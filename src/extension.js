const vscode = require('vscode');
const path = require('path');
const { parseApxToGraph, assessParseQuality } = require('./parser');
const { guessAppRoot, buildPageIndex, injectNavStubs } = require('./page-nav');
const { findOrphans } = require('./orphan-detector');
const { buildAppMap } = require('./app-map');

// Output channel for everything — panel lifecycle, parse timing, and any
// exception (extension-side or reported up from the webview). View via
// "APEXLang View: Show Logs" or View → Output → "APEXLang View".
let output;
function log(line) {
  const ts = new Date().toISOString().split('T')[1].replace('Z', '');
  output.appendLine(`[${ts}] ${line}`);
}
function logError(prefix, err) {
  log(`${prefix}: ${err && err.message ? err.message : String(err)}`);
  if (err && err.stack) log(err.stack);
}

// Known-benign noise: Node's own inspector/network instrumentation reacting
// to some other extension's activity (observed stack is entirely
// node:inspector/node:internal/inspector/network_http — nothing from this
// extension's code anywhere in it). process-wide uncaughtException/
// unhandledRejection handlers below catch this too since they're global to
// the whole extension host, not scoped to our own code — filtered here so
// it doesn't bury real errors in the output channel.
function isKnownBenignNoise(err) {
  return !!(err && err.message === 'Missing dataLength in event');
}

// Single persistent panel. Switching which file it shows is done via the
// in-panel "Switch file..." picker (apexlangView.switchFile) — deliberately
// NOT by following the active text editor. An earlier version followed
// onDidChangeActiveTextEditor, but clicking a file in Explorer always opens
// it as a text tab first (core VS Code behavior, not something an
// extension can intercept or suppress) — so "following" the editor could
// never satisfy "don't open any tabs at all". The picker sidesteps the
// editor entirely: pick a file, graph updates, nothing else opens.
let panel = null;
let currentUri = null;
let debounceTimer = null;

// Page-number -> file fsPath index, one per app root, built lazily and
// cached (rebuilding on every refresh would mean a workspace file scan per
// keystroke during live-edit). Keyed by app root fspath so switching
// between two different apps in the same workspace doesn't share a stale
// index. The actual index/stub-injection logic lives in page-nav.js
// (vscode-free, unit-testable); this is just the vscode.workspace.findFiles
// glue that a plain Node test can't exercise (there is no `vscode` module
// outside a real Extension Development Host).
const pageIndexCache = new Map();

async function getPageIndex(appRoot) {
  if (pageIndexCache.has(appRoot)) return pageIndexCache.get(appRoot);
  const pattern = new vscode.RelativePattern(appRoot, '**/*.apx');
  const files = await vscode.workspace.findFiles(pattern, null, 5000);
  const map = buildPageIndex(files.map((f) => f.fsPath));
  pageIndexCache.set(appRoot, map);
  return map;
}

// Resolves parser.js's file-local navTargets (just page numbers) into real
// graph nodes/edges pointing at actual files — this cross-file resolution
// is deliberately kept OUT of parser.js, which has no filesystem access and
// should stay a pure single-file parser.
async function resolveNavTargets(uri, graph) {
  if (!graph.navTargets || graph.navTargets.length === 0) return;
  const appRoot = guessAppRoot(uri.fsPath);
  const pageIndex = await getPageIndex(appRoot);
  injectNavStubs(graph, uri.fsPath, pageIndex);
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  output = vscode.window.createOutputChannel('APEXLang View');
  context.subscriptions.push(output);
  log('Extension activated.');

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.showLogs', () => output.show())
  );

  process.on('uncaughtException', (err) => {
    if (isKnownBenignNoise(err)) return;
    logError('Uncaught exception', err);
  });
  process.on('unhandledRejection', (reason) => {
    if (isKnownBenignNoise(reason)) return;
    logError('Unhandled rejection', reason);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.openGraph', async (uri) => {
      try {
        await openGraphCommand(context, uri);
      } catch (err) {
        logError('apexlangView.openGraph failed', err);
        vscode.window.showErrorMessage(`APEXLang View: unexpected error — ${err.message}. See "APEXLang View" output channel for details.`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.switchFile', async () => {
      try {
        await switchFileCommand(context);
      } catch (err) {
        logError('apexlangView.switchFile failed', err);
        vscode.window.showErrorMessage(`APEXLang View: unexpected error — ${err.message}. See "APEXLang View" output channel for details.`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.openAppMap', async (uri) => {
      try {
        await openAppMapCommand(context, uri);
      } catch (err) {
        logError('apexlangView.openAppMap failed', err);
        vscode.window.showErrorMessage(`APEXLang View: unexpected error — ${err.message}. See "APEXLang View" output channel for details.`);
      }
    })
  );

  // Live refresh: re-parse on edits to whichever file the panel currently
  // shows. Registered once (not per-panel) since currentUri now changes
  // over the panel's lifetime instead of being fixed at creation.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!panel || !currentUri) return;
      if (e.document.uri.toString() !== currentUri.toString()) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refresh(currentUri).catch((err) => logError('live-refresh failed', err)), 400);
    })
  );

  // Follow the active editor: if the panel is already open and the user
  // clicks a different .apx file in Explorer, VS Code will open that file
  // as its own tab regardless of anything we do (unavoidable core
  // behavior) — but at least the graph panel updates to match instead of
  // sitting stale on whatever file it last showed. Only follows when the
  // panel is already open; opening a .apx file does NOT auto-open the panel.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!panel || !editor) return;
      const uri = editor.document.uri;
      if (uri.fsPath === (currentUri && currentUri.fsPath)) return;
      if (path.extname(uri.fsPath) !== '.apx') return;
      log(`Following active editor to ${uri.toString()}`);
      switchTo(context, uri).catch((err) => logError('follow-active-editor failed', err));
    })
  );
}

