# Phase 50: Photo/Reference Track - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 10 (8 modified, 2 new)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/efx-paint/document/efxPaintDocument.ts` | model | transform (pure schema) | `FrameLoopClip` / `BackgroundTrack` in same file | exact |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | model/parser | transform (fail-closed) | `parseBackgroundTrack` in same file | exact |
| `app/src/efx-paint/document/efxPaintDocumentRevision.ts` | utility | transform (canonical hash) | `encodeCanonicalLoopClips` in same file | exact |
| `app/src/stores/physicPaintStore.ts` | store | request-response (registry/resolution) | `_backgroundSourceImages` + `_backgroundSourceRevision` in same file | exact |
| `app/src/stores/efxPaintStore.ts` | store | CRUD (mutations + display prefs) | `_setTrackDisplayProperty` + `serializeRuntimeIntoDocument` in same file | exact |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | component | request-response (UI) | `PhysicsPaintTrackRowHeader` Bg branch in same file | exact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | component | request-response (UI) | Bg row mount + picker swap in same file | role-match |
| `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.tsx` | component | request-response (UI) | `PhysicsPaintBackgroundClipSection.tsx` | exact |
| `app/src/efx-paint/document/efxPaintDocumentParsers.test.ts` | test | transform | `efxPaintDocument.test.ts` | exact |
| `app/src/stores/efxPaintStore.photoReference.test.ts` | test | CRUD | `efxPaintStore.test.ts` | exact |

---

## Pattern Assignments

### `app/src/efx-paint/document/efxPaintDocument.ts` (model, transform)

**Analog:** `FrameLoopClip` + `BackgroundTrack` interfaces in the same file.

**Model interface pattern** (lines 50-95) — the `PhotoReferenceTrack` should mirror the frozen readonly-record shape with a `revision` counter and a `sourceFrameRefs`-style source identity:
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

export interface BackgroundTrack {
  readonly id: string;
  readonly clips: readonly FrameLoopClip[];
  readonly fallback: BackgroundFallback;
  readonly visible: boolean;
  readonly revision: number;
}
```

**Document field to replace** (line 105) — `photoReference: null` becomes `photoReference: PhotoReferenceTrack | null`:
```typescript
export interface EfxPaintDocument {
  readonly version: number;
  readonly parentLayerId: string;
  readonly documentRevision: number;
  readonly activeTrackId: string;
  readonly tracks: readonly InternalPaintTrack[];
  readonly background: BackgroundTrack;
  readonly photoReference: null;   // -> PhotoReferenceTrack | null
  readonly compositeRevision: number;
}
```

**Factory pattern** (lines 131-149) — `createEfxPaintDocument` deep-freezes every nested record and assigns fresh UUIDs; the new track factory must follow `Object.freeze` + `crypto.randomUUID()`:
```typescript
export function createEfxPaintDocument(parentLayerId: string): EfxPaintDocument {
  const defaultTrackId = crypto.randomUUID();
  return Object.freeze({
    version: EFX_PAINT_DOCUMENT_VERSION,
    parentLayerId,
    documentRevision: 0,
    activeTrackId: defaultTrackId,
    tracks: Object.freeze([createDefaultPaintTrack(defaultTrackId)]),
    background: Object.freeze({ id: crypto.randomUUID(), clips: Object.freeze([]), fallback: Object.freeze({ mode: 'transparent' as const }), visible: true, revision: 0 }),
    photoReference: null,
    compositeRevision: 0,
  });
}
```

**Key model decision (Claude's Discretion, RESEARCH Open Question 1):** the source identity is a `readonly string[]` of library asset IDs in natural-filename-sort order (mirroring `FrameLoopClip.sourceFrameRefs`), NOT a richer object. The display-preference fields (`visibleInStudio`, opacity, transform, lock) live on the track alongside `visibleInStudio` (RESEARCH Assumption A3) so save/reopen persistence is automatic.

---

### `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (model/parser, transform)

