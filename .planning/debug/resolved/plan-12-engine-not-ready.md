---
status: resolved
trigger: >-
  Phase 36.14 Plan 12 native UAT blocker. In a new disposable project, Physics Paint displays "Engine not ready" in the top-right status area. Painting remains visible on the canvas but does not create or persist a usable real Roto key, the key is not represented correctly in the timeline, and frame navigation becomes blocked.
created: 2026-07-22
updated: 2026-07-23
---

## Current Focus

phase: resolved after user-owned native end-to-end UAT
bug_class: bohrbug
hypothesis: CONFIRMED and resolved: the blocker was an AND-chain across canonical launch transport, first-key ownership/settlement lifetime, Rust project persistence, reopened-key presentation, and FX-only timeline extent; the final user-owned native UAT confirms the complete corrected chain.
known_runtime_truths: green-key presentation, physical records, caches, hydration, navigation, and project reopen are confirmed and must not be reopened
reasoning_checkpoint:
  hypothesis: "The save rejection is caused by the FX-only timeline reporting zero frames; range-move clamping subtracts the 100-frame duration after setting the end to zero, creating `inFrame = -100`, and project serialization passes it unchanged to Rust `u32`."
  confirming_evidence:
    - "The actual saved project contains one 0..100 Physics Paint FX sequence and no content key photos, audio, images, keyframes, or typed cached frames."
    - "Canonical `roto_physical` is `serde_json::Value` and canonical `frames` is empty, eliminating every nested Physics/Roto `u32` member from command deserialization."
    - "`frameMap` computes target length 100 but cannot append without a content `tailEntry`, so `totalFrames = frameMap.length` remains 0."
    - "The production move branch deterministically computes `newOut = 0` then `newIn = newOut - duration = -100` for the persisted 100-frame range."
  falsification_test: "A source path showing a different reachable typed `u32` field in this exact project can become -100, or showing `totalFrames` already returns the 100-frame required extent without a content tail, would falsify this hypothesis. Exhaustive field mapping and the current implementation show neither."
  fix_rationale: "Define exported timeline length from the existing all-sequence required-frame calculation instead of the materialized content-frame array length. This corrects the upstream zero bound for FX-only projects, so the existing range clamp remains inside its unsigned domain; it does not sanitize the save payload or widen Rust to accept invalid state."
  blind_spots: "The exact live JavaScript payload cannot be inspected under the static-only checkpoint; renewed user-owned native UAT must confirm save succeeds after the source correction."
  candidate_causes:
    - "code: exported `totalFrames` ignores the already-derived FX/Physics Paint extent when no content frame exists"
    - "data: the project contains only a 100-frame Physics Paint FX sequence, so `frameMap` has no tail content entry to extend"
  and_gate: "yes — the invalid -100 requires the FX-only/no-content shape plus a range pointer move that applies the zero bound to a 100-frame bar; the code defect is the incorrect zero derived length under that valid project shape"
test: bounded source audit that `totalFrames` returns `getTimelineRequiredFrameCount(...)` for the FX-only shape and that the move branch then receives 100 rather than 0
expecting: the 0..100 range remains 0..100 under a zero-delta move, so `buildMceProject` cannot emit the observed negative `in_frame`
constraints: do not create, modify, discover, or run tests; do not run typecheck, build, package, server, browser, native app, or native commands; preserve stable keyId/direct appFrame and canonical authority; no clamp, compatibility, migration, aliases, wrappers, or dual writes; bounded static verification only
next_action: archive this resolved debug session and return to Phase 36.14 Plan/Wave 14 UAT

## Reopen Trace Collection

1. Rebuild and relaunch the native app using the normal UAT workflow.
2. In the **main** window DevTools Console, enable **Preserve log**, clear once, and filter for `[PP-REOPEN]`.
3. Open the already-saved project `/Users/lmarques/Desktop/efx-motion-editor-project-test/test-phase-36/test-phase-36.mce`, then open the affected Physics Paint layer once. Do not paint, navigate, save, close/reopen the layer, or perform any other Physics Paint action.
4. In the **efx-physic-paint** window DevTools Console, filter for `[PP-REOPEN]` and copy the `child-hydration-install` and `timeline-projection` lines. Copy the matching `parent-launch-delivery` line from the main console.
5. Return exactly those three correlated lines plus whether the previously persisted green real-key markers at app frames 0, 1, 4, and 8 are visible.

## Symptoms

expected: A new project initializes Physics Paint; the first painted Roto key becomes a selectable, persistent real physical key represented immediately in the timeline; navigation remains available; save and reopen preserve the key and paint payload.
actual: Physics Paint shows "Engine not ready"; paint remains visible on the canvas, but no usable canonical real Roto key is created or persisted, timeline representation is incorrect, and physical-frame navigation becomes blocked.
errors: "Engine not ready" in the top-right Physics Paint status area.
reproduction: Create a new disposable project, launch Physics Paint, paint the first Roto key, inspect the timeline and attempt physical-frame navigation, then save and reopen.
started: The new-project first-key path has never been validated since the physical-frame cutover.

## Investigation Scope

- Trace engine-readiness initialization for a new project and Physics Paint launch.
- Trace the first painted-key mutation through live-pixel publication, physical-record creation, persistence, timeline derivation, and navigation availability.
- Identify why visible canvas paint exists while the canonical physical key is absent or unusable.
- Determine whether "Engine not ready" is the cause or a downstream symptom.

## Constraints

- Preserve the Phase 36.14 stable keyId/direct appFrame model and accepted coordinator authority.
- Do not add sourceFrame/displayFrame compatibility, migration code, forwarding wrappers, aliases, dual-write paths, or another timing/transaction authority.
- Old-project compatibility is out of scope; reproduce and fix only the new-project path.
- Do not modify or run regression tests before renewed Plan 12 native approval. Tests remain assigned to Plans 13–14.
- Do not start the server or native application; the user owns live UAT.
- Apply the smallest production fix and use only plan-authorized bounded static verification.
- Stop for renewed native UAT.
- Do not execute Plans 13–18 or create 36.14-12-APPROVAL.txt.

## Eliminated

- hypothesis: The parent launch producer rejects or omits the valid empty physical document for a new layer.
  evidence: `createPhysicPaintLaunchContext` explicitly constructs, validates, and emits an empty canonical physical document when the store has no document; launch hydration accepts and installs zero records.
  timestamp: 2026-07-22

- hypothesis: The engine-ready wrapper throws while reconciling initial zero-history availability.
  evidence: `setHistoryAvailabilityListener` immediately publishes `{ undo: 0, redo: 0 }`; `reconcilePaintBarriers` only trims empty arrays, writes a Signal, and has no empty-state failure branch. No project-dependent throw mechanism remains.
  timestamp: 2026-07-22

- hypothesis: Tauri bridge mode detection itself depends on whether the project is saved/new.
  evidence: Detection depends only on successful import of `@tauri-apps/api/event` and presence of `emit`; launch context retrieval uses global native state and has no project-state branch.
  timestamp: 2026-07-22

- hypothesis: The main window never installs the Physics Paint apply listener, so first-key requests have no parent consumer.
  evidence: `app/src/main.tsx` imports and awaits `installPhysicPaintApplyListener()` in the main-window bootstrap. The earlier narrow search result was incomplete.
  timestamp: 2026-07-22

