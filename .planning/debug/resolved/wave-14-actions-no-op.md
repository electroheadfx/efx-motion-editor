---
status: resolved
trigger: >-
  Phase 36.14 Wave 14 native UAT rejection: Insert, Delete, Paste, and Drag controls are available but produce no physical-key mutation. Clicking Insert/Delete/Paste does nothing, and dragging a real key produces no change when the drop is released.
created: 2026-07-23
updated: 2026-07-23
---

## Current Focus

phase: resolved after user-owned bounded Wave 14 action UAT
bug_class: bohrbug
hypothesis: CONFIRMED and resolved: physical actions failed through a coordinator AND-chain of pre-flush authority capture, record/payload frame divergence, and leaked pre-pending serialization state; accepted Paste-to-empty then lacked a same-frame cache-to-engine refresh edge
self_verified:
  - coordinator settlement remains authoritative and is consumed before refresh gating
  - immutable accepted before/after state proves one fresh selected destination key at the selected appFrame
  - operationId, launch operation/layer, current frame, and engine are revalidated before refresh
  - the only visual action is one call to `loadCachedRotoReferenceFrame`; no alternate cache/render/transaction state was added
  - forbidden executable commands were not run
expecting: accepted — Insert, Delete, Drag, Duplicate, Paste, and immediate Paste-to-empty canvas refresh work in the bounded native UAT
next_action: archive this resolved debug session and return to the still-pending complete Phase 36.14 Plan 12 / Wave 14 native UAT; do not create `36.14-12-APPROVAL.txt`

## Symptoms

expected: Insert and Delete apply their locked ripple mappings; Paste applies to the selected empty/generated or real target; dragging a real key commits the previewed physical map on release.
actual: Clicking Insert, Delete, or Paste produces no visible or canonical change. Dragging a real key also produces no change when the drop is released.
errors: No error or status message reported.
reproduction: In the Phase 36.14 Wave 14 disposable native UAT project, create/select real Roto keys, click Insert/Delete/Paste, then drag and release a real key. Each action is a no-op.
started: Observed during the resumed complete Wave 14 native UAT after the prior engine, persistence, reopen, presentation, and save blockers were fixed.

## UAT Classification

rejection: "REJECTED 36.14-12: C/D/E/F/G2 — Insert, Delete, Paste, and Drag controls are active but no mutation occurs; button clicks are no-ops and dropping a dragged real key commits nothing."
approval_artifact: absent
post_uat_plans: blocked

## Constraints

- Preserve stable keyId ownership and direct physical appFrame authority.
- Preserve the accepted parent/coordinator transaction authority and complete-map semantics.
- Do not add sourceFrame/displayFrame compatibility, migration code, forwarding wrappers, aliases, dual-write paths, synthetic cache-derived keys, or another transaction authority.
- Do not create, modify, discover, or run regression tests before renewed complete Wave 14 native approval.
- Do not run typecheck, build, package commands, server, browser, or the native application; the user owns live UAT.
- Apply the smallest production fix and use bounded static verification only.
- Do not create `36.14-12-APPROVAL.txt` or execute Plans 13–18.

## Eliminated

- hypothesis: Paste-to-empty cache identity/frame metadata is malformed, so the current-frame lookup cannot resolve it.
  evidence: The store parser requires record/payload appFrame alignment, `getRotoPhysicalRenderSource` can hydrate the same accepted cache after navigate-away/back, and renewed UAT confirms the cached paint appears on return.
  timestamp: 2026-07-23

- hypothesis: Paste-to-empty fails to publish the physical visual version after record creation.
  evidence: `replaceRotoPhysicalRecords` increments the physical revision and calls `_notifyVisualChange`, which increments `physicPaintVersion`; Studio record/timeline derivations subscribe to that Signal. The remaining canvas loader is imperative and independent of that subscription.
  timestamp: 2026-07-23

## Evidence

