# Phase 62: Painted-Stroke Curve Editing - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 14 (7 modified, 5 new, 2 test families)
**Analogs found:** 12 / 14 (2 have no direct precedent — see "No Analog Found")

**Note:** No RESEARCH.md exists for this phase (research disabled). The file list below is derived from `62-CONTEXT.md` (D-01..D-14 and its `canonical_refs`). Every analog path below is git-tracked source (verified via `git ls-files`), never a `.gsd/capabilities` mirror.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/components/physic-paint/view/vectorPathFit.ts` **(new)** | utility | transform (pure geometry) | `packages/efx-watercolor/src/vector/spine.ts` + `app/src/lib/bezierPath.ts` | role-match |
| `app/src/components/physic-paint/view/vectorPathHandles.ts` | utility | transform (pure geometry) | itself (`resampleVectorPaintPoints` / `vectorSpinePressures` seam) | exact |
| `app/src/components/physic-paint/view/vectorPathSession.ts` | store (session latches) | event-driven | itself + `vectorPathLatches.ts` | exact |
| `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` **(new)** | store (session bracket) | event-driven | `app/src/components/physic-paint/view/scriptStrokeEdition.ts` wireframe latch | role-match |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | store (record registry) | CRUD | itself (`updateAquarellePathInScript`, `updateAquarelleCurveModeInScript`) | exact |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | store (edit ledger) | event-driven | itself (`beginAquarellePathEdit`, `captureAquarelleSnapshot`) | exact |
| `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` | service (bake sequencer) | request-response | itself + `roto/rotoLivePixelCacheTransactions.ts` (staleness epoch) | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | controller | request-response | itself (`commitAquarelleVectorPathEdit`, `runAquarelleScriptReplay` wiring) | exact |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | model (gate) | transform | itself (`resolvePathEditGate`) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | component | request-response | itself (spline-pointer button) | exact |
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | component (overlay) | event-driven | itself (drawn-path projection, edit-target resolution) | exact |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` / `engine/PhysicsPaintCanvasMount.tsx` | component (prop plumbing) | request-response | itself (`onEditVectorPath` ref seam) | exact |
| `app/src/components/physic-paint/view/vectorPathFit.test.ts` **(new)** | test | — | `view/vectorPathHandles.test.ts`, `view/aquarelleVectorPathCommit.test.ts` | exact |
| `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` **(extend)** | test | — | itself | exact |

**Carried, not created (D-02):** no new `.mce` field. `anchors` and `curveMode` already round-trip:
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:180-190` (`VECTOR_FLAG_ANCHORS`, `VECTOR_FLAG_CURVE_MODE`), write path `:603-614`
- `app/src-tauri/src/models/project.rs:506-508` (`pub anchors`, `#[serde(rename = "curveMode")] pub curve_mode`)
- `app/src/lib/mceFieldContract.test.ts`, `app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts` — REL-02 pins

## Pattern Assignments

### 1. `app/src/components/physic-paint/view/vectorPathFit.ts` (utility, transform) — NEW

**Analog:** `packages/efx-watercolor/src/vector/spine.ts` (pure geometry leaf) and `app/src/lib/bezierPath.ts` (tolerance-clamping reference only, D-04).

**Purity header contract** — copy the package leaf's "no imports / no Preact / no DOM / no RNG" discipline from `packages/efx-watercolor/src/vector/spine.ts:1-34`. The fitter must be callable from an event handler and unit-testable without mounting anything:

```typescript
//  PURITY: no imports, no Preact, no signals, no DOM, no engine, no
//  unseeded RNG, and no pixel / zoom / viewport term. Coordinates
//  are document uv — this module knows nothing about the canvas.
```

**Decimation + cap law** (D-05: curvature-adaptive, ~40 cap, minimum floor). The existing deterministic decimation analogs are `app/src/components/physic-paint/view/scriptStrokeEdition.ts:517-527` (index-uniform, NOT what we want) and `scriptStrokeEdition.ts:76`-area worker cap; the curvature-driven part has no precedent in the tree — model it on the station-walk style of `spine.ts:196-236`:

