---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 06
subsystem: core
tags: [efx-paint, clean-break, v1.0-document, session-file, launch-context, standalone-engine, consumer-sweep, vitest]

# Dependency graph
requires:
  - phase: 45-04
    provides: efxPaintStore (registerDocument/getDocument/serializeRuntimeIntoDocument/hydrateRuntimeFromDocument/reset) + efxPaintPersistence
  - phase: 45-05
    provides: single v1.0 open/save funnel, layer-creation document registration, version 16 project files
provides:
  - "Session-file contract re-wired to the v1.0 document with distinct pre-v1.0 rejection (Pitfall F5); bridge launch context carries the v1.0 document (no fetch round-trip); standalone @efxlab/efx-physic-paint engine save()/load() round-trips the v1.0 document with fail-closed legacy rejection; full SerializedProject/isSerializedProject consumer sweep to the v1.0 document"
affects: [45-07, 45-08]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 48380
  tasks: 4
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns: [active-track engine carrier reads, strip-then-parse carrier guard, fail-closed validation before engine state mutation, distinct legacy rejection copies, dead-file deletion over rewiring]

key-files:
  created:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.documentFormat.test.ts
  modified:
    - app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts
    - app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
    - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts
    - app/src/components/physic-paint/roto/rotoLaunchHydration.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/roto/rotoSaveTransactions.ts
    - app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts
    - app/src/components/physic-paint/roto/rotoCanvasFrames.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
    - app/src/components/physic-paint/engine/physicsPaintCanvasSizing.ts
    - app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/lib/previewRenderer.test.ts
    - app/src/components/physic-paint/roto/rotoSaveTransactions.test.ts
    - app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts
    - app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - packages/efx-physic-paint/src/types.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts
    - packages/efx-physic-paint/src/index.ts
    - packages/efx-physic-paint/demo/src/Toolbar.tsx
  deleted:
    - app/src/components/physic-paint/view/PhysicsPaintStudioToolbar.tsx

key-decisions:
  - "Session files are v1.0 documents: parsePhysicsPaintStateFile JSON-parses, detects the recognized legacy version:2 / strokes+settings shape and throws the distinct LOAD_STATE_UNSUPPORTED_VERSION_COPY, then validates via parseEfxPaintDocument mapping any parse throw to LOAD_STATE_INVALID_COPY; save serializes the document from efxPaintStore with the efx-paint-doc- filename marker"
  - "The launch IS the document: PhysicPaintLaunchContext carries the full v1.0 document from efxPaintStore.getDocument(layerId) — no fetch round-trip — and the legacy editableState/rotoPhysical/cachedRotoFrames/rotoInterpolationSettings fields are gone from the launch contract"
  - "The standalone engine adopts the v1.0 document: save() emits the document with strokes/settings riding the default track as engine-only carriers; load() validates fail-closed BEFORE mutating engine state, rejecting legacy version:2 with the distinct pre-v1.0 copy and unknown members with the generic invalid copy"
  - "The apply-canvas editableState carrier stays typed as the PACKAGE's EfxPaintDocument (the engine's save() output is not assignable to the app-side type — rotoPhysical: unknown vs PhysicPaintRotoPhysicalDocument); the guard validates a carrier-stripped copy through the full fail-closed parseEfxPaintDocument, rejecting legacy version:2"
  - "The dead PhysicsPaintStudioToolbar.tsx is deleted, not rewired: zero importers anywhere, and its independent v2-only session-load path is exactly the legacy session-file contract D-02 hard-deletes; the live Studio session load already routes through usePhysicsPaintSessionController → parsePhysicsPaintStateFile"
  - "The demo toolbar delegates validation to engine.load: JSON.parse failures surface the invalid-file copy, engine.load failures surface the engine's distinct error message (legacy v2 files hit the pre-v1.0 unsupported copy)"

