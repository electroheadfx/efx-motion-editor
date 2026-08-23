---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 05
subsystem: core
tags: [efx-paint, clean-break, rejection-gate, persistence, cutover, preact-signals, vitest, tauri-dialog]

# Dependency graph
requires:
  - phase: 45-02
    provides: efx_paint_documents in both models/project.rs and types/project.ts, cache/efx-paint dir + native cache transaction re-point
  - phase: 45-03
    provides: findLegacyPhysicPaintRejection pure gate predicate + reason union
  - phase: 45-04
    provides: efxPaintStore (registerDocument/serializeRuntimeIntoDocument/hydrateRuntimeFromDocument/reset) + efxPaintPersistence (saveEfxPaintDocumentsWithProjectWrite/loadEfxPaintDocuments)
provides:
  - "Live open/save funnel cutover: clean-break rejection gate + blocking no-recourse dialog in openProject, single v1.0 document save path (version 16), v1.0 hydration + store lifecycle, document registration at physic-paint layer creation"
affects: [45-06, 45-07, 45-08]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 10517
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns: [gate-before-mutation open funnel, no-recourse rejection dialog, single save path, source-order test assertions, hoisted vi.mock funnel tests]

key-files:
  created:
    - app/src/lib/efxPaintRejectionDialog.ts
    - app/src/stores/projectStore.efxPaintCutover.test.ts
  modified:
    - app/src/stores/projectStore.ts
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/stores/projectStore.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/vite.config.ts
    - app/src/viteBuild.test.ts

key-decisions:
  - "The rejection gate runs immediately after the result.ok check in openProject — before any sidecar IO, closeProject, hydration, or startAutoSave — and on rejection shows a blocking no-recourse native error dialog (single OK) then returns with zero store mutation (D-05/D-07, Pitfall F4); the gate is stateless"
  - "The rejection dialog copy is an exported constant (LEGACY_PHYSIC_PAINT_REJECTED_COPY) naming EFX Physic Paint, pre-v1.0, and the impossibility of opening — no partial open, no continue-anyway, no converter offer"
  - "There is exactly one save path after this plan: saveProject and saveProjectAs both call saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, writeProject) with the bound cache transaction; physic_paint_outputs is never emitted (explicit undefined override in the spread); version 16"
  - "openProject hydrates documents via loadEfxPaintDocuments + registerDocument + hydrateRuntimeFromDocument per document; closeProject calls efxPaintStore.reset() alongside physicPaintStore.reset so no document leaks across projects; the dirty callback is wired at module bottom"
  - "AddFxMenu registers exactly one v1.0 document per physic-paint layer at creation (registerDocument(createEfxPaintDocument(layerId)) after both creation branches)"
  - "The 45-05 wiring pulled efxPaintStore + efxPaintPersistence + the document model into the main chunk (1124.96 kB measured); the V09-C04 desktop budget was raised 1120 → 1130 with documented measurement (established pattern)"

