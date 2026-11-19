# APEXLang View — Roadmap & Tracker

Single source of truth for what's been asked, decided, done, and pending.
Update the status here whenever an item moves; don't rely on chat history.

Status key: ✅ done · 🔨 in progress · ⏳ waiting on Mohammad · 📋 to do · 💤 on hold · ❌ dropped

Last updated: 2026-10-17

---

## A. Requests from 2026-10-17 session

| # | Request | Status | Notes / next action |
|---|---|---|---|
| A1 | Resume work on the extension | ✅ | Status reviewed; live stats pulled. |
| A2 | Update SQLcl | ✅ / ⏳ | 26.1.2 → 26.3.0 installed at `C:\oracle\sqlcl`; old copy kept at `C:\oracle\sqlcl_26.1.2`. Uses `TNS_ADMIN` → `instantclient_23_6\network\admin` (unchanged). **Mohammad:** confirm `connmgr list` shows saved connections, then the old folder can be deleted. |
| A3 | Fix the broken `feature/git-diff` branch | ✅ / ⏳ | Commit `6123abc`. 64/64 tests; browser-tested (old version crashed, fixed version clean). **Mohammad:** approve merge into `dev`. |
| A4 | Revamp — make it less | 📋 | See section C. |
| A5 | Add logs | ⏳ | Local diagnostic logs already exist (output channel + "Show Logs" command). **Mohammad:** decide whether usage telemetry is wanted (A6). |
| A6 | See who installed it / are they using it | 🔨 / ⏳ | Public stats (2026-10-17): **174 installs, 1 rating (5★)**, v0.1.0. **Mohammad:** check Reports tab at marketplace.visualstudio.com/manage (installs/uninstalls over time). Real usage needs opt-in-respecting telemetry (Azure App Insights, VS Code telemetry setting honored, README disclosure, command counts only) — decision pending. |
| A7 | Enhancements | 📋 | See section D. |
| A8 | APEX 26.2 compliance | 🔨 | Release notes list **no `.apx` syntax changes**. All 3 SQLcl 26.2.2 folder layouts work (app root = parent of `pages/`). **Not yet verified on real 26.2 files** — need one app exported from a 26.2 instance, then run the corpus test. |
| A9 | Search online for APEXLang issues we can handle | ✅ | Findings → D1 (static-file references), D2 (stale deleted pages). Positioning: Oracle's own extension does export/validate/complete/import; we own navigation, App Map, diff. |
| A10 | Record everything in a plan so nothing is missed | ✅ | This file. |

## A2. Requests from 2026-11-19 session

| # | Request | Status | Notes |
|---|---|---|---|
| A11 | Check if a v0.2.0 / GIF version was released | ✅ | Not released. Marketplace, GitHub and installed copy are all 0.1.0 (232 installs, 1× 5★ on 2026-11-19). GIF + video exist only locally on `feature/git-diff` (`1b08d0c`). |
| A12 | Review what v1 does vs what v2 plans | ✅ | See section G. |
| A13 | Research what's new in the APEX community (4 months) for v2 | ✅ | See section G. |
| A14 | **Anonymous logs: installs, bugs, crashes — for improving only** (top priority) | 📋 ⏳ | Plan in G3. Needs Mohammad to create an Azure Application Insights resource (free tier) and choose scope. |

## G. v1 vs v2 review + research (2026-11-19)

### G1. What v0.1.0 (released) does
Commands: Open Graph View, Switch File, Open App Map, Show Logs (editor title button + Explorer right-click on `.apx`).
Features: indented outline tree · in-tree search · `@identifier` cross-references (References / Referenced by) · cross-page navigation badges · App Map (page-to-page) · auto-collapse big groups · By Type view · Graph canvas view · breadcrumbs + keyboard nav · live refresh · theme-native.
Problem: released README's "Try it" section tells Marketplace users to "open this folder and press F5" (developer steps). Fixed in the new README (B1).

