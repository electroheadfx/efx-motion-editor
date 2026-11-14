---
phase: 61-vector-painting-tool
plan: 05
subsystem: persistence
tags: [aqtl, binary-codec, vector-path, watercolor, tdd, restore, f32]

requires:
  - phase: 61-vector-painting-tool
    provides: 61-03 vector payload seam (VectorAnchor, normaliseAquarelleAnchors, projectVectorPath, resolveAquarelleRenderMode)

provides:
  - AQTL v2 binary payload carrying the anchor block, sparse width factors and render mode
  - Fail-closed vector-block decode (truncation, hostile anchor counts, reserved flags)
  - Reopen-lossless restore seeding of anchors and renderMode
  - Codec byte-level fixed-point pins (encode/decode/re-encode identical, no width residue)

affects: [61-07, 61-14, snapshot codec, script replay, path editing]

actuals:
  tokens: 9328
  tasks: 3
  commits: 5

plan_head_before: 9df1dd29f3d8c516d7c79243072a3226a4b0ab86
plan_head_after: 19c75c3cf9f5763080e677414e774273fc8f5b65

tech-stack:
  added: []
  patterns:
    - "Vector block appended inside the opaque engine slot (after playFrame, before pointCount) so every pre-existing field offset stays stable"
    - "Conditional key materialisation on decode: an optional field is written back only when its flag carried it, never as an explicit default"
    - "Bounded reader with a per-anchor minimum-byte bound rejects hostile u16 counts before any allocation"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  modified:
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts

key-decisions:
  - "A hand-painted stroke pays exactly ONE u8 vector-flags byte: the version field keeps its u16 width, and the plan's own byte-layout table fixes the structural addition at one byte (the '+2' prose was arithmetic that double-counted the version bump)"
  - "Anchor scalars are f32 on the wire, so the fixture carries Math.fround(1.8); the test asserts exact whole-stroke deep equality plus a 1e-6 tolerance check against the authored 1.8"
  - "renderMode is seeded on restore only when the payload carried the key — an absent mode stays absent so the byte fixed point never materialises a default"
  - "A malformed anchor list omits the path for that event instead of aborting the restore; the refusal surfaces at path edit and export"

patterns-established:
  - "Vector block in the opaque carrier: any future per-stroke extension appends after the previous block rather than re-laying out the stroke body"
  - "Codec fixed point as the reopen guarantee: byte identity across repeated passes is asserted at the codec seam, independent of engine replay"

requirements-completed: [VEC-06]

coverage:
  - id: D1
    description: "AQTL v2 round-trips a vector stroke deep-equal (two anchor kinds, stored handles, one sparse 1.8 width factor, renderMode) and refuses v1 with unsupported-version"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 vector payload (61-05) > round-trips a two-anchor vector stroke deep-equal, order preserved"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL fail-closed validation > validates the header before allocating"
        status: pass
    human_judgment: false
  - id: D2
    description: "A truncated anchor block and a hostile u16 anchor count both fail closed with typed codec errors instead of returning a partial stroke"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 vector payload (61-05) > fails closed when the stream is cut inside the anchor block"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 vector payload (61-05) > rejects a hostile anchor count before reading any anchor"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reopen restore path seeds anchors and renderMode beside playFrame; a malformed anchor list degrades only its own event while serials, clock, key anchors and timeline stay unchanged"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.test.ts#61-05 reopen-lossless vector restore > seeds the anchor path, the sparse width factor and the render mode"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.test.ts#61-05 reopen-lossless vector restore > degrades only its own event when the anchor list is malformed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Codec byte-level fixed point: encode/decode/re-encode is byte-identical, a uniform path accumulates no width residue, and three passes stay byte-stable"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 encode/decode fixed point (61-05) > is byte-identical when a decoded vector stroke is re-encoded"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 encode/decode fixed point (61-05) > leaves no width residue on a uniform path"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 05: AQTL v2 Vector Payload Summary