async function openGraphCommand(context, uri) {
  const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
  if (!targetUri) {
    vscode.window.showWarningMessage('APEXLang View: open an .apx file first, or use "APEXLang View: Switch File".');
    return;
  }

  if (panel) {
    if (targetUri.toString() === (currentUri && currentUri.toString()) && panel.active) {
      // Same file, panel already focused — treat as a close toggle.
      log(`Toggle close: ${targetUri.toString()}`);
      panel.dispose();
      return;
    }
    log(`Retargeting existing panel to ${targetUri.toString()}`);
    await switchTo(context, targetUri);
    return;
  }

  await createPanelAndShow(context, targetUri);
}

// Quick-pick every .apx file in the workspace and switch the graph to
// whichever one is chosen — never touches the text editor, never opens a
// tab. Opens the panel first if it isn't already open.
async function switchFileCommand(context) {
  const files = await vscode.workspace.findFiles('**/*.apx', '**/node_modules/**', 500);
  if (files.length === 0) {
    vscode.window.showInformationMessage('APEXLang View: no .apx files found in this workspace.');
    return;
  }

  const items = files
    .map((uri) => ({
      label: path.basename(uri.fsPath),
      description: vscode.workspace.asRelativePath(uri),
      uri,
    }))
    .sort((a, b) => a.description.localeCompare(b.description));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an .apx file to view',
    matchOnDescription: true,
  });
  if (!picked) return;

  log(`Switch-file picker: ${picked.uri.toString()}`);
  if (panel) {
    await switchTo(context, picked.uri);
  } else {
    await createPanelAndShow(context, picked.uri);
  }
}

// Scans the whole app root for .apx files, builds a page-to-page nav map
// (roadmap #2, app-level scope — see app-map.js), and pushes it into the
// panel. Opens the panel first (showing whichever file anchors the scan) if
// it isn't already open, matching openGraphCommand's own bootstrap.
async function openAppMapCommand(context, uri) {
  const anchorUri = uri || vscode.window.activeTextEditor?.document.uri || currentUri;
  if (!anchorUri) {
    vscode.window.showWarningMessage('APEXLang View: open an .apx file first, or use "APEXLang View: Switch File", so I know which app to map.');
    return;
  }

  const appRoot = guessAppRoot(anchorUri.fsPath);
  log(`Building app map for: ${appRoot}`);
  const pattern = new vscode.RelativePattern(appRoot, '**/*.apx');
  const uris = await vscode.workspace.findFiles(pattern, null, 5000);
  const files = [];
  for (const u of uris) {
    try {
      const bytes = await vscode.workspace.fs.readFile(u);
      files.push({ fsPath: u.fsPath, text: Buffer.from(bytes).toString('utf8') });
    } catch (err) {
      logError(`openAppMap: could not read ${u.fsPath}`, err);
    }
  }

  const appMap = buildAppMap(files);
  log(`App map: ${appMap.pages.length} page(s), ${appMap.edges.length} edge(s)`);

  if (!panel) {
    await createPanelAndShow(context, anchorUri);
  } else {
    panel.reveal(panel.viewColumn, true);
  }
  panel.webview.postMessage({ type: 'appMap', appMap });
}

