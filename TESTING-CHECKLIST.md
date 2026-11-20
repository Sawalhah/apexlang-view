# APEXLang View — Manual Test Checklist

Run through this in the Extension Development Host (F5) before release. Check
off each item; note anything that breaks so it can be reported back.

**Note:** the graph panel was redesigned 2026-07-24 from a floating
node-and-edge canvas into an indented outline tree (like Page Designer's
Rendering tree / VS Code's own Explorer). No more pan/zoom/drag — it's a
normal scrollable list now. Cross-reference and navigation info moved into
the detail panel's new "References"/"Navigation" sections instead of
separate floating boxes.

## Setup
- [ ] Press F5, wait for the Dev Host window to open.
- [ ] In the Dev Host, open this folder's `fixtures/` directory (or the
      whole `apexlang-view` folder).

## 1. Basic tree view
- [ ] Open `fixtures/p00003-basic-cards.apx`.
- [ ] Right-click the file → "APEXLang View: Open Graph View" (or use the
      editor title bar icon). Panel opens beside the editor as an indented
      list (page → regions → items), not a floating box canvas.
- [ ] Click a row → detail panel shows properties + a breadcrumb, and the
      source file jumps to that line.
- [ ] Click a row with children (a disclosure triangle ▾/▸) → toggles
      expand/collapse in place.
- [ ] Click "Expand all" / "Collapse all" — whole tree responds correctly.
- [ ] Scroll the tree normally (mouse wheel / scrollbar) — no
      pan/drag/zoom, just a normal scrollable list.

## 2. Search / filter
- [ ] Type a partial region name into the search box.
- [ ] Matching rows' labels turn gold/bold; non-matching rows dim.
- [ ] Press Enter a few times — selection cycles through matches, each one
      scrolled into view.
- [ ] Clear the search box — highlighting clears.

## 3. Cross-reference info (now in the detail panel)
- [ ] Open `fixtures/p00007-buttons-and-refs.apx`.
- [ ] Click the `action` node that references `button: @save`.
- [ ] Detail panel shows a "References" section: `↗ button: Save`. Click
      it — selection jumps to the `save` button's row and its source line.
- [ ] Click that `save` button row directly — detail panel shows a
      "Referenced by" section pointing back at the action.

## 4. Cross-page navigation
- [ ] Still on `p00007-buttons-and-refs.apx`, find the branch node near the
      bottom targeting page 6 — its row shows a small "→ Page 6" badge on
      the right.