patterns-established:
  - "Active-track engine carrier reads: strokes/settings ride the active track in v1.0 documents — shape reads go through readRotoActiveTrack(state) (rotoSaveTransactions/rotoEditBufferTransactions/rotoCanvasFrames)"
  - "Strip-then-parse carrier guard: the app-side parser's closed TRACK_KEYS rejects engine carriers, so the apply-canvas guard strips strokes/settings from each track and validates the copy through parseEfxPaintDocument"
  - "Fail-closed validation before engine state mutation: validateEfxPaintDocument runs first in loadProjectData; legacy version:2 detected explicitly and rejected with the distinct unsupported copy, unknown members throw the generic invalid copy"
  - "Distinct legacy rejection copies: LOAD_STATE_UNSUPPORTED_VERSION_COPY (pre-v1.0 wording) vs LOAD_STATE_INVALID_COPY, shared verbatim between the app session-file path and the package engine"
  - "Dead-file deletion over rewiring: a zero-importer component carrying an independent legacy load path is deleted, not reworked"

requirements-completed: [DOC-04, DOC-05]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Session-file contract re-wired to the v1.0 document: parsePhysicsPaintStateFile accepts v1.0 session files and rejects legacy version:2 files with the distinct pre-v1.0 unsupported copy while genuinely malformed files keep the generic invalid copy; save serializes the document from efxPaintStore with the efx-paint-doc- filename marker"
    requirement: DOC-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts#serializes a session whose payload is a v1.0 document and parses it back with identity intact"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts#rejects a legacy version:2 session file with the distinct pre-v1.0 unsupported copy"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts#throws the exact invalid-state copy for malformed or unrecognized JSON"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts#rejects a v1.0-shaped payload with an unknown member fail-closed as invalid"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts#names v1.0 session files with the efx-paint-doc- marker"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bridge launch context carries the v1.0 document: createPhysicPaintLaunchContext builds the carrier from efxPaintStore.getDocument(layerId) with no fetch round-trip; the legacy editableState/rotoPhysical/cachedRotoFrames/rotoInterpolationSettings fields are gone from PhysicPaintLaunchContext; the launch validator re-validates the carrier fail-closed via parseEfxPaintDocument; the Studio hydrates the engine from the carried document"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts#parses canonical encoded Roto launch envelopes while rejecting incomplete or flat input"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts#rejects fail-closed document carriers: unknown members and startFrame/cursor mismatch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts#applies launch context and resolved Roto settings only"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.test.ts#loads the carried v1.0 document into the engine and registers it in efxPaintStore"
        status: pass
    human_judgment: false
  - id: D3
    description: "Standalone engine adopts the v1.0 document format: save() emits a v1.0 document with strokes/settings riding the default track; load() hydrates from it fail-closed — validation runs BEFORE any engine state mutation, legacy version:2 payloads reject with the distinct pre-v1.0 unsupported copy, malformed/unknown-member payloads throw the generic invalid copy"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.documentFormat.test.ts#save() emits a v1.0 document-shaped payload and load() restores engine state from the default track"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.documentFormat.test.ts#load() rejects a legacy version:2 payload with the distinct pre-v1.0 unsupported error"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.documentFormat.test.ts#load() rejects malformed payloads fail-closed with the generic invalid error before mutating state"
        status: pass
    human_judgment: false
  - id: D4
    description: "Consumer sweep to the v1.0 document: coordinator generic defaults (RotoPhysicalEditCoordinatorPorts/Handle, useRotoPhysicalEditCoordinator, useRotoPhysicalEditHistory) resolve to the package's EfxPaintDocument; the apply-canvas editableState carrier is a v1.0 document accepted by isPhysicPaintApplyPayload and legacy version:2 shapes rejected; the TEMP SerializedProject alias is removed from the package barrel; zero SerializedProject/isSerializedProject references survive in app/src, packages/efx-physic-paint/src, and packages/efx-physic-paint/demo"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/types/physicPaint.test.ts#accepts a v1.0 document editableState carrier and rejects the legacy version:2 shape"
        status: pass
      - kind: other
        ref: "grep -rn SerializedProject|isSerializedProject app/src packages/efx-physic-paint/src packages/efx-physic-paint/demo (zero matches)"
        status: pass
      - kind: other
        ref: "pnpm --dir app run typecheck && pnpm --filter efx-motion-editor exec vitest run && pnpm --filter @efxlab/efx-physic-paint exec vitest run && pnpm build (all green)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dead Studio toolbar deleted and demo toolbar rewired: PhysicsPaintStudioToolbar.tsx (zero importers, independent v2-only session-load path) is deleted; the demo Toolbar.tsx no longer contains a version===2 shape guard — its load path JSON-parses (parse failure surfaces the invalid-file copy) then delegates validation to engine.load, surfacing the engine's distinct error message"
    requirement: DOC-04
    verification:
      - kind: other
        ref: "git rm app/src/components/physic-paint/view/PhysicsPaintStudioToolbar.tsx (deleted, nothing imports it)"
        status: pass
      - kind: other
        ref: "grep -n 'version === 2' packages/efx-physic-paint/demo/src/Toolbar.tsx (zero matches; load path calls engine.load and surfaces error.message)"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 06 Summary