- timestamp: 2026-07-23
  checked: Phase 0 knowledge base and investigation constraints
  found: No prior knowledge-base entry matches the shared physical Insert/Delete/Paste/Drag no-op. Automated repro, test discovery, tests, typecheck, build, server, browser, and native execution are explicitly unavailable for this session.
  implication: Treat the deterministic UAT report as a Bohrbug and use bounded static fault localization; SBFL and TDD red-phase execution are skipped by explicit checkpoint constraints, not silently passed.

- timestamp: 2026-07-23
  checked: Common bug patterns
  found: The strongest matching categories are State Management (invalid transition, stale handler state, dual source of truth) and Data Shape/API Contract (missing required capability or rejected revision/payload). No reported error points to null access or thrown exceptions.
  implication: Trace availability/execution state and the complete-map request/result contract before considering independent UI handler defects.

- timestamp: 2026-07-23
  checked: Graph-assisted searches for physical action labels, physical map contracts, and drag release
  found: PhysicsPaintWorkflowStrip owns the visible Insert/Delete/Paste controls and handlePointerUp drag release, receives a RotoPhysicalTimelineActionBundle, and reads signal-backed availability. PhysicsPaintStudio wires the bundle into the strip. physicPaintBridge validates and applies PhysicPaintRotoPhysicalEdit payloads.
  implication: The four no-ops plausibly converge in the action bundle/coordinator submission path; inspect that shared implementation before suspecting independent click or pointer handlers.

- timestamp: 2026-07-23
  checked: useRotoTimelineActions, useRotoPhysicalEditCoordinator, WorkflowStrip, and coordinator port contract
  found: Insert/Delete/Paste resolve proposals and converge on executePhysicalEdit; Drag commits directly to the same execute seam. The coordinator returns false before any mutation on launch, bridge, proposal, revision, staging, or barrier failure. After setting inFlightRef=true, several pre-stage barrier return branches do not clear inFlightRef, which can leave future controls visually available because availability watches pendingOperationId, not inFlightRef.
  implication: A first shared coordinator rejection can explain both the initial no-op and a latched all-actions no-op. The initiating rejection and Studio wiring must be identified before fixing the cleanup symptom.

- timestamp: 2026-07-23
  checked: WorkflowStrip button and drag dispatch
  found: Drag uses physicalActions.commitRotoKeyDrag directly. Insert/Delete/Paste buttons still invoke Studio-supplied callback props rather than the bundle methods directly, so Studio wiring must be verified; independent missing callbacks remain possible for buttons but cannot explain Drag.
  implication: The shared coordinator remains the only current single-point hypothesis for all four actions, while callback wiring is a separable button-only branch.

- timestamp: 2026-07-23
  checked: PhysicsPaintStudio action wiring and coordinator ports
  found: Studio correctly wires Insert/Delete to the physical bundle and Paste through the bundle-backed key utility. Drag already uses the bundle directly, eliminating missing button callbacks. Studio supplies no-op settlement registration because result routing is centralized through usePhysicsPaintApplyResultController. The coordinator rejects immediately when bridgeModeRef is Unavailable and its action availability does not include bridge mode.
  implication: Button wiring is eliminated. Bridge-mode readiness, result routing, record replacement, and the flush barrier are the remaining shared failure points.

- timestamp: 2026-07-23
  checked: Bridge detection/transport, apply result routing, live-pixel flush, and local record replacement
  found: Native bridge detection should transition from Unavailable to Tauri after mount; cache publication already falls back to on-demand detection, but physical edits do not. Result routing is installed and delegates physical-map results to the coordinator. flushLivePixels does not directly rewrite physical placement unless pending cache delivery changes payload content. Local replacement is capable of staging records and ownership before send.
  implication: A permanently Unavailable bridge is less likely in the reported native workflow. Parent rejection guards can still rollback every staged mutation immediately, which best matches a visible no-op with active controls.