```typescript
export function decimateScriptPoints(points: readonly CanvasPoint[]): CanvasPoint[] {
  if (points.length <= MAX_POLYLINE_POINTS) return [...points];
  const out: CanvasPoint[] = [];
  for (let index = 0; index < MAX_POLYLINE_POINTS; index += 1) {
    const sourceIndex = Math.round(
      (index * (points.length - 1)) / (MAX_POLYLINE_POINTS - 1),
    );
    out.push(points[sourceIndex]!);
  }
  return out;
}
```

**Tolerance clamping (reference only)** — `app/src/lib/bezierPath.ts:54-97` shows the retry-with-tolerance loop the phase must NOT copy (least-squares `fitCurve` is rejected by D-04), but its bounded-attempt/`>80 anchors` guard shape is the precedent for a hard cap:

```typescript
let currentTolerance = tolerance;
let segments: number[][] = [];
let attempts = 0;
while (attempts < 5) {
  segments = fitCurve(positions, currentTolerance);
  const anchorCount = segments.length + 1;
  if (anchorCount > 80) { currentTolerance *= 2.0; attempts++; continue; }
  if (anchorCount < 3 && points.length > 10) { currentTolerance *= 0.5; attempts++; continue; }
  break;
}
```

**Anchor shape to emit** — anchors are placed ON original samples (D-04) and use the Phase 61 anchor kind `auto` so the spine derives handles (`packages/efx-watercolor/src/vector/spine.ts:42-65`):

```typescript
export type VectorAnchorKind = 'auto' | 'bezier'
export interface VectorAnchor {
  readonly x: number
  readonly y: number
  readonly kind: VectorAnchorKind
  readonly in?: Vec2
  readonly out?: Vec2
  readonly width?: number
  readonly color?: string
}
```

**Fail-closed / total contract** — return `readonly VectorAnchor[]`, never throw, never repair partially (`vectorPath.ts:21-28` "FAIL-CLOSED (T-61-08)"). Degenerate input (all points coincident, < 2 distinct samples) must yield `[]` so the caller refuses with named copy.

---

### 2. `app/src/components/physic-paint/view/vectorPathHandles.ts` (utility, transform) — MODIFY

This is the D-07/D-08 seam named by CONTEXT. Three edits, all here:

**(a) Count-preserving re-sample (D-08).** Today's sampler is length-proportional (`vectorPathHandles.ts:751-801`). The new law redistributes the stroke's EXISTING sample count along the new spine by arc length — the station walk below is the reusable half:

```typescript
export function resampleVectorPaintPoints(points: readonly Vec2[]): readonly Vec2[] {
  if (points.length <= 2) return [...points];
  const stations: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    stations.push(stations[index - 1]! + Math.hypot(point.x - previous.x, point.y - previous.y));
  }
  const total = stations[stations.length - 1]!;
  if (!(total > 0)) return [...points];
  ...
}
```

Important: D-08 explicitly retires any pin asserting length-proportional counts — `vectorPathHandles.test.ts` and `aquarelleRecordState.path.test.ts` almost certainly carry them. Retire with a stated reason in the plan, never silently.

**(b) Pressure remap (D-07).** Today `vectorSpinePressures` stamps the sentinel unconditionally (`vectorPathHandles.ts:741`, `:869-874`):

```typescript
const VECTOR_PRESSURE_SENTINEL = -1;

export function vectorSpinePressures(
  points: readonly { x: number; y: number }[],
): readonly number[] {
  if (points.length === 0) return [];
  return points.map(() => VECTOR_PRESSURE_SENTINEL);
}
```

The remap must keep the sentinel path for DRAWN vector strokes and only substitute remapped pressures for a CONVERTED painted stroke (endpoints pinned to the original first/last `p`). The nearest-sample station mapping to copy is the package's width sampler — `packages/efx-watercolor/src/vector/spine.ts:361-386` (`sampleVectorWidths`) — do not invent a second station list.

**(c) Pressure envelope (D-09).** `projectVectorPath` currently draws the envelope from per-anchor width factors (`vectorPathHandles.ts:360-385`); the hand-painted band builder is the reusable geometry for a pressure-derived band (`view/aquarelleStrokeBand.ts:112-128`, `:142-171`):

```typescript
export function paintRadiusDocFor(
  tool: 'brush' | 'water' | 'pen',
  brush: Brush,
  engineSize: number,
  pressure: number,
): number {
  const sizeMult = Math.pow(3, (engineSize - 0.5) * 2);
  const clamped = Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0;
  ...
}
```

