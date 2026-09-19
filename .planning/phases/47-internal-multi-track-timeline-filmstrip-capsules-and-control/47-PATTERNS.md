# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/stores/efxPaintStore.ts` | store | CRUD | `setActiveTrackId`/`commitDeleteTrack`/`serializeRuntimeIntoDocument` (same file) | exact |
| `app/src/stores/physicPaintStore.ts` | store | CRUD | `moveTrackItems`/`duplicateTrackFrames`/`bumpTrackRevision` (same file) | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | controller | request-response | `trackIdOfLaunch`/`studioActiveTrackId` (same file) | exact |
| `app/src/lib/previewRenderer.ts` | utility | CRUD | `resolvePhysicPaintFrameSource` (same file) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | component | event-driven | itself (single-row → multi-row refactor) | refactor |
| `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` | component | request-response | strip `physics-paint-workflow-header` section (798-834) | role-match |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | component | event-driven | strip cells render section (2793-2884) + `PhysicsPaintLoopClipRail` | role-match |
| `app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.tsx` | component | render/transform | `PhysicsPaintLoopClipRailTarget` (152-357) | role-match |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | component | event-driven | itself (evolve, keep rail semantics) | refactor |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | utility | transform | itself (62-130) + geometry (224-240) | refactor |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | hook/utility | event-driven | itself (90-240) + `isPhysicsPaintShortcutTarget` (46-52) | refactor |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | component | request-response | `PanelSlider` (99-120) | role-match |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | hook | event-driven | `usePhysicsPaintGroupRailDrag` / `moveTrackItems` | role-match |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | service | transform | `derivePhysicPaintRotoLoopRanges` + `PhysicPaintRotoLoopRange` (5338-5364) | consume-only |
| `app/src/components/physic-paint/physicsPaintStudio.css` | config/style | — | grid rows (412) + strip height (1964-1972) | refactor |
| `app/src/components/physic-paint/view/physicsPaintSoloArm.ts` | utility | — | itself (23-46) | consume-only |

## Pattern Assignments

### `app/src/stores/efxPaintStore.ts` (store, CRUD) — add/rename/duplicate/reorder + hide/solo/opacity/blend ops

**Analog:** `setActiveTrackId` (97-108), `commitDeleteTrack` (182-231), `serializeRuntimeIntoDocument` (250-273) — all same file.

The store is a non-reactive `Map<string, EfxPaintDocument>` keyed by parent layerId, with a single `efxPaintVersion` counter-signal. Every mutation follows the exact same shape: read `getDocument`, validate fail-closed, build the next immutable document (never mutate in place), `_documents.set(layerId, next)`, then `_notifyChange()`.

**Mutation + notify pattern** (`_notifyChange`, lines 53-56 — apply to EVERY new track op):
```typescript
function _notifyChange(): void {
  efxPaintVersion.value++;
  _markProjectDirty?.();
}
```

**Document-mutation op shape** (`setActiveTrackId`, lines 97-108 — the template for `addTrack`/`renameTrack`/`reorderTrack`/`setTrackVisible`/`setTrackSolo`/`setTrackOpacity`/`setTrackBlend`):
```typescript
export function setActiveTrackId(layerId: string, trackId: string): boolean {
  const document = getDocument(layerId);
  if (!document) return false;
  if (!document.tracks.some((track) => track.id === trackId)) return false;   // fail-closed validation
  if (document.activeTrackId === trackId) return true;                         // early no-op guard
  const candidate: EfxPaintDocument = { ...document, activeTrackId: trackId };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return true;
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return true;
}
```
Note: every op bumps `documentRevision` by 1 and rebuilds the document immutably. New `setTrackVisible`/`setTrackSolo`/`setTrackOpacity`/`setTrackBlend` follow this exact shape but additionally call `physicPaintStore.bumpTrackRevision(layerId, trackId)` (the per-track revision signal) after the document write — `visible`/`solo`/`opacity`/`blendMode` are **not** `documentRevision` docrev terms, so the per-track revision bump (Pitfall 4) is required for cache invalidation.

