# Phase 52: Shared Mask Compositor and Reveal - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 13 (9 modified + 4 new test files)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/efx-paint/document/efxPaintDocument.ts` | model | CRUD (schema) | itself (`FrameLoopClip`, `PhotoReferenceTrack`) | exact (extend in place) |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | parser | transform (fail-closed) | itself (`parseFrameLoopClip`, `parsePhotoReferenceTrack`) | exact (extend in place) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` | service | batch (per-frame render) | itself (`renderRotoPlayScriptFrames`) | exact (sibling fn) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | model | CRUD (schema) | itself (`PhysicPaintRotoLoopClip`, `PhysicPaintRotoRealKeyRecord`) | exact (extend in place) |
| `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` | component | request-response (UI) | itself (modal action buttons) | exact (extend in place) |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | component | request-response (UI) | itself (Loop Clip rail target) | exact (variant) |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | utility | transform (projection) | itself (`projectPhysicsPaintLoopClipPresentation`) | exact (extend) |
| `app/src/stores/efxPaintStore.ts` | store | CRUD (mutation + undo) | itself (`setPhotoReferenceSource`, `BackgroundEditDescriptor`) | exact (extend in place) |
| `app/src/stores/physicPaintStore.ts` | store | CRUD (commit + resolve) | itself (`_resolveReferenceSourceImage`, `getFlattenedFrame`) | exact (extend in place) |
| `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | test | batch | `physicsPaintRotoPlayScriptRenderer` tests | role-match |
| `app/src/stores/efxPaintStore.reveal.test.ts` | test | CRUD | existing `efxPaintStore` tests | role-match |
| `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | test | transform | existing parser tests | role-match |
| `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | test | transform | existing compositor tests | role-match |

---

## Pattern Assignments

### `app/src/efx-paint/document/efxPaintDocument.ts` (model, CRUD schema)

**Analog:** itself — `FrameLoopClip` (lines 51-64) and `PhotoReferenceTrack` (lines 126-135). The reveal rail is a `FrameLoopClip`-shaped record (new `sourceKind`/variant) OR a sibling record; the `mode` field on `PhotoReferenceTrack` is REMOVED (D-15).

**Core pattern — `FrameLoopClip` (the reveal rail's shape anchor, lines 51-64):**
```typescript
export interface FrameLoopClip {
  readonly id: string;
  readonly startFrame: number;
  readonly sourceFrameRefs: readonly string[];
  readonly repeat: FrameLoopClipRepeat;
  readonly sourceKind: 'playscript-hold' | 'imported-background';
  readonly revision: number;
  readonly scale?: FrameLoopClipScale;
}
```

**Core pattern — `PhotoReferenceMode` to REMOVE (lines 97-103, D-15 clean break):**
```typescript
export type PhotoReferenceMode = 'reference-only' | 'reveal-source' | 'masked-transform-source';
```
Remove this union and the `mode: PhotoReferenceMode` field on `PhotoReferenceTrack` (line 129). No vestigial state.

**Factory pattern — deep-freeze + fresh UUID (lines 149-189):**
```typescript
function createDefaultPaintTrack(id: string): InternalPaintTrack {
  return Object.freeze({ id, name: 'Track 1', order: 0, visible: true, solo: false,
    opacity: 1, blendMode: 'normal' as const, revision: 0,
    frames: Object.freeze({}), rotoPhysical: null, loopClips: Object.freeze([]) });
}
```
All output is `Object.freeze`d; IDs are `crypto.randomUUID()` per call. The reveal rail record must follow the same freeze discipline.

---

### `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (parser, transform fail-closed)

**Analog:** itself — `parseFrameLoopClip` (lines 114-180) and `parsePhotoReferenceTrack` (lines 343-381). The reveal rail parse mirrors `parseFrameLoopClip`; the `mode` field is dropped from `parsePhotoReferenceTrack`.

**Core pattern — fail-closed allowlist (lines 33-53, 62-70):**
```typescript
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}
const LOOP_CLIP_KEYS = new Set(['id', 'startFrame', 'sourceFrameRefs', 'repeat', 'sourceKind', 'revision', 'scale']);
const PHOTO_REFERENCE_KEYS = new Set(['id', 'sourceFrameRefs', 'mode', 'revision', 'visibleInStudio', 'opacity', 'transform', 'transformLocked']);
const PHOTO_REFERENCE_MODES = new Set(['reference-only', 'reveal-source', 'masked-transform-source']);
```

