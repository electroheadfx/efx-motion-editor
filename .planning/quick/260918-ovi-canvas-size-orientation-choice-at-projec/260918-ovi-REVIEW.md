---
phase: 260918-ovi-canvas-size-orientation-choice-at-projec
reviewed: 2026-09-18T00:00:00Z
depth: quick
files_reviewed: 17
files_reviewed_list:
  - app/src-tauri/src/commands/project.rs
  - app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts
  - app/src/components/project/NewProjectDialog.test.tsx
  - app/src/components/project/NewProjectDialog.test.tsx.test.ts
  - app/src/components/project/NewProjectDialog.tsx
  - app/src/components/project/canvasFormatPresets.test.ts
  - app/src/components/project/canvasFormatPresets.ts
  - app/src/components/views/SettingsView.test.tsx
  - app/src/components/views/SettingsView.test.tsx.test.ts
  - app/src/components/views/SettingsView.tsx
  - app/src/lib/exportEngine.test.ts
  - app/src/lib/ipc.ts
  - app/src/stores/projectStore.efxPaintCutover.test.ts
  - app/src/stores/projectStore.test.ts
  - app/src/stores/projectStore.ts
  - app/src/stores/sequenceStore.test.ts
  - app/src/stores/sequenceStore.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 260918-ovi: Code Review Report

**Reviewed:** 2026-09-18T00:00:00Z
**Depth:** quick
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Quick-depth pattern-matching scan across 17 files (Rust command, Preact/TS sources, tests). No hardcoded secrets, no dangerous function calls (`eval`, `innerHTML`, `dangerouslySetInnerHTML`, `exec`, `system`, `shell_exec`, `passthru`), no debug artifacts (`console.log`, `debugger;`, `TODO`, `FIXME`, `XXX`, `HACK`), no empty catch blocks, and no Rust panic primitives (`unsafe`, `.unwrap()`, `.expect()`, `panic!`, `unimplemented!`, `todo!`) in `project.rs`.

Project-mandate scan for `useState` flagged `NewProjectDialog.tsx`, but the file's own comment at lines 18-20 explicitly documents the five `useState` fields at lines 44-48 as pre-existing legacy state deliberately left out of the refactor scope. New canvas state correctly uses module-scope `@preact/signals` — the mandate is upheld for new code. However, that module-scope signal choice surfaces one correctness concern around state persistence across dialog mount cycles, recorded below as a warning.

## Warnings

### WR-01: Module-scope canvas signals leak state across dialog mount cycles

**File:** `app/src/components/project/NewProjectDialog.tsx:21-26`
**Issue:** The three new signals — `selectedPresetId` (line 21), `customWidth` (line 25), `customHeight` (line 26) — are declared at module scope, which means they persist for the lifetime of the JS module and are NOT reset when the dialog unmounts and remounts. The five sibling `useState` fields at lines 44-48 (`name`, `fps`, `dirPath`, `isCreating`, `error`) are component-scoped and DO reset to defaults on every mount. The result is an inconsistent UX: reopening the New Project dialog restores the previously chosen preset and custom dimensions, while every other field returns to its initial value. If the design intent is "fresh dialog each open" (which the legacy `useState` defaults strongly suggest), the canvas selection silently leaks the previous session's choices into a new project the user believes is starting from defaults. If instead the intent is "remember last canvas choice across opens," that asymmetry vs. name/fps/dirPath is unexplained and should be documented.
**Fix:** Either reset the three signals inside the mount `useEffect` at lines 52-55 (e.g. `selectedPresetId.value = DEFAULT_CANVAS_FORMAT_PRESET_ID; customWidth.value = 1920; customHeight.value = 1080;`), or convert them to component-scope signals created inside `NewProjectDialog` via `useSignal(...)` so they follow the same lifecycle as the `useState` fields. If persistence across opens is the deliberate design, add a one-line comment at line 21 stating so, and consider whether `fps` should follow the same pattern for consistency.

---

_Reviewed: 2026-09-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
