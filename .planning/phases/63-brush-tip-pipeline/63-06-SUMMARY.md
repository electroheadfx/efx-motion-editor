---
phase: 63-brush-tip-pipeline
plan: 06
subsystem: ui
tags: [brush-tips, preact-signals, mask-registry, cache-invalidation, cross-realm, tdd]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-03's three compile-time built-in tips, module-level mask registry and maskGeneration() counter"
  - phase: 63-brush-tip-pipeline
    provides: "63-05's cross-realm import request/result and the replace-only catalog snapshot that fills the Studio realm"
provides:
  - "A sectioned brush library in delivered order: shipped Presets, Texture (the three wc/builtin-* tips), then Custom (project imports, only when non-empty)"
  - "One painted-stroke thumbnail per tip id, painted through buildBrushForStroke and cached on tip id + mask generation"
  - "One import toolbar row above the grid (the only new control), wired through importTip and requestPhysicPaintBrushImport, disabled in flight, with IMPORT_TIP_FAILURE_COPY on refusal"
  - "Greyed, unselectable cards for unavailable project tips plus exactly ONE aggregate warning line naming unavailableTipCount"
  - "Generation-keyed stroke-thumb, tinted-tip (tipImage) and engine footprint caches, so a replaced mask is never served stale"
affects: [63-07, 63-08, 63-09, verify-work]

actuals:
  tokens: 16241
  tasks: 3
  commits: 4
  plan_head_before: a72862232f555dd5dd3b82a3469c42c94dd8c987
  plan_head_after: 71e35f2c740bbe6d61b4d57b0e85ed6b108255ed

tech-stack:
  added: []
  patterns:
    - "Module-scope signals for state shared by both library mounts, with compare-then-write setters (efx-preact-reactivity rule 3)"
    - "Every derived cache key carries maskGeneration(): single-entry footprint signature, stroke thumb, and the tinted tip canvas"
    - "Cross-realm import: the Studio realm decodes the picked file, the main realm owns registration and the catalog push"
    - "TAP-clean RED assertions: boolean identity/count pins instead of object or whole-source comparisons"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
    - app/src/components/physic-paint/engine/aquarelleFootprint.ts
    - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts

key-decisions:
  - "The unavailable set stays the catalog store's replace-only signal; the component declares no second degradation state, so a multi-failure state is one signal and one rendered line (D-19)."
  - "The import row decodes in the Studio realm and asks the main realm via requestPhysicPaintBrushImport; the component never appends to the catalog itself."
  - "tipImage's tinted-tip canvas key carries maskGeneration() in addition to id and hex, not just the stroke-thumb key: drawStroke blits that canvas, so a stale mask could otherwise survive a generation bump."
  - "The footprint cache signature is `${tipId}|${overrides}|g${maskGeneration()}`; the build-count observable comes from a delegating vi.mock wrapper because the single-entry cache has no accessor."
  - "RED assertions use boolean identity/count forms: object `.not.toBe` and whole-source `toContain` diagnostics print multi-line YAML that the TAP-red evidence parser refuses (first capture was INVALID_RED for that reason)."

patterns-established:
  - "Mask-generation invalidation is layered: engine footprint, stroke thumb and tinted tip all observe the same counter, so one registry write invalidates every preview surface together."
  - "An import affordance lives where the brushes are: one toolbar row inside the library, never a revived docker."

requirements-completed: [TIP-01, TIP-06, TIP-10, TIP-13]

coverage:
  - id: D1
    description: "The library renders Presets, Texture and Custom sections in order, every card painting its own stroke thumbnail resolved through buildBrushForStroke"
    requirement: "TIP-13"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#brush-card grid (I-03, 261027-gh9)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts#stroke thumb cache (63-06 D-05 / T-63-18)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One import toolbar row above the grid wires the picked PNG/JPEG through importTip and requestPhysicPaintBrushImport, disables in flight, and shows IMPORT_TIP_FAILURE_COPY on refusal without touching the catalog"
    requirement: "TIP-01"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#import row and unavailable tips (63-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unavailable project tips render greyed and disabled, cannot become the active tip, and produce exactly one aggregate warning line for the whole set"
    requirement: "TIP-10"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#three unavailable tips produce one aggregate line and three greyed cards"
        status: pass
    human_judgment: false
  - id: D4
    description: "A mask replaced under an unchanged id rebuilds the footprint brush and repaints both thumbnail caches; a registry reset reverts the same id to the preset footprint; clearing drops both maps"
    requirement: "TIP-06"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleFootprint.test.ts#footprint brush cache is generation-aware (63-06 / G-2 / T-63-18)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts#thumbnail caches observe mask generation (63-06 / T-63-18)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live Studio surface: import a PNG/JPG from the Brush tab, see the new Custom card preview its own texture, paint a visibly different footprint with it, and see a degraded project tip greyed with one warning line"
    requirement: "TIP-01"
    verification: []
    human_judgment: true
    rationale: "The node vitest environment stubs both the canvas and the Tauri event bus; thumbnail appearance, the aggregate warning placement and the painted stroke footprint require a live run."

duration: 49min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 06: Brush Library Truthful Surface Summary

**The brush library now shows its real catalog — three sections, per-tip painted previews, an in-library import row and honest degraded cards — with every preview and footprint cache keyed to the mask generation.**

## Performance

