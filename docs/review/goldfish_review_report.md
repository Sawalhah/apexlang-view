# Goldfish Annotated Review Report

**Target:** `docs/DESIGN-v0.2-v0.3.md` (lines 1–442, FeatureRange)
**Inputs:** `critic_report.md` (Stage 7, round 1), plus overlapping open items
from `zoom_out_report.md` (Stage 5) and `comprehension_report.md` (Stage 6).
**Totals:** 25 PROPOSE FIX · 1 ESCALATE · 0 CONTEST · remaining Nits DECLINE
(listed at the end).

Note: Stage 7 reviews lines 1–442 only. Where a fix also changes the Detailed
Implementation Plan (lines 443–667), that part is applied in Stage 9 so the
plan is reviewed against the final design.

## Needs your input (ESCALATE)

### [E1] PostHog data region — US or EU? → ANSWERED 2026-11-19: **US** (Mohammad already signed up on US cloud). Apply as: "Region: US (PostHog US Cloud), chosen at sign-up; switching to EU later means a new EU-cloud organization and a new key, with no data migration."
*   **Source:** design-M11 (C14).
*   **Why escalated:** a business choice, not something the documents decide.
    EU (Frankfurt) keeps data in the EU, which suits EU and Middle-East users
    and GDPR; US is PostHog's default. It cannot be changed later without a new
    project and a new key.
*   **Proposed Edit (once you choose):** Open Questions item becomes a decision
    under G1: "Region: <EU|US>, chosen because …".

## Prioritized Findings & AI Suggestions

### [Issue 1] [`egm-design`] - Severity: Blocker — own off-switch bypassed (C1)
*   **Affected Scope:** lines 219-223, 244, 307-308 (Technical Plan §1)
*   **Discrepancy:** `apexlangView.telemetry.enabled` is checked only in
    `track()`/`trackError()`; VS Code forwards unhandled errors directly to the
    sender.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The sender is the only point every event passes.
*   ***Proposed Edit:*** §1: "The sender checks `apexlangView.telemetry.enabled`
    on every `sendEventData` / `sendErrorData` call (read live from
    configuration), so no event of any kind leaves when it is off. `track()` and
    `trackError()` no longer check it."

### [Issue 2] [`egm-design`] - Severity: Blocker — no property allowlist (C2)
*   **Affected Scope:** lines 109-116, 239, 360-367
*   **Discrepancy:** VS Code's logger adds built-in common properties
    (including the machine ID) that the design never filters.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid regardless of the exact built-in list: the
    design's privacy promise must not depend on what VS Code adds.
*   ***Proposed Edit:*** G1 privacy list + §1: "The sender builds every PostHog
    payload from an explicit allowlist — event name (with any
    `publisher.extension/` prefix VS Code adds stripped), the properties in the
    event table, extension version, VS Code version (`vscode.version`), OS
    (`process.platform`), and the random `distinct_id` — and drops every other
    key, including VS Code's built-in `common.*` properties
    (`ignoreBuiltInCommonProperties: true`)." Event table `activated` row:
    properties = `extVersion`, `vscodeVersion`, `os`.

### [Issue 3] [`egm-structural`] - Severity: Blocker — no Risks & Mitigations section (C3)
*   **Affected Scope:** whole document
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** New `## Risks & Mitigations` after Non-Functional
    Requirements, a table with: (1) fake events via the public key → closed
    event list, 200-event cap, PostHog billing limit $0 / free plan without
    card, event-definition review; revoking the key is one-way; (2) free-quota
    exhaustion → volume estimate (Issue 13); (3) thin data → decision rule
    with fallback (Issue 12); (4) proxy-blocked users missing → proxy-aware
    HTTP (Issue 14), stated as a known bias; (5) git failures (no repo,
    untracked, shallow clone, file absent at commit, detached HEAD) → explicit
    states (Issue 10); (6) other extensions' errors → single capture path
    (Issue 5); (7) parity regression → CSS-rule test + manual side-by-side
    (Issue 7); (8) rollback → tag `v0.1.0` + kept VSIX at
    `tools/apexlang-view/apexlang-view-0.1.0.vsix`. Move "Reach of the data"
    from Open Questions into this table.

### [Issue 4] [`egm-structural`/`egm-design`] - Severity: Blocker — "Rejected by author" without link (C4)
*   **Affected Scope:** lines 36-38, 101-107, Alternatives A–I
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** The rule is unconditional. Each alternative already
    has a concrete trade-off in its Cons; state it as the reason.
