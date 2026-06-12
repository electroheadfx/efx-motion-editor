# Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 16 new/modified files
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | component/orchestrator | event-driven, request-response, file-I/O | `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | exact-existing |
| `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` | component | event-driven, file-I/O | `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` | exact-existing |
| `app/src/components/physic-paint/PhysicsPaintTopBar.tsx` | component | event-driven | `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` | role-match |
| `app/src/components/physic-paint/PhysicsPaintToolRail.tsx` | component | event-driven | `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` | role-match |
| `app/src/components/physic-paint/PhysicsPaintRightPanel.tsx` | component | event-driven | `app/src/components/sidebar/InlineColorPicker.tsx` | role-match |
| `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` | component | event-driven, request-response | `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | role+flow-match |
| `app/src/components/physic-paint/physicsPaintDevExport.ts` | utility | transform, file-I/O | `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` + `app/src/types/physicPaint.ts` | flow-match |
| `app/src/components/physic-paint/physicsPaintSessionFile.ts` | utility | file-I/O, validation | `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` | exact-flow |
| `app/src/components/physic-paint/physicsPaintWorkflowState.ts` | utility | transform | `app/src/types/physicPaint.ts` | role-match |
| `app/src/components/physic-paint/physicsPaintStudio.css` | config/style | transform | `app/src/components/physic-paint/physicsPaintStudio.css` | exact-existing |
| `app/src/components/physic-paint/physicsPaintDevExport.test.ts` | test | request-response, transform | `app/src/types/physicPaint.test.ts` | role-match |
| `app/src/components/physic-paint/physicsPaintSessionFile.test.ts` | test | file-I/O, validation | `app/src/lib/physicPaintBridge.test.ts` | role+flow-match |
| `app/src/types/physicPaint.ts` | type contract/validation | transform, request-response | `app/src/types/physicPaint.ts` | exact-existing |
| `app/src/types/physicPaint.test.ts` | test | validation, request-response | `app/src/types/physicPaint.test.ts` | exact-existing |
| `app/src/lib/physicPaintBridge.ts` | bridge/orchestrator | event-driven, request-response | `app/src/lib/physicPaintBridge.ts` | exact-existing |
| `app/src/lib/physicPaintBridge.test.ts` | test | event-driven, request-response | `app/src/lib/physicPaintBridge.test.ts` | exact-existing |

## Pattern Assignments

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (component/orchestrator, event-driven + request-response)

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`

**Imports pattern** (lines 1-9):
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext } from '../../types/physicPaint';
import { clampPhysicPaintFrameCount, isPhysicPaintLaunchContext } from '../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT } from '../../lib/physicPaintBridge';
import { PhysicsPaintStudioToolbar, type PhysicsPaintStudioToolbarSettings } from './PhysicsPaintStudioToolbar';
import './physicsPaintStudio.css';
```

**Launch context parse/validation pattern** (lines 67-98):
```typescript
function parseLaunchContext(location: Location): PhysicPaintLaunchContext | null {
  const params = new URLSearchParams(location.search);
  appendParams(params, location.hash);

  const encodedContext = nonEmptyParam(params, 'context');
  if (encodedContext) {
    try {
      const parsed = JSON.parse(decodeURIComponent(encodedContext));
      if (isPhysicPaintLaunchContext(parsed)) return parsed;
    } catch {
      // Continue with flat query/hash parameters.
    }
  }

  const layerId = nonEmptyParam(params, 'layerId', 'layer', 'physicPaintLayerId');
  const operationId = nonEmptyParam(params, 'operationId', 'op', 'requestId');
  const startFrameRaw = nonEmptyParam(params, 'startFrame', 'frame', 'currentFrame');
  const startFrame = Number(startFrameRaw);
  if (!layerId || !operationId || !Number.isInteger(startFrame) || startFrame < 0) return null;
```

**Bridge detection and send pattern** (lines 100-149):
```typescript
async function detectBridgeMode(): Promise<BridgeMode> {
  try {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emit === 'function') return 'Tauri';
  } catch {
    // Browser fallback below is expected outside Tauri.
  }

  if (typeof window !== 'undefined' && (window.opener || typeof window.dispatchEvent === 'function')) {
    return 'Browser fallback';
  }

  return 'Unavailable';
}

async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: BridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, payload);
    return;
  }
```

**Canvas engine mounting pattern** (lines 151-188):
```typescript
function CanvasMountProbe(props: { width: number; height: number; onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void; onNativePenInputReady: (handler: (input: { pressure: number; tiltX?: number; tiltY?: number }) => void) => void }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const mounted = Boolean(shellRef.current?.querySelector('canvas'));
      props.onCanvasMounted(mounted);
      if (!mounted) setMountError(CANVAS_MOUNT_ERROR);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);
```

**Apply result/error handling pattern** (lines 305-334):
```typescript
const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
  if (!detail || detail.operationId !== activeOperationIdRef.current) return;
  if (applyTimeoutRef.current) {
    window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = null;
  }
  activeOperationIdRef.current = null;

  const ok = detail.ok ?? detail.success ?? false;
  if (!ok) {
    const message = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
    const diagnostic = detail.detail || detail.error;
    setApplyStatus('error');
    setApplyMessage(diagnostic ? `${message} ${diagnostic}` : message);
    setLastError(diagnostic ? `${message} ${diagnostic}` : message);
    return;
  }

  setApplyStatus('success');
  setLastError(null);
  void closePhysicsPaintWindow();
```
**Phase 36 deviation:** keep this status pattern but remove/replace the unconditional `closePhysicsPaintWindow()` call for `Save play` per D-15.