- hypothesis: Fresh-launch frame-indexed child state makes the empty-to-first-key ownership rebuild reject locally.
  evidence: Launch reset empties frame states, previews, captures, confirmed frames, dirty frames, live counts, editable frames, and reference state. Before a real key exists, `flushLivePixels(0)` has no frame identity, and the patched first-key path defers `beginFrameEdit()` until acceptance.
  timestamp: 2026-07-22

- hypothesis: The blank first-key Paste request or a parent success/rejection result violates the closed field validators.
  evidence: The actual first-key request satisfies every request predicate: closed top-level keys; `replace-roto-physical-map`; nonempty operation/layer/launch/project/revision strings; frame 0; one UUID-owned record whose record/payload `appFrame` is 0; PNG data URL; paired positive dimensions; boolean interpolation; paired selected UUID/frame 0; exact Paste semantic delta with null destination, fresh UUID, and valid blank payload; no replay provenance. Parent success echoes the full tuple with matching staged/accepted revision, selection, count 1, `ok: true`, and the same semantic delta. Parent rejection echoes the full tuple with accepted revision null, count 0, `ok: false`, optional error, and the same semantic delta. Both result forms satisfy the closed result guard and coordinator tuple comparison.
  timestamp: 2026-07-22

- hypothesis: The child-window notification capability rejection aborts or blocks the physical request/result event transaction.
  evidence: The notification caller remains export-only. The generated ACL manifest and `capabilities/physics-paint.json` explicitly grant `core:event:default` to `efx-physic-paint` while intentionally omitting `notification:default`; the main capability alone owns notification permission. The notification rejection therefore confirms a separate denied plugin call, not denial of the physical event bridge.
  timestamp: 2026-07-22

- hypothesis: The frontend persistence serializer emits retired top-level fields or a launch/apply envelope instead of a closed physical output.
  evidence: `savePhysicPaintData()` first validates the runtime output against `OUTPUT_KEYS`, then constructs a fresh persisted object containing only `layer_id`, `frames`, and optional `roto_physical`; Save and Save As pass that return value directly to IPC.
  timestamp: 2026-07-23

- hypothesis: A missing nested physical field or non-JSON nested value directly triggers the reported line-266 error.
  evidence: Line 266 executes only the top-level plain-object/key/layer_id/frames predicate. Nested frame and `roto_physical` validation happens later and emits different error messages.
  timestamp: 2026-07-23

- hypothesis: The latest save retained only raster sidecars or legacy `frames` while dropping `roto_physical.realKeyRecords` before reopen launch construction.
  evidence: The latest user-owned `.mce` directly contains `frames: []` plus four canonical real-key records at app frames 0, 1, 4, and 8; each stable `keyId` maps one-to-one to an existing PNG sidecar, and selection, cursor, capacity, revision, and layer identity are coherent.
  timestamp: 2026-07-23

- hypothesis: Project output filtering or layer-ID drift removed the physical document even though raster files survived.
  evidence: The persisted layer `id`, layer source `layer_id`, and `physic_paint_outputs[].layer_id` are all `e6f28408-04b8-46da-b025-71ab539a1ede`, and the output contains the full canonical document.
  timestamp: 2026-07-23

- hypothesis: The corrected Rust project schema still omitted required empty `frames` or canonical `roto_physical` in the latest native artifact.
  evidence: The on-disk output has both required `frames: []` and a complete `roto_physical` object with all four records.
  timestamp: 2026-07-23

- hypothesis: The new `-100` save rejection comes from a nested canonical Physics Paint/Roto field whose Rust type should be signed.
  evidence: `McePhysicPaintOutput.roto_physical` is `Option<serde_json::Value>`, so Rust does not deserialize canonical capacity, cursor, record, payload, interpolation, Script Motion, background, selection, or revision members into nested `u32` fields. The canonical branch serializes `frames: []`, leaving no typed cached-frame member in this project payload.
  timestamp: 2026-07-23

- hypothesis: Rust `MceSequence.in_frame` is stale and should be changed from `u32` to a signed type.
  evidence: The frontend domain declares overlay `inFrame` as a global timeline start, creates it at 0, and the timeline interaction explicitly clamps normal move/left-resize starts to `>= 0`. The negative value is born only when the zero-length timeline bound is applied after that clamp, so changing persistence to signed would preserve invalid runtime state instead of correcting its source.
  timestamp: 2026-07-23

## Evidence

- timestamp: 2026-07-22
  checked: .planning/debug/knowledge-base.md for engine-readiness, first-key, empty-state, and Roto transaction patterns
  found: No semantically relevant prior resolution; the only Physics Paint entry concerns deletion/cache cleanup and does not cover new-project initialization or first-key creation.
  implication: Proceed with fresh code-path tracing; do not anchor on the prior deletion multi-source-of-truth bug.

- timestamp: 2026-07-22
  checked: exact source of the visible "Engine not ready" status
  found: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx derives the copy solely from its boolean `ready` prop (`ready ? 'Engine ready' : 'Engine not ready'`).
  implication: The visible status is not an independent error path; its causal value depends entirely on where the parent obtains `ready`. Trace that prop before treating the status as root cause.

- timestamp: 2026-07-22
  checked: PhysicsPaintTopBar caller and workflow readiness consumers
  found: PhysicsPaintStudio passes `readyToApply` to both the top bar and PhysicsPaintWorkflowStrip. The workflow strip disables key utilities/interpolation/playback when ready is false, explaining why the visible status and blocked workflow occur together.
  implication: `readyToApply` is the shared gate behind both symptoms. Its prerequisites are engine existence, mounted canvas, launch context, connected bridge, idle apply state, and playback state; isolate the false prerequisite rather than patching individual controls.

- timestamp: 2026-07-22
  checked: PhysicsPaintStudio first completed-mutation publication path
  found: A non-empty completed mutation publishes live pixels only after resolving a canonical `keyId`; when the current physical cell is empty and no accepted script target exists, `keyId` is null and the handler returns before capture/persistence. The canvas can therefore retain visible engine pixels while canonical Roto state remains absent.
  implication: The reported visible-paint/no-real-key split is directly represented in production code. A preceding input-intent transaction must create/select the first real key before mutation completion; if that transaction is missing or asynchronous, publication is deterministically dropped.

- timestamp: 2026-07-22
  checked: engine lifecycle and first input-intent controller
  found: The engine lifecycle only resets on canvas-size key changes and publishes the engine synchronously from `onEngineReady`; it has no new-project-specific branch. `beginFrameEdit`, however, only marks the current frame dirty and never creates a physical real-key record for an empty cell.
  implication: A lifecycle initialization-order bug is not supported by static code. The first-key path is structurally incomplete unless launch hydration or another upstream transaction pre-creates a real key. Trace the launch envelope and empty-document semantics next.

