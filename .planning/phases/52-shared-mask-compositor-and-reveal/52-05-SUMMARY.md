---
phase: 52-shared-mask-compositor-and-reveal
plan: 05
subsystem: testing
tags: [reveal, leak-contract, token-allow-list, rvl-05, bake-time-guarantee, source-scan]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    provides: the D-06 token allow-list contract over the four raster surfaces (mirrored here)
  - phase: 52-shared-mask-compositor-and-reveal (52-01)
    provides: the reveal bake path (renderRotoRevealFrames, commitRevealBake, createRevealRail family) whose reference read must not leak into a raster surface
  - phase: 52-shared-mask-compositor-and-reveal (52-02)
    provides: the mode-free PhotoReferenceTrack schema (D-15) the bake-time guarantee rests on
provides:
  - The RVL-05 leak contract test: a token allow-list scan over the four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer) asserting no reference-input token appears in any of them, extended to the reveal bake path
affects: [verify-work, 52-06, 53-integrated-v1.0.0-acceptance]

# Actuals (#2632) — pairs with the plan's `estimate` (8000 tokens).
actuals:
  tokens: 915       # chars/4 over the realized diff (3662 chars, the new test file)
  tasks: 1          # tasks completed
  commits: 1        # commits made (test commit)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token allow-list leak contract: a grep-based scan over the four raster surfaces' source asserting forbidden reference/reveal tokens are absent — the RVL-05 bake-time guarantee enforced by construction"

key-files:
  created:
    - app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts

key-decisions:
  - "The leak contract mirrors the Phase 50 D-06 contract exactly (same four raster surfaces, same toContain token-absence style) and extends it with the reveal bake path tokens — the bake's reference read cannot leak a token into any raster surface."
  - "The token list lives in the test file itself (per the plan's 'do not name the exact forbidden tokens in prose' instruction); the plan prose names only the surfaces and the guarantee."

patterns-established:
  - "Pattern 1: Leak contract by token allow-list — the four raster surfaces are scanned for reference-input and reveal-bake tokens; absence is asserted structurally, so a future reference read threaded into a raster surface fails the contract."

requirements-completed: [RVL-05]

coverage:
  - id: D1
    description: "The four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer) contain no reference-input token (RVL-05, D-15 bake-time guarantee)"
    requirement: RVL-05
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts#keeps the Phase 50 reference-input tokens out of the four raster surfaces"
        status: pass
    human_judgment: false
  - id: D2
    description: "The reveal bake path introduces no reference-input token into any of the four raster surfaces (RVL-05 extension)"
    requirement: RVL-05
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts#keeps the reveal bake path tokens out of the four raster surfaces"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-02
status: complete
---

# Phase 52 Plan 5: Reveal Leak Contract Summary

**The RVL-05 leak contract as a token allow-list scan over the four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer) asserting no reference-input token appears in any of them, extended to the reveal bake path so the bake's reference read cannot leak a reference-input token into any raster surface**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-02T16:05:00Z
- **Completed:** 2026-09-02T16:17:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Authored `efxPaintRevealLeakContract.test.ts` — a token allow-list (grep-based) scan over the four raster surfaces' source, mirroring the Phase 50 D-06 contract (same four surfaces, same `readFileSync` + `toContain` absence style).
- The scan asserts the 13 Phase 50 reference-input tokens (`photoReference`, `drawReferenceGhost`, `getReferenceSourceFrameVerdict`, `registerReferenceSourceImage`, the `setPhotoReference*` setters, the ghost/transform/section components, `getReferenceBounds`) are absent from all four surfaces.
- The scan is extended to the reveal bake path: `renderRotoRevealFrames`, `compositeRevealMask`, `loadRevealReferenceImage`, `commitRevealBake`, `_resolveReferenceSourceImage`, `createRevealRail`, `replayRevealRail`, `deleteRevealRail`, `resizeRevealRail`, and `railKind` must not appear in any raster surface — the bake writes ordinary track keys, never a raster-surface reference read (Pitfall 2 / Pitfall 14 closed by construction).
- The contract is green against the Plan 01/02 implementation, and the full suite is green (3366 passed, 1 skipped, 101 todo).
- The test was mutation-checked: injecting `renderRotoRevealFrames` into the compositor source makes the scan fail, proving the contract has teeth (it would catch a leak, not a vacuous pass).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reveal leak contract — token allow-list over the four raster surfaces (RVL-05)** - `b05ad997` (test)