**Still apply payload pattern** (lines 413-446):
```typescript
const applyCanvas = useCallback(async () => {
  if (!engine || !launchContext || !readyToApply) return;

  try {
    setApplyStatus('applying');
    setApplyMessage('Applying physics paint output...');
    setLastError(null);
    const operationId = `${launchContext.operationId}:canvas:${Date.now()}`;
    activeOperationIdRef.current = operationId;
    const canvas = engine.exportCompositeCanvas();
    const payload: PhysicPaintApplyPayload = {
      operationId,
      kind: 'apply-canvas',
      layerId: launchContext.layerId,
      startFrame: launchContext.startFrame,
      editableState: engine.save(),
      renderedFrame: {
        frameIndex: 0,
        appFrame: launchContext.startFrame,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      },
    };
    await sendPhysicPaintApplyPayload(payload, bridgeMode);
    startApplyTimeout(operationId);
  } catch (error) {
```

**Play frame capture pattern** (lines 448-505):
```typescript
const applyPlayCanvas = useCallback(async () => {
  if (!engine || !launchContext || !readyToApply || !playerRef.current) return;

  const frameCount = clampPhysicPaintFrameCount(framesToApply);

  try {
    setApplyStatus('applying');
    setApplyMessage('Applying physics paint output...');
    setLastError(null);
    setIsPlaying(true);
    setAnimTotal(frameCount);
    setAnimFrame(0);
    const operationId = `${launchContext.operationId}:play:${Date.now()}`;
    activeOperationIdRef.current = operationId;

    const frames = await new Promise<RenderedFramePayload[]>((resolve, reject) => {
      const captured: RenderedFramePayload[] = [];
      const timeout = window.setTimeout(() => reject(new Error('Timed out while generating physics paint frames')), Math.max(15000, frameCount * 1000));
      playerRef.current?.play({
        frameCount,
        fps: 24,
        onFrame: (frameIndex: number, canvas: HTMLCanvasElement) => {
          setAnimFrame(frameIndex);
          captured.push({
            frameIndex,
            appFrame: launchContext.startFrame + frameIndex,
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          });
        },
```
**Phase 36 deviation:** replace hardcoded `fps: 24` with current project FPS from launch context or sequence-derived context.

---

### `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` (component, event-driven + file-I/O)

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx`

**Imports and settings contract pattern** (lines 1-21):
```typescript
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';

export interface PhysicsPaintStudioToolbarSettings {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  physicsMode: 'local' | null;
}

interface PhysicsPaintStudioToolbarProps {
  engine: EfxPaintEngine;
  onPlay?: (frameCount: number, fps: number) => void;
  onStop?: () => void;
  isPlaying?: boolean;
  animFrame?: number;
  animTotal?: number;
  onSettingsChange?: (settings: PhysicsPaintStudioToolbarSettings) => void;
  onError?: (message: string | null) => void;
}
```

**Initial engine sync pattern** (lines 102-116):
```typescript
useEffect(() => {
  engine.setColorHex(color);
  engine.setBrushSize(size);
  engine.setBrushOpacity(opacity);
  engine.setEdgeDetail(detail);
  engine.setPickup(pickup);
  engine.setEraseStrength(eraseStr);
  engine.setEmbossStrength(grainStr);
  engine.setPhysicsMode(physMode);
  engine.setLocalSpreadStrength(spreadStr);
}, [engine]);

useEffect(() => {
  onSettingsChange?.({ tool, color, size, opacity, physicsMode: physMode });
}, [color, onSettingsChange, opacity, physMode, size, tool]);
```

**Engine setter callback pattern** (lines 118-159):
```typescript
const selectTool = useCallback((nextTool: ToolType) => {
  setToolState(nextTool);
  engine.setTool(nextTool);
}, [engine]);

