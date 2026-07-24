# Changelog

All notable changes to APEXLang View are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — Unreleased

Initial build. Not yet published to the VS Code Marketplace.

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

### Known limitations

- Single-file scope — no whole-app graph across multiple pages yet.
- Cross-reference resolution only recognizes the bare `@identifier` syntax;
  many real APEX references use a plain name string instead.
- An "unused shared components" detector was built and tested, but shelved
  (not wired to a command) — real-corpus validation showed it would flag
  mostly-used components as false-positive orphans.
