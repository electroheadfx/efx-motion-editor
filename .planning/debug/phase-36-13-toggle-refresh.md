---
status: resolved
trigger: "Continue Phase 36.13 on branch `phase-36.13-debugs`. Run exactly Debug 05 — Toggle and Refresh, narrowed to the remaining native-UAT tool-availability refresh failure."
created: 2026-07-12
updated: 2026-07-12
---

## Current Focus

hypothesis: "Paste keeps keyActionInFlight true while persistRotoKeyFrameTransaction awaits the native replace-key-frames apply publication. That global blocker disables Copy/Delete during immediate navigation; when the async apply result returns, the action settles and the UI repairs. The shared session refresh also cleared copiedKeyRef, violating reusable clipboard semantics."
test: "Render useRotoKeyUtilities through PhysicsPaintWorkflowStrip, perform an actual Copy -> navigate -> Paste, leave persistence unresolved, then immediately navigate to real frame 9, generated frame 8, and empty frame 15. Assert Copy/Delete classification updates immediately and Paste remains available from the reusable clipboard."
expecting: "Pre-fix RED at frame 9 because Copy remains disabled while the Paste persistence Promise is unresolved. Post-fix GREEN without resolving persistence first."
next_action: "Await native UAT of the exact post-Paste navigation sequence; automated RED/GREEN is complete."
first_divergent_symbol: "unlisten assignment in usePhysicsPaintLaunchBridge: eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, ...) is reached only after awaiting coreApi.invoke('get_physics_paint_launch_context')."
known_pattern_candidate: "Async initialization-order race with two launch-context publication sources."
reasoning_checkpoint:
  hypothesis: "Awaiting stored launch context before registering the launch event listener creates a loss window; registering first closes the window, while an event-generation guard prevents an older delayed stored context from superseding a newer event."
  confirming_evidence:
    - "The production effect awaits coreApi.invoke before importing eventApi and calling listen."
    - "The initial native URL omits cachedRotoFrames, so the full launch event/stored context is required for downstream availability."
  falsification_test: "If a direct rendered hook test shows the listener is already registered while invoke is unresolved, or the event is not applied immediately after registration, this hypothesis is wrong."
  fix_rationale: "Move listener installation ahead of the stored-context await and apply the stored result only if no newer launch event arrived during the request."
  blind_spots: "The direct hook boundary proves bridge timing/order; rendered Studio coverage separately proves Copy/Delete availability after a full context is applied."
tdd_checkpoint:
  test_file: "app/src/lib/physicPaintRotoDurableCore.test.ts"
  test_name: "registers the launch listener before stored context resolves and preserves the newer event"
  status: "red"
  failure_output: "Focused Vitest run failed at physicPaintRotoDurableCore.test.ts:907: expected launchListeners length 1 while stored invoke remained unresolved, received 0."

## Symptoms

expected: "When native navigation selects a visible projected real Roto key, Copy and Duplicate are enabled immediately. After Copy, Paste availability updates immediately on a valid target. Availability must match the same state after close/reopen."
actual: "Native UAT reports delayed Copy/Paste/Duplicate availability in some navigation states. The visible workflow strip can classify the selected interpolation-ON display frame as a real key while session availability remains disabled; leaving and returning to the timeline or reopening can make the tools available."
errors: "No explicit error is reported. Native buttons remain disabled or actions are rejected because availability is stale."
started: "Observed during Phase 36.13 native UAT and recorded while completing Debug 04 on 2026-07-12."
reproduction: "With interpolation ON and source real keys such as 0/1/2/3 projected to display 0/3/6/9, navigate natively to visible real key display 9 and inspect Copy/Duplicate availability. Copy the key, navigate to a valid target, and inspect Paste availability. In the failure, availability becomes correct only after another navigation, leaving/returning, or close/reopen."

## Scope Constraints

- Run exactly Debug 05, narrowed to the native-UAT tool-availability refresh failure.
- Do not reopen Debugs 02–04.
- Do not modify committed source/display, Save, Paste, persistence, hydration, or projection behavior.
- Do not start Debug 06 or Debug 07.
- Do not fix the Duplicate transaction/projection failure; Duplicate may only be checked as an availability indicator.
- Do not add mirrored state or an internal Roto useEffect synchronization workaround.
- Do not start the development server.
- Do not commit unless explicitly requested.

## Evidence

- timestamp: 2026-07-12T20:49:00Z
  checked: "Exact rendered post-Paste path with native persistence deliberately unresolved"
  found: "Paste applies and publishes the replacement cache synchronously, then executeSessionEffects awaited persistRotoKeyFrameTransaction. runSessionResult therefore kept keyActionInFlight=true for the full native apply round trip. deriveRotoKeyUtilityActionState consumes that blocker, so Copy/Delete remained disabled on immediately selected real frame 9. The apply-result publication that resolves the replace-roto-key-frames operation completes the awaited persistence path and sets keyActionInFlight=false, producing the delayed repair. The same completion path called syncPendingRotoFrames, whose resetSession previously cleared copiedKeyRef."
  implication: "The delay is not waiting for cache identity, projection replacement, a timer, playback, launch context, or remount. It is the native replace-key-frames apply completion releasing keyActionInFlight. Paste must publish local availability immediately while persistence continues, and ordinary post-transaction refresh must retain the clipboard."

