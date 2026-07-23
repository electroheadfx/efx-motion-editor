---
status: diagnosed
trigger: "Diagnose only Phase 36.14 UAT gap G-36.14-5 occupied-boundary Drag semantics. Compare the locked Wave 14 cut-and-insert expectation A@1,C@4,D@7,B@8, the observed A@1,C@4,D@7,B@9, and the user's requested no-source-gap-closure A@1,C@5,D@8,B@9. Trace resolver/coordinator/UI destination semantics and identify exactly why the observed result is B@9 and where the product/spec conflict originates. Do not choose a new product behavior silently: document the competing semantics and the smallest implementation impact of each. Inspect current working tree including uncommitted production fixes. Do not modify code or tests and do not run tests, typecheck, build, server, browser, or native app. You may write only `.planning/debug/uat-36-14-occupied-drag.md`. Read the UAT and relevant Phase 36.14 plan/spec artifacts. Return evidence with file:line references and decision required."
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T21:40:00Z
---

## Current Focus

bug_class: bohrbug
hypothesis: Confirmed statically. The observed A@1,C@4,D@7,B@9 is the current resolver's direct `physical-cell(9)` result, not its occupied `after-key(D)` result. The UI treats D's right half and adjacent frame 9 as different intents, while the phrase "after D" can describe either gesture.
test: Complete; current production call-path and parent-authority trace preserve the target/proposal without another destination calculation.
expecting: Decision required before any implementation: retain locked ripple cut-and-insert, adopt no-source-gap closure, or explicitly canonize the observed hybrid.
next_action: Return diagnosis with file:line evidence and the smallest impact of each product choice; do not modify implementation.

reasoning_checkpoint:
  hypothesis: "Pointer hit classification selected direct physical cell 9, so the resolver closed B's source slot and then preserved frame 9 as the requested final destination; an occupied after-key(D) intent would instead resolve to frame 8."
  confirming_evidence:
    - "WorkflowStrip emits physical-cell(appFrame) for empty/generated cells but emits after-key(targetKeyId) only while the pointer is inside the right half of an occupied cell."
    - "The resolver's physical-cell branch calls cutAndInsert with the literal target frame, whereas after-key resolves the target identity against the post-cut map."
    - "Action, coordinator, payload type, and parent bridge preserve the complete proposal records and contain no +1 destination rewrite."
    - "The observed C@4,D@7 proves source-gap closure; B@9 identifies a literal final-frame-9 target under the current resolver."
  falsification_test: "A captured publication showing targetKind=after-key, targetKeyId=D, resolvedInsertionAppFrame=9 on this exact checked-out source would falsify the diagnosis; current source inspection says that tuple is impossible."
  fix_rationale: "No fix is selected in diagnosis-only mode. The implementation must follow an explicit product decision because changing source closure or occupied-boundary interpretation changes the physical timeline contract."
  blind_spots: "Execution and instrumentation were prohibited, and image-16 records history badges rather than pointer position or proposal metadata. If the native release was definitely inside D's right half, the running binary did not match the inspected source and stale-build/source mismatch remains the next hypothesis."
  candidate_causes:
    - "code: hit testing intentionally maps D's right half to after-key(D) but maps adjacent frame 9 to physical-cell(9), producing distinct final maps for two gestures described as 'after D'."
    - "data/input: the accepted target carried appFrame 9 rather than targetKeyId D; the final map fingerprints that direct target under current source."
    - "environment: a stale native binary could explain B@9 from a true after-key(D) release, but only if the release location was positively captured inside D's right half."
    - "config: no relevant flag or capacity setting participates in destination calculation."
  and_gate: "yes — the UAT mismatch requires both the direct-cell-9 gesture classification and an expectation framed as occupied after-key or no-gap move; the resolver's deterministic source-close behavior then yields the observed hybrid map."

## Symptoms

expected: Locked Wave 14 cut-and-insert expectation is A@1,C@4,D@7,B@8; user-requested no-source-gap-closure behavior is A@1,C@5,D@8,B@9.
actual: Occupied-boundary Drag produces A@1,C@4,D@7,B@9.
errors: No runtime error; semantic mismatch at an occupied destination boundary.
reproduction: Phase 36.14 UAT gap G-36.14-5 occupied-boundary Drag scenario using keys A, B, C, D at the documented frames.
started: Observed during Phase 36.14 UAT; exact introduction point to be determined from artifacts and current working tree.

## Eliminated

