# Phase 41: EFX Paint Audio Preview + Monitoring Toggle - Research

**Researched:** 2026-08-04
**Domain:** Cross-window read-only audio monitoring (Tauri v2 multi-window, Web Audio API, revisioned bridge payloads)
**Confidence:** HIGH (architecture and reuse seams verified in-repo); MEDIUM for the single CSP/fetch detail, which D-04 already routes through a packaged-app proof

## Summary

Phase 41 adds read-only, frame-synchronized monitoring of the main editor's audio arrangement inside the EFX Paint standalone window, plus a session-local Audio Preview toggle. Every hard problem in this phase already has a proven in-repo template: the offset/trim/slip math lives in `playbackEngine.startAudioPlayback()`; the one-shot Web Audio playback primitives (with mute/volume/fade handling) live in `audioEngine.ts`; the revisioned exact-payload handoff idiom lives in `physicsPaintLaunchContext.ts`; and the main-to-child event transport (`emitTo`/`listen`) is already exercised by five existing bridge event pairs. The phase is composition and discipline, not invention.

The two genuinely new mechanisms are: (1) asset-byte transport to the child window under the D-04 security boundary — the child window has **no fs permissions** (capability file grants only core/event/store/notification), so audio bytes must arrive via `fetch()` of an `efxasset://localhost` protocol URL carried in the revisioned context, which requires adding `efxasset:` to the CSP `connect-src` directive — exactly the "single narrow directive proven by a failing packaged-app test" path D-04 anticipates; and (2) playback-ownership signaling for the first-player-wins doubled-audio guard (D-05..D-07), for which **no existing event carries playback state in either direction** — only `physic-paint:seek-frame` (child to main frame sync) exists today.

The locked entry artifact (frame-to-audio truth table) is well-supported by verified code: paint `appFrame` **is** the main-editor global frame — the G-01 frame-sync handler seeks `timelineStore` directly with the child's `appFrame` value, with no translation. One real design question the truth table must answer: the child's Roto playback fps is user-adjustable (1-60, defaulting to project fps), so when it diverges from project fps the audio advance rate must be defined (see Open Questions).

**Primary recommendation:** Build the monitor as a child-window module that (a) receives a revisioned `audioPreview` section added to the existing launch/session payload (D-01), (b) fetches each track's bytes via the `efxasset:` URL carried in that section and decodes locally through the existing `audioEngine` math, (c) drives playback with the `playbackEngine` seek-restart pattern on Play/seek/loop-wrap/revision-update, free-running on the Web Audio clock with ~40ms drift-threshold correction (D-10), and (d) ships a first-player-wins ownership guard with a suppressed-status note and auto-resume, using new lightweight playback-state events between the windows.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audio context transport (AUDIO-02, AUDIO-04)**

- **D-01:** Extend the Phase 39 exact-payload revisioned bridge handoff: the audio preview context (revision, fps, per-track timing/gain state) becomes another section of the launch/session payload. One channel, one revision discipline — no dedicated audio channel or separate revision counter.
- **D-02:** Push on every change: the main editor emits an authoritative context event whenever audio state changes while EFX Paint is open; EFX Paint applies an update only if its revision is newer, and drops stale events silently. No launch-snapshot-only or manual-refresh behavior.
- **D-03:** Mid-playback revisioned updates restart audio at the current Paint cursor using the new context — what the user hears always reflects the latest main-editor state (no "apply on next play" deferral).
- **D-04:** Asset transport uses ONLY the existing secure Tauri asset protocol — **Reversibility:** one-way — context payloads carry opaque asset IDs or protocol URLs; no absolute filesystem paths and no raw audio bytes cross the bridge; EFX Paint fetches through the established asset-resolution authority and decodes locally via the existing Web Audio path. Explicitly forbidden: base64 or `data:` URLs for audio; reusing the v0.8.1 `img-src data:` grant for audio; speculative CSP broadening; unrestricted filesystem paths. Any CSP adjustment must be the single narrow directive proven necessary by a failing packaged-app test, without changing the existing image CSP contract.

**Doubled-audio guard policy (AUDIO-06)**

- **D-05:** First-player wins: whichever window starts playing audio first owns monitoring; starting playback in the other window while one is already audible is a no-op for audio (visual playback still proceeds). Deterministic, no mixing.
- **D-06:** When EFX Paint audio is suppressed by the guard, show a small non-blocking status note (e.g. "Audio playing in main editor") in the playback/status area — never silent suppression.
- **D-07:** Auto-resume on stop: when the main editor stops while EFX Paint is still visually playing and the toggle is On, monitoring resumes at the current Paint cursor and the suppressed status clears.
- **D-08:** Single audio engine instance per EFX Paint window; fully stopped and released on close; re-hydration and revisioned updates reuse the same instance — a second engine is never spawned.

**Scrub/seek audio behavior (AUDIO-03)**

- **D-09:** Silent scrub, play-only audio: dragging/scrubbing the Paint cursor produces no audio; each scrub leaves the engine positioned at the cursor, ready for Play. Matches main-editor scrub behavior; no NLE-style scrub auditioning.
- **D-10:** Free-run + drift-threshold correction: audio free-runs on the Web Audio clock after a seek-aligned start; the engine corrects only when measured drift exceeds a small threshold (~40ms / one frame). No per-frame re-sync chatter against the frame-sync architecture.
- **D-11:** Loop wraps re-seek audio: the EFX Paint loop range maps to the corresponding audio time window; each loop wrap re-seeks audio to the mapped start via the normal seek path. Source audio metadata is never touched.

**Toggle placement + default (AUDIO-05)**

- **D-12:** The Audio Preview On/Off toggle is a compact speaker/monitor icon button next to the Play/loop controls in the EFX Paint playback area, following the Phase 36.15 approved guarded-icon-with-tooltip pattern.
- **D-13:** Default On per session: session-local state, resets to On on each EFX Paint open; nothing persisted to project data or app config (mirrors soloStore session-only precedent).
- **D-14:** Immediate effect mid-playback: toggling Off silences audio immediately while visual playback continues; toggling On resumes audio at the current Paint cursor without restarting visual playback.

