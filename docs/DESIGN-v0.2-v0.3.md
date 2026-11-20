# APEXLang View v0.2.0 – v0.3.0

*   **Author:** sawalhah (Mohammad Sawalhah)
*   **Status:** Approved by author; /egm:egm-review complete 2026-11-20 (Stages 5-9 resolved; see docs/review/consolidated_review_report.md). Ready to build.
*   **Date:** 2026-11-19

--------------------------------------------------------------------------------

## Overview

APEXLang View is a VS Code extension that shows Oracle APEX application files
written in APEXlang (`.apx`, introduced in APEX 26.1) as a navigable outline
tree, with an App Map of page-to-page links. Version 0.1.0 has been on the VS
Code Marketplace since 2026-07-25 (232 installs, one 5-star rating as of
2026-11-19).

This design covers the next two releases (decided by author: two releases,
not one large release and not three small ones):

*   **0.2.0 — Trust and diff.** Learn how the extension is used and where it
    fails (anonymous telemetry), ship the already-built "Diff vs HEAD" feature
    after fixing ten review findings, let the user compare the current file
    with any past commit of it, replace the developer-facing README, and add
    parser tests against Oracle's official grammar. Specified in full.
*   **0.3.0 — Review and safety.** Compare two arbitrary versions (branch vs
    branch, a pull-request branch fetched locally vs its base branch),
    changed-page badges in the App Map, and warnings for problems Oracle's own
    validator does not report. Released together as one bundle. Specified at
    outline level, with a data-based decision rule for its order.

Comparing with any past commit moved from 0.3.0 into 0.2.0 by author, after
Oracle's SQL Developer product manager showed reviewing AI-agent commits one
by one as plain text diffs (see The Problem, item 3).

0.3.0 stays at outline level on purpose: which of its parts come first is
decided from 0.2.0 telemetry data by the rule in "Decision point for 0.3.0".
Releasing everything at once would delay the first usage data by the whole
0.3.0 build; releasing three times would triple the packaging, clean-profile
testing, and Marketplace uploads (see Alternatives A and B).

## The Problem

Four problems, in priority order.

**1. We cannot see how the extension is used or when it breaks.** The only
data is the Marketplace install count. We do not know how many of the 232
installs still use the extension, which features they use, or whether it
crashes on their files. A parse failure on a real customer file is invisible
unless someone files a GitHub issue, and nobody has. No product decision so
far has been based on usage data.

**2. Built but unreleased work is not reaching users.** Diff vs HEAD, a
keyboard shortcut, and a rewritten README with a demo GIF have been built since
July but never released. The released README tells Marketplace users to "open
this folder and press F5", which are instructions for the extension's
developer, not its users. A code review of the unreleased work (ROADMAP section
F, listed under G3 below) found ten problems, two of which block release: the
demo media would grow the package from 39 KB to about 16.5 MB, and the version
number was never raised.

**3. Reviewing APEX changes is still manual.** APEXlang made APEX applications
readable as text, but comparing two versions of an app still reports only that
"page 1 differs", not which region, button, or dynamic action changed.
Reference and naming conflicts are checked by reading the source, and a clean
text merge does not guarantee a valid application.

The evidence comes from community writing since July. Alex on APEX
(2026-07-24) and juanl.hashnode.dev describe the merge and compare pain.
Oracle's own product manager for SQL Developer shows the review workflow
(thatjeffsmith.com, "Vibe coding an Oracle APEX app via APEXlang, pt2: diffs",
2026-11): an AI agent edits and commits APEXlang, and he reviews each commit
through VS Code's Timeline and plain line-by-line file diffs. There is no
component-level view of what the agent changed (which region, which query,
which tooltip); the reviewer reads raw text.

Why now: Oracle publishes the APEXlang grammar so AI agents (Claude, Codex)
can write APEX applications (SiliconANGLE, 2026-11-04). The share of changes
made by tools is expected to grow, and people need to see what those tools
changed.

**4. v1 was built without an official language definition.** The parser was
hand-written from sample exports because Oracle had not published a grammar.
Oracle now publishes an APEXlang reference with a downloadable EBNF grammar for
26.1 and 26.2. We have no test that checks our parser against it. 26.2 added
163 keywords we have not verified and removed one (`uiDefaultsReference`).

**What we are not solving:** editing assistance. Oracle's SQL Developer for VS
Code (26.3.1) already provides completion, validation, formatting, and
import/export for `.apx` files. Oracle's extension (26.3+) can also compare
local APEXlang with the application in the database; it does not compare
against git history or show changes per component. It does not provide an
outline tree or component navigation either; that is the space this extension
occupies.

## Goals

*   **G1 — Anonymous usage and error data.** 0.2.0 reports, without personal
    data, file paths, or file contents, the events in the event table
    (Technical Plan §1; that table is the full, closed list). Nothing is sent
    when VS Code's telemetry or this extension's own telemetry setting is
    turned off. Data goes to **PostHog Cloud (free plan)**, whose built-in
    screens answer the three questions the author asked: how many people
    actively use the extension, which errors they hit, and which views and
    features they use most. Chosen by author against the criteria "free, no
    extra setup, no complication": PostHog's free plan needs no credit card,
    has no expiry as of 2026-11, includes 1M events/month, and its dashboards
    need no query writing. Azure Application Insights and Grafana Cloud were
    rejected (Alternatives C and D).
    *   **Region: EU (PostHog EU Cloud, Frankfurt)**, project "APEXLang
        View" (id 359325). Changed from US by the author on 2026-11-20 during
        the build (a new EU-cloud organization; no data had been sent yet).
        Originally: US, chosen at sign-up. Switching to EU
        later means a new EU-cloud organization and a new key, with no data
        migration.
    *   **Volume:** ~232 installs × ~2 sessions/day × ~15 events ≈ 7,000
        events/day ≈ 210,000/month, about 21% of the free 1M monthly events.

    Privacy and security requirements for G1:
    *   Events go through VS Code's built-in `TelemetryLogger`
        (`vscode.env.createTelemetryLogger`), which enforces the user's VS Code
        telemetry setting and makes a best-effort pass to remove sensitive
        values; our code only supplies a small sender that posts to PostHog.
        No third-party telemetry library.
    *   **Property allowlist:** the sender builds every PostHog payload from an
        explicit allowlist (event name with any `publisher.extension/` prefix
        stripped, the properties in the event table, extension version, VS
        Code version, OS, and the random `distinct_id`) and drops every other
        key, including VS Code's built-in `common.*` properties
        (`ignoreBuiltInCommonProperties: true`). The privacy promise does not
        depend on what VS Code adds.
    *   **No message text:** no error message text is ever sent. An error event
        carries only the error `name`, a fixed `where` code from a closed list,
        and stack frames from our own files reduced to `file.js:line`. Full
        messages stay in the local output channel.
    *   **Identity:** no personal identity; one random per-install ID generated
        by the extension on first run and stored in its own storage. Not VS
        Code's `machineId`, not any account or computer name.
    *   PostHog project setting to discard IP addresses / location is turned on
        before 0.2.0 ships.
    *   **Public key limits:** only the public, send-only project key is
        embedded; the personal (read) key never appears in code. Because the
        project key is public, anyone could send fake events. Limits: the
        sender only sends the closed event list, each install stops at 200
        events per VS Code session, and the PostHog project stays on the free
        plan with no card, so overuse can never be billed.
    *   One schema in the code is the only source of the event list; a
        generated-and-tested `telemetry.json` publishes it, and the README
        "Privacy" section links to that file.
