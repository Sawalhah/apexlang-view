// Full-corpus regression gate — parses every real .apx file under the local
// apex_podman sample-apps checkout and asserts against a known-good baseline.
//
// This is the test that would have caught today's regression automatically:
// a signature change to buildGraph() left parseApxToGraph() calling it with
// one fewer argument, and every single parse started throwing. Nothing in
// the fixture-level unit tests caught it because they didn't exercise the
// actual exported parseApxToGraph() code path broadly enough by hand until
// the corpus script was re-run manually.
//
// Skips (does not fail) if the external corpus isn't present on this
// machine — it lives outside this repo, so CI/other machines won't have it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('../src/parser');

const CORPUS_ROOT = 'C:\\Users\\sawalhah\\OneDrive\\Projects\\apex_podman\\apex-apps\\sample-apps';

// Baseline captured 2026-07-21 after the quoted-identifier fix. If this
// number goes UP, something regressed. If it goes DOWN, great — update the
// baseline down and note why in the commit.
const BASELINE = {
  minFiles: 1200, // sanity floor — catches "corpus directory moved/emptied" too
  maxSuspicious: 11,
  maxErrors: 0,
};

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.apx')) out.push(full);
  }
}

function looksLikeGarbageTypeName(t) {
  if (!t) return true;
  if (/[\s<>"'.,;]/.test(t)) return true;
  if (t.length > 40) return true;
  return false;
}

test('full real-world corpus: 0 hard errors, suspicious count at or below baseline', { skip: !fs.existsSync(CORPUS_ROOT) && 'corpus not present on this machine' }, () => {
  const files = [];
  walk(CORPUS_ROOT, files);
  assert.ok(files.length >= BASELINE.minFiles, `expected at least ${BASELINE.minFiles} files, found ${files.length} — corpus may have moved`);

  let errors = 0;
  let suspicious = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.trim().length === 0) continue;

    let graph;
    try {
      graph = parseApxToGraph(text);
    } catch {
      errors++;
      continue;
    }

    const kb = text.length / 1024;
    const nodesPerKb = graph.nodes.length / Math.max(kb, 0.01);
    const garbageTypes = graph.nodes.filter((n) => looksLikeGarbageTypeName(n.typeName));
    const isSuspicious =
      (graph.nodes.length === 0 && kb > 0.3) ||
      (kb > 3 && nodesPerKb < 0.15) ||
      garbageTypes.length > 0;
    if (isSuspicious) suspicious++;
  }

  assert.ok(errors <= BASELINE.maxErrors, `${errors} files threw during parsing (baseline: ${BASELINE.maxErrors}) — run src/test-corpus.js for details`);
  assert.ok(suspicious <= BASELINE.maxSuspicious, `${suspicious} files flagged suspicious (baseline: ${BASELINE.maxSuspicious}) — run src/test-corpus.js for details`);
});
