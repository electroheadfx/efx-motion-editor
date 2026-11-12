---
phase: 61-vector-painting-tool
plan: 03
subsystem: payload
tags:
  - watercolor
  - vector-path
  - sparse-width
  - render-mode
  - fail-closed-validation
  - wire-codec
  - tdd

# Dependency graph
requires:
  - phase: 61-02
    provides: "VectorAnchor / VectorAnchorKind as the one structural anchor type, ANCHOR_WIDTH_MIN/MAX/DEFAULT, isUniformWidthProfile (D-10's store-nothing gate)"
  - phase: 61-01
    provides: "Wave-0 verdict (payload-extension seam, 4x density, scriptFactor width channel) — the shape is persisted as engine-block extension, not a new event kind"
provides:
  - "packages/efx-watercolor/src/payload/vectorPath.ts — AquarelleAnchor (re-export), AquarelleRenderMode, AQUARELLE_RENDER_MODES, DEFAULT_AQUARELLE_RENDER_MODE, fail-closed normaliseAquarelleAnchors, isVectorStroke, isAquarelleRenderMode, resolveAquarelleRenderMode, projectVectorPath, anchorsEqual, vectorPathsEqual"
  - "AquarelleStrokePayload.anchors? / .renderMode? and the same two on AquarelleStroke, copied into the opaque engine block only when present"
  - "codec.parse validates both optional engine fields and still refuses unknown schemaVersion; the payload entry re-exports the module"
affects:
  - 61-04 (the adapter reads engine.anchors; sampleVectorWidths consumes the sparse factors)
  - 61-05 (AQTL v2 encodes the same two fields — this module is the shape authority)
  - 61-06 (the Rust side declares the same two optional keys)
  - 61-09 (path-edit overlay rebuilds the persisted shape from this module)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 9810
  tasks: 3
  commits: 6
plan_head_before: 9d6926db28c2b427bf3dffa7d038f446d4e090e9
plan_head_after: 1582810c5de09adc92754441974816265bf13cbe

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Conditional canonical term in the engine-block projection: each new field is spread ONLY when present, so the pre-existing key set stays literally identical and a mode-only stroke gains exactly one key (D-14 independence)"
  - "Fail-closed list validator: a single malformed entry refuses the WHOLE list with an `undefined` return, never a partial repair and never a throw (T-61-08)"
  - "Canonicalising clone at the wire boundary: parse rebuilds each anchor from its known fields into a frozen array, so a parsed event never aliases the untrusted wire object and unknown extra keys cannot reach a document"
  - "Tolerance-based structural equality (|a-b| < 1e-9) as the change-detection primitive later plans diff drafts against"
  - "Sparse-field projection: a factor equal to the published default is dropped at projection time, so a uniform stroke writes no width data at all (D-10)"

key-files:
  created:
    - packages/efx-watercolor/src/payload/vectorPath.ts
    - packages/efx-watercolor/src/payload/vectorPath.test.ts
  modified:
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/payload/codec.test.ts
    - packages/efx-watercolor/src/payload/index.ts

key-decisions:
  - "The engine block is the persistence carrier: `anchors` and `renderMode` ride the existing opaque slot, so the host generic contract (StudioStroke<P>) is untouched and the host still never reads P."
  - "Conditional spread rather than explicit `undefined` members for the two new keys, because the no-fields case is pinned by literal Object.keys equality against the nine pre-vector keys."
  - "Equality tolerance is |a-b| < 1e-9, so a pair of factors differing by exactly 1e-9 compares unequal — the plan's wording ('differs by 1e-9') reads as a difference, not as equality."
  - "vectorPathsEqual resolves an absent mode to watercolour, so { anchors } equals { anchors, renderMode: 'watercolor' } — the absent-means-watercolour law applies to comparison too."
  - "normaliseAquarelleAnchors builds a canonical anchor from the known fields only and freezes the array; an empty list refuses (an empty list is not a path) and a non-array refuses rather than throwing."
  - "projectVectorPath drops a width key only when the factor is exactly ANCHOR_WIDTH_DEFAULT and never clamps a non-default factor, so 1.8 and 0.3 pass through untouched; the input array is never mutated."
  - "Codec validation lives in isStrokeShape (so a bad field refuses the whole event) and canonicalisation lives in cloneStrokeForWire (so parse returns a frozen copy); serialize stays a faithful pass-through for a valid stroke."
  - "AQUARELLE_SCHEMA_VERSION stays 1 with the reason recorded in the codec header: the two fields are optional additions whose absence is the documented state, not a legacy path."

