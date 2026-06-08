# Phase 35: Interactive Physics Paint Controls - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/types/layer.ts` | model | CRUD / transform | `app/src/types/layer.ts` | exact-modification |
| `app/src/types/physicPaint.ts` | model | event-driven / request-response | `app/src/types/layer.ts` | role-match |
| `app/src/stores/physicPaintStore.ts` | store | CRUD / event-driven | `app/src/stores/paintStore.ts` | exact |
| `app/src/lib/physicPaintBridge.ts` | utility | event-driven / request-response | `app/src/main.tsx`, `app/src/components/canvas/PaintOverlay.tsx`, `app/src/lib/ipc.ts` | role-match |
| `app/src/components/sidebar/PhysicPaintProperties.tsx` | component | request-response | `app/src/components/sidebar/PaintProperties.tsx` | exact |
| `app/src/components/timeline/AddFxMenu.tsx` | component | CRUD / request-response | `app/src/components/timeline/AddFxMenu.tsx` | exact-modification |
| `app/src/components/layout/LeftPanel.tsx` | component | request-response | `app/src/components/layout/LeftPanel.tsx` | exact-modification |
| `app/src/lib/previewRenderer.ts` | utility | transform / file-I/O | `app/src/lib/previewRenderer.ts` | exact-modification |
| `packages/efx-physic-paint/demo/src/App.tsx` | component | event-driven / streaming | `packages/efx-physic-paint/demo/src/App.tsx` | exact-modification |
| `packages/efx-physic-paint/demo/src/Toolbar.tsx` | component | event-driven / file-I/O | `packages/efx-physic-paint/demo/src/Toolbar.tsx` | exact-modification |

## Pattern Assignments

### `app/src/types/layer.ts` (model, CRUD / transform)

**Analog:** `app/src/types/layer.ts`

**Union extension pattern** (lines 1-14):
```typescript
export type LayerType =
  | 'static-image'
  | 'image-sequence'
  | 'video'
  | 'generator-grain'
  | 'generator-particles'
  | 'generator-lines'
  | 'generator-dots'
  | 'generator-vignette'
  | 'generator-glsl'
  | 'adjustment-color-grade'
  | 'adjustment-blur'
  | 'adjustment-glsl'
  | 'paint';
```

**Source data union pattern** (lines 18-32):
```typescript
export type LayerSourceData =
  | { type: 'static-image'; imageId: string }
  | { type: 'image-sequence'; imageIds: string[] }
  | { type: 'video'; videoAssetId: string }
  | { type: 'generator-grain'; density: number; size: number; intensity: number; lockSeed: boolean; seed: number }
  | { type: 'generator-particles'; count: number; speed: number; sizeMin: number; sizeMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-lines'; count: number; thickness: number; lengthMin: number; lengthMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-dots'; count: number; sizeMin: number; sizeMax: number; speed: number; lockSeed: boolean; seed: number }
  | { type: 'generator-vignette'; size: number; softness: number; intensity: number }
  | { type: 'adjustment-color-grade'; brightness: number; contrast: number; saturation: number; hue: number; fade: number; tintColor: string; preset: string; fadeBlend?: string }
  | { type: 'adjustment-blur'; radius: number }
  | { type: 'generator-glsl'; shaderId: string; params: Record<string, number> }
  | { type: 'adjustment-glsl'; shaderId: string; params: Record<string, number> }
  | { type: 'paint'; layerId: string };
```

**Default helper pattern** (lines 82-99, 159-181):
```typescript
export function defaultTransform(): LayerTransform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
}

export function createDefaultFxSource(type: LayerType): LayerSourceData {
  switch (type) {
    case 'generator-grain':
      return { type: 'generator-grain', density: 0.3, size: 1, intensity: 0.5, lockSeed: true, seed: 42 };
    default:
      throw new Error(`Not an FX layer type: ${type}`);
  }
}
```

**Apply to Phase 35:** Add `physic-paint` as a distinct sibling to `paint`; do not overload `paint`. Add a typed source such as `{ type: 'physic-paint'; layerId: string }` or rendered-frame references, depending on storage choice.

---

### `app/src/types/physicPaint.ts` (model, event-driven / request-response)

**Analog:** `app/src/types/layer.ts` and Tauri event payload patterns from `app/src/components/canvas/PaintOverlay.tsx`

