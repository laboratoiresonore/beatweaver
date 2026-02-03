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
