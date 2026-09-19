---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 04
subsystem: core
tags: [efx-paint, persistence, staging-commit, preact-signals, projection, dedup, path-safety, typescript, vitest]

# Dependency graph
requires:
  - phase: 45-01
    provides: EfxPaintDocument v1.0 schema/factory, CachedFrameReference, parseEfxPaintDocument fail-closed parser, buildEfxPaintDocumentRevision fingerprint
  - phase: 45-02
    provides: native cache transaction service re-pointed at cache/efx-paint with .efx-paint-staging- prefix (publish/settle command surface unchanged)
provides:
  - "Reactive v1.0 document store efxPaintStore (layerId → EfxPaintDocument, efxPaintVersion counter-signal, injected dirty callback, reset hook)"
  - "v1.0 TS persistence service efxPaintPersistence: staging/commit save with content-fingerprint dedup, fail-closed load, isSafeEfxPaintCachePath + stableSegment FNV-1a"
  - "Runtime ↔ default-track projection: serializeRuntimeIntoDocument / hydrateRuntimeFromDocument backed by physicPaintStore extractRuntimeStateForDocument / installRuntimeStateFromDocument"
affects: [45-05, 45-06, 45-07, 45-08]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 11795
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns: [non-reactive Map + counter-signal store, two-resource staging/commit transaction, content-fingerprint dedup cache, fail-closed parser delegation, prefix-locked path guard, shared serialization helper]

key-files:
  created:
    - app/src/stores/efxPaintStore.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/lib/efxPaintPersistence.test.ts
    - app/src/stores/efxPaintStore.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts

key-decisions:
  - "The persisted payload is the layerId → EfxPaintDocument map as-is (rotoPhysical dataUrls inline); the document model's CachedFrameReference carries no dataUrl, so the save input carries runtime frame bytes alongside documents and the loader returns hydrated frames"
  - "serializeRuntimeIntoDocument bumps documentRevision by one ONLY when the projected content actually changed (fingerprint comparison on the same docrev) — an unconditional bump would break the Task 3 idempotency dedup in the real 45-05 save flow"
  - "The dedup fingerprint combines buildEfxPaintDocumentRevision per layer with runtime frame byte terms (dataUrls): a repaint changes the bytes while deterministic cachePath refs stay the same, so a document-only key would wrongly skip re-staging"
  - "The rotoPhysical payload build is shared between the legacy toMceOutputs roto branch and extractRuntimeStateForDocument via _buildRotoPhysicalDocumentForLayer so both serialization seams emit identical payloads"
  - "installRuntimeStateFromDocument replaces the layer's runtime maps wholesale (delete-then-install) and mirrors loadFromMceOutputs' validation (canonical parse + timeline projection) and publication (bump rotoPhysicalRevision + physicPaintVersion, no dirty callback); it also clears the per-layer _rotoPhysicalStructuralCache"
  - "hydrateRuntimeFromDocument takes (document, frames) — the loader supplies the hydrated frame bytes; registerDocument stays a separate call (45-05 open path: loadEfxPaintDocuments + registerDocument + hydrateRuntimeFromDocument)"
  - "The dedup cache is populated only after a successful commit and cleared on every commit, mirroring savedOutputCache; a rollback never touches the cache so the prior committed fingerprint stays reusable"

patterns-established:
  - "Non-reactive Map + counter-signal store: every mutation bumps efxPaintVersion AND fires the injected dirty callback (MEMORY: always bump AND subscribe)"
  - "Two-resource transaction: stage sidecars under cache/.efx-paint-staging-<uuid> → writeProject(payload, transactionId) → settle commit/rollback; writeProject failure settles rollback and re-throws"
  - "Content-fingerprint dedup: fingerprint = document revisions + frame byte terms; cache hit skips staging/publish/settle entirely and reuses the prior persisted payload"
  - "Fail-closed load: every persisted document passes parseEfxPaintDocument before any store hydration; sidecar paths guarded by isSafeEfxPaintCachePath (prefix-locked, no backslash/absolute/NUL/empty/dot segments)"
  - "Shared serialization helper: _buildRotoPhysicalDocumentForLayer reads module maps directly (the _resolveRotoPhysicalStructural idiom) and is used by both the legacy and v1.0 seams"

