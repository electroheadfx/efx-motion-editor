# Phase 43: Hold Loop Clips + Filmstrip Capsule - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 18 (15 modified, 3+ new)
**Analogs found:** 18 / 18 — this phase is almost entirely extend-in-place; every target file IS its own closest analog, and every new file has a verified in-repo idiom to copy.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (mod) | model | validation/transform | itself — existing allowlist guards + revision fingerprint | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (mod) | service (resolver) | transform (pure projection) | itself — `PhysicPaintRotoPhysicalCell` union + `projectPhysicPaintRotoPhysicalTimeline` | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (mod) | controller | request-response (authority/commit) | itself — Phase 42 signal-based controller + ports | exact |
| `app/src/components/physic-paint/roto/rotoTimelineSelectors.ts` (mod) | selector/utility | transform | `PhysicsPaintWorkflowStrip.tsx` cell-kind consumers (`cell.kind ===` sites) | exact |
| `app/src/stores/physicPaintStore.ts` (mod) | store | request-response (per-frame render source) | itself — `getRotoPhysicalRenderSource` real/generated branches | exact |
| `app/src/lib/physicPaintPersistence.ts` (mod) | persistence | file-I/O | itself — `PERSISTED_DOCUMENT_KEYS` + save mapping + hydration | exact |
| `app/src/lib/physicPaintBridge.ts` (mod) | bridge | request-response (apply payload) | itself — apply-payload validation path | exact |
| `app/src/lib/frameMap.ts` (mod) | projection | transform (signal computed) | itself — `fxTrackLayouts` computed + `rotoKeyFrames` feed | exact |
| `app/src/types/physicPaint.ts` (mod) | types | validation (payload allowlists) | itself — `hasOnlyKeys` guard at line 330 | exact |
| `app/src/types/project.ts` (mod) | types | n/a (schema) | itself — `McePhysicPaintRotoPhysicalDocument` | exact |
| `app/src/types/timeline.ts` (mod) | types | n/a (schema) | itself — `FxTrackLayout` | exact |
| `app/src/components/timeline/TimelineRenderer.ts` (mod) | renderer | canvas paint calls | itself — `drawPhysicPaintPlayScriptMarkers` + `drawRotoKeyMarkers` | exact |
| `app/src/components/timeline/TimelineInteraction.ts` (mod) | interaction | event-driven (pointer hit-testing) | itself — existing keyframe hit-test (line 353) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` (mod) | component | event-driven (dialog modes) | itself — Phase 42 dialog + controller signals | exact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (mod) | component | render (cell derivation) | itself — cell derivation block lines 1297-1343 | exact |
| NEW: main-timeline tooltip host component | component | event-driven (hover/focus) | `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx` | role-match |
| NEW: parent→child "open loop-edit dialog" bridge message | bridge | event-driven | `physicsPaintBridgeTransport.ts` sender pattern | role-match |
| NEW: test specs (loop resolver, loopClips persistence, HOLD-02 determinism, history extension) | test | unit | `physicsPaintRotoPlayScriptController.test.ts` harness pattern | exact |

## Pattern Assignments

### `physicsPaintRotoPhysicalModel.ts` (+ `PhysicPaintRotoLoopClip` record, guards, parser, document keys)

**Analog:** itself — extend the established fail-closed validation discipline.

**Allowlist pattern** (lines 269-278 — the set `loopClips` must join):
```typescript
const PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS = new Set([
  'capacity',
  'realKeyRecords',
  'interpolation',
  'scriptMotion',
  'background',
  'selectedKeyId',
  'cursorAppFrame',
  'revision',
]);
```

**Guard idiom to copy for the loop-clip guard** (lines 322-336):
```typescript
function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function isPhysicPaintRotoKeyIdentity(value: unknown): value is PhysicPaintRotoKeyIdentity {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_KEY_IDENTITY_KEYS)) return false;
  return isBoundedKeyId(value.keyId) && isNonNegativeInteger(value.appFrame);
}
```

**Optional-member load rule** (new for this phase — every current member is required): `loopClips` must be the first genuinely optional document member: `value.loopClips === undefined ? [] : parse(value.loopClips)`. The parser entry point `parsePhysicPaintRotoPhysicalDocument` (lines 653-702) recomputes the canonical revision and throws on mismatch (lines 687-690) — if loopClips join the revision fingerprint (Open Question Q1), `buildPhysicPaintRotoPhysicalRevision` (lines 595-601, signature `(records, interpolation)`) and `encodePhysicPaintRotoPhysicalContent` (lines 609-632) are the exact seams.

**Anti-pattern (locked):** distinguish "structurally malformed" (throw) from "well-formed but dangling keyId reference" (preserve verbatim + mark unresolved, D-31). Do NOT collapse both into one throw.

---

### `physicsPaintRotoPhysicalResolver.ts` (+ `'linked-loop'` virtual cell kind)

**Analog:** itself — the closed cell union and the single projection seam.

**Cell union to extend** (lines 193-201):
```typescript
export type PhysicPaintRotoPhysicalCell =
  | { readonly kind: 'real'; readonly appFrame: number; readonly keyId: string }
  | {
      readonly kind: 'generated';
      readonly appFrame: number;
      readonly leftKeyId: string;
      readonly rightKeyId: string;
    }
  | { readonly kind: 'empty'; readonly appFrame: number };
