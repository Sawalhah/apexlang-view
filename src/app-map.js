// Whole-app page map (roadmap #2, app-level scope): one node per page/file
// in an app, connected by the same navTarget resolution page-nav.js already
// uses for single-file nav stubs. Deliberately NOT a merged single graph —
// this only maps page-to-page navigation, not full cross-file containment.
// Kept vscode-free (like page-nav.js) so it's testable under plain
// `node --test`.

const { parseApxToGraph } = require('./parser');
const { pageNumberFromFilename } = require('./page-nav');

// files: [{fsPath, text}] — every candidate .apx file under one app root.
// Returns { pages: [{pageNumber, fsPath, label, nodeCount}], edges: [{from, to}] }
// (from/to are page numbers, both strings). Files that aren't page exports
// (shared components, application.apx) or fail to parse are skipped — they
// have no page number and so no place in a page-to-page map.
function buildAppMap(files) {
  const pages = [];
  const pageByNumber = new Map();
  const parsedByFsPath = new Map();

  for (const file of files) {
    const pageNumber = pageNumberFromFilename(file.fsPath);
    if (!pageNumber) continue;

    let graph;
    try {
      graph = parseApxToGraph(file.text);
    } catch (err) {
      continue;
    }

    const root = graph.nodes[0];
    const label = (root && root.label) || `Page ${pageNumber}`;
    const page = { pageNumber, fsPath: file.fsPath, label, nodeCount: graph.nodes.length };
    pages.push(page);
    pageByNumber.set(pageNumber, page);
    parsedByFsPath.set(file.fsPath, { graph, pageNumber });
  }

  const edgeKeys = new Set();
  const edges = [];
  for (const { graph, pageNumber } of parsedByFsPath.values()) {
    for (const nav of graph.navTargets || []) {
      if (nav.pageNumber === pageNumber) continue; // self-nav, not useful on the map
      if (!pageByNumber.has(nav.pageNumber)) continue; // target page not found in this app root
      const key = `${pageNumber}->${nav.pageNumber}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from: pageNumber, to: nav.pageNumber });
    }
  }

  pages.sort((a, b) => Number(a.pageNumber) - Number(b.pageNumber));
  return { pages, edges };
}

module.exports = { buildAppMap };
