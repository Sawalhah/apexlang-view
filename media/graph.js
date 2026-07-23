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

  const viewToggleBtn = document.getElementById('view-toggle');
  viewToggleBtn.addEventListener('click', () => {
    viewMode = viewMode === 'tree' ? 'byType' : 'tree';
    viewToggleBtn.textContent = viewMode === 'tree' ? 'View: Tree' : 'View: By Type';
    selectedNodeId = null;
    detailPanel.classList.add('hidden');
    render();
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'fileChanged') {
      fileLabelEl.textContent = msg.fileName;
      detailPanel.classList.add('hidden');
      selectedNodeId = null;
      searchBox.value = '';
      searchQuery = '';
      applySearch();
      return;
    }
    if (msg.type === 'graph') {
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
      render();
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
    render();
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
    render();
  });

  // ---- Tree rendering (indented outline, like Page Designer's Rendering
  // tree / VS Code's own Explorer — no floating boxes, no canvas, no
  // pan/zoom. Only currently-visible rows are ever in the DOM.) ----

  function render() {
    treeRoot.innerHTML = '';
    if (!currentGraph) return;

    if (viewMode === 'byType') {
      renderByType();
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
    const el = treeRoot.querySelector(`[data-node-id="${nodeId}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
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
