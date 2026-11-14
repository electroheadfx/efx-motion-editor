---
phase: 59-rail-motion-channels-v7-interface
plan: 09
subsystem: rendering
tags: [preact, vitest, compositor, rail-motion, sub-frame, export, rel-04, motn-08]

# Dependency graph
requires:
  - phase: 59-08
    provides: "Compositor rail transforms, the shared drawEfxPaintTrack site and the motion key term"
  - phase: 59-05
    provides: "evaluateRailMotion + resolveRailLocalFrame — the single interpolation authority"
provides:
  - "Fractional-frame acceptance in _resolveFlattenedFrame with an explicit content-frame / transform-frame split"
  - "Fractional flattened deliveries bypass the flattened memo (never read, never written)"
  - "Shared integer per-track raster memo: one content raster per frame per track, many transforms"
  - "Test-only diagnostic seam getLastAppliedTrackTransforms(layerId) for transform-frame parity"
affects: [59-10, 59-11, export, preview]

# Actuals (#2632) — pairs with the plan's estimate (55,000 tokens / 2 tasks, low confidence).
# Same estimateTokens scale: chars/4 over the realized app/src diff (35,138 chars => 8,784).
actuals:
  tokens: 8784
  tasks: 2
  commits: 4
  plan_head_before: 44846d52eb8813f1dd70d3aef032806cfc0d65fe
  plan_head_after: d221a5c65ca2f7239a994fbcbb4f2a7c9cd28ac3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integer content frame vs unfloored transform frame: content lookups, content key terms and the composite floor once; the rail transform samples the exact sub-frame"
    - "Per-sub-frame composites are deliberately uncached at the flattened level while the per-track raster memo stays integer-keyed"
    - "Diagnostic read-only seam populated after the memo read so a cache hit leaves the previous build's map in place"

key-files:
  created:
    - app/src/lib/railMotionExportParity.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts

key-decisions:
  - "record.frame / renderedFrame carry contentFrame: a sub-frame delivery is the same content identity under a different draw-time affine"
  - "The rail view resolves at contentFrame (integer half-open spans, bounded view memo) while the evaluator samples the unfloored frame"
  - "The diagnostic seam is set after the flattened memo read and cleared with the layer teardown and store reset"

patterns-established:
  - "REL-04 sub-frame law at the store boundary: content floors, transform does not, flattened cache bypassed"
  - "Parity asserted against evaluateRailMotion's own output, never a hand-written expected number"