**Fail-closed result return shape** (`commitDeleteTrack`, lines 186-231 — the template for the delete path and any op that can reject):
```typescript
): { ok: true } | { ok: false; error: string } {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  if (!document.tracks.some((track) => track.id === trackId)) return { ok: false, error: 'unknown track' };
  ...
  const nextActiveTrackId = document.activeTrackId === trackId
    ? projectedTracks[deletedIndex]?.id ?? projectedTracks[deletedIndex - 1]?.id ?? document.activeTrackId
    : document.activeTrackId;
  const next: EfxPaintDocument = { ...document, activeTrackId: nextActiveTrackId, tracks: projectedTracks, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return { ok: true };
}
```

**Write-through serialize/hydrate for TML-08** (`serializeRuntimeIntoDocument`, lines 250-273 — `addTrack`/`duplicateTrack`/`reorderTrack` must project tracks by stable `id`, never array index):
```typescript
const tracks = document.tracks.map((track) => {
  const runtime = physicPaintStore.extractRuntimeStateForDocument(layerId, track.id);
  const frames: Record<number, CachedFrameReference> = {};
  for (const [appFrame, frame] of runtime.frames) {
    frames[appFrame] = { cachePath: buildEfxPaintFrameCachePath(layerId, track.id, frame), width: frame.width ?? 0, height: frame.height ?? 0 };
  }
  return { ...track, frames, rotoPhysical: runtime.rotoPhysical };
});
const candidate: EfxPaintDocument = { ...document, tracks };
if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return candidate;
const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
_documents.set(layerId, next);
_notifyChange();
return next;
```
**Reorder law (Pitfall 1/M3):** rewrite `track.order` only — never re-key the array or mutate `track.id`. New tracks get fresh UUIDs; `duplicateTrack` deep-copies via `physicPaintStore.duplicateTrackFrames` + fresh-identity Loop Clip copy (Phase 46 D-05).

**Auto-name sequence (copy contract, RESEARCH A2):** new tracks `Paint 1`, `Paint 2`, ... at next free number; duplicate suffix `Copy` → `Paint 1 Copy`, then `Paint 1 Copy 2`. Default `createDefaultPaintTrack` name is `'Track 1'` (`efxPaintDocument.ts:82-96`) — unchanged for existing docs.

---

### `app/src/stores/physicPaintStore.ts` (store, CRUD) — existing ops Phase 47 consumes

**Analog:** `bumpTrackRevision` (89-106), `mountTrackRuntime` (117-138), `moveTrackItems` (2711-2757).

These ops ALREADY EXIST and are the commit surface the UI must call — do not re-derive their semantics (RESEARCH "Don't Hand-Roll").

**Per-track revision bump + subscribe (Pitfall 4)** (`bumpTrackRevision`, lines 89-106 — call after every hide/solo/opacity/blend mutation):
```typescript
export function bumpTrackRevision(
  layerId: string, trackId: string, diagnostics?, markDirty = true,
): void {
  const entry = _getOrCreateTrackRevisions(trackId);
  entry.paint.value++;
  entry.roto.value++;
  physicPaintVersion.value++;
  _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
  if (markDirty) _markProjectDirty?.();
  ...
}
```

