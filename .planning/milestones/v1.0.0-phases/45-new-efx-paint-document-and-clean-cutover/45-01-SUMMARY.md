---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 01
subsystem: core
tags: [efx-paint, document-model, fail-closed-parser, deterministic-revision, typescript, vitest]

# Dependency graph
requires:
  - phase: 36
    provides: PhysicPaintRotoPhysicalDocument type and buildPhysicPaintRotoPhysicalRevision (roto physical model)
provides:
  - "EfxPaintDocument v1.0 type + deep-frozen factory (createEfxPaintDocument) with one default Paint track and one fixed Background track"
  - "Fail-closed parsers at every record level (parseEfxPaintDocument, parseInternalPaintTrack, parseBackgroundTrack, parseFrameLoopClip, parseCachedFrameReference)"
  - "Deterministic document/track/composite revision builders (buildEfxPaintDocumentRevision, buildEfxPaintTrackRevision, buildEfxPaintCompositeRevision)"
  - "Shared canonical encoder (efxPaintCanonicalEncoder.ts) re-used by the roto physical model"
affects: [45-02, 45-03, 45-04, 45-05, 45-06, 45-07, 45-08, phases 46-52]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 9100
  tasks: 3
  commits: 7

# Tech tracking
tech-stack:
  added: []
  patterns: [fail-closed parsing, deterministic revision encoding, pure model / reactive store split, D-29 empty-collection idiom]

key-files:
  created:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/efx-paint/document/efxPaintCanonicalEncoder.ts
    - app/src/efx-paint/document/efxPaintDocument.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts

key-decisions:
  - "EfxPaintDocument is the identity root: one versioned document per parent layer with stable UUID track IDs (crypto.randomUUID) and a documentRevision"
  - "The Background track is the single fixed track beneath all Paint tracks; a new document has exactly one Paint track and one Background track with the transparent fallback (D-08)"
  - "Shared canonical encoder extracted to efxPaintCanonicalEncoder.ts and re-pointed from the roto physical model — no duplicated encoding logic"
  - "Parsers never allocate IDs and never normalize malformed input; absent frames/loopClips members are treated as empty collections (D-29 idiom)"
  - "Tracer gate auto-approved: config mode is yolo (auto-approve), so the tracer verify was re-run green and execution continued without stopping"

patterns-established:
  - "Fail-closed parsing: isPlainRecord + hasOnlyKeys allowed-key Sets + throw-on-unknown at every record level, 'TypeName: reason.' error style"
  - "Deterministic revision encoding: validate-then-hash, stable-identity sort (localeCompare), length-prefixed strings, FNV-1a fingerprint"
  - "Empty additive collections (frames, loopClips, background clips) contribute no revision term (D-29 idiom)"
  - "Pure model modules: no Preact imports, signals, or side effects in the document model"

requirements-completed: [DOC-01, DOC-02]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "v1.0 EfxPaintDocument type and deep-frozen factory: version=1, documentRevision=0, compositeRevision=0, one default Paint track (UUID id, 'Track 1', order 0, visible, opacity 1, normal blend), one fixed Background track (UUID id, empty clips, transparent fallback, visible), activeTrackId = default track id, photoReference null"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocument.test.ts#createEfxPaintDocument"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fail-closed parser at every record level: allowed-key sets, version check, duplicate track ids, dangling activeTrackId, fallback union, non-record input, member-order determinism; round-trips factory documents through JSON serialize/parse"
    requirement: DOC-01
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocument.test.ts#parseEfxPaintDocument fail-closed behavior"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deterministic document/track/composite revision builders: prefixed fingerprints, pure, member-order insensitive, sensitive to track id/revision/fallback/activeTrackId, empty additive collections contribute no term"
    requirement: DOC-02
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocument.test.ts#revision builders"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shared canonical encoder (efxPaintCanonicalEncoder.ts) extracted from the roto physical model and re-used by both revision builders and buildPhysicPaintRotoPhysicalRevision with no regression"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run (full suite, 2692 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 2h15m
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 01 Summary

**Pure v1.0 EFX Paint document model: deep-frozen factory, fail-closed parsers at every record level, and deterministic document/track/composite revision builders over a shared canonical encoder**

## Performance

- **Duration:** 2h15m wall clock (13:44 phase start to 16:00 last commit, including a context-compaction pause)
- **Started:** 2026-08-23T13:44:55Z
- **Completed:** 2026-08-23T16:00:21Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `EfxPaintDocument` v1.0 identity root: one versioned document per parent layer, stable UUID track IDs, one default Paint track, one fixed Background track with transparent fallback (DOC-01, DOC-02, D-08)
- Fail-closed parser at every record level: allowed-key sets, version check, duplicate track id detection, dangling activeTrackId rejection, fallback union validation — never allocates IDs, never normalizes
- Deterministic document/track/composite revision builders: validate-then-hash, stable-identity sort, length-prefixed strings, FNV-1a fingerprint; empty additive collections contribute no term (D-29)
- Shared canonical encoder extracted to `efxPaintCanonicalEncoder.ts` and re-pointed from the roto physical model — one encoder implementation, no duplicated logic
- 17 unit tests covering factory shape, fail-closed hostile input, and revision determinism/sensitivity; full suite green (139 files, 2692 tests) and typecheck clean

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: v1.0 document types, factory, happy-path parser** - `e0e1d91a` (test) + `d5410e9a` (feat)
2. **Task 2: fail-closed parser at every record level** - `2a54f566` (test) + `38480bcf` (feat)
3. **Task 3: deterministic document/track/composite revision builders** - `b3719de0` (test) + `1316f1fb` (feat)

