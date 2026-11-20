// Anonymous telemetry (design G1): posthog-sender.js and telemetry-schema.js
// are vscode-free, so the privacy rules are tested headless with a fake
// network request.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createPostHogSender, ownFrames, encodeFrames, decodeFrames, MAX_EVENTS_PER_SESSION, BATCH_SIZE } = require('../src/posthog-sender');
const schema = require('../src/telemetry-schema');

const OWN_ROOT = 'C:\\Users\\someone\\.vscode\\extensions\\mohammadsawalhah.apexlang-view-0.2.0';

function makeSender(overrides = {}) {
  const requests = [];
  const logs = [];
  let enabled = true;
  const sender = createPostHogSender({
    host: 'https://us.i.posthog.com',
    key: 'phc_test',
    distinctId: 'uuid-1',
    common: { extVersion: '0.2.0', vscodeVersion: '1.96.0', os: 'win32' },
    ownRoot: OWN_ROOT,
    isEnabled: () => enabled,
    log: (line) => logs.push(line),
    request: async (url, body) => {
      requests.push({ url, body: JSON.parse(body) });
      return 200;
    },
    now: () => new Date('2026-11-20T10:00:00.000Z'),
    ...overrides,
  });
  return { sender, requests, logs, setEnabled: (v) => { enabled = v; } };
}

async function sentEvents(sender, requests) {
  await sender.flush();
  return requests.flatMap((r) => r.body.batch);
}

function ownError(name = 'TypeError', message = 'Cannot read C:\\Users\\someone\\secret.apx') {
  const err = new Error(message);
  err.name = name;
  err.stack = [
    `${name}: ${message}`,
    `    at parseApxToGraph (${OWN_ROOT}\\src\\parser.js:212:15)`,
    `    at refresh (${OWN_ROOT}\\src\\extension.js:550:13)`,
    '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
  ].join('\n');
  return err;
}

test('payload shape matches PostHog batch format, with common properties', async () => {
  const { sender, requests } = makeSender();
  sender.sendEventData('mohammadsawalhah.apexlang-view/command', { name: 'toggleDiff' });
  await sender.flush();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://us.i.posthog.com/batch/');
  assert.equal(requests[0].body.api_key, 'phc_test');
  assert.deepEqual(requests[0].body.batch, [{
    event: 'command',
    timestamp: '2026-11-20T10:00:00.000Z',
    properties: {
      distinct_id: 'uuid-1',
      $process_person_profile: false,
      extVersion: '0.2.0',
      vscodeVersion: '1.96.0',
      os: 'win32',
      name: 'toggleDiff',
    },
  }]);
});

test('unknown event names are dropped', async () => {
  const { sender, requests } = makeSender();
  sender.sendEventData('fileOpened', { path: 'C:\\x.apx' });
  assert.deepEqual(await sentEvents(sender, requests), []);
});

test('unknown keys, disallowed values, and common.* keys are dropped', async () => {
  const { sender, requests } = makeSender();
  sender.sendEventData('command', { name: 'deleteEverything', fileName: 'p1.apx', 'common.machineId': 'abc' });
  sender.sendEventData('viewChanged', { view: 'graph', extra: 'x' });
  const events = await sentEvents(sender, requests);
  assert.equal(events.length, 2);
  assert.deepEqual(Object.keys(events[0].properties).sort(),
    ['$process_person_profile', 'distinct_id', 'extVersion', 'os', 'vscodeVersion']);
  assert.equal(events[1].properties.view, 'graph');
  assert.equal(events[1].properties.extra, undefined);
});

test('free-text common values outside the allowed pattern become "other"', async () => {
  const { sender, requests } = makeSender({ common: { extVersion: '0.2.0', vscodeVersion: '1.96 (C:\\Users\\me)', os: 'win32' } });
  sender.sendEventData('activated', {});
  const [event] = await sentEvents(sender, requests);
  assert.equal(event.properties.vscodeVersion, 'other');
});

test('nothing is sent while our setting is off, for events and errors', async () => {
  const { sender, requests, logs, setEnabled } = makeSender();
  setEnabled(false);
  sender.sendEventData('activated', {});
  sender.sendErrorData(ownError(), { where: 'refresh.parse' });
  assert.deepEqual(await sentEvents(sender, requests), []);
  assert.ok(logs.includes('telemetry: dropped: setting off'));
});

