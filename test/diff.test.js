// Git-diff indicators (next-version feature) — node:test.
// diff.js is deliberately vscode-free and git-free (pure graph comparison),
// like page-nav.js/app-map.js, so it's unit-testable headless.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('../src/parser');
const { diffGraphs } = require('../src/diff');

function fixtureText(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');
}

test('diffGraphs reports no changes when comparing a graph against itself', () => {
  const graph = parseApxToGraph(fixtureText('p00001-home.apx'));
  const result = diffGraphs(graph, graph);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.changed, []);
});

test('diffGraphs detects a changed property value on an identified node', () => {
  const oldGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n1', typeName: 'button', identifier: 'save', label: 'save', props: { label: 'Save' } },
    ],
    edges: [{ from: 'n0', to: 'n1' }],
  };
  const newGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n1', typeName: 'button', identifier: 'save', label: 'save', props: { label: 'Save Changes' } },
    ],
    edges: [{ from: 'n0', to: 'n1' }],
  };
  const result = diffGraphs(oldGraph, newGraph);
  assert.deepEqual(result.changed, ['n1']);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
});

test('diffGraphs detects an added identified node', () => {
  const oldGraph = {
    nodes: [{ id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} }],
    edges: [],
  };
  const newGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n1', typeName: 'button', identifier: 'cancel', label: 'cancel', props: {} },
    ],
    edges: [{ from: 'n0', to: 'n1' }],
  };
  const result = diffGraphs(oldGraph, newGraph);
  assert.deepEqual(result.added, ['n1']);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.changed, []);
});

test('diffGraphs detects a removed identified node', () => {
  const oldGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n1', typeName: 'button', identifier: 'cancel', label: 'cancel', props: {} },
    ],
    edges: [{ from: 'n0', to: 'n1' }],
  };
  const newGraph = {
    nodes: [{ id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} }],
    edges: [],
  };
  const result = diffGraphs(oldGraph, newGraph);
  assert.deepEqual(result.removed, ['n1']);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.changed, []);
});

test('diffGraphs matches identified nodes by identifier, not by positional node id', () => {
  // Same node, but the second parse assigned it a different id (e.g. an
  // unrelated node was inserted earlier in the file, shifting every
  // subsequent n<N> id) — the path-based match must still recognize it as
  // the same node and report no change, since props/label are identical.
  const oldGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n5', typeName: 'button', identifier: 'save', label: 'save', props: { label: 'Save' } },
    ],
    edges: [{ from: 'n0', to: 'n5' }],
  };
  const newGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n9', typeName: 'button', identifier: 'save', label: 'save', props: { label: 'Save' } },
    ],
    edges: [{ from: 'n0', to: 'n9' }],
  };
  const result = diffGraphs(oldGraph, newGraph);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.changed, []);
});

test('diffGraphs matches anonymous same-typed siblings by sibling index', () => {
  const oldGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n1', typeName: 'action', identifier: null, label: 'action', props: { code: 'A' } },
      { id: 'n2', typeName: 'action', identifier: null, label: 'action', props: { code: 'B' } },
    ],
    edges: [
      { from: 'n0', to: 'n1' },
      { from: 'n0', to: 'n2' },
    ],
  };
  const newGraph = {
    nodes: [
      { id: 'n0', typeName: 'page', identifier: '1', label: 'Home', props: {} },
      { id: 'n1', typeName: 'action', identifier: null, label: 'action', props: { code: 'A' } },
      { id: 'n2', typeName: 'action', identifier: null, label: 'action', props: { code: 'CHANGED' } },
    ],
    edges: [
      { from: 'n0', to: 'n1' },
      { from: 'n0', to: 'n2' },
    ],
  };
  const result = diffGraphs(oldGraph, newGraph);
  assert.deepEqual(result.changed, ['n2']);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
});

test('diffGraphs on two real fixtures with genuinely different content reports a non-trivial diff', () => {
  const a = parseApxToGraph(fixtureText('p00001-home.apx'));
  const b = parseApxToGraph(fixtureText('p00003-basic-cards.apx'));
  const result = diffGraphs(a, b);
  // Different pages entirely — expect real churn, not a no-op diff.
  assert.ok(result.added.length + result.removed.length + result.changed.length > 0);
});
