---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
verified: 2026-06-13T11:08:10Z
status: human_needed
next_action: human verification required before Phase 36 can be marked fully accepted
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed:
    - "UAT gap 4: bottom workflow conversion buttons were removed; Roto/Play tab switching now opens guarded destructive conversion confirmation."
    - "UAT gap 5: onion overlay data now flows from local/persisted Roto frame snapshots and live preview suppresses overlays."
    - "UAT gap 6: Save state now uses a native Tauri save dialog/writeTextFile path when available with browser fallback and clean cancel behavior."
    - "UAT gap 7: Save play stores Play workflow metadata, relaunch hydrates Play mode/range/source context, and saved Play frames are not reused as post-save onion overlays."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the user-run app, launch a Physics Paint layer/window, and inspect the rebuilt five-region UI visually."
    expected: "Top bar, left rail, canvas region, right panel, and workflow strip match the Phase 36 visual spec and remain polished in the real runtime. Grain strength exposes None, Soft, Med, Hard."
    why_human: "Visual fidelity and runtime interaction feel cannot be fully verified by static code inspection or unit tests, and project instructions prohibit running the dev server."
  - test: "Retest tab-driven Roto/Play conversion UX in the live app."
    expected: "There are no standalone Convert Play to Roto / Convert Roto to Play buttons in the bottom strip; switching workflow tabs opens the appropriate destructive confirmation, and Play lane clicks only inspect/navigate."
    why_human: "Runtime interaction flow and visual absence/presence of controls require user-run app verification."
  - test: "Retest onion controls with multiple saved/navigated Roto frames and during Play preview."
    expected: "Previous/next/count controls visibly update onion overlays from adjacent Roto snapshots; live Play preview hides overlays; Save play does not leave a yellow/orange overlay artifact."
    why_human: "Canvas overlay rendering and visual artifact absence require live browser/canvas verification."
  - test: "Retest Save state and Load state in the desktop app."
    expected: "Save state opens the native macOS/Tauri save dialog and writes editable JSON when a path is selected; cancel is non-error; Load state still accepts valid JSON and rejects invalid JSON with the required copy."
    why_human: "Native OS save dialog behavior cannot be proven by static source checks or non-Tauri unit tests."
  - test: "Retest Play preview, Save play, close/reopen EFX Physics for the same layer, and dev export."
    expected: "Play remains preview-only until Save play; Save play keeps the standalone window open with a summary; reopening restores Play canvas mode/range/source edits; dev export produces inspectable PNG/manifest proof metadata."
    why_human: "End-to-end desktop runtime, canvas frame capture, persistence round-trip, and file/download output require live app verification."
---

# Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof Verification Report