- timestamp: 2026-07-22
  checked: canonical physical document validator, launch hydration, store empty-state behavior, and pointer input boundary
  found: The physical document contract explicitly accepts zero real-key records with `selectedKeyId: null`; hydration/projecting an empty timeline is valid. However, `physicPaintStore.getRotoPhysicalDocument(layerId)` returns null when the layer has never received a `_rotoRealKeyRecords` map entry. The pointer capture invokes `beginFrameEdit` synchronously, but that handler only marks dirty and does not allocate a first key.
  implication: The data contract supports a new empty project, but the store/launch producer may fail to instantiate that valid empty document. This is now the highest-probability single-point failure; inspect the producer before concluding the empty-cell editor needs a second fix.

- timestamp: 2026-07-22
  checked: `createPhysicPaintLaunchContext` new-layer fallback
  found: The producer constructs an empty physical document with positive capacity, zero records, disabled interpolation, null selection, requested cursor, and the correct empty revision, then revalidates the complete launch envelope. `openPhysicPaintCanvas` sends that context through the native/browser launch path.
  implication: Launch-envelope creation is not the divergence. The remaining readiness candidates are transport/bridge mode, canvas mount/engine publication, or apply/playback state; first-key materialization remains independently absent.

- timestamp: 2026-07-22
  checked: bridge mode detection, Tauri launch listener/fetch path, and physical insert utilities
  found: Bridge detection and native context retrieval have no saved/new-project branch: Tauri mode is based on API availability, and launch context is both stored in Rust and fetchable after listener installation. The canonical `pasteKey(destination, blankPayload, null)` path can create a key in an empty cell, but `beginFrameEdit` never calls it. Additionally, Studio performs history-listener setup before `handleEngineReady`; any throw there leaves the canvas engine alive internally but Studio `engine` null.
  implication: Static evidence weakens the bridge hypothesis and raises a precise engine-publication ordering hypothesis. Inspect whether history listener registration invokes a callback that rejects the empty initial state.

- timestamp: 2026-07-22
  checked: native Rust launch transport schema against the canonical TypeScript launch envelope
  found: The JS parent sends `rotoPhysical`, but Rust `PhysicsPaintLaunchContext` still declares only the retired legacy `rotoBackground`, `cachedRotoFrames`, and `rotoInterpolationSettings` fields. Serde ignores the unknown canonical member, stores the stripped struct, and emits/fetches a payload without `rotoPhysical`; the child type guard requires the canonical physical envelope and rejects it.
  implication: This directly explains `launchContext === null`, `readyToApply === false`, visible internal canvas paint, blocked workflow controls, and publication returns on `!launchContext`. It is a confirmed transport root-cause candidate requiring a round-trip regression test.

- timestamp: 2026-07-22
  checked: engine history-listener registration and zero-history reconciliation
  found: Listener registration immediately emits `{ undo: 0, redo: 0 }`; reconciliation safely trims empty ledgers and updates a Signal. No throw or new-project-specific branch exists.
  implication: Eliminate the engine-ready wrapper hypothesis. The top-bar copy is misleading because the shared readiness gate is false from missing launch context, not from an uninitialized internal paint engine.

- timestamp: 2026-07-22
  checked: smallest production-only native transport correction under the pre-approval test lock
  found: The existing Rust transport value slot now uses the canonical wire name `rotoPhysical`, so the emitted and fetched payload retain the complete physical document without modifying the locked Rust test module.
  implication: Native launch hydration can satisfy the Studio's closed canonical parser; the shared readiness gate no longer fails solely because transport stripped the physical document.

- timestamp: 2026-07-22
  checked: direct empty-cell paint ordering against the accepted physical coordinator and ownership rebuild
  found: Input intent now starts one deduplicated blank-key Paste transaction before marking the frame dirty; the completed mutation retains its alpha snapshot, awaits that accepted stable identity when necessary, revalidates launch identity, and publishes pixels only to the accepted real-key record.
  implication: The first painted frame gains a canonical owner before frame-indexed child state is dirtied, avoiding both the null-key publication drop and the ownership guard's correct rejection of unowned dirty state.

- timestamp: 2026-07-22
  checked: plan-authorized bounded static verification only
  found: `git diff --check` passed; a targeted read-only Node contract audit confirmed the canonical Rust wire key, empty-cell target preparation, accepted-target wait, launch identity guard, and canvas input wiring. Only the two production files plus this debug checkpoint are changed.
  implication: The fix is statically ready for renewed user-owned native UAT. No test, test discovery, typecheck, build, package command, server, browser, or native application was run.

- timestamp: 2026-07-22
  checked: renewed native UAT after the prior production fix
  found: Painting is visible, but the key does not become green, cache is not saved, selecting another frame remains blocked, and the physical cursor stays on frame 0. The top-right readiness text was not reported.
  implication: The prior fix did not establish accepted canonical ownership/timeline state in the actual native first-paint path. Transport readiness cannot be assumed either way; reopen the transaction chain from input intent through coordinator acceptance and timeline projection.

- timestamp: 2026-07-22
  checked: prior Studio first-paint implementation and accepted physical coordinator
  found: Pointer intent starts an asynchronous Paste transaction, but the stroke itself continues immediately. The coordinator stages the new record locally only after flushing current-frame live pixels, then waits for a parent settlement event before publishing `acceptedOutput`; completed paint publication waits on that acceptance promise. Therefore any native parent rejection/missing settlement rolls the staged key back or times out while leaving engine paint visible.
  implication: The failed UAT pattern is consistent with a failure after local preparation but before coordinator acceptance. Trace the exact native `replace-roto-physical-map` payload and settlement result rather than adding another local ownership path.

- timestamp: 2026-07-22
  checked: native console checkpoint after corrected Rust transport
  found: The child logs `[PhysicsPaintStudio] launch context fetched – Object`, while UAT still shows visible paint, no green real key, no cache save, and navigation blocked on physical frame 0. The console also reports an unhandled `notification.is_permission_granted` capability rejection because the child window is not allowed by `main-capability`.
  implication: The prior missing-launch-context transport hypothesis is no longer active. Investigation must distinguish an unrelated notification rejection from an initialization-chain abort and identify the exact first-key coordinator settlement and parent timeline ownership result.

- timestamp: 2026-07-22
  checked: all production references to `@tauri-apps/plugin-notification` and `isPermissionGranted`
  found: The only application caller is the export-completion branch in `app/src/lib/exportEngine.ts`; it runs only after an export completes while `document.hidden`. No Physics Paint bridge, launch, coordinator, store, or Studio module invokes the notification plugin.
  implication: The capability rejection has no direct call-path connection to Physics Paint initialization or first-key transactions. Unless an unrelated export is completing concurrently, it cannot abort launch/coordinator setup; continue on the canonical settlement path.

- timestamp: 2026-07-22
  checked: child coordinator send/result matching and parent physical-map authority
  found: The child stages the first-key record locally, sends one `replace-roto-physical-map` event to `main`, and accepts only a result echoing the complete tuple and staged revision. The parent validates launch identity, expected revision, selection, semantic delta, replaces the canonical document, and emits the result globally plus directly to the child. No static mismatch is apparent in the first-key tuple itself.
  implication: The remaining high-value boundary is event listener lifecycle/installation or a parent-side early rejection whose result is not observed. Trace listener installation and exact first-key proposal fields before changing authority logic.

