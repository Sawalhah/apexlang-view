**What this proposes**

The document plans the next two releases of APEXLang View, a VS Code extension
that shows APEXlang `.apx` files as an outline tree and an App Map. Release
0.2.0 is fully specified and does six things:

- adds anonymous, opt-out telemetry, sent through VS Code's `TelemetryLogger` to
  PostHog Cloud on the free plan;
- ships the already-built "Diff vs HEAD" feature after fixing ten review
  findings (F1–F10);
- generalizes that diff so the user can pick any of the last 50 commits that
  touched the file;
- tests the parser against Oracle's 26.1 and 26.2 EBNF grammars;
- adds a jsdom test showing that, with Diff off, the tree looks the same as in
  0.1.0;
- rewrites the README for users and keeps the package under 100 KB.

Release 0.3.0 is only outlined: comparing two arbitrary refs (branch vs branch,
pull request), changed-page badges in the App Map, and extra warnings in the
Problems panel for things Oracle's validator misses. Telemetry from 0.2.0
decides what 0.3.0 does first and how far each part goes.

**How the existing system works, per this document**

The extension has no runtime dependencies and no build step.
`src/extension.js` reads an `.apx` file and calls the hand-written generic
parser `src/parser.js`, which returns a `{nodes, edges}` graph. That graph is
posted to a webview, where `media/graph.js` draws the Tree, By Type and Graph
views. The two sides talk only through a fixed set of named messages.
Unreleased work on `feature/git-diff` adds a Diff-vs-HEAD toggle
(`diffAgainstHead`, `getContentAtHead`, `diffGraphs` in `src/diff.js`) that
marks added and changed tree rows and shows old → new values. That work has ten
known defects, recorded in ROADMAP section F. The parser has not changed since
tag `v0.1.0`. It has been checked against a 2,228-file sample corpus but never
against Oracle's grammar.

--------------------------------------------------------------------------------

# Stage 6 — Comprehension Test findings

*   **Target:** `docs/DESIGN-v0.2-v0.3.md` (FeatureRange 1–442, DetailedRange
    443–667), read alone with no other files.
*   **Reviewer:** egm-comprehension (fresh context)
*   **Date:** 2026-11-19
*   **Totals:** 7 Major, 9 Nit, 0 Blocker.

1.  **Major** — G3 (line 127), Problem item 2 (55–57), Technical Plan §2
    (251–264), items 4–7, 9. "All ten review findings (F1–F10)" are never
    listed; F2 is never described; F1 appears only on the `demo.mp4` delete;
    F7–F10 only in the detailed plan; the two release blockers are not mapped
    to F-numbers; the version bump has no F-number. Needs a one-line-per-item
    F1–F10 table.
2.  **Major** — §5 (305–306) vs item 16 (618–619) vs Verification "Package"
    (658–659). The package-exclusion lists disagree (`ROADMAP.md`,
    `node_modules/**`, `test/`, `fixtures/`); unclear what the existing
    `.vscodeignore` already has.
3.  **Major** — G5 (137–139), item 16 (618), item 9 (565). G5 says the
    Marketplace page shows the GIF, but the GIF is excluded from the package;
    the document never says how the image reaches the Marketplace (absolute
    GitHub URL, or vsce rewriting relative links). Unstated prerequisite.
4.  **Major** — G2 (124–126), §4 (298–303), item 12 (584–592). Three different
    scopes for the parity check (all corpus files vs fixtures + ≤50; `graph.js`
    + `graph.css` vs `graph.js` only; indentation compared vs not; toolbar
    differences). None explains how a jsdom text/class comparison would detect
    F3's 3px layout shift.
5.  **Major** — lines 125, 135, 155, 292, 320, 582, 587. The corpus (central to
    G2, G4 and the 0.3.0 zero-false-positive rule) is never located or
    explained; a new contributor running `npm test` would silently skip the
    most important checks.
6.  **Major** — `fileParsed.suspicious` (line 243). "Suspicious" is never
    defined; `telemetry.json` and the README Privacy section can't describe it.
7.  **Major** — item 20 (643), title/filename. Item 20 says create
    `docs/DESIGN-v0.2-v0.4.md`; this document is `DESIGN-v0.2-v0.3.md`.
8.  **Nit** — G4 (136). "Zero hard errors" undefined (vs soft errors / the
    `suspicious` flag).
9.  **Nit** — G1 (120–121). "Ignored in the dashboard" is vague; the key is
    public, so how the dashboard filters arbitrary events is unstated.
10. **Nit** — §2b (279–280) vs item 4 (503–504). Toggle behavior when `diffRef`
    holds a commit hash is unclear (→ `null` or → `'HEAD'`?).
11. **Nit** — diagram (199–214) omits the `compareWithCommit` message and the
    `diffStatus` payload.
12. **Nit** — `featureUsed` `jumpToSource` (242) vs "`revealLine` click" (526–527);
    mapping not stated.
13. **Nit** — Verification (657, 660): "the July break" and "browser harness
    from 2026-10-17" unexplained.
14. **Nit** — items 4, 5, 11: existing identifiers used without description;
    especially `removedInfo` (are removed nodes shown at all?) and
    `isKnownBenignNoise` (what counts as benign).
15. **Nit** — Test C (295), Problem 4 (83): whether some of the 163 new 26.2
    keywords are component keywords (Test A territory) is unstated.
16. **Nit** — Additional Resources (429), Problem 3 (61): "Alex on APEX" and
    "juanl.hashnode.dev" lack full URLs.

Overlaps with Stage 5: #2 ≈ Z14, #3 ≈ Z9, #4 ≈ Z6, #5/#8 ≈ Z7, #7 ≈ Z14,
#9 ≈ Z10.
