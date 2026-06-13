---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
verified: 2026-06-13T07:34:48Z
status: human_needed
next_action: human verification required before Phase 36 can be marked fully accepted
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "PhysicsPaintTopBar.tsx now exposes Grain strength choices None, Soft, Med, Hard."
    - ".planning/REQUIREMENTS.md now defines and traces UI-REBUILD-01 and UI-REBUILD-02."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the user-run app, launch a Physics Paint layer/window, and inspect the rebuilt five-region UI visually."
    expected: "Top bar, left rail, canvas region, right panel, and workflow strip match the Phase 36 visual spec and remain polished in the real runtime. Grain strength exposes None, Soft, Med, Hard."
    why_human: "Visual fidelity and runtime interaction feel cannot be fully verified by static code inspection or unit tests, and project instructions prohibit running the dev server."
  - test: "Paint, Save state JSON, Load the saved JSON, run Play preview, Save play, and use dev export in development."
    expected: "Editable state round-trips, Play preview is preview-only until Save play, Save play keeps the window open with a summary, and dev export produces inspectable proof metadata/artifacts."
    why_human: "Canvas engine behavior, browser file downloads, and generated visual output require a live app/runtime check."
---

# Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof Verification Report

**Phase Goal:** Users can work in a rebuilt, production-grade physics paint package UI that preserves standalone sessions and produces inspectable rendered output suitable for later cached editor compositing.
**Verified:** 2026-06-13T07:34:48Z
**Status:** human_needed
**Re-verification:** Yes — after gap-fix commit `3fd91f4`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states for painting, erasing, tool/settings changes, save/load, and export actions. | VERIFIED | `PhysicsPaintStudio.tsx` renders the five-region layout (`PhysicsPaintTopBar`, `PhysicsPaintToolRail`, canvas region, `PhysicsPaintRightPanel`, `PhysicsPaintWorkflowStrip`) and wires callbacks. Prior gap closed: `PhysicsPaintTopBar.tsx` defines `GRAIN_STRENGTH_OPTIONS` with `None`, `Soft`, `Med`, `Hard` at lines 45-50 and renders them under `Grain strength`. |
| 2 | User can save the current standalone paint session as JSON from the rebuilt UI. | VERIFIED | `PhysicsPaintWorkflowStrip.tsx` renders `Save state`; `PhysicsPaintStudio.tsx` wires `onSaveState={saveEditableState}`; `saveEditableState` calls `downloadPhysicsPaintState(engine.save())`. |
| 3 | User can reload saved JSON and continue testing the same paint session without losing editable physics paint state. | VERIFIED | `PhysicsPaintWorkflowStrip.tsx` renders `Load state`; `PhysicsPaintStudio.tsx` wires file input changes to `parsePhysicsPaintStateFile`, validates via `isSerializedProject`, then calls `engine.load(state)`. |
| 4 | User can export the current rendered physics paint result as a PNG or still image from the rebuilt UI. | VERIFIED | `PhysicsPaintTopBar.tsx` renders the dev-gated `Export PNGs + manifest` button; `PhysicsPaintStudio.tsx` captures `engine.exportCompositeCanvas().toDataURL('image/png')` and builds still metadata with `buildPhysicsPaintStillExport`. |
| 5 | User can produce a frame-sequence or cache-manifest proof from the live engine for future editor consumption. | VERIFIED | `physicsPaintDevExport.ts` builds bounded `manifest.json` metadata from live `PhysicPaintRenderedFrame` PNG data URLs; `savePlay` captures `AnimationPlayer` frames as PNG data URLs and dev export builds a manifest from captured frames. |
| 6 | The rebuilt package UI remains standalone-package-first and does not add editor integration scope beyond rendered-output proof artifacts. | VERIFIED | Phase 36 UI/bridge code uses standalone launch/apply/frame-sync seams and rendered-output payloads; no `.mce` persistence, headless replay, `renderFromStrokes`, or editor compositing implementation was added in the verified Phase 36 files. |

**Score:** 6/6 truths verified

## Prior Gap Re-check

