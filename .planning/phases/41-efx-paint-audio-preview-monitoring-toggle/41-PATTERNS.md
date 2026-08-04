# Phase 41: EFX Paint Audio Preview + Monitoring Toggle - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 13 (4 new, 9 modified/conditional)
**Analogs found:** 11 / 13 (ownership guard and drift corrector have no existing analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `components/physic-paint/audio/efxPaintAudioPreviewContext.ts` (NEW) | utility (schema/guard) | event-driven | `components/physic-paint/bridge/physicsPaintLaunchContext.ts` | exact |
| `components/physic-paint/audio/efxPaintAudioMonitor.ts` (NEW) | service (engine wrapper) | streaming (Web Audio) | `lib/playbackEngine.ts` (`startAudioPlayback`) + `lib/audioEngine.ts` | role-match (main-window twin) |
| `components/physic-paint/audio/efxPaintAudioOwnership.ts` (NEW) | service (guard state machine) | event-driven | `stores/soloStore.ts` (session signal only) | partial — no guard analog exists |
| `components/physic-paint/audio/efxPaintAudioPreview.test.ts` (NEW) | test | — | `components/physic-paint/bridge/physicsPaintLaunchContext.test.ts` | exact |
| `types/physicPaint.ts` (MODIFY: audioPreview section + guard) | model | — | `isPhysicPaintRotoPlaybackSettings` / `isPhysicPaintLaunchContext` in same file | exact (in-file) |
| `lib/physicPaintBridge.ts` (MODIFY: event constants, publisher, ownership events) | service (bridge) | event-driven | `publishPhysicPaintProjectContext` + event constants in same file | exact (in-file) |
| `components/physic-paint/bridge/physicsPaintLaunchContext.ts` (MODIFY: accept audioPreview key) | utility (schema) | event-driven | itself (LAUNCH_KEYS/PHYSICAL_KEYS idiom) | exact (in-file) |
| `components/physic-paint/bridge/physicsPaintBridgeTransport.ts` (MODIFY: ownership senders) | service (transport) | request-response | `sendPhysicPaintScriptLibraryRequest` in same file | exact (in-file) |
| `components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` (MODIFY: audio context listener + close release) | hook | event-driven | `usePhysicsPaintProjectContextBridge` + `usePhysicsPaintCloseFlush` in same file | exact (in-file) |
| `components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (MODIFY: toggle button D-12 + suppressed note D-06) | component | request-response | loop-toggle button + `useStyledTooltip` usage in same file | exact (in-file) |
| Session toggle signal (NEW, e.g. inside `audio/efxPaintAudioPreviewStore.ts`) | store | event-driven | `stores/soloStore.ts` | exact |
| `app/src-tauri/tauri.conf.json` (MODIFY, conditional: `efxasset:` in `connect-src`) | config | — | v0.8.1 `img-src data:` grant | role-match (precedent, not file) |
| `src/releaseContract.test.ts` (MODIFY: pin the new grant) | test (contract) | — | `Tauri CSP image data-url contract` describe block in same file | exact (in-file) |

## Pattern Assignments

### `audio/efxPaintAudioPreviewContext.ts` (NEW — schema parse + revision guard)

**Analog:** `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts`

**Closed-key + structured-clone + plain-record validation** (lines 13-39):
```typescript
const LAUNCH_KEYS = new Set(['operationId', 'layerId', 'project', 'startFrame', 'layerName', 'workflowLabel', 'width', 'height', 'fps', 'rotoPhysical', 'rotoPlayback']);
const PHYSICAL_KEYS = new Set(['capacity', 'records', 'interpolationEnabled', 'interpolationMode', 'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame', 'revision']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isStructuredClonePlainData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.every((entry) => isStructuredClonePlainData(entry, seen));
    if (!isPlainRecord(value)) return false;
    return Object.values(value).every((entry) => isStructuredClonePlainData(entry, seen));
  } finally {
    seen.delete(value);
  }
}
```
Copy this idiom verbatim for an `AUDIO_PREVIEW_KEYS` closed set (must include `revision`). Note: `isPlainRecord`/`hasOnlyKeys`/`isStructuredClonePlainData` are module-private here — the new module either duplicates them (consistent with current codebase style) or the planner extracts them to a shared helper.

**Fail-null parse funnel with try/catch** (lines 52-57, 95-97, 100-108):
```typescript
export function parseCanonicalPhysicsPaintLaunchValue(value: unknown): PhysicPaintLaunchContext | null {
  if (!isStructuredClonePlainData(value) || !isPlainRecord(value) || !hasOnlyKeys(value, LAUNCH_KEYS)) return null;
  if (!isPhysicPaintLaunchContext(value) || !isPlainRecord(value.project) || !isPlainRecord(value.rotoPhysical)) return null;
  if (!hasOnlyKeys(value.rotoPhysical, PHYSICAL_KEYS) || !Array.isArray(value.rotoPhysical.records)) return null;
  // ...
  try {
    // ...rebuild canonical payload
  } catch {
    return null;
  }
}
```
Invalid/stale/foreign payloads return `null` — never throw, never partially apply (HYDR-03 lesson). The revision compare-and-drop (`incoming.revision > current.revision`, stale dropped silently per D-02) is applied by the caller after a successful parse.

---

### `audio/efxPaintAudioMonitor.ts` (NEW — engine wrapper: play-at-frame, seek, stop, loop re-seek, drift check, release)

**Analog A:** `app/src/lib/playbackEngine.ts` — the frame→audio mapping math (reuse, do not rewrite).

**Per-track offset/trim/slip math** (lines 192-224) — copy this structure, substituting the Paint cursor for `currentFrame`, payload tracks for `audioStore.tracks`, and the Paint playback-range end for `totalFrames` (D-11 loop window cap):
```typescript
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

