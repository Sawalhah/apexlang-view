// Search/filter regression tests (roadmap item #1) — node:test.
// Tests the pure matching engine in media/search-logic.js directly, against
// a real parsed graph, so the feature has actual coverage without needing a
// VS Code Extension Development Host to click through by hand.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('../src/parser');
const { nodeMatches, buildParentMap, computeMatches } = require('../media/search-logic');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('computeMatches finds nodes by label, case-insensitively', () => {
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  // "sample cards" legitimately matches two nodes in this fixture: the
  // "Sample Cards" region itself (by label) AND the page (whose `title`
  // prop is also literally "Sample Cards") — both are correct matches,
  // not a bug, since search checks props as well as label/identifier.
  const { matchIds, matchOrder } = computeMatches(graph, 'sample cards');
  const matched = graph.nodes.filter((n) => matchIds.has(n.id));
  assert.equal(matched.length, 2);
  assert.ok(matched.some((n) => n.typeName === 'region' && n.label === 'Sample Cards'));
  assert.ok(matched.some((n) => n.typeName === 'page'));
  assert.equal(matchOrder.length, 2);
});

test('computeMatches finds nodes by typeName', () => {
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  const { matchIds } = computeMatches(graph, 'region');
  const matched = graph.nodes.filter((n) => matchIds.has(n.id));
  assert.ok(matched.length >= 3, 'all region nodes should match a typeName search');
  assert.ok(matched.every((n) => n.typeName === 'region'));
});

test('computeMatches returns empty result for an empty query', () => {
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  const { matchIds, matchOrder, ancestorsToExpand } = computeMatches(graph, '');
  assert.equal(matchIds.size, 0);
  assert.equal(matchOrder.length, 0);
  assert.equal(ancestorsToExpand.size, 0);
});

test('computeMatches returns empty result for a null graph (panel not yet loaded)', () => {
  const { matchIds, matchOrder } = computeMatches(null, 'anything');
  assert.equal(matchIds.size, 0);
  assert.equal(matchOrder.length, 0);
});

test('computeMatches collects every ancestor of a match, so a match inside a collapsed subtree can be auto-expanded', () => {
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  const target = graph.nodes.find((n) => n.label === 'Sample Cards');
  assert.ok(target, 'fixture should contain a "Sample Cards" region');
  const parentOf = buildParentMap(graph);
  const expectedAncestors = new Set();
  let a = parentOf[target.id];
  while (a !== undefined) {
    expectedAncestors.add(a);
    a = parentOf[a];
  }
  assert.ok(expectedAncestors.size > 0, 'the matched node should have at least one ancestor (the page)');

  const { ancestorsToExpand } = computeMatches(graph, 'sample cards');
  assert.deepEqual([...ancestorsToExpand].sort(), [...expectedAncestors].sort());
});

test('nodeMatches checks typeName, identifier, label, and scalar prop values', () => {
  const base = { typeName: 'region', identifier: 'reg_1', label: 'My Region', props: { title: 'Hello World' } };
  assert.ok(nodeMatches(base, 'region'));
  assert.ok(nodeMatches(base, 'reg_1'));
  assert.ok(nodeMatches(base, 'my region'));
  assert.ok(nodeMatches(base, 'hello world'));
  assert.ok(!nodeMatches(base, 'nonexistent'));
});

test('nodeMatches does not throw on a node with no props', () => {
  assert.doesNotThrow(() => nodeMatches({ typeName: 'app' }, 'x'));
});
