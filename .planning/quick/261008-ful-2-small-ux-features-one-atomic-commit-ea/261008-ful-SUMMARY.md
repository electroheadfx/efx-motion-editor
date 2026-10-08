---
phase: quick-261008-ful
plan: 261008-ful
subsystem: ui
tags: [physic-paint, layer-list, double-click, studio-launch, audio-modal, gain, numeric-stepper, source-contract]

# Dependency graph
requires: []
provides:
  - "ONE shared Studio launch path: openPhysicPaintForLayer in physicPaintBridge.ts is the single payload-assembly site (frame/canvas/fps/workflowLabel peeks) consumed by both the sidebar button and the LayerList double-click"
  - "LayerRow double-click on a physic-paint row opens the Studio at the current frame under type/source/frame guards + a useRef busy flag; select/grip/eye/delete byte-untouched, no rename handler"
  - "Audio modal field 4 Gain: native range slider fully replaced by NumericStepper (step 5, -100..100, per-step commitGain); signed readout copy intact; controller/model/persistence untouched"
affects: [physic-paint-studio-entry, layer-list, audio-modal, sidebar-layer-row]

# Actuals (#2632)
actuals:
  tokens: 4375
  tasks: 2
  commits: 2

commits: 2
plan_head_before: ce5f6744bddc8c83ffdcc45299faccca0da71a7b
plan_head_after: 478650e0bb7b96a52fa387cb5741224f63cdcf35

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single launch-path law: every Studio launcher composes its PhysicPaintOpenRequest through openPhysicPaintForLayer; component surfaces never assemble payloads or call openPhysicPaintCanvas directly (pinned by region-scoped negatives in both test files)"
    - "Component-local useRef busy flag mirrors the sidebar's opening guard for double-click re-entrancy (no useState, no signal writes — efx-preact-reactivity)"

key-files:
  created:
    - app/src/components/layer/LayerList.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/sidebar/PhysicPaintProperties.tsx
    - app/src/components/sidebar/PhysicPaintProperties.test.ts
    - app/src/components/layer/LayerList.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx

key-decisions:
  - "openPhysicPaintForLayer is a field-for-field move of the existing handleOpenCanvas peeks (all at call time) placed immediately before openPhysicPaintCanvas; validation/media/geometry/window logic stays inside openPhysicPaintCanvas — no second launch mechanism (T-261008-FUL-01)"
  - "The retargeted sidebar payload pin reads physicPaintBridge.ts as a second source, so the sidebar and LayerList launchers stay welded to one payload contract; the sidebar source carries a direct not.toContain('openPhysicPaintCanvas(') single-path pin"
  - "LayerRow double-click failures are silent in the UI (console.info only) — no new labels, surfaces, or copy; non-physic-paint rows return before any launch (T-261008-FUL-02/T-03)"
  - "Gain stepper routes every press and typed commit through the existing commitGain → isValidGain → patchSound chain; the live-drag draft path (previewGainInput) left with the slider, dropped from the render destructure only — controller file byte-untouched (T-261008-FUL-04)"

requirements-completed: [QUICK-261008-FUL]

