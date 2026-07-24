// Generates a standalone HTML report visualizing parser results across the
// full 1263-file real-world corpus — a fast visual scan instead of reading
// a text list. Self-contained (no CDN), matches the artifact/no-external-
// request constraint.

const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('./parser');

const ROOT = 'C:\\Users\\sawalhah\\OneDrive\\Projects\\apex_podman\\apex-apps\\sample-apps';
const OUT = path.join(__dirname, '..', 'corpus-report.html');

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

function appNameOf(relPath) {
  return relPath.split(path.sep)[0];
}

const files = [];
walk(ROOT, files);

const results = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const app = appNameOf(rel);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    results.push({ rel, app, status: 'error', kb: 0, nodes: 0, reasons: [`read failed: ${err.message}`] });
    continue;
  }
  const kb = text.length / 1024;
  if (text.trim().length === 0) {
    results.push({ rel, app, status: 'ok', kb, nodes: 0, reasons: [] });
    continue;
  }

  let graph;
  try {
    graph = parseApxToGraph(text);
  } catch (err) {
    results.push({ rel, app, status: 'error', kb, nodes: 0, reasons: [`parser threw: ${err.message}`] });
    continue;
  }

  const nodesPerKb = graph.nodes.length / Math.max(kb, 0.01);
  const garbageTypes = graph.nodes.filter((n) => looksLikeGarbageTypeName(n.typeName));
  const reasons = [];
  if (graph.nodes.length === 0 && kb > 0.3) reasons.push('0 nodes from non-trivial file');
  if (kb > 3 && nodesPerKb < 0.15) reasons.push(`low node density (${nodesPerKb.toFixed(2)}/KB)`);
  if (garbageTypes.length > 0) reasons.push(`${garbageTypes.length} garbage-looking typeName(s)`);

  results.push({
    rel,
    app,
    status: reasons.length > 0 ? 'suspicious' : 'ok',
    kb: Number(kb.toFixed(1)),
    nodes: graph.nodes.length,
    reasons,
  });
}

// Group by app
const byApp = {};
for (const r of results) {
  if (!byApp[r.app]) byApp[r.app] = [];
  byApp[r.app].push(r);
}

const totalOk = results.filter((r) => r.status === 'ok').length;
const totalSuspicious = results.filter((r) => r.status === 'suspicious').length;
const totalError = results.filter((r) => r.status === 'error').length;

const dataJson = JSON.stringify({ byApp, totals: { ok: totalOk, suspicious: totalSuspicious, error: totalError, files: results.length } });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>APEXLang View — Corpus Parse Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; padding: 24px; background: #0f1117; color: #e6e6e6; }
  @media (prefers-color-scheme: light) { body { background: #f7f7f9; color: #1a1a1a; } }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { opacity: 0.7; font-size: 13px; margin-bottom: 18px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { padding: 10px 16px; border-radius: 8px; background: #1c1f2b; min-width: 100px; }
  @media (prefers-color-scheme: light) { .stat { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); } }
  .stat .n { font-size: 22px; font-weight: 700; }
  .stat .l { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat.ok .n { color: #4ec9a0; }
  .stat.suspicious .n { color: #e0af4c; }
  .stat.error .n { color: #f4746c; }
  .app-group { margin-bottom: 18px; }
  .app-header { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 0; font-weight: 600; font-size: 14px; }
  .app-header .count { font-weight: 400; opacity: 0.6; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18px, 1fr)); gap: 3px; padding: 4px 0 12px; max-width: 900px; }
  .cell { width: 100%; aspect-ratio: 1; border-radius: 3px; cursor: pointer; }
  .cell.ok { background: #2f7a5c; }
  .cell.suspicious { background: #c8922f; }
  .cell.error { background: #b7413a; }
  @media (prefers-color-scheme: light) { .cell.ok { background: #7fd6ab; } .cell.suspicious { background: #f4c66b; } .cell.error { background: #f29a94; } }
  .cell:hover { outline: 2px solid #4daafc; }
  #detail { position: fixed; bottom: 0; left: 0; right: 0; background: #1c1f2b; border-top: 1px solid #333; padding: 12px 20px; font-size: 12px; display: none; max-height: 30%; overflow: auto; }
  @media (prefers-color-scheme: light) { #detail { background: #fff; border-top: 1px solid #ddd; } }
  #detail.show { display: block; }
  #detail .path { font-weight: 600; margin-bottom: 4px; word-break: break-all; }
  #detail .meta { opacity: 0.7; margin-bottom: 4px; }
  #detail .reasons { color: #e0af4c; }
  .legend { display: flex; gap: 14px; font-size: 12px; margin-bottom: 18px; opacity: 0.8; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
</style>
</head>
<body>
<h1>APEXLang View — Corpus Parse Report</h1>
<div class="sub">Every real .apx export under apex-apps/sample-apps, parsed with tools/apexlang-view/src/parser.js</div>

<div class="summary">
  <div class="stat ok"><div class="n">${totalOk}</div><div class="l">Clean</div></div>
  <div class="stat suspicious"><div class="n">${totalSuspicious}</div><div class="l">Suspicious</div></div>
  <div class="stat error"><div class="n">${totalError}</div><div class="l">Errors</div></div>
  <div class="stat"><div class="n">${results.length}</div><div class="l">Total files</div></div>
</div>

<div class="legend">
  <span><i style="background:#2f7a5c"></i> clean parse</span>
  <span><i style="background:#c8922f"></i> suspicious (low density / garbage type)</span>
  <span><i style="background:#b7413a"></i> parser error</span>
  <span style="opacity:0.6">— click a cell for detail, click an app name to collapse</span>
</div>

<div id="apps"></div>
<div id="detail"></div>

<script>
const DATA = ${dataJson};
const appsEl = document.getElementById('apps');
const detailEl = document.getElementById('detail');

const appNames = Object.keys(DATA.byApp).sort();
for (const app of appNames) {
  const files = DATA.byApp[app];
  const group = document.createElement('div');
  group.className = 'app-group';

  const header = document.createElement('div');
  header.className = 'app-header';
  const susp = files.filter(f => f.status === 'suspicious').length;
  const err = files.filter(f => f.status === 'error').length;
  header.innerHTML = app + ' <span class="count">(' + files.length + ' files' +
    (susp ? ', ' + susp + ' suspicious' : '') +
    (err ? ', ' + err + ' errors' : '') + ')</span>';

  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const f of files) {
    const cell = document.createElement('div');
    cell.className = 'cell ' + f.status;
    cell.title = f.rel;
    cell.addEventListener('click', () => {
      detailEl.className = 'show';
      detailEl.innerHTML =
        '<div class="path">' + f.rel + '</div>' +
        '<div class="meta">' + f.kb + 'KB, ' + f.nodes + ' node(s), status: ' + f.status + '</div>' +
        (f.reasons.length ? '<div class="reasons">' + f.reasons.join('<br/>') + '</div>' : '');
    });
    grid.appendChild(cell);
  }

  header.addEventListener('click', () => {
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
  });

  group.appendChild(header);
  group.appendChild(grid);
  appsEl.appendChild(group);
}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`Totals: ${totalOk} ok, ${totalSuspicious} suspicious, ${totalError} error, ${results.length} files`);
