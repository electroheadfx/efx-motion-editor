---
status: resolved
trigger: "Run exactly Debug 07 — Key Utilities and Overrides, starting with the confirmed Insert transaction and projection failures."
created: 2026-07-13T06:49:52Z
updated: 2026-07-13T15:04:00Z
---

## Current Focus

hypothesis: Duplicate incorrectly reuses Insert's preserve-selected-display rule after creating a new source key. Therefore source 3 is durably created but selection/action availability remain at display 6 instead of canonical display 9, making immediate canvas staleness non-destructive and the next old-frame Delete destructive. Independently, Duplicate's generic override rebase moves a custom distant endpoint 3->20 to 3->21 instead of preserving the existing display anchor.
test: Run only the rendered-control critical Duplicate/Delete and distant ON/OFF Duplicate regressions after correcting source-ownership assertions to use the source-domain store API.
expecting: RED 4 must first fail because `Delete Roto key at frame 9` is absent after source 3 is correctly published; RED 5 must fail because the transaction transforms 3->20 into 3->21 and/or does not select source 21 at display 23 ON / 21 OFF.
next_action: Debug 07 is resolved and native-UAT accepted. Commit this atomic correction set, then stop; do not begin Debug 08 in this session.
targeted_uat_status: accepted
complete_debug_07_uat_status: accepted
verification_summary:
  - "RED evidence captured the exact failures before correction: projected Insert published source-domain selection/restore state; distant Insert/Delete lost the 3->20 anchor; immediate Insert/Duplicate canvas loaded stale C; Duplicate retained display 6 instead of selecting display 9; immediate Delete could target B; and distant Duplicate rebased 3->20 to 3->21."
  - "Production corrections canonicalize post-mutation source/display selection, carry refreshed cache truth into immediate restore, keep durable keys out of transient preview ownership, preserve custom override endpoints for Insert/Duplicate and exact reversal Delete, and keep local action availability independent from bridge persistence latency."
  - "Complete focused Debug 07 gate passes 5 files / 190 tests."
  - "Rendered durable interaction suite passes 30/30."
  - "Complete Physics Paint matrix passes 37 files / 490 tests."
  - "Typecheck passes; production build passes with 1086 modules; git diff --check passes."
  - "Complete native UAT accepted compact and distant Insert/Duplicate/Delete, one/two/outside custom-segment Delete, override removal/rebasing, generated Copy blocking, reusable normal/distant Paste, immediate canvas/actions, ON/OFF parity, persistence, hydration, and reopen."
  - "No server was started and no push was performed."
reasoning_checkpoint:
  hypothesis: "Duplicate creates target source N+1 but `physicsPaintRotoSession.runKeyTransaction` applies the Insert-only preserve-selected-display rule, so the canonical selected display and subsequent Delete target remain the original display. Separately, Duplicate's generic override rebase maps an existing custom endpoint at the selected source to the newly copied source."
  confirming_evidence:
    - "Rendered RED 4 publishes exact durable sources [0,1,2,3], exact A/B/C/C paint ownership, and projected real displays [0,3,6,9], but the rendered context remains `Key 6` and `Delete Roto key at frame 9` is null."
    - "Rendered RED 5 ON and OFF both produce exact source 21 paint ownership, then fail at `transaction.segmentSpacingOverrides`: expected 3->20, received 3->21."
    - "Source inspection shows `preservesSelectedDisplay = operation === 'insert' || operation === 'duplicate'`; controller inspection shows Duplicate calls generic rebasing without `preserveToFrame`, while Insert already uses that targeted option."
  falsification_test: "The hypothesis is wrong if resolving transaction.activeFrame through the post-transaction projection still leaves rendered selection at the old display, or if preserving the selected source endpoint does not yield ON real displays [0,3,6,9,20,23] while OFF remains [0,1,2,3,20,21]."
  fix_rationale: "Select Duplicate's newly created durable source through the same canonical projection used by the timeline, while retaining Insert's old-display behavior. Preserve only the existing override endpoint equal to the duplicated source, matching the already-proven Insert endpoint rule and leaving other mappings unchanged."
  blind_spots: "Persistence/hydration/reopen parity and adjacent Copy/Paste/direct-paint behavior must still be rerun after GREEN; native timing behavior remains user-verification only."