**Analog:** `parseBackgroundTrack` + `parseFrameLoopClip` in the same file.

**Guard primitives** (lines 30-64) — reuse these verbatim; add a `PHOTO_REFERENCE_KEYS` set and a `PHOTO_MODES` set:
```typescript
function isPlainRecord(value: unknown): value is Record<string, unknown> { ... }
function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean { ... }
function isNonEmptyString(value: unknown): value is string { ... }
function isNonNegativeInteger(value: unknown): value is number { ... }
const LOOP_CLIP_KEYS = new Set(['id', 'startFrame', 'sourceFrameRefs', 'repeat', 'sourceKind', 'revision', 'scale']);
```

**Fail-closed record parse pattern** (lines 274-300) — `parsePhotoReferenceTrack` should mirror `parseBackgroundTrack` exactly (hasOnlyKeys → per-field validation → `Object.freeze`):
```typescript
function parseBackgroundTrack(value: unknown): BackgroundTrack {
  if (!isPlainRecord(value)) throw new Error('BackgroundTrack: expected a record.');
  if (!hasOnlyKeys(value, BACKGROUND_KEYS)) throw new Error('BackgroundTrack: unknown members; ...');
  if (!isNonEmptyString(value.id)) throw new Error('BackgroundTrack: id must be a non-empty string.');
  if (!Array.isArray(value.clips)) throw new Error('BackgroundTrack: clips must be an array.');
  if (typeof value.visible !== 'boolean') throw new Error('BackgroundTrack: visible must be a boolean.');
  if (!isNonNegativeInteger(value.revision)) throw new Error('BackgroundTrack: revision must be a non-negative integer.');
  return Object.freeze({ id: value.id, clips: Object.freeze(value.clips.map(parseFrameLoopClip)), fallback: parseBackgroundFallback(value.fallback), visible: value.visible, revision: value.revision });
}
```

**The reject to replace** (lines 327-329) — the current fail-closed `photoReference` reject becomes a `parsePhotoReferenceTrack` call (null stays valid; non-null must parse or throw):
```typescript
if (value.photoReference !== null) {
  throw new Error('EfxPaintDocument: photoReference must be null.');
}
// -> becomes:
// photoReference: value.photoReference === null ? null : parsePhotoReferenceTrack(value.photoReference),
```

**Mode union validation** — mirror the `sourceKind` union check (lines 144-146):
```typescript
if (value.sourceKind !== 'playscript-hold' && value.sourceKind !== 'imported-background') {
  throw new Error('FrameLoopClip: sourceKind must be playscript-hold or imported-background.');
}
// -> photo mode: 'reference-only' | 'reveal-source' | 'masked-transform-source'
```

---

### `app/src/efx-paint/document/efxPaintDocumentRevision.ts` (utility, transform)

**Analog:** `encodeCanonicalLoopClips` + the `'photo:null;'` placeholder in the same file.

**Canonical encoding pattern** (lines 42-58) — add an `encodeCanonicalPhotoReference` that emits real photo terms (id, source refs, mode, visibleInStudio, revision) in place of the placeholder:
```typescript
function encodeCanonicalLoopClips(clips: readonly FrameLoopClip[]): string {
  const ordered = [...clips].sort((a, b) => a.id.localeCompare(b.id));
  return `${ordered.length}:${ordered.map((clip) => [
    encodeCanonicalString(clip.id),
    encodeCanonicalNumber(clip.startFrame),
    `${clip.sourceFrameRefs.length}:${clip.sourceFrameRefs.map(encodeCanonicalString).join('')}`,
    ...
  ].join('')).join('')}`;
}
```

**The placeholder to replace** (line 117) — inside `encodeValidatedEfxPaintDocumentContent`:
```typescript
'photo:null;',
// -> becomes a real term, e.g. `photo:${encodeCanonicalPhotoReference(document.photoReference)}`
//    (empty when photoReference === null, mirroring the empty-additive-collection D-29 idiom)
```