Also preserve `VECTOR_STROKE_BASE_PRESSURE = 0.5` (`:707`) and the pure-list-operation style (never mutate inputs, return the input reference for a no-op) used by every edit helper in this file.

---

### 3. `app/src/components/physic-paint/view/vectorPathSession.ts` (store, event-driven) — MODIFY

**Analog:** itself, plus `vectorPathLatches.ts`.

**Entry/exit action pattern** — actions clear sibling surfaces through their own setters and are compare-then-write (`vectorPathSession.ts:77-95`):

```typescript
export function enterPathEdit(mutationId: string): void {
  writeIfChanged(pathEditMutationId, mutationId);
  exitVectorPen();
  disarmAquarellePicker();
}

export const pathEditRebakeActive = signal(false);

/** Idempotent by construction (`writeIfChanged`) — a no-op transition never bumps. */
export function setPathEditRebakeActive(active: boolean): void {
  writeIfChanged(pathEditRebakeActive, active);
}
```

**Session-only law** (Phase 60 / 61 D-16) — the module reads no document store and imports no payload/codec/save-path module (`vectorPathSession.ts:1-21`, `vectorPathLatches.ts:1-21`). The held fit and the ghost's original points are session state, never persisted. Model the held fit as one more signal with `writeIfChanged` and a `clearVectorFit()` exit action, cleared by `resetForStudioOpen()` (`vectorPathSession.ts:143-149`).

---

### 4. `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` (store, event-driven) — NEW (D-06)

**Analog:** `app/src/components/physic-paint/view/scriptStrokeEdition.ts` wireframe latch (`:184`, `:211-215`, `:222-239`).

```typescript
export const wireframeMode = signal(false);

export function setWireframeMode(on: boolean): void {
  if (wireframeMode.value === on) return;
  if (on) setDraftMode(true);
  wireframeMode.value = on;
}

export const wireframeSettleInFlight = signal(false);
```

The bracket must remember the user's PRE-ENTRY wireframe value and restore it on exit. Because Wireframe OFF routes through the Studio's ONE settle (`runWireframeOffTransition`), the restore is asynchronous and single-flight — copy that shape rather than writing `wireframeMode.value = false` directly:

```typescript
export function runWireframeOffTransition(settle: () => Promise<boolean>): Promise<boolean> {
```

Keep the same "fixed refusal copy, never interpolated" contract as `WIREFRAME_SETTLE_REFUSED_MESSAGE` / `DRAFT_SETTLE_BUSY_MESSAGE` (`scriptStrokeEdition.ts:186-202`) for the degenerate-stroke refusal (D-10).

---

### 5. `app/src/components/physic-paint/view/aquarelleRecordState.ts` (store, CRUD) — MODIFY

**Analog:** itself — `updateAquarellePathInScript` (`:1096-1138`) and `updateAquarelleCurveModeInScript` (`:1004-1068`).

**Conversion write seam (D-01 / D-02 / D-12).** The existing writer already accepts a stroke with NO anchors — the compare is `stroke.anchors ?? []`:

```typescript
export function updateAquarellePathInScript(
  mutationId: number,
  anchors: readonly AquarelleAnchor[],
): number {
  if (!Number.isFinite(mutationId)) return 0;
  const stroke = recordedStrokes.get(mutationId);
  const entry = recordedStrokeEntries.get(mutationId);
  if (!stroke || !entry || deletedAquarelleStrokeIds.has(mutationId)) return 0;
  const index = payloadTimeline.indexOf(entry);
  if (index < 0) return 0;
  const normalised = normaliseAquarelleAnchors(anchors);
  if (normalised === undefined) return 0;
  const nextAnchors = projectVectorPath(normalised);
  if (anchorsEqual(stroke.anchors ?? [], nextAnchors)) return 0;
  ...
  const nextStroke: AquarelleStroke = { ...stroke, points: nextPoints, anchors: nextAnchors };
  const nextEntry = toStudioStroke(nextStroke);
  recordedStrokes.set(mutationId, nextStroke);
  recordedStrokeEntries.set(mutationId, nextEntry);
  payloadTimeline[index] = nextEntry;
  bumpAquarelleStrokesRevision();
  return 1;
}
```