- timestamp: 2026-07-12T20:47:42Z
  checked: "Rendered TDD checkpoint for actual Copy -> Paste -> immediate navigation"
  found: "RED at physicPaintRotoDurableCore.test.ts:946: expected Copy on real frame 9 to be enabled before the unresolved persistence Promise completed, received disabled=true."
  implication: "The test faithfully reproduces the UAT-specific post-Paste stale availability without any unrelated async response."

- timestamp: 2026-07-12T20:49:08Z
  checked: "GREEN verification after Paste-specific asynchronous persistence and clipboard-preserving session refresh"
  found: "The rendered test passes while persistence remains unresolved: frame 9 enables Copy/Delete, generated frame 8 disables both, and empty frame 15 keeps Paste enabled from the original clipboard. Focused Debug 05 tests pass (3), Roto session/strip regressions pass (72), and TypeScript check passes."
  implication: "Availability now follows the synchronous local cache/projection publication, while native persistence acknowledgement remains responsible only for durable completion feedback."

- timestamp: 2026-07-12T20:30:00Z
  checked: "Native startup bridge ordering against local rendered-cell navigation"
  found: "The native window URL contains only flat launch fields and omits cachedRotoFrames. usePhysicsPaintLaunchBridge asynchronously awaits get_physics_paint_launch_context before installing the launch listener. A local cell navigation immediately publishes launchContext.startFrame and records pendingFrameSyncRef. When the delayed stored-context invoke resolves, applyIncomingLaunchContext preserves pendingFrameSyncRef as startFrame, hydrates the full cache, resets the session, and republishes launchContext. This single delayed publication can repair Copy and Delete together while keeping the visibly selected frame."
  implication: "Highest-ranked repair event is delayed get_physics_paint_launch_context completion, not a timer in utility code. The harness must defer the real invoke, select while it is pending, then resolve it and observe the shared availability repair."

- timestamp: 2026-07-12T20:35:00Z
  checked: "Attempted faithful delayed-invoke regression in physicPaintRotoDurableCore.test.ts"
  found: "The existing hoisted dynamic Tauri mock still never installs the launch listener, even after reordering production listener registration before invoke and repeated async flushes. The test therefore remains RED at listener count 0 for both pre-fix and proposed fix and cannot distinguish production behavior."
  implication: "This is the exact missing harness boundary: the rendered Studio test cannot observe dynamic @tauri-apps/api/event registration. Per the user's requirement, production must not be edited without a genuine RED/GREEN. The bridge-order correction was reverted; only harness/debug-file changes remain."


- timestamp: 2026-07-12T19:55:00Z
  checked: "Exact selected-frame path and candidate repair events"
  found: "Cell click calls requestRotoFrameNavigation -> useRotoNavigationCoordinator.requestNavigation -> session.requestFrame -> persistence openFrame, which first sets launchContext.startFrame and then emits physic-paint:seek-frame. Studio reads currentFrame directly from launchContext.startFrame; selectRotoTimelineView derives the projection; useRotoKeyUtilities derives actionAvailability from that current frame plus projected real keys; the strip maps it to Copy/Delete disabled props. No timer, polling loop, playback tick, cache publication, or controller synchronization runs at approximately three seconds on this path. The only nearby delayed lifecycle timeout is the five-second apply-operation error timeout, which is unrelated to a clean selection."
  implication: "The reported three-second repair is not produced by the selected-frame availability path. It must be observed/instrumented as an external native launch/cache publication or unrelated render before causal attribution."

- timestamp: 2026-07-12T19:56:00Z
  checked: "Rendered TDD regression and candidate memo against restored inline Studio"
  found: "The rendered Studio regression selects projected real key 9 and immediately observes Copy/Delete enabled, while generated 8 remains disabled; the mounted projection regression refreshes session frames from 0/3/6/9 to 0/1/2/3. Both pass with the candidate memo. The rendered availability regression also passes with the restored pre-fix inline projection expression, so it is GREEN coverage but not a RED proof of the native delay."
  implication: "Preserve the scoped memo as a safe identity stabilization, but do not call it a confirmed correction for the native failure."

- timestamp: 2026-07-12T19:18:00Z
  checked: "PhysicsPaintStudio final workflow props and useRotoKeyUtilities session construction"
  found: "Studio already passes selectProjectedRealCachedRotoFrames(launchContext.cachedRotoFrames, rotoTimelineModel.view.value.projection) into the session and passes session.actionAvailability.value to the workflow strip. The strip independently classifies projected display keys and already falls back to visible-key classification for Copy/Duplicate, but Paste remains session-derived."
  implication: "The first divergence is not inside the strip's projected cell classifier; it must occur before or during launch/native-navigation publication into Studio's currentFrame/session inputs, or in copied-key reactive publication."