requirements-completed: [DOC-01, DOC-05]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Reactive v1.0 document store efxPaintStore: non-reactive Map<layerId, EfxPaintDocument>, efxPaintVersion counter-signal bumped on every mutation, _setEfxPaintMarkDirtyCallback injection, registerDocument/getDocument/hasDocument/removeDocument/reset (reset no-ops when empty), no useEffect/useState"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#registers a document and returns it by layer id"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#bumps efxPaintVersion and fires the injected dirty callback on every mutation"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#reset empties the map and bumps the version signal"
        status: pass
    human_judgment: false
  - id: D2
    description: "v1.0 persistence service efxPaintPersistence: saveEfxPaintDocumentsWithProjectWrite stages PNG sidecars under cache/.efx-paint-staging-<uuid>, writes the .mce with the bound cache transaction, settles commit/rollback; loadEfxPaintDocuments validates every document through parseEfxPaintDocument (fail-closed) and reads sidecar PNGs back with every path guarded by isSafeEfxPaintCachePath"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#round-trips a document through staging/commit and restores identity on load"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#fails closed when the persisted document has unknown members"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#returns an empty map when no documents are persisted"
        status: pass
    human_judgment: false
  - id: D3
    description: "Runtime ↔ default-track projection: serializeRuntimeIntoDocument(layerId) projects the layerId-keyed runtime maps into the document's single default track (frames as deterministic CachedFrameReference refs via buildEfxPaintFrameCachePath, rotoPhysical as-is) and increments documentRevision only on real content change; hydrateRuntimeFromDocument(document, frames) restores the runtime maps; multi-Paint-track documents fail loud on outbound projection"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#projects runtime state into the single default track and increments documentRevision"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#hydrates a document whose default track carries frames/rotoPhysical into the runtime maps"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#round-trips runtime → document → runtime with reference-stable identity"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#projects an empty runtime into a schema-valid document with an empty default-track payload"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#never reads or writes another layer runtime maps when projecting layer A"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#throws on outbound projection when the document has more than one Paint track"
        status: pass
    human_judgment: false
  - id: D4
    description: "Path safety and stableSegment: isSafeEfxPaintCachePath accepts canonical cache/efx-paint/<stable-segment>/frame.png paths and rejects absolute paths, backslashes, NUL bytes, empty segments, '.'/'..' segments, and wrong prefixes; stableSegment is deterministic FNV-1a with sanitization (unsafe chars replaced, empty fallback 'layer', hash disambiguates sanitized collisions)"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#isSafeEfxPaintCachePath accepts canonical sidecar paths and rejects traversal"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#stableSegment is deterministic, collision-resistant, and sanitized"
        status: pass
    human_judgment: false
  - id: D5
    description: "Content-fingerprint dedup and rollback hardening: saving the same unchanged document twice produces an identical persisted payload with ZERO sidecar writeFile calls on the second save; when writeProject throws after staging, settle is called with 'rollback', the staging generation is removed, and the previously committed generation remains published with its original bytes"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#saving the same unchanged document twice skips sidecar staging on the second save"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#rolls back the staged generation and keeps the prior committed generation when the project write throws"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 04 Summary

**Reactive v1.0 document store plus the staging/commit TS persistence service with content-fingerprint dedup, fail-closed load, and the runtime ↔ default-track projection — DOC-01/DOC-05 TS side complete**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-23T16:20:00Z
- **Completed:** 2026-08-23T16:36:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created source, 2 created test, 1 modified)