**Cross-track move commit (D-15..D-17)** (`moveTrackItems`, lines 2711-2757 — the single commit primitive the cross-track drag calls; implements Phase 46 D-09 copy-paste-delete with fail-closed Hold re-pointing):
```typescript
moveTrackItems(layerId: string, fromTrackId: string, toTrackId: string, keys: readonly string[]): RotoTrackPasteResult {
  if (!layerId || !fromTrackId || !toTrackId) return { ok: false, reason: 'track-missing' };
  if (fromTrackId === toTrackId) return { ok: false, reason: 'duplicate-destination-frame' };
  ...
  const copied = this.copyTrackSelection(layerId, fromTrackId, keys);       // cut COPY half
  const pasted = proposeRails({ document: destinationDocument, payload: copied.payload, placementMode: 'paste', ... }); // paste FIRST
  if (!pasted.ok) return { ok: false, reason: pasted.reason };              // fail closed, source untouched
  const applied = _applyRotoTrackPaste(this, layerId, toTrackId, destinationDocument, pasted.proposal);
  if (!applied.ok) return { ok: false, reason: 'apply-failed' };
  const removed = _applyRotoTrackSelectionRemoval(this, layerId, fromTrackId, keyIdSet, carriedLoopIds); // delete half
  if (!removed.ok) return { ok: false, reason: 'apply-failed' };
  return { ok: true, impact: pasted.impact };
}
```

**Duplicate deep-copy** (`duplicateTrackFrames`, lines 2646-2668 — same-track fresh-identity duplicate; the `duplicateTrack` store op composes this + Loop Clip fresh-identity copy).

---

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (controller, request-response) — active-track routing authority

**Analog:** `trackIdOfLaunch`/`studioActiveTrackId` (lines 243-244) — ALREADY centralized. All non-cross gestures MUST keep routing through it (Pitfall 3).
```typescript
const trackIdOfLaunch = (lc: PhysicPaintLaunchContext | null | undefined): string => lc?.document?.activeTrackId ?? '';
const studioActiveTrackId = () => trackIdOfLaunch(launchContextRef.current);
```
Row click in the multi-row strip calls `efxPaintStore.setActiveTrackId(layerId, trackId)`. The Studio re-reads the active track on `efxPaintVersion` change (verify `setActiveTrackId` bumps it — RESEARCH A1/Open Q1). Multi-row per-row reads pass each row's own trackId to `getRotoPhysicalRenderSource`/`getFrame`; all mutations still go through `studioActiveTrackId()`.

---

### `app/src/lib/previewRenderer.ts` (utility, CRUD) — hide/solo visibility filter

**Analog:** `resolvePhysicPaintFrameSource` (lines 132-154). **Insertion point** for the hide/solo truth table (Pitfall M8) — at the TOP of this function, before both store calls. Rule: no solo → all visible; solo → visible+soloed only; hide wins over solo. Return `null` (empty frame) when the active track is hidden or not in the solo set. Do NOT touch the `'loop-placeholder'` branch (135-138). Do NOT apply opacity/blend (Phase 48).
```typescript
function resolvePhysicPaintFrameSource(layerId: string, frame: number): PreviewPhysicPaintFrameSource | null {
  if (isPhysicalRotoWorkflowLayer(layerId)) {
    const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame);
    if (!source || source.kind === 'loop-placeholder' || source.layerId !== layerId || source.appFrame !== frame) return null;
    return { layerId, frame, cacheKey: `physic-paint:${layerId}:physical:${source.cacheRevision}`, renderedFrame: source.renderedFrame };
  }
  const renderedFrame = physicPaintStore.getFrame(layerId, getActiveTrackId(layerId), frame);
  if (!renderedFrame) return null;
  ...
}
```
**Pitfall 8:** the `cacheKey` must include the track identity — the single-row keys (`physic-paint:${layerId}:physical:...`) never carried a trackId; the multi-row render-source lookups pass each row's own trackId. When the visibility filter returns `null`, the frame renders as empty (checkerboard/solid fallback).

---

### `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (component, event-driven) — MULTI-ROW REFACTOR (D-01)

**Analog:** itself. Generalize the single-row strip into a row-based model — do NOT instantiate N per-track strip copies (anti-pattern: forks ruler/scrollbar/zoom/selection machinery).