test('queued events are not sent if the setting is turned off before flush', async () => {
  const { sender, requests, setEnabled } = makeSender();
  sender.sendEventData('activated', {});
  setEnabled(false);
  assert.deepEqual(await sentEvents(sender, requests), []);
});

test('error payload has the name, where code, and own frames only, never the message', async () => {
  const { sender, requests } = makeSender();
  sender.sendErrorData(ownError(), { where: 'refresh.parse' });
  const [event] = await sentEvents(sender, requests);
  assert.equal(event.event, '$exception');
  assert.equal(event.properties.where, 'refresh.parse');
  assert.deepEqual(event.properties.$exception_list, [{
    type: 'TypeError',
    value: 'TypeError',
    stacktrace: { type: 'raw', frames: [
      { platform: 'node:javascript', function: 'parseApxToGraph', filename: 'parser.js', lineno: 212, colno: 15, in_app: true },
      { platform: 'node:javascript', function: 'refresh', filename: 'extension.js', lineno: 550, colno: 13, in_app: true },
    ] },
  }]);
  const raw = JSON.stringify(requests);
  assert.ok(!raw.includes('secret'), 'message text leaked');
  assert.ok(!raw.includes('Users'), 'path leaked');
  assert.ok(!raw.includes('\\\\'), 'backslash path leaked');
});

test('webview frames (resource URLs under the install path) count as own', async () => {
  const { sender, requests } = makeSender();
  const err = new Error('boom');
  err.name = 'TypeError';
  err.stack = 'TypeError: boom\n    at render (https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/someone/.vscode/extensions/mohammadsawalhah.apexlang-view-0.2.0/media/graph.js:640:9)';
  sender.sendErrorData(err, { where: 'webview.render' });
  const [event] = await sentEvents(sender, requests);
  assert.deepEqual(event.properties.$exception_list[0].stacktrace.frames, [
    { platform: 'node:javascript', function: 'render', filename: 'graph.js', lineno: 640, colno: 9, in_app: true },
  ]);
});

test('unknown where codes become "unhandled"; errors without own frames are dropped', async () => {
  const { sender, requests } = makeSender();
  sender.sendErrorData(ownError(), { where: 'C:\\some\\path' });
  const foreign = new Error('x');
  foreign.stack = 'Error: x\n    at foo (C:\\other-extension\\node_modules\\lib\\index.js:1:1)';
  sender.sendErrorData(foreign, {});
  const events = await sentEvents(sender, requests);
  assert.equal(events.length, 1);
  assert.equal(events[0].properties.where, 'unhandled');
});

test('the same error is sent once per session', async () => {
  const { sender, requests } = makeSender();
  sender.sendErrorData(ownError(), { where: 'refresh.parse' });
  sender.sendErrorData(ownError(), { where: 'refresh.parse' });
  assert.equal((await sentEvents(sender, requests)).length, 1);
});

// VS Code's TelemetryLogger.logError may redact every path in the stack,
// file name included, before the sender sees it. telemetry.js passes the
// frames it took from the original stack in data.ownFrames.
test('frames passed in data.ownFrames are used when the stack was redacted', async () => {
  const { sender, requests } = makeSender();
  const frames = ownFrames(ownError().stack, OWN_ROOT);
  const redacted = new Error('<REDACTED: user-file-path>');
  redacted.name = 'TypeError';
  redacted.stack = 'TypeError: x\n    at parseApxToGraph (<REDACTED: user-file-path>:212:15)';
  assert.deepEqual(ownFrames(redacted.stack, OWN_ROOT), [], 'redacted stack has no frames of its own');
  sender.sendErrorData(redacted, { where: 'refresh.parse', ownFrames: encodeFrames(frames) });
  const [event] = await sentEvents(sender, requests);
  assert.deepEqual(event.properties.$exception_list[0].stacktrace.frames, frames);
  assert.ok(!('ownFrames' in event.properties), 'the transport value itself is not sent');
});