// NOT CURRENTLY WIRED TO A COMMAND (roadmap #5, deliberately shelved
// 2026-07-23) — real-corpus validation showed the @identifier-only
// detection this relies on is unreliable: most shared-component types
// (LOVs, files, authentication schemes, etc.) are actually referenced via a
// plain NAME string elsewhere, not the bare `@identifier` syntax this
// checks. Confirmed against 180 real apps: restDataSource 1/26 referenced
// this way, LOV 1/105, file 0/383. Shipping "Find Unused Components" on
// this alone would flag mostly-used real components as orphaned. Kept
// here, tested, and correct at what it actually does — re-wire only after
// adding real by-name reference matching per type, which is a separate,
// larger effort, not a quick follow-up.
async function findUnusedComponentsCommand(context) {
  const anchorUri = vscode.window.activeTextEditor?.document.uri || currentUri;
  if (!anchorUri) {
    vscode.window.showWarningMessage('APEXLang View: open (or view the graph for) an .apx file first, so I know which app to scan.');
    return;
  }

  const appRoot = guessAppRoot(anchorUri.fsPath);
  log(`Scanning for unused shared components under: ${appRoot}`);
  const pattern = new vscode.RelativePattern(appRoot, '**/*.apx');
  const uris = await vscode.workspace.findFiles(pattern, null, 5000);
  const files = [];
  for (const uri of uris) {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      files.push({ fsPath: uri.fsPath, text: Buffer.from(bytes).toString('utf8') });
    } catch (err) {
      logError(`findUnusedComponents: could not read ${uri.fsPath}`, err);
    }
  }

  const orphans = findOrphans(files);
  log(`findUnusedComponents: scanned ${files.length} files, found ${orphans.length} unused shared component(s)`);

  if (orphans.length === 0) {
    vscode.window.showInformationMessage('APEXLang View: no unused shared components found.');
    return;
  }

  const items = orphans
    .map((o) => ({
      label: `${o.identifier} (${o.typeName})`,
      description: vscode.workspace.asRelativePath(o.fsPath),
      orphan: o,
    }))
    .sort((a, b) => a.description.localeCompare(b.description));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `${orphans.length} unused shared component(s) found — select one to jump to its declaration`,
    matchOnDescription: true,
  });
  if (!picked) return;

  await revealLineInEditor(vscode.Uri.file(picked.orphan.fsPath), picked.orphan.line);
}

async function createPanelAndShow(context, targetUri) {
  log(`Opening panel for ${targetUri.toString()}`);
  panel = vscode.window.createWebviewPanel(
    'apexlangViewGraph',
    'APEXLang Graph',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
    }
  );

  const mediaUri = (file) =>
    panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', file)));
  panel.webview.html = getWebviewHtml(panel.webview, mediaUri);

  panel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'ready') {
      if (currentUri) refresh(currentUri).catch((err) => logError('refresh on ready failed', err));
      return;
    }
    if (msg.type === 'revealLine' && typeof msg.line === 'number') {
      revealLineInEditor(currentUri, msg.line);
      return;
    }
    if (msg.type === 'switchFile') {
      switchFileCommand(context).catch((err) => logError('switch-file from toolbar failed', err));
      return;
    }
    if (msg.type === 'openAppMap') {
      openAppMapCommand(context, currentUri).catch((err) => logError('app-map from toolbar failed', err));
      return;
    }
    if (msg.type === 'openExternalPage' && msg.targetFsPath) {
      confirmAndOpenExternalPage(context, msg.targetFsPath, msg.label).catch((err) => logError('openExternalPage failed', err));
      return;
    }
    if (msg.type === 'error') {
      log(`Webview error: ${msg.message}`);
      if (msg.stack) log(msg.stack);
      return;
    }
    if (msg.type === 'log') {
      log(`Webview: ${msg.message}`);
    }
  });

  panel.onDidDispose(() => {
    log('Panel disposed.');
    clearTimeout(debounceTimer);
    panel = null;
    currentUri = null;
  });

  await switchTo(context, targetUri);
}

// Points the (already-open) panel at a new file and refreshes it.
async function switchTo(context, uri) {
  currentUri = uri;
  const fileName = path.basename(uri.fsPath);
  panel.title = `Graph: ${fileName}`;
  panel.webview.postMessage({ type: 'fileChanged', fileName });
  await refresh(uri);
  panel.reveal(panel.viewColumn, true);
}