**Typed payload pattern** (from `PaintOverlay.tsx` lines 593-608):
```typescript
useEffect(() => {
  let unlisten: (() => void) | undefined;
  listen<{pressure: number; tilt_x: number; tilt_y: number}>('tablet:pressure', (event) => {
    nativePressure.current = event.payload.pressure;
    nativeTiltX.current = event.payload.tilt_x;
    nativeTiltY.current = event.payload.tilt_y;
  }).then(fn => { unlisten = fn; });
  return () => unlisten?.();
}, []);
```

**Apply to Phase 35:** Define strongly typed launch/apply payloads before writing bridge code. Include `layerId`, `startFrame`, `frameCount`, optional `operationId`, and rendered frame refs/data. Validate max frame count 600 per UI spec.

---

### `app/src/stores/physicPaintStore.ts` (store, CRUD / event-driven)

**Analog:** `app/src/stores/paintStore.ts`

**Imports and signal pattern** (lines 1-8, 39-48):
```typescript
import {signal, effect} from '@preact/signals';
import type {PaintElement, PaintFrame, PaintToolType, PaintStrokeOptions, BrushStyle, BrushFxParams, PaintStroke, PaintShape, PaintMode} from '../types/paint';
import {projectStore} from './projectStore';

/** Bumped on every paint data mutation so reactive consumers (Preview) re-render */
const paintVersion = signal(0);

/** layerId -> (frameNumber -> PaintFrame) */
const _frames = new Map<string, Map<number, PaintFrame>>();

/** "layerId:frameNum" strings for persistence tracking */
const _dirtyFrames = new Set<string>();
```

**Centralized visual-change notification** (lines 69-74):
```typescript
/** Centralized notification: mark frame dirty, bump paintVersion, and notify project */
function _notifyVisualChange(layerId: string, frame: number): void {
  _dirtyFrames.add(`${layerId}:${frame}`);
  paintVersion.value++;
  _markProjectDirty?.();
}
```

**Frame set/load/reset pattern** (lines 122-127, 443-452, 454-480):
```typescript
setFrame(layerId: string, frame: number, pf: PaintFrame): void {
  _getOrCreateFrame(layerId, frame);
  _frames.get(layerId)!.set(frame, pf);
  this.markDirty(layerId, frame);
  paintVersion.value++;
}

/** Load frame data without undo (used by persistence) */
loadFrame(layerId: string, frame: number, pf: PaintFrame): void {
  let layerFrames = _frames.get(layerId);
  if (!layerFrames) {
    layerFrames = new Map();
    _frames.set(layerId, layerFrames);
  }
  layerFrames.set(frame, pf);
  paintVersion.value++;
}

/** Clear all paint data (called on project close/new) */
reset(): void {
  _frames.clear();
  _dirtyFrames.clear();
  paintMode.value = false;
  activeTool.value = 'brush';
}
```

**Apply to Phase 35:** Store rendered physics outputs by `layerId -> frame -> rendered output`. Expose `physicPaintVersion` or reuse the shared invalidation strategy so preview/export rerender after `[apply canvas]` and `[apply play canvas]`. User memory requires version bumps on mutations.

---

### `app/src/lib/physicPaintBridge.ts` (utility, event-driven / request-response)

**Analogs:** `app/src/main.tsx`, `app/src/components/canvas/PaintOverlay.tsx`, `app/src/lib/ipc.ts`

**Tauri event imports/listeners** (`main.tsx` lines 1-4, 24-30):
```typescript
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';

// Listen for undo/redo events emitted by the native macOS menu.
listen('menu:undo', () => { undo(); });
listen('menu:redo', () => { redo(); });
```

**Listener cleanup pattern** (`PaintOverlay.tsx` lines 593-608):
```typescript
useEffect(() => {
  let unlisten: (() => void) | undefined;
  listen<{pressure: number; tilt_x: number; tilt_y: number}>('tablet:pressure', (event) => {
    nativePressure.current = event.payload.pressure;
    nativeTiltX.current = event.payload.tilt_x;
    nativeTiltY.current = event.payload.tilt_y;
  }).then(fn => { unlisten = fn; });
  return () => unlisten?.();
}, []);
```

**IPC result/error wrapper** (`ipc.ts` lines 5-18):
```typescript
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
```

**PNG/file write helper pattern** (`ipc.ts` lines 133-140):
```typescript
export function exportWritePng(dirPath: string, filename: string, data: number[]) {
  return safeInvoke<null>('export_write_png', { dirPath, filename, data });
}
```

