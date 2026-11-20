const vscode = require('vscode');
const path = require('path');
const { parseApxToGraph, assessParseQuality } = require('./parser');
const { guessAppRoot, buildPageIndex, injectNavStubs } = require('./page-nav');
const { buildAppMap } = require('./app-map');
const { diffGraphs, buildPathIndex } = require('./diff');
const { initTelemetry, track, trackError, resetPanelSession, flushTelemetry } = require('./telemetry');
const { sizeBucket, msBucket, nodeBucket } = require('./telemetry-schema');

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

// Git-diff indicators: off by default, toggled per-session (not persisted)
// via the toolbar/command. diffRef is what the working copy is compared
// against: null (Diff off), 'HEAD', or a full commit hash picked with
// "Compare with Commit...". When set, refresh() fetches the file's content
// at that ref via VS Code's built-in Git extension API (no shell-out) and
// diffs it against the working-tree parse using diff.js's pure diffGraphs.
let diffRef = null;

// Short, human label for a ref: "HEAD" or the first 7 characters of a hash.
function refLabel(ref) {
  return ref === 'HEAD' ? 'HEAD' : String(ref).slice(0, 7);
}

// Lazily resolved — the built-in git extension may not be activated yet
// (e.g. no git repo open at all) the first time this is called. While the
// git extension is still starting up, its API reports state 'uninitialized'
// and knows no repositories yet; wait for it once (up to 5 seconds) so the
// first diff right after VS Code starts isn't wrongly reported as "no git".
// This waits for git itself, never for a repository to appear, so files
// outside any repo don't stall later refreshes.
let gitReadyWait = null;
async function getGitApi() {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) return null;
  const exports = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
  // With "git.enabled": false (or no git installed) getAPI throws; treat
  // that the same as having no git at all.
  if (!exports || exports.enabled === false) return null;
  let api;
  try {
    api = exports.getAPI(1);
  } catch {
    return null;
  }
  if (api.state && api.state !== 'initialized' && typeof api.onDidChangeState === 'function') {
    if (!gitReadyWait) {
      gitReadyWait = new Promise((resolve) => {
        let timer = null;
        let sub = null;
        const done = () => {
          clearTimeout(timer);
          if (sub) sub.dispose();
          resolve();
        };
        sub = api.onDidChangeState((state) => {
          if (state === 'initialized') done();
        });
        timer = setTimeout(done, 5000);
      });
    }
    await gitReadyWait;
  }
  return api;
}

// The base for the diff, cached so live typing does no git work (and no
// second parse) after the first read. Keyed by the RESOLVED commit hash
// (never the moving name 'HEAD'), so an entry can never go stale: a new
// commit means a new hash and a cache miss. Failed reads are cached too, so
// an uncommitted file doesn't spawn a failing `git show` on every edit.
// Only one entry is kept (the current file); replaced on miss.
let baseCache = null; // { hash, path, text, graph? } or { hash, path, reason }

// Each "why there is no diff" reason is logged once per file + ref instead
// of on every keystroke (F6).
const loggedDiffReasons = new Set();
function logDiffReasonOnce(uri, ref, reason, detail) {
  const key = `${uri.fsPath}|${ref}|${reason}`;
  if (loggedDiffReasons.has(key)) return;
  loggedDiffReasons.add(key);
  log(`Diff vs ${refLabel(ref)} unavailable for ${path.basename(uri.fsPath)}: ${reason}${detail ? ' (' + detail + ')' : ''}`);
}

// The expected ways a read fails when the file is not at that commit. The
// git CLI says "path ... does not exist in '<ref>'" or "... exists on disk,
// but not in '<ref>'"; VS Code's git extension may instead throw a GitError
// with gitErrorCode FileNotFound/WrongCase, or "Git relative path not found."
// after its wrong-case retry. Its generic "Could not show object." is NOT
// matched: it covers any failed read (corrupt object, lock, ...), and those
// are logged and reported once (the failure is cached, see baseCache).
function isPathNotInCommitError(err) {
  if (!err) return false;
  const text = `${err.message || ''} ${err.stderr || ''}`;
  if (/does not exist in|exists on disk, but not in|relative path not found/i.test(text)) return true;
  return err.gitErrorCode === 'WrongCase' || err.gitErrorCode === 'FileNotFound';
}

