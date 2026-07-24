// Whole-app page map tests (roadmap #2, app-level scope) — node:test.
// app-map.js is deliberately vscode-free, like page-nav.js, so it's
// unit-testable headless.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildAppMap } = require('../src/app-map');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
function loadFixture(name) {
  return { fsPath: path.join(FIXTURES_DIR, name), text: fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8') };
}

test('buildAppMap only includes files that are page exports (skips application.apx, plugins)', () => {
  const files = [
    loadFixture('p00001-home.apx'),
    loadFixture('application.apx'),
    loadFixture('plugin-markdown-region.apx'),
  ];
  const { pages } = buildAppMap(files);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].pageNumber, '1');
});

test('buildAppMap picks up the root node label as the page label', () => {
  const { pages } = buildAppMap([loadFixture('p00001-home.apx')]);
  assert.equal(pages[0].label, 'Home');
});

test('buildAppMap adds a page-to-page edge for a navTarget that resolves to another page in the set', () => {
  const files = [loadFixture('p00007-buttons-and-refs.apx'), loadFixture('p00006-stores-report-content-row.apx')];
  const { pages, edges } = buildAppMap(files);
  assert.equal(pages.length, 2);
  assert.ok(edges.some((e) => e.from === '7' && e.to === '6'), 'expected an edge from page 7 to page 6');
});

test('buildAppMap omits an edge when the navTarget does not resolve to any page in the set', () => {
  const { edges } = buildAppMap([loadFixture('p00007-buttons-and-refs.apx')]);
  assert.equal(edges.length, 0, 'page 6 was not included in this file set, so no edge should be produced');
});

test('buildAppMap never produces a self-navigation edge', () => {
  const files = [loadFixture('p00007-buttons-and-refs.apx'), loadFixture('p00006-stores-report-content-row.apx')];
  const { edges } = buildAppMap(files);
  assert.equal(edges.filter((e) => e.from === e.to).length, 0);
});

test('buildAppMap deduplicates repeated page-to-page edges', () => {
  const files = [loadFixture('p00007-buttons-and-refs.apx'), loadFixture('p00006-stores-report-content-row.apx')];
  const { edges } = buildAppMap(files);
  const keys = edges.map((e) => `${e.from}->${e.to}`);
  assert.equal(new Set(keys).size, keys.length, 'no duplicate edge keys');
});

test('buildAppMap sorts pages numerically by page number', () => {
  const files = [
    loadFixture('p00019-advanced.apx'),
    loadFixture('p00003-basic-cards.apx'),
    loadFixture('p00001-home.apx'),
  ];
  const { pages } = buildAppMap(files);
  assert.deepEqual(pages.map((p) => p.pageNumber), ['1', '3', '19']);
});

test('buildAppMap skips a file that fails to parse without throwing', () => {
  const files = [loadFixture('p00001-home.apx'), { fsPath: 'p00099-broken.apx', text: '\x00\x01 not valid apexlang' }];
  assert.doesNotThrow(() => buildAppMap(files));
});
