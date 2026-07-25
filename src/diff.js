// Git-diff indicators (next-version feature, agreed 2026-07-25 office-hours
// session): compares two parsed graphs of the SAME file (e.g. working tree vs
// HEAD) and classifies nodes as added/removed/changed. Deliberately pure —
// no git, no filesystem, no vscode — so it's unit-testable under plain
// `node --test`, matching page-nav.js/app-map.js's pattern. The caller (a
// future extension.js wiring, not yet built) is responsible for producing
// the two graphs to compare (e.g. via parseApxToGraph on the working copy
// and on `git show <ref>:<path>`).
//
// Nodes are matched across the two graphs by a structural PATH, not by
// node.id — ids are just positional ("n0", "n1", ...) assigned during a
// single parse, so they're meaningless across two independent parses of
// possibly-different text. The path is built from containment edges: each
// node's path is its parent's path + its own typeName, disambiguated by
// `identifier` when the node has one (stable across reordering/insertion)
// or by sibling index among same-typed anonymous siblings otherwise (a
// known, accepted limitation — inserting a new anonymous same-typed sibling
// before an existing one can misalign matching for siblings after it; named
// blocks, which cover the vast majority of real nodes, are unaffected).

function isContainmentEdge(e) {
  return (e.kind || 'contains') === 'contains';
}

function buildChildrenMap(graph) {
  const map = new Map();
  for (const e of graph.edges) {
    if (!isContainmentEdge(e)) continue;
    if (!map.has(e.from)) map.set(e.from, []);
    map.get(e.from).push(e.to);
  }
  return map;
}

function buildRoots(graph) {
  const hasParent = new Set(graph.edges.filter(isContainmentEdge).map((e) => e.to));
  return graph.nodes.filter((n) => !hasParent.has(n.id) && !n.external);
}

function nextSiblingIndex(counters, typeName) {
  const n = (counters.get(typeName) || 0) + 1;
  counters.set(typeName, n);
  return n;
}

// Returns Map<pathKey, node> for every node in `graph`.
function buildPathIndex(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const childrenOf = buildChildrenMap(graph);
  const index = new Map();

  function visitChildren(parentKey, parentId) {
    const kids = (childrenOf.get(parentId) || []).map((id) => byId.get(id)).filter(Boolean);
    const anonCounters = new Map();
    for (const kid of kids) {
      const kidKey = kid.identifier
        ? `${parentKey}/${kid.typeName}:${kid.identifier}`
        : `${parentKey}/${kid.typeName}#${nextSiblingIndex(anonCounters, kid.typeName)}`;
      index.set(kidKey, kid);
      visitChildren(kidKey, kid.id);
    }
  }

  const rootCounters = new Map();
  for (const root of buildRoots(graph)) {
    const key = root.identifier
      ? `${root.typeName}:${root.identifier}`
      : `${root.typeName}#${nextSiblingIndex(rootCounters, root.typeName)}`;
    index.set(key, root);
    visitChildren(key, root.id);
  }
  return index;
}

function propsEqual(a, b) {
  const propsA = a.props || {};
  const propsB = b.props || {};
  const keysA = Object.keys(propsA);
  const keysB = Object.keys(propsB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (propsA[key] !== propsB[key]) return false;
  }
  return a.label === b.label;
}

// Returns { added: [nodeId in newGraph], removed: [nodeId in oldGraph],
// changed: [nodeId in newGraph] } — added/changed reference newGraph's node
// ids (what the caller is currently rendering), removed references
// oldGraph's ids (there's no equivalent node in newGraph to point at).
function diffGraphs(oldGraph, newGraph) {
  const oldIndex = buildPathIndex(oldGraph);
  const newIndex = buildPathIndex(newGraph);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, node] of newIndex) {
    if (!oldIndex.has(key)) {
      added.push(node.id);
    } else if (!propsEqual(oldIndex.get(key), node)) {
      changed.push(node.id);
    }
  }
  for (const [key, node] of oldIndex) {
    if (!newIndex.has(key)) removed.push(node.id);
  }

  return { added, removed, changed };
}

module.exports = { diffGraphs, buildPathIndex };
