// parser.js's navTargets detection (roadmap #3, the single-file half of
// cross-page navigation — see src/page-nav.js for the cross-file half).
// Uses real data confirmed in fixtures/p00007-buttons-and-refs.apx:
//   - a page-level `branch (... behavior { target: { page: 6 } } )` with no
//     identifier — a real, numeric navigation target.
//   - a `cancel` button with `behavior { action: redirectThisApp target: {
//     page: &LAST_VIEW. } }` — a SUBSTITUTION VARIABLE, not a literal page
//     number, which must NOT be treated as a resolvable nav target.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('../src/parser');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('a page-level branch with a numeric target.page produces a navTarget', () => {
  const graph = parseApxToGraph(fixture('p00007-buttons-and-refs.apx'));
  const branchNode = graph.nodes.find((n) => n.typeName === 'branch' && n.props.page === '6');
  assert.ok(branchNode, 'the branch targeting page 6 should exist as a node');
  const navTarget = graph.navTargets.find((t) => t.from === branchNode.id);
  assert.ok(navTarget, 'that branch should produce a navTarget');
  assert.equal(navTarget.pageNumber, '6');
});

test('a substitution-variable target (&LAST_VIEW.) is NOT treated as a navTarget', () => {
  const graph = parseApxToGraph(fixture('p00007-buttons-and-refs.apx'));
  const cancelButton = graph.nodes.find((n) => n.typeName === 'button' && n.identifier === 'cancel');
  assert.ok(cancelButton, 'the cancel button should exist');
  assert.equal(cancelButton.props.page, '&LAST_VIEW.');
  const navTarget = graph.navTargets.find((t) => t.from === cancelButton.id);
  assert.equal(navTarget, undefined, 'a non-numeric target.page must not produce a navTarget');
});

test('a "page" prop on a non-trigger block type (e.g. a region) is ignored', () => {
  // Defensive: NAV_TRIGGER_TYPES restricts detection to
  // branch/button/dynamicAction specifically so an unrelated "page" property
  // on some other block type can never be misread as navigation.
  const graph = parseApxToGraph('page 1 (\n  region r (\n    page: 5\n  )\n)\n');
  assert.equal(graph.navTargets.length, 0);
});

test('navTargets is always an array, even for a file with none', () => {
  const graph = parseApxToGraph(fixture('p00001-home.apx'));
  assert.ok(Array.isArray(graph.navTargets));
});