### G2. Research findings (Nov 2026)
- APEX 26.2 shipped (download 2026-10-06; GA announced 2026-11-09). APEXlang exports can now include **translations**; file-level import; Working Copy APIs; REST Workshop retired.
- Oracle SQL Developer for VS Code is at **26.3.1**: highlighting, completion, validation, diagnostics, **formatting**, export/import, and (26.3+) compare local APEXlang vs the connected DB app and pull changes. Its listing still shows **no outline/tree, no component navigation, no go-to-definition, no git-based semantic diff** → our lane is still open.
- Oracle is publishing the **APEXlang grammar, skills and docs in the public domain** so AI agents (Claude, Codex) can write APEXlang (SiliconANGLE, 2026-11-04). More APEX changes will be AI-generated → people need to *see and review* what changed.
- Top community pain = **reviewing and merging** `.apx` changes (Alex on APEX, 2026-07-24; juanl.hashnode.dev): comparison only says "page 1 differs", not which components; conflicts, collisions and dangling references are checked by hand; no 3-way merge. A readable text diff ≠ a safe merge.

### G3. Anonymous telemetry plan (A14)
- Use Microsoft's official `@vscode/extension-telemetry` → Azure Application Insights (free tier). It automatically obeys VS Code's telemetry setting (`isTelemetryEnabled`), so anyone who turned telemetry off sends nothing.
- Send only: extension activated (version, VS Code version, OS — added by the module), which command/view was used (counts), file size bucket + parse time bucket, and **errors** (error type + our own stack frames only).
- Never send: file paths, file names, app/page names, `.apx` content, workspace names, git info, user names.
- Add `telemetry.json` (VS Code's transparency file), a README "Privacy" line, and an extension setting `apexlangView.telemetry.enabled` (extra off switch).
- Install/uninstall counts come from the Marketplace publisher Reports page (no code needed); telemetry adds "active users" and crashes, but only for users who update to 0.2.0+.
- Mohammad's step: create an Application Insights resource in Azure (his Microsoft account) and share the connection string (it's designed to be embedded in public extension code).

### G4. Proposed scope (decide)
- **0.2.0 — "trust + diff"**: telemetry (G3) · git diff vs HEAD (built) · fixes F1–F10 · new README + GIF · Ctrl+Alt+L.
- **0.3.0 — "review changes"**: compare any two versions (branch / commit / PR) at component level (D4, upgraded) · App Map changed-page badges (D3) · positioning: "see exactly what changed — by you, a teammate, or an AI agent".
- **0.4.0 — "safety checks"**: Problems-panel warnings Oracle's validator doesn't cover: broken static-file refs (D1), dangling `@references`, duplicate identifiers, merge collisions between two branches (3-way).
- **Ongoing**: verify the parser on real 26.2 exports incl. translations (A8); check against Oracle's public grammar once its location is found.

## B. Release v0.2.0

| # | Item | Status | Notes |
|---|---|---|---|
| B1 | README rewrite + demo GIF + `Ctrl+Alt+L` | ✅ | Commit `1b08d0c` (on `feature/git-diff`). |
| B2 | Git diff vs HEAD (toggle, row highlights, old→new in detail panel) | ✅ | Pending merge (A3). |
| B3 | CHANGELOG corrected | ✅ | Removed entries for the rejected Changes panel / filter. |
| B4 | Merge `feature/git-diff` → `dev` → `master`/`main` | ⏳ | Waiting on A3 approval. |
| B5 | Bump version, `vsce package`, upload to Marketplace | 📋 | After C + chosen D items. Publisher ID: `MohammadSawalhah`. Note: Global PATs retire 2026-12-01 (web upload unaffected). |
| B6 | Announce (LinkedIn / Telegram) | 📋 | After B5. |

## C. Make it smaller (revamp)

| # | Item | Status | Notes |
|---|---|---|---|
| C1 | Remove rejected diff extras (Changes panel, Changes-only filter, minimap) | ✅ | −341 lines (A3). |
| C2 | Delete shelved orphan detector (`src/orphan-detector.js`, its test, unregistered `findUnusedComponentsCommand`) | 📋 | Never wired to a command; misleading results on real data. |
| C3 | Graph (canvas) view — keep or drop? | ⏳ | Largest chunk of `graph.js` (48 KB). **Mohammad decides.** If kept, add diff highlighting (D5). |
| C4 | Review `graph.js` for other dead code | 📋 | After C2/C3. |