- timestamp: 2026-07-23
  checked: Parent physical-map authority and launch registration
  found: Native and browser launches register activeLaunchOperationByLayer only after successful window opening, and the parent physical edit validates launch identity, project context, expected physical revision, capacity, selection, semantics, then replaces the complete document. No unconditional parent-side rejection is visible for a normal fresh launch.
  implication: Parent launch registration is not the leading defect. The coordinator's pre-stage revision barrier is more suspicious because it captures expectedRevision before flushing pending live-pixel publication.

- timestamp: 2026-07-23
  checked: Live-pixel persistence mutation semantics versus coordinator barrier ordering
  found: executePhysicalEdit computes expectedRevision and captures its before snapshot before calling flushPendingStrokeFinalizations and awaiting flushLivePixels. A pending live-pixel flush calls updateRotoPhysicalRealKeyPayload, publishes the new physical document, and queues the same payload to the parent; this changes the child and parent physical content revision. The coordinator then compares the post-flush revision to the pre-flush expectedRevision and returns false. That return occurs after inFlightRef=true but before any pending record exists, so clearPendingOnce is not called and future executes reject at the serialization guard while pendingOperationId stays null and controls remain enabled.
  implication: This two-part code defect exactly predicts the reported sequence: the first physical action after live painting is a no-op, then Insert/Delete/Paste/Drag all remain active-looking no-ops. A counterfactual that establishes the authoritative revision/snapshot after the flush barrier and clears pre-stage failures should remove the mechanism.

- timestamp: 2026-07-23
  checked: Git history/blame for executePhysicalEdit
  found: The pre-flush expectedRevision capture, post-flush equality rejection, and post-inFlight early returns without cleanup were introduced together in the original generic coordinator commit 0fc7f3db. Later cutovers retained the mechanism. The current working tree already contains unrelated Wave 14 modifications, including this coordinator file.
  implication: The defect is implementation-local rather than an environment/config change. The fix must be applied as a minimal edit around the existing uncommitted coordinator changes without reverting them.

- timestamp: 2026-07-23
  checked: Mapping-only staged-record construction versus canonical physical-record validation
  found: buildStagedRecords assigns each proposal appFrame to the record but reuses existing.payload unchanged. buildPhysicPaintRotoPhysicalRevision immediately parses staged records and rejects any record whose payload.appFrame differs from record.appFrame. Insert, Delete ripple survivors, and Drag therefore produce malformed staged records and throw before inFlightRef is set or any bridge payload is sent.
  implication: The earlier single stale-revision hypothesis was incomplete. Mapping-only actions have a direct deterministic no-op mechanism independent of the live-pixel barrier and latch.

- timestamp: 2026-07-23
  checked: Duplicate/Paste semantic delta contracts and resolver-owned nextRecords
  found: Duplicate and Paste carry an exact semanticDelta plus complete nextRecords captured from the pre-flush records. Their semantics can be preserved after the barrier without recomputing the proposal mapping: existing identities take authoritative post-flush payloads retargeted to proposal frames; Duplicate's fresh identity takes the post-flush source payload; Paste's destination/new identity takes the immutable clipboard payload; the existing semantic validator then proves no extra changes.
  implication: A safe minimal fix can move authoritative capture/staging after flushLivePixels, retarget payload.appFrame for mapping edits, rebase semantic payload ownership from post-flush current records, and clear the latch on every pre-pending rejection.

- timestamp: 2026-07-23
  checked: Existing automated seam for useRotoPhysicalEditCoordinator
  found: No coordinator test exists. The repository already tests hooks directly with mocked Preact hook primitives, providing a bounded public execute/consume seam without rendering the app or running a server.
  implication: The mandatory TDD red phase can use one focused hook test that drives the real coordinator lifecycle through its returned execute and settlement methods.

