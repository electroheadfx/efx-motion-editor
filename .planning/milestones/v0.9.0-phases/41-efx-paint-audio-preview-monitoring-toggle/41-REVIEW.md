---
phase: 41-efx-paint-audio-preview-monitoring-toggle
reviewed: 2026-08-05T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - app/src-tauri/src/lib.rs
  - app/src-tauri/tauri.conf.json
  - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
  - app/src/components/physic-paint/audio/efxPaintAudioOwnership.ts
  - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
  - app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts
  - app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/lib/audioEngine.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/playbackEngine.test.ts
  - app/src/lib/playbackEngine.ts
  - app/src/main.test.ts
  - app/src/main.tsx
  - app/src/releaseContract.test.ts
  - app/src/types/physicPaint.ts
findings:
  critical: 1
  warning: 8
  info: 4
  total: 13
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-08-05
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The phase delivers a well-tested audio preview monitoring pipeline: the revision guard, closed-key validation, truth-table mapping, drift throttle, and ownership state machine are all carefully implemented with strong test coverage. The main weaknesses are in async lifecycle handling around the monitor: an ungated async prepare→play chain that can start audio after visual playback has stopped, unserialized concurrent context applications, a stale-session leak across child-window re-launches (the "fresh bundle per window" assumption is violated by Tauri window reuse), and an ownership claim that is taken even when nothing audible was dispatched. One pre-existing Range-parsing underflow in the `efxasset` Rust handler becomes more load-bearing now that the protocol is wired to `connect-src` fetch.

## Critical Issues

### CR-01: Async prepare→play chain starts audio after visual playback has stopped

**File:** `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts:173-175`
**Issue:** `start()` kicks off `efxPaintAudioMonitor.prepare(audioPreview).then(() => efxPaintAudioMonitor.playAtCursor(...))` with no check that playback is still active when the promise resolves. Fetching + decoding whole audio files over the `efxasset://` protocol can take a noticeable amount of time for large WAVs. If the user stops playback (or the playback funnel stops for any reason: empty-frame re-entry, workflow-mode switch, `resetForLaunch`) while `prepare` is in flight, `finishPlayback()` → `efxPaintAudioMonitor.stop()` runs first, and then the pending `.then` fires `playAtCursor` unconditionally — `playAtCursor` re-enters `'playing'`, dispatches sources, and calls `efxPaintAudioOwnership.claimAudio()`. Result: audio plays with no visual playback, no tick loop remains to stop it (it only ends when `maxPlaySec` elapses), and the latched ownership claim suppresses the main editor's audio indefinitely (until the child window closes or another play/stop cycle releases it). The same hole exists for a revisioned push whose `prepare` is in flight across a visual stop, though that path is partly protected by the `state === 'playing'` re-check in `applyRevisionedContext` — the `start()` path has no equivalent guard.

**Fix:** Gate the deferred play on the playback session that requested it. For example, capture a generation counter or the timer identity at `start()` and re-check before dispatching:

```ts
const playbackSession = timerRef.current; // set right before the interval is created, or use a monotonically increasing session id
void efxPaintAudioMonitor.prepare(audioPreview).then(() => {
  if (timerRef.current === null || playbackSession !== timerRef.current) return; // stopped meanwhile
  efxPaintAudioMonitor.playAtCursor(audioCursorAppFrame, audioPlaybackRangeEnd);
});
```

Alternatively, have `efxPaintAudioMonitor.stop()` bump an internal epoch and make `playAtCursor` a no-op when called with a stale epoch token returned by `prepare`.

## Warnings

### WR-01: Concurrent `applyRevisionedContext`/`prepare` calls are not serialized — out-of-order decode leaves stale buffers