five_failure_trace:
  insert_canvas:
    divergent_symbol: `lastPreviewBasePayload()` / engine preview-base payload can remain pre-mutation paint although canonical source frames are already replaced. The existing reopened RED 1 is green against the prior explicit refreshed-frame correction, so this failure is not independently reproducible in the harness at the current production candidate.
    repair_event: Native UAT reports unrelated navigation; established earlier rendered diagnosis was away/back selection after a fresh render.
  insert_delete_availability:
    divergent_symbol: rendered `Delete Roto key at frame 3` availability. Reopened RED 2 is green immediately while Insert persistence remains unresolved, so the three-second native delay is not reproduced by persistence latency in the current probe.
    repair_event: Native UAT reports approximately three seconds; no test delay was used and no exact later event is yet observed in harness.
  duplicate_canvas:
    divergent_symbol: `session.currentFrame` / rendered key utility context remains display 6 after Duplicate source 2 creates source 3, so `Delete Roto key at frame 9` is absent. Canvas payload is stale but non-destructive; native navigation repairs it.
    repair_event: away/back navigation rebuilds source/display resolution and selects the new duplicated C projection.
  duplicate_delete_target:
    divergent_symbol: destructive stale target begins before Delete: Duplicate from rendered display 6 resolves the wrong source payload in the probe/Studio path, and rendered selection remains old display 6 instead of duplicated source 3/display 9. The critical test stops before Delete because the exact target button is absent; clicking the old-frame Delete is the native path that removes B.
    repair_event: selecting the duplicated display cell or navigating away/back refreshes the mapping before Delete.
  distant_duplicate_override:
    divergent_symbol: `rebaseRotoSegmentSpacingOverrides()` generically maps custom endpoint 3->20 to 3->21 during Duplicate; ON also retains old selected display 20 while duplicated source 21 should be display 23. OFF initial rendered availability is disabled because the helper fed projected ON cache into an OFF view and requires harness correction before final RED evidence.
    repair_event: interpolation toggle/reopen can rebuild projection, but cannot restore a destructively transformed override; no genuine repair event exists for lost custom timing.
tdd_checkpoint:
  test_file: app/src/lib/physicPaintRotoDurableCore.test.ts
  test_name: `Debug 07 reopened RED 1` through `Debug 07 reopened RED 5`
  status: red
  failure_output: |
    Command: pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts -t "Debug 07 reopened RED"
    Result: 4 failed, 2 passed, 23 skipped.
    RED 1 Insert canvas: passed against current candidate.
    RED 2 Insert Delete availability with unresolved persistence: passed immediately.
    RED 3 Duplicate selection/canvas: failed because `Delete Roto key at frame 9` was null while rendered context stayed `Key 6`; store source keys were [0,1,2,3].
    RED 4 Duplicate/Delete critical path: failed at immediate post-Duplicate paint ownership before Delete; expected source 1 B, received A in the probe path. The test now additionally records transaction paint to separate builder output from store publication.
    RED 5 ON: transaction contained [0,1,2,3,20,21], but store publication still reported [0,1,2,3,20]; exact publication seam requires correction/diagnosis.
    RED 5 OFF: rendered Duplicate was disabled because the helper supplied projected cache inconsistent with interpolation OFF; harness must seed source-domain frames for OFF before treating this as production evidence.

## Symptoms

expected: |
  Compact source keys 0/1/2 projected ON as 0/3/6 insert correctly and immediately from every rendered real-key cell. Distant source keys 0/1/2/3/20 projected ON as 0/3/6/9/20 become source 0/1/2/3/20/21 and ON 0/3/6/9/20/23, with generated 21/22, empty paint at source 20, original OK paint at source 21, and transformed overrides preserved atomically. Deleting exactly that inserted empty source 20 restores source 0/1/2/3/20 and ON 0/3/6/9/20 across live, persisted, and hydrated state.
actual: |
  Insert from projected display 3 or 6 may require an unrelated update before becoming correct, and display 6 appeared to create or expose a key near source 1. Distant Insert mutates durable source keys and paint correctly but renders ON as 0/3/6/9/12/15, losing the display anchor at 20. Deleting the inserted empty key restores source keys and OK paint but re-enabling interpolation renders 0/3/6/9/12 instead of 0/3/6/9/20.
