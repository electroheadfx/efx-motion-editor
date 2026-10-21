---
status: resolved
trigger: "Auto-paint on an empty frame does not create/initialize a key, so the painted stroke and its cache are lost. Auto-paint mode also still shows the Create key fallback button, which should be hidden there (+key is the manual path). Repro from user's live app: enable auto-paint, paint on an empty frame -> no key paint is created and the cache is lost."
created: 2026-10-21T07:31:32Z
updated: 2026-10-21T15:40:00Z
---

## Current Focus

bug_class: Bohrbug (deterministic; both residual faults are synchronous contract violations on the accepted/leave path)

reasoning_checkpoint:
  hypothesis: "Two independent contracts strand live state after a successful auto-key. (A) The accepted physical edit publishes the child document and then performs unrecoverable UI aftermath (reconcile, selection/rail bookkeeping, cache reload, settlement ack). A throw in that aftermath skips `acknowledgePhysicalEditSettlement`, so `settledLeaseRef` keeps the exclusive store lease active: `physicalMutationAvailable` stays false -> `mutationLocked` true -> after `autoKeyPromotionPaintExempt` clears, `rotoInputDisabled` true -> the canvas stack is pointer-events:none (pointer cursor, no brush ring). Water color paints only because the aquarelle layer sets its own pointer-events:auto. (B) Both capture paths await `pendingFirstPaintTarget.promise` (auto-key promotion) before submitting the capture. Navigation calls the aquarelle flush and `flushLivePixels` BEFORE the promotion resolves, so a deferred capture submits after that flush returned and waits CAPTURE_PRODUCE_QUIET_MS = 6000 ms from the last interaction; leaving/closing inside the window strands the pixels (empty cache on return)."
  confirming_evidence:
    - "RED coordinator test: `reconcileCurrentFrame` throwing at useRotoPhysicalEditCoordinator.ts:1338 propagates out of consumePhysicalEditResult -> consumeBridgeApplyResult; accept() never settles, acceptedSignal null, lease held. Stack captured in the failing run."
    - "Static chain: finalizeAccepted calls reconcile (1338) BEFORE acceptedSignal (1340) and the settledLeaseRef handoff (1357-1364); the Studio wrapper acks as its LAST statement after ~120 lines of aftermath, with no try/catch anywhere in consumeBridgeApplyResult or the bridge listener."
    - "Lock surface: PhysicsPaintStudioView.tsx:193 sets pointerEvents none when inputDisabled; canvasStack memo depends on rotoInputDisabled (not stale); engine.onPointerMove is ungated and the ring unconditional, so a missing ring proves the stack lock, not engine.inputLocked."
    - "Live capture 09:36Z: navigateToSyncedPhysicalFrame invokes aquarelleFlushCaptureRef then flushLivePixels(currentFrame); aquarelle-capture-enqueue lands at 30.864Z only because promotion had resolved by then. CAPTURE_PRODUCE_QUIET_MS = 6000 in rotoLivePixelCacheTransactions.ts:24; a capture submitted after flush returns is invisible to that flush (pending.set is synchronous, flush iterates current pending)."
  falsification_test: "If the store lease were already released at acceptance, a forced reconcile throw would still leave acknowledgePhysicalEditSettlement returning true and physicalMutationAvailable true (Brush unlocked). If deferred captures were already flushed by navigation, leaving within <6 s of acceptance would still produce a cache-write-commit; observing an empty cache-read after a fast leave would refute the quiet-window explanation."
  fix_rationale: "Guard the reconcile (visual refresh must not gate settlement), keep the settlement ack as the guaranteed last statement in a finally, and force the transaction gate open immediately after a promotion-deferred capture submits. Each fix addresses the contract that was violated, not the symptom (no pointer-events override, no quiet-window shortening)."
  blind_spots: "The wrapper aftermath itself is only pinned structurally (huge Studio source-pin test); no behavioral component test exercises a throwing selection/rail handler. The exact live trigger of the Brush throw is not reproduced in this run (the 09:36Z capture shows reconcile succeeding), so the guard is defensive against the proven class rather than a specific thrown line. Engine-1 watercolor capture still early-returns by design; the aquarelle path is the owner."
  candidate_causes:
    - "code: settlement/reconcile ordering and unguarded aftermath in finalizeAccepted + Studio route wrapper (accepted state)"
    - "config/contract: capture transaction quiescence (6000 ms quiet window) vs promotion-deferred submission ordering (pixel cache)"
    - "environment: live-only timing (native WKWebView schedule) makes the deferred capture lose the race; unit probes cannot observe it"
  and_gate: "no — the two faults are independent: (A) is an exception-ordering bug in the accepted settlement; (B) is a submit-vs-flush ordering bug. Neither requires the other to fire."