**Plan metadata:** `4c79a4d2` (fix: typecheck parser guards and test fixture typing)

## Files Created/Modified
- `app/src/efx-paint/document/efxPaintDocument.ts` - Pure model: types (EfxPaintDocument, InternalPaintTrack, BackgroundTrack, FrameLoopClip, CachedFrameReference, BackgroundFallback, BlendMode) + deep-frozen factory `createEfxPaintDocument`
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` - Fail-closed parsers with allowed-key Sets at every record level; exports `parseEfxPaintDocument` and `parseInternalPaintTrack`
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` - `buildEfxPaintDocumentRevision`, `buildEfxPaintTrackRevision`, `buildEfxPaintCompositeRevision`
- `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts` - Shared encoder primitives (length-prefixed strings, canonical numbers, validated booleans, FNV-1a hash)
- `app/src/efx-paint/document/efxPaintDocument.test.ts` - 17 tests: factory shape/round-trip/freezing, fail-closed hostile input, revision determinism and sensitivity
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` - Modified: imports the shared encoder, removed the 5 duplicated local encoder functions

## Decisions Made
- **EfxPaintDocument is the identity root** (per plan's assumption-delta decision): one document per parent layer, stable UUID track IDs, documentRevision as the change-detection lease
- **Background track fixed and single**: exactly one Background track beneath all Paint tracks; transparent fallback at creation (D-08), no fallback UI in Phase 45 (D-09)
- **Shared encoder extraction**: the plan's action text directed extracting the encoder into a shared pure helper if not exported — created `efxPaintCanonicalEncoder.ts` and re-pointed the roto physical model (no duplicated logic)
- **D-29 empty-collection idiom**: absent `frames`/`loopClips` members parse as empty collections so empty additive collections contribute no revision term
- **Tracer gate handling**: config mode is `yolo` (auto-approve) with `_auto_chain_active: false` — treated as auto mode, re-ran the tracer verify (green), and continued to Task 2 without stopping

## Deviations from Plan

### Auto-fixed Issues

**1. [Typecheck - Blocking] Parser type narrowing for blendMode and repeat union**
- **Found during:** Task 3 verification (typecheck after GREEN)
- **Issue:** `blendMode: value.blendMode` did not narrow string to the BlendMode union, and the repeat ternary produced `count: unknown` (narrowing did not apply inside the ternary)
- **Fix:** Added `isBlendMode` type guard + BLEND_MODES Set; restructured repeat parsing into a `let repeat: FrameLoopClipRepeat` block with construction inside the mode branches after `isNonNegativeInteger` narrowing
- **Files modified:** app/src/efx-paint/document/efxPaintDocumentParsers.ts
- **Verification:** `pnpm --dir app run typecheck` clean; document suite 17/17; full suite 2692 passed
- **Committed in:** 4c79a4d2

**2. [Typecheck - Blocking] Test fixture typing for hostile-input mutations**
- **Found during:** Task 3 verification (typecheck after GREEN)
- **Issue:** `validDocumentJson(): Record<string, unknown>` made `.tracks`/`.background` accesses `unknown` (TS18046) and the background object lacked an index signature
- **Fix:** Typed the fixture as `MutableDocumentJson` with typed tracks/background/clips/fallback plus index signatures
- **Files modified:** app/src/efx-paint/document/efxPaintDocument.test.ts
- **Verification:** `pnpm --dir app run typecheck` clean
- **Committed in:** 4c79a4d2

**3. [Test assertion - Minor] Fallback unknown-member message regex**
- **Found during:** Task 2 RED run
- **Issue:** The test expected `/BackgroundTrack: unknown members/` but the parser correctly throws `BackgroundTrack: transparent fallback must contain exactly mode.` (the transparent fallback's allowed-key set is exactly `{mode}`)
- **Fix:** Updated the test regex to the actual fail-closed message; parser behavior was correct
- **Files modified:** app/src/efx-paint/document/efxPaintDocument.test.ts
- **Verification:** Task 2 suite green
- **Committed in:** 38480bcf (Task 2 GREEN)

---

**Total deviations:** 3 auto-fixed (2 blocking typecheck, 1 minor test assertion)
**Impact on plan:** All fixes necessary for correctness (typecheck gate) or test accuracy. No scope creep.

## Issues Encountered
- Typecheck surfaced two narrowing problems in the parser (blendMode union, repeat union construction) — resolved with a type guard and branch-local construction; both were pure type-level issues, no behavior change
- The fallback unknown-member test initially asserted the wrong message — the parser's fail-closed message was correct, the assertion was too specific

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `EFX_PAINT_DOCUMENT_VERSION` is the single version discriminator the 45-03 rejection gate and all parsers consume
- `createEfxPaintDocument`'s stable UUID track IDs are the identity every later phase (45-02 through 45-08, phases 46-52) addresses
- Parsers and revision builders are ready for 45-04 persistence (serialize/parse round-trip proven) and the 45-05/45-06 store and bridge
- No blockers; the roto physical model continues to build its revision from the shared encoder with zero regression

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
