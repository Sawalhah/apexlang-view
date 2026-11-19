# Stage 7 — Critic Review (round 1)

*   **Target:** `docs/DESIGN-v0.2-v0.3.md`, FeatureRange lines 1–442
*   **Reviewers:** egm-design (feature-spec-standard), egm-structural
    (feature-spec-standard), egm-style (persona rules) — all completed
*   **GoldfishContext:** ROADMAP.md, package.json, src/extension.js, src/diff.js,
    src/parser.js, media/graph.js
*   **Date:** 2026-11-19
*   **Verdicts:** design NOT READY (2 Blocker, 11 Major, 7 Nit); structural FAIL
    (2 Blocker, 6 Major, 7 Nit); style no Blockers (7 Major, 23 Nit).
*   **Round status:** not clean (open Blockers/Majors).

## Consolidated findings (deduplicated; ids map to the raw findings below)

### 🔴 Blockers

| # | Finding | Raw ids |
|---|---|---|
| C1 | **Our own off-switch leaks.** `apexlangView.telemetry.enabled` is checked in `track()`/`trackError()`, but the logger forwards unhandled errors straight to the sender, bypassing it. Check the setting inside the sender (`sendEventData`/`sendErrorData`), re-read on config change. | design-B1 |
| C2 | **No property allowlist in the sender.** VS Code's logger adds built-in common properties (reportedly including `common.vscodemachineid`, session IDs) — contradicting G1's "not machineId" (Alternative E) — and possibly no OS. Sender must build each payload from an explicit allowlist; consider `ignoreBuiltInCommonProperties: true`; unit-test that unknown keys are dropped. (VERIFY against vscode.d.ts.) | design-B2 |
| C3 | **No Risks & Mitigations section** (required by the standard). Risk content is scattered; unstated risks: event spoofing via public key, git API failure modes (large history, shallow clone, detached HEAD, renames), in-flight git calls, CI needing the `v0.1.0` tag. | struct-B1, design-M10/M11 (partly) |
| C4 | **"Rejected by author" without a link breaks the Alternatives rule** (9+ places, plus Overview and G1). Replace with the concrete trade-off, or link a real issue/discussion/PR (or the ROADMAP decision entry). | struct-B2, design-M8 |

### 🟡 Majors

