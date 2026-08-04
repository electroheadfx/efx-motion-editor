# Architecture Research

**Domain:** v0.9.0 feature integration into the existing EFX Motion Editor monorepo (Tauri 2.0 main editor + standalone `efx-physic-paint` window)
**Researched:** 2026-08-03
**Confidence:** HIGH — all integration points verified by direct repo inspection (no external research needed; the open questions are internal seam choices, not ecosystem unknowns)

## Standard Architecture

### System Overview (post-v0.9.0)

```
┌─────────────────────────── Main editor window (Tauri "main") ───────────────────────────┐
│  timelineStore / audioStore / physicPaintStore / projectStore (13 signal stores)        │
│  playbackEngine.ts ── audioEngine.ts (Web Audio, authoritative monitoring)              │
│  lib/physicPaintBridge.ts                                                               │
│    ├─ launch: createPhysicPaintLaunchContext (+ NEW audioPreview payload)               │
│    ├─ NEW revisioned audio-preview context emitter (subscribes audioStore)              │
│    ├─ listen branches: apply / roto-authority / script-library / state-save /           │
│    │   thumbnail-encode / physic-paint:seek-frame                                       │
│    └─ physicPaintPersistence.ts (+ NEW loop-clips member in roto_physical document)     │
└───────────────┬─────────────────────────────────────────────────────────────────────────┘
                │ Tauri events (emitTo 'efx-physic-paint') + launch URL context
                │ (existing patterns: PHYSIC_PAINT_*_EVENT constants)
┌───────────────▼──────────── EFX Paint window (label "efx-physic-paint") ────────────────┐
│  Same SPA bundle, parsed via parsePhysicsPaintLaunchContext(location)                   │
│  PhysicsPaintStudio + hooks/ controllers (signals boundary)                             │
│  ├─ NEW audio/efxPaintAudioPreviewEngine.ts (own AudioContext, read-only)               │
│  ├─ roto/physicsPaintRotoPlayScriptController.ts (+ NEW applicationMode, colorOverride) │
│  ├─ roto/physicsPaintRotoPlayScriptRenderer.ts (+ hold scheduling, recolor)             │
│  ├─ roto/physicsPaintRotoPhysicalModel.ts (+ NEW durable loopClips member)              │
│  ├─ roto/physicsPaintRotoPhysicalResolver.ts (+ loop projection/resolution)             │
│  └─ view/PhysicsPaintWorkflowStrip.tsx (+ filmstrip loop capsule)                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────── packages/efx-physic-paint ──────────────────────────────────┐
│  animation/progressiveStrokeSchedule.ts (progressive — unchanged default)               │
│  animation/recordedStrokeMotion.ts (deterministic held-pose Script Motion — reused)     │
│  NEW animation/staticStrokeSchedule.ts (hold mode: full stroke set per frame)           │
│  engine/EfxPaintEngine.ts (render host for staged frames — unchanged API)               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `app/src/stores/audioStore.ts` | Authoritative audio tracks (offset/trim/volume/mute/fades/order), persistence | **Unmodified** (read by new bridge code) |
| `app/src/lib/audioEngine.ts` | Main-window Web Audio playback singleton (`play`, `playDelayed`, `stopAll`) | **Unmodified** |
| `app/src/lib/playbackEngine.ts` | Main-editor frame→audio scheduling (`startAudioPlayback` math at lines 192–224) | **Modified** — extract pure resolver into shared module (see Pattern 1) |
| `app/src/lib/physicPaintBridge.ts` | Launch context, project-context event, all request/result listen branches, seek-frame routing | **Modified** — new audio-preview context in launch payload + revisioned update emitter |
| `app/src/types/physicPaint.ts` | Closed bridge/launch schema (`PhysicPaintLaunchContext`, authority result, etc.) | **Modified** — new `PhysicPaintAudioPreviewContext`, optional `audioPreview` on launch context, new event constants |
| `app/src/components/physic-paint/audio/efxPaintAudioPreviewEngine.ts` | NEW. Paint-window-local Web Audio preview: decode, schedule, seek, stop, monitoring toggle | **New** |
| `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` | Paint playback cursor (`playbackTick`, `start`/`stop`/`toggle`, loop/fps) | **Modified** — notify audio preview on start/stop/seek (ports-style callback, not direct import) |
| `physicsPaintRotoPlayScriptController.ts` | Play Script commit authority: `requestAuthority` → render → `commit` with `expectedRevision`, phases, cancel | **Modified** — new controller ports/options (`applicationMode`, `colorOverride`, loop params); commit path itself unchanged |
| `physicsPaintRotoPlayScriptRenderer.ts` | `renderRotoPlayScriptFrames` staging (engine host, schedule, alpha merge, PNG encode) | **Modified** — mode switch (progressive schedule vs full-set hold), application-time recolor |
| `physicsPaintRotoPhysicalModel.ts` | Canonical durable model: `PhysicPaintRotoRealKeyRecord{keyId, appFrame, payload}`, `PhysicPaintRotoPhysicalState/Document`, revision builder, fail-closed parsers | **Modified** — new `loopClips` durable member + validators + revision participation |
| `physicsPaintRotoPhysicalResolver.ts` | `resolvePhysicPaintRotoPhysicalEdit` / `projectPhysicPaintRotoPhysicalTimeline` (finalizeProposal single authority) | **Modified** — loop-clip cell projection, modulo occurrence resolution, next-clip boundary |
| `app/src/types/project.ts` + `physicPaintPersistence.ts` | `.mce` `roto_physical` document + PNG sidecars | **Modified** — schema bump for loop clips (clean break per project convention: no legacy migration) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` + `hooks/useRotoTimelineModel.ts` | Roto timeline strip cells/capsule | **Modified** — filmstrip loop capsule rendering (source cycle + hatched repetition band + ×N/∞ badge) |
| `app/vite.config.ts` + `app/src/viteBuild.test.ts` | Build config + production bundle guard test seam | **Modified** — `chunkSizeWarningLimit: 1100`, safe mixed-import fixes, extended seam assertions |
| `scripts/macos-release.sh` + `app/src-tauri/icons/` + `tauri.conf.json` | Release preflight icon contract | **Modified icons only** — preflight already validates the exact 5-entry array + ICNS magic (lines ~117–136) and packaged `CFBundleIconFile` (~306–323); no SPECS dependency |