## Accomplishments
- `efxPaintStore` — non-reactive Map + `efxPaintVersion` counter-signal, injected dirty callback, `registerDocument`/`getDocument`/`hasDocument`/`removeDocument`/`reset`; every mutation bumps AND fires (DOC-01)
- `efxPaintPersistence` — `saveEfxPaintDocumentsWithProjectWrite` stages PNG sidecars under `cache/.efx-paint-staging-<uuid>`, writes the `.mce` with the bound cache transaction, settles commit/rollback; `loadEfxPaintDocuments` fail-closed via `parseEfxPaintDocument` with every sidecar path guarded by `isSafeEfxPaintCachePath` (DOC-05)
- Runtime ↔ default-track projection: `serializeRuntimeIntoDocument` / `hydrateRuntimeFromDocument` backed by new `physicPaintStore` accessors `extractRuntimeStateForDocument` / `installRuntimeStateFromDocument`; `documentRevision` bumps only on real content change; multi-track documents fail loud
- Content-fingerprint dedup: no-op saves skip sidecar staging entirely (ZERO `writeFile` on the second save) and reuse the prior persisted payload; rollback provably leaves the prior committed generation intact
- Shared `_buildRotoPhysicalDocumentForLayer` helper keeps the legacy `toMceOutputs` roto branch and the v1.0 projection emitting identical payloads
- 16 new tests green (9 store + 7 persistence); full suite 2717 passed (up from 2701), typecheck clean

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: efxPaintStore + one-document save→load round-trip through staging/commit** - `aa19f9d4` (feat; tracer task — RED tests were authored and verified in the same pass)
2. **Task 2: Runtime ↔ default-track projection (serialization boundary, research A4)** - `08cfe642` (test) + `d973fbfc` (feat)
3. **Task 3: Path safety, content-fingerprint dedup, and rollback-on-failure hardening** - `098bfca3` (test) + `6477659f` (feat)

**Plan metadata:** (committed with this SUMMARY)

## Files Created/Modified
- `app/src/stores/efxPaintStore.ts` - Reactive document store: Map + counter-signal, dirty-callback injection, register/get/has/remove/reset, `serializeRuntimeIntoDocument` (single default track, content-changed revision bump), `hydrateRuntimeFromDocument`
- `app/src/lib/efxPaintPersistence.ts` - v1.0 persistence: staging/commit save, content-fingerprint dedup cache, fail-closed load, `isSafeEfxPaintCachePath`, `stableSegment` FNV-1a, `buildEfxPaintFrameCachePath`
- `app/src/lib/efxPaintPersistence.test.ts` - 7 tests: round-trip identity, fail-closed load, empty map, path guard, second-save idempotency, rollback keeps prior generation, stableSegment
- `app/src/stores/efxPaintStore.test.ts` - 9 tests: store reactivity + 6 projection tests (outbound, inbound, round-trip, empty, isolation, multi-track throw)
- `app/src/stores/physicPaintStore.ts` - `EfxPaintRuntimeProjection` type, `extractRuntimeStateForDocument` / `installRuntimeStateFromDocument` accessors, shared `_buildRotoPhysicalDocumentForLayer` helper (also used by the legacy `toMceOutputs` roto branch)

## Decisions Made
- **Persisted payload = document map as-is**: rotoPhysical dataUrls stay inline; the save input carries runtime frame bytes alongside documents and the loader returns hydrated frames (CachedFrameReference has no dataUrl by 45-01 design)
- **Content-changed revision bump**: `serializeRuntimeIntoDocument` compares the candidate fingerprint (same docrev) against the current document and bumps `documentRevision` only on real change — an unconditional bump would defeat the Task 3 dedup in the 45-05 save flow
- **Fingerprint includes frame byte terms**: document revision alone would wrongly skip re-staging when a repaint changes bytes but deterministic cachePath refs stay the same
- **Shared serialization helper**: `_buildRotoPhysicalDocumentForLayer` reads module maps directly (the `_resolveRotoPhysicalStructural` idiom) and serves both the legacy `toMceOutputs` roto branch and the v1.0 projection, guaranteeing identical payloads
- **Delete-then-install hydration**: `installRuntimeStateFromDocument` replaces the layer's runtime maps wholesale, mirrors `loadFromMceOutputs` validation (canonical parse + timeline projection) and publication (bump `rotoPhysicalRevision` + `physicPaintVersion`, no dirty callback), and clears the per-layer `_rotoPhysicalStructuralCache`
- **Cache populated only on commit**: the dedup cache is cleared and re-set on every successful commit (mirroring `savedOutputCache`); rollback never touches it

