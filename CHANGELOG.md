# Changelog

All notable changes to APEXLang View are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] — Unreleased

### Added

- "Diff: HEAD" toggle — highlights nodes added (green left border) or
  changed (yellow left border) in the current file's working-tree content
  versus its last commit. Uses VS Code's built-in Git extension API (no
  shell-out), diffs the two parsed graphs structurally (matched by
  containment path + identifier, not by positional node id, so unrelated
  edits elsewhere in the file don't cause spurious diffs). Off by default,
  not persisted across panel restarts. Node-count label shows a
  `+added ~changed -removed` summary.
- Detail panel shows old→new values (struck-through old, highlighted new)
  for exactly which properties changed on a selected node, instead of just
  flagging that it changed.
- "Changes only" filter toggle — dims every node except added/changed ones
  (and their ancestors, so the path to a change stays reachable).
- "Changes" summary panel — a card list of every added/changed/removed
  node in one place, with inline old→new previews; click a card to jump
  straight to that node in the tree (added/changed only — removed nodes
  have no live node to jump to, shown for visibility only).

### Known limitations (new this release)

- Diff only compares working tree vs `HEAD` — no arbitrary ref-to-ref
  picker yet (planned as a later step: default HEAD now, generalize later).
- Removed nodes appear in the Changes panel and node-count summary but not
  as rows in the tree itself (there's no current-graph node to anchor them
  to there).
- Diff highlighting, the Changes panel, and "Changes only" filtering only
  apply to Tree/By Type views, not the Graph (canvas) view.
- Anonymous (no-identifier) sibling nodes are matched by position among
  same-typed siblings — inserting a new anonymous sibling before existing
  ones can misalign matching for those that follow. Identified (named)
  nodes, the vast majority in real files, are unaffected.

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
