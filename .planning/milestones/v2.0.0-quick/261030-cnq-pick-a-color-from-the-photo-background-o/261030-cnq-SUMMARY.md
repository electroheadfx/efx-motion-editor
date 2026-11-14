---
phase: 261030-cnq
plan: "01"
subsystem: physic-paint / watercolor studio
tags: [color-picker, eyedropper, preact-signals, canvas-sampling, alt-modifier, tdd]

requires:
  - phase: 56-12 / 261027-klx
    provides: the watercolor sandwich (fond / below monitor / cached base / live sheet / above monitor) that the picker samples
  - phase: 261029-lel
    provides: the wet-paint gate and the rail leaf-subscription pattern
provides:
  - "a host-level color picker: Alt-hold temporary + a latched rail Picker tool (I) that never changes the aquarelle paint tool"
  - "one sampling law for the visible stack, with the live engine transmittance converted to pigment alpha"
  - "a capture-phase consumption seam on the canvas stack that stops picks reaching the engine, the select overlay and the Roto auto-key"
affects: [physic-paint studio, watercolor rail, studio keyboard dispatch]

actuals:
  tokens: 10708
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "host tool outside the engine tool union: the picker owns two session signals and never touches aquarelleActiveTool"
    - "pointerdown CAPTURE consumption with a boolean-returning handler (true = consumed) before onInputIntent"
    - "straight-alpha source-over folding bottom→top over the layered canvases, quantized once at #rrggbb"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleColorPicker.ts
    - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
    - app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The picker is a HOST tool, not an AquarelleTool: it never enters AQUARELLE_TOOLS or WATERCOLOR_RAIL_TOOLS, so releasing Alt or unlatching is literally back to the previous paint tool."
  - "Two signals only — latched + altHeld, with computed aquarellePickerActive; both setters are compare-then-write."
  - "Sampling runs on pointerdown only (button 0) while armed, never on pointermove, and is inert during Move/Edit and playback (Select owns Alt = the existing stroke-delete law)."
  - "The live sheet is read through port.exportCanvas('transparent', false) because .aquarelle-live-canvas is WebGL2; its opaque transmittance pixel is converted with the exact lib/rasterAlpha.ts law."
  - "One disarm choke point per law: setAquarelleTool (disarm BEFORE the equality early-return), setAquarelleSelectMode(true), and the hook's window blur / document hide."
  - "Both color surfaces are written with the same normalized hex through the existing right-panel law: handleActiveColorChanged + paintStore.setForeground."

patterns-established:
  - "Capture-phase consume: onColorPick returns true and the view calls preventDefault + stopPropagation BEFORE onInputIntent and every descendant listener."
  - "Wiring pins via readFileSync literals for a crossing that no node-env unit test can execute (canvas + DOM)."

requirements-completed: [PICK-ALT-TEMPORARY, PICK-RAIL-TOOL, PICK-SAMPLE-COMPOSITE, PICK-COMMIT-COLOR, PICK-CONSUME-INPUT, PICK-SELECT-CARVE, PICK-DISARM]