**Apply to Phase 35:** Use typed `listen`/`emit` with cleanup; return `Result`-style errors for bridge open/apply failures; prefer file refs or capped payloads for sequences. There is no existing `WebviewWindow` usage, so use Tauri v2 docs for opening/focusing a standalone window.

---

### `app/src/components/sidebar/PhysicPaintProperties.tsx` (component, request-response)

**Analog:** `app/src/components/sidebar/PaintProperties.tsx`

**Imports pattern** (lines 1-15):
```typescript
import {useState, useEffect} from 'preact/hooks';
import {ArrowRight, ChevronDown} from 'lucide-preact';
import {SectionLabel} from '../shared/SectionLabel';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import type {Layer, BlendMode} from '../../types/layer';
```

**Sidebar shell and compact controls pattern** (lines 77-108, 140-175):
```typescript
export function PaintProperties({layer}: {layer: Layer}) {
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const bgColor = layer.paintBgColor ?? 'transparent';
  const setBgColor = (c: string) => {
    layerStore.updateLayer(layer.id, { paintBgColor: c });
    paintStore.setPaintBgColor(c);
  };

  return (
    <div class="px-3 py-2 space-y-3">
      <div class="flex items-center gap-3">
        <div class="relative shrink-0" style={{ width: '90px' }}>
          <select
            class="w-full text-[11px] rounded px-2 py-[3px] outline-none cursor-pointer appearance-none pr-5"
            style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', borderRadius: '6px' }}
            value={layer.blendMode}
            onChange={(e) => {
              layerStore.updateLayer(layer.id, {blendMode: (e.target as HTMLSelectElement).value as BlendMode});
            }}
          >
```

**Status/feedback strip pattern** (lines 177-197):
```typescript
{paintStore.isRenderingFx.value && (
  <div class="flex items-center gap-2 px-1 py-1 rounded text-[10px]"
    style={{backgroundColor: 'var(--color-accent)', color: 'white'}}>
    <span class="animate-pulse">Rendering FX...</span>
  </div>
)}
```

**Disabled visible control pattern** (lines 539-545):
```typescript
<button
  class="paint-action-btn flex-1 text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
  onClick={() => setShowAnimateDialog(true)}
  disabled={paintStore.selectedStrokeIds.value.size === 0}
  title="Animate selected stroke(s) (draw reveal)"
  style={{opacity: paintStore.selectedStrokeIds.value.size === 0 ? 0.4 : 1}}
>
```

**Apply to Phase 35:** Build a compact sidebar panel with exact `[open fx paint canvas]` label, current frame/status, empty copy, disabled state `Select a physics paint layer and frame first.`, and no changes to `PaintModeSelector`.

---

### `app/src/components/timeline/AddFxMenu.tsx` (component, CRUD / request-response)

**Analog:** `app/src/components/timeline/AddFxMenu.tsx`

**Imports and store dependencies** (lines 1-12):
```typescript
import {useState, useEffect, useRef} from 'preact/hooks';
import {Clapperboard, Sparkles} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {paintStore} from '../../stores/paintStore';
import {uiStore} from '../../stores/uiStore';
import {timelineStore} from '../../stores/timelineStore';
import {defaultTransform, createDefaultFxSource} from '../../types/layer';
import type {LayerType, BlendMode, Layer, LayerSourceData} from '../../types/layer';
```

**Click-outside cleanup pattern** (lines 19-29):
```typescript
useEffect(() => {
  if (!menuOpen) return;
  function handleClick(e: MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  }
  document.addEventListener('mousedown', handleClick);
  return () => document.removeEventListener('mousedown', handleClick);
}, [menuOpen]);
```

**Layer creation pattern** (lines 102-133):
```typescript
const handleAddPaintLayer = () => {
  setMenuOpen(false);
  const layerId = crypto.randomUUID();
  const paintLayer: Layer = {
    id: layerId,
    name: 'Paint',
    type: 'paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'paint', layerId } as LayerSourceData,
    isBase: false,
  };
  if (targetSequenceId) {
    sequenceStore.createFxSequence('Paint', paintLayer, totalFrames.peek(), { inFrame: isolatedInFrame, outFrame: isolatedOutFrame });
  } else {
    sequenceStore.createFxSequence('Paint', paintLayer, totalFrames.peek());
  }
  layerStore.setSelected(layerId);
  uiStore.selectLayer(layerId);
};
```