coverage:
  - id: D1
    description: "LayerRow double-click opens the Studio via the ONE shared launch path (gated on physic-paint type/source/valid frame, busy-flag guarded); select/grip/eye/delete untouched"
    requirement: QUICK-261008-FUL
    verification:
      - kind: unit
        ref: "app/src/components/layer/LayerList.test.ts#gates the Studio launch on physic-paint type, source, and frame guards through the ONE shared path"
        status: pass
      - kind: unit
        ref: "app/src/components/layer/LayerList.test.ts#binds double-click on the row div to the launch handler alongside the existing gestures"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/layer/LayerList.test.ts src/components/sidebar/PhysicPaintProperties.test.ts (11 tests green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Open payload assembled in exactly ONE place — both launchers compose through openPhysicPaintForLayer (bridge peeks: frame, canvas w/h, fps, workflowLabel)"
    requirement: QUICK-261008-FUL
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/PhysicPaintProperties.test.ts#passes the current frame, project canvas size, and derived workflow label to the Roto bridge (retargeted: reads physicPaintBridge.ts helper + sidebar single-path negative)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Audio modal field 4 Gain is a NumericStepper only (step 5, -100..100, per-step commitGain); native range slider and 'native range' wording gone; signed readout copy verbatim"
    requirement: QUICK-261008-FUL
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts#renders field 4 as a NumericStepper (step 5, clamped) committing through commitGain"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts#removes the native range slider and the stale contract wording entirely"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts (9 tests green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "documentAudio model/persistence untouched — diff for feature 2 confined to the modal view plus its new test (controller/stores byte-untouched, git diff audit)"
    requirement: QUICK-261008-FUL
    verification:
      - kind: other
        ref: "git diff --stat ce5f6744..HEAD — exactly the 7 planned files; grep over physicsPaintAudioController|stores/|persistence over the diff returns NONE"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live UAT row 1: double-click a physic-paint layer row → Studio opens at current frame; single-click select, grip reorder, eye, delete still work; image/video row double-click shows no new behavior"
    requirement: QUICK-261008-FUL
    verification: []
    human_judgment: true
    rationale: "Native visual verification in the Tauri app must be performed by the user (no Chrome DevTools MCP per project rule); automated pins prove the wiring, not the live gesture"
  - id: D6
    description: "Live UAT row 2: Gain stepper −/+ moves 5 per press clamped −100..+100; a set value survives close/reopen of Studio; Fades and toggles unchanged"
    requirement: QUICK-261008-FUL
    verification: []
    human_judgment: true
    rationale: "Persistence across Studio close/reopen is a cross-window live behavior; vitest cannot exercise the Tauri window lifecycle (live evidence over unit probes)"

# Metrics
duration: 8min
completed: 2026-10-08
status: complete
---

# Quick 261008-ful: 2 Small UX Features, One Atomic Commit Each — Summary

**Single shared Studio launch path consumed by a gated LayerRow double-click, plus the audio modal Gain slider fully replaced by the shared NumericStepper (step 5, per-step commit) — two atomic commits, 11 new/retargeted source-contract pins green.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-08T10:04:33Z
- **Completed:** 2026-10-08T10:12:19Z
- **Tasks:** 2
- **Files modified:** 7 (5 in commit 1, 2 in commit 2)

## Accomplishments

- Extracted `openPhysicPaintForLayer` into `physicPaintBridge.ts` as the ONLY payload-assembly site; the sidebar's `handleOpenCanvas` now delegates to it with its guard/status/logging flow intact, and the LayerRow double-click calls the same helper under type/source/frame guards plus a useRef busy flag (no useState, no signal writes)
- Retargeted the sidebar payload pin to read the bridge helper (single-path pin: sidebar `not.toContain('openPhysicPaintCanvas(')`), kept the other eight sidebar pins byte-for-byte, and added `LayerList.test.ts` pins (handler binding, all three guards, region-scoped single-path negative, no `fxRenameEdit`, select/grip survival pins)
- Replaced audio modal field 4's native range input with `NumericStepper` (step 5, min −100, max 100, every press/typed commit routed through existing `commitGain`), dropped `previewGainInput` from the render destructure, updated both field-order contract comments, and added `PhysicsPaintAudioModalView.test.ts` pins including file-wide negatives for `type="range"` / `native range`
- Diff-boundary audit clean: exactly the 7 planned files across the two commits; `physicsPaintAudioController.ts`, stores, and persistence byte-untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: LayerRow double-click opens Studio via ONE shared launch path** - `6b3d3eae` (feat) — 5 files
2. **Task 2: Audio modal Gain slider → NumericStepper (per-step commit)** - `478650e0` (feat) — 2 files

**Plan metadata:** `ce5f6744` (docs: plan, pre-committed by orchestrator)

Measured: `git rev-list --count ce5f6744..HEAD` = 2.

## Files Created/Modified

- `app/src/lib/physicPaintBridge.ts` — added `fxTrackLayouts` to the frameMap import; new exported `openPhysicPaintForLayer` (single payload-assembly site) immediately before `openPhysicPaintCanvas`
- `app/src/components/sidebar/PhysicPaintProperties.tsx` — `handleOpenCanvas` delegates to the helper; unused `projectStore`/`fxTrackLayouts` imports and the shadowed local `currentFrame` dropped (noUnusedLocals)
- `app/src/components/sidebar/PhysicPaintProperties.test.ts` — payload case retargeted to read `physicPaintBridge.ts`; other 8 cases untouched
- `app/src/components/layer/LayerList.tsx` — `handleRowDoubleClick` bound as `onDblClick` on the row div; busy-ref guard; new `timelineStore`/bridge imports
- `app/src/components/layer/LayerList.test.ts` — new source-contract pins (binding, guards, single-path negative, no rename, select/grip survival)
- `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx` — field 4 slider → NumericStepper; destructure drop; contract comment updates
- `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts` — new source-contract pins (stepper props, slider/wording negatives, signed readout verbatim)

## Decisions Made

- Helper composition is a field-for-field move of the pre-existing sidebar peeks (all at call time) — no payload semantic change (threat T-261008-FUL-01 mitigation, proven by the retargeted pin)
- Double-click launch failures log via `console.info` only — failure stays silent in the UI per the no-new-copy guardrail
- Gain stepper passes both `disabled` and `ariaDisabled` from `controlsDisabled`, matching the Studio guarded-pattern contract; `class="physics-paint-audio-field-stepper"` reuses the fades precedent style (already in physicsPaintStudio.css)

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** No unplanned work; guardrails (single payload site, no rename handler, slider replaced not supplemented, copy contract, model/persistence untouched) all held and are pinned.

## Issues Encountered

- **Pre-existing typecheck failures (out of scope, NOT fixed):** `tsc --noEmit` reports 3 errors at baseline HEAD and after both commits, identical: `physicsPaintTemporaryErase.ts(95)` / `PhysicsPaintToolRail.tsx(63,124)` — `"move"` not assignable to `ToolType` (from quick 261004-dn5). Proven pre-existing by running tsc in a detached worktree at `ce5f6744`; zero new typecheck errors from this quick (none in the 7 changed files).
- **Pre-existing test failure (out of scope, NOT fixed):** full suite `PhysicsPaintStudioView.test.ts` fails identically before (`ce5f6744` baseline) and after (`_setPaintMarkDirtyCallback is not a function` in `projectStore.ts:1152`). No NEW failures: baseline 243 files (1 failed | 240 passed | 2 skipped) → final 245 files (1 failed | 242 passed | 2 skipped); the +2 files are this quick's new tests, both passing.

## Deferred Issues

See `.planning/quick/261008-ful-2-small-ux-features-one-atomic-commit-ea/deferred-items.md` (the two pre-existing failures above).

## User Setup Required

None - no external service configuration required.

## Live UAT (pending — nothing claimed done before it passes)

| # | Row | Pass condition |
|---|-----|----------------|
| 1 | LayerRow double-click | Double-click a physic-paint layer row → Studio opens at the current frame; single-click select, grip reorder, eye toggle, delete all still work; double-click on image/video rows produces no new behavior |
| 2 | Audio modal Gain | Gain shows as a value with −/+ moving 5 per press, clamped −100..+100; set a value, close Studio, reopen → persists; Fades and toggles unchanged |

## Next Phase Readiness

- Both features automated-ready: per-task gates green (11 + 9 tests), full suite no NEW failures, diff boundaries exact, two atomic commits on `feat/v1.0.0-52-5-audio-studio`
- Blocking for "done": the user's two native UAT rows above
- Non-blocking debt carried: the two pre-existing failures (typecheck ×3, suite ×1) belong to quick 261004-dn5's `'move'` tool cluster / paintStore wiring — route to a future quick, not this one

## Self-Check: PASSED

- FOUND: app/src/components/layer/LayerList.test.ts
- FOUND: app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
- FOUND: commit 6b3d3eae (ancestor of HEAD)
- FOUND: commit 478650e0 (ancestor of HEAD)
- FOUND: SUMMARY written with `status: complete`, measured `commits: 2`

---
*Phase: quick-261008-ful*
*Completed: 2026-10-08*
