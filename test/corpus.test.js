// Full-corpus regression gate — parses every real .apx file under the local
// apex_podman apex-apps checkout (Oracle's APEX 26.1 sample, starter, and
// utility apps: 2,228 files) and asserts against a known-good baseline.
//
// This is the test that would have caught the July regression automatically:
// a signature change to buildGraph() left parseApxToGraph() calling it with
// one fewer argument, and every single parse started throwing. Nothing in
// the fixture-level unit tests caught it because they didn't exercise the
// actual exported parseApxToGraph() code path broadly enough by hand until
// the corpus script was re-run manually.
//
// Also the G4a grammar check (design docs/DESIGN-v0.2-v0.3.md): every
// component type the parser produces is a component keyword in Oracle's
// published APEXlang grammar (26.1 or 26.2; list generated once into
// test/grammar-keywords.json). A name outside the grammar means the parser
// misread a file.
//
// Skips (does not fail) if the external corpus isn't present on this
// machine — it lives outside this repo, so CI/other machines won't have it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph, assessParseQuality } = require('../src/parser');

const CORPUS_ROOT = 'C:\\Users\\sawalhah\\OneDrive\\Projects\\apex_podman\\apex-apps';
const GRAMMAR_KEYWORDS = new Set(require('./grammar-keywords.json').keywords);

// Baseline: 11 suspicious files in sample-apps (captured 2026-07-21 after
// the quoted-identifier fix); 16 across the whole apex-apps tree (2026-11-20,
// when the test widened from sample-apps to all of apex-apps). If this number
// goes UP, something regressed. If it goes DOWN, great — update the baseline
// down and note why in the commit.
const BASELINE = {
  minFiles: 2228, // the whole corpus; catches "corpus moved/emptied" too
  maxSuspicious: 16,
  maxErrors: 0,
};

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.apx')) out.push(full);
  }
}

const corpusMissing = !fs.existsSync(CORPUS_ROOT) && 'corpus not present on this machine';

function parseCorpus() {
  const files = [];
  walk(CORPUS_ROOT, files);
  const results = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.trim().length === 0) continue;
    try {
      const graph = parseApxToGraph(text);
      results.push({ file, graph, quality: assessParseQuality(text, graph) });
    } catch (err) {
      results.push({ file, error: err });
    }
  }
  return { files, results };
}

let cached = null;
function corpus() {
  if (!cached) cached = parseCorpus();
  return cached;
}

test('full real-world corpus: 0 hard errors, suspicious count at or below baseline', { skip: corpusMissing }, () => {
  const { files, results } = corpus();
  assert.ok(files.length >= BASELINE.minFiles, `expected at least ${BASELINE.minFiles} files, found ${files.length} — corpus may have moved`);

  const errors = results.filter((r) => r.error).length;
  const suspicious = results.filter((r) => r.quality && r.quality.suspicious).length;

  assert.ok(errors <= BASELINE.maxErrors, `${errors} files threw during parsing (baseline: ${BASELINE.maxErrors}) — run src/test-corpus.js for details`);
  assert.ok(suspicious <= BASELINE.maxSuspicious, `${suspicious} files flagged suspicious (baseline: ${BASELINE.maxSuspicious}) — run src/test-corpus.js for details`);
});

// Suspicious files are covered by the baseline above (they can contain
// garbage type names by definition), so they are skipped here.
test('G4a: every component type in the corpus is a keyword in Oracle\'s APEXlang grammar', { skip: corpusMissing }, () => {
  const { results } = corpus();
  const unknown = new Map(); // typeName -> first file
  for (const r of results) {
    if (r.error || r.quality.suspicious) continue;
    for (const node of r.graph.nodes) {
      if (node.external) continue;
      if (!GRAMMAR_KEYWORDS.has(node.typeName) && !unknown.has(node.typeName)) {
        unknown.set(node.typeName, path.relative(CORPUS_ROOT, r.file));
      }
    }
  }
  assert.deepEqual([...unknown.entries()], [], 'component types not in the 26.1/26.2 grammar (type, first file)');
});