**Menu item visual pattern** (lines 175-182):
```typescript
<div class="px-3 py-1 text-[9px] text-(--color-text-dim) font-semibold">PAINT</div>
<button
  class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
  onClick={handleAddPaintLayer}
>
  <span class="w-2 h-2 rounded-sm bg-[#E91E63] shrink-0" />
  Paint / Rotopaint
</button>
```

**Apply to Phase 35:** Add a sibling `handleAddPhysicPaintLayer` and menu item under PAINT. Do not alter `handleAddPaintLayer` or enter existing paint mode for physics layers.

---

### `app/src/components/layout/LeftPanel.tsx` (component, request-response)

**Analog:** `app/src/components/layout/LeftPanel.tsx`

**Selected-layer routing pattern** (lines 280-309):
```typescript
<CollapsibleSection
  title="PROPERTIES"
  collapsed={uiStore.propertiesSectionCollapsed}
  onCollapse={handlePropCollapse}
>
  {transitionSel && (
    <SidebarScrollArea>
      <TransitionProperties selection={transitionSel} />
    </SidebarScrollArea>
  )}
  {!transitionSel && selectedLayer && isFx && (
    <SidebarScrollArea>
      <SidebarFxProperties layer={selectedLayer} fxSequenceId={fxSequenceId} />
    </SidebarScrollArea>
  )}
  {!transitionSel && selectedLayer && !isFx && selectedLayer.type === 'paint' && paintStore.paintMode.value && (
    <SidebarScrollArea>
      <PaintProperties layer={selectedLayer} />
    </SidebarScrollArea>
  )}
  {!transitionSel && selectedLayer && !isFx && selectedLayer.type !== 'paint' && (
    <SidebarScrollArea>
      <SidebarProperties layer={selectedLayer} isContentOverlay={isContentOverlay} />
    </SidebarScrollArea>
  )}
</CollapsibleSection>
```

**Apply to Phase 35:** Insert `selectedLayer.type === 'physic-paint'` route before the generic non-paint `SidebarProperties` branch and render `PhysicPaintProperties`.

---

### `app/src/lib/previewRenderer.ts` (utility, transform / file-I/O)

**Analog:** `app/src/lib/previewRenderer.ts`

**Imports and cache dependencies** (lines 1-20):
```typescript
import type {Layer, BlendMode} from '../types/layer';
import {isGeneratorLayer, isAdjustmentLayer, isFxLayer} from '../types/layer';
import {imageStore} from '../stores/imageStore';
import {assetUrl} from './ipc';
import {renderPaintFrameWithBg} from './paintRenderer';
import {paintStore} from '../stores/paintStore';
import {projectStore} from '../stores/projectStore';
```

**Layer draw dispatch pattern** (lines 176-204, 280-307):
```typescript
for (const layer of layers) {
  if (!layer.visible) continue;

  if (isGeneratorLayer(layer)) {
    hasDrawable = true;
    break;
  } else if (layer.type === 'paint') {
    hasDrawable = true;  // Paint layer always has solid bg
    break;
  } else if (isAdjustmentLayer(layer)) {
    continue;
  } else {
    const source = this.resolveLayerSource(layer, frame, frames, fps);
    if (source !== null || layer.source.type === 'video') {
      hasDrawable = true;
      break;
    }
  }
}

} else if (layer.type === 'paint') {
  const paintFrame = paintStore.getFrame(layer.id, paintLookupFrame);
  const projW = projectStore.width.peek();
  const projH = projectStore.height.peek();
  const off = document.createElement('canvas');
  off.width = projW;
  off.height = projH;
  const offCtx = off.getContext('2d')!;
  // ... render then composite
  ctx.save();
  ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
  ctx.globalAlpha = effectiveOpacity;
  ctx.drawImage(off, 0, 0, logicalW, logicalH);
  ctx.restore();
}
```

**Drawable source resolution pattern** (lines 434-478):
```typescript
private resolveLayerSource(
  layer: Layer,
  frame: number,
  frames: FrameEntry[],
  fps: number,
): CanvasImageSource | null {
  switch (layer.source.type) {
    case 'static-image': {
      return this.getImageSource(layer.source.imageId);
    }
    case 'image-sequence': {
      const fi = Math.floor(frame);
      // ...
      return this.getImageSource(imageId);
    }
    case 'video': {
      return this.resolveVideoSource(layer, frame, fps);
    }
    default:
      return null;
  }
}
```

