// Cross-reference resolution tests (roadmap item #2) — node:test.
//
// Real syntax confirmed against apex-apps/sample-apps/brookstrut-sample-app
// /apexlang/brookstrut/pages/p00007.apx: a block declares an identifier
// (`button save (`), and elsewhere a property value points at it with
// `@identifier` (`button: @save`). fixtures/p00099-cross-references.apx
// reproduces that pattern plus a `@/standard` template ref, which must NOT
// resolve to a local node (no local block has that identifier — it points
// at a built-in Universal Theme template).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('../src/parser');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('resolves an @identifier reference to the block that declares that identifier', () => {
  const graph = parseApxToGraph(fixture('p00099-cross-references.apx'));
  const saveButton = graph.nodes.find((n) => n.typeName === 'button' && n.identifier === 'save');
  const saveAction = graph.nodes.find((n) => n.identifier === 'save-action');
  assert.ok(saveButton, 'save button node should exist');
  assert.ok(saveAction, 'save-action node should exist');

  const refEdge = graph.edges.find(
    (e) => e.kind === 'reference' && e.from === saveAction.id && e.to === saveButton.id
  );
  assert.ok(refEdge, 'a reference edge from save-action to the save button should exist');
  assert.equal(refEdge.via, 'button');
});

test('resolves a second, independent @identifier reference correctly (not confused with the first)', () => {
  const graph = parseApxToGraph(fixture('p00099-cross-references.apx'));
  const cancelButton = graph.nodes.find((n) => n.typeName === 'button' && n.identifier === 'cancel');
  const cancelAction = graph.nodes.find((n) => n.identifier === 'cancel-action');
  const refEdge = graph.edges.find(
    (e) => e.kind === 'reference' && e.from === cancelAction.id && e.to === cancelButton.id
  );
  assert.ok(refEdge, 'a reference edge from cancel-action to the cancel button should exist');
});

test('a @/template ref does NOT create a reference edge — no local block has that identifier', () => {
  const graph = parseApxToGraph(fixture('p00099-cross-references.apx'));
  const refEdges = graph.edges.filter((e) => e.kind === 'reference');
  assert.equal(refEdges.length, 2, 'only the two @save/@cancel refs should resolve, not @/standard');
});

test('containment edges are tagged kind: contains, distinct from reference edges', () => {
  const graph = parseApxToGraph(fixture('p00099-cross-references.apx'));
  const containment = graph.edges.filter((e) => e.kind === 'contains');
  assert.ok(containment.length > 0);
  assert.ok(containment.every((e) => e.kind === 'contains'));
});

test('reference edges never point a node at itself', () => {
  const graph = parseApxToGraph(fixture('p00099-cross-references.apx'));
  for (const e of graph.edges.filter((e) => e.kind === 'reference')) {
    assert.notEqual(e.from, e.to);
  }
});

test('resolveReferences runs clean on every bundled fixture, no throw', () => {
  const names = fs.readdirSync(FIXTURES, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.apx'))
    .map((e) => e.name);
  for (const name of names) {
    const graph = parseApxToGraph(fixture(name));
    assert.ok(Array.isArray(graph.edges));
  }
});
