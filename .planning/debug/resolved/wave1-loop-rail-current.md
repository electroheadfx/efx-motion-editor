---
status: resolved
trigger: "Diagnose and fix the deterministic Wave 1 post-merge test failure on the main working tree. Failing test: PhysicsPaintLoopClipRail ownership tracer > renders source-cycle generated cells blue and their repeated counterparts dark. Expected boundaryStart.props.cellClass to contain current; received physics-paint-roto-cell roto-fill-cached roto-loop-boundary-start occupied saved roto-spacing-proxy-selected. Determine real regression vs stale assertion, apply smallest correct fix, run one-shot Vitest tests, and commit as fix: resolve post-merge conflicts from wave 1."
created: 2026-08-09T14:24:01Z
updated: 2026-08-09T14:41:00Z
---

## Current Focus

bug_class: bohrbug
hypothesis: confirmed and human-verified
next_action: none — resolved, archived, and ready for the planning-artifact commit
reasoning_checkpoint:
  hypothesis: "The failure is a stale assertion: Quick 260809-aac intentionally changed real-key `current` ownership from cursor overlay to nullable primary-key identity, and spacing-proxy selection has precedence, so the frame-0 source proxy must have `roto-spacing-proxy-selected` without `current`."
  confirming_evidence:
    - "Production derives `isPrimarySelected` only when `!isSpacingProxySelected` and the nullable primary key matches, then derives `current` from `hasCurrentTreatment`; the fixture supplies spacing selection and no primary identity."
    - "Quick 260809-aac planning and approved UAT explicitly require real-key current styling to be owned by stable primary identity, preserve spacing-proxy precedence, and prevent overlapping current/complete-selection treatments."
    - "Git history shows the assertion dates to accepted Phase 43 commit 45677643, while production semantics changed later in 15224dc8/0431e812/39fe1895; the rail test was not updated or included in that quick task's focused gate."
    - "Wave 1 commits 32d80242/98c18819/2cf5a082 do not touch the workflow strip or rail test; the full post-merge suite merely exposed the pre-existing stale assertion."
  falsification_test: "If a current production/planning contract requires a spacing-selected real key with no primary identity to also carry `current`, or if changing the assertion causes adjacent selection/rail regressions, this hypothesis is wrong."
  fix_rationale: "Replace the obsolete `current` expectation with the intended spacing-proxy-selected expectation at the exact integration seam; production behavior remains unchanged because it matches the approved selection truth table."
  blind_spots: "Native visual behavior is not rerun here, but the exact truth table already passed native UAT on 2026-08-09 and the change is test-only."
  candidate_causes:
    - "code/test: stale Phase 43 assertion was not reconciled after Quick 260809-aac changed current-class ownership"
    - "config/environment: Vitest launcher/config mismatch could have executed a duplicate stale file, but the launcher only imports the canonical tracked `.test.tsx` file and is functioning as designed"
  and_gate: "no — the stale assertion alone fully explains the deterministic failure; Wave 1 and Vitest configuration are exposure mechanisms, not contributing root causes"

## Symptoms

expected: boundaryStart.props.cellClass contains `current` according to the existing test
actual: boundaryStart.props.cellClass is `physics-paint-roto-cell roto-fill-cached roto-loop-boundary-start occupied saved roto-spacing-proxy-selected` without `current`
errors: "PhysicsPaintLoopClipRail.test.tsx:747 assertion failure: expected boundaryStart.props.cellClass to contain current"
reproduction: run the focused test `PhysicsPaintLoopClipRail ownership tracer > renders source-cycle generated cells blue and their repeated counterparts dark`
started: after merging Wave 1 commits 32d80242, 98c18819, and 2cf5a082; production build passes; full suite has 1 failure out of 1,626

## Eliminated

- hypothesis: Wave 1 production changes regressed Loop Rail current/selection behavior
  evidence: commits 32d80242, 98c18819, and 2cf5a082 do not modify the rail test or workflow-strip presentation; the behavior change predates Wave 1 in Quick 260809-aac
  timestamp: 2026-08-09T14:31:40Z

- hypothesis: Vitest executes an unintended duplicate implementation of the test
  evidence: `PhysicsPaintLoopClipRail.test.tsx.test.ts` is a four-line tracked import-only launcher required by the existing `src/**/*.test.ts` configuration and imports the canonical `.test.tsx` file
  timestamp: 2026-08-09T14:31:40Z

- hypothesis: production should restore `current` alongside spacing-proxy selection
  evidence: Quick 260809-aac explicitly assigns real-key current styling to nullable primary identity, preserves spacing-proxy precedence, and passed native UAT for eliminating overlapping selection highlights
  timestamp: 2026-08-09T14:31:40Z

## Evidence

- timestamp: 2026-08-09T14:24:01Z
  checked: user-provided full-suite and focused-test results
  found: failure is deterministic and isolated to one assertion while production build passes
  implication: this is a Bohrbug suitable for focused reproduction and differential tracing

- timestamp: 2026-08-09T14:24:01Z
  checked: requested codebase-memory-mcp-first exploration
  found: the codebase-memory skill is available, but its graph MCP tools are not exposed in this runtime
  implication: continue with the skill's structural workflow using repository search/read tools while preserving the requested exploration order as far as the runtime permits

- timestamp: 2026-08-09T14:24:27Z
  checked: focused one-shot Vitest reproduction
  found: the named test fails deterministically in 614ms at line 747 because the boundary-start cell has `roto-spacing-proxy-selected` but not `current`; the other three tests in the file are skipped by the name filter
  implication: a tight red-capable feedback loop exists and directly captures the reported symptom