*   ***Proposed Edit:*** Each "Reason for Rejection" becomes the trade-off
    itself, followed by "(decision recorded in [ROADMAP.md](../ROADMAP.md),
    section …)". Examples: A — "first usage data delayed by the whole 0.3.0
    build"; B — "three version bumps, three packaging + clean-profile test
    passes, three Marketplace uploads, for features that do not depend on each
    other's data"; F — "removes a view existing users have (breaks G2) without
    data on its use". Add a "Decisions log" table to ROADMAP.md listing each
    decision with date, so the links resolve.

### [Issue 5] [`egm-design`] - Severity: Major — other extensions' errors (C5 / Z1)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** §1: "Error capture paths: (a) explicit `trackError` at
    our own catch sites; (b) the webview `error` message; (c) the logger's own
    forwarding of unhandled errors, which VS Code limits to our extension. The
    process-wide `uncaughtException`/`unhandledRejection` handlers keep logging
    to the output channel only and never send telemetry. The sender drops any
    exception with no stack frame from our files and sends each distinct error
    (name + top own frame) at most once per VS Code session."

### [Issue 6] [`egm-design`] - Severity: Major — error payloads may carry user data (C6 / Z2)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** G1 privacy list + event table `$exception` row: "No
    error message text is ever sent. An error event carries only: the error
    `name`, a fixed `where` code naming the call site (closed list, e.g.
    `refresh.parse`, `refresh.diff`, `git.show`, `appMap.scan`,
    `webview.render`), and stack frames from our own files reduced to
    `file.js:line` (webview frames reduced from `vscode-webview://…/graph.js`
    to `graph.js:line`). The webview `error` message gains a `name` field. Full
    messages stay in the local output channel."

### [Issue 7] [`egm-design`/`egm-style`] - Severity: Major — G2 test can't catch F3 (C7 / Z6)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** G2: "With Diff off, 0.2.0 shows the same rows, order,
    labels, icons, and indentation as 0.1.0. Allowed additions: the Diff
    button, the ▾ compare button, the `compareWithCommit` command, and the
    telemetry setting." §4 replaced: "A test parses `graph.css` from tag
    `v0.1.0` and from the working copy and fails if any rule that applies to
    `.tree-row`, its children, or the toolbar changed in a layout property
    (margin, padding, border, width, height, position, display), except rules
    for the diff classes, which may only use `box-shadow`. Plus a required
    release step: open the same files side by side in 0.1.0 and 0.2.0 (Diff
    off) in a clean profile. No `jsdom` dependency." Alternatives gains
    "jsdom DOM comparison" (rejected: no layout, could not have caught F3).