- [ ] Click the badge — confirmation dialog appears ("Open graph for Page
      6...?").
- [ ] Click **Cancel** — graph stays on the current file.
- [ ] Click the badge again, click **Open** — graph switches to
      `p00006-stores-report-content-row.apx`.
- [ ] Alternatively: select the branch row, check the detail panel's
      "Navigation" section shows the same "Navigates to Page 6" line,
      clickable with the same confirm flow.

## 5. Large sibling groups (auto-collapse)
- [ ] On `p00006-stores-report-content-row.apx` (or
      `p00011-interactive-report.apx`), find the report region with ~20+
      columns.
- [ ] It should load already collapsed (disclosure ▸, shows a count) —
      not spamming 20 rows by default.
- [ ] Click to expand — all columns appear as normal indented rows,
      scrollable, each clickable to jump to its source line.

## 6. "By Type" view
- [ ] Click the "View: Tree" toolbar button → it flips to "View: By Type".
- [ ] Top-level rows are now type groups ("region (N)", "button (N)",
      etc.), each collapsed by default — click to expand and see members.
- [ ] Click a member row — still jumps to source / shows detail.
- [ ] Click "View: By Type" again → flips to "View: Graph" (boxes-and-wires
      canvas). Click once more → back to "View: Tree".

## 6b. Graph view (canvas)
- [ ] In Graph view, drag to pan, scroll wheel to zoom.
- [ ] Click a node — selects it, shows detail panel, jumps to source.
- [ ] Click a node's `−`/`+N` toggle — collapses/expands that subtree.
- [ ] Dashed purple lines (reference edges) and dashed blue lines
      (navigation edges, ending at an external-page stub box) should be
      visible on `p00007-buttons-and-refs.apx`.
- [ ] Click an external-page stub node — same confirm-before-navigate
      dialog as the badge in Tree view.
- [ ] "Expand all"/"Collapse all" and search highlighting also work here.

## 7. Breadcrumbs + keyboard nav
- [ ] In Tree view, click a deeply nested node (e.g. a `pageItem` inside a
      `region`).
- [ ] Detail panel shows a breadcrumb trail (page › region › item).
- [ ] Click an earlier breadcrumb segment — selection jumps to that
      ancestor.
- [ ] With a row selected, press Down/Up arrow — selection moves to the
      next/previous VISIBLE row (standard tree behavior, matches VS Code's
      own Explorer).
- [ ] Press Right arrow on a collapsed parent — it expands (selection
      stays). Press Right again — moves into the first child.
- [ ] Press Left arrow on an expanded parent — it collapses. Press Left
      again — moves to the parent.
- [ ] Click into the search box and press arrow keys — tree does NOT
      navigate (typing/search should be unaffected).

## 8. File switching
- [ ] Click "Switch file…" in the toolbar — QuickPick list appears, pick a
      different `.apx` file, tree updates.
- [ ] Click a different `.apx` file directly in Explorer — the file opens
      as its own tab (expected, can't be avoided), AND the panel also
      updates to match it (confirmed-acceptable behavior from earlier in
      the project).

## 9. Live refresh
- [ ] With a file's tree open, edit the underlying `.apx` file's text
      (e.g. change a label) and save (or just wait ~400ms after typing).
- [ ] Tree re-parses and updates without needing to reopen the panel.

## 10. Theme check (new — the whole point of this redesign pass)
- [ ] Switch VS Code to a LIGHT theme (Command Palette → "Preferences:
      Color Theme" → e.g. "Light+"). Reopen/refresh the graph panel.
- [ ] Rows, selection highlight, hover, badges, and the detail panel should
      all look native and legible — no dark boxes or invisible text.
- [ ] Switch back to a dark theme — same check.

## 11. Logging / error visibility
- [ ] Command Palette → "APEXLang View: Show Logs" — output channel opens
      with timestamped lines for each panel action.
- [ ] No unexpected errors appear (the one benign "Missing dataLength in
      event" Node-inspector line is now filtered out — if you see it,
      something regressed).

## 12. Same look as 0.1.0 with Diff off (0.2.0 release gate)
- [ ] In a clean VS Code profile, install `apexlang-view-0.1.0.vsix` and the
      new `apexlang-view-0.2.0.vsix` in two windows (or one after the other)
      and open the same files (e.g. `p00007-buttons-and-refs.apx`,
      `p00011-interactive-report.apx`).
- [ ] With Diff off, rows, order, labels, icons, and indentation match
      exactly. The only new things are the Diff button and the ▾ next to it.
- [ ] Interactive Grid files: columns like `APEX$ROW_ACTION` now show as
      `column APEX$ROW_ACTION` (in 0.1.0 they showed as a separate
      `ROW_ACTION` component) — expected fix.

## 13. Diff vs HEAD and Compare with Commit
- [ ] Open a tracked `.apx` file, click **Diff: Off** → it reads
      **Diff: HEAD**. Edit a label (e.g. `label: Apply Changes` →
      `Apply Changes TEST`) and save: the row gets a yellow bar, the node
      count shows `+0 ~1 -0 vs HEAD`.
- [ ] Select that row: the details panel shows old → new. Keep typing: the
      open panel updates. Close the panel and type again: it stays closed.
- [ ] Remove a property line: the details panel shows it as old → (none).
- [ ] Click **Diff: HEAD** → back to **Diff: Off**, highlighting gone.
- [ ] Click **▾** → a list of the last commits that changed this file
      (short hash, first message line, date). Pick an older one: the button
      reads **Diff: a1b2c3d** and highlights the differences. Press Escape
      in the list instead: nothing changes.
- [ ] With a commit chosen, switch to another file: the button falls back
      to **Diff: HEAD**.
- [ ] New, uncommitted file: the button reads **Diff: not tracked**. A file
      outside any git repo: **Diff: no git**. Neither spams the log (one
      line per file).
- [ ] **Highest risk (only tested against a fake git so far):** close VS
      Code, reopen it, and turn Diff on immediately while git is still
      loading. It should show **Diff: HEAD** with highlights (it waits up to
      5 s for git), not **Diff: no git**.
- [ ] **Highest risk:** a brand-new repo (`git init`, no commits) with an
      `.apx` file: Diff reads **Diff: not in HEAD**, and nothing errors in
      the log.

## 14. Telemetry (installed VSIX only)
Telemetry is off in the Extension Development Host (F5) on purpose, so dev
runs never count as users. Test this with `apexlang-view-0.2.0.vsix`
installed in a clean profile (**Extensions → … → Install from VSIX…**).
The log shows `telemetry: off in development/test runs` under F5.
- [ ] With VS Code telemetry off (`telemetry.telemetryLevel: off`): use the
      panel; "Show Logs" shows no `telemetry: sent` lines.
- [ ] VS Code telemetry on, `apexlangView.telemetry.enabled: false`: the log
      shows `telemetry: dropped: setting off` once, and no `sent` lines.
- [ ] Both on: after ~30 s or 20 actions the log shows
      `telemetry: sent N events`, and the events appear in PostHog (EU
      project "APEXLang View") → Activity with no file names, paths, or
      messages in any property.
- [ ] Warning sign: if the log ever shows
      `telemetry: dropped: error without own stack frame` right after an
      error from this extension, error reporting is broken (VS Code may be
      hiding the file paths); report it.
- [ ] Error reaches PostHog (U3): turn Diff on with `git.enabled: false`
      set (the button reads "Diff: no git"), or force any parse error; after
      ~30 s the `$exception` shows in PostHog → Error tracking with
      `extension.js` / `parser.js` frames and no paths.

## 15. Ultrareview fixes (2026-11-20)
- [ ] `Alt+Shift+L` (Win/Linux) / `Cmd+Alt+L` (Mac) opens the view for the
      active `.apx` file; on Windows, AltGr+L in an `.apx` file types the
      layout's character (e.g. `ł` on Polish), not the view.
- [ ] Select a node (detail panel open), then add a new block ABOVE it in
      the file: the same node stays selected and the panel shows its
      values. Delete the selected block: the panel closes.
- [ ] Collapse a group, add a block above it: it stays collapsed.
- [ ] Diff on for a new (uncommitted) file: button says "Diff: not
      tracked"; typing adds no new lines to the log.
- [ ] With `"git.enabled": false`: Diff shows "Diff: no git";
      Compare with Commit says the file is not in a git repository.

## Known-acceptable (don't report as bugs)
- Clicking a file in Explorer opens a native editor tab before the graph
  catches up — unavoidable VS Code behavior, already discussed/accepted.
