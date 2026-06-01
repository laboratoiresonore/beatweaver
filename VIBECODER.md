# Vibecoder scope - beatweaver

> **What this is:** the local vibe coder for `beatweaver` is a lightweight on-device LLM that handles routine code changes in this repo. It's NOT for architecture work, security review, or anything touching production data. The orchestrator (Claude Code) should defer to this scope when the user's request matches one of the bullets below.

## Repo at a glance
<!-- AUTO:glance -->
- **Local path:** `C:\LeLaboratoireSonore\beatweaver`
- **Primary language:** `JavaScript`
- **Last analyzed:** `2026-05-07T09:42:29Z`
- **Last commit:** `48bf52d - feat(ui): Add 11 visual enhancements for DJ pro experience`
- **Lines of code (rough):** `51`
- **Test command:** `pytest`
<!-- /AUTO:glance -->

## What the vibe coder owns (do delegate)
- Mechanical refactors confined to a single file
- Adding a CLI flag / config option that's already plumbed elsewhere in the repo
- Updating docstrings, type hints, comment formatting
- Fixing a single failing test where the fix is "make the test pass without changing semantics"
- Bumping a dependency version in the manifest (but not migrating call sites)
- Following an established pattern to add a new instance (e.g. another OWUI tool of the same shape, another route handler matching the existing list)
- Adding a new React component that mirrors an existing one in `src/`
- Updating styling within a single .jsx/.css file
- Adding a single new fixture / sample beat to the fixtures directory

## What the vibe coder must NOT touch (do not delegate)
- Schema changes (db migrations, breaking API changes)
- Anything in `_logs/`, `data/`, `cases/`, or other personal-data directories
- OAuth or credential handling
- Cross-repo refactors
- Anything that requires understanding the whole repo at once
- Build/bundler config changes
- Any refactor that touches more than one component

## Hand-off contract
The orchestrator should:
1. Make sure the change is local to one or two files.
2. Spell out the exact files + the desired behavior (the vibe coder is happier with concrete diffs than with goals).
3. Provide an obvious success signal (a test, a log line, a manual smoke check).

## Auto-detected modules (high signal for delegation)
<!-- AUTO:modules -->
- `src/App.jsx`
- `src/styles/index.css`
- `package-lock.json`
- `src/presets/index.js`
- `src/ui/BpmKeyDisplay.jsx`
- `src/ui/ListenControls.jsx`
- `src/ui/PresetGrid.jsx`
- `src/ui/VuMeter.jsx`
- `index.html`
- `package.json`
- `src/core/SynthFactory.js`
- `src/ui/MasterControls.jsx`
<!-- /AUTO:modules -->
