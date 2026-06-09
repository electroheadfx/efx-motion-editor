---
status: diagnosed
trigger: "Investigate Phase 35 UAT issue test 4 in /Users/lmarques/Dev/efx-motion-editor. The user reported: \"save button doesn't save a file, I see nothing, maybe its for the next release ?\" Expected: standalone persistence controls labelled Save state / Load state; Save state downloads or saves editable physics paint state JSON. Relevant files likely include packages/efx-physic-paint/demo/src/App.tsx, Toolbar.tsx, styles.css and any efx-physic-paint state serialization code. Read .planning/phases/35-interactive-physics-paint-controls/35-UAT.md and source files. Return root cause, exact files/functions involved, and minimal fix guidance. Do not edit files."
created: 2026-06-09T00:00:00Z
updated: 2026-06-09T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "Toolbar.onSave creates a detached anchor and immediately revokes the object URL; in the standalone/Tauri webview this can result in no visible file save/download even though engine serialization exists."
test: "Confirm engine.save returns a plain SerializedProject and search for alternate save/download helpers or Tauri filesystem/dialog persistence."
expecting: "If true, engine serialization is valid but demo has only browser-style detached-anchor download and no Tauri/native save path or DOM-attached delayed-revoke download path."
next_action: "Search app/package for Tauri dialog/fs APIs and save-state implementations."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "standalone persistence controls labelled Save state / Load state; Save state downloads or saves editable physics paint state JSON"
actual: "save button doesn't save a file; user sees nothing; maybe for next release"
errors: "none reported"
reproduction: "Phase 35 UAT test 4; use standalone physics paint persistence controls and click save"
started: "Phase 35 UAT"

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-09T00:00:00Z
  checked: "35-UAT.md test 4"
  found: "Test 4 expects controls labelled Save state / Load state; result is issue with report that save button does not save a file and user sees nothing."
  implication: "Failure is specifically standalone editable-state persistence, not apply/rendered-output transport."
- timestamp: 2026-06-09T00:00:00Z
  checked: "packages/efx-physic-paint/demo/src/Toolbar.tsx"
  found: "Toolbar renders Save state and Load state buttons. onSave calls engine.save(), creates application/json Blob, creates an anchor, sets href/download, calls a.click(), then immediately revokes the object URL."
  implication: "Labels and handler exist; root cause is likely browser/Tauri download semantics or engine.save() output, not missing UI."
- timestamp: 2026-06-09T00:00:00Z
  checked: "packages/efx-physic-paint/demo/src/App.tsx"
  found: "Toolbar is rendered only when engine exists; diagnostics/apply controls are separate and do not affect onSave/onLoad."
  implication: "Save should be available after engine ready and is independent from app bridge readiness."

- timestamp: 2026-06-09T00:00:00Z
  checked: "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts and src/types.ts"
  found: "EfxPaintEngine.save() returns serializeProject(); SerializedProject is a plain JSON-compatible v2 object with width, height, strokes, and settings. load() accepts the same shape."
  implication: "State serialization exists and is not the blocker for saving editable JSON."
- timestamp: 2026-06-09T00:00:00Z
  checked: "app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx"
  found: "The in-app standalone physics paint toolbar duplicates the package demo onSave implementation: create Blob/object URL, detached anchor.click(), immediate URL.revokeObjectURL(). No Tauri dialog/save or filesystem write path is attempted."
  implication: "The actual Phase 35 standalone window has the same fragile browser-download implementation as the package demo."
- timestamp: 2026-06-09T00:00:00Z
  checked: "app/src-tauri/capabilities/default.json and generated schema"
  found: "Capability includes dialog:default and dialog:allow-open but not dialog:allow-save; fs:allow-write-text-file is present. Main toolbar already imports @tauri-apps/plugin-dialog save."
  implication: "A native Tauri save-file implementation is intended/available in the app, but the physics paint window cannot currently call save dialog unless dialog:allow-save is added; current browser-style download provides no save dialog in Tauri and can appear to do nothing."
- timestamp: 2026-06-09T00:00:00Z
  checked: "app/src-tauri/src/lib.rs and app/src/main.tsx"
  found: "Physics paint standalone is an app webview at /physics-paint with label efx-physic-paint, not the package Vite demo in normal UAT."
  implication: "Minimal product fix belongs in app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx plus Tauri capabilities; package demo can be kept in sync if desired."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "The Save state button is wired only to a browser download hack in PhysicsPaintStudioToolbar.onSave (and the package demo Toolbar.onSave): it creates a Blob URL, clicks a detached <a download>, and immediately revokes the URL. In the Tauri standalone webview this does not open a native save dialog or reliably create a visible file, so the user sees no saved state. Serialization itself is present and valid via EfxPaintEngine.save()/SerializedProject. The Tauri app already has fs write permission, but the physics paint save path does not use @tauri-apps/plugin-dialog save + @tauri-apps/plugin-fs writeTextFile, and default.json lacks dialog:allow-save."
fix: "Use native Tauri persistence for the app standalone: make onSave async, JSON.stringify(engine.save(), null, 2), call @tauri-apps/plugin-dialog save with JSON filter/defaultPath, then @tauri-apps/plugin-fs writeTextFile to the selected path; add dialog:allow-save to app/src-tauri/capabilities/default.json. Keep a browser fallback that appends the anchor to document.body and revokes the object URL after a timeout. Optionally mirror the safer fallback in packages/efx-physic-paint/demo/src/Toolbar.tsx."
verification: "Diagnosis-only investigation; no files edited."
files_changed: []
