// A tiny VS Code TelemetrySender that posts anonymous events to PostHog's
// batch endpoint (design G1, Technical Plan §1). No vscode import and no
// third-party library, so it is unit-testable under plain `node --test`.
//
// Privacy rules enforced here, at the one point every event passes:
//   - nothing is sent while isEnabled() is false (our own off switch; VS
//     Code's own telemetry setting is enforced by its TelemetryLogger);
//   - only events and property values listed in telemetry-schema.js are
//     sent; every other key is dropped;
//   - errors carry only their name, a fixed call-site code, and stack frames
//     from this extension's own files as basename + line. Never the message.

const https = require('https');
const path = require('path');
const { EVENTS, ERROR_EVENT, WHERE_CODES, COMMON_KEYS, cleanFreeText } = require('./telemetry-schema');

const MAX_EVENTS_PER_SESSION = 200;
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_FRAMES = 10;

// POSTs `body` (a JSON string) to `url` with Node's https module, so VS
// Code's proxy settings apply. Resolves with the HTTP status code, or 0 on
// any network error or timeout. Never rejects.
function httpsPost(url, body, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const target = new URL(url);
      const req = https.request(
        {
          hostname: target.hostname,
          path: target.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode || 0));
          res.on('error', () => resolve(0));
        }
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => resolve(0));
      req.end(body);
    } catch {
      resolve(0);
    }
  });
}

// VS Code prefixes event names with "<publisher>.<extension>/".
function stripPrefix(eventName) {
  const name = String(eventName || '');
  const slash = name.lastIndexOf('/');
  return slash >= 0 ? name.slice(slash + 1) : name;
}

function normalizeLocation(text) {
  let s = String(text || '');
  try {
    s = decodeURIComponent(s);
  } catch {
    // keep as is
  }
  return s.replace(/\\/g, '/').toLowerCase();
}

// This extension's own source files. Used as a fallback when VS Code has
// redacted the user's install path out of a stack trace.
const OWN_FILES = new Set([
  'extension.js', 'parser.js', 'diff.js', 'page-nav.js', 'app-map.js',
  'telemetry.js', 'telemetry-schema.js', 'posthog-sender.js',
  'graph.js', 'search-logic.js',
]);

// Keeps only stack frames from this extension's own files, reduced to
// PostHog's raw JavaScript frame: { platform, function, filename (basename
// only), lineno, colno, in_app }. PostHog rejects frames without `platform`.
// `function` is the name of one of our own functions, never user data.
// A frame is ours when its location is under ownRoot (this matches both
// Node paths and the webview's resource URLs, which embed the same install
// path), or, if the path was redacted, when its file name is one of ours and
// it is not inside node_modules.
const FRAME_RE = /^\s*at\s+(?:(.+?)\s+\()?((?:[a-z][\w+.-]*:\/\/)?[^\s()]+):(\d+):(\d+)\)?\s*$/i;
const SAFE_FUNCTION = /^[\w$.<>\[\] ]{1,80}$/;