**Plan metadata:** pending final docs commit

_Note: The task is `tdd="true"` but the plan's deliverable IS the contract test itself — there is no separate implementation to write. The RED phase was vacuous: the leak-free implementation already exists from Plans 01/02, so the test passed on first run (the plan's action explicitly says "confirm GREEN against the Plan 01/02 implementation"). The mutation check proves the test would fail if a token leaked._

## Files Created/Modified

- `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` - NEW: 2 tests — (1) the 13 Phase 50 reference-input tokens absent from the four raster surfaces (D-06 mirror), (2) the 10 reveal bake path tokens absent from the four raster surfaces (RVL-05 extension). Reads the four surfaces via `readFileSync` + `fileURLToPath`, joins them, and asserts each forbidden token is absent.

## Decisions Made

- The leak contract mirrors the Phase 50 D-06 contract exactly (same four raster surfaces, same token-absence style) and extends it with the reveal bake path tokens — one contract file, one guarantee.
- The token list lives in the test file itself, per the plan's "do not name the exact forbidden tokens in prose" instruction; the plan prose names only the surfaces and the guarantee.
- The reveal bake path tokens are the bake's reference-read symbols (`_resolveReferenceSourceImage`, `renderRotoRevealFrames`, `compositeRevealMask`, `loadRevealReferenceImage`, `commitRevealBake`) plus the rail mutations (`createRevealRail`/`replayRevealRail`/`deleteRevealRail`/`resizeRevealRail`) and the `railKind` discriminator — none may appear in a raster surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan verify command path] The plan's verify command path is wrong relative to the vitest root**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` command `pnpm --filter efx-motion-editor exec vitest run app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` fails with "No test files found" — the vitest root is `app/` (include `src/**/*.test.ts`) and the filter must be relative to it. Same finding as 52-02.
- **Fix:** Used the correct equivalent `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` (2 tests pass).
- **Verification:** Reveal leak contract test green; full suite green.
- **Committed in:** n/a (command-only deviation)

---

**Total deviations:** 1 (command-path deviation)
**Impact on plan:** The command-path deviation is a plan-authoring artifact, not a code issue. No scope creep.

## TDD Gate Compliance

- **Task 1 is `tdd="true"`.** The plan's deliverable IS the contract test — there is no separate implementation to write, so the strict RED/GREEN commit sequence does not apply. The RED phase was vacuous: the leak-free implementation already exists from Plans 01/02, and the plan's action explicitly says "confirm GREEN against the Plan 01/02 implementation." The test passed on first run (2 tests).
- **Mutation check (fail-fast rule):** To verify the test is not vacuous, a reveal-bake token (`renderRotoRevealFrames`) was temporarily injected into the compositor source; the scan failed (1 failed | 1 passed), then the injection was reverted. The contract has teeth.
- **Git log gate:** the plan's git log contains a single `test(52-05)` commit (b05ad997) that carries the contract test. There is no separate `feat(...)` commit because the implementation already exists from Plans 01/02 — this is a documented deviation from the strict RED/GREEN sequence, not a missing gate.

## Issues Encountered

- The plan's verify command path (`app/src/...`) is wrong relative to the vitest root (`app/`); the correct equivalent (`src/...`) passes. Documented as a deviation (same finding as 52-02).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The RVL-05 leak contract is green: the four raster surfaces carry no reference-input token, and the reveal bake path introduces none — the bake-time guarantee (D-15) is enforced by construction, closing Pitfall 2 (reference leak) and Pitfall 14 (reference leak into output).
- Ready for the remaining Phase 52 horizontal expansion (52-03/52-04 rail surface + "Reveal with script…" modal) and the wave-end full-suite gate.
- The contract will catch any future reference read threaded into a raster surface — a standing guard for Phase 53 (Integrated v1.0.0 Acceptance).

## Self-Check: PASSED

- FOUND: `.planning/phases/52-shared-mask-compositor-and-reveal/52-05-SUMMARY.md`
- FOUND: `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts`
- FOUND: commit `b05ad997`

---
*Phase: 52-shared-mask-compositor-and-reveal*
*Completed: 2026-09-02*
