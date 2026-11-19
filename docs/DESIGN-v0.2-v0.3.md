# APEXLang View v0.2.0 – v0.3.0

*   **Author:** sawalhah (Mohammad Sawalhah)
*   **Status:** Approved by author (pending /egm:egm-review)
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
    branch, pull request), changed-page badges in the App Map, and warnings
    for problems Oracle's own validator does not report. Released together as
    one bundle. Specified at outline level.

Comparing with any past commit moved from 0.3.0 into 0.2.0 by author, after
Oracle's SQL Developer product manager showed reviewing AI-agent commits one
by one as plain text diffs (see The Problem, item 3).

0.3.0 stays at outline level on purpose: which of its parts come first, and
how far each goes, is decided from 0.2.0 telemetry data, which does not exist
yet. Rejected by author: releasing everything at once delays the first usage
data by the whole build time; releasing three times adds release overhead the
author does not want.

## The Problem

Four problems, in priority order.

**1. We cannot see how the extension is used or when it breaks.** The only
data is the Marketplace install count. We do not know how many of the 232
installs still use the extension, which features they use, or whether it
crashes on their files. A parse failure on a real customer file is invisible
unless someone files a GitHub issue, and nobody has. Every product decision so
far has been a guess.

**2. Finished work is not reaching users.** Diff vs HEAD, a keyboard shortcut,
and a rewritten README with a demo GIF have been built since July but never
released. The released README tells Marketplace users to "open this folder and
press F5", which are instructions for the extension's developer, not its users.
A code review of the unreleased work (ROADMAP section F) found ten problems,
two of which block release: the demo media would grow the package from 39 KB
to about 16.5 MB, and the version number was never raised.

**3. Reviewing APEX changes is still manual.** APEXlang made APEX applications
readable as text, but community writing since July (Alex on APEX, 2026-07-24;
juanl.hashnode.dev) shows the remaining pain: comparing two versions of an app
reports only that "page 1 differs", not which region, button, or dynamic action
changed; reference and naming conflicts are checked by reading the source; a
clean text merge does not guarantee a valid application. This matters more now
that Oracle publishes the APEXlang grammar so AI agents (Claude, Codex) can
write APEX applications (SiliconANGLE, 2026-11-04) — more changes will be made
by tools, and people need to see what those tools changed. Oracle's own
product manager for SQL Developer shows this workflow (thatjeffsmith.com,
"Vibe coding an Oracle APEX app via APEXlang, pt2: diffs", 2026-11): an AI
agent edits and commits APEXlang, and he reviews each commit through VS Code's
Timeline and plain line-by-line file diffs. There is no component-level view
of what the agent changed (which region, which query, which tooltip) — the
reviewer reads raw text. Agent tooling is growing on the writing side:
APEXREST (github.com/apexrest-dev/apexrest, Apache-2.0) is a Claude Code /
Codex plugin that writes APEXlang from 389 Oracle 26.2 component definitions,
previews, validates, and imports it. It has no human review view, which makes
it a complement to this extension, not a competitor.

**4. v1 was built without an official language definition.** The parser was
hand-written from sample exports because Oracle had not published a grammar.
Oracle now publishes an APEXlang reference with a downloadable EBNF grammar for
26.1 and 26.2. We have no test that checks our parser against it, and 26.2
added 163 keywords we have not verified.

**What we are not solving:** editing assistance. Oracle's SQL Developer for VS
Code (26.3.1) already provides completion, validation, formatting, and
import/export for `.apx` files. It does not provide an outline tree,
component navigation, or a git-based component-level diff — that is the space
this extension occupies.

## Goals

