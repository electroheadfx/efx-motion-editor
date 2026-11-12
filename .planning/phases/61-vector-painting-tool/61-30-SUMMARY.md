---
phase: 61-vector-painting-tool
plan: 30
subsystem: payload
tags: [vector-path, curve-mode, spline, aqtl-v2, mce-contract, tdd, gap-closure, g20]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-03's persisted vector-path vocabulary (`AquarelleRenderMode`, `normaliseAquarelleAnchors`, `projectVectorPath`) and its conditional `recorded…Field` projection pattern"
  - phase: 61-vector-painting-tool
    provides: "61-05/61-06's AQTL v2 vector block (flag byte, anchors, render-mode code byte) and the dual-language `MceAquarelleVectorPath` declaration pin"
  - phase: 61-vector-painting-tool
    provides: "61-02's spine evaluator (`handlesFor` derives handles for any kind that is not `bezier`, `sampleVectorPath`)"
  - phase: 61-vector-painting-tool
    provides: "61-12's `updateAquarelleRenderModeInScript` batch-door template and 61-29's re-sampling path write"
provides:
  - "`AquarelleCurveMode`, `AQUARELLE_CURVE_MODES`, `DEFAULT_AQUARELLE_CURVE_MODE`, `isAquarelleCurveMode`, `resolveAquarelleCurveMode`, `recordedCurveModeField`, `resolveCurveAnchors`, `evaluateAquarellePath`"
  - "`curveMode` on `AquarelleStroke` and `AquarelleStrokePayload`, projected into the engine block only when present"
  - "AQTL v2 vector flag bit 2 plus a curve-mode code byte, encoded last and refused on an unknown code"
  - "`MceAquarelleVectorPath.curveMode` on both the TypeScript and the Rust side, pinned by `mceFieldContract.test.ts`"
  - "`updateAquarelleCurveModeInScript` (batch door that re-samples points) and the mode-aware re-sample inside `updateAquarellePathInScript`"
  - "Optional `curveMode` on `buildDraftPath` / `projectVectorPath` / `hitTestVectorPath` / `promoteAnchorForDrag` / `insertAnchorOnSegment`, all defaulting to Bézier"
affects: [61-31, 61-32]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 14355
  tasks: 2
  commits: 4

plan_head_before: 046cffe8c035c3db11ed6195275d5b2cbae63089
plan_head_after: 09a51ceb3ade5a11a3fdc6a826a7f02e4dbf060f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An EVALUATION MODE is a read-time view over stored data, never a fourth persisted variant: `resolveCurveAnchors` derives auto tangents for spline and returns the authored list untouched for Bézier, so a mode round trip returns the authored bytes"
    - "Every new persisted discriminator mirrors `renderMode`: closed union, strict guard, absent-means-default resolver, conditional `recorded…Field` projection, AQTL flag bit + code byte, dual-language `.mce` declaration"
    - "A committed mode switch re-derives the derived geometry it owns in the SAME write: re-sample `points` from the new evaluation, reproject the entry at the same index, bump once"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/payload/vectorPath.ts
    - packages/efx-watercolor/src/payload/vectorPath.test.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
    - packages/efx-watercolor/src/payload/codec.ts
    - packages/efx-watercolor/src/payload/codec.test.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
    - app/src/types/project.ts
    - app/src-tauri/src/models/project.rs
    - app/src/lib/mceFieldContract.test.ts
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/view/vectorPathHandles.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts

key-decisions:
  - "Scope (Task 1 checkpoint, answered by the user): per-stroke `curveMode` mirroring the shipped per-stroke `renderMode` in every layer. The document-level variant was rejected; the one-way persistence consequence was accepted for projects that actually use the switch."
  - "Spline is an EVALUATION MODE, not a third anchor kind (D-01 preserved): the auto view is derived on read, authored kinds and handles are never rewritten, and switching back drops the key so untouched documents stay byte-identical (REL-02)."
  - "An unknown curve mode is refused, not defaulted: the payload codec, the AQTL decoder and the batch door all fail closed; only the ABSENCE of the key reads Bézier."
  - "`VectorPathCommit` / `buildVectorStroke` stay untouched: a new path is recorded Bézier and switched afterwards with one press, so no commit seam carries a mode."
  - "`sampleVectorWidths` keeps reading the NORMALISED STORED anchors, never the spline view: the width profile is paint, not evaluation."