coverage:
  - id: D1
    description: "Holding Alt and clicking the canvas samples the visible pixel and makes it the active foreground color; releasing Alt returns to the previous paint tool."
    requirement: "PICK-ALT-TEMPORARY"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#picker state — two signals, one active verdict"
        status: pass
    human_judgment: true
    rationale: "Needs a live Studio window: only a human can confirm the swatch and the next stroke take the sampled pixel under the real cursor."
  - id: D2
    description: "The left watercolor rail gains a Picker button (Pipette) that latches the picker, deselects the paint-tool buttons, and is left by a paint-tool key or a second click."
    requirement: "PICK-RAIL-TOOL"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#the left rail renders the Picker button outside the paint-tool row"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#261030-cnq color picker shortcut (I)"
        status: pass
    human_judgment: true
    rationale: "The lit/deselected button states and the click-through are visual; automated pins cover only the literals."
  - id: D3
    description: "One sampling law: fond → below monitor → cached base → live engine export (transmittance→pigment) → above monitor, straight-alpha over bottom→top, empty rejected by PICK_MIN_ALPHA."
    requirement: "PICK-SAMPLE-COMPOSITE"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#compositeRgbaOver / compositePickLayers / transmittancePixelToPigment"
        status: pass
    human_judgment: true
    rationale: "Pixel-parity against the real composites (photo Background, semi-transparent wash, a track above the active one) is a visual verdict."
  - id: D4
    description: "A pick writes both color surfaces with ONE normalized lower-case #rrggbb (rgbaToHex clamps and rounds)."
    requirement: "PICK-COMMIT-COLOR"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#rgbaToHex — the one normalized color string"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#the Studio passes the pick handler into the canvas stack"
        status: pass
    human_judgment: false
  - id: D5
    description: "A pick never paints: the press is consumed at the canvas-stack capture phase before the Roto edit intent and every paint listener."
    requirement: "PICK-CONSUME-INPUT"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#the Studio view consumes a pick before the Roto edit intent"
        status: pass
      - kind: integration
        ref: "src/components/physic-paint/PhysicsPaintStudio.test.ts#passes the pointer event from the capture listener into the Studio intent"
        status: pass
    human_judgment: true
    rationale: "No stroke and no auto-created Roto key on a blank key are observed live (UAT-4)."
  - id: D6
    description: "Move/Edit owns Alt: the picker is inert there and Alt+click still deletes the hit stroke."
    requirement: "PICK-SELECT-CARVE"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#entering Move/Edit disarms the picker"
        status: pass
    human_judgment: true
    rationale: "The preserved Alt+click delete gesture is a live Studio gesture (UAT-5)."
  - id: D7
    description: "Losing window focus or hiding the window while Alt is held disarms the temporary picker."
    requirement: "PICK-DISARM"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleColorPicker.test.ts#a paint-tool pick disarms a latched picker even when the tool is already active"
        status: pass
    human_judgment: true
    rationale: "Cmd+Tab away and back is a live window-manager gesture (UAT-6)."

duration: 10min
completed: 2026-10-30
status: complete
---

# Quick 261030-cnq: Studio color picker (eyedropper) Summary

**Alt-hold and a latched rail Picker tool sample the visible layer stack — photo Background, wash and paint — into one normalized `#rrggbb` written to both the swatch and the engine color, without painting.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-30T08:13Z
- **Completed:** 2026-10-30T08:22Z
- **Tasks:** 2
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- `aquarelleColorPicker.ts` — two session-only signals (`aquarellePickerLatched`, `aquarellePickerAltHeld`), the `aquarellePickerActive` computed, compare-then-write setters, one disarm choke point, the straight-alpha color law, and the ONE DOM sampler.
- `useAquarelleColorPicker.ts` — Alt keydown/keyup plus window `blur` and `visibilitychange` release the temporary picker, so a lost keyup can never leave sampling mode stuck.
- The canvas stack consumes a pick at the **pointerdown CAPTURE** phase (`preventDefault` + `stopPropagation`) before `beginRotoFrameEdit` and before the engine / stroke-overlay listeners beneath it — no stroke, no auto-key, no selection change.
- The left rail gains a Pipette button outside `WATERCOLOR_RAIL_TOOLS`; the four paint tools render deselected while it is armed and come back on release. Bare `I` toggles the same latch.
- Two disarm choke points: `setAquarelleTool` (disarm runs BEFORE the equality early-return, so re-picking the current tool still leaves) and `setAquarelleSelectMode(true)` (Select owns Alt).

## Sampling law

Layer order, bottom→top, straight-alpha source-over, read in each canvas's own UV space against the `.demo-canvas-shell` rect:

1. `.physics-paint-fond-layer canvas` — the document paper fond
2. `.physics-paint-program-monitor:not(.physics-paint-program-monitor-above) canvas` — Background photo + every track below the active one
3. `.demo-canvas-shell .aquarelle-cached-base` — committed sheet (already straight-alpha pigment)
4. the caller's `exportCanvas('transparent', false)` — the live engine sheet, OPAQUE transmittance, converted per pixel with the display law: `min = min(r,g,b)`, `alpha = (255-min)/255`, `channel = (c-min)/alpha`; `min === 255` is no pigment
5. `.physics-paint-program-monitor-above canvas` — tracks above the active one