## Recommended Project Structure (new files only)

```
app/src/
├── lib/
│   ├── audioPlaybackResolver.ts        # NEW — pure frame→per-track schedule math, shared
│   └── physicPaintBridge.ts            # MOD — audio preview launch payload + revisioned emitter
├── types/
│   ├── physicPaint.ts                  # MOD — PhysicPaintAudioPreviewContext, event constants
│   └── project.ts                      # MOD — McePhysicPaintRotoPhysicalDocument + loop_clips
└── components/physic-paint/
    ├── audio/                          # NEW folder
    │   ├── efxPaintAudioPreviewEngine.ts   # own AudioContext, per-track sources/gains
    │   ├── efxPaintAudioPreviewBridge.ts   # listen for context events, revision guard, dispose
    │   └── useEfxPaintAudioPreview.ts      # hook: monitoring toggle signal + playback wiring
    └── roto/
        ├── physicsPaintRotoLoopClip.ts     # NEW — LoopClip model, validators, modulo resolver
        └── (model/resolver/controller/renderer/strip — modified in place)

packages/efx-physic-paint/src/animation/
└── staticStrokeSchedule.ts             # NEW — hold-mode full-set schedule + tests
```

### Structure Rationale

- **`audio/` subfolder under physic-paint:** mirrors the existing `bridge/`, `roto/`, `hooks/`, `view/` decomposition and keeps the session-local engine out of shared `lib/` (it must never be imported by the main window — two engines in one JS context is the doubled-audio pitfall).
- **Loop clip as its own roto module:** matches the post-36.8 pattern of compact focused modules (`physicsPaintRotoAlphaMerge.ts`, `rotoLivePixelCacheTransactions.ts`) rather than growing the model file.
- **Pure resolver in `lib/`:** the frame→audio math must be bit-identical between main editor and paint window; a shared pure module is the only way to guarantee that without cross-window imports.

## Architectural Patterns