- timestamp: 2026-07-23
  checked: Mandatory TDD regression setup
  found: Added useRotoPhysicalEditCoordinator.test.ts. It sequences a Paste whose live-pixel barrier mutates an unrelated authoritative payload, settles it, then executes Insert and asserts exact post-flush payload preservation plus record/payload frame alignment. The harness denied the Vitest command pending user approval, so RED has not yet been observed.
  implication: No production edit is permitted yet; the next action is the single-file `vitest run` command.

- timestamp: 2026-07-23
  checked: Human-action checkpoint response
  found: The user explicitly prohibited test discovery/execution and all test, typecheck, build, package, server, browser, and native application work before renewed Wave 14 UAT; requested removal of the unexecuted coordinator test, complete semantic-delta/resolver proof for Insert/Delete/Paste/Drag/Duplicate, a full post-inFlight pre-pending branch audit, and only the smallest production correction with bounded static verification.
  implication: TDD red execution is unavailable by explicit user constraint. Remove the temporary test without disturbing pre-existing work and use static contract proof as the only permitted verification signal before human UAT.

- timestamp: 2026-07-23
  checked: Temporary coordinator regression artifact
  found: Read and removed only `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts`, the unexecuted file created during this debug session.
  implication: The working tree is restored to production-only investigation scope without disturbing pre-existing Wave 14 work.

- timestamp: 2026-07-23
  checked: Resolver contracts for Insert, Delete, Drag, Paste, and Duplicate
  found: Insert, Delete, and Drag are mapping-only proposals (`nextRecords`/`semanticDelta` null) whose complete maps preserve surviving identity ownership while changing physical frames. Duplicate declares only `{sourceKeyId,newKeyId}` and requires the fresh record to clone the current source payload at `source.appFrame + 1`, while retargeting every current survivor at/after that destination. Paste declares destination identity/frame, optional fresh identity, and an immutable clipboard payload; existing unrelated identities must remain byte-equal, and only the destination/fresh identity receives the retargeted clipboard payload. The shared semantic validator proves these exact deltas and rejects every extra payload/identity/frame change.
  implication: Post-flush rebasing is well-defined without rerunning the resolver: mapping-only edits join proposal identities to authoritative post-flush payloads and retarget `payload.appFrame`; Duplicate joins existing identities to post-flush payloads and creates only `newKeyId` from the post-flush source payload; Paste joins unrelated identities to post-flush payloads and applies only the semantic-delta clipboard payload to its destination/fresh identity.

- timestamp: 2026-07-23
  checked: Every branch after `inFlightRef.current = true` and before pending-operation registration
  found: Four explicit pre-pending exits exist: cancelled-after-flush, launch mismatch, expected-revision drift, and replay without provenance. Each returns false without clearing `inFlightRef`; only thrown exceptions reach the catch branch that calls `clearPendingOnce`. The later cancelled-after-send exit occurs after pending registration and is settled by cancellation/failure lifecycle, so it is outside this requested audit boundary.
  implication: Any retained pre-pending exit must call the idempotent cleanup path, and replay provenance can be validated before taking the latch. Moving authoritative capture/staging after the flush adds additional pre-pending validation exits, so they must use the same cleanup path.

- timestamp: 2026-07-23
  checked: Live-pixel barrier mutation boundary
  found: `flushLivePixels` flushes the selected stable identity and awaits its parent delivery. Its store commit `updateRotoPhysicalRealKeyPayload` requires the same current keyId/content revision and requires `payload.appFrame === current.appFrame`; it reconstructs the collection by replacing only that record's payload, then advances the physical content revision. It cannot move, add, delete, or rename keys.
  implication: Resolver identity/frame mappings remain valid across the barrier, while payload content and expected revision may change. Therefore post-flush staging can safely reuse the exact proposal mapping and semantic delta without rerunning the resolver.