requirements-completed: [MOTN-08, REL-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "getFlattenedFrame accepts fractional frames and composes content at the integer frame; every motion-blur sub-frame of one export frame reuses one content raster"
    requirement: REL-04
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionExportParity.test.ts#rail motion export sub-frame parity (59-09 REL-04 / MOTN-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rail transform is evaluated at the unfloored frame and equals the 59-05 evaluator's own output at f + 0.5; one affine per draw over the shared content raster"
    requirement: MOTN-08
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionExportParity.test.ts#transform-frame parity (59-09 MOTN-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A motion-blur export in the running app draws paint at the sub-frame's transform on every sampled sub-frame"
    requirement: MOTN-08
    verification: []
    human_judgment: true
    rationale: "Automated pins prove the store law and the evaluator parity; the visible export result across a real animated sequence remains a user-facing UAT judgment."

# Metrics
duration: 14min
started: 2026-11-06T16:09:26Z
completed: 2026-11-06T16:23:30Z
status: complete
---

# Phase 59 Plan 09: Export Sub-Frame Parity Summary

**Fractional export frames now deliver paint on every sub-frame: content is composed once at the integer frame and the rail transform is sampled at the unfloored sub-frame, with fractional deliveries never entering the flattened memo**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-06T16:09:26Z (after the 59-11 completion commit)
- **Completed:** 2026-11-06T16:23:30Z
- **Tasks:** 2
- **Files modified:** 7 tracked (3 source/test + 4 RED evidence artifacts)

## Accomplishments

- `getFlattenedFrame(layerId, 5.375)` returns a full composite: the finiteness guard replaced the integer guard, and every content seam (track revisions, per-track raster memo key, background clip resolution, flattened cache-key `frame:` term, composite frame) is driven with `Math.floor(frame)`.
- The rail transform is evaluated at the unfloored frame while the rail view resolves at the integer frame — the two-frame split is named explicitly (`frame` vs `contentFrame`) and documented as the REL-04 law at the code site, including the D-18 no-velocity-blur statement.
- Fractional deliveries are never read from or written into the flattened memo (T-59-27); the per-track raster memo keeps its integer key so each sub-frame reuses one content raster (T-59-26).
- A test-only diagnostic seam (`getLastAppliedTrackTransforms(layerId)`) records the transforms the most recent build actually applied, letting the parity test assert agreement with `evaluateRailMotion` rather than re-deriving expectations.
- New suite `railMotionExportParity.test.ts` (12 tests) pins sub-frame paint presence, content identity, unfloored transform sampling, integer missing-frame reporting, memo isolation, evaluator parity, single-affine application, the absent-motion path, and seam clearing.

## Task Commits

Each task was committed atomically (TDD red → green):

1. **Task 1 RED: add failing sub-frame export parity pins** - `3ff8dfc84` (test)
2. **Task 1 GREEN: resolve content at the integer frame and the transform at the sub-frame** - `fb09246e1` (feat)
3. **Task 2 RED: pin transform-frame parity at fractional times** - `ef3f2934e` (test)
4. **Task 2 GREEN: expose the applied rail transforms for transform-frame parity** - `d221a5c65` (feat)

**Plan metadata:** `docs(59-09): complete …` (docs: complete plan)

_Note: TDD tasks carry separate RED and GREEN commits; the validated RED evidence records are committed alongside each RED commit._

## Files Created/Modified

- `app/src/lib/railMotionExportParity.test.ts` - new 12-test suite driving the REAL store composite path through the export sub-frame formula `base + i / subFrames`; recording canvas ops expose the applied affine and the drawn content raster.
- `app/src/stores/physicPaintStore.ts` - fractional-frame acceptance, content/transform frame split, fractional memo bypass, integer-keyed per-track raster memo, test-only transform seam with lifecycle clearing.
- `app/src/stores/physicPaintStore.test.ts` - re-pinned the legacy integer-guard test: fractional frames now deliver the integer content frame's composite (REL-04).
- `.planning/.../red-evidence-59-09-task1.json` + `red-evidence/red-59-09-task1.xml` - validated RED evidence for Task 1 (7 tests, 6 failing, RED_EVIDENCE_OK).
- `.planning/.../red-evidence-59-09-task2.json` + `red-evidence/red-59-09-task2.xml` - validated RED evidence for Task 2 (12 tests, 3 seam assertions failing, RED_EVIDENCE_OK).

## Decisions Made

- **Record metadata stays content-identical.** `frame` and `renderedFrame` carry `contentFrame`, so a fractional delivery's metadata equals the integer delivery's; only the baked affine differs. This keeps every metadata consumer (export naming, transport readers) on integer frames.
- **Rail view at the integer frame, evaluator at the exact frame.** View spans are integer half-open, so the lookup is identical for a sub-frame and its floor while the view memo stays integer-only and bounded.
- **Seam after the memo read.** Placing it before the memo read made every cache hit rebuild the map (different object identity for equal transforms); after the read, a hit builds nothing and leaves the previous map, matching the documented "most recent build" contract.
- **Existing pin corrected, not worked around.** `physicPaintStore.test.ts` asserted `getFlattenedFrame(LAYER, 1.5) === null`; that contradicted the plan's must-have, so the assertion now pins the new law (`frame === 1`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-pinned the legacy fractional-frame rejection test**
- **Found during:** Task 1 (fractional frame end-to-end)
- **Issue:** `app/src/stores/physicPaintStore.test.ts` line ~1935 asserted that a fractional frame returns null — the exact behavior the plan removes. Leaving it would have made the suite red for the wrong reason (a stale pin, not a regression).
- **Fix:** Renamed the guard test and asserted the new law (`getFlattenedFrame(FLAT_LAYER, 1.5)?.frame === 1`), keeping the negative/non-finite rejections.
- **Files modified:** app/src/stores/physicPaintStore.test.ts
- **Verification:** Full store suite passes (131 tests).
- **Committed in:** `fb09246e1` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** The fix is required for the new must-have and does not change any other behavior; the plan's `files_modified` list simply did not include the store's own test file.

## Issues Encountered

- The RED test fixture initially failed at rail-motion installation: the parser requires `position-x` and `position-y` to be both present with identical frame sets. Fixed in the fixture by pairing the axes with matching frames (pre-commit, no production change).
- Content lookups rejected sub-frames independently: `getRotoPhysicalRenderSource` also guards integers, confirming that `contentFrame` (not `frame`) must be threaded into `_preResolveTrackContent` and `compositeFrame`; otherwise the track resolved as missing and paint vanished on every sub-frame.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Store law is proven: 12 parity tests, 7 compositor rail-motion tests, 131 store tests, 4 hold-composite tests and 14 structural-cache tests pass; `tsc --noEmit` is clean.
- Acceptance checks: `grep -c "Number.isInteger(frame) || frame < 0) return null"` = 0 and exactly one `Math.floor(frame` (the content floor) remain true.
- The visible export result across a real animated sequence is left to user UAT (coverage row D3).

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED
