# Stage 5 — Initial Zoom Out Review

*   **Target:** `docs/DESIGN-v0.2-v0.3.md` (full file)
*   **Reviewers:** egm-zoom-out, egm-inventive-catalyst (fresh context each)
*   **GoldfishContext:** ROADMAP.md, package.json, src/extension.js, src/diff.js,
    src/parser.js, media/graph.js
*   **Date:** 2026-11-19
*   **Verdict:** Approve with Majors to address. No Blockers.

## Short version (deduplicated)

| # | Severity | Finding | Raised by |
|---|---|---|---|
| Z1 | 🟡 Major | Error telemetry has overlapping paths: the existing process-wide `uncaughtException`/`unhandledRejection` handlers catch **other extensions'** errors and would send them via `logError → trackError`; our own crashes can be sent twice. Fix: one path only (own catch sites + webview `error` + logger's scoped capture); drop exceptions with zero own frames; dedupe repeats. | both |
| Z2 | 🟡 Major | Privacy scrub is regex-based; `logError` messages contain bare file names (`p00001.apx`) that survive it, breaking the Non-Goal. Fix: send no free-text message — only error `name`, a fixed `where` code per call site, and own `file.js:line` frames. | catalyst |
| Z3 | 🟡 Major | Diff re-fetches the unchanging base from git on every keystroke — the root cause of F4 (stale refresh) and F6 (log spam). Fix: cache the parsed base graph per (file, resolved commit); invalidate when HEAD moves. Keep the sequence guard as a backup. | catalyst |
| Z4 | 🟡 Major | "0.3.0 decided by telemetry" has no event that measures demand for 0.3.0 features, and no decision rule or time window. Fix: add a proxy (e.g. bucketed `refAge` on compare) and write the rule + minimum days/users now. | catalyst |
| Z5 | 🟡 Major | G3b (compare with any commit) contradicts the design's own "decide from data" reason for the split; VS Code's **Timeline** already lists a file's commits — a "Show component changes" Timeline menu action may be simpler than a QuickPick + "▾" button (needs a check that the commit hash is available). | both |
| Z6 | 🟡 Major | The jsdom parity test can't see layout (would not have caught F3's 3px shift), needs more harness than listed, and breaks on purpose in 0.3.0. Fix: drop it and `jsdom`; keep the manual parity check; add a small CSS assertion (no `border-left` on `.tree-row`, diff markers use `box-shadow`). | zoom-out |
| Z7 | 🟡 Major | Grammar Tests A and C pass by construction (parser accepts any word); only Test B is meaningful — fold it into `test/corpus.test.js` and use a committed keyword list (JSON) instead of a permanent EBNF scraper. Corpus counts conflict (2,228 vs `minFiles: 1200`). | zoom-out |
| Z8 | 🟡 Major | `gitNotReady` shown as a label (and mislabeled "no git") instead of waiting for git to finish loading. Fix: wait with a short timeout inside `getContentAtRef`; user-visible states only `untracked` and `noRepo`. | zoom-out |
| Z9 | 🟡 Major | Verification plan misses: GitHub `main` must contain `media/demo.gif` **before** Marketplace upload, or the README image is broken. | zoom-out |
| Z10 | 🟢 Nit | Telemetry sprawl: fold `telemetry-config.js` into `telemetry.js`; "first use per session" implemented twice; batching may be premature for ~232 installs; extra setting duplicates VS Code's switch. | zoom-out |
| Z11 | 🟢 Nit | `TelemetryLogger` may prefix event names with the extension ID before the sender sees them — an exact-match allow-list could drop everything. Verify and test. | zoom-out |
| Z12 | 🟢 Nit | Architecture section repeats implementation numbers (20/30s/5s, endpoints). | zoom-out |
| Z13 | 🟢 Nit | G6 says "pull request" but the outline only covers branches/tags. | zoom-out |
| Z14 | 🟢 Nit | Leftovers: item 20 still says `DESIGN-v0.2-v0.4.md`; `.vscodeignore` lists differ between §5 and item 16; `demo.mp4` both deleted and ignored; expected test count after removing orphan tests not stated. | zoom-out |
| Z15 | 🟢 Nit | Positional matching of unnamed same-type siblings misaligns when an agent inserts a component mid-block — state the limitation for G3b/G6. | catalyst |

