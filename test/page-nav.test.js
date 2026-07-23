// Cross-page navigation resolution tests (roadmap item #3) — node:test.
// page-nav.js is deliberately vscode-free so it can be unit-tested headless
// (extension.js requires('vscode'), which only exists inside a real
// Extension Development Host).

const test = require('node:test');
const assert = require('node:assert/strict');
const { pageNumberFromFilename, guessAppRoot, buildPageIndex, injectNavStubs } = require('../src/page-nav');

test('pageNumberFromFilename extracts the zero-padded page number prefix', () => {
  assert.equal(pageNumberFromFilename('C:/app/pages/p00007.apx'), '7');
  assert.equal(pageNumberFromFilename('p00001-home.apx'), '1');
  assert.equal(pageNumberFromFilename('p00099-cross-references.apx'), '99');
});

test('pageNumberFromFilename returns null for files that are not page exports', () => {
  assert.equal(pageNumberFromFilename('application.apx'), null);
  assert.equal(pageNumberFromFilename('plugin.apx'), null);
});

test('guessAppRoot goes one level up when the parent dir is literally "pages"', () => {
  assert.equal(guessAppRoot('C:/apps/brookstrut/pages/p00007.apx'), 'C:/apps/brookstrut');
});

test('guessAppRoot falls back to the file\'s own directory otherwise', () => {
  assert.equal(guessAppRoot('C:/apps/brookstrut/shared-components/plugin.apx'), 'C:/apps/brookstrut/shared-components');
});

test('buildPageIndex maps page numbers to fsPaths, first match wins on duplicates', () => {
  const index = buildPageIndex([
    'C:/app/pages/p00001-home.apx',
    'C:/app/pages/p00007.apx',
    'C:/app/application.apx', // not a page export, ignored
  ]);
  assert.equal(index.get('1'), 'C:/app/pages/p00001-home.apx');
  assert.equal(index.get('7'), 'C:/app/pages/p00007.apx');
  assert.equal(index.has('application'), false);
});

test('injectNavStubs adds one external stub node + navigation edge per resolvable target', () => {
  const graph = {
    nodes: [{ id: 'n1', typeName: 'branch', identifier: null, props: { page: '6' } }],
    edges: [],
    navTargets: [{ from: 'n1', pageNumber: '6' }],
  };
  const pageIndex = new Map([['6', 'C:/app/pages/p00006.apx']]);
  injectNavStubs(graph, 'C:/app/pages/p00007.apx', pageIndex);

  const stub = graph.nodes.find((n) => n.external);
  assert.ok(stub, 'an external stub node should have been added');
  assert.equal(stub.identifier, '6');
  assert.equal(stub.targetFsPath, 'C:/app/pages/p00006.apx');

  const navEdge = graph.edges.find((e) => e.kind === 'navigation');
  assert.ok(navEdge);
  assert.equal(navEdge.from, 'n1');
  assert.equal(navEdge.to, stub.id);
});

test('injectNavStubs skips targets that do not resolve to a known page', () => {
  const graph = { nodes: [{ id: 'n1' }], edges: [], navTargets: [{ from: 'n1', pageNumber: '999' }] };
  injectNavStubs(graph, 'C:/app/pages/p00007.apx', new Map());
  assert.equal(graph.nodes.filter((n) => n.external).length, 0);
  assert.equal(graph.edges.filter((e) => e.kind === 'navigation').length, 0);
});

test('injectNavStubs skips self-navigation (target resolves to the current file itself)', () => {
  const graph = { nodes: [{ id: 'n1' }], edges: [], navTargets: [{ from: 'n1', pageNumber: '7' }] };
  const pageIndex = new Map([['7', 'C:/app/pages/p00007.apx']]);
  injectNavStubs(graph, 'C:/app/pages/p00007.apx', pageIndex);
  assert.equal(graph.nodes.filter((n) => n.external).length, 0, 'a page navigating to itself should not produce a stub');
});

test('injectNavStubs deduplicates the stub node when multiple triggers target the same page', () => {
  const graph = {
    nodes: [{ id: 'n1' }, { id: 'n2' }],
    edges: [],
    navTargets: [
      { from: 'n1', pageNumber: '6' },
      { from: 'n2', pageNumber: '6' },
    ],
  };
  const pageIndex = new Map([['6', 'C:/app/pages/p00006.apx']]);
  injectNavStubs(graph, 'C:/app/pages/p00007.apx', pageIndex);
  assert.equal(graph.nodes.filter((n) => n.external).length, 1, 'only one stub node for page 6, not one per trigger');
  assert.equal(graph.edges.filter((e) => e.kind === 'navigation').length, 2, 'but both triggers still get their own edge to it');
});