errors: No explicit runtime error reported; failures are inconsistent immediate projection and lost custom segment override.
started: Debug 07 after Debug 06 was native-UAT accepted and committed. Debugs 01–06 must not be reopened.
reproduction: |
  A) Use source keys 0/1/2, global in-betweens 2, ON projection 0/3/6. Click each rendered real key and invoke Insert; display 3 and 6 do not immediately produce the correct canonical/projected result.
  B) Use distinct paint payloads on source 0/1/2/3/20 with ON projection 0/3/6/9/20 and a custom distant segment anchor. Select rendered display 20 and Insert. Actual ON becomes 0/3/6/9/12/15 although OFF later shows source 0/1/2/3/20/21 with correct paint movement.
  C) Delete only the inserted empty source key 20. OFF restores 0/1/2/3/20 and OK paint, but ON becomes 0/3/6/9/12 rather than restoring 0/3/6/9/20.

## Scope and Constraints

- Own only the Insert slice of Debug 07 and minimum Delete behavior for Insert-then-delete reversibility.
- Preserve passing Duplicate behavior with regression coverage; do not change its production path without a distinct failing test.
- Do not implement the complete Delete utility matrix or start Debug 08.
- Preserve Debug 01 architecture: PhysicsPaintStudio.tsx composition only, pure model/transaction/selector business logic, thin Preact controllers/hooks.
- No internal Roto useEffect synchronization, timers, polling, delayed refresh, forced remounts, mirrored frame arrays, or compatibility shims.
- Preserve absolute source identity, reusable Copy/Paste clipboard, Debug 05 utility availability, and Debug 06 independent distant segments.
- Do not start the development server. Do not commit.
- Stop at automated-ready for native UAT; do not mark complete Debug 07 or Phase 36.13 UAT-accepted.

## Required Rendered Trace

Timeline cell click -> selected display frame -> projected real-key classification -> durable source-frame resolution -> Insert action -> source-key shift -> paint/cache rekey -> override transformation -> atomic store publication -> cache regeneration -> final rendered real/generated frames.

## Required RED Coverage

1. Rendered Insert from display 0, 3, and 6 with source 0/1/2 and count 2; immediate canonical, paint/cache, projection, generated, rendered, and selected/resolved frame assertions; equivalent OFF starts must have identical durable results.
2. Exact distant Insert from source 0/1/2/3/20, ON 0/3/6/9/20; distinct paint; exact transformed overrides; ON 0/3/6/9/20/23; generated 21/22; OFF 0/1/2/3/20/21; persistence/hydration and immediate/reopen equivalence.
3. Delete exactly the inserted empty source 20 and assert exact restoration of source, paint/cache, override, ON/OFF projection, persistence, hydration, and reopen equivalence.
4. Atomic transaction-boundary assertion covering selected display, resolved source, source keys, paint/cache keys, overrides, persisted/hydrated settings, projected real keys, and generated frames together.

## Eliminated

## Evidence

- timestamp: 2026-07-13T06:52:57Z
  checked: Debug knowledge base against symptom keywords (Insert, projected display, source, override, delayed projection)
  found: No entry has the required two-keyword overlap; the only prior entry concerns timeline label hit testing.
  implication: No known-pattern shortcut applies; build a fresh RED-capable Insert reproduction and trace the current path.

- timestamp: 2026-07-13T06:52:57Z
  checked: Initial code search for Insert and Roto projection symbols
  found: The visible action is wired PhysicsPaintStudio -> useRotoKeyUtilities.insertBlankKey -> physicsPaintRotoSession.insertBlankKey/applyTransaction -> physicsPaintRotoKeyController transaction, with projection/override logic in rotoSourceDisplayModel, rotoTimelineSelectors, and rotoKeyTransactions.
  implication: A correct regression seam exists at the session/transaction-rendered model boundary; inspect these implementations and existing tests before adding the first RED test.

- timestamp: 2026-07-13T06:52:57Z
  checked: Complete Insert transaction/session implementations
  found: createRotoSession stores projected real-key frames by display appFrame, but runKeyTransaction resolves a source frame and passes it to buildRotoKeyUtilityTransaction. That builder constructs displayToSourceFrame from the projected inputs, then operates on normalizeRealKeyFrames keyed by durable sourceFrame. Insert shifts durable keys and rebases overrides using move mappings; the session batch publishes keys/cache/current source frame together before effects.
  implication: The transaction seam is capable of one-time display-to-source resolution and atomic publication, but a RED rendered test is required to distinguish stale projected input/session recreation from an incorrect transaction or override transformation.

