// G2 / F3 guard: with Diff off, tree rows must sit exactly where they did in
// 0.1.0. The 0.1.0 regression was a 3px transparent border-left on every
// row; the diff marker is now an inset box-shadow, which takes no layout
// space. Reads the working-copy stylesheet only: no git, no tag, so this
// keeps working when later versions change the toolbar.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'media', 'graph.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Returns the declaration block bodies of every rule whose selector list is
// exactly `selector` (whitespace-normalized).
function rulesFor(selector) {
  const bodies = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selectors = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

function propertyNames(body) {
  return body.split(';').map((d) => d.split(':')[0].trim()).filter(Boolean);
}

test('.tree-row sets no border-left (rows keep their 0.1.0 position)', () => {
  const bodies = rulesFor('.tree-row');
  assert.ok(bodies.length > 0, '.tree-row rule not found');
  for (const body of bodies) {
    assert.ok(!propertyNames(body).some((p) => p.startsWith('border')), `.tree-row has a border: ${body.trim()}`);
  }
});

for (const cls of ['.tree-row.diff-added', '.tree-row.diff-changed']) {
  test(`${cls} sets only box-shadow`, () => {
    const bodies = rulesFor(cls);
    assert.ok(bodies.length > 0, `${cls} rule not found`);
    for (const body of bodies) {
      assert.deepEqual(propertyNames(body), ['box-shadow']);
    }
  });
}