- timestamp: 2026-07-22
  checked: production references to `installPhysicPaintApplyListener`
  found: The initial narrow search missed `app/src/main.tsx`; the complete bootstrap imports and awaits `installPhysicPaintApplyListener()` in the main-window branch before the other Physics Paint listeners. Rust has no competing apply handler because the Tauri event bus delivers the request to this JS listener.
  implication: The missing-parent-listener hypothesis is eliminated. Continue with result-listener readiness, parent rejection predicates, and child projection/closure state.

- timestamp: 2026-07-22
  checked: current Studio first-key implementation against coordinator staging order
  found: Input intent starts the async Paste transaction, but the coordinator captures its before snapshot and then calls `flushPendingStrokeFinalizations()` plus `flushLivePixels(frame)` before local record staging. The actual `replaceRecords` seam is `replacePhysicalRecordsWithOwnership`, which can reject locally before the payload is sent.
  implication: A local pre-send rejection remains plausible and exactly matches visible engine paint with no parent result. Inspect whether pre-stage flushing or launch reset populates frame-indexed child state that the empty-to-first-key ownership rebuild refuses.

- timestamp: 2026-07-22
  checked: ownership rebuild inputs for a fresh launch
  found: Launch reset clears every edit-buffer collection and confirmed/reference state; `flushLivePixels(0)` has no identity when no real key exists and only flushes already-pending transactions. The first-key implementation delays `beginFrameEdit()` until acceptance, so no dirty/editable state is intentionally created before local staging.
  implication: The prior initialized-frame-state ownership hypothesis is not supported for the fresh first-key path. Inspect request/result validators next, because a guard rejection can silently prevent coordinator settlement while leaving engine pixels visible.

- timestamp: 2026-07-22
  checked: first-key request construction against `isPhysicPaintApplyPayload`, `isPhysicPaintRotoPhysicalEditApplyPayload`, record/payload guards, and Paste semantic validation
  found: Every emitted field is inside the accepted domain. The blank canvas produces frameIndex/appFrame 0, a PNG data URL, and paired positive dimensions. The resolver retargets the payload to frame 0, allocates one bounded UUID, emits one record at frame 0, selects the same UUID/frame pair, and declares the exact null-destination/fresh-ID Paste delta. Expected/staged revisions are built from the same validated records/interpolation functions used by the parent. No unknown key, retired coordinate, replay provenance, malformed selection, or payload/frame disagreement is emitted.
  implication: The request-validator hypothesis is refuted; no request shape change is authorized.

- timestamp: 2026-07-22
  checked: parent physical result construction against `isPhysicPaintRotoPhysicalEditApplyResult` and `transitionPhysicalEditResult`
  found: Success returns the exact operation/kind/layer/start/launch/project/expected/staged tuple, accepted revision equal to staged revision, matching selected UUID/frame, applied count 1, `ok: true`, and the same semantic delta. Every parent rejection after closed payload acceptance returns the same tuple, null accepted revision, count 0, `ok: false`, optional string error, and the same semantic delta. Both satisfy the closed guard and pending-tuple matcher.
  implication: The result-validator hypothesis is refuted; the accepted-output consumer, not the wire field contract, is the remaining deterministic boundary.

- timestamp: 2026-07-22
  checked: child capability scope for the physical event bridge versus the reported notification rejection
  found: `capabilities/physics-paint.json` and the generated ACL manifest bind `efx-physic-paint` to `core:event:default`, so apply emission and result listening are permitted. The capability intentionally omits `notification:default`, while `main-capability` owns it only for `main`.
  implication: Keep the notification error independently classified. It neither proves nor causes rejection of the key transaction event path.

- timestamp: 2026-07-22
  checked: coordinator pending/accepted publication identity across Studio initialization rerenders
  found: `useRotoPhysicalEditCoordinator` created four Signals with plain `signal()` on every hook render, but its `useCallback` transaction functions remain stable and retain the first-render Signal instances. Launch fetch, bridge-mode detection, engine publication, and local record staging rerender Studio. The first-key waiter therefore receives newer `pendingOperationId`/`acceptedOutput` computed views while `executePhysicalEdit` and `finalizeAccepted` publish into older Signals. `dispatchAndWaitForAcceptedRotoPhysicalEdit` can return null at its `expectedOperationId === null` guard or never observe the accepted output even when the parent tuple is valid.
  implication: This is the exact deterministic divergence between a valid transaction settlement and the first-paint accepted-target consumer. It explains why the stroke remains visually present while first-key publication never receives the accepted stable identity.

- timestamp: 2026-07-22
  checked: smallest production correction under the session command/test lock
  found: The coordinator now allocates presentation, accepted, failure, and pending-operation Signals with Preact `useSignal()`, preserving one Signal identity for the hook lifetime while retaining the existing parent/coordinator authority, stable keyId/direct appFrame request, and settlement tuple unchanged.
  implication: Static inspection confirms the waiter and stable transaction callbacks now observe the same pending/accepted publications. No compatibility path, wrapper, alias, migration, dual write, or competing authority was added. No test, discovery, typecheck, build, package, shell, server, browser, or native command was run.

- timestamp: 2026-07-22
  checked: renewed native UAT after the stable coordinator Signal identity correction
  found: The user fully quit and relaunched/rebuilt for each attempt. Physical-frame navigation sometimes works transiently, but the painted key/cache is never durably saved. Closing or reopening the layer can block navigation again. An empty physical frame 0 can sometimes appear green after reopen; leaving it restores the original visible-paint/no-durable-key/frame-0-lock behavior.
  implication: The deterministic unstable-Signal hypothesis is refuted as a complete root cause. The intermittent transitions point to a lifecycle/ordering race spanning first-key acceptance, pixel settlement, cache publication, parent persistence, close/reopen hydration, selection derivation, and navigation gating. Existing unapproved fixes remain hypotheses until this complete timeline has one coherent evidenced explanation.

- timestamp: 2026-07-22
  checked: complete first-paint transaction, live-pixel persistence, parent apply, close flush, launch hydration, and timeline derivation functions
  found: Decisive static boundaries are concentrated in `PhysicsPaintStudio.tsx`, `useRotoPhysicalEditCoordinator.ts`, `useRotoFramePersistenceCoordinator.ts`, `usePhysicsPaintParentBridge.ts`, `usePhysicsPaintLaunchIntegration.ts`, and `physicPaintBridge.ts`. Existing callbacks expose the required operationId/keyId/appFrame/launch/layer identities without logging pixel data or changing authority.
  implication: One compact `[PP-TX]` trace can distinguish request absence/deduplication, parent rejection, child settlement loss, stale live-alpha capture, cache publication failure, close-flush loss, and reopen hydration/selection divergence. Temporary instrumentation can remain behavior-neutral.

- timestamp: 2026-07-22
  checked: parent apply listener and launch-open boundaries
  found: Both browser fallback transports and the native Tauri event listener now emit compact `apply.received`, `apply.result`, and successful `physical.write`/`cache.write` stages. Launch opening now reports only identity, record/selection/revision counts, transport, and outcome instead of logging the full launch envelope.
  implication: The parent trace can prove whether each first-key/cache request arrived, was accepted or rejected, and became visible in the canonical store without exposing frame pixels, data URLs, editable project state, or large payload objects.

