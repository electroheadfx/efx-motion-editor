---
phase: 261109-pwt-phase-60-issue-with-paint-on-cached-key-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
autonomous: true
requirements: [QUICK-261109-PWT]
user_setup: []

estimate:
  tokens: 55000
  raw_tokens: 55000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Returning to a cached key whose frame-leave capture is still pending shows the just-painted pixels on the FIRST return; the second click workaround is no longer needed."
    - "The settle flush targets only the destination frame's identity and runs only once that frame is the DISPLAYED frame (startFrame propagated), so the group-paint stale-document cursor check accepts the commit instead of refusing it."
    - "A superseded navigation, active cached playback, or a frame that is not yet displayed never flushes and never reloads; a navigation with nothing pending arms nothing and adds no wait."
    - "The display reload happens only when the applied preview base's byte carrier differs from the resolved display frame's, so nothing-pending and same-bytes navigations do no reload, produce no flash and cannot loop."
    - "Identity and ordinary paths are untouched: no change to motion evaluation, key evaluation, the compositor, the selection/transform overlay, the engine pointer conversion, the document schema or any store setter."
  artifacts:
    - path: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts"
      provides: "hasPendingLivePixelsForFrame(appFrame, trackId?) read-only per-frame probe (identity-scoped, includes parent-delivery keys) exposed on the hook return"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "pendingDestinationCaptureRef arm sampled before the navigation's synchronous destination load, plus one settle effect that flushes the destination identity after startFrame shows it and forces one reload only on a byte change"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "Source pins for the arm ordering and the settle-effect guards/reload contract"
    - path: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts"
      provides: "Source pin for the read-only probe and its hook-return exposure"
    - path: "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts"
      provides: "Behavior pin: hasPending/flush are per identity, so one identity settles while another stays pending"
  key_links:
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts"
      via: "the navigation arm calls rotoPersistenceRef.current.hasPendingLivePixelsForFrame(frame) BEFORE loadCachedRotoReferenceFrame(frame, previewBasePort)"
    - from: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts"
      to: "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts"
      via: "the probe delegates to livePixelTransactionsRef.current.hasPending(identity) plus the parent-delivery maps; the settle flush uses the existing identity-scoped flushLivePixels(armed.frame)"
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/hooks/useRotoReferenceController.ts"
      via: "the changed-bytes reload reproduces the generated post-flush sequence (clear base, reset background, reload) because the loader's plain-refresh guard refuses an explicit base reload without the clear"
---

<objective>
Make the FIRST return to a cached key show paint added since that key's last cache commit. Today the frame-leave capture for a painted key can still be pending when a navigation loads the destination's cached base; the destination load is synchronous, so it shows the pre-capture payload, and the pending capture only commits when the user clicks the same key again.

Purpose: the paint is already correct in the store transaction path — the defect is that the destination's pending capture commits after its bytes were already loaded into the display, and the commit itself is refused while the Studio's currentFrame still points at the outgoing frame. Settling the destination identity once that frame is displayed removes the second-click workaround without touching paint, motion, compositor or schema code.
Output: one read-only per-frame pending probe in the persistence coordinator, one navigation-time arm plus one settle effect in the Studio, and deterministic source/behavior pins for both.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.claude/skills/efx-async-orchestration/SKILL.md