const onSize = useCallback((value: number) => { setSize(value); engine.setBrushSize(value); }, [engine]);
const onOpacity = useCallback((value: number) => { setOpacity(value); engine.setBrushOpacity(value); }, [engine]);
const onDetail = useCallback((value: number) => { setDetail(value); engine.setEdgeDetail(value); }, [engine]);
const onAntiAlias = useCallback((value: number) => { setAntiAlias(value); engine.setAntiAlias(value); }, [engine]);
const onPickup = useCallback((value: number) => { setPickup(value); engine.setPickup(value); }, [engine]);
const onEraseStr = useCallback((value: number) => { setEraseStr(value); engine.setEraseStrength(value); }, [engine]);
```

**Editable JSON save pattern** (lines 171-221):
```typescript
const onSave = useCallback(async () => {
  const data = engine.save();
  const serialized = JSON.stringify(data, null, 2);
  const filename = `efx-paint-state-${Date.now()}.json`;
  setSaveFeedback(null);

  try {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      const dialogModule = '@tauri-apps/plugin-dialog';
      const fsModule = '@tauri-apps/plugin-fs';
      const [{ save }, { writeTextFile }] = await Promise.all([
        import(/* @vite-ignore */ dialogModule) as Promise<{ save: (options: { defaultPath: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | null> }>,
        import(/* @vite-ignore */ fsModule) as Promise<{ writeTextFile: (path: string, contents: string) => Promise<void> }>,
      ]);
      const selectedPath = await save({
        defaultPath: filename,
        filters: [{ name: 'Physics paint state', extensions: ['json'] }],
      });
```

**Editable JSON load/validation pattern** (lines 227-247):
```typescript
const onFileChange = useCallback((event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result ?? ''));
      if (!isSerializedProject(parsed)) throw new Error(INVALID_STATE_COPY);
      engine.load(parsed);
      setLoadError(null);
      onError?.(null);
    } catch (error) {
      console.error('Failed to load project:', error);
      setLoadError(INVALID_STATE_COPY);
      onError?.(INVALID_STATE_COPY);
    }
  };
  reader.readAsText(file);
  (event.target as HTMLInputElement).value = '';
}, [engine, onError]);
```

**Grain strength choices pattern** (lines 323-337):
```typescript
<div class="g">
  <label>Grain</label>
  <div class="row">
    {([
      { label: 'None', value: 0 },
      { label: 'Soft', value: 0.45 },
      { label: 'Med', value: 0.7 },
      { label: 'Hard', value: 0.95 },
    ]).map(({ label, value }) => (
      <button class={`grain-btn${grainStr === value ? ' active' : ''}`} onClick={() => onGrainStr(value)}>
        {label}
      </button>
    ))}
  </div>
</div>
```
**Phase 36 deviation:** label must become `Grain strength`, choices remain exactly `None`, `Soft`, `Med`, `Hard`.

---

### `app/src/components/physic-paint/PhysicsPaintTopBar.tsx` (component, event-driven)

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx`

**Control grouping pattern** (lines 263-280):
```typescript
return (
  <div class="tb">
    <div class="g">
      <label>Tools</label>
      <div class="row">
        <button class={tool === 'paint' ? 'active' : ''} onClick={() => selectTool('paint')}>Paint</button>
        <button class={tool === 'erase' ? 'active' : ''} onClick={() => selectTool('erase')}>Erase</button>
      </div>
    </div>
    <div class="sep" />

    <div class="g">
      <label>Color</label>
      <input type="color" class="ci" value={color} onInput={onColor} />
    </div>

    <Slider label="Size" id="sz" min={1} max={80} value={size} onChange={onSize} />
    <Slider label="Opacity" id="op" min={10} max={100} value={opacity} onChange={onOpacity} />
```

**Status/error display pattern** (lines 388-392):
```typescript
<button onClick={onSave}>Save state</button>
<button onClick={onLoad} title="Loading a state file replaces the current canvas.">Load state</button>
<input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={onFileChange} />
{saveFeedback ? <div class={saveFeedback.type === 'error' ? 'toolbar-error' : 'toolbar-status'}>{saveFeedback.message}</div> : null}
{loadError ? <div class="toolbar-error">{loadError}</div> : null}
```

**Apply readiness/status source pattern** (lines 549-556 from `PhysicsPaintStudio.tsx`):
```typescript
<section class={`diagnostics-panel ${readyToApply ? 'ready' : 'not-ready'}`} aria-live="polite">
  <div class="diagnostics-header">
    <span class={`ready-badge ${readyToApply ? 'ready' : 'not-ready'}`}>
      {readyToApply ? 'Ready to apply' : 'Not ready to apply'}
    </span>
    {applyStatus === 'applying' ? <span class="busy-copy">Applying physics paint output...</span> : null}
    {applyMessage ? <span class={`apply-feedback ${applyStatus}`}>{applyMessage}</span> : null}
  </div>
```
**Phase 36 deviation:** keep compact `aria-live` status in top bar; remove the full diagnostics grid.

---

### `app/src/components/physic-paint/PhysicsPaintToolRail.tsx` (component, event-driven)

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx`

**Tool action callback pattern** (lines 118-144):
```typescript
const selectTool = useCallback((nextTool: ToolType) => {
  setToolState(nextTool);
  engine.setTool(nextTool);
}, [engine]);

const onSize = useCallback((value: number) => { setSize(value); engine.setBrushSize(value); }, [engine]);
const onOpacity = useCallback((value: number) => { setOpacity(value); engine.setBrushOpacity(value); }, [engine]);

const onColor = useCallback((event: Event) => {
  const hex = (event.target as HTMLInputElement).value;
  setColor(hex);
  engine.setColorHex(hex);
}, [engine]);
```

**Physics press-and-hold pattern** (lines 161-169):
```typescript
const physicsDown = useCallback((mode: 'last' | 'all') => {
  setPhysActive(mode);
  engine.startPhysics(mode);
}, [engine]);

const physicsUp = useCallback(() => {
  setPhysActive(null);
  engine.stopPhysics();
}, [engine]);
```

**Physics rail controls pattern** (lines 341-365):
```typescript
<div class="g">
  <label>Physics</label>
  <div class="row compact-row">
    <button class={physMode === 'local' ? 'active' : ''} onClick={() => onPhysMode('local')}>Local</button>
    <button class={physMode === null ? 'active' : ''} onClick={() => onPhysMode(null)}>Global</button>
  </div>
  <div class="row compact-row">
    <button
      class={physActive === 'last' ? 'physics-active' : 'physics-idle'}
      onMouseDown={() => physicsDown('last')}
      onMouseUp={physicsUp}
      onMouseLeave={physicsUp}
    >
      Last
    </button>
```
**Phase 36 addition:** map these actions to SVG assets from `SPECS/physics-paint-ui/icons/`; preserve action behavior and disabled states.

---

### `app/src/components/physic-paint/PhysicsPaintRightPanel.tsx` (component, event-driven)

**Analog:** `app/src/components/sidebar/InlineColorPicker.tsx`

**Imports and props pattern** (lines 1-16):
```typescript
import {useState, useEffect, useRef, useCallback} from 'preact/hooks';
import {X, Plus} from 'lucide-preact';
import {
  hexToRgba, rgbaToHex, rgbToHsl, hslToRgb,
  rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb,
} from '../../lib/colorUtils';
import {loadRecentColors, saveRecentColors, loadFavoriteColors, saveFavoriteColors} from '../../lib/paintPreferences';

export interface InlineColorPickerProps {
  color: string;
  opacity: number;
  onChange: (color: string, opacity: number) => void;
  onClose: () => void;
}
```

**External prop synchronization guard pattern** (lines 37-62):
```typescript
// Guard to distinguish external prop changes from internal user interactions
const isExternalUpdate = useRef(false);
const prevColorRef = useRef(color);
const prevOpacityRef = useRef(opacity);

// Sync from external color prop changes (only when prop actually changes from outside)
useEffect(() => {
  if (prevColorRef.current === color && prevOpacityRef.current === opacity) return;
  prevColorRef.current = color;
  prevOpacityRef.current = opacity;

  isExternalUpdate.current = true;
  const r = hexToRgba(color);
  const h = rgbToHsv(r.r, r.g, r.b);
  setHue(h.h); setSat(h.s); setVal(h.v);
  setAlpha(opacity);
  setHexInput(color);
  // Reset flag after microtask (after React batches state updates)
  queueMicrotask(() => { isExternalUpdate.current = false; });
}, [color, opacity]);
```

**User-only onChange pattern** (lines 70-76):
```typescript
// Fire onChange only on USER interactions (not external prop sync)
useEffect(() => {
  if (isExternalUpdate.current) return; // Skip if this was triggered by prop sync
  const hex = rgbaToHex(hsvToRgb(hue, sat, val).r, hsvToRgb(hue, sat, val).g, hsvToRgb(hue, sat, val).b);
  setHexInput(hex);
  onChange(hex, alpha);
}, [hue, sat, val, alpha]);
```

**Swatch persistence pattern** (lines 107-114 and 199-207):
```typescript
const addToRecent = useCallback((c: string) => {
  loadRecentColors().then(recents => {
    const updated = [c, ...recents.filter(r => r !== c)].slice(0, 16);
    saveRecentColors(updated);
    setRecentColors(updated);
  });
}, []);

const addToFavorites = useCallback(() => {
  loadFavoriteColors().then(favs => {
    if (favs.includes(currentHex)) return;
    const updated = [...favs, currentHex];
    saveFavoriteColors(updated);
    setFavoriteColors(updated);
  });
}, [currentHex]);
```

**Sidebar visual language pattern** (lines 346-358):
```typescript
return (
  <div
    class="flex flex-col gap-2 p-3"
    style={{
      width: '100%',
      backgroundColor: 'var(--sidebar-panel-bg)',
      overflow: 'hidden',
      height: '100%',
    }}
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
  >
```

**Hex validation/input pattern** (lines 168-190):
```typescript
const commitHex = useCallback(() => {
  const cleaned = hexInput.trim();
  const match = cleaned.match(/^#?([0-9a-fA-F]{3,8})$/);
  if (match) {
    let hex = match[1];
    // Expand 3/4 digit shorthand
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    else if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    if (hex.length >= 6) {
      const fullHex = `#${hex.substring(0, 6)}`;
      const rgb = hexToRgba(fullHex);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
      if (hex.length === 8) {
        setAlpha(parseInt(hex.substring(6, 8), 16) / 255);
      }
      addToRecent(fullHex);
    }
  } else {
    setHexInput(currentHex);
  }
}, [hexInput, currentHex, addToRecent]);
```

---

### `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` (component, event-driven + request-response)

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`

**Readiness derivation pattern** (lines 370-381):
```typescript
const missingConditions = useMemo(() => {
  const missing: string[] = [];
  if (!engine) missing.push('Engine is still initializing');
  if (!canvasMounted) missing.push('Canvas is still mounting');
  if (!launchContext) missing.push('No app layer context received');
  if (bridgeMode === 'Unavailable') missing.push('App bridge is not connected');
  if (applyStatus === 'applying' || isPlaying) missing.push('Apply operation is still running');
  return missing;
}, [applyStatus, bridgeMode, canvasMounted, engine, isPlaying, launchContext]);

const readyToApply = missingConditions.length === 0;
```

**Preview play/stop pattern** (lines 382-399):
```typescript
const handlePlay = useCallback((frameCount: number, fps: number) => {
  if (!playerRef.current) return;
  setIsPlaying(true);
  setAnimTotal(frameCount);
  setAnimFrame(0);
  playerRef.current.play({
    frameCount,
    fps,
    onFrame: (frameIndex) => setAnimFrame(frameIndex),
    onComplete: () => setIsPlaying(false),
  });
}, []);

const handleStop = useCallback(() => {
  if (!playerRef.current) return;
  playerRef.current.stop();
  setIsPlaying(false);
}, []);
```

**Apply timeout pattern** (lines 401-411):
```typescript
const startApplyTimeout = useCallback((operationId: string) => {
  if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current);
  applyTimeoutRef.current = window.setTimeout(() => {
    if (activeOperationIdRef.current !== operationId) return;
    setApplyStatus('error');
    setApplyMessage('Could not apply physics paint output. The main editor did not return an apply result.');
    setLastError('The main editor did not return an apply result.');
    activeOperationIdRef.current = null;
    applyTimeoutRef.current = null;
  }, 5000);
}, []);
```

**Existing bottom controls to move into workflow strip** (lines 573-584):
```typescript
<div class="apply-controls">
  <label for="frames-to-apply">Frames to apply</label>
  <input
    id="frames-to-apply"
    type="number"
    min={1}
    max={600}
    value={framesToApply}
    onInput={(event) => setFramesToApply(clampPhysicPaintFrameCount(Number((event.target as HTMLInputElement).value)))}
  />
  <button class="apply-button" disabled={!readyToApply} onClick={applyCanvas}>[apply canvas]</button>
  <button class="apply-button" disabled={!readyToApply} onClick={applyPlayCanvas}>[apply play canvas]</button>
</div>
```
**Phase 36 deviations:** rename `[apply canvas]` to `Save roto frame`, `[apply play canvas]` to `Save play`; place both in visible Roto/Play workflow tabs; add timeline rows without cloning the main editor timeline.

---

### `app/src/components/physic-paint/physicsPaintDevExport.ts` (utility, transform + file-I/O)

**Analogs:** `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx`, `app/src/types/physicPaint.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`

**Browser Blob download pattern** (lines 206-214 from toolbar):
```typescript
const blob = new Blob([serialized], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const anchor = document.createElement('a');
anchor.href = url;
anchor.download = filename;
anchor.click();
URL.revokeObjectURL(url);
setSaveFeedback({ type: 'success', message: SAVE_SUCCESS_COPY });
onError?.(null);
```

**Tauri save/write pattern** (lines 177-195 from toolbar):
```typescript
if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
  const dialogModule = '@tauri-apps/plugin-dialog';
  const fsModule = '@tauri-apps/plugin-fs';
  const [{ save }, { writeTextFile }] = await Promise.all([
    import(/* @vite-ignore */ dialogModule) as Promise<{ save: (options: { defaultPath: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | null> }>,
    import(/* @vite-ignore */ fsModule) as Promise<{ writeTextFile: (path: string, contents: string) => Promise<void> }>,
  ]);
  const selectedPath = await save({
    defaultPath: filename,
    filters: [{ name: 'Physics paint state', extensions: ['json'] }],
  });
  if (!selectedPath) {
    setSaveFeedback({ type: 'info', message: SAVE_CANCELLED_COPY });
    onError?.(null);
    return;
  }
  await writeTextFile(selectedPath, serialized);
```

**Rendered frame contract pattern** (lines 22-31 from types):
```typescript
export interface PhysicPaintRenderedFrame {
  /** Generated sequence-local frame index. For still applies this is 0. */
  frameIndex: number;
  /** Editor timeline frame that should receive this rendered output. */
  appFrame: number;
  /** Rendered PNG output only. Editable stroke/engine state is never transported here. */
  dataUrl: string;
  width?: number;
  height?: number;
}
```

**Captured frame source pattern** (lines 463-485 from studio):
```typescript
const frames = await new Promise<RenderedFramePayload[]>((resolve, reject) => {
  const captured: RenderedFramePayload[] = [];
  const timeout = window.setTimeout(() => reject(new Error('Timed out while generating physics paint frames')), Math.max(15000, frameCount * 1000));
  playerRef.current?.play({
    frameCount,
    fps: 24,
    onFrame: (frameIndex: number, canvas: HTMLCanvasElement) => {
      setAnimFrame(frameIndex);
      captured.push({
        frameIndex,
        appFrame: launchContext.startFrame + frameIndex,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      });
    },
```

**Validation constraints:** dev export must be a sidecar of captured payloads; do not add a second renderer, backend service, or headless batch replay.

---

### `app/src/components/physic-paint/physicsPaintSessionFile.ts` (utility, file-I/O + validation)

**Analog:** `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx`

**Serialized project validation pattern** (lines 33-44):
```typescript
function isSerializedProject(value: unknown): value is Parameters<EfxPaintEngine['load']>[0] {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { version?: unknown }).version === 2 &&
      typeof (value as { width?: unknown }).width === 'number' &&
      typeof (value as { height?: unknown }).height === 'number' &&
      Array.isArray((value as { strokes?: unknown }).strokes) &&
      typeof (value as { settings?: unknown }).settings === 'object' &&
      (value as { settings?: unknown }).settings !== null,
  );
}
```

**Save state helper source pattern** (lines 171-221):
```typescript
const onSave = useCallback(async () => {
  const data = engine.save();
  const serialized = JSON.stringify(data, null, 2);
  const filename = `efx-paint-state-${Date.now()}.json`;
  setSaveFeedback(null);

  try {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      const dialogModule = '@tauri-apps/plugin-dialog';
      const fsModule = '@tauri-apps/plugin-fs';
      const [{ save }, { writeTextFile }] = await Promise.all([
        import(/* @vite-ignore */ dialogModule) as Promise<{ save: (options: { defaultPath: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | null> }>,
        import(/* @vite-ignore */ fsModule) as Promise<{ writeTextFile: (path: string, contents: string) => Promise<void> }>,
      ]);
```

**Load state helper source pattern** (lines 227-247):
```typescript
const onFileChange = useCallback((event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result ?? ''));
      if (!isSerializedProject(parsed)) throw new Error(INVALID_STATE_COPY);
      engine.load(parsed);
      setLoadError(null);
      onError?.(null);
    } catch (error) {
      console.error('Failed to load project:', error);
      setLoadError(INVALID_STATE_COPY);
      onError?.(INVALID_STATE_COPY);
    }
  };
  reader.readAsText(file);
  (event.target as HTMLInputElement).value = '';
}, [engine, onError]);
```

---

### `app/src/components/physic-paint/physicsPaintWorkflowState.ts` (utility, transform)

**Analog:** `app/src/types/physicPaint.ts`

**Clamping utility pattern** (lines 75-82):
```typescript
export function clampPhysicPaintFrameCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return PHYSIC_PAINT_DEFAULT_APPLY_FRAMES;
  const integer = Math.trunc(numeric);
  if (integer < PHYSIC_PAINT_MIN_APPLY_FRAMES) return PHYSIC_PAINT_MIN_APPLY_FRAMES;
  if (integer > PHYSIC_PAINT_MAX_APPLY_FRAMES) return PHYSIC_PAINT_MAX_APPLY_FRAMES;
  return integer;
}
```

**Type guard composition pattern** (lines 97-118):
```typescript
export function isPhysicPaintApplyPayload(value: unknown): value is PhysicPaintApplyPayload {
  if (!isRecord(value) || containsForbiddenApplyField(value)) return false;

  if (!isBaseApplyPayload(value)) return false;

  if (!isSerializedProject(value.editableState)) return false;

  if (value.kind === 'apply-canvas') {
    return isPhysicPaintRenderedFrame(value.renderedFrame, value.startFrame, 0);
  }

  if (value.kind === 'apply-play-canvas') {
    const frameCount = value.frameCount;
    const frames = value.frames;
    if (typeof frameCount !== 'number' || !Number.isInteger(frameCount)) return false;
    if (frameCount < PHYSIC_PAINT_MIN_APPLY_FRAMES || frameCount > PHYSIC_PAINT_MAX_APPLY_FRAMES) return false;
    if (!Array.isArray(frames) || frames.length !== frameCount) return false;
    return frames.every((frame, index) => isPhysicPaintRenderedFrame(frame, value.startFrame + index, index));
  }
```

**Small predicate helpers pattern** (lines 175-189):
```typescript
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
```

---

### `app/src/components/physic-paint/physicsPaintStudio.css` (style config, transform)

**Analog:** `app/src/components/physic-paint/physicsPaintStudio.css`

**Shell/header style pattern** (lines 15-33):
```css
.demo-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 100vh;
}

.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px 6px 0 0;
  background: #1a1a1a;
}
```

**Canvas shell pattern** (lines 51-66):
```css
.demo-canvas-shell {
  position: relative;
  width: min(100%, 1280px);
}

.paint-canvas {
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.7);
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%),
    linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
}
```

**Error/status panel pattern** (lines 68-94):
```css
.demo-error,
.toolbar-error {
  margin: 12px 0 0;
  padding: 8px 12px;
  border: 1px solid rgba(255, 102, 102, 0.42);
  border-radius: 8px;
  color: #ff6666;
  background: rgba(70, 18, 18, 0.7);
  font-size: 13px;
  line-height: 1.5;
}

.toolbar-status {
  padding: 8px 12px;
  border: 1px solid rgba(106, 182, 255, 0.42);
  border-radius: 8px;
  color: #9ed0ff;
  background: rgba(18, 40, 70, 0.7);
```

**Button/active/disabled pattern** (lines 163-199):
```css
button {
  padding: 8px 16px;
  border: 1px solid #2a5588;
  border-radius: 4px;
  background: #1a3a5a;
  color: #c0ddf0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  transition: all 0.12s;
}

button.active {
  border-color: #2d5be3;
  background: #2d5be3;
  color: #fff;
}

button:disabled,
.disabled-control {
  opacity: 0.5;
  cursor: not-allowed;
  background: #111827;
  color: #6b7280;
}
```

**Phase 36 note:** Preserve app CSS-variable visual language from sidebar components where practical (`var(--sidebar-panel-bg)`, `var(--sidebar-text-secondary)`, `var(--color-accent)`) and remove `.diagnostics-grid` UI from the layout.

---

### `app/src/components/physic-paint/physicsPaintDevExport.test.ts` (test, transform)

**Analog:** `app/src/types/physicPaint.test.ts`

**Vitest imports and fixture pattern** (lines 1-24):
```typescript
import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
  isPhysicPaintApplyPayload,
  isPhysicPaintLaunchContext,
} from './physicPaint';

const renderedFrame = {
  frameIndex: 0,
  appFrame: 12,
  dataUrl: 'data:image/png;base64,aGVsbG8=',
  width: 1000,
  height: 650,
};

const editableState = {
  version: 2,
  width: 1000,
  height: 650,
  strokes: [],
  settings: {},
};
```

**Validation test style pattern** (lines 39-58):
```typescript
it('accepts rendered-output still and sequence payloads', () => {
  expect(isPhysicPaintApplyPayload({
    kind: 'apply-canvas',
    operationId: 'op-1',
    layerId: 'layer-1',
    startFrame: 12,
    renderedFrame,
    editableState,
  })).toBe(true);

  expect(isPhysicPaintApplyPayload({
    kind: 'apply-play-canvas',
    operationId: 'op-2',
    layerId: 'layer-1',
    startFrame: 12,
    frameCount: 1,
    frames: [renderedFrame],
    editableState,
  })).toBe(true);
});
```

**Negative test pattern** (lines 60-79):
```typescript
it('rejects editable engine internals in apply payloads', () => {
  expect(isPhysicPaintApplyPayload({
    kind: 'apply-canvas',
    operationId: 'op-1',
    layerId: 'layer-1',
    startFrame: 12,
    renderedFrame,
    strokes: [],
  })).toBe(false);
```

---

### `app/src/components/physic-paint/physicsPaintSessionFile.test.ts` (test, file-I/O + validation)

**Analog:** `app/src/lib/physicPaintBridge.test.ts`

**Mock lifecycle pattern** (lines 1-17 and 87-115):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore } from '../stores/physicPaintStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import type { PhysicPaintApplyPayload } from '../types/physicPaint';
```
```typescript
describe('physicPaintBridge', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    projectStore.closeProject();
```

**Fixture helper pattern** (lines 20-41):
```typescript
const editableState = {
  version: 2 as const,
  width: 1000,
  height: 650,
  strokes: [{
    tool: 'paint',
    pts: [[1, 2, 0.5, 0, 0, 0, 0] as [number, number, number, number, number, number, number]],
    color: '#103c65',
    params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 },
    time: 123,
    diffusionFrames: 0,
  }],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
};

const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
  width: 1000,
  height: 650,
});
```

**Mocked dynamic import/Tauri pattern** (lines 176-190):
```typescript
vi.doMock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: vi.fn().mockRejectedValue(new Error('permission denied')),
}));
const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');

