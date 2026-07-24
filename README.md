# APEXLang View

A structural viewer for Oracle APEX's APEXLang export format (`.apx` files,
introduced in APEX 26.1). Renders a page's component hierarchy — page →
regions → items → processes → ... — as an indented, collapsible outline
tree inside VS Code, in the same visual language as APEX Page Designer's own
Rendering tree and VS Code's own Explorer/Outline — not a separate floating
node-graph canvas.

## Features

- **Indented outline tree** — collapsible hierarchy of every block in a
  `.apx` file, icon-coded by component type, using the same list/selection
  visual language as VS Code's own Explorer (so it feels native, not like a
  foreign tool bolted on). Click a row to see its scalar properties, a
  breadcrumb trail, and jump straight to that line in the source file.
- **In-tree search** — type in the toolbar box to highlight matching rows
  (matches typeName, identifier, label, and property values). Matches
  auto-expand any collapsed ancestor so they're never hidden; Enter cycles
  through matches.
- **Cross-reference resolution** — resolves `@identifier`-style component
  references (e.g. `button: @save` pointing at `button save (...)`) and
  shows them in the selected row's detail panel as "References" (what it
  points to) and "Referenced by" (what points to it) — clickable to jump
  straight there, the same way Page Designer surfaces related info in its
  properties panel rather than drawing it into the tree itself.
- **Cross-page navigation** — when a button, branch, or dynamic action
  redirects to another page (`target: { page: N }`), its row shows a small
  "→ Page N" badge. Clicking it prompts before switching the tree to that
  page's file.
- **Auto-collapsed large sibling groups** — a region with many columns
  (interactive reports), LOV entries, or similar repetitive children starts
  collapsed by default so the tree opens legible, one click away from full
  detail.
- **"By Type" view** — toggle to a flat grouping, one collapsible group per
  component type across the whole file (all regions, all buttons, etc.) —
  useful for scanning composition rather than structure.
- **Graph view** — a third toggle state: the same structure and edges (containment, reference, navigation) as boxes-and-wires on a pannable/zoomable canvas, for anyone who wants the visual node-graph layout instead of (or alongside) the tree.
- **Breadcrumbs + keyboard nav** — the detail panel shows a clickable
  root-to-node breadcrumb trail; arrow keys navigate the tree using
  standard tree-widget semantics (Up/Down move between visible rows,
  Right expands/descends, Left collapses/ascends).
- **Live refresh** — the tree re-parses automatically (debounced) as you
  edit the currently-shown file.
- **Theme-native** — every color comes from VS Code's own theme tokens
  (`--vscode-*`), so it looks correct in light, dark, and custom themes —
  not hardcoded to look like one specific theme.

## Try it

1. Open this folder in VS Code.
2. Press F5 (Run Extension) to launch an Extension Development Host.
3. In that new window, open a file from `fixtures/` (e.g.
   `p00003-basic-cards.apx`) and use the editor title bar icon, or
   right-click the file, → "APEXLang View: Open Graph View".
4. Use the toolbar's "Switch file…" button, or click a different `.apx`
   file in Explorer, to change what the graph shows.

## Commands

- **APEXLang View: Open Graph View** — opens/toggles the graph panel for
  the active (or right-clicked) `.apx` file.
- **APEXLang View: Switch File** — quick-pick any `.apx` file in the
  workspace without touching the text editor.
- **APEXLang View: Show Logs** — opens the "APEXLang View" output channel
  (panel lifecycle, parse timing/node counts, and any error, extension-side
  or from the webview).

## Parser

`src/parser.js` is a hand-written recursive-descent parser for the
APEXLang grammar observed in real APEX 26.1 exports (`type identifier (
... )` blocks, `key { ... }` groups, `@ref` references, `#TOKEN#`
placeholders, fenced code blocks, arrays). It is **not** built from an
official formal grammar file (none is publicly downloadable as of research
date) — it's reverse-fit to real exports, validated against a 1263-file
corpus of real sample apps.

Cross-file logic (page-to-page navigation resolution, in `src/page-nav.js`)
is deliberately kept separate from the parser — the parser only ever reads
one file and has no filesystem access.

## Tests

`npm test` runs the automated regression suite (`node --test`, no
dependencies) — parser unit tests, search/filter logic, cross-reference
resolution, cross-page navigation resolution, and a full corpus regression
gate against a real sample-apps checkout at
`apex_podman/apex-apps/sample-apps` (skips gracefully if that path isn't
present, e.g. on another machine). Run this after every change.

`npm run test:corpus` / `npm run test:parser` run older standalone scripts
directly if you want a full text/HTML report instead of pass/fail.

## Known gaps

- No formal APEXLang grammar to validate against — the parser will
  silently produce a wrong-looking tree on syntax it hasn't seen rather
  than erroring loudly, though `assessParseQuality()` catches the common
  cases (0 nodes, low density, garbage-looking type names) and warns in the
  UI.
- Cross-reference resolution only recognizes the bare `@identifier` syntax
  — many APEX shared-component references use a plain name string instead,
  which isn't currently resolved.