**Session-file contract, bridge launch context, and standalone package engine all re-wired to the v1.0 document format (D-03 — one document format everywhere) with explicit distinct rejection of legacy version:2 session files (Pitfall F5), and the full SerializedProject/isSerializedProject consumer sweep**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-23T16:55:00Z
- **Completed:** 2026-08-23T17:49:00Z
- **Tasks:** 4
- **Files modified:** 42 (1 created, 40 modified, 1 deleted)

## Accomplishments
- Session-file contract re-wired: `parsePhysicsPaintStateFile` accepts v1.0 session files, rejects recognized legacy version:2 / strokes+settings shapes with the distinct `LOAD_STATE_UNSUPPORTED_VERSION_COPY`, and keeps the generic invalid copy for malformed JSON; save serializes the document from `efxPaintStore` with the `efx-paint-doc-` filename marker (Pitfall F5)
- Bridge launch context carries the v1.0 document: `createPhysicPaintLaunchContext` builds the carrier from `efxPaintStore.getDocument(layerId)` — no fetch round-trip — and the legacy `editableState`/`rotoPhysical`/`cachedRotoFrames`/`rotoInterpolationSettings` fields are gone from the launch contract; the Studio hydrates the engine from the carried document
- Standalone engine adopts the v1.0 document: `save()` emits the document with strokes/settings riding the default track as engine-only carriers; `load()` validates fail-closed BEFORE mutating engine state — legacy version:2 rejected with the distinct pre-v1.0 copy, unknown members throw the generic invalid copy
- Consumer sweep complete: coordinator generic defaults, the apply-canvas `editableState` carrier, and the standalone demo all speak the v1.0 document; the dead Studio toolbar (zero importers, v2-only load path) is deleted; the TEMP package alias is removed; zero `SerializedProject`/`isSerializedProject` references survive tree-wide
- All gates green at the final commit: app typecheck, full app suite (143 files / 2735 tests), package suite (12 files / 127 tests), package tsc check, and the workspace build

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: v1.0 session-file format with distinct legacy rejection** - `a160f382` (test) + `e5119879` (feat)
2. **Task 2: Bridge launch context carries the v1.0 document** - `e55e7797` (feat)
3. **Task 3: Standalone engine adopts the v1.0 document format** - `2dcd4bde` (test) + `ace9502d` (feat)
4. **Task 4: Consumer sweep — coordinator generic defaults, apply-canvas carrier, dead toolbar deletion, demo toolbar rewire, barrel alias removal** - `12fca5c0` (feat)

**Plan metadata:** (committed with this SUMMARY)