*   **G1 — Anonymous usage and error data.** 0.2.0 reports, without personal
    data, file paths, or file contents: extension activations (with extension
    version, VS Code version, OS), counts of each command and view used, parse
    time and file size in coarse buckets, and errors with their type and our own
    stack frames. Nothing is sent when VS Code's telemetry is turned off.
    Data goes to **PostHog Cloud (free plan)**, whose built-in screens answer
    the three questions the author asked: how many people actively use the
    extension, which errors they hit, and which views and features they use
    most. Chosen by author against the criteria "always free, no extra setup,
    no complication": PostHog's free plan does not expire and needs no credit
    card, and its dashboards need no query writing. Rejected by author: Azure
    Application Insights (needs a credit card to open the account, charts
    need queries in the Azure portal, and the official library adds package
    weight); Grafana Cloud (its write keys are not meant to be embedded in
    public code, so it needs a relay server the author would have to run).
    Privacy and security requirements for G1:
    *   Events go through VS Code's built-in `TelemetryLogger`
        (`vscode.env.createTelemetryLogger`), which enforces the user's VS Code
        telemetry setting and removes potentially sensitive data; our code only
        supplies a small sender that posts to PostHog. No third-party
        telemetry library.
    *   User identity is a random ID generated by the extension on first run
        and stored in its own storage — not VS Code's `machineId`, not any
        account or computer name.
    *   PostHog project setting to discard IP addresses / location is turned on
        before 0.2.0 ships.
    *   Only the public, send-only project key is embedded; the personal
        (read) key never appears in code. Events whose name is not on the
        published list are ignored in the dashboard.
    *   A `telemetry.json` file and a README "Privacy" section list every event
        and property.
*   **G2 — No visible change for existing users.** With Diff off, 0.2.0 renders
    every `.apx` file in the test corpus identically to 0.1.0 (tag `v0.1.0`),
    and every 0.1.0 command keeps its ID and behavior.
*   **G3 — Diff vs HEAD ships correct.** All ten review findings (F1–F10) are
    fixed, and the package is under 100 KB.
*   **G3b — Compare with any past commit.** From the panel, the user picks one
    of the last 50 commits that touched the current file; the tree highlights
    what changed between that commit and the working copy, with the same
    added/changed markers and old → new values as Diff vs HEAD.
*   **G4 — Parser verified against Oracle's grammar.** A test checks that every
    component and property keyword in the 26.1 and 26.2 grammars is parsed
    without error, and the full sample corpus (2,228 files) parses with zero
    hard errors on 26.1 and 26.2 exports.
*   **G5 — README for users.** The Marketplace page explains what the extension
    does and how to use it, with the demo GIF, and states what telemetry
    collects.
*   **G6 (0.3.0, outline)** — Compare two arbitrary versions (branch vs
    branch, pull request) at component level, and show changed pages in the
    App Map.
*   **G7 (0.3.0, outline)** — Warn about problems Oracle's validator does not
    report (broken static-file references, dangling `@references`, duplicate
    names), each check validated on the real corpus before it ships.

## Non-Goals

*   **Editing features Oracle already ships:** autocomplete, syntax
    validation, formatting, import/export to the database. Duplicating them
    competes with a free first-party tool.
*   **Shipping the grammar inside the extension.** Each EBNF file is about
    1.9 MB; it is used in development and tests only.
*   **Rewriting the parser from the grammar.** The current parser is generic (it
    reads any block and property name), handles the 2,228-file corpus, and the
    grammar is used to test it, not replace it.
*   **Telemetry about the user or their application:** no file names, paths,
    page or component names, `.apx` content, workspace names, git data, or
    user identity.
*   **A full three-way merge tool.** 0.3.0 shows differences; it does not
    write merged files.
*   **Changes to the Graph (canvas) view in 0.2.0.** It ships in 0.1.0 and stays
    unchanged (no Diff highlighting there yet). Decided by author: telemetry
    counts how often it is opened, and 0.3.0 decides keep, upgrade, or drop
    from that data.

## Open Questions

*   **PostHog account:** Mohammad signs up for PostHog Cloud (free plan, no
    card) and shares the project key, which is designed to be public in client
    code. Region (US or EU) chosen at sign-up.
*   **Reach of the data:** only users who update to 0.2.0 and have VS Code
    telemetry on are counted; installs and uninstalls come from the Marketplace
    Reports page instead.
*   **Depth of 0.3.0:** kept at outline level until 0.2.0 telemetry has run for
    a period to be decided.