test('encoded frames contain no path, and decoding accepts only our own file names', () => {
  const text = encodeFrames(ownFrames(ownError().stack, OWN_ROOT));
  assert.equal(text, 'parser.js:212:15:parseApxToGraph,extension.js:550:13:refresh');
  assert.ok(!/[\\/]/.test(text));
  assert.deepEqual(decodeFrames('C:\\Users\\x\\secret.apx:1:1:f,other.js:2:2:g,diff.js:3:4:has spaces/slash'), [
    { platform: 'node:javascript', function: '<anonymous>', filename: 'diff.js', lineno: 3, colno: 4, in_app: true },
  ]);
  assert.deepEqual(decodeFrames(undefined), []);
});

test('function names VS Code would treat as secrets are sent as <anonymous>', () => {
  const text = encodeFrames([{ filename: 'diff.js', lineno: 1, colno: 1, function: 'cacheKey' }]);
  assert.equal(text, 'diff.js:1:1:<anonymous>');
});

test('the same frame under different where codes is sent once per where code', async () => {
  const { sender, requests } = makeSender();
  sender.sendErrorData(ownError(), { where: 'git.show' });
  sender.sendErrorData(ownError(), { where: 'git.log' });
  sender.sendErrorData(ownError(), { where: 'git.log' });
  const events = await sentEvents(sender, requests);
  assert.deepEqual(events.map((e) => e.properties.where), ['git.show', 'git.log']);
});

test('a batch is sent automatically once BATCH_SIZE events are queued', async () => {
  const { sender, requests } = makeSender();
  for (let i = 0; i < BATCH_SIZE; i++) sender.sendEventData('activated', {});
  await new Promise((r) => setImmediate(r));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.batch.length, BATCH_SIZE);
});

test('at most MAX_EVENTS_PER_SESSION events are sent', async () => {
  const { sender, requests, logs } = makeSender();
  for (let i = 0; i < MAX_EVENTS_PER_SESSION + 50; i++) sender.sendEventData('activated', {});
  const events = await sentEvents(sender, requests);
  assert.equal(events.length, MAX_EVENTS_PER_SESSION);
  assert.ok(logs.includes('telemetry: dropped: cap reached'));
});

test('network failure does not throw', async () => {
  const { sender, logs } = makeSender({ request: async () => { throw new Error('offline'); } });
  sender.sendEventData('activated', {});
  await sender.flush();
  const failing = makeSender({ request: async () => 0 });
  failing.sender.sendEventData('activated', {});
  await failing.sender.flush();
  assert.ok(failing.logs.some((l) => l.startsWith('telemetry: send failed')));
  assert.ok(Array.isArray(logs));
});

test('telemetry.json lists exactly the events and properties in telemetry-schema.js', () => {
  const published = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'telemetry.json'), 'utf8'));
  assert.deepEqual(Object.keys(published.commonProperties).sort(), [...schema.COMMON_KEYS].sort());
  const expectedEvents = [...Object.keys(schema.EVENTS), schema.ERROR_EVENT].sort();
  assert.deepEqual(Object.keys(published.events).sort(), expectedEvents);
  for (const [name, props] of Object.entries(schema.EVENTS)) {
    const publishedProps = published.events[name].properties;
    assert.deepEqual(Object.keys(publishedProps).sort(), Object.keys(props).sort(), `properties of ${name}`);
    for (const [prop, values] of Object.entries(props)) {
      assert.deepEqual(publishedProps[prop].values, values, `values of ${name}.${prop}`);
    }
  }
  assert.deepEqual(published.events[schema.ERROR_EVENT].properties.where.values, schema.WHERE_CODES);
});

test('bucket helpers return only listed values', () => {
  const { sizeBucket, msBucket, nodeBucket, EVENTS } = schema;
  for (const b of [0, 20000, 500000, 5000000].map(sizeBucket)) assert.ok(EVENTS.fileParsed.sizeBucket.includes(b));
  for (const b of [1, 100, 500, 5000].map(msBucket)) assert.ok(EVENTS.fileParsed.msBucket.includes(b));
  for (const b of [1, 100, 5000].map(nodeBucket)) assert.ok(EVENTS.fileParsed.nodeBucket.includes(b));
});