- timestamp: 2026-07-13T06:52:57Z
  checked: Override transformation and projection implementations
  found: Insert maps every source key >= insertion source by +1 and rebaseRotoSegmentSpacingOverrides only remaps existing override endpoints. It does not create the new segment override needed to preserve an absolute distant display anchor when inserting a blank source key before the distant key. Delete drops every override touching the deleted frame before rebasing remaining endpoints.
  implication: Distant display 20 can collapse to global spacing immediately after Insert, and Delete cannot restore the original 3->20 anchor once the Insert transformation failed to split/preserve it. This is a high-priority falsifiable hypothesis, not yet the confirmed first loss point.

- timestamp: 2026-07-13T06:52:57Z
  checked: Common bug pattern map
  found: Symptoms match State Management (stale render/dual representation) for delayed compact correction and Data Shape/Boundary transformation for the distant segment override; no async timer is present in the inspected core path.
  implication: First RED compact test should observe whether the first divergence is selection/source resolution, transaction publication, or projection input; distant test should assert the exact transformed override literal.

- timestamp: 2026-07-13T07:04:04Z
  checked: Project symbol/test inventory for the rendered Insert trace
  found: The focused production modules and tests are colocated under app/src/components/physic-paint/{hooks,roto}; existing tests cover the session, controller, key transactions, source/display model, timeline selectors, and workflow adapter. No area-specific CONTEXT.md or ADR tree was found.
  implication: A fast agent-runnable RED loop can be added to the existing focused Vitest suites without starting the application server or inventing a test harness.

- timestamp: 2026-07-13T07:05:34Z
  checked: Complete compact Insert path from projected session inputs through display restore
  found: Studio passes projected real keys with appFrame/displayFrame 0/3/6 and sourceFrame 0/1/2. physicsPaintRotoSession resolves selected display 3 to source 1 for the transaction, then sets currentFrame and activeRestore to transaction.activeFrame 1. useRotoPersistenceIntegration.restoreFrame clears only when effect.frame equals the still-selected Studio current display frame, so frame 1 cannot clear visible display 3.
  implication: The compact delayed-refresh mechanism is directly explained by a source/display domain leak at the session transaction result boundary. The first RED should demand source-domain keys [0,1,2,3] while keeping active/current restore in display domain 3.

- timestamp: 2026-07-13T07:07:06Z
  checked: Focused compact display-3 session RED with projected 0/3/6 keys and source resolver 3->1
  found: Command `node app/node_modules/vitest/vitest.mjs run app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts` failed deterministically at the display-domain assertion: expected current frame 3, received 1. The transaction source keys and distinct paint movement assertions passed; 22 adjacent session tests passed.
  implication: The transaction itself mutates the correct durable source frame, and the first observed divergence is exactly session publication of source frame 1 as selected/restore frame. The compact hypothesis is confirmed and has a tight RED loop.

- timestamp: 2026-07-13T07:27:00Z
  checked: Minimal compact Insert session publication repair
  found: Insert now keeps the captured display frame for session currentFrame and active restore/effect publication while preserving source-domain transaction.activeFrame. The focused session suite passes 23/23 with the confirmed RED green.
  implication: The compact source/display leak is repaired at the smallest session seam; override transformation remains unchanged and must be driven by its own exact RED.

- timestamp: 2026-07-13T07:31:00Z
  checked: Exact distant Insert controller RED at source 20 with incoming override 3->20 and distinct paint
  found: Durable source keys became [0,1,2,3,20,21], blank paint was created at 20, and original paint moved to 21 as required. The first failing output was transaction.segmentSpacingOverrides: expected 3->20 count 10, received mechanically rebased 3->21 count 10; 17 adjacent controller tests passed.
  implication: The distant bug is independently reproduced and the override is first lost at Insert's generic rebase call, before model normalization/projection drops the non-adjacent 3->21 override.

- timestamp: 2026-07-13T07:36:00Z
  checked: Minimal distant Insert endpoint-preservation repair
  found: The Insert call now requests preservation only for an override.toSourceFrame equal to the insertion source. The exact controller suite passes 18/18, including durable paint shift, override 3->20, ON real keys 0/3/6/9/20/23, and generated 21/22.
  implication: The distant Insert loss is repaired without changing Duplicate/Paste/Delete callers; a new RED is required before touching Delete for reversibility.