**Image loading/error pattern** (lines 520-540):
```typescript
const image = imageStore.getById(imageId);
if (!image) {
  return null;
}

this.loadingImages.add(imageId);

const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => {
  this.loadingImages.delete(imageId);
  this.imageCache.set(imageId, img);
  this.onImageLoaded?.();
};
img.onerror = () => {
  this.loadingImages.delete(imageId);
  this.failedImages.add(imageId);
  console.warn(`[PreviewRenderer] Failed to load image: ${imageId}`);
  this.onImageLoaded?.();
};
img.src = assetUrl(image.project_path, imageId);
```

**Dispose cleanup pattern** (lines 1013-1034):
```typescript
dispose(): void {
  for (const [layerId, video] of this.videoElements.entries()) {
    const handler = this.videoReadyHandlers.get(layerId);
    if (handler) {
      video.removeEventListener('loadeddata', handler);
      video.removeEventListener('seeked', handler);
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  this.videoElements.clear();
  this.imageCache.clear();
  this.onImageLoaded = null;
}
```

**Apply to Phase 35:** Add `physic-paint` draw handling that resolves rendered frame output for `globalFrame ?? frame`, composites with `blendModeToCompositeOp`, and calls `onImageLoaded`/version invalidation for async image refs.

---

### `packages/efx-physic-paint/demo/src/App.tsx` (component, event-driven / streaming)

**Analog:** `packages/efx-physic-paint/demo/src/App.tsx`

**Imports pattern** (lines 1-5):
```typescript
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint'
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation'
import { Toolbar } from './Toolbar'
```

**Canvas mount and engine readiness pattern** (lines 9-43):
```typescript
function CanvasMountProbe(props: { onEngineReady: (engine: EfxPaintEngine) => void }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [mountError, setMountError] = useState<string | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!shellRef.current?.querySelector('canvas')) {
        setMountError(CANVAS_MOUNT_ERROR)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div class="demo-canvas-shell" ref={shellRef}>
      <EfxPaintCanvas
        width={1000}
        height={650}
        papers={[
          { name: 'canvas1', url: '/img/paper_1.jpg' },
        ]}
        defaultPaper="canvas1"
        class="paint-canvas"
        onEngineReady={(engine) => {
          engine.setTool('paint')
          setMountError(null)
          props.onEngineReady(engine)
        }}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  )
}
```

**Animation lifecycle pattern** (lines 53-82):
```typescript
useEffect(() => {
  if (!engine) return

  playerRef.current = new AnimationPlayer(engine)
  return () => {
    playerRef.current?.stop()
    playerRef.current = null
  }
}, [engine])

const handlePlay = useCallback((frameCount: number, fps: number) => {
  if (!playerRef.current) return

  setIsPlaying(true)
  setAnimTotal(frameCount)
  setAnimFrame(0)
  playerRef.current.play({
    frameCount,
    fps,
    onFrame: (frameIndex) => setAnimFrame(frameIndex),
    onComplete: () => setIsPlaying(false),
  })
}, [])
```

**Apply to Phase 35:** Keep standalone as engine owner. Add launch context state, diagnostics/apply strip, and rendered-output capture using `engine.getDisplayCanvas()`; never send editable strokes to the app as apply-back.

---

### `packages/efx-physic-paint/demo/src/Toolbar.tsx` (component, event-driven / file-I/O)

**Analog:** `packages/efx-physic-paint/demo/src/Toolbar.tsx`

**Imports and props pattern** (lines 1-11):
```typescript
import { useState, useRef, useCallback, useEffect } from 'preact/hooks'
import type { EfxPaintEngine, ToolType, BgMode } from '@efxlab/efx-physic-paint'

interface Props {
  engine: EfxPaintEngine
  onPlay?: (frameCount: number, fps: number) => void
  onStop?: () => void
  isPlaying?: boolean
  animFrame?: number
  animTotal?: number
}
```

**Validation/clamp pattern** (lines 13-29):
```typescript
const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function isSerializedProject(value: unknown): value is Parameters<EfxPaintEngine['load']>[0] {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { version?: unknown }).version === 2 &&
      typeof (value as { width?: unknown }).width === 'number' &&
      typeof (value as { height?: unknown }).height === 'number' &&
      Array.isArray((value as { strokes?: unknown }).strokes) &&
      typeof (value as { settings?: unknown }).settings === 'object'
  )
}
```