**Core pattern — `sourceKind` allowlist (lines 150-152):**
```typescript
if (value.sourceKind !== 'playscript-hold' && value.sourceKind !== 'imported-background') {
  throw new Error('FrameLoopClip: sourceKind must be playscript-hold or imported-background.');
}
```
The reveal rail adds a new `sourceKind` (or a new record) to this allowlist. The parser NEVER allocates IDs and NEVER normalizes malformed input — unknown members throw.

**D-15 change — remove `mode` from `parsePhotoReferenceTrack` (lines 356-358, 374):**
```typescript
if (typeof value.mode !== 'string' || !PHOTO_REFERENCE_MODES.has(value.mode)) {
  throw new Error('PhotoReferenceTrack: mode must be reference-only, reveal-source, or masked-transform-source.');
}
// ... and the returned Object.freeze({ ... mode: value.mode as PhotoReferenceMode, ... })
```
Delete the `mode` key from `PHOTO_REFERENCE_KEYS`, the `PHOTO_REFERENCE_MODES` set, the validation, and the returned field. Clean break (Phase 45 no-compat).

---

### `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` (service, batch per-frame render)

**Analog:** itself — `renderRotoPlayScriptFrames` (lines 33-109). The reveal bake is a NEW sibling function that reuses the coverage-alpha path but replaces `mergeRotoAlphaCanvases` with a `destination-in` reference mask.

**Imports pattern (lines 1-6):**
```typescript
import { EfxPaintEngine, type PaintStroke } from '@efxlab/efx-physic-paint';
import { buildProgressiveStrokeSchedule, buildStaticStrokeSchedule, getProgressiveFrameStrokes, getStaticFrameStrokes, transformRecordedStrokeForHeldPose } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { mergeRotoAlphaCanvases } from './physicsPaintRotoAlphaMerge';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';
```

**Core pattern — the coverage loop the bake consumes (lines 54-97):**
```typescript
const strokes = flattenScriptStrokes(input.script);
const mode = input.mode ?? 'progressive';
const schedule = mode === 'static'
  ? buildStaticStrokeSchedule(strokes, input.frameCount)
  : buildProgressiveStrokeSchedule(strokes, input.frameCount);

for (let frameIndex = 0; frameIndex < input.frameCount; frameIndex += 1) {
  throwIfAborted(input.signal);
  const destination = input.canonicalStart + frameIndex;
  // ... transformFrameStroke (motion transform + overrideColor) ...
  const frameStrokes = mode === 'static'
    ? getStaticFrameStrokes(schedule, frameIndex, transformFrameStroke)
    : getProgressiveFrameStrokes(schedule, frameIndex, transformFrameStroke);
  let scriptAlpha: HTMLCanvasElement | null = null;
  let merged: HTMLCanvasElement | null = null;
  try {
    scriptAlpha = engine.renderProgressiveAlphaFrame(frameStrokes);   // coverage alpha
    throwIfAborted(input.signal);
    merged = await mergeRotoAlphaCanvases(input.existingFrames.get(destination) ?? null, scriptAlpha, input.size);
    throwIfAborted(input.signal);
    const encoded = await encodeRotoFrameFromCanvas(merged, destination, input.size);
    throwIfAborted(input.signal);
    staged.push({ ...encoded, frameIndex, appFrame: destination, source: 'real-key' });
    input.onProgress?.(frameIndex + 1, input.frameCount);
  } finally {
    if (scriptAlpha) releaseCanvas(scriptAlpha);
    if (merged) releaseCanvas(merged);
  }
  await yieldToBrowser(input.signal);
}
```

**NEW reveal step (replaces `mergeRotoAlphaCanvases` at line 86):** draw the reference image (as placed, full opacity — D-18) then apply the coverage alpha as a `destination-in` mask:
```typescript
// ctx.drawImage(referenceImage, /* as-placed transform, full opacity */);
// ctx.globalCompositeOperation = 'destination-in';
// ctx.drawImage(scriptAlpha, 0, 0);
// → reference pixels where coverage is, transparent elsewhere (D-17)
```