next_action: Human-verify checkpoint returned. Native UAT: (1) Brush — paint on an empty frame, keep painting immediately after the key appears; (2) Water color — paint on an empty frame, leave/return within a few seconds while the sheet still settles. Then read /private/tmp/paint-cache-frame-enter.json for physical-settlement-ack (released:true), physical-settlement-aftermath-failed (absence expected), promotion-settled (scriptLocked:false, leaseAvailable:true), and cache-write-commit events.

## Symptoms

expected: Painting on an empty Roto frame with direct-paint auto-key creates the blank Roto key for that frame and preserves the painted stroke/cache across navigation and reopen. No Create key fallback button appears in auto-paint mode, because +key is the deliberate manual key-creation path.
actual: Painting on any empty frame creates no key; the stroke/cache is lost immediately and after navigation/reopen. A Create key fallback button appears; clicking it also creates no key and yields the same errors. Console evidence (user, native app):
- "Could not create a Roto key on this frame - the stroke was discarded."
- "[PhysicsPaintStudio] physical edit: Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical revision became stale before commit."
- "[PhysicsPaintStudio] auto-key promotion failed: no-acceptance · reason=parent-rejection · Apply failed — see LOG · Added an empty Roto key."
Stack: logDiagnostic PhysicsPaintStudio.tsx:1301 -> useRotoPhysicalEditCoordinator.ts:819/837 -> consumeBridgeApplyResult PhysicsPaintStudio.tsx:2660/601 -> usePhysicsPaintApplyResultController.ts:83 -> usePhysicsPaintParentBridge.ts:298.
errors: parent-rejection, reason=parent-rejection; "Roto physical revision became stale before commit"; auto-key promotion branch no-acceptance; key-add status "Added an empty Roto key."
reproduction: In the native app, open Physic Paint Studio in Roto, go to any empty frame, paint one stroke. No key is created and the paint is lost; the Create key fallback appears. Clicking Create key fails the same way.
started: 2026-10-21, first live test of the 261019-mj2 direct-paint auto-key path. Before 261019-mj2 the user could paint on an empty frame directly (no key, no cache). Automated tests were green, but the live parent-bridge path was never exercised.

## Eliminated

- hypothesis: The Create key fallback button appears because an auto-paint-mode flag gates it but is mis-set.
  evidence: There is no auto-paint-mode flag anywhere in the code. `createKeyFallback` (PhysicsPaintStudio.tsx ~4780) gates only on: workflowMode==='roto', autoKeyFallbackFrame===currentFrame, !isPlaying, !mutationLocked, !autoKeyPromotionPaintExempt, selection not real-key, paintTarget.kind==='empty'. So the button is simply the D-06 fallback surfacing after the promotion failure — the visibility defect is that no suppression exists, not a mis-set flag.
  timestamp: 2026-10-21T09:40:00Z

- hypothesis: The "Added an empty Roto key." status implies the promotion succeeded and only the cache was lost afterwards.
  evidence: ADD_KEY_SUCCESS_MESSAGE ('Added an empty Roto key.') is published by `runPhysicalAction` in useRotoTimelineActions.ts only when `executePhysicalEdit` returns accepted. In the user's repro the immediate failure is 'no-acceptance'. The success message in the diagnostic bundle is therefore either from an earlier accepted +Key/manual attempt in the same session (proving the channel can accept) or from a stale status left in the LOG panel — it does not indicate this promotion succeeded.
  timestamp: 2026-10-21T09:50:00Z

## Evidence