**AQTL v2 carries the vector anchor block, sparse width factors and render mode end to end — v1 is refused outright, and a reopened vector stroke stays editable as a path instead of degrading to a painted one**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-10T13:23:08Z
- **Completed:** 2026-11-10T13:30:12Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `SCRIPT_TIMELINE_BINARY_VERSION` is 2 and the decoder accepts nothing else: version 1 fails with `unsupported-version` carrying the received number, with no upgrade path and no v1 reader left behind.
- The vector block (flags byte, u16 anchor count, per-anchor f32 x/y + kind + handle flags + conditional handle pairs + conditional width, then an optional render-mode byte) is written after the engine `playFrame` presence and before `pointCount`, so every pre-existing offset is stable and a hand-painted stroke pays exactly one byte.
- Decoding is fail-closed through the same bounded reader: reserved flags, zero counts, hostile u16 counts (checked against a per-anchor minimum before any allocation), truncated anchor blocks and unknown kind/mode codes all raise typed `ScriptTimelineCodecError`s.
- `restoreAquarelleRecordTimeline` seeds `anchors` (normalised) and `renderMode` (resolved) beside `playFrame`, writing each key only when the payload carried it; a malformed anchor list omits the path for its own event without aborting the restore.
- Codec-level determinism is pinned: encode/decode/re-encode is byte-identical, a uniform-width path gains no `width` residue, and three passes are byte-stable.

## Task Commits

Each task was committed atomically (TDD tasks carry RED then GREEN):

1. **Task 1: AQTL v2 vector payload (tracer, TDD)** - `004d01e79` (test, RED) → `413061a08` (feat, GREEN)
2. **Task 2: Reopen-lossless restore seeding (TDD)** - `e606b4cba` (test, RED) → `d424be1da` (feat, GREEN)
3. **Task 3: Codec byte-level fixed point** - `19c75c3cf` (test)