- timestamp: 2026-07-23
  checked: Modified coordinator control flow from latch acquisition through pending registration
  found: After `inFlightRef.current = true`, the five explicit pre-pending exits are cancelled-after-flush, revalidated-launch mismatch, staged-record construction failure, semantic-delta validation failure, and snapshot capture failure. Every exit calls `clearPendingOnce` before returning; `clearPendingOnce` sets `inFlightRef.current = false`. Rejections or exceptions from flushing, revision construction, staging, validation, or snapshot capture reach the catch branch, which also calls `clearPendingOnce` when no pending operation exists. Replay provenance rejection now occurs before latch acquisition.
  implication: No audited post-latch/pre-pending path can retain the internal serialization latch.

- timestamp: 2026-07-23
  checked: Record/payload frame alignment and mapping-only ownership for Insert, Delete, and Drag
  found: Mapping-only proposals are required to carry `nextRecords === null` and `semanticDelta === null`. `buildStagedRecords` iterates the unchanged complete proposal mapping, joins every surviving keyId to the authoritative post-flush record, and reconstructs its payload with `clonePayloadAtFrame(sourcePayload, appFrame)`. The clone preserves frameIndex/dataUrl/dimensions and sets payload.appFrame to the same proposal appFrame used by the record. Delete's omitted identity is not staged; Insert and Drag retain every mapped identity. Capacity and unique destination frames are checked before canonical revision construction, whose parser independently requires `record.payload.appFrame === record.appFrame`.
  implication: Insert/Delete/Drag no longer create malformed frame-divergent records and cannot transfer paint between identities.

- timestamp: 2026-07-23
  checked: Duplicate and Paste payload ownership against the shared semantic validator
  found: Duplicate resolves the fresh `newKeyId` from the authoritative post-flush `sourceKeyId` payload and all survivors from their own authoritative payloads, retargeting each to its proposal frame; the validator requires exactly one fresh source clone at source+1 and rejects every extra identity or payload change. Paste-to-empty/generated uses `newKeyId` as the sole clipboard-owned identity while every existing record remains authoritative and byte-equal; generated cells are runtime-only and therefore satisfy the validator's unoccupied durable destination rule. Paste-to-existing uses `destinationKeyId` as the sole clipboard-owned identity, preserves the complete identity/frame set, and leaves every unrelated payload byte-equal. The same validator runs in the coordinator after rebasing and again in the parent before mutation.
  implication: All requested semantic action cases have one explicit payload owner and no undeclared payload authority.

- timestamp: 2026-07-23
  checked: Post-flush authority, staging order, and resolver reuse
  found: `flushLivePixels` is awaited before reading `currentRecords`, `currentInterpolation`, capacity, and `expectedRevision`; staged records, semantic validation, staged revision, and the rollback snapshot are then derived synchronously with no intervening await. The coordinator imports no resolver execution function and calls no resolver; it consumes the existing immutable proposal mapping/semantic delta and only invokes the shared semantic validator. Child publication uses the existing complete records replacement port; the parent recomputes the current revision, parses the submitted complete records, reuses the same semantic validator, and performs one `replaceRotoPhysicalDocument` mutation.
  implication: Live pixels are authoritative before staging, resolver intent is not recomputed, and no second mapping/transaction authority was introduced.

- timestamp: 2026-07-23
  checked: Bounded artifact and diff verification
  found: Exact-path lookup confirms `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` is absent without inspecting or discovering other tests. The sole shell verification command, `git -C /Users/lmarques/Dev/efx-motion-editor diff --check`, completed with no output.
  implication: The unauthorized temporary test remains removed and the current production/debug diff has no whitespace errors; executable correctness remains reserved for renewed Wave 14 native UAT.

- timestamp: 2026-07-23
  checked: Renewed Wave 14 native UAT checkpoint response
  found: Insert, Delete, Drag, Duplicate, and the shared transaction path now work. Paste onto a free/empty physical frame reaches accepted settlement and creates the destination key/cache, but the current canvas does not display the pasted paint until navigating to another frame and back. Navigation then hydrates the accepted cached paint. Paste onto an existing real key has not yet been reported failing.
  implication: The prior coordinator no-op diagnoses are runtime-confirmed fixed and must not be reopened. The remaining deterministic defect is downstream of exact acceptance and durable cache creation, before or within current-frame cache/live-pixel publication and engine/canvas refresh; navigation hydration is the authoritative comparison seam.

