---
phase: 64-medium-engine
plan: 26
subsystem: [watercolor-engine, last-touch, time-base]
tags: [ping-pong, carry, webgl2, float32, ages, time-base, tdd, cr-03, wr-03, in-04, dead-uniform]

requires:
  - phase: 64-medium-engine (64-24)
    provides: the last-touch pair, its exact-float R32F format, the one-week sentinel, the touch stamp and the sheet-cache seam this plan repairs
provides:
  - the last-touch ping-pong is a real memory — each dab carries the previous dab's rect read-to-write before its scissored stamp, and the carry is invalidated at every whole-target write
  - two pure CPU modules proving the carry induction and the stamps/ages conversions, with the f32 precision bound recorded (2^-7 s ≈ 7.8 ms at a 24-hour session)
  - an AGES whole-document boundary — captureWhole converts, uploadWhole re-stamps into a NEW array, and captureSheet/restoreSheet are pass-through
  - a monotonic live time base — clearLastTouch never re-anchors timeBaseMs; only setClock starts a new base
  - the dead uAmount uniform retired from bristleTouchFS, its upload and its argument, with the supersession recorded
affects: [phase-64 verification, any future last-touch or ping-pong work, the bristle pickup inputs]

actuals:
  tokens: 11782
  tasks: 3
  commits: 6
plan_head_before: bb06ac61a3ba6b47417c8530e5eb0855e1ad4294
plan_head_after: 35e00e999dbf1fccb5d5aac4c5ba9d43da670277

tech-stack:
  added: []
  patterns:
    - "A ping-pong pair is only a memory if each stamp carries the previous one: after a stamp-and-swap the halves differ only inside the just-stamped rect, so ONE rect-sized blit per dab restores the invariant where a document-sized copy would violate the delivery law"
    - "A capture record that crosses a clock boundary stores AGES: converted once at the whole-document boundary, re-stamped on upload into a NEW array — never mutated, never converted twice"
    - "The live time base is per-engine state, not per-sheet: sheet wipes and target reallocation never re-anchor it; only a different clock does"

key-files:
  created:
    - packages/efx-watercolor/src/playground/lastTouchCarry.ts
    - packages/efx-watercolor/src/playground/lastTouchCarry.test.ts
    - packages/efx-watercolor/src/playground/lastTouchClock.ts
    - packages/efx-watercolor/src/playground/lastTouchClock.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/lastTouch.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/liveSeed.test.ts

key-decisions:
  - "The carry is one rect-sized blit per dab: the stamp just wrote the write half's scissored rect, so carrying that same rect read-to-write makes the halves equal everywhere else again; a document-sized blit would re-open D-29's delivery-law budget"
  - "WholeDoc.layers.lastTouch now means AGES: captureWhole converts with stampsToAges against nowSec, uploadWhole re-stamps with agesToStamps into a NEW array, and captureSheet/restoreSheet are pass-through so the law lives at exactly one boundary"
  - "timeBaseMs is per-engine and monotonic: clearLastTouch writes the sentinel but never re-anchors, so resizeDocument's raw-stamp copy keeps its meaning; only setClock, which installs a different clock, starts a new base"
  - "The dead uAmount uniform was deleted rather than wired: the 261119-pod measurement made the bare coverage channel the weight, superseding 64-24 truth 3's 'bounded by the dab amount' clause — recorded in the shader comment and the suite header, never left silent"

requirements-completed: [MED-05, MED-23, MED-38]

coverage:
  - id: D1
    description: "The last-touch ping-pong is a memory again: every dab blits the previous dab's rect from the read half into the write half before its scissored stamp, swaps, then records its own rect; clearLastTouch, uploadWhole and the resize target copy invalidate the pending carry."
    requirement: MED-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/lastTouchCarry.test.ts#carries the previous dab rect so two non-overlapping dabs both survive"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/lastTouch.test.ts#invalidates the carry at every whole-target write"
        status: pass
    human_judgment: false
  - id: D2
    description: "A whole-document record carries last-touch as AGES: captureWhole converts stamps to ages, uploadWhole re-stamps them on the receiving clock into a NEW array and never mutates the record, and captureSheet/restoreSheet hold no conversion of their own."
    requirement: MED-23
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/lastTouchClock.test.ts#returns a NEW array and leaves the record byte-identical"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/liveSeed.test.ts#carries last-touch as AGES at the whole-document boundary only"
        status: pass
    human_judgment: false
  - id: D3
    description: "The live time base is monotonic across sheet wipes, clears and target reallocation; only setClock starts a new base, and the f32 precision bound (≈7.8 ms at a 24-hour session) is recorded rather than assumed."
    requirement: MED-38
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/lastTouch.test.ts#keeps the live time base monotonic across sheet wipes; only setClock re-anchors"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/lastTouchClock.test.ts#round-trips the sentinel inside the recorded f32 bound at 24 hours"
        status: pass
    human_judgment: false
  - id: D4
    description: "The touch path hides no dead interface: bristleTouchFS declares no uAmount, the engine uploads none, bristleTouch takes no amount argument, and the 261119-pod comment records the removal and the bare coverage channel as the weight."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#declares ONE gather-free bristleTouchFS: the cover-weighted mix toward uNow"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#stamps the touch into the write half, then swaps — after the deposit"
        status: pass
    human_judgment: false