**Engine setting sync pattern** (lines 77-87, 89-115):
```typescript
useEffect(() => {
  engine.setColorHex(color)
  engine.setBrushSize(size)
  engine.setBrushOpacity(opacity)
  engine.setEdgeDetail(detail)
  engine.setPickup(pickup)
  engine.setEraseStrength(eraseStr)
  engine.setEmbossStrength(grainStr)
  engine.setPhysicsMode(physMode)
  engine.setLocalSpreadStrength(spreadStr)
}, [engine])

const selectTool = useCallback((t: ToolType) => {
  setToolState(t)
  engine.setTool(t)
}, [engine])
```

**Save/load error handling pattern** (lines 142-177):
```typescript
const onSave = useCallback(() => {
  const data = engine.save()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `efx-paint-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}, [engine])

const onFileChange = useCallback((e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result ?? ''))
      if (!isSerializedProject(parsed)) {
        throw new Error('Invalid project file: missing serialized paint project fields')
      }
      engine.load(parsed)
      setLoadError(null)
    } catch (err) {
      console.error('Failed to load project:', err)
      setLoadError(err instanceof Error ? err.message : 'Failed to load project')
    }
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ''
}, [engine])
```

**Toolbar controls pattern** (lines 193-325):
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
    <Slider label="Size" id="sz" min={1} max={80} value={size} onChange={onSize} />
    <Slider label="Opacity" id="op" min={10} max={100} value={opacity} onChange={onOpacity} />
    <button onClick={onSave}>Save</button>
    <button onClick={onLoad}>Load</button>
    <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={onFileChange} />
    {loadError ? <div class="toolbar-error">{loadError}</div> : null}
    <button onClick={() => engine.undo()}>Undo</button>
    <button onClick={() => engine.clear()}>Clear</button>
  </div>
)
```

**Apply to Phase 35:** Preserve all existing controls. Rename save/load visible copy to `Save state` / `Load state` if touched. Add apply controls next to toolbar or separate strip; use frame clamp `1..600` for `Frames to apply` per UI spec.

---

### `packages/efx-physic-paint/src/preact.tsx` (provider/component, event-driven)

**Analog:** `packages/efx-physic-paint/src/preact.tsx`

**Lifecycle ownership pattern** (lines 7-17, 36-55):
```typescript
import { useRef, useEffect } from 'preact/hooks'
import type { FunctionalComponent } from 'preact'
import { EfxPaintEngine } from './engine/EfxPaintEngine'
import type { EngineConfig } from './types'

export interface EfxPaintCanvasProps extends EngineConfig {
  width?: number
  height?: number
  class?: string
  onEngineReady?: (engine: EfxPaintEngine) => void
}

useEffect(() => {
  if (!containerRef.current) return
  const engine = new EfxPaintEngine(containerRef.current, {
    width: props.width,
    height: props.height,
    papers: props.papers,
    defaultPaper: props.defaultPaper,
  })
  engineRef.current = engine

  engine.init().then(() => {
    props.onEngineReady?.(engine)
  })

  return () => {
    engine.destroy()
    engineRef.current = null
  }
}, [])
```

**Apply to Phase 35:** Do not instantiate the engine inside the editor app. Keep lifecycle in standalone/demo component and only expose rendered canvas/apply payloads.

---

### `packages/efx-physic-paint/src/animation/AnimationPlayer.ts` (service, streaming)

**Analog:** `packages/efx-physic-paint/src/animation/AnimationPlayer.ts`

**Playback and callback pattern** (lines 31-50, 114-149):
```typescript
play(config: AnimationConfig): void {
  this.config = config
  this.playing = true
  this.currentFrame = 0

  this.engine.setInputLocked(true)
  this.engine.setAnimationMode(true)

  const strokes = this.engine.getStrokes()
  this.distributeStrokes(strokes, config.frameCount)

  this.lastFrameTime = 0
  this.rafId = requestAnimationFrame(this.tick)
}

private tick = (timestamp: number): void => {
  if (!this.playing || !this.config) return
  const frameDuration = 1000 / this.config.fps
  if (timestamp - this.lastFrameTime >= frameDuration) {
    this.renderFrame(this.currentFrame)
    this.config.onFrame?.(this.currentFrame, this.engine.getDisplayCanvas())
    this.currentFrame++
    if (this.currentFrame >= this.config.frameCount) {
      this.playing = false
      this.engine.renderAllStrokes()
      this.engine.setAnimationMode(false)
      this.engine.setInputLocked(false)
      this.config.onComplete?.()
      return
    }
  }
  this.rafId = requestAnimationFrame(this.tick)
}
```