**Seek-restart pattern** (lines 99-103) — the template for D-03 (mid-playback revision update), D-09 (seek while playing), D-11 (loop wrap), D-14 (toggle-On resume):
```typescript
// If currently playing, restart audio at new seek position
if (timelineStore.isPlaying.peek()) {
  audioEngine.stopAll();
  this.startAudioPlayback();
}
```

**Loop-wrap re-seek** (lines 287-291) — identical shape for D-11:
```typescript
if (isLooping) {
  timelineStore.seek(0);
  audioEngine.stopAll();
  this.startAudioPlayback();
}
```

**Analog B:** `app/src/lib/audioEngine.ts` — engine API the monitor calls (import the singleton; each webview gets its own instance, which satisfies D-08 naturally).

**Lazy context + autoplay-suspension handling** (lines 17-26) — call from the Play button handler (the user gesture):
```typescript
ensureContext(): AudioContext {
  if (!this.ctx) {
    this.ctx = new AudioContext();
  }
  if (this.ctx.state === 'suspended') {
    this.ctx.resume();
  }
  return this.ctx;
}
```

**Engine API surface** (lines 45, 105, 178-183): `play(trackId, offsetSeconds, track, fps, maxDurationSec?)`, `playDelayed(trackId, delaySec, offsetSeconds, track, fps, maxDurationSec?)`, `stopAll()`, `decode(trackId, arrayBuffer)`, `getBuffer(trackId)`. Key constraints already enforced inside the engine — do NOT reimplement or regress: fresh `AudioBufferSourceNode` per `play()` (one-shot, lines 53-55), `exponentialRampToValueAtTime` targets 0.001 not 0 (line 207 comment), clamped offsets (line 83).

**Missing-asset warn-and-skip** (AUDIO-06): mirror the decode-failure tolerance — main-window precedent is `projectStore.ts` decode flow (`audioEngine.decode(track.id, arrayBuffer)` after byte read); in the child the byte read is `const buf = await (await fetch(assetUrl)).arrayBuffer()`. The `efxasset` Rust handler returns 404 for missing files (`app/src-tauri/src/lib.rs:421-428`); per-track try/catch → `console.warn` → skip that track, never block playback of the others.

**Anti-pattern (from RESEARCH.md, enforced by architecture):** the child module must NOT import `audioStore`, `timelineStore`, or `playbackEngine` — same-bundle singletons in a separate webview would be empty independent instances, silently breaking AUDIO-01/AUDIO-06. The monitor consumes payload data only.

---

### `audio/efxPaintAudioOwnership.ts` (NEW — first-player-wins guard, D-05..D-07)