- timestamp: 2026-07-22
  checked: child launch/result bridge and launch hydration lifecycle
  found: Child logs now identify whether each valid apply result arrived through the Tauri event, CustomEvent, or window-message channel; launch receipt/fetch reports a compact canonical summary; hydration reports start, rejection/success, installed record/selection/cursor/revision state, engine presence, and integration disposal identity.
  implication: A single trace can distinguish missing versus duplicate settlement delivery and determine whether close/reopen loses the canonical document before transport, during hydration, or only after timeline derivation.

- timestamp: 2026-07-22
  checked: bounded static verification of the completed temporary instrumentation
  found: `git diff --check` passed. A read-only trace audit validated six helpers using the same `[PP-TX]` prefix and one-line JSON payloads. Searches found no remaining full launch-context/object logs in the instrumented paths and no trace arguments containing raw pixel data, data URLs, editable state, rendered-frame payloads, or canvas objects. Timeline logging is signature-deduplicated; all other stages sit on transaction, result, capture, persistence, close, or hydration boundaries.
  implication: Instrumentation is statically ready for one native capture and remains observational. No functional correction, compatibility path, source/display alias, dual write, competing authority, test, test discovery, typecheck, build, package, server, browser, or native app execution was added or run in this checkpoint.

- timestamp: 2026-07-22
  checked: user-owned instrumented native reproduction after a full app relaunch
  found: For the same launchOperationId and layer, parent launch open/result succeeds and the child receives and hydrates the launch, but ordinary initialization/rerenders repeatedly emit `launch.integration.dispose` followed by `physical.cancel`. The first paint reports `Roto physical edit failed (settlement-mismatch): Cancelled due to disposal.` First-key dispatch/result observations occur around that disposal sequence. Later completed mutations carry `operationId: null`, each publication is skipped, and further integration disposal/cancel events occur while navigating away from and back to physical frame 0. No physical bridge permission error appears; the notification permission rejection remains separate.
  implication: The launch transport and parent authority are working. Repeated launch-integration effect cleanup is the first decisive divergence: it cancels the accepted/in-flight physical coordinator and clears transaction/persistence identity during the live launch, directly explaining null-operation publication skips, absent durable cache/key state, and loss after navigation.

- timestamp: 2026-07-22
  checked: exact launch-integration effect dependency and Studio call-site identity
  found: `PhysicsPaintStudio` creates `disposePhysicalEditSettlement` as a new inline arrow on every render. `usePhysicsPaintLaunchIntegration` listed that callback in the cleanup effect dependency array, so every ordinary render identity change executed `coordinatorRef.current?.dispose()` and `cancelPhysicalEdit('disposal')` without any launch/layer generation change.
  implication: The runtime trace and static call graph identify one exact causal identity edge; the cleanup must be tied to hook-generation unmount rather than callback identity.

- timestamp: 2026-07-22
  checked: cleanup side effects through physical coordinator settlement and first-key publication
  found: Disposal cancellation calls `finalizeFailed`, which restores the pre-edit snapshot, clears `acceptedSignal`, then `clearPendingOnce` clears `pendingOperationIdSignal` and the pending tuple. The first-key waiter consequently resolves without an accepted target; completed mutation publication has neither a stable key nor accepted publication operation identity and skips durable cache publication.
  implication: Preventing render-driven cleanup preserves both coordinator acceptance and the publication identity required by the existing first-key/cache path.

- timestamp: 2026-07-22
  checked: smallest generation-lifetime correction and prior unapproved changes
  found: The launch integration now keeps the latest disposal callback in a ref and owns one empty-dependency cleanup for unmount only. Temporary `[PP-TX]` instrumentation and instrumentation-only bridge/persistence rewrites were removed. The canonical Rust `rotoPhysical` wire key, first-empty-cell single-flight key creation plus accepted-target wait, and hook-lifetime `useSignal` coordinator state were retained because each corrects an independently demonstrated structural divergence required for the traced transaction to reach the causal cleanup boundary.
  implication: The resulting source diff contains only evidence-backed production corrections and the causal lifetime fix.

- timestamp: 2026-07-22
  checked: plan-authorized bounded static verification after instrumentation removal
  found: `git diff --check` passed. A read-only Node audit confirmed unmount-only launch teardown, latest-callback ref routing, first-key single flight and accepted-key wait, stable coordinator Signal identity, canonical native `rotoPhysical` transport, and absence of `[PP-TX]` helpers/calls.
  implication: Source is ready for renewed user-owned native UAT. No test, test discovery, typecheck, build, package, server, browser, or native application command was run.

- timestamp: 2026-07-23
  checked: renewed native UAT after the launch-generation lifetime fix
  found: Active editing now works across several physical frames: every painted frame creates a cache and a green real key, and physical-frame navigation works. After saving and closing, reopening the recent project deterministically fails at `physicPaintPersistence.ts:266` with `Persisted Physics Paint output is not a closed physical output.` via `WelcomeScreen.tsx:208`.
  implication: The lifecycle/transaction fix is behaviorally confirmed for the active launch. The remaining blocker is downstream at the exact save serialization/reopen closed-contract boundary; preserve the accepted active-edit architecture and isolate the first malformed persisted field or envelope.

- timestamp: 2026-07-23
  checked: complete `savePhysicPaintData` producer and `loadPhysicPaintData` line-266 predicate
  found: Save validation accepts only top-level `layer_id`, `frames`, and optional `roto_physical`, then constructs a fresh persisted object with exactly those keys. Reopen line 266 runs before frame or nested physical-document validation and rejects only when the output is not a plain object, contains an unknown top-level key, has an invalid/missing `layer_id`, or has non-array/missing `frames`.
  implication: The error cannot yet be caused by a missing nested physical field, retired nested record field, non-JSON physical value, or launch/apply envelope inside `roto_physical`; those would fail later with different messages. Since save completed, trace mutation/renaming after `savePhysicPaintData()` returns, especially IPC/Rust JSON serialization.

- timestamp: 2026-07-23
  checked: project store save/open call boundary
  found: Both Save and Save As overwrite `project.physic_paint_outputs` with the fresh result of `savePhysicPaintData()` immediately before IPC persistence. Open passes the IPC-decoded `result.data.physic_paint_outputs` directly into `loadPhysicPaintData()` before closing or hydrating the current project.
  implication: The first observable divergence lies between the validated serializer return and the IPC-decoded project field, not in store hydration or WelcomeScreen error handling.

- timestamp: 2026-07-23
  checked: canonical store serialization for a layer with physical real-key records
  found: `physicPaintStore.toMceOutputs()` explicitly returns `{ layer_id: layerId, frames: [], roto_physical: rotoPhysical }` for the canonical physical branch; retired cache/interpolation/background output members are used only by the non-physical branch.
  implication: The saved UAT project deterministically reaches Rust with an intentionally empty required `frames` array and the complete canonical document solely under `roto_physical`.

- timestamp: 2026-07-23
  checked: Rust `McePhysicPaintOutput` Serde schema and project I/O round trip
  found: The Rust model has no `roto_physical` member, retains retired `roto_cache_metadata`, `roto_interpolation_settings`, and `roto_background` members, and applies `skip_serializing_if = "Vec::is_empty"` to `frames`. Incoming canonical `roto_physical` is ignored; empty `frames` is defaulted and then omitted; project I/O serializes/deserializes this Rust struct directly.
  implication: The actual canonical physical output is reduced to `{ "layer_id": "..." }` across the Rust persistence boundary. On reopen, `Array.isArray(output.frames)` is the first false closed-contract predicate at line 265/266. The physical document is also lost entirely.

