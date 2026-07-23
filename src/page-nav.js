// Cross-page navigation resolution (roadmap #3), split out from
// extension.js specifically so it's testable without the `vscode` module —
// extension.js requires('vscode'), which only exists inside a real
// Extension Development Host, so nothing that imports it can run under
// plain `node --test`. Everything here is pure/deterministic; extension.js
// wraps it with the actual vscode.workspace.findFiles() call.

const path = require('path');

// Real APEX page-export filenames are `pNNNNN[-slug].apx` (zero-padded page
// number prefix) — confirmed across every fixture and the full corpus.
function pageNumberFromFilename(fsPath) {
  const m = path.basename(fsPath).match(/^p0*(\d+)/i);
  return m ? String(parseInt(m[1], 10)) : null;
}

// Heuristic app-root guess: real exports put pages under
// `.../<app>/pages/pNNNNN.apx` — if the immediate parent directory is
// literally named "pages", the app root is one level up. Otherwise fall
// back to the file's own directory.
function guessAppRoot(fsPath) {
  const dir = path.dirname(fsPath);
  return path.basename(dir).toLowerCase() === 'pages' ? path.dirname(dir) : dir;
}

// Builds a page-number -> fsPath index from a flat list of candidate .apx
// file paths (already scoped to one app root by the caller).
function buildPageIndex(fsPaths) {
  const map = new Map();
  for (const fsPath of fsPaths) {
    const num = pageNumberFromFilename(fsPath);
    if (num && !map.has(num)) map.set(num, fsPath);
  }
  return map;
}

// Mutates `graph` in place: for each navTarget resolvable via pageIndex,
// adds one synthetic "external page" stub node (deduped per page number)
// plus a `kind: 'navigation'` edge from the triggering node to that stub.
// `currentFsPath` is excluded from resolution — a page navigating to itself
// isn't useful to draw. Returns the same graph object for convenience.
function injectNavStubs(graph, currentFsPath, pageIndex) {
  if (!graph.navTargets || graph.navTargets.length === 0) return graph;
  const stubIds = new Set();
  for (const nav of graph.navTargets) {
    const targetFsPath = pageIndex.get(nav.pageNumber);
    if (!targetFsPath || targetFsPath === currentFsPath) continue;
    const stubId = `ext:${nav.pageNumber}`;
    if (!stubIds.has(stubId)) {
      stubIds.add(stubId);
      graph.nodes.push({
        id: stubId,
        typeName: 'externalPage',
        identifier: nav.pageNumber,
        label: `Page ${nav.pageNumber}`,
        props: {},
        line: null,
        external: true,
        targetFsPath,
      });
    }
    graph.edges.push({ from: nav.from, to: stubId, kind: 'navigation' });
  }
  return graph;
}

module.exports = { pageNumberFromFilename, guessAppRoot, buildPageIndex, injectNavStubs };