Phase 62 extends this one function (or adds a conversion-aware sibling in the same module) with:
- optional `curveMode` written CONDITIONALLY, copying the exact delete-then-set idiom from `updateAquarelleCurveModeInScript:1054-1059`:
  ```typescript
  delete nextStroke.curveMode;
  if (mode !== DEFAULT_AQUARELLE_CURVE_MODE) nextStroke.curveMode = mode;
  ```
- D-07/D-08 re-sampling instead of `resampleVectorPaintPoints` + `vectorSpinePressures`
- the pre-conversion `points` count as the D-08 input

**Invariants to preserve:** resolve-before-mutate, same timeline index (`payloadTimeline[index] = nextEntry`, never splice), regenerate through `toStudioStroke`, one `bumpAquarelleStrokesRevision()`, return `0` for a no-op.

---

### 6. `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` (store, event-driven) — MODIFY

**Analog:** itself. `beginAquarellePathEdit` (`:1067-1078`) is already the one-gesture/one-ledger wrapper:

```typescript
export function beginAquarellePathEdit(
  mutationId: number,
  anchors: readonly AquarelleAnchor[],
): number | null {
  clearAquarelleStrokeDrag();
  if (aquarelleScriptEditInFlight) return null;
  if (!Number.isFinite(mutationId)) return null;
  const before = captureAquarelleSnapshot();
  if (updateAquarellePathInScript(mutationId, anchors) === 0) return null;
  const after = captureAquarelleSnapshot();
  return storeAquarelleEdit({ before, after });
}
```

D-12 needs one thing from this wrapper: the `before` snapshot must be captured BEFORE the conversion, so one undo restores the hand-recorded `points` AND the pre-edit bake. The snapshot already includes the stroke registry by reference (`:792-820`, `captureAquarelleStrokeRegistry` at `aquarelleRecordState.ts:591`), so if the conversion goes through `updateAquarellePathInScript` no extra work is needed — but the conversion must NOT be split into two edit ids. Extend the signature rather than adding a second wrapper that records separately (T-61-33 law: one entry per gesture).

Add the eligibility read alongside the existing appearance read (`:253-270`) so the gate's new predicate has ONE source of truth.

---

### 7. `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` (service, request-response) — MODIFY (D-13)

**Analog:** itself (`runAquarelleScriptRebake`, `:94-126`) plus the commit-time staleness epoch in `roto/rotoLivePixelCacheTransactions.ts`.

The cancellation token hangs off the existing terminal-callback contract. Today the sequence is a closed interface:

```typescript
export interface AquarelleScriptRebakeSequence {
  readonly isInFlight: () => boolean;
  readonly beginInFlight: () => void;
  readonly endInFlight: () => void;
  readonly resetSheet: () => void;
  readonly applyTimeline: () => Promise<boolean>;
  readonly onSuccess?: () => void;
  readonly onFailure?: () => void;
}

export async function runAquarelleScriptRebake(sequence: AquarelleScriptRebakeSequence): Promise<boolean> {
  if (sequence.isInFlight()) return false;
  sequence.beginInFlight();
  let ok = false;
  try {
    await yieldForPaint();
    sequence.resetSheet();
    ok = await sequence.applyTimeline();
  } catch {
    ok = false;
  } finally {
    sequence.endInFlight();
  }
  await yieldForPaint();
  if (ok) sequence.onSuccess?.();
  else sequence.onFailure?.();
  return ok;
}
```

**Cancellation shape to copy:** the live-pixel transactions module already solves "the operation resolved but a newer event must win" with a synchronous epoch checked at BOTH the produce and the commit turn (`rotoLivePixelCacheTransactions.ts:26-50`, `:172-183`, `:198-203`):

```typescript
/**
 * 261029-lsr: commit-time identity beyond the per-key revision (the script
 * epoch). A stroke undo swaps the script and re-bakes WITHOUT moving
 * `contentRevision`, so the per-key revision alone cannot kill a capture
 * queued before that undo. Absent = no extra gate.
 */
isStillCurrent?: () => boolean;
```

```typescript
isStillWanted: (stage) => {
  if (input.isStillCurrent !== undefined && !input.isStillCurrent()) { ... return false; }
  ...
}
```