The composite is quantized exactly once (`rgbaToHex`: clamped, rounded, lower-case `#rrggbb`); an alpha below `PICK_MIN_ALPHA` (0.02) returns `null` and changes nothing.

## Task Commits

TDD: every task produced a RED commit before its GREEN commit.

1. **Task 1 RED** — `55b775bd` (test): failing pick-law + state + wiring-pin suite (module stub so it fails on assertions, not a load error)
2. **Task 1 GREEN** — `c123a28c` (feat): sampling module, Alt hook, capture-phase seam, Studio handler + both color surfaces
3. **Task 2 RED** — `4c1ec3a4` (test): failing disarm-law + bare-`I` + rail-pin cases
4. **Task 2 GREEN** — `314c93cf` (feat): rail Picker button, `I` shortcut, the two disarm choke points
5. **Pin repair** — `b04b407b` (test): the two pre-existing Studio literal pins updated to the new wiring

Plan metadata (SUMMARY + STATE) is committed by the orchestrator.

## Test commands captured

- Focused: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleColorPicker.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` → 177 passed
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` → clean
- Full app suite: `pnpm --filter efx-motion-editor exec vitest run` → **356 files passed, 2 skipped; 6432 tests passed, 1 skipped, 96 todo, 0 failures**

## TDD Gate Compliance

| Phase | Commit | Evidence |
|-------|--------|----------|
| RED (Task 1) | `55b775bd` | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`, junit report, 21 tests / 17 failing) |
| GREEN (Task 1) | `c123a28c` | 21/21 passing, typecheck clean |
| RED (Task 2) | `4c1ec3a4` | `RED_EVIDENCE_OK` (`target_test_failed`, junit report, 177 tests / 4 failing) |
| GREEN (Task 2) | `314c93cf` | 177/177 passing, typecheck clean |

RED records live in `.planning/quick/261030-cnq-pick-a-color-from-the-photo-background-o/.red/` (`task1-record.json`, `task2-record.json` with their junit reports). Semantic assessment for both: the named target test executed and failed on its planned assertion; no import, setup, or collection faults.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleColorPicker.ts` — signals, color law, canvas sampler
- `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts` — 26 unit tests (law, state, disarm, wiring pins)
- `app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts` — the Alt-hold arming hook
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — `onColorPick` prop + capture-phase consumption + shortcuts-help line
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — hook call, `handleAquarelleColorPick`, `handleToggleAquarellePicker`, memo dep + emitted prop, keyboard action
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — Pipette button, picker-aware active law
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `setAquarelleTool` disarm
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `setAquarelleSelectMode(true)` disarm
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` — bare-`I` branch + action type
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` — `toggleAquarellePicker` in the helper + 4 cases
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — two existing literal pins updated

## Decisions Made

- **The picker is not a paint tool.** Deliberately outside `AquarelleTool` / `AQUARELLE_TOOLS` / `WATERCOLOR_RAIL_TOOLS`; `aquarelleActiveTool` is never written by a pick, so releasing Alt or unlatching is literally the previous tool.
- **Pointerdown only.** Sampling never runs on pointermove; it is refused while Move/Edit is armed and while playback runs (DoS mitigation T-261030-03).
- **Engine export with `texture = false`** is the live-sheet readback, because the live canvas is WebGL2 and cannot be read with a 2D context.
- **One quantization per pick** — the composite keeps exact floats and only `rgbaToHex` rounds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's `transmittancePixelToPigment` example was internally inconsistent**
- **Found during:** Task 1 (RED test authoring)
- **Issue:** The `<behavior>` bullet gave `(200,180,180) → alpha 75/255, rgb (255,0,0)`, but the law stated in the same task (`(c-min)/alpha`, i.e. the `lib/rasterAlpha.ts` scale) yields `(68,0,0)` for that input. `rgb (255,0,0)` is only produced by `(255,180,180)`.
- **Fix:** Implemented the stated law (the one the plan says is "the SAME law the display path uses") and tested both the saturating input `(255,180,180) → (255,0,0)` and the literal `(200,180,180) → (68,0,0)`, so the conversion is pinned against `rasterAlpha.ts` rather than against the typo.
- **Files modified:** `aquarelleColorPicker.ts`, `aquarelleColorPicker.test.ts`
- **Verification:** both cases pass in the focused suite
- **Committed in:** `c123a28c`