*   **26.2 corpus:** no real 26.2 export is available locally; Goal G4's 26.2
    half needs one app exported from a 26.2 instance.

## Technical Plan (Architecture)

### Current shape (0.1.0 + unreleased diff work)

The extension has no runtime dependencies and no build step. `src/extension.js`
(VS Code side) reads an `.apx` file, calls `src/parser.js` to turn it into a
graph (`{nodes, edges}`), and posts the graph to a webview. `media/graph.js`
(webview side) draws the Tree, By Type, and Graph views. The two sides talk
only through messages:

*   webview → extension: `ready`, `revealLine`, `switchFile`, `openAppMap`,
    `toggleDiff`, `openExternalPage`, `error`, `log`
*   extension → webview: `fileChanged`, `graph`, `appMap`

`parser.js` has not changed since 0.1.0 (`git diff v0.1.0..HEAD` shows no
change to it), so parse output for any file is identical to 0.1.0.

### 0.2.0 additions

```text
 VS Code side (src/)                                Webview (media/graph.js)
 ┌─────────────────────────────┐   messages         ┌──────────────────────┐
 │ extension.js                │ <───────────────── │ ready, revealLine,   │
 │  commands, refresh(), diff  │   + viewChanged    │ ... + viewChanged,   │
 │        │  track(...)         │   + featureUsed    │   featureUsed (new)  │
 │        v                     │                    │ error (existing)     │
 │ telemetry.js (new)           │                    └──────────────────────┘
 │  vscode.env.createTelemetryLogger(sender)
 │    - VS Code drops events if the user's telemetry is off
 │    - VS Code strips potentially sensitive values
 │  posthog-sender.js (new): queue → HTTPS POST (global fetch, Node 18+)
 └──────────────┬──────────────┘
                v
        PostHog Cloud (free plan): dashboards for users, features, errors
```

**1. Telemetry (G1).**

*   `src/telemetry.js` owns one `TelemetryLogger`, created with
    `vscode.env.createTelemetryLogger(sender, { ignoreUnhandledErrors: false })`
    so VS Code also forwards unhandled errors thrown from our extension code.
    It exposes `track(event, props)` and `trackError(where, err)`. Every call
    first checks our own setting `apexlangView.telemetry.enabled`; VS Code's
    own setting is enforced by the logger itself.
*   `src/posthog-sender.js` implements VS Code's `TelemetrySender`
    (`sendEventData`, `sendErrorData`, `flush`). It queues events and sends
    them in one HTTPS POST to PostHog's batch endpoint every 30 seconds, when
    20 events are queued, and on `flush()` at deactivation. Errors are sent as
    PostHog `$exception` events so they appear in PostHog's Error tracking
    screen. Every event sets `$process_person_profile: false` (anonymous
    event, no person profile). Network failures are dropped silently after one
    5-second timeout; telemetry never shows an error to the user and never
    blocks the UI.
*   Anonymous ID: a random UUID generated on first activation and stored in
    `context.globalState`; used as PostHog's `distinct_id`.
*   Event list (closed; anything else is a bug):

| Event | Properties | Sent when |
|---|---|---|
| `activated` | — (VS Code adds extension version, VS Code version, OS) | extension activates |
| `command` | `name`: openGraph, switchFile, openAppMap, toggleDiff, showLogs | a command runs (palette, button, or toolbar) |
| `viewChanged` | `view`: tree, byType, graph | the View toggle is clicked |
| `featureUsed` | `name`: search, jumpToSource, openExternalPage, breadcrumb | first use of that feature per panel session |
| `fileParsed` | `sizeBucket` (<10KB, <100KB, <1MB, ≥1MB), `msBucket` (<50, <200, <1000, ≥1000), `nodeBucket` (<50, <500, ≥500), `suspicious` (bool) | first parse of a file per panel session — not on every keystroke |
| `$exception` | `where`: extension or webview; error name; stack frames from our own files only, reduced to file basename + line | `logError`, webview `error` message, or an unhandled error |