**No exact analog exists** — no current event carries playback state in either direction. Build as a small focused module (per "extract hooks for hard fixes" memory) using:

**Session-signal state container** — analog `app/src/stores/soloStore.ts` (full file, 16 lines):
```typescript
import { signal, computed } from '@preact/signals';

const soloEnabled = signal(false);

export const soloStore = {
  soloEnabled,
  isSolo: computed(() => soloEnabled.value),

  toggleSolo() {
    soloEnabled.value = !soloEnabled.value;
  },

  setSolo(v: boolean) {
    soloEnabled.value = v;
  },
};
```
Same shape for ownership state (`otherWindowPlaying` signal) and the toggle signal (D-13: session-local, default On, never persisted).

**State machine** (idle/positioned/playing/suppressed): no in-repo template — planner designs it; the transitions are fully pinned by D-05 (first-player wins, later window no-op for audio), D-06 (suppressed → status note via the strip's `setStatus`/capsule path, see `useRotoCachedPlayback.ts` lines 202-208 `publishStatus` for the status-publish funnel), D-07 (other window stops → auto-resume at cursor if visually playing and toggle On).

---

### `audio/efxPaintAudioPreview.test.ts` (NEW — truth table + guards + ownership + toggle)

**Analog:** `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts`

**Test file header + fixture factories** (lines 1-45):
```typescript
import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import { applyPhysicsPaintLaunchContext, parsePhysicsPaintLaunchContext } from '../bridge/physicsPaintLaunchContext';

function makeRotoPhysical(overrides: Record<string, unknown> = {}) {
  return {
    capacity: 12,
    records: [],
    // ...
    revision: buildPhysicPaintRotoPhysicalRevision([], EMPTY_INTERPOLATION),
    ...overrides,
  };
}

function makeLaunchEnvelope(overrides: Record<string, unknown> = {}) {
  const rotoPhysical = makeRotoPhysical();
  return {
    operationId: 'op-1',
    layerId: 'layer-1',
    project: { name: 'Project', saved: true, contextId: 'opaque-context' },
    startFrame: rotoPhysical.cursorAppFrame as number,
    rotoPhysical,
    ...overrides,
  };
}
```

**Assertion style — parse accepts canonical, rejects incomplete/flat/foreign in the same `it`** (lines 48-61):
```typescript
expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(envelope)}`))).toMatchObject({ /* ... */ });
// Flat query-param launch contexts are a retired encoding ... and must be rejected.
expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7'))).toBeNull();
```

**Path-leak guard assertion** (lines 76-77) — directly relevant to D-04 (no filesystem paths crossing the bridge beyond the protocol URL):
```typescript
expect(JSON.stringify(parsed)).not.toContain('/Users/');
expect(JSON.stringify(parsed)).not.toContain('authority');
```

Note: `app/src/lib/audioEngine.test.ts` is mostly `it.todo` stubs — do NOT copy its style. The launch-context test is the house style: concrete factories + real assertions. For engine-mocking style (Web Audio stubs), check `app/src/lib/playbackEngine.test.ts` before writing the monitor tests.

---

### `types/physicPaint.ts` (MODIFY — audioPreview section type + type guard)

**Analog (in-file):** closed-key section guard, lines 869-877:
```typescript
export function isPhysicPaintRotoPlaybackSettings(value: unknown): value is PhysicPaintRotoPlaybackSettings {
  return isRecord(value)
    && hasOnlyKeys(value, ['loop', 'fps'])
    && typeof value.loop === 'boolean'
    && typeof value.fps === 'number'
    && Number.isFinite(value.fps)
    && value.fps >= 1
    && value.fps <= 60;
}
```

**Wiring the optional section into the launch-context guard** (lines 734-752) — the new `isEfxPaintAudioPreviewContext` guard joins this chain as another optional-section clause:
```typescript
export function isPhysicPaintLaunchContext(value: unknown): value is PhysicPaintLaunchContext {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.operationId) &&
    // ...
    (value.rotoPlayback === undefined || isPhysicPaintRotoPlaybackSettings(value.rotoPlayback)) &&
    optionalRotoPhysicalDocumentPayload(value.rotoPhysical) &&
    // add: (value.audioPreview === undefined || isEfxPaintAudioPreviewContext(value.audioPreview)) &&
  );
}
```

Track entries in the payload map to a subset of `AudioTrack` (`app/src/types/audio.ts:3-30`) — timing/gain fields only (`id`, `offsetFrame`, `inFrame`, `outFrame`, `slipOffset`, `volume`, `muted`, `fadeInFrames`, `fadeOutFrames`, `fadeInCurve`, `fadeOutCurve`) plus the `efxasset:` URL. Never include `filePath`/`relativePath` (D-04 path-leak). Revision: `rotoPhysical.revision` is a string (line 461); the audio revision needs a total order — a monotonic counter from the publisher is recommended (RESEARCH Open Question 3).

---

### `lib/physicPaintBridge.ts` (MODIFY — event constants, publisher, ownership events)

**Analog (in-file):** event constant block (lines 26-44) — add audio constants here:
```typescript
export const PHYSIC_PAINT_LAUNCH_EVENT = 'physic-paint:launch';
export const PHYSIC_PAINT_PROJECT_CONTEXT_EVENT = 'physic-paint:project-context';
// ...existing pairs...
const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';
```

**Main→child targeted publish with browser fallback** (lines 823-834) — the audio context publisher follows this exact shape, called from a signal `effect()` over `audioStore.tracks` (D-02):
```typescript
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
Use `emitTo` (window-label targeting), never broadcast `emit`, for main→child audio events (spoofing mitigation, RESEARCH Security Domain).