**Geometry constants** (line 341) + structural index (lines 368-415):
```typescript
const ROTO_CELL_WIDTH_PX = 18;          // frame pitch — shared across all rows
const RULER_STEP = 3;
// rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX  (line 1067)
```
The shared `frameCells` extent + horizontal scroller + ruler stay at the strip level; each `PhysicsPaintTrackRow` maps the SAME `frameCells` with its own `trackId` passed through `getRotoCellDerivation(frame)` (line 1197). CSS targets (RESEARCH Pattern 1, verified): `.physics-paint-studio` grid rows `minmax(58px, auto) minmax(0, 1fr) 161px` (css:412) → **264px** total, **141px** rows region, **48px** row height, **140px** header column, **18px** pitch. The existing header/action row (798-834) becomes the global toolbar (D-01).

---

### `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` (component, request-response) — NEW pinned header column (D-02..D-08)

**Analog:** the strip's `physics-paint-workflow-header` (798-834) for the icon-button + `aria-label` + `aria-pressed` contract, and lucide-preact icons.

**Icon-button pattern** (strip lines 817-828 — template for hide/solo/duplicate/delete/`+` header controls):
```tsx
<button
  type="button"
  class={`physics-paint-nav-button ${props.active ? 'active' : ''}`}
  aria-label={props.enabled ? 'Disable X' : 'Enable X'}
  aria-pressed={props.active === true}
  disabled={!props.ready}
  onClick={() => { tooltip.hide(); props.onToggle?.(); }}
>
  {props.active ? <Eye size={15} /> : <EyeOff size={15} />}
</button>
```
**Rename edit-in-place (D-03):** double-click toggles the name to a controlled `<input>`; on commit, call `renameTrack` then trim + length-cap + reject empty/control chars (ASVS V5). Name truncation with ellipsis + hover tooltip (D-02) — render names as text nodes, never `dangerouslySetInnerHTML` (security: XSS).

**Reorder drag (D-08/D-18):** a `GripVertical` grab region with a distinct cursor, separate pointer-down handler from content drag (never falls through), live insertion indicator; commit writes `track.order`, never `id`.

**Active accent (D-04):** CSS left border + row tint + bold name, distinct from selection orange `#F59E0B` and rail purple `#8B5CF6`/cyan `#06B6D4`.

**Bg row (D-06):** label `"Bg"` (fits 140px column), muted tone, `Lock` indicator; cannot reorder above Paint rows. Icons from lucide-preact: `Plus`, `Copy`, `Trash2`, `GripVertical`, `Eye`, `EyeOff`, `Lock`.

---

### `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (component, event-driven) — NEW one row (48px)

**Analog:** the strip's cells render section (2793-2884) + `PhysicsPaintLoopClipRail`.

**Per-row cells grid** (strip lines 2793-2798 — pass the row's `trackId` through every per-row read; Pitfall 8):
```tsx
<div class="physics-paint-roto-cells" role="row" style={{ gridTemplateColumns: `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)` }}>
  {frameCells.map(frame => { const { vm, fill } = getRotoCellDerivation(frame); ... })}
</div>
```
Each row reads its OWN data (`getRotoPhysicalRenderSource(layerId, rowTrackId, frame)`, `getFrame(layerId, rowTrackId, frame)`); mutations still route through `studioActiveTrackId()`. Rails (Key Rails + Loop Clip Rails) render per row with the row's ranges/presentations. The roving rail keyboard nav (`physicsPaintRailKeyboardNavigation.ts`) operates within the ACTIVE row's lane — each row's lane gets a `data-track-id` (RESEARCH Pattern 1).

---

### `app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.tsx` (component, render/transform) — NEW capsule elements around the rail

**Analog:** `PhysicsPaintLoopClipRailTarget` (152-357) + `PhysicsPaintLoopClipRail` (359-449).

