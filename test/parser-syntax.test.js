// G4b (design docs/DESIGN-v0.2-v0.3.md): the parser handles each syntax
// form Oracle's APEXlang grammar defines (reference/apexlang-26.*.ebnf),
// one minimal example each.

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseApxToGraph } = require('../src/parser');

function nodes(text) {
  return parseApxToGraph(text).nodes.filter((n) => !n.external);
}

test('block with identifier, nested block, and properties', () => {
  const ns = nodes('page 1 (\n  name: Home\n  region r1 (\n    name: Orders\n  )\n)\n');
  assert.deepEqual(ns.map((n) => [n.typeName, n.identifier, n.props.name]), [
    ['page', '1', 'Home'],
    ['region', 'r1', 'Orders'],
  ]);
});

test('names containing $ (Interactive Grid generated columns)', () => {
  const ns = nodes('page 1 (\n  column APEX$ROW_ACTION (\n    type: actionsMenu\n  )\n  column DERIVED$01 (\n    type: link\n  )\n)\n');
  assert.deepEqual(ns.slice(1).map((n) => [n.typeName, n.identifier]), [
    ['column', 'APEX$ROW_ACTION'],
    ['column', 'DERIVED$01'],
  ]);
});

test('quoted names with spaces and escapes', () => {
  const ns = nodes('installScript "Install \\"Demo\\" Data" (\n  name: x\n)\n');
  assert.equal(ns[0].typeName, 'installScript');
  assert.equal(ns[0].identifier, 'Install "Demo" Data');
});

test('// line comments are ignored, line numbers kept', () => {
  const ns = nodes('page 1 (\n  // region old (\n  name: Home\n  region r1 (\n  )\n)\n');
  assert.deepEqual(ns.map((n) => n.typeName), ['page', 'region']);
  assert.equal(ns[0].props.name, 'Home');
  assert.equal(ns[1].line, 3);
});

test('/* */ block comments (one line and multi-line) are ignored, line numbers kept', () => {
  const ns = nodes('page 1 (\n  /* a note */\n  /* region old (\n  ) */\n  name: Home\n  region r1 (\n  )\n)\n');
  assert.deepEqual(ns.map((n) => n.typeName), ['page', 'region']);
  assert.deepEqual(ns[0].props, { name: 'Home' });
  assert.equal(ns[1].line, 5);
});

test('/* inside a value is not a comment', () => {
  const ns = nodes('page 1 (\n  fileUrls: #APP_FILES#icons/*.png\n)\n');
  assert.equal(ns[0].props.fileUrls, '#APP_FILES#icons/*.png');
});

test('arrays do not swallow the properties after them', () => {
  const ns = nodes('page 1 (\n  cssClasses: [\n    a\n    b\n  ]\n  name: Home\n)\n');
  assert.equal(ns[0].props.name, 'Home');
});

test('fenced code is opaque: block-like text inside it is not parsed', () => {
  const ns = nodes('page 1 (\n  javascriptCode:\n    ```js\n    region fake (\n    // not a comment for the parser\n    ```\n  name: Home\n)\n');
  assert.deepEqual(ns.map((n) => n.typeName), ['page']);
  assert.equal(ns[0].props.name, 'Home');
});

test('nested groups contribute properties to the enclosing block', () => {
  const ns = nodes('page 1 (\n  layout {\n    grid {\n      column: 2\n    }\n  }\n  region r1 (\n    name: R\n  )\n)\n');
  assert.equal(ns[0].props.column, '2');
  assert.deepEqual(ns.map((n) => n.typeName), ['page', 'region']);
});