**2. [Rule 1 - Bug] Two pre-existing Studio literal pins broke on the intended capture-handler change**
- **Found during:** Full app suite run after Task 2
- **Issue:** `PhysicsPaintStudio.test.ts` pinned the exact old one-line `onPointerDownCapture={(event) => props.onInputIntent?.(event)}` and the exact old rail active law `!selectActive && active === id`.
- **Fix:** Updated both pins to the new shape; the capture pin now also asserts the pick check sits BETWEEN the capture seam and `props.onInputIntent?.(event)` (a stronger guarantee than before).
- **Files modified:** `PhysicsPaintStudio.test.ts`
- **Verification:** that file 295/295 passing; full suite 0 failures
- **Committed in:** `b04b407b`

---

**Total deviations:** 2 auto-fixed (both Rule 1)
**Impact on plan:** No scope expansion. Deviation 1 keeps the conversion faithful to the display path; deviation 2 repairs assertions that the planned change invalidated.

## Issues Encountered

- Vitest's TAP reporter emits multi-line assertion diffs that break a strict TAP parser, so the RED evidence for both tasks was captured with `--reporter=junit` (a supported format), per the RED-evidence contract's "rerun with a supported reporter" allowance.

## Known Interactions (not stubs)

- The wet-paint gate's automatic Water→Brush fallback (`setAquarelleHasWetPaint(false)` while Water is active) goes through `setAquarelleTool`, so it also disarms an armed picker. This is the plan's declared law (every paint-tool change leaves the picker); flagged here so a UAT-3 observation while the sheet dries is not misread as a flake.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: the only value reaching `paintStore.setForeground` / `handleActiveColorChanged` is `rgbaToHex` output (T-261030-02), readback failures are swallowed to `null` without logging (T-261030-01), and no dependency was added (T-261030-SC).

## Native UAT Rows — ALL PENDING

Automated-green is NOT UAT-green. None of these rows has been executed.