**Frame-identity proof** (lines 956-961) — anchor for the truth table (paint appFrame == main-editor global frame, no translation):
```typescript
export function handlePhysicPaintFrameSyncMessage(value: unknown): boolean {
  if (!isPhysicPaintFrameSyncMessage(value)) return false;
  timelineStore.seek(value.frame);
  timelineStore.ensureFrameVisible(value.frame);
  return true;
}
```

**Ownership broadcast hook point:** emit from `playbackEngine.start()/stop()` (main window, lines 35-58/60-71) via a bridge publisher shaped like the one above (RESEARCH Open Question 4 recommendation — one funnel).

---

### `bridge/physicsPaintLaunchContext.ts` (MODIFY — accept audioPreview key)

Add `'audioPreview'` to `LAUNCH_KEYS` (line 13), add an `AUDIO_PREVIEW_KEYS` set next to `PHYSICAL_KEYS` (line 14), and extend `parseCanonicalPhysicsPaintLaunchValue` (lines 52-98) with the same closed-key check + conditional spread pattern used for `rotoPlayback` (line 82):
```typescript
...(value.rotoPlayback !== undefined ? { rotoPlayback: { ...value.rotoPlayback } } : {}),
```

---

### `bridge/physicsPaintBridgeTransport.ts` (MODIFY — child→main ownership senders)

**Analog (in-file):** dual-transport sender with Tauri + browser fallback (lines 23-35):
```typescript
export async function sendPhysicPaintScriptLibraryRequest(request: PhysicPaintScriptLibraryRequest, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, request);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, payload: request }, window.location.origin);
    return;
  }
  throw new Error('Project script library is unavailable');
}
```
Ownership claim/release senders follow this shape (child→main direction targets label `'main'`).

---

### `bridge/usePhysicsPaintParentBridge.ts` (MODIFY — audio context listener + close-path engine release)

**Analog A (in-file):** triple-transport listener with disposed-guard cleanup (lines 100-119):
```typescript
export function usePhysicsPaintProjectContextBridge(handleProject: (project: PhysicPaintLaunchContext['project']) => void): void {
  const handleRef = useRef(handleProject); handleRef.current = handleProject;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => { /* validate, then handleRef.current(...) */ };
    const custom = (event: Event) => accept((event as CustomEvent).detail);
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_PROJECT_CONTEXT_EVENT) accept(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, (event) => accept(event.payload));
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom); window.removeEventListener('message', message); };
  }, []);
}
```
The audio-context listener copies this shape; inside `accept`, run the revision guard (D-02: newer-only, stale dropped silently) before applying, and route mid-playback application through the seek-restart path (D-03).