| # | Finding | Raw ids |
|---|---|---|
| C5 | Process-wide handlers would send **other extensions' errors**; `trackError` must never be called from them; drop zero-own-frame errors. (Same as Stage 5 Z1.) | design-M1 |
| C6 | **Webview errors:** no `name` sent, frames are `vscode-webview://` URLs, `message` may contain user data — state `message` is never sent, add `name`, define frame reduction. (Relates to Stage 5 Z2.) | design-M5 |
| C7 | **G2 parity test can't catch F3** (jsdom: no layout/stylesheet geometry); toolbar now also has "▾" and setting/command additions. Restate G2 as "identical except listed additions"; replace/augment with CSS-rule comparison or rendering check; keep the manual side-by-side as a required release step. (Same as Z6.) | design-M2, style-M2, design-N1 |
| C8 | **G4 not measurable:** no 26.2 export exists; "hard error" undefined (parser never throws); Tests A/C can't fail (parser ignores keywords). Define pass via `assessParseQuality`; test grammar *structural* forms (strings/escapes, comments, arrays, fenced code, nesting); make 26.2 half conditional; mention the removed `uiDefaultsReference`. (Same as Z7.) | design-M3, struct-M4, style-M3 |
| C9 | `fileParsed.msBucket` would mostly time file read + workspace scan + git, not parsing. Time `parseApxToGraph` alone or send separate timings. | design-M4 |
| C10 | **Compare-with-commit:** `log`/`show` don't follow renames (page slugs change); no state for "file absent at this commit"; `show` re-run every 400 ms — cache by (hash, path). (Relates to Z3.) | design-M6 |
| C11 | Resetting the chosen ref on file switch turns Diff off silently with auto-follow; today `diffAgainstHead` survives switches. Decide: HEAD survives, only a specific commit resets; note in CHANGELOG. | design-M7 |
| C12 | **0.3.0 decision rule missing:** no period, thresholds, minimum users, or fallback when data is thin. (Same as Z4.) | design-M9 |
| C13 | **Public key abuse & quota:** no volume estimate vs free quota, no zero-spend billing limit, no event-definition lock; revoking the key is one-way. | design-M10, style-M5 |
| C14 | **Proxy & region:** global `fetch` may ignore corporate proxies (enterprise users silently missing → biased data); no rule for US vs EU region. | design-M11 |
| C15 | G3b compare-with-commit has **no alternatives weighed** (Timeline integration is named as a future item; it's the workflow the evidence uses). (Same as Z5.) | struct-M6 |
| C16 | Missing alternatives: telemetry opt-out vs opt-in; jsdom vs rendering check; custom sender vs PostHog client; fixed cap vs per-event limits. Alternative B rationale is preference only. | design-M8, struct-M1 |
| C17 | "Closed" event list extended elsewhere (`compareWithCommit` only in §2b); G1 omits `nodeBucket`/`suspicious`. Put the whole list in the table. | struct-M3, style-N14 |
| C18 | Link gaps: juanl.hashnode.dev and SiliconANGLE missing from resources; Alex on APEX and thatjeffsmith without URLs; `ROADMAP.md` not a relative link (`../ROADMAP.md`); bare URLs. | struct-M5, style-N?, design-N7 |
| C19 | Headings "Additional Resources"/"Future Improvements" are H3 under NFRs — promote to H2. | struct-M2 |
| C20 | Overclaims to calibrate: "every product decision … a guess" (→ "none based on usage data"); random ID "cannot be linked to anything else" (→ "not shared with other extensions or derived from machine/account data"); Oracle's local-vs-DB compare not mentioned in "What we are not solving". | style-M1, style-M6, style-M4 |
| C21 | Problem 3 paragraph is 19 lines mixing gap, evidence, forecast, and competitor note — split; move APEXREST to resources; mark the forecast as expected. | style-M7 |

### 🟢 Nits (selected; full list below)

Diagram misaligned and incomplete (missing `compareWithCommit`, `diffStatus`,
extension→webview arrow); table breaks a bullet list; plan sections use bold
labels not headings; G6/G7 styled differently; duplicated rejection reasoning;
orphan-detector removal has no plan step; "finished work" → "built but
unreleased"; G3 title grammar; one corpus term; "handles" → "parses all 2,228
without error"; "always free" → dated vendor terms; VS Code cleaning is
best-effort; Open Questions aren't questions / name the author; "we" vs
"author"; define "panel session"/"VS Code session"; single failure-handling
statement; F3 isn't "architectural"; label for `gitNotReady`; garbled toggle
sentence; name both EBNF files; Alt A estimate basis; subjective Alternatives
wording; `createTelemetryLogger` comes from the VS Code API, not Node 18;
message list wrongly includes webview `log`; "no user identity" wording;
packaging/shallow-clone preconditions; deactivate flush is sync; 0.3.0
duplicate-name check vs the 29 legit theme files; "pull request" has no
mechanism.

--------------------------------------------------------------------------------

## Raw findings — egm-design (NOT READY)

**Blockers.** B1 own setting bypassed by forwarded unhandled errors (lines
219-223, 244, 307-308) → check in sender. B2 no property allowlist; built-in
common props may include machineId and omit OS (109-116, 239, 360-367) →
allowlist + `ignoreBuiltInCommonProperties` + test. [VERIFY]

**Majors.** M1 other extensions' errors via process handlers (244;
extension.js 22-31, 124-131). M2 jsdom can't catch F3 (124-126, 298-303;
graph.js 727). M3 G4 unmeasurable; Tests A/C trivially pass; test structural
grammar forms instead (133-136, 177-178, 286-296; parser.js 137-204). M4
msBucket measures scan/git (93-97, 243; extension.js 436-499, 94-101). M5
webview error lacks name, frames are webview URLs, message may hold user data
(244; graph.js 7-20). M6 renames, missing-at-commit state, cache by hash
(129-132, 268-281; extension.js 185). M7 ref reset on file switch vs
auto-follow (279-281; extension.js 195-204, 423-430). M8 Alternatives rule,
preference-only B/F, missing alternatives (opt-in, rendering check, PostHog
client, rate limits); VERIFY Grafana Faro (322-406). M9 no decision rule for
0.3.0 (34-38, 162-165, 172-176). M10 public-key abuse, quota estimate, billing
limit, key revocation is one-way [VERIFY] (98-103, 119-121, 246-247, 416-418).
M11 proxy behavior of global fetch [VERIFY]; region rule (99-103, 169-171, 210,
410-415).

