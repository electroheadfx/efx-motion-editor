# Phase 42: PlayScript Application Modes + Color Override - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 11 (3 new, 8 extended)
**Analogs found:** 10 / 11 (segmented radiogroup control has no in-repo analog — W3C APG pattern per RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts` | service (schedule module) | transform | `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` | exact (sibling) |
| `packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` | test | transform | `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.test.ts` | exact (sibling) |
| `packages/efx-physic-paint/src/animation/index.ts` | config (barrel export) | — | itself (current 7 lines) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | controller | request-response (authority→render→commit) | itself (extend in place); session-signal precedent: `app/src/stores/soloStore.ts` | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | test | request-response | itself (harness pattern) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` | service | batch transform (staged frames) | itself (extend in place) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` | test | batch transform | itself (vi.mock harness) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | component | request-response (dialog) | itself; Motion sliders: `PhysicsPaintRightPanel.tsx` `PanelSlider`; picker mount: `CanvasArea.tsx` | role-match |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | component | request-response (panel) | itself (toolbar/status structure) | exact |
| `app/src/components/physic-paint/physicsPaintStudio.css` | config (styles) | — | itself (`.physics-paint-play-script-*` scope, lines 1216-1304) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | test | component | `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` | role-match |

## Pattern Assignments

### `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts` (NEW — schedule module, transform)

**Analog:** `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` (sibling; progressive module is regression-locked — never branch it, mirror its shape in a new file)

**Imports + type pattern** (lines 1-13):
```typescript
import type { PaintStroke } from '../types'
import type { FrameStroke } from './types'

export type ProgressiveStrokeTransform = (
  stroke: PaintStroke,
  frameIndex: number,
  strokeIndex: number,
) => PaintStroke

export interface ProgressiveStrokeFrame {
  stroke: PaintStroke
  pointCount: number
}
```
Copy this shape with `Static` names (e.g. `StaticStrokeTransform`, `StaticStrokeFrame`) — or reuse the existing `FrameStroke` type from `./types` where it fits.

**Builder signature pattern** (lines 15-21):
```typescript
/** Build the canonical progressive schedule shared by timed and offline playback. */
export function buildProgressiveStrokeSchedule(
  strokes: readonly PaintStroke[],
  frameCount: number,
): FrameStroke[] {
  const usableFrames = Math.max(1, Math.trunc(frameCount))
  if (strokes.length === 0) return []
```
Static/hold mirror: same `(strokes, frameCount)` input contract; every stroke gets `startFrame: 0, endFrame: usableFrames - 1, pointsPerFrame: stroke.points.length`.

**Frame accessor pattern** (lines 83-108):
```typescript
/** Reveal one cumulative frame from a schedule, with an optional render-time transform. */
export function getProgressiveFrameStrokes(
  schedule: readonly FrameStroke[],
  frameIndex: number,
  transform?: ProgressiveStrokeTransform,
): ProgressiveStrokeFrame[] {
  // ...
  strokes.push({
    stroke: transform?.(entry.stroke, frameIndex, strokeIndex) ?? entry.stroke,
    pointCount,
  })
```
Copy the `(schedule, frameIndex, transform?)` triple exactly — the renderer's per-frame callback seam depends on it. Static accessor returns every stroke with full `pointCount` on every frame.

**Style notes:** package files use no semicolons, single quotes, named exports, JSDoc on public functions.

---

### `packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` (NEW — package test)

**Analog:** `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.test.ts`

**Full test scaffolding pattern** (lines 1-14):
```typescript
import { describe, expect, it } from 'vitest';
import type { PaintStroke, PenPoint } from '../types';
import { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule';

const point = (index: number): PenPoint => ({ x: index, y: index * 2, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 1 });
const stroke = (color: string, points: number, timestamp: number, playFrame?: number): PaintStroke => ({
  tool: 'paint', color, timestamp, ...(playFrame === undefined ? {} : { playFrame }),
  points: Array.from({ length: points }, (_, index) => point(index)),
  params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
  physicsMode: color === '#physics' ? 'local' : null,
});
const reveal = (strokes: readonly PaintStroke[], frames: number, frame: number) => getProgressiveFrameStrokes(buildProgressiveStrokeSchedule(strokes, frames), frame);
```
Note: test files use semicolons (opposite of source files). Copy the `point`/`stroke` factories verbatim — they produce valid `PaintStroke` fixtures including erase-tool variants (`tool: 'erase'` needed for PLAY-02 tests).

**Run command (verified this session, 8 tests passed on the analog):**
```
NODE_PATH=app/node_modules app/node_modules/.bin/vitest --run --config /dev/null packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts
```

---

### `packages/efx-physic-paint/src/animation/index.ts` (MODIFY — additive barrel)

**Analog:** itself. Current content (all 7 lines):
```typescript
// @efxlab/efx-physic-paint/animation -- Animation sub-path export
export { AnimationPlayer } from './AnimationPlayer'
export { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule'
export type { ProgressiveStrokeFrame, ProgressiveStrokeTransform } from './progressiveStrokeSchedule'
export { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'
export type { AnimationConfig, AnimationState, AnimationStrokeStyleOverride, AnimationWiggleConfig, FrameStroke } from './types'
```
Pattern: append value-export line + type-export line for the static schedule. No build config change needed (tsup `animation` entry + app vite source alias already pick up `animation/index.ts` — verified `packages/efx-physic-paint/tsup.config.ts` and `app/vite.config.ts:157-160`).

---

### `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (EXTEND — controller, request-response)

**Analog:** itself (extend in place). Options ride the existing controller as signals — no new commit path.

**Imports pattern** (lines 1-16):
```typescript
import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type {
  PhysicPaintLaunchContext,
  PhysicPaintRotoAuthorityResult,
  // ...
} from '../../../types/physicPaint';
import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';
```

**Signal-group + derived computed pattern** (lines 82-112) — copy this for the new option signals (`mode`, `overrideColor`, `dialogMotion`, `repeatText`, `infinity`, retained `layerEndExclusive`):
```typescript
const confirmationOpen = signal(false);
const countText = signal('Max');
const capacity = signal(0);
const canonicalStart = signal<number | null>(null);
// ...
const parsedCount = computed(() => parseCount(countText.value, capacity.value));
const validationError = computed(() => parsedCount.value.error);
const destinationRange = computed(() => {
  const start = canonicalStart.value;
  const count = parsedCount.value.count;
  return start === null || count === null ? null : `F${start}–F${start + count - 1}`;
});
```

**Authority retention seam** (lines 123-127) — where the new `layerEndExclusive` signal is set (Pitfall 5):
```typescript
canonicalStart.value = authority.canonicalStart;
capacity.value = authority.capacity;
countText.value = 'Max';
confirmationOpen.value = true;
phase.value = 'idle'; status.value = `Max ${authority.capacity} · F${authority.canonicalStart}–F${authority.layerEndExclusive - 1}`;
```

**Renderer invocation seam** (lines 150-156) — where `mode`/`overrideColor`/dialog-Motion enter `renderRotoPlayScriptFrames`:
```typescript
const motion = { ...ports.getMotion() };
// ...
const staged = await renderRotoPlayScriptFrames({
  script: snapshot, frameCount: count, canonicalStart: start, motion, existingFrames, size: ports.getSize(), signal: abortController.signal,
  onProgress: (completed, total) => { if (generation === acceptedGeneration) { progress.value = { completed, total }; status.value = `Rendering ${completed} / ${total}`; } },
});
```
Phase 42: `motion` comes from dialog signals (initialized from `ports.getMotion()` on open, per D-06), not from the port at confirm time.

**Strict numeric parsing pattern** (lines 207-216) — mirror for Repeat/Cycle fields:
```typescript
function parseCount(value: string, capacity: number): { count: number | null; error: string | null } {
  const text = value.trim();
  if (!text) return { count: null, error: 'Enter a positive integer or Max.' };
  if (/^max$/i.test(text)) return capacity > 0 ? { count: capacity, error: null } : { count: null, error: 'No real-key capacity remains.' };
  if (!/^\d+$/.test(text)) return { count: null, error: 'Enter a positive integer or Max.' };
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count <= 0) return { count: null, error: 'Enter a positive integer or Max.' };
  if (count > capacity) return { count: null, error: `Maximum available count is ${capacity}.` };
  return { count, error: null };
}
```

**Public interface + return pattern** (lines 62-79, 204): add new signals to `RotoPlayScriptController` interface and the returned object literal — the dialog and panel consume only what the interface exposes.

**Session-memory precedent (D-10):** `app/src/stores/soloStore.ts` (entire file, 17 lines) — module-level signals, no persistence:
```typescript
import { signal, computed } from '@preact/signals';
const soloEnabled = signal(false);
export const soloStore = {
  soloEnabled,
  isSolo: computed(() => soloEnabled.value),
  // ...
};
```
For Play Script the signals live inside `createRotoPlayScriptController` (created once per Studio mount via `controllerRef` in `useRotoPlayScriptController.ts`), which gives the same session lifetime.

---

### `physicsPaintRotoPlayScriptController.test.ts` (EXTEND — test)

**Analog:** itself.

**Mock harness pattern** (lines 1-8):
```typescript
import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// ...
const rendered = vi.hoisted(() => vi.fn());
vi.mock('./physicsPaintRotoPlayScriptRenderer', () => ({ renderRotoPlayScriptFrames: rendered }));
```

**Ports harness pattern** (lines 40-67): `harness(overrides)` builds fake library/authority/commit with signals; `authority()` factory (lines 19-36) already includes `layerEndExclusive: 8` / `capacity: 4` — extend assertions on the new option signals and loop readout from these.

**Table-driven validation pattern** (lines 100-108) — copy for Repeat/Cycle field tests:
```typescript
it.each([
  ['', 'Enter a positive integer or Max.'], ['0', 'Enter a positive integer or Max.'], /* ... */
])('strictly rejects count %j without clamping', async (value, message) => {
  const test = harness(); await test.controller.openConfirmation(); test.controller.countText.value = value;
  expect(test.controller.validationError.value).toBe(message);
  expect(await test.controller.confirm()).toBe(false);
  expect(rendered).not.toHaveBeenCalled();
});
```

**Renderer-input assertion pattern** (line 116) — extend with `mode`/`overrideColor`:
```typescript
expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ script: expect.objectContaining({ /* ... */ }), frameCount: 4, canonicalStart: 4, motion: { deformation: 25, position: 40 } }));
```

---

### `physicsPaintRotoPlayScriptRenderer.ts` (EXTEND — service, batch transform)

**Analog:** itself. Only 2 progressive-specific lines today — the schedule build and the frame accessor call.

**Input interface pattern** (lines 11-23) — add `mode`, `overrideColor`:
```typescript
export interface RotoPlayScriptRenderInput {
  script: Readonly<RotoPaintScript>;
  frameCount: number;
  canonicalStart: number;
  motion: Readonly<{ deformation: number; position: number }>;
  existingFrames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
  size: Readonly<{ width: number; height: number }>;
  // ...
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}
```

**Schedule-selection seam** (lines 50-65) — the ONLY mode-specific block; everything else (engine init, alpha merge, PNG encode, memory guards, abort) is mode-agnostic:
```typescript
const strokes = flattenScriptStrokes(input.script);
const schedule = buildProgressiveStrokeSchedule(strokes, input.frameCount);

for (let frameIndex = 0; frameIndex < input.frameCount; frameIndex += 1) {
  throwIfAborted(input.signal);
  const destination = input.canonicalStart + frameIndex;
  const progressive = getProgressiveFrameStrokes(schedule, frameIndex, (stroke, _scheduleFrame, strokeIndex) => (
    stroke.points.length === 0
      ? stroke
      : transformRecordedStrokeForHeldPose(stroke, {
        destinationSourceFrame: destination,
        strokeIndex,
        deformation: input.motion.deformation,
        position: input.motion.position,
      })
  ));
```
Static/hold substitutes the sibling schedule/accessor pair at these two call sites.

**Color-override seam (Pitfall 2 — MUST apply AFTER the Motion transform):** wrap the transform result inside this same callback. The determinism seed hashes the original color (`recordedStrokeMotion.ts:51`: `` `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}` ``), so recolor-first changes geometry. New code pattern:
```typescript
const transformed = transformRecordedStrokeForHeldPose(stroke, { destinationSourceFrame: destination, strokeIndex, deformation: input.motion.deformation, position: input.motion.position });
return input.overrideColor !== null && transformed.tool !== 'erase'
  ? { ...transformed, color: input.overrideColor }
  : transformed;
```

**Stroke cloning / source immutability pattern** (lines 96-107):
```typescript
function flattenScriptStrokes(script: Readonly<RotoPaintScript>): PaintStroke[] {
  const strokes: PaintStroke[] = [];
  for (const brush of script.brushes) {
    strokes.push(cloneStroke(brush.primary));
    for (const continuation of brush.continuations ?? []) strokes.push(cloneStroke(continuation));
  }
  return strokes;
}
function cloneStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })), params: { ...stroke.params } };
}
```

**Guard patterns already in place (static/hold inherits free):** `MAX_FRAME_COUNT = 10_000`, `MAX_AGGREGATE_RGBA_BYTES = 512MB` (lines 8-9), `validateRenderInput` (109-121), `throwIfAborted` (123-125), canvas release in `finally` (77-80, 141-144).

---

### `physicsPaintRotoPlayScriptRenderer.test.ts` (EXTEND — test)

**Analog:** itself.

**Module-mock harness pattern** (lines 1-26) — add the static schedule exports to the animation mock:
```typescript
const harness = vi.hoisted(() => ({
  scriptAlpha: null as HTMLCanvasElement | null,
  merged: null as HTMLCanvasElement | null,
  merge: vi.fn(),
  encode: vi.fn(),
}));
vi.mock('@efxlab/efx-physic-paint', () => ({
  EfxPaintEngine: class {
    async init() {}
    setAnimationMode() {}
    setInputLocked() {}
    setBgMode() {}
    renderProgressiveAlphaFrame() { return harness.scriptAlpha; }
    destroy() {}
  },
}));
vi.mock('@efxlab/efx-physic-paint/animation', () => ({
  buildProgressiveStrokeSchedule: vi.fn(() => ({})),
  getProgressiveFrameStrokes: vi.fn(() => []),
  transformRecordedStrokeForHeldPose: vi.fn((stroke) => stroke),
}));
```

**Browser-global stubbing pattern** (lines 48-56):
```typescript
vi.stubGlobal('document', { createElement: vi.fn(() => ({ replaceChildren: vi.fn() })) });
vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callback(0); return 1; }));
vi.stubGlobal('cancelAnimationFrame', vi.fn());
```

New PLAY-02 cases: assert schedule selection by `mode`; assert override recolors paint strokes only (pass `tool: 'erase'` strokes through the mocked accessor); assert geometry parity — same transform input stroke (original color) regardless of override.

---

### `PhysicsPaintPlayScriptDialog.tsx` (EXTEND — component, dialog)

**Analog:** itself (structure/keyboard); Motion controls analog: `PanelSlider` in `PhysicsPaintRightPanel.tsx`; picker mount analog: `CanvasArea.tsx`.

**Dialog shell + focus-trap pattern** (lines 29-59) — all new markup stays inside `.physics-paint-play-script-dialog/-surface/-content`; roving tabindex for the radiogroup integrates with the existing trap query:
```tsx
<div
  ref={dialogRef}
  class="physics-paint-play-script-dialog"
  role="dialog"
  aria-modal="true"
  aria-labelledby="physics-play-script-title"
  onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); playScript.cancel(); return; }
    if (event.key === 'Enter' && !playScript.validationError.value && !playScript.canCancel.value) { /* ... */ }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
    // first/last wrap focus
  }}
>
```

**Signal-bound input pattern** (lines 65-79) — copy for Repeat/Cycle fields:
```tsx
<label for="physics-play-script-count">Frames</label>
<input
  ref={inputRef}
  id="physics-play-script-count"
  inputMode="numeric"
  value={playScript.countText.value}
  disabled={playScript.canCancel.value}
  aria-invalid={Boolean(playScript.validationError.value)}
  aria-describedby="physics-play-script-help physics-play-script-error"
  onInput={(event) => {
    playScript.countText.value = (event.currentTarget as HTMLInputElement).value;
  }}
/>
<span id="physics-play-script-help">Enter a positive integer or Max.</span>
{playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{playScript.validationError.value}</span> : null}
```

**Motion slider analog** — `PanelSlider` (`PhysicsPaintRightPanel.tsx:99-124`), including its 0-100 clamp (`clampWiggleValue`, lines 126-130 — matches `clampPercent` in `recordedStrokeMotion.ts:45-48`):
```tsx
function PanelSlider(props: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void; suffix?: string; disabled?: boolean }) {
  return (
    <label class="physics-paint-option-row" for={props.id}>
      <span class="physics-paint-right-label">{props.label}</span>
      <input id={props.id} type="range" min={props.min} max={props.max} value={props.value}
        disabled={props.disabled}
        onInput={(event) => props.onChange(Number((event.target as HTMLInputElement).value))} />
      <output>{props.value}{props.suffix ?? ''}</output>
    </label>
  );
}
```
Dialog Motion sliders write to controller dialog-Motion signals — NEVER to `updatePanelMotion` (D-06; it triggers interpolation regeneration, `PhysicsPaintStudio.tsx:1154-1158`).

**InlineColorPicker mount analog** — `CanvasArea.tsx:368-400` (props contract from `InlineColorPicker.tsx:11-16`):
```tsx
<InlineColorPicker
  color={paintStore.brushColor.value}
  opacity={paintStore.brushOpacity.value}
  onChange={(color: string, opacity: number) => { /* ... */ }}
  onClose={() => { paintStore.showInlineColorPicker.value = false; }}
/>
```
Props interface (verbatim):
```typescript
export interface InlineColorPickerProps {
  color: string;
  opacity: number;
  onChange: (color: string, opacity: number) => void;
  onClose: () => void;
}
```
**Pitfall 3:** the picker fires `onChange` on mount (`InlineColorPicker.tsx:38,71-76` — `isExternalUpdate` starts `false`). The dialog must own the "override exists" boolean and ignore the mount-time `onChange` (D-09: override exists only after a genuine user pick). Render the picker inline within the dialog content column (not a popover) to preserve the focus trap and CSS isolation.

**Segmented control (D-05):** NO in-repo analog (grep-verified in RESEARCH). Use W3C APG radio-group pattern: `role="radiogroup"` wrapper, two `role="radio"` children with `aria-checked`, roving `tabindex` (checked = 0, unchecked = -1), Left/Right arrows move focus AND check with wrap, helper line below via `aria-describedby`. Cited: https://www.w3.org/WAI/ARIA/apg/patterns/radio/

---

### `PhysicsPaintScriptsPanel.tsx` (EXTEND — component, panel)

**Analog:** itself.

**Two-line summary insertion point:** between the toolbar (lines 75-166) and the listbox (lines 167-208), per RESEARCH Open Question 2 recommendation. Panel structure:
```tsx
<div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Roto scripts">
  <div class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Roto script library actions">
    {/* ... IconButtons ... */}
  </div>
  {/* NEW: two-line read-only summary block here (D-07), projected from playScript signals */}
  <div class="physics-paint-scripts-list" role="listbox" aria-label="Saved Roto scripts">
  {/* ... */}
  <p class="physics-paint-scripts-status" aria-live="polite">{playScript.status.value ?? library.status.value}{/* ... */}</p>
```

**Disabled-reason / guarded-icon pattern** (lines 76-78, 230-234) — apply to any new panel control; also update the Play tooltip copy (Pitfall 8, line 78):
```tsx
<IconButton buttonRef={playButtonRef} label="Play Script" title={`Play Script — ${playScript.disabledReason.value ?? 'Generate progressive real Roto keys'}`} disabled={playScript.disabledReason.value !== null} disabledReason={playScript.disabledReason.value ?? undefined} descriptionId={playReasonId} onClick={() => { void playScript.openConfirmation(); }}><Play size={16} /></IconButton>
```
```tsx
function IconButton(props: { buttonRef?: Ref<HTMLButtonElement>; label: string; title: string; disabled?: boolean; disabledReason?: string; descriptionId?: string; onClick?: () => void; children: ComponentChildren }) {
  const button = <button ref={props.buttonRef} type="button" class="physics-paint-script-icon-button" aria-label={props.label} title={props.title} disabled={props.disabled} aria-describedby={props.disabledReason ? props.descriptionId : undefined} onClick={props.onClick}>{props.children}</button>;
  if (!props.disabledReason || !props.descriptionId) return button;
  return <span class="physics-paint-script-disabled-control" tabIndex={0} title={props.title} aria-describedby={props.descriptionId}>{button}<span id={props.descriptionId} class="physics-paint-sr-only">{props.disabledReason}</span></span>;
}
```

---

### `physicsPaintStudio.css` (EXTEND — styles)

**Analog:** itself — the isolated dialog scope (lines 1216-1304). All new rules use the `physics-paint-play-script-*` prefix inside this scope only (Pitfall 6; Phase 36.14 regression lesson).

```css
.physics-paint-play-script-dialog {
  position: relative;
  z-index: 12;
  grid-row: 2;
  grid-column: 2;
  align-self: stretch;
  justify-self: stretch;
  display: flex;
  min-width: 0;
  min-height: 0;
  inset: 0;
  overflow: hidden;
}

.physics-paint-play-script-surface {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  height: 100%;
  padding: clamp(24px, 4vw, 52px);
  border: 1px solid #d8d4ca;
  background: #f7f5ef;   /* light surface — do NOT inherit dark pane styles */
  color: #20242a;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
}

.physics-paint-play-script-content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
```
New controls (segmented control, swatch button, sliders, loop readout) get `.physics-paint-play-script-*` classes with the light-surface palette (`#f7f5ef` background, `#20242a` text, `#a9afb7` borders — see input rules at lines 1279-1288).

---

### `PhysicsPaintPlayScriptDialog.test.ts` (NEW — component test)

**Analog:** `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` (role-match; exists in `app/src/components/physic-paint/view/`). Follow the app vitest setup (`app/vitest.config.ts` includes `src/**/*.test.ts`). Cover: radiogroup semantics/arrow-key navigation (D-05), Original-colors default state, picker-open does not create an override (Pitfall 3 / D-09), mode-dependent Frames label (D-03), loop readout copy (D-13). No dialog test exists today — this is a Wave 0 gap.

## Shared Patterns

### Signals-first state (CLAUDE.md mandate + D-10)
**Source:** `physicsPaintRotoPlayScriptController.ts:82-112`; precedent `app/src/stores/soloStore.ts`
**Apply to:** All new option state (mode, overrideColor, dialogMotion, loop values, summary)
```typescript
import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
// raw signals + derived computed; components read .value directly — no useState/useEffect for option state
```

### Authority-gated commit (regression-locked, unchanged)
**Source:** `physicsPaintRotoPlayScriptController.ts:158-164, 227-230`
**Apply to:** Both modes identically — generation bounded by `capacity`; `buildPhysicalPublication` hard-validates `staged.length === count` and range < `layerEndExclusive`. Static/hold keeps `count` = cycle length (D-02/D-03); repeat never multiplies generation.

### Erase-stroke detection + color-only substitution (D-11)
**Source:** `packages/efx-physic-paint/src/types.ts:59` (`ToolType = 'paint' | 'erase'`), `:175` (`PaintStroke.color: string | null`); applied in renderer transform callback
**Apply to:** Color override in both modes — `transformed.tool !== 'erase'` gate; never use engine `AnimationStrokeStyleOverride` (`animation/types.ts:18-23` flattens tool/params — FORBIDDEN).

### Numeric field validation
**Source:** `physicsPaintRotoPlayScriptController.ts:207-216` (`parseCount` strict-regex)
**Apply to:** Repeat and Cycle frames fields — trim, `/^\d+$/`, safe-integer, positive, capacity-bound; error strings mirror the existing copy style.

### Color values
**Source:** `app/src/lib/colorUtils.ts` (hexToRgba/rgbaToHex/rgbToHsv/…, imported by `InlineColorPicker.tsx:3-6`)
**Apply to:** Override color formatting in summary/readout; colors only ever `'#rrggbb' | null` on `stroke.color` — never free text.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Segmented radiogroup control (inside `PhysicsPaintPlayScriptDialog.tsx`) | component | request-response | No radiogroup/segmented-control precedent anywhere in the app (grep-verified in RESEARCH). Use W3C APG radio pattern: https://www.w3.org/WAI/ARIA/apg/patterns/radio/ — markup/styling within dialog conventions is Claude's discretion (D-05 constraints: two options, helper line, arrow-key nav, roving tabindex). |

## Metadata

**Analog search scope:** `packages/efx-physic-paint/src/animation/`, `app/src/components/physic-paint/` (roto/, view/, hooks/), `app/src/components/sidebar/`, `app/src/components/layout/`, `app/src/stores/`, `app/src/lib/`
**Files scanned:** 14 read in full or targeted ranges (controller, renderer, both test files, dialog, panel, progressive schedule + test, animation index/types, recordedStrokeMotion, soloStore, InlineColorPicker, CanvasArea region, RightPanel region, physicsPaintStudio.css region)
**Pattern extraction date:** 2026-08-05
