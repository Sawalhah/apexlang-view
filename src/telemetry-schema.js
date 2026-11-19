// The only copy of the closed list of anonymous telemetry events (design
// G1, Technical Plan §1 "Allowlist, defined once"). The PostHog sender
// filters every payload against it, and test/telemetry.test.js checks that
// telemetry.json (the published list) matches it. No vscode import, so it is
// unit-testable under plain `node --test`.
//
// Nothing about the user or their application is ever listed here: no file
// names, paths, page or component names, .apx content, workspace names, git
// data, or error message text.

// Event name -> { property name -> allowed values }.
const EVENTS = {
  activated: {},
  command: {
    name: ['openGraph', 'switchFile', 'openAppMap', 'toggleDiff', 'compareWithCommit', 'showLogs'],
  },
  viewChanged: {
    view: ['tree', 'byType', 'graph'],
  },
  featureUsed: {
    name: ['search', 'jumpToSource', 'openExternalPage', 'breadcrumb'],
  },
  fileParsed: {
    sizeBucket: ['<10KB', '<100KB', '<1MB', '>=1MB'],
    msBucket: ['<50', '<200', '<1000', '>=1000'],
    nodeBucket: ['<50', '<500', '>=500'],
    suspicious: [true, false],
  },
};

// Error events are sent as PostHog's `$exception` with only: the error name,
// one of these call-site codes, and our own stack frames as file:line.
const ERROR_EVENT = '$exception';
const WHERE_CODES = [
  'refresh.parse',
  'refresh.diff',
  'git.show',
  'git.log',
  'appMap.scan',
  'webview.render',
  'unhandled',
];

// Added by the sender to every event (error events included).
const COMMON_KEYS = ['extVersion', 'vscodeVersion', 'os'];

// Values with no fixed list (the common keys and an error's name) must be a
// short plain token; anything else is replaced by 'other'.
const FREE_TEXT = /^[\w.\-]{1,64}$/;
function cleanFreeText(value) {
  return typeof value === 'string' && FREE_TEXT.test(value) ? value : 'other';
}

function sizeBucket(bytes) {
  if (bytes < 10 * 1024) return '<10KB';
  if (bytes < 100 * 1024) return '<100KB';
  if (bytes < 1024 * 1024) return '<1MB';
  return '>=1MB';
}

function msBucket(ms) {
  if (ms < 50) return '<50';
  if (ms < 200) return '<200';
  if (ms < 1000) return '<1000';
  return '>=1000';
}

function nodeBucket(count) {
  if (count < 50) return '<50';
  if (count < 500) return '<500';
  return '>=500';
}

module.exports = {
  EVENTS,
  ERROR_EVENT,
  WHERE_CODES,
  COMMON_KEYS,
  FREE_TEXT,
  cleanFreeText,
  sizeBucket,
  msBucket,
  nodeBucket,
};