**Nits.** N1 "▾" not in allowed differences. N2 protocol list wrong (`log`),
missing `diffStatus`. N3 "no user identity" vs per-install ID. N4 packaging
exclusions, `vsce ls`, shallow-clone precondition. N5 deactivate is sync —
state subscriptions/flush timeout. N6 duplicate-name check vs 29 theme files.
N7 PR compare mechanism; source links.

## Raw findings — egm-structural (FAIL)

**Blockers.** B1 missing Risks & Mitigations section. B2 "Rejected by author"
with no link (36-38, 101-107, 331…404).

**Majors.** M1 Alternative B rejected on preference. M2 H3s after the rule
become children of NFRs. M3 closed event list extended elsewhere; G1 omits
`nodeBucket`/`suspicious`. M4 G4 vs Open Questions (26.2). M5 link gaps
(juanl, SiliconANGLE, Alex on APEX, thatjeffsmith, `../ROADMAP.md`, bare
URLs). M6 no alternatives for G3b (Timeline).

**Nits.** N1 diagram broken/incomplete. N2 table interrupts list. N3 bold
labels not headings; numbering vs goals. N4 G6/G7 style. N5 rejection
reasoning duplicated. N6 orphan removal has no plan step. N7 (optional)
section names differ from the standard's examples.

**Compliant:** heading levels before line 420; uniform Alternatives
structure; event table well-formed; code fences closed; message list matches
extension.js; `diffAgainstHead`/`getContentAtHead` exist; engines match.

## Raw findings — egm-style (no Blockers)

**Majors.** M1 "every decision … a guess" overclaim (48-49). M2 G2 "no visible
change" contradicted by listed additions (124-126 vs 271-272, 298-303). M3 G4
corpus is 26.1 only; "hard errors" undefined (133-136, 177-178). M4 Oracle's
local-vs-DB compare omitted; positioning language (85-89). M5 passive,
mechanism-less "ignored in the dashboard" (119-121). M6 random ID "cannot be
linked" absolute claim (366-367). M7 Problem 3 paragraph mixes four things
(59-77).

**Nits N1–N23.** Repetition of the release decision and "Rejected by author";
"finished work"; G3 title; corpus terminology; "handles"; 163 keywords +1
removal; "user identity"; "always free" / quantify allowances; VS Code cleaning
best-effort; Open Questions phrasing and first name; "we" voice; diagram
alignment; `logError` context; `compareWithCommit` in table; define session
terms; failure-handling consistency and "never slows" claim; "architectural
ones"; `gitNotReady` label; toggle sentence; EBNF filenames; Alt A estimate
basis; subjective Alternatives wording; Node 18 vs VS Code API attribution.

**Unverified (not counted):** parser.js unchanged since `v0.1.0` (Elephant
note: confirmed earlier — `git diff --stat v0.1.0..HEAD` lists no parser.js
change); commit `6123abc` (Elephant note: confirmed — it is the strip commit);
PostHog key revocation behavior; location of `apexlang-view-0.1.0.vsix`
(Elephant note: repo root, `tools/apexlang-view/`).