**Error/abort handling (lines 100-108, 138-154):**
```typescript
} catch (error) {
  staged.length = 0;
  throw error;
} finally {
  engine.setInputLocked(false);
  engine.setAnimationMode(false);
  engine.destroy();
  host.replaceChildren();
}
// ...
function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Play Script generation cancelled.', 'AbortError');
}
```

**Validation pattern (lines 124-136):** `validateRenderInput` throws `RangeError` on bad frameCount/canonicalStart/size and enforces `MAX_AGGREGATE_RGBA_BYTES`. The reveal bake reuses this shape.

---

### `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (model, CRUD schema)

**Analog:** itself — `PhysicPaintRotoLoopClip` (lines 273-289) and `PhysicPaintRotoRealKeyRecord` (lines 102-105). The reveal rail is a `PhysicPaintRotoLoopClip`-shaped record (already carries `mode`, `scriptId`, `motion`, `overrideColor`, lifecycle); baked keys are `PhysicPaintRotoRealKeyRecord`s.

**Core pattern — `PhysicPaintRotoLoopClip` (lines 273-289):**
```typescript
export interface PhysicPaintRotoLoopClip {
  readonly loopId: string;
  readonly placementStart: number;
  readonly sourceKeyIds: readonly string[];
  readonly repeat: number | 'infinity';
  readonly mode: 'progressive' | 'static';
  readonly scriptId?: string;
  readonly motion?: PhysicPaintRotoScriptMotionSettings;
  readonly overrideColor?: string | null;
  readonly syncState?: 'synchronized' | 'modified';
  readonly provenanceState?: 'attached' | 'detached';
  readonly phaseOrigin?: number;
  readonly originalEndExclusive?: number;
  readonly visibleRanges?: readonly PhysicPaintRotoGroupVisibleRange[];
  readonly frameOverrides?: readonly PhysicPaintRotoGroupFrameOverride[];
}
```

**Core pattern — `PhysicPaintRotoRealKeyRecord` (lines 102-105):**
```typescript
export interface PhysicPaintRotoRealKeyRecord extends PhysicPaintRotoKeyIdentity {
  readonly kind: 'real-key';
  readonly payload: PhysicPaintRotoRealKeyPayload;
}
```

**Guard pattern — `isPhysicPaintRotoLoopClip` (lines 621-641):**
```typescript
export function isPhysicPaintRotoLoopClip(value: unknown): value is PhysicPaintRotoLoopClip {
  // ...
  const hasProvenance = value.scriptId !== undefined || value.motion !== undefined || value.overrideColor !== undefined;
  if (hasProvenance) {
    if (!isBoundedKeyId(value.scriptId)) return false;
    // ...
    if (value.overrideColor !== null
      && !(typeof value.overrideColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.overrideColor))) return false;
  }
  // ...
}
```
The reveal rail's `mode` (`progressive`/`static`) maps directly onto the existing `mode` field; the variant is fixed at creation (D-21). The `overrideColor` mechanism (D-22) is already here.

---

### `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` (component, request-response UI)

**Analog:** itself — the modal action buttons (lines 269-285). The "Reveal with script…" entry is a new action button in the same actions row.

**Imports pattern (lines 1-10):**
```typescript
import { useEffect, useRef } from 'preact/hooks';
import { Camera, Eye, EyeOff, Image, ImageUp, Lock, LockOpen, Trash2, X } from 'lucide-preact';
import {
  usePhysicsPaintPhotoReferenceController,
  PHOTO_REFERENCE_MODE_HINT,
  PHOTO_REFERENCE_EMPTY_SOURCE,
  PHOTO_REFERENCE_UNLOCKED_TOOLTIP,
  PHOTO_REFERENCE_MODE_OPTIONS,
  type PhysicsPaintPhotoReferencePorts,
} from './physicsPaintPhotoReferenceController';
```