*   **G2 — No visible change for existing users.** With Diff off, 0.2.0 shows
    the same rows, order, labels, icons, and indentation as 0.1.0 (tag
    `v0.1.0`), and every 0.1.0 command keeps its ID and behavior. Allowed
    additions (closed list): the Diff button and its `toggleDiff` command, the
    ▾ compare button and its `compareWithCommit` command, the `ctrl+alt+l`
    keybinding, and the telemetry setting.
*   **G3 — Diff vs HEAD: findings fixed, package under 100 KB.** All ten
    review findings (ROADMAP section F) are fixed:

    | ID | Finding |
    |---|---|
    | F1 | Demo media included in the package |
    | F2 | Version not bumped |
    | F3 | Diff row marker shifts rows by 3px |
    | F4 | Stale refresh can overwrite a newer one |
    | F5 | Detail panel not refreshed after a new graph |
    | F6 | Unclear diff state, plus log spam |
    | F7 | Removed properties hidden |
    | F8 | Duplicate names overwrite each other |
    | F9 | A rename shows as two changes |
    | F10 | Slow lookups, stale comments, unused `removedInfo` |

*   **G3b — Compare with any past commit.** From the panel, the user picks one
    of the last 50 commits that touched the current file; the tree highlights
    what changed between that commit and the working copy, with the same
    added/changed markers and old → new values as Diff vs HEAD.
