---
status: verifying
trigger: "Diagnose and fix the Phase 43.2 Wave 2 full-suite regression on the current branch. Failing test: app/src/lib/physicPaintBridge.test.ts — physicPaintBridge accepts the first Progressive Play Script and Loop Clip on a fresh layer — assertion near line 1549 expected null but received Invalid physics paint apply payload. Preserve the clean-break policy and correct the fresh-layer producer or fixture boundary so newly generated payloads are canonical."
created: 2026-08-11T05:58:28Z
updated: 2026-08-11T05:58:28Z
audit_acknowledged:
  milestone: v0.9.0
  at: 2026-08-21
  status: verifying
---

## Current Focus

bug_class: Bohrbug
reasoning_checkpoint:
  hypothesis: "Plan 43.2-05 made finite Group transport lifecycle-complete, but the physical-edit coordinator's cloneLoopClips producer strips all six lifecycle fields and the direct fresh-layer bridge fixture still constructs the same pre-cutover five-field record, so isPhysicPaintRotoPhysicalEditApplyPayload rejects the payload before application."
  confirming_evidence:

    - "The failing run deterministically returns the top-level Invalid physics paint apply payload error before semantic application."
    - "isLifecycleCompletePhysicPaintRotoLoopClip requires syncState, provenanceState, phaseOrigin, originalEndExclusive, visibleRanges, and frameOverrides; the failing fixture supplies none."
    - "Production cloneLoopClips copies only loopId, placementStart, sourceKeyIds, repeat, mode, and provenance, dropping lifecycle fields even when canonical input carries them."
  falsification_test: "After preserving/canonicalizing lifecycle fields at cloneLoopClips and making the direct fixture canonical, the exact bridge test would still fail with Invalid physics paint apply payload."
  fix_rationale: "Canonicalize finite Groups at the outbound coordinator clone boundary and preserve every lifecycle member, then align the direct bridge payload fixture with the same canonical contract; this fixes producers without weakening validation or adding compatibility migration."
  blind_spots: "Infinity Groups cannot synthesize a finite originalEndExclusive and are intentionally outside this reported finite Progressive repeat=2 regression; no server/native UI is run."
  candidate_causes:

    - "code: cloneLoopClips drops lifecycle fields at the real producer boundary"
    - "data: the existing direct bridge fixture constructs a partial finite Group"
  and_gate: "yes — the regression requires both the intentional strict transport cutover and a producer/fixture path that bypasses or erases canonical finite lifecycle hydration"
hypothesis: confirmed root cause at the producer/fixture boundary
test: apply the minimal two-file fix and rerun the exact failing test
expecting: all 68 bridge tests pass except the existing single skip, with no parser changes
next_action: run the full one-shot app Vitest suite, then run the root pnpm build

## Symptoms

expected: The first Progressive Play Script and Loop Clip apply on a fresh physics-paint layer is accepted and the bridge error remains null.
actual: The bridge returns "Invalid physics paint apply payload".
errors: Vitest assertion near app/src/lib/physicPaintBridge.test.ts:1549 expected null but received "Invalid physics paint apply payload".
reproduction: Run app/src/lib/physicPaintBridge.test.ts and execute the test named "physicPaintBridge accepts the first Progressive Play Script and Loop Clip on a fresh layer".
started: After Plan 43.2-05 made Group/Loop Clip records lifecycle-complete and canonical across types, persistence, transport, and store boundaries.

## Eliminated

## Evidence

- timestamp: 2026-08-11T05:59:28Z
  checked: pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts --silent
  found: Deterministic reproduction; 1 of 68 tests fails, 1 skipped, 66 pass. The exact fresh-layer test receives "Invalid physics paint apply payload" from the top-level runtime validator.
  implication: This is a Bohrbug at the payload-shape boundary before bridge semantic application or store replacement.

- timestamp: 2026-08-11T05:59:28Z
  checked: Plan 43.2-05 and knowledge base
  found: Plan 05 intentionally requires a strict lifecycle-complete Group schema across parser, transport, persistence, and store boundaries; a prior Phase 43 issue also involved omitted canonical fields at consumer boundaries, but no exact fresh-layer producer match exists.
  implication: The parser must remain strict; the producer/fixture payload must be compared against the new complete schema.

- timestamp: 2026-08-11T06:04:00Z
  checked: app/src/types/physicPaint.ts transport guard and app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts parser
  found: Finite pre-lifecycle Groups are canonically hydrated to synchronized/attached contiguous semantics by parsePhysicPaintRotoLoopClips, while physical transport deliberately requires all six lifecycle fields.
  implication: Canonicalization belongs before transport; accepting the partial payload in the transport validator would violate Plan 05.

- timestamp: 2026-08-11T06:04:00Z
  checked: production Play Script controller and useRotoPhysicalEditCoordinator.cloneLoopClips
  found: Fresh Play Script creates a finite five-field Group and cloneLoopClips then copies only base/provenance fields, so no canonical lifecycle reaches the parent payload. The failing bridge fixture mirrors this pre-cutover shape directly.
  implication: The real producer boundary and its direct fixture must emit lifecycle-complete finite Groups.

- timestamp: 2026-08-11T06:03:17Z
  checked: exact bridge test after minimal fix
  found: app/src/lib/physicPaintBridge.test.ts passes with 67 tests passed and 1 existing skip.
  implication: Preserving canonical lifecycle fields removes the original fail-closed payload rejection without parser changes.

## Resolution

root_cause: Plan 43.2-05 correctly tightened physical transport to lifecycle-complete finite Groups, but cloneLoopClips erased the six canonical lifecycle fields and the direct fresh-layer bridge fixture still emitted the same partial record, causing fail-closed rejection before application.
fix: Canonicalize finite Groups at the physical-edit coordinator clone boundary, preserve every lifecycle field in outbound payloads, and update the direct fresh-layer bridge fixture to emit the complete synchronized/attached Group record.
verification:
  target_test: { result: pass, tests_passed: 67, tests_skipped: 1 }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker dependency or configuration is present", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["app/src/lib/physicPaintBridge.test.ts: 67 passed, 1 skipped", "full app suite: 116 files passed, 3 skipped; 1664 tests passed, 1 skipped, 101 todo"] }
  build: { result: pass, command: "pnpm build" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict: accepted
files_changed: [app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts, app/src/lib/physicPaintBridge.test.ts]