**Analog B (in-file):** close-path release hook (lines 19-44) — D-08 engine stop + `ctx.close()` hooks into this same close funnel:
```typescript
export function usePhysicsPaintCloseFlush(hasPending: () => boolean, flush: () => Promise<void>): void {
  // ...
  unlisten = await appWindow.onCloseRequested(async (event) => {
    if (!hasPendingRef.current()) return;
    event.preventDefault();
    try {
      await flushRef.current();
      if (!disposed) await appWindow.destroy();
    } catch (error) { /* ... */ }
  });
}
```
The audio release must ALSO run on unconditional close (the current flush early-returns when `!hasPending`) — planner wires engine release into both the close-requested path and the component unmount path.

---

### `view/PhysicsPaintWorkflowStrip.tsx` (MODIFY — Audio Preview toggle D-12 + suppressed-status note D-06)

**Analog (in-file):** the loop-toggle button — exact placement sibling for the new speaker icon button (line 366), and the transport button (line 360):
```tsx
<button type="button" class={`physics-paint-nav-button physics-paint-roto-loop-toggle ${props.playbackLoop ? 'active' : ''}`} aria-label="Loop cached Roto playback" aria-pressed={props.playbackLoop} disabled={!props.ready || !props.onPlaybackLoopChange} onClick={() => props.onPlaybackLoopChange?.(!props.playbackLoop)}><RotateCcw size={15} /></button>
```
Pattern to copy: `physics-paint-nav-button` class + conditional `active` class, `aria-pressed` for toggle state, dynamic `aria-label`, lucide icon at `size={15}` (use a speaker/volume icon), guarded onClick via optional callback prop. The toggle lives in the `physics-paint-pill--playback` group (line 365) next to the loop toggle.

**Guarded-icon-with-tooltip (Phase 36.15 pattern):** each icon button owns one `useStyledTooltip()` instance on a wrapping anchor span — `PhysicsPaintWorkflowStrip.tsx` lines 432-466 (`RotoTimelineCellButtonImpl`) shows the mount shape:
```tsx
const tooltip = useStyledTooltip();
return (
  <span
    class="physics-paint-roto-cell-anchor"
    onPointerEnter={tooltip.onPointerEnter}
    onPointerLeave={tooltip.onPointerLeave}
  >
    <button /* ... */ onFocus={tooltip.onFocus} onBlur={tooltip.onBlur} onClick={(event) => { tooltip.hide(); /* action */ }} />
    <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom">{props.tooltipCopy}</PhysicsPaintStyledTooltip>
  </span>
);
```
`useStyledTooltip` contract (from `PhysicsPaintStyledTooltip.tsx` lines 28-90): 1000ms hover delay, immediate on keyboard focus, Escape hides, `hide()` on activation. Region for bottom-of-UI playback controls is `region="bottom"` (pill renders above).

**Suppressed-status note (D-06):** publish through the existing status/capsule funnel rather than new UI — `useRotoCachedPlayback.ts` lines 202-208 (`publishStatus` gate: queued during active playback, immediate otherwise, null clears always pass).

---

### Session toggle signal (NEW — D-13)

**Analog:** `app/src/stores/soloStore.ts` (full file quoted in the ownership section above). Signal + computed + toggle/set methods; module-level singleton; nothing persisted. Default On — initialize `signal(true)` at module scope; each EFX Paint window load is a fresh bundle, so "resets on each open" is automatic.

---

### `app/src-tauri/tauri.conf.json` + `src/releaseContract.test.ts` (MODIFY, conditional — D-04 CSP proof)

