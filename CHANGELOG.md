# Changelog

All notable changes to APEXLang View are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] — Unreleased

### Added

- **Diff vs HEAD** (Diff button, or "APEXLang View: Toggle Diff vs HEAD") —
  highlights nodes added (green bar) or changed (yellow bar) in the current
  file's working copy compared with its last commit. Uses VS Code's built-in
  Git extension (no shell-out) and compares the two parsed trees by
  component path and name, so unrelated edits elsewhere in the file don't
  show up as changes. The node count shows a `+added ~changed -removed`
  summary. Off by default, not saved between sessions.
- **Compare with Commit…** (the ▾ next to the Diff button, or the command) —
  pick one of the last 50 commits that changed the file; the tree
  highlights what changed between that commit and your working copy.
- The details panel shows old → new values for exactly the properties that
  changed on the selected node, including properties that were removed.
- The Diff button says why there is nothing to compare: "Diff: not
  tracked", "Diff: no git", or "Diff: not in a1b2c3d".
- `Ctrl+Alt+L` / `Cmd+Alt+L` opens the view for the active `.apx` file.
- Anonymous usage and error data (see "Privacy" in the README and
  `telemetry.json`). Respects VS Code's telemetry setting; can also be
  turned off with `apexlangView.telemetry.enabled`.
- Parser tested against Oracle's published APEXlang grammar (26.1 and 26.2)
  and all 2,228 files of Oracle's APEX 26.1 sample, starter, and utility
  apps.
- README rewritten for users, with a demo GIF.

### Fixed

- Interactive Grid columns whose names contain `$` (`APEX$ROW_ACTION`,
  `APEX$ROW_SELECTOR`, `DERIVED$01`) showed as a separate `ROW_ACTION` /
  `ROW_SELECTOR` component instead of a column.
- `/* … */` comments at the start of a line are ignored (a commented-out
  block could show up as a real component).
- Quoted names with escapes (`"Say \"hi\""`) show the text without the
  backslashes.
- With Diff off, the tree looks exactly like 0.1.0 (the diff marker no
  longer shifts rows by 3px).
- While Diff is on, an open details panel updates as you type; a panel you
  closed stays closed.
- Repeated names among siblings (e.g. several `templateOptionGroup` blocks
  with the same name) are compared in order instead of overwriting each
  other; renaming through `name:` shows one change, not two.
- A slow refresh can no longer overwrite a newer one while typing.

### Removed

- The unused "unused shared components" detector code (it was never wired
  to a command).

### Known limitations (new this release)

- Removed nodes are counted in the summary but don't appear as rows in the
  tree (there's no current node to attach them to).
- Diff highlighting applies to the Tree and By Type views, not the Graph
  (canvas) view.
- Unnamed sibling components are matched by position among siblings of the
  same type, so inserting one before others can show the later ones as
  changed. Named components, the vast majority, are unaffected.
- Compare with Commit doesn't follow renames: commits from before a file was
  renamed aren't listed. Switching to another file resets a chosen commit
  to HEAD.
- Not yet verified on files exported from APEX 26.2 (the grammar check
  covers 26.2's keywords; no real 26.2 export was available).
- Anonymous usage data is only counted for users whose network VS Code can
  reach PostHog through.

## [0.1.0] — Published 2026-07-25

Initial release, published to the VS Code Marketplace.

### Added

- Hand-written recursive-descent parser for the APEXLang export format,
  validated against 1263 real `.apx` files (0 hard errors).
- Indented outline tree view (matching APEX Page Designer's own Rendering
  tree / VS Code's Explorer) — click a row for properties, a breadcrumb
  trail, and jump-to-source.
- In-tree search/filter with match highlighting and Enter-to-cycle.
- Cross-reference resolution (`@identifier`-style refs) shown as
  "References"/"Referenced by" in the detail panel.
- Cross-page navigation: buttons/branches that redirect to another page
  show a "→ Page N" badge, with a confirmation prompt before switching.
- Auto-collapsed large sibling groups (e.g. interactive report columns) so
  the tree opens legible by default.
- "By Type" view — flat groups of nodes by component type, for scanning
  composition.
- "Graph" view — an SVG boxes-and-wires canvas (pan/zoom) as a third view
  alongside Tree/By Type, reusing the same edges and category colors.
- Keyboard navigation (standard tree-widget semantics: Up/Down/Left/Right).
- Theme-native styling — every color is a VS Code theme token, correct in
  light, dark, and custom themes.
- Live refresh on file edit (debounced).
- "App Map" — a page-to-page navigation map for the whole app: scans every
  `.apx` page under the app root and lists each page with its outgoing
  navigation targets as clickable chips; click a page to jump the graph to
  it. Not a merged cross-file graph — just page-level nav, resolved from the
  same navTarget data already used for single-file nav stubs.

### Known limitations

- App Map covers page-to-page navigation only — it's not a merged, full
  cross-file containment graph (that's a larger, separate effort).
- Cross-reference resolution only recognizes the bare `@identifier` syntax;
  many real APEX references use a plain name string instead.
- An "unused shared components" detector was built and tested, but shelved
  (not wired to a command) — real-corpus validation showed it would flag
  mostly-used components as false-positive orphans.