Phase 62's token should be the same shape: a monotonic epoch/token captured before the bake, re-checked after the apply resolves. If cancelled, `runAquarelleScriptRebake` must resolve `false` and call NEITHER `onSuccess` nor `onFailure` publishes — the Studio's undo path already restored the script and sheet, and no ledger entry may be written. Keep the "already in flight → return false without touching anything (fail closed)" property (`:96-98`).

Also preserve the `MessageChannel`/`yieldForPaint` helpers (`:42-92`) untouched — they are the paint-visibility contract, not this phase's business.

---

### 8. `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (controller, request-response) — MODIFY

**Analog:** itself. Four seams.

**(a) `commitAquarelleVectorPathEdit` (`:10266-10355`)** — the ONE commit. The guard order and the post-await Draft read are the pattern:

```typescript
const commitAquarelleVectorPathEdit = useCallback(async (mutationId: number, anchors: readonly AquarelleAnchor[]): Promise<number | null> => {
  if (isPhysicalMutationLocked()) return null;
  if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return null;
  if (isAquarelleScriptEditInFlight()) return null;
  const playFrame = launchContextRef.current?.startFrame ?? 0;
  await ensureAquarelleDurableBaseRef.current(playFrame);
  // WR-03: read Draft only AFTER the await; `.peek()` never subscribes.
  const draft = draftMode.peek();
  const wireframe = wireframeMode.peek();
  const editId = beginAquarellePathEdit(mutationId, anchors);
  if (editId === null) return null;
  if (draft || wireframe) {
    rotoMoveHistory.recordAquarelleScriptEdit(editId);
    setDraftPixelsDirty(true);
    ...
    return editId;
  }
  setApplyStatus('applying');
  const ok = await runAquarelleScriptRebake({ ... });
  return ok ? editId : null;
}, [...]);
```

Phase 62 changes inside this callback only: the conversion arguments (curveMode + sample count + original pressures), the cancellation token, and the required "no ledger entry on cancel" route (D-13). Do NOT fork a second commit entry point — the same function is already reached by the overlay, the Vertex-size row (`:11747`) and the Corner row (`:11771`).

**(b) `handleAquarelleVectorPathEdit` (`:10365-10377`)** — currently refuses any anchorless stroke:

```typescript
const handleAquarelleVectorPathEdit = useCallback(
  async (mutationId: number, anchors: readonly AquarelleAnchor[]): Promise<number | null> => {
    const stroke = getRecordedAquarelleStroke(mutationId);
    if (!stroke || normaliseAquarelleAnchors(stroke.anchors) === undefined) {
      setApplyMessage(VECTOR_PATH_REJECTION_MESSAGE);
      ...
      return null;
    }
    return commitAquarelleVectorPathEdit(mutationId, anchors);
  },
  [commitAquarelleVectorPathEdit],
);
```

This refusal branch becomes the conversion gate: eligible = `tool !== 'lift'` AND a readable `points` array. The named-refusal copy convention is `VECTOR_PATH_REJECTION_MESSAGE` (`:378`, a module constant, never interpolated).

**(c) `bakeAquarelleVectorCommit` (`:8728-8763`)** — the draw-time bake; NOT the edit route. Its `resolveVectorCommitRoute` deferral (`aquarelleVectorPathCommit.ts:28-30`) is the D-14 reference: "nothing is baked while the wireframe is on".

**(d) `readVectorAnchors` bundle read (`:11714-11719`)** — the gate's ONE read seam:

```typescript
readVectorAnchors: (ids) => {
  if (ids.length !== 1) return null;
  const stroke = getRecordedAquarelleStroke(ids[0]!);
  if (!stroke) return null;
  return normaliseAquarelleAnchors(stroke.anchors) ?? null;
},
```

D-10 requires a sibling/complement read (e.g. `readPathEditEligibility`) resolved from the SAME `getRecordedAquarelleStroke` call — never a second record-store walk inside the dialog.

**(e) Recovered pre-script base (CONTEXT §D-01/Domain).** `ensureAquarelleDurableBaseRef.current(playFrame)` (`:7872-7873`) is already awaited before the edit; the fail-closed law is `resolveScriptBase`'s `durable-base-unknown` (`roto/aquarelleScriptBaseAuthority.ts:74-98`). Zero writes on `ok: false` — the existing `await`-then-guard order already encodes this; do not add a second base resolver.

---

