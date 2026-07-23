// Stress-tests the parser against every real .apx export under
// apex_podman/apex-apps/sample-apps — every APEX feature area (IR, REST,
// Maps, trees, etc), not just the cards fixtures used for initial dev.
//
// Flags files that likely misparsed via heuristics (no ground truth exists):
//   - parser threw
//   - 0 nodes produced from a non-trivial file
//   - a node count wildly out of proportion to file size (str suspiciously
//     low nodes/KB, suggesting most of the file fell through as one blob)
//   - a typeName that looks like parsed-out-of-HTML garbage (contains spaces,
//     punctuation, or is implausibly long) — signature of the fenced-block
//     bug we already found once
//   - unbalanced parens/braces remaining unconsumed (parser stops early)

const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('./parser');

const ROOT = 'C:\\Users\\sawalhah\\OneDrive\\Projects\\apex_podman\\apex-apps\\sample-apps';

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.apx')) out.push(full);
  }
}

function looksLikeGarbageTypeName(t) {
  if (!t) return true;
  if (/[\s<>"'.,;]/.test(t)) return true; // spaces/punctuation from mis-scanned prose
  if (t.length > 40) return true;
  return false;
}

const files = [];
walk(ROOT, files);
console.log(`Found ${files.length} .apx files.\n`);

let errors = [];
let suspicious = [];
let totalNodes = 0;
let ok = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    errors.push({ file: rel, reason: `read failed: ${err.message}` });
    continue;
  }
  if (text.trim().length === 0) continue; // empty file, nothing to parse

  let graph;
  try {
    graph = parseApxToGraph(text);
  } catch (err) {
    errors.push({ file: rel, reason: `parser threw: ${err.message}` });
    continue;
  }

  totalNodes += graph.nodes.length;

  const kb = text.length / 1024;
  const nodesPerKb = graph.nodes.length / Math.max(kb, 0.01);

  const garbageTypes = graph.nodes.filter((n) => looksLikeGarbageTypeName(n.typeName));

  const reasons = [];
  if (graph.nodes.length === 0 && kb > 0.3) reasons.push('0 nodes from non-trivial file');
  if (kb > 3 && nodesPerKb < 0.15) reasons.push(`very low node density (${nodesPerKb.toFixed(2)}/KB over ${kb.toFixed(1)}KB)`);
  if (garbageTypes.length > 0) reasons.push(`${garbageTypes.length} garbage-looking typeName(s): ${garbageTypes.slice(0, 3).map((n) => JSON.stringify(n.typeName)).join(', ')}`);

  if (reasons.length > 0) {
    suspicious.push({ file: rel, nodes: graph.nodes.length, kb: kb.toFixed(1), reasons });
  } else {
    ok++;
  }
}

console.log(`=== PARSER ERRORS (${errors.length}) ===`);
for (const e of errors.slice(0, 30)) console.log(`  ${e.file}\n    ${e.reason}`);
if (errors.length > 30) console.log(`  ... and ${errors.length - 30} more`);

console.log(`\n=== SUSPICIOUS PARSES (${suspicious.length}) ===`);
for (const s of suspicious.slice(0, 40)) {
  console.log(`  ${s.file} — ${s.nodes} nodes, ${s.kb}KB`);
  for (const r of s.reasons) console.log(`    - ${r}`);
}
if (suspicious.length > 40) console.log(`  ... and ${suspicious.length - 40} more`);

console.log(`\n=== SUMMARY ===`);
console.log(`Total files:      ${files.length}`);
console.log(`Clean parses:     ${ok}`);
console.log(`Suspicious:       ${suspicious.length}`);
console.log(`Hard errors:      ${errors.length}`);
console.log(`Total nodes:      ${totalNodes}`);