*   Rate cap: at most 200 events per VS Code session; further events are
    dropped.
*   Configuration constants (PostHog host for the chosen region, public
    project key) live in `src/telemetry-config.js`.

**2. Diff vs HEAD hardening (G3).** Fix F1–F10 from ROADMAP section F, inside
the existing files. The architectural ones:

*   F4 (stale refresh): `refresh()` takes a sequence number at its start and
    posts only if it is still the latest.
*   F5 (detail panel not updating): the `graph` message handler re-renders the
    open detail panel for the selected node, or closes it if the node is gone.
*   F6 (diff state unclear): `getContentAtHead` returns a reason (`untracked`,
    `noRepo`, `gitNotReady`) instead of `null`; the extension sends
    `diffStatus` with the `graph` message; the button shows "Diff: not
    tracked" / "Diff: no git"; the reason is logged once per file.
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
*   The button reads "Diff: HEAD" or "Diff: a1b2c3d"; clicking it while on
    toggles diff off. The chosen ref resets to off when the panel switches
    file.
*   Telemetry: `command` event gains `compareWithCommit`.

**3. Grammar conformance (G4).** Tests only; nothing grammar-related ships.

*   `test/grammar-catalog.js` (test helper) reads
    `reference/apexlang-26.x.ebnf`, collects every component keyword (the
    first quoted string of each production listed under `<component>`) and
    every property keyword.
*   Test A — every grammar component keyword, written as a minimal block
    (`<keyword> x (\n)`), parses into a node with that `typeName`.
*   Test B — every `typeName` the parser produces across the real corpus is a
    keyword in the 26.1 or 26.2 grammar. A name outside the grammar means the
    parser misread a file.
*   Test C — the 26.2 grammar's new keywords (163) parse as property names
    inside a block.

**4. Unchanged-for-existing-users check (G2).** A test renders the same parsed
corpus files with the 0.1.0 webview (`graph.js` and `graph.css` read from tag
`v0.1.0` via `git show`) and the 0.2.0 webview (Diff off) in a DOM emulator
(`jsdom`, dev-only dependency, not shipped) and compares the visible tree:
row order, labels, classes, and indentation. The only allowed difference is
the new Diff button in the toolbar.

**5. Packaging and docs (G3, G5).** `.vscodeignore` excludes demo media,
`reference/`, `docs/`, `design_draft.md`, and `ROADMAP.md`. New README section
"Privacy"; new `telemetry.json`; `package.json` gets version 0.2.0 and the
`apexlangView.telemetry.enabled` setting (tagged `telemetry`,
`usesOnlineServices`). The packaged size check (< 100 KB) runs before upload.

### 0.3.0 outline (shape only; detail after 0.2.0 data)

*   **Compare two versions (G6):** extends the 0.2.0 commit picker to two
    arbitrary refs (branches and tags via `repository.getRefs`); both sides
    read with `repository.show(ref, path)` and compared with `diffGraphs`. The
    App Map gets per-page changed badges from the same comparison.
*   **Safety warnings (G7):** results go to VS Code's Problems panel through
    a `DiagnosticCollection` labeled "APEXLang View", so they sit next to, not
    on top of, Oracle's own diagnostics. Each check ships only after it shows
    zero false positives on the 2,228-file corpus.

## Alternatives Considered

### Alternative A: One release with everything (0.2.0 + 0.3.0 together)

*   **Pros**: One version bump, one upload, one announcement with visible new
    features.
*   **Cons**: Usage data starts only after the whole build (about 5–7 working
    sessions instead of 1–2); 0.3.0 would be built on guesses; a bad safety
    warning would force rolling back everything.
*   **Reason for Rejection**: Rejected by author: delays the telemetry, which
    the author ranked most important.

### Alternative B: Three releases (0.2.0, 0.3.0, 0.4.0)

*   **Pros**: Smallest change per release; easiest to tell which change broke
    something.
*   **Cons**: Most release overhead.
*   **Reason for Rejection**: Rejected by author: does not want frequent
    releases.