- timestamp: 2026-07-13T07:40:00Z
  checked: Exact Insert-then-delete reversibility RED
  found: Delete restored source keys [0,1,2,3,20], move mapping 21->20, and the original distinct paint at 20. Its first divergent output was segmentSpacingOverrides: expected 3->20 count 10, received []; 18 adjacent controller tests passed.
  implication: The generic deletedFrame filter is the exact reversal loss point. The correction can be gated by the repair event where a shifted successor lands on the deleted source endpoint, preserving existing generic Delete behavior.

- timestamp: 2026-07-13T07:45:00Z
  checked: Conditional Delete green phase against the exact reversal and existing D-11 generic delete in the focused controller suite
  found: `node app/node_modules/vitest/vitest.mjs run app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts` passed 19/19. The reversal restores 3->20 and ON 0/3/6/9/20; D-11 still drops its merged-segment override.
  implication: The persisted mapping-to-deleted-frame discriminator is sufficient and does not broaden generic Delete behavior. Remaining work is required integration coverage and repository gates only.

- timestamp: 2026-07-13T07:50:00Z
  checked: Rendered compact Insert interaction coverage for ON displays 0/3/6 and equivalent OFF source displays 0/1/2
  found: The durable-core public harness clicks the rendered cell and Insert button, publishes exact source keys/paint, keeps the selected display frame, and immediately renders the expected ON [0,3,6,9] or OFF [0,1,2,3] cells. Scoped run passed 6/6.
  implication: Compact display-to-source resolution and immediate publication are covered through WorkflowStrip and useRotoKeyUtilities, not only the session unit seam; ON/OFF starts are durably equivalent.

- timestamp: 2026-07-13T07:55:00Z
  checked: Distant rendered Insert -> persistence/hydration/reopen -> rendered Delete -> persistence/hydration/reopen
  found: One atomic publication records selected display 20, resolved source 20, source keys, distinct paint, 3->20 override, projected real keys 0/3/6/9/20/23, and generated 21/22 together. Reopen preserves them. Delete restores original keys/paint/override and ON 0/3/6/9/20; persisted/hydrated reopen and OFF/ON toggle remain equivalent. Scoped run passed 1/1.
  implication: Required atomic, durable, hydrated, reopened, distinct-paint, and exact reversal coverage is now present at the existing integration boundary.

- timestamp: 2026-07-13T08:18:00Z
  checked: First durable-core verification command from repository root
  found: Vitest expanded the relative target across stale .claude worktrees and produced unrelated historical failures; it did not isolate the current app test file.
  implication: This command is invalid evidence for Debug 07. Re-run with app as the Vitest root and an app-relative test path before evaluating the current failure.

- timestamp: 2026-07-13T08:22:00Z
  checked: Isolated current durable-core suite with `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts`
  found: Debug 07 integration coverage and 19 adjacent tests pass. The sole failing test accumulates three legacy expectations in the older durable-cache scenario: literal `Cached` label, non-editable preview-base use, and clearing editable strokes. Rendered text now classifies frame 8 as `Current`, and the latter two expectations also fail.
  implication: The stale-copy hypothesis explains only one of three failures. Inspect the current cached/current classification and preview-base/editable-state contracts before deciding whether all three are stale expectations or any genuine regression exists.

- timestamp: 2026-07-13T08:36:00Z
  checked: Current presentation tests, Phase 36.11 summaries, reference loader unit coverage, launch-listener focused test, and durable harness teardown
  found: `Frame 8: Current` is explicitly the current selected-cell contract. Phase 36.11 still requires engine preview-base plus clear/no-stroke-restore. The reference loader unit test passes that contract, and the listener hook unit test passes independently. The durable integration test uniquely reuses a mounted Studio and manually dispatches a mocked listener, while afterEach renders null into a different node and immediately unstubs globals.
  implication: Preserve production behavior and preview-base assertions. Correct the integration harness to exercise a real reopen/remount and to unmount real roots before global teardown; this directly targets both stale copy and deferred effect lifecycle.

- timestamp: 2026-07-13T08:40:00Z
  checked: Harness-only correction with real reopen remount inside `act` and tracked-root teardown
  found: The formerly failing cached reopen scenario passes while retaining preview-base and engine-clear assertions. The deferred ResizeObserver teardown exception no longer appears. Full durable suite now reaches 18/20, exposing two pre-existing Studio interaction tests whose initial effects were not settled before clicks (Copy remains disabled; Save emits no apply payload).
  implication: Cached-label/preview failures and ResizeObserver exception were harness lifecycle defects. Apply the same narrow `act` mount discipline to the two remaining integration tests; production behavior remains untouched.