**File:** `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts:70-86, 248-255`
**Issue:** Two accepted revisions (e.g. rev 2 then rev 3 arriving in quick succession, or a push racing a `start()`-initiated `prepare`) each run `prepare` concurrently. `audioEngine.decode(trackId, bytes)` keys buffers by `track.id`, so if rev 2's slow fetch of a *changed* track (same id, new asset) resolves after rev 3's decode, the stale rev-2 bytes overwrite the rev-3 buffer. Likewise rev 2's late completion re-adds ids to the shared `preparedTrackIds` set after rev 3 cleared it — a track whose rev-3 fetch *failed* can be re-marked prepared and dispatched with the stale buffer. The store's revision guard protects the store, but nothing protects the monitor's decode/prepared state.

**Fix:** Serialize monitor-side applications (queue the next `applyRevisionedContext` until the in-flight one settles), or tag each prepare with the section revision and discard decode completions whose revision no longer matches `context.revision`.

### WR-02: Launch hydration never clears the audio store/monitor when the new launch omits `audioPreview` — stale audio survives window reuse

**File:** `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts:126-130`
**Issue:** `applySettledLaunchContext` only applies the section when `hydration.context.audioPreview` is present; the "absent section = no audio" contract is never enforced by clearing. `open_physics_paint_window` (app/src-tauri/src/lib.rs:139) reuses the existing `efx-physic-paint` window and re-emits `physic-paint:launch` without reloading the bundle, so the child bundle — including `efxPaintAudioPreviewStore.section`, `efxPaintAudioMonitor`'s module-scope `context`/`preparedTrackIds`, and the `audioPreviewEnabled` toggle — survives across re-launches. If launch N carried audio and launch N+1 (same reused window, different layer/project state) omits it, pressing Play monitors the *previous* launch's tracks. This also breaks the D-13 assumption in `efxPaintAudioPreviewStore.ts` ("a fresh bundle per window gives the reset for free") — the session toggle is not reset on re-launch of a reused window.

**Fix:** In `applySettledLaunchContext`, add an explicit else branch:

```ts
if (hydration.context.audioPreview) {
  applyRevisionedEfxPaintAudioPreview(efxPaintAudioPreviewStore, hydration.context.audioPreview);
} else {
  efxPaintAudioPreviewStore.clear();
  efxPaintAudioMonitor.stop(); // drop stale context/prepared state for the new launch
}
```

Consider also resetting `audioPreviewEnabled` to `true` on a settled launch if D-13's "resets on window open" is meant to cover re-launch.

### WR-03: Ownership claim is taken even when zero audio sources were dispatched

**File:** `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts:119-141`
**Issue:** `playAtCursor` calls `efxPaintAudioOwnership.claimAudio()` unconditionally at the end of the funnel, even when every track resolved to `null` (cursor outside all windows, playback-range cap, all-muted, or all fetches failed) and nothing was dispatched. While that empty claim is held, `playbackEngine.startAudioPlayback()` on the main side suppresses itself (app/src/lib/playbackEngine.ts:208) — the user can end up with both windows silent: the child playing nothing audible yet blocking the main editor's audio.

**Fix:** Track whether at least one `play`/`playDelayed` dispatch happened in the loop and only claim when something is actually audible:

```ts
let dispatched = false;
// ... set dispatched = true inside each dispatch branch
if (dispatched) efxPaintAudioOwnership.claimAudio();
```

(If a delayed source counts as "will be audible", claiming on a `playDelayed` dispatch is still correct.)

### WR-04: Drift corrector produces a seek-restart storm when playback fps differs from project fps

**File:** `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts:196-200` (with `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts:204-207`)
**Issue:** `checkDrift` computes `expectedSec = (cursorAppFrame - anchorAppFrame) / context.fps` using the *project* fps, but the visual tick advances the cursor one appFrame per `1000 / playbackFps` ms. On any fps mismatch (the exact case A6 explicitly tolerates as "best-effort" with a note), expected and actual diverge by `|1/projectFps − 1/playbackFps|` per frame, exceeding the 40ms threshold within a few frames. The result is a full `stopAll` + re-dispatch every 10 ticks for the entire mismatched session — audible stutter on a fixed cadence — which is worse than free-running. The A6 note promises "best-effort" sync; the implementation delivers a restart storm.