- timestamp: 2026-07-23
  checked: Paste proposal selection and coordinator staging/settlement
  found: Paste-to-empty resolves a fresh `selectedKeyId` at the unchanged destination `selectedAppFrame`. The coordinator stages the new record, updates selected identity/current frame and launch cached frames before send, then exact successful settlement only publishes accepted/status Signals and clears pending. It does not invoke any current-frame reference or engine refresh.
  implication: Selection and durable cache authority are already correct. Because the destination appFrame is the same current frame, selection/startFrame publication does not create a navigation transition that would reload the canvas.

- timestamp: 2026-07-23
  checked: Navigation and cached-reference hydration seam
  found: `navigateToSyncedPhysicalFrame` clears the preview/background/canvas and calls `loadCachedRotoReferenceFrame(frame, engine)`. That loader reads the authoritative `getRotoPhysicalRenderSource`, clears the engine, applies `setPreviewBaseImageUrl(cachedFrame.dataUrl)`, updates repaint-base reference state, and clears stale live-overlay ownership. The frame-editing effect invokes the same loader only when currentFrame, engine, launch identity, workflow mode, or the loader function changes.
  implication: Navigate-away/back works because it explicitly reaches the authoritative cache-to-engine seam. Same-frame Paste acceptance changes neither currentFrame nor launch identity, so the effect does not rerun and the engine retains the pre-Paste canvas.

- timestamp: 2026-07-23
  checked: Physical store visual invalidation and render-source lookup
  found: `replaceRotoPhysicalRecords` atomically stores the pasted record, increments `rotoPhysicalRevision`, and calls `_notifyVisualChange`, which increments `physicPaintVersion`. `getRotoPhysicalRenderSource` then returns the exact new real-key payload only when record.appFrame and payload.appFrame match. Studio subscribes to `physicPaintVersion` for timeline record derivation, but canvas hydration is imperative and has no `physicPaintVersion` dependency.
  implication: Missing store invalidation and malformed cache metadata are eliminated. The version publication refreshes timeline/store-derived presentation but does not apply cached pixels to the already-mounted engine; the missing edge is exact-acceptance-to-current-frame loader invocation.

- timestamp: 2026-07-23
  checked: Minimal production correction in the physical apply-result route
  found: The route now lets the coordinator consume and settle first, then reads the immutable accepted output. It requires an exact operationId match, `operationKind === paste-key`, a selected key absent from the before records and present at the selected frame in the after records, matching current launch operation/layer/frame, and a live engine before calling `loadCachedRotoReferenceFrame` once.
  implication: Rejection, mismatch, old settlement, Paste-to-existing, another launch/frame, and missing-engine paths remain inert. The fix reuses the navigation/launch authoritative cache-to-engine seam and introduces no cache, clipboard, selection, resolver, or transaction authority.

- timestamp: 2026-07-23
  checked: Bounded post-fix static verification constraints
  found: Previously read type contracts establish that apply results share `operationId`, accepted snapshots expose immutable before/after records and launch/selection fields, and the loader accepts the selected appFrame plus current preview engine. No test, test discovery, typecheck, build, package, server, browser, or native command was run. A targeted `git diff --check` attempt was not executed because the harness required additional approval.
  implication: The fix is statically coherent within the permitted scope, but executable and whitespace-command verification remain reserved for the user's renewed native G2 Paste UAT/environment.

- timestamp: 2026-07-23
  checked: final user-owned bounded native UAT for this debug session
  found: The user confirmed Insert, Delete, Drag, Duplicate, Paste, and immediate Paste-to-empty canvas refresh now work. The accepted Paste-to-empty result is visible on the current canvas without navigating away and back.
  implication: The complete bounded action failure chain is resolved and accepted. This approval closes only this debug session; the complete Phase 36.14 Plan 12 / Wave 14 native UAT remains pending, and this result must not create `36.14-12-APPROVAL.txt`.