### 9. `app/src/components/physic-paint/view/strokeSettingsModel.ts` (model, transform) — MODIFY (D-10)

**Analog:** itself, `resolvePathEditGate` (`:776-815`):

```typescript
export const PATH_EDIT_LABEL = 'Edit path';
export const PATH_EDIT_SINGLE_DISABLED_REASON = 'Edit path — select one vector stroke';
export const PATH_EDIT_MULTI_DISABLED_REASON = 'Edit path — select a single vector stroke';

export interface PathEditGateArgs {
  readonly selectionSize: number;
  readonly vectorStrokeCount: number;
  readonly selectedMutationId: number | null;
  readonly pathEditMutationId: string | null;
}

export function resolvePathEditGate(args: PathEditGateArgs): PathEditGate {
  const enabled = args.selectionSize === 1 && args.vectorStrokeCount === 1;
  return {
    enabled,
    title: enabled ? PATH_EDIT_LABEL : args.selectionSize > 1 ? PATH_EDIT_MULTI_DISABLED_REASON : PATH_EDIT_SINGLE_DISABLED_REASON,
    pressed: args.selectedMutationId !== null && args.pathEditMutationId === String(args.selectedMutationId),
  };
}
```

The extension keeps the same shape: add an eligible-painted count (or an `editablePathCount`) to `PathEditGateArgs`, add a `PATH_EDIT_LIFT_DISABLED_REASON` / degenerate constant, keep `title` a model constant so the button never inlines copy, and keep the string-vs-number id comparison (`pressed`). `shouldExitPathEdit` (`:859-865`) must keep its own target comparison — the gate answers only "may the button be pressed".

---

### 10. `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` (component, request-response) — MODIFY

**Analog:** itself, the spline-pointer button (`:978-1007`):

```tsx
<button
  type="button"
  data-testid="stroke-settings-spline-pointer"
  class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle"
  aria-pressed={pathEditGate.pressed}
  aria-label="Edit path"
  title={pathEditGate.title}
  disabled={!pathEditGate.enabled}
  onPointerDown={(event) => event.stopPropagation()}
  onClick={() => {
    if (pathEditGate.pressed) { exitPathEdit(); return; }
    const target = selectedMutationId;
    if (target === null) return;
    enterPathEdit(String(target));
  }}
>
  <SplinePointer size={12} aria-hidden="true" />
</button>
```

D-06 adds the fit trigger to the same `enterPathEdit` action (the dialog is a leaf; the Studio bundle owns reads) — do NOT add a second button or a second entry path. The render-body marker + lifecycle-effect pattern (`:449-500`, `:536-567`) is the ONLY place a render-body decision can schedule a session write; keep the new bracket restore on that same effect.

---

### 11. `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` (component, event-driven) — MODIFY (D-06 ghost, no-forked-editor)

**Analog:** itself.

**Edit-target resolution (`:879-896`)** currently SKIPS any stroke without anchors — the exact reason a painted stroke cannot be edited today:

```typescript
for (const [mutationId, candidate] of recordedStrokes) {
  if (String(mutationId) !== editMutationId) continue;
  if (isAquarelleStrokeDeleted(mutationId)) continue;
  const candidateAnchors = candidate.anchors;
  if (candidateAnchors === undefined || candidateAnchors.length === 0) continue;
  editTargetMutationId = mutationId;
  editTargetAnchors = candidateAnchors;
  editTargetCurveMode = resolveAquarelleCurveMode(candidate.curveMode);
  break;
}
```

Phase 62's fallback: when the session holds a fit for this stroke, use the held anchors instead of `candidate.anchors`. The overlay still never writes, records or bakes (`:1-30`).

**Structure visibility law (`:934-963`)** — the ghost belongs to the same "construction chrome" branch:

```typescript
const showStructure = penActive || editTargetMutationId !== null || wireframe;
...
const drawn = drawnPathOf(`stroke-${mutationId}`, anchors, props.width, props.height, {
  alwaysEnvelope: wireframe,
  color: typeof stroke.color === 'string' && stroke.color.length > 0 ? stroke.color : null,
  selected: editMutationId !== null && String(mutationId) === editMutationId,
  curveMode: resolveAquarelleCurveMode(stroke.curveMode),
});
```