### Claude's Discretion

- Exact drift-measurement mechanics and the precise correction threshold within the ~1-frame budget (D-10).
- Exact visual form of the suppressed-status note within the existing status/capsule conventions (D-06).
- How the existing `app/src/lib/audioEngine.ts` per-track offset/trim/delay math is reused or adapted for the EFX Paint window (researcher/planner territory — reuse rather than rewrite).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIO-01 | Main editor sole authority for audio IDs, assets, offset, trim, volume, mute, fades, ordering, persistence, export mixing | Context payload is a read-only projection of `audioStore.tracks`; child never imports `audioStore` (its own bundle instance would be empty anyway); no child-side audio mutations exist — see Architecture Patterns P1 |
| AUDIO-02 | Launch/session context provides revision, sequence, parent layer, fps, per-track timing/gain state | D-01 section extension of `PhysicPaintLaunchContext`; `AudioTrack` type (`app/src/types/audio.ts:3-30`) carries every needed field; revision discipline mirrors `rotoPhysical.revision` in `physicsPaintLaunchContext.ts` |
| AUDIO-03 | Start/seek/pause/stop/loop in sync with Paint cursor, no drift | Seek-restart template `playbackEngine.ts:92-104` + per-track math `playbackEngine.ts:192-224` (quoted verbatim below); loop-wrap hook point identified in `useRotoCachedPlayback.ts` `showNextFrame`; free-run + threshold correction per D-10 |
| AUDIO-04 | Revisioned bridge updates; stale never overwrites newer | D-02/D-03; revision-guard pattern from Phase 39 PHYSICAL_KEYS/revision idiom; main-side publish point = signal `effect()` subscription on `audioStore.tracks` (Preact-native, per CLAUDE.md) |
| AUDIO-05 | Session-local On/Off toggle, no main-editor mutation | D-12/D-13/D-14; session signal in child window only (soloStore precedent); toggle-off path = `stopAll()` + positioned-at-cursor state; guarded-icon-with-tooltip pattern exists in `PhysicsPaintStyledTooltip.tsx` / toolbar |
| AUDIO-06 | Missing assets non-blocking; failure never blocks editing; close releases resources; no doubled audio | efxasset handler returns 404 for missing files (`lib.rs:421-428`) → per-track warn-and-skip mirrors `projectStore.ts:561-572` decode-failure tolerance; close path hook exists (`usePhysicsPaintCloseFlush`); ownership guard D-05..D-08 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD install from `.claude/gsd-core`; **do not run the dev server** (user runs it).
- Tests: `vitest run` only — **never** launch Vitest in watch mode.
- Preact-native patterns: prefer Signals over `useState`/`useEffect`; no effect-dependency sprawl; effects only to synchronize with something external. Consult the `developing-preact` skill before new shared-state abstractions.
- Preserve existing conventions; inspect nearby modules before changing; keep changes proportional; no unrelated refactors.
- Git index lock recovery: check `lsof .git/index.lock`; remove only the stale lock file; ask if unclear.
- Memory-derived directives relevant here: pnpm (not npm); no backward-compat shims for format changes; native visual UAT is the oracle — nothing is "done" until live UAT passes; small focused hooks/modules for Studio work; CSP changes only as narrow grants proven by failing packaged-app tests with contract-test guards (v0.8.1 precedent).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audio authority (IDs, trim, mute, volume, fades, ordering, persistence, export) | Main editor window (`audioStore`, `audioEngine`, `audioExportMixer`) | — | Locked boundary (AUDIO-01); child is read-only |
| Revisioned audio context publishing (D-02) | Main editor window (signal `effect()` on `audioStore.tracks` → `emitTo('efx-physic-paint', ...)`) | Rust event bus (transport only) | Main owns the authoritative state; push-on-change |
| Asset ID → byte resolution | Tauri `efxasset` custom protocol (`lib.rs:383`) | Main editor (builds the protocol URL via `ipc.ts assetUrl()`) | D-04: no paths/bytes cross the bridge; protocol URL is the sanctioned carrier |
| Audio decode + monitoring playback | EFX Paint window (reuse of `audioEngine` math, own engine instance) | — | D-04 local decode; D-08 single engine per window |
| Playback ownership arbitration (first-player-wins) | Shared: both windows emit/assert ownership over bridge events | EFX Paint window shows suppressed note (D-06) | Neither window is authoritative alone; deterministic rule needs state from both |
| Drift measurement/correction | EFX Paint window | — | Only the child has both clocks (frame cursor + Web Audio) |
| Session toggle state | EFX Paint window (session signal) | — | D-13: session-local, never persisted |
| CSP grant (if proven) | `app/src-tauri/tauri.conf.json` + `releaseContract.test.ts` guard | — | v0.8.1 narrow-grant-with-contract-test discipline |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `GainNode`) | platform (WKWebView) | Decode, sample-accurate scheduled playback, gain/fade automation | Already the main-editor audio path (`audioEngine.ts`); D-04 mandates local decode via "the existing Web Audio path" [VERIFIED: app/src/lib/audioEngine.ts:11-99] |
| `@tauri-apps/api` (event) | ^2.10.1 (installed) | `emitTo`/`listen` cross-window transport | Five existing bridge event pairs use exactly this [VERIFIED: app/package.json dependencies; app/src/lib/physicPaintBridge.ts:823-834] |
| `@preact/signals` | ^2.8.1 (installed) | Revisioned context signal in child; publish subscription in main; session toggle signal | Project-standard state primitive per CLAUDE.md; soloStore precedent for session-local signals |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^2.1.9 (installed) | Unit tests for truth table, revision guard, drift corrector, ownership guard | All automated coverage; `vitest run` only (CLAUDE.md) |
| `@tauri-apps/plugin-fs` | ^2.4.5 (installed, **main window only**) | Main-editor audio byte reads (`readFile`) | NOT available in child window — capability file grants no `fs:` permissions to `efx-physic-paint` [VERIFIED: app/src-tauri/capabilities/physics-paint.json:6-15] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch(efxasset://...)` + `decodeAudioData` | `<audio>` element + `MediaElementAudioSourceNode` (media-src already grants `efxasset:` — zero CSP change) | Loses sample-accurate offsets, one-shot scheduling, and all existing `audioEngine` fade/trim math; D-04 says "decodes locally via the existing Web Audio path" — buffer decode is that path |
| `fetch(efxasset://...)` | Extend Rust `efxasset` handler with opaque token registry (ID→path in Rust) | Truly path-free payloads, but a new native mechanism + state registry; heavier than D-04 requires since protocol URLs are explicitly permitted |
| Reusing `audioEngine.ts` in child | New child-local engine module | Duplicates offset/trim/fade math; CONTEXT discretion says "reuse rather than rewrite". Note: `audioEngine` exports a singleton — each webview gets its own instance, which satisfies D-08 naturally |

**Installation:**
```bash
# No new packages. All dependencies already installed.
```

**Version verification:** No new packages to verify. Existing versions confirmed from `app/package.json` (read this session).

## Package Legitimacy Audit

**This phase installs no external packages.** All work uses platform APIs (Web Audio), already-installed dependencies (`@tauri-apps/api`, `@preact/signals`), and in-repo modules.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
MAIN EDITOR WINDOW ('main')                     EFX PAINT WINDOW ('efx-physic-paint')
─────────────────────────────                   ──────────────────────────────────────
audioStore.tracks (authority)                   launch/session payload listener
        │                                               │
        ▼ effect() on change (D-02)                     ▼
build audioPreview section ───────────────►  revision guard (D-02: newer only)
{ revision, fps, tracks[{ id,                         │
  assetUrl(efxasset://...), offsetFrame,              ▼
  inFrame, outFrame, slipOffset, volume,     audioPreviewStore (session signal)
  muted, fadeIn/Out(+curves) }] }                     │
        │  (also embedded in launch                   ▼ per track, lazy
        │   context section, D-01)            fetch(assetUrl) ──► efxasset protocol
        │                                               │       (Rust, lib.rs:383)
        │                                               ▼
        │                                       decodeAudioData → buffer cache
        │                                               │
playback ownership events ◄─────────────────────────────┤
(main play/stop broadcast,                            ▼
 child ownership claim/release)              PaintAudioMonitor (single engine, D-08)
        │                                       play/seek/stopAll/loop-wrap re-seek
        │                                               │  (playbackEngine seek-restart
        ▼                                               │   pattern + D-10 drift check)
main playbackEngine (unchanged                          ▼
 audio path, guarded by                        Web Audio graph → speakers
 first-player-wins)                                   │
                                               toggle signal (D-13/14) ──► stopAll /
                                                     resume-at-cursor
```

### Recommended Project Structure

```
app/src/
├── lib/
│   ├── audioEngine.ts                    # REUSE: play/playDelayed/stopAll/fades (unchanged or lightly extracted)
│   ├── playbackEngine.ts                 # REUSE template: startAudioPlayback math + seek-restart (main window; do NOT import in child)
│   └── physicPaintBridge.ts              # EXTEND: audio preview event constants, publisher, ownership events
├── types/
│   └── physicPaint.ts                    # EXTEND: audioPreview section type + type guard (closed plain-data, like rotoPhysical)
├── stores/
│   └── audioStore.ts                     # UNCHANGED (main-window authority)
└── components/physic-paint/
    ├── audio/                            # NEW: child-side monitoring module (focused, per "extract hooks for hard fixes")
    │   ├── efxPaintAudioPreviewContext.ts    # section schema parse + revision guard (mirrors physicsPaintLaunchContext.ts idiom)
    │   ├── efxPaintAudioMonitor.ts           # engine wrapper: play-at-frame, seek, stop, loop re-seek, drift check, release
    │   ├── efxPaintAudioOwnership.ts         # first-player-wins guard state (D-05..D-07)
    │   └── efxPaintAudioPreview.test.ts      # truth table + revision guard + drift + ownership tests
    ├── bridge/
    │   ├── physicsPaintLaunchContext.ts  # EXTEND: accept audioPreview key in canonical envelope
    │   ├── physicsPaintBridgeTransport.ts# EXTEND: ownership/state event senders
    │   └── usePhysicsPaintParentBridge.ts# EXTEND: audio context + ownership listeners
    └── view/                             # EXTEND: toggle icon button (D-12) + suppressed-status note (D-06)
```

### Pattern 1: Revisioned exact-payload section (D-01/D-02)

**What:** Add an `audioPreview` section to the canonical launch envelope and to a push-on-change session event, guarded by the same closed-key + structured-clone + revision discipline as `rotoPhysical`.
**When to use:** All audio context transport — launch hydration and live updates share one schema, one revision counter discipline.
**Verified idiom to mirror** [VERIFIED: app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts:13-14]:

```ts
const LAUNCH_KEYS = new Set(['operationId', 'layerId', 'project', 'startFrame', 'layerName', 'workflowLabel', 'width', 'height', 'fps', 'rotoPhysical', 'rotoPlayback']);
const PHYSICAL_KEYS = new Set(['capacity', 'records', 'interpolationEnabled', 'interpolationMode', 'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame', 'revision']);
```

The audio section follows suit: an `AUDIO_PREVIEW_KEYS` closed set (including `revision`), validated by a type guard in `types/physicPaint.ts` next to `isPhysicPaintRotoPlaybackSettings`, and applied child-side only when `incoming.revision > current.revision` (stale dropped silently, D-02).

### Pattern 2: Seek-restart audio at cursor (D-03/D-09/D-11)

**What:** Any discontinuity (seek-while-playing, loop wrap, mid-playback revision update, toggle-On) stops all sources and restarts them at the mapped cursor position.
**When to use:** Every audio position change. Never try to "nudge" playing sources.
**Verified template** [VERIFIED: app/src/lib/playbackEngine.ts:99-103]:

```ts
    // If currently playing, restart audio at new seek position
    if (timelineStore.isPlaying.peek()) {
      audioEngine.stopAll();
      this.startAudioPlayback();
    }
```

### Pattern 3: Per-track offset/trim/slip math (reuse, don't rewrite)

**What:** The exact frame→audio-time mapping, including future-track delayed scheduling.
**Verified core math** [VERIFIED: app/src/lib/playbackEngine.ts:192-224]:

```ts
  private startAudioPlayback(): void {
    const currentFrame = timelineStore.currentFrame.peek();
    const fps = projectStore.fps.peek();
    const maxFrames = totalFrames.peek();

    for (const track of audioStore.tracks.peek()) {
      if (track.muted) continue;

      // The track is audible on the timeline between:
      //   track.offsetFrame  and  track.offsetFrame + (track.outFrame - track.inFrame)
      const trackStartOnTimeline = track.offsetFrame;
      const trimDuration = track.outFrame - track.inFrame;
      const trackEndOnTimeline = trackStartOnTimeline + trimDuration;

      // Cap to timeline length — audio must not play beyond the last frame
      const effectiveEnd = Math.min(trackEndOnTimeline, maxFrames);

      if (currentFrame >= trackStartOnTimeline && currentFrame < effectiveEnd) {
        // Playhead is within the track range — start immediately
        const framesIntoTrack = currentFrame - trackStartOnTimeline;
        const sourceOffset = (track.inFrame + track.slipOffset + framesIntoTrack) / fps;
        const maxPlayFrames = effectiveEnd - currentFrame;
        audioEngine.play(track.id, sourceOffset, track, fps, maxPlayFrames / fps);
      } else if (currentFrame < trackStartOnTimeline && trackStartOnTimeline < effectiveEnd) {
        // Track starts in the future — schedule it with a delay
        const delaySec = (trackStartOnTimeline - currentFrame) / fps;
        const sourceOffset = (track.inFrame + track.slipOffset) / fps;
        const maxPlayFrames = effectiveEnd - trackStartOnTimeline;
        audioEngine.playDelayed(track.id, delaySec, sourceOffset, track, fps, maxPlayFrames / fps);
      }
    }
  }
```

The child's monitor consumes the same math against the payload's track list (mapped to `AudioTrack`-shaped entries), substituting the Paint cursor for `currentFrame`. Note `maxFrames` capping: in the child, the cap is the Paint playback range end (D-11 loop window), not `totalFrames` — the truth table must state this. Engine API [VERIFIED: app/src/lib/audioEngine.ts:45]: `play(trackId: string, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): void`.

### Pattern 4: Free-run + drift-threshold correction (D-10)

**What:** After a seek-aligned start, audio free-runs on `ctx.currentTime`. On each playback tick, compute `expectedAudioTime = f(currentAppFrame)` via the truth table and `actualAudioTime = anchorOffset + (ctx.currentTime - anchorContextTime)`; re-seek only when `|expected - actual| > threshold` (~40ms, one frame at 24fps ≈ 41.7ms).
**When to use:** Sustained playback only; never per-frame re-sync (frame-sync architecture forbids the chatter).
**Example:** [ASSUMED — discretion D-10 mechanics; training knowledge, not verified against an external source this session]

```ts
// anchor captured at seek-aligned start:
anchor = { appFrame: startAppFrame, audioTime: startAudioOffset, ctxTime: ctx.currentTime };
// per tick (throttled, e.g. every ~10 ticks):
const expected = anchor.audioTime + (cursorAppFrame - anchor.appFrame) / projectFps;
const actual = anchor.audioTime + (ctx.currentTime - anchor.ctxTime);
if (Math.abs(expected - actual) > DRIFT_THRESHOLD_SEC) restartAtCursor(); // Pattern 2
```

### Pattern 5: First-player-wins ownership guard (D-05..D-08)

**What:** Both windows publish lightweight playback-state events; each window checks the other's state before starting audio. Child suppressed → status note (D-06); other window stops → child auto-resumes at cursor if visually playing and toggle On (D-07).
**Gap identified:** No existing event carries playback state in either direction. Existing child→main events: `physic-paint:seek-frame` (frame sync), apply/request events. Existing main→child events: launch, project-context, request results. New events (planner names them, e.g. `physic-paint:audio-ownership`) must be added in `physicPaintBridge.ts` alongside the existing constants [VERIFIED: app/src/lib/physicPaintBridge.ts:26-42 — event constants list contains no playback-state event].
**Note:** Ownership signaling is transient session state, not revisioned context — D-01's "one channel, one revision discipline" applies to the audio *context*; keep ownership events minimal and separate rather than forcing them through the revision counter (recommend; planner confirms).

### Pattern 6: Asset-byte transport via `efxasset:` protocol (D-04)

**What:** The main window builds a protocol URL per track with the existing helper and includes it in the context section; the child fetches and decodes.
**Verified helper** [VERIFIED: app/src/lib/ipc.ts:25-30]:

```ts
export function assetUrl(filePath: string, bustKey?: string): string {
  const encoded = encodeURIComponent(filePath)
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':');
  const bust = bustKey ? `?v=${bustKey}` : '';
  return `efxasset://localhost${encoded}${bust}`;
}
```

The Rust handler (`lib.rs:383`, registered app-wide) serves any local file with percent-decoded path and returns 404 with CORS header for missing files — the missing-asset hook for AUDIO-06. Child decode path: `const buf = await (await fetch(assetUrl)).arrayBuffer(); await audioEngine.decode(trackId, buf);` — mirroring the main window's `readFile` → `decode` flow [VERIFIED: app/src/stores/projectStore.ts:566 decodes via `audioEngine.decode(track.id, arrayBuffer)`].

### Anti-Patterns to Avoid

- **fs plugin reads in the child window:** the `efx-physic-paint` capability grants no `fs:*` permissions [VERIFIED: app/src-tauri/capabilities/physics-paint.json:6-15 — permissions are `core:default`, `core:window:default`, `core:window:allow-close`, `core:window:allow-destroy`, `core:event:default`, `store:default`, three notification permissions]. Any `readFile` in the child fails at runtime. Use Pattern 6.
- **base64/`data:` audio or reusing the `img-src data:` grant:** explicitly forbidden by D-04.
- **Per-frame audio re-sync:** violates D-10 and fights the 38.1 per-tick signal architecture; threshold correction only.
- **Restarting a used `AudioBufferSourceNode`:** one-shot nodes; `audioEngine.play()` already creates a fresh node per call — always go through it.
- **`exponentialRampToValueAtTime(0, ...)`:** cannot target 0; `audioEngine` already targets 0.001 — do not regress this in any extracted code [VERIFIED: app/src/lib/audioEngine.ts:207 comment].
- **Child importing main-window stores (`audioStore`, `timelineStore`, `playbackEngine`):** the child runs the same bundle in a separate webview — module singletons would be *empty/independent instances*, silently breaking authority (AUDIO-01) and doubled-audio guarantees (AUDIO-06). The child consumes payload data only.
- **Persisting the toggle:** D-13 session-local; writing it to project data or app config violates AUDIO-05.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Offset/trim/slip/fade math | Child-side reimplementation | `audioEngine.play/playDelayed` + Pattern 3 math | Fade scheduling, clamp-to-buffer, one-shot node lifecycle, mute handling already correct and tested (`audioEngine.test.ts` exists) |
| Cross-window messaging | Custom postMessage protocol | `emitTo`/`listen` with typed guards (existing five event pairs) | Tauri event delivery, window-label targeting, browser fallback all solved |
| Payload validation | Ad-hoc `as` casts | Closed-key + structured-clone + type-guard idiom from `physicsPaintLaunchContext.ts` | Phase 39 proven; keeps stale/foreign payloads out (HYDR-03 lesson: no stale context application) |
| Audio decode | ffmpeg/native decode | `ctx.decodeAudioData` | WKWebView decodes mp3/wav/m4a natively; main editor already relies on it |
| Frame→time mapping | New mapping module | Locked truth table + Pattern 3 formula | Single source of truth; the entry artifact exists precisely to prevent divergence |

**Key insight:** The only genuinely new code is (a) the payload section + publisher, (b) the child monitor state machine (idle/positioned/playing/suppressed), (c) ownership signaling, (d) drift corrector, (e) the toggle UI. Everything else is reuse.

## Common Pitfalls

### Pitfall 1: `fetch(efxasset://...)` blocked by CSP `connect-src`
**What goes wrong:** Audio fetches fail in the packaged app even though images/video via `efxasset:` work.
**Why it happens:** `fetch()` is governed by `connect-src`, not `media-src`/`img-src`. Current CSP [VERIFIED: app/src-tauri/tauri.conf.json:38]:
`"csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost efxasset: blob: data: https://*; media-src 'self' asset: http://asset.localhost efxasset:; connect-src 'self' ipc: http://ipc.localhost https://*; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"` — `connect-src` lacks `efxasset:`. Tauri v2 docs' CSP example shows custom schemes must be listed per-directive [CITED: https://v2.tauri.app/security/csp/].
**How to avoid:** Plan a packaged-app test that proves the failure first, then add exactly `efxasset:` to `connect-src` (nothing else), and extend the existing contract-test guard. `releaseContract.test.ts:119` already enumerates `connect-src` in its "pre-existing sources preserved" check [VERIFIED: app/src/releaseContract.test.ts:119-120] — the guard must be updated deliberately in the same commit, per the v0.8.1 `img-src data:` precedent.
**Warning signs:** Works in dev (`vite` server origin) but silent 0-byte/blocked fetch in packaged build; console shows CSP violation.

### Pitfall 2: Child playback fps ≠ project fps breaks the real-time mapping
**What goes wrong:** If the user changes Roto playback fps in the child, audio drifts constantly or the corrector chatters.
**Why it happens:** Child playback advances `appFrame` at `rotoPlayback.fps` (user-adjustable 1–60 [VERIFIED: app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts:7-8 `MIN_ROTO_PLAYBACK_FPS = 1` / `MAX_ROTO_PLAYBACK_FPS = 60`]), defaulting to project fps [VERIFIED: app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts:93-96 — `fps: Math.max(1, Math.min(60, context.fps ?? 12))`]. Audio time maps through **project** fps. At mismatched rates, frames advance slower/faster than real time while Web Audio free-runs at real time.
**How to avoid:** The locked truth table MUST define this case. Options: (a) scale `source.playbackRate = playbackFps / projectFps` (pitch shift — likely unacceptable), (b) constrain audio monitoring guarantee to matched fps and show a non-blocking note when they differ, (c) treat each tick as a micro-seek (violates D-10). Recommendation: (b) for v0.9.0 scope, since default is matched fps; flag to user in the truth-table artifact review.
**Warning signs:** Drift corrector fires every few seconds; audio sounds fine only at default fps.

### Pitfall 3: Doubled audio from both windows playing
**What goes wrong:** User presses Play in both windows; two engines render the same tracks.
**Why it happens:** Two independent webviews, two Web Audio contexts, no shared mute.
**How to avoid:** D-05..D-08 ownership guard (Pattern 5) + the child never auto-starts audio except auto-resume per D-07. Also note the main window's own playback is unaffected by the child's toggle — the guard lives in both windows' play paths.
**Warning signs:** Phasing/echo during UAT; ownership events not arriving (check `emitTo` target label `'efx-physic-paint'` [VERIFIED: app/src/lib/physicPaintBridge.ts:44]).

### Pitfall 4: Stale revisioned update overwrites newer context
**What goes wrong:** Out-of-order or replayed events regress the child's track state mid-playback.
**Why it happens:** Re-hydration + push-on-change can interleave; browser-fallback `postMessage` and Tauri events can both deliver.
**How to avoid:** Strict `incoming.revision > current.revision` compare-and-drop (D-02), single application funnel (mirrors Phase 39 hydration guard HYDR-03), and D-03 restart-at-cursor applied only after the newer context is committed. Revision is a string in `rotoPhysical` (`revision: string` [VERIFIED: app/src/types/physicPaint.ts:456]); keep the audio revision comparable (monotonic counter or timestamped id — planner picks one discipline and documents it in the truth table).
**Warning signs:** Tracks flip to an older arrangement after rapid main-editor edits.

### Pitfall 5: AudioContext autoplay suspension
**What goes wrong:** No sound on first Play in the child window.
**Why it happens:** WebKit suspends `AudioContext` created without a user gesture.
**How to avoid:** Create/resume the context inside the Play button handler; `audioEngine.ensureContext()` already resumes suspended contexts [VERIFIED: app/src/lib/audioEngine.ts:18-26]. The toggle/Play press is the gesture.
**Warning signs:** `ctx.state === 'suspended'`; works after second click.

### Pitfall 6: Resource leak on window close
**What goes wrong:** Audio keeps playing after the child window closes, or buffers linger on re-open.
**Why it happens:** `onended` cleanup only fires for finished sources; scheduled future (`playDelayed`) sources survive navigation-less close races.
**How to avoid:** Explicit release in the close path — `stopAll()` + `ctx.close()` — hooked into the existing close funnel (`usePhysicsPaintCloseFlush` pattern [VERIFIED: app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:19-44]) and the unmount path. D-08: one engine instance per window lifetime; re-hydration reuses it.
**Warning signs:** Audio continues ~seconds after close; memory growth across open/close cycles.

### Pitfall 7: Loop-wrap not re-seeking audio
**What goes wrong:** First loop pass is in sync; subsequent passes drift or play past the loop window.
**Why it happens:** The child's playback loop wraps frame index internally without a "seek" event [VERIFIED: app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts — `showNextFrame` resets `frameIndex = 0` on wrap when `settingsRef.current.loop` is true].
**How to avoid:** D-11: hook the wrap (or detect the backward appFrame jump in `onFrame`) and run Pattern 2 restart mapped to the loop-start appFrame. Main-editor template does exactly this at its loop boundaries [VERIFIED: app/src/lib/playbackEngine.ts:287-291 — `timelineStore.seek(0); audioEngine.stopAll(); this.startAudioPlayback();`].
**Warning signs:** Sync perfect on first pass only.

### Pitfall 8: Non-audio MIME from `efxasset` handler
**What goes wrong:** (Minor) audio files are served as `application/octet-stream`.
**Why it happens:** The handler's MIME table covers images and video only [VERIFIED: app/src-tauri/src/lib.rs:394-417 — mp4/mov/webm/avi mapped, no audio extensions].
**How to avoid:** Harmless for `fetch → arrayBuffer → decodeAudioData` (MIME ignored). Do NOT add audio MIME entries unless a proven need arises — keep the Rust diff at zero for this phase if possible.
**Warning signs:** None for the fetch path; would matter only for `<audio>` element playback.

## Code Examples

Verified patterns from in-repo sources (quoted this session):

### Main→child targeted event publish
```ts
// Source: app/src/lib/physicPaintBridge.ts:823-834 (publishPhysicPaintProjectContext)
export async function publishPhysicPaintProjectContext(): Promise<void> {
  const project = { name: projectStore.name.peek(), saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()), contextId: projectStore.projectContextId.peek() };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, project);
  }
  if (typeof window !== 'undefined') {
    const message = { type: PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, payload: project };
    window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, { detail: project }));
    window.opener?.postMessage?.(message, window.location.origin);
  }
}
```
The audio context publisher follows this shape: `emitTo('efx-physic-paint', PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, section)` + browser fallbacks, called from a signal `effect()` over `audioStore.tracks`.

### Child-side launch listener with validation guard
```ts
// Source: app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:69-77
unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
  if (isPhysicPaintLaunchContext(event.payload)) {
    launchEventReceived = true;
    console.info('[PhysicsPaintStudio] launch context received', event.payload);
    applyIncomingLaunchContextRef.current(event.payload);
  } else {
    console.warn('[PhysicsPaintStudio] invalid launch context', event.payload);
  }
});
```

### Frame identity proof (truth table anchor)
```ts
// Source: app/src/lib/physicPaintBridge.ts:956-961 — the child's appFrame seeks the
// main-editor timeline DIRECTLY: paint appFrame == main-editor global frame.
export function handlePhysicPaintFrameSyncMessage(value: unknown): boolean {
  if (!isPhysicPaintFrameSyncMessage(value)) return false;
  timelineStore.seek(value.frame);
  timelineStore.ensureFrameVisible(value.frame);
  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Launch-snapshot-only context | Push-on-change revisioned sections (D-01/D-02) | Phase 39 idiom, extended here | Child always reflects latest main-editor audio state |
| `asset:` protocol + `convertFileSrc` | `efxasset:` custom protocol with percent-decoded paths | Pre-v0.8.1 (NFC/NFD path fix) | Handles accented macOS paths; app-wide registration makes it reachable from the child window |
| rAF playback tick (main editor) | `setInterval` per-tick signal write (child, 38.1-D-01) | Phase 38.1 | Child audio anchor must read the per-tick signal via `.peek()`, never subscribe in render |

**Deprecated/outdated:**
- Sending raw bytes/base64 across the bridge for media: forbidden by D-04 for audio (thumbnail base64 remains allowed for the pre-existing encode-request pair only — do not generalize it).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fetch()` to a custom Tauri scheme requires the scheme in `connect-src`; adding `efxasset:` to `connect-src` unblocks it on macOS WKWebView | Pitfall 1 | MEDIUM impact if wrong: packaged test fails differently than predicted; D-04 already routes through the failing-test proof, so the plan survives either way. Basis: Tauri v2 CSP docs example + community reports [CITED: https://v2.tauri.app/security/csp/]; not executed against this app. **CONFIRMED VALID (2026-08-05, 41-05):** the pre-grant packaged build's EFX Paint webview refused the efxasset fetch with the verbatim console error "Refused to connect to efxasset://localhost/... because it does not appear in the connect-src directive of the Content Security Policy." — the connect-src directive is exactly the gate A1 named |
| A2 | Drift-correction mechanics (anchor + per-tick expected-vs-actual compare, ~40ms threshold) | Pattern 4 | LOW impact: D-10 is explicitly Claude's discretion; native UAT is the oracle for sync quality |
| A3 | The `efxasset` protocol handler registered via `register_uri_scheme_protocol` is reachable from the `efx-physic-paint` webview (registration is app-wide, not per-window) | Pattern 6 | MEDIUM impact if wrong: child fetches 404/blocked regardless of CSP; would force a per-window registration or Rust change. Mitigated by the same packaged-test proof as A1 |
| A4 | An `efxasset://localhost/...` URL qualifies as the "protocol URL" D-04 permits, even though it embeds a percent-encoded absolute path | Pattern 6 | If the user's intent is stricter (no path material in payloads at all), the fallback is an opaque-ID + Rust-side resolution registry (bigger diff). Surface in truth-table/UAT review |
| A5 | Ownership signaling should be separate lightweight events, not part of the revisioned context section | Pattern 5 | LOW impact: planner can fold it into the section instead; behavior identical, schema slightly larger |
| A6 | Recommended resolution for playback-fps mismatch is "guarantee sync at matched fps, non-blocking note otherwise" | Pitfall 2 | If user wants monitoring at variable playback speed, the design needs playbackRate scaling with pitch consequences — changes truth-table content, not architecture |

**Planner note:** A1/A3 are resolved by the D-04-mandated packaged-app test; A4/A6 deserve explicit user confirmation when the truth-table entry artifact is reviewed (both are one-line answers).

## Open Questions (RESOLVED — Q1-Q3 locked by the 41-01 Task 3 checkpoint on 2026-08-04; Q4 resolved by the 41-04 design)

> Q1-Q3 resolved at the blocking 41-01 Task 3 decision checkpoint and recorded in the truth table's DECISIONS LOCKED section (section 9); Q4 resolved by the 41-04 design (broadcast from `playbackEngine.start/stop` via a bridge publisher).

1. **Playback fps ≠ project fps: what does the user hear?** — RESOLVED: **`a6-matched-fps`**
   - Decision: the sync guarantee holds when child playback fps equals project fps (the default). Non-default playback speeds are best-effort monitoring, not sample-locked — non-blocking status note, no `playbackRate` scaling, no pitch shift. Locked in the truth table section 6.
   - What we know: child playback fps is user-adjustable 1–60, defaults to project fps; audio time maps through project fps.
   - Recommendation adopted: matched-fps guarantee + note (A6).

2. **Does "no absolute filesystem paths" (D-04) tolerate the path-bearing `efxasset:` URL?** — RESOLVED: **`a4-protocol-url`**
   - Decision: the `efxasset://` URL carrying the percent-encoded absolute path IS the permitted carrier — zero Rust transport diff; D-04 read as permitting protocol URLs. Payloads still never carry raw `filePath`/`relativePath` fields. Locked in the truth table sections 7 and 9.
   - What we know: D-04 permits "opaque asset IDs or protocol URLs"; `efxasset:` URLs encode the absolute path; the URL is useless without the fetch, which stays inside the Tauri protocol boundary.

3. **Revision discipline for the audio section: counter or string id?** — RESOLVED: **`rev-counter`**
   - Decision: monotonically increasing integer counter owned by the main-side publisher — total order, strict newer-than compare, bumped exactly once per publish. Locked in the truth table section 4.
   - What we know: `rotoPhysical.revision` is a string; D-02 needs a total order ("newer"); no existing monotonic audio revision source was found.

**D-04 proof mode (from the 41-01 Task 3 checkpoint, recorded here because it gates 41-05):** RESOLVED: **`d04-proof-packaged-build`** — the `efxasset` fetch failure must be observed inside a **packaged build** before the `connect-src` grant lands (exact D-04 wording). Plan 41-05 runs a packaged build cycle demonstrating the pre-grant failure BEFORE adding the grant; the config-level contract test remains as the permanent guard afterwards but does not substitute for the packaged proof.

4. **Main-window playback-state broadcast hook point** — RESOLVED by 41-04 design: emit ownership events from `playbackEngine.start/stop` via a bridge publisher
   - What we know: D-07 needs the child to learn when main playback stops; `playbackEngine.start()/stop()` are the funnel.
   - What's unclear: whether broadcasting from `playbackEngine` (main-only module) vs. a bridge-level subscriber is preferred.
   - Recommendation: Emit ownership events from `playbackEngine.start/stop` via a bridge publisher (keeps one funnel, mirrors `publishPhysicPaintProjectContext` shape).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test | ✓ | v24.15.0 | — |
| pnpm | install/test (project standard) | ✓ | 10.27.0 | — |
| cargo / Tauri CLI | packaged-app CSP proof test | ✓ | cargo 1.93.1 | — |
| macOS WKWebView (Web Audio) | decode/playback | ✓ | platform | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 [VERIFIED: app/package.json devDependencies] |
| Config file | `app/vitest.config.ts` (exists) |
| Quick run command | `pnpm --dir app exec vitest run src/components/physic-paint/audio` |
| Full suite command | `pnpm --dir app exec vitest run` (CLAUDE.md: `vitest run` only, never watch) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | Payload is a read-only projection; child applies no mutations | unit (schema/guard) | `pnpm --dir app exec vitest run efxPaintAudioPreview` | ❌ Wave 0 |
| AUDIO-02 | Context section parse/validate, closed-key rejection, launch embed | unit | same file | ❌ Wave 0 |
| AUDIO-03 | Truth table: frame→audio-time for offset/trim/slip combos; seek/loop re-seek math | unit (truth-table suite — the locked entry artifact) | same file | ❌ Wave 0 |
| AUDIO-04 | Revision guard: stale dropped, newer applied; mid-playback restart path | unit | same file | ❌ Wave 0 |
| AUDIO-05 | Toggle: immediate silence, resume-at-cursor, no main-state mutation, session-only default On | unit + native UAT | same file | ❌ Wave 0 |
| AUDIO-06 | Missing asset warn-and-skip; close releases engine; ownership guard first-player-wins + auto-resume | unit (guard state machine) + packaged-app UAT | same file | ❌ Wave 0 |
| D-04/CSP | `connect-src` grant proven by packaged-app failure, then guarded | contract test extension | `pnpm --dir app exec vitest run releaseContract` | ✅ exists (`app/src/releaseContract.test.ts`, extend) |

### Sampling Rate
- **Per task commit:** `pnpm --dir app exec vitest run <touched test file>`
- **Per wave merge:** `pnpm --dir app exec vitest run` + `pnpm --dir app typecheck`
- **Phase gate:** Full suite green; native packaged-app UAT (audio sync/seek/loop/stop without drift or doubling, toggle isolation) per REL-02 — audio sync quality is inherently a native-UAT judgment; nothing is "done" until live UAT passes.

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` — truth table (entry artifact, written FIRST per roadmap), revision guard, drift corrector, ownership guard, toggle semantics — covers AUDIO-01..06
- [ ] `app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts` — section schema + guards (test target must exist)
- [ ] Truth-table document — locked frame→audio mapping incl. per-track offset/trim/slip combinations and the fps-mismatch rule (Open Question 1), written and reviewed before implementation tasks
- [ ] Packaged-app CSP proof test (script or manual step) demonstrating the `connect-src` failure before the grant is added (D-04 discipline)

*(Framework install: none needed — vitest infrastructure exists, including `audioEngine.test.ts` precedent for Web Audio unit tests.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (local desktop app, no auth boundary) |
| V3 Session Management | no | — |
| V4 Access Control | yes (analog) | Window-capability scoping: child has no fs permissions; authority boundary AUDIO-01 enforced by architecture (child holds no mutable audio store) |
| V5 Input Validation | yes | Closed-key + structured-clone + type-guard validation on every bridge payload (existing `isPhysicPaint*` idiom); revision guard against stale/replayed context |
| V6 Cryptography | no | — (no crypto; never hand-roll regardless) |
| V14 Configuration | yes | CSP as narrow-grant-only; contract-test guard on every directive (`releaseContract.test.ts`); no speculative broadening (D-04) |

### Known Threat Patterns for Tauri multi-window + custom protocol

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path injection via crafted protocol URL | Tampering | Child fetches only URLs received in validated revisioned sections; `efxasset` handler serves bytes read-only; no path strings accepted as data fields (D-04) |
| CSP broadening creep | Security misconfiguration | Single narrow directive (`efxasset:` in `connect-src`) proven by failing packaged test; contract test pins all pre-existing sources; image CSP contract untouched |
| Bridge payload spoofing/replay (other windows, browser fallback) | Spoofing/Tampering | Type guards + revision compare-and-drop; `emitTo` window-label targeting (not broadcast `emit`) for main→child events |
| Resource exhaustion via oversized payloads | DoS | Existing precedent: 32MB cap on state-save contents (`physicPaintBridge.ts` state-save listener); audio context is small (track metadata + URLs), bytes never cross the bridge |
| Raw audio bytes/base64 crossing bridge | Information disclosure (paths/data) | Forbidden by D-04; bytes flow only through the local protocol handler within the app's own webview process |

## Sources

### Primary (HIGH confidence)
- In-repo reads this session (all quoted verbatim above): `app/src/lib/audioEngine.ts`, `app/src/lib/playbackEngine.ts`, `app/src/stores/audioStore.ts`, `app/src/types/audio.ts`, `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts`, `.../usePhysicsPaintParentBridge.ts`, `.../physicsPaintBridgeTransport.ts`, `app/src/lib/physicPaintBridge.ts`, `app/src/lib/ipc.ts`, `app/src-tauri/src/lib.rs` (efxasset handler), `app/src-tauri/tauri.conf.json` (CSP), `app/src-tauri/capabilities/{default,physics-paint}.json`, `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts`, `.../usePhysicsPaintLaunchIntegration.ts`, `app/src/releaseContract.test.ts`, `SPECS/milestone-v0.9.0-plan.md` §Phase 2, `41-CONTEXT.md`, `.planning/ROADMAP.md` §Phase 41
- `SPECS/milestone-v0.9.0-plan.md` — locked AUDIO-01..06 spec text + illustrative `EfxPaintAudioPreviewContext`

### Secondary (MEDIUM confidence)
- [Tauri v2 CSP docs](https://v2.tauri.app/security/csp/) — custom scheme must appear in the relevant directive (connect-src for fetch) [CITED]
- Tauri v2 community/release notes — custom protocol URL form on macOS (`scheme://localhost`) vs Windows (`http://scheme.localhost`); macOS-only target makes this moot [CITED: https://v2.tauri.app/blog/tauri-20/]

### Tertiary (LOW confidence)
- None — all LOW-confidence mechanics are tagged [ASSUMED] in-line and listed in the Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all versions read from installed manifests
- Architecture: HIGH — every reuse seam opened and quoted this session; only the ownership-signaling schema is new design (flagged)
- Pitfalls: HIGH for in-repo mechanics (CSP string, capabilities, loop wrap, fps clamp); MEDIUM for the WKWebView fetch-through-custom-protocol behavior (A1/A3), which the plan proves via packaged test per D-04 regardless

**Research date:** 2026-08-04
**Valid until:** 2026-09-04 (stable in-repo domain; re-verify if Tauri or Web Audio dependencies are upgraded)
