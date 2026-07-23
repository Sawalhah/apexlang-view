// Pure search/filter logic, shared between the webview (media/graph.js, via a
// plain <script> tag — no bundler in this project) and the Node test suite
// (via module.exports, which is undefined in the browser so this is a no-op
// there). Keeping this pure and DOM-free is what makes it testable at all.

function nodeMatches(node, query) {
  if (node.typeName && node.typeName.toLowerCase().includes(query)) return true;
  if (node.identifier && node.identifier.toLowerCase().includes(query)) return true;
  if (node.label && node.label.toLowerCase().includes(query)) return true;
  for (const v of Object.values(node.props || {})) {
    if (String(v).toLowerCase().includes(query)) return true;
  }
  return false;
}

// Only containment edges define ancestry — a reference edge (`kind:
// 'reference'`, added by cross-reference resolution in parser.js) must not
// overwrite a node's real containment parent in this map.
function buildParentMap(graph) {
  const map = {};
  for (const e of graph.edges) {
    if ((e.kind || 'contains') !== 'contains') continue;
    map[e.to] = e.from;
  }
  return map;
}

// Returns { matchIds: Set, matchOrder: string[], ancestorsToExpand: Set }.
// ancestorsToExpand is every ancestor of every match — the caller removes
// these from its collapsed-set so a match is never hidden inside a
// collapsed subtree.
function computeMatches(graph, query) {
  const matchIds = new Set();
  const matchOrder = [];
  const ancestorsToExpand = new Set();
  if (!graph || !query) return { matchIds, matchOrder, ancestorsToExpand };

  const parentOf = buildParentMap(graph);
  for (const node of graph.nodes) {
    if (nodeMatches(node, query)) {
      matchIds.add(node.id);
      matchOrder.push(node.id);
      let ancestor = parentOf[node.id];
      while (ancestor !== undefined) {
        ancestorsToExpand.add(ancestor);
        ancestor = parentOf[ancestor];
      }
    }
  }
  return { matchIds, matchOrder, ancestorsToExpand };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { nodeMatches, buildParentMap, computeMatches };
} else if (typeof window !== 'undefined') {
  window.ApxSearchLogic = { nodeMatches, buildParentMap, computeMatches };
}
