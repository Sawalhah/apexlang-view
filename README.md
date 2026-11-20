# APEXLang View

View Oracle APEX `.apx` (APEXLang) files as a collapsible component tree in VS Code — no APEX install required.

![APEXLang View demo](media/demo.gif)

## Features

- **Outline tree** — page → regions → items → processes, rendered like VS Code's own Explorer. Click a node for its properties, breadcrumb, and a jump to that line in source.
- **Search** — filter by type, identifier, label, or property value.
- **Cross-references** — resolves `@identifier` links between components (References / Referenced by).
- **Cross-page navigation** — buttons, branches, and dynamic actions that redirect to another page show a `→ Page N` badge; click to switch.
- **By Type view** — flat grouping by component type, for scanning composition instead of hierarchy.
- **Graph view** — the same tree as a pannable node-graph canvas.
- **App Map** — a page-to-page navigation map across the whole app.
- **Diff vs HEAD** — highlights nodes added or changed since your last commit, with old → new values in the details panel, and counts what was removed.
- **Compare with Commit…** — the same highlighting against any of the last 50 commits that changed the file (the ▾ next to the Diff button).
- **Live refresh** — the tree updates as you edit the file.
- Fully theme-aware (light/dark/custom).

## Usage

1. Open a `.apx` file.
2. Run **APEXLang View: Open Graph View** from the command palette, editor title bar, or file right-click.
3. Use **Switch File** to change which `.apx` file the view targets.

## Commands

| Command | Shortcut | Description |
|---|---|---|
| `APEXLang View: Open Graph View` | `Alt+Shift+L` (`Cmd+Alt+L` on Mac) | Opens/toggles the view for the active file |
| `APEXLang View: Switch File` | — | Quick-pick a different `.apx` file |
| `APEXLang View: Open App Map` | — | Shows the page-to-page navigation map for the whole app |
| `APEXLang View: Toggle Diff vs HEAD` | — | Highlights nodes changed since your last commit |
| `APEXLang View: Compare with Commit…` | — | Pick a past commit of this file to compare with |
| `APEXLang View: Show Logs` | — | Output channel for parse timing and errors |

## Privacy

APEXLang View sends anonymous usage and error data so I can see which features are used and fix crashes: which commands and views are used, coarse parse timings and file sizes, and error types with this extension's own file and line numbers. It never sends file names, paths, page or component names, `.apx` content, git data, or error messages, and it identifies an install only by a random ID it creates itself.

Nothing is sent when VS Code's telemetry is off (`telemetry.telemetryLevel`), or when you turn off **APEXLang View › Telemetry: Enabled** (`apexlangView.telemetry.enabled`). The full list of events is in [telemetry.json](telemetry.json).

## Development

```bash
npm test          # regression suite (node:test)
```

Press `F5` to launch an Extension Development Host, then open a file from `fixtures/`.

Validated against Oracle's 2,228 APEX 26.1 sample, starter, and utility app files, and tested against Oracle's published APEXlang grammar (26.1 and 26.2).