### [Issue 8] [`egm-design`/`egm-structural`/`egm-style`] - Severity: Major — G4 not measurable (C8 / Z7)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** G4 split: "G4a — every `typeName` the parser produces
    on the local sample corpus (APEX 26.1 sample apps, 2,228 `.apx` files,
    stored outside the repo at `apex_podman/apex-apps`) is a component keyword
    in Oracle's 26.1 or 26.2 grammar, and every file passes
    `assessParseQuality` (not `suspicious`). G4b — the parser handles each
    syntax form the grammar defines (strings with escapes, `//` and `/* */`
    comments, arrays, fenced ``` code, nested groups), each tested with a
    minimal example. G4c (only if a 26.2 export is obtained before release) —
    the same check on that export; otherwise noted as unverified in the
    CHANGELOG." §3: drop Tests A and C (they cannot fail — the parser does not
    look at keywords); Test B moves into `test/corpus.test.js`; the keyword
    list is generated once into a committed JSON file. Problem 4 mentions the
    one removed keyword (`uiDefaultsReference`). Define "suspicious" once:
    "`assessParseQuality` flags a file when its parse looks wrong (unexpected
    characters or garbage type names)".

### [Issue 9] [`egm-design`] - Severity: Major — msBucket measures the wrong thing (C9)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** event table: `fileParsed.msBucket` = time spent in
    `parseApxToGraph` only.

### [Issue 10] [`egm-design`] - Severity: Major — compare-with-commit edge cases (C10 / Z3)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** §2b: "The base file text is cached per (commit hash,
    path); `HEAD` is resolved to a hash first and the cache entry is dropped
    when the repository's HEAD changes, so typing does no git work after the
    first read. History does not follow renames (VS Code's git API `log` and
    `show` use the current path): commits from before a rename are not listed,
    and a chosen commit where the file did not exist shows 'Diff: not in
    a1b2c3d'. Renamed-file history is a known limit." Status list gains
    `notInCommit`. F4's sequence guard stays as a backup.

### [Issue 11] [`egm-design`] - Severity: Major — ref reset on file switch (C11)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** §2b: "When the panel switches file, Diff vs HEAD stays
    on (as today); a specific chosen commit resets to HEAD, because that commit
    belongs to the previous file's history." Same note for the CHANGELOG.

### [Issue 12] [`egm-design`] - Severity: Major — no 0.3.0 decision rule (C12 / Z4)
*   ***AI Suggestion:*** PROPOSE FIX (numbers are proposals — change them freely)
*   ***Proposed Edit:*** New subsection under the 0.3.0 outline: "Decision
    point: 6 weeks after 0.2.0 ships, or when 30 distinct weekly users are
    reached, whichever is later (capped at 10 weeks). Rules: (1) if
    `compareWithCommit` is used by ≥20% of weekly users, branch/PR compare
    (G6) goes first, else safety warnings (G7) go first; (2) if the Graph view
    accounts for <5% of `viewChanged` events, it is dropped in 0.3.0, ≥15% it
    gains diff highlighting, otherwise unchanged. Fallback if fewer than 30
    weekly users by week 10: keep G6 then G7, Graph view unchanged." Add
    `refAge` bucket (`HEAD~1`, `≤10 back`, `>10 back`) to the `command` event
    for `compareWithCommit`.

### [Issue 13] [`egm-design`/`egm-style`] - Severity: Major — public key abuse and quota (C13)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** G1: replace "ignored in the dashboard" with: "Because
    the project key is public, anyone could send fake events. Limits: the
    sender only sends the closed event list, each install stops at 200 events
    per VS Code session, and the PostHog project stays on the free plan with no
    card, so overuse can never be billed. Volume estimate: ~232 installs × ~2
    sessions/day × ~15 events ≈ 7,000 events/day ≈ 210,000/month, about 21% of
    the 1M free monthly events." Risks table notes that revoking the key is
    one-way (all installed copies stop sending until a new release).

### [Issue 14] [`egm-design`] - Severity: Major — proxies (C14, region → E1)
*   ***AI Suggestion:*** PROPOSE FIX (proxy part)
*   ***Proposed Edit:*** §1: "The sender uses Node's `https` module rather than
    global `fetch`, because VS Code applies the user's proxy settings
    (`http.proxy`) to `https` requests from extensions; users behind proxies
    VS Code cannot pass are not counted (known bias, Risks table)."

### [Issue 15] [`egm-structural`] - Severity: Major — G3b has no alternatives (C15 / Z5)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** Alternatives gains "J: Timeline 'Show component
    changes' action instead of a commit picker. Pros: reuses VS Code's own
    commit list, the workflow in the cited post. Cons: VS Code does not
    document what a git Timeline item passes to a contributed command, so the
    commit hash may not be reliably available; the built-in Timeline item
    shape can change between versions. Reason for rejection: unverified
    dependency on undocumented data; re-checked during the build — if the
    commit hash is available, the Timeline action is added alongside the
    picker." Remove the Timeline line from Future Improvements.

### [Issue 16] [`egm-design`/`egm-structural`] - Severity: Major — missing alternatives (C16)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** Alternatives gains: "K: opt-in telemetry (off until the
    user turns it on) — rejected: almost no one opts in, so the data could not
    answer the three questions; the design follows VS Code's convention of
    obeying the user's global telemetry setting, plus an extra off switch."
    "L: PostHog's Node client (`posthog-node`) instead of a custom sender —
    rejected: adds the first runtime dependency and a bundling step; it would
    still need the allowlist." "M: per-event rate limits instead of one
    200-event cap — rejected: more state for a few hundred users; the single
    cap already protects the free quota." Alternative B reason per Issue 4.

### [Issue 17] [`egm-structural`] - Severity: Major — closed event list split (C17)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** event table `command.name` adds `compareWithCommit`;
    G1 points to the table ("the full list is the event table in the Technical
    Plan") instead of repeating a partial list.

### [Issue 18] [`egm-structural`] - Severity: Major — link gaps (C18)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** Additional Resources: add full links for Alex on APEX
    (https://alexonapex.com/blog/2026/07/24/merging-apex-working-copies-with-apexlang/),
    thatjeffsmith
    (https://www.thatjeffsmith.com/archive/2026/11/vibe-coding-an-oracle-apex-app-via-apexlang-pt2-diffs/),
    juanl (https://juanl.hashnode.dev/apexlang-oracle-apex-control-versiones),
    SiliconANGLE
    (https://siliconangle.com/2026/11/04/vibe-coding-meets-governance-apexlang-abstraction-oracleaiworld/);
    `ROADMAP.md` → `[ROADMAP.md](../ROADMAP.md)`; bare URLs as link text.

### [Issue 19] [`egm-structural`] - Severity: Major — heading levels (C19)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** "Additional Resources" and "Future Improvements" → H2.

### [Issue 20] [`egm-style`] - Severity: Major — overclaims (C20)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** "Every product decision so far has been a guess" →
    "No product decision so far has been based on usage data." Alternative E
    "cannot be linked to anything else" → "is not shared with other extensions
    and not derived from machine or account data." "What we are not solving":
    add "Oracle's extension (26.3+) can also compare local APEXlang with the
    application in the database; it does not compare against git history or
    show changes per component."

### [Issue 21] [`egm-style`] - Severity: Major — Problem 3 paragraph (C21)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** split into three short paragraphs: the gap; the
    evidence (Alex on APEX, thatjeffsmith); why now ("expected to grow" for the
    AI forecast). Move APEXREST to Additional Resources as a related tool.

### [Issue 22] [`egm-comprehension`] - Severity: Major — F1–F10 never listed
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** under G3, a one-line-each table: F1 demo media in
    package · F2 version not bumped · F3 3px row shift · F4 stale refresh ·
    F5 detail panel not refreshed · F6 unclear diff state + log spam · F7
    removed props hidden · F8 duplicate names overwrite · F9 rename shows two
    changes · F10 slow lookups + stale comments + unused `removedInfo`.

### [Issue 23] [`egm-comprehension`/`egm-zoom-out`] - Severity: Major — GIF on Marketplace
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** G5: "The README links the GIF by relative path; when
    packaging, `vsce` rewrites relative links to the GitHub repository in
    `package.json`, so `media/demo.gif` must be on GitHub `main` before the
    Marketplace upload (release checklist item)."

### [Issue 24] [`egm-zoom-out`] - Severity: Major — `gitNotReady` (Z8)
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** F6 text: "If git is still loading, the extension waits
    for it (up to 5 seconds) before reading; user-visible states are only
    'Diff: not tracked', 'Diff: no git', and 'Diff: not in a1b2c3d'."

### [Issue 25] [`egm-comprehension`] - Severity: Major — corpus never located
*   ***AI Suggestion:*** PROPOSE FIX (covered by Issue 8's G4a wording; also
    state once that tests skip, not fail, when it is absent).

### [Issue 26] [`egm-style`/`egm-structural`] - Severity: Nit — selected Nits worth fixing
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Proposed Edit:*** "Finished work" → "Built but unreleased work"; G3
    title → "Diff vs HEAD: findings fixed, package under 100 KB"; one corpus
    term ("sample corpus"); "handles" → "parses all 2,228 files without
    error"; "always free" → "free plan, no card, no expiry as of 2026-11, 1M
    events/month"; VS Code cleaning described as best-effort; Open Questions
    rephrased as questions without the first name; define "panel session"
    (panel open → close) and "VS Code session" (window lifetime); one
    failure-handling sentence (one attempt, 5-second timeout, no retry); NFR
    attribution (VS Code 1.85 API provides `createTelemetryLogger`); fix the
    diagram (both directions, `compareWithCommit`, `diffStatus`, remove
    duplicate labels); remove webview `log` from the message list; "no user
    identity" → "no personal identity; one random per-install ID"; add the
    orphan-detector removal to the plan; G6 "pull request" → "a pull-request
    branch fetched locally vs its base branch"; G7 duplicate-names check scoped
    to exclude legitimate repeats (e.g. `templateOptionGroup`).

### DECLINE (Nits recorded, not fixed now)

Bold labels vs H4 headings in the plan (style choice; left as is) · G6/G7
heading style · section names vs the standard's examples (optional per the
standard) · Alternative A estimate basis (stated as the author's estimate in
Issue 4's rewrite) · subjective wording in Alternatives H (replaced by the
concrete reason in Issue 4) · F3 called "architectural" (heading reworded in
Issue 26 implicitly) · telemetry module consolidation, batching, extra setting
(Detailed plan topics → Stage 9) · positional matching of unnamed siblings
(added to the Risks table as a known limit instead).
