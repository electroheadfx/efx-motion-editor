---
status: resolved
trigger: "Diagnose and fix the deterministic Phase 43.1 Wave 4 post-merge test failures on the main working tree. Production build passes; four assertions fail in app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts after contextual Insert and deferred empty-segment publication changes. Determine production regression versus stale static source-contract tests, apply the smallest correct fix, run focused/adjacent/typecheck/full-suite verification, and commit as fix: resolve post-merge conflicts from wave 4."
created: 2026-08-09T16:19:05Z
updated: 2026-08-09T16:29:57Z
---

## Current Focus

bug_class: Bohrbug
hypothesis: the four failures are caused by the static test parser identifying Insert only through the superseded literal `aria-label="Insert key before"`, while production now correctly binds `aria-label={insertRotoKeyDescription}` for contextual dispatch
ranked_hypotheses:
  - "test parser literal drift after f36c284b (confirmed)"
  - "production accessibility/action markup regression (eliminated)"
  - "environment or build divergence (eliminated)"
reasoning_checkpoint:
  hypothesis: "The stale literal Insert lookup causes all four failures because `getButtonBlock` and row-order checks return an empty/-1 result when the production aria-label is a contextual expression."
  confirming_evidence:
    - "f36c284b changed only Insert's aria-label and tooltip description from a literal to `insertRotoKeyDescription`; unchanged neighboring markup retains aria-disabled, aria-describedby, click guard, keydown guard, icon, visible label, and order."
    - "Focused strip run fails exactly four indexOf/empty-block assertions while 74 other tests pass; adjacent contextual Insert and accepted-only settlement suites pass 27/27."
  falsification_test: "If updating the parser to match `aria-label={insertRotoKeyDescription}` does not make all four failures green, or if adjacent contextual Insert tests fail, this hypothesis is wrong."
  fix_rationale: "Teach the source-contract helper to use the exact contextual Insert aria-label source token while keeping literal matching for every other action; this preserves meaningful accessibility, keyboard, label, and order assertions without reverting production behavior."
  blind_spots: "No browser DOM harness exists in the current one-shot Node test setup; behavior is established by direct production markup tracing plus controller/coordinator interaction tests rather than a rendered browser event test."
  candidate_causes:
    - "code/test: static source parser assumes every action has a literal aria-label"
    - "config/environment: Vitest transform or build mode could alter source visibility, but direct read and deterministic raw-source index failures refute this"
  and_gate: "no — one literal-token mismatch is sufficient to produce all four failures because each failing assertion depends on the same Insert lookup"
next_action: archive the confirmed session, commit planning artifacts, and record the recurrence pattern in the debug knowledge base

## Symptoms

expected: Physics Paint workflow strip keeps seven guarded actions in locked order, all actions remain focusable without native disabled, aria-disabled communicates guarded state, click and keydown are guarded, enlarged bottom-row icons retain short visible labels, and contextual Insert preserves its intended location and acceptance behavior.
actual: production build passes, but four static assertions fail because expected source tokens or aria-disabled within an extracted action block are not found after Wave 4 merge.
errors: "renders the seven guarded icon actions in locked order (D-10): source token not found; keeps every guarded action focusable without native disabled and guarded on click and keydown (D-12): expected aria-disabled in extracted action block; renders a short visible label after each enlarged bottom-row icon (Gap D): source token not found; top bar regrouping contract orders the bottom action row including Insert: source token not found"
reproduction: run the one-shot Vitest test file app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts from the app package/root command convention.
started: deterministic post-merge failure after Phase 43.1 Wave 4 commits 52d02d2a, f36c284b, 2f7b40a5, 69f01016, c8512c30.

## Eliminated

- hypothesis: production markup lost Insert focusability, aria-disabled semantics, keyboard guarding, icon label, or row position during Wave 4.
  evidence: the f36c284b diff changed only the aria-label/tooltip description from a literal to `insertRotoKeyDescription`; the same button block retains all guards and position, while 27 adjacent contextual action/settlement tests pass.
  timestamp: 2026-08-09T16:26:00Z

- hypothesis: environment/configuration or build output causes the four failures.
  evidence: the focused test reproduces in 368ms in Node, production build already passes, and every failure is a deterministic `indexOf`/empty-slice result against source text.
  timestamp: 2026-08-09T16:26:00Z

## Evidence

- timestamp: 2026-08-09T16:25:00Z
  checked: contextual Insert controller, Studio wiring, and accepted-only settlement tests
  found: `useRotoTimelineActions` derives one Signal-backed target authority; occupied targets expose `Insert key before` and dispatch `insert-slot`, genuinely empty targets expose `Insert an empty key and start a new interpolation segment.` and dispatch `insert-empty-segment`; Studio passes the same `rotoPhysicalActions.insertRotoFrame` to the strip; the strip binds that signal value to the button's aria-label/tooltip while retaining its click and Enter/Space guards.
  implication: contextual visible/accessibility behavior is intentional and unambiguous; reverting production to a literal label would regress Plan 43.1-04. The correction belongs in the static source-contract test lookup.