**Core pattern — action button row (lines 269-285):**
```typescript
<div class="physics-paint-photo-reference-actions">
  <button type="button" class="physics-paint-photo-reference-import" onClick={onImportSource}>
    <ImageUp size={13} aria-hidden="true" />
    <span>{hasSource ? 'Replace source' : 'Import'}</span>
  </button>
  {hasSource ? (
    <button type="button" class="physics-paint-photo-reference-remove"
      aria-label="Remove photo reference" title="Remove photo reference" onClick={removeReference}>
      <Trash2 size={13} aria-hidden="true" />
    </button>
  ) : null}
</div>
```
The "Reveal with script…" button is added here, gated on `hasSource` (D-12 creation guard: a reveal rail cannot be created without a placed reference). The component is a thin render shell — the state machine lives in `usePhysicsPaintPhotoReferenceController` (signals-only, no useState).

**Reactivity contract (lines 34-37):** signals-only state, no `useState`, no render-body signal writes. The reveal entry must follow the same controller/ports split.

---

### `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` (component, request-response UI)

**Analog:** itself — `PhysicsPaintLoopClipRailTarget` (lines 158-380). The reveal rail is a variant of the Loop Clip rail target, inheriting `overrideColor` (D-22), the lifecycle dot (D-23), and the Regenerate control (D-24).

**Core pattern — rail target class + lifecycle dot (lines 310-345):**
```typescript
<button
  type="button"
  class={`physics-paint-rail-target physics-paint-loop-clip-rail-target mode-${presentation.mode}${props.selected ? ' selected' : ''}${props.actionLinked ? ' action-linked' : ''}${props.showStartBoundary ? ' boundary-start boundary-cell-start' : ''}${props.showEndBoundary ? ' boundary-end boundary-cell-end' : ''}${range.truncated ? ' truncated' : ''}${range.unresolved ? ' unresolved' : ''}`}
  aria-label={presentation.accessibleName}
  aria-pressed={props.selected}
  data-rail-first-frame={range.placementStart}
  onPointerDown={...}
  onClick={handleClick}
  onKeyDown={handleKeyDown}
  onFocus={...}
  onBlur={tooltip.onBlur}
>
  <span class="physics-paint-rail-segment physics-paint-loop-clip-rail-segment" aria-hidden="true" />
  {props.isSetAnchor ? <span class="physics-paint-rail-anchor-tick" aria-hidden="true" /> : null}
  {presentation.synchronizationDot ? (
    <span class={`physics-paint-loop-clip-lifecycle-dot ${presentation.synchronizationDot}`} aria-hidden="true" />
  ) : null}
</button>
```

**Core pattern — tooltip lines (lines 360-377):**
```typescript
<PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom" anchorRef={anchorRef} topmost>
  <span class="physics-paint-loop-clip-tooltip-copy">
    {tooltipLines.map((line, index) => {
      if (index === 0) return <strong key={line}>{line}</strong>;
      if (line.startsWith('Status:')) {
        return (
          <span key={`${index}:${line}`} class="physics-paint-loop-clip-tooltip-status">
            {presentation.synchronizationDot ? (
              <span class={`physics-paint-loop-clip-tooltip-status-dot ${presentation.synchronizationDot}`} aria-hidden="true" />
            ) : null}
            {line}
          </span>
        );
      }
      return <span key={`${index}:${line}`}>{line}</span>;
    })}
  </span>
</PhysicsPaintStyledTooltip>
```
The reveal rail's freshness line (D-23) is appended to `presentation.tooltipLines` — the same `tooltipLines` array, no new rendering path. The `mode-${presentation.mode}` class already distinguishes Motion/Static; the reveal variant adds emerald/teal via `overrideColor` (D-22).

---

### `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` (utility, transform projection)

**Analog:** itself — `projectPhysicsPaintLoopClipPresentation` (lines 72-162). The reveal rail adds a freshness tooltip line and reuses the lifecycle/status/regenerate machinery.

**Core pattern — tooltipLines assembly (lines 124-133):**
```typescript
const tooltipLines = [
  displayName,
  `Type: ${modeLabel}`,
  cycleLabel,
  `Effective ${effectiveDuration}f`,
  `Status: ${statusLabel}`,
  ...(shortenedLabel ? [shortenedLabel] : []),
  ...(interruptionTooltipLine ? [interruptionTooltipLine] : []),
  ...(fragmentLabel ? [fragmentLabel] : []),
];
```