The faint original spine draws as a second `drawnPathOf`-style projection of the ORIGINAL recorded points (`stroke.points`) — the same layer-pixel frame (`uvToScreen`), a new low-opacity constant beside `SELECTED_SPINE_COLOR`/`OWNED_CONTROL_COLOR` (`:95-114`), z-index 41.

**Gesture commit** stays one call per gesture (`:1173`, `:1206`, `:1265`), and the clear-before-commit law (T-61-30) must not be touched.

---

### 12. `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` + `engine/PhysicsPaintCanvasMount.tsx` (prop plumbing) — MODIFY

**Analog:** itself. The path-edit prop crosses three layers by ref, never as a re-rendering prop:

```typescript
// PhysicsPaintCanvasMount.tsx:73
onAquarelleVectorPathEdit?: (mutationId: number, anchors: readonly VectorAnchor[]) => Promise<number | null>;
// :91, :111
const onAquarelleVectorPathEditRef = useRef(props.onAquarelleVectorPathEdit);
onAquarelleVectorPathEditRef.current = props.onAquarelleVectorPathEdit;
// :235
onEditVectorPath={(mutationId, anchors) => onAquarelleVectorPathEditRef.current?.(mutationId, anchors)}
```

```tsx
// AquarelleCanvasLayer.tsx:1038-1046
<VectorPathOverlay
  ...
  onPathEdit={(mutationId, anchors) => onEditVectorPathRef.current?.(mutationId, anchors)}
/>
```

The ghost needs the original points; add them to the SAME `getRecordedStrokes` read the overlay already performs (`VectorPathOverlayProps.getRecordedStrokes`, `:126`) rather than threading a new getter through this chain. The mount memo is identity-sensitive (`PhysicsPaintStudio.tsx:10385`), so any new prop must be a stable `useCallback`/ref.

---

### 13. Tests

**Analog:** `app/src/components/physic-paint/view/vectorPathHandles.test.ts`, `view/aquarelleVectorPathCommit.test.ts`, `view/aquarelleRecordState.path.test.ts`, `engine/VectorPathOverlay.test.ts`, `view/strokeSettingsModel.test.ts`, `PhysicsPaintStudio.test.ts`.

Conventions to copy:
- Vitest only, `.test.ts` (NOT `.test.tsx` — a `.test.tsx` target exits 0 while running nothing in this repo).
- Leaf-first: everything testable without mounting the Studio (`aquarelleVectorPathCommit.test.ts:1-13` states the three leaf contracts).
- Static seam pins live in `PhysicsPaintStudio.test.ts` as string assertions on the source bundle (e.g. `:6511` `expect(commit.split('beginAquarellePathEdit(').length - 1).toBe(1)`); Phase 62's "ONE commit seam / no forked editor" law should be pinned the same way — one `runAquarelleScriptRebake` call site inside the commit, one `beginAquarellePathEdit`.
- Fixed-copy assertions (never interpolated, no `${`).

## Shared Patterns