### Alternative C: Azure Application Insights for telemetry

*   **Pros**: Microsoft's documented path for VS Code extensions
    (`@vscode/extension-telemetry`); large free data allowance.
*   **Cons**: Account needs a credit card; charts need queries written in the
    Azure portal; the library is the extension's first runtime dependency and
    would need a bundling step to keep the package small.
*   **Reason for Rejection**: Rejected by author: fails "always free, no extra
    setup, no complication".

### Alternative D: Grafana Cloud for telemetry

*   **Pros**: The Grafana dashboards the author first asked about.
*   **Cons**: Its write keys are not meant to be embedded in public code, so a
    relay server between the extension and Grafana is required.
*   **Reason for Rejection**: Rejected by author: a server to run is extra
    setup and complication.

### Alternative E: VS Code's `machineId` as the anonymous user ID

*   **Pros**: Already provided by VS Code; no storage needed.
*   **Cons**: The same value is visible to every extension on the machine, so
    it could link our data with other data sets.
*   **Reason for Rejection**: Rejected by author (approved privacy
    requirements in G1): a random ID created by this extension cannot be
    linked to anything else.

### Alternative F: Drop the Graph (canvas) view, or add Diff to it, in 0.2.0

*   **Pros**: Dropping removes the largest part of `graph.js`; adding Diff
    makes all three views consistent.
*   **Cons**: Dropping removes a view 0.1.0 users have (breaks G2); both are
    decided without usage data.
*   **Reason for Rejection**: Rejected by author: keep it unchanged and let
    telemetry decide in 0.3.0.

### Alternative G: Rewrite the parser from Oracle's grammar, or ship the grammar for live checks

*   **Pros**: Parser matches Oracle's definition by construction; live
    checks could flag unknown properties.
*   **Cons**: The current generic parser already handles the 2,228-file
    corpus; a rewrite risks regressions for no user-visible gain; each grammar
    file is about 1.9 MB, roughly 50 times the current package; Oracle's own
    extension already validates properties.
*   **Reason for Rejection**: Rejected by author (approved Non-Goals): the
    grammar is used in tests only.

### Alternative H: Earlier diff ideas — separate extension, Changes panel, Changes-only filter, diff minimap

*   **Pros**: More ways to scan changes.
*   **Cons**: A separate extension means a second install with no shared
    context; the panel, filter, and minimap cluttered the toolbar and the
    minimap was unreadable at real file sizes.
*   **Reason for Rejection**: Rejected by author (July 2026, after seeing them
    built); code removed in commit `6123abc`.

### Alternative I: Unused-component ("orphan") detector based on `@identifier` references

*   **Pros**: Cheap to build on the existing reference resolver.
*   **Cons**: On the real corpus most shared components are referenced by
    plain name, not `@identifier`, so it flagged mostly-used components as
    unused.
*   **Reason for Rejection**: Rejected by author (July 2026, after corpus
    data); `src/orphan-detector.js` is left unwired and is removed in this
    work.

## Non-Functional Requirements

*   **Privacy:** see G1 requirements. Telemetry never blocks or slows the UI:
    sending is asynchronous, batched, and dropped on any network error.
*   **Package size:** under 100 KB (0.1.0 is 39 KB). No runtime dependencies
    are added.
*   **Compatibility:** `engines.vscode` stays `^1.85.0` (Node 18, so global
    `fetch` and `createTelemetryLogger` are available).
*   **Rollback:** tag `v0.1.0` and the kept `apexlang-view-0.1.0.vsix`. If
    0.2.0 misbehaves, rebuild from `v0.1.0` and publish it as 0.2.1. Telemetry
    can be cut without a release by revoking the PostHog project key.

--------------------------------------------------------------------------------

### Additional Resources

*   `ROADMAP.md` — every request, decision, and review finding (sections A–G).
*   Oracle APEXlang reference and grammar:
    https://docs.oracle.com/en/database/oracle/apex/26.2/apxln/
*   VS Code telemetry guide:
    https://code.visualstudio.com/api/extension-guides/telemetry
