---
phase: 61-vector-painting-tool
plan: 07
subsystem: engine
tags:
  - watercolor
  - render-mode
  - simple-ribbon
  - brush-preset
  - stroke-thumb
  - probe-measurement
  - tdd

# Dependency graph
requires:
  - phase: 61-01
    provides: "The probe harness (esbuild + headless Chrome + /tmp result extraction) and the pinned-adapter replay helpers"
  - phase: 61-03
    provides: "The persisted AquarelleRenderMode discriminator and resolveAquarelleRenderMode"
  - phase: 61-04
    provides: "The per-sample width channel and the width probe scenario the ribbon scenario reuses (same sheet, density and pinned adapter)"
provides:
  - "StrokeRenderMode, Stroke.renderMode and the append-only renderMode argument on scriptBegin"
  - "The ribbon stamp branch inside the existing trace/stamp path, with RIBBON_RIM_FRAC = 0.08 and the guarded ribbon profile in stampFS"
  - "The adapter's one scriptBegin mode argument (scriptMove unchanged)"
  - "BrushPreset.renderMode and the simple-ribbon preset"
  - "SIMPLE_RIBBON_BRUSH_ID, resolveRenderModeForBrushId and recordedRenderModeField"
  - "The record-time mode stamp in AquarelleCanvasLayer.onStrokeEnd"
  - "brushMenuPresets / filterLiftPresets (eraser branch filter) and resolveThumbMode + the crisp-sweep thumb branch"
  - "The mode-parameterised determinism replay arm (self-identical per mode, distinct across modes)"
  - "probe/vector-spine --scenario ribbon: edge-transition ratio vs watercolour and the seven-global digest sweep"