### Pattern 1: Shared pure frame→audio-time resolver (audio bridge correctness keystone)

**What:** Extract the scheduling math currently inline in `playbackEngine.ts` `startAudioPlayback()` (lines 192–224) into a pure function both windows use.
**When to use:** Always — the spec stop condition "Audio drifts from Paint playback" is only satisfiable if both sides compute identical offsets.
**Trade-offs:** Tiny refactor of proven code; must keep `playbackEngine` behavior bit-identical (regression-lock with existing audio tests before rewiring).

**Example:**
```typescript
// app/src/lib/audioPlaybackResolver.ts (NEW)
export interface AudioPlaybackCue {
  trackId: string;
  delaySec: number;        // 0 = start now
  sourceOffsetSec: number; // (inFrame + slipOffset + framesIntoTrack) / fps
  maxDurationSec: number;
}
export function resolveAudioCuesAtFrame(
  tracks: readonly AudioTrack[],
  frame: number,           // main-editor global frame == paint appFrame
  fps: number,
  maxFrames: number,
): AudioPlaybackCue[] { /* exact math from playbackEngine.startAudioPlayback */ }
```

**Locked mapping (answers question a):** `PhysicPaintRenderedFrame.appFrame` is documented as the *editor timeline frame* — the paint window's physical model already lives in main-editor global frames. Therefore the four-level mapping collapses: `paint appFrame == parent layer frame == main-editor global frame` (the physical model's `canonicalStart`/`layerEndExclusive` are the parent-layer bounds in global frames; sequence-local indices exist only as `frameIndex` inside rendered payloads). Audio time is `appFrame / fps` seconds; per-track source offset adds `inFrame + slipOffset`. The only remaining mapping is paint playback *range* (cursor start, loop span) → cue recomputation. A truth table (frame → per-track cue) must be written and regression-tested before implementation, per the spec risk register.

### Pattern 2: Paint-window-local Web Audio preview engine (not a shared engine)

**What:** The EFX Paint window is a separate Tauri webview (`app/src-tauri/src/lib.rs:125`, label `efx-physic-paint`) loading the same SPA bundle. JS contexts do not cross windows, so `audioEngine` cannot be reused. The paint window instantiates its own preview engine with its own `AudioContext`, fed by a **read-only context payload**.
**When to use:** For the entire audio preview feature.
**Trade-offs:** Buffers are decoded twice (once per window). Acceptable: decode cost is bounded and one-time per open session. Do NOT attempt `AudioBuffer` transport — structured-clone of decoded buffers across Tauri events is not supported; transport asset bytes (via the existing secure asset channel family, same as thumbnail encode) and decode locally with `ctx.decodeAudioData` (existing pattern in `audioEngine.decode`).

**Context payload (slots into existing launch/bridge schema):**
```typescript
// app/src/types/physicPaint.ts (MOD)
export interface PhysicPaintAudioPreviewTrack {
  id: string; assetPath: string;      // absolute path; bytes via secure transport
  offsetFrame: number; inFrame: number; outFrame: number;
  slipOffset: number; volume: number; muted: boolean;
  fadeInFrames: number; fadeOutFrames: number;
  fadeInCurve: FadeCurve; fadeOutCurve: FadeCurve;
  order: number;
}
export interface PhysicPaintAudioPreviewContext {
  revision: number;                    // monotonic, main-editor-owned
  fps: number;
  tracks: readonly PhysicPaintAudioPreviewTrack[];
}
// PhysicPaintLaunchContext gains: audioPreview?: PhysicPaintAudioPreviewContext
// New event: PHYSIC_PAINT_AUDIO_PREVIEW_CONTEXT_EVENT = 'physic-paint:audio-preview-context'
```

**Revisioned updates:** `physicPaintBridge.ts` gains an emitter that subscribes to `audioStore` mutations (and fps), bumps a monotonic revision, and `emitTo('efx-physic-paint', ...)` the fresh context — same pattern as the existing `PHYSIC_PAINT_PROJECT_CONTEXT_EVENT` emission (line ~827). The paint-side bridge applies a context only if `incoming.revision > current.revision`; stale updates are dropped, never queued. This mirrors the `expectedRevision` guard discipline already used by the Roto authority/commit path.