**Fix:** Suppress (or rescale) the drift check when `playbackFps !== context.fps` — e.g. pass the playback fps into `playAtCursor`/`checkDrift` and skip correction on mismatch, since the note already covers the degraded guarantee:

```ts
if (context.fps !== playbackFpsAtStart) return; // A6 mismatch: free-run, no restart storm
```

### WR-05: Claim-release on window close is fire-and-forget — main-side claim can latch true for the session

**File:** `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:32-45` (with `app/src/components/physic-paint/PhysicsPaintStudio.tsx:133-142, 686-694`)
**Issue:** On close with nothing to flush, `onCloseRequested` runs `efxPaintAudioMonitor.release()` → `stop()` → `releaseAudio()` → `claimSender(false)` → `sendPhysicPaintAudioOwnership(false, ...)`, which is `void`-ed (async `emitTo`/`postMessage`). The handler then returns without `preventDefault`, so the webview can be destroyed before the release event is delivered. The main window's `physicPaintChildAudioClaimed` signal then stays `true` and the main editor's audio stays suppressed until the app restarts or a new child launch clears it (physicPaintBridge.ts:1323). The `pagehide` fallback in `efxPaintAudioOwnership.ts:152` has the same async-delivery race.

**Fix:** Make the close path await the release before letting the close proceed — e.g. in the `onCloseRequested` handler, `event.preventDefault()`, `await` the claim-release send (bounded by a short timeout), then `destroy()`. Alternatively, have the main side expire a claim that isn't refreshed (heartbeat) or clear it on child-window `destroyed` events via `getWebviewWindow('efx-physic-paint')` lifecycle.

### WR-06: First-player-wins arbitration has an inherent delivery race — doubled audio is possible in the event window

**File:** `app/src/lib/physicPaintBridge.ts:895-957` (with `app/src/components/physic-paint/audio/efxPaintAudioOwnership.ts:68-70`, `app/src/lib/playbackEngine.ts:202-208`)
**Issue:** The design comment in `efxPaintAudioOwnership.ts` states doubled audio is "structurally impossible", but the guard is driven by transient async events in both directions. If the child starts audio and the main editor starts within the claim-event delivery window (claim `emitTo` still in flight), the main's `isPhysicPaintChildAudioClaimed()` check reads `false` and both windows dispatch audio simultaneously; symmetrically for a main start racing the playback-state broadcast. The window is small (one IPC round trip) but real, and it recurs on every seek/loop-wrap restart on the main side while doubled.

**Fix:** Accept and document the race as best-effort (drop the "structurally impossible" claim), or narrow it: have the main side treat "child window exists and is playing" as a claim-pending state, or route claim/start through a Rust-side arbitration flag both windows check synchronously via `invoke`.

### WR-07: `efxasset` Range parsing underflows u64 (crafted or out-of-file range) → huge allocation / abort

**File:** `app/src-tauri/src/lib.rs:444-483`
**Issue:** In the video Range branch, `start` and `end` are parsed independently and `end` is clamped with `end.min(file_size - 1)`, but `start` is never validated against `end` or `file_size`. For `Range: bytes=100-50` or `bytes=99999999-` on a smaller file, `end - start + 1` underflows (`u64`): a panic in debug builds, and in release a wrap to ~2^64 followed by `vec![0u8; length as usize]` — an allocation-failure abort of the whole app, triggerable by any webview `fetch` with a crafted Range header. Additionally, `file.seek(...).ok()` and `let _ = file.read_exact(&mut buf)` silently ignore failures, returning zero-filled/partial buffers with a 206 status. This handler predates the phase, but the phase extends `efxasset` to `connect-src` fetch (tauri.conf.json:38), making the protocol a general fetch target rather than a media-element-only one.

**Fix:**

```rust
if start >= file_size || start > end {
    return tauri::http::Response::builder()
        .header("Content-Range", format!("bytes */{}", file_size))
        .status(416)
        .body(Vec::new())
        .unwrap();
}
let length = end - start + 1;
// propagate seek/read errors as 500 instead of returning zero-filled buffers
```