patterns-established:
  - "One structural anchor type: the payload re-exports 61-02's VectorAnchor instead of redeclaring it, pinned by a source scan that also forbids per-anchor brush and colour members (VEC-04)."
  - "Every hand-written field list on the persistence path is the failure surface, so each seam gets a no-field pin (key-set equality) beside its carry-the-field pin."

requirements-completed: [VEC-01, VEC-03, VEC-04]

coverage:
  - id: D1
    description: "A stroke carries an optional non-empty anchor list plus an explicit render mode; both are copied into the opaque engine block only when present, and a stroke with neither keeps the exact pre-vector key set"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/vectorPath.test.ts#isVectorStroke"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/toStudioStroke.test.ts#vector path engine block (61-03 D-12 / D-14)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sparse per-anchor width is the only per-vertex property: a uniform stroke writes no width key, exactly one factor survives in a sparse list, 1.8 and 0.3 pass through unclamped and 0.1 is refused"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/vectorPath.test.ts#projectVectorPath — sparse width (D-10)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/toStudioStroke.test.ts#sparse vector width projection (61-03 D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The payload type carries no per-vertex brush type and no per-vertex colour member; brush id and colour stay stroke-level and round-trip unchanged, and the wire codec validates both optional fields fail-closed while keeping schemaVersion 1"
    requirement: VEC-04
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/vectorPath.test.ts#the anchor type is re-exported, never redeclared"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#wire validation of the vector fields (61-03 T-61-08)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 03: Vector Path Payload Shape Summary

**A vector stroke is persisted as an optional non-empty anchor list plus an explicit render mode inside the existing opaque engine block — validated fail-closed at both seams, width-stored sparsely, and leaving every hand-painted stroke byte-identical in shape.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-10T12:54:48Z
- **Completed:** 2026-11-10T13:00:44Z
- **Tasks:** 3 (3 TDD cycles)
- **Files created/modified:** 7 (2 created, 5 modified)

## Accomplishments

- `payload/vectorPath.ts` establishes the phase's one persisted shape and its laws: vector-ness is a non-empty anchor list (no parallel boolean), render mode is explicit with absent meaning watercolour (D-12), and the width factor is the only per-anchor paint property (VEC-03 / VEC-04).
- The anchor type is 61-02's `VectorAnchor` re-exported as `AquarelleAnchor` — one structural type, one definition, pinned by a source scan that also forbids any per-anchor brush or colour member.
- `normaliseAquarelleAnchors` refuses a whole list on the first malformed entry (NaN coordinate, unknown kind, non-finite handle, width outside 0.2–2.0, empty list, non-array) and never throws; the returned list is a frozen canonical copy.
- `toStudioStroke` copies `anchors` and `renderMode` into the opaque engine block with conditional spreads, so a stroke with neither field returns `Object.keys(engine)` equal to the literal nine pre-vector keys, and a mode-only stroke gains exactly that one key (D-14 independence).
- `projectVectorPath` implements D-10's store-nothing law: a factor equal to the default is dropped, a sparse 1.8 survives as exactly one width key, order is preserved for 61-02's stations, and the input is never mutated.
- `codec.parse` validates both optional engine fields and returns null (never a repaired event) for a malformed anchor list or an unknown mode, while `AQUARELLE_SCHEMA_VERSION` stays 1 with the reason stated in the header.

## Task Commits

Each task was committed atomically; all three TDD tasks carry a RED then a GREEN commit:

1. **Task 1 RED: failing pins for the persisted vector-path shape** - `86f6ef832` (test)
2. **Task 1 GREEN: the vectorPath module, engine-block copy and package re-export** - `d5cb4c5e4` (feat)
3. **Task 2 RED: failing pins for the sparse width projection** - `73fff165c` (test)
4. **Task 2 GREEN: projectVectorPath wired into the engine block** - `bd537c119` (feat)
5. **Task 3 RED: failing pins for vector-field wire validation** - `8baf391d1` (test)
6. **Task 3 GREEN: fail-closed validation at the codec boundary** - `1582810c5` (feat)

**Plan metadata:** included in the `docs(61-03)` completion commit.

## TDD Gate Compliance

| Gate | Evidence |
|------|----------|
| Task 1 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `vector path engine block (61-03 D-12 / D-14) > copies anchors and renderMode into the engine block unchanged`. 34 tests ran, 11 failed on assertions (4 engine-block + 7 vectorPath truth-table). |
| Task 1 GREEN | `vitest run src/payload/vectorPath.test.ts src/payload/toStudioStroke.test.ts` → 34/34 passed; committed as `feat`. |
| Task 2 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `projectVectorPath — sparse width (D-10) > omits an explicit default factor and keeps exactly one non-default factor`. 43 tests ran, 3 failed on assertions. |
| Task 2 GREEN | same command → 43/43 passed; committed as `feat`. |
| Task 3 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `wire validation of the vector fields (61-03 T-61-08) > parses to null when an anchor list is malformed`. 33 tests ran, 3 failed on assertions. |
| Task 3 GREEN | `vitest run src/payload/codec.test.ts` → 33/33 passed; committed as `feat`. |
| REFACTOR | Not needed — no cleanup beyond the in-cycle work recorded below. |

