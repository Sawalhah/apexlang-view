# Stage 8: Intermediate Zoom Out Review

*   **Target:** `docs/DESIGN-v0.2-v0.3.md` (full file: FeatureRange 1-614, DetailedRange 615-839)
*   **Inputs:** `zoom_out_report.md` (Z1-Z15), `goldfish_review_report.md` (resolved)
*   **Verdict:** Approve with Majors. No Blockers. Stage 7 closed most of Z1-Z15; three fixes created new issues (Z16 G4a vs parser baseline, Z17 CSS test gaps, Z18 four copies of the telemetry list).

## Z-item status

| Z | Status | Remaining gap |
|---|---|---|
| Z1 error paths | Resolved (FeatureRange) | DetailedRange still contradicts (Z23) |
| Z2 privacy scrub | Resolved | — |
| Z3 base re-fetch | Resolved | Simplification in Z21 |
| Z4 0.3.0 rule | Resolved | `refAge` unused (Z19) |
| Z5 G3b / Timeline | Partly | Alternative J adds scope (Z20) |
| Z6 jsdom test | Partly | Replacement has gaps (Z17) |
| Z7 grammar tests | Partly | 2,228 vs `minFiles: 1200` (`corpus.test.js:26`) and README "1200+"; Z16 |
| Z8 gitNotReady | Resolved | — |
| Z9 GIF on main | Resolved | Verification Plan step missing (Stage 9) |
| Z10 telemetry sprawl | Open (Stage 9) | `telemetry-config.js` separate; see Z18 |
| Z11 event prefix | Resolved | — |
| Z12 detail in architecture | Open, grown | §1 has `ignoreBuiltInCommonProperties`, `https`, `$process_person_profile`, `globalState`, 20/30s/5s numbers → move to Detailed items 2-3 |
| Z13 pull request | Resolved | — |
| Z14 leftovers | Partly (Stage 9) | Item 20 says v0.4; `.vscodeignore` lists differ (§5 vs item 16); test count missing |
| Z15 unnamed siblings | Resolved | Risk 9 |

## New findings

### Z16 — Major — G4a (175-177) vs 240-241, 205-207
G4a demands "none suspicious", but the baseline is `maxSuspicious: 11` (`test/corpus.test.js:27`). Meeting it needs unplanned parser changes, which break "parser.js unchanged / identical parse output" (G2) and the no-rewrite Non-Goal.
**Fix:** G4a = "0 errors, suspicious count ≤ baseline (11)". Align `minFiles` to 2,228 and the corpus path to `.../apex-apps/sample-apps` (`corpus.test.js:20`).

### Z17 — Major — §4 (378-384), Risk 7
Indentation is set inline (`row.style.paddingLeft`, `media/graph.js:691,727`), not in `graph.css`, so the CSS test can't catch it. "Rules that apply to `.tree-row`…" needs a hand-written selector matcher. Reading tag `v0.1.0` via git needs git + tag at test time and will fail on purpose when 0.3.0 changes the toolbar.
**Fix:** Narrow assertion: `.tree-row` has no `border-left`; diff classes set only `box-shadow`. No git, no tag. The manual side-by-side check is the real G2 guard; Risk 7 says so.

### Z18 — Major — 99, 121-127, 143-144, 301-306, 315; Detailed items 2, 15
The closed event/property list exists in four places (event table, sender allowlist + `where` list, `telemetry.json`, README Privacy) with nothing checking they match.
**Fix:** One schema in `src/` (event → allowed props, plus `where` codes); the sender filters against it; a unit test asserts `telemetry.json` matches; the README links to `telemetry.json`.

### Z19 — Nit — 311 vs 411-417
`refAge` is collected but no decision rule reads it. **Fix:** drop it, or add a rule (mostly `>10 back` favors G6).

### Z20 — Nit — Alternative J (522-524)
"Timeline action added if the hash is available" = two entry points decided mid-build, and missing from the closed lists (G2 additions, `command.name`, Detailed item 14). **Fix:** pick one now, or move it to Open Questions and name the lists that change.

### Z21 — Nit — 352-355
Keyed by resolved hash, an entry can't go stale, so "drop on HEAD change" is redundant; the cache is also unbounded. **Fix:** read `repository.state.HEAD.commit` each refresh, key `(hash, path)`, keep only the current file's entry (reuse the `pageIndexCache` pattern, `extension.js:92-101`).

### Z22 — Nit — Alt M (543-547) vs §1 (299-300); G2 (147-149)
Alt M rejects per-event limits for "more state", yet §1 adds per-error dedupe state: reword M. G2's allowed additions omit `toggleDiff` / Diff vs HEAD and the `ctrl+alt+l` keybinding (unreleased): add them.

### Z23 — Major (grouped) — DetailedRange not aligned with Stage 7 (Stage 9 work)
*   Item 1: "US or EU".
*   Item 2: `fetchImpl` not `https`; message truncated instead of omitted; exact names, no prefix strip or allowlist; no own-frame filter or dedupe; no live `enabled` check in the sender.
*   Item 3: `track`/`trackError` check `enabled`; logger lacks `ignoreBuiltInCommonProperties`.
*   Item 4: "`logError` calls `trackError`" reopens Z1 (process handlers call `logError`, `extension.js:124-131`); `where: 'webview'` not in the list; `gitNotReady` not `notInCommit`; no base cache; "`diffRef` resets to null in switchTo" contradicts §2b.
*   Item 5: no "Diff: not in a1b2c3d" label.
*   Item 10: tests the path scrub, not the schema.
*   Item 11: keeps Tests A/B/C and `grammar-catalog.js`.
*   Items 12, 14: jsdom test and devDependency.
*   Items 16, 20: see Z14.
*   Verification Plan: no GIF-on-main step, no CSS test, no test count.

## Reuse checks
`pageIndexCache` (`extension.js:92-101`) for the base cache; `corpus.test.js` walker/skip/baseline for G4a; `getGitApi`, `repository.show`, `repository.state.HEAD` cover §2b; no new runtime dependencies.