- hypothesis: The current `after-key(D)` resolver path adds one too many and directly produces B@9.
  evidence: `physicsPaintRotoPhysicalResolver.ts:910-921` closes the source, re-finds D at post-cut frame 7, and inserts after it at frame 8.
  timestamp: 2026-07-23T21:40:00Z
- hypothesis: The coordinator changes a resolver proposal from B@8 to B@9 while rebuilding payload ownership.
  evidence: `useRotoPhysicalEditCoordinator.ts:703-740` iterates the proposal mapping and assigns each record exactly that mapping's appFrame.
  timestamp: 2026-07-23T21:40:00Z
- hypothesis: The parent bridge reconstructs move-key destination semantics from startFrame, selection, or target geometry.
  evidence: `physicPaintBridge.ts:392-478` parses and validates the submitted complete records, then replaces the physical document; it never receives a Drag target and never calculates a destination.
  timestamp: 2026-07-23T21:40:00Z
- hypothesis: A second active production Drag route bypasses the physical resolver.
  evidence: Production search found one route: WorkflowStrip classification -> `prepareRotoKeyDrag` -> physical resolver -> retained proposal -> physical coordinator. `PhysicsPaintStudio.tsx:419-440` wires that action bundle to the inspected coordinator.
  timestamp: 2026-07-23T21:40:00Z
- hypothesis: Current uncommitted production fixes introduced the B@9 offset.
  evidence: The WorkflowStrip diff changes real-key fill classes only; coordinator changes revision timing and payload retargeting; Studio changes first-paint/Paste refresh. None changes Drag target classification or mapping placement.
  timestamp: 2026-07-23T21:40:00Z

## Evidence

- timestamp: 2026-07-23T00:00:00Z
  checked: Investigation constraints
  found: User explicitly prohibited tests, typecheck, build, server, browser, and native app execution.
  implication: The normal runnable red/green feedback loop is intentionally unavailable; diagnosis must use the supplied deterministic UAT observation plus static contract and call-path tracing.
- timestamp: 2026-07-23T21:40:00Z
  checked: Knowledge base and common-pattern scan
  found: No existing knowledge-base entry matches Roto occupied Drag semantics. The relevant general pattern is a boundary/input-contract ambiguity, not a null, async, coercion, or state failure.
  implication: The prior-resolution shortcut does not apply; direct contract and call-path evidence controls the diagnosis.
- timestamp: 2026-07-23T21:40:00Z
  checked: Locked product contract
  found: `36.14-CONTEXT.md:24-29,135-138`, `36.14-02-PLAN.md:157-163`, and `36.14-12-PLAN.md:207-213` all define Drag as ripple cut-and-insert and the occupied target as D's stable identity after source closure, yielding A@1,C@4,D@7,B@8.
  implication: B@8 is not an incidental test expectation; it is the locked Wave 14 semantic.
- timestamp: 2026-07-23T21:40:00Z
  checked: UAT conflict record
  found: `36.14-UAT.md:60-68,198-209` records locked B@8, observed B@9, and requested no-source-gap A@1,C@5,D@8,B@9 as three distinct outcomes and explicitly requires a product decision.
  implication: Implementing the requested behavior would change the contract, not merely correct an arithmetic offset.
- timestamp: 2026-07-23T21:40:00Z
  checked: UI pointer target classification
  found: `PhysicsPaintWorkflowStrip.tsx:404-452` maps the right half of occupied D to `{kind:'after-key', targetKeyId:D}` but maps the adjacent empty/generated frame 9 to `{kind:'physical-cell', appFrame:9}`. `PhysicsPaintWorkflowStrip.tsx:841-854` renders each physical frame as its own hit-test button with these data attributes.
  implication: Two spatially adjacent releases both colloquially described as "after D" are different resolver intents.
- timestamp: 2026-07-23T21:40:00Z
  checked: UI boundary affordance
  found: `36.14-UI-SPEC.md:218-229` requires a transient left/right caret for occupied boundaries; implementation applies boundary classes only after proposal publication (`PhysicsPaintWorkflowStrip.tsx:824-840`, `physicsPaintStudio.css:1975-1997`).
  implication: The semantic distinction is preview-driven rather than a permanent separate target, making the UAT phrase/gesture easy to interpret as the adjacent frame-9 cell.