const result = await openCanvas({ layer: physicLayer(), frame: 4 });

expect(result.ok).toBe(false);
if (!result.ok) expect(result.error).toContain('permission denied');
expect(window.open).not.toHaveBeenCalled();
```

---

### D-26 editor-side frame sync receiver analogs

**Applies to:** `app/src/types/physicPaint.ts`, `app/src/types/physicPaint.test.ts`, `app/src/lib/physicPaintBridge.ts`, `app/src/lib/physicPaintBridge.test.ts`

**Type contract analog:** `app/src/types/physicPaint.ts` already defines fail-closed message/payload guards such as `isPhysicPaintLaunchContext` and `isPhysicPaintApplyPayload`. Add D-26 frame-sync message contracts beside those guards, using the same `isRecord`, non-empty string, and non-negative integer validation style. The receiver message should be namespaced, for example `type: 'physic-paint:seek-frame'`, and must reject negative, fractional, non-finite, string, and missing frames before any timeline mutation.

**Bridge receiver analog:** `app/src/lib/physicPaintBridge.ts` already validates external bridge payloads before mutating editor stores through `applyPhysicPaintPayload`. Follow that fail-closed pattern for `handlePhysicPaintFrameSyncMessage(value: unknown): boolean`: validate first, extract `frame`, call `timelineStore.seek(frame)`, then call `timelineStore.ensureFrameVisible(frame)`, and return true only after both editor timeline calls are made. Browser listener installation should mirror the existing `window.addEventListener` / cleanup pattern in bridge tests and should ignore non-Physics-Paint messages.

**Test analog:** `app/src/lib/physicPaintBridge.test.ts` already spies on store mutations and asserts invalid payloads do not mutate state. Add D-26 tests in the same style: spy/mock `timelineStore.seek` and `timelineStore.ensureFrameVisible`, assert a valid `physic-paint:seek-frame` message with `frame: 12` calls both methods with `12`, and assert invalid frames call neither method.

## Shared Patterns

### Preact hook/action architecture
**Source:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx` lines 190-213; `PhysicsPaintStudioToolbar.tsx` lines 72-100
**Apply to:** All new physics paint components
```typescript
export function PhysicsPaintStudio() {
  const [engine, setEngine] = useState<EfxPaintEngine | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [animTotal, setAnimTotal] = useState(0);
  const [launchContext, setLaunchContext] = useState<PhysicPaintLaunchContext | null>(() => parseLaunchContext(window.location));
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>('Unavailable');
  const [lastError, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
```

