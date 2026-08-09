---
status: resolved
trigger: "Diagnose and fix a CRITICAL Phase 43.1 native UAT data-loss regression on the main working tree. Contextual Insert at frame 32 appeared, closing Physics Paint left Studio raster frames visible, but reopening Physics Paint hydrated a blank physical document with only frame 0. Build a deterministic production-seam Vitest RED first, fix minimally, verify, commit test-first and fix commits, and return a human-verify checkpoint without completing Plan 06 or Phase 43.1."
created: 2026-08-09T17:14:53Z
updated: 2026-08-09T18:41:02Z
---

## Current Focus

hypothesis: resolved — canonical break ownership crosses hydration, projection, and republishing boundaries intact
bug_class: bohrbug
human_verification: approved after a clean frozen-code native restart
scope_decision: Phase 43.1 remains closed without an Insert Gap action; group deletion/frame-from-group and packed-boundary hole insertion are deferred to a later phase and are not blockers
next_action: archive the resolved session, update the debug knowledge base, and commit planning artifacts only

## Symptoms

expected: Contextual empty Insert creates a physical key at frame 32, suppresses the incoming generated span, and closing then reopening Physics Paint preserves all physical keys, interpolation, break ownership, blank payload, selection/cursor, Loop Clips, and projection.
actual: Insert created a key but incoming generated cells remained; after close Studio still showed raster frames and thumbnails, but reopened Physics Paint showed a blank canvas and an empty physical strip containing only frame 0, with all physical keys gone.
errors: No textual error reported; visible state divergence and physical-document data loss.
reproduction: In pnpm tauri dev, open a Physics Paint document with multiple physical Roto keys and generated frames; contextual Insert at frame 32; close Physics Paint; observe Studio raster frames remain; reopen/view Physics Paint; observe blank canvas and only frame 0.
started: Phase 43.1 Plan 06 native UAT; blocking regression, phase remains automated-ready and not approved.

## Eliminated

- hypothesis: Loop Clips alone cause the child launch canonical revision mismatch.
  evidence: With Loop Clips retained and incomingInterpolationBreakKeyIds empty, the production-seam close/reopen test passed.
  timestamp: 2026-08-09T17:34:00Z
- hypothesis: Close-time apply-canvas destroys the parent physical document before reopen.
  evidence: Pre-hydration assertions observed all real records, Loop Clips, break ownership, and generated render source intact after close sync.
  timestamp: 2026-08-09T17:34:00Z
- hypothesis: createPhysicPaintLaunchContext or the launch parser drops the complete physical fields.
  evidence: The launch envelope directly contained all transport records, Loop Clips, and incoming break ownership before child hydration failed.
  timestamp: 2026-08-09T17:34:00Z
- hypothesis: A native-only stale transport event is required to reproduce the reopen failure.
  evidence: The pure production seam deterministically fails before native transport-specific behavior can contribute.
  timestamp: 2026-08-09T17:34:00Z

## Evidence

- timestamp: 2026-08-09T17:15:28Z
  checked: User screenshots 1.png, 2.png, and 3.png
  found: Screenshot 1 shows the inserted outlined key with incoming blue generated cells still present; screenshot 3 shows Studio retaining rendered thumbnails/canvas; screenshot 2 shows reopened Physics Paint blank with only frame 0.
  implication: The visible failure is a dual-source divergence: parent raster/cache output survives while the reopened child physical document is empty.
- timestamp: 2026-08-09T17:15:28Z
  checked: .planning/debug/knowledge-base.md
  found: Prior physics-paint-delete-cache incident involved unsynchronized timeline/runtime/persisted canonical state and identity/persistence cleanup.
  implication: Treat split source-of-truth persistence as a high-value candidate only after the production-seam RED exists.
- timestamp: 2026-08-09T17:15:28Z
  checked: codebase-memory skill bootstrap
  found: The required codebase-memory skill was invoked first, but its graph MCP functions are not exposed in this runtime; only the skill instructions were available.
  implication: Continue with project-local planning artifacts and targeted filesystem/code search while preserving the required graph-first intent.