| Prior Gap | Status | Evidence |
|---|---|---|
| `PhysicsPaintTopBar.tsx` must expose Grain strength choices None, Soft, Med, Hard. | CLOSED | `app/src/components/physic-paint/PhysicsPaintTopBar.tsx` lines 45-50 define exactly `None`, `Soft`, `Med`, `Hard`; lines 150-163 render the mapped options in the `Grain strength` segmented control and call `onGrainStrengthChange(option.value)`. |
| `.planning/REQUIREMENTS.md` must define and trace UI-REBUILD-01 and UI-REBUILD-02. | CLOSED | `.planning/REQUIREMENTS.md` lines 24-28 define `UI-REBUILD-01` and `UI-REBUILD-02`; lines 82-83 trace both to Phase 36 with Complete status. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Integrated five-region rebuilt Physics Paint UI and behavior callbacks | VERIFIED | Renders top bar, rail, canvas region, right panel, workflow strip; preserves engine mount, save/load, preview, publish, dev export, conversion, and shortcut callbacks. |
| `app/src/components/physic-paint/PhysicsPaintTopBar.tsx` | Top controls, compact status, dev export control, exact Grain strength choices | VERIFIED | Substantive and wired; `GRAIN_STRENGTH_OPTIONS` includes `None`, `Soft`, `Med`, `Hard` and maps to rendered buttons. |
| `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` | Bottom Roto/Play workflow strip, save/play controls, lanes, confirmations | VERIFIED | Renders Roto/Play modes, save/load, play controls, timeline lanes, conversion confirmations, and inspection-only Play range handling. |
| `app/src/lib/physicPaintBridge.ts` | Launch FPS, apply payload receiver, frame-sync receiver | VERIFIED | Carries optional FPS, applies validated payloads, routes conversion payloads to store, and handles `physic-paint:seek-frame`. |
| `app/src/stores/physicPaintStore.ts` | Rendered frame/editable state storage and conversion mutations | VERIFIED | Stores frames/editable state, applies canvas/sequence, converts Play/Roto, removes ranges, and bumps `physicPaintVersion`. |
| `app/src/types/physicPaint.ts` | Typed launch/apply/rendered-frame contracts and validators | VERIFIED | Provides guards for launch context, frame sync, apply payloads, rendered frames, and serialized project state. |
| `.planning/REQUIREMENTS.md` | Requirement definitions and traceability for Phase 36 IDs | VERIFIED | Defines and traces `UI-REBUILD-01`, `UI-REBUILD-02`, `SAVE-01`, `SAVE-02`, `OUT-01`, and `OUT-02`. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `PhysicsPaintStudio.tsx` | `PhysicsPaintTopBar.tsx` | Component render and callback props | WIRED | `<PhysicsPaintTopBar>` receives engine settings, readiness/status, grain-strength state, and `onExportDebugProof={exportDebugProof}`. |
| `PhysicsPaintStudio.tsx` | `PhysicsPaintWorkflowStrip.tsx` | Component render and callback props | WIRED | `<PhysicsPaintWorkflowStrip>` receives save/load/play/navigation/onion/conversion callbacks. |
| `PhysicsPaintStudio.tsx` | `physicsPaintSessionFile.ts` | Helper imports | WIRED | Imports `downloadPhysicsPaintState` and `parsePhysicsPaintStateFile`; uses them in save/load callbacks. |
| `PhysicsPaintStudio.tsx` | `physicsPaintDevExport.ts` | Helper imports | WIRED | Imports and calls `buildPhysicsPaintDebugManifest` and `buildPhysicsPaintStillExport`. |
| `physicPaintBridge.ts` | `physicPaintStore.ts` | Validated apply payload routing | WIRED | Applies `apply-canvas`, `apply-play-canvas`, `convert-play-to-roto`, and `convert-roto-to-play` payloads. |
| `physicPaintBridge.ts` | `timelineStore.ts` | Frame-sync receiver | WIRED | `handlePhysicPaintFrameSyncMessage` validates then calls `timelineStore.seek(frame)` and `timelineStore.ensureFrameVisible(frame)`. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `PhysicsPaintStudio.tsx` | `settings`, `engine`, `launchContext`, `latestPlayFrames`, `onionPreviewFrames` | `EfxPaintCanvas` engine callbacks, URL/Tauri launch context, live `AnimationPlayer` captures, `physicPaintStore.getFrames` | Yes | FLOWING |
| `PhysicsPaintTopBar.tsx` | Brush/background/grain/status props | Props from Studio engine state and callbacks | Yes | FLOWING |
| `PhysicsPaintWorkflowStrip.tsx` | Workflow mode, frame markers, play range, callbacks | Props from Studio state and helper predicates | Yes | FLOWING |
| `physicPaintBridge.ts` | Apply and frame-sync payloads | Browser/Tauri messages and validated payload guards | Yes | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| App TypeScript typecheck passes | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` | Exit code 0 | PASS |
| Targeted Phase 36 regression tests pass | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/types/physicPaint.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/stores/physicPaintStore.test.ts` | 4 files passed, 44 tests passed | PASS |
| Dev server runtime | Not run | Project instruction: do not run the server | SKIPPED |