*   **G4 — Parser verified against Oracle's grammar.** The *sample corpus* is
    Oracle's APEX 26.1 sample, starter, and utility apps: 2,228 `.apx` files,
    stored outside the repo at `apex_podman/apex-apps` (the `sample-apps`
    folder alone is 1,263; corrected during the build). Tests that need it
    skip, not fail, when it is absent; the test's file-count floor is raised
    from 1,200 to 2,228. A file is *suspicious* when `assessParseQuality`
    flags its parse as likely wrong (unexpected characters or garbage type
    names).
    *   **G4a** — every `typeName` the parser produces on the sample corpus is
        a component keyword in Oracle's 26.1 or 26.2 grammar; the parser
        parses all 2,228 files without error; and the suspicious count stays
        at or below the baseline of 16 for the whole tree (11 of them in
        `sample-apps`; `test/corpus.test.js`). Reaching zero would need
        parser work this design does not plan.
    *   **G4b** — the parser handles each syntax form the grammar defines
        (strings with escapes, `//` and `/* */` comments, arrays, fenced
        ``` code, nested groups), each tested with a minimal example.
    *   **Parser fixes found by these tests (decided by author during the
        build, 2026-11-20):** names containing `$` (Interactive Grid columns
        such as `APEX$ROW_ACTION`; 0.1.0 showed a bogus `ROW_ACTION`
        component), `/* */` comments that start a line, and escapes in quoted
        names. Across the corpus, exactly 30 of 2,228 files parse differently
        from 0.1.0, all because of `$` names.
    *   **G4c** (only if a 26.2 export is obtained before release) — the same
        check on that export; otherwise noted as unverified in the CHANGELOG.
*   **G5 — README for users.** The Marketplace page explains what the extension
    does and how to use it, with the demo GIF, and states what telemetry
    collects. The README links the GIF by relative path; when packaging,
    `vsce` rewrites relative links to the GitHub repository in `package.json`,
    so `media/demo.gif` must be on GitHub `main` before the Marketplace upload
    (release checklist item).
*   **G6 (0.3.0, outline)** — Compare two arbitrary versions (branch vs
    branch, a pull-request branch fetched locally vs its base branch) at
    component level, and show changed pages in the App Map.
*   **G7 (0.3.0, outline)** — Warn about problems Oracle's validator does not
    report (broken static-file references, dangling `@references`, duplicate
    names where APEX requires unique ones; legitimate repeats such as
    `templateOptionGroup` are excluded), each check validated on the sample
    corpus before it ships.

## Non-Goals

*   **Editing features Oracle already ships:** autocomplete, syntax
    validation, formatting, import/export to the database. Duplicating them
    competes with a free first-party tool.
*   **Shipping the grammar inside the extension.** Each EBNF file is about
    1.9 MB; it is used in development and tests only.
*   **Rewriting the parser from the grammar.** The current parser is generic (it
    reads any block and property name), parses all 2,228 sample-corpus files
    without error, and the grammar is used to test it, not replace it. Small
    fixes the grammar tests expose are allowed (see G4).
*   **Telemetry about the user or their application:** no file names, paths,
    page or component names, `.apx` content, workspace names, git data, error
    message text, or personal identity.
*   **A full three-way merge tool.** 0.3.0 shows differences; it does not
    write merged files.
*   **Changes to the Graph (canvas) view in 0.2.0.** It ships in 0.1.0 and stays
    unchanged (no Diff highlighting there yet). Decided by author: telemetry
    counts how often it is opened, and 0.3.0 decides keep, upgrade, or drop
    by the rule in "Decision point for 0.3.0".

## Open Questions

*   **PostHog project key:** when will the US-cloud project key (`phc_…`) be
    shared? It is designed to be public in client code; the build can use a
    placeholder until then.
*   **26.2 sample:** can one app be exported from a 26.2 instance before
    release, so G4c can run?

## Technical Plan (Architecture)

### Current shape (0.1.0 + unreleased diff work)

The extension has no runtime dependencies and no build step. `src/extension.js`
(VS Code side) reads an `.apx` file, calls `src/parser.js` to turn it into a
graph (`{nodes, edges}`), and posts the graph to a webview. `media/graph.js`
(webview side) draws the Tree, By Type, and Graph views. The two sides talk
only through messages:

*   webview → extension: `ready`, `revealLine`, `switchFile`, `openAppMap`,
    `toggleDiff`, `openExternalPage`, `error`
*   extension → webview: `fileChanged`, `graph`, `appMap`

`parser.js` had not changed since 0.1.0 when this design was written. The
0.2.0 build adds three small fixes found by the grammar tests (see G4);
parse output is otherwise identical to 0.1.0.

Terms: a *panel session* runs from opening the APEXLang View panel to closing
it; a *VS Code session* is the lifetime of one VS Code window.

### 0.2.0 additions

```text
 VS Code side (src/)                                 Webview (media/graph.js)
 ┌──────────────────────────────┐                    ┌──────────────────────┐
 │ extension.js                 │ <── ready, revealLine, switchFile,       │
 │  commands (incl.             │     openAppMap, toggleDiff,              │
 │  compareWithCommit),         │     compareWithCommit, openExternalPage, │
 │  refresh(), diff             │     error, viewChanged, featureUsed      │
 │        │ track / trackError  │ ──> fileChanged, graph (+ diffStatus),   │
 │        v                     │     appMap                               │
 │ telemetry.js (new)           │                    └──────────────────────┘
 │  vscode.env.createTelemetryLogger(sender)
 │    - VS Code drops events if the user's telemetry is off
 │  posthog-sender.js (new)
 │    - checks apexlangView.telemetry.enabled on every send
 │    - property allowlist, 200-event cap
 │    - queue → HTTPS POST (Node https module)
 └──────────────┬───────────────┘
                v
        PostHog EU Cloud (free plan): dashboards for users, features, errors
```

**1. Telemetry (G1).**

*   `src/telemetry.js` owns one `TelemetryLogger` built with
    `vscode.env.createTelemetryLogger`, set so VS Code forwards unhandled
    errors from our extension code and adds none of its built-in common
    properties. It exposes `track(event, props)` and `trackError(where, err)`.
*   **Off switch:** the sender checks `apexlangView.telemetry.enabled` on every
    `sendEventData` / `sendErrorData` call (read live from configuration), so
    no event of any kind, including forwarded unhandled errors, leaves when it
    is off. `track()` and `trackError()` do not check it themselves. VS Code's
    own setting is enforced by the logger.
*   `src/posthog-sender.js` implements VS Code's `TelemetrySender`
    (`sendEventData`, `sendErrorData`, `flush`). It queues events and sends
    them in batches to PostHog's batch endpoint, including a final flush at
    deactivation. It uses Node's
    `https` module rather than global `fetch`, because VS Code applies the
    user's proxy settings (`http.proxy`) to `https` requests from extensions;
    users behind proxies VS Code cannot pass are not counted (known bias, see
    Risks). Errors are sent as PostHog `$exception` events so they appear in
    PostHog's Error tracking screen. Every event is marked as anonymous, so
    PostHog creates no person profile.
*   **Failure handling:** one attempt per batch with a short timeout, no
    retry; on failure the batch is dropped. Telemetry never shows an error to the
    user and never blocks the UI.
*   **Error capture paths:** (a) explicit `trackError` at our own catch sites;
    (b) the webview `error` message; (c) the logger's own forwarding of
    unhandled errors, which VS Code limits to our extension. The process-wide
    `uncaughtException` / `unhandledRejection` handlers keep logging to the
    output channel only and never send telemetry. The sender drops any
    exception with no stack frame from our files, and sends each distinct
    error (name + top own frame) at most once per VS Code session.
*   **Allowlist, defined once:** `src/telemetry-schema.js` holds the only
    copy of the closed list (event name → allowed properties and values, plus
    the `where` codes). The sender filters every payload against it, strips
    any `publisher.extension/` prefix from the event name, and drops
    everything else. A unit test asserts that `telemetry.json` matches the
    schema, and the README "Privacy" section links to `telemetry.json`
    instead of repeating the list.
*   Anonymous ID: a random UUID generated on first activation and stored in
    the extension's own storage; used as PostHog's `distinct_id`.
*   Event list (closed; anything else is a bug):

| Event | Properties | Sent when |
|---|---|---|
| `activated` | none of its own. Every event (this one included) carries the common properties `extVersion`, `vscodeVersion` (`vscode.version`), and `os` (`process.platform`), added by the sender | extension activates |
| `command` | `name`: openGraph, switchFile, openAppMap, toggleDiff, compareWithCommit, showLogs | a command runs (palette, button, or toolbar) |
| `viewChanged` | `view`: tree, byType, graph | the View toggle is clicked |
| `featureUsed` | `name`: search, jumpToSource, openExternalPage, breadcrumb | first use of that feature per panel session |
| `fileParsed` | `sizeBucket` (<10KB, <100KB, <1MB, >=1MB), `msBucket` (time in `parseApxToGraph` only: <50, <200, <1000, >=1000), `nodeBucket` (<50, <500, >=500), `suspicious` (bool) | first parse of a file per panel session — not on every keystroke |
| `$exception` | `name` (error name only, never the message); `where`: closed list (`refresh.parse`, `refresh.diff`, `git.show`, `git.log`, `appMap.scan`, `webview.render`, `unhandled`); stack frames from our own files as `file.js:line` (webview frames reduced from `vscode-webview://…/graph.js` to `graph.js:line`) | a `trackError` call, a webview `error` message (which gains a `name` field), or an unhandled error from our code |

*   Rate cap: at most 200 events per VS Code session; further events are
    dropped.
*   The PostHog EU host and public project key are constants in
    `src/telemetry.js`.

**2. Diff vs HEAD hardening (G3).** Fix F1–F10 from ROADMAP section F, inside
the existing files. The ones that change structure:

*   F4 (stale refresh): `refresh()` takes a sequence number at its start and
    posts only if it is still the latest.
*   F5 (detail panel not updating): when the detail panel is open, the
    `graph` message handler re-renders it for the selected node, or closes it
    if the node is gone. A panel the user closed stays closed.
*   F6 (diff state unclear): `getContentAtRef` returns a reason (`untracked`,
    `noRepo`, `notInCommit`) instead of `null`; the extension sends
    `diffStatus` with the `graph` message; the reason is logged once per file
    and ref. If VS Code's git extension is still starting, the extension
    waits for it once (up to 5 seconds) before the first read; it never waits
    for a repository to appear. User-visible states are only "Diff: not tracked",
    "Diff: no git", and "Diff: not in a1b2c3d".
*   F3 (3px shift): the diff row marker becomes an inset box-shadow, which
    takes no layout space, so rows render at their 0.1.0 position when Diff is
    off.

**2b. Compare with any past commit (G3b).**

*   The diff state in `extension.js` changes from a boolean
    (`diffAgainstHead`) to a ref: `null` (off), `'HEAD'`, or a commit hash.
    0.1.0 behavior is unchanged while it is `null`.
*   New command `apexlangView.compareWithCommit` ("Compare with Commit…"),
    also reachable from a small "▾" next to the Diff button. It lists the last
    50 commits that touched the current file (`repository.log({ path,
    maxEntries: 50 })`) in a QuickPick: short hash, date, first line of the
    message.
*   `getContentAtHead(uri)` becomes `getContentAtRef(uri, ref)`, using
    `repository.show(ref, path)`; the rest of the pipeline (`parseApxToGraph`,
    `diffGraphs`, the `graph` message) is unchanged.
*   **Base cache:** on each refresh, `HEAD` is resolved to a hash from
    `repository.state.HEAD.commit` (in memory, no git call). The base file
    text is cached under (commit hash, path); an entry keyed by a hash never
    goes stale, so there is no invalidation logic. Only one entry is kept
    (the current file), replaced on a miss, so typing does no git work after
    the first read. F4's sequence guard stays
    as a backup.
*   **Renames:** history does not follow renames (VS Code's git API `log` and
    `show` use the current path). Commits from before a rename are not listed,
    and a chosen commit where the file did not exist shows "Diff: not in
    a1b2c3d". Renamed-file history is a known limit.
*   The button reads "Diff: HEAD" or "Diff: a1b2c3d"; clicking it while on
    toggles diff off.
*   **File switch:** when the panel switches file, Diff vs HEAD stays on (as
    today); a specific chosen commit resets to HEAD, because that commit
    belongs to the previous file's history. The CHANGELOG states this.

**3. Grammar conformance (G4).** Tests only; nothing grammar-related ships.

*   A keyword list is generated once from `reference/apexlang-26.1.ebnf` and
    `apexlang-26.2.ebnf` (every component keyword: the first quoted string of
    each production listed under `<component>`) into a committed JSON file
    under `test/`.
*   G4a check: in `test/corpus.test.js`, every `typeName` the parser produces
    across the sample corpus is in that list, with 0 errors and at most 16
    suspicious files (the baseline for the whole tree).
*   G4b check: one minimal example per syntax form, parsed and asserted.
*   No per-keyword parse test: the parser does not look at keywords, so such a
    test could not fail.

**4. Unchanged-for-existing-users check (G2).** The real guard is a required
release step: open the same files side by side in 0.1.0 and 0.2.0 (Diff off)
in a clean profile and compare rows, order, labels, icons, and indentation.
A small automated test guards the one regression found so far (F3): it reads
the working-copy `graph.css` and asserts that `.tree-row` sets no
`border-left` and that the diff classes set only `box-shadow`. It needs no
git and no tag, so it keeps working after 0.3.0 changes the toolbar.
Indentation is set inline in `media/graph.js`, not in CSS, so only the manual
check covers it. No `jsdom` dependency (see Alternative N).

**5. Packaging and docs (G3, G5).** `.vscodeignore` excludes demo media,
`reference/`, `docs/`, and `ROADMAP.md`. New README section "Privacy"; new
`telemetry.json`; `package.json` gets version 0.2.0 and the
`apexlangView.telemetry.enabled` setting (tagged `telemetry`,
`usesOnlineServices`). The packaged size check (< 100 KB) runs before upload.
`media/demo.gif` is pushed to GitHub `main` before the Marketplace upload (G5).
The unwired `src/orphan-detector.js` is deleted (Alternative I).

### 0.3.0 outline (shape only; order set by the decision point)

*   **Compare two versions (G6):** extends the 0.2.0 commit picker to two
    arbitrary refs (branches and tags via `repository.getRefs`); both sides
    read with `repository.show(ref, path)` and compared with `diffGraphs`. The
    App Map gets per-page changed badges from the same comparison.
*   **Safety warnings (G7):** results go to VS Code's Problems panel through
    a `DiagnosticCollection` labeled "APEXLang View", so they sit next to, not
    on top of, Oracle's own diagnostics. Each check ships only after it shows
    zero false positives on the 2,228-file sample corpus.

#### Decision point for 0.3.0

Taken 6 weeks after 0.2.0 ships, or when 30 distinct weekly users are
reached, whichever is later (capped at 10 weeks). The numbers are the author's
starting proposal and can be changed before the decision.

1.  If `compareWithCommit` is used by ≥20% of weekly users, branch/PR compare
    (G6) goes first; otherwise safety warnings (G7) go first.
2.  If the Graph view accounts for <5% of `viewChanged` events, it is dropped
    in 0.3.0; at ≥15% it gains diff highlighting; otherwise it stays
    unchanged.
3.  Fallback if there are fewer than 30 weekly users by week 10: G6 then G7,
    Graph view unchanged.

## Alternatives Considered

### Alternative A: One release with everything (0.2.0 + 0.3.0 together)

*   **Pros**: One version bump, one upload, one announcement with visible new
    features.
*   **Cons**: Usage data starts only after the whole build (the author's
    estimate: about 5–7 working sessions instead of 1–2); 0.3.0 would be built
    without data; a bad safety warning would force rolling back everything.
*   **Reason for Rejection**: The first usage data would be delayed by the
    whole 0.3.0 build. (Decision recorded in [ROADMAP.md](../ROADMAP.md),
    section H.)

### Alternative B: Three releases (0.2.0, 0.3.0, 0.4.0)

*   **Pros**: Smallest change per release; easiest to tell which change broke
    something.
*   **Cons**: Most release overhead.
*   **Reason for Rejection**: Three version bumps, three packaging and
    clean-profile test passes, and three Marketplace uploads, for features that
    do not depend on each other's data. (Decision recorded in
    [ROADMAP.md](../ROADMAP.md), section H.)