**Plan metadata:** see the docs commit that follows this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` - AQTL v2: version bump, vector block encode/decode, f32 reader/writer, typed fail-closed validation
- `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` - vector fixtures and round-trip/byte-cost/truncation/hostile-count/idempotence pins plus the fixed-point cases
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - `restoreAquarelleRecordTimeline` seeds `anchors` and `renderMode` conditionally
- `app/src/components/physic-paint/view/aquarelleRecordState.test.ts` - new reopen-lossless suite (node environment, no DOM/Preact)

## Decisions Made

- **One-byte cost, not two.** The plan's must-have prose said a default hand-painted stroke costs "two bytes more", but its own parenthetical and byte-layout table fix the structural addition at one u8 `vectorFlags` byte (the version field keeps its u16 width, so the version bump is free). The layout table is the authority for on-disk format; the test asserts the exact delta of 1 against the v1 baseline (93 → 94) and documents the arithmetic in a comment.
- **f32 wire precision is part of the fixture.** `1.8` is not binary32-exact, so the fixture stores `Math.fround(1.8)` and the round-trip assertion is exact whole-stroke deep equality, plus `|width − 1.8| < 1e-6` for the human-authored value. All other fixture coordinates are chosen binary32-exact.
- **Absent means absent.** The decoder never materialises `renderMode: 'watercolor'` when the flag is clear, and the restore never writes a mode key the payload did not carry; this is what keeps `encode(decode(encode(x)))` byte-identical. The absent-means-watercolour law is applied at resolution points (`resolveAquarelleRenderMode`), not on the wire.

## TDD Gate Compliance

| Phase | Task | Evidence |
|---|---|---|
| RED | Task 1 | `.red-evidence/61-05-t1/red-record.json` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: whole-stroke deep equality; observed `expected { …(11) } to deeply equal { …(11) }` with `anchors` missing from the decoded engine. 8 planned arms failed on assertions; 18 pre-existing tests still passed. |
| GREEN | Task 1 | `413061a08` — 26/26 green. |
| RED | Task 2 | `.red-evidence/61-05-t2/red-record.json` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `seeds the anchor path, the sparse width factor and the render mode`; observed `expected undefined to deeply equal [ … ]` because the restore never listed the fields. 2 failed | 2 passed; the two absent-key arms passed vacuously and became real pins at GREEN. |
| GREEN | Task 2 | `d424be1da` — 4/4 green plus 39 existing record-state tests green. |

Semantic assessment (recorded verbatim in both evidence records): the named target executed in the run and failed on the planned assertion inside the test body, never on a load, import, collection or fixture fault.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan byte-delta arithmetic corrected to the specified layout**
- **Found during:** Task 1 (AQTL v2 vector payload)
- **Issue:** The must-have/behavior/acceptance prose said a default hand-painted stroke costs "two bytes more", but its own parenthetical ("the version byte is the same width; the vector-flags byte is the only addition") and its artifacts table specify exactly one u8 `vectorFlags` byte.
- **Fix:** Implemented the specified layout and asserted the exact delta of 1 (v1 93 → v2 94 bytes), with the reconciliation documented in the test comment.
- **Files modified:** `scriptTimelineCodec.test.ts`
- **Verification:** Byte-length pin green; full app suite green.
- **Committed in:** `004d01e79` (RED) / `413061a08` (GREEN)

**2. [Rule 3 - Blocking] Rebuilt the `@efxlab/efx-watercolor` dist so tests resolve the 61-03 vector exports**
- **Found during:** Task 1 verify
- **Issue:** App vitest resolves `@efxlab/efx-watercolor/payload` through the package `exports` map to `dist/payload.mjs`, which predated 61-03; the value import `resolveAquarelleRenderMode` was undefined at runtime even though the source existed.
- **Fix:** `pnpm --filter @efxlab/efx-watercolor build`. `packages/*/dist/` is gitignored, so this is an environment refresh with no repository change.
- **Files modified:** none tracked (gitignored build output)
- **Verification:** Test suite went from 1 failed to 26/26 green.
- **Committed in:** n/a (build artifact)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Neither changes scope. The byte-delta correction prevents permanently wasted disk space per stroke; the dist rebuild was a stale-environment prerequisite, not a code change.

## Issues Encountered

- The plan's byte-delta contradiction was resolved in favor of its own layout table (see deviation 1).
- `Math.fround` was needed for exact deep-equality assertions over f32 scalars (see Decisions).

## Known Stubs

None — no stub, skipped test, TODO or unrun verify was left behind. The plan's third verify command (`git diff --stat packages/efx-watercolor/src/determinismContract.test.ts`) shows no change; 61-07 owns that file in this wave.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The persistence chain now reaches from payload anchors through AQTL v2 bytes and back into the runtime record state; 61-07 can parameterise its replay arm by render mode against a stable codec.
- `packages/efx-watercolor/dist` must be rebuilt after source changes to the payload package before running app tests that import runtime values from it (gitignored artifact).
- No blockers for the remaining wave plans.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — 29/29 green.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.test.ts` — 4/4 green.
- `git diff --stat packages/efx-watercolor/src/determinismContract.test.ts` — empty.
- `pnpm --filter efx-motion-editor exec vitest run` — full app suite green: 412 passed | 2 skipped files; 8479 passed | 1 skipped | 96 todo.
- `grep -n "SCRIPT_TIMELINE_BINARY_VERSION" .../scriptTimelineCodec.ts` — initialiser at 2 (line 90), writer at 692, guard at 966 comparing against the constant; no literal 1.

## Self-Check: PASSED

- All 4 planned files exist.
- All 5 plan commits are ancestors of HEAD (`004d01e79`, `413061a08`, `e606b4cba`, `d424be1da`, `19c75c3cf`).
- Measured from the persisted ledger base `9df1dd29f`: `commits: 5`, `plan_head_after: 19c75c3cf9f5763080e677414e774273fc8f5b65`.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*
