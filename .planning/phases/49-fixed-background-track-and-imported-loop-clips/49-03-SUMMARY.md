---
phase: 49-fixed-background-track-and-imported-loop-clips
plan: 03
subsystem: store
tags: [efx-paint, background-track, document-fallback, fond-authority, cache-key, checkerboard, tdd]

# Dependency graph
requires:
  - phase: 49-fixed-background-track-and-imported-loop-clips (49-01)
    provides: extended BackgroundFallback union (paper arm) the fond instruction and selector round-trip
  - phase: 49-fixed-background-track-and-imported-loop-clips (49-02)
    provides: setBackgroundFallback op (revision-stable no-op on same-value writes) the selector write-through consumes
  - phase: 48-internal-compositor-and-flattened-parent-result
    provides: deriveEfxPaintBackgroundResolution + resolveEfxPaintBackgroundFrame (content/gap/missing verdicts) and the flattened cache key derivation
provides:
  - D-11 consumption half: _resolveDocumentFondInstruction reads ONLY document.background.fallback (per-track _rotoBackgroundMetadata fond walk deleted); both fond derivation sites (store flattened instruction AND monitor fondBackground) resolve the same fallback record
  - Flattened-cache fallback term: the derived key gains a `fallback:` term via the exported canonical encoder (encodeCanonicalBackgroundFallback) — a fallback-mode change with an unchanged background.revision still rotates the key (BKG-09)
  - Selector write-through + reflection: backgroundModeToFallback (one mode → one fallback record) + reflectFallbackToBackgroundMode (document authoritative, one-of active segment); BackgroundSelectorMode = Exclude<BgMode, 'photo'> structurally excludes the Phase 50 photo mode
  - D-12 monitor-only transparency checkerboard: repeating-conic-gradient(#777 0% 25%, #d8d8d8 0% 50%) 0 0 / 8px 8px layer beneath the monitor content, shown only when the effective fond is fully transparent for the current frame (transparent fallback AND gap verdict)
  - Store accessors getDocumentFondInstruction(layerId) + getBackgroundFrameVerdict(layerId, frame) — the monitor consumes the already-resolved background-frame plumbing, never a re-resolution
affects: [49-04, 49-05, 49-06, Phase 50 photoReference]

# Actuals (#2632) — pairs with the plan's estimate (80000 tokens)
actuals:
  tokens: 11486    # chars/4 over the realized diff (45946 chars)
  tasks: 3         # tasks completed
  commits: 5       # commits made

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One fond authority, two consumers: the store resolves document.background.fallback to the fond instruction once; the flattened path and the monitor fond layer both consume it (Pitfall 1)"
    - "Canonical encoder single source: the flattened cache key's fallback term reuses the document revision encoder's encodeCanonicalBackgroundFallback — no second hand-written switch that can drift (T-49-03-02)"
    - "Instruction → metadata bridge: fondInstructionToFondMetadata maps the store's resolved instruction back to the view's PhysicPaintRotoBackgroundMetadata prop, lossless for the solid/paper arms"
    - "Monitor-only paint: the checkerboard is a pure CSS layer (no canvas, no document state) — never in the flattened raster, main preview, or export (T-49-03-03)"

key-files:
  created: []
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
    - app/src/lib/previewRenderer.test.ts

key-decisions:
  - "Fond authority collapsed to the document fallback: _resolveDocumentFondInstruction reads ONLY document.background.fallback; the per-track _rotoBackgroundMetadata fond walk is deleted, not shadowed (Pitfall 1). Transparent → no instruction; solid → solid fill; paper → paper draw with paperGrain/grainStrength"
  - "Flattened cache key gains a dedicated fallback term via the exported canonical encoder (encodeCanonicalBackgroundFallback) — a fallback-mode change with an unchanged background.revision still rotates the key, so a stale fond raster is never served (BKG-09, T-49-03-02)"
  - "Selector round-trip: backgroundModeToFallback maps each of the fixed five modes to exactly one fallback record (white → solid #ffffff, no distinct 'white' literal); reflectFallbackToBackgroundMode derives the active segment from the document (authoritative); same-mode dispatch is a revision-stable no-op through setBackgroundFallback's guard (BKG-09, the 1552-1569 lesson)"
  - "BackgroundSelectorMode = Exclude<BgMode, 'photo'> structurally excludes the Phase 50 photo mode from the fallback surface (D-11) — the engine BgMode union itself is untouched"
  - "Monitor fond + checkerboard consume the store's already-resolved plumbing: getDocumentFondInstruction returns the same instruction the flattened path uses; getBackgroundFrameVerdict reuses deriveEfxPaintBackgroundResolution + resolveEfxPaintBackgroundFrame with the runtime known-source set — never a re-resolution in the Studio"
  - "Checkerboard condition: fondInstruction === null AND getBackgroundFrameVerdict === 'gap' — transparent fallback AND no clip covering the frame. The layer is a pure CSS repeating-conic-gradient div, clipped to canvas bounds, paint-only (T-49-03-03)"

patterns-established:
  - "Pattern: one authority, two consumers — the store resolves the fallback to the fond instruction once; the flattened path and the monitor fond layer both consume it, so Studio monitor, row gap swatches, flattened parent output, main preview, and export can never disagree"
  - "Pattern: canonical encoder single source — the flattened cache key's fallback term reuses the document revision encoder's per-mode term (encodeCanonicalBackgroundFallback), never a second hand-written switch"
  - "Pattern: monitor-only paint — the transparency checkerboard exists only as a CSS layer in the Studio monitor stack, never a document state and never in any raster output"

requirements-completed: [BKG-06, BKG-09]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "D-11 fond authority — _resolveDocumentFondInstruction reads ONLY document.background.fallback (solid white fills regardless of per-track metadata; paper canvas2 draws the paper; transparent produces no instruction; deleting a per-track metadata entry is inert); the monitor fondBackground resolves from the same store instruction (no inline derivation remains)"
    requirement: BKG-06
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#49-03 T1: solid white fallback fills white regardless of per-track roto background metadata"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#49-03 T2: paper canvas2 fallback draws the canvas2 paper; transparent fallback produces no fond"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#49-03 T4: deleting a per-track roto background metadata entry no longer changes the fond instruction"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#resolves the monitor fond from the document fallback via the store instruction (no inline derivation remains)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Selector write-through + reflection (S6) — each of the fixed five modes maps to exactly one document fallback record; the active segment resolves unambiguously from the document (solid non-white → White, never a blank selector); same-mode dispatch is a revision-stable no-op (no documentRevision bump, no dirty callback); the option set contains no 'photo' value (D-11)"
    requirement: BKG-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-03 T1: each selector mode maps to exactly one document fallback record (write-through)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-03 T2: the active segment resolves unambiguously from the document fallback (reflection)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-03 T3: dispatching the current mode is a revision-stable no-op (no documentRevision bump, no dirty callback)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-03 T4: the fallback surface carries no photo mode — the fixed 5-option map (D-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Flattened-cache fallback term (BKG-09/CMP-04 carried) — the derived flattened cache key gains a fallback-content term (canonical encoding of the fallback record) alongside bg:${background.revision}; a fallback-mode change with EQUAL background.revision still produces a different key; identical documents yield identical keys"
    requirement: BKG-09
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#49-03 T3: a fallback-mode change with EQUAL background.revision rotates the flattened key; identical documents yield identical keys"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-12 monitor-only transparency checkerboard — shown only when the effective fond is fully transparent for the current frame (transparent fallback AND gap verdict); the two-gray repeating-conic-gradient treatment sits on a layer beneath the monitor content clipped to canvas bounds; raster non-regression: no checkerboard reference in the compositor, flattened cache, previewRenderer, or exportRenderer"
    requirement: BKG-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#shows the checkerboard only in the no-fond case and keeps the fond layer as today"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#uses the two-gray repeating-conic-gradient treatment clipped to canvas bounds"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#keeps the checkerboard out of the flattened raster, preview, and export (T-49-03-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-31
status: complete
---

# Phase 49 Plan 3: Document-Fallback Fond Authority, Selector Write-Through, and Monitor Checkerboard Summary

**Collapsed the fond to a single document-fallback authority (D-11): the store's flattened instruction and the Studio monitor fond both resolve `document.background.fallback` (the per-track roto metadata walk is deleted), the Background swatch selector round-trips through `setBackgroundFallback` with revision-stable same-mode no-ops, the flattened cache key gains a canonical fallback term so a fallback change always invalidates (BKG-09), and the monitor draws a paint-only transparency checkerboard only in the no-fond gap case (D-12).**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-31T13:00:00Z
- **Completed:** 2026-08-31T14:05:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- **D-11 fond authority (consumption half)**: `_resolveDocumentFondInstruction` now reads ONLY `document.background.fallback` — transparent → no instruction, solid → solid fill, paper → paper draw with paperGrain/grainStrength. The per-track `_rotoBackgroundMetadata` fond walk is DELETED, not shadowed (Pitfall 1). Both derivation sites — the store's flattened instruction AND the monitor's `fondBackground` — resolve the same fallback record, so Studio monitor, row gap swatches, flattened parent output, main preview, and export can never disagree (BKG-06).
- **Flattened-cache fallback term (BKG-09/CMP-04 carried)**: the derived flattened cache key gains a `fallback:` term using the exported canonical encoder `encodeCanonicalBackgroundFallback` (the document revision encoder's per-mode term — single source, no second hand-written switch, T-49-03-02). A fallback-mode change with an unchanged `background.revision` still produces a different key, so a stale fond raster is never served.
- **Selector write-through + reflection (S6)**: `backgroundModeToFallback` maps each of the fixed five modes to exactly one document fallback record (white → the 49-01-gated solid `#ffffff`, no distinct 'white' literal; paper modes carry the current grain controls); `reflectFallbackToBackgroundMode` derives the active segment from the document (authoritative, one-of, never a blank selector). Same-mode dispatch is a revision-stable no-op through `setBackgroundFallback`'s guard (BKG-09, the 1552-1569 OOM lesson). `BackgroundSelectorMode = Exclude<BgMode, 'photo'>` structurally excludes the Phase 50 photo mode (D-11).
- **D-12 monitor-only transparency checkerboard**: the canvas-stack memo computes `showTransparencyCheckerboard` as `fondInstruction === null && getBackgroundFrameVerdict(layerId, currentFrame) === 'gap'` — transparent fallback AND no clip covering the frame. The view renders a sibling layer beneath the monitor content (`repeating-conic-gradient(#777 0% 25%, #d8d8d8 0% 50%) 0 0 / 8px 8px`), clipped to canvas bounds, paint-only — never a document state, never in the flattened raster, main preview, or export (T-49-03-03).
- **Store accessors**: `getDocumentFondInstruction(layerId)` returns the same resolved instruction the flattened path uses; `getBackgroundFrameVerdict(layerId, frame)` reuses `deriveEfxPaintBackgroundResolution` + `resolveEfxPaintBackgroundFrame` with the runtime known-source set — the monitor consumes the already-resolved background-frame plumbing, never a re-resolution.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: re-wire `_resolveDocumentFondInstruction` to the document fallback + flattened-cache fallback term** - `aa27f4fd` (test: RED), `b1d903df` (feat: GREEN)
2. **Task 2: fond selector → document fallback write-through (S6) with idempotent same-mode clicks** - `a00d19ee` (test: RED), `a5f37eac` (feat: GREEN)
3. **Task 3: monitor fondBackground re-wire + transparency checkerboard (D-12, S7)** - `e1fc0576` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `app/src/stores/physicPaintStore.ts` - `_resolveDocumentFondInstruction` reads only `document.background.fallback` (metadata walk deleted); new public accessors `getDocumentFondInstruction(layerId)` and `getBackgroundFrameVerdict(layerId, frame)`.
- `app/src/stores/physicPaintStore.test.ts` - 49-03 T1 (solid white regardless of metadata), T2 (paper canvas2 / transparent), T4 (metadata deletion inert); RED 8/8b/8c updated to set the document fallback.
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` - flattened key gains the `fallback:` term via `encodeCanonicalBackgroundFallback`.
- `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` - 49-03 T3 (fallback change with equal revision rotates key; identical docs yield identical keys).
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` - `encodeCanonicalBackgroundFallback` exported (was private) as the single canonical fallback term source.
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` - `BackgroundSelectorMode`, `backgroundModeToFallback`, `reflectFallbackToBackgroundMode`.
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts` - 49-03 T1-T4 (write-through, reflection, idempotence, photo-absent).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - canvas-stack memo reads `getDocumentFondInstruction` + `getBackgroundFrameVerdict`; `fondInstructionToFondMetadata` bridge; `showTransparencyCheckerboard` computed.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 4 new source-level tests (monitor fond from store instruction, checkerboard IFF no-fond, gradient treatment, raster non-regression).
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - `showTransparencyCheckerboard` prop + checkerboard layer beneath the monitor content.
- `app/src/components/physic-paint/physicsPaintStudio.css` - `.physics-paint-transparency-checkerboard` rule (z-index 0, pointer-events none, repeating-conic-gradient).
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts` - pre-existing 48-06 UAT-C test updated to assert the new D-11 authority.
- `app/src/lib/previewRenderer.test.ts` - pre-existing 48-03/48-06 flattened seam tests updated: `seedPhysicalRoto` mirrors the paper metadata into the document fallback.

## Decisions Made

- **Fond authority collapsed to the document fallback**: `_resolveDocumentFondInstruction` reads ONLY `document.background.fallback`; the per-track `_rotoBackgroundMetadata` fond walk is deleted, not shadowed (Pitfall 1). Transparent → no instruction; solid → solid fill; paper → paper draw with paperGrain/grainStrength.
- **Flattened cache key gains a dedicated fallback term** via the exported canonical encoder (`encodeCanonicalBackgroundFallback`) — a fallback-mode change with an unchanged `background.revision` still rotates the key, so a stale fond raster is never served (BKG-09, T-49-03-02).
- **Selector round-trip**: `backgroundModeToFallback` maps each of the fixed five modes to exactly one fallback record (white → solid `#ffffff`, no distinct 'white' literal); `reflectFallbackToBackgroundMode` derives the active segment from the document (authoritative); same-mode dispatch is a revision-stable no-op through `setBackgroundFallback`'s guard (BKG-09, the 1552-1569 lesson).
- **`BackgroundSelectorMode = Exclude<BgMode, 'photo'>`** structurally excludes the Phase 50 photo mode from the fallback surface (D-11) — the engine BgMode union itself is untouched.
- **Monitor fond + checkerboard consume the store's already-resolved plumbing**: `getDocumentFondInstruction` returns the same instruction the flattened path uses; `getBackgroundFrameVerdict` reuses `deriveEfxPaintBackgroundResolution` + `resolveEfxPaintBackgroundFrame` with the runtime known-source set — never a re-resolution in the Studio.
- **Checkerboard condition**: `fondInstruction === null && getBackgroundFrameVerdict === 'gap'` — transparent fallback AND no clip covering the frame. The layer is a pure CSS `repeating-conic-gradient` div, clipped to canvas bounds, paint-only (T-49-03-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tests broken by the Task 1 metadata-walk deletion (missed by targeted-only verification)**
- **Found during:** Task 3 (full-suite verification)
- **Issue:** Task 1 deleted the per-track `_rotoBackgroundMetadata` fond walk, but I only ran the targeted test files after Task 1, not the full suite. The full suite then revealed 7 pre-existing tests asserting the OLD fond derivation: 6 in `previewRenderer.test.ts` (48-03/48-06 flattened seam tests that seeded the fond via per-track metadata) and 1 in `PhysicsPaintCanvasMount.test.ts` (48-06 UAT-C asserting `getRotoBackgroundMetadata` in the Studio).
- **Fix:** Updated the tests to the new D-11 authority. `PhysicsPaintCanvasMount.test.ts` now asserts `physicPaintStore.getDocumentFondInstruction(programMonitorLayerId)` and asserts the old walk is absent. `previewRenderer.test.ts`'s `seedPhysicalRoto` now mirrors the paper metadata into the document fallback via `setBackgroundFallback` (the metadata itself stays set for the `getRotoBackgroundMetadata` parity assertion).
- **Files modified:** app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts, app/src/lib/previewRenderer.test.ts
- **Verification:** full suite 3111 passed | 1 skipped | 101 todo; `pnpm --dir app run typecheck` exits 0
- **Committed in:** e1fc0576 (Task 3 commit)

**2. [Rule 3 - Blocking] Task 3 files list omits the view, CSS, and store — the checkerboard and monitor re-wire need them**
- **Found during:** Task 3 (implementation)
- **Issue:** The plan's Task 3 `files` list names only `PhysicsPaintStudio.tsx` and `PhysicsPaintStudio.test.ts`, but the checkerboard layer must be rendered in `PhysicsPaintStudioView.tsx` (the canvas-stack renderer), styled in `physicsPaintStudio.css`, and the store must expose the fond instruction + background frame verdict accessors (`getDocumentFondInstruction`, `getBackgroundFrameVerdict`) for the memo to consume the already-resolved plumbing rather than re-resolving.
- **Fix:** Added the checkerboard layer + `showTransparencyCheckerboard` prop in the view, the `.physics-paint-transparency-checkerboard` CSS rule, and the two store accessors. All are necessary for the plan's own goal (D-12 checkerboard + D-11 monitor re-wire).
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/stores/physicPaintStore.ts
- **Verification:** full suite 3111 passed; `pnpm --dir app run typecheck` exits 0
- **Committed in:** e1fc0576 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary for the plan's own goals — the test updates align pre-existing assertions with the new D-11 authority, and the view/CSS/store additions are the only way to render the D-12 checkerboard and re-wire the monitor fond. No scope creep.

## Issues Encountered

- **Full-suite regression after Task 1 (7 tests):** the metadata-walk deletion broke pre-existing tests that seeded the fond via per-track metadata. Root cause: I verified Task 1 with only the targeted test files, not the full suite. Fixed by updating the tests to the new D-11 authority (see Deviation 1). Lesson: run the full suite after a store-authority change, not just the targeted files.
- **Typecheck error in the test fix:** `setBackgroundFallback` returns a union; the `!fallbackResult.ok` branch narrows to `{ ok: false; reason }` which has no `error` property. Fixed by reading `fallbackResult.reason`.
- **`applyCanvas` does not touch the document fallback:** confirmed the 36.11 test's `applyCanvas` call leaves the fallback set by `seedPhysicalRoto` intact, so the paper fond still bakes into the flattened raster.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **49-04/49-05/49-06 consume the single fond authority**: the Background swatch selector is the persisted document fallback config end-to-end; gaps reveal it identically on every surface (row gap swatches, monitor, flattened parent output, main preview, export); the monitor shows a checkerboard only in the no-fond case; a fallback change always invalidates the flattened cache.
- **Selector mapping functions** (`backgroundModeToFallback`, `reflectFallbackToBackgroundMode`) and the `BackgroundSelectorMode` union are exported from `physicsPaintStudioSettings.ts` for the swatch click handler wiring.
- **Store accessors** `getDocumentFondInstruction(layerId)` and `getBackgroundFrameVerdict(layerId, frame)` are public for the monitor and any future consumer.
- The `photo` mode remains reserved for the Phase 50 photoReference track (D-11) — structurally excluded from the fallback surface.

## Self-Check: PASSED

- FOUND: app/src/stores/physicPaintStore.ts, app/src/efx-paint/compositor/efxPaintCompositeCache.ts, app/src/efx-paint/document/efxPaintDocumentRevision.ts, app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/physicsPaintStudio.css
- FOUND: aa27f4fd (RED), b1d903df (GREEN), a00d19ee (RED), a5f37eac (GREEN), e1fc0576 (Task 3)

---
*Phase: 49-fixed-background-track-and-imported-loop-clips*
*Completed: 2026-08-31*