## D. Enhancements (candidates)

| # | Item | Status | Notes |
|---|---|---|---|
| D1 | Broken static-file reference check | 📋 | Targets SQLcl bug: lowercased file names → `REFERENCE_NOT_FOUND`. `file "path"` in `static-files.apx` → `static-files/<path>`, exact case. Validated: 328/328 refs resolve in the clean corpus (0 false positives). |
| D2 | Flag pages that may have been deleted but survived re-export | 💤 | Needs thought — can't be certain from files alone. |
| D3 | Git diff step 2: changed-page badges in App Map | 📋 | Agreed order from 2026-07-25 office hours. |
| D4 | Git diff step 3: compare any two refs (branch/tag) | 📋 | After D3. |
| D5 | Diff highlighting in Graph (canvas) view | 📋 | Never existed; depends on C3. |
| D6 | Usage telemetry | ⏳ | Depends on A6 decision. |
| D7 | Plugin references (`type: plugin/<name>`) | 💤 | Researched 2026-07-24; Mohammad chose to hold. |
| D8 | Full whole-app merged graph | 💤 | Long-term goal; deferred. |
| D9 | Smaller ideas: export PNG/SVG, impact-of-change view, copy reference, pin two nodes to compare, legend filtering | 💤 | Captured, not prioritized. |

## F. Code review of v0.1.0..HEAD (2026-10-17) — fix before releasing 0.2.0

Released code is tagged **`v0.1.0`** (= `c9f84dc`, verified byte-identical to `apexlang-view-0.1.0.vsix`). Everything below is on unreleased work only — 0.1.0 users are unaffected until 0.2.0 ships.

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | 🔴 High | `media/demo.gif` (13.6 MB) + unused `media/demo.mp4` (2.9 MB) would ship inside the VSIX (39 KB → ~16.5 MB per install). Fix: exclude `media/demo.*` in `.vscodeignore`, delete `demo.mp4`. README's relative GIF link is served from GitHub, so **GitHub `main` must have the GIF before publishing**. | 📋 |
| F2 | 🔴 High | `package.json` still `0.1.0` — Marketplace would reject the upload. Bump to `0.2.0` at release time. | 📋 |
| F3 | 🟠 Medium | Changes 0.1.0 look with Diff off: `.tree-row` got `border-left: 3px solid transparent` → every row shifted 3px. Fix: only add the border on `.diff-added`/`.diff-changed` without shifting (e.g. `box-shadow: inset 3px 0 …`). | 📋 |
| F4 | 🟠 Medium | Race: with Diff on and fast typing, an older refresh (still waiting on git) can overwrite a newer one → stale graph/markers. Fix: refresh sequence number. | 📋 |
| F5 | 🟠 Medium | Detail panel doesn't re-render when Diff toggles or the graph refreshes → old→new appears/disappears only after re-clicking the node. | 📋 |
| F6 | 🟠 Medium | Untracked/new file or git not ready → button says "Diff: HEAD" but nothing shows, and an error is logged every keystroke. Fix: show "Diff: not tracked" / "Diff: no git", log once. | 📋 |
| F7 | 🟡 Low | A property *removed* since HEAD isn't shown in the detail panel (only current props are listed). | 📋 |
| F8 | 🟡 Low | Duplicate sibling names overwrite each other in diff matching. Real but rare: 29/2,228 corpus files, all theme `template-option-groups.apx`. | 📋 |
| F9 | 🟡 Low | Renaming via `name:` shows two changed rows (`label` and `name`) for one edit. | 📋 |
| F10 | ⚪ Cleanup | Perf: `Array.includes` per row → use Sets. Misplaced doc comment above `toggleDiffCommand`; stale "not yet built" comment in `diff.js`; unused `removedInfo` sent every refresh. | 📋 |

