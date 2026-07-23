// Parser regression tests — node:test (built into Node 22, no dependency).
// Run with: node --test test/
//
// These exist because we've already had two real regressions caught only by
// manually re-running scripts and eyeballing output:
//   1. Fenced HTML code blocks starting on the line after `key:` were being
//      mis-parsed as APEXLang syntax (fixed — see "fenced code block on its
//      own line" test below).
//   2. Quoted identifiers (`installScript "Install Data" (`) broke block
//      detection entirely, silently producing 0 nodes (fixed — see "quoted
//      identifier" test below).
// Both are asserted here so a future edit can't silently reintroduce them.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph, assessParseQuality } = require('../src/parser');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('sample-cards home page — expected node/edge shape', () => {
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.length, 3);
  const page = graph.nodes.find((n) => n.typeName === 'page');
  assert.ok(page, 'page node should exist');
  assert.equal(page.label, 'Home');
  const regionLabels = graph.nodes.filter((n) => n.typeName === 'region').map((n) => n.label).sort();
  assert.deepEqual(regionLabels, ['About This App', 'App Navigation', 'Sample Cards']);
});

test('fenced code block on its own line does not leak into the tree (regression)', () => {
  // p00001-home.apx has `htmlCode:` followed by a ```html fence on the NEXT
  // line, containing prose like "Oracle Application Express (APEX)" that
  // once got mis-parsed as fake `Application Express (` block nodes.
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  const badTypeNames = graph.nodes.filter((n) => /\s/.test(n.typeName));
  assert.deepEqual(badTypeNames, [], 'no node should have a typeName containing whitespace (sign of HTML leaking into the parse)');
});

test('quoted identifiers parse as real block nodes (regression)', () => {
  // installScript "Install Data" ( ... ) — space/punctuation in the
  // identifier isn't valid in a bare word, needs the quoted-string path.
  const graph = parseApxToGraph(fixture('install-scripts-quoted-ids.apx'));
  assert.equal(graph.nodes.length, 3, 'all three installScript blocks should become nodes, not 0');
  const labels = graph.nodes.map((n) => n.label).sort();
  assert.deepEqual(labels, ['Install Data', 'Install Manage Orders Package', 'Install Restaurant Tables']);
});

test('basic-cards page — multiple sibling regions with nested property groups', () => {
  const graph = parseApxToGraph(fixture('p00003-basic-cards.apx'));
  assert.equal(graph.nodes.length, 7);
  const styleA = graph.nodes.find((n) => n.identifier === 'style-a');
  assert.ok(styleA, 'style-a region should exist');
  // Nested `title { column: ENAME }` should NOT create a separate node —
  // groups (intentionally) flatten into the parent block's props rather
  // than becoming their own node, however deeply nested.
  assert.equal(styleA.props.column, 'ENAME', 'nested group properties should flatten into the parent block\'s props');
  assert.equal(styleA.props.tableName, 'EBA_DEMO_CARD_EMP');
});

test('nested blocks inside a region (action, pageItem) become their own nodes with correct parent edges', () => {
  const graph = parseApxToGraph(fixture('p00016-conditional-actions.apx'));
  const region = graph.nodes.find((n) => n.identifier === 'conditional-card-actions');
  const action = graph.nodes.find((n) => n.identifier === 'action');
  assert.ok(region && action);
  assert.ok(
    graph.edges.some((e) => e.from === region.id && e.to === action.id),
    'action should be a child of its enclosing region in the edge list'
  );
  // pageItem is a direct child of the page, not the region — this exact
  // case regressed once already (edge existed in data but wasn't verified).
  const page = graph.nodes.find((n) => n.typeName === 'page');
  const pageItem = graph.nodes.find((n) => n.typeName === 'pageItem');
  assert.ok(
    graph.edges.some((e) => e.from === page.id && e.to === pageItem.id),
    'pageItem should be a direct child of the page node'
  );
});

test('line numbers are tracked and monotonically increase with source order', () => {
  const graph = parseApxToGraph(fixture('p00003-basic-cards.apx'));
  for (const n of graph.nodes) {
    assert.equal(typeof n.line, 'number');
    assert.ok(n.line >= 0);
  }
  // regions appear later in the file than the page block that contains them
  const page = graph.nodes.find((n) => n.typeName === 'page');
  const region = graph.nodes.find((n) => n.identifier === 'style-a');
  assert.ok(region.line > page.line, 'nested region should be on a later line than its parent page');
});

test('assessParseQuality flags a file with zero nodes as suspicious', () => {
  // Must exceed the 0.3KB non-trivial-size threshold the heuristic uses —
  // repeat the prose to comfortably clear it rather than relying on one
  // long sentence (fragile against future threshold tuning).
  const text = 'this is not valid apexlang syntax at all, just prose with no blocks whatsoever. '.repeat(6);
  assert.ok(text.length / 1024 > 0.3, 'test fixture must exceed the suspicious-size threshold');
  const graph = parseApxToGraph(text);
  const quality = assessParseQuality(text, graph);
  assert.equal(quality.suspicious, true);
});

test('assessParseQuality does not flag a normal, well-formed file', () => {
  const text = fixture('p00003-basic-cards.apx');
  const graph = parseApxToGraph(text);
  const quality = assessParseQuality(text, graph);
  assert.equal(quality.suspicious, false);
});

test('parser never throws on any bundled fixture', () => {
  for (const file of fs.readdirSync(FIXTURES)) {
    if (!file.endsWith('.apx')) continue;
    assert.doesNotThrow(() => parseApxToGraph(fixture(file)), `should not throw on ${file}`);
  }
});