affects:
  - 61-12 (the pick-time zeroed globals must keep the ribbon's plain-sweep look and still blend back)
  - 61-14 (a hand-painted stroke carrying renderMode must round-trip)
  - every brush surface that lists presets or paints a thumb (top-bar menu, floating catalog)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 20360
  tasks: 3
  commits: 6
plan_head_before: d0fa03057dca94cdc7fb126190a52d4ad565ad8e
plan_head_after: 6018713a13be6de78b6737ba825f07c7a4b1584c

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "The mode is explicit stroke data: read from `stroke.renderMode` (seeded from the brush on the interactive path, supplied by scriptBegin on replay), never inferred from a parameter being zero"
  - "A pure menu-filter helper (`brushMenuPresets`) keeps a node-env test behavioural instead of textual, while a source pin proves the component calls it in each branch"
  - "A pure thumb-mode resolver (`resolveThumbMode`) keeps the preview law independent of canvas pixels; the cache stays keyed by preset id"
  - "A deterministic `vi.mock` engine stand-in lets the adapter replay pin byte identity per render mode where vitest has no WebGL2; real pixels stay in the probe"
  - "Probe measurement has a plateau requirement: the edge transition is measured 90→10% of the widest row's plateau, scanned from both flanks"
  - "Neutral brush-side multipliers (1) on the clean-sweep preset, so zeroed globals stay zero through the bag but a raised global can still reach the deposit"

key-files:
  created:
    - packages/efx-watercolor/src/playground/engineRenderMode.test.ts
    - app/src/components/physic-paint/view/brushMenuPresets.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
    - app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts
    - packages/efx-watercolor/probe/vector-spine/.gitignore
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/src/payload/vectorPath.ts
    - packages/efx-watercolor/src/payload/vectorPath.test.ts
    - packages/efx-watercolor/probe/vector-spine/probe.ts
    - packages/efx-watercolor/probe/vector-spine/run.mjs
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts

key-decisions:
  - "The ribbon branch lives inside the existing stamp/brush path and is selected from `stroke.renderMode`, never from a zeroed parameter; the sampling law (spacingFrac, carry phase, 48-substep cap) is untouched and no second deposit path exists (T-61-22)."
  - "Each of the seven wet globals is an independent blend weight on its own deposit term, with no reuse of the watercolour branch's floored wet/concentration expressions; at all-zero the ribbon deposits the plain sweep."
  - "The preset keeps brush-side water/load/flow/capacity at the neutral 1 so raising a global still reaches the deposit (D-13); only crispness changes (grain 0, scatter 0, spacing 0.14, wetRound 0.35)."
  - "The record-time stamp resolves from the SAME brush id the literal stores and writes `renderMode` only when non-default, so a plain hand-painted stroke keeps its pre-phase key set and byte cost."
  - "The thumb branch is a pure function of the preset's `renderMode`; the paint-once cache key stays the preset id because the mode is a preset property."
  - "The eraser popover filters presets that carry a render mode through one pure helper; the brush popover stays complete."
  - "The determinism arm runs through a deterministic engine stand-in rather than declaring the law unpinnable: the two modes produce different digests, proving the payload mode reaches the one scriptBegin call; real pixels remain the probe's job."

patterns-established:
  - "Source-contract pins for wiring sites DOM/WebGL suites cannot reach: one recordedRenderModeField spread at the record site, both menu branches through brushMenuPresets, and the crisp branch's absence of grain/scatter/rnd reads."
  - "Replay determinism in a WebGL-less runner: a `vi.mock` engine whose exported bytes are a pure function of the fed script (including the render mode), with paperSeed pinned around every construction."
  - "Edge-transition measurement as a ratio against the same stroke's watercolour baseline, so the gate isolates the mode from the sheet and the geometry."

requirements-completed: [VEC-04, VEC-06]

coverage:
  - id: D1
    description: "A ribbon stroke deposits a clean sweep with a hard edge: the measured edge transition is 3px vs 20px in watercolour (ratio 0.15, gate 0.6), and all seven wet globals still reach the deposit (7/7 digests move when raised alone)"
    requirement: VEC-06
    verification:
      - kind: probe
        ref: "packages/efx-watercolor/probe/vector-spine/run.mjs --scenario ribbon (VECTOR-RIBBON PASS ratio=0.15 wet=7/7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The mode channel is explicit and replay-deterministic: scriptBegin stores the mode (omitted -> watercolor), the interactive stroke seeds from the brush, the adapter passes it at the one scriptBegin call, and each mode replays byte-identically while the two modes differ"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/engineRenderMode.test.ts#scriptBegin stores the stroke render mode (61-07 D-12)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#render-mode replay contract (61-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The simple-ribbon preset ships with the approved name and hint, neutral wet multipliers, crispness overrides, and the brush-id mapping + record-time stamp are pure and tested (default adds no key)"
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#simple-ribbon brush preset (61-07)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts#record-time render-mode stamp (61-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The brush popover lists the ribbon preset exactly once and the eraser popover never lists it; the ribbon thumb selects the crisp branch while every wet preset keeps the bloom, with the cache key unchanged"
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "E8 error backstop — the ribbon row's thumb reads as a plain sweep rather than the wet bloom, judged by eye"
    verification: []
    human_judgment: true
    rationale: "The branch wiring is pinned automatically, but whether the painted sweep reads as a clean ribbon at 116x34 is a visual judgement held for end-of-phase UAT (61-VALIDATION.md)."
  - id: D6
    description: "End-of-phase UAT: paint a freehand stroke with the Simple ribbon tip and see the crisp sweep live; raise Water on the stroke and see the wet bloom return; save and reopen and see both results"
    verification: []
    human_judgment: true
    rationale: "The live WebGL deposit and the reopen re-bake cannot be exercised in vitest (no WebGL2); this is the user-visible proof of D-12/D-14."

duration: 23min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 07: Simple-Ribbon Deposit Mode Summary

**A second deposit mode ships inside the one engine — a clean sweep whose measured edge transition is 0.15x the watercolour's, still driven by the same seven wet globals, discoverable as a preset, recorded on the stroke at record time, and replayed byte-identically.**

## Performance

- **Duration:** 23 min (first task commit to last task commit)
- **Started:** 2026-11-10T13:41:32Z
- **Completed:** 2026-11-10T14:04:31Z
- **Tasks:** 3 (tracer, pin/stamp task, brush surface)
- **Files created/modified:** 28 (5 created, 23 modified)

## Accomplishments

- **The ribbon deposit branch** lives in `Engine.ts` `trace`/`stamp`, selected explicitly from `stroke.renderMode`. `RIBBON_RIM_FRAC = 0.08` fixes the profile: solid coverage inside `radius × (1 − rim)`, a smoothstep rim to zero, and the guarded `uRibbon`/`uEdge` uniforms in `stampFS`. A watercolour stamp binds `uRibbon 0` and keeps its exact pre-phase profile. The dab count is unchanged (T-61-22), and `spacingFrac`, `s.carry` and the 48-substep cap are untouched (C-04).
- **The seven wet globals are independent blend weights in the ribbon branch** (D-13): `water` widens/softens the rim, `load` adds the travelled-distance fade, `flow` the speed edge term and velocity splat, `bleed` the diffusion widening, `dry` the rim hardening, `edge` the tide ring, `granulation` the paper gate. No floored expression from the watercolour branch is reused.
- **Real-pixel proof:** `--scenario ribbon` replays the same three-anchor stroke through the adapter in both modes and measures the widest-row 90→10% transition: **20px watercolour vs 3px ribbon, ratio 0.15** (`VECTOR-RIBBON PASS`). Arm 2 zeroes all seven globals and raises each alone; **7/7** captures change digest, proving the shared bag reaches the deposit.
- **The mode is part of the deterministic replay input:** the replay arm runs each mode on two fresh adapters with `paperSeed` pinned — each mode is byte-identical to itself and the two modes produce different digests. An absent mode replays as watercolour (REL-02).
- **A new preset, `Simple ribbon`**, ships with the approved hint, `renderMode: 'simple-ribbon'`, neutral brush-side water/load/flow/capacity (1) and crispness-only overrides (spacing 0.14, wetRound 0.35, grain 0, scatter 0). `resolveRenderModeForBrushId` / `recordedRenderModeField` are pure string comparisons in the payload layer (no playground import).
- **The record-time stamp** in `AquarelleCanvasLayer.onStrokeEnd` resolves from the same brush id the literal stores and spreads one `recordedRenderModeField(...)` — a default brush adds no key, and the hand-painted path writes no `anchors`.
- **The brush surfaces split correctly:** the top-bar brush popover lists every preset (ribbon included, exactly once); the eraser popover filters it out through a pure `brushMenuPresets('lift')`; the ribbon thumb paints a one-rim crisp sweep through `resolveThumbMode`, with the cache still keyed by preset id.

## Task Commits

1. **Task 1 RED: failing pin for the stroke render mode channel** - `559e6fb65` (test)
2. **Task 1 GREEN: simple-ribbon stamp branch and its probe** - `25582f1b5` (feat — Engine.ts, shaders.ts, engineAdapter.ts, brushes.ts preset field, probe.ts, run.mjs)
3. **Task 2 RED: failing pins for the preset, mode mapping and record stamp** - `19743d6ff` (test)
4. **Task 2 GREEN: the simple-ribbon preset and its record-time mode stamp** - `15179d88c` (feat — brushes.ts, vectorPath.ts, AquarelleCanvasLayer.tsx)
5. **Task 3: brush surface — menu filter and crisp thumb** - `aabf2dba3` (feat — PhysicsPaintBrushMenu.tsx, brushMenuPresets.ts, watercolorStrokeThumb.ts, tests and shipped-count pins)
6. **Plan-level fix: scope the per-anchor paint pin** - `6018713a1` (fix — vectorPath.test.ts)

**Plan metadata:** the `docs(61-07)` completion commit (SUMMARY.md, STATE.md, ROADMAP.md).

## TDD Gate Compliance

| Gate | Evidence |
|------|----------|
| Task 1 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `scriptBegin stores the stroke render mode (61-07 D-12) > stores simple-ribbon on the active stroke when the argument says so`. 10 tests ran, 8 failed on assertions (default mode undefined, explicit mode undefined, brush-override arm, missing pointerdown seed, undefined `RIBBON_RIM_FRAC`, missing branch discriminator, missing shader uniforms). |
| Task 1 GREEN | Probe verify passed: `VECTOR-RIBBON PASS ratio=0.15 wet=7/7`; `engineRenderMode.test.ts` green. Committed as `feat`. Tracer feedback gate re-ran the automated verify end-to-end before Task 2. |
| Task 2 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `simple-ribbon brush preset (61-07) > ships exactly one ribbon preset with the approved name and hint`. 48 tests ran, 6 failed on assertions (zero ribbon presets, undefined mapping helpers, no record-site spread); the app bridge run failed exactly the two planned record-site pins. |
| Task 2 GREEN | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/adapter/engineAdapter.test.ts src/determinismContract.test.ts` → 40 passed \| 8 skipped; `pnpm --filter efx-motion-editor exec vitest run … aquarelleStrokeBridge.test.ts` → 16 passed. Committed as `feat`. |
| Task 3 | No TDD cycle (`auto`, no `tdd="true"`): new plain node-env tests plus the component wiring, verified green before the atomic commit. |
| REFACTOR | Not needed — no cleanup beyond the in-cycle work. |

RED evidence records live in `.planning/phases/61-vector-painting-tool/.red-evidence/61-07-t1/` and `61-07-t2/` (committed with their GREEN commits; the sibling `.red-evidence/61-0x-t*` directories remain untracked as in prior plans).

## Files Created/Modified

- `packages/efx-watercolor/src/playground/Engine.ts` - `StrokeRenderMode`, `Stroke.renderMode`, `scriptBegin(..., renderMode = 'watercolor')`, interactive brush seed, `RIBBON_RIM_FRAC`, and the ribbon deposit branch
- `packages/efx-watercolor/src/playground/shaders.ts` - `uRibbon` / `uEdge` uniforms and the guarded ribbon profile in `stampFS`
- `packages/efx-watercolor/src/playground/brushes.ts` - `BrushPreset.renderMode` (pulled forward in Task 1) and the `simple-ribbon` preset
- `packages/efx-watercolor/src/playground/engineRenderMode.test.ts` - created: 10 non-GPU pins over a hand-seeded engine (mode channel, interactive seed, sampling-law guards, branch discriminator, floored-expression prohibition, shader uniforms)
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` - the one `scriptBegin` mode argument; `scriptMove` unchanged
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` - the preset contract, the mapping table, `recordedRenderModeField`, the payload round trip, and the multi-line `scriptBegin` source contract
- `packages/efx-watercolor/src/determinismContract.test.ts` - the mode-parameterised replay arm with the deterministic engine stand-in and pinned `paperSeed`
- `packages/efx-watercolor/src/payload/vectorPath.ts` - `SIMPLE_RIBBON_BRUSH_ID`, `resolveRenderModeForBrushId`, `recordedRenderModeField`
- `packages/efx-watercolor/src/payload/vectorPath.test.ts` - the VEC-04 per-anchor pin scoped to the anchor type
- `packages/efx-watercolor/probe/vector-spine/probe.ts` - `?scenario=ribbon`: two arms, edge-transition measurement, seven-global digest sweep
- `packages/efx-watercolor/probe/vector-spine/run.mjs` - `--scenario ribbon`, `/tmp/vector-spine/ribbon-result.json`, `VECTOR-RIBBON` verdict
- `packages/efx-watercolor/probe/vector-spine/.gitignore` - ignores the regenerated `probe.bundle.js`
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - the record-time mode stamp
- `app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts` - the record-site source pins
- `app/src/components/physic-paint/view/brushMenuPresets.ts` - created: `BrushMenuTarget`, `filterLiftPresets`, `brushMenuPresets`
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` - both branches through `brushMenuPresets`
- `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` - `ThumbMode`, `resolveThumbMode`, `drawCrispSweep`
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts` - created: helper behaviour + branch wiring pins
- `app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts` - created: thumb-mode resolver + crisp-branch source contract + cache-key pin
- `app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts`, `WatercolorBrushLibrary.test.ts`, `WatercolorBrushLibrary.tsx`, `aquarellePresetSelection.test.ts` - shipped-count and list expectations updated for the 16th preset; canvas stub gains the path API

## Verification Run

- `pnpm --filter @efxlab/efx-watercolor exec vitest run` → 16 files, **299 passed | 8 skipped (GPU-only)** (307)
- `node packages/efx-watercolor/probe/vector-spine/run.mjs --scenario ribbon` → `VECTOR-RIBBON PASS ratio=0.15 wet=7/7`; `edgeTransitionPx.{watercolor: 20, ribbon: 3}`
- `pnpm --filter efx-motion-editor exec vitest run` → 414 passed | 2 skipped (416 files); **8502 passed | 1 skipped | 96 todo (8599 tests)**
- `pnpm --filter efx-motion-editor run typecheck` → only the 3 pre-existing errors (see Deferred Issues); no error in any plan file
- `git diff <ledger>..HEAD -- packages/efx-watercolor/src/bake/aquarelleBake.ts` → empty (C-04)
- `git diff <ledger>..HEAD -- packages/efx-watercolor/src/payload/toStudioStroke.ts` → empty; `AquarelleTool` remains the four-value union (no fifth tool)
- Engine diff review: additions are the mode type/field, the `scriptBegin` argument, the interactive seed, the ribbon branch and the shader uniforms — `spacingFrac`, the carry phase and the 48-substep cap have no changed line
- Post-commit deletion check on all six commits → no tracked file deleted

## Decisions Made

- **Explicit stroke data, never inference.** The branch is read from `stroke.renderMode`; no parameter value selects it. The interactive stroke seeds from the brush through the shipped `setBrush(buildBrushForStroke(...))` path, and a supplied `scriptBegin` mode always wins — that is what keeps replay independent of the loaded brush.
- **No second deposit path.** The branch is inside the existing `trace`/`stamp` path, so the dab count is unchanged and the sampling law does not fork.
- **Neutral brush multipliers on the clean-sweep preset.** Zeroing water/load/flow/capacity would make a raised global unable to reach the deposit, falsifying D-13; the preset only changes crispness.
- **Conditional canonical term at the record site.** `recordedRenderModeField` returns `{}` for the watercolour default, so a plain hand-painted stroke keeps its exact pre-phase key set and byte cost (REL-02).
- **Deterministic replay stand-in.** vitest has no WebGL2, so the adapter runs engine-less and a mock 2D canvas returns zero bytes; the replay arm swaps in a deterministic engine whose exported bytes are a pure function of the fed script (including mode). The real-pixel proof stays in the probe.
- **Thumb cache key unchanged.** The mode is a preset property, so the paint-once cache remains keyed by preset id.
- **The eraser popover owns a tip shape, not a render mode.** One pure helper filters it, and the brush popover keeps the complete list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `BrushPreset.renderMode` pulled forward into Task 1**
- **Found during:** Task 1 (tracer)
- **Issue:** The interactive stroke seeds its mode from `this.brush.renderMode`, and the engine's own test needed the field on `Brush`; the preset type could not wait for Task 2 or the tracer could not compile.
- **Fix:** Added the optional `renderMode?: 'simple-ribbon'` field to `BrushPreset` in Task 1's GREEN with its D-12 documentation; no preset used it until Task 2.
- **Files modified:** `packages/efx-watercolor/src/playground/brushes.ts`
- **Commit:** `25582f1b5`

**2. [Rule 1 - Bug] Concentration-floor count assertion corrected (1 → 2 pre-phase copies)**
- **Found during:** Task 1
- **Issue:** The RED test asserted one occurrence of `0.15 * Math.exp(P.load * 2.8)` in `Engine.ts`, but the pre-phase engine legitimately owns two (the brush case and `fillStep`); the assertion, not the engine, was wrong.
- **Fix:** Pinned the true pre-phase counts — wet floor 1, concentration floor 2 — and documented why; the ribbon branch adds neither.
- **Files modified:** `packages/efx-watercolor/src/playground/engineRenderMode.test.ts`
- **Commit:** `25582f1b5`

**3. [Rule 3 - Blocking] Adapter source contract could not read the multi-line `scriptBegin`**
- **Found during:** Task 1
- **Issue:** The 61-04 contract asserted the last source line of the `scriptBegin` call ended in `widthFactor)`. The render-mode argument makes the call multi-line, so the line-based assertion no longer described the call site.
- **Fix:** The contract now slices the argument block between `scriptBegin(` and `scriptMove(` and pins the width factor plus the render-mode expression on the SAME call — reinforcing T-61-22 (one deposit path).
- **Files modified:** `packages/efx-watercolor/src/adapter/engineAdapter.test.ts`
- **Commit:** `25582f1b5`

**4. [Rule 1 - Bug] Ribbon sweep coefficient tuned to a full-opacity core**
- **Found during:** Task 1 (probe)
- **Issue:** The first coefficient left the ribbon plateau translucent, so the edge measurement had no 90% band to descend from and could not quantify the rim.
- **Fix:** Raised the sweep coefficient so the core reaches full opacity while the physical rim (`RIBBON_RIM_FRAC`) resolves the edge; the probe then measured 20px → 3px.
- **Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`
- **Commit:** `25582f1b5`

**5. [Rule 3 - Blocking] Probe bundle output needed ignoring**
- **Found during:** Task 1
- **Issue:** `run.mjs` regenerates `probe.bundle.js` on every run, leaving a generated artifact untracked.
- **Fix:** Added `probe/vector-spine/.gitignore` for the bundle.
- **Files modified:** `packages/efx-watercolor/probe/vector-spine/.gitignore`
- **Commit:** `25582f1b5`

**6. [Rule 1 - Bug] Record-site prose tripped the no-`anchors` source pin**
- **Found during:** Task 2 (GREEN)
- **Issue:** The explanatory comment at the record site contained the literal word `anchors`, so the new "writes no anchors key" source pin failed on prose rather than code.
- **Fix:** Reworded the comment to "The mode is a stroke property, never a path property (D-14)." The pin still guarantees the hand-painted path writes no `anchors` key.
- **Files modified:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`
- **Commit:** `15179d88c`

**7. [Rule 3 - Blocking] Existing shipped-count pins updated for the 16th preset**
- **Found during:** Task 3
- **Issue:** Four existing surfaces hard-coded the old 15-preset catalog (lift list completeness, card count, paint-once count, exact id list) and the library test's canvas stub lacked `beginPath`/`moveTo`/`lineTo`/`stroke`, so the new crisp thumb could not paint under node.
- **Fix:** Replaced the counts with `BRUSH_PRESETS.length`, narrowed the lift expectation to the filtered list (the new law), extended the id list with `simple-ribbon`, added the path API to both canvas stubs, and updated the stale header comment. Behaviour is unchanged for every other preset.
- **Files modified:** `PhysicsPaintBrushPicker.test.ts`, `WatercolorBrushLibrary.test.ts`, `WatercolorBrushLibrary.tsx`, `aquarellePresetSelection.test.ts`
- **Commit:** `aabf2dba3`

**8. [Rule 3 - Blocking] VEC-04 per-anchor pin painted the new stroke-level helper as a violation**
- **Found during:** plan-level verification
- **Issue:** `vectorPath.test.ts` scanned the whole module for `brushId` to forbid per-anchor paint identity; the new `resolveRenderModeForBrushId`/`recordedRenderModeField` are stroke-level helpers and made the whole-file regex fail.
- **Fix:** Scoped the scan to the anchor type and its canonicalisation (the only place an anchor member can be declared) and documented why; the prohibition is unchanged for anchors.
- **Files modified:** `packages/efx-watercolor/src/payload/vectorPath.test.ts`
- **Commit:** `6018713a1`

### Design Notes (not deviations)

- The determinism replay arm uses a `vi.mock` engine stand-in because vitest has no WebGL2; the mock's exported bytes depend on the render mode passed at the one `scriptBegin` call, so the arm fails if the mode stops reaching the engine or the replay stops being deterministic. Real-pixel proof remains in the probe.
- `vi.mock` must name the adapter's own specifier (`./playground/Engine` from `src/determinismContract.test.ts`); a parent-relative path silently fails to intercept and leaves the real constructor throwing.

---

**Total deviations:** 8 auto-fixed (2 Rule 1 bugs, 6 Rule 3 blocking)
**Impact on plan:** No scope change. The plan's behaviour is fully implemented; every deviation either unblocked the tracer, corrected an over-broad pin, or updated shipped-count expectations for the deliberately added preset.

## Deferred Issues

- Three pre-existing app typecheck errors remain in untouched, out-of-scope files: `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts:243` (`MINIMAL_VECTOR_FLAGS_OFFSET` unused) and `app/src/lib/mceFieldContract.test.ts:351/352/354` (TS2352 conversions). Not introduced by this plan; left untouched per the scope boundary.
- E8 error backstop (the thumb must read as a plain sweep) and the end-of-phase live UAT (paint with the ribbon, raise Water, save/reopen) are human-judgement rows recorded in coverage D5/D6.

## Known Stubs

None — no placeholder values, no unwired data sources, no skipped tests in the plan's surface.

## Self-Check: PASSED

- `packages/efx-watercolor/src/playground/engineRenderMode.test.ts` — FOUND
- `app/src/components/physic-paint/view/brushMenuPresets.ts` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts` — FOUND
- `app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts` — FOUND
- `packages/efx-watercolor/probe/vector-spine/.gitignore` — FOUND
- `559e6fb65`, `25582f1b5`, `19743d6ff`, `15179d88c`, `aabf2dba3`, `6018713a1` — all ancestors of HEAD