**Core pattern — lifecycle + regenerate reason (lines 225-257):**
```typescript
function resolveGroupLifecycle(range, clip): PhysicsPaintGroupLifecycle {
  if (range.unresolved) return 'unresolved';
  if (clip?.provenanceState === 'detached') return 'detached';
  if (!clip?.scriptId) return 'unavailable';
  return clip?.syncState === 'modified' ? 'modified' : 'synchronized';
}
function regenerateDisabledReasonFor(lifecycle: PhysicsPaintGroupLifecycle): string | null {
  switch (lifecycle) {
    case 'modified': return null;
    case 'synchronized': return 'Already synchronized with Action.';
    case 'detached': return 'Regenerate unavailable — Action detached.';
    case 'unavailable': return 'Regenerate unavailable — Source Action unavailable.';
    case 'unresolved': return 'Source missing';
  }
}
```
The reveal rail's freshness line (D-23: "baked from current script & reference" vs "stale — script or reference changed since bake, Replay to refresh") is a new tooltip line appended after `Status:`. The `regenerateDisabledReason` (D-24) is reused verbatim for the Replay control's disabled reason.

---

### `app/src/stores/efxPaintStore.ts` (store, CRUD mutation + undo)

**Analog:** itself — `BackgroundEditDescriptor` (lines 568-573), `setPhotoReferenceSource` (lines 1115-1173), `setPhotoReferenceMode` (lines 1181-1207). The reveal create/replay/delete/span mutations follow the same by-reference ledger pattern.

**Core pattern — `BackgroundEditDescriptor` (lines 549-573):**
```typescript
export type BackgroundEditOperationKind =
  | 'add-background-clip'
  | 'move-background-clip'
  | 'set-background-clip-repeat'
  | 'set-background-clip-scale'
  | 'resize-background-clip'
  | 'set-background-clip-source'
  | 'delete-background-clip'
  | 'set-background-fallback'
  | 'set-photo-reference-source'
  | 'set-photo-reference-mode'
  | 'clear-photo-reference';

export interface BackgroundEditDescriptor {
  readonly operationId: string;
  readonly operationKind: BackgroundEditOperationKind;
  readonly before: EfxPaintDocument;
  readonly after: EfxPaintDocument;
}
```
Add new `'reveal-*'` operation kinds (create/replay/delete/span-shrink). `before`/`after` are exact document objects by reference — undo restores `before`, redo re-applies `after` (RVL-06).

**Core pattern — mutation setter body (lines 1115-1173):**
```typescript
export function setPhotoReferenceSource(layerId, sourceFrameRefs): PhotoReferenceMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  if (!_isValidSourceRefs(sourceFrameRefs)) return { ok: false, reason: 'invalid-source-refs' };
  // ... build immutable next document, bump documentRevision ...
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'set-photo-reference-source',
      before: document,
      after: next,
    },
  };
}
```
The reveal mutations follow this exact shape: fail-closed on absent document/reference/script, immutable `next` document, `documentRevision` bump, `_documents.set`, `_notifyChange()`, and a `descriptor` with `before`/`after` by reference. No-op writes return `descriptor: null`.

**Fail-closed guard pattern (D-12/D-13):** Replay preflight checks `document.photoReference !== null` (reference present) and the script library row exists; on failure return `{ ok: false, reason: ... }` with NO key write and NO document mutation.

---

### `app/src/stores/physicPaintStore.ts` (store, CRUD commit + resolve)

**Analog:** itself — `_resolveReferenceSourceImage` (lines 1224-1232), `getReferenceSourceFrameVerdict` (lines 1947-1951), `getFlattenedFrame` (line 1892). The reveal bake reads the reference via `_resolveReferenceSourceImage` and commits baked keys through the existing physical-edit transaction.

**Core pattern — frame-aligned reference resolution (lines 1210-1232):**
```typescript
export interface ReferenceSourceFrameVerdict {
  readonly ref: string;
  readonly dataUrl: string;
  readonly clamped: boolean;
}

function _resolveReferenceSourceImage(document: EfxPaintDocument, frame: number): ReferenceSourceFrameVerdict | null {
  const track = document.photoReference;
  if (track === null || track.sourceFrameRefs.length === 0) return null;
  const index = Math.min(frame, track.sourceFrameRefs.length - 1);
  const ref = track.sourceFrameRefs[index];
  const dataUrl = _referenceSourceImages.get(ref);
  if (dataUrl === undefined) return null;
  return { ref, dataUrl, clamped: index !== frame };
}
```
The bake reads this verdict (frame N → source frame N, clamped at sequence end, null on missing → fail-closed) as its source input — NEVER the composited preview (Pitfall 2).