- timestamp: 2026-08-09T14:25:12Z
  checked: knowledge base and common bug patterns
  found: no prior knowledge-base entry matches loop-rail current/selection semantics; the closest generic category is state/presentation contract drift
  implication: investigate as a fresh deterministic code-or-test contract mismatch

- timestamp: 2026-08-09T14:29:10Z
  checked: production `PhysicsPaintWorkflowStrip` presentation path
  found: spacing selection sets `isSpacingProxySelected`; `isPrimarySelected` is explicitly gated by `!isSpacingProxySelected`; real-key `current` is emitted only from `isPrimarySelected`; the failing fixture supplies a spacing selection and no `rotoPrimarySelectedKeyId`
  implication: the received class list is the intended production result, not a regression

- timestamp: 2026-08-09T14:29:10Z
  checked: Phase 43 validation/context and Quick 260809-aac plan/summary
  found: Phase 43 requires explicit physical spacing proxies to remain visible and selected repeats to use `:not(.current)` styling; Quick 260809-aac later made stable primary identity authoritative for real-key `current`, preserved spacing-proxy precedence, and passed native UAT
  implication: the assertion expecting `current` contradicts the latest approved selection contract

- timestamp: 2026-08-09T14:29:10Z
  checked: git blame and commit sequence
  found: the failing assertion came from 45677643; production current ownership changed later in 15224dc8 with UAT corrections 0431e812 and 39fe1895; the focused quick-task gate did not include `PhysicsPaintLoopClipRail.test.tsx`; Wave 1 commits do not touch this path
  implication: this is stale cross-test fallout surfaced by the later full suite, not a Wave 1 behavior regression

- timestamp: 2026-08-09T14:33:22Z
  checked: focused test after the one-line assertion correction
  found: exact named test passes; 1 passed and 3 skipped in the launcher file
  implication: the specified oracle now matches intended production behavior

- timestamp: 2026-08-09T14:34:22Z
  checked: relevant Loop Rail, WorkflowStrip, Studio, and spacing-selection regression set
  found: 4 files passed with 126 of 126 tests passing
  implication: adjacent current/selection and Loop Clip behavior remains green

- timestamp: 2026-08-09T14:35:42Z
  checked: full app suite with `vitest run --silent`
  found: 116 files passed, 3 skipped; 1524 tests passed, 1 skipped, 101 todo, 1626 total; zero failures
  implication: the original full-suite gate is restored

- timestamp: 2026-08-09T14:36:42Z
  checked: mutation-test availability
  found: no Stryker configuration or CLI is available in the app
  implication: mutation signal is skipped with explicit tooling-unavailable reason

- timestamp: 2026-08-09T14:38:30Z
  checked: revert-and-reconfirm guardrail
  found: restoring the stale `current` assertion reproduced the exact original focused failure; reapplying `roto-spacing-proxy-selected` restored the focused pass
  implication: the one-line oracle correction causally resolves the deterministic gate without production changes

## Resolution

root_cause: "`PhysicsPaintLoopClipRail.test.tsx` retained a Phase 43 assertion that cursor frame 0 must carry `current`; Quick 260809-aac later made real-key `current` depend on an active primary key identity and gave spacing-proxy selection precedence, but its focused gate omitted this rail integration test. Wave 1 did not introduce the behavior; its post-merge full-suite run exposed the stale assertion."
fix: "Replace the obsolete `current` expectation with an explicit `roto-spacing-proxy-selected` expectation for the selected frame-0 source proxy."
oracle_type: specified
verification:
  target_test:
    status: pass
    result: "Focused ownership-tracer test passed: 1 passed, 3 skipped."
  mutation_signal:
    status: skipped
    result: "No Stryker configuration or CLI is available."
  no_op_deletion_detector:
    status: pass
    result: "The diff replaces one obsolete assertion with the specified spacing-proxy oracle; it is not deletion-only or a disabled check."
  adjacent_regressions:
    status: pass
    result: "4 relevant files passed with 126 of 126 tests; full app suite passed with 1524 passed, 1 skipped, 101 todo, 1626 total."
  revert_and_reconfirm:
    status: pass
    result: "Reverting the assertion reproduced the exact failure; restoring the correction returned the focused test to green."
  human_verification:
    status: pass
    result: "User confirmed fixed after independent inspection of fix commit ff292d8221bc2a131ae83783d9306f3cfff93f56 and a full app suite run reporting 1,626 total tests with 0 failures."
  guardrail_verdict: accepted
files_changed:
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
fix_commit: ff292d8221bc2a131ae83783d9306f3cfff93f56

## Prevention

causal_branches:
  code_test:
    - "The Phase 43 rail integration test encoded cursor-based `current` ownership."
    - "Quick 260809-aac intentionally moved real-key `current` ownership to stable primary identity while preserving spacing-proxy precedence."
    - "That quick task's focused test gate did not include the Loop Rail ownership-tracer integration test, so the old oracle remained unchanged."
  workflow_gate:
    - "The focused quick-task verification covered the changed selection truth table but not every downstream integration assertion that duplicated the old contract."
    - "The later Wave 1 full-suite run was the first gate broad enough to expose the stale assertion."
  and_gate: "no — the stale test oracle alone caused the failure; the narrower prior gate explains why it was not caught earlier but was not required for the bug to exist"
why_not_caught: "The Quick 260809-aac focused test gate omitted the downstream PhysicsPaintLoopClipRail ownership-tracer test that still encoded the superseded `current` contract."
recurrence_guard: "The corrected specified-oracle assertion in /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx now requires `roto-spacing-proxy-selected` for this spacing-selected source proxy; the full 1,626-test app suite verifies the downstream integration contract."