Evolve the rail — never replace. The locked rail semantics (selection, drag, spacing, playback, purple/cyan, passive markers, white endpoint cuts) stay. The capsule ADDS: source-cycle cells at the capsule head, ×N/∞ + requested badge, diagonal cut on partial cycles, high-zoom expansion (threshold derived from cell width, D-13). All facts come from `derivePhysicPaintRotoLoopRanges` (resolver, 5478) — NOT hand-rolled modulo (RESEARCH Don't Hand-Roll).

**Geometry projection** — reuse `projectPhysicsPaintLoopClipGeometry` (presentation lines 224-240):
```typescript
export function projectPhysicsPaintLoopClipGeometry(
  range, visibleFrameWindow, framePitch,
): PhysicsPaintLoopClipGeometry | null {
  if (range.effectiveEnd <= visibleFrameWindow.startFrame || range.placementStart >= visibleFrameWindow.endFrameExclusive) return null;
  const clippedStart = Math.max(range.placementStart, visibleFrameWindow.startFrame);
  const clippedEnd = Math.min(range.effectiveEnd, visibleFrameWindow.endFrameExclusive);
  return { left: (clippedStart - visibleFrameWindow.startFrame) * framePitch, width: Math.max(framePitch, (clippedEnd - clippedStart) * framePitch) };
}
```

**Rail target button shell** (LoopClipRail 290-333 — the capsule's DOM anchor + tooltip wiring; keep these classes/attributes, add capsule elements around them):
```tsx
<button type="button" class={`physics-paint-rail-target physics-paint-loop-clip-rail-target mode-${presentation.mode}...${range.truncated ? ' truncated' : ''}...`}
  aria-label={presentation.accessibleName} aria-pressed={props.selected} data-rail-first-frame={range.placementStart}
  onPointerDown={onPointerDown} onClick={handleClick} onKeyDown={handleKeyDown} ...>
  <span class="physics-paint-rail-segment physics-paint-loop-clip-rail-segment" aria-hidden="true" />
  ...
</button>
```

---

### `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` (component, event-driven) — MODIFY for capsule integration

**Analog:** itself. Keep rail semantics locked (D-11). The rail already consumes `ranges` + `presentations` + `projectPhysicsPaintLoopClipGeometry` and renders purple/cyan, passive markers, white cuts, ghost drag preview, lifecycle dot, styled tooltip. The capsule (source-cycle head cells, badges, high-zoom expansion) mounts around `PhysicsPaintLoopClipRailTarget` inside the 48px row.

---

### `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` (utility, transform) — MODIFY badge/tooltip (D-12)

**Analog:** `projectPhysicsPaintLoopClipPresentation` (62-130).

The presentation already produces `cycleLabel` (`Cycle {N}f × {R} = {T}f` or `Cycle {N}f × ∞` — the REQUESTED badge, Pitfall m2), `effectiveLabel`, `tooltipLines`, `accessibleName`. Extend it for the capsule: keep `cycleLabel` (requested) in the badge at all times; add a distinct SHORTENED visual + `"Loop shortened by next clip"` when `range.truncated` is true; the following-clip label is `"next clip — interrupts the loop"` (English, D-14). Full detail (repeat instance, source-frame index, source asset, provenance) stays in the tooltip.

**Badge label source** (lines 71-73 — requested duration; do not let the badge show the truncated/effective end):
```typescript
const requestedDuration = range.repeat === 'infinity' ? null : range.cycleLength * range.repeat;
const cycleLabel = range.repeat === 'infinity'
  ? `Cycle ${range.cycleLength}f × ∞`
  : `Cycle ${range.cycleLength}f × ${range.repeat} = ${requestedDuration}f`;
```

---

### `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` (hook/utility, event-driven) — MODIFY track CRUD shortcuts

**Analog:** `dispatchPhysicsPaintStudioKeyDown` (90-240) + `isPhysicsPaintShortcutTarget` (46-52).

Add track CRUD shortcuts following the existing guarded contract. Every new shortcut MUST:
1. Bail via `isPhysicsPaintShortcutTarget(event.target)` (line 96) — so typing a rename in an input never fires a CRUD shortcut (ASVS V5).
2. `event.preventDefault()` + `state.mutationLocked` guard.
3. Escape layering: `disarmSolo` returns true only when a solo was actually armed (solo-arm 42-46).

**Guard entry (lines 96-98) — every new shortcut copies this:**
```typescript
if (!isPhysicsPaintShortcutTarget(event.target)) return;
const key = event.key.toLowerCase();
const meta = event.metaKey || event.ctrlKey;
```

---

### `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` (component, request-response) — MODIFY opacity slider + blend select

**Analog:** `PanelSlider` (99-120) — the existing slider contract. Add an opacity slider (0-1 float mapping to `opacity: number`, RESEARCH A5) + blend `<select>` mapping 1:1 to the `BlendMode` union (`'normal' | 'screen' | 'multiply' | 'overlay' | 'add'`, `efxPaintDocument.ts:17`). Call `setTrackOpacity`/`setTrackBlend`; apply is Phase 48.
```tsx
function PanelSlider(props: { id; label; value; min; max; onChange; suffix?; disabled? }) {
  return (
    <label class="physics-paint-option-row" for={props.id}>
      <span class="physics-paint-right-label">{props.label}</span>
      <input id={props.id} type="range" min={props.min} max={props.max} value={props.value}
        disabled={props.disabled} onInput={(event) => props.onChange(Number((event.target as HTMLInputElement).value))} />
    </label>
  );
}
```

---

### `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` (hook, event-driven) — MODIFY cross-track drag

**Analog:** `usePhysicsPaintGroupRailDrag` (drag prepare/commit/rejection pattern) + `physicPaintStore.moveTrackItems` (commit).

The existing drag actions are track-agnostic (active track). Cross-track drag (D-15..D-18) captures a destination `trackId` at row-boundary crossing, and the commit routes through `physicPaintStore.moveTrackItems(layerId, fromTrackId, toTrackId, keys): RotoTrackPasteResult`. Rejections (`{ ok: false, reason }`) publish to the existing status capsule with the red warning triangle — the Phase 46 paste rejection UX (D-17). Row-reorder drag is a separate gesture with distinct grab area + cursor (D-18).

---

### `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (service, transform) — CONSUME ONLY (Pitfall 5 path drift)

**Analog:** `derivePhysicPaintRotoLoopRanges` (5478) + `PhysicPaintRotoLoopRange` (5338-5364). NOTE: CONTEXT.md's canonical ref `physicsPaintRotoLoopClips.ts` DOES NOT EXIST — the resolver lives here. Every capsule/rail label fact comes from this single resolver (requested vs effective, truncated, partialCycle, unresolved). Range shape:
```typescript
export interface PhysicPaintRotoLoopRange {
  readonly loopId: string;
  readonly placementStart: number;   // visible fragment start
  readonly phaseOrigin: number;      // immutable modulo origin
  readonly cycleLength: number;      // one source cycle duration
  readonly sourceFrameCount: number;
  readonly sourceKeyIds: readonly string[];
  readonly sourceOffsets: readonly number[];
  readonly repeat: number | 'infinity';
  readonly requestedEnd: number | 'infinity';
  readonly effectiveEnd: number;
  readonly truncated: boolean;       // → "Loop shortened by next clip" badge
  readonly partialCycle: boolean;    // → diagonal cut
  readonly unresolved: { readonly missingSourceKeyIds: readonly string[]; readonly invalidSourceTiming?: true } | null;
}
```
Background row capsule reuse (RESEARCH A3/Open Q3) is a sub-task with a verification step — `BackgroundTrack.clips` are `FrameLoopClip[]` and may need a different projection.

---

### `app/src/components/physic-paint/physicsPaintStudio.css` (config/style) — MODIFY geometry

**Analog:** itself. `.physics-paint-studio` grid rows `minmax(58px, auto) minmax(0, 1fr) 161px` (412) → target **264px** total / **141px** rows region / **48px** row height / **140px** header column / **18px** pitch. `.physics-paint-workflow-strip` height `161px` (1964-1972). Add: pinned header column, vertical scrollbar, active-track accent border/tint/bold, muted Bg row tone, lock indicator, capsule badge/cells/hatched-band/high-zoom-expansion, insertion indicator, `data-track-id` scoping.

---

### `app/src/components/physic-paint/view/physicsPaintSoloArm.ts` (utility) — CONSUME ONLY (hide/solo arm pattern)

**Analog:** itself (23-46). Session-only armed `signal(false)`; `isSoloArmed()` subscribing read; `toggleSolo()`/`disarmSolo()` (returns true only when actually armed for Escape layering). Reuse this pattern/`isSoloArmed()` for the hide/solo toggles + preview truth-table (Pitfall M8).

## Shared Patterns

### Store mutation + notify (apply to every new `efxPaintStore` track op)
**Source:** `efxPaintStore.ts:53-56` (`_notifyChange`) + `97-108` (op shape).
**Apply to:** `addTrack`, `renameTrack`, `duplicateTrack`, `reorderTrack`, `setTrackVisible`, `setTrackSolo`, `setTrackOpacity`, `setTrackBlend`. Each: validate fail-closed → build immutable next doc → `_documents.set` → `_notifyChange()`. Hide/solo/opacity/blend ops ALSO call `physicPaintStore.bumpTrackRevision(layerId, trackId)`. `duplicateTrack`/`addTrack` call `mountTrackRuntime`; `duplicateTrack` calls `duplicateTrackFrames` + Loop Clip fresh-identity copy.

### Active-track routing authority (apply to every gesture)
**Source:** `PhysicsPaintStudio.tsx:243-244`.
**Apply to:** all non-cross mutations in the multi-row timeline. Row click → `setActiveTrackId`; per-row reads pass row trackId; cross-track drag only targets a destination trackId (Pitfall 3).

### Hide/solo truth table (apply to preview)
**Source:** `previewRenderer.ts:132` + `physicsPaintSoloArm.ts:23`.
**Apply to:** `resolvePhysicPaintFrameSource` top. No solo → all visible; solo → visible+soloed only; hide wins. Return `null` = empty frame. No opacity/blend math (Phase 48).

### Shortcut guard (apply to every new track shortcut)
**Source:** `physicsPaintStudioKeyboard.ts:46-52, 96`.
**Apply to:** track CRUD shortcuts. Bail on `isPhysicsPaintShortcutTarget`; `preventDefault`; `mutationLocked` guard; Escape layering.

### Revision bump + subscribe (apply to hide/solo/opacity/blend + multi-row cache keys)
**Source:** `physicPaintStore.ts:89-106`.
**Apply to:** all per-track mutations; all per-row cache keys/`getTrackPaintVersion`/`getTrackRotorRevision` subscriptions include the row's trackId (Pitfall 8).

### Copy contract (apply to all user-facing copy — English, Pitfall m1/m2/D-14)
**Source:** UI-SPEC copy contract + RESEARCH.
**Apply to:** all surfaces. `Add track`, `Paint 1`/`Paint 2`, `Duplicate track {name}` / `Delete track {name}?`, `A document must always have at least one Paint track.` (last-track refusal), `Loop shortened by next clip`, `next clip — interrupts the loop`. NEVER `clip suivant`/`clip bloquant`/`Boucle raccourcie`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` | component | request-response | No existing pinned header column component; build from strip header sections + icon-button pattern (analog = role-match via strip header) |

## Metadata

**Analog search scope:** `app/src/stores`, `app/src/components/physic-paint` (+ view/roto/hooks), `app/src/lib`, `app/src/efx-paint/document`
**Files scanned:** ~12 read this session (efxPaintStore, physicPaintStore, previewRenderer, PhysicsPaintStudio, WorkflowStrip, LoopClipRail, presentation, soloArm, studioKeyboard, RightPanel, resolver, document model via RESEARCH)
**Pattern extraction date:** 2026-08-24
