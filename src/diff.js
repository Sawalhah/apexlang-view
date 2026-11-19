// Git-diff indicators (next-version feature, agreed 2026-07-25 office-hours
// session): compares two parsed graphs of the SAME file (e.g. working tree vs
// HEAD) and classifies nodes as added/removed/changed. Deliberately pure —
// no git, no filesystem, no vscode — so it's unit-testable under plain
// `node --test`, matching page-nav.js/app-map.js's pattern. The caller
// (extension.js refresh()) produces the two graphs to compare: parseApxToGraph
// on the working copy and on the file's text at the chosen git ref.
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
// Repeated identifiers among siblings (e.g. several templateOptionGroup
// blocks with the same name) are matched in order: the first keeps the bare
// key, later ones get `#2`, `#3`, ... (F8).

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

// Path segment for one node among its siblings. Named nodes use their
// identifier; a repeated identifier gets an occurrence suffix (#2, #3, ...)
// so duplicates are matched in order instead of overwriting each other.
// Anonymous nodes use their position among same-typed anonymous siblings.
function siblingKey(node, anonCounters, namedCounters) {
  if (node.identifier) {
    const base = `${node.typeName}:${node.identifier}`;
    const n = nextSiblingIndex(namedCounters, base);
    return n === 1 ? base : `${base}#${n}`;
  }
  return `${node.typeName}#${nextSiblingIndex(anonCounters, node.typeName)}`;
}

// Returns Map<pathKey, node> for every node in `graph`.
function buildPathIndex(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const childrenOf = buildChildrenMap(graph);
  const index = new Map();

  function visitChildren(parentKey, parentId) {
    const kids = (childrenOf.get(parentId) || []).map((id) => byId.get(id)).filter(Boolean);
    const anonCounters = new Map();
    const namedCounters = new Map();
    for (const kid of kids) {
      const kidKey = `${parentKey}/${siblingKey(kid, anonCounters, namedCounters)}`;
      index.set(kidKey, kid);
      visitChildren(kidKey, kid.id);
    }
  }

  const rootCounters = new Map();
  const rootNamedCounters = new Map();
  for (const root of buildRoots(graph)) {
    const key = siblingKey(root, rootCounters, rootNamedCounters);
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
  return true;
}

// Returns [{key, oldValue, newValue}] for every prop that differs between
// oldNode and newNode. Only called on a pair already known to differ
// (propsEqual returned false), so the result is never empty in practice.
// The display label is not compared: the parser always derives it from
// props.name, the identifier, or the type (parser.js), so a label change
// always shows up as a `name` change or a different path key (F9).
function computePropChanges(oldNode, newNode) {
  const oldProps = oldNode.props || {};
  const newProps = newNode.props || {};
  const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  const changes = [];
  for (const key of allKeys) {
    if (oldProps[key] !== newProps[key]) {
      changes.push({ key, oldValue: oldProps[key], newValue: newProps[key] });
    }
  }
  return changes;
}

// Returns {
//   added: [nodeId in newGraph], removed: [nodeId in oldGraph],
//   changed: [nodeId in newGraph],
//   propChanges: { [nodeId in newGraph]: [{key, oldValue, newValue}] },
//   removedInfo: [{typeName, identifier, label}] — oldGraph nodes with no
//     equivalent id in newGraph to point at, so callers that want to show
//     "what was removed" (not just a count) use this instead of a live node.
// }
// added/changed/propChanges reference newGraph's node ids (what the caller
// is currently rendering); removed references oldGraph's ids.
function diffGraphs(oldGraph, newGraph) {
  const oldIndex = buildPathIndex(oldGraph);
  const newIndex = buildPathIndex(newGraph);

  const added = [];
  const removed = [];
  const changed = [];
  const propChanges = {};
  const removedInfo = [];

  for (const [key, node] of newIndex) {
    if (!oldIndex.has(key)) {
      added.push(node.id);
    } else if (!propsEqual(oldIndex.get(key), node)) {
      changed.push(node.id);
      propChanges[node.id] = computePropChanges(oldIndex.get(key), node);
    }
  }
  for (const [key, node] of oldIndex) {
    if (!newIndex.has(key)) {
      removed.push(node.id);
      removedInfo.push({ typeName: node.typeName, identifier: node.identifier, label: node.label });
    }
  }

  return { added, removed, changed, propChanges, removedInfo };
}

module.exports = { diffGraphs, buildPathIndex };
