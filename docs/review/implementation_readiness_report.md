# Stage 9: Implementation Readiness Report
n**Status: resolved 2026-11-20** - all I1-I26 applied to the design.

*   **Target:** `docs/DESIGN-v0.2-v0.3.md`, DetailedRange lines 634–925 (after alignment commit `cdcd1d8`)
*   **Reviewers:** egm-implementation-readiness (R), egm-codebase-details (K), egm-style (S). Duplicates merged; source IDs kept.
*   **Verdict:** Not ready yet: 1 Blocker, 10 Majors, 15 Nits. The file list, the F1–F10 mapping, test counts (64, 6 orphan), `.vscodeignore`, and all named functions match the code. Gaps: the PostHog wire format, git failure classification, diff-ref leftovers, the G4a failure path, phasing.
*   **Note:** no separate style standard exists in the EGM plugin; the style review used `agents/style.md` only.

## Blocker

| ID | Source | Lines | Issue | Fix |
|---|---|---|---|---|
| I1 | K1 | 727 | Base cache "same pattern as `pageIndexCache`", but `pageIndexCache` is an unbounded, never-evicted Map (`extension.js:92-101`). | Describe it as its own single variable `{hash, path, text}`, replaced on a miss; drop the comparison. |

## Majors

| ID | Source | Lines | Issue | Fix |
|---|---|---|---|---|
| I2 | R1 | 653–678 | PostHog wire format unspecified: `/batch/` body shape (`api_key`, top-level vs `properties`), and `$exception` encoding (`$exception_list[{type, value, stacktrace:{frames}}]`, where `value` is normally the message, which G1 forbids). | One literal example payload for a normal event and one for `$exception`; `value` = error name; frame fields `filename`, `lineno`. |
| I3 | R2 | 654–658, 670, 895 | Sender lacks inputs: common values (no `vscode` import), extension path to tell own frames apart, and a logger (item 21 expects the output channel to show "nothing sent"). | Add `common`, `ownRoot`, `log` to `createPostHogSender`; list what it logs (sent / dropped by setting / dropped by cap). |
| I4 | R3, S4, K3, R12 | 721–725, 747–749 | `diffStatus` "ref or reason" can't produce "Diff: not in a1b2c3d". Leftover HEAD assumptions: `msg.diffAgainstHead` (`graph.js:146`, `extension.js:503`), "vs HEAD" node-count text (`graph.js:149`), "Diff vs HEAD" logs (`extension.js:267,493,499`). | `diffStatus: { ref: null / 'HEAD' / fullHash, reason?: 'untracked' / 'noRepo' / 'notInCommit' }`; short hash = 7 chars; remove `diffAgainstHead`; drive all labels and log text from the ref. |
| I5 | R4, K5, K6 | 704–728 | No rule maps git failures to reasons; `show` throws the same way for untracked, staged-not-committed, missing-in-commit, and a repo with no commits (`HEAD.commit` undefined). `git.show` as a `trackError` site would report every untracked file. The 5-second wait is undefined (could stall every refresh outside git). | No API/repo → `noRepo`; no HEAD commit → `notInCommit`; failed `show` with ref HEAD → `untracked`; with a hash → `notInCommit`; `trackError('git.show')` only for other failures. Wait once for git API `state === 'initialized'` (via `onDidChangeState`, 5 s), never for a repo to appear. Extend `getGitApi()`; call `show()` with the resolved hash. |
| I6 | R5, K11 | 717–720 | `compareWithCommitCommand` edge cases: no current file, no repo, 0 commits, cancel, `log()` throws; doesn't say a pick triggers `refresh()`; no `onDidReceiveMessage` branch for the webview's `compareWithCommit`. | Follow `openGraph`'s pattern: warn if no file; info "no commits for this file"; cancel leaves `diffRef`; `trackError('git.log')` on throw; `await refresh(currentUri)` after pick; add the message branch. |
| I7 | R6 | 805–815 | G4a has no failure path: up to 11 suspicious files are allowed, and those have garbage type names that won't be grammar keywords, so the check fails on first run. | Skip files `assessParseQuality` flags when running the keyword check; use the exported `assessParseQuality`, not the copy in `corpus.test.js:39-73`. |
| I8 | R7 | whole section | No phases or order; dependencies exist (item 14 needs 7; 10 needs 1, 2, 17; `diffRef` in items 4 and 5 lands together). | Ordered phases, green after each: (1) deletions + F-fixes in diff.js/graph.css/graph.js + tests; (2) diffRef, getContentAtRef, cache, Compare with Commit; (3) schema, sender, telemetry, telemetry.json + tests; (4) grammar tests; (5) README, CHANGELOG, package.json, .vscodeignore, package. |
| I9 | K2 | 750–751 | F5: re-rendering for `selectedNodeId` reopens a panel the user closed (close only adds `hidden`, `graph.js:75-77`). | Re-render only if the panel is not hidden. |
| I10 | K4, R14 | 769–771 | F8: `buildPathIndex` overwrites duplicates in two loops (children `diff.js:56-59`, roots `:66-69`); numbering unspecified. | Fix both loops; reuse `nextSiblingIndex` (`diff.js:40-44`); first keeps the bare key, then `#2`, `#3`; add a root-level duplicate test. |
| I11 | K7 | 772–773 | F9: the label is *always* derived (`parser.js:256`), so the condition is always true. | Drop `_label` from `computePropChanges` (`diff.js:96-98`) and `propsEqual` (`:84`); remove the dead `labelChange` branch in `renderPropsGrid` (`graph.js:851-864`). |