### Alternative C: Azure Application Insights for telemetry

*   **Pros**: Microsoft's documented path for VS Code extensions
    (`@vscode/extension-telemetry`); large free data allowance.
*   **Cons**: Account needs a credit card; charts need queries written in the
    Azure portal; the library is the extension's first runtime dependency and
    would need a bundling step to keep the package small.
*   **Reason for Rejection**: Needs a credit card and written queries for
    every chart, against the criteria "free, no extra setup, no
    complication". (Decision recorded in [ROADMAP.md](../ROADMAP.md),
    section H.)

### Alternative D: Grafana Cloud for telemetry

*   **Pros**: The Grafana dashboards the author first asked about.
*   **Cons**: Its write keys are not meant to be embedded in public code, so a
    relay server between the extension and Grafana is required.
*   **Reason for Rejection**: Requires running a relay server. (Decision
    recorded in [ROADMAP.md](../ROADMAP.md), section H.)

### Alternative E: VS Code's `machineId` as the anonymous user ID

*   **Pros**: Already provided by VS Code; no storage needed.
*   **Cons**: The same value is visible to every extension on the machine, so
    it could link our data with other data sets.
*   **Reason for Rejection**: A random ID created by this extension is not
    shared with other extensions and not derived from machine or account data.
    (Decision recorded in [ROADMAP.md](../ROADMAP.md), section H.)

### Alternative F: Drop the Graph (canvas) view, or add Diff to it, in 0.2.0

*   **Pros**: Dropping removes the largest part of `graph.js`; adding Diff
    makes all three views consistent.
*   **Cons**: Dropping removes a view 0.1.0 users have (breaks G2); both are
    decided without usage data.
*   **Reason for Rejection**: Removes a view existing users have (breaks G2)
    without data on its use; the decision point for 0.3.0 settles it.
    (Decision recorded in [ROADMAP.md](../ROADMAP.md), section H.)

### Alternative G: Rewrite the parser from Oracle's grammar, or ship the grammar for live checks

*   **Pros**: Parser matches Oracle's definition by construction; live
    checks could flag unknown properties.
*   **Cons**: The current generic parser already parses all 2,228 sample-corpus
    files without error; a rewrite risks regressions for no user-visible gain;
    each grammar file is about 1.9 MB, roughly 50 times the current package;
    Oracle's own extension already validates properties.
*   **Reason for Rejection**: Regression risk with no user-visible gain, and a
    package about 50 times larger. (Decision recorded in
    [ROADMAP.md](../ROADMAP.md), section H.)

### Alternative H: Earlier diff ideas — separate extension, Changes panel, Changes-only filter, diff minimap

*   **Pros**: More ways to scan changes.
*   **Cons**: A separate extension means a second install with no shared
    context; the panel, filter, and minimap added three toolbar controls, and
    the minimap could not show individual changes at real file sizes.
*   **Reason for Rejection**: Three extra toolbar controls and a minimap that
    could not show changes at real file sizes (July 2026, after seeing them
    built); code removed in commit `6123abc`. (Decision recorded in
    [ROADMAP.md](../ROADMAP.md), sections E and H.)

### Alternative I: Unused-component ("orphan") detector based on `@identifier` references

*   **Pros**: Cheap to build on the existing reference resolver.
*   **Cons**: On the sample corpus most shared components are referenced by
    plain name, not `@identifier`, so it flagged mostly-used components as
    unused.
*   **Reason for Rejection**: Flagged mostly-used components as unused on the
    sample corpus (July 2026); `src/orphan-detector.js` is left unwired and is
    deleted in this work. (Decision recorded in [ROADMAP.md](../ROADMAP.md),
    sections E and H.)

### Alternative J: Timeline "Show component changes" action instead of a commit picker

*   **Pros**: Reuses VS Code's own commit list, the workflow in the
    thatjeffsmith post.
*   **Cons**: VS Code does not document what a git Timeline item passes to a
    contributed command, so the commit hash may not be reliably available; the
    built-in Timeline item shape can change between versions.