## Files Created/Modified
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.documentFormat.test.ts` - created: v1.0 save/load round-trip, legacy version:2 rejection, fail-closed malformed rejection
- `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts` - v1.0 session parse/save, `LOAD_STATE_UNSUPPORTED_VERSION_COPY`, `efx-paint-doc-` marker, `matchesLegacyV2SessionShape`
- `app/src/types/physicPaint.ts` - launch carrier swap, `editableState` → package `EfxPaintDocument`, strip-then-parse carrier guard, `isSerializedProject`/`isSerializedStroke` deleted
- `app/src/lib/physicPaintBridge.ts` - launch context built from `efxPaintStore.getDocument(layerId)`
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts` - LAUNCH_KEYS carrier swap, fail-closed document re-validation
- `app/src/components/physic-paint/roto/rotoLaunchHydration.ts` - roto physical model parsed from the carried document's active track
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` - launch background from the active track's rotoPhysical
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - initial roto frames / layerEndExclusive from hydrated runtime; `SerializedProject` → `EfxPaintDocument` at 6 sites
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` + `hooks/useRotoPhysicalEditCoordinator.ts` - generic defaults → `EfxPaintDocument`
- `app/src/components/physic-paint/roto/rotoSaveTransactions.ts` + `rotoEditBufferTransactions.ts` + `rotoCanvasFrames.ts` - active-track engine carrier reads via `readRotoActiveTrack`
- `app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts` - `registerDocument(document)` + `engine.load(document)` on apply-loaded state
- `app/src/components/physic-paint/view/PhysicsPaintStudioToolbar.tsx` - DELETED (zero importers, v2-only load path)
- `packages/efx-physic-paint/src/types.ts` - v1.0 document mirror types (EfxPaintDocument, InternalPaintTrack with strokes/settings carriers)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` - `validateEfxPaintDocument` fail-closed, v1.0 `save()`/`load()`, distinct legacy rejection copies
- `packages/efx-physic-paint/src/index.ts` - `EfxPaintDocument` export, TEMP `SerializedProject` alias removed
- `packages/efx-physic-paint/demo/src/Toolbar.tsx` - local v2 guard deleted; load path delegates to `engine.load` and surfaces the engine's error message
- Test fixtures converted to v1.0 documents: `physicPaintStore.test.ts`, `physicPaintStore.rotoLoopClips.test.ts`, `physicPaintBridge.test.ts`, `previewRenderer.test.ts`, `rotoSaveTransactions.test.ts`, `rotoEditBufferTransactions.test.ts`, `useRotoFrameEditingController.test.ts`, `useRotoFramePersistenceCoordinator.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `usePhysicsPaintSessionController.test.ts`, `physicsPaintRotoScriptClipboard.test.ts`, `EfxPaintEngine.cooperativeFinalization.contract.red.test.ts`, `PhysicsPaintStudio.test.ts`, `physicsPaintLaunchContext.test.ts`, `usePhysicsPaintLaunchIntegration.test.ts`, `physicsPaintSessionFile.test.ts`, `physicPaint.test.ts`

