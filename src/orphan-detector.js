// Orphan/unused shared-component detector (roadmap #5). Deliberately
// vscode-free (like page-nav.js) so it's unit-testable under plain
// `node --test` — extension.js wires the actual filesystem access around it.
//
// Real convention confirmed against the corpus: reusable definitions live
// under `<app>/shared-components/<category>/*.apx` (rest-data-sources,
// plugins, automations, etc.) and are referenced elsewhere via the same
// bare `@identifier` syntax that grounds roadmap #2 — confirmed concretely
// in sample-application-search: `shared-components/rest-data-sources/
// MovieDB.apx` declares `restDataSource MovieDB (`, and
// `shared-components/search-configs.apx` references it via `restSource:
// @MovieDB`. `themes/` and `static-files/` are excluded from candidates —
// those are asset/system exports (Universal Theme markup, uploaded files)
// whose "usage" is via `@/path` template refs, a different, unrelated
// syntax our reference matching intentionally doesn't resolve — including
// them would just produce a wall of false-positive "orphans".

const path = require('path');
const { parseApxToGraph } = require('./parser');

const EXCLUDED_SHARED_DIRS = new Set(['themes', 'static-files']);

function isSharedComponentFile(fsPath) {
  const parts = fsPath.split(/[/\\]/);
  const idx = parts.indexOf('shared-components');
  if (idx === -1 || idx + 1 >= parts.length) return false;
  return !EXCLUDED_SHARED_DIRS.has(parts[idx + 1]);
}

// Root-level blocks only (no containment parent within their own file) —
// nested blocks like a REST data source's `operation get (...)` are
// internal details of that component, not independently reusable/
// referenced entities in their own right.
function collectRootIdentifiers(fsPath, text) {
  let graph;
  try {
    graph = parseApxToGraph(text);
  } catch {
    return [];
  }
  const hasContainmentParent = new Set(
    graph.edges.filter((e) => (e.kind || 'contains') === 'contains').map((e) => e.to)
  );
  return graph.nodes
    .filter((n) => n.identifier && !hasContainmentParent.has(n.id))
    .map((n) => ({ identifier: n.identifier, typeName: n.typeName, fsPath, line: n.line }));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `files` is an array of { fsPath, text } for every .apx file in the app
// (shared-components AND pages — a candidate can legitimately be used from
// either). Returns candidates with zero `@identifier` occurrences anywhere
// in the app.
function findOrphans(files) {
  const candidates = [];
  for (const f of files) {
    if (!isSharedComponentFile(f.fsPath)) continue;
    candidates.push(...collectRootIdentifiers(f.fsPath, f.text));
  }
  if (candidates.length === 0) return [];

  const combinedText = files.map((f) => f.text).join('\n');
  const orphans = [];
  for (const c of candidates) {
    // Negative lookahead matching the exact identifier character class used
    // by parser.js's own @ref matching (not a plain \b word boundary) —
    // real identifiers can contain hyphens (e.g. "custom-manifest-example",
    // confirmed in the corpus), and \b treats '-' as a non-word char, which
    // would misfire on hyphenated names.
    const pattern = new RegExp(`@${escapeRegex(c.identifier)}(?![A-Za-z0-9_-])`);
    if (!pattern.test(combinedText)) orphans.push(c);
  }
  return orphans;
}

module.exports = { isSharedComponentFile, collectRootIdentifiers, findOrphans };