- timestamp: 2026-07-12T19:18:30Z
  checked: "Initial rendered regression attempt through the Tauri launch-listener harness"
  found: "The test was RED, but the harness never installed its mocked Tauri listener (listener count remained zero), so the rendered Studio stayed at frame 6. This failure does not reproduce the product bug and cannot be used as causal evidence."
  implication: "Eliminate this harness path and use the existing rendered controller/strip Probe or stored-context remount path to create an unconfounded RED test."

- timestamp: 2026-07-12T16:25:00Z
  checked: "Native UAT observation retained from resolved Debug 04"
  found: "Copy/Paste/Duplicate availability can remain delayed in some navigation states."
  implication: "The unresolved failure is availability refresh only, not the accepted Paste transaction or durable model."

- timestamp: 2026-07-12T00:00:00Z
  checked: "PhysicsPaintWorkflowStrip availability versus PhysicsPaintStudio session inputs"
  found: "The strip classified interpolation-ON display 9 as a real key from projected timeline data, while session availability received raw source-positioned launch frames 0/1/2/3. Copy was disabled or rejected before copied state could populate."
  implication: "Tool availability and Copy capture must consume the same projected real-key frame classification; navigation or reopen only appears to repair availability because it reconstructs session/cache coordinates."

- timestamp: 2026-07-12T20:10:00Z
  checked: "Direct rendered usePhysicsPaintLaunchBridge Probe with deferred mocked core invoke"
  found: "With pre-fix production and Preact act flushing, the focused test deterministically failed because launchListeners remained 0 while invoke was unresolved. After listener-first reorder, it registered one listener, applied the event context immediately, ignored the older delayed stored context, and cleaned up on unmount."
  implication: "The external bridge initialization order is the confirmed race and the stored-context publication must not overwrite a newer event."

- timestamp: 2026-07-12T20:11:00Z
  checked: "Rendered Studio availability after full launch context arrival"
  found: "Projected-real frame 9 exposes Copy/Delete immediately; generated frame 8 and empty frame 12 keep both disabled. The unrelated projected-array memo was removed and this coverage still passes."
  implication: "The downstream availability contract is correct once the full launch context arrives; no session memo correction is required for Debug 05."

## Eliminated

- hypothesis: "The projected real-key array identity memo fixes the native launch race."
  evidence: "The availability test passes without the memo, while the direct bridge test alone produces a genuine pre-fix RED at listener registration."
  timestamp: 2026-07-12T20:11:00Z

- hypothesis: "A mocked Tauri launch event in physicPaintRotoDurableCore.test can directly reproduce native navigation."
  evidence: "The dynamic bridge import did not use the hoisted listener mock in this test harness; paintHarness.launchListeners remained empty after repeated flushes, leaving the UI at frame 6."
  timestamp: 2026-07-12T19:18:30Z

- hypothesis: "The remaining failure is Paste transaction publication or durable far-key spacing."
  evidence: "Debug 04 fixed and live-UAT accepted Paste publication, durable paint/source identity, settings, persistence, hydration, and reopen projection for targets 12 and 14."

- hypothesis: "The remaining failure requires changing the absolute source/display contract."
  evidence: "Debugs 02–04 are committed and live-UAT accepted; this session is explicitly limited to availability refresh at the final display boundary."

## Resolution

root_cause: "After Paste or Delete, executeSessionEffects awaited persistRotoKeyFrameTransaction, so runSessionResult held keyActionInFlight=true until the native replace-roto-key-frames apply-result publication returned. That shared blocker disabled Copy/Delete despite the cache and timeline projection already being replaced locally. The completion-triggered session refresh also cleared copiedKeyRef after Paste, making the clipboard non-reusable."
fix: "For Paste and Delete, start native persistence without awaiting it in the utility action loop; Duplicate retains its existing awaited persistence behavior and Delete transaction semantics are unchanged. Immediately rebuild the session from the synchronously published replacement cache, and make ordinary pending-frame/session refresh preserve copiedKeyRef and copied editable state. Keep explicit launch resets able to clear the clipboard. The independently tested launch-listener ordering correction remains."
verification: "RED Paste: rendered Copy -> Paste failed before persistence completion because Copy on real frame 9 remained disabled=true. RED Delete: the extended rendered test performed Delete at frame 9, left persistence unresolved, navigated to projected real frame 6, and failed because Copy remained disabled=true. GREEN: the combined test passes without resolving persistence, with Copy/Delete enabled on a remaining real key, disabled on generated and empty frames, and reusable Paste preserved. Focused Debug 05 tests: 3 passed. pnpm exec tsc --noEmit passed. Full durable-core run: 12 passed and the same pre-existing order-sensitive cached-label assertion failed; focused post-transaction tests pass. Native UAT accepted on 2026-07-12: no delayed availability after Paste or Delete, selection-dependent actions refresh immediately, and the copied paint remains reusable across repeated Paste operations."
files_changed:
  - "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts"
  - "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts"
  - "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx"
  - "/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintRotoDurableCore.test.ts"
  - "/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-13-toggle-refresh.md"