- timestamp: 2026-10-21T09:20:00Z
  checked: physicPaintBridge.ts parent apply path (~1736) and docSync receive path (installPhysicPaintEfxPaintDocumentListener)
  found: Parent rejects with 'Roto physical revision became stale before commit.' when `currentRevision !== payload.expectedRevision`, where currentRevision = buildPhysicPaintRotoPhysicalRevision over parent store records/interpolation/loops/breaks/groupOverrides. The docSync receive path runs `applyDocumentSyncFrameMedia` BEFORE the revision guard and gates mirroring on `getRotoPhysicalContentRevision(...) === track.rotoPhysical.revision`.
  implication: The rejection is a pure revision-string equality gate on the parent realm. Any carrier (inline bytes `d...;` vs media ref `m...;`) or collection divergence between realms produces this exact error.

- timestamp: 2026-10-21T09:25:00Z
  checked: physicPaintBridge.ts `mirrorSyncedTrackDocuments` / `preserveMirroredInlineBytes`
  found: `bytesByDigest` is built ONLY from the parent runtime records (track-scoped, then layer-wide). `preserveMirroredInlineBytes` re-attaches parent bytes by digest and recomputes the revision. The `_documentSyncFramePorts` / `_frameMediaBytes` digest store — which `apply-canvas` populates with painted frame bytes — is not consulted by this path.
  implication: If the parent runtime lacks a record's bytes (e.g. it was built from a media-shaped docSync, or the key was created child-side and paint traveled only via apply-canvas), the mirrored record keeps its media reference and the recomputed revision is media-carrier, while the child's is bytes-carrier. Direct cause candidate for the gate mismatch.

- timestamp: 2026-10-21T09:30:00Z
  checked: PhysicsPaintStudio.tsx pushLiveProjection (~5095) and docSync trigger wiring
  found: docSync (`physic-paint:efx-paint-document`) is pushed only on structural `efxPaintVersion` changes; physical edits and paint results are explicitly excluded from docSync and ship only through the applyPayload/apply-canvas bridge. `bumpTrackRevision` bumps `physicPaintVersion`, not `efxPaintVersion`.
  implication: A paint-only update to a real key (updateRotoPhysicalRealKeyPayload + apply-canvas) never causes a docSync push, so the parent physical records for that key lag behind the child. The child's next physical edit computes expectedRevision over the painted (bytes) record; the parent still holds the pre-paint record revision -> stale rejection. This is the strongest candidate for the first-failure-with-prior-success pattern.

- timestamp: 2026-10-21T09:35:00Z
  checked: useRotoPhysicalEditCoordinator.ts dispatch (~1855) and settlement (~1479)
  found: The child computes `expectedRevision` live from the child store at dispatch; settlement re-checks the child store revision against pending.expectedRevision. On a parent rejection it calls finalizeFailed(pending, before, 'parent-rejection', transition.detail?.error) and the Studio routes the promotion failure diagnostic with reason=parent-rejection.
  implication: Confirms the child never compares against the parent before sending — divergence is only discovered at the parent gate, matching the observed error path exactly.

- timestamp: 2026-10-21T09:45:00Z
  checked: useRotoFramePersistenceCoordinator.ts routeRotoPhysicalPaintFrame / queueParentPayload / upsertCachedFrame
  found: `upsertCachedFrame` writes `store.updateRotoPhysicalRealKeyPayload` on the CHILD only, then queues the parent payload `{ kind: 'apply-canvas', renderedFrame }` via the parent bridge, then marks the docSync digest delivered. The parent-side apply-canvas installs bytes into the digest store only; it does not update parent physical records.
  implication: Confirms the asymmetric write: after a paint capture, child records carry bytes inline; parent records still carry the prior payload/reference. The next child physical edit's expectedRevision cannot match the parent revision unless a docSync mirror intervenes with identical carriers.

- timestamp: 2026-10-21T09:55:00Z
  checked: physicsPaintRotoPhysicalModel.ts buildPhysicPaintRotoPhysicalRevision / encodePhysicPaintRotoPhysicalContent
  found: Canonical encoding is carrier-sensitive: inline bytes hash as `d<len><head><tail>;`, media references hash as `m<relativePath><digest>;`. Records are ordered by stable identity.
  implication: The gate is string-equality on a carrier-sensitive hash; a bytes-vs-media difference for the identical logical content is guaranteed to mismatch. This establishes the falsifiable prediction for the harness test.