## Nits

| ID | Source | Lines | Issue | Fix |
|---|---|---|---|---|
| I12 | R8, S3, K13 | 693–695, 742–744 | "First use per panel session" claimed by graph.js and telemetry.js; no reset API. | Only `telemetry.js` dedupes; export `resetPanelSession()`, call it in `createPanelAndShow`. |
| I13 | R9, S2, K11 | 742–744 | `featureUsed` triggers don't map to names; `revealLine` is posted from row, arrow-key, breadcrumb and reference clicks. | Emit at each call site with the exact name; give message shapes `{type:'viewChanged', view}`, `{type:'featureUsed', name}`. |
| I14 | R10, S5 | 701–704 | `track('command')` in handler *and* message could double count. | Track once, inside each `xxxCommand()` function. |
| I15 | R11, K8 | 756 | Webview `log` removal is in the wrong file. | Move to item 4 (`extension.js:407-409`). |
| I16 | R13, K12 | 717 | Toggle from a commit hash undefined; reset on panel close unstated. | "non-null → `null`; `null` → `'HEAD'`"; state that `diffRef` survives dispose (as today). |
| I17 | R15 | 645–665 | Free-text values (`extVersion`, `vscodeVersion`, `os`, error `name`) have no check. | Any string ≤ 64 chars matching `^[\w.\-]+$`. |
| I18 | R16, K15 | 675, 683–691 | Placeholder-key behaviour, shutdown flush, timer cleanup unspecified. | `track`/`trackError` no-op with no logger; `deactivate` returns the flush promise (best effort); timer `unref()`'d and cleared on dispose. |
| I19 | S1 | 916 | "Mohammad's F5 run" clashes with finding F5 and with "the author". | "the author's manual run (Extension Development Host)". |
| I20 | S6, K10 | 761–765 | `<git decoration token>` placeholder; stale "Left border" comments (`graph.css:529-533`, `graph.js:891-893`); `#diff-pick` already styled by `#toolbar button`. | Name `--vscode-gitDecoration-addedResourceForeground` / `modifiedResourceForeground`; update comments; only a width override. |
| I21 | S7 | 644 | "Z18" undefined in the doc. | Reference "Technical Plan §1, Allowlist". |
| I22 | S8 | 649, 665, 701 | Common keys listed only on `activated`, yet added to every event. | Say "added to every event by the sender"; mark them common in the event table. |
| I23 | S9, S10 | 305, 326, 340, 672, 724 | "once per file" vs "per file + ref"; "per instance" vs "per VS Code session". | Use "per file + ref" and "per VS Code session (one sender instance)" everywhere. |
| I24 | S11, K14 | 868 | "matches §5" but §5 lacks `node_modules/**`. | Drop the "matches" sentence. |
| I25 | S12 | 909–921 | Unverifiable checks: test total deferred, "browser harness" undefined, "discard-IP first" relative to what. | "58 existing + new"; describe the harness in one line; "before the Marketplace upload". |
| I26 | K9 | 773–774 | Stale text is a sentence at `diff.js:5-8`, not a header line. | "rewrite the sentence at lines 5-8". |

## Confirmed against code

Branch `feature/git-diff`; all named functions/variables at stated locations; process handlers output-only (`extension.js:124-131`); `switchTo` is the single funnel; `diffValueEl` renders `undefined` as "(none)" (reuse for F7); 64 tests (6 orphan; corpus test skips without corpus); `fixtures/orphan-app/` used only by orphan tests; `demo.mp4` unreferenced; `.vscodeignore` and `package.json` as described; README line 44 says "1200+". VS Code API claims match the published API but could not be checked locally (no `@types/vscode`).