## Deviations from Plan

### Auto-fixed Issues

**1. [Bundle budget - Blocking] Task 2 additions pushed the main chunk over the 1120 kB desktop budget (V09-C04)**
- **Found during:** Task 2 verification (full suite after GREEN)
- **Issue:** The two new accessor methods in physicPaintStore.ts added 1.81 kB minified to the main chunk (1,118.22 → 1,120.03 kB), tripping `viteBuild.test.ts`'s no-warning assertion at the 1120 kB budget
- **Fix:** Extracted the rotoPhysical payload build into a shared module-level helper `_buildRotoPhysicalDocumentForLayer` used by BOTH the legacy `toMceOutputs` roto branch and `extractRuntimeStateForDocument` — eliminating the duplication instead of raising the milestone budget; main chunk back to 1,119.24 kB (0.76 kB margin)
- **Files modified:** app/src/stores/physicPaintStore.ts
- **Verification:** full suite green (2717 passed incl. viteBuild), typecheck clean
- **Committed in:** d973fbfc (Task 2 GREEN)

**2. [Typecheck - Blocking] Task 1 test file type errors surfaced at Task 2 verification**
- **Found during:** Task 2 verification (typecheck after GREEN)
- **Issue:** `saveDocuments` helper declared but never read (TS6133) and the `writeProject.mock.calls[0]` cast failed TS2352 because the untyped `vi.fn(async () => {})` mock inferred a zero-arg call signature
- **Fix:** Removed the unused helper; typed the mock as `vi.fn(async (_payload: Record<string, unknown>, _transactionId: string | null) => {})` so the destructured call tuple types correctly
- **Files modified:** app/src/lib/efxPaintPersistence.test.ts
- **Verification:** `pnpm --dir app run typecheck` clean; persistence suite 7/7
- **Committed in:** d973fbfc (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking bundle budget, 1 blocking typecheck)
**Impact on plan:** The bundle fix was a genuine code-quality improvement (removed duplication between the legacy and v1.0 serialization seams) and avoided amending the milestone budget criterion; the typecheck fix was test-only. No scope creep.

## Issues Encountered
- The 1120 kB bundle budget (V09-C04) is tight: the plan's own additions nearly tripped it. Resolved by sharing the rotoPhysical serialization logic instead of raising the budget — the shared helper is also the correct long-term shape for 45-07's legacy deletion
- The module-level dedup cache persists across tests in the same file (mirroring the legacy `savedOutputCache` behavior), so each new test uses a distinct layerId to avoid cross-test cache hits — same idiom as the legacy test file's distinct `makeOutput(n)` content

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 45-05 wires the store: `saveProject`/`saveProjectAs` call `saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, writeProject)` where documents come from `efxPaintStore` after `serializeRuntimeIntoDocument(layerId)` per physic-paint layer; the open path uses `loadEfxPaintDocuments` + `registerDocument` + `hydrateRuntimeFromDocument`; `closeProject` calls `efxPaintStore.reset()`
- `efxPaintStore` is not yet imported by any app code — it is tree-shaken out of the production bundle (the 45-05 wiring will pull it in; the bundle budget has 0.76 kB headroom)
- `toMceOutputs`/`loadFromMceOutputs` remain present as required (deletion is 45-07 scope); the shared `_buildRotoPhysicalDocumentForLayer` helper is the seam 45-07 can keep after the legacy branch is deleted

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