- timestamp: 2026-08-09T16:21:58Z
  checked: adjacent one-shot Vitest suites for contextual Insert and coordinator settlement
  found: 2 files passed, 27/27 tests passed in 403ms. Coverage includes occupied and genuinely-empty dispatch, exact contextual description, disabled and racing rejection, accepted-only empty-segment publication, parent rejection, mismatch, and transport rollback.
  implication: production action semantics and deferred publication are green; only the source parser's literal Insert label assumption is stale.

- timestamp: 2026-08-09T16:23:00Z
  checked: full PhysicsPaintWorkflowStrip implementation, full source-contract test, and Wave 4 strip diff
  found: commit f36c284b changed only Insert's literal `aria-label="Insert key before"` and tooltip description to the dynamic `insertRotoKeyDescription`, sourced from `physicalActions.insertTooltipDescription.value`; the button remains in the same DOM position with unchanged focusability, aria-disabled, aria-describedby, click guard, keydown guard, icon, and visible `Insert` label.
  implication: all four failures share one brittle literal lookup: `getButtonBlock(row, 'Insert key before')` returns empty and order tests see -1 even though the production button markup/guards remain present. Runtime behavior still needs direct adjacent controller/interaction evidence before editing.

- timestamp: 2026-08-09T16:20:29Z
  checked: focused one-shot Vitest feedback loop
  found: 78 tests ran deterministically in 368ms; exactly the reported 4 static source-contract assertions failed and 74 tests passed.
  implication: the feedback loop is tight, fast, deterministic, and isolated to source-token/block extraction; the failure is a Bohrbug in test/implementation contract integration rather than a build failure.

- timestamp: 2026-08-09T16:21:00Z
  checked: initial focused-test command invocation
  found: `pnpm --dir app vitest run ...` was parsed as an executable path and failed with EACCES before Vitest started.
  implication: this is a command-shape error, not product evidence; use `pnpm --dir app exec vitest run ...` for the red-capable loop.

## Resolution

root_cause: `PhysicsPaintWorkflowStrip.test.ts` encoded Insert identity as the literal source token `aria-label="Insert key before"`. Wave 4 intentionally changed production to `aria-label={insertRotoKeyDescription}` so occupied and genuinely-empty targets expose contextual accessible copy. The shared literal lookup returned no Insert button, causing all four downstream order/accessibility/label assertions to fail despite unchanged production markup and behavior.
fix: Added one source-token helper that maps the existing semantic Insert test identity to the exact contextual aria-label expression while retaining literal matching for every other action; reused it in button extraction and both action-order checks.
verification:
  target_test: { result: pass, detail: "PhysicsPaintWorkflowStrip.test.ts 78/78" }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker dependency or configuration exists in package.json, app/package.json, or pnpm-lock.yaml.", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false, detail: "Additive parser correction; no production behavior or assertion removed." }
  adjacent_tests: { result: pass, suites_run: ["useRotoTimelineActions.test.ts 18/18", "useRotoPhysicalEditCoordinator.test.ts 9/9", "focused combined 105/105", "full app suite 1649 tests, 0 failures"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, detail: "Revert restored exactly 4 failures/74 passes; reapply restored 78/78." }
  typecheck: { result: pass, detail: "tsc --noEmit" }
  production_build: { result: pass, detail: "Production build passes and production behavior remains intact." }
  human_verification: { result: pass, detail: "User confirmed fixed after independent inspection of commit b171c505." }
  guardrail_verdict: accepted
commit: b171c505
files_changed: ["app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts"]

## Prevention

- **Code/test branch:** The source-contract helper treated semantic action identity as equivalent to one literal JSX aria-label representation. That assumption became false when Insert intentionally switched to contextual accessible copy, so every assertion sharing the helper lost the same button block.
- **Config/environment branch:** Vitest and the production build were healthy; deterministic raw-source lookup failures ruled out transform or environment divergence. The branch did not contribute to the failure.
- **AND-gate:** No. The stale literal source token alone was sufficient to cause all four failures.
- **Why not caught:** The focused contextual Insert and settlement gates verified behavior but omitted the downstream static `PhysicsPaintWorkflowStrip` source-contract suite; the full post-merge app suite was the first gate that combined the intentional production change with the stale extractor.
- **Recurrence guard:** `getActionAriaLabelToken` in `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` now centralizes semantic action-to-source-token mapping, and the corrected 78-test strip suite plus the full 1,649-test app suite cover contextual Insert without reverting its dynamic accessible label.
