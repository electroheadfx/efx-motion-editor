---
phase: 63-brush-tip-pipeline
plan: 01
subsystem: engine
tags: [typescript, vitest, brush-tips, mask-derivation, rec709, registry]

requires: []
provides:
  - "deriveMask: the pinned two-branch RGBA → 36,864-byte mask law, with bake-only normalizeMaskContrast"
  - "maskRegistry: module-level, exact-length, replace-never-append tip registry with a monotonic generation counter"
  - "buildBrushForStroke mask resolution: a registered mask becomes Brush.tipData at tipSize 192 on the single live/bake path"
affects: [63-brush-tip-pipeline]

actuals:
  tokens: 8925
  tasks: 3
  commits: 3
  plan_head_before: 96ba12fd3e2ada9ed72c8c101c5d482262c81acf
  plan_head_after: fdd423f69c66226085e9d122c1d35432fe9a0ba9

tech-stack:
  added: []
  patterns:
    - "Module-scoped engine registry (Preact-free) with a monotonic generation counter for derived-cache keying"
    - "Fail-closed exact-length admission at every registry entry point, including per-entry refusal inside replace"
    - "Law-in-the-header: the module header states the derivation law; the test file is its executable statement"

key-files:
  created:
    - packages/efx-watercolor/src/brushes/deriveMask.ts
    - packages/efx-watercolor/src/brushes/maskRegistry.ts
    - packages/efx-watercolor/src/brushes/deriveMask.test.ts
    - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
    - packages/efx-watercolor/src/playground/brushBridge.test.ts
  modified:
    - packages/efx-watercolor/src/brushes/index.ts
    - packages/efx-watercolor/src/playground/brushBridge.ts

key-decisions:
  - "deriveMask fails closed on any buffer whose length is not exactly 36,864 before allocating; the alpha branch scans first and never consults RGB"
  - "normalizeMaskContrast is exported but never called from deriveMask (bake-only by law), pinned by a source-level test"
  - "Replace clears the registry first, then installs valid entries individually (D-18), so replace never appends and valid siblings survive an invalid entry"
  - "resolveMask returns the exact registered Uint8Array (identity contract), so live paint and bake share one allocation"
  - "Registry resolution happens before the preset lookup inside buildBrushForStroke; the eight D-08 multipliers apply identically to masked and preset bases (D-21/D-22)"

patterns-established:
  - "Scalar predicate assertions (boolean/primitive toBe) in tests so TAP diagnostics stay one-line and the RED evidence classifier parses"
  - "Every registry mutation bumps one generation counter; reads and rejected writes never do"

requirements-completed: [TIP-03, TIP-05]