Key anchors at HEAD (re-verified for this plan):
- app/src/components/physic-paint/PhysicsPaintStudio.tsx — `rotoNavigationGeneration` at 1001; `currentFrame = launchContext?.startFrame ?? 0` at 1234; `launchContextRef` at 814-815; `cachedRotoRepaintBaseFrameRef` at 421-424 (render-mirrored applied base); `rotoPersistenceRef` at 4070-4071. `navigateToSyncedPhysicalFrame` at 5441: `setRotoPhysicalSelection(..., frame)` writes the document cursor synchronously at 5487; `aquarelleFlushCaptureRef.current?.();` at 5503; `rotoPersistence.snapshotLivePixels(currentFrame)` at 5508; `const flushPromise = rotoPersistence.flushLivePixels(currentFrame);` at 5510; `setCachedRotoReferenceUrl(null);` at 5511; the destination is loaded SYNCHRONOUSLY at 5515-5517 (`previewBasePort.clearPreviewBaseImage(true)`, `previewBasePort.resetBackground(true)`, `loadCachedRotoReferenceFrame(frame, previewBasePort)`) before `await flushPromise` at 5521; the generated-only post-flush repaint at 5542-5548; `scheduleRotoStartFramePropagation(frame)` at 5554. `currentFrame` only moves one rAF later.
- app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts — `resolveFrameIdentityInput(appFrame, trackId?)` at 768-780 (same identity resolver every capture/flush uses); `snapshotLivePixels` at 846-850; `flushLivePixels(appFrame?, trackId?)` at 852-888 (identity-scoped transaction flush plus the parent-delivery await/throw); return object at 917-934 with the global `hasPendingLivePixels` at 928.
- app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts — the group-paint stale-document refusal at 2149-2162 with `cursor: currentDocument.cursorAppFrame === currentAppFrameForEdit`; `currentAppFrameForEdit` is the Studio's `currentFrame`, so during the leave flush the destination capture is refused while the destination is the document cursor.
- app/src/components/physic-paint/hooks/useRotoReferenceController.ts — loader at 156-262; the plain-refresh guard at 199-215 refuses a reload when an explicit base is already applied for the same frame; `findCachedRotoDisplayFrame` at 108-118; the app-owned `previewBasePort` at 357-385.
- app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts — `flush(identity)` at 240-260 (identity-scoped, three passes, `beginFlush` opens the queue gate globally for the flush window); `hasPending(identity?)` at 261; `pending` is keyed by launchId/layerId/keyId.
- app/src/components/physic-paint/pilot/finalizationQueue.ts — `beginFlush()` opens the gate and bypasses the quiet window; `CAPTURE_PRODUCE_QUIET_MS = 6000` is why a capture enqueued one rAF after the navigation flush can stay pending.
- Live evidence (/tmp/efx-aquarelle-render-split.json, 2026-11-09): the leave navigation's flush refuses the destination's capture (`physical-dispatch-refused`, `stage: 'stale-document'`, `checks.cursor: false`) and the rAF frame-leave capture then sits pending; RETURN loads the destination base synchronously before the awaited flush, so it shows the pre-capture payload; a second click on the same key flushes the identity while the cursor matches and the commit + acceptance reconcile repaint it. That is the reported symptom, reproduced end to end.
- Test harnesses: app/src/components/physic-paint/PhysicsPaintStudio.test.ts reads the Studio source as `studio` at line 18 and defines local `regionOf` helpers; app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts reads `coordinatorSource` at line 23; app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts already captures with explicit identities and calls `transactions.flush(identity)`.
- app/vitest.config.ts collects ONLY src/**/*.test.ts — never add a .test.tsx. Do not start the dev server; use pnpm and `vitest run` only.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end settle — per-frame pending probe, navigation arm, displayed-frame settle effect</name>
  <files>
    app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
    In app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts add a read-only per-frame probe immediately between `snapshotLivePixels` (ends at line 850) and `flushLivePixels` (starts at line 852): a `useCallback` named `hasPendingLivePixelsForFrame` with signature (appFrame: number, trackId?: string) => boolean whose body resolves the identity with `resolveFrameIdentityInput(appFrame, trackId)`, returns false when it is null, builds the delivery key as launchId + ':' + layerId + ':' + keyId, and returns `livePixelTransactionsRef.current.hasPending(identity) || parentDeliveryRef.current.has(key) || parentDeliveryErrorRef.current.has(key)`; deps are exactly [resolveFrameIdentityInput]. Write the comment naming it the navigation settle probe: it only READS the pending maps, never drains, never flushes, never throws. Expose `hasPendingLivePixelsForFrame,` on the hook's return object between `snapshotLivePixels,` and `flushLivePixels,` at the same four-space indentation.

    In app/src/components/physic-paint/PhysicsPaintStudio.tsx declare `const pendingDestinationCaptureRef = useRef<{ frame: number; generation: number } | null>(null);` immediately before `const navigateToSyncedPhysicalFrame = useCallback(` at line 5441, with a comment: the destination frame whose frame-leave capture was still pending when this navigation loaded its cached base; consumed by the settle effect below. Inside the navigation body, immediately after `setCachedRotoReferenceUrl(null);` (line 5511) and before the `clearAndLoadStartedAtMs` sample, assign the arm UNCONDITIONALLY: `pendingDestinationCaptureRef.current = frame !== currentFrame && rotoPersistenceRef.current.hasPendingLivePixelsForFrame(frame) ? { frame, generation } : null;`. This sample MUST run before the synchronous `loadCachedRotoReferenceFrame(frame, previewBasePort);` at line 5517 and before the awaited `flushPromise` can settle, because `flushLivePixels` opens the queue gate globally and the sample is what arms the repair even if the capture is refused and retried mid-navigation. `frame !== currentFrame` skips arming when the destination is already the displayed frame — the navigation's own flush is then that identity's flush. Do not add any probe call after the flush.

    Immediately after the navigation callback's closing deps array (line 5571) and before `const lastReferenceDisplayStateRef = useRef<string | null>(null);` (line 5581) add ONE useEffect whose first line is the comment `// quick-261109-pwt: settle the destination frame's pending cache capture once it is displayed.` Behavior in order: read `const armed = pendingDestinationCaptureRef.current;` and return when it is null or `armed.frame !== currentFrame` (startFrame propagation one rAF after navigation is what marks the destination displayed); if `!rotoNavigationGeneration.isLatest(armed.generation)` set the ref to null and return; if `rotoCachedPlayback.isActive` set the ref to null and return (a run-time flag read — the playback object identity changes every render, so it must not be a dependency); otherwise set `pendingDestinationCaptureRef.current = null;` BEFORE any await so a re-run can never double-flush; then run one async IIFE: inside a try/catch guard with `hasPendingLivePixelsForFrame(armed.frame)`, `await rotoPersistenceRef.current.flushLivePixels(armed.frame);`, and on error `console.error('[PhysicsPaintStudio] pending destination capture flush failed', error)` then CONTINUE to the comparison (the commit may already have landed); after the await re-check `rotoNavigationGeneration.isLatest(armed.generation)` and `(launchContextRef.current?.startFrame ?? -1) !== armed.frame` and return on either; then read `const displayed = findCachedRotoDisplayFrame(armed.frame); const applied = cachedRotoRepaintBaseFrameRef.current;` and return when both are null or when both are non-null and `displayed.bytes === applied.bytes` (the store keeps a payload's byte carrier stable between commits, so reference equality IS content identity); otherwise force the loader through the same sequence the generated post-flush repaint uses: `setCachedRotoReferenceUrl(null); previewBasePort.clearPreviewBaseImage(true); previewBasePort.resetBackground(true); loadCachedRotoReferenceFrame(armed.frame, previewBasePort);`. The forced sequence is required because the loader's plain-refresh guard refuses a plain reload when an explicit base is already applied for the same frame. The effect deps are exactly `[currentFrame, findCachedRotoDisplayFrame, loadCachedRotoReferenceFrame, previewBasePort, rotoNavigationGeneration, setCachedRotoReferenceUrl]`; read `rotoPersistenceRef`, `launchContextRef`, `cachedRotoRepaintBaseFrameRef` and `rotoCachedPlayback` at run time and do not list them. No engine, motion, key, compositor, selection, schema or store-setter change; a navigation with nothing pending leaves the arm null and the effect returns before any await.

    Add the source pins. In app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts add a describe named `261109-pwt destination pending probe` (after the 52.2-15 delivery retry describe) that slices `coordinatorSource` from `const hasPendingLivePixelsForFrame = useCallback(` to `const flushLivePixels = useCallback(` and asserts: the slice is non-empty; it contains `livePixelTransactionsRef.current.hasPending(identity)`, `parentDeliveryRef.current.has(key)` and `parentDeliveryErrorRef.current.has(key)`; it contains neither `await` nor `.flush(`; and the return object contains the line `    hasPendingLivePixelsForFrame,`. In app/src/components/physic-paint/PhysicsPaintStudio.test.ts add a describe named `quick 261109-pwt — pending destination capture settles after the destination is displayed` with its own regionOf helper. Pin A: slice from `const navigateToSyncedPhysicalFrame` to the settle marker `// quick-261109-pwt: settle the destination frame's pending cache capture once it is displayed.`; assert `rotoPersistenceRef.current.hasPendingLivePixelsForFrame(frame)` is present and its index is LESS than the index of the first `loadCachedRotoReferenceFrame(frame, previewBasePort);`, and assert the arm is guarded by `frame !== currentFrame`. Pin B: slice from the settle marker to `const lastReferenceDisplayStateRef`; assert `pendingDestinationCaptureRef.current = null;` occurs before `await rotoPersistenceRef.current.flushLivePixels(armed.frame);`; the flush is guarded by `hasPendingLivePixelsForFrame(armed.frame)`; the slice contains `rotoNavigationGeneration.isLatest(armed.generation)`, `launchContextRef.current?.startFrame ?? -1`, `!== armed.frame`, `cachedRotoRepaintBaseFrameRef.current`, `displayed.bytes === applied.bytes`, `setCachedRotoReferenceUrl(null);`, `previewBasePort.clearPreviewBaseImage(true);`, `previewBasePort.resetBackground(true);` and `loadCachedRotoReferenceFrame(armed.frame, previewBasePort);`; and its deps array begins `}, [currentFrame`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts</automated>
  </verify>
  <done>
    The coordinator exposes a read-only identity-scoped pending probe; the navigation arms the destination only for a real frame change with a pending capture, sampled before the synchronous destination load; one effect consumes the arm only when the destination is displayed and latest, flushes only the destination identity, and forces exactly one reload only when the applied byte carrier differs from the resolved display frame. Nothing-pending, superseded, playback-active and same-frame paths add no flush and no wait. Typecheck and both targeted suites pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Per-identity pending/flush behavior pin and full gates</name>
  <files>
    app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
  </files>
  <behavior>
    - Test 1: with two captures pending on distinct identities (different keyIds and appFrames), hasPending(identityA) and hasPending(identityB) are both true, hasPending() is true, and hasPending of an identity never captured is false.
    - Test 2: flush(identityA) resolves after A's produce/commit settles while B's produce is still suspended on its deferred promise; hasPending(identityA) is then false while hasPending(identityB) is still true.
    - Test 3: after B's deferred produce resolves and flush(identityB) completes, both identity probes and the global hasPending() are false, and each commit received its own produced value and identity.
  </behavior>
  <action>
    Add one test to app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts inside a new describe named `261109-pwt per-identity pending probe`, following the file's existing explicit-identity capture harness: declare two full identities with distinct keyIds and appFrames (launchId/layerId shared or distinct, contentRevision and appFrame present), create one transactions instance, and call capture twice without awaiting, each with `resolveCurrent: () => identity`, a per-capture deferred `produce` promise, and its own `commit: vi.fn()`. Assert the probe matrix from Test 1 immediately after both captures. Start `transactions.flush(identityA)`, resolve A's deferred produce with a distinct value, await that flush, and assert Test 2. Then resolve B's deferred produce, await `transactions.flush(identityB)`, and assert Test 3, including that each commit was called once with its own value. Do not use fake timers: `flush` opens the queue gate and bypasses the quiet window, so the test is deterministic; end any interaction you begin, and never add a .test.tsx. Do not change any production file in this task.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    The per-identity contract the settle effect relies on is pinned: one identity's flush settles that identity while another stays pending, and the global probe only clears when every capture settles. The targeted file, typecheck and the full vitest run pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigation intent to cache commit | a background settle writes paint bytes into a key after the UI has already moved; the wrong identity or a stale navigation would commit pixels to the wrong frame |
| cached display to live commit | a forced reload replaces the visible preview base; a wrong reload condition would flash, loop or show a stale render |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-PWT-01 | Tampering | settle effect flush and reload | high | mitigate | The flush is identity-scoped through the existing `resolveFrameIdentityInput` (the same resolver every capture uses) and only runs for the armed destination frame; after the await the generation token must still be latest and launchContext.startFrame must still equal the armed frame, otherwise no reload. The arm is consumed synchronously before the await. |
| T-PWT-02 | Denial of service | effect re-runs and reload storms | medium | mitigate | The effect depends on `currentFrame` plus stable callbacks only; an unarmed navigation returns before any await. The reload requires a byte-carrier change between the applied base and the resolved display frame, so a settled or same-bytes state never reloads. The probe is a read-only map lookup and never drains. |
| T-PWT-03 | Information disclosure | probe and reload diagnostics | low | accept | The probe exposes only pending-cache bookkeeping already local to the Studio; the error log carries the error text and nothing persisted or transmitted changes. |
| T-PWT-SC | Tampering | package installs | high | mitigate | No package is installed and no dependency is added by this quick; the existing dependency-surface pins stay green. |
</threat_model>

<verification>
Automated:
- pnpm --filter efx-motion-editor run typecheck
- pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
- pnpm --filter efx-motion-editor exec vitest run (full suite; vitest run only, never watch)
- No .test.tsx file is added (vitest collects only .test.ts); no dev server is started.

Native UAT (human-check, live native build — the exact visible surface reported):
1. Group-painted cached key, first return: paint a new mark on a key that already shows cached paint (a Group override cell), leave that key, then return to it ONCE. The new mark is visible immediately on that first return; no second click, no leave-and-return again.
2. Plain real key control: paint over cached paint on an ordinary real key, leave and return once — the new paint is visible on the first return and the key still selects/highlights correctly.
3. Generated destination control: navigate to a generated frame after painting a neighbor; it still repaints from the just-flushed neighbor and never shows a stale cached frame.
4. Leave without returning, then Save and reopen the Studio: the paint is still present (the pending capture is not dropped or superseded by the settle path).
5. No visible delay: navigating between frames with nothing pending is as fast as at HEAD; no flash, no blank frame, no double reload.
6. Identity rails: a rail with identity Motion (and a rail with no Motion) paints, leaves and returns pixel-identically to HEAD; the rail-edit cursor seat fix from the previous debug is unaffected.
</verification>

<success_criteria>
- Returning to a cached key whose frame-leave capture is still pending shows the newly painted pixels on the first return, for both Group override cells and ordinary real keys, with no second click.
- The settle flush runs only for the armed destination identity, only when that frame is displayed and the navigation is latest; the reload runs only on a real byte change, and identity/no-pending/superseded/playback paths are unchanged.
- The per-frame pending probe is read-only and identity-scoped, and the per-identity hasPending/flush contract is pinned behaviorally.
- No change to motion evaluation, key evaluation, the compositor, the selection/transform overlay, the engine pointer conversion, the document schema or any store setter; no new dependency.
- Typecheck, the targeted suites and the full vitest run pass; all six native UAT rows pass on the user's build.
</success_criteria>

<output>
Create .planning/quick/261109-pwt-phase-60-issue-with-paint-on-cached-key-/261109-pwt-SUMMARY.md when done.
</output>