**Important:** the mode and source identity are document-mutation terms (they MUST enter the revision so D-07 bumps the deterministic document revision). The display-preference fields (`visibleInStudio`, opacity, transform, lock) are NOT revision terms — mirroring how `visible`/`solo`/`opacity`/`blendMode` are excluded from `buildEfxPaintDocumentRevision` (see `_setTrackDisplayProperty` note in efxPaintStore.ts lines 320-330).

---

### `app/src/stores/physicPaintStore.ts` (store, request-response)

**Analog:** `_backgroundSourceImages` registry + `_backgroundSourceRevision` + `_resolveFlattenedFrame` in the same file.

**Source registry pattern** (lines 434-447) — add a parallel `_referenceSourceImages` map + `registerReferenceSourceImage` (RESEARCH Open Question 2 recommends a parallel map to keep the reference's fail-closed resolution independent of the Background clip lifecycle):
```typescript
const _backgroundSourceImages = new Map<string, string>();
export function registerBackgroundSourceImage(sourceRef: string, dataUrl: string): void {
  if (_backgroundSourceImages.get(sourceRef) === dataUrl) return;
  _backgroundSourceImages.set(sourceRef, dataUrl);
  _flattenedMemo.clear();
  physicPaintVersion.value++;
}
```

**Source revision term pattern** (lines 1584-1593) — add `_referenceSourceRevision` mirroring this (the `:missing` suffix is the fail-closed signal):
```typescript
function _backgroundSourceRevision(document: EfxPaintDocument): string {
  const refs = new Set<string>();
  for (const clip of document.background.clips) {
    for (const ref of clip.sourceFrameRefs) refs.add(ref);
  }
  return [...refs].sort().map((ref) => {
    const dataUrl = _backgroundSourceImages.get(ref);
    return dataUrl === undefined ? `${ref}:missing` : `${ref}:${dataUrl.length}:${dataUrl.slice(0, 64)}`;
  }).join('|');
}
```

**Hydration seam** (lines 491-521, 614-639) — `hydrateBackgroundSourceImages` + `hydrateBackgroundSourceImagesFromLibrary` are the reopen-path byte-warming; the reference source must register through the SAME library-hydration path (RESEARCH REF-05). The `resolveAssetUrls` port (imageStore primary + picker fallback) and `_decodeEfxAssetBytes` (crossOrigin anonymous, 2048px cap) are reused verbatim.

**D-06 exclusion lock (structural)** — `_resolveFlattenedFrame` (lines 1609-1694) and `getFlattenedFrame` (line 1768) receive NO reference input. The reference ghost draw path must be a SEPARATE monitor-paint function that never threads a reference source ref into `_resolveFlattenedFrame`, `compositeFrame`, or `previewRenderer.ts`. The frame-aligned resolution (D-15) resolves `frame N → source frame N` clamped at the sequence end, per cursor frame — never once at import (Pitfall M5).

---

### `app/src/stores/efxPaintStore.ts` (store, CRUD)

**Analog:** `_setTrackDisplayProperty` (display prefs) + `serializeRuntimeIntoDocument`/`hydrateRuntimeFromDocument` (persistence) in the same file.

**Display-preference setter pattern** (lines 331-351) — the reference `visibleInStudio`, opacity, transform, and lock setters follow this shape (NO documentRevision bump, NO undo record — they are persisted display preferences, D-11/D-12/D-13):
```typescript
function _setTrackDisplayProperty(
  layerId: string, trackId: string,
  patch: (track: InternalPaintTrack) => InternalPaintTrack,
  isChanged: (track: InternalPaintTrack) => boolean,
): TrackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return { ok: false, error: 'unknown track' };
  if (!isChanged(track)) return { ok: true, trackId };
  const nextTrack = patch(track);
  const next: EfxPaintDocument = { ...document, tracks: document.tracks.map((current) => (current.id === trackId ? nextTrack : current)) };
  _documents.set(layerId, next);
  bumpTrackRevision(layerId, trackId);
  _notifyChange();
  return { ok: true, trackId };
}
```

**Mutation setter pattern (D-03/D-07)** — the source replace and mode switch are UNDOABLE document mutations: they must bump the photo/reference track `revision` AND the document `documentRevision` counter (unlike `_setTrackDisplayProperty`). Follow the `serializeRuntimeIntoDocument` revision-bump idiom (lines 1054-1061):
```typescript
const candidate: EfxPaintDocument = { ...document, tracks };
if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
  return candidate;
}
const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
_documents.set(layerId, next);
_notifyChange();
return next;
```

**Serialize/hydrate seam** (lines 1039-1089) — the photo/reference track must be serialized into the document (like `serializeRuntimeIntoDocument`) and hydrated on reopen (like `hydrateRuntimeFromDocument`), with its source images registered through `hydrateBackgroundSourceImagesFromLibrary` (line 1088):
```typescript
void hydrateBackgroundSourceImagesFromLibrary(document);
```

**Critical classification (RESEARCH Pattern 1):** every store setter must be classified into exactly one of two classes — document mutation (source + mode: undoable, bump revision) vs display preference (visibleInStudio + opacity + transform + lock: persisted, no undo, no revision bump). Conflating them is the highest-risk mistake in this phase.

---

### `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (component, request-response)

**Analog:** `PhysicsPaintTrackRowHeader` Bg branch (lines 845-882) + `PhysicsPaintTrackRowKind` (line 85).

**Row kind union** (line 85) — extend to add `'photo-reference'`:
```typescript
export type PhysicsPaintTrackRowKind = 'paint' | 'background';
// -> 'paint' | 'background' | 'photo-reference'
```

**Fixed-row header pattern** (lines 845-882) — the Photo row header mirrors the Bg header: plain non-selectable header cell (no `role="button"`, no tabIndex), glyph + label + lock indicator + eye toggle + Import/Replace control. The Photo row uses a camera/image glyph (NOT the Bg checker swatch) and label `Photo`:
```typescript
if (isBackground) {
  return (
    <div class={headerClass} data-track-id={trackId} aria-pressed={selected ? 'true' : undefined} aria-label={`${label} row`}>
      <span class="physics-paint-bg-checker" aria-hidden="true"> ... </span>
      <span class="physics-paint-track-row-label">{label}</span>
      <span class="physics-paint-track-row-lock" title="Background layer — fixed position" aria-hidden="true">
        <Lock size={12} />
      </span>
      <button type="button" class="physics-paint-bg-import-button" aria-label="Import images" title="Import images" onClick={() => onImportBackground?.()}>
        <ImagePlus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
```

**Lane pattern** — the Photo row lane renders a passive muted reference band (Phase 43 passive-marker family), NOT editable rails/clips. The band spans frame 0..parent end when a source exists; empty lane when none. No drag, no reorder, no duplicate/delete. The band click selects the photo reference and opens the right-panel section (S5).

---

### `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (component, request-response)

**Analog:** Bg row mount + picker region swap in the same file (4370 lines — grep for `kind="background"` / `BackgroundAssetPickerView` mount sites).

**Strip composition pattern** — the Photo row mounts directly ABOVE the Bg row in the pinned fixed-row block (Paint rows scroll above; Photo row, then Bg row, pinned below). The picker region swap reuses the `BackgroundAssetPickerView` mount (engine stays mounted underneath, paused). The reference ghost overlay + transform handles live on the monitor surface (outside the strip layer stack), not in the strip.

**Key integration points (from CONTEXT.md):** `PhysicsPaintStudio.tsx` (photo row, picker region swap, ghost draw path), `PhysicsPaintWorkflowStrip.tsx` (photo row + Import control), the right panel (mode selector + opacity slider).

---

### `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.tsx` (component, request-response) — NEW

**Analog:** `PhysicsPaintBackgroundClipSection.tsx` (390 lines) — the right-panel section pattern.

**Controller + view split pattern** (lines 31-71, 97-239) — the section follows the `useXxxController` + presentational view split, with injectable `ports` for tests and `defaultPorts` at the bottom:
```typescript
export interface PhysicsPaintBackgroundClipSectionPorts {
  getDocument: (layerId: string) => EfxPaintDocument | undefined;
  setRepeat: (layerId: string, clipId: string, repeat: FrameLoopClipRepeat) => BackgroundClipMutationResult;
  ...
}
export interface PhysicsPaintBackgroundClipSectionProps {
  layerId: string;
  selectedBackgroundClipId: Signal<string | null>;
  ports?: Partial<PhysicsPaintBackgroundClipSectionPorts>;
}
export function usePhysicsPaintBackgroundClipSectionController({ layerId, selectedBackgroundClipId, ports = {} }: PhysicsPaintBackgroundClipSectionProps): PhysicsPaintBackgroundClipSectionController { ... }
export function PhysicsPaintBackgroundClipSection(props: PhysicsPaintBackgroundClipSectionProps) { ... }
const defaultPorts: PhysicsPaintBackgroundClipSectionPorts = { getDocument: () => undefined, setRepeat: () => ({ ok: false, reason: 'clip-not-found' }), ... };
```

**Section render pattern** (lines 241-380) — the section renders a `<section class="physics-paint-right-section ...">` with a heading, option rows (`physics-paint-option-row` + `physics-paint-right-label`), and controls. The Photo Reference section renders: `Mode` 3-segment control (radiogroup), `Overlay opacity` slider (release-commit), `Lock reference transform` toggle, and source facts (`{N} image(s)`).

**Signals-only state (efx-preact-reactivity)** — the controller holds draft state in signals; the view reads the document via narrow reads. No `useState`, no render-body signal writes. The opacity slider follows the release-commit pattern (live preview during drag, commit on release — same as `setTrackOpacity`).

---

### `app/src/efx-paint/document/efxPaintDocumentParsers.test.ts` (test, transform) — NEW

**Analog:** `efxPaintDocument.test.ts` (existing).

**Test structure pattern** (lines 1-40):
```typescript
import { describe, expect, it } from 'vitest';
import { EFX_PAINT_DOCUMENT_VERSION, createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision } from './efxPaintDocumentRevision';

function validDocumentJson(): MutableDocumentJson {
  return JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc')));
}

describe('createEfxPaintDocument', () => {
  it('round-trips a factory-produced document through JSON serialize/parse', () => {
    const document = createEfxPaintDocument('layer-abc');
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed).toEqual(document);
  });
});
```

**Coverage (RESEARCH Wave 0):** REF-01 (parser accepts valid `PhotoReferenceTrack`, rejects malformed), REF-05 (round-trip preserves source identity, mode, visibleInStudio, opacity, transform, lock). Add a shared fixture for a valid `PhotoReferenceTrack` and a missing-source document.

---

### `app/src/stores/efxPaintStore.photoReference.test.ts` (test, CRUD) — NEW

**Analog:** `efxPaintStore.test.ts` (existing).

**Test structure pattern** (lines 1-40) — imports the store ops under test, `createEfxPaintDocument`, `parseEfxPaintDocument`, `buildEfxPaintDocumentRevision`, and the `_setEfxPaintMarkDirtyCallback` / `reset` test seams:
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import { _setEfxPaintMarkDirtyCallback, getDocument, registerDocument, reset, serializeRuntimeIntoDocument, ... } from './efxPaintStore';
```

**Coverage (RESEARCH Wave 0):** REF-02 (mode mutation + undo), REF-03 (exclusion — `visibleInStudio` toggle never changes `getFlattenedFrame` output), REF-04 (source revision term changes on replace; missing source resolves to null + fail-closed report).

---

## Shared Patterns

### Fail-closed parser (apply to: parser + revision builder)
**Source:** `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (lines 30-64, 274-300)
The parser never allocates IDs and never normalizes malformed input. Every record level uses `isPlainRecord` → `hasOnlyKeys` → per-field validation → `Object.freeze`. The `PhotoReferenceTrack` parser must keep this posture: any malformed track throws; legacy `photoReference: null` is handled by the clean-break rule (no migration, no compatibility branch).

### Document-mutation vs display-preference split (apply to: all store setters)
**Source:** `app/src/stores/efxPaintStore.ts` (lines 320-351) + `efxPaintDocumentRevision.ts` (lines 100-120)
Source identity + mode = undoable document mutations (bump track `revision` AND `documentRevision`). `visibleInStudio` + opacity + transform + lock = persisted display preferences (no undo, no revision bump). Classify every setter before implementation.

### D-06 exclusion lock (apply to: ghost draw path, compositor boundary)
**Source:** `app/src/stores/physicPaintStore.ts` (lines 1609-1694, 1768)
The reference ghost draws in the monitor-paint layer seat only (onion-ghost family, `rotoOnionPreview.ts` line 34 `ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15]`). The compositor (`_resolveFlattenedFrame`), `getFlattenedFrame`, `previewRenderer.ts`, and export receive NO reference input — the exclusion is structural, not a runtime check.

### Natural filename sort (apply to: source import confirm path)
**Source:** `app/src/efx-paint/utils/naturalFilenameSort.ts` (lines 19-42)
`sortImagesByOriginalFilename` with `Intl.Collator({ numeric: true, sensitivity: 'base' })`. Order `sourceFrameRefs` by original filename basename (`shot_1 < shot_2 < shot_10`), never asset UUID or click order (D-02).

### Source registry + revision (apply to: reference source resolution)
**Source:** `app/src/stores/physicPaintStore.ts` (lines 434-447, 1584-1593, 491-639)
Parallel `_referenceSourceImages` map + `_referenceSourceRevision` term (with `:missing` fail-closed suffix). Hydrate through `hydrateBackgroundSourceImagesFromLibrary` (imageStore primary + picker fallback, crossOrigin anonymous, 2048px cap).

### TransformOverlay reuse (apply to: reference display transform, D-13)
**Source:** `app/src/components/canvas/TransformOverlay.tsx` (lines 190-194, 463-557, 691-729)
Counter-scaled fixed screen-pixel handles (`cornerSize = 8 / zoom`, `edgeSize = 6 / zoom`, `strokeWidth = 1.5 / zoom`), drag-to-move body hit, corner scale handles, rotation handle. The reference transform reuses this pattern but writes to display properties (NOT `layerStore`/`keyframeStore` — the reference is not a layer), and is gated behind the lock toggle (locked by default).

### Status capsule fail-closed (apply to: missing-source recovery, D-04)
**Source:** `app/src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.tsx` + Phase 46 paste UX
Missing asset resolves to null (never placeholder, never silent transparency — Pitfall M6); the status capsule reports `Missing reference source — use Replace source to re-link.` with the red warning triangle. Recovery is the Replace flow (D-04).

---

## No Analog Found

None — every file has a strong in-repo analog (this phase is entirely in-repo reuse, zero new dependencies). The only genuinely new surface is the reference ghost overlay draw path, but it draws in the established onion-ghost family (`rotoOnionPreview.ts`) and the transform reuses `TransformOverlay` — both are exact analogs.

## Metadata

**Analog search scope:** `app/src/efx-paint/document/`, `app/src/stores/`, `app/src/components/physic-paint/view/`, `app/src/components/physic-paint/roto/`, `app/src/components/canvas/`, `app/src/efx-paint/utils/`
**Files scanned:** 12 (all git-tracked, verified via `git ls-files`)
**Pattern extraction date:** 2026-09-01