### Engine mutations stay behind callbacks
**Source:** `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` lines 118-159
**Apply to:** TopBar, ToolRail, RightPanel, WorkflowStrip
```typescript
const selectTool = useCallback((nextTool: ToolType) => {
  setToolState(nextTool);
  engine.setTool(nextTool);
}, [engine]);

const onSize = useCallback((value: number) => { setSize(value); engine.setBrushSize(value); }, [engine]);
const onOpacity = useCallback((value: number) => { setOpacity(value); engine.setBrushOpacity(value); }, [engine]);
```

### Editable state and rendered PNG output are separate
**Source:** `app/src/types/physicPaint.ts` lines 22-50
**Apply to:** Studio apply actions, dev export, tests, store interactions
```typescript
export interface PhysicPaintRenderedFrame {
  /** Generated sequence-local frame index. For still applies this is 0. */
  frameIndex: number;
  /** Editor timeline frame that should receive this rendered output. */
  appFrame: number;
  /** Rendered PNG output only. Editable stroke/engine state is never transported here. */
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface PhysicPaintApplyPlayCanvasPayload {
  kind: 'apply-play-canvas';
  operationId: string;
  layerId: string;
  startFrame: number;
  frameCount: number;
  frames: PhysicPaintRenderedFrame[];
  editableState: SerializedProject;
}
```