```

**Projection seam to extend** (lines 2057-2085): `projectPhysicPaintRotoPhysicalTimeline` builds the real-key `mapping` first, then calls `buildProjectionFromMapping`. The new virtual rule slots in after real cells are assigned — "real keys always win" (D-06 shrink, D-12 materialize) is emergent if `linked-loop` cells are only assigned where no real cell exists. Loop resolution per frame is O(1) modulo: `sourceKeyIds[(appFrame - canonicalStart) % cycleLength]`; `repeatIndex = Math.floor((appFrame - canonicalStart) / cycleLength)`.

**Failure idiom to copy** (lines 2087-2096): typed `projectionFailure(code, operationKind, text)` returning a frozen `{ ok: false, failure }` — loop boundary errors and unresolved-loop surfacing reuse this, never thrown exceptions in the read path.

**Mandatory follow-up (Pitfall 7):** audit every `cell.kind ===` / `cell.kind !==` consumer (`rotoTimelineSelectors.ts`, `rotoPhysicalTimelinePorts.ts`, `physicsPaintWorkflowPresentation.ts`, `useRotoTimelineModel.ts`, `PhysicsPaintWorkflowStrip.tsx:1301-1337`) with a `never`-fallback exhaustiveness switch; selection/drag ports must explicitly exclude `linked-loop` (D-23: ghost cells never key-selectable).

---

### `physicsPaintRotoPlayScriptController.ts` (+ loop-edit/source-edit modes, Link/Create flow, D-06 preflight)

**Analog:** itself — the Phase 42 signal-based controller.

**Imports + ports pattern** (lines 1-66):
```typescript
import { computed, effect, signal, type ReadonlySignal, type Signal } from '@preact/signals';
// ...
export interface RotoPlayScriptControllerPorts {
  library: RotoScriptLibraryController;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  // ...
  requestAuthority: (operationId: string, start: number) => Promise<PhysicPaintRotoAuthorityResult>;
  commit: (publication: RotoPlayScriptPhysicalPublication) => Promise<RotoPlayScriptCommitResult>;
  stopPlayback: () => void;
  log: (message: string, error?: boolean) => void;
}
```

**Locked conventions the loop modes must keep:**
- All dialog state is Preact Signals on the controller (`confirmationOpen`, `mode`, `repeatText`, `infinity` — lines 68-80); no `useState` for shared state (CLAUDE.md Preact guidelines).
- `Regenerate source cycle` (D-02) reuses `confirm()` → staged render → `buildPhysicalPublication` verbatim — no new commit path (HOLD-03).
- The existing inline `loopReadout` (controller lines 144-158) computes `effective = Math.min(requested, layerEndExclusive - start)` — Pitfall 4: loop-edit mode readout MUST come from the canonical resolver's boundary query instead; make the shared boundary computation a resolver export consumed by both dialog and capsule.
- Repeat validation `parseRepeat` (lines 340-353) already bounds `cycleLength × repeat` to `Number.MAX_SAFE_INTEGER` — reuse for `Update loop`.

---

### `physicPaintStore.ts` (+ loopClips state, virtual render-source branch, loop-aware end frame)

**Analog:** itself — `getRotoPhysicalRenderSource`.

**Canonical per-frame resolution to extend** (lines 1405-1453):
```typescript
getRotoPhysicalRenderSource(layerId: string, appFrame: number): PhysicPaintRotoPhysicalRenderSource | null {
  if (!Number.isInteger(appFrame) || appFrame < 0) return null;
  const projection = this.getRotoPhysicalProjection(layerId);
  const contentRevision = this.getRotoPhysicalContentRevision(layerId);
  if (!projection || !contentRevision) return null;
  const cell = projection.cells[appFrame];
  if (!cell || cell.appFrame !== appFrame || cell.kind === 'empty') return null;
  if (cell.kind === 'real') {
    const record = this.getRotoRealKeyRecord(layerId, cell.keyId);
    if (!record || record.appFrame !== appFrame || record.payload.appFrame !== appFrame) return null;
    return {
      kind: 'real',
      layerId,
      appFrame,
      keyId: record.keyId,
      contentRevision,
      cacheRevision: `${contentRevision}:real:${record.keyId}`,
      renderedFrame: record.payload,
    };
  }
  // … 'generated' branch …
```

The NEW `linked-loop` branch resolves `cell.sourceKeyId`'s record and returns ITS payload with a source-scoped cache revision (`${contentRevision}:real:${sourceKeyId}`) so one source edit invalidates every occurrence at once (D-26). Consumers already verified: `previewRenderer.ts:127`, `PhysicsPaintStudio.tsx:808,1077`, `useRotoFramePersistenceCoordinator.ts:134`, export via `PreviewRenderer`.

**End-frame Pitfall 3** (lines 1399-1402 — must become loop-aware):
```typescript
getRotoPhysicalEndFrame(layerId: string): number | null {
  const records = this.getRotoRealKeyRecords(layerId);
  return records.length === 0 ? null : records[records.length - 1].appFrame + 1;
}
```
New: `max(last real key end, max loop effective end)`, bounded by parent end (D-25) and physical capacity 600.

---

### `physicPaintPersistence.ts` (+ loopClips in allowlist, save mapping, hydration)

**Analog:** itself — the three seams that MUST all change together (Pitfall 1).

**Save mapping — field-by-field, unlisted fields are LOST** (lines 180-189):
```typescript
rotoPhysical = {
  capacity: physical.capacity,
  realKeyRecords,
  interpolation: physical.interpolation,
  scriptMotion: physical.scriptMotion,
  background: physical.background,
  selectedKeyId: physical.selectedKeyId,
  cursorAppFrame: physical.cursorAppFrame,
  revision: physical.revision,
};
```

**Persisted parse guard** (lines 216-219): `parsePersistedPhysicalDocument` throws `'Persisted physical Roto document has unknown or missing members.'` on keys outside `PERSISTED_DOCUMENT_KEYS` (line 18).

**Hydration mapping** (lines 255-264): rebuilds the runtime document field-by-field then calls `parsePhysicPaintRotoPhysicalDocument` — `loopClips` threads here too, with absent-means-`[]`.

**Round-trip test is mandatory:** save→reopen asserting `loopClips` survives byte-identically, plus a v0.8.1-shaped document (no `loopClips` key) loading as an empty collection.

---

### `app/src/types/project.ts` + `app/src/types/physicPaint.ts` + `app/src/types/timeline.ts` (type seams)

**Analog:** themselves.

**`project.ts` document type to extend** (lines 68-77):
```typescript
export interface McePhysicPaintRotoPhysicalDocument {
  readonly capacity: number;
  readonly realKeyRecords: readonly McePhysicPaintRotoPhysicalRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly scriptMotion: PhysicPaintRotoScriptMotionSettings;
  readonly background: PhysicPaintRotoBackgroundMetadata | null;
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly revision: string;
}
```
Add `readonly loopClips?: readonly McePhysicPaintRotoLoopClip[];` (optional — absent = empty, D-29). Rust side needs nothing: `roto_physical: Option<Value>` is opaque JSON (`app/src-tauri/src/models/project.rs:37`).

**`physicPaint.ts` apply-payload allowlist** (line 330): if loop state rides the commit payload, the `hasOnlyKeys(value, [...])` key set (and the matching result allowlist at line 367) grow too. `PHYSIC_PAINT_MAX_APPLY_FRAMES = 600` (line 13) is the capacity bound for all loop math.

**`timeline.ts` FxTrackLayout to extend** (lines 45-60): add a loop-capsule layout field beside `rotoKeyFrames?: number[]` (line 57). Do NOT reuse `playScriptMarkers` (line 56) — it is dead, never populated by `frameMap.ts`.

---

### `frameMap.ts` (+ capsule projection field on FxTrackLayout)

**Analog:** itself — the `fxTrackLayouts` computed signal (lines 171-205).

**Feed pattern to copy** (lines 171-199):
```typescript
export const fxTrackLayouts = computed<FxTrackLayout[]>(() => {
  physicPaintVersion.value;
  const layouts: FxTrackLayout[] = [];
  // ...
  layouts.push({
    // ...
    rotoKeyFrames: primaryLayer?.type === 'physic-paint'
      ? physicPaintStore.getRotoRealKeyRecords(getLayerId(primaryLayer)).map((record) => record.appFrame)
      : undefined,
    // ...
  });
  return layouts;
});
```
The capsule layout field reads the resolver's derived capsule model from `physicPaintStore` the same way — TimelineRenderer never recomputes canonical start or boundaries (D-24 single definition). Timeline length derives through `getTimelineRequiredFrameCount` / `getTimelineOverlaySequenceOutFrame` (lines 124-153) which consume `getRotoPhysicalEndFrame` — the loop-aware end frame lands there automatically once the store read is fixed.

---

### `TimelineRenderer.ts` (+ capsule drawing: thumbnails, band, ghost cells, badge, diagonal, anchor flag)

**Analog:** itself — `drawPhysicPaintPlayScriptMarkers` (lines 423-496) is the structural template for the capsule (clipped range band inside the FX bar, label truncation, theme colors); `drawRotoKeyMarkers` (lines 500-540) is the source-key diamond idiom the capsule keeps.

**Geometry helper pattern** (lines 41-50 — pure exported function, unit-testable):
```typescript
export function getPhysicPaintRotoKeyMarkerGeometry(marker: {
  appFrame: number;
  inFrame: number;
  frameWidth: number;
  scrollX: number;
}): PhysicPaintRotoKeyMarkerGeometry {
  return {
    x: (marker.inFrame + marker.appFrame) * marker.frameWidth - marker.scrollX + TRACK_HEADER_WIDTH,
  };
}
```
Capsule geometry (band extents, ghost-cell grid, diagonal landing point, anchor-flag position) should be exported pure functions in the same style — this is what `TimelineRenderer.test.ts` asserts.

**Canvas drawing conventions to copy** (lines 441-495): `ctx.save()` → `roundRect` clip to bar → draw → `ctx.restore()`; theme colors via `getThemeColors()` (CSS-variable cache, lines 74-100); labels gated on `labelMaxW >= 18` with `this.truncateText` (line 1585); badge text forms are locked verbatim (D-19): `Cycle 5f × 5 = 25f`, `Cycle 5f × ∞`, `Cycle 5f × 1 = 5f`.

**Thumbnail source (D-15):** `ThumbnailCache.get(imageId, thumbnailUrl)` returns a cached `HTMLImageElement` or `null` (caller draws placeholder; `onLoad` triggers redraw) — full pattern in `app/src/components/timeline/ThumbnailCache.ts:7-42`. Source-cycle thumbnails are real-key payload dataUrls downscaled via `drawImage` at draw time; no new image pipeline.

**Zoom-adaptive rule (D-16):** `MIN_FRAME_WIDTH_FOR_THUMB = 4` (line 68) is the existing zoom-fallback precedent — ghost cells only above a frame-width threshold, band+badge below.

---

### `TimelineInteraction.ts` (+ capsule hit regions, selection, keyboard focus)

**Analog:** itself — single `export class TimelineInteraction` (line 28) with existing keyframe hit-testing gated at line 353 (`// Only hit-test if we have active keyframes`). Capsule hit regions (badge click → D-01 loop-edit, ghost-cell click → D-17 tooltip + seek, anchor-flag click → D-22) extend the same pointer-dispatch path. Selection unit = the whole loop object (D-23); ghost cells never produce key selection (Pitfall 7).

---

### NEW: main-timeline tooltip host (gap — Pitfall 5)

**Analog:** `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx` (Studio-only today; no tooltip module exists under `app/src/components/timeline/`).

**Controller idiom to copy** (lines 28-90):
```typescript
export function useStyledTooltip(delayMs: number = STYLED_TOOLTIP_DELAY_MS): StyledTooltipController {
  const [visible, setVisible] = useState(false);
  // 1000ms hover delay, never instant; pointerleave cancels
  // Keyboard focus shows immediately; blur hides
  // Escape hides; window keydown listener only while visible (idempotent cleanup + mountedRef)
  function onPointerEnter() { clearTimer(); timerRef.current = setTimeout(show, delayMs); }
  function onPointerLeave() { hide(); }
  function onFocus() { clearTimer(); show(); }
  function onBlur() { hide(); }
  // ...
}
```
The new main-timeline surface follows this exact discipline (delay, Escape, focus immediacy, viewport margin `TOOLTIP_VIEWPORT_MARGIN = 8`, flat-multiline Phase 38 content). Tooltip copy forms are locked (D-17/D-19/D-22, e.g. `Repeat 3 · Source frame 2 of 5`, `Cycle 5f × 5 = 25f · Effective 0f — fully shortened by the next clip`). English only; `clip bloquant` prohibited in every language.

---

### NEW: parent→child "open loop-edit dialog" bridge message (gap — Pitfall 5)

**Analog:** `physicsPaintBridgeTransport.ts` sender pattern (whole file is 132 lines).

**Sender idiom to copy** (lines 57-69):
```typescript
export async function sendPhysicPaintRotoAuthorityRequest(request: PhysicPaintRotoAuthorityRequest, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, request);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, payload: request }, window.location.origin);
    return;
  }
  throw new Error('Roto authority is unavailable');
}
```
The new message reverses direction (parent→child: launch/focus Studio + open Play Script dialog in loop-edit mode with target loopId) — planner must handle the Studio-closed case (Open Question 3: launch-or-focus). Event name constant lives beside the others in `app/src/lib/physicPaintBridge.ts`; typed request payload + `isX` guard in `app/src/types/physicPaint.ts` following the `isPhysicPaintThumbnailEncodeResult` precedent.

---

### `PhysicsPaintPlayScriptDialog.tsx` (+ loop-edit / source-edit modes S2/S3/S4)

**Analog:** itself — Phase 42 dialog.

**Conventions to keep** (lines 37-116):
- Controller-driven: all state read from `playScript.*.value` signals; dialog holds only local UI state (drag offset) via `useState` by locality.
- Locked option arrays with locked labels/helpers (lines 16-26: `PLAY_SCRIPT_MODES` with `Progressive` / `Static / Hold` helpers) — loop-edit mode exposes ONLY Repeat + Infinity + Requested/Effective readout (D-01); source-edit mode prefills mode/Frames/color/Motion and confirms with `Regenerate source cycle` (D-02).
- Focus discipline (lines 48-52): focus input on open, restore `returnFocusRef` on close.
- `if (!confirmationOpen) return null;` early-exit (line 106) — loop-edit/source-edit get their own open signals on the controller, not new dialog components.
- Reuse the Phase 42 `--ps-*` modal overlay; do NOT build a second dialog system.

---

### `PhysicsPaintWorkflowStrip.tsx` (+ additive link badge, S5)

**Analog:** itself — the per-cell derivation block (lines 1297-1343).

**Cell-derivation pattern to extend** (lines 1300-1314):
```typescript
const semanticCell = physicalCellByAppFrame.get(frame) ?? null;
const isGenerated = semanticCell?.kind === 'generated';
const { vm, fill } = getRotoCellDerivation(frame);
const isPhysicalRealKey = semanticCell?.kind === 'real';
const fillClass = isPhysicalRealKey
  ? 'roto-fill-cached'
  : `${getRotoFillClass(fill)} ${vm.fillClass}`;
```
The `linked-loop` kind gets an ADDITIVE badge/border class layered onto the existing `cellClass` string (D-18) — no new first-class cell state, no geometry change, no palette change. `dragEligible = isPhysicalRealKey && !rotoDragLocked` (line 1315) already excludes non-real cells — linked-loop cells must also be excluded from selection/drag explicitly (Pitfall 7). Source-cycle cells keep real-key diamonds.

---

### NEW: test specs (loop resolver, persistence round-trip, HOLD-02 determinism, history extension)

**Analog:** `physicsPaintRotoPlayScriptController.test.ts` — the harness pattern.

**Test-harness idiom to copy** (lines 1-67):
```typescript
import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rendered = vi.hoisted(() => vi.fn());
vi.mock('./physicsPaintRotoPlayScriptRenderer', () => ({ renderRotoPlayScriptFrames: rendered }));

/** Minimal valid PNG data URL (real signature bytes) for canonical payloads. */
const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

function harness(overrides: Partial<RotoPlayScriptControllerPorts> = {}) { /* ports with vi.fn() defaults */ }
```
Conventions: colocated `*.test.ts` beside source; `vi.hoisted` + `vi.mock` for renderer seams; valid-PNG dataUrl factory; ports object with overridable `vi.fn()` defaults. Run with `pnpm --dir app exec vitest run <file>` — NEVER watch mode (CLAUDE.md). Extend `TimelineRenderer.test.ts` for capsule geometry; extend `physicsPaintRotoPhysicalResolver.test.ts` (or new spec) for modulo/boundary/priority cases per the RESEARCH test map.

## Shared Patterns

### Strict allowlist validation (fail-closed)
**Source:** `physicsPaintRotoPhysicalModel.ts:281-336`, `physicPaintPersistence.ts:216-235`
**Apply to:** `loopClips` record parser, bridge payload guard, persisted document parser — all four seams (model keys, persistence keys + save/hydrate mapping, `types/project.ts`, bridge apply-payload allowlists) must change together in ONE task (Pitfall 1).

### Snapshot-based atomic Undo/Redo
**Source:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:83-92, 138-163`
```typescript
interface RotoPhysicalEditCommand<EngineState> {
  readonly kind: 'physical';
  readonly operationId: string;
  readonly operationKind: RotoPhysicalEditOrdinaryOperationKind;
  readonly before: RotoPhysicalEditSnapshot<EngineState>;
  readonly after: RotoPhysicalEditSnapshot<EngineState>;
  readonly acceptedRevision: string;
  // ...
}
function snapshotRevision(snapshot: RotoPhysicalEditSnapshot<unknown>): string {
  return buildPhysicPaintRotoPhysicalRevision(snapshot.records, snapshot.interpolation);
}
```
**Apply to:** every loop op (Update, Unlink, Duplicate, Clear-materialize, generation-with-shrink). `loopClips` MUST join the snapshot, `snapshotRecordsEqual`, and the revision (or ride a parallel member with composite checking — Open Question Q1, planner decides). D-06 requires keys + loops in ONE snapshot.

### Preact Signals over hooks
**Source:** `physicsPaintRotoPlayScriptController.ts:1` (`import { computed, effect, signal, ... } from '@preact/signals'`)
**Apply to:** all new controller/dialog loop state. Local component-only UI state (drag offsets) may use `useState` by locality; shared/reactive state is always a controller signal. No `useEffect` for internal state derivation (CLAUDE.md).

### Fail-closed guarded operations with reason copy
**Source:** Cut-tool precedent (Phase 36.15); rejection plumbing through resolver `fail(code, operationKind, text)` (`physicsPaintRotoPhysicalResolver.ts:2014-2035`)
**Apply to:** source-key deletion rejection (D-07), single-key drag / Force Spacing rejection on linked keys (D-11), Delete-key rejection with locked copy (D-13): `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.`

### Deterministic held pose (do NOT hand-roll)
**Source:** `packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts:14-92` — `transformRecordedStrokeForHeldPose`, FNV-1a seed from `` `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}` ``, integer-only `poseNoise`, zero-variation returns input unchanged.
**Apply to:** HOLD-02 — add regression proof (byte-identical dataUrls across save/reopen + cache regen), no new determinism machinery. Note Pitfall 6: seeding uses absolute `destinationSourceFrame` (`physicsPaintRotoPlayScriptRenderer.ts:66-71`), so D-05 "identical cycle" matching must include canonical start when Motion ≠ 0.

## No Analog Found

None. Every new file has a verified in-repo idiom (tooltip → `PhysicsPaintStyledTooltip.tsx`; parent→child bridge message → `physicsPaintBridgeTransport.ts` senders; capsule → `drawPhysicPaintPlayScriptMarkers`). The two genuine GAPS (no main-timeline tooltip surface; no parent→child dialog-open message) are new code following existing idioms, not patternless work — both are called out with their analog above.

## Metadata

**Analog search scope:** `app/src/components/physic-paint/**`, `app/src/components/timeline/**`, `app/src/stores/`, `app/src/lib/`, `app/src/types/`, `packages/efx-physic-paint/src/animation/`
**Files scanned:** 15 primary analogs (read at cited line ranges) + 20 colocated roto test files (listed)
**Pattern extraction date:** 2026-08-06