requirements-completed: [VEC-01, VEC-02, VEC-06, VEC-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Closed `curveMode` vocabulary with an absent-means-Bézier resolver and a conditional record projection (no `bezier` key is ever stored)"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/vectorPath.test.ts#curve mode"
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/toStudioStroke.test.ts#curve mode engine block"
    human_judgment: false
  - id: D2
    description: "`curveMode` rides the engine payload through the payload codec, which refuses an unknown mode and keeps an absent key absent"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/codec.test.ts#wire validation of the vector fields"
    human_judgment: false
  - id: D3
    description: "AQTL v2 vector block carries the mode in flag bit 2 plus a trailing code byte; a mode-free body costs zero extra bytes and an unmapped code is refused"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts#AQTL v2 curve mode"
    human_judgment: false
  - id: D4
    description: "`.mce` declaration surface names `curveMode` on both languages while the engine slot stays opaque"
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 61 vector field set"
    human_judgment: false
  - id: D5
    description: "Spline evaluates a frozen derived-auto view; draft, projection, hit test, promotion and insertion honour the mode without rewriting any stored kind or handle"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/vectorPath.test.ts#curve evaluation"
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#61-30 curve mode"
    human_judgment: false
  - id: D6
    description: "The curve-mode batch door re-samples the points from the new evaluation in one write, and an anchor edit on a spline stroke stays spline"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-30 G-20"
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 30: Spline curve mode for vector strokes Summary

**Per-stroke spline evaluation over the same authored anchors, carried through the engine payload, the AQTL v2 wire and both `.mce` declarations, with the switch re-sampling the replay points in the same write.**

## Performance

- **Duration:** 10 min (measured from Task 2's first RED run; the Task 1 checkpoint response preceded it)
- **Started:** 2026-11-11T14:00:47Z
- **Completed:** 2026-11-11T14:10:34Z
- **Tasks:** 2 executed of 3 (Task 1 was the scope checkpoint, answered `per-stroke`, and wrote no code)
- **Files modified:** 15

## Accomplishments

- A stroke can now carry `curveMode: 'spline'`; absent reads Bézier, so every pre-existing document and script body stays byte-identical (REL-02).
- The mode survives every transport: engine payload projection, payload codec validation, AQTL v2 flag bit 2 plus a trailing code byte, and the dual-language `.mce` declaration.
- Spline is a read-time view: `resolveCurveAnchors` derives auto tangents and drops authored handles from the VIEW only, so switching modes never rewrites what the user authored.
- Every edited read path honours the mode: the draft samples the spline, promotion converts nothing, the handle loop is skipped, and an insertion lands on the derived segment.
- `updateAquarelleCurveModeInScript` switches the mode and re-samples `points` in one write at the same timeline index; switching back to Bézier drops the key and restores the authored geometry exactly.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 2 RED: pin per-stroke curve mode across the wire** — `67018fe69` (test)
2. **Task 2 GREEN: carry a per-stroke curve mode through every transport** — `9125e5b39` (feat)
3. **Task 3 RED: pin spline evaluation over the authored path** — `33d4d84d4` (test)
4. **Task 3 GREEN: evaluate spline strokes and re-sample on the mode switch** — `09a51ceb3` (feat)

**Plan metadata:** committed separately by the close-out step (`docs(61-30): complete …`).

## Files Created/Modified

- `packages/efx-watercolor/src/payload/vectorPath.ts` — the `curveMode` vocabulary, `resolveCurveAnchors` and `evaluateAquarellePath`
- `packages/efx-watercolor/src/payload/vectorPath.test.ts` — 8 new pins (vocabulary + evaluation view)
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` — `curveMode` on both interfaces, projected only when present
- `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` — the engine-block projection pins
- `packages/efx-watercolor/src/payload/codec.ts` — fail-closed `curveMode` validation in `isStrokeShape`
- `packages/efx-watercolor/src/payload/codec.test.ts` — round-trip and refusal pins
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` — AQTL flag bit 2 + code byte, encoded last
- `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — round-trip, byte-delta and unmapped-code pins
- `app/src/types/project.ts` — `MceAquarelleVectorPath.curveMode?: string`
- `app/src-tauri/src/models/project.rs` — `curve_mode: Option<String>` with the `curveMode` serde rename
- `app/src/lib/mceFieldContract.test.ts` — the dual-language member-key pin and a spline round trip
- `app/src/components/physic-paint/view/vectorPathHandles.ts` — optional `curveMode` on all five helpers; every sampler routed through `evaluateAquarellePath`
- `app/src/components/physic-paint/view/vectorPathHandles.test.ts` — the four mode-threading pins
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `updateAquarelleCurveModeInScript`; the path write re-samples through the stored mode
- `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` — the two write-door pins

## Decisions Made

- **Scope (Task 1 checkpoint, answered `per-stroke`):** per-stroke `curveMode` mirroring the shipped per-stroke `renderMode` in every layer. Document-level was rejected; the one-way persistence consequence was accepted.
- **Spline is an evaluation mode, not a third anchor kind (D-01 preserved):** the derived-auto view is computed on read and never stored, so authored kinds and handles return byte-identical after a round trip.
- **Absence is the default, never a stored value:** `recordedCurveModeField` writes nothing for `bezier`, and the batch door deletes the key when switching back, so an untouched document keeps today's exact bytes.
- **Unknown modes fail closed:** the payload codec, the AQTL decoder and the batch door refuse rather than default; only an absent key reads Bézier.
- **The commit seam is untouched:** `VectorPathCommit` / `buildVectorStroke` still record Bézier; the UI switch (61-31) applies the mode afterwards.
- **Widths read the stored anchors:** `sampleVectorWidths` receives the normalised stored list, never the spline view, because the width profile is paint rather than evaluation.

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
| ---- | --- | ----- | -------- | ------ |
| Task 2 (tracer, tdd) | `67018fe69` — `RED_EVIDENCE_OK`, target failed on `expected 94 to be 95` | `9125e5b39` | — | Pass |
| Task 3 (auto, tdd) | `33d4d84d4` — `RED_EVIDENCE_OK`, target failed on `expected … not to be …` | `09a51ceb3` | — | Pass |

Both RED runs failed on planned assertions, with no load or fixture failures. Floors held exactly: watercolor 33 / 33, app 51 / 14.

## Deviations from Plan

None — the plan executed exactly as written. Task 1 was the designed scope checkpoint; the user's answer (`per-stroke`) was implemented in Tasks 2 and 3 without re-opening the question.

## Issues Encountered

- **Commit ledger missing:** Task 2 never wrote `.git/gsd-plan-head-before-61-30`. The base was reconstructed from the parent of the first Task 2 commit (`046cffe8c`, the `61-29` completion commit), so `commits: 4` measures the whole plan rather than only Task 3.
- **RED evidence merge:** the first `junit.xml` merge captured each report's outer `<testsuites>` open tag without its close, so the validator rejected it as malformed XML. The merge was rebuilt by stripping the per-report XML declaration and outer wrapper; the record then validated `RED_EVIDENCE_OK` (131 tests, 9 failed, target matched).
- **Stale `dist` during RED:** the app resolves `@efxlab/efx-watercolor/payload` types from `dist/*.d.ts`, so the GREEN type check required `pnpm --filter @efxlab/efx-watercolor build` before `tsc --noEmit` was meaningful. Both type checks are clean.

## Known Stubs

None. The two RED scratch stubs (`resolveCurveAnchors` / `evaluateAquarellePath`, `updateAquarelleCurveModeInScript`) were replaced by the GREEN implementation and a scan for `SCRATCH STUB` in `packages/efx-watercolor/src` and `app/src` returns nothing.

## Threat Flags

None beyond the plan's threat model. The new key rides the existing opaque engine slot, and the AQTL flag bit / code byte were the planned surface (T-61-88, T-61-89, T-61-90).

## User Setup Required

None - no external service configuration required.

## Verification

- Watercolor: `vectorPath.test.ts` 33, `spine.test.ts` 33, `toStudioStroke.test.ts` 20, `codec.test.ts` 35 — 121 passed.
- App: `scriptTimelineCodec.test.ts` 32, `mceFieldContract.test.ts` 17, `vectorPathHandles.test.ts` 51, `aquarelleRecordState.path.test.ts` 14 — 114 passed.
- `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean; `pnpm --filter @efxlab/efx-watercolor check` — clean.
- Native UAT: none in this plan; 61-31 wires the switch and owns the human gate.

## Next Phase Readiness

- The model layer for G-20 is complete: 61-31 can expose the per-stroke switch and call `updateAquarelleCurveModeInScript` plus thread `stroke.curveMode` into the overlay's five helpers.
- No blockers. No dependency was added to any module, and every existing caller keeps its Bézier behaviour with no parameter passed.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- All 15 modified files exist at HEAD.
- All four task commits (`67018fe69`, `9125e5b39`, `33d4d84d4`, `09a51ceb3`) are ancestors of HEAD.
- Both RED records validated `RED_EVIDENCE_OK`; both GREEN suites and the full plan-verification suite set pass at their floors, and both type checks are clean.