**Sync without drift:** on paint playback start, compute cues via Pattern 1 and schedule all sources against `AudioContext.currentTime` in one shot (`playDelayed`-style, already proven in `audioEngine`). Do not re-nudge per paint frame — the audio clock is the drift-free reference; the paint cursor chases wall-clock anyway. Seek/pause/stop = dispose all sources and recompute from the new cursor. Loop = at range end, stop all and reschedule from range start (source metadata untouched).

**Doubled-audio and cleanup (AUDIO-06):**
- Session rule: the paint preview engine asserts main-editor playback is stopped before starting (bridge-provided flag or a stop intent sent on paint play start); the main window never monitors while the paint window drives preview.
- Window close → `dispose()` (stop all sources, `ctx.close()`, drop buffers) wired into the existing Studio close path. Regression test: close during playback leaves zero running sources.
- Monitoring toggle is a session-local signal in the paint window (`useEfxPaintAudioPreview`), defaulting to on when context exists; it gates the preview engine's master gain only — never touches `audioStore`.

### Pattern 3: LoopClip as a durable member of the canonical physical model

**What:** Loop clips live in `physicsPaintRotoPhysicalModel.ts` as a new member of `PhysicPaintRotoPhysicalState`/`PhysicPaintRotoPhysicalDocument`, referencing existing real keys by `keyId` — no duplicated payloads.

**Locked semantics mapped onto the existing model:**
- Source cycle = N durable `PhysicPaintRotoRealKeyRecord`s created by one hold-mode Play Script commit (existing atomic path). They are ordinary real keys — editable, movable, undoable.
- The loop clip record: `{ clipId, startFrame, sourceKeyIds: keyId[], repeat: finite{count} | infinite, revision }`. `cycleLength = sourceKeyIds.length`. Occurrence at appFrame F resolves to `sourceKeyIds[(F - startFrame) % cycleLength]` — render output is the referenced key's existing payload `dataUrl`, so the live pixel cache and preview get reuse for free.
- Next-clip boundary: effective end = `min(startFrame + requestedDuration, nextClipStart, capacity)` with half-open intervals `[start, end)` — the same ordering discipline the resolver already applies to real keys. "Next clip" = the next durable occupant (real key or loop clip) at a later appFrame; a truth table for boundary cases (adjacent clips, partial cycle, clip moved later, clip removed, infinite → parent end) must be authored before implementation (project convention: truth table before timing patches).
- Generated interpolation cells: loop occurrences are a distinct render-source variant (`{ kind: 'loop-occurrence', clipId, occurrenceIndex, sourceKeyId, ... }` added to `PhysicPaintRotoPhysicalRenderSource`), NOT generated-interpolation cells — they must be excluded from the interpolation gap derivation (`max(0, right-left-1)` interiors) to avoid phantom cells inside a loop span.
- Revision/persistence: `loopClips` participates in `buildPhysicPaintRotoPhysicalRevision`, the fail-closed parsers (`parsePhysicPaintRotoPhysicalState`), and `McePhysicPaintRotoPhysicalDocument` (`roto_physical` in `.mce`; PNG sidecars unchanged — occurrences have no sidecars).
- Undo/redo: loop creation is a semantic delta on the existing commit path (extend `validatePhysicPaintRotoPhysicalEditSemanticDelta` in `physicsPaintRotoPhysicalResolver.ts`); repeat-count edits are metadata-only operations through `finalizeProposal` — no re-render, no source cache invalidation.

**Why not materialize occurrences as generated cells or cache frames:** the model deliberately excludes generated cells from durable serialization and cache ownership; a loop is durable user intent, so it belongs in the durable document beside real keys.

### Pattern 4: PlayScript mode/color as render-input options, commit path untouched

**What:** `applicationMode` and `colorOverride` enter exclusively through `RotoPlayScriptRenderInput` (renderer) and the controller's UI ports. `RotoPlayScriptControllerPorts.requestAuthority`/`commit`, the phase machine, `expectedRevision` guards, and undo/redo are unchanged.
**When to use:** For PLAY-01/02/04.
**Trade-offs:** The renderer branches on mode; the alternative (two controllers) would fork the commit authority — rejected.

- **Hold mode:** new package export `staticStrokeSchedule.ts` (preferred over a `mode` param on `buildProgressiveStrokeSchedule` — the progressive distribution math is regression-locked and should not grow a branch). Hold mode materializes the full flattened stroke set on every destination frame, still passing each stroke through `transformRecordedStrokeForHeldPose` with the same deterministic `destinationSourceFrame` seeding → Script Motion variation preserved, zero motion = stable hold, same input = same output.
- **Color override:** applied in the renderer at `flattenScriptStrokes` time — clone strokes, recolor paint strokes, pass erase strokes through untouched. The `RotoPaintScript` (`physicsPaintRotoScriptClipboard.ts`) and the durable library JSON (`physicsPaintRotoScriptLibrary.ts`) are never mutated (spec: no persisted overrides in script documents).
- **UI:** extend `useRotoPlayScriptController.ts` + the PlayScript dialog/strip surfaces with mode selector, override swatch, cycle/repeat/∞ controls; status copy must show requested vs effective duration and the locked French label `Boucle raccourcie par le clip suivant` (never `clip bloquant`).

## Data Flow

### Audio preview (main → paint, read-only)

```
audioStore mutation (main)                Paint playback (EFX Paint window)
        ↓                                          ↓
revisioned context builder          playbackTick / start / stop / seek
(physicPaintBridge.ts)                       ↓
        ↓ emitTo                        resolveAudioCuesAtFrame(cursor, fps)
'physic-paint:audio-preview-context'         ↓
        ↓                             efxPaintAudioPreviewEngine
revision guard (drop stale)                 ↓
        ↓                             own AudioContext: schedule all cues once
applied context signal                monitoring toggle → master gain only
```

### Hold PlayScript with Loop Clip (commit)

```
Scripts panel (mode=hold, cycle=N, repeat=R, colorOverride?)
        ↓
useRotoPlayScriptController → createRotoPlayScriptController.confirm()
        ↓ requestAuthority (unchanged)
renderRotoPlayScriptFrames(mode:'hold', colorOverride)   ← staticStrokeSchedule + recolor clone
        ↓ staged N frames (source cycle only — NOT N×R)
commit(publication, expectedRevision) → finalizeProposal (single authority)
        ↓ semantic delta: play-script-hold { sourceKeyIds[N], loopClip{repeat} }
durable document: N real keys + 1 loop clip → revision bump → undo snapshot
        ↓
projectPhysicPaintRotoPhysicalTimeline: loop occurrences projected to
min(start + N×R, nextClipStart, capacity), half-open
        ↓
WorkflowStrip filmstrip capsule: [N source cells][hatched ×R band][Cycle 5f × 5 = 25f]
```

## Anti-Patterns

### Anti-Pattern 1: Per-frame audio position correction

**What people do:** Send `seek` commands from the paint cursor to the audio engine every frame tick.
**Why it's wrong:** Event latency jitter becomes audible drift/stutter; it also fights the AudioContext clock, which is the only accurate timebase.
**Do this instead:** Schedule the whole cue set once per play/seek against `AudioContext.currentTime` (existing `playDelayed` pattern); the visual cursor is the thing that drifts, and it already chases wall-clock.

### Anti-Pattern 2: Loop occurrences as materialized frames or cache entries

**What people do:** Expand `5f × 5` into 25 staged frames at commit time "so the rest of the pipeline doesn't change."
**Why it's wrong:** Violates the locked spec (no duplicated durable assets), breaks "edit source → all occurrences update," inflates the cache/sidecar footprint, and makes repeat-count edits a re-render.
**Do this instead:** Durable loop clip + modulo resolution at projection/render time; occurrences reuse source payloads.

### Anti-Pattern 3: Importing main-window audio singletons into the paint window

**What people do:** `import { audioEngine } from '../../../lib/audioEngine'` inside the paint surface and call it directly.
**Why it's wrong:** Both windows load the same bundle but have separate JS contexts; bypassing the bridge loses the revision guard and the read-only contract, and invites doubled monitoring.
**Do this instead:** Bridge-carried context payload + paint-local engine in `components/physic-paint/audio/`; keep `lib/audioEngine.ts` main-window-only.