## Probe Execution

No phase probe scripts were declared or found for Phase 36 verification. Step 7c skipped.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| UI-REBUILD-01 | 36-01, 36-05, 36-06, 36-07 PLAN frontmatter; ROADMAP Phase 36; REQUIREMENTS.md lines 26, 82 | User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states | SATISFIED IN CODE / NEEDS HUMAN VISUAL ACCEPTANCE | Five-region UI exists and is wired; prior Grain strength gap is closed with `None`, `Soft`, `Med`, `Hard`. Visual polish still requires user-run app verification. |
| UI-REBUILD-02 | 36-01, 36-03, 36-04, 36-07 PLAN frontmatter; ROADMAP Phase 36; REQUIREMENTS.md lines 27, 83 | Standalone-package-first; no editor integration scope beyond proof artifacts | SATISFIED | Code remains standalone-first with validated bridge seams and rendered-output proof paths. |
| SAVE-01 | 36-02, 36-04, 36-05, 36-06, 36-07 PLAN frontmatter; REQUIREMENTS.md lines 31, 84 | User can save standalone paint session as JSON | SATISFIED | Workflow `Save state` calls Studio `saveEditableState`, which downloads `engine.save()` JSON through `downloadPhysicsPaintState`. |
| SAVE-02 | 36-02, 36-04, 36-05, 36-06, 36-07 PLAN frontmatter; REQUIREMENTS.md lines 32, 85 | User can reload saved JSON and continue testing the same paint session | SATISFIED | Load path validates JSON with `parsePhysicsPaintStateFile` / `isSerializedProject`, then calls `engine.load(state)`. |
| OUT-01 | 36-03, 36-04, 36-05, 36-06, 36-07 PLAN frontmatter; REQUIREMENTS.md lines 33, 86 | User can export current rendered paint result as PNG/still image | SATISFIED | Dev export captures `exportCompositeCanvas().toDataURL('image/png')` and creates still metadata; save/apply canvas path also sends rendered PNG output. |
| OUT-02 | 36-03, 36-04, 36-05, 36-06, 36-07 PLAN frontmatter; REQUIREMENTS.md lines 34, 87 | User can produce frame-sequence or cache-manifest proof from live engine | SATISFIED | `buildPhysicsPaintDebugManifest` produces bounded `manifest.json`; Play save captures live `AnimationPlayer` PNG frames. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 53, 81, 257, 613, 650, 655, 713 | `return null` / guard returns | INFO | Guard clauses for absent launch/engine/action context; not rendered placeholders or hollow implementations. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 792 | `return []` | INFO | Onion preview returns no overlays while playing or without launch context; expected behavior, not a hardcoded user-visible stub. |
| `app/src/lib/physicPaintBridge.ts` | 102, 135 | `return () => {}` | INFO | No-op listener cleanup for unsupported target/window contexts; not user-visible stub behavior. |

No blocker debt markers (`TBD`, `FIXME`, `XXX`) were found in the re-verified files.

## Human Verification Required

### 1. Visual layout and interaction review

**Test:** Open the user-run app, launch a Physics Paint layer/window, and inspect the rebuilt five-region UI visually.
**Expected:** Top bar, left rail, canvas region, right panel, and workflow strip match the Phase 36 visual spec and remain polished in the real runtime. Grain strength exposes `None`, `Soft`, `Med`, `Hard`.
**Why human:** Visual fidelity and runtime interaction feel cannot be fully verified by static code inspection or unit tests, and project instructions prohibit running the dev server.

### 2. Runtime save/load/play/export flow

**Test:** Paint, Save state JSON, Load the saved JSON, run Play preview, Save play, and use dev export in development.
**Expected:** Editable state round-trips, Play preview is preview-only until Save play, Save play keeps the window open with a summary, and dev export produces inspectable proof metadata/artifacts.
**Why human:** Canvas engine behavior, browser file downloads, and generated visual output require a live app/runtime check.

## Gaps Summary

No code-level blocking gaps remain after commit `3fd91f4`. The two prior gaps are closed: the Grain strength control now exposes the required four choices, and `.planning/REQUIREMENTS.md` now defines and traces `UI-REBUILD-01` / `UI-REBUILD-02`. Previous satisfied requirements remain satisfied by current code evidence and targeted regression checks.

The phase remains `human_needed`, not `passed`, because runtime visual fidelity and browser/canvas file-output behavior require user-run app verification, and the project instructions prohibit starting the dev server from verification.

---

_Verified: 2026-06-13T07:34:48Z_
_Verifier: Claude (gsd-verifier)_