- timestamp: 2026-07-23T21:40:00Z
  checked: Resolver direct-cell path
  found: `physicsPaintRotoPhysicalResolver.ts:863-888,967-1003,1033-1047` treats `physical-cell(9)` as the desired final frame: remove B@3, shift C 5->4 and D 8->7, then insert B at literal frame 9.
  implication: This path deterministically produces the observed A@1,C@4,D@7,B@9 with no downstream offset bug.
- timestamp: 2026-07-23T21:40:00Z
  checked: Resolver occupied-boundary path
  found: `physicsPaintRotoPhysicalResolver.ts:890-921` resolves `after-key(D)` only after the same source cut: D is at 7, so insertion is 8.
  implication: On the inspected source, a genuine occupied after-D publication cannot produce B@9.
- timestamp: 2026-07-23T21:40:00Z
  checked: Action preview/commit parity
  found: `useRotoTimelineActions.ts:343-410` passes the UI target unchanged into the resolver and commits the exact retained proposal without recomputing its destination.
  implication: The accepted mapping reveals the resolver target branch selected during hit testing.
- timestamp: 2026-07-23T21:40:00Z
  checked: Coordinator and parent authority
  found: `useRotoPhysicalEditCoordinator.ts:703-740`, `physicPaint.ts:109-142`, and `physicPaintBridge.ts:392-478` carry complete records with direct appFrames; both coordinator and parent preserve those frames and have no before/after target data from which to create an offset.
  implication: B@9 originates before transport, at UI target classification plus resolver semantics.
- timestamp: 2026-07-23T21:40:00Z
  checked: Active composition and alternate routes
  found: `PhysicsPaintStudio.tsx:349-440,744-764` wires the current physical coordinator into `useRotoTimelineActions`; production search found no second Drag commit route.
  implication: A hidden current-source bypass is not supported by static evidence.
- timestamp: 2026-07-23T21:40:00Z
  checked: Git history and working-tree production diffs
  found: Commits `85fba4ab` and `4c837833` introduced the same direct-cell-final-frame and post-cut occupied-identity semantics now present. Current uncommitted changes do not modify either branch.
  implication: The observed map does not come from a newly introduced uncommitted destination calculation. A stale binary remains relevant only if the release is independently known to have occurred inside D's right half.
- timestamp: 2026-07-23T21:40:00Z
  checked: SBFL and executable reproduction availability
  found: Execution was prohibited, so no test suite, per-test coverage, runtime proposal capture, or repeated reproduction could be run.
  implication: SBFL is skipped by constraint. The diagnosis is strong for the inspected source but retains one explicit environment blind spot about the exact native pointer target/build.

## Resolution

root_cause: "Under the current checked-out source, the observed A@1,C@4,D@7,B@9 can only be the direct `physical-cell(9)` Drag result, not the occupied `after-key(D)` result. WorkflowStrip classifies a release inside D's right half as `after-key(D)` but classifies the adjacent frame-9 cell as `physical-cell(9)`. The resolver closes B's source slot in both cases (C 5->4, D 8->7); the direct-cell branch then preserves 9 as the requested final frame, while the occupied branch re-finds D at 7 and inserts B at 8. The product/spec conflict is separate: locked D-07 requires source-gap closure and post-cut occupied identity, whereas the user's requested A@1,C@5,D@8,B@9 requires removing B without closing its source gap."
fix: "Diagnosis only; no fix applied. Competing smallest impacts: (1) retain locked B@8 — no resolver/coordinator/bridge change; clarify/verify release inside D's right half and improve/confirm boundary affordance, investigating stale binary only if that exact gesture still gives B@9; (2) adopt no-source-gap B@9 — replace Drag's source-closing cut with remove-without-close for the agreed scope, then update D-07, empty/generated and occupied examples, UAT, history snapshots, and regression contracts; coordinator/bridge structure can remain unchanged because they consume complete maps; (3) canonize observed hybrid — no change for direct frame-9 drops, but making occupied after-key(D) also end at 9 would require resolving against D's pre-cut frame and changing the locked contract, while still not satisfying the user's no-gap request."
verification: "Static call-path and artifact verification only; execution prohibited. Product decision required: choose locked ripple cut-and-insert, no-source-gap movement (and whether for all Drag targets or occupied only), or explicitly approve the hybrid. If the user confirms the native pointer was released inside D's right half rather than frame 9, verify source/binary parity next because that output is impossible on the inspected after-key path."
files_changed:
  - /Users/lmarques/Dev/efx-motion-editor/.planning/debug/uat-36-14-occupied-drag.md