**Analog (in-file):** the v0.8.1 `img-src data:` contract-test discipline, `releaseContract.test.ts` lines 107-132:
```typescript
describe('Tauri CSP image data-url contract', () => {
  const csp = tauriConfig.app?.security?.csp ?? '';

  it('img-src grants the data: scheme alongside every pre-existing source', () => {
    const tokens = cspDirectiveTokens(csp, 'img-src');
    expect(tokens.length, 'CSP must contain an img-src directive').toBeGreaterThan(0);
    for (const source of ["'self'", 'asset:', 'http://asset.localhost', 'efxasset:', 'blob:', 'data:', 'https://*']) {
      expect(tokens, `img-src must include ${source}`).toContain(source);
    }
  });

  it('no other CSP directive gains the data: scheme', () => {
    for (const directive of ['default-src', 'script-src', 'style-src', 'connect-src', 'media-src']) {
      const tokens = cspDirectiveTokens(csp, directive);
      expect(tokens, `${directive} must not include data:`).not.toContain('data:');
    }
  });
});
```
Same discipline for the audio grant: (1) packaged-app test proves `fetch(efxasset://...)` fails against current `connect-src`, (2) add exactly `efxasset:` to `connect-src` — nothing else, image CSP contract untouched, (3) extend the contract test in the same commit to pin `connect-src` including `efxasset:` alongside every pre-existing source. Reuse the file's existing `cspDirectiveTokens` helper.

## Shared Patterns

### Revisioned exact-payload validation (D-01/D-02)
**Source:** `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts` (lines 13-39, 52-98)
**Apply to:** `efxPaintAudioPreviewContext.ts`, `types/physicPaint.ts` guard, `physicsPaintLaunchContext.ts` extension

Closed key sets + structured-clone check + plain-record check + fail-null funnel. Stale updates dropped via strict revision-newer compare at the application point (single application funnel).

### Dual-transport cross-window events
**Source:** `app/src/lib/physicPaintBridge.ts` (publish, lines 823-834; listen, lines 963-975) + `usePhysicsPaintParentBridge.ts` (lines 100-119)
**Apply to:** audio context publisher, ownership events (both directions), audio context listener

Tauri `emitTo(label, ...)`/`listen` first, `CustomEvent` dispatch + `window.opener.postMessage` browser fallback second; listeners always carry the `disposed` flag + `unlisten?.()` cleanup.

### Seek-restart audio discipline (D-03/D-09/D-11/D-14)
**Source:** `app/src/lib/playbackEngine.ts` (lines 99-103, 287-291)
**Apply to:** `efxPaintAudioMonitor.ts` — every position discontinuity (seek, loop wrap, revision update, toggle-On) is `stopAll()` + restart-at-cursor. Never nudge playing sources; never per-frame re-sync (D-10 threshold only, ~40ms).

### Session-local ephemeral state (D-13)
**Source:** `app/src/stores/soloStore.ts` (entire file)
**Apply to:** toggle signal, ownership guard state — signals, never project data or app config (AUDIO-05).

### Guarded icon button with styled tooltip (D-12)
**Source:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (lines 357-467) + `PhysicsPaintStyledTooltip.tsx` (lines 28-90)
**Apply to:** the Audio Preview toggle button and any other new icon control in the playback area.

### Preact signal discipline in playback loops
**Source:** `app/src/lib/playbackEngine.ts` header comment (lines 14-24) + `useRotoCachedPlayback.ts` (lines 14-24, 75-77)
**Apply to:** `efxPaintAudioMonitor.ts`, drift corrector — always `.peek()` inside tick/interval loops; never subscribe in render; per-tick values live on signals written once per tick (38.1-D-01).

### CSP narrow-grant-with-contract-test (D-04)
**Source:** `app/src/releaseContract.test.ts` (lines 107-132)
**Apply to:** the conditional `connect-src` change — failing packaged proof first, single directive, contract test extended in the same commit.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `audio/efxPaintAudioOwnership.ts` (guard logic) | service | event-driven | No existing event carries playback state in either direction; first-player-wins arbitration is new design (only session-signal container pattern transfers from soloStore) |
| Drift corrector (inside `efxPaintAudioMonitor.ts`) | utility | streaming | D-10 is explicitly Claude's discretion; no free-run/threshold-correction code exists in-repo (main editor hard-restarts on every discontinuity instead) |

For both: planner designs from the D-decisions; RESEARCH.md Pattern 4/Pitfall 2/5 carry the constraints. Native UAT is the sync-quality oracle.

## Metadata

**Analog search scope:** `app/src/lib/`, `app/src/types/`, `app/src/stores/`, `app/src/components/physic-paint/` (bridge, hooks, view), `app/src/releaseContract.test.ts`
**Files scanned:** ~40 (14 read in full or targeted sections)
**Pattern extraction date:** 2026-08-04