- timestamp: 2026-07-23
  checked: smallest production serialization correction
  found: `app/src-tauri/src/models/project.rs` now retains optional canonical `roto_physical`, keeps `frames` serialized when empty, and no longer declares the retired project-persistence Roto fields. No TypeScript persistence, store authority, key identity, app-frame mapping, or coordinator code changed in this continuation.
  implication: The exact canonical frontend output shape can now survive both Tauri command deserialization and Rust JSON serialization without wrappers, aliases, dual writes, or migration logic.

- timestamp: 2026-07-23
  checked: bounded static verification of the persistence correction
  found: `git diff --check` passed. The exact model diff is limited to the required-frame Serde attribute and replacement of three retired members with `roto_physical`. A source search confirms the production project model now matches `OUTPUT_KEYS`; remaining retired project-model references are inside the explicitly locked Rust test module. No test, test discovery, typecheck, build, package, server, browser, or native app command ran.
  implication: The production fix is statically ready for renewed user-owned native save/close/reopen UAT; test debt remains intentionally deferred by the checkpoint constraint.

- timestamp: 2026-07-23
  checked: renewed user-owned native close/reopen observation after the Rust schema correction
  found: The raster cache survives child close/reopen while the green timeline real-key markers disappear.
  implication: The cache persistence path and canonical `roto_physical.records` path diverge. The prior top-level Rust schema fix is not sufficient; trace record identity and selection field provenance through all seven close/reopen stages before any further production change.

- timestamp: 2026-07-23
  checked: latest user-owned native project `/Users/lmarques/Desktop/efx-motion-editor-project-test/test-phase-36/test-phase-36.mce`
  found: The physical output for layer `e6f28408-04b8-46da-b025-71ab539a1ede` contains required `frames: []`, capacity 600, cursor frame 4, selected key `f1b6ebd2-6598-409d-9ddf-44ae575cd825`, revision `physical-416200-5a515a0c`, and four canonical records at app frames 0, 1, 4, and 8 with stable key IDs and matching payload app frames.
  implication: Canonical physical records are not lost before or during stage 4 project persistence. The latest native artifact validates the corrected Rust schema and moves the first unresolved divergence downstream to reopen launch delivery, child hydration/publication, or timeline publication.

- timestamp: 2026-07-23
  checked: persisted Physics Paint sidecar directory for the same layer
  found: Four PNG files exist, and every filename's app frame and stable key ID matches exactly one persisted `realKeyRecords` entry.
  implication: Raster and canonical-record paths are synchronized on disk. The reported visible raster/absent-marker split occurs after project output is loaded or transported, not in sidecar creation or save serialization.

- timestamp: 2026-07-23
  checked: field-by-field static provenance from `createPhysicPaintLaunchContext` through native transport, strict child parsing, hydration/store replacement, timeline projection, and workflow-strip marker rendering
  found: Each boundary preserves `keyId`, direct `appFrame`, payload, capacity, interpolation, Script Motion, background, selection, cursor, and revision. The persisted identities 0/1/4/8 are valid under capacity 600, and the view marks any received `real` cell as saved/green.
  implication: Static code does not identify a lossy transform after stage 4. Runtime counts are required to distinguish stage-5 delivery, stage-6 hydration/reactive publication, and stage-7 model/view publication.

- timestamp: 2026-07-23
  checked: repository, Desktop, project folder, and application-support filesystem for existing `pp-tx` captures or text/log evidence
  found: No matching capture, `.txt`, or `.log` file exists in the searched locations.
  implication: Continue with the prior conversation transcript as the final existing-evidence source; if it lacks reopen stage-5/6/7 counts, investigation is blocked without a bounded user-owned observation.

- timestamp: 2026-07-23
  checked: prior session transcript `/Users/lmarques/.claude/projects/-Users-lmarques-Dev-efx-motion-editor/3737de95-687f-47d7-b37e-690c2e3f9391.jsonl` for user-owned reopen launch, hydration, child-store, and timeline counts
  found: The transcript contains the visible observation that caches remain while green keys disappear, but no stage-5 launch `realKeyRecords` count, stage-6 installed child-store count, stage-7 timeline `real` cell count, or saved `[PP-TX]` reopen trace.
  implication: Existing evidence proves the persisted canonical records and sidecars agree through stage 4 but cannot distinguish the first runtime loss among stages 5–7. Further production changes are blocked because any choice would be speculative.

- timestamp: 2026-07-23
  checked: user decision and exact production seams for bounded reopen observability
  found: The user approved exactly three compact temporary stage logs with prefix `[PP-REOPEN]` and no functional change. The successful parent delivery seam is after `tryOpenTauriPhysicPaintWindow`/`openBrowserFallback`; the child installation seam is immediately after `hydrateRotoPhysicalLaunchContext`; the consumed timeline seam is the `useRotoTimelineModel` physical projection in `PhysicsPaintStudio`.
  implication: Instrument only these three stage types, correlate them by launch operation/layer/revision, and deduplicate child/timeline observations so ordinary rerenders do not create trace noise.

- timestamp: 2026-07-23
  checked: bounded static verification of the approved `[PP-REOPEN]` instrumentation
  found: `git diff --check` passed for the three instrumented production files. Source search finds exactly three `[PP-REOPEN]` `console.info` definitions: `parent-launch-delivery`, `child-hydration-install`, and `timeline-projection`. Each emits one-line JSON containing only operation/layer/revision/count/status metadata; no data URL, rendered frame, canvas, launch object, or pixel payload is logged. Child hydration is deduplicated by launch operation plus physical revision; timeline projection is emitted once per launch operation.
  implication: The trace is behavior-neutral and statically ready for one user-owned close/reopen capture. No functional fix, test, test discovery, typecheck, build, package command, server, browser, or native application was run.

- timestamp: 2026-07-23
  checked: approved instrumentation placement and checkpoint reproduction wording before human capture
  found: The parent trace was emitted only after `tryOpenTauriPhysicPaintWindow` or `openBrowserFallback` succeeded, so it observed the wrong side of the delivery boundary. The debug file also retained an obsolete `[PP-TX]` workflow requiring a disposable project, painting, waiting, navigation, save, close, and reopen.
  implication: The prior static-ready conclusion was too broad. Parent placement and reproduction scope had to be corrected before collecting evidence, without changing runtime behavior.

- timestamp: 2026-07-23
  checked: bounded source-only verification after the instrumentation audit correction
  found: Source search finds exactly three `[PP-REOPEN]` `console.info` definitions across three files. `parent-launch-delivery` now emits the validated operation/layer/launchRevision/recordCount summary inside `createPhysicPaintLaunchContext` immediately before `return validated`; no post-transport helper or call remains. `child-hydration-install` still reads back the installed document immediately after successful hydration and deduplicates by launch operation plus revision. `timeline-projection` still reports input records and real cells once per launch operation. The active capture steps now require only rebuild/relaunch, opening the known saved project, and opening the affected layer once with no painting or other Physics Paint action.
  implication: The temporary trace now matches the approved checkpoint exactly and is ready for one user-owned capture. No functional fix, test, test discovery, typecheck, build, package, server, browser, or native application command was run.