function ownFrames(stack, ownRoot) {
  if (!stack) return [];
  const root = ownRoot ? normalizeLocation(ownRoot).replace(/\/+$/, '') + '/' : null;
  const frames = [];
  for (const line of String(stack).split('\n')) {
    const m = line.match(FRAME_RE);
    if (!m) continue;
    const location = normalizeLocation(m[2]);
    const underRoot = root !== null && location.includes(root);
    const ownName = OWN_FILES.has(path.posix.basename(location)) && !location.includes('/node_modules/');
    if (!underRoot && !ownName) continue;
    const fn = m[1] && SAFE_FUNCTION.test(m[1]) ? m[1] : '<anonymous>';
    frames.push({
      platform: 'node:javascript',
      function: fn,
      filename: path.posix.basename(location),
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: true,
    });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}

// Frames travel from telemetry.js to the sender through VS Code's logger as
// text: "file:line:col:function" entries joined by ",". There is no path in
// it, so VS Code's path redaction leaves it alone. A function name that looks
// like a secret to VS Code's scrubber (it would redact the whole value) is
// sent as <anonymous>.
const SCRUBBER_WORDS = /key|token|sig|secret|password|passwd|pwd/i;

function encodeFrames(frames) {
  return frames
    .map((f) => {
      const fn = SCRUBBER_WORDS.test(f.function) ? '<anonymous>' : f.function;
      return `${f.filename}:${f.lineno}:${f.colno}:${fn}`;
    })
    .join(',');
}

// Parses encodeFrames' text back into frames. Anything that is not exactly
// one of our own file names with numeric positions is dropped, so this
// value cannot carry anything else off the machine.
function decodeFrames(text) {
  if (typeof text !== 'string' || !text) return [];
  const frames = [];
  for (const part of text.split(',')) {
    const m = part.match(/^([\w.-]+):(\d{1,7}):(\d{1,7}):(.*)$/);
    if (!m || !OWN_FILES.has(m[1])) continue;
    frames.push({
      platform: 'node:javascript',
      function: SAFE_FUNCTION.test(m[4]) ? m[4] : '<anonymous>',
      filename: m[1],
      lineno: Number(m[2]),
      colno: Number(m[3]),
      in_app: true,
    });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}

/**
 * @param {object} opts
 * @param {string} opts.host        PostHog host, e.g. https://eu.i.posthog.com
 * @param {string} opts.key         public project key (phc_…)
 * @param {string} opts.distinctId  random per-install ID
 * @param {{extVersion:string, vscodeVersion:string, os:string}} opts.common
 * @param {string} opts.ownRoot     the extension's install path
 * @param {() => boolean} opts.isEnabled  our own setting, read live
 * @param {(line: string) => void} [opts.log]  output-channel logger
 * @param {(url: string, body: string, timeoutMs: number) => Promise<number>} [opts.request]
 * @param {() => Date} [opts.now]
 */
function createPostHogSender(opts) {
  const {
    host,
    key,
    distinctId,
    common,
    ownRoot,
    isEnabled,
    log = () => {},
    request = httpsPost,
    now = () => new Date(),
  } = opts;

  const commonProps = {};
  for (const k of COMMON_KEYS) commonProps[k] = cleanFreeText(common && common[k]);

  let queue = [];
  let accepted = 0;
  let timer = null;
  const sentErrors = new Set();
  const loggedDrops = new Set();

  function dropped(cause) {
    if (loggedDrops.has(cause)) return;
    loggedDrops.add(cause);
    log(`telemetry: dropped: ${cause}`);
  }

  function enabled() {
    try {
      return !!isEnabled();
    } catch {
      return false;
    }
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function enqueue(event, props) {
    if (accepted >= MAX_EVENTS_PER_SESSION) {
      dropped('cap reached');
      return;
    }
    accepted++;
    queue.push({
      event,
      timestamp: now().toISOString(),
      properties: { distinct_id: distinctId, $process_person_profile: false, ...commonProps, ...props },
    });
    if (queue.length >= BATCH_SIZE) {
      flush();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, FLUSH_INTERVAL_MS);
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
  }

  function sendEventData(eventName, data) {
    if (!enabled()) {
      dropped('setting off');
      return;
    }
    const name = stripPrefix(eventName);
    const spec = Object.prototype.hasOwnProperty.call(EVENTS, name) ? EVENTS[name] : null;
    if (!spec) {
      dropped('not allowed');
      return;
    }
    const props = {};
    for (const [prop, allowed] of Object.entries(spec)) {
      const value = data ? data[prop] : undefined;
      if (allowed.includes(value)) props[prop] = value;
    }
    enqueue(name, props);
  }

  function sendErrorData(error, data) {
    if (!enabled()) {
      dropped('setting off');
      return;
    }
    // Frames taken by telemetry.js before VS Code's path redaction come
    // first; the stack itself is the fallback (e.g. VS Code's own
    // unhandled-error reports, which don't pass through trackError).
    let frames = decodeFrames(data && data.ownFrames);
    if (frames.length === 0) frames = ownFrames(error && error.stack, ownRoot);
    if (frames.length === 0) {
      dropped('error without own stack frame');
      return;
    }
    const name = cleanFreeText(error && error.name);
    const where = data && WHERE_CODES.includes(data.where) ? data.where : 'unhandled';
    const signature = `${where}|${name}|${frames[0].filename}:${frames[0].lineno}`;
    if (sentErrors.has(signature)) return;
    sentErrors.add(signature);
    enqueue(ERROR_EVENT, {
      where,
      $exception_list: [{ type: name, value: name, stacktrace: { type: 'raw', frames } }],
    });
  }

  function flush() {
    clearTimer();
    if (queue.length === 0) return Promise.resolve();
    const batch = queue;
    queue = [];
    if (!enabled()) {
      dropped('setting off');
      return Promise.resolve();
    }
    const body = JSON.stringify({ api_key: key, batch });
    return Promise.resolve()
      .then(() => request(`${host}/batch/`, body, REQUEST_TIMEOUT_MS))
      .then((status) => {
        if (status >= 200 && status < 300) log(`telemetry: sent ${batch.length} events`);
        else log(`telemetry: send failed (${status || 'network'}); ${batch.length} events dropped`);
      })
      .catch(() => {});
  }

  return { sendEventData, sendErrorData, flush };
}

module.exports = { createPostHogSender, ownFrames, encodeFrames, decodeFrames, stripPrefix, MAX_EVENTS_PER_SESSION, BATCH_SIZE };