- timestamp: 2026-07-13T09:52:05Z
  checked: Final isolated durable suite after narrow render-then-`act` effect flushing for Studio interaction tests, tracked-root cleanup, and actual reopen remount
  found: `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts` passes 20/20. Copy availability, rendered Paste, far Save identity, cached preview-base reopen, and Delete reversal all pass. No unhandled ResizeObserver exception is emitted.
  implication: The remaining failures were harness scheduling/lifecycle defects, not production regressions.

- timestamp: 2026-07-13T09:53:14Z
  checked: Focused Debug 07 session/controller gate
  found: `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoSession.test.ts src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts` passes 42/42.
  implication: Display-domain publication, distant Insert override preservation, exact Delete reversal, and adjacent transaction behavior remain green.

- timestamp: 2026-07-13T09:54:00Z
  checked: Mandatory final repository gates from app root
  found: Full Physics Paint matrix passes 40 files / 507 tests; `pnpm --dir app typecheck` passes; `pnpm --dir app build` passes (1086 modules transformed); `git diff --check` passes. The matrix was app-root scoped and did not expand into stale worktrees.
  implication: Debug 07 is automated-ready. Native visible UAT remains required before resolution/UAT acceptance.

- timestamp: 2026-07-13T10:25:00Z
  checked: Native UAT continuation for immediate Insert and Duplicate canvas/editable payload
  found: Durable mutation, timeline projection, distant overrides, Delete reversal, persistence, and reopen remain accepted. Only the currently visible engine payload is stale immediately after Insert/Duplicate with interpolation ON; an away/back selection repairs it.
  implication: Reopen investigation at the shared post-key-mutation display publication boundary and preserve all previously passing behavior.

- timestamp: 2026-07-13T10:32:00Z
  checked: Full rendered click-to-canvas path in useRotoKeyUtilities, useRotoPersistenceIntegration, useRotoFrameEditingController, useRotoReferenceController, and PhysicsPaintStudio
  found: replaceKeys first rekeys editable/preview maps and publishes canonical store/cache state. restoreFrame then calls loadCachedRotoReferenceFrame with the restored display frame, but that loader reads its frame lookup through inputRef.current from the render that existed before syncKeyFrameLists/setLaunchContext completed. Navigation repairs the canvas because openFrame runs after a fresh render and resolves the updated display frame before loading the engine.
  implication: The first plausible divergence is restoreFrame consuming a stale render-bound reference lookup after canonical publication, not the durable transaction. REDs must capture immediate engine load/preview payload and prove requestNavigation away/back performs the repair.

- timestamp: 2026-07-13T11:10:00Z
  checked: Corrected and executed rendered Debug 07 RED A/B/C from the app root with `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts -t "Debug 07 RED"`
  found: The initial tests were invalid because mounting inside `act` prevented the mocked engine-ready effect from settling; changing only the harness to the established render-then-flush pattern produced a genuine RED. A passed immediately and additionally observes engine clear/no editable load. B failed after canonical source keys `[0,1,2,3]` and blank source 1/display 3 were correct: expected `saved-roto-frame`, received stale `debug-07-immediate-C`. C failed after canonical source keys and duplicated source 1/display 3 were correct: expected `debug-07-immediate-B`, received stale `debug-07-immediate-C`. Both diagnostic away/back assertions remain after the immediate assertion.
  implication: Exact first divergent symbol is `lastPreviewBasePayload()` / engine `setPreviewBaseImageUrl`: the store and key transaction are already canonical while engine publication still resolves old display 3 to source C. The exact repair event is away to display 6 and back to display 3, which invokes navigation after a fresh render. The smallest shared correction boundary is `useRotoKeyUtilities.executeSessionEffects`: retain the cache snapshot returned by `applyTransaction` for `replaceKeys` and provide it explicitly to the immediately following `restoreFrame`, rather than allowing the restore loader to consult stale render-bound lookup input.

- timestamp: 2026-07-13T11:20:00Z
  checked: Green implementation and requested automated gates
  found: `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts -t "Debug 07 RED"` passes A/B/C 3/3. Focused session/controller passes 42/42 and reference controller passes 3/3. Typecheck passes, build passes with 1086 modules, and `git diff --check` passes. The complete 23-test durable file is not stable as a single run: mounted Studio effect ordering can leave new A/C and existing Paste/Save tests disabled even though the same tests pass focused. This is a test harness lifecycle/order failure, not a production assertion divergence, and was not hidden as a green matrix result.
  implication: The production correction is automated-ready for native visible UAT, but complete durable/full Physics Paint matrix acceptance remains blocked on harness-order stabilization. Keep status verifying and do not mark the Insert slice, Debug 07, or Phase 36.13 accepted/resolved.