## Decisions Made
- **Session-file contract**: v1.0 document in, legacy version:2 out — recognized legacy shapes throw the distinct pre-v1.0 unsupported copy, malformed JSON keeps the generic invalid copy, no partial read (Pitfall F5)
- **Launch IS the document**: the launch context carries the full v1.0 document from `efxPaintStore` (research Q3 recommendation) — no fetch round-trip; the legacy launch fields are gone
- **Engine carriers on the active track**: strokes/settings ride the default track as optional engine-only carriers (absent in app-side documents), so payloads inter-operate across the bridge without mapping
- **Fail-closed engine validation**: `validateEfxPaintDocument` runs BEFORE any engine state mutation; legacy version:2 detected explicitly and rejected with the distinct unsupported copy
- **editableState stays the package type**: the engine's `save()` output is not assignable to the app-side `EfxPaintDocument` (`rotoPhysical: unknown` vs `PhysicPaintRotoPhysicalDocument`), so the apply-canvas carrier keeps the package type and the guard validates a carrier-stripped copy through `parseEfxPaintDocument`
- **Dead toolbar deleted, not rewired**: zero importers and an independent v2-only load path make `PhysicsPaintStudioToolbar.tsx` exactly the legacy contract D-02 hard-deletes
- **Demo delegates to the engine**: the demo toolbar's load path is `JSON.parse` (invalid copy on parse failure) then `engine.load` (engine's distinct error surfaced) — one fail-closed enforcement point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Task 3's shape consumers and test fixtures were not anticipated by the plan**
- **Found during:** Task 3 verification (app typecheck after GREEN)
- **Issue:** The plan only anticipated NAME consumers (`rotoCoordinatorPorts`, `useRotoPhysicalEditCoordinator`, `types/physicPaint.ts:1765`) breaking; the shape consumers (`rotoSaveTransactions`, `rotoEditBufferTransactions`, `rotoCanvasFrames`, `useRotoEditBufferController`, `PhysicsPaintStudio`) and v2-shaped test fixtures broke at typecheck (20 errors), and the v1.0-typed fixtures failed the v2 `isSerializedProject` guard at runtime
- **Fix:** Rewrote shape reads to active-track reads via `readRotoActiveTrack` (strokes/settings ride the active track in v1.0 documents), converted all test fixtures to v1.0 documents, and pulled the apply-canvas guard rewrite forward into Task 3 (the v1.0-typed fixtures fail the v2 guard at runtime, and Task 3's acceptance requires bridge suites green)
- **Files modified:** rotoSaveTransactions.ts, rotoEditBufferTransactions.ts, rotoCanvasFrames.ts, types/physicPaint.ts, and 12 test fixture files
- **Verification:** app typecheck exits 0; full app suite green at the Task 3 commit
- **Committed in:** ace9502d (Task 3 GREEN)

**2. [Rule 2 - Missing Critical] Pre-existing Task 2 regression: bridge launch path requires a registered document**
- **Found during:** Task 3 verification (full suite after GREEN)
- **Issue:** 6 failures in `physicPaintStore.rotoLoopClips.test.ts` ("No EFX Paint document for layer 'layer-bridge-loop-clips'") — verified via `git stash` that the same 6 failures existed at the Task 2 state (Task 2's verify only ran 11 files; the launch path now requires a document in `efxPaintStore`)
- **Fix:** Registered a document in the failing describe block's `beforeEach` (`resetEfxPaintStore(); registerDocument(createEfxPaintDocument(BRIDGE_LAYER))`) with a comment noting the v1.0 launch contract
- **Files modified:** app/src/stores/physicPaintStore.rotoLoopClips.test.ts
- **Verification:** full app suite green
- **Committed in:** ace9502d (Task 3 GREEN)

**3. [Typecheck - Blocking] Task 4 missed a SerializedProject consumer in PhysicsPaintStudio.tsx**
- **Found during:** Task 4 verification (workspace build after GREEN)
- **Issue:** The pre-implementation inventory missed `PhysicsPaintStudio.tsx` — 6 `SerializedProject` references (import, coordinator/history generic instantiations, two execute-input casts, one frameStates cast). The app typecheck passed only because the package `dist` was stale; the tsup rebuild removed the alias and the app build's tsc failed
- **Fix:** Replaced all 6 references with the package's `EfxPaintDocument` (the engineState port returns `engine.save()` output, so the package type is the correct instantiation)
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Verification:** workspace build green; tree-wide grep zero matches
- **Committed in:** 12fca5c0 (Task 4 GREEN)

**4. [Rule 3 - Blocking] Task 4 legacy-shape helper name collided with the 45-07 token ban**
- **Found during:** Task 4 verification (tree-wide sweep)
- **Issue:** `isLegacySerializedProjectShape` in physicsPaintSessionFile.ts (Task 1's intentional legacy detection) contains the banned `SerializedProject` substring — a substring-based 45-07 gate would false-positive
- **Fix:** Renamed to `matchesLegacyV2SessionShape` (same detection semantics: version === 2 or strokes+settings top-level members)
- **Files modified:** app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts
- **Verification:** tree-wide grep for `SerializedProject`/`isSerializedProject` returns zero matches
- **Committed in:** 12fca5c0 (Task 4 GREEN)

---

**Total deviations:** 4 auto-fixed (2 missing critical, 2 blocking)
**Impact on plan:** All auto-fixes were necessary consequences of the v1.0 cutover (shape-read rewrites, fixture conversion, the launch-contract document requirement, the missed consumer, and the token-ban hygiene rename). No scope creep; the plan's deliverables are unchanged.

## Issues Encountered
- The app typecheck resolves `@efxlab/efx-physic-paint` via the BUILT `dist/index.d.ts` (gitignored) — a stale dist can mask or create typecheck failures; the workspace build's tsup step rebuilds it first, which is how the missed `PhysicsPaintStudio.tsx` consumer surfaced
- The app-side `parseEfxPaintDocument` has closed TRACK_KEYS that reject the engine's strokes/settings carriers — the apply-canvas guard must strip carriers before parsing (strip-then-parse idiom)
- The package has no vitest install — its tests run via the app's vitest binary from the package directory; the package's own check is `pnpm run check` (tsc --noEmit), not `typecheck`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 45-07 (legacy deletion) is unblocked: zero `SerializedProject`/`isSerializedProject` references survive in app/src, packages/efx-physic-paint/src, and packages/efx-physic-paint/demo — the token ban can go green without allowlist creep
- The dead `PhysicsPaintStudioToolbar.tsx` is already deleted; no v2-only session-load path survives anywhere (session files, launch context, engine, demo toolbar)
- DOC-04/DOC-05 marked complete under the shared-ID gate; final native confirmation at 45-08 UAT

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