**Phase Goal:** Users can work in a rebuilt, production-grade physics paint package UI that preserves standalone sessions and produces inspectable rendered output suitable for later cached editor compositing.
**Verified:** 2026-06-13T11:08:10Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plans 36-08 through 36-11 and follow-up fix commit `c72d7ca`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states for painting, erasing, tool/settings changes, save/load, and export actions. | VERIFIED | `PhysicsPaintStudio.tsx` renders the five-region layout through `PhysicsPaintTopBar`, `PhysicsPaintToolRail`, canvas region, `PhysicsPaintRightPanel`, and `PhysicsPaintWorkflowStrip` (lines 1053-1200). Gap closure evidence: `PhysicsPaintWorkflowStrip.tsx` now uses Roto/Play tab clicks to call `requestWorkflowModeChange` and confirmation state instead of standalone conversion buttons (lines 254-318, 385-397); `PhysicsPaintStudio.tsx` has contextual shortcut handling and wires all child callbacks. |
| 2 | User can save the current standalone paint session as JSON from the rebuilt UI. | VERIFIED | `PhysicsPaintWorkflowStrip.tsx` renders `Save state` (lines 312-318), `PhysicsPaintStudio.tsx` wires `onSaveState={saveEditableState}` (line 1186), and `saveEditableState` calls `downloadPhysicsPaintState(engine.save())` (lines 757-776). `physicsPaintSessionFile.ts` now dynamically uses Tauri `plugin-dialog.save` and `plugin-fs.writeTextFile` when available, with browser fallback (lines 48-117). |
| 3 | User can reload saved JSON and continue testing the same paint session without losing editable physics paint state. | VERIFIED | `loadEditableState` parses selected JSON via `parsePhysicsPaintStateFile`, validates through `isSerializedProject`, then calls `engine.load(state)` with success/error status (PhysicsPaintStudio.tsx lines 778-799; physicsPaintSessionFile.ts lines 38-45). Save play persistence now also preserves editable state and workflow metadata through `physicPaintStore.applySequence` and relaunch context. |
| 4 | User can export the current rendered physics paint result as a PNG or still image from the rebuilt UI. | VERIFIED | `PhysicsPaintTopBar` receives `onExportDebugProof={exportDebugProof}` (PhysicsPaintStudio.tsx line 1078). `exportDebugProof` captures `engine.exportCompositeCanvas().toDataURL('image/png')` and builds still/manifest metadata using `buildPhysicsPaintStillExport` / `buildPhysicsPaintDebugManifest` (lines 801-830). |
| 5 | User can produce a frame-sequence or cache-manifest proof from the live engine for future editor consumption. | VERIFIED | `savePlay` uses `AnimationPlayer.play` callbacks to capture live PNG frames and sends `apply-play-canvas` payloads with rendered frames and editable state (PhysicsPaintStudio.tsx lines 685-738). `physicPaintStore.applySequence` stores all frames plus Play metadata (physicPaintStore.ts lines 201-231). Dev export helpers produce bounded manifest/still proof metadata from live captured frames. |
| 6 | The rebuilt package UI remains standalone-package-first and does not add editor integration scope beyond rendered-output proof artifacts. | VERIFIED | Bridge/store changes are limited to validated launch/apply/frame-sync seams and rendered-output metadata. `PhysicPaintLaunchContext` carries narrow optional workflow metadata (physicPaint.ts lines 21-34); store serialization carries rendered frames, editable state, and workflow metadata only (physicPaintStore.ts lines 10-18, 111-155); no headless replay, `renderFromStrokes`, `.mce` migration compatibility, or editor compositing implementation was added in verified files. |

**Score:** 6/6 truths verified

## Prior Gap Re-check

