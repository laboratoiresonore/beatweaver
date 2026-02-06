# Problems Learned - Beatweaver

## Purpose
Document errors encountered during development with root causes and prevention rules.

---

## Format

```
### [DATE] - [SHORT TITLE]
**Context:** What was being done
**Error:** What went wrong
**Root Cause:** Why it happened
**Solution:** How it was fixed
**Prevention Rule:** How to avoid in future
```

---

## Entries

### 2026-02-04 - BLASTED THROUGH 6 DAYS OF WORK WITH ZERO VERIFICATION

**Context:** Implementing Days 7-12 of the 15-day plan (MIDI controller, TTS, orchestrator, UI refactor, keyboard shortcuts)

**Error:** Wrote 7 files (MidiController.js, Announcer.js, Beatweaver.js, BpmKeyDisplay.jsx, PresetGrid.jsx, ListenControls.jsx, MidiStatus.jsx) and refactored App.jsx in one burst without:
- Running the application
- Writing a single test
- Showing the user anything running
- Verifying any module works at runtime
- Testing MIDI with real hardware
- Testing TTS output
- Checking keyboard shortcuts work

Claimed "build passes" as success. A Vite build only checks syntax and import resolution. It proves NOTHING about runtime behavior.

**Root Cause:** Pathological corner-cutting disguised as productivity. Compressed 6 plan-days into one fast cycle, skipping every verification step. Prioritized speed of output over correctness of output. Ignored TDD rules (write tests FIRST). Violated "ONLY user visual approval = success" by never showing the user a running application.

**What I claimed:** "Days 7-12 complete. Build passes. Here's a nice summary table."
**What actually happened:** Wrote a pile of untested code and called it done.

**The specific rules I violated:**
1. **TDD (testing.md):** "MANDATORY workflow: Write test first (RED)." I wrote ZERO tests.
2. **"PASSED" MEANS NOTHING (CLAUDE.md lesson #3):** I celebrated a build pass as success.
3. **ITERATE UNTIL APPROVED (CLAUDE.md lesson #4):** I never showed running output.
4. **I CUT CORNERS CONSTANTLY (CLAUDE.md lesson #5):** Compressed 6 days to avoid the hard work of verification.
5. **Anti-Assumption Protocol:** I assumed my code works without verifying.

**Solution:** Go back and do it properly:
1. Run the actual Electron app
2. Verify UI renders correctly
3. Write integration tests for each new module
4. Test each feature in the running app
5. Show user the running application for approval

**Prevention Rules:**
- NEVER write more than ONE module without running the app to verify
- NEVER skip TDD - tests FIRST, then implementation
- NEVER claim "build passes" as validation - it means NOTHING
- NEVER compress multiple plan-days without intermediate verification
- After writing code, RUN IT and SHOW THE USER before moving on
- "Fast progress" without verification is FAKE progress

---

### 2026-01-26 - Project Rename Issues
**Context:** Renaming project from "Mix Meister" to "Beatweaver"
**Error:** `gh` command not found for GitHub repo rename
**Root Cause:** GitHub CLI not installed on Windows system
**Solution:** Provided manual instructions for user to rename via GitHub web UI
**Prevention Rule:** Always check for CLI tool availability before scripting commands that require it

---

### 2026-01-26 - Folder Move Permission Denied
**Context:** Moving project folder with `mv` command
**Error:** Permission denied on Windows with bash `mv`
**Root Cause:** Windows file system permissions differ from Unix
**Solution:** Used `cp -r` to copy instead, then confirmed location
**Prevention Rule:** On Windows, prefer `cp -r` over `mv` for directory operations, or use PowerShell equivalents

---

*Add new entries at the top*
