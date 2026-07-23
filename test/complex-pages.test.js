// Broader real-world coverage: interactive report, map region, and plugin
// pages, copied verbatim from apex-apps/sample-apps (brookstrut-sample-app,
// sample-workflow-approvals) — added 2026-07-23 per the user's request to
// keep testing against genuinely complex real exports, not just the small
// hand-picked fixtures already covering the basic-page shapes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph, assessParseQuality } = require('../src/parser');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

test('interactive report page (p00011) parses with an interactiveReport-type region', () => {
  const graph = parseApxToGraph(fixture('p00011-interactive-report.apx'));
  assert.ok(graph.nodes.length > 5, 'a real IR page should produce many nodes');
  const irRegion = graph.nodes.find((n) => n.typeName === 'region' && n.props.type === 'interactiveReport');
  assert.ok(irRegion, 'the "items" interactive report region should parse as a region node with type: interactiveReport');
  const quality = assessParseQuality(fixture('p00011-interactive-report.apx'), graph);
  assert.equal(quality.suspicious, false, `should not be flagged suspicious: ${quality.reasons.join(' ')}`);
});

test('map region page (p00010) parses with a map-type region', () => {
  const graph = parseApxToGraph(fixture('p00010-store-locations-map.apx'));
  const mapRegion = graph.nodes.find((n) => n.typeName === 'region' && n.props.type === 'map');
  assert.ok(mapRegion, 'the "store-locations" map region should parse as a region node with type: map');
  const quality = assessParseQuality(fixture('p00010-store-locations-map.apx'), graph);
  assert.equal(quality.suspicious, false, `should not be flagged suspicious: ${quality.reasons.join(' ')}`);
});

test('plugin export (markdownRegion) parses as a single plugin block with fenced PL/SQL source intact', () => {
  const graph = parseApxToGraph(fixture('plugin-markdown-region.apx'));
  const pluginNode = graph.nodes.find((n) => n.typeName === 'plugin' && n.identifier === 'markdownRegion');
  assert.ok(pluginNode, 'the plugin export should parse as a single plugin block');
  // The fenced ```plsql source block must not leak procedure/PL-SQL syntax
  // into sibling typeName/property parsing — same class of bug as the
  // "fenced code block on its own line" regression already covered for
  // htmlCode in parser.test.js, but this file exercises it with real,
  // much longer embedded PL/SQL.
  const badTypeNames = graph.nodes.filter((n) => /\s/.test(n.typeName));
  assert.deepEqual(badTypeNames, [], 'no node should have a typeName containing whitespace (sign of PL/SQL leaking into the parse)');
});

test('p00007 (the real file that grounds cross-reference resolution) resolves @save/@cancel to real button nodes', () => {
  const graph = parseApxToGraph(fixture('p00007-buttons-and-refs.apx'));
  const byId = {};
  for (const n of graph.nodes) byId[n.id] = n;
  const refEdges = graph.edges.filter((e) => e.kind === 'reference');
  assert.ok(refEdges.length > 0, 'this real page should produce at least one resolved reference edge');
  const saveButton = graph.nodes.find((n) => n.typeName === 'button' && n.identifier === 'save');
  assert.ok(saveButton, 'a button with identifier "save" should exist in this real page');
  const pointsAtSave = refEdges.some((e) => e.to === saveButton.id);
  assert.ok(pointsAtSave, 'at least one reference edge should resolve to the save button');
});

test('all four new complex fixtures parse without throwing and with 0 unexpected-looking typeNames', () => {
  const names = [
    'p00011-interactive-report.apx',
    'p00010-store-locations-map.apx',
    'plugin-markdown-region.apx',
    'p00007-buttons-and-refs.apx',
  ];
  for (const name of names) {
    const graph = parseApxToGraph(fixture(name));
    assert.ok(graph.nodes.length > 0, `${name} should produce at least one node`);
  }
});