### Anti-Pattern 4: Mutating the progressive schedule module for hold mode

**What people do:** Add `if (mode === 'hold')` branches inside `buildProgressiveStrokeSchedule`/`getProgressiveFrameStrokes`.
**Why it's wrong:** That module is regression-locked progressive behavior (package-level tests); branching it risks the spec stop condition "Progressive PlayScript output changes unexpectedly."
**Do this instead:** Separate `staticStrokeSchedule.ts` with its own tests; add an equivalence test asserting default progressive output is unchanged.

### Anti-Pattern 5: Timing-hack hydration or warning-filter build hygiene

**What people do:** `setTimeout`/polling to fix Scripts hydration; warning filters or fake lazy imports to satisfy Vite's 500 kB default.
**Why it's wrong:** Both are explicitly forbidden by the locked spec; they mask races and invite silent bundle growth.
**Do this instead:** Consume the exact authoritative project-context event (existing `PHYSIC_PAINT_PROJECT_CONTEXT_EVENT` flow); set `chunkSizeWarningLimit: 1100` with documented desktop rationale and correct only proven-ineffective mixed imports, preserving Tauri/browser runtime guards and cycle-breaking dynamic imports involving stores/bridge modules.

## Integration Points (new vs modified, explicit)

### Internal Boundaries

| Boundary | Communication | New/Modified | Notes |
|----------|---------------|--------------|-------|
| main `audioStore` → paint window | Tauri event `physic-paint:audio-preview-context` (revisioned) + launch payload | **New** | Follows `PHYSIC_PAINT_PROJECT_CONTEXT_EVENT` emission pattern (physicPaintBridge.ts ~827) |
| paint playback → audio preview | ports-style callbacks on `useRotoCachedPlayback` (start/stop/seek/loop) | **Modified** | No direct store imports in the hook; keep the 38.1 signals-boundary discipline |
| paint window close → preview engine | Studio close path → `dispose()` | **New** | Cleanup test: no leaked AudioContext, no playing sources |
| Scripts UI → PlayScript controller | extended ports (`applicationMode`, `colorOverride`, loop params) | **Modified** | Controller/commit authority unchanged |
| renderer → package animation | `staticStrokeSchedule.ts` export via `@efxlab/efx-physic-paint/animation` alias | **New** | Alias already exists in `app/vite.config.ts` resolve.alias |
| loop clips → physical document | new durable member + parsers + revision | **Modified** | `.mce` schema bump; clean break (no legacy migration per project convention) |
| loop clips → timeline strip | `projectPhysicPaintRotoPhysicalTimeline` cell projection → `useRotoTimelineModel` → `PhysicsPaintWorkflowStrip` capsule | **Modified** | Filmstrip rendering is view-only; resolution stays in the resolver |
| release preflight → icons | existing inline node validation in `scripts/macos-release.sh` | **Unmodified** | Regenerate `app/src-tauri/icons/*` via `pnpm tauri icon SPECS/efxmotioneditor-icon-2.png`; preflight already independent of SPECS |
| build seam → chunk budget | `app/src/viteBuild.test.ts` extended to assert resolved `chunkSizeWarningLimit === 1100` | **Modified** | Export a resolved-config helper from `vite.config.ts`; no hash/count-dependent assertions |

## Suggested Build Order (answers question d)

```
Phase 0  Scripts auto-hydration quick fix        [blocking; touches bridge context flow]
Phase 1  Icon regeneration + build hygiene       [independent of all feature code]
Phase 2  Audio preview bridge                    [needs only Patterns 1+2; independent of PlayScript]
Phase 3  PlayScript controls (mode + color)      [renderer/controller; no model change yet]
Phase 4  Hold renderer + LoopClip model          [deepest change; needs Phase 3's hold mode]
Phase 5  Integrated UAT + signed release         [all gates green]
```

