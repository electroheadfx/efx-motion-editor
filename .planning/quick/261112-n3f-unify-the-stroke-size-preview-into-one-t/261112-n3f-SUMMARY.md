---
phase: 261112-n3f-unify-the-stroke-size-preview-into-one-t
plan: 01

subsystem: ui
tags: [preact, signals, svg-mask, vector-painting, stroke-preview, aquarelle]

# Dependency graph
requires:
  - phase: 61-25
    provides: the UI-03 band law (fill 0.14/0.07, edge 3.5/1.5, non-scaling stroke) and the Select/Move band renderer
  - phase: 261101-mvg
    provides: the stroke-size preview switch and the cached paint-footprint band resolver
provides:
  - strokeSizePreview is the ONE gate for the Edit-path vector width envelope (OFF by default)
  - a split envelope render (unmasked fill + per-path masked edge at doubled authored width) shared by Edit path, 61-13 wireframe and Select/Move band
  - ScriptStrokeBand descriptor ({ polygonPx, maskedEdge? }) as the bandFor return contract
  - vector strokes preview in Select mode as the SAME per-vertex envelope the Edit-path overlay draws
affects: [61-25 band surface, 61-13 wireframe, Select/Move preview, any future envelope consumer]

actuals:
  tokens: 9158
  tasks: 2
  commits: 2
plan_head_before: 8801594eb536be3cd8e665304a05ba48c07459ee
plan_head_after: 8f5ae4c82c3c944421339f1fe79800019d795790

tech-stack:
  added: []
  patterns:
    - "Per-path SVG mask + doubled authored stroke width instead of polygon union or SVG filter"
    - "Edge-policy descriptor on the edition port (`maskedEdge`) rather than branching on stroke kind at the draw site"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The envelope is two nodes: an UNMASKED fill (wash survives) plus ONE masked edge (interior crossings gone), with the authored width doubled so the visible contour keeps the 61-25 3.5/1.5 weight."
  - "Mask ids are deterministic per path: `vector-envelope-mask-<sanitized key>` for the Edit path and `script-stroke-band-mask-<mutationId>` for the Select band; one overlay per canvas layer keeps them document-unique."
  - "Select mode resolves a vector stroke to the same per-vertex envelope via projectVectorPath (same anchors, same curve mode) instead of the paint-band approximation."
  - "D-10 survives on both surfaces: a uniform-width vector stroke draws no envelope and resolves no band."

patterns-established:
  - "Masked-edge descriptor: the resolver declares the polygon's edge policy; the drawing surface honours it with the same mask + doubled-width law."

requirements-completed: [QUICK-261112-N3F]

coverage:
  - id: D1
    description: "Edit-path vector width envelope is gated by the shared Preview-stroke-size switch (OFF by default); D-10 still refuses a uniform profile"
    requirement: QUICK-261112-N3F
    verification:
      - kind: unit
        ref: "src/components/physic-paint/engine/VectorPathOverlay.test.ts#draws no envelope for a path edit while the preview switch is off"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/engine/VectorPathOverlay.test.ts#draws the per-vertex envelope only while the preview switch is on"
        status: pass
    human_judgment: true
    rationale: "UAT rows 1-3 are live visual judgments on the native paint window; unit pins prove structure, not the rendered absence of interior lines."
  - id: D2
    description: "61-13 wireframe keeps drawing every vector stroke's envelope unconditionally, whatever the switch says"
    requirement: QUICK-261112-N3F
    verification:
      - kind: unit
        ref: "src/components/physic-paint/engine/VectorPathOverlay.test.ts#keeps the wireframe envelope for a uniform profile whatever the switch says"
        status: pass
    human_judgment: true
    rationale: "UAT row 4 checks the wireframe on the live canvas; the unit pin only proves the nodes are emitted."
  - id: D3
    description: "Wherever the envelope is painted it is an unmasked fill plus one masked edge at doubled authored width — no interior self-intersection lines, wash intact"
    requirement: QUICK-261112-N3F
    verification:
      - kind: unit
        ref: "src/components/physic-paint/engine/VectorPathOverlay.test.ts#masks the edge with the filled polygon while the fill stays unmasked"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/engine/VectorPathOverlay.test.ts#draws a Select-mode vector band as an unmasked fill plus one masked edge"
        status: pass
    human_judgment: true
    rationale: "UAT rows 3 and 6 are rendered-pixel judgments on the native window; the DOM pins cannot observe painted crossings."
  - id: D4
    description: "Select mode resolves a vector stroke as its per-vertex envelope (descriptor flagged maskedEdge); hand-painted bands and lifts keep the shipped single path with unchanged props"
    requirement: QUICK-261112-N3F
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#resolves a vector stroke to its per-vertex envelope flagged for the masked edge"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#resolves no band for a uniform-profile vector stroke"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/PhysicsPaintStudio.test.ts"
        status: pass
    human_judgment: true
    rationale: "UAT row 5 judges the pinch/swell against the old constant footprint and the untouched paint/lift bands live."
  - id: D5
    description: "Preview OFF in Select mode still shows no band anywhere"
    requirement: QUICK-261112-N3F
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#resolves no band for either kind while the switch is off"
        status: pass
    human_judgment: true
    rationale: "UAT row 7 confirms the shipped thin centerline outlines are what remains on the live canvas."

