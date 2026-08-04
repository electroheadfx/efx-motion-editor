# Phase 41: Frame-to-Audio Truth Table (LOCKED ENTRY ARTIFACT)

**Status:** Locked entry artifact per ROADMAP.md — written and test-encoded (RED) BEFORE any implementation.
**Authority:** Every later plan's tests and implementation derive from this table. Divergence between this table and implementation is a defect (threat T-41-01): the RED suite in `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` encodes every rule below.
**Scope:** Read-only audio monitoring inside the EFX Paint child window. The main editor remains sole authority for audio IDs, assets, offset, trim, volume, mute, fades, ordering, persistence, and export mixing (AUDIO-01).

---

## 1. FRAME IDENTITY

The Paint `appFrame` **IS** the main-editor global frame. There is zero translation, zero offset, and zero re-basing between the two windows' frame domains.

**Proof:** `handlePhysicPaintFrameSyncMessage` (`app/src/lib/physicPaintBridge.ts:956-961`) seeks the main-editor timeline directly with the child's `appFrame` value:

```ts
export function handlePhysicPaintFrameSyncMessage(value: unknown): boolean {
  if (!isPhysicPaintFrameSyncMessage(value)) return false;
  timelineStore.seek(value.frame);           // child's appFrame used verbatim
  timelineStore.ensureFrameVisible(value.frame);
  return true;
}
```

Consequence: every formula below consumes the Paint cursor frame as-is. Any code path that translates, scales, or offsets the frame value before applying the audio mapping is a defect.

---

## 2. AUDIBLE WINDOW

A track is audible on the global timeline on the **half-open** interval:

```
[track.offsetFrame, track.offsetFrame + (track.outFrame - track.inFrame))
```

That is: `trackStartOnTimeline = track.offsetFrame`, `trackEndOnTimeline = trackStartOnTimeline + (track.outFrame - track.inFrame)`, audible while `cursorFrame >= trackStartOnTimeline && cursorFrame < trackEndOnTimeline`.

**Effective end cap (child-window rule, differs from the main editor):** in the main editor, `playbackEngine.startAudioPlayback()` caps the end at `totalFrames` (`app/src/lib/playbackEngine.ts:208`). In the EFX Paint window the cap is the **Paint playback-range end** — the D-11 loop window — NOT `totalFrames`:

```
effectiveEnd = min(trackEndOnTimeline, playbackRangeEnd)
```

Audio must never play beyond the playback-range end; loop wraps re-seek audio (D-11), so no source may be scheduled past `effectiveEnd`.

Muted tracks are skipped entirely — they never enter the mapping.

---

## 3. SOURCE OFFSET MATH

This math mirrors `app/src/lib/playbackEngine.ts:192-224` exactly, substituting the Paint cursor for `currentFrame` and the playback-range cap from section 2 for `totalFrames`. `projectFps` is the main-editor project fps carried in the payload (`fps` field), not the child's playback fps (see section 6).

### Case A — cursor inside the window (`track.offsetFrame <= cursorFrame < effectiveEnd`): start immediately

```
framesIntoTrack = cursorFrame - track.offsetFrame
sourceOffsetSec = (track.inFrame + track.slipOffset + framesIntoTrack) / projectFps
maxPlaySec      = (effectiveEnd - cursorFrame) / projectFps
```

### Case B — cursor before the window (`cursorFrame < track.offsetFrame < effectiveEnd`): schedule with delay

```
delaySec        = (track.offsetFrame - cursorFrame) / projectFps
sourceOffsetSec = (track.inFrame + track.slipOffset) / projectFps
maxPlaySec      = (effectiveEnd - track.offsetFrame) / projectFps
```

### Case C — no audible extent: emit nothing (null)

- `track.muted === true` — skipped before any math.
- `cursorFrame >= effectiveEnd` — the window is fully at/behind the cursor; nothing left to play.
- `track.offsetFrame >= effectiveEnd` — the window is fully capped away by the playback-range end; nothing to schedule.

### Worked examples (projectFps = 24)

| # | Track (offsetFrame / inFrame / outFrame / slipOffset) | cursorFrame | playbackRangeEnd | effectiveEnd | Result |
|---|--------------------------------------------------------|-------------|------------------|--------------|--------|
| 1 | 48 / 0 / 240 / 0 (plain offset) | 96 | 288 | min(48+240, 288) = 288 | immediate: framesIntoTrack = 48, sourceOffsetSec = (0+0+48)/24 = **2.0**, maxPlaySec = (288-96)/24 = **8.0** |
| 2 | 48 / 24 / 240 / 0 (offset + trim) | 96 | 288 | min(48+216, 288) = 264 | immediate: sourceOffsetSec = (24+0+48)/24 = **3.0**, maxPlaySec = (264-96)/24 = **7.0** |
| 3 | 48 / 24 / 240 / 12 (offset + trim + slip) | 96 | 288 | 264 | immediate: sourceOffsetSec = (24+12+48)/24 = **3.5**, maxPlaySec = **7.0** |
| 4 | 48 / 24 / 240 / 12 (future track) | 24 | 288 | 264 | delayed: delaySec = (48-24)/24 = **1.0**, sourceOffsetSec = (24+12)/24 = **1.5**, maxPlaySec = (264-48)/24 = **9.0** |
| 5 | 48 / 24 / 240 / 0 (playback-range-end cap) | 96 | 200 | min(264, 200) = **200** | immediate: sourceOffsetSec = **3.0**, maxPlaySec = (200-96)/24 = **104/24 ≈ 4.3333** |
| 6 | 48 / 24 / 240 / 0, muted = true | 96 | 288 | — | **null** (muted skip) |
| 7 | 48 / 24 / 240 / 0 (window fully behind cursor) | 264 | 288 | 264 | **null** (cursor >= effectiveEnd) |
| 8 | 200 / 0 / 240 / 0 (window fully capped by range end) | 96 | 200 | min(440, 200) = 200 | **null** (track.offsetFrame >= effectiveEnd) |