- timestamp: 2026-10-21T10:00:00Z
  checked: .planning/quick/261019-mj2-roto-paint-workflow-auto-key-on-paint-ke/261019-mj2-CONTEXT.md (D-01..D-16)
  found: D-06 explicitly ships the centered Create key fallback as the UAT fallback if direct paint fails live. There is no auto-paint-mode flag concept in the decisions; direct paint IS the auto-key behavior.
  implication: The secondary UX fix is a suppression gate, not a flag correction. Direct-paint auto-key contract upstream is correct; the failure is in execution.

- timestamp: 2026-10-21T10:12:00Z
  checked: useRotoPhysicalEditCoordinator.ts executePhysicalEdit end (~2364-2381) and runPhysicalAction success-status ordering
  found: `await portsRef.current.bridge.sendPhysicalEditPayload(wirePayload); ... return true;` — executePhysicalEdit resolves true on successful SEND, not on parent settlement. `runPhysicalAction` therefore publishes ADD_KEY_SUCCESS_MESSAGE ('Added an empty Roto key.') immediately, before the parent rejection arrives via finalizeFailed.
  implication: Resolves the LOG contradiction: the success status and the parent-rejection diagnostic come from the SAME failing attempt. Refutes the "earlier accepted key" explanation of Eliminated entry #2; the failure IS a first-edit failure. Also means the Create key button failing identically is expected (same pre-edit revision gate).

- timestamp: 2026-10-21T10:14:00Z
  checked: /tmp for app-written capture files (find /tmp -maxdepth 2 -name 'efx-*' etc.)
  found: No capture files present.
  implication: No live realm-state dump to compare against; the divergence must be reproduced deterministically in the cross-realm harness.

- timestamp: 2026-10-21T10:22:00Z
  checked: physicPaintBridge.liveLaunchParity.probe.test.ts re-run (real launch door + real child launch docSync push + real parent listener/mirror)
  found: 7-record persisted doc -> persisted media revision `physical-1793-6737aa5c`; parent after launch, carried launch document and child after hydration all `physical-2518-71d992f9` (bytes). Six-record live shape (drop frame-17 record + its break, recompute): parentAfterLaunch = childAfterHydration = parentAfterPush = childAfterPush = `physical-2151-6af3bbe7`; wire media projection = `physical-1527-536616ab`. Both probe assertions pass.
  implication: The launch leg and the launch docSync mirror are deterministic and carrier-correct on the exact live record set. The stale gate cannot be explained by launch; the divergence is post-launch live state.

- timestamp: 2026-10-21T10:25:00Z
  checked: active-track resolution (PhysicsPaintStudio.tsx:571 `studioActiveTrackId`, :980 `getActiveTrackId`, records port :1706-1707, payload trackId coordinator :2282)
  found: Both `studioActiveTrackId()` and the coordinator's `getActiveTrackId` resolve `getEfxPaintDocument(layerId)?.activeTrackId`; the records port and the payload trackId therefore name the same track (fallback differs — launch track vs `''` — but the document is registered and present in the live session).
  implication: Track mismatch is not the mechanism under normal operation; it remains a corner case only if the child's efx document is absent.

- timestamp: 2026-10-21T10:28:00Z
  checked: Studio boot checkpoint substitution (usePhysicsPaintLaunchIntegration.ts:127-129) + transport encoding (physicsPaintBridgeTransport.ts:126-168, webpBytes.ts toTransportPayload/fromTransportPayload)
  found: Checkpoints store `serializeRuntimeIntoDocument(layerId)` (bytes, no resolveRef) as base64 via `toTransportPayload`, bound to the launch operationId; base64 round-trip preserves Uint8Array bytes. Substitution only occurs for a matching operationId.
  implication: A Studio remount cannot flip bytes to media, and a fresh launch has no prior checkpoint. Not the divergence source.