| Prior Gap | Status | Evidence |
|---|---|---|
| UAT gap 4: conversion UX should happen through Roto/Play tab switching and not separate conversion buttons. | CLOSED | `PhysicsPaintWorkflowStrip.tsx` no longer renders separate conversion action buttons in `.physics-paint-state-actions`; tab buttons call `requestWorkflowModeChange`, which sets confirmation state, and confirmation `Continue` invokes conversion callbacks (lines 163-177, 243-252, 254-318, 385-397). Source-contract test asserts no standalone conversion buttons and tab-driven confirmation (`PhysicsPaintWorkflowStrip.test.ts` lines 122-145). |
| UAT gap 5: onion controls were present but not functional. | CLOSED IN CODE / NEEDS LIVE CANVAS RETEST | `PhysicsPaintStudio.tsx` snapshots Roto frame preview images via `rotoPreviewFramesRef` and `buildRotoPreviewFrame` (lines 213-221, 491-505, 647-656); `buildOnionPreviewFrames` reads persisted store frames plus local Roto snapshots and returns empty while playing (lines 832-854). Workflow strip filters by count/previous/next/live preview state (lines 133-139, 371-383). |
| UAT gap 6: Save state should open OS save dialog in desktop app. | CLOSED IN CODE / NEEDS DESKTOP RETEST | `physicsPaintSessionFile.ts` default adapter detects Tauri, imports `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`, calls `save` with JSON filter/default filename, writes via `writeTextFile`, returns clean cancel on null path, and falls back to browser download outside Tauri (lines 48-117). Tests cover native save, cancel, fallback, and PNG exclusion. |
| UAT gap 7: Save play should not leave yellow overlay, should persist Play source/range, and reopening should restore Play canvas context. | CLOSED IN CODE / NEEDS LIVE RETEST | `savePlay` stores captured frames in `latestPlayFramesRef` for conversion availability but clears rendered overlay state via `setLatestPlayFrames([])` and bumps `playFramesVersion` (PhysicsPaintStudio.tsx lines 724-736); `buildOnionPreviewFrames` no longer adds latest Play frames as onion overlays (lines 832-854). Store persists Play metadata in `applySequence` and serializes/hydrates it (physicPaintStore.ts lines 53-78, 111-155, 201-231). Bridge relaunch context includes persisted metadata and uses Play start frame when reopening (physicPaintBridge.ts lines 193-216). Studio initializes workflow mode and frame count from launch context (PhysicsPaintStudio.tsx lines 254-256, 315-329). Native launch context parity exists in `lib.rs` lines 14-40 and URL forwarding lines 136-151. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Integrated five-region rebuilt Physics Paint UI and behavior callbacks | VERIFIED | Exists and substantive; renders top bar, tool rail, canvas region, right panel, workflow strip; wires save/load/play/export/conversion/onion/frame-sync and shortcut behavior. |
| `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` | Bottom Roto/Play workflow strip, save/play controls, lanes, tab-driven confirmations | VERIFIED | Exists and substantive; no standalone conversion buttons; tab transition confirmation, inspection-only Play lane, save/load state actions, onion overlay rendering. |
| `app/src/components/physic-paint/physicsPaintSessionFile.ts` | Editable JSON save/load helper with native save adapter and browser fallback | VERIFIED | Exists and substantive; validates JSON, serializes editable state only, uses Tauri dialog/fs when available, browser fallback otherwise. |
| `app/src/stores/physicPaintStore.ts` | Rendered frame/editable state storage plus Play workflow metadata persistence | VERIFIED | Exists and substantive; applies still/sequence/convert payloads, persists metadata to project outputs, hydrates metadata, bumps `physicPaintVersion`. |
| `app/src/lib/physicPaintBridge.ts` | Launch context, apply payload receiver, frame-sync receiver, persisted metadata relaunch | VERIFIED | Exists and substantive; validates/apply routes payloads, handles seek-frame, includes workflow metadata in browser/Tauri launch context. |
| `app/src/types/physicPaint.ts` | Typed launch/apply/rendered-frame/workflow metadata contracts and validators | VERIFIED | Exists and substantive; includes workflow metadata fields and validators for launch/apply/result/frame-sync/rendered frames. |
| `app/src-tauri/src/lib.rs` | Native launch-context parity for workflow metadata | VERIFIED | Exists and substantive; native launch context accepts workflow metadata and forwards it as query parameters. |
| `.planning/REQUIREMENTS.md` | Requirement definitions and traceability for Phase 36 IDs | VERIFIED | Defines and traces `UI-REBUILD-01`, `UI-REBUILD-02`, `SAVE-01`, `SAVE-02`, `OUT-01`, and `OUT-02` to Phase 36 (lines 24-34, 82-87). |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `PhysicsPaintStudio.tsx` | `PhysicsPaintWorkflowStrip.tsx` | Component render and callback props | WIRED | `<PhysicsPaintWorkflowStrip>` receives mode, frame state, save/load/play, navigation, onion, conversion, and missing-frames props (lines 1168-1200). |
| `PhysicsPaintWorkflowStrip.tsx` | `PhysicsPaintStudio.tsx` conversion callbacks | Tab-driven confirmation and `onConvert*` props | WIRED | Tab clicks open confirmation; `Continue` calls `onConvertPlayToRoto` / `onConvertRotoToPlay`; Studio passes `convertPlayToRoto` and `convertRotoToPlay`. |
| `PhysicsPaintStudio.tsx` | `physicsPaintSessionFile.ts` | Helper import and calls | WIRED | Imports `downloadPhysicsPaintState` / `parsePhysicsPaintStateFile`; save calls native-capable helper, load validates and engine-loads state. |
| `physicsPaintSessionFile.ts` | Tauri dialog/fs plugins | Dynamic imports in Tauri runtime | WIRED | `loadTauriNativeSaveAdapter` imports `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`, exposes `saveDialog` / `writeTextFile`. |
| `PhysicsPaintStudio.tsx` | `physicsPaintDevExport.ts` | Helper import and calls | WIRED | `exportDebugProof` uses live `engine.exportCompositeCanvas()` PNG data URL and builds still/manifest metadata. |
| `physicPaintBridge.ts` | `physicPaintStore.ts` | Validated apply payload routing | WIRED | Routes `apply-canvas`, `apply-play-canvas`, `convert-play-to-roto`, and `convert-roto-to-play` to store methods. |
| `physicPaintStore.ts` | `physicPaintBridge.ts` relaunch context | Persisted workflow metadata | WIRED | Store saves/loads metadata; bridge `createPhysicPaintLaunchContext` reads it and includes mode/range/source in context. |
| `physicPaintBridge.ts` | `timelineStore.ts` | Frame-sync receiver | WIRED | `handlePhysicPaintFrameSyncMessage` validates then calls `timelineStore.seek(frame)` and `timelineStore.ensureFrameVisible(frame)`. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `PhysicsPaintStudio.tsx` | `settings`, `engine`, `launchContext`, `framesToApply`, `onionPreviewFrames`, `latestPlayFramesRef` | `EfxPaintCanvas` engine callbacks, parsed URL/Tauri launch event, live `AnimationPlayer` captures, local Roto snapshots, `physicPaintStore.getFrames` | Yes | FLOWING |
| `PhysicsPaintWorkflowStrip.tsx` | mode/frame/onion/confirmation props | Props from Studio state and helper predicates; tab clicks call Studio-owned conversion callbacks | Yes | FLOWING |
| `physicsPaintSessionFile.ts` | editable JSON contents | `engine.save()` passed by Studio; native dialog-selected path or browser adapter | Yes | FLOWING |
| `physicPaintStore.ts` | frames, editable state, workflow metadata | Validated apply payloads and project output hydration | Yes | FLOWING |
| `physicPaintBridge.ts` | launch/apply/frame-sync payloads | Browser/Tauri messages, store metadata, typed validators | Yes | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Targeted Phase 36 regression tests pass | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/physicsPaintSessionFile.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts src/types/physicPaint.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | Exit code 0; 6 files passed, 57 tests passed | PASS |
| App TypeScript typecheck passes | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` | Exit code 0 | PASS |
| Tauri Rust crate checks | `cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml` | Exit code 0 | PASS |
| Dev server runtime | Not run | Project instruction: do not run the server | SKIPPED |

## Probe Execution

No phase probe scripts were declared or found for Phase 36 verification. Step 7c skipped.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| UI-REBUILD-01 | 36-01, 36-05, 36-06, 36-07, 36-08, 36-09 PLAN frontmatter; REQUIREMENTS.md lines 26, 82 | User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states. | SATISFIED IN CODE / NEEDS HUMAN VISUAL ACCEPTANCE | Five-region UI is wired; tab-driven conversion and onion gap fixes exist in code/tests; visual polish still requires live app review. |
| UI-REBUILD-02 | 36-01, 36-03, 36-04, 36-07, 36-08, 36-09 PLAN frontmatter; REQUIREMENTS.md lines 27, 83 | Standalone-package-first; no editor integration scope beyond proof artifacts. | SATISFIED | Code remains limited to standalone launch/apply/frame-sync seams, rendered frames, editable state, and workflow metadata; no editor compositing/headless replay added. |
| SAVE-01 | 36-02, 36-04, 36-05, 36-06, 36-07, 36-08, 36-09, 36-10, 36-11 PLAN frontmatter; REQUIREMENTS.md lines 31, 84 | User can save standalone paint session as JSON. | SATISFIED IN CODE / NEEDS DESKTOP DIALOG RETEST | Workflow `Save state` calls Studio `saveEditableState`, which downloads/writes `engine.save()` editable JSON through native-capable helper; native OS dialog behavior needs live Tauri verification. |
| SAVE-02 | 36-02, 36-04, 36-05, 36-06, 36-07, 36-08, 36-10, 36-11 PLAN frontmatter; REQUIREMENTS.md lines 32, 85 | User can reload saved JSON and continue testing the same paint session. | SATISFIED | Load path validates JSON through `parsePhysicsPaintStateFile` / `isSerializedProject` and calls `engine.load(state)`; invalid copy is tested. Play metadata persistence also round-trips through store/bridge. |
| OUT-01 | 36-03, 36-04, 36-05, 36-06, 36-07, 36-08, 36-09, 36-11 PLAN frontmatter; REQUIREMENTS.md lines 33, 86 | User can export current rendered paint result as PNG/still image. | SATISFIED | `exportDebugProof` captures a live composite canvas PNG; save/apply still path sends `renderedFrame` PNG output. |
| OUT-02 | 36-03, 36-04, 36-05, 36-06, 36-07, 36-08, 36-11 PLAN frontmatter; REQUIREMENTS.md lines 34, 87 | User can produce frame-sequence or cache-manifest proof from live engine. | SATISFIED | `savePlay` captures live `AnimationPlayer` frames as PNG data URLs; manifest helper builds bounded `manifest.json` proof; store persists frame sequences and metadata. |

No orphaned Phase 36 requirement IDs were found in `.planning/REQUIREMENTS.md`; all six requested IDs are defined and traced to Phase 36.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 53, 81, 279, 648, 681, 686, 748 | `return null` guard returns | INFO | Guard clauses for absent launch context, engine, ready/apply context, or failed save/play; not placeholders. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 833 | `return []` | INFO | Expected no onion overlays while playing or before launch context; not a hollow data path. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 304, 325, 334, 339, 357, 636 | `console.warn/info/error` diagnostics | INFO | Runtime diagnostics for native listener/launch/restore paths; not console-only implementations. |
| `app/src/lib/physicPaintBridge.ts` | 102, 135 | `return () => {}` | INFO | No-op cleanup for unsupported target/window contexts; not user-visible stub behavior. |

No blocker debt markers (`TBD`, `FIXME`, `XXX`) were found in the verified phase implementation files.

## Human Verification Required

### 1. Visual layout and interaction review

**Test:** Open the user-run app, launch a Physics Paint layer/window, and inspect the rebuilt five-region UI visually.  
**Expected:** Top bar, left rail, canvas region, right panel, and workflow strip match the Phase 36 visual spec and remain polished in the real runtime. Grain strength exposes `None`, `Soft`, `Med`, `Hard`.  
**Why human:** Visual fidelity and runtime interaction feel cannot be fully verified by static code inspection or unit tests, and project instructions prohibit running the dev server.

### 2. Tab-driven Roto/Play conversion UX

**Test:** In the live app, switch between `Roto canvas` and `Play canvas`, inspect the bottom strip, and click inside the Play lane.  
**Expected:** There are no standalone conversion buttons; cross-mode tab switches open destructive confirmation; Play lane clicks only inspect/navigate and never publish/convert/delete data.  
**Why human:** Runtime UX and visual control placement require live app verification.

### 3. Onion overlay behavior

**Test:** Save/navigate between multiple Roto frames, toggle previous/next/count onion controls, run Play preview, then Save play.  
**Expected:** Onion controls visibly change adjacent Roto overlays; live preview hides overlays; Save play does not leave a yellow/orange overlay artifact.  
**Why human:** Canvas overlay rendering and artifact absence require a live browser/canvas check.

### 4. Desktop Save state / Load state flow

**Test:** Click `Save state` and `Load state` in the desktop app.  
**Expected:** Save state opens the native macOS/Tauri save dialog and writes editable JSON when a path is selected; cancel is non-error; Load state accepts valid exported JSON and rejects invalid JSON with the required message.  
**Why human:** Native OS dialog behavior cannot be proven by static code or non-Tauri unit tests.

### 5. Save play persistence and output proof

**Test:** Paint in Play mode, run Play preview, Save play, close/reopen EFX Physics for the same layer, and run dev export in development.  
**Expected:** Play remains preview-only until Save play; Save play keeps the window open with a summary; reopening restores Play canvas mode/range/source edits; dev export produces inspectable PNG/manifest proof metadata.  
**Why human:** End-to-end desktop runtime, canvas capture, persisted project round-trip, and output file/download behavior require live app verification.

## Gaps Summary

No code-level blocking gaps remain after the 36-08 through 36-11 gap-closure work and follow-up fix commit `c72d7ca`. The prior UAT gaps are closed in code with supporting tests: tab-driven conversion UX, functional Roto onion preview sourcing, native Save state adapter, and Save play workflow metadata/relaunch hydration.

The phase remains `human_needed`, not `passed`, because the remaining acceptance items are runtime/visual/Tauri/canvas behaviors that require user-run app verification, and project instructions prohibit starting the dev server during automated verification.

---

_Verified: 2026-06-13T11:08:10Z_  
_Verifier: Claude (gsd-verifier)_