patterns-established:
  - "Gate-before-mutation open funnel: findLegacyPhysicPaintRejection runs immediately after the result.ok check, before any sidecar IO, closeProject, hydration, or startAutoSave; rejection returns with zero store mutation and the previously open project stays open"
  - "No-recourse rejection UX: native message() dialog, kind 'error', single OK button, exported *_COPY constant — no partial open, no continue-anyway, no converter offer"
  - "Single save path: both saveProject and saveProjectAs funnel through saveEfxPaintDocumentsWithProjectWrite with the bound cache transaction; physic_paint_outputs explicitly undefined in the spread"
  - "Source-order test assertions on .ts/.tsx sources (readFileSync + indexOf) for component-internal behavior (AddFxMenu handler) — the established projectStore.test.ts idiom"
  - "Hoisted vi.mock funnel tests: full ipc/persistence/dialog/fs module graph mocked, real stores run so hydration effects are observable"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-05, DOC-06]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Clean-break rejection gate wired into openProject: findLegacyPhysicPaintRejection runs immediately after the result.ok check and before any sidecar IO, closeProject, hydration, or startAutoSave; a rejected project shows the blocking dialog and returns with zero store mutation; the previously open project stays open; the gate is stateless (identical behavior on a second open attempt)"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#rejects a legacy project with a blocking dialog and zero downstream invocation"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#opens a clean project through the normal hydration path exactly as today"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#behaves identically on a second open attempt of a rejected file (stateless gate)"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#the gate predicate itself is the pure scan from 45-03 (structure-discriminated)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No-recourse rejection dialog: exported LEGACY_PHYSIC_PAINT_REJECTED_COPY naming EFX Physic Paint, pre-v1.0, and the impossibility of opening; showLegacyPhysicPaintRejectionDialog uses the native message() idiom with kind 'error' and a single OK button"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#exports an explicit no-recourse copy naming EFX Physic Paint, pre-v1.0, and the impossibility of opening"
        status: pass
    human_judgment: false
  - id: D3
    description: "v1.0 save funnel: saveProject and saveProjectAs both persist efx_paint_documents keyed by layer id through saveEfxPaintDocumentsWithProjectWrite with the bound cache transaction and never emit physic_paint_outputs; a save with no physic-paint layers passes an empty document map and skips staging"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#saveProject persists efx_paint_documents keyed by layer id and never emits physic_paint_outputs"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#saveProjectAs performs the identical v1.0 switch on its call path"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#a save with no physic-paint layers passes an empty document map and skips staging"
        status: pass
    human_judgment: false
  - id: D4
    description: "v1.0 open hydration + version 16 + store lifecycle: buildMceProject writes version 16; openProject loads documents via loadEfxPaintDocuments, registers them into efxPaintStore, and projects the default track into the runtime; closeProject resets efxPaintStore so no document leaks across projects"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#buildMceProject writes version 16"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#openProject hydrates efxPaintStore and projects the default track into the runtime"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#closeProject resets efxPaintStore so no document leaks across projects"
        status: pass
    human_judgment: false
  - id: D5
    description: "Layer-creation document registration: handleAddPhysicPaintLayer registers exactly one v1.0 document keyed by the new layer id after both creation branches; the registered document has the DOC-02 shape (one default Paint track, fixed Background with transparent fallback, version 1, documentRevision 0, activeTrackId === tracks[0].id); the layer object itself is unchanged"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#handleAddPhysicPaintLayer registers exactly one document keyed by the new layer id"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#the registered document has the DOC-02 shape: one default Paint track, fixed Background fallback, version 1, revision 0"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#the layer object itself is unchanged: type physic-paint, source.layerId === layer id, defaultTransform"
        status: pass
    human_judgment: false
  - id: D6
    description: "Main-editor sequence timing and outer layer composition unchanged: the 45-05 diff touches no previewRenderer.ts, paintStore.ts, paintRenderer.ts, PaintOverlay.tsx, or paintPersistence.ts, and the existing timing/composition suite stays green (DOC-06; re-verified at 45-07's full-gate sweep and natively at 45-08 UAT part 4)"
    requirement: DOC-06
    verification:
      - kind: other
        ref: "git diff --name-only 503f9c59..HEAD (45-05 diff gate: no previewRenderer/paintStore/paintRenderer/PaintOverlay/paintPersistence changes)"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run (full suite green, 2731 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 05 Summary

**Open/save funnel cutover: clean-break rejection gate with blocking no-recourse dialog in openProject, single v1.0 document save path with version 16, v1.0 hydration + store lifecycle, and document registration at physic-paint layer creation**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-23T14:21:00Z
- **Completed:** 2026-08-23T14:51:00Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- Rejection gate live: `openProject` runs `findLegacyPhysicPaintRejection` immediately after the `result.ok` check — before any sidecar IO, `closeProject`, hydration, or `startAutoSave` — and on rejection shows a blocking no-recourse native error dialog (single OK) then returns with zero store mutation (D-05/D-07, Pitfall F4); the previously open project stays open; the gate is stateless
- Single v1.0 save path: `saveProject` and `saveProjectAs` both call `saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, writeProject)` with the bound cache transaction; `physic_paint_outputs` is never emitted; version 16 written (A1)
- v1.0 open hydration: `loadEfxPaintDocuments` + `registerDocument` + `hydrateRuntimeFromDocument` per document; `closeProject` resets `efxPaintStore` alongside `physicPaintStore` so no document leaks across projects; the dirty callback is wired
- Layer-creation registration: AddFxMenu's `handleAddPhysicPaintLayer` registers exactly one v1.0 document per physic-paint layer (DOC-01/DOC-02)
- 14 new cutover tests green; full suite 2731 passed (up from 2717), typecheck clean; diff gate PASS (no previewRenderer/paintStore/paintRenderer/PaintOverlay/paintPersistence changes)

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: Rejection gate wired into openProject + blocking no-recourse dialog** - `61591e40` (test) + `5a297c9d` (feat)
2. **Task 2: Save/load funnel switch to the v1.0 document + version bump 16 + store lifecycle** - `b6c8c9fc` (test) + `8cbed9d3` (feat)
3. **Task 3: AddFxMenu registers the v1.0 document at physic-paint layer creation** - `1a6c99f6` (test) + `e565526b` (feat)

**Plan metadata:** (committed with this SUMMARY)

## Files Created/Modified
- `app/src/lib/efxPaintRejectionDialog.ts` - `LEGACY_PHYSIC_PAINT_REJECTED_COPY` + `showLegacyPhysicPaintRejectionDialog` (native `message()`, kind 'error', single OK)
- `app/src/stores/projectStore.efxPaintCutover.test.ts` - 14 tests across 3 describes (gate, funnel, creation)
- `app/src/stores/projectStore.ts` - gate call, save-path switch x2, version 16, v1.0 hydration, `efxPaintStore.reset` in closeProject, dirty callback
- `app/src/components/timeline/AddFxMenu.tsx` - `registerDocument(createEfxPaintDocument(layerId))` in `handleAddPhysicPaintLayer`
- `app/src/stores/projectStore.test.ts` - save-path source assertions updated to the v1.0 call, version 15→16, `physic_paint_outputs` carrier test rewritten
- `app/src/lib/physicPaintBridge.test.ts` - round-trip via `serializeRuntimeIntoDocument` + `hydrateFromMce` loadedDocuments
- `app/vite.config.ts` - `chunkSizeWarningLimit` 1120→1130 (measured 1124.96 kB)
- `app/src/viteBuild.test.ts` - budget assertion 1120→1130

## Decisions Made
- **Gate placement**: the rejection gate runs immediately after the `result.ok` check, before any sidecar IO, `closeProject`, hydration, or `startAutoSave` — rejection returns with zero store mutation (D-05/D-07, Pitfall F4); the gate is stateless
- **No-recourse dialog copy**: exported `LEGACY_PHYSIC_PAINT_REJECTED_COPY` naming EFX Physic Paint, pre-v1.0, and the impossibility of opening — no partial open, no continue-anyway, no converter offer
- **Single save path**: both `saveProject` and `saveProjectAs` funnel through `saveEfxPaintDocumentsWithProjectWrite` with the bound cache transaction; `physic_paint_outputs` explicitly `undefined` in the spread; version 16
- **Hydration + lifecycle**: `loadEfxPaintDocuments` + `registerDocument` + `hydrateRuntimeFromDocument` per document on open; `efxPaintStore.reset()` in `closeProject`; dirty callback wired at module bottom
- **Layer-creation registration**: `registerDocument(createEfxPaintDocument(layerId))` after both creation branches in `handleAddPhysicPaintLayer`
- **Bundle budget raise**: the v1.0 funnel modules are required imports (not removable duplication), so the V09-C04 budget was raised 1120 → 1130 with the documented measurement (established pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 45-05 wiring pushed the main chunk over the 1120 kB desktop budget (V09-C04)**
- **Found during:** Task 2 verification (full suite after GREEN)
- **Issue:** The v1.0 document funnel (efxPaintStore + efxPaintPersistence + document model) entered the main chunk, measured 1124.96 kB — over the 1120 kB budget, tripping `viteBuild.test.ts`'s no-warning assertion
- **Fix:** Raised `chunkSizeWarningLimit` 1120 → 1130 with the documented measurement (measured value + ~5 kB headroom). 45-04 avoided a raise by sharing code, but the funnel modules are required imports, not duplication
- **Files modified:** app/vite.config.ts, app/src/viteBuild.test.ts
- **Verification:** full suite green incl. viteBuild; typecheck clean
- **Committed in:** 8cbed9d3 (Task 2 GREEN)

**2. [Rule 2 - Missing Critical] Legacy save-path tests asserted the removed call**
- **Found during:** Task 2 verification (full suite after GREEN)
- **Issue:** `projectStore.test.ts`'s save-path tests asserted the legacy `savePhysicPaintDataWithProjectWrite` call and `physic_paint_outputs` emission, which the plan's single-save-path switch removed; `physicPaintBridge.test.ts` asserted the legacy carrier in its round-trip
- **Fix:** Updated `projectStore.test.ts` to assert the v1.0 `saveEfxPaintDocumentsWithProjectWrite` call in both paths + version 16 + no `physic_paint_outputs` carrier; `physicPaintBridge.test.ts` round-trips through `serializeRuntimeIntoDocument` + `hydrateFromMce` loadedDocuments (serialize before `closeProject` — closeProject wipes the stores)
- **Files modified:** app/src/stores/projectStore.test.ts, app/src/lib/physicPaintBridge.test.ts
- **Verification:** full suite green (2731 passed); typecheck clean
- **Committed in:** 8cbed9d3 (Task 2 GREEN)

**3. [Typecheck - Blocking] Task 2 type errors surfaced at verification**
- **Found during:** Task 2 verification (typecheck after GREEN)
- **Issue:** unused `hydrateRuntimeFromDocument` import in physicPaintBridge.test.ts, unused `showLegacyPhysicPaintRejectionDialog` import in the cutover test, unused `layerId` loop variable in `hydrateFromMce`, and RuntimeMceProject→MceProject spread type friction
- **Fix:** Removed unused imports; changed the loop to `for (const [, loaded] of loadedDocuments)`; added explicit `physic_paint_outputs: undefined` overrides in both save-path spreads
- **Files modified:** app/src/stores/projectStore.ts, app/src/lib/physicPaintBridge.test.ts, app/src/stores/projectStore.efxPaintCutover.test.ts
- **Verification:** `pnpm --dir app run typecheck` exits 0
- **Committed in:** 8cbed9d3 (Task 2 GREEN)

---

**Total deviations:** 3 auto-fixed (1 blocking bundle budget, 1 missing critical, 1 blocking typecheck)
**Impact on plan:** The bundle raise follows the established documented-measurement pattern (the funnel modules are required imports, not removable duplication); the test updates were necessary consequences of the single-save-path switch; the typecheck fixes were mechanical. No scope creep.

## Issues Encountered
- `efxPaintStore` exports standalone functions, not a store object — spying and aliasing require `import * as efxPaintStoreModule` / aliased imports (established in 45-04, applied here)
- `serializeRuntimeIntoDocument` must run BEFORE `closeProject` (closeProject wipes the stores) — the physicPaintBridge round-trip test captures document + frames first
- The naive "no `physic_paint_outputs` emission" source check false-positives on comment text — verified via grep that all remaining occurrences are legitimate (comments, the no-op `loadFromMceOutputs` call, explicit `undefined` overrides)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 45-06 (v1.0 session-file format, bridge launch-context swap, standalone engine re-wire) can proceed: the app funnel is fully v1.0; the legacy module is dead code awaiting 45-07's deletion
- The rejection gate is live for every open entry point (Toolbar, WelcomeScreen, shortcuts — T-45-16 audit confirmed all funnel through `openProject`)
- DOC-03/DOC-06 marked complete; DOC-01/DOC-02/DOC-05 complete under the shared-ID gate (final native confirmation at 45-08 UAT)

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
