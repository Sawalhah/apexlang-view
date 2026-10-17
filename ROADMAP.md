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

## E. Decided against (don't re-propose)

- Separate extension for diff — rejected; keep it in this one.
- Diff minimap / Changes panel / Changes-only filter — built, rejected on sight, removed.
- In-panel source snippet instead of jumping to the real line — wrong; clicking a node jumps to source.
- `<video>` tag / YouTube link in README — GIF covers both GitHub and Marketplace.
- "Known limitations" section in README — keep caveats in CHANGELOG only.
- Orphan detector based on `@identifier` only — too many false positives.