- timestamp: 2026-07-13T11:45:00Z
  checked: Complete 23-test durable-file failure and shared Studio harness mount/effect/readiness lifecycle
  found: The complete file reproduced at 21/23 with A and C disabled (`Engine not ready`). The shared mock canvas scheduled `onEngineReady` in a deferred effect while Studio roots and globals were reused across tests; manual remount/unmount paths were not consistently settled through the actual tracked root. The smallest test-only stabilization binds the mock effect to the engine captured by that render, tracks every actual root, unmounts those roots inside `act`, and uses the file's render-then-effect-flush boundary before readiness-sensitive interactions. No production file was changed for this harness issue.
  implication: The disabled controls were caused by test mount/effect settlement, not an Insert/Duplicate/Paste/Save production assertion divergence.

- timestamp: 2026-07-13T11:46:00Z
  checked: Post-correction durable and focused verification
  found: `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts` passes 23/23 in one complete run, covering immediate A/B/C, existing Paste and Save, distant Insert/reversal/persistence, and Duplicate. Focused session/controller passes 42/42; reference controller passes 3/3; `pnpm --dir app typecheck` passes; `git diff --check` passes.
  implication: The durable harness readiness blocker is cleared for the required single complete run and focused production seams remain green.

- timestamp: 2026-07-13T11:47:00Z
  checked: Full Physics Paint matrix after durable stabilization
  found: The matrix stops on two source-contract assertions in `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`: one still requires the old `syncRotoKeyFrameLists(refreshedCacheFrames.length > 0 ? refreshedCacheFrames : transaction.realKeyFrames)` text, and one still requires `input.restoreFrame(effect)`, while the intentional production correction now calls `input.restoreFrame(effect, refreshedCacheFrames)`. These are assertion failures, not disabled-control/readiness failures. Per the stop condition, they were preserved rather than weakened or papered over. Build was not rerun after this stopping failure; the earlier 11:20 build remains green.
  implication: Status remains verifying. Native UAT readiness cannot be represented as a fully green matrix until the production source-contract expectations are deliberately reconciled outside this harness-only correction.

- timestamp: 2026-07-13T11:53:00Z
  checked: Final source-contract reconciliation, durable harness verification, and complete repository gates
  found: Workflow source contracts now require the authoritative `publishedFrames` variable and `input.restoreFrame(effect, refreshedCacheFrames)` call. The complete durable file passes 23/23 in isolation. Focused session/controller/reference seams pass 45/45. The exact Physics Paint matrix passes 40 files / 509 tests, including the two new immediate canvas-payload regressions beyond the prior 507 count. Typecheck passes, production build passes with 1086 modules, and `git diff --check` passes.
  implication: The remaining immediate Insert/Duplicate canvas-refresh issue is automated-ready for another native visible UAT. No automated blocker remains; acceptance is intentionally pending native confirmation.

- timestamp: 2026-07-13T14:36:00Z
  checked: Exact rendered native-UAT regression for Insert at display 0 with interpolation count 2 and source paint 0[A], 1[B], 2[C]
  found: `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts -t "Debug 07 reopened RED 6"` failed deterministically. Durable source keys were already `[0,1,2,3]`, source 3 already owned A, but the first rendered click on display 3 sent C to `setPreviewBaseImageUrl`; expected `debug-07-immediate-A`, received `debug-07-immediate-C`. Navigating to display 6 and then back to display 3 repaired the canvas to A.
  implication: The transaction/store mutation is canonical before the failure. The first divergent symbol is `findCachedRotoDisplayFrame()` selecting `input.previewFrames.get(3)` ahead of the refreshed projected cache. `applyRotoKeyUtilityTransactionToLocalState()` had populated that transient map with every durable transaction key keyed by source frame, so source 3=C shadowed projected display 3=A. The repair event is a later render/navigation after transient ownership is rebuilt. The minimal correction is to stop publishing durable `transaction.realKeyFrames` into the transient preview map while preserving genuine moved/copied local preview ownership.

