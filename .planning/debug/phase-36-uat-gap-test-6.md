---
status: investigating
trigger: "Investigate Phase 36 UAT gap test 6 in /Users/lmarques/Dev/efx-motion-editor. Context: User reported Save state does not open an OS save dialog to choose where to save the file, while Load state does open the OS dialog. Read the UAT file `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-UAT.md`, relevant phase summaries/specs, and source files around physicsPaintSessionFile, PhysicsPaintStudio, and any Tauri/browser save/load integration. Do not edit files. Return a concise root-cause diagnosis with: root_cause, artifacts (paths + issue), and missing fix actions."
created: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: The active rebuilt PhysicsPaintStudio Save state path is wired to downloadPhysicsPaintState's default browser anchor-download adapter, not to the existing Tauri save-dialog/writeTextFile implementation.
test: Compare PhysicsPaintStudio saveEditableState/onSaveState wiring, physicsPaintSessionFile default adapter, WorkflowStrip Load state input, and legacy PhysicsPaintStudioToolbar Tauri save path.
expecting: Confirm active Save state cannot open OS save dialog because no Tauri dialog API is imported/called in the active path.
next_action: Record confirmed root cause and return diagnosis without editing files.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Save state should open an OS save dialog to choose where to save the file, consistent with Load state opening an OS dialog.
actual: Save state does not open an OS save dialog; Load state does open the OS dialog.
errors: none reported
reproduction: Phase 36 UAT gap test 6; click Save state in Physics Paint Studio and observe no OS save dialog.
started: Phase 36 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-13T00:01:00Z
  checked: Phase 36 UAT gap test 6
  found: UAT marks test 6 failed because Save state does not open an OS save dialog while Load state does.
  implication: Diagnosis should compare the Save state implementation with Load state/picker integration.
- timestamp: 2026-06-13T00:02:00Z
  checked: Source search for physics paint save/load integration
  found: PhysicsPaintStudio imports downloadPhysicsPaintState/parsePhysicsPaintStateFile; PhysicsPaintStudioToolbar contains a Tauri dialog save path; workflow strip exposes Save state and Load state buttons.
  implication: There may be two save-state implementations, and the active Phase 36 workflow may be wired to the browser download helper rather than the Tauri dialog helper.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The active Phase 36 rebuilt PhysicsPaintStudio Save state handler calls downloadPhysicsPaintState(engine.save()) with no adapter, so physicsPaintSessionFile uses its browser anchor-download adapter. That path creates a Blob, sets anchor.download, and clicks it; it never calls @tauri-apps/plugin-dialog.save or @tauri-apps/plugin-fs.writeTextFile. Load state opens a picker because the WorkflowStrip renders an <input type="file"> under a Load state label. A legacy PhysicsPaintStudioToolbar contains the desired Tauri save-dialog/writeTextFile pattern, but the rebuilt active Studio does not use it.
fix: Not applied; user requested no edits. Missing fix is to add/use a Tauri-capable editable-state save adapter in the active PhysicsPaintStudio/physicsPaintSessionFile path, invoking plugin-dialog.save with JSON filter/default filename and writing selected path via plugin-fs.writeTextFile, preserving browser fallback and cancel/error copy.
verification: Static diagnosis only; no files edited and no server run.
files_changed: []
