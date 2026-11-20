// VS Code side of the anonymous telemetry (design G1). Builds one
// TelemetryLogger around the PostHog sender: VS Code's logger enforces the
// user's VS Code telemetry setting and scrubs values; the sender enforces
// our own setting and the allowlist. What is sent: telemetry.json.

const vscode = require('vscode');
const crypto = require('crypto');
const { createPostHogSender } = require('./posthog-sender');

// PostHog EU Cloud (Frankfurt), project "APEXLang View" (id 359325); region
// changed from US to EU by the author on 2026-11-20. The project key is
// PostHog's public, write-only project token, designed to be embedded in
// client code (it cannot read any data). If it is ever replaced by a value
// that is not a phc_ key, telemetry is not created and nothing is sent.
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const POSTHOG_PROJECT_KEY = 'phc_q2UEPLtsuUzNS26kybmtaGpc4yXRx5vpQRHgBhumZqpn';
const ANON_ID_KEY = 'apexlangView.anonId';

let logger = null;
let sender = null;
// "First use per panel session": the only place repeats are removed.
// Cleared when the panel is (re)created.
const seenThisPanel = new Set();

function isConfigured() {
  return typeof POSTHOG_PROJECT_KEY === 'string' && /^phc_/.test(POSTHOG_PROJECT_KEY) && !POSTHOG_PROJECT_KEY.includes('PLACEHOLDER');
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {(line: string) => void} log
 */
function initTelemetry(context, log) {
  if (!isConfigured()) {
    log('telemetry: no project key configured; nothing will be sent');
    return;
  }
  let distinctId = context.globalState.get(ANON_ID_KEY);
  if (!distinctId) {
    distinctId = crypto.randomUUID();
    context.globalState.update(ANON_ID_KEY, distinctId);
  }
  const packageJSON = (context.extension && context.extension.packageJSON) || {};
  sender = createPostHogSender({
    host: POSTHOG_HOST,
    key: POSTHOG_PROJECT_KEY,
    distinctId,
    common: { extVersion: packageJSON.version, vscodeVersion: vscode.version, os: process.platform },
    ownRoot: context.extensionPath,
    isEnabled: () => vscode.workspace.getConfiguration('apexlangView').get('telemetry.enabled', true),
    log,
  });
  logger = vscode.env.createTelemetryLogger(sender, {
    ignoreUnhandledErrors: false,
    ignoreBuiltInCommonProperties: true,
  });
  context.subscriptions.push(logger);
}

// Sends a usage event. `oncePerPanel`, when given, is a key: the event is
// sent only the first time that key is seen in the current panel session.
function track(name, props, oncePerPanel) {
  if (!logger) return;
  if (oncePerPanel !== undefined) {
    const key = `${name}|${oncePerPanel}`;
    if (seenThisPanel.has(key)) return;
    seenThisPanel.add(key);
  }
  try {
    logger.logUsage(name, props || {});
  } catch {
    // telemetry must never break the extension
  }
}

// Sends an error event: only its name, the `where` code, and our own stack
// frames leave the machine (see posthog-sender.js).
function trackError(where, err) {
  if (!logger || !err) return;
  try {
    const error = err instanceof Error ? err : Object.assign(new Error('error'), { name: err.name, stack: err.stack });
    logger.logError(error, { where });
  } catch {
    // telemetry must never break the extension
  }
}

function resetPanelSession() {
  seenThisPanel.clear();
}

// Best effort within VS Code's deactivate window.
function flushTelemetry() {
  return sender ? sender.flush() : Promise.resolve();
}

module.exports = { initTelemetry, track, trackError, resetPanelSession, flushTelemetry };