*   Alex on APEX, "Merging APEX Working Copies with APEXlang" (2026-07-24).
*   thatjeffsmith.com, "Vibe coding an Oracle APEX app via APEXlang, pt2:
    diffs" (2026-11).
*   APEXREST: https://github.com/apexrest-dev/apexrest

### Future Improvements

*   **Component catalog from Oracle's reference:** descriptions and allowed
    values per property, shown in the detail panel.
*   **Timeline integration:** "Show component changes" on a commit in VS
    Code's Timeline view, matching the workflow in the thatjeffsmith post.

--------------------------------------------------------------------------------

## Detailed Implementation Plan (0.2.0)

All paths are relative to `tools/apexlang-view/`. Work happens on
`feature/git-diff`.

### Target Files to Create/Modify

#### 1. `src/telemetry-config.js` (Create)

*   **Type / Scope**: Configuration module.
*   **Proposed Changes**: Exports `POSTHOG_HOST` (`https://us.i.posthog.com` or
    `https://eu.i.posthog.com`, per the region chosen at sign-up) and
    `POSTHOG_PROJECT_KEY` (the public `phc_` key). Nothing else.

#### 2. `src/posthog-sender.js` (Create)

*   **Type / Scope**: Node module, no `vscode` import (unit-testable).
*   **Proposed Changes**: `createPostHogSender({ host, key, distinctId,
    fetchImpl, now })` returns `{ sendEventData(name, data),
    sendErrorData(error, data), flush() }`.
    *   Allow-list of event names: `activated`, `command`, `viewChanged`,
        `featureUsed`, `fileParsed`; anything else is dropped.
    *   `sendErrorData` builds a `$exception` event: error `name`, message cut
        to 200 characters with anything that looks like a path
        (`/…`, `X:\…`) replaced by `<path>`, and stack frames kept only if
        they come from this extension's `src/` or `media/` files, reduced to
        `file.js:line`.
    *   Every event gets `distinct_id`, `$process_person_profile: false`,
        and a timestamp.
    *   Queue flushes to `POST {host}/batch/` at 20 events, every 30 seconds,
        and on `flush()`; 5-second timeout; failures dropped.
    *   Hard cap of 200 events per instance (per VS Code session).

#### 3. `src/telemetry.js` (Create)

*   **Type / Scope**: VS Code-side wrapper.
*   **Proposed Changes**: `initTelemetry(context)` creates or reads the
    anonymous UUID in `context.globalState` (key `apexlangView.anonId`),
    builds the sender, wraps it with
    `vscode.env.createTelemetryLogger(sender, { ignoreUnhandledErrors: false })`,
    and registers it in `context.subscriptions` so it is disposed (flushed) on
    deactivate. Exports `track(name, props)` and `trackError(where, err)`;
    both return immediately when `apexlangView.telemetry.enabled` is false.
    Also tracks "first use per panel session" for `featureUsed` and
    `fileParsed` (a `Set` reset when the panel is created).

#### 4. `src/extension.js` (Modify)

*   **Type / Scope**: Extension entry point.
*   **Proposed Changes**:
    *   Telemetry: call `initTelemetry` in `activate` and `track('activated')`;
        `track('command', { name })` in every command handler and toolbar
        message (`openGraph`, `switchFile`, `openAppMap`, `toggleDiff`,
        `compareWithCommit`, `showLogs`); `logError` also calls `trackError`
        (except `isKnownBenignNoise`); the webview `error` message calls
        `trackError('webview', …)`; new webview messages `viewChanged` and
        `featureUsed` map to `track`; `refresh()` sends `fileParsed` with
        size/ms/node buckets on the first parse of each file per panel
        session.
    *   Diff state: replace `diffAgainstHead` (boolean) with `diffRef`
        (`null` | `'HEAD'` | commit hash). `toggleDiffCommand` switches
        between `null` and `'HEAD'`. New `compareWithCommitCommand` shows a
        QuickPick of `repository.log({ path, maxEntries: 50 })` (short hash,
        date, first message line) and sets `diffRef`. `diffRef` resets to
        `null` in `switchTo`.
    *   F6: rename `getContentAtHead` to `getContentAtRef(uri, ref)`; return
        `{ text }` or `{ reason: 'untracked' | 'noRepo' | 'gitNotReady' }`;
        log the reason once per file + ref; send `diffStatus` (ref or reason)
        with the `graph` message.
    *   F4: module-level `refreshSeq`; each `refresh()` captures its number
        and skips `postMessage` if a newer refresh started.
    *   F10: move the App Map doc comment back above `openAppMapCommand`;
        strip `removedInfo` from the diff before `postMessage`.
    *   Remove the `orphan-detector` import and `findUnusedComponentsCommand`.
    *   Register the `compareWithCommit` command.
    *   The webview HTML (`getWebviewHtml`) adds a "▾" button next to Diff
        (`id="diff-pick"`, title "Compare with commit…").

