---
status: resolved
trigger: paint-cache-empty-frame-on-key-return — intermittent: after painting on a key, navigating away and back to that key sometimes shows an EMPTY frame. Navigating away and back a second time refreshes and shows the paint correctly. The paint data survives (the second return shows it). Hard to reproduce; not frequent. User suspects a cache-update race or a missing useEffect dep (paintVersion subscribe?). Likely frame-cache write landing AFTER the display read on frame enter, or a frame-display useEffect with a stale dep that misses the just-painted version. Ride existing machinery — no new cache system. Instrument via /tmp JSON capture so the next occurrence names which arm ran (cache read vs live draw vs paintVersion). Live evidence over unit probes.
created: 2026-10-17
updated: 2026-10-17 (resolved — live UAT passed)
---

# Debug Session: paint-cache-empty-frame-on-key

## Symptoms

- **Expected behavior:** paint applied on a key remains visible when navigating away from and back to that key.
- **Actual behavior:** the FIRST return to the key sometimes shows an EMPTY frame. Leaving the key and returning a SECOND time refreshes and shows the paint correctly.
- **Errors:** none reported.
- **Timeline:** intermittent, infrequent, hard to reproduce. Not a hard regression — a race/timing window.
- **Reproduction:** paint on a key → navigate away from the key → navigate back to the key → sometimes empty → navigate away + back again → paint appears. Data survives (the second return shows it).

## Architecture (pre-mapped — do not re-derive)