- timestamp: 2026-08-09T17:21:25Z
  checked: deterministic production-seam Vitest RED
  found: The focused command fails in 0.55s after successful parent close sync and surviving generated render source; child reopen hydration returns `PhysicPaintRotoPhysicalDocument: canonical revision mismatch.`
  implication: The failure is in complete-document launch hydration after parent state remains intact, not a missing parent raster symptom or nondeterministic native-only effect.
- timestamp: 2026-08-09T17:34:00Z
  checked: controlled break-only and Loop-Clip-only production-seam experiments
  found: Break ownership alone reproduces the canonical mismatch; Loop Clips alone pass hydration.
  implication: Missing incomingInterpolationBreakKeyIds is necessary and sufficient for the confirmed reopen failure, while Loop Clips remain an adjacent completeness concern.
- timestamp: 2026-08-09T17:34:00Z
  checked: parent document and launch envelope immediately before hydration
  found: Close sync preserves all canonical records, break ownership, Loop Clips, selection/cursor, and generated projection; createPhysicPaintLaunchContext transports those fields intact.
  implication: The intact parent canonical document is a non-destructive recovery source, and the fault localizes to child reconstruction rather than close cleanup or launch creation.
- timestamp: 2026-08-09T17:34:00Z
  checked: prepareRotoPhysicalLaunch in rotoLaunchHydration.ts
  found: Document reconstruction and projection validation both omit incomingInterpolationBreakKeyIds even though the supplied revision includes them.
  implication: Child hydration deterministically rejects the complete launch document and leaves the child store empty.
- timestamp: 2026-08-09T17:34:00Z
  checked: useRotoTimelineModel and PhysicsPaintStudio timeline-model call
  found: Studio computes accepted incoming break owner IDs, but the timeline model input, structural signal, selector call, and memo dependencies omit them.
  implication: Live generated-cell projection ignores accepted incoming breaks, directly explaining why contextual Insert leaves the incoming generated span visible.
- timestamp: 2026-08-09T17:34:00Z
  checked: encodeLaunchPhysical in useRotoFramePersistenceCoordinator.ts
  found: Republished launch physical state omits both loopClips and incomingInterpolationBreakKeyIds.
  implication: Pixel/document publication can degrade the child launch envelope even after initial hydration; this adjacent boundary needs a focused preservation test and minimal fix.
- timestamp: 2026-08-09T17:36:00Z
  checked: focused timeline-model specified-oracle RED
  found: With real keys at 0/16/32 and key-32 owning the incoming break, frame 31 resolves as generated from key-16→key-32 instead of empty; the test runs in 0.33s.
  implication: The live projection omission independently reproduces the first native symptom and provides a deterministic regression guard.
- timestamp: 2026-08-09T17:38:00Z
  checked: focused launch-publication specified-oracle RED
  found: The coordinator has no complete-document encoder export, and its private encoder omits Loop Clips and incoming break IDs; the behavior test fails in 0.36s before equality can pass.
  implication: A pure encoder boundary can lock complete child launch republishing without mounting hooks or introducing effect-based synchronization.
- timestamp: 2026-08-09T17:42:00Z
  checked: target and adjacent suites after the minimal forwarding fix
  found: 109 tests passed and one pre-existing test skipped across bridge, model, coordinator, selector, and Studio suites.
  implication: All three original REDs are green and adjacent behavior remains intact.
- timestamp: 2026-08-09T17:42:00Z
  checked: app typecheck
  found: Production code typechecks, but the new regression test used Array.at, which is unavailable under the configured TypeScript lib target.
  implication: Replace only the assertion's access syntax; this is a test portability correction, not a production behavior failure.
- timestamp: 2026-08-09T17:42:00Z
  checked: mutation-test configuration
  found: No Stryker or mutation-test dependency/configuration exists in root package.json, app/package.json, or pnpm-lock.yaml.
  implication: Guardrail signal 2 must be recorded as skipped because mutation tooling is unavailable.