- timestamp: 2026-10-21T10:31:00Z
  checked: save projection (efxPaintStore.serializeRuntimeIntoDocument with resolveRef)
  found: The package-save projection rewrites media refs only inside the efx document (`_documents`); it does not write the physicPaintStore runtime records.
  implication: Saving cannot swap the parent runtime carrier; the in-session gate rejection is independent of the save.

- timestamp: 2026-10-21T10:34:00Z
  checked: /private/tmp/paint-cache-frame-enter.json events + capture plumbing (paintCacheFrameEnterCapture.ts; useRotoReferenceController.ts:166-270; PhysicsPaintStudio.tsx:2290-2300)
  found: 10 events: frame-enter 0 empty (pv 0,1), roto-playback-stop 0, frame-enter 1 cache-read bytesLen 267096 contentRevision `physical-2151-6af3bbe7` (pv 6,8), skip-plain-refresh (pv 10), roto-playback-stop 1 flattened true, frame-enter 17 empty (pv 13,14). No cache-write / live-capture events. `contentRevision` comes from the frame's render source = the LIVE track-wide `structural.contentRevision` (physicPaintStore.getRotoPhysicalRenderSource:4570-4575). Playback-stop only reads `getFlattenedFrame` and bumps `physicPaintVersion`. `routeRotoPhysicalPaintFrame` returns `empty-target` without mutating the store for a keyless frame.
  implication: At frame 1 (pv 6) the live child held exactly SIX bytes-carried records (`physical-2151-6af3bbe7`), i.e. the frame-17 record did not exist at launch. Painting the empty frame reached the promotion with no prior child record mutation, so the failure is at key creation.

- timestamp: 2026-10-21T10:37:00Z
  checked: persisted layer document + file mtimes + app-config lastOpened
  found: layers/7bcc…json has 7 real-key records (frames 0,2,6,9,13,15,17); frame 17 is a blank WebP (digest a6110034, 88 bytes), selected ff110f96, cursor 17, capacity 18, interpolation {enabled:true, mode:'duplicate'}, breaks [bc8c1ce4,bda911e8,64fd918c,ff110f96]. Capture file mtime 07:26:42Z, project/layer save 07:26:48Z, project lastOpened 07:26:49Z, paper capture 07:27:22Z.
  implication: The seventh record post-dates the six-record launch and was persisted at 07:26:48Z. Its origin is NOT proven to be an accepted Studio promotion — it could be a later successful Create key click, or a main-window +Key before the 07:26:49Z reopen. The earlier "accepted add-empty-key proved" inference is downgraded.