**Stop cleanup pattern** (lines 52-65):
```typescript
stop(): void {
  this.playing = false
  cancelAnimationFrame(this.rafId)

  this.engine.renderAllStrokes()
  this.engine.setAnimationMode(false)
  this.engine.setInputLocked(false)
}
```

**Apply to Phase 35:** For `[apply play canvas]`, capture `canvas.toDataURL('image/png')` or write PNG refs inside `onFrame`, then apply to app frames `startFrame + frameIndex`.

## Shared Patterns

### Distinct physics paint layer, no paint-mode overload
**Source:** `app/src/types/layer.ts`, `app/src/components/timeline/AddFxMenu.tsx`
**Apply to:** `layer.ts`, `AddFxMenu.tsx`, `LeftPanel.tsx`, `PhysicPaintProperties.tsx`, `previewRenderer.ts`
```typescript
source: { type: 'paint', layerId } as LayerSourceData,
// Phase 35 should add a sibling source: { type: 'physic-paint', layerId }
```

### Store mutation invalidation
**Source:** `app/src/stores/paintStore.ts`
**Apply to:** `physicPaintStore.ts`, bridge apply handlers, preview renderer invalidation
```typescript
function _notifyVisualChange(layerId: string, frame: number): void {
  _dirtyFrames.add(`${layerId}:${frame}`);
  paintVersion.value++;
  _markProjectDirty?.();
}
```

### Tauri event listeners must clean up
**Source:** `app/src/components/canvas/PaintOverlay.tsx`
**Apply to:** bridge listeners and component-owned listeners
```typescript
useEffect(() => {
  let unlisten: (() => void) | undefined;
  listen<Payload>('event:name', (event) => {
    // validate event.payload before mutation
  }).then(fn => { unlisten = fn; });
  return () => unlisten?.();
}, []);
```

### Result-style errors for bridge/file operations
**Source:** `app/src/lib/ipc.ts`
**Apply to:** `physicPaintBridge.ts`, rendered-frame file writes
```typescript
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
```

### Standalone engine ownership and cleanup
**Source:** `packages/efx-physic-paint/src/preact.tsx`, `demo/src/App.tsx`
**Apply to:** standalone app/diagnostics/apply controls
```typescript
useEffect(() => {
  if (!containerRef.current) return
  const engine = new EfxPaintEngine(containerRef.current, config)
  engine.init().then(() => props.onEngineReady?.(engine))
  return () => {
    engine.destroy()
    engineRef.current = null
  }
}, [])
```

### File/import validation and visible errors
**Source:** `packages/efx-physic-paint/demo/src/Toolbar.tsx`
**Apply to:** state file loading, apply diagnostics, frame count validation
```typescript
try {
  const parsed = JSON.parse(String(reader.result ?? ''))
  if (!isSerializedProject(parsed)) {
    throw new Error('Invalid project file: missing serialized paint project fields')
  }
  engine.load(parsed)
  setLoadError(null)
} catch (err) {
  console.error('Failed to load project:', err)
  setLoadError(err instanceof Error ? err.message : 'Failed to load project')
}
```

### Canvas compositing and resource cleanup
**Source:** `app/src/lib/previewRenderer.ts`
**Apply to:** `physic-paint` preview/export support
```typescript
ctx.save();
ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
ctx.globalAlpha = effectiveOpacity;
ctx.drawImage(sourceOrOffscreen, 0, 0, logicalW, logicalH);
ctx.restore();
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/lib/physicPaintBridge.ts` window-opening portion | utility | request-response | No existing `WebviewWindow` usage found in app/package source. Use Tauri v2 docs plus local `listen`/`Result` patterns. |

## Metadata

**Analog search scope:** `/Users/lmarques/Dev/efx-motion-editor/app/src`, `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint`, `/Users/lmarques/Dev/efx-motion-editor/src-tauri`
**Files scanned:** 19 candidate files surfaced; 13 analog files read/extracted
**Pattern extraction date:** 2026-06-08