The commit order is RED → GREEN for all three cycles. RED evidence records live in
`.planning/phases/61-vector-painting-tool/.red-evidence/61-03-t1|t2|t3/` (untracked, as in 61-02 and 61-08).

## Files Created/Modified

- `packages/efx-watercolor/src/payload/vectorPath.ts` - the shape module: type re-exports, the closed render-mode union, the fail-closed anchor validator, `isVectorStroke`, `projectVectorPath`, `anchorsEqual`, `vectorPathsEqual`
- `packages/efx-watercolor/src/payload/vectorPath.test.ts` - 25 pins: vector-ness, render-mode default and membership, the malformed-truth-table, equality tolerance, sparse projection, JSON round trip, and the no-redeclare / no-per-vertex-paint source scans
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` - the two optional members on `AquarelleStroke` and `AquarelleStrokePayload` and their conditional spread into the engine block (anchors projected, renderMode verbatim)
- `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` - 8 new pins: carry both, carry neither (key-set equality), mode-only (exactly one added key), zero-length-handle bezier, uniform stores nothing, one 1.8 keeps one key, 1.8/0.3 unclamped through engine block and wire
- `packages/efx-watercolor/src/payload/codec.ts` - optional-field validation in `isStrokeShape`, canonicalising anchor copy in `cloneStrokeForWire`, and the schemaVersion-1 rationale in the header
- `packages/efx-watercolor/src/payload/codec.test.ts` - 6 new pins: vector round trip with one 1.8, malformed anchor lists → null, unknown mode → null, faithful re-serialise, neither-field round trip, named refusal codes
- `packages/efx-watercolor/src/payload/index.ts` - `export * from './vectorPath'`

## Verification Run

- `pnpm --filter @efxlab/efx-watercolor exec vitest run src/payload/vectorPath.test.ts src/payload/toStudioStroke.test.ts src/payload/codec.test.ts` → 76 passed
- `pnpm --filter @efxlab/efx-watercolor exec vitest run` → 14 files, 260 passed | 8 skipped (baseline before this plan: 221 passed | 8 skipped; +39 tests)
- `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` → 9 passed with `src/payload` still scanned
- `pnpm --filter @efxlab/efx-watercolor run check` (tsc --noEmit) → clean
- `grep -rn "brushId" packages/efx-watercolor/src/payload/vectorPath.ts` → no match (brush id stays stroke-level)
- `git show --first-parent --diff-filter=D --name-only` on each of the six commits → no tracked file deleted

## Decisions Made

- **Engine block as the carrier.** The two fields ride the existing opaque `engine: P` slot, so the host generic contract is untouched and the host still never reads `P`. This is the shape 61-05's AQTL v2 must encode.
- **Conditional spread, not explicit `undefined`.** The no-fields pin is `Object.keys(engine)` equality against the literal nine pre-vector keys, so a spread that adds nothing is the only implementation that satisfies both "no key invented" and "exactly one key added for a mode-only stroke".
- **`|a-b| < 1e-9` means equal.** The plan says `anchorsEqual` is false "when one width factor differs by 1e-9", so a difference of exactly the tolerance must compare unequal; a strict `<` on the absolute difference is the only reading that satisfies it.
- **`vectorPathsEqual` resolves the mode.** Comparing resolved modes makes `{ anchors }` equal to `{ anchors, renderMode: 'watercolor' }`, applying the absent-means-watercolour law to change detection as well as rendering.
- **Canonical anchors at the boundary.** `canonicalAnchor` rebuilds from the known fields only, so an unknown extra key in a hand-edited document can never reach a parsed event; the list is frozen so a later mutation cannot desync the geometry.
- **Validation in `isStrokeShape`, canonicalisation in `cloneStrokeForWire`.** This keeps `parse` fail-closed (null for the whole event) while `serialize` remains a faithful pass-through for a stroke that already passed the shape test.
- **Schema version stays 1.** The fields are optional additions whose absence is the documented state, not a legacy branch — recorded in one sentence in the codec header.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A brand-new module cannot produce valid RED on a load failure**
- **Found during:** Task 1 RED and Task 2 RED
- **Issue:** The plan says to create the test file and "let it fail before the module exists" (Task 1) and to extend a module with a not-yet-existing function (Task 2). A missing-module import makes Vitest report `Failed Suites … 0 test`, which the #3770 classifier refuses (`fixture_or_load_failure`) — it cannot authorize GREEN. This is the 61-02 precedent repeating.
- **Fix:** The load failure was observed and recorded first (Task 1: "Failed to load url ./vectorPath … Does the file exist?"), then a scratch shape-only stub was added locally so the target tests executed and failed on their assertions. The stub was never committed: each RED commit carries only the test file(s), and `vectorPath.ts` was restored with `git checkout -- <file>` before the Task 2 RED commit.
- **Files modified:** none committed by the stub.
- **Verification:** `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for all three cycles with 11, 3 and 3 failing assertion tests respectively.
- **Committed in:** `86f6ef832`, `73fff165c`, `8baf391d1` (the RED commits)