- timestamp: 2026-07-13T15:05:00Z
  checked: Native UAT for the targeted Debug 07 Insert/Duplicate/Delete slices
  found: All requested scenarios passed: Insert at displays 0, 3, and 6 with immediate Delete; Duplicate C from interpolation ON and OFF with immediate Delete; distant Duplicate from OFF and ON with Delete; distant Insert/Delete non-regression; and reopen/persistence/hydration/ON-OFF parity. Native UAT also confirmed immediate action availability, immediate canonical canvas payloads without repair navigation, correct Delete targeting, and preservation of distant custom interpolation anchors through Duplicate and Delete.
  implication: The targeted Insert/Duplicate/Delete slices and their resolved source/display, action-target, override, and persistence causes are native-UAT accepted.

- timestamp: 2026-07-13T15:05:00Z
  checked: Complete Debug 07 contract audit before commit
  found: Generated-frame Copy blocking is covered at controller, session, and rendered-control levels. Normal and custom Paste are covered through rendered Studio interaction, persistence, hydration, reopen, and ON/OFF projection. Generic Delete touching one custom segment is covered automatically (`36.13 D-11`), but no accepted native UAT was recorded at audit time. Automated coverage was absent for a source key touching two custom segments and for deleting a source key outside an unrelated custom segment.
  implication: Complete acceptance required focused native UAT for the three generic Delete topologies before commit.

- timestamp: 2026-07-13T15:04:00Z
  checked: Final complete native UAT acceptance and repository verification
  found: Native UAT passed compact projected Insert, immediate Delete after Insert, Duplicate ON/OFF, immediate Delete after Duplicate, distant Insert/Duplicate and reversal Delete, direct Delete touching one custom segment, direct Delete touching two custom segments, direct Delete outside a custom segment, override removal/rebasing, generated-frame Copy blocking, reusable normal/distant Paste, immediate canvas/action availability, ON/OFF parity, close/reopen, persistence, and hydration. The user confirmed no delayed availability, repair navigation, wrong Delete target, lost distant anchor, or paint/cache identity corruption. Final gates pass: focused Debug 07 190/190; rendered durable 30/30; complete Physics Paint 37 files / 490 tests; typecheck; production build with 1086 modules; git diff --check.
  implication: Complete Debug 07 — Key Utilities and Overrides is resolved and native-UAT accepted. It is safe to create the requested atomic commit and stop before Debug 08.

## Resolution

root_cause: "The immediate canvas issue came from two source/display boundary leaks. Immediate restore could consume pre-publication projection state, and after Insert the local-state transaction path also copied every durable source-domain real key into the transient display-domain preview map. With source 0[A],1[B],2[C] inserted at 0, previewFrames[3]=source 3[C] shadowed the refreshed projected cache where display 3 correctly owned shifted A. The reopened destructive Duplicate failures had two additional exact causes: the session treated Duplicate like Insert and preserved the old selected display instead of selecting the newly created source key's projected display; and the Duplicate transaction generically rebased a custom override endpoint from the copied source to the new duplicate. Insert/Delete persistence was awaited inline, so rendered action availability stayed busy until the bridge completed."
fix: "Carry refreshed cache truth into immediate restore; keep durable transaction keys out of transient preview ownership while preserving genuine moved local previews; publish restore.frame as launch-context selection; resolve Duplicate's new source through the canonical post-transaction projection while retaining Insert's selected-display behavior; preserve a duplicated source's existing custom override endpoint; and dispatch key persistence asynchronously with existing error handling so local canonical selection/action availability is immediate. No effects, timers, polling, sleeps, forced remounts, artificial navigation, mirrored frame arrays, or hook sprawl were added."
verification: "RED evidence captured source/display publication leaks, stale immediate canvas payloads, destructive stale Delete targeting, lost distant override anchors, and persistence-delayed action availability before correction. Final automated gates pass: focused Debug 07 190/190; rendered durable interactions 30/30; complete Physics Paint 37 files / 490 tests; typecheck; production build with 1086 modules; git diff --check. Complete native UAT accepted all targeted and generic Insert/Duplicate/Delete, override, Copy/Paste, immediate refresh, ON/OFF, persistence, hydration, and reopen scenarios. Debug 07 is resolved and native-UAT accepted."
files_changed:
  - app/src/components/physic-paint/roto/physicsPaintRotoSession.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts
  - app/src/lib/physicPaintRotoDurableCore.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - .planning/debug/debug-07-insert-overrides.md