Boundary note: `cursorFrame == track.offsetFrame` is Case A with `framesIntoTrack = 0` (half-open interval, start inclusive).

---

## 4. REVISION DISCIPLINE

- The audio context **revision is a monotonically increasing integer** owned by the main-side publisher module.
- The publisher bumps the counter **exactly once per publish**; the value is embedded identically in the launch-context `audioPreview` section and in every push-on-change update event (D-01/D-02: one channel, one revision discipline).
- The child applies an incoming section **only when `incoming.revision > current.revision`** (strict newer-than). Equal or lower revisions are **dropped silently** (D-02).
- **Idempotency (AUDIO-04 edge):** applying the same revision twice is a defined no-op — the second application is dropped by the strict newer-than guard, leaving child state byte-identical.
- **Concurrency (AUDIO-04 edge):** interleaved re-hydration and push events resolve through a **single application funnel** (the same compare-and-drop guard at the one application point); final child state always equals the newest revision received. No provisional state is ever presented as accepted (Phase 38.1 canvas-first rule).

---

## 5. DRIFT POLICY

After a seek-aligned start, audio **free-runs on the Web Audio clock** (D-10). There is no per-frame re-sync.

- An anchor is captured at each seek-aligned start: `anchor = { appFrame, audioTime, ctxTime }`.
- On a **throttled check** (about every 10 playback ticks — never per frame), compute:
  - `expected = anchor.audioTime + (cursorAppFrame - anchor.appFrame) / projectFps`
  - `actual   = anchor.audioTime + (ctx.currentTime - anchor.ctxTime)`
- Correct — via a full seek-restart at the current cursor (stopAll + restart, the Pattern-2 template) — **only when `|expected - actual| > 40ms`** (~one frame at 24fps ≈ 41.7ms).
- Any position discontinuity (seek while playing, loop wrap, mid-playback revision update, toggle-On resume) is always a full seek-restart, never a nudge of playing sources.

---

## 6. FPS-MISMATCH POLICY

- Sync is **guaranteed when the child playback fps equals the project fps**. This is the default: `usePhysicsPaintLaunchIntegration` clamps the launch `context.fps` into 1..60 and defaults playback fps to project fps.
- When child playback fps diverges from project fps: **no playbackRate scaling, no pitch shift**. Audio time continues to map through project fps. Show a **non-blocking status note** in the playback/status area, and let the drift corrector (section 5) hold sync at loop-wrap/seek boundaries.
- Flagged: this is the RESEARCH A6 default, pending Task 3 checkpoint confirmation (see section 9).

---

## 7. ASSET TRANSPORT

- Payloads carry **only `efxasset://localhost` protocol URLs**, built main-side via `assetUrl()` (`app/src/lib/ipc.ts:25-30`).
- `AudioTrack.filePath` and `AudioTrack.relativePath` **never appear in the payload** — not as fields, not as raw path strings (D-04). The closed-key schema rejects any track or section carrying them.
- Forbidden by D-04: base64 or `data:` audio URLs; reuse of the v0.8.1 `img-src data:` grant for audio; speculative CSP broadening; unrestricted filesystem paths; raw audio bytes crossing the bridge.
- Decode is **local** in the child window: `fetch(assetUrl)` → `arrayBuffer()` → `decodeAudioData` through the existing `audioEngine` path. The `efxasset` Rust handler returns 404 for missing files; the child warns and skips that track, never blocking the others (AUDIO-06).
- Any CSP adjustment is the single narrow directive proven necessary by a failing test, guarded by a contract test (v0.8.1 precedent); the proof mode is selected at the Task 3 checkpoint (section 9).

---

## 8. SCRUB POLICY

Scrubbing produces **no audio** (D-09 — silent scrub, play-only audio; no NLE-style scrub auditioning). Each scrub repositions the engine anchor at the cursor, ready for Play. Matches main-editor scrub behavior.

---

## 9. DECISIONS PENDING

To be locked by the 41-01 Task 3 blocking decision checkpoint; this section is renamed **DECISIONS LOCKED** once answered. Section 6 is annotated with the outcome.

| # | Question | Options routed at checkpoint |
|---|----------|------------------------------|
| A4 | Does "no absolute filesystem paths" (D-04) tolerate the path-bearing `efxasset://localhost` URL? | `a4-protocol-url` (permitted carrier) / `a4-opaque-token` (Rust ID-to-path registry) |
| A6 | What does the user hear when child playback fps ≠ project fps? | `a6-matched-fps` (guarantee at matched fps + status note) / `a6-playback-rate` (playbackRate scaling, pitch shift) |
| REV | Revision discipline for the audio section | `rev-counter` (monotonic integer, publisher-owned) / `rev-timestamp` (string id, rotoPhysical style) |
| D04 | Proof mode for the D-04 "failing packaged-app test" before the 41-05 CSP grant | `d04-proof-contract-red` (contract-test RED is the accepted proof) / `d04-proof-packaged-build` (pre-grant packaged build must fail first) |

---

*Locked by: Phase 41 plan 41-01 (Task 1). Test-encoded RED by plan 41-01 (Task 2). Decisions locked by plan 41-01 (Task 3 checkpoint).*