**2. [Rule 3 - Blocking] Task 2 could not be completed without touching `toStudioStroke.ts`**
- **Found during:** Task 2 (`Sparse width projection and the absent-means-uniform rule`)
- **Issue:** The plan's frontmatter `files_modified` and the task's `<files>` list name only `vectorPath.ts`, `vectorPath.test.ts` and `toStudioStroke.test.ts`, but the task's `<action>` requires making `toStudioStroke` apply `projectVectorPath` to the anchor list it copies into the engine block. The wiring is the deliverable, so the file had to be modified.
- **Fix:** `toStudioStroke.ts` now calls `projectVectorPath(s.anchors)` in the engine-block spread. The change is confined to the single expression the task describes.
- **Files modified:** `packages/efx-watercolor/src/payload/toStudioStroke.ts`
- **Verification:** the engine-block pin `drops an explicit default factor through the engine block (uniform stores nothing)` fails on the un-wired implementation and passes after it.
- **Committed in:** `bd537c119` (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking)
**Impact on plan:** Both are execution-mechanics fixes; no scope change, no product surface beyond the plan's stated actions, and every planned behaviour and acceptance criterion is asserted by the committed tests.

## Issues Encountered

- The `AquarelleStroke` runtime type did not yet carry `anchors`/`renderMode` when the Task 1 RED tests were committed, so that RED commit is type-invalid at that revision (vitest runs through esbuild and does not typecheck). This is inherent to writing the test before the type exists and resolved in the same task's GREEN commit; `tsc --noEmit` is clean at every subsequent commit.
- None otherwise. No flaky arms, no unrelated failures, no pre-existing warnings touched.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The two scratch RED stubs were replaced by the committed implementations before each GREEN commit; no placeholder branch or hardcoded empty data remains.

## Threat Surface

- T-61-08 (tampering via document JSON): every coordinate, handle and width factor is checked for finiteness and range by `normaliseAquarelleAnchors`; one bad anchor refuses the whole list; test-time refusal is asserted in both `vectorPath.test.ts` and `codec.test.ts`, and both refuse by returning null/undefined rather than throwing.
- T-61-09 (unbounded anchor list from disk): the validator is a single O(n) pass with no recursion, and `cloneStrokeForWire` canonicalises into a new array sized from the validated entries; nothing in this plan allocates from an unvalidated count.
- T-61-10 (engine-block key leakage): accepted — the block is already stored opaquely and the two new keys are geometry the user drew.
- T-61-SC (package installs): none — the plan added no dependency; the module imports only `../vector/spine` and host types.
- No new network endpoint, auth path or file access pattern was introduced.

## Next Phase Readiness

- 61-04 can read `engine.anchors` from the projected stroke and feed `sampleVectorWidths` from 61-02; the sparse factors survive the engine block and the wire unclamped.
- 61-05 has a single shape authority to encode into AQTL v2: `anchors` (canonical, ordered, sparse width) plus `renderMode`; `projectVectorPath` and `resolveAquarelleRenderMode` are the two helpers it should call rather than re-deriving.
- 61-06 declares the same two optional keys in Rust; the wire contract is pinned by the codec round-trip arms.
- 61-09 can rebuild a persisted path with `normaliseAquarelleAnchors` and diff drafts with `anchorsEqual` / `vectorPathsEqual`.
- No blockers. The end-of-phase manual UAT rows belong to later plans; this plan's deliverables are fully proven by passing unit tests.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All seven plan files exist on disk (2 created, 5 modified).
- All six task commits (`86f6ef832`, `d5cb4c5e4`, `73fff165c`, `bd537c119`, `8baf391d1`, `1582810c5`) are ancestors of HEAD.
- No commit deletes a tracked file.