- timestamp: 2026-07-23
  checked: user-owned correlated `[PP-REOPEN]` screenshots across initial open and close/reopen
  found: The initial empty launch reports parent delivery, child hydration, and timeline projection with zero records, as expected. After painting three frames, closing Physics Paint, and reopening the same layer, child hydration reads back `installedRecordCount: 3` and timeline projection receives `inputRecordCount: 3` at the same physical/launch projection revision. The cached raster is visible, but no green real-key marker is rendered; frame 0 shows only the orange current-frame outline. No additional logs occur during painting, matching the reopen-only instrumentation design.
  implication: Canonical persistence, reopen transport, strict child hydration, child-store installation, and the input side of timeline projection are all intact. The first unresolved deterministic boundary is now inside timeline-model derivation or the marker view predicate after the logged three-record input; do not alter persistence, transport, or hydration again.

- timestamp: 2026-07-23
  checked: complete `useRotoTimelineModel`, physical/legacy selectors, and workflow-strip marker predicate
  found: The model contains two parallel projections. `physicalView` derives semantic `real` cells from canonical `rotoKeyRecords`, while `savedRotoFrames` still derives from the legacy cache/source-display view. The strip does not rely solely on the legacy markers: it marks a cell saved when either its physical semantic cell is `real` or `savedRotoFrames` contains the frame. Therefore three physical real cells should render as saved even if legacy cache markers are stale.
  implication: The likely divergence is now narrower than the selector input: either `rotoPhysicalCells` is not passed/reactively refreshed at the strip boundary, or CSS/presentation ordering visually overrides the resulting `saved` class. Inspect the Studio prop handoff and exact CSS cascade before changing selectors.

- timestamp: 2026-07-23
  checked: `PhysicsPaintStudio` physical model construction and workflow view-model handoff
  found: Studio reads `physicPaintVersion.value`, rebuilds `rotoKeyRecords`, computes `rotoTimelineModel.physicalCells.value`, and passes that exact physical-cell array to the workflow as `rotoPhysicalCells`. The workflow strip builds `physicalCellByAppFrame` from the prop and classifies each `real` semantic cell as both `occupied` and `saved`.
  implication: If the logged `realCellCount` is three, the same render pass necessarily hands three real cells to the strip and creates `saved` class names. The remaining production boundary is visual CSS/cascade or a view-model transport that drops `rotoPhysicalCells`; inspect both before requesting more runtime data.

- timestamp: 2026-07-23
  checked: exact timeline cell class construction and `physicsPaintStudio.css` cascade
  found: For each cell, both `getRotoFillClass(fill)` and `vm.fillClass` derive exclusively from `cachedRotoFrames`. A canonical physical `real` cell with no legacy cache-list entry therefore receives `roto-fill-empty ... occupied saved current`. CSS gives `.occupied,.saved` only an inset box shadow; the green border/background exists only on `.roto-fill-cached` and `.roto-fill-cached-only`. The orange `.current` outline then matches the user's frame-0 screenshot while all reopened real keys remain gray.
  implication: Root cause is confirmed at the presentation predicate. Reopen data is valid; the timeline's visible saved-key fill still treats the legacy cache list as color authority instead of the canonical physical real-cell projection.

- timestamp: 2026-07-23
  checked: TDD red regression setup for the confirmed reopen marker defect
  found: A focused regression test was drafted but never executed because every attempted command was blocked by the approval gate. The checkpoint owner subsequently declared the test unauthorized under Plan 12 and removed it without execution.
  implication: Tests remain fully locked for this continuation. Verification must use only the explicitly permitted source audit, `git diff --check`, and renewed user-owned native visual UAT.

- timestamp: 2026-07-23
  checked: smallest production presentation correction and temporary reopen instrumentation removal
  found: `PhysicsPaintWorkflowStrip` now chooses the existing `roto-fill-cached` class directly when the canonical semantic cell kind is `real`; only non-real cells continue through the independent legacy cached-only plus generated/background view-model fill paths. The three `[PP-REOPEN]` log blocks and their instrumentation-only refs/derived values were removed from the parent launch, child hydration, and timeline projection seams.
  implication: Canonical real-key presentation no longer depends on `cachedRotoFrames`, while persistence, hydration, transaction authority, generated cells, background-only cells, and cached-only cells are unchanged.

- timestamp: 2026-07-23
  checked: permitted bounded static verification after the presentation correction
  found: `git diff --check` passed with no output. Read-only source audit confirms canonical `real` selects only `roto-fill-cached`; non-real cells still combine the existing `getRotoCellFill` cached-only path with `getRotoCellViewModel` generated/background/empty classification; source search finds no remaining `[PP-REOPEN]` logs or instrumentation-only identifiers.
  implication: The production diff is statically ready for renewed user-owned native close/reopen visual UAT. No test, test discovery command, typecheck, build, package, server, browser, or native app command was run.

- timestamp: 2026-07-23
  checked: latest user-owned native UAT after the canonical real-key presentation correction
  found: Reopened canonical real-key markers now remain green, confirming the presentation fix. Saving the project now deterministically fails at `Toolbar.tsx:75` with `invalid args project for command project_save: invalid value: integer -100, expected u32`.
  implication: Treat all prior presentation/persistence/hydration/navigation diagnoses as runtime-confirmed. The new blocker is a field-level JS-to-Rust project-save argument contract mismatch; trace all nested Rust `u32` fields to their frontend serialized sources without reopening accepted paths.

- timestamp: 2026-07-23
  checked: exact `Toolbar.tsx` → `projectStore.saveProject` → `buildMceProject` → `ipc.projectSave` → Rust `project_save(MceProject)` path
  found: Toolbar only reports the rejected promise. `projectStore` builds a complete project object, replaces Physics Paint outputs with the persistence serializer result, and passes the object unchanged to Tauri; the rejection occurs while Serde deserializes that JavaScript object into `MceProject`, before `project_io::save_project` runs.
  implication: The value must be in a Rust-typed `u32` field present in the command argument; disk writing and post-save logic cannot cause this error.

- timestamp: 2026-07-23
  checked: every Rust `u32` field reachable in the actual Physics-Paint-only project shape against the frontend serializer source
  found: Project version/fps/width/height are fixed positive values; sequence fps/width/height are hydrated positive values; sequence and layer order are array indices; there are no key photos, transitions, keyframes, images, or audio tracks; canonical `frames` is empty; and `roto_physical` is untyped `serde_json::Value`. The only mutable reachable unsigned fields are the overlay sequence `in_frame`/`out_frame`, serialized directly from `seq.inFrame`/`seq.outFrame`.
  implication: Nested canonical Roto fields cannot produce the typed rejection. The current payload's only viable `-100` candidate is the FX sequence range, specifically `in_frame`.