- **Duration:** 49 min
- **Started:** 2026-11-15T11:53:32Z
- **Completed:** 2026-11-15T12:42:43Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- The library is sectioned in delivered order: the shipped `BRUSH_PRESETS` first, then "Texture" (the three compile-time `wc/builtin-*` tips), then "Custom" only when the open project has imports. Section headers span both library columns and lay their own 2-column card grid, so section order is visual order.
- Every card paints its own stroke thumbnail. The thumb module resolves a mask-backed tip through the same `buildBrushForStroke` binding the engine and the bake use, so a preview cannot drift from the stroke it produces; preset ids keep the shipped `buildBrush(preset)` path.
- One import toolbar row above the grid is the only new control: a `FolderOpen` button plus a hidden PNG/JPEG input. Picking a file decodes one 192×192 mask in the Studio realm through `importTip`, then asks the main realm via `requestPhysicPaintBrushImport`; the catalog push lists the result and the component never appends it itself. The button is disabled in flight and a refusal renders `IMPORT_TIP_FAILURE_COPY` without changing the catalog.
- An unavailable project tip renders as a greyed, disabled, unselectable card, and the whole degraded set produces exactly one aggregate warning line naming `unavailableTipCount` — never one line per tip.
- All three derived caches observe `maskGeneration()`: the engine footprint's single-entry signature, the stroke-thumb cache key and `tipImage`'s tinted-tip canvas key. A mask replaced under an unchanged id rebuilds and repaints; a registry reset reverts the same id to the preset footprint; `clearStrokeThumbCache` drops both maps.
- Selecting a mask-backed card resolves through the project catalog (`selectAquarelleTip` → `resolveCatalogTip`), so a custom id becomes the active tip; the eight response multipliers still apply to the next stroke. The lift/eraser popover remains preset-only (D-04), and `BrushesDocker` stays unmounted and unimported (D-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end card — a sectioned grid with real per-tip previews** — `49b64b509` (feat, tracer)
2. **Task 2: Import row, greyed unavailable cards and one aggregate warning** — `4dc1faf9d` (feat)
3. **Task 3: Cache correctness — generation-keyed previews and footprint** — `163221b20` (test, RED) → `71e35f2c7` (feat, GREEN)

_Note: the tracer task's feedback gate re-ran its full `<verify>` end-to-end (package build plus the three suites) before expansion; 32 tests passed. The RED evidence for task 3 is `.planning/phases/63-brush-tip-pipeline/63-06-red-evidence-task3.json` (`RED_EVIDENCE_OK`, 4 failing / 23 passing)._

## Files Created/Modified

- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` — three sections, per-tip painted cards, the one import toolbar row, the aggregate unavailable line, greyed unselectable cards, and a module header stating the delivered surface
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` — section order, per-tip thumbs, import row, refusal path, one-warning-one-signal degradation pins
- `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` — mask-generation key on the stroke-thumb cache and on `tipImage`'s tinted-tip canvas
- `app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts` — source pins plus functional stub-canvas tests for generation invalidation and both-map clearing
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `selectAquarelleTip` resolves catalog ids after `TIPS` and `BRUSH_PRESETS`
- `app/src/components/physic-paint/view/aquarelleRecordState.test.ts` — catalog-id selection and lift-preset-only pins
- `app/src/components/physic-paint/engine/aquarelleFootprint.ts` — `brushFor` signature carries `maskGeneration()`
- `app/src/components/physic-paint/engine/aquarelleFootprint.test.ts` — build-count and preset-revert pins through a delegating mock wrapper

## Decisions Made

- Degradation is one state: the store's replace-only `unavailableTipIds`. The component adds no second signal, so the tests assert one signal and one rendered line rather than a node count.
- The import row decodes in the Studio realm and delegates registration; it never mutates the catalog locally, keeping the main realm the single owner of project data.
- `tipImage`'s key needed the generation independently of the stroke-thumb key: `drawStroke` blits that canvas, so a stale tinted tip would defeat a correct stroke-thumb invalidation.
- The footprint cache is observable only through `buildBrushForStroke` calls, verified with a delegating `vi.mock` wrapper and a `vi.hoisted` counter.
- RED assertions were written in boolean identity/count form after the first TAP capture was refused (`INVALID_RED`): object `.not.toBe` and whole-source `toContain` diagnostics print multi-line YAML.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first RED evidence capture was rejected by `gsd_run check tdd-red-evidence` because the source pin compared the whole file and a canvas identity comparison printed multi-line TAP diagnostics. Rewritten as boolean assertions; the second capture validated `RED_EVIDENCE_OK`. No production code was touched before GREEN was authorized.

## User Setup Required

None.

## Next Phase Readiness

- The library consumes the child realm's catalog and unavailable set exactly as plan 63-05 provides them; no fetch is re-implemented here.
- Remaining phase work can build on the generation-keyed cache law: any new derived preview must include `maskGeneration()` in its key.
- Live UAT (coverage D5) remains: import from the Brush tab, confirm the custom card previews its own texture and paints a different footprint, then confirm a degraded tip shows greyed with one aggregate line.

## Self-Check: PASSED

- All 8 plan source files and the RED evidence artifact exist on disk.
- All 4 plan commits (`49b64b509`, `4dc1faf9d`, `163221b20`, `71e35f2c7`) are ancestors of HEAD.
- Plan-level verification: 5 suites / 76 tests passed; `src/viteBuild.test.ts` 13 tests passed (main chunk 1,895.43 kB < 2000 kB); the `BrushesDocker` source grep prints 0.