coverage:
  - id: D1
    description: "One exported deriveMask turns a 192×192 RGBA buffer into a 36,864-byte mask under the pinned two-branch rule (alpha verbatim when any alpha < 250; otherwise Rec. 709 luminance with mean-128 polarity)"
    requirement: TIP-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/deriveMask.test.ts (24 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bake-only normalizeMaskContrast contrast-stretches a mask, never divides by zero, and is never invoked from the derivation path"
    requirement: TIP-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/deriveMask.test.ts#normalizeMaskContrast — bake-only contrast stretch"
        status: pass
    human_judgment: false
  - id: D3
    description: "Module-level mask registry: exact-length admission, identity resolve, replace-never-append, reset-with-no-ghost, monotonic generation"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts (22 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildBrushForStroke resolves a registered mask before the preset lookup, builds it from CUSTOM_BASE at tipSize 192, and overlays the D-08 multiplier bag unchanged"
    requirement: TIP-05
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/brushBridge.test.ts (11 tests)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts#registry builds"
        status: pass
    human_judgment: false
  - id: D5
    description: "The new modules are exported from the brushes barrel; the package typecheck and build stay green"
    verification:
      - kind: other
        ref: "pnpm --filter @efxlab/efx-watercolor check && pnpm --filter @efxlab/efx-watercolor build"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 01: Brush Tip Derivation and Registry Summary

**Two-branch 192×192 tip-mask derivation, an exact-length mask registry, and mask-aware `buildBrushForStroke` on the single live/bake path**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-15T10:34:44Z
- **Completed:** 2026-11-15T10:40:00Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `deriveMask` implements the pinned two-branch law: any alpha below 250 takes the alpha channel verbatim; otherwise Rec. 709 luminance with polarity from the mean (`mean < 128` → luminance, else `255 − luminance`). Wrong lengths are refused before allocation.
- `normalizeMaskContrast` is exported for the built-in bake but never reachable from the derivation path — the bake-only rule is enforced by a source-level test, not convention.
- `maskRegistry` gives the engine a module-level, Preact-free registry with exact-length admission (T-63-02), replace-never-append (D-20), per-entry refusal on replace (D-18), an identity `resolveMask`, and a monotonic generation counter (G-2).
- `buildBrushForStroke` resolves a registered mask before the preset lookup and builds the brush from `CUSTOM_BASE` with the mask as `tipData`; the eight tool-override multipliers still apply identically, so masked tips are stamps, not a second mapping path.
- Reset leaves no ghost: after `resetMaskRegistry()` the same brush id falls back to the preset path, pinned end-to-end through `buildBrushForStroke`.
- Plan-level verification: 57/57 tests across the three suites, `tsc --noEmit` exit 0, package build green, no dependency changes against the plan base.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mask derivation law, registry, and the bridge mapping (tracer)** — `6b99e5338` (feat)
2. **Task 2: Pin the two-branch derivation law at every boundary** — `e1ab548ce` (test)
3. **Task 3: Pin registry lifecycle — reject, replace, reset, no ghost** — `fdd423f69` (test)

_Note: TDD tasks 2 and 3 landed as test-only commits; see `## TDD Gate Compliance` for why no RED-then-GREEN pair exists._

## Files Created/Modified

- `packages/efx-watercolor/src/brushes/deriveMask.ts` — two-branch derivation law, pinned constants, bake-only `normalizeMaskContrast`
- `packages/efx-watercolor/src/brushes/maskRegistry.ts` — module-level registry, exact-length admission, replace/reset, generation counter
- `packages/efx-watercolor/src/brushes/index.ts` — barrel exports for both new modules
- `packages/efx-watercolor/src/playground/brushBridge.ts` — registry resolution before preset lookup; masked tips built from `CUSTOM_BASE`
- `packages/efx-watercolor/src/brushes/deriveMask.test.ts` — 24 tests pinning every branch boundary, coefficients, totality, and bake-only normalization
- `packages/efx-watercolor/src/brushes/maskRegistry.test.ts` — 22 tests pinning admission, identity, replace/reset, generation, and bridge integration
- `packages/efx-watercolor/src/playground/brushBridge.test.ts` — 11 tests pinning the mask-backed mapping, `CUSTOM_BASE` base values, `tipMean` formula, and overrides

## Decisions Made

- **Per-entry refusal on replace (D-18):** `replaceMaskRegistry` clears first, then installs each valid entry individually; a wrong-length entry is skipped without discarding valid siblings, and the generation still bumps because the registry demonstrably changed.
- **Identity contract:** `resolveMask` returns the exact registered array. Live paint and bake therefore share one allocation, and the tests pin identity rather than deep equality so a future copy-on-read is caught.
- **Bake-only normalization:** `normalizeMaskContrast` is exported but never called from `deriveMask`; the source-level pin makes demoting the rule a deliberate edit.
- **Tracer owns the implementation:** plan task 1 (tracer) deliberately delivered both modules in full, per its own action text; tasks 2 and 3 are their executable specifications.

## Deviations from Plan

### Plan-shape deviation — tasks 2 and 3 are test-only

- **Found during:** Task 2 (deriveMask tests)
- **Issue:** The tracer task (Task 1) implements `deriveMask` and `maskRegistry` in full by design, so the TDD tasks written afterward hit immediate GREEN. A genuine RED was not producible without fabricating a failing test or deliberately breaking working code.
- **Resolution:** Both suites were committed as `test(63-01)` commits with no corresponding `feat` commit. No RED was fabricated. Full detail in `## TDD Gate Compliance`.
- **Files modified:** `packages/efx-watercolor/src/brushes/deriveMask.test.ts`, `packages/efx-watercolor/src/brushes/maskRegistry.test.ts`
- **Verification:** Both suites pass (46 new tests); plan-level total 57/57.

**Total deviations:** 1 plan-shape deviation (test-only TDD tasks); no auto-fixed issues.
**Impact on plan:** None on delivered behavior — every pinned law is covered by tests. The deviation is structural and accepted by precedent (Phase 61-14, Phase 62 CRV-03).

## TDD Gate Compliance

Plan frontmatter carries `type: execute`, so the plan-level RED→GREEN sequence gate does not apply as a hard sequence; the individual tasks nevertheless declared TDD shape, and this section records their actual commit order for the verifier.

- Observed order in this plan's commits: `feat(63-01)` (`6b99e5338`) precedes `test(63-01)` (`e1ab548ce`, `fdd423f69`). The plan-level gate, if applied, would flag this ordering.
- Why: the first task is a `tracer` whose declared action builds the full slice (`deriveMask` + `maskRegistry` + bridge wiring). Tasks 2 and 3 then have nothing left to RED. The behavior-adding predicate is satisfied by the tracer commit, not by the tests.
- Project precedent: Phase 61-14 (`task.is-behavior-adding=false`; no feat commit fabricated) and Phase 62 CRV-03 ("landed GREEN by construction; no RED was fabricated").
- Evidence: all three suites pass in one run — `deriveMask.test.ts` 24/24, `maskRegistry.test.ts` 22/22, `brushBridge.test.ts` 11/11 — and `tsc --noEmit` exits 0.

## Issues Encountered

- `gsd_run query task.resolve-content` returned `{"resolved": false, "reason": "no-resolver"}` (exit 0); execution proceeded from the inline `PLAN.md` content, as the contract allows.
- The TDD-order situation above was resolved through documentation rather than by manufacturing RED, per the TDD reference's fail-fast rule.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The registry and derivation law are ready for the import surface (63-02), package carrier (63-05), and project-open/script carriers.
- `normalizeMaskContrast` is exported and tested but intentionally uncalled until the built-in bake lands (plan 63-03).
- `TIP-02` and `TIP-06` remain open by design: their decode-at-import and import-surface halves live in plans 63-05/63-06, so only `TIP-03` and `TIP-05` are marked complete at plan level.

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All five created files exist on disk.
- Commits `6b99e5338`, `e1ab548ce`, `fdd423f69` are ancestors of HEAD.