- **UAT-1 — PENDING.** Hold Alt over the photo Background and click: the rail swatch and the next Brush stroke take that color; release Alt and a drag paints with the previous tool.
- **UAT-2 — PENDING.** Hold Alt over a semi-transparent wash painted over the photo: the picked color matches the visible pixel (not the raw pigment, not the bare photo).
- **UAT-3 — PENDING.** Click the rail Picker button: it lights, the paint-tool buttons go unlit, clicks sample without Alt; press B (or click Picker again) and Brush is active again.
- **UAT-4 — PENDING.** With the picker armed, a press on an EMPTY blank key picks the paper color and creates no Roto key and no stroke.
- **UAT-5 — PENDING.** In Move/Edit (Select), Alt+click a stroke still deletes it (the picker is inert there).
- **UAT-6 — PENDING.** Hold Alt and switch away from the Studio (Cmd+Tab): back in the Studio the next click paints, never picks.
- **UAT-7 — PENDING.** Pick on a track above the active one (above-monitor slice) returns that track's visible color.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Ready for live UAT in the Studio window (the user runs the server; never started here).
- The picker only reads the existing DOM/canvas stack, so any later change to the layer order must update the selector list in `sampleAquarelleStackColor` (pinned by the module's layer-order comment).

## Self-Check: PASSED

- `app/src/components/physic-paint/view/aquarelleColorPicker.ts` — FOUND
- `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts` — FOUND
- `app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts` — FOUND
- `55b775bd`, `c123a28c`, `4c1ec3a4`, `314c93cf`, `b04b407b` — all ancestors of HEAD

---
*Quick task: 261030-cnq*
*Completed: 2026-10-30*

## UAT round 2 (2026-10-30) — three native findings fixed

| Finding | Root cause | Fix |
|---|---|---|
| Pointer must be the lucide Pipette | no cursor rule existed | `.physics-paint-canvas-stack.picker-armed *` sets a 32px PNG pipette cursor (SVG + crosshair fallbacks); the stack leaf subscribes to `aquarellePickerActive` and adds `picker-armed`. |
| With a Background photo active, a pick returned the paint | the sampler read the DOM monitor slice, which did not resolve to the photo | `sampleAquarelleStackColor` now takes `beneathCanvas` — `physicPaintStore.getFlattenedFrameExcluding(layer, frame, activeTrack, includeFond=true, …).raster`, the exact composite the monitor draws (Background photo + other tracks + paper). DOM slices remain the fallback; an opaque `transmittance` record is rejected. The Photo Reference ghost canvas is sampled last (it is monitor paint above the composite). |
| Photo Reference "Overlay opacity" slider could not be dragged | CSS specificity: the global `input[type="range"] { width: 80px; height: 6px }` out-specified `.physics-paint-photo-reference-slider-input`, leaving the invisible input an 80px stub on a ~228px track — the thumb past ~35% was outside its hit area | selector raised to `input[type="range"].physics-paint-photo-reference-slider-input` (plus `padding: 0`). |

Commits `41b41eaf`, `b27f729e`. Gates: typecheck clean; focused suites 324 selected / picker 29; **full app suite 356 files passed / 6,435 tests passed / 0 failures**. Native rows for the three findings remain PENDING until the user re-tests live.

## UAT round 3 (2026-10-30) — pointer visor + photo colour law

| Finding | Decision |
|---|---|
| Why a base64 cursor | Dropped. The sheet sets `cursor: none` (the brush ring IS the pointer), so no CSS cursor could ever show. The picker now renders the **lucide `Pipette` component** as a stack-level visor (`AquarellePickerVisor`) following the shell-relative pointer, with a 1px tip dot at the sampled pixel. |
| Pointer stayed the paint brush | The brush ring is a DOM element inside the isolated tracks group; it now returns null while `aquarellePickerActive`, and the visor (z 60, **outside** the group) takes over. |
| At 100% overlay the pointer vanished behind the photo | Same stacking cause: the group's `isolation: isolate` confines the ring below the reference ghost (z 5). The visor is a sibling of the ghost, so it stays visible. |
| Pick returned "photo transparency mixed with paint" | A pick over a photo layer is now read from the **source image**: `createPhotoPickSampler(layerId, frame, projectW, projectH)` samples the Photo Reference first, then the Background clip, with the exact placement math of each draw path (`photoPixelAt` inverse-maps translate→rotate→scale). The result is the photo's full-strength pixel — overlay opacity and translucent paint are both ignored. |

Commit `430442ef`. Gates: typecheck clean; picker suite 33; **full app suite 356 files / 6,439 tests passed**. The three native rows remain PENDING until re-tested live.

## UAT APPROVED (2026-10-30)

All native rows passed live, including the round-2/3 follow-ups:

- Alt-hold and the rail Picker (`I`) both arm the picker; releasing Alt returns to the previous paint tool.
- Pointer is the **lucide `Pipette` visor** (no embedded cursor asset); it stays visible above a 100%-opacity Photo Reference.
- The **brush ring** stays visible above the reference overlay (moved out of the isolated tracks group).
- A pick over a photo returns the photo's **full source color** at any overlay opacity (1%–100%), not a paint blend.
- The Photo Reference **"Overlay opacity" slider** is draggable across the whole track.
- Alt arms the picker even while a Studio dialog holds focus (capture-phase listeners).
- Picks never paint and never create a Roto key; Select keeps Alt+click stroke delete.

Quick task closed. Commits: `55b775bd`, `c123a28c`, `4c1ec3a4`, `314c93cf`, `b04b407b`, `50123e3e`, `41b41eaf`, `b27f729e`, `b5f2b6aa`, `430442ef`, `9d26e1d9`, `10315a9f`, `8c25e49e`.