#### 5. `media/graph.js` (Modify)

*   **Type / Scope**: Webview script.
*   **Proposed Changes**:
    *   Post `viewChanged` from the View toggle; post `featureUsed` on the
        first search input, `revealLine` click, external-page open, and
        breadcrumb click per panel session.
    *   Diff button label from `diffStatus`: "Diff: Off", "Diff: HEAD",
        "Diff: a1b2c3d", "Diff: not tracked", "Diff: no git". The "▾" button
        posts `compareWithCommit`.
    *   F5: after a `graph` message, re-render the detail panel for
        `selectedNodeId`, or hide it if that node no longer exists.
    *   F7: `renderPropsGrid` also lists keys present only in
        `propChanges[node.id]` (removed properties, shown as old → "(none)").
    *   F10: build `addedSet` / `changedSet` once per `graph` message; row
        rendering uses `Set.has`.

#### 6. `media/graph.css` (Modify)

*   **Type / Scope**: Webview styles.
*   **Proposed Changes**: F3 — remove `border-left: 3px solid transparent`
    from `.tree-row`; `.tree-row.diff-added` / `.diff-changed` use
    `box-shadow: inset 3px 0 0 <git decoration token>` instead of a border.
    Style for `#diff-pick` (same as other toolbar buttons, narrow).

#### 7. `src/diff.js` (Modify)

*   **Type / Scope**: Pure diff module.
*   **Proposed Changes**: F8 — in `buildPathIndex`, when a
    `typeName:identifier` key already exists among siblings, append `#n` (nth
    occurrence) so duplicates are matched in order instead of overwritten.
    F9 — `computePropChanges` skips `_label` when the label is derived from
    `props.name` or the identifier. Remove the stale "extension.js wiring not
    yet built" header line.

#### 8. `src/orphan-detector.js`, `test/orphan-detector.test.js`, `fixtures/orphan-app/` (Delete)

*   **Type / Scope**: Dead code (Alternative I).
*   **Proposed Changes**: Delete. `fixtures/orphan-app/` is used only by
    `test/orphan-detector.test.js`.

#### 9. `media/demo.mp4` (Delete)

*   **Type / Scope**: Unused media (F1).
*   **Proposed Changes**: `git rm`. Not referenced anywhere; `demo.gif` stays
    in the repo for the README.

#### 10. `test/telemetry.test.js` (Create)

