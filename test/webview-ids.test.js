// Static check: every element graph.js looks up by id must exist in the
// webview HTML that extension.js generates. A missing id made the whole
// webview crash in July ("Cannot read properties of null").

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const graphJs = fs.readFileSync(path.join(root, 'media', 'graph.js'), 'utf8');
const extensionJs = fs.readFileSync(path.join(root, 'src', 'extension.js'), 'utf8');

test('every getElementById in graph.js has a matching id in getWebviewHtml', () => {
  const start = extensionJs.indexOf('function getWebviewHtml');
  assert.ok(start >= 0, 'getWebviewHtml not found in extension.js');
  const html = extensionJs.slice(start);
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const usedIds = [...new Set([...graphJs.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]))];
  assert.ok(usedIds.length > 0, 'no getElementById calls found');
  const missing = usedIds.filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, []);
});
