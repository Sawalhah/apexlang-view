(function () {
  const vscode = acquireVsCodeApi();

  // Without this, an exception inside the webview just silently blanks or
  // freezes the panel — invisible unless dev tools happen to be open.
  // Report it to the extension's output channel instead.
  window.addEventListener('error', (ev) => {
    vscode.postMessage({
      type: 'error',
      message: ev.message,
      stack: ev.error && ev.error.stack,
    });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    vscode.postMessage({
      type: 'error',
      message: 'Unhandled promise rejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)),
      stack: ev.reason && ev.reason.stack,
    });
  });

  // Icon per component type — a plain unicode glyph, no icon font/sprite
  // sheet to bundle.
  const TYPE_ICON = {
    app: '▣', page: '▤', region: '▢', pageItem: '✎', button: '⬚',
    action: '⚡', process: '⚙', substitution: '§', validation: '✓',
    dynamicAction: '⚡', installScript: '⚒', plugin: '◆', externalPage: '⇲',
  };
  function iconFor(typeName) {
    return TYPE_ICON[typeName] || '●';
  }

  // A small, deliberate category system — 4 groups, not a color-per-type
  // rainbow (that was the problem we just fixed). Applied only to the icon
  // glyph and a tinted "type pill," never a fill/background/border on the
  // row itself, so it stays restrained and never fights the row-selection
  // highlight that already uses the theme's own accent. Colors are
  // `--vscode-charts-*` tokens — real theme tokens meant for exactly this
  // (diagram/data-viz accents), so this still adapts to light/dark/custom
  // themes instead of being hardcoded like the old 12-hue map was.
  const TYPE_CATEGORY = {
    app: 'structural', page: 'structural', region: 'structural',
    pageItem: 'interactive', button: 'interactive', action: 'interactive', dynamicAction: 'interactive',
    process: 'logic', validation: 'logic', substitution: 'logic',
    plugin: 'external', installScript: 'external', externalPage: 'external',
  };
  function categoryFor(typeName) {
    return TYPE_CATEGORY[typeName] || 'neutral';
  }

  // ---- Graph (canvas) view constants — SVG boxes-and-wires, an alternate
  // view alongside Tree/By Type for anyone who wants the visual
  // node-and-edge layout back. Shares all the same underlying state
  // (currentGraph, collapsed, selectedNodeId) as the other two views.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const NODE_W = 168;
  const NODE_H = 46;
  const H_GAP = 30;
  const V_GAP = 84;
  let view = { x: 0, y: 0, scale: 1 };
  let svgEl = null;

  const treeRoot = document.getElementById('graph-root');
  const nodeCountEl = document.getElementById('node-count');
  const fileLabelEl = document.getElementById('file-label');
  const searchBox = document.getElementById('search-box');
  const searchCountEl = document.getElementById('search-count');
  const detailPanel = document.getElementById('detail-panel');
  const detailBadge = document.getElementById('detail-badge');
  const detailTitle = document.getElementById('detail-title');
  const detailBody = document.getElementById('detail-body');
  const detailBreadcrumb = document.getElementById('detail-breadcrumb');
  const detailRefs = document.getElementById('detail-refs');
  const warningBanner = document.getElementById('warning-banner');
  document.getElementById('detail-close').addEventListener('click', () => {
    detailPanel.classList.add('hidden');
  });
  document.getElementById('switch-file').addEventListener('click', () => {
    vscode.postMessage({ type: 'switchFile' });
  });
  document.getElementById('app-map').addEventListener('click', () => {
    vscode.postMessage({ type: 'openAppMap' });
  });

  let currentGraph = null;
  let currentFileName = null;
  let selectedNodeId = null;
  let collapsed = new Set(); // node ids (or 'type:<typeName>' group ids)
  let searchQuery = '';
  let matchIds = new Set();
  let matchOrder = [];
  let matchCursor = -1;
  // 'tree' (default, hierarchical containment) or 'byType' (flat groups, one
  // per typeName across the whole file, ignoring containment — for scanning
  // "how many regions/buttons/page items does this page have").
  let viewMode = 'tree';
  // Whole-app page map (roadmap #2) is a separate top-level state, not a
  // fourth VIEW_MODES entry — it's cross-file data (pages + nav edges), not
  // another way to look at the current single-file graph, so it fully
  // replaces the tree/byType/graph container instead of toggling within it.
  let showingAppMap = false;
  let appMapData = null;

  const VIEW_MODES = ['tree', 'byType', 'graph'];
  const VIEW_LABELS = { tree: 'View: Tree', byType: 'View: By Type', graph: 'View: Graph' };
  const viewToggleBtn = document.getElementById('view-toggle');
  viewToggleBtn.addEventListener('click', () => {
    viewMode = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
    viewToggleBtn.textContent = VIEW_LABELS[viewMode];
    treeRoot.classList.toggle('canvas-mode', viewMode === 'graph');
    selectedNodeId = null;
    detailPanel.classList.add('hidden');
    render({ fit: true });
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'fileChanged') {
      showingAppMap = false;
      fileLabelEl.textContent = msg.fileName;
      detailPanel.classList.add('hidden');
      selectedNodeId = null;
      searchBox.value = '';
      searchQuery = '';
      applySearch();
      return;
    }
    if (msg.type === 'appMap') {
      showingAppMap = true;
      appMapData = msg.appMap;
      detailPanel.classList.add('hidden');
      render();
      return;
    }
    if (msg.type === 'graph') {
      showingAppMap = false;
      const isNewFile = currentGraph === null || msg.fileName !== currentFileName;
      currentGraph = msg.graph;
      currentFileName = msg.fileName;
      fileLabelEl.textContent = msg.fileName;
      nodeCountEl.textContent = `${currentGraph.nodes.length} nodes`;
      if (isNewFile) {
        // Fresh file: start with big same-type sibling groups collapsed
        // (e.g. an interactive report's 20+ columns) so the tree opens
        // legible instead of a wall of rows — still one click away.
        collapsed = autoCollapseDefaults(currentGraph);
      } else {
        const validIds = new Set(currentGraph.nodes.map((n) => n.id));
        collapsed = new Set([...collapsed].filter((id) => validIds.has(id) || id.startsWith('type:')));
      }
      if (msg.quality && msg.quality.suspicious) {
        warningBanner.textContent = '⚠ ' + msg.quality.reasons.join(' ');
        warningBanner.classList.remove('hidden');
      } else {
        warningBanner.classList.add('hidden');
      }
      // Fit-to-view on a genuinely new file (Graph view's pan/zoom has no
      // meaningful state yet); a live-edit refresh of the SAME file keeps
      // whatever pan/zoom the user currently has, same reasoning as the
      // original canvas view — resetting it on every keystroke was jarring.
      render({ fit: isNewFile });
      return;
    }
  });

  // ---- Graph structure helpers (containment-only unless noted) ----

  function isContainmentEdge(e) {
    return (e.kind || 'contains') === 'contains';
  }

  function buildChildrenMap() {
    const map = {};
    for (const e of currentGraph.edges) {
      if (!isContainmentEdge(e)) continue;
      if (!map[e.from]) map[e.from] = [];
      map[e.from].push(e.to);
    }
    return map;
  }

  function buildParentMap() {
    const map = {};
    for (const e of currentGraph.edges) {
      if (!isContainmentEdge(e)) continue;
      map[e.to] = e.from;
    }
    return map;
  }

  function buildRoots() {
    const hasParent = new Set(currentGraph.edges.filter(isContainmentEdge).map((e) => e.to));
    // External page stubs (roadmap #3) never get their own row — they're
    // shown as a "Navigates to Page N" line in the detail panel of whichever
    // button/branch triggers them, not a structural part of this file.
    return currentGraph.nodes.filter((n) => !hasParent.has(n.id) && !n.external);
  }

  // Auto-collapse any parent whose children are mostly one repetitive leaf
  // type in large numbers (columns, LOV entries, ...) — opens legible by
  // default without losing anything; one click away via the disclosure
  // triangle. Threshold matches what used to trigger the old compact-list
  // box rendering.
  const AUTO_COLLAPSE_THRESHOLD = 8;
  function autoCollapseDefaults(graph) {
    const childrenOf = {};
    for (const e of graph.edges) {
      if (!isContainmentEdge(e)) continue;
      if (!childrenOf[e.from]) childrenOf[e.from] = [];
      childrenOf[e.from].push(e.to);
    }
    const out = new Set();
    for (const [parentId, kids] of Object.entries(childrenOf)) {
      if (kids.length >= AUTO_COLLAPSE_THRESHOLD) out.add(parentId);
    }
    return out;
  }

  function byIdMap() {
    const byId = {};
    for (const n of currentGraph.nodes) byId[n.id] = n;
    return byId;
  }

  // ---- Search (matching engine lives in search-logic.js, DOM-free) ----

  function applySearch() {
    if (!currentGraph || !searchQuery) {
      matchIds = new Set();
      matchOrder = [];
      matchCursor = -1;
      searchCountEl.textContent = '';
      return;
    }
    const result = window.ApxSearchLogic.computeMatches(currentGraph, searchQuery);
    matchIds = result.matchIds;
    matchOrder = result.matchOrder;
    matchCursor = -1;
    for (const ancestor of result.ancestorsToExpand) collapsed.delete(ancestor);
    searchCountEl.textContent = matchOrder.length
      ? `${matchOrder.length} match${matchOrder.length === 1 ? '' : 'es'}`
      : 'no matches';
  }

  searchBox.addEventListener('input', () => {
    searchQuery = searchBox.value.trim().toLowerCase();
    applySearch();
    render();
  });

  searchBox.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || matchOrder.length === 0) return;
    matchCursor = (matchCursor + 1) % matchOrder.length;
    selectAndReveal(matchOrder[matchCursor], { jumpToSource: false });
  });

  document.getElementById('expand-all').addEventListener('click', () => {
    collapsed = new Set();
    render({ fit: true });
  });
  document.getElementById('collapse-all').addEventListener('click', () => {
    if (!currentGraph) return;
    const childrenOf = buildChildrenMap();
    const next = new Set(
      currentGraph.nodes.filter((n) => (childrenOf[n.id] || []).length > 0).map((n) => n.id)
    );
    // Also collapse every "By Type" group header, regardless of which view
    // is currently active — collapse-all's own node ids have no visible
    // effect in that view (members render flat, with no disclosure of
    // their own), so without this it would look like Collapse All "does
    // nothing" whenever you're in By Type view.
    for (const n of currentGraph.nodes) {
      if (!n.external) next.add(`type:${n.typeName}`);
    }
    collapsed = next;
    render({ fit: true });
  });

  // ---- Tree rendering (indented outline, like Page Designer's Rendering
  // tree / VS Code's own Explorer — no floating boxes, no canvas, no
  // pan/zoom. Only currently-visible rows are ever in the DOM.) ----

  function render(opts) {
    treeRoot.innerHTML = '';
    if (showingAppMap) {
      renderAppMap();
      return;
    }
    if (!currentGraph) return;

    if (viewMode === 'byType') {
      renderByType();
    } else if (viewMode === 'graph') {
      renderGraphView(!!(opts && opts.fit));
    } else {
      renderTree();
    }
  }

  function renderTree() {
    const childrenOf = buildChildrenMap();
    const byId = byIdMap();
    const roots = buildRoots();
    const frag = document.createDocumentFragment();
    for (const root of roots) appendRow(frag, root, 0, childrenOf, byId);
    treeRoot.appendChild(frag);
  }

  function appendRow(container, node, depth, childrenOf, byId) {
    const kids = (childrenOf[node.id] || []).filter((id) => byId[id]);
    const isCollapsed = collapsed.has(node.id);
    container.appendChild(buildRowEl(node, depth, kids.length, isCollapsed));
    if (kids.length > 0 && !isCollapsed) {
      for (const kidId of kids) appendRow(container, byId[kidId], depth + 1, childrenOf, byId);
    }
  }

  // Whole-app page map (roadmap #2): a plain list of pages, each with a
  // "Navigates to" line of clickable page chips — deliberately not a
  // boxes-and-wires canvas like the Graph view. Reuses the same row/link
  // primitives as the References panel (renderReferences) rather than
  // inventing new layout machinery for what's still just a small list in
  // realistic apps (tens, not hundreds, of pages).
  function renderAppMap() {
    if (!appMapData) return;
    nodeCountEl.textContent = `${appMapData.pages.length} page${appMapData.pages.length === 1 ? '' : 's'}`;
    fileLabelEl.textContent = 'App Map';

    const outgoingByPage = {};
    for (const e of appMapData.edges) {
      if (!outgoingByPage[e.from]) outgoingByPage[e.from] = [];
      outgoingByPage[e.from].push(e.to);
    }
    const pageByNumber = {};
    for (const p of appMapData.pages) pageByNumber[p.pageNumber] = p;

    const frag = document.createDocumentFragment();
    for (const page of appMapData.pages) {
      const row = document.createElement('div');
      row.className = 'app-map-row';

      const title = document.createElement('div');
      title.className = 'app-map-page-title';
      title.textContent = `Page ${page.pageNumber} — ${page.label}`;
      title.addEventListener('click', () => {
        vscode.postMessage({ type: 'openExternalPage', targetFsPath: page.fsPath, label: page.label });
      });
      row.appendChild(title);

      const targets = outgoingByPage[page.pageNumber] || [];
      if (targets.length > 0) {
        const nav = document.createElement('div');
        nav.className = 'app-map-nav';
        nav.appendChild(document.createTextNode('Navigates to: '));
        targets.forEach((targetPageNumber, i) => {
          const target = pageByNumber[targetPageNumber];
          if (!target) return;
          const chip = document.createElement('span');
          chip.className = 'app-map-chip';
          chip.textContent = `Page ${target.pageNumber}`;
          chip.addEventListener('click', () => {
            vscode.postMessage({ type: 'openExternalPage', targetFsPath: target.fsPath, label: target.label });
          });
          nav.appendChild(chip);
          if (i < targets.length - 1) nav.appendChild(document.createTextNode(' '));
        });
        row.appendChild(nav);
      }

      frag.appendChild(row);
    }
    treeRoot.appendChild(frag);
  }

  function renderByType() {
    const byId = byIdMap();
    const groups = {};
    for (const n of currentGraph.nodes) {
      if (n.external) continue;
      if (!groups[n.typeName]) groups[n.typeName] = [];
      groups[n.typeName].push(n);
    }
    const typeNames = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    const frag = document.createDocumentFragment();
    for (const typeName of typeNames) {
      const groupId = `type:${typeName}`;
      const members = groups[typeName];
      const isCollapsed = collapsed.has(groupId);
      frag.appendChild(buildGroupHeaderEl(groupId, typeName, members.length, isCollapsed));
      if (!isCollapsed) {
        for (const n of members) frag.appendChild(buildRowEl(n, 1, 0, false));
      }
    }
    treeRoot.appendChild(frag);
  }

  // ---- Graph (canvas) view — SVG boxes-and-wires. Layout tree uses
  // containment PLUS navigation edges (a nav-target stub is positioned as a
  // visual child directly below its trigger); reference edges are drawn
  // separately as cross-links once every node has a position. ----

  function buildLayoutChildrenMap() {
    const map = {};
    for (const e of currentGraph.edges) {
      const isNav = e.kind === 'navigation';
      if (!isContainmentEdge(e) && !isNav) continue;
      if (!map[e.from]) map[e.from] = [];
      map[e.from].push(e.to);
    }
    return map;
  }

  function renderGraphView(fit) {
    const byId = byIdMap();
    const childrenOf = buildChildrenMap();
    const layoutChildrenOf = buildLayoutChildrenMap();
    const hasParent = new Set(currentGraph.edges.filter(isContainmentEdge).map((e) => e.to));
    const roots = currentGraph.nodes.filter((n) => !hasParent.has(n.id) && !n.external);

    const positions = {};
    let nextX = 0;
    const visiting = new Set();

    function layout(nodeId, depth) {
      if (visiting.has(nodeId)) {
        positions[nodeId] = { x: nextX * (NODE_W + H_GAP), y: depth * V_GAP };
        nextX += 1;
        return;
      }
      visiting.add(nodeId);
      const kids = (layoutChildrenOf[nodeId] || []).filter((id) => byId[id]);
      const isCollapsed = collapsed.has(nodeId);
      if (kids.length === 0 || isCollapsed) {
        positions[nodeId] = { x: nextX * (NODE_W + H_GAP), y: depth * V_GAP };
        nextX += 1;
        visiting.delete(nodeId);
        return;
      }
      const startX = nextX;
      for (const kid of kids) layout(kid, depth + 1);
      const endX = nextX;
      const centerSlot = (startX + endX - 1) / 2;
      positions[nodeId] = { x: centerSlot * (NODE_W + H_GAP), y: depth * V_GAP };
      visiting.delete(nodeId);
    }
    for (const root of roots) layout(root.id, 0);

    const MARGIN = 32;
    for (const id in positions) {
      positions[id].x += MARGIN;
      positions[id].y += MARGIN;
    }
    let maxX = 0, maxY = 0;
    for (const id in positions) {
      maxX = Math.max(maxX, positions[id].x + NODE_W);
      maxY = Math.max(maxY, positions[id].y + NODE_H);
    }

    const svg = document.createElementNS(SVG_NS, 'svg');
    svgEl = svg;
    svg.setAttribute('id', 'graph-svg');
    svg.setAttribute('width', maxX + 40);
    svg.setAttribute('height', maxY + 40);

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML =
      '<marker id="ref-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" class="ref-arrow-head"/></marker>' +
      '<marker id="nav-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" class="nav-arrow-head"/></marker>';
    svg.appendChild(defs);

    const edgesGroup = document.createElementNS(SVG_NS, 'g');
    function visibleContainmentEdges() {
      const out = [];
      const seen = new Set();
      function walk(nodeId) {
        if (seen.has(nodeId)) return;
        seen.add(nodeId);
        if (collapsed.has(nodeId)) return;
        for (const kid of childrenOf[nodeId] || []) {
          if (!byId[kid]) continue;
          out.push({ from: nodeId, to: kid });
          walk(kid);
        }
      }
      for (const r of roots) walk(r.id);
      return out;
    }
    for (const e of visibleContainmentEdges()) {
      const p1 = positions[e.from], p2 = positions[e.to];
      if (!p1 || !p2) continue;
      edgesGroup.appendChild(bezierPath(p1, p2, 'edge-path'));
    }
    // Navigation edges (stub positioned as a layout-child of its trigger).
    for (const e of currentGraph.edges.filter((e) => e.kind === 'navigation')) {
      const p1 = positions[e.from], p2 = positions[e.to];
      if (!p1 || !p2) continue;
      edgesGroup.appendChild(bezierPath(p1, p2, 'nav-edge-path', 'nav-arrow'));
    }
    svg.appendChild(edgesGroup);

    const nodesGroup = document.createElementNS(SVG_NS, 'g');
    for (const id in positions) {
      const node = byId[id];
      const kids = (childrenOf[id] || []).filter((k) => byId[k]);
      nodesGroup.appendChild(buildGraphNodeEl(node, positions[id], kids.length));
    }
    svg.appendChild(nodesGroup);

    // Reference edges drawn last (on top) — dashed cross-links, only when
    // both endpoints currently have a position (not hidden by collapse).
    const refGroup = document.createElementNS(SVG_NS, 'g');
    for (const e of currentGraph.edges.filter((e) => e.kind === 'reference')) {
      const p1 = positions[e.from], p2 = positions[e.to];
      if (!p1 || !p2) continue;
      const path = straightPath(p1, p2, 'ref-edge-path', 'ref-arrow');
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = `${e.via}: ${byId[e.to].label || byId[e.to].identifier}`;
      path.appendChild(title);
      refGroup.appendChild(path);
    }
    svg.appendChild(refGroup);

    treeRoot.appendChild(svg);

    if (fit) {
      const vw = treeRoot.clientWidth || 800;
      const vh = treeRoot.clientHeight || 600;
      const contentW = maxX + 40;
      const contentH = maxY + 40;
      const scale = Math.min(1.2, Math.max(0.15, Math.min(vw / contentW, vh / contentH) * 0.9));
      view = { x: (vw - contentW * scale) / 2, y: Math.max(20, (vh - contentH * scale) / 2), scale };
    }
    applyGraphTransform();
  }

  function bezierPath(p1, p2, className, markerId) {
    const x1 = p1.x + NODE_W / 2, y1 = p1.y + NODE_H;
    const x2 = p2.x + NODE_W / 2, y2 = p2.y;
    const midY = (y1 + y2) / 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
    path.setAttribute('class', className);
    if (markerId) path.setAttribute('marker-end', `url(#${markerId})`);
    return path;
  }

  function straightPath(p1, p2, className, markerId) {
    const x1 = p1.x + NODE_W / 2, y1 = p1.y + NODE_H / 2;
    const x2 = p2.x + NODE_W / 2, y2 = p2.y + NODE_H / 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute('class', className);
    if (markerId) path.setAttribute('marker-end', `url(#${markerId})`);
    return path;
  }

  function buildGraphNodeEl(node, pos, kidsCount) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    g.setAttribute('data-node-id', node.id);
    const category = categoryFor(node.typeName);
    const classes = ['gnode'];
    if (node.id === selectedNodeId) classes.push('selected');
    if (node.external) classes.push('external');
    if (searchQuery) classes.push(matchIds.has(node.id) ? 'match' : 'dimmed');
    g.setAttribute('class', classes.join(' '));

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', NODE_W);
    rect.setAttribute('height', NODE_H);
    rect.setAttribute('rx', 8);
    rect.setAttribute('class', 'gnode-rect');
    g.appendChild(rect);

    const icon = document.createElementNS(SVG_NS, 'text');
    icon.setAttribute('x', 12);
    icon.setAttribute('y', 18);
    icon.setAttribute('class', `gnode-icon cat-${category}`);
    icon.textContent = iconFor(node.typeName);
    g.appendChild(icon);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', 12);
    label.setAttribute('y', 33);
    label.setAttribute('class', 'gnode-label');
    label.textContent = truncateText(node.label || node.identifier || '(unnamed)', 20);
    g.appendChild(label);

    const typeLabel = document.createElementNS(SVG_NS, 'text');
    typeLabel.setAttribute('x', 12);
    typeLabel.setAttribute('y', 43);
    typeLabel.setAttribute('class', 'gnode-type');
    typeLabel.textContent = node.typeName;
    g.appendChild(typeLabel);

    if (kidsCount > 0) {
      const toggle = document.createElementNS(SVG_NS, 'text');
      toggle.setAttribute('x', NODE_W - 10);
      toggle.setAttribute('y', 16);
      toggle.setAttribute('text-anchor', 'end');
      toggle.setAttribute('class', 'gnode-toggle');
      toggle.textContent = collapsed.has(node.id) ? `+${kidsCount}` : '−';
      toggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (collapsed.has(node.id)) collapsed.delete(node.id);
        else collapsed.add(node.id);
        render();
      });
      g.appendChild(toggle);
    }

    g.addEventListener('click', () => {
      if (node.external) {
        requestOpenExternalPage(node);
        return;
      }
      selectAndReveal(node.id, { jumpToSource: true });
    });

    return g;
  }

  function truncateText(str, n) {
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  function applyGraphTransform() {
    if (!svgEl) return;
    svgEl.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }

  function centerGraphOnNode(nodeId) {
    if (!svgEl) return;
    const el = treeRoot.querySelector(`[data-node-id="${nodeId}"]`);
    if (!el) return;
    const m = el.getAttribute('transform').match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
    if (!m) return;
    const x = parseFloat(m[1]), y = parseFloat(m[2]);
    const vw = treeRoot.clientWidth || 800;
    const vh = treeRoot.clientHeight || 600;
    view.x = vw / 2 - (x + NODE_W / 2) * view.scale;
    view.y = vh / 2 - (y + NODE_H / 2) * view.scale;
    applyGraphTransform();
  }

  // Pan + zoom — only meaningful in Graph view; Tree/By Type use native
  // scroll, so these no-op unless viewMode === 'graph'.
  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  treeRoot.addEventListener('mousedown', (ev) => {
    if (viewMode !== 'graph') return;
    dragging = true;
    treeRoot.classList.add('dragging');
    dragStart = { x: ev.clientX - view.x, y: ev.clientY - view.y };
  });
  window.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    view.x = ev.clientX - dragStart.x;
    view.y = ev.clientY - dragStart.y;
    applyGraphTransform();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    treeRoot.classList.remove('dragging');
  });
  treeRoot.addEventListener('wheel', (ev) => {
    if (viewMode !== 'graph') return;
    ev.preventDefault();
    const delta = ev.deltaY > 0 ? 0.9 : 1.1;
    view.scale = Math.min(3, Math.max(0.2, view.scale * delta));
    applyGraphTransform();
  }, { passive: false });

  function buildGroupHeaderEl(groupId, typeName, count, isCollapsed) {
    const row = document.createElement('div');
    row.className = 'tree-row group-header';
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-expanded', String(!isCollapsed));
    row.dataset.groupId = groupId;
    row.style.paddingLeft = '4px';

    row.appendChild(disclosureEl(count > 0, isCollapsed));
    const label = document.createElement('span');
    label.className = 'row-label group-label';
    label.textContent = `${typeName} (${count})`;
    row.appendChild(label);

    row.addEventListener('click', () => {
      if (collapsed.has(groupId)) collapsed.delete(groupId);
      else collapsed.add(groupId);
      render();
    });
    return row;
  }

  function disclosureEl(hasKids, isCollapsed) {
    const span = document.createElement('span');
    span.className = 'disclosure' + (hasKids && !isCollapsed ? ' expanded' : '');
    span.textContent = hasKids ? '▸' : '';
    return span;
  }

  function buildRowEl(node, depth, kidsCount, isCollapsed) {
    const row = document.createElement('div');
    const classes = ['tree-row'];
    if (node.id === selectedNodeId) classes.push('selected');
    if (searchQuery) classes.push(matchIds.has(node.id) ? 'match' : 'dimmed');
    row.className = classes.join(' ');
    row.setAttribute('role', 'treeitem');
    if (kidsCount > 0) row.setAttribute('aria-expanded', String(!isCollapsed));
    row.dataset.nodeId = node.id;
    row.style.paddingLeft = `${4 + depth * 16}px`;
    row.tabIndex = -1;

    row.appendChild(disclosureEl(kidsCount > 0, isCollapsed));

    const category = categoryFor(node.typeName);
    const icon = document.createElement('span');
    icon.className = `row-icon cat-${category}`;
    icon.textContent = iconFor(node.typeName);
    row.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = node.label || node.identifier || '(unnamed)';
    row.appendChild(label);

    const typeTag = document.createElement('span');
    typeTag.className = `row-type cat-${category}`;
    typeTag.textContent = node.typeName;
    row.appendChild(typeTag);

    const navTargets = navTargetsFor(node.id);
    if (navTargets.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'row-nav-badge';
      badge.textContent = `→ ${navTargets[0].label}${navTargets.length > 1 ? ` +${navTargets.length - 1}` : ''}`;
      badge.title = 'Navigate to this page';
      badge.addEventListener('click', (ev) => {
        ev.stopPropagation();
        requestOpenExternalPage(navTargets[0]);
      });
      row.appendChild(badge);
    }

    row.addEventListener('click', () => {
      if (kidsCount > 0) {
        if (collapsed.has(node.id)) collapsed.delete(node.id);
        else collapsed.add(node.id);
      }
      selectAndReveal(node.id, { jumpToSource: true });
    });

    return row;
  }

  function requestOpenExternalPage(stubNode) {
    vscode.postMessage({ type: 'openExternalPage', targetFsPath: stubNode.targetFsPath, label: stubNode.label });
  }

  // ---- Cross-reference / navigation lookups (shown in the detail panel,
  // not as separate floating nodes — matches how Page Designer surfaces
  // related info in the properties panel, not the tree itself). ----

  function navTargetsFor(nodeId) {
    const byId = byIdMap();
    return currentGraph.edges
      .filter((e) => e.kind === 'navigation' && e.from === nodeId)
      .map((e) => byId[e.to])
      .filter(Boolean);
  }

  function referencesFor(nodeId) {
    const byId = byIdMap();
    const outgoing = currentGraph.edges
      .filter((e) => e.kind === 'reference' && e.from === nodeId)
      .map((e) => ({ via: e.via, node: byId[e.to] }))
      .filter((r) => r.node);
    const incoming = currentGraph.edges
      .filter((e) => e.kind === 'reference' && e.to === nodeId)
      .map((e) => ({ via: e.via, node: byId[e.from] }))
      .filter((r) => r.node);
    return { outgoing, incoming };
  }

  // ---- Selection / detail panel ----

  function selectAndReveal(nodeId, opts) {
    const byId = byIdMap();
    const node = byId[nodeId];
    if (!node) return;
    expandAncestorsOf(nodeId);
    selectedNodeId = nodeId;
    render();
    if (viewMode === 'graph') {
      centerGraphOnNode(nodeId);
    } else {
      const el = treeRoot.querySelector(`[data-node-id="${nodeId}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
    showDetail(node);
    if (opts && opts.jumpToSource && typeof node.line === 'number') {
      vscode.postMessage({ type: 'revealLine', line: node.line });
    }
  }

  function expandAncestorsOf(nodeId) {
    const parentOf = buildParentMap();
    let cur = parentOf[nodeId];
    while (cur) {
      collapsed.delete(cur);
      cur = parentOf[cur];
    }
  }

  function showDetail(node) {
    detailBadge.className = `cat-badge cat-${categoryFor(node.typeName)}`;
    detailBadge.textContent = iconFor(node.typeName);
    detailTitle.textContent = `${node.typeName} ${node.identifier || ''}`.trim();
    renderPropsGrid(node);
    renderBreadcrumb(node.id);
    renderReferences(node.id);
    detailPanel.classList.remove('hidden');
  }

  // A real label/value inspector grid instead of a flat "key: value" text
  // dump — same idea as a Figma/VS Code properties panel: consistent label
  // column, values get their own column so they actually line up.
  function renderPropsGrid(node) {
    detailBody.innerHTML = '';
    const entries = Object.entries(node.props || {});
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'props-empty';
      empty.textContent = 'No scalar properties';
      detailBody.appendChild(empty);
      return;
    }
    for (const [key, value] of entries) {
      const row = document.createElement('div');
      row.className = 'props-row';
      const label = document.createElement('span');
      label.className = 'props-label';
      label.textContent = key;
      const val = document.createElement('span');
      val.className = 'props-value';
      val.textContent = value;
      row.appendChild(label);
      row.appendChild(val);
      detailBody.appendChild(row);
    }
  }

  function renderBreadcrumb(nodeId) {
    const parentOf = buildParentMap();
    const byId = byIdMap();
    const chain = [];
    const visited = new Set();
    let cur = nodeId;
    while (cur && byId[cur] && !visited.has(cur)) {
      visited.add(cur);
      chain.unshift(byId[cur]);
      cur = parentOf[cur];
    }
    detailBreadcrumb.innerHTML = '';
    chain.forEach((n, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.textContent = ' › ';
        sep.className = 'breadcrumb-sep';
        detailBreadcrumb.appendChild(sep);
      }
      const seg = document.createElement('span');
      seg.textContent = n.label || n.identifier || n.typeName;
      seg.className = i === chain.length - 1 ? 'breadcrumb-seg current' : 'breadcrumb-seg';
      if (i < chain.length - 1) {
        seg.addEventListener('click', () => selectAndReveal(n.id, { jumpToSource: true }));
      }
      detailBreadcrumb.appendChild(seg);
    });
  }

  // References section — this is where cross-reference/navigation info
  // lives instead of separate floating graph nodes, same way Page
  // Designer surfaces related info in its properties panel rather than
  // drawing it into the Rendering tree itself.
  function renderReferences(nodeId) {
    detailRefs.innerHTML = '';
    const { outgoing, incoming } = referencesFor(nodeId);
    const navTargets = navTargetsFor(nodeId);
    if (outgoing.length === 0 && incoming.length === 0 && navTargets.length === 0) {
      detailRefs.classList.add('hidden');
      return;
    }
    detailRefs.classList.remove('hidden');

    const addSection = (title, items, isExternal) => {
      if (items.length === 0) return;
      const heading = document.createElement('div');
      heading.className = 'refs-heading';
      heading.textContent = title;
      detailRefs.appendChild(heading);
      for (const item of items) {
        const line = document.createElement('div');
        line.className = 'refs-line';
        line.textContent = item.text;
        if (!isExternal) {
          line.classList.add('clickable');
          line.addEventListener('click', () => selectAndReveal(item.id, { jumpToSource: true }));
        } else {
          line.classList.add('clickable');
          line.addEventListener('click', () => requestOpenExternalPage(item.stub));
        }
        detailRefs.appendChild(line);
      }
    };

    addSection(
      'References',
      outgoing.map((r) => ({ text: `↗ ${r.via}: ${r.node.label || r.node.identifier}`, id: r.node.id }))
    );
    addSection(
      'Referenced by',
      incoming.map((r) => ({ text: `↙ ${r.node.label || r.node.identifier} (${r.via})`, id: r.node.id }))
    );
    addSection(
      'Navigation',
      navTargets.map((stub) => ({ text: `⇲ Navigates to ${stub.label}`, stub })),
      true
    );
  }

  // ---- Keyboard navigation: standard tree-widget semantics — Up/Down move
  // to the previous/next VISIBLE row in document order, Right expands (or
  // moves into the first child if already expanded), Left collapses (or
  // moves to the parent if already collapsed/a leaf). Never fires while the
  // search box has focus. ----

  const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  document.addEventListener('keydown', (ev) => {
    if (document.activeElement === searchBox) return;
    if (!selectedNodeId || !currentGraph) return;
    if (!ARROW_KEYS.has(ev.key)) return;
    ev.preventDefault();

    const rows = Array.from(treeRoot.querySelectorAll('[data-node-id]'));
    const idx = rows.findIndex((r) => r.dataset.nodeId === selectedNodeId);
    if (idx === -1) return;

    if (ev.key === 'ArrowDown') {
      const next = rows[idx + 1];
      if (next) selectAndReveal(next.dataset.nodeId, { jumpToSource: true });
      return;
    }
    if (ev.key === 'ArrowUp') {
      const prev = rows[idx - 1];
      if (prev) selectAndReveal(prev.dataset.nodeId, { jumpToSource: true });
      return;
    }

    const childrenOf = buildChildrenMap();
    const byId = byIdMap();
    const kids = (childrenOf[selectedNodeId] || []).filter((id) => byId[id]);

    if (ev.key === 'ArrowRight') {
      if (kids.length === 0) return;
      if (collapsed.has(selectedNodeId)) {
        collapsed.delete(selectedNodeId);
        render();
      } else {
        selectAndReveal(kids[0], { jumpToSource: true });
      }
      return;
    }
    if (ev.key === 'ArrowLeft') {
      if (kids.length > 0 && !collapsed.has(selectedNodeId)) {
        collapsed.add(selectedNodeId);
        render();
      } else {
        const parentOf = buildParentMap();
        const parentId = parentOf[selectedNodeId];
        if (parentId) selectAndReveal(parentId, { jumpToSource: true });
      }
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