duration: 18min
completed: 2026-11-12
status: complete
---

# Quick 261112-n3f: Unify the stroke-size preview into one toggle Summary

**One Preview-stroke-size switch now gates the vector width envelope on every surface, drawn as an unmasked fill plus a per-path masked edge so the closed ring's interior self-intersection lines are never painted.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-11-12T16:06:48Z
- **Completed:** 2026-11-12T16:25:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `strokeSizePreview` is the single gate in the Edit-path surface: the overlay reads it once in its component body (the same narrow leaf that reads `wireframeMode`) and `renderPath` now takes `preview`; opening a path edit or storing a non-uniform profile no longer draws an envelope on its own. The 61-13 wireframe still passes `alwaysEnvelope: true` and draws unconditionally, uniform profile included.
- The envelope renders as three parts: a `<defs><mask>` built from the filled polygon over the layer box, an unmasked fill path keeping `0.14/0.07`, and a new `vector-path-envelope-edge` path at the doubled authored width (`(selected ? 3.5 : 1.5) * 2`) masked by that polygon — so the wash survives and the crossing straight lines produced by `buildEnvelope`'s closed ring are hidden. No polygon union, no SVG filter.
- `bandFor` now returns a `ScriptStrokeBand` descriptor (`polygonPx` + optional `maskedEdge`). `resolveAquarelleStrokeBandPx` resolves a vector stroke to the SAME `projectVectorPath` envelope (same stored anchors, same curve mode) flagged `maskedEdge: true`; paint and lift descriptors are the shipped geometry with no flag.
- `ScriptStrokeOverlay` honours the flag: a masked band is an unmasked `stroke-size-band` fill plus one `stroke-size-band-edge` at doubled width masked by `script-stroke-band-mask-<mutationId>`; paint and lift keep the shipped single path with unchanged rendered props and no mask. Pointer, drag and transform lifecycle untouched; no `useEffect`/`useSignal` added.
- Three suites repointed and extended; the geometry law (`projectVectorPath` / `buildEnvelope` / `buildStrokeBandCached`) is untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: One preview gate in the Edit-path surface and an envelope edge that paints only the outer silhouette** - `b52855017` (feat)
2. **Task 2: The Select/Move band end-to-end — one descriptor from port type to unmasked fill plus one masked edge** - `8f5ae4c82` (feat)

**Plan metadata:** none — the orchestrator commits `.planning/` artifacts after handoff.

## Files Created/Modified

- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - imports `strokeSizePreview`, reads it once in the component body, adds the `preview` parameter and the split fill/masked-edge envelope fragment with `envelopeMaskId`.
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - OFF-by-default, switch-gated, non-vacuous D-10 and unconditional-wireframe pins; mask-structure pin; split Edit-path band law; Select/Move masked band, paint/lift single-path and transform-follow pins (inside the 61-25 UI-03/UI-04 describe).
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` - descriptor resolution, hoisted `bandEdgeWidthPx`, `bandMaskId`, and the two render branches (masked fill + edge vs shipped single path).
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` - `ScriptStrokeBand` interface and the `bandFor` return type (type-only change).
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - vector branch resolving the per-vertex envelope with `maskedEdge: true`; paint/lift wrapped as plain descriptors.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` - vector descriptor, uniform-profile refusal, OFF behaviour and untouched paint/lift descriptor pins.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - the two moved source pins plus the descriptor/mask/edge-testid pins.

## Decisions Made

- Mask the edge only: a black mask over the polygon interior would erase the wash, so the fill node stays unmasked and the mask trims the edge's inner half; authoring 2x width keeps the VISIBLE contour at the 61-25 3.5/1.5 law.
- Deterministic mask ids (sanitized drawn key / numeric mutation id) instead of a counter hook, relying on one overlay per canvas layer for document uniqueness.
- Vector Select band reuses `projectVectorPath` rather than a new geometry path, so the Edit-path surface and the Select/Move surface can never disagree; D-10 (no envelope for uniform profiles) falls out on both.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored the literal `const band =` the Studio pin anchors on**
- **Found during:** Task 2 (Select/Move band)
- **Issue:** The plan asked for `bandFor` to return the descriptor AND for the Studio pin to anchor on `indexOf('const band =')`; typing the local as `const band: ScriptStrokeBand | undefined =` made that anchor miss and typecheck also rejected the wireframe literal lacking the optional-property union shape.
- **Fix:** Removed the annotation (inference now yields the union) and added `maskedEdge: false` to the wireframe branch literal so both union members carry the property.
- **Files modified:** `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`
- **Verification:** `PhysicsPaintStudio.test.ts` and typecheck green.
- **Committed in:** `8f5ae4c82`

**2. [Rule 3 - Blocking] `polygonPx` declared readonly**
- **Found during:** Task 2 (typecheck)
- **Issue:** TS4104: `projectVectorPath(...).envelope` is `readonly CanvasPoint[]`, not assignable to the plan's literal mutable `polygonPx: CanvasPoint[]`.
- **Fix:** `readonly polygonPx: readonly CanvasPoint[]` in `ScriptStrokeBand`; mutable arrays remain assignable, so paint/lift descriptors are unaffected.
- **Files modified:** `app/src/components/physic-paint/view/scriptStrokeEdition.ts`
- **Verification:** typecheck green; suite green.
- **Committed in:** `8f5ae4c82`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both reconcile internal inconsistencies in the plan text (pin anchor vs annotation; readonly geometry). No scope creep, no behaviour change beyond the plan.

## Issues Encountered

- Test authoring only: a paren imbalance in two new `render(...)` calls and unused Task-1 imports (removed until Task 2 used them). No product-code issue beyond the two deviations above.

## Known Stubs

None — no hardcoded empty values, placeholder text or unwired data introduced.

## Threat Flags

None — every security-relevant surface added (mask ids, per-stroke envelope evaluation while ON) was already registered in the plan's threat model (T-261112-n3f-01/02/03); no package installs.

## User Setup Required

None - no external service configuration required.

## Verification Run

- `VectorPathOverlay.test.ts` — 95 tests green
- `aquarelleStrokeSelection.test.ts` — 98 tests green
- `PhysicsPaintStudio.test.ts` — 413 tests green
- `vectorPathHandles.test.ts` — 84 tests green (geometry law untouched)
- `scriptStrokeEdition.test.ts` — 31 tests green (port's other members untouched)
- `pnpm --prefix app run typecheck` — green
- Broader regression over `src/components/physic-paint/engine` + `src/components/physic-paint/view` — 128 files / 2,839 tests green
- Scope: `git diff --stat` names exactly the 7 planned paths (646 insertions, 75 deletions); `scriptStrokeEdition.ts` diff is type-only; no `<filter` in changed sources; no `useEffect`/`useSignal` in `ScriptStrokeOverlay.tsx`.

## Native UAT — handed to the user (not claimed)

1. Frame with a vector stroke carrying per-vertex width factors, Edit path open, Preview stroke size OFF (default): NO width envelope — only spine, anchors, handles.
2. Toggle Preview stroke size ON: the per-vertex envelope appears as the old automatic edit-path preview did; toggle OFF: it disappears without closing the edit.
3. Preview ON on a folding curved stroke: the Edit-path band keeps its fill and contour with NO straight navy lines crossing the interior; outer contour at its usual weight.
4. Wireframe ON with the Preview switch OFF: the envelope still appears for every vector stroke (uniform profile included), usual weight, no interior crossings.
5. Select mode, Preview ON: a vector stroke's band pinches and swells with its per-vertex widths; a uniform vector stroke shows no band; a hand-painted band and a lift ribbon look exactly as before.
6. Select mode, Preview ON, folding stroke: the band keeps its WASH and outer contour, no interior lines, contour not double weight; the adjacent hand-painted band is unchanged.
7. Preview OFF in Select mode: no band anywhere (the shipped thin centerline outlines).

## Next Phase Readiness

- Automated surface complete and green; awaiting the user's 7 native UAT rows before this quick task can be called verified.
- No blockers; the geometry law and the Studio behaviour are untouched, so no downstream surface needs migration.

---

*Phase: 261112-n3f-unify-the-stroke-size-preview-into-one-t*
*Completed: 2026-11-12*

## Self-Check: PASSED

- All 7 modified files exist on disk.
- Task commits `b52855017` and `8f5ae4c82` are ancestors of HEAD.
- Code working tree clean; only the orchestrator-owned PLAN.md edit and this SUMMARY.md are uncommitted (docs commit is the orchestrator's).