metrics:
  duration: ~6min
  completed: 2026-11-22
status: complete
---

# Phase 64 Plan 26: The last-touch memory, its time base and the dead uniform

**The last-touch ping-pong is a real memory again — every bristle dab carries the previous dab's rect read-to-write before stamping, the whole-document record travels as clock-free ages, the live base never re-anchors under a sheet wipe, and the touch path no longer declares the dead `uAmount` uniform**

## Performance

- **Duration:** ~6 min (17:07 → 17:12 local; the plan's commits)
- **Started:** 2026-11-22T16:07:26Z
- **Completed:** 2026-11-22T16:12:49Z
- **Tasks:** 3 (all TDD: 3 RED + 3 GREEN commits)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `lastTouchCarry.ts` proves the CR-03 induction on the CPU and a simulated ping-pong: without the carry the second dab erases the first dab's stamps (the shipped defect reproduced); with it, two, three and overlapping dabs all preserve every texel they did not paint.
- `bristleTouch` now takes the pending rect, blits read-to-write over exactly that rect before the scissored stamp, swaps, then records its own rect; `clearLastTouch`, `uploadWhole` and `resizeDocument`'s target copy invalidate it because each leaves both halves identical. The false docstring ("Texels outside the dab rect keep their age untouched") is gone and the carry law stands in its place.
- `lastTouchClock.ts` converts both ways without reading a clock: `stampsToAges` (in place, clamped at 0, sentinel → ancient age) and `agesToStamps` (a NEW array; the cached record is never mutated). The 24-hour f32 precision bound is recorded in the module header.
- `WholeDoc.layers.lastTouch` now means AGES end to end: `captureWhole` wraps the exact readback in `stampsToAges(..., this.nowSec())`, `uploadWhole` re-stamps with `agesToStamps(lt, this.nowSec())` and uploads the stamps to both halves, and `captureSheet`/`restoreSheet` are reduced to pass-through — one boundary, one law.
- `clearLastTouch` writes the sentinel but no longer re-anchors `timeBaseMs`; the resize copy's raw stamps keep their meaning, and only `setClock` starts a new base.
- IN-04 retired: `bristleTouchFS` declares no `uAmount`, the engine uploads none, `bristleTouch` takes no amount, and the 261119-pod comment records why (the bare coverage channel is the weight).

## Task Commits

Each task was committed atomically (TDD pairs):

1. **Task 1: The carry law and the clock law, proven on CPU** — `9e2129d8b` (test) → `332965ef7` (feat)
2. **Task 2: The carry at the engine, the corrected law, and the dead uniform** — `f61a1bc07` (test) → `00cb177fa` (feat)
3. **Task 3: The whole-document boundary speaks ages, and the live base stops re-anchoring** — `80b7a846d` (test) → `35e00e999` (feat)

**Plan metadata:** committed separately after this SUMMARY (docs: complete plan).

## Files Created/Modified

- `packages/efx-watercolor/src/playground/lastTouchCarry.ts` — the pending-rect carry state machine (`newLastTouchCarry`, `takeCarry`, `recordStamp`, `invalidateCarry`) with the CR-03 induction in its header, WebGL-free.
- `packages/efx-watercolor/src/playground/lastTouchCarry.test.ts` — CPU ping-pong simulation: the shipped rollback reproduced, then two/three/overlapping dabs preserved; the state machine's take-once, empty-rect and invalidate laws.
- `packages/efx-watercolor/src/playground/lastTouchClock.ts` — `stampsToAges` (in place) and `agesToStamps` (new array), with the seconds-vs-ages law and the 24-hour f32 precision record.
- `packages/efx-watercolor/src/playground/lastTouchClock.test.ts` — conversion laws, byte-identical input, sentinel round-trip inside 0.1 s at 24 hours, and the no-clock-of-its-own source pins.
- `packages/efx-watercolor/src/playground/Engine.ts` — the carry import/field/blit/record, three invalidations, the corrected touch docstring, the AGES boundary in `captureWhole`/`uploadWhole`, pass-through sheet seam, monotonic base; the `WholeDoc` doc block says AGES.
- `packages/efx-watercolor/src/playground/shaders.ts` — `uAmount` removed from `bristleTouchFS`; the 261119-pod comment records the removal as dead (IN-04).
- `packages/efx-watercolor/src/playground/lastTouch.test.ts` — amended 6/8/7/8 to the AGES literals, the record-immutability pin, the time-base pin, the carry/import/invalidation/docstring suite, and the truth-3 supersession in the header.
- `packages/efx-watercolor/src/playground/scattering.test.ts` — `uAmount` absence pins (fragment + engine touch body), the carry blit literal, the new call-site literal and its ordering pins.
- `packages/efx-watercolor/src/playground/liveSeed.test.ts` — the sheet-cache boundary law: conversion in `captureWhole`/`uploadWhole`, none in `captureSheet`/`restoreSheet`, restore ordering against `this.uploadWhole(whole)`.

## Decisions Made

- The carry copies the PREVIOUS dab's rect only: after stamp-and-swap the halves differ exactly inside that rect, so one rect-sized blit per dab restores the invariant without a document-sized copy (D-29's delivery law).
- The AGES law lives at exactly one boundary (`captureWhole`/`uploadWhole`); `captureSheet`/`restoreSheet` were deliberately reduced to pass-through rather than kept as a second conversion site.
- `uploadWhole` allocates a fresh stamps array from the record's ages rather than converting in place: the app restores the same cached sheet repeatedly and an in-place conversion would age it on every restore.
- The uniform was deleted, not wired: the measurement (261119-pod) already made the bare coverage channel the weight, so the declaration was a false affordance; the supersession of 64-24 truth 3 is recorded in both the shader comment and the suite header.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] API-skeleton modules committed alongside Task 1's RED tests**
- **Found during:** Task 1 (RED)
- **Issue:** The plan instructed writing the tests "before the modules exist" and recording the module-not-found run as RED evidence, but the TDD gate classifies a load failure as `fixture_or_load_failure` — an invalid RED (`/gsd-core/references/tdd.md`'s fail-fast rules). A module-not-found run can never authorize GREEN.
- **Fix:** Committed no-op API skeletons of `lastTouchCarry.ts` and `lastTouchClock.ts` (exported functions, empty bodies, explicitly labeled "RED skeleton") in the RED commit so the tests load and fail on their own planned assertions. The GREEN commit then filled the bodies.
- **Files modified:** packages/efx-watercolor/src/playground/lastTouchCarry.ts, packages/efx-watercolor/src/playground/lastTouchClock.ts
- **Verification:** `gsd_run check tdd-red-evidence .gsd/tdd-evidence/64-26/task1-red.json` returned `RED_EVIDENCE_OK` with the target test failing on its own assertion; 90 co-located tests stayed green in the same run.
- **Committed in:** `9e2129d8b` (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mechanism-only; the plan's tested laws are unchanged. The RED gate's format rules govern over the plan's literal "run before the modules exist" instruction.

## Issues Encountered

- Vitest's TAP reporter reports any multi-line diagnostic as "Malformed TAP", so every assertion that can fail in RED was written message-first (`expect(source.includes(needle), 'missing source text: ...').toBe(true)`) with scalar/boolean actuals; a raw `toContain` would dump whole engine slices into the report. Two RED-evidence attempts were rejected by `gsd_run check tdd-red-evidence` (INVALID_RED, `invalid_record`) before this was applied; the final records for all three tasks are `RED_EVIDENCE_OK`.
- The docstring pin `'the engine carries the previous dab'` is case- and wrap-sensitive: the sentence was re-wrapped mid-sentence so the pinned literal appears contiguously and in lowercase.

## Threat Flags

None — the changes stay inside the plan's threat register (T-64-88..91); no new network, auth, file-access or schema surface was introduced.

## Known Stubs

None — the removed `uAmount` was the only declared-but-unread interface on this path, and it is deleted rather than stubbed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The last-touch field now accumulates instead of rolling back, so the bristle pickup inputs legitimately move: the 12 red probe gates and their baselines are expected to drift and are explicitly out of scope (the artist's G-01 ruling), owned by a later re-authoring.
- The AGES boundary is unpersisted engine state (last-touch remains engine-internal); no project format changed.
- `resizeDocument` stays correct as written under the monotonic base, with no app wiring added.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-22*

## Self-Check: PASSED

- All 4 created files exist on disk.
- All 6 task commits (9e2129d8b, 332965ef7, f61a1bc07, 00cb177fa, 80b7a846d, 35e00e999) are ancestors of HEAD.
- `actuals.commits` = 6, measured with `git rev-list --count bb06ac61a..HEAD` at SUMMARY time; `plan_head_before`/`plan_head_after` recorded from the commit ledger.