**Exact locations / fix notes (from the review, as of commit `f458d4e`):**
- F1 — `.vscodeignore` (add `media/demo.gif`, `media/demo.mp4`); `git rm media/demo.mp4` (unreferenced anywhere). Webview `localResourceRoots` points at `media/`, which is why everything there ships.
- F2 — `package.json` `"version": "0.1.0"` → `0.2.0` at release (CHANGELOG already says 0.2.0 Unreleased).
- F3 — `media/graph.css` ~line 194, inside `.tree-row { … }`: remove `border-left: 3px solid transparent;`. Re-style `.tree-row.diff-added` / `.tree-row.diff-changed` (end of graph.css) so they don't change layout, e.g. `box-shadow: inset 3px 0 0 <git token>`.
- F4 — `src/extension.js` `refresh()` ~line 482: the only stale guard is `uri.toString() !== currentUri.toString()` (~line 502). Add a module-level `refreshSeq` counter; capture it at the start of refresh, drop the post if it's no longer the latest.
- F5 — `media/graph.js` `'graph'` message handler ~line 140-170: after updating `currentDiff`/`currentGraph`, if `selectedNodeId` still exists and the detail panel is open, call `showDetail` for it again (and hide it if the node no longer exists).
- F6 — `src/extension.js` `getContentAtHead()` ~line 65-82: tell untracked/new-file vs no-repo vs git-not-ready apart; send a status to the webview (e.g. `diffStatus: 'untracked' | 'no-repo'`) so the button reads "Diff: not tracked" / "Diff: no git"; log only once per file, not every 400 ms keystroke. Possible fix for git not ready: wait for `git.state === 'initialized'` / `onDidOpenRepository`.
- F7 — `media/graph.js` `renderPropsGrid` ~line 871: also render keys found in `propChanges[node.id]` that are missing from current `node.props` (`newValue === undefined`); `diffValueEl` already renders undefined as "(none)".
- F8 — `src/diff.js` `buildPathIndex` ~line 59: `index.set(kidKey, kid)` overwrites duplicate `typeName:identifier` siblings. Fix: if the key already exists, append a `#n` occurrence counter (the same approach anonymous nodes use). Corpus: 29/2,228 files, all `template-option-groups.apx` (`templateOptionGroup:display-mode`, `:color-accents`).
- F9 — `media/graph.js` ~line 851 + `src/diff.js` `computePropChanges`/`propsEqual`: the label comes from `props.name` (parser.js ~line 256), so a rename yields `_label` + `name` changes. Skip `_label` when it equals the derived name/identifier.
- F10 — `media/graph.js` `buildRowEl` ~line 720: precompute `addedSet`/`changedSet` when the `'graph'` message arrives. `src/extension.js` ~line 265: move the misplaced App Map doc comment back above `openAppMapCommand`. `src/diff.js` header: delete the stale "extension.js wiring not yet built". Stop sending unused `removedInfo` (or keep it in diff.js for the tests but strip it before postMessage).

**Safe release plan for 0.2.0 (protects 0.1.0 users):**
1. Fix F1–F10 on `feature/git-diff`; tests stay green; re-run the browser harness + Mohammad's F5 test.
2. Package locally (`vsce package`), check size is ~40 KB and the file list (`vsce ls`) has no demo media/tests.
3. Install that `.vsix` in a clean VS Code profile and click through `TESTING-CHECKLIST.md` with Diff **off** (must look/behave exactly like 0.1.0), then with Diff on.
4. Merge → `dev` → `main`, push (GitHub now has the GIF), tag `v0.2.0`.
5. Upload to Marketplace. Rollback if needed: re-upload the kept `apexlang-view-0.1.0.vsix` content as `0.2.1` from tag `v0.1.0`.

## E. Decided against (don't re-propose)

- Separate extension for diff — rejected; keep it in this one.
- Diff minimap / Changes panel / Changes-only filter — built, rejected on sight, removed.
- In-panel source snippet instead of jumping to the real line — wrong; clicking a node jumps to source.
- `<video>` tag / YouTube link in README — GIF covers both GitHub and Marketplace.
- "Known limitations" section in README — keep caveats in CHANGELOG only.
- Orphan detector based on `@identifier` only — too many false positives.