*   **Reason for Rejection**: Unverified dependency on undocumented data.
    0.2.0 ships the picker as the only entry point. Whether a Timeline item
    passes the commit hash is checked during the build and recorded in
    ROADMAP; if it does, a Timeline action is a 0.3.0 candidate (it would add
    a command to the G2 additions and the `command.name` list).

### Alternative K: Opt-in telemetry (off until the user turns it on)

*   **Pros**: Strongest consent model.
*   **Cons**: Almost no one opts in, so the data could not answer the three
    questions.
*   **Reason for Rejection**: Could not answer the three questions. The design
    follows VS Code's convention of obeying the user's global telemetry
    setting, plus an extra off switch.

### Alternative L: PostHog's Node client (`posthog-node`) instead of a custom sender

*   **Pros**: Maintained by PostHog; handles batching.
*   **Cons**: The extension's first runtime dependency, plus a bundling step;
    it would still need the allowlist.
*   **Reason for Rejection**: Adds a runtime dependency and a build step
    without removing any of our own code.

### Alternative M: Per-event rate limits instead of one 200-event cap

*   **Pros**: Finer control per event type.
*   **Cons**: More state to keep for a few hundred users.
*   **Reason for Rejection**: The single cap already protects the free quota.
    (Per-error dedupe in §1 is kept for a different reason: one crash in a
    loop should not use up the whole 200-event cap.)

### Alternative N: jsdom DOM comparison for G2

*   **Pros**: Compares the actual rendered tree.
*   **Cons**: jsdom does no layout, so it could not have caught F3 (a 3px
    shift); adds a dev dependency.
*   **Reason for Rejection**: Cannot detect the layout changes G2 is about;
    replaced by a manual side-by-side check plus a narrow CSS test for F3.

## Non-Functional Requirements

*   **Privacy:** see G1 requirements. Telemetry never blocks or slows the UI:
    sending is asynchronous, batched, and dropped on any network error.
*   **Package size:** under 100 KB (0.1.0 is 39 KB). No runtime dependencies
    are added.
*   **Compatibility:** `engines.vscode` stays `^1.85.0`; the VS Code 1.85 API
    provides `createTelemetryLogger`, and its Node 18 runtime provides the
    `https` module and `crypto.randomUUID`.
*   **Rollback:** see Risks & Mitigations, item 8.

## Risks & Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Fake events sent with the public project key | Closed event list; 200-event cap per session; free plan with no card, so overuse cannot be billed; event definitions reviewed in PostHog. Revoking the key is one-way: all installed copies stop sending until a new release. |
| 2 | Free quota (1M events/month) exhausted | Volume estimate ≈ 210,000/month (G1); 200-event cap; first-parse-only `fileParsed`. |
| 3 | Too little data to decide 0.3.0 | Decision rule with a 10-week cap and a fixed fallback order. |
| 4 | Reach of the data: only users who update to 0.2.0, have telemetry on, and can reach PostHog through VS Code's proxy settings are counted | Known bias, stated in the README; installs and uninstalls come from the Marketplace Reports page. |
| 5 | Git failures: no repo, untracked file, shallow clone, file absent at the chosen commit, detached HEAD, git still loading | Explicit states ("Diff: no git", "Diff: not tracked", "Diff: not in a1b2c3d"); wait up to 5 seconds for git to load; HEAD resolved to a hash. |
| 6 | Other extensions' errors reported as ours | Single capture path through the logger (limited to our extension); process-wide handlers never send; exceptions without an own-file frame dropped. |
| 7 | Visible regression for 0.1.0 users | Manual side-by-side check against 0.1.0 in a clean profile (the main guard, required before upload); a CSS test guards the F3 row shift. |
| 8 | 0.2.0 misbehaves after release | Tag `v0.1.0` and the kept VSIX at `tools/apexlang-view/apexlang-view-0.1.0.vsix`: rebuild from `v0.1.0` and publish it as 0.2.1. Telemetry can be cut without a release by revoking the key (see item 1). |
| 9 | Unnamed sibling components matched by position in the diff | Known limit: inserting an unnamed sibling can show later siblings as changed. |
| 10 | Renamed files lose history before the rename | Known limit, documented in the CHANGELOG. |

--------------------------------------------------------------------------------

## Additional Resources

*   [ROADMAP.md](../ROADMAP.md) — every request, decision (section H), and
    review finding (sections A–H).