- timestamp: 2026-10-21T10:38:00Z
  checked: parent `applyCanvas` (physicPaintStore.ts:3494-3537)
  found: CORRECTION to Evidence 09:45Z — when a real-key record exists at `payload.startFrame`, `applyCanvas` calls `updateRotoPhysicalRealKeyPayload` on the PARENT with the rendered bytes (guarded by the parent's current content revision); with no key it calls `upsertRealRotoKeyFrame`. The digest-store install (physicPaintBridge.ts:509-519) is additional, not the whole effect.
  implication: A child paint capture can mutate parent records out-of-band (no docSync), and the parent's guarded update can fail silently from the child's perspective. A new asymmetry source exists between paint captures and physical edits.

- timestamp: 2026-10-21T10:41:00Z
  checked: physicPaintBridge.ts:3575-3604 mirror commentary + preserveMirroredInlineBytes (3478-3539)
  found: The codebase already documents this exact failure family: right side media-carried, left side bytes-carried for identical pixels, stable for minutes, every later physical edit rejected with "Roto physical revision became stale before commit". `preserveMirroredInlineBytes` re-attaches bytes only when the parent holds the record (`getRotoRealKeyRecord`) or the layer-wide `bytesByDigest` has the media digest, and only when `frameDigestForInlineBytes(bytes) === media.digest`; otherwise the record stays media-carried. `mirrorSyncedTrackDocuments` skips tracks whose parent content revision equals the WIRE revision — the wire is media-projected, so this skip comparison and the install both hinge on carrier bookkeeping.
  implication: Candidate (A) has strong precedent and a precise, falsifiable shape: on the live gate, parent records will hash `m…` where the payload/staged records hash `d…`. This is the first term to check in the capture.

- timestamp: 2026-10-21T11:00:00Z
  checked: /private/tmp/physic-revision-components.json — 11 live events from the user's repro at frame 15
  found: Event 2 is a paste-key physical-map apply with matched=true (parent physical-1784-8384a6d3; payload adds key ff341d8a). Events 3-8 are paste-key applies with matched=false, parent physical-2151-c402edd, each adding a NEW key id while the parent still carries ff341d8a. Shared carrier/content terms match on every event; incomingBreaksMatch is false on all of them. The child baseline therefore stayed at the pre-acceptance revision after event 2, so every later promotion is stale.
  implication: The accepted auto-key promotion is not applied back to the child before the next promotion. Root-cause the accepted-output application/reconciliation path — not the launch path and not the media-vs-bytes carrier hypothesis.

- timestamp: 2026-10-21T11:00:00Z
  checked: user-requested UI correction during the debug
  found: The Create key fallback was removed from PhysicsPaintStudioView (prop + render), physicsPaintStudio.css, the Studio gate/handler/signal, and the 'create-key-button' promotion source. Focused PhysicsPaintStudio.test.ts passes 178/178; full typecheck exits 0.
  implication: Do not restore the fallback; +key is the manual key path. The fix must make direct auto-paint work without a fallback button.

- timestamp: 2026-10-21T09:05:00Z
  checked: user's second live repro after the Create key fallback removal (frame 15, empty cell)
  found: No brush preview on the empty key; painting fails with "Could not create a Roto key on this frame - the stroke was discarded." and the exception "Roto physical edit failed (exception): Frame-indexed child state is not completely owned by the pre-state real-key identities."; auto-key promotion reports no-acceptance · reason=exception. Stack: useRotoPhysicalEditCoordinator -> consumeBridgeApplyResult -> usePhysicsPaintApplyResultController -> usePhysicsPaintParentBridge.
  implication: The accepted edit now reaches child publication, which fails closed on frame-indexed state that has no pre-state owner.

- timestamp: 2026-10-21T09:10:36Z
  checked: beginRotoFrameEditImplRef and replacePhysicalDocumentWithOwnership / rebuildRotoPhysicalOwnership
  found: beginRotoFrameEditImplRef marks the empty frame dirty and live-overlay-dirty before startRotoPaintPromotion. The accepted document's rebuild maps every snapshot frame through the pre-state real-key identities; the promoted empty frame has no pre-state identity and is not Group-owned, so remapOwnedSet/Map return null and the rebuild fails with the exact error. The earlier stale parent rejections are downstream: the child never publishes the accepted document, so its next promotion uses the pre-acceptance revision.
  implication: The accepted key frame must be discardable during the ownership rebuild. Added the before→after keyId frame diff (`addedKeyFrames`) to `discardUnownedAppFrames` in replacePhysicalDocumentWithOwnership. Focused tests 182 pass; typecheck error set unchanged from baseline. Awaiting live UAT.

- timestamp: 2026-10-21T09:18:32Z
  checked: post-ownership-fix live test — Brush module
  found: Auto-key creation succeeds, but painting stays blocked: pointer cursor, no brush ring, no stroke. The aquarelle layer re-enables pointer events in its own container (`disabled={false}` → pointerEvents auto) while the Studio stack sets pointerEvents none when rotoInputDisabled; that asymmetry is why Water color still paints under the lock. rotoInputDisabled = mutationLocked && !autoKeyPromotionPaintExempt. Suspects: lease settled but not released, recovery lease, or settlement-mismatch after publication.
  implication: Instrument the auto-key paste-key acceptance/settlement: transition, accepted non-null, acknowledge result, failure reason, lease availability, pending vs current selection/cursor/revision.

- timestamp: 2026-10-21T09:18:32Z
  checked: post-ownership-fix live test — Water color module
  found: Key is created and the brush paints live, but the cache is not persisted — leaving the key/frame shows it empty. The engine-1 completed-mutation capture early-returns for Water color (`if (activeModule.value === 'watercolor') return;` PhysicsPaintStudio.tsx ~4326); the aquarelle sheet capture is separate and does not attach to the auto-created key. The pending first-paint target may be cleared before the aquarelle stroke-end capture resolves.
  implication: Trace the aquarelle stroke-end/capture path against the promotion: key identity + merge base must attach to the new key and the cache write must happen after acceptance.

- timestamp: 2026-10-21T11:52:00Z
  checked: post-ownership-fix live run (single repro) — /private/tmp/physic-revision-components.json + /private/tmp/paint-cache-frame-enter.json
  found: One `physical-map-apply` event at 09:36:24.299Z: matched=true, paste-key, startFrame 14, parent `physical-1784-8384a6d3` (5 bytes records at frames 0,2,6,9,13), payload adds key fb56c5f7 at frame 14 with 88 blank WebP bytes. Reconcile ran 13 ms later (frame-enter cache-read frame 14, 88 B, `physical-2151-57020833`) — the reconcile did NOT throw in this run, and the key published. Paint cache: playback-stop 30.853Z, aquarelle-capture-enqueue base=cache 30.864Z, frame 15 empty 30.868Z, cache-write-commit 38418 B 31.433Z, settle-measured ticks 235 mutationId 7, session-end, second commit 38436 B 32.055Z, then frame 14 cache-read 38436 B. No cache-write-rejected. The user left ~6.5 s after acceptance, so the deferred capture had outlived the 6000 ms quiet window.
  implication: Key creation and lease release both work when the promotion settles before the leave. The Brush lock and the cache loss are timing/exception dependent, consistent with the two contract violations below; this run is the "slow leave" control that stays green.

- timestamp: 2026-10-21T11:45:00Z
  checked: TDD RED — new regression tests before any production change
  found: `pnpm vitest run PhysicsPaintStudio.test.ts useRotoPhysicalEditCoordinator.test.ts` -> 3 failed, 262 passed. (1) coordinator settlement test threw `reconcile failed` from useRotoPhysicalEditCoordinator.ts:1338 through consumePhysicalEditResult/accept(), proving a visual reconcile throw skips acceptance and lease handoff; (2) Studio deferred-capture pin missed `deferredPromotionCapture`; (3) Studio ack pin missed `try { ... } finally {` around the aftermath.
  implication: Falsifiable confirmation of both contract violations before the fix; the tests are derived-oracle regression guards for the settlement and capture contracts (not implicit crash-only oracles).

- timestamp: 2026-10-21T11:48:00Z
  checked: TDD GREEN after applying the five fixes
  found: `pnpm vitest run PhysicsPaintStudio.test.ts useRotoPhysicalEditCoordinator.test.ts` -> 265 passed (180 + 85). Full physic-paint directory -> 152 files, 3184 tests passed. Typecheck produces no error in either touched file; the repo-wide failures (PhysicsPaintPalette.test.ts, physicPaintBridge.ts:2497, projectPaperRaster.test.ts) are pre-existing in files not modified for this fix set.
  implication: All guardrail signals applicable to this change pass: regression tests green, focused suites green, touched-file typecheck clean. The two fixes are minimal and localized (reconcile guard; guaranteed ack in finally; forced flush after deferred capture in both capture paths; measure-only promotion-settled capture).

- timestamp: 2026-10-21T15:00:00Z
  checked: post-color-law live UAT (fresh /tmp/paint-cache-frame-enter.json) + the paste-key acceptance path
  found: The promotion itself succeeds (`promotion-settled ok:true`), but `finalizeAccepted` ALWAYS reconciles `paste-key` (useRotoPhysicalEditCoordinator.ts:1344) before acceptedSignal. The promoted key is BLANK (88-byte WebP), so `loadCachedRotoReferenceFrame(..., generation)` runs `engine.clear(true)` and arms `baseSwapDryClearPending`; when the blank base paints, `redrawPreviewBase()` clears the dry canvas. That erase is exactly the live first stroke — Brush loses it the moment the key appears (Water color survived because the sheet is a separate layer). The same reload (engine clear + blank decode + redrawAll) is the visible hitch at key creation in BOTH modules. The existing `acceptedSelfPromotion` suppression only covered the Studio settlement listener's reload, which runs after the coordinator reconcile.
  implication: The reconcile port must detect the matching pending auto-key promotion, skip the engine base paint, and pin the blank frame as the capture merge base. Capture then merges the live stroke onto the blank key as designed.

## Resolution

root_cause: Two independent contract violations on the accepted auto-key path. (A) Brush input lock: the accepted physical edit performs an unguarded UI aftermath after publishing the child document (finalizeAccepted's `reconcileCurrentFrame` at useRotoPhysicalEditCoordinator.ts:1338 before acceptance/settlement, and the Studio route wrapper's selection/rail/reload bookkeeping before its final `acknowledgePhysicalEditSettlement`). A throw in either place skips the settlement ack, leaving `settledLeaseRef` and the exclusive store lease active; `physicalMutationAvailable` stays false, `mutationLocked` stays true, and once `autoKeyPromotionPaintExempt` clears the Studio canvas stack goes pointer-events:none (pointer cursor, no brush ring). Water color still paints because the aquarelle layer sets its own pointer-events. (B) Water color cache loss: both capture paths await `pendingFirstPaintTarget.promise` (the auto-key promotion) before submitting, but navigation flushes captures before that promise resolves. The deferred capture submits after the flush, is invisible to it, and waits CAPTURE_PRODUCE_QUIET_MS = 6000 ms from the last interaction; leaving/closing inside that window strands the pixels and the cache reads empty on return.
fix: (1) finalizeAccepted guards `reconcileCurrentFrame` in try/catch with a diagnostic — a visual refresh failure can no longer skip acceptance/settlement. (2) The Studio coordinator route wrapper runs the post-acceptance aftermath inside try/catch and moved `acknowledgePhysicalEditSettlement(...,'release')` into `finally`, captured as `physical-settlement-ack` (with `physical-settlement-aftermath-failed` on throw), so the lease is always released on the accepted path. (3) Engine-1 completed-mutation capture tracks `deferredPromotionCapture` and forces `rotoPersistence.flushLivePixels(appFrame)` immediately after submitting. (4) The aquarelle capture defines `flushDeferredPromotionCapture` (guarded by `pendingFirstPaintTarget === null`, which keeps the non-deferred navigation flush path untouched) and invokes it after both the initial and retry enqueues. (5) Measure-only `promotion-settled` capture records scriptLocked/leaseAvailable/exempt post-promotion. (6) The Studio `reconcileCurrentFrame` port detects the pending auto-key self-promotion (`pendingFirstPaintTargetRef`), skips the blank-key base paint that armed the engine's atomic dry clear, pins the blank frame as the capture merge base, and records `promotion-reconcile-skipped`. This preserves the live first stroke and removes the key-creation engine reload (the perceived hitch in both modules).
verification: TDD red->green. RED (3 failed / 262 passed) reproduced both leaks: the reconcile throw escaped consumePhysicalEditResult and skipped settlement; the deferred-capture and finally-pinned source contracts were absent. GREEN: 265/265 across the two focused suites; 3184/3184 across all 152 physic-paint test files; no typecheck error in touched files (repo-wide pre-existing failures remain in unmodified files). Live control run at 09:36Z shows key creation, lease release and cache commits when the promotion settles before the leave; native UAT pending for the two timing-sensitive flows.
files_changed:
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts (guarded reconcile in finalizeAccepted)
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx (settlement try/catch/finally + guaranteed ack + ack/aftermath captures; deferred-capture flush in engine-1 and aquarelle paths; promotion-settled capture)
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts (settlement regression test)
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts (deferred-capture flush pin + guaranteed-ack pin)
oracle_type: derived (settlement/capture contracts: an accepted edit always releases its lease; a promotion-deferred capture is flushed) — plus source-pinned structural assertions for the wrapper and capture blocks.
live_uat: approved by the user on 2026-10-21 after the Brush one-paper-multiply law, first-stroke preservation, and the key-creation hitch fix. Debug /tmp capture instrumentation was removed before commit; the remaining contract tests pin behavior, not logging.