- timestamp: 2026-07-23
  checked: FX-only timeline length and FX range-drag arithmetic
  found: `getTimelineRequiredFrameCount` correctly computes 100 from the Physics Paint FX sequence, but `frameMap` can extend to that target only by cloning `tailEntry`; with no content key photo, `tailEntry` is undefined, `frameMap` remains empty, and exported `totalFrames = frameMap.length` is 0. During an FX move, the 100-frame range is first clamped to nonnegative, then `newOut > totalFr` forces `newOut = 0` and `newIn = newOut - duration = -100`; `updateFxSequenceRange` stores that value and `buildMceProject` writes it as `in_frame`.
  implication: The exact rejected integer is reproduced algebraically from the production path. Rust `u32` is contract-correct; the invalid value originates from the zero timeline bound exposed by a Physics-Paint-only project.

- timestamp: 2026-07-23
  checked: common-pattern and bug-taxonomy classification for the save failure
  found: The failure is a deterministic Data Shape/API Contract plus boundary-order Bohrbug: an FX-only data shape exposes a zero derived length, and the range clamp subtracts duration after its nonnegative clamp.
  implication: Correct the first invalid derived boundary rather than clamping at serialization or widening Rust to a signed type.

- timestamp: 2026-07-23
  checked: smallest production correction at the first invalid derived boundary
  found: Exported `totalFrames` now calls the existing `getTimelineRequiredFrameCount(sequenceStore.sequences.value, frameMap.value.length)`. For the current project shape, the helper returns 100 from the visible Physics Paint FX sequence even though the content-backed frame array is empty.
  implication: FX range interaction receives the actual 100-frame timeline bound; a zero-delta move preserves 0..100 and cannot create the observed `inFrame = -100`. No project serializer clamp, Rust signed widening, Roto compatibility path, or authority change was added.

- timestamp: 2026-07-23
  checked: permitted bounded static verification of the save correction
  found: `git diff --check` passed with no output. The source diff is one behavior line in `frameMap.ts`; read-only audit confirms `buildMceProject` still serializes `seq.inFrame` directly, Rust still requires `Option<u32>`, canonical `roto_physical` remains `serde_json::Value`, and the save boundary contains no clamp or sanitizer.
  implication: The contract-correct source fix is statically ready for renewed user-owned native save UAT. No test, test discovery, typecheck, build, package, server, browser, or native app command ran.

- timestamp: 2026-07-23
  checked: final user-owned native end-to-end UAT across the complete corrected root-cause chain
  found: The user confirmed Physics Paint initializes; multiple physical keys can be painted; real keys remain green; caches persist; physical-frame navigation works; the layer closes and reopens; project save succeeds without the `-100`/`u32` rejection; and save/close/reopen preserves both paint and physical-key state.
  implication: Every previously blocked native behavior is resolved. The aggregate launch, first-key settlement, persistence, presentation, navigation, and FX-only save corrections are accepted; close this session and return to Phase 36.14 Plan/Wave 14 UAT.

## Resolution

root_cause:
  - Launch/first-key blocker: the native Rust launch transport stripped canonical `rotoPhysical`; the empty-cell stroke path needed an accepted stable real-key owner before pixel publication; coordinator Signals were recreated across renders; and `PhysicsPaintStudio` recreated the inline `disposePhysicalEditSettlement` callback while `usePhysicsPaintLaunchIntegration` treated that identity as a cleanup-effect dependency. Together these boundaries made readiness false or repeatedly cancelled the live physical edit before first-key/cache settlement.
  - Save/reopen blocker: canonical physical outputs are `{ layer_id, frames: [], roto_physical }`, but Rust `McePhysicPaintOutput` dropped `roto_physical` and omitted empty `frames`, reducing the IPC/on-disk round trip to `{ layer_id }` and failing the first reopen closed-contract predicate.
  - Reopen marker blocker: `PhysicsPaintWorkflowStrip` derived green cell fill only from legacy `cachedRotoFrames`; canonical physical `real` cells without a legacy cache-list entry received `roto-fill-empty`, while `occupied saved` added only a subtle box shadow, so persisted real keys were present but visually gray after reopen.
  - Save `-100` blocker: in a valid Physics-Paint-only project, the required timeline extent was 100 but exported `totalFrames` used the empty content-backed `frameMap.length`; an FX range move clamped the 100-frame bar against zero and stored `inFrame = -100`, which failed Rust's correctly unsigned `MceSequence.in_frame` deserialization.
fix:
  - Bind launch-integration teardown to hook-generation unmount through a latest-callback ref; retain the independently required canonical native transport, first-empty-cell accepted-key wait, and hook-lifetime coordinator Signals; remove all temporary transaction instrumentation.
  - Cut the Rust project output schema over to optional canonical `roto_physical`, always serialize the required `frames` array, and remove retired Roto persistence members.
  - Make canonical physical cell kind `real` select the existing green `roto-fill-cached` presentation directly; retain the existing independent cached-only/generated/background-only branches for non-real cells; remove all temporary `[PP-REOPEN]` instrumentation.
  - Define exported timeline `totalFrames` from the existing all-sequence required-frame calculation instead of the materialized content-frame array length, preserving the valid 0..100 FX range in a Physics-Paint-only project without clamping or widening persistence types.
verification:
  target_test: { result: skipped, reason_if_skipped: "Plan 12 explicitly prohibits creating, modifying, discovering, or running tests for this checkpoint; the unauthorized draft was removed without execution." }
  mutation_check: { result: skipped, reason_if_skipped: "Tests and mutation tooling are explicitly locked for this checkpoint.", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, reason: "The behavior change adds canonical-real fill authority at the presentation seam. Deletions remove only the three approved temporary trace blocks and their instrumentation-only state." }
  adjacent_tests: { result: skipped, reason_if_skipped: "Tests and test discovery are explicitly locked for this checkpoint.", suites_run: [] }
  revert_and_reconfirm: { result: pass, reason: "The recorded pre-fix native failures no longer reproduce: initialization, multi-key painting, green real-key presentation, cache persistence, physical navigation, close/reopen, project save, and save/close/reopen preservation all passed user-owned native UAT." }
  static_source_audit: { result: pass, checks: ["canonical real selects roto-fill-cached", "non-real cached-only/generated/background-only paths unchanged", "all PP-REOPEN instrumentation absent", "FX-only totalFrames uses required all-sequence extent", "buildMceProject still serializes seq.inFrame directly", "Rust MceSequence.in_frame remains Option<u32>", "canonical roto_physical remains serde_json::Value", "no save-boundary clamp or sanitizer", "git diff --check passed"] }
  native_uat: { result: pass, checks: ["Physics Paint initializes", "multiple physical keys can be painted", "real keys stay green", "caches persist", "physical-frame navigation works", "layer close/reopen works", "project save succeeds", "save/close/reopen preserves paint and physical-key state"] }
  guardrail_verdict: passed_native_uat
postmortem:
  why_not_caught: "No earlier gate exercised the complete new-project Physics-Paint-only lifecycle across native launch transport, first-key settlement, project serialization, reopened marker presentation, FX range interaction, and save/close/reopen as one end-to-end chain."
  guard: "The user-owned Plan 12 native UAT now covers that complete lifecycle; automated regression work remains intentionally assigned to Phase 36.14 Plans 13–14."
  artifact: "This resolved debug checkpoint preserves the causal chain, bounded static checks, and final native UAT matrix."
files_changed:
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/models/project.rs
  - app/src/lib/physicPaintBridge.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/lib/frameMap.ts