### Validation fails closed before mutation
**Source:** `app/src/lib/physicPaintBridge.ts` lines 53-85; `app/src/types/physicPaint.ts` lines 97-118
**Apply to:** Apply bridge, dev export helpers, session load helpers
```typescript
export function applyPhysicPaintPayload(payload: unknown): PhysicPaintApplyResult {
  const base = resultBase(payload);
  if (!isPhysicPaintApplyPayload(payload)) {
    return failureResult(base, 'Invalid physics paint apply payload');
  }

  const targetLayer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find(layer => {
    if (layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') return false;
    const sourceLayerId = typeof layer.source.layerId === 'string' && layer.source.layerId.length > 0
      ? layer.source.layerId
      : layer.id;
    return sourceLayerId === payload.layerId || layer.id === payload.layerId;
  });
  if (!targetLayer) {
    return failureResult(payload, `Unknown physics paint layer: ${payload.layerId}`);
  }
```

### Non-reactive Map store uses explicit version signal
**Source:** `app/src/stores/physicPaintStore.ts` lines 8-39 and `app/src/components/sidebar/PhysicPaintProperties.tsx` lines 27-33
**Apply to:** Workflow timeline lane output markers, any UI reading store frames
```typescript
export const physicPaintVersion = signal(0);

function _notifyVisualChange(): void {
  _invalidateSerializationCache();
  physicPaintVersion.value++;
  _markProjectDirty?.();
}
```
```typescript
// Subscribe to explicit rendered-output invalidation while keeping Map storage non-reactive.
physicPaintVersion.value;

const currentFrame = timelineStore.currentFrame.value;
const sourceLayerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
const validContext = layer.type === 'physic-paint' && layer.source.type === 'physic-paint' && Number.isInteger(currentFrame) && currentFrame >= 0;
const hasOutput = validContext ? physicPaintStore.hasOutput(sourceLayerId) : false;
```