// Returns the cache entry: { text } — the file's content at `ref` ('HEAD' or
// a commit hash; the caller may keep the parsed base on it as `graph`) —
// or { reason } explaining why there is nothing to diff against:
//   noRepo      — no git extension, or the file is not in a repository
//   untracked   — compared with HEAD, but the file is not committed yet
//                 (new, untracked, or staged but not committed)
//   notInCommit — the chosen commit doesn't contain this file (or the repo
//                 has no commits yet)
async function getContentAtRef(uri, ref) {
  const git = await getGitApi();
  if (!git) {
    logDiffReasonOnce(uri, ref, 'noRepo', 'vscode.git extension not found');
    return { reason: 'noRepo' };
  }
  const repository = git.getRepository(uri);
  if (!repository) {
    logDiffReasonOnce(uri, ref, 'noRepo', `known repos: ${git.repositories.map((r) => r.rootUri.fsPath).join(', ') || 'none'}`);
    return { reason: 'noRepo' };
  }
  const hash = ref === 'HEAD' ? repository.state.HEAD && repository.state.HEAD.commit : ref;
  if (!hash) {
    logDiffReasonOnce(uri, ref, 'notInCommit', 'repository has no commits');
    return { reason: 'notInCommit' };
  }
  if (baseCache && baseCache.hash === hash && baseCache.path === uri.fsPath) {
    return baseCache;
  }
  try {
    const text = await repository.show(hash, uri.fsPath);
    baseCache = { hash, path: uri.fsPath, text };
    return baseCache;
  } catch (err) {
    // Whatever git's wording, a failed read at HEAD means "not committed
    // yet" and at a chosen commit means "not in that commit", so the button
    // label stays useful. Unexpected errors are also logged in full.
    const reason = ref === 'HEAD' ? 'untracked' : 'notInCommit';
    if (isPathNotInCommitError(err)) {
      logDiffReasonOnce(uri, ref, reason);
    } else {
      logError(`getContentAtRef: repository.show(${refLabel(ref)}) failed for ${uri.fsPath}`, err);
      trackError('git.show', err);
    }
    baseCache = { hash, path: uri.fsPath, reason };
    return baseCache;
  }
}

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
  initTelemetry(context, log);
  track('activated');

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.showLogs', () => {
      track('command', { name: 'showLogs' });
      output.show();
    })
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

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.toggleDiff', async () => {
      try {
        await toggleDiffCommand();
      } catch (err) {
        logError('apexlangView.toggleDiff failed', err);
        vscode.window.showErrorMessage(`APEXLang View: unexpected error — ${err.message}. See "APEXLang View" output channel for details.`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apexlangView.compareWithCommit', async () => {
      try {
        await compareWithCommitCommand();
      } catch (err) {
        logError('apexlangView.compareWithCommit failed', err);
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
  track('command', { name: 'openGraph' });
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
  track('command', { name: 'switchFile' });
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

// Diff button: any comparison on (HEAD or a chosen commit) -> off;
// off -> compare with HEAD. Re-renders the current file.
async function toggleDiffCommand() {
  track('command', { name: 'toggleDiff' });
  // Re-toggling is the user's retry: forget a cached (possibly transient) failure.
  baseCache = null;
  diffRef = diffRef ? null : 'HEAD';
  log(diffRef ? 'Diff vs HEAD: on' : 'Diff: off');
  if (currentUri) await refresh(currentUri);
}

// "Compare with Commit...": pick one of the last 50 commits that touched the
// current file; the tree then highlights what changed between that commit
// and the working copy (same markers as Diff vs HEAD).
async function compareWithCommitCommand() {
  track('command', { name: 'compareWithCommit' });
  if (!panel || !currentUri) {
    vscode.window.showWarningMessage('APEXLang View: open an .apx file in the APEXLang View panel first.');
    return;
  }
  const uri = currentUri;
  let repository = null;
  try {
    const git = await getGitApi();
    repository = git && git.getRepository(uri);
  } catch (err) {
    logError('compareWithCommit: git is not available', err);
  }
  if (!repository) {
    vscode.window.showInformationMessage('APEXLang View: this file is not in a git repository.');
    return;
  }

  let commits;
  try {
    commits = await repository.log({ path: uri.fsPath, maxEntries: 50 });
  } catch (err) {
    logError(`compareWithCommit: repository.log failed for ${uri.fsPath}`, err);
    trackError('git.log', err);
    vscode.window.showInformationMessage('APEXLang View: could not read the git history of this file. See the "APEXLang View" output channel.');
    return;
  }
  if (!commits || commits.length === 0) {
    vscode.window.showInformationMessage('APEXLang View: no commits for this file yet.');
    return;
  }

  const items = commits.map((c) => {
    const date = c.authorDate || c.commitDate;
    return {
      label: `${c.hash.slice(0, 7)}  ${(c.message || '').split('\n')[0]}`,
      description: date ? new Date(date).toISOString().slice(0, 10) : '',
      hash: c.hash,
    };
  });
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Compare ${path.basename(uri.fsPath)} with a commit (last ${commits.length} that changed it)`,
    matchOnDescription: true,
  });
  if (!picked) return;
  if (!panel || !currentUri || currentUri.toString() !== uri.toString()) return;

  baseCache = null;
  diffRef = picked.hash;
  log(`Diff vs ${refLabel(diffRef)}: on`);
  await refresh(currentUri);
}

// Scans the whole app root for .apx files, builds a page-to-page nav map
// (roadmap #2, app-level scope — see app-map.js), and pushes it into the
// panel. Opens the panel first (showing whichever file anchors the scan) if
// it isn't already open, matching openGraphCommand's own bootstrap.
async function openAppMapCommand(context, uri) {
  track('command', { name: 'openAppMap' });
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

  let appMap;
  try {
    appMap = buildAppMap(files);
  } catch (err) {
    trackError('appMap.scan', err);
    throw err;
  }
  log(`App map: ${appMap.pages.length} page(s), ${appMap.edges.length} edge(s)`);

  if (!panel) {
    await createPanelAndShow(context, anchorUri);
  } else {
    panel.reveal(panel.viewColumn, true);
  }
  panel.webview.postMessage({ type: 'appMap', appMap });
}

async function createPanelAndShow(context, targetUri) {
  log(`Opening panel for ${targetUri.toString()}`);
  resetPanelSession();
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
      track('featureUsed', { name: msg.feature === 'breadcrumb' ? 'breadcrumb' : 'jumpToSource' }, msg.feature === 'breadcrumb' ? 'breadcrumb' : 'jumpToSource');
      revealLineInEditor(currentUri, msg.line);
      return;
    }
    if (msg.type === 'viewChanged') {
      track('viewChanged', { view: msg.view });
      return;
    }
    if (msg.type === 'featureUsed') {
      track('featureUsed', { name: msg.name }, msg.name);
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
    if (msg.type === 'toggleDiff') {
      toggleDiffCommand().catch((err) => logError('toggleDiff from toolbar failed', err));
      return;
    }
    if (msg.type === 'compareWithCommit') {
      compareWithCommitCommand().catch((err) => logError('compareWithCommit from toolbar failed', err));
      return;
    }
    if (msg.type === 'openExternalPage' && msg.targetFsPath) {
      track('featureUsed', { name: 'openExternalPage' }, 'openExternalPage');
      confirmAndOpenExternalPage(context, msg.targetFsPath, msg.label).catch((err) => logError('openExternalPage failed', err));
      return;
    }
    if (msg.type === 'error') {
      log(`Webview error: ${msg.message}`);
      if (msg.stack) log(msg.stack);
      trackError('webview.render', { name: msg.name || 'Error', stack: msg.stack });
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
  // A chosen commit belongs to the previous file's history, so switching to
  // a different file falls back to comparing with HEAD. Diff off and Diff vs
  // HEAD carry over unchanged.
  const isNewFile = !currentUri || currentUri.toString() !== uri.toString();
  if (isNewFile && diffRef && diffRef !== 'HEAD') {
    log(`Diff vs ${refLabel(diffRef)} reset to HEAD for the new file`);
    diffRef = 'HEAD';
  }
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
// F4: every refresh takes a sequence number; only the latest one may post,
// so a slow refresh (e.g. still waiting on git) can't overwrite a newer one.
let refreshSeq = 0;

async function refresh(uri) {
  if (!panel || !uri) return;
  const seq = ++refreshSeq;
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
  const parseStartedAt = Date.now();
  try {
    graph = parseApxToGraph(text);
  } catch (err) {
    logError(`refresh(${fileName}): parse failed`, err);
    trackError('refresh.parse', err);
    vscode.window.showErrorMessage(`APEXLang View: parse failed — ${err.message}`);
    return;
  }

  const parseMs = Date.now() - parseStartedAt;

  try {
    await resolveNavTargets(uri, graph);
  } catch (err) {
    // Non-fatal: the graph itself parsed fine, just log and show it without
    // the cross-page navigation stubs rather than failing the whole refresh.
    logError(`refresh(${fileName}): resolveNavTargets failed`, err);
  }

  let diff = null;
  const ref = diffRef;
  const diffStatus = { ref };
  if (ref) {
    try {
      const base = await getContentAtRef(uri, ref);
      if (base.reason) {
        diffStatus.reason = base.reason;
      } else {
        // The base never changes for a cached hash, so it is parsed once.
        // diffGraphs does not modify either graph.
        if (!base.graph) base.graph = parseApxToGraph(base.text);
        // removedInfo is not used by the webview (F10); keep the message small.
        const { removedInfo, ...forWebview } = diffGraphs(base.graph, graph);
        diff = forWebview;
      }
    } catch (err) {
      // The button must not read "Diff: HEAD" (no changes) when the diff failed.
      diffStatus.reason = 'error';
      logError(`refresh(${fileName}): diff vs ${refLabel(ref)} failed`, err);
      trackError('refresh.diff', err);
    }
  }

  // Node ids are positional (n0, n1, ...) and shift when a block is added
  // above; the webview keeps its selection and collapsed rows by this
  // structural key instead, so a live edit can't move them to another node.
  for (const [key, node] of buildPathIndex(graph)) node.pathKey = key;

  const quality = assessParseQuality(text, graph);
  const ms = Date.now() - startedAt;
  track('fileParsed', {
    sizeBucket: sizeBucket(Buffer.byteLength(text, 'utf8')),
    msBucket: msBucket(parseMs),
    nodeBucket: nodeBucket(graph.nodes.length),
    suspicious: !!quality.suspicious,
  }, uri.fsPath);
  log(`refresh(${fileName}): ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${ms}ms${quality.suspicious ? ' [suspicious: ' + quality.reasons.join(' ') + ']' : ''}${diff ? ` [diff vs ${refLabel(ref)}: +${diff.added.length} ~${diff.changed.length} -${diff.removed.length}]` : ''}`);
  // Guard against a slow refresh finishing after a newer one started, or
  // after the user switched files or closed the panel — don't clobber the
  // panel with stale data.
  if (seq !== refreshSeq || !panel) return;
  if (uri.toString() !== (currentUri && currentUri.toString())) return;
  panel.webview.postMessage({ type: 'graph', fileName, graph, quality, diff, diffStatus });
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
    <button id="diff-toggle" title="Highlight nodes changed since the last commit (HEAD); click again to turn off">Diff: Off</button>
    <button id="diff-pick" title="Compare with commit…">▾</button>
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

// Gives queued telemetry a last chance to send (best effort).
function deactivate() {
  return flushTelemetry();
}

module.exports = { activate, deactivate };
