// Orphan/unused shared-component detector tests (roadmap item #5).
// fixtures/orphan-app/ is a small synthetic "app" built from real data:
//   - shared-components/rest-data-sources/MovieDB.apx — copied verbatim
//     from sample-application-search; genuinely used via `restSource:
//     @MovieDB` in shared-components/search-configs.apx (also copied
//     verbatim) — confirmed real usage, not assumed.
//   - shared-components/rest-data-sources/Unused-Source.apx — synthetic,
//     deliberately never referenced anywhere, to prove detection actually
//     catches something (the real corpus sample didn't happen to contain
//     a genuine orphan to point at).
//   - shared-components/themes/theme.apx — deliberately has an
//     unreferenced identifier too, to prove themes/ is excluded regardless.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { isSharedComponentFile, findOrphans } = require('../src/orphan-detector');

const APP_ROOT = path.join(__dirname, '..', 'fixtures', 'orphan-app');

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.apx')) out.push(full);
  }
}

function loadAppFiles() {
  const paths = [];
  walk(APP_ROOT, paths);
  return paths.map((fsPath) => ({ fsPath, text: fs.readFileSync(fsPath, 'utf8') }));
}

test('isSharedComponentFile accepts rest-data-sources, rejects themes and static-files', () => {
  assert.equal(isSharedComponentFile('C:/app/shared-components/rest-data-sources/x.apx'), true);
  assert.equal(isSharedComponentFile('C:/app/shared-components/themes/theme.apx'), false);
  assert.equal(isSharedComponentFile('C:/app/shared-components/static-files/img/x.apx'), false);
  assert.equal(isSharedComponentFile('C:/app/pages/p00001.apx'), false);
});

test('findOrphans does NOT flag MovieDB — it is genuinely referenced (real data)', () => {
  const orphans = findOrphans(loadAppFiles());
  assert.ok(!orphans.some((o) => o.identifier === 'MovieDB'), 'MovieDB is used via @MovieDB in search-configs.apx and must not be flagged');
});

test('findOrphans DOES flag UnusedWeatherApi — genuinely never referenced', () => {
  const orphans = findOrphans(loadAppFiles());
  const found = orphans.find((o) => o.identifier === 'UnusedWeatherApi');
  assert.ok(found, 'UnusedWeatherApi should be flagged as an orphan');
  assert.equal(found.typeName, 'restDataSource');
  assert.ok(found.fsPath.includes('Unused-Source.apx'));
});

test('findOrphans never reports anything from shared-components/themes/', () => {
  const orphans = findOrphans(loadAppFiles());
  assert.ok(
    orphans.every((o) => !o.fsPath.includes(`${path.sep}themes${path.sep}`)),
    'theme.apx has an unreferenced identifier on purpose — it must never surface as an orphan'
  );
});

test('findOrphans only considers root-level blocks, not a REST source\'s nested "operation" block', () => {
  const orphans = findOrphans(loadAppFiles());
  assert.ok(!orphans.some((o) => o.typeName === 'operation'), 'nested operation blocks are implementation detail, not independently-referenced components');
});

test('findOrphans returns an empty array when there are no shared-component files at all', () => {
  const orphans = findOrphans([{ fsPath: 'C:/app/pages/p00001.apx', text: 'page 1 (\n)\n' }]);
  assert.deepEqual(orphans, []);
});