*   Oracle APEXlang reference and grammar:
    [docs.oracle.com/en/database/oracle/apex/26.2/apxln/](https://docs.oracle.com/en/database/oracle/apex/26.2/apxln/)
*   VS Code telemetry guide:
    [code.visualstudio.com/api/extension-guides/telemetry](https://code.visualstudio.com/api/extension-guides/telemetry)
*   Alex on APEX, "Merging APEX Working Copies with APEXlang" (2026-07-24):
    [alexonapex.com](https://alexonapex.com/blog/2026/07/24/merging-apex-working-copies-with-apexlang/)
*   thatjeffsmith.com, "Vibe coding an Oracle APEX app via APEXlang, pt2:
    diffs" (2026-11):
    [thatjeffsmith.com](https://www.thatjeffsmith.com/archive/2026/11/vibe-coding-an-oracle-apex-app-via-apexlang-pt2-diffs/)
*   juanl, APEXlang and version control:
    [juanl.hashnode.dev](https://juanl.hashnode.dev/apexlang-oracle-apex-control-versiones)
*   SiliconANGLE, "Vibe coding meets governance" (2026-11-04):
    [siliconangle.com](https://siliconangle.com/2026/11/04/vibe-coding-meets-governance-apexlang-abstraction-oracleaiworld/)
*   Related tool — APEXREST, a Claude Code / Codex plugin that writes,
    previews, validates, and imports APEXlang from 389 Oracle 26.2 component
    definitions (Apache-2.0). It has no human review view, so it complements
    this extension:
    [github.com/apexrest-dev/apexrest](https://github.com/apexrest-dev/apexrest)

## Future Improvements

*   **Component catalog from Oracle's reference:** descriptions and allowed
    values per property, shown in the detail panel.

--------------------------------------------------------------------------------

## Detailed Implementation Plan (0.2.0)

All paths are relative to `tools/apexlang-view/`. Work happens on
`feature/git-diff`. Line numbers refer to the code at commit `cdcd1d8`.

### Build Phases

Each phase ends with `npm test` green and a commit. Items are listed below
by file; this is the order to build them in.

1.  **Clean-up and F-fixes:** items 8, 9 (deletions); 7 and 14 (F8, F9 in
    `diff.js` with tests); 6 (F3 CSS) and 13 (CSS test); the F5, F7, F10
    parts of item 5; the F10 and orphan parts of item 4; item 15
    (webview-ids test).
2.  **Diff ref and Compare with Commit:** the diff-state, F4, F6, base-cache,
    and Compare-with-Commit parts of items 4 and 5 together (they share the
    `graph` message shape), plus the new command in item 16.
3.  **Telemetry:** items 1, 2, 3, 17, 10, then the telemetry parts of items 4
    and 5, and the setting in item 16.
4.  **Grammar tests:** items 11 and 12.
5.  **Docs and packaging:** items 18, 19, 20, 21, 22, version bump in item 16,
    then `vsce package` and the Verification Plan.

### Target Files to Create/Modify

#### 1. `src/telemetry-schema.js` (Create)

*   **Type / Scope**: Data module, no `vscode` import. The only copy of the
    closed telemetry list (Technical Plan §1, "Allowlist, defined once").
*   **Proposed Changes**: Exports:
    *   `EVENTS`: event name → allowed property names, each with its allowed
        values or bucket list, exactly as the event table.
    *   `WHERE_CODES`: `refresh.parse`, `refresh.diff`, `git.show`,
        `git.log`, `appMap.scan`, `webview.render`, `unhandled`.
    *   `COMMON_KEYS`: `extVersion`, `vscodeVersion`, `os`. These are added
        to every event by the sender.
    *   `FREE_TEXT`: the check for values that have no fixed list
        (`extVersion`, `vscodeVersion`, `os`, error `name`): a string of at
        most 64 characters matching `^[\w.\-]+$`; anything else is replaced by
        `other`.

#### 2. `src/posthog-sender.js` (Create)

*   **Type / Scope**: Node module, no `vscode` import (unit-testable).
*   **Proposed Changes**: `createPostHogSender({ host, key, distinctId,
    common, ownRoot, isEnabled, log, request, now })` returns
    `{ sendEventData(name, data), sendErrorData(error, data), flush() }`.
    *   Inputs: `common` = `{ extVersion, vscodeVersion, os }`; `ownRoot` =
        the extension's install path (`context.extensionPath`), used to tell
        our stack frames apart; `log(line)` writes to the output channel;
        `request` defaults to a wrapper around Node's `https.request` (so VS
        Code's proxy settings apply), and tests pass a fake.
    *   **Off switch:** every `sendEventData` / `sendErrorData` call first
        calls `isEnabled()` (reads `apexlangView.telemetry.enabled` live) and
        returns if false.
    *   **Allowlist:** strip any `publisher.extension/` prefix from `name`;
        drop the event if the name is not in `EVENTS`; copy only the
        properties `EVENTS[name]` allows, with allowed values; add `common`
        (checked with `FREE_TEXT`). Everything else is dropped.
    *   **Errors:** `sendErrorData` builds a `$exception` event with only the
        error `name`, a `where` code (must be in `WHERE_CODES`, else
        `unhandled`), and stack frames whose path is under `ownRoot` (or a
        webview `vscode-webview://…/graph.js` URL), reduced to file basename
        and line. No message text. An exception with no own frame is
        dropped. Each distinct error (name + top own frame) is sent at most
        once per VS Code session (one sender instance).
    *   **Wire format** (`POST {host}/batch/`, JSON). To be checked against
        PostHog's capture API docs during phase 3; field names below are the
        documented ones as of 2026-11:

        ```json
        { "api_key": "phc_…",
          "batch": [
            { "event": "command",
              "timestamp": "2026-11-20T10:00:00.000Z",
              "properties": { "distinct_id": "<uuid>",
                "$process_person_profile": false,
                "extVersion": "0.2.0", "vscodeVersion": "1.96.0", "os": "win32",
                "name": "toggleDiff" } },
            { "event": "$exception",
              "timestamp": "2026-11-20T10:00:01.000Z",
              "properties": { "distinct_id": "<uuid>",
                "$process_person_profile": false,
                "extVersion": "0.2.0", "vscodeVersion": "1.96.0", "os": "win32",
                "where": "refresh.parse",
                "$exception_list": [ { "type": "TypeError", "value": "TypeError",
                  "stacktrace": { "type": "raw", "frames": [
                    { "filename": "parser.js", "lineno": 212, "in_app": true } ] } } ] } } ] }
        ```

        `value` is the error name, never the message.
    *   Queue flushes at 20 events, every 30 seconds (timer `unref()`'d), and
        on `flush()`; one attempt, 5-second timeout, failures dropped, never
        throws. `flush()` clears the timer and returns a promise.
    *   Hard cap of 200 events per VS Code session (one sender instance).
    *   **Logging:** one output-channel line per batch sent (`telemetry:
        sent N events`), and one line the first time an event is dropped for
        each cause (`dropped: setting off` / `dropped: cap reached` /
        `dropped: not allowed`).

#### 3. `src/telemetry.js` (Create)

*   **Type / Scope**: VS Code-side wrapper.
*   **Proposed Changes**:
    *   Constants `POSTHOG_HOST = 'https://eu.i.posthog.com'` (EU region,
        decided) and `POSTHOG_PROJECT_KEY` (public `phc_` key; a placeholder
        until shared).
    *   `initTelemetry(context, log)`: if the key is still the placeholder,
        create nothing. Otherwise create or read the anonymous UUID
        (`crypto.randomUUID()`) in `context.globalState` (key
        `apexlangView.anonId`); build the sender with `common`,
        `ownRoot = context.extensionPath`, `isEnabled` reading the setting,
        and `log`; wrap it with `vscode.env.createTelemetryLogger(sender, {
        ignoreUnhandledErrors: false, ignoreBuiltInCommonProperties: true })`;
        register the logger in `context.subscriptions`.
    *   `track(name, props)` and `trackError(where, err)`: no-op when no
        logger exists; neither checks the setting (the sender does).
    *   **First use per panel session:** `telemetry.js` is the only place
        that removes repeats for `featureUsed` (per name) and `fileParsed`
        (per file path, kept in memory only). Callers call `track` on every
        use. `resetPanelSession()` clears the sets.
    *   `flushTelemetry()` returns the sender's flush promise (best effort
        within VS Code's deactivate window).

#### 4. `src/extension.js` (Modify)

*   **Type / Scope**: Extension entry point.
*   **Proposed Changes**:
    *   **Telemetry wiring:** call `initTelemetry(context, logLine)` in
        `activate`, then `track('activated')`. `deactivate` returns
        `flushTelemetry()`. `createPanelAndShow` calls `resetPanelSession()`.
    *   **Commands:** `track('command', { name })` is called once, at the top
        of each `xxxCommand()` function (`openGraph`, `switchFile`,
        `openAppMap`, `toggleDiff`, `compareWithCommit`, `showLogs`); both
        the registered command and the webview message call that function,
        so each user action counts once.
    *   **Errors:** `trackError` only at our own catch sites, each with its
        `where` code (`refresh.parse`, `refresh.diff`, `git.show` for
        unexpected git failures only, `git.log`, `appMap.scan`). `logError`
        does **not** call `trackError`, and the process-wide
        `uncaughtException` / `unhandledRejection` handlers
        (lines 124-131) stay output-channel only. The webview `error` message
        calls `trackError('webview.render', …)` with the posted `name` and
        stack.
    *   **New webview messages** in `onDidReceiveMessage` (lines 377-410):
        `{type:'viewChanged', view}` → `track('viewChanged', { view })`;
        `{type:'featureUsed', name}` → `track('featureUsed', { name })`;
        `{type:'compareWithCommit'}` → `compareWithCommitCommand()`. Remove
        the unused `log` branch (lines 407-409).
    *   **`fileParsed`:** `refresh()` times `parseApxToGraph` only and calls
        `track('fileParsed', …)` with size/ms/node buckets and `suspicious`
        on every parse; `telemetry.js` keeps the first per file per panel
        session.
    *   **Diff state:** replace `diffAgainstHead` (line 51) with `diffRef`
        (`null` | `'HEAD'` | full commit hash). `toggleDiffCommand`: any
        non-null value → `null`; `null` → `'HEAD'`. In `switchTo`, a commit
        hash resets to `'HEAD'`; `'HEAD'` and `null` stay. `diffRef` survives
        panel close (as `diffAgainstHead` does today). Log text at lines 267,
        493, 499 uses the ref ("Diff vs HEAD" / "Diff vs a1b2c3d").
    *   **`compareWithCommitCommand`:** if there is no current file, show the
        same warning as `openGraph`. Get the repository; if none, show an
        info message "Not in a git repository". Run `repository.log({ path,
        maxEntries: 50 })`; on throw, `trackError('git.log', err)` and an
        info message; if 0 commits, info "No commits for this file". Show a
        QuickPick: 7-character hash, date as `YYYY-MM-DD`, first message
        line. Cancel leaves `diffRef` unchanged. On pick, set `diffRef` to
        the full hash and `await refresh(currentUri)`.
    *   **F6 — `getContentAtRef(uri, ref)`** (renamed from
        `getContentAtHead`, line 65; extends `getGitApi()`, lines 55-60):
        *   Git API wait: the first time, if the API `state` is not
            `'initialized'`, wait for `onDidChangeState` up to 5 seconds.
            Only once per VS Code session; never wait for a repository.
        *   No API or no repository for the file → `{ reason: 'noRepo' }`.
        *   Resolve `'HEAD'` to `repository.state.HEAD?.commit`; if there is
            no HEAD commit (empty repo) → `{ reason: 'notInCommit' }`.
        *   Base cache: one variable `{ hash, path, text }`; if hash and path
            match, return its text; otherwise call
            `repository.show(hash, path)` with the resolved hash and replace
            the variable.
        *   `show` fails and the ref was `'HEAD'` → `{ reason: 'untracked' }`
            (covers new and staged-but-uncommitted files); `show` fails with
            a chosen hash → `{ reason: 'notInCommit' }`. This mapping applies
            to every `show` failure so the button label stays useful; a
            failure that is not git's "path does not exist / not in" wording
            is also logged in full and sent as `trackError('git.show')`
            (changed during the build, phase 2).
        *   Log the reason once per file and ref.
    *   **`graph` message** (line 503): remove `diffAgainstHead`; add
        `diffStatus: { ref: null | 'HEAD' | fullHash, reason?: 'untracked' |
        'noRepo' | 'notInCommit' }`.
    *   **F4:** module-level `refreshSeq`; each `refresh()` captures its number
        and skips `postMessage` if a newer refresh started.
    *   **F10:** move the App Map doc comment (lines 261-264) back above
        `openAppMapCommand`; strip `removedInfo` from the diff before
        `postMessage`.
    *   Remove the `orphan-detector` import and `findUnusedComponentsCommand`
        (line 314).
    *   Register the `compareWithCommit` command.
    *   `getWebviewHtml` adds a "▾" button next to Diff (`id="diff-pick"`,
        title "Compare with commit…").

#### 5. `media/graph.js` (Modify)

*   **Type / Scope**: Webview script.
*   **Proposed Changes**:
    *   **Telemetry messages:** the View toggle posts
        `{type:'viewChanged', view}`. `featureUsed` is posted at each call
        site, every time (the extension removes repeats):
        *   search box input → `search`;
        *   tree row click or arrow-key move that calls `selectAndReveal`
            with `jumpToSource` → `jumpToSource`;
        *   breadcrumb click (line 935) → `breadcrumb`;
        *   external-page open → `openExternalPage`.

        A breadcrumb click counts only as `breadcrumb`; reference clicks
        (line 967) count as `jumpToSource`.
    *   The `error` message (lines 7-20) also posts `name`.
    *   **Diff label** from `diffStatus` (replacing `msg.diffAgainstHead`,
        line 146):
        *   `ref: null` → "Diff: Off";
        *   `ref: 'HEAD'` and no reason → "Diff: HEAD";
        *   a hash and no reason → "Diff: a1b2c3d" (first 7 characters);
        *   reason `untracked` → "Diff: not tracked";
        *   reason `noRepo` → "Diff: no git";
        *   reason `notInCommit` → "Diff: not in a1b2c3d", or "Diff: not in
            HEAD" when the ref is `'HEAD'`.

        The node-count text (line 149) uses the same ref label instead of
        the hard-coded "vs HEAD". The "▾" button posts
        `{type:'compareWithCommit'}`.
    *   **F5:** after a `graph` message, if the detail panel is not hidden,
        re-render it for `selectedNodeId`, or hide it if that node no longer
        exists. A closed panel stays closed.
    *   **F7:** `renderPropsGrid` (line 846) also lists keys present only in
        `propChanges[node.id]` (removed properties); reuse `diffValueEl`,
        which already renders `undefined` as "(none)".
    *   **F9 follow-up:** remove the now-dead `labelChange` branch in
        `renderPropsGrid` (lines 851-864).
    *   **F10:** build `addedSet` / `changedSet` once per `graph` message; row
        rendering uses `Set.has` instead of `.includes` (lines 720-721).
    *   Update the stale "tree-row diff borders" comment (lines 891-893).

#### 6. `media/graph.css` (Modify)

*   **Type / Scope**: Webview styles.
*   **Proposed Changes**: F3: remove `border-left: 3px solid transparent`
    from `.tree-row` (line 194). `.tree-row.diff-added` uses
    `box-shadow: inset 3px 0 0
    var(--vscode-gitDecoration-addedResourceForeground, #81b88b)` and
    `.tree-row.diff-changed` uses the same with
    `--vscode-gitDecoration-modifiedResourceForeground, #e2c08d` (lines
    534-540). Update the "Left border only" comment (lines 529-533).
    `#diff-pick` already gets toolbar styling from `#toolbar button`
    (lines 28-40); add only a narrow width/padding override.

#### 7. `src/diff.js` (Modify)

*   **Type / Scope**: Pure diff module.
*   **Proposed Changes**:
    *   **F8:** in `buildPathIndex`, both the child loop (lines 56-59) and
        the root loop (lines 66-69) stop overwriting duplicates. The first
        occurrence of a `typeName:identifier` key keeps the bare key; the
        2nd and later get `#2`, `#3`, … Reuse `nextSiblingIndex`
        (lines 40-44) for the counter.
    *   **F9:** the label is always derived from `props.name`, the
        identifier, or the type (`parser.js:256`), so a label change always
        comes with a `name` or key change. Drop `_label` from
        `computePropChanges` (lines 96-98) and from the comparison in
        `propsEqual` (line 84).
    *   Rewrite the stale sentence at lines 5-8 ("The caller (a future
        extension.js wiring, not yet built) …").

#### 8. `src/orphan-detector.js`, `test/orphan-detector.test.js`, `fixtures/orphan-app/` (Delete)

*   **Type / Scope**: Dead code (Alternative I).
*   **Proposed Changes**: Delete. `fixtures/orphan-app/` is used only by
    `test/orphan-detector.test.js` (6 tests removed).

#### 9. `media/demo.mp4` (Delete)

*   **Type / Scope**: Unused media (F1).
*   **Proposed Changes**: `git rm`. Not referenced anywhere; `demo.gif` stays
    in the repo for the README.

#### 10. `test/telemetry.test.js` (Create)

*   **Type / Scope**: Unit tests for `posthog-sender.js` and the schema, with
    a fake `request` and fake `log`.
*   **Proposed Changes**:
    *   Unknown event names dropped; `publisher.extension/` prefix stripped.
    *   Unknown property keys and disallowed values dropped; `common.*` keys
        never sent; free-text values outside `FREE_TEXT` become `other`.
    *   `isEnabled() === false` → nothing sent for events or errors, and the
        log shows "dropped: setting off".
    *   Error payload: no message text anywhere; `value` equals the name;
        `where` outside the list becomes `unhandled`; only frames under
        `ownRoot` kept, as basename + line; exception without own frames
        dropped; the same error sent once.
    *   Payload shape matches the wire-format example (item 2).
    *   Batch flush at 20 and on `flush()`; cap at 200; network failure does
        not throw.
    *   `telemetry.json` lists exactly the events and properties in
        `telemetry-schema.js`.

#### 11. `test/grammar-keywords.json` (Create) and `test/corpus.test.js` (Modify)

*   **Type / Scope**: Test data + corpus test (G4a).
*   **Proposed Changes**:
    *   The keyword list is generated once by a short one-off script (run by
        hand, not kept) from `reference/apexlang-26.1.ebnf` and
        `-26.2.ebnf`: every component keyword, i.e. the first quoted string
        of each production listed under `<component>`.
    *   `corpus.test.js`: point the root at `apex-apps` (not `sample-apps`);
        raise `minFiles` from 1,200 to 2,228; keep `maxErrors: 0`; set
        `maxSuspicious: 16` (the whole tree); replace the local copy of the
        quality check (lines 39-73) with the exported `assessParseQuality`
        from `src/parser.js`.
    *   G4a check: for every file **not** flagged suspicious, every produced
        `typeName` is in `grammar-keywords.json` (suspicious files have
        garbage type names by definition and are covered by the baseline).
    *   Skips when the corpus is absent (existing rule).

#### 12. `test/parser-syntax.test.js` (Create)

*   **Type / Scope**: Parser unit tests (G4b).
*   **Proposed Changes**: One minimal example each for strings with escapes,
    `//` and `/* */` comments, arrays, fenced ``` code, and nested groups;
    asserts the parsed nodes and properties.

#### 13. `test/css-parity.test.js` (Create)

*   **Type / Scope**: Regression test for F3 (G2's automated part).
*   **Proposed Changes**: Reads the working-copy `media/graph.css` as text
    and asserts that the `.tree-row` rule has no `border-left`, and that the
    `.tree-row.diff-added` / `.tree-row.diff-changed` rules set only
    `box-shadow`. No git, no tag, no `jsdom`.

#### 14. `test/diff.test.js` (Modify)

*   **Type / Scope**: Unit tests.
*   **Proposed Changes**: Cases for F8 (two same-named child siblings, edit
    the first → only it flagged; same for two same-named root blocks) and
    F9 (rename via `name:` → one change, not two).

#### 15. `test/webview-ids.test.js` (Create)

*   **Type / Scope**: Static check.
*   **Proposed Changes**: Every `getElementById('…')` in `media/graph.js`
    has a matching `id="…"` in `getWebviewHtml` in `src/extension.js` (the
    check that would have caught the July break; all ids match today).

#### 16. `package.json` (Modify)

*   **Type / Scope**: Manifest.
*   **Proposed Changes**: `version` 0.2.0 (phase 5); command
    `apexlangView.compareWithCommit` ("APEXLang View: Compare with
    Commit…", phase 2); `contributes.configuration` with
    `apexlangView.telemetry.enabled` (boolean, default true, tags
    `telemetry`, `usesOnlineServices`, description linking to
    `telemetry.json`; phase 3). No new dependencies of any kind.

#### 17. `telemetry.json` (Create)

*   **Type / Scope**: VS Code transparency file.
*   **Proposed Changes**: Lists each event and property from
    `telemetry-schema.js`, including the common properties, with purpose
    and classification (usage / error). Kept in sync by the test in item 10.

#### 18. `.vscodeignore` (Modify)

*   **Type / Scope**: Packaging.
*   **Proposed Changes**: Add `media/demo.gif`, `reference/**`, `docs/**`,
    `node_modules/**`. `ROADMAP.md`, `test/**`, and `fixtures/**` are
    already excluded; `demo.mp4` is deleted in item 9.

#### 19. `README.md` (Modify)

*   **Type / Scope**: Marketplace page.
*   **Proposed Changes**: Add "Compare with Commit…" to Features and the
    Commands table; change "1200+" (line 44) to 2,228 files; add a "Privacy"
    section: what kind of data is sent, what never is, how to turn it off
    (VS Code telemetry setting or `apexlangView.telemetry.enabled`), a link
    to `telemetry.json` for the full list, and the known bias (users whose
    network VS Code cannot pass through are not counted).

#### 20. `CHANGELOG.md` (Modify)

*   **Type / Scope**: Release notes.
*   **Proposed Changes**: 0.2.0 entries for anonymous telemetry, Compare with
    Commit, the fixes users can see (F5, F6, F7, F8, F9), and removal of the
    unused orphan-detector code. Known limits: renamed-file history before
    the rename; a chosen commit resets to HEAD on file switch; unnamed
    siblings matched by position; 26.2 unverified unless G4c ran.

#### 21. `TESTING-CHECKLIST.md` (Modify)

*   **Type / Scope**: Manual test script.
*   **Proposed Changes**: Add: Diff-off side-by-side parity with 0.1.0 in a
    clean profile (rows, order, labels, icons, indentation); Compare with
    Commit (including "Diff: not in a1b2c3d", cancel, and file switch);
    telemetry off (VS Code setting, then our setting) → output channel shows
    "dropped: setting off" and no "sent" lines; telemetry on → "sent N
    events" lines and events in PostHog Live events.

#### 22. `ROADMAP.md` (Modify)

*   **Type / Scope**: Tracking.
*   **Proposed Changes**: Mark items done as each phase lands; record the
    Timeline check result (Alternative J). The final design is this file,
    `docs/DESIGN-v0.2-v0.3.md`.

### Verification Plan

*   **Compilation/Build**: none (plain JavaScript); `node --check` on every
    changed `.js` file.
*   **Unit Tests**: `npm test`. Today 64 tests; minus 6 orphan-detector
    tests leaves 58 existing tests, all passing (the corpus test skips on
    machines without the corpus), plus the new tests from items 10-15.
*   **Package**: `npx @vscode/vsce package`; size < 100 KB; `vsce ls` shows no
    `demo.*`, `reference/`, `docs/`, `test/`, or `fixtures/`.
*   **E2E/Integration**:
    *   Browser harness: the real webview HTML from `getWebviewHtml` with
        CSP and nonces stripped, the real `graph.js` / `graph.css`, a mocked
        `acquireVsCodeApi` that records posted messages, and real
        `diffGraphs` payloads, served by a small local Node HTTP server
        (rebuilt in a temp folder and deleted afterwards).
    *   The author's manual run of `TESTING-CHECKLIST.md` in the Extension
        Development Host.
    *   Install the packaged `.vsix` in a clean VS Code profile, do the
        side-by-side check with 0.1.0, and confirm events arrive in PostHog
        Live events and none arrive with either telemetry setting off.
*   **Before the Marketplace upload**: turn on PostHog's discard-IP setting
    (G1) and push `media/demo.gif` to GitHub `main` (G5).

--------------------------------------------------------------------------------

*Drafted with EGM*