### One ledger entry per gesture (D-12)
**Source:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:1067-1078` + `roto/aquarelleScriptReplay.ts:69-151`
**Apply to:** the conversion commit, every subsequent anchor edit on a converted stroke
```typescript
const before = captureAquarelleSnapshot();
if (updateAquarellePathInScript(mutationId, anchors) === 0) return null;
const after = captureAquarelleSnapshot();
return storeAquarelleEdit({ before, after });
```
A zero-change write returns `0` → no id → no ledger entry. Never one entry per anchor (T-61-33).

### Fail-closed durable base
**Source:** `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts:74-98`
**Apply to:** the conversion commit and the re-bake
```typescript
if (typeof resolutionKeyId !== 'string' || resolutionKeyId.length === 0) return UNKNOWN;
if (lookup.isRevealKey(resolutionKeyId)) return { ok: true, kind: 'reveal', persistPin: false };
const persisted = lookup.persistedDurableBase(resolutionKeyId);
if (persisted !== undefined) return entryResolution(persisted);
const session = lookup.sessionDurableBase(resolutionKeyId);
if (session !== undefined) return entryResolution(session);
if (lookup.hasRecordedStrokes(resolutionKeyId)) return UNKNOWN;
```
`durable-base-unknown` ⇒ the caller performs ZERO writes.

### Undo/replay order (D-13 context)
**Source:** `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts:69-127`
**Apply to:** the undo path that must cancel an in-flight bake
```typescript
// (1) Synchronous, before ANY await: kill queued pre-undo captures.
ports.invalidate();
// (2) Base recovery precedes the build (R-1).
await ports.ensureBase();
...
// (6) One shared Apply; a false or rejected bake rolls the script back.
```
The 'invalidate' step is the precedent for the cancellation token: a synchronous epoch write before any await, re-checked by the bake before it publishes.

### Conditional canonical terms
**Source:** `packages/efx-watercolor/src/payload/toStudioStroke.ts:184-190` and `payload/vectorPath.ts:103-112`
**Apply to:** the conversion write
```typescript
...(s.anchors !== undefined ? { anchors: projectVectorPath(s.anchors) } : {}),
...(s.curveMode !== undefined ? { curveMode: s.curveMode } : {}),
```
```typescript
export function recordedCurveModeField(curveMode: AquarelleCurveMode): { curveMode?: AquarelleCurveMode } {
  return curveMode === DEFAULT_AQUARELLE_CURVE_MODE ? {} : { curveMode }
}
```
Write a key ONLY when present / non-default; an untouched document keeps byte-identical output (REL-02).

### Compare-then-write session setters
**Source:** `app/src/components/physic-paint/view/vectorPathLatches.ts:78-94`
**Apply to:** every new session signal (held fit, ghost, previous-wireframe value)
```typescript
export function writeIfChanged<T>(target: Signal<T>, next: T): boolean {
  if (target.peek() === next) return false;
  target.value = next;
  return true;
}
```

### One source cache entry serves every occurrence (D-11)
**Source:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:158-175`
**Apply to:** the conversion invalidation — nothing to add, this is the existing behaviour to rely on and pin
```
Phase 43 (D-26/D-27): linked Loop Clip occurrences resolve through the SAME
'real' variant as their source key — `keyId` is the source keyId and the
cache revision is source-scoped (`${contentRevision}:real:${sourceKeyId}`),
so one source cache entry serves every occurrence and one source edit
invalidates them all.
```

### Single-flight bake latch + terminal callback
**Source:** `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts:94-126`
**Apply to:** the conversion bake (one success XOR one failure; never both, never a throw to the caller)

### Pure geometry leaves: no Preact, no DOM, no engine
**Source:** `packages/efx-watercolor/src/vector/spine.ts:31-33`, `view/vectorPathHandles.ts:22-25`, `view/aquarelleStrokeBand.ts:24-28`
**Apply to:** `vectorPathFit.ts`, the D-07/D-08 helpers, any ghost geometry
Everything numeric is unit-testable without a webview — important because vitest is blind to the Tauri DOM-fallback branch.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vectorPathFit.ts` — the curvature-adaptive interpolating fit itself | utility | transform | No interpolating/curvature-decimating fitter exists. `app/src/lib/bezierPath.ts` is a least-squares `fit-curve` wrapper explicitly rejected by D-04; only its tolerance-clamp shape is reusable. The curvature signal (`turn load`) does exist in `vectorPathHandles.ts:811-844` and should be re-read as the density heuristic. |
| `vectorPathCurveBracket.ts` — entry/exit bracket that snapshots and restores a view setting | store | event-driven | No existing "remember a view setting for the duration of a mode" helper. Build it from `scriptStrokeEdition.ts`'s wireframe single-flight + `vectorPathLatches.ts`'s compare-then-write. |

## Metadata

**Analog search scope:** `app/src/components/physic-paint/{view,engine,roto,performance}`, `packages/efx-watercolor/src/{vector,payload}`, `app/src/lib`, `app/src-tauri/src/models`

**Files scanned:** 20 source files + 6 test files (all git-tracked; no `.gsd/capabilities` mirrors used)

**Key constraints carried into every assignment:**
- No new `.mce` field, no new runtime dependency (REL-01/REL-02; D-02)
- Session view state never enters the document/revision/cache key (Phase 60/61 D-16)
- Path edit stays single-stroke; no forked editor surface
- Preserve the `vectorPathEditDrag` / clear-before-commit / pointer-capture laws in the overlay
- Do not re-read the same line range; large resolvers (`physicsPaintRotoPhysicalResolver.ts`, 7.3k lines) were only searched, not loaded

**Pattern extraction date:** 2026-11-14