- **paintVersion contract (project law):** bump `paintVersion` on EVERY mutation AND subscribe to it in render useEffects. A missing bump OR a missing subscribe both produce "stale until something else forces a redraw" — exactly this symptom.
- **Frame cache:** WebP via Rust `WebPLosslessCodec.encode_rgba` / `decode_rgba` (`src-tauri/src/commands/frame_codec.rs`). Cache writes are ASYNC — a read on frame enter can race a not-yet-landed write.
- **Studio is a separate Tauri window**, navigated on each open. But this symptom is key-to-key navigation INSIDE a session, not Studio reopen.
- **Aquarelle cache:** `MODE.transparent` OPAQUE TRANSMITTANCE, composited with MULTIPLY over the fond (just fixed in studio-reopen-paper-washout, `09c422e1`/`04177803`/`aa1c5135`). Frame-scoped live aquarelle layer (task #26).
- **Prior related fix:** "Fix aquarelle cache loss on navigation" (task #29, completed) — there WAS a cache-loss-on-navigation bug before.
- **`_resolveFlattenedFrame`** in `physicPaintStore.ts` composites fond + raster. `cachedRotoPlaybackComposition` holds the display composite.
- **Preact + @preact/signals**, not React. No useState. Identity-stable effect deps, narrow signal reads, idempotent store setters (see `efx-preact-reactivity` skill).
- **frame/export guard:** `physicPaintStore.ts` must contain ZERO `getImageData|putImageData` (paperPass.frameGuard.test.ts). Pixel probes live in `lib/rasterAlpha.ts`.
- **App writes JSON capture files to /tmp** — prefer that over console (paperFondCapture.ts is the existing pattern).

## Current Focus

- hypothesis: CONFIRMED — root cause found, fixed, and live UAT PASSED 2026-10-17.
- status: resolved — contract test RED→GREEN, full suite 4583 passed / 1 skipped / 96 todo (241 files). Live UAT: paint on a watercolor key → navigate away → back shows the paint on FIRST return. The /tmp instrument (`/tmp/paint-cache-frame-enter.json`) remains in place to name the arm if the symptom ever recurs.
- next_action: none — closed. Next issue comes from SPECS/v1.1.0-water-color/phase-55-issues/index.md on user's go.
- next_reasoning_checkpoint:
  hypothesis: "Aquarelle frame-leave capture is queued one rAF AFTER navigation's flushLivePixels drains, so the capture sits in CAPTURE_PRODUCE_QUIET_MS (6s) while the return-to-key load reads the stale/blank cache; the plain-refresh guard in createRotoReferenceLoader prevents the frame-change effect from repairing the display."
  confirming_evidence:
    - "AquarelleCanvasLayer.tsx rAF poll (line 348-361): frame-leave capture runs when getPlayFrame() changes, which is AFTER scheduleRotoStartFramePropagation (rAF-batched) — i.e. AFTER navigateToSyncedPhysicalFrame's flushLivePixels has already awaited and resolved."
    - "rotoLivePixelCacheTransactions.ts CAPTURE_PRODUCE_QUIET_MS = 6000: a capture queued after flush.beginFlush() has closed sits in the quiet window; flush(identity) with no pending work awaits undefined and returns immediately."
    - "useRotoReferenceController.ts plain-refresh guard (lines 201-212): after navigation paints with a content token (resolveContentToken always returns a number → requestExplicit=true in EfxPaintEngine.setPreviewBaseImageUrl), the frame-change effect's load is skipped — it can never repair a stale/empty paint."
    - "Second leave flushes the stuck capture (flushLivePixels drains pending work), so the second return reads the committed bytes — matches the user's exact symptom."
  falsification_test: "If the aquarelle rAF poll captured BEFORE the navigation flush (or if navigation forced a capture before flushing), the empty-frame symptom would not occur. If the symptom occurs in pure engine-1 mode (aquarelleActive=false), this hypothesis is wrong."
  fix_rationale: "Force a synchronous aquarelle frame-leave capture at the start of navigateToSyncedPhysicalFrame (before flushLivePixels), mirroring engine-1's flushPendingStrokeFinalizations pattern. Rides the existing captureLivePixels / onCaptureFrame machinery — no new cache system."
  blind_spots: "Have not tested live (user runs the app). Have not verified whether the symptom also occurs in engine-1 mode. The dirty-refusal arm (dirtyFrames + no bytes → refuse → empty) is a secondary contributor not yet exercised."
  candidate_causes:
    - "code: aquarelle rAF frame-leave capture queued after navigation flush (ordering hole)"
    - "code: CAPTURE_PRODUCE_QUIET_MS=6000 amplifies the race window from ~100ms to 6s"
    - "code: plain-refresh guard prevents effect repair of stale display"
  and_gate: "Yes — three conditions must coincide: (1) the ordering hole queues the capture after flush, (2) the user returns within the quiet window before the capture commits, (3) the plain-refresh guard blocks the repair path. The ordering hole is the root cause; (2) and (3) are amplifiers that make it visible."
- next_action: implement the pre-navigation aquarelle capture + /tmp JSON instrument + contract test

## Hypotheses

- H1 (strongest): a frame-display effect is missing `paintVersion` in its dep list (or subscribes to the wrong signal), so it draws from a stale cache snapshot and never re-runs when the mutation lands. The second navigation re-runs the effect and reads the now-landed cache.
- H2: the frame cache WRITE is async and lands AFTER the frame-enter READ. The read gets a miss or stale bytes; nothing invalidates the display when the write completes. Second navigation reads the landed write.
- H3: the frame-scope of the live aquarelle layer (task #26) unmounts the layer on key-leave and the remount on key-return reads an empty cache before the range is re-materialized.

## Constraints

- Ride existing machinery — no new cache system.
- Instrument via /tmp JSON capture so the next occurrence names which arm ran (cache read vs live draw vs paintVersion).
- Live evidence over unit probes — this is a timing race; vitest cannot reproduce it.
- Preact + @preact/signals rules mandatory (efx-preact-reactivity skill).
- `physicPaintStore.ts` stays free of `getImageData|putImageData`.
- Vendored WatercolorEngine remains the ONLY paper generator.

## Evidence

- timestamp: 2026-10-17T00:00:00Z
  checked: useRotoFrameEditingController.ts:188-191 frame-change effect
  found: useEffect loads reference on currentFrame change via loadReferenceFrame (plain refresh, no generation/explicitBytes). Deps are currentFrame, engine, launchContext layer/operation, loadReferenceFrame, workflowMode — no paintVersion. But the effect is a secondary path; navigation loads explicitly.
  implication: the effect alone cannot cause empty (it paints or skips). But it can never REPAIR a stale navigation paint due to the plain-refresh guard.

- timestamp: 2026-10-17T00:00:00Z
  checked: useRotoReferenceController.ts createRotoReferenceLoader plain-refresh guard (lines 201-212) and resolveContentToken
  found: resolveContentToken (physicPaintStore.ts:445) ALWAYS returns a number (0 for null/undefined). So every loader paint passes a contentToken to setPreviewBaseImageUrl → requestExplicit=true in the engine. After navigation paints a frame, appliedExplicit=true. The frame-change effect's plain refresh (generation=undefined, explicitBytes=undefined) hits the guard: `isPlainRefresh && appliedExplicit && appliedAppFrame === appFrame && appliedDataUrl !== null && paintBytes !== null` → SKIP. The effect can never overwrite or repair the navigation's paint for the same frame.
  implication: if the navigation paints stale/empty bytes, no repair path exists until a NEW navigation clears the base. This is the "second navigation fixes it" mechanism.

- timestamp: 2026-10-17T00:00:00Z
  checked: PhysicsPaintStudio.tsx navigateToSyncedPhysicalFrame (lines 2640-2747) and AquarelleCanvasLayer.tsx rAF poll (lines 348-375)
  found: Navigation order is: flushPendingStrokeFinalizations (engine-1 only) → snapshotLivePixels(currentFrame) → flushLivePixels(currentFrame) [awaited] → engine.clear() → loadCachedRotoReferenceFrame(destination) → await flush → scheduleRotoStartFramePropagation(destination). The aquarelle frame-leave capture (onCaptureFrame) runs in the rAF poll when getPlayFrame() changes — which happens AFTER scheduleRotoStartFramePropagation (rAF-batched), i.e. AFTER flushLivePixels has already resolved. The capture is queued into livePixelTransactions AFTER the flush drained.
  implication: THIS IS THE ROOT CAUSE. The aquarelle capture of the left frame's paint lands after the flush, so the flush misses it.

- timestamp: 2026-10-17T00:00:00Z
  checked: rotoLivePixelCacheTransactions.ts CAPTURE_PRODUCE_QUIET_MS and flush()
  found: CAPTURE_PRODUCE_QUIET_MS = 6000ms. A capture queued after flush.beginFlush() has closed sits in the quiet window (produce waits for quiescence). flush(identity) with no pending work does `await pending.get(key)` which is `await undefined` → resolves immediately. So the navigation flush is a no-op for the late aquarelle capture.
  implication: the late capture sits for up to 6s. If the user returns within that window, the display reads the pre-capture cache.

- timestamp: 2026-10-17T00:00:00Z
  checked: engine-1 path (handleCanvasCompletedMutation + flushPendingStrokeFinalizations)
  found: engine-1's captureLivePixels is queued SYNCHRONOUSLY during flushPendingStrokeFinalizations (notifyCompletedMutation → handleCanvasCompletedMutation → captureLivePixels → queue.submit). snapshotLivePixels then starts produce (canvas copy) BEFORE engine.clear(). flushLivePixels drains encode+commit. This path is correct — no ordering hole for engine-1.
  implication: the bug is aquarelle-specific (watercolor module). Engine-1 navigation flush is sound.

- timestamp: 2026-10-17T00:00:00Z
  checked: buildPhysicPaintRotoPhysicalRevision includes payload bytes (encodeCanonicalBytesPayload via buildFrameBytesToken)
  found: revision is content-sensitive — a paint change produces a new revision. updateRotoPhysicalRealKeyPayload's `nextRevision === currentRevision` early-return does NOT skip real paint updates.
  implication: eliminates the "revision skips payload update" hypothesis.

- timestamp: 2026-10-17T00:00:00Z
  checked: knowledge-base.md for prior matches
  found: no exact match. Closest: studio-reopen-empty-boot (reference-only record on runtime path), 52.1 paint-loss-on-leave (superseded capture wiping snapshots — already fixed in clearPending guard).
  implication: this is a new class — aquarelle late-capture vs navigation flush ordering.

## Eliminated

- hypothesis: H1 (missing paintVersion dep in frame-display effect)
  evidence: The effect at useRotoFrameEditingController.ts:188 does not subscribe to paintVersion, but it is a secondary load path. Navigation explicitly loads the frame. The effect either paints the same bytes or skips (plain-refresh guard). It cannot CAUSE the empty frame; it can only fail to REPAIR it (which is a contributing factor, not the root cause). The root cause is the aquarelle capture ordering.
  timestamp: 2026-10-17

- hypothesis: revision-based payload update skip (updateRotoPhysicalRealKeyPayload early-return)
  evidence: buildPhysicPaintRotoPhysicalRevision includes payload bytes via encodeCanonicalBytesPayload. A paint change always produces a new revision.
  timestamp: 2026-10-17

- hypothesis: H3 (aquarelle layer unmount/remount on key-leave)
  evidence: AquarelleCanvasLayer stays mounted across navigation (getAquarellePlayFrame is identity-stable so the mount memo never invalidates on frame change; canvasKey is dimensions only). The rAF poll detects playFrame change without remounting.
  timestamp: 2026-10-17

## Resolution

root_cause: Aquarelle (watercolor) frame-leave cache capture is queued by the rAF poll in AquarelleCanvasLayer AFTER navigateToSyncedPhysicalFrame has already drained flushLivePixels. The capture sits in CAPTURE_PRODUCE_QUIET_MS (6s). The return-to-key display reads the pre-capture cache → empty/stale frame. The plain-refresh guard in createRotoReferenceLoader prevents the frame-change effect from repairing the display. The second leave's flush drains the stuck capture → second return shows the paint. AND-gate: ordering hole + return-within-quiet-window + no-repair-path.
fix: Expose a synchronous flush-capture registration on AquarelleCanvasLayer (onFlushCaptureReady, mirroring onNativePenInputReady). navigateToSyncedPhysicalFrame calls the registered flush BEFORE flushLivePixels so the aquarelle frame-leave capture is queued in time — the engine-1 analogue of flushPendingStrokeFinalizations. Plus /tmp JSON capture instrument at the frame-enter display path (paintCacheFrameEnterCapture.ts) recording arm/cache-read/empty/dirty-refusal/skip-plain-refresh + paintVersion-at-read + cache-write-commit timestamps.
verification: Contract test NAV FLUSH in aquarelleLayerContract.test.ts (RED at base, GREEN after). Full suite 4583 passed / 1 skipped / 96 todo (241 files). FrameGuard holds (physicPaintStore.ts free of pixel-array canvas APIs). Live UAT PASSED 2026-10-17: paint on a watercolor key → navigate away → back shows the paint on FIRST return.
files_changed:
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/lib/paintCacheFrameEnterCapture.ts
guardrail_verdict: accepted
oracle_type: derived (contract/source-pattern assertion on call-ordering law)