*   **Type / Scope**: Unit tests for `posthog-sender.js` with a fake `fetch`.
*   **Proposed Changes**: Unknown event names dropped; batch flush at 20 and
    on `flush()`; cap at 200; payload never contains `\`, `/Users/`,
    `.apx`, or `C:` after path scrubbing; error stack keeps only extension
    frames; network failure does not throw.

#### 11. `test/grammar-catalog.js` (Create) and `test/grammar.test.js` (Create)

*   **Type / Scope**: Test helper + tests (G4).
*   **Proposed Changes**: The helper reads `reference/apexlang-26.1.ebnf` and
    `-26.2.ebnf` and returns component keywords and property keywords. Tests
    A, B, C as in the Technical Plan. Test B uses the external corpus and
    skips if it is absent (same rule as `test/corpus.test.js`).

#### 12. `test/baseline-render.test.js` (Create)

*   **Type / Scope**: Regression test for G2.
*   **Proposed Changes**: For every fixture in `fixtures/` (and up to 50
    corpus files if present), parse once, then render with the `v0.1.0`
    `graph.js` (read via `git show v0.1.0:media/graph.js`) and the current
    `graph.js` in `jsdom`, Diff off, Tree and By Type views, all expanded.
    Compare row order, text, and class lists; ignore the toolbar. Skips if
    git or the tag is unavailable.

#### 13. `test/diff.test.js` (Modify)

*   **Type / Scope**: Unit tests.
*   **Proposed Changes**: Cases for F8 (two same-named siblings, edit the
    first → flagged) and F9 (rename via `name:` → one change, not two).

#### 14. `package.json` (Modify)

*   **Type / Scope**: Manifest.
*   **Proposed Changes**: `version` 0.2.0; command `apexlangView.compareWithCommit`
    ("APEXLang View: Compare with Commit…"); `contributes.configuration` with
    `apexlangView.telemetry.enabled` (boolean, default true, tags `telemetry`,
    `usesOnlineServices`, description stating what is sent);
    `devDependencies`: `jsdom` (test only, not packaged).

#### 15. `telemetry.json` (Create)

*   **Type / Scope**: VS Code transparency file.
*   **Proposed Changes**: Lists each event and property from the Technical
    Plan's event table, with purpose and classification (usage / error).

#### 16. `.vscodeignore` (Modify)

*   **Type / Scope**: Packaging.
*   **Proposed Changes**: Add `media/demo.gif`, `media/demo.mp4`,
    `reference/**`, `docs/**`, `design_draft.md`, `node_modules/**`.

#### 17. `README.md` (Modify)

*   **Type / Scope**: Marketplace page.
*   **Proposed Changes**: Add "Compare with Commit…" to Features and the
    Commands table; add a "Privacy" section (what is sent, what never is,
    how to turn it off: VS Code telemetry setting or
    `apexlangView.telemetry.enabled`).

#### 18. `CHANGELOG.md` (Modify)

*   **Type / Scope**: Release notes.
*   **Proposed Changes**: 0.2.0 entries for anonymous telemetry, Compare with
    Commit, the F-fixes visible to users (F5, F6, F7), and removal of the
    unused orphan-detector code.

#### 19. `TESTING-CHECKLIST.md` (Modify)

*   **Type / Scope**: Manual test script.
*   **Proposed Changes**: Add: Diff-off parity with 0.1.0; Compare with
    Commit; telemetry off (VS Code setting) → output channel shows events
    dropped; telemetry on → events appear in PostHog Live events.

#### 20. `ROADMAP.md` (Modify) and `docs/DESIGN-v0.2-v0.4.md` (Create)

*   **Type / Scope**: Tracking and design record.
*   **Proposed Changes**: Mark items done as they land. The final design is
    this document, saved to `docs/`.

### Verification Plan

*   **Compilation/Build**: none (plain JavaScript); `node --check` on every
    changed `.js` file.
*   **Unit Tests**: `npm test` — all existing tests pass (64 minus the removed
    orphan-detector tests) plus the new telemetry, grammar, diff, and
    baseline-render tests.
*   **Static Analysis & Linting**: every `getElementById` in `graph.js` exists
    in `getWebviewHtml` (the check that would have caught the July break).
*   **Package**: `npx @vscode/vsce package`; size < 100 KB; `vsce ls` shows no
    `demo.*`, `reference/`, `docs/`, `test/`, or `fixtures/`.
*   **E2E/Integration**: browser harness from 2026-10-17 re-run on the new
    webview; Mohammad's F5 run of `TESTING-CHECKLIST.md`; install the packaged
    `.vsix` in a clean VS Code profile and confirm events arrive in PostHog
    Live events, and that none arrive with VS Code telemetry off.

--------------------------------------------------------------------------------

*Drafted with EGM*