### EFX sidebar visual language
**Source:** `app/src/components/sidebar/PhysicPaintProperties.tsx` lines 77-93 and `SectionLabel.tsx` lines 1-8
**Apply to:** RightPanel, WorkflowStrip, compact status panels
```typescript
<div class="px-3 py-2 space-y-3 text-[13px]" style={{ color: 'var(--sidebar-text-primary)' }}>
  <div class="space-y-1">
    <SectionLabel text="Physics Paint" />
    <div class="rounded px-2 py-2 space-y-1" style={{ backgroundColor: 'var(--sidebar-input-bg)' }}>
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>Layer</span>
        <span class="text-[11px] truncate" title={layer.name}>{layer.name}</span>
      </div>
```
```typescript
export function SectionLabel({ text }: { text: string }) {
  return (
    <span style="font-size: 11px; font-weight: 600; color: var(--sidebar-text-secondary); letter-spacing: 2px; white-space: nowrap">
      {text}
    </span>
  );
}
```

### Testing fixtures and fail-closed assertions
**Source:** `app/src/lib/physicPaintBridge.test.ts` lines 20-67, 302-321
**Apply to:** New helper tests
```typescript
function applyCanvasPayload(overrides: Partial<PhysicPaintApplyPayload> = {}): PhysicPaintApplyPayload {
  return {
    kind: 'apply-canvas',
    operationId: 'apply-still-1',
    layerId: 'phys-layer-1',
    startFrame: 8,
    renderedFrame: makeFrame(0, 8),
    editableState,
    ...overrides,
  } as PhysicPaintApplyPayload;
}
```
```typescript
it('fails closed for invalid payloads before mutating the rendered store', () => {
  mockLayers([physicLayer()]);
  const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');
  const applySequence = vi.spyOn(physicPaintStore, 'applySequence');

  const result = applyPhysicPaintPayload({
    kind: 'apply-canvas',
    operationId: 'bad-op',
    layerId: 'phys-layer-1',
    startFrame: 8,
    renderedFrame: { ...makeFrame(0, 99), appFrame: 99 },
  });

  expect(result.ok).toBe(false);
  expect(applyCanvas).not.toHaveBeenCalled();
  expect(applySequence).not.toHaveBeenCalled();
});
```

## No Analog Found

No files are without useful analogs. The weakest matches are the newly proposed layout-specific child components (`PhysicsPaintTopBar.tsx`, `PhysicsPaintToolRail.tsx`, `PhysicsPaintWorkflowStrip.tsx`) because the current code is a monolithic toolbar/studio, but their behavior and styling patterns are covered by exact existing source files.

## Metadata

**Analog search scope:** `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/sidebar`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/shared`, `/Users/lmarques/Dev/efx-motion-editor/app/src/lib`, `/Users/lmarques/Dev/efx-motion-editor/app/src/stores`, `/Users/lmarques/Dev/efx-motion-editor/app/src/types`, `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src`
**Files scanned:** 140+ TypeScript/TSX/CSS files from targeted directories
**Pattern extraction date:** 2026-06-12
**Project instructions read:** `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`
**Project skills read:** `/Users/lmarques/Dev/efx-motion-editor/.claude/skills/repomix-reference-efx-motion-editor/SKILL.md`, `/Users/lmarques/Dev/efx-motion-editor/.agents/skills/repomix-explorer/SKILL.md`, `/Users/lmarques/Dev/efx-motion-editor/.agents/skills/repomix-reference-efx-motion-editor/SKILL.md`