// Parses uri's current content and pushes {graph, quality} into the panel.
// Called on open/switch, on every debounced live edit, and again whenever
// the webview signals it's ready to receive (covers the race where
// postMessage fires before the webview's message listener is attached).
async function refresh(uri) {
  if (!panel || !uri) return;
  const fileName = path.basename(uri.fsPath);
  const startedAt = Date.now();

  let text;
  try {
    // If the file is ALREADY open somewhere, read its in-memory buffer —
    // that's the only way to reflect unsaved edits (live-refresh depends
    // on this). Otherwise read raw bytes straight off disk via
    // workspace.fs, exactly how the built-in Markdown preview reads files
    // it's rendering. Deliberately NOT vscode.workspace.openTextDocument()
    // here: that call registers the file as an "open document" in VS
    // Code's model, which can surface it as a visible tab under some
    // conditions even without an explicit showTextDocument() call — which
    // is exactly the "switching files still opens a tab" bug this fixes.
    const alreadyOpen = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    if (alreadyOpen) {
      text = alreadyOpen.getText();
    } else {
      const bytes = await vscode.workspace.fs.readFile(uri);
      text = Buffer.from(bytes).toString('utf8');
    }
  } catch (err) {
    logError(`refresh(${fileName}): read failed`, err);
    vscode.window.showErrorMessage(`APEXLang View: could not read file — ${err.message}`);
    return;
  }

  let graph;
  try {
    graph = parseApxToGraph(text);
  } catch (err) {
    logError(`refresh(${fileName}): parse failed`, err);
    vscode.window.showErrorMessage(`APEXLang View: parse failed — ${err.message}`);
    return;
  }

  try {
    await resolveNavTargets(uri, graph);
  } catch (err) {
    // Non-fatal: the graph itself parsed fine, just log and show it without
    // the cross-page navigation stubs rather than failing the whole refresh.
    logError(`refresh(${fileName}): resolveNavTargets failed`, err);
  }

  const quality = assessParseQuality(text, graph);
  const ms = Date.now() - startedAt;
  log(`refresh(${fileName}): ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${ms}ms${quality.suspicious ? ' [suspicious: ' + quality.reasons.join(' ') + ']' : ''}`);
  // Guard against a slow parse finishing after the user has already
  // switched to a different file — don't clobber the panel with stale data.
  if (uri.toString() !== (currentUri && currentUri.toString())) return;
  panel.webview.postMessage({ type: 'graph', fileName, graph, quality });
}

// Confirms before actually switching the graph to a nav-target stub's page
// (roadmap #3) — clicking a stub is often just "what page is this pointing
// at", not "take me there", so navigating unconditionally on every click
// would be surprising. A cancel leaves the current graph untouched.
async function confirmAndOpenExternalPage(context, targetFsPath, label) {
  const targetName = path.basename(targetFsPath);
  const choice = await vscode.window.showWarningMessage(
    `Open graph for ${label || targetName} (${targetName})? This replaces the current graph view.`,
    { modal: true },
    'Open'
  );
  if (choice !== 'Open') return;
  log(`Navigating to external page stub: ${targetFsPath}`);
  await switchTo(context, vscode.Uri.file(targetFsPath));
}

// Opens/reveals the source file at the clicked node's line in the real
// editor. This is the ONE intentional place this extension opens a native
// tab — a deliberate "go to source" action from clicking a node, not
// implicit following, and the user confirmed they want it (it's distinct
// from the earlier "switching files must never open a tab" bug, which was
// about the file-switcher, not this).
async function revealLineInEditor(targetUri, line) {
  if (!targetUri) return;
  try {
    const doc = await vscode.workspace.openTextDocument(targetUri);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    const clampedLine = Math.max(0, Math.min(line, doc.lineCount - 1));
    const range = doc.lineAt(clampedLine).range;
    editor.selection = new vscode.Selection(range.start, range.start);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (err) {
    logError('revealLineInEditor failed', err);
    vscode.window.showErrorMessage(`APEXLang View: could not jump to source — ${err.message}`);
  }
}

function getWebviewHtml(webview, mediaUri) {
  const cssUri = mediaUri('graph.css');
  const searchLogicUri = mediaUri('search-logic.js');
  const jsUri = mediaUri('graph.js');
  const nonce = String(Date.now());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>APEXLang Graph</title>
</head>
<body>
  <div id="toolbar">
    <button id="switch-file" title="Pick a different .apx file to view">Switch file…</button>
    <button id="app-map" title="Show a page-to-page navigation map for the whole app">App Map</button>
    <button id="view-toggle" title="Toggle between hierarchy tree and grouped-by-type list">View: Tree</button>
    <span id="file-label"></span>
    <span id="node-count"></span>
    <input id="search-box" type="text" placeholder="Search nodes…" />
    <span id="search-count"></span>
    <button id="expand-all">Expand all</button>
    <button id="collapse-all">Collapse all</button>
  </div>
  <div id="warning-banner" class="hidden"></div>
  <div id="graph-root"></div>
  <div id="detail-panel" class="hidden">
    <div id="detail-header">
      <span id="detail-badge"></span>
      <span id="detail-title"></span>
      <button id="detail-close">&times;</button>
    </div>
    <div id="detail-breadcrumb"></div>
    <div id="detail-refs"></div>
    <div id="detail-body"></div>
  </div>
  <script nonce="${nonce}" src="${searchLogicUri}"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