**Core pattern — public verdict accessor (lines 1947-1951):**
```typescript
getReferenceSourceFrameVerdict(layerId: string, frame: number): ReferenceSourceFrameVerdict | null {
  const efxDocument = getEfxPaintDocument(layerId);
  if (!efxDocument) return null;
  return _resolveReferenceSourceImage(efxDocument, frame);
},
```

**Compositor seam (D-02):** baked keys flow through the unchanged `getFlattenedFrame` (line 1892) → `efxPaintCompositor.ts` as ordinary track content. No new compositor path.

---

## Shared Patterns

### Undo-by-reference ledger
**Source:** `app/src/stores/efxPaintStore.ts:568-573` (`BackgroundEditDescriptor`)
**Apply to:** All reveal mutations (create/replay/delete/span-shrink) in `efxPaintStore.ts` and `physicPaintStore.ts`.
```typescript
export interface BackgroundEditDescriptor {
  readonly operationId: string;
  readonly operationKind: BackgroundEditOperationKind; // + new 'reveal-*' kinds
  readonly before: EfxPaintDocument;
  readonly after: EfxPaintDocument;
}
```
`before`/`after` are exact document objects by reference — never raster-byte snapshots (RVL-06).

### Fail-closed guards (D-12/D-13)
**Source:** `app/src/stores/efxPaintStore.ts:1115-1173` (setter fail-closed shape) + `app/src/stores/physicPaintStore.ts:1224-1232` (null-on-missing resolution)
**Apply to:** Reveal Replay preflight (no placed reference → fail closed; deleted script → fail closed). Status capsule red warning via `setApplyStatus('error')` (see `PhysicsPaintWorkflowStrip.tsx:2182`); existing baked keys untouched; no silent re-bake.

### Fail-closed parser allowlist
**Source:** `app/src/efx-paint/document/efxPaintDocumentParsers.ts:33-70`
**Apply to:** The reveal rail parse (new `sourceKind`/record) and the `mode`-field removal (D-15). Unknown members throw; no ID allocation; no normalization.

### Straight-alpha boundary (Pitfall 1)
**Source:** `app/src/efx-paint/compositor/efxPaintCompositor.ts:31-35` (D-02 straight/unmultiplied alpha) + `encodeRotoFrameFromCanvas` (`rotoCanvasFrames.ts:123`)
**Apply to:** The reveal bake's `destination-in` mask step — encode baked keys as straight-alpha PNGs via the existing `encodeRotoFrameFromCanvas`; verify the mask does not premultiply.

### Reference "as placed" transform (D-14)
**Source:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts:20-51` (`getReferenceBounds`) + `PhysicsPaintReferenceGhost.ts:58-86` (`drawReferenceGhost`)
**Apply to:** The reveal bake draws the reference at FULL opacity (D-18) with the same transform (position/scale/rotation), never the guide opacity.

### Coverage-alpha path (D-09/D-11)
**Source:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:54-97`
**Apply to:** The reveal bake consumes `buildProgressiveStrokeSchedule`/`buildStaticStrokeSchedule` → `getProgressiveFrameStrokes`/`getStaticFrameStrokes` → `engine.renderProgressiveAlphaFrame` verbatim; only the merge step changes.

---

## No Analog Found

None — every file has an exact in-place analog (this phase is a code-only extension of existing machinery; the only genuinely new code is the `destination-in` reference-mask composite, which is a sibling of the existing `mergeRotoAlphaCanvases`).

## Metadata

**Analog search scope:** `app/src/efx-paint/document/`, `app/src/efx-paint/compositor/`, `app/src/components/physic-paint/roto/`, `app/src/components/physic-paint/view/`, `app/src/stores/`
**Files scanned:** 15 (all git-tracked, verified via `git ls-files`)
**Pattern extraction date:** 2026-09-02