**Ordering rationale:**
- **0 before everything:** locked by spec; also de-risks the bridge project-context event path that Phase 2's audio context emitter imitates.
- **1 early and parallel-safe:** touches only `app/src-tauri/icons/`, `vite.config.ts`, `viteBuild.test.ts` — zero overlap with feature code; gets release-blocking surfaces validated while features proceed.
- **2 before 3/4:** audio is self-contained (bridge + new engine + one shared pure module); landing it before the Roto model churn keeps UAT surfaces separable and matches the milestone schedule (08-07→08-12 audio, 08-13→08-17 controls, 08-18→08-23 hold/loop).
- **3 before 4:** hold-mode rendering and color override are renderer-level and testable against real-key commits alone; LoopClip persistence/resolution (4) then builds on proven hold output instead of landing both halves of static/hold at once.
- **Hard dependency:** Phase 4's filmstrip capsule needs the resolver projection from the same phase — do not split capsule UI into Phase 3.

## Scaling Considerations

Not user-count scaling (single-user desktop); the real constraints are frame counts and asset weight:

| Concern | Current behavior | v0.9.0 impact | Mitigation |
|---------|------------------|---------------|------------|
| Roto cache footprint | PNG sidecars per real key; compression deferred from v0.8.0 | Loop clips add zero sidecars — this is the spec's point | Keep occurrences payload-free; revisit compression separately |
| Audio decode cost in paint window | n/a | One decode per track per session | Decode lazily on first play, not at launch; non-blocking warning on missing assets |
| Hold commit size | Progressive commits bounded by `PHYSIC_PAINT_MAX_APPLY_FRAMES = 600` | Hold cycle bounded by cycle length, NOT requested duration | Enforce cycle-length capacity check at authority time; repeats are free |
| Bundle size | entry chunk near warning threshold | 1100 budget documented | Fixed budget + review before raising; production bundle guard remains the correctness gate |

## Sources

All findings from direct repository inspection (HIGH confidence):

- `app/src/lib/physicPaintBridge.ts` — event constants, launch context construction (line 1087), project-context emission (~827), seek-frame listen branch (~966), request/result listener patterns
- `app/src/types/physicPaint.ts` — `PhysicPaintLaunchContext`, `PhysicPaintRotoAuthorityResult` (`canonicalStart`, `layerEndExclusive`, `physicalRevision`), `PhysicPaintRenderedFrame.appFrame` documented as editor timeline frame, `PHYSIC_PAINT_MAX_APPLY_FRAMES = 600`
- `app/src/lib/audioEngine.ts` — Web Audio one-shot source pattern, `decode`, `play`/`playDelayed` fade scheduling
- `app/src/lib/playbackEngine.ts` lines 192–224 — the frame→audio cue math to extract
- `app/src/stores/audioStore.ts`, `app/src/types/audio.ts` — `AudioTrack` authoritative field set (offsetFrame/inFrame/outFrame/slipOffset/volume/muted/fades/order)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — canonical keyId/appFrame records, `PhysicPaintRotoPhysicalState/Document` (the loop-clip host), revision builder, fail-closed parsers
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — commit ports, phase machine, `expectedRevision` publication
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — `RotoPlayScriptRenderInput`, engine staging, `flattenScriptStrokes` (recolor seam)
- `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts`, `recordedStrokeMotion.ts` — progressive schedule + deterministic `transformRecordedStrokeForHeldPose`
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — paint playback surface (`playbackTick`, start/stop/loop/fps)
- `app/src/lib/physicPaintPersistence.ts` + `app/src/types/project.ts` — `roto_physical` MCE document + sidecar validation
- `app/src-tauri/src/lib.rs:125` — paint window creation; `app/src-tauri/tauri.conf.json` — exact 5-entry `bundle.icon` array
- `scripts/macos-release.sh` — preflight icon validation (~117–136: exact array, non-empty, ICNS magic) and packaged-app checks (~306–323: `CFBundleIconFile`, bundled ICNS)
- `app/vite.config.ts` — build config, production bundle guard, `@efxlab/efx-physic-paint/animation` alias; `app/src/viteBuild.test.ts` — the production-build test seam
- `SPECS/milestone-v0.9.0-plan.md` — locked ownership boundaries, stop conditions, delivery schedule

---
*Architecture research for: EFX Motion Editor v0.9.0 — PlayScript workflow, EFX Paint audio preview, macOS identity*
*Researched: 2026-08-03*