### WR-08: `efxasset` protocol serves arbitrary filesystem paths with no scoping, now wired to `connect-src`

**File:** `app/src-tauri/src/lib.rs:385-431` (with `app/src-tauri/tauri.conf.json:38`)
**Issue:** The `efxasset` handler percent-decodes the URL path and reads whatever it points to — there is no equivalent of the `assetProtocol.scope` allowlist (`$APPDATA`, `$HOME`, `/Volumes`, `/tmp`, `/private`) constraining it. Any content running in either webview can `fetch('efxasset://localhost/etc/passwd')` (or any user file outside those scopes) and read it through the new `connect-src efxasset:` grant. This is pre-existing for `<img>`/`<video>` sinks, but the connect-src grant turns it into a programmatic read primitive. First-party-only content limits the practical risk, but the payload channel (launch context `assetUrl`) is built from `track.filePath` without any check that the path is inside an allowed root.

**Fix:** Reuse the asset-scope roots (or a configured subset) in the `efxasset` handler and 403 paths outside them, and/or validate `track.filePath` against the project/media roots when building `assetUrl` in `buildPhysicPaintAudioPreviewSection` (app/src/lib/physicPaintBridge.ts:1224-1238).

## Info

### IN-01: Duplicated validation helpers and key sets across two launch/preview modules

**File:** `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts:17-43` and `app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts:19-45`
**Issue:** `isPlainRecord`, `hasOnlyKeys`, `isStructuredClonePlainData`, `AUDIO_PREVIEW_KEYS`, and `AUDIO_PREVIEW_TRACK_KEYS` are copy-pasted verbatim (the key sets also exist a third time inline in `app/src/types/physicPaint.ts:910,927`). A future schema change must be applied in three places to stay consistent.
**Fix:** Extract the helpers and key sets into a shared module (e.g. `audio/efxPaintAudioPreviewSchema.ts`) imported by both.

### IN-02: `hasAudio` computed is exported but never consumed

**File:** `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts:49`
**Issue:** `efxPaintAudioPreviewStore.hasAudio` has no consumers outside the module (callers re-derive `tracks.length > 0`, e.g. useRotoCachedPlayback.ts:170). Dead surface.
**Fix:** Remove it, or use it in `useRotoCachedPlayback.start()` and to gate the toggle's enabled state in `PhysicsPaintWorkflowStrip`.

### IN-03: Double type assertion `track as unknown as AudioTrack` bypasses the compiler at the engine boundary

**File:** `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts:126`
**Issue:** The payload track is asserted through `unknown` into `AudioTrack` for the engine's fade/volume math. The comment documents the field-name compatibility, but any future drift in `AudioTrack` (new required field consumed by `audioEngine.play`) compiles cleanly and fails only at runtime.
**Fix:** Give `audioEngine.play/playDelayed` a minimal structural parameter type (`Pick<AudioTrack, 'muted' | 'volume' | 'inFrame' | 'outFrame' | 'slipOffset' | 'fadeInFrames' | 'fadeOutFrames' | 'fadeInCurve' | 'fadeOutCurve'>`) that `EfxPaintAudioPreviewTrack` satisfies natively, dropping the assertion.

### IN-04: `start()` re-fetches and re-decodes every track on each Play and each mid-playback fps change

**File:** `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts:173` and `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts:70-86`
**Issue:** `updateFps` while playing re-enters `start()`, which calls `prepare` — clearing `preparedTrackIds` and re-fetching/re-decoding all bytes even when the section revision is unchanged. Rapid fps edits trigger repeated full-file reads over the protocol and a decode storm on the shared engine buffers. (Flagged as quality/robustness, not performance per se.)
**Fix:** Skip re-prepare when `efxPaintAudioPreviewStore.getSection()?.revision` equals the revision the monitor last prepared; prepare only on revision change.

---

_Reviewed: 2026-08-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