--------------------------------------------------------------------------------

## Full report — egm-zoom-out

Verdict: Approve with Majors to address. No Blockers. Context is sufficient; the
architecture fits the codebase (no runtime dependencies, parser/diff stay pure,
compare-with-commit reuses `parseApxToGraph`/`diffGraphs`; built-in
`TelemetryLogger` and git API reused instead of libraries). The Majors are
mostly about cutting scope and complexity.

1.  **Major — error capture has two overlapping paths, one catching other
    extensions' errors.** Scope: Technical Plan §1; Implementation item 4;
    extension.js 124-131. `activate()` already installs process-wide handlers
    that catch noise from other extensions (comment at extension.js 22-28).
    The design adds `logError → trackError` (fed by those handlers) and
    `ignoreUnhandledErrors: false` (already VS Code's default). Result: our
    crashes sent twice; other extensions' crashes sent with no own frames,
    eating the 200 cap. Fix: one capture path — `logError` from our own
    try/catch sites and the webview `error` message, plus the logger's own
    scoped capture; never from the process-wide handlers; drop exceptions
    with zero own frames.
2.  **Major — the G2 jsdom parity test is heavy, can't catch F3, and breaks by
    design.** jsdom does no layout; indentation is inline `paddingLeft`
    (graph.js 691, 727). The harness also needs the toolbar HTML (inside
    `getWebviewHtml`, which requires `vscode`), `search-logic.js`, an
    `acquireVsCodeApi` stub, and `#diff-pick` at both versions. Pinned to
    `v0.1.0`, it fails when 0.3.0 changes the webview on purpose. The manual
    Diff-off parity check already exists. Drop jsdom; add a CSS assertion
    targeting F3.
3.  **Major — G3b contradicts the release-split rationale; Timeline may be
    simpler.** Moving a 0.3.0 feature into 0.2.0 on one blog post is the
    "decided without data" pattern rejected elsewhere (Alternative F). The
    cited workflow uses Timeline, which already lists the file's commits; a
    `timeline/item/context` command could replace the QuickPick, "▾" button,
    and new toolbar state. Either keep 0.2.0 to Diff vs HEAD, or check the
    Timeline route first. Unverified: whether the git Timeline item exposes
    the commit hash.
4.  **Major — grammar Tests A and C pass by construction; Test B belongs in
    corpus.test.js.** `parseEntries` (parser.js 137-197) accepts any word as a
    block type or property. Only Test B (every corpus `typeName` is a grammar
    keyword) can catch a misread file; it duplicates corpus.test.js's walker
    and skip rule. Generate the component keyword list once as a committed
    JSON fixture instead of a permanent EBNF scraper. Fix the conflicting
    corpus counts (2,228 vs `minFiles: 1200` / README "1200+").
5.  **Major — `gitNotReady` shown as a label instead of fixed.** ROADMAP's own
    F6 note says wait for `git.state === 'initialized'` /
    `onDidOpenRepository`. The webview has no label for `gitNotReady`. Wait
    inside `getContentAtRef` with a short timeout; user-visible states only
    `untracked` and `noRepo`.
6.  **Major — README GIF depends on GitHub `main`; not verified.** With
    `demo.gif` excluded from the VSIX, the Marketplace image is served from
    GitHub. Add "GitHub `main` contains `media/demo.gif` before upload" to the
    Verification Plan.
7.  **Nit — telemetry module sprawl.** `telemetry-config.js` holds two
    constants; "first use per panel session" lives in both graph.js and
    telemetry.js (telemetry layer shouldn't know panel lifecycle); overlapping
    guards (allow-list, dashboard filter, closed-list rule, cap — keep the
    cap); batching premature for this scale; extra setting duplicates VS
    Code's switch (acceptable).
8.  **Nit — allow-list vs event names after TelemetryLogger.** The logger may
    prefix names with the extension ID (`publisher.extension/eventName`) and
    add `common.*` properties before `sendEventData`. Unverified; confirm and
    test.
9.  **Nit — implementation detail in the architecture section.** Thresholds,
    endpoint, `$process_person_profile`, `refreshSeq`, box-shadow are repeated
    in the implementation plan; keep the architecture at "async, batched,
    capped, never blocks" and "latest refresh wins".
10. **Nit — G6 "pull request".** Needs a hosting API and auth; define it as
    "PR branch vs base branch, both local" or drop the word.
11. **Nit — consistency.** Item 20 names `DESIGN-v0.2-v0.4.md`; item 16 ignores
    `demo.mp4` that item 9 deletes; `ROADMAP.md` already ignored;
    `design_draft.md` no longer exists; §5 and item 16 exclusion lists differ;
    state the expected test count.

Reuse checks performed: corpus walker in test/corpus.test.js (reuse for Test
B); `getGitApi`/`repository.show` (generalizing is correct reuse);
`diffGraphs`/`buildPathIndex` reused; webview `error` forwarding and
`logError` reused (exclude process-wide handlers); Timeline as a candidate for
G3b; manual parity check makes jsdom unnecessary.

--------------------------------------------------------------------------------

## Full report — egm-inventive-catalyst

Context sufficiency: passes. Genuine contradictions exist (not a "no false
compromise" verdict). The overall plan is sound: two releases, a kill-switch by
revoking the PostHog key, grammar used only in tests, and a parity check
against v0.1.0. The compromises are in error telemetry, how the diff base is
fetched, and how 0.3.0 is to be decided.

1.  **Major — process-wide error handlers pollute error telemetry and
    double-count.** (Same mechanism as zoom-out #1.) Resolution — Extraction:
    the logger's extension-scoped unhandled-error forwarding is the only
    telemetry path for unhandled errors; process-wide handlers log only;
    explicit `trackError` only from own catch sites; sender drops `$exception`
    with zero own frames and duplicate (name + top own frame) repeats per
    session. Secondary: unattributable async rejections missed; small dedupe
    state; repeat counts hidden unless counted.
2.  **Major — privacy scrub contradicts Non-Goals and its own test.** Current
    `logError` prefixes embed `${fileName}` / `${uri.fsPath}`; a bare
    `p00001.apx` isn't path-shaped and survives; webview `error` text may carry
    component names; VS Code's cleaning doesn't remove APEX component names.
    Resolution — Segmentation: send only `name`, a fixed `where` code per call
    site (`refresh.parse`, `refresh.diff`, `appMap.read`, `webview.render`, …),
    and own `file.js:line` frames; no free text; full message stays in the
    local output channel; test becomes a schema check. Secondary: less detail
    per error; `where` codes must be maintained and listed in
    `telemetry.json`.
3.  **Major — F4's sequence number treats a symptom.** With Diff on, each
    400 ms debounced edit awaits `repository.show` and re-parses a base that
    doesn't change (extension.js 482-495) — that await opens the F4 race and
    caused F6's log spam. Resolution — memoize the parsed base graph per (uri,
    resolved commit hash); invalidate on `repository.state.onDidChange` /
    re-resolving HEAD; keep the sequence guard. G6 benefits too. Secondary:
    memory for one graph per file+ref; invalidation must handle HEAD moves,
    rebases, repo close.
4.  **Major — "0.3.0 decided by telemetry" has no measurable input.** No event
    measures G6 vs G7 demand; observation period "to be decided"; small sample.
    Resolution: define proxies now (e.g. bucketed `refAge` on
    `compareWithCommit`: HEAD~1, ≤10, >10) and write the threshold + minimum
    days/users before release. Rejected: silently running G7 checks and
    reporting counts (telemetry about the user's app — violates a Non-Goal).
    Secondary: more fields to document; proxies can mislead; less freedom to
    interpret later.
5.  **Nit — positional matching of unnamed siblings.** diff.js 14-19: inserting
    an unnamed same-type sibling misaligns those after it; F8's `#n` is also
    positional. Agent edits often insert mid-block. State the limitation; a
    later fix could match by content similarity — don't build now.
6.  **Nit — custom QuickPick duplicates Timeline.** Inversion: contribute "Show
    component changes" via `timeline/item/context`; check first that the git
    Timeline item exposes the commit hash; keep QuickPick as fallback if not.
    Secondary: Timeline item shape isn't a formal API contract.

Considered and not raised: persisting unsent events across sessions (YAGNI);
PostHog vs App Insights/Grafana, machineId rejection, rollback via v0.1.0, and
test-only grammar use (balanced, no false compromise).