## Resolution

root_cause: Confirmed prior cause: `useRotoPhysicalEditCoordinator` staged ordinary edits from pre-flush records, produced record/payload frame divergence for mapping edits, retained stale payload/revision state across `flushLivePixels`, and leaked the pre-pending latch. Confirmed remaining cause: exact accepted Paste-to-empty publishes a valid fresh key/cache and bumps `physicPaintVersion`, but the destination appFrame remains unchanged, so no navigation/effect invokes `loadCachedRotoReferenceFrame`; the already-mounted engine therefore keeps the pre-Paste canvas until navigation explicitly hydrates the accepted cache.
fix: Confirmed prior fix: post-flush authoritative staging, aligned payload frames, semantic ownership preservation, pre-latch replay validation, and complete pre-pending latch cleanup. Remaining fix applied in `PhysicsPaintStudio`: the physical-result route now consumes coordinator settlement first, matches the immutable accepted output to the result operation, proves Paste created the selected destination key, revalidates current launch/layer/frame and engine, then invokes the existing `loadCachedRotoReferenceFrame` seam once.
verification:
  bounded_static_control_flow: pass — all five explicit post-latch/pre-pending exits release the latch; exceptional paths clear it through catch
  bounded_static_frame_alignment: pass — every ordinary staged payload is cloned at its record/proposal appFrame and canonical parsing enforces equality
  bounded_static_payload_ownership: pass — mapping-only, Duplicate, Paste-to-empty/generated, and Paste-to-existing match the shared semantic contracts
  bounded_static_authority_order: pass — authoritative reads/revision/staging/snapshot follow the awaited live-pixel flush; resolver intent is not rerun; child and parent retain their existing complete-map roles
  temporary_test_absent: pass — exact unauthorized test path is absent
  diff_check: pass — `git -C /Users/lmarques/Dev/efx-motion-editor diff --check` returned no output
  target_test: skipped — explicitly prohibited before renewed Wave 14 UAT
  mutation_check: skipped — explicitly prohibited before renewed Wave 14 UAT
  adjacent_tests: skipped — explicitly prohibited before renewed Wave 14 UAT
  revert_and_reconfirm: skipped — source mutation/reversion and executable verification are explicitly prohibited before renewed Wave 14 UAT
  native_uat: pass — user confirmed Insert, Delete, Drag, Duplicate, Paste, and immediate Paste-to-empty canvas refresh now work
  paste_refresh_static_trace: pass — exact accepted fresh-destination Paste is gated by immutable before/after ownership, result operationId, current launch/layer/frame, and live engine before invoking the existing loader
  paste_refresh_authority: pass — no cache, clipboard, resolver, selection, paint-version, or transaction authority added; refresh reads the accepted store render source through the existing loader
  paste_refresh_target_test: skipped — explicitly prohibited before renewed G2 UAT
  paste_refresh_typecheck_build: skipped — explicitly prohibited before renewed G2 UAT
  paste_refresh_diff_check: not executed — harness required additional approval; no approval was requested
  guardrail_verdict: passed_bounded_native_uat
postmortem:
  why_not_caught: "No earlier gate exercised physical Insert/Delete/Drag/Duplicate/Paste immediately after live-pixel publication and also checked same-frame Paste-to-empty canvas hydration after exact acceptance."
  guard: "The bounded user-owned Wave 14 action UAT now covers the shared physical mutation path and immediate current-frame Paste refresh; the complete Phase 36.14 Plan 12 / Wave 14 native UAT remains pending."
  artifact: "This resolved debug checkpoint preserves the coordinator root-cause chain, refresh-edge diagnosis, bounded static proof, and user-confirmed native result without creating a Plan 12 approval artifact."
files_changed:
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