- timestamp: 2026-08-09T17:45:00Z
  checked: guardrail revert-and-reconfirm
  found: Stashing the six tracked fix files restored all three exact failures (canonical mismatch, generated frame 31, missing complete encoder); popping the stash made all three target tests pass again.
  implication: The minimal forwarding diff directly causes the observed recovery and is not a coincidental green.
- timestamp: 2026-08-09T17:48:00Z
  checked: Phase 43.1 focused regression matrix
  found: All 11 files passed; 291 tests passed and one pre-existing test skipped.
  implication: Intentional-gap model, resolver, persistence, bridge, history, actions, presentation, and strip contracts remain green.
- timestamp: 2026-08-09T17:48:00Z
  checked: repository-wide automated gates
  found: Full Vitest passed 116 files with 1554 tests passed, one skipped, and 101 todo; app typecheck passed; root ESM/DTS and Vite production build passed with existing import warnings; whitespace check passed.
  implication: The fix is automated-ready for native verification and does not change the pending Phase 43.1 approval boundary.
- timestamp: 2026-08-09T18:41:02Z
  checked: owner-operated native verification after a clean frozen-code restart
  found: Baseline keys and accumulating strokes, intentional empty-frame Insert with incoming-only suppression, save/close/reopen persistence, project-script persistence across Paint layer deletion/recreation, and Undo/Redo were all approved.
  implication: The original native regression is resolved end-to-end; future group workflows are explicitly outside Phase 43.1 and do not block closure.

## Resolution

root_cause: Break-bearing canonical documents are reconstructed/projected through incomplete consumer inputs: child hydration omits incomingInterpolationBreakKeyIds and rejects the canonical revision; the live timeline model/selector omit the same collection and render the incoming generated span; coordinator launch republishing omits break IDs and Loop Clips.
fix: Forward the intact canonical break collection through hydration validation and live projection, pass it from Studio, and republish complete launch physical documents including Loop Clips and breaks. Fix commit: 6e6acac7.
verification:
  oracle_type: specified
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker or mutation-test configuration/dependency exists in the repository.", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["5 changed/import-neighbor files: 109 passed, 1 skipped", "Phase 43.1 matrix: 11 files, 291 passed, 1 skipped", "full Vitest: 116 files passed, 3 skipped; 1554 passed, 1 skipped, 101 todo", "app typecheck", "root production build", "git diff --check"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  human_native_verification: { result: pass, environment: "clean frozen-code native restart", approved_workflows: ["baseline keys and multiple accumulating strokes", "intentional empty-frame Insert with incoming-only suppression", "save/close/reopen persistence", "project script persistence across Paint layer deletion/recreation", "Undo/Redo"] }
  guardrail_verdict: accepted
files_changed:
  - app/src/components/physic-paint/roto/rotoLaunchHydration.ts
  - app/src/components/physic-paint/roto/rotoTimelineSelectors.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineModel.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineModel.test.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  - app/src/lib/physicPaintBridge.test.ts

## Prevention

causal_branches:
  code:
    - "Canonical break ownership was accepted by the parent document but omitted by multiple consumer reconstruction/projection boundaries."
    - "Those boundaries used field-by-field adapters, so newly authoritative document fields could be silently excluded."
  data:
    - "The defect required a break-bearing document; no-break documents produced the same revision and masked the omission."
    - "The original focused coverage did not include complete break-bearing documents across hydration, live projection, and republishing."
and_gate: "The failure required both an incomplete consumer boundary and canonical data containing incoming break ownership; the visible pair of symptoms required omissions at separate hydration and projection seams."
why_not_caught: "No pre-existing gate exercised a complete break-bearing physical document across child hydration, live timeline projection, and launch republishing; no-break fixtures passed and hid the field omission."
recurrence_guard: "Specified-oracle regression coverage now exists in app/src/lib/physicPaintBridge.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineModel.test.ts, and app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts; the tests fail when break ownership or Loop Clips are omitted and passed in the full 1,554-test Vitest gate."
