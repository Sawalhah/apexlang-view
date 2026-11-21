# Development notes

Not part of the public README. For me only.

## Run and test

```bash
npm test          # regression suite (node:test)
```

Press `F5` to launch an Extension Development Host, then open a file from `fixtures/`. Telemetry is off in F5 runs on purpose; test it with the installed VSIX (see `TESTING-CHECKLIST.md` §14).

## Package

```bash
npx @vscode/vsce package
```

## Coverage

Parser checked against Oracle's 2,228 APEX 26.1 sample, starter and utility app files (`test/corpus.test.js`, baseline 16 suspicious, 0 errors) and against Oracle's published APEXlang grammar, 26.1 and 26.2 (`reference/`).

## Commands

| Command | Shortcut |
|---|---|
| Open Graph View | `Alt+Shift+L` / `Cmd+Alt+L` |
| Switch File | |
| Open App Map | |
| Toggle Diff vs HEAD | |
| Compare with Commit… | |
| Show Logs | |

## Where things are

- `ROADMAP.md`: every request and its status
- `TESTING-CHECKLIST.md`: manual test before each release
- `docs/DESIGN-v0.2-v0.3.md` and `docs/review/`: design and review history
- `media/demo.gif`: old 0.1.0 recording, no longer used in the README
