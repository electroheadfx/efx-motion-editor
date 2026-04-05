import {useState} from 'preact/hooks';
import {ArrowRight} from 'lucide-preact';
import {SectionLabel} from '../shared/SectionLabel';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import {PaintModeSelector} from './PaintModeSelector';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {fxTrackLayouts, trackLayouts} from '../../lib/frameMap';
import {pushAction} from '../../lib/history';
import {BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, DEFAULT_PAINT_BG_COLOR, BRUSH_STYLES, BRUSH_FX_VISIBLE_PARAMS, DEFAULT_BRUSH_FX_PARAMS} from '../../types/paint';
import type {PaintToolType, PaintStroke, PaintShape, PaintStrokeOptions, PaintElement} from '../../types/paint';
import type {Layer, BlendMode} from '../../types/layer';
import {StrokeList} from './StrokeList';

const SHAPE_TOOLS: PaintToolType[] = ['line', 'rect', 'ellipse'];
const BRUSH_TOOLS: PaintToolType[] = ['brush', 'eraser'];
const STROKE_TOOLS: PaintToolType[] = ['brush', 'eraser'];

function shapeToBrushStrokes(shape: PaintShape, brushOptions: PaintStrokeOptions): PaintStroke[] {
  const {tool, x1, y1, x2, y2, color, opacity, strokeWidth} = shape;
  const newId = () => crypto.randomUUID();
  const baseStroke = {
    id: newId(),
    tool: 'brush' as const,
    color,
    opacity,
    size: strokeWidth,
    options: brushOptions,
    brushStyle: 'flat' as const,
    visible: shape.visible,
  };

  if (tool === 'line') {
    return [{
      ...baseStroke,
      points: [[x1, y1, 0.5], [x2, y2, 0.5]] as [number, number, number][],
    }];
  }

  if (tool === 'rect') {
    // Trace rectangle outline: top, right, bottom, left
    const [rx1, ry1, rx2, ry2] = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    const top =    {points: [[rx1, ry1, 0.5], [rx2, ry1, 0.5]] as [number,number,number][]};
    const right =  {points: [[rx2, ry1, 0.5], [rx2, ry2, 0.5]] as [number,number,number][]};
    const bottom = {points: [[rx2, ry2, 0.5], [rx1, ry2, 0.5]] as [number,number,number][]};
    const left =   {points: [[rx1, ry2, 0.5], [rx1, ry1, 0.5]] as [number,number,number][]};
    return [
      {...baseStroke, ...top, id: newId()},
      {...baseStroke, ...right, id: newId()},
      {...baseStroke, ...bottom, id: newId()},
      {...baseStroke, ...left, id: newId()},
    ];
  }

  if (tool === 'ellipse') {
    // Sample ~36 points around the ellipse
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const NUM_POINTS = 36;
    const points: [number, number, number][] = [];
    for (let i = 0; i <= NUM_POINTS; i++) {
      const angle = (i / NUM_POINTS) * Math.PI * 2;
      points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle), 0.5]);
    }
    return [{...baseStroke, points}];
  }

  return [];
}

export function PaintProperties({layer}: {layer: Layer}) {
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({x: 0, y: 0});
  const [onionCollapsed, setOnionCollapsed] = useState(true);
  const [tabletCollapsed, setTabletCollapsed] = useState(true);
  const [showAnimateDialog, setShowAnimateDialog] = useState(false);

  const activeTool = paintStore.activeTool.value;
  const brushSizeVal = paintStore.brushSize.value;
  const brushColorVal = paintStore.brushColor.value;
  const brushOpacityVal = paintStore.brushOpacity.value;
  const strokeOpts = paintStore.strokeOptions.value;
  const shapeFilledVal = paintStore.shapeFilled.value;
  const fillToleranceVal = paintStore.fillTolerance.value;
  const bgColor = paintStore.paintBgColor.value;

  const showBrushSettings = BRUSH_TOOLS.includes(activeTool) || SHAPE_TOOLS.includes(activeTool);
  const showStrokeOptions = STROKE_TOOLS.includes(activeTool);
  const showShapeOptions = SHAPE_TOOLS.includes(activeTool);
  const showFillOptions = activeTool === 'fill';

  return (
    <div class="px-3 py-2 space-y-3">
      <style>{`
        @keyframes pulsate {
          0%, 100% { background-color: #f97316; box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
          50% { background-color: #dc2626; box-shadow: 0 0 12px 4px rgba(249, 115, 22, 0.6); }
        }
      `}</style>
      {/* Layer name + exit paint mode */}
      <div class="flex items-center justify-between px-1">
        <div class="text-[12px] font-medium" style={{color: 'var(--sidebar-text-primary)'}}>
          {layer.name}
        </div>
        <button
          class="paint-exit-btn text-[10px] px-2 py-0.5 rounded cursor-pointer flex items-center gap-1"
          onClick={() => paintStore.paintMode.value = false}
          title="Exit paint mode (P)"
          style={{
            backgroundColor: '#f97316',
            color: '#ffffff',
            border: 'none',
            animation: 'pulsate 2s ease-in-out infinite',
          }}
        >
          Exit Paint Mode
          <ArrowRight size={12} />
        </button>
        <style>{`
          @keyframes pulsate {
            0%, 100% { background-color: #f97316; box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
            50% { background-color: #dc2626; box-shadow: 0 0 12px 4px rgba(249, 115, 22, 0.6); }
          }
        `}</style>
      </div>

      {/* Paint Mode Selector (D-21) */}
      <div class="px-1">
        <PaintModeSelector layerId={layer.id} frame={timelineStore.currentFrame.value} />
      </div>

      {/* Layer Blend Mode & Opacity (D-29) */}
      <div class="px-1">
        <div class="flex items-center gap-2">
          <span class="text-[10px] w-12 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Blend</span>
          <select
            class="flex-1 text-[10px] rounded px-1 py-0.5 outline-none cursor-pointer"
            style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', border: 'none'}}
            value={layer.blendMode}
            onChange={(e) => {
              layerStore.updateLayer(layer.id, {blendMode: (e.target as HTMLSelectElement).value as BlendMode});
            }}
          >
            <option value="normal">Normal</option>
            <option value="screen">Screen</option>
            <option value="multiply">Multiply</option>
            <option value="overlay">Overlay</option>
            <option value="add">Add</option>
          </select>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-[10px] w-12 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Layer Op</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(layer.opacity * 100)}
            class="flex-1 min-w-0 h-1 cursor-pointer"
            style={{accentColor: 'var(--color-accent)'}}
            onInput={(e) => {
              layerStore.updateLayer(layer.id, {opacity: parseInt((e.target as HTMLInputElement).value, 10) / 100});
            }}
          />
          <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
      </div>

      {/* Rendering indicator */}
      {paintStore.isRenderingFx.value && (
        <div class="flex items-center gap-2 px-1 py-1 rounded text-[10px]"
          style={{backgroundColor: 'var(--color-accent)', color: 'white'}}>
          <span class="animate-pulse">Rendering FX...</span>
        </div>
      )}

      {/* Flat preview mode indicator (D-30: only in FX mode) */}
      {paintStore.activePaintMode.value === 'fx-paint' && paintStore.showFlatPreview.value && (
        <div class="flex items-center justify-between px-1 py-1 rounded text-[10px]"
          style={{backgroundColor: '#f59e0b', color: '#000'}}>
          <span>Flat preview mode</span>
          <button
            class="text-[9px] font-bold cursor-pointer underline"
            onClick={() => paintStore.toggleFlatPreview()}
          >
            Exit (F)
          </button>
        </div>
      )}

      {/* Background Color + Show Sequence image -- mode-aware (D-18, D-31) */}
      <div style={{ padding: '4px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
          {/* Col 1: Background Color -- hidden in FX mode (always white per p5.brush) */}
          {paintStore.activePaintMode.value !== 'fx-paint' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--sidebar-text-secondary)' }}>Background Color</span>
              <div
                style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor, cursor: 'pointer', border: '1px solid var(--color-border-subtle)', backgroundImage: bgColor === 'transparent' ? 'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)' : undefined, backgroundSize: bgColor === 'transparent' ? '8px 8px' : undefined, backgroundPosition: bgColor === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined }}
                onClick={(e: MouseEvent) => {
                  setColorPickerPos({x: e.clientX, y: e.clientY});
                  setShowBgColorPicker(true);
                }}
                title="Paint background color"
              />
              {bgColor !== DEFAULT_PAINT_BG_COLOR && (
                <button
                  onClick={() => paintStore.setPaintBgColor(DEFAULT_PAINT_BG_COLOR)}
                  style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-secondary)', cursor: 'pointer', border: 'none' }}
                >
                  Reset
                </button>
              )}
            </div>
          )}
          {/* Col 2: Show BG Sequence */}
          <label style={{ fontSize: '10px', color: 'var(--sidebar-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            Show BG Sequence
            <div style={{ width: 16, height: 16, borderRadius: '3px', backgroundColor: '#4A4A60', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={paintStore.showSequenceOverlay.value}
                onChange={() => paintStore.toggleSequenceOverlay()}
                style={{ width: 14, height: 14, accentColor: 'var(--color-accent)', margin: 0, cursor: 'pointer' }}
              />
            </div>
          </label>
        </div>
        {/* Sequence overlay opacity slider -- conditional on showSequenceOverlay */}
        {paintStore.showSequenceOverlay.value && (
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(paintStore.sequenceOverlayOpacity.value * 100)}
              class="flex-1 min-w-0 h-1 cursor-pointer"
              style={{accentColor: 'var(--color-accent)'}}
              onInput={(e) => paintStore.setSequenceOverlayOpacity(parseInt((e.target as HTMLInputElement).value, 10) / 100)}
            />
            <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
              {Math.round(paintStore.sequenceOverlayOpacity.value * 100)}%
            </span>
          </div>
        )}
      </div>

      {showBgColorPicker && (
        <ColorPickerModal
          color={bgColor}
          mouseX={colorPickerPos.x}
          mouseY={colorPickerPos.y}
          onLiveChange={(c) => paintStore.setPaintBgColor(c)}
          onCommit={(c) => {
            paintStore.setPaintBgColor(c);
            setShowBgColorPicker(false);
          }}
          onClose={() => setShowBgColorPicker(false)}
        />
      )}

      {/* STROKES section -- D-20: before SELECTION */}
      {activeTool === 'select' && (
        <StrokeList layerId={layer.id} />
      )}

      {/* SELECT MODE TOOLS -- 2-col grouping (per D-08) */}
      {activeTool === 'select' && (
        <div>
          <SectionLabel text="SELECTION" />
          <div class="flex flex-col gap-2 mt-1.5">
            {/* D-08: Row 1 -- Select All | Delete Selected (2-col) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                class="paint-action-btn text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
                onClick={() => {
                  const frame = timelineStore.currentFrame.peek();
                  const paintFrame = paintStore.getFrame(layer.id, frame);
                  if (!paintFrame) return;
                  paintStore.clearSelection();
                  for (const el of paintFrame.elements) {
                    paintStore.selectStroke(el.id);
                  }
                }}
              >
                Select All
              </button>
              {paintStore.selectedStrokeIds.value.size > 0 ? (
                <button
                  class="paint-action-btn text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
                  onClick={() => {
                    const frame = timelineStore.currentFrame.peek();
                    const selected = paintStore.selectedStrokeIds.peek();
                    for (const strokeId of selected) {
                      paintStore.removeElement(layer.id, frame, strokeId);
                    }
                    paintStore.clearSelection();
                  }}
                >
                  Delete Selected ({paintStore.selectedStrokeIds.value.size})
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* D-08: Row 2 -- Width | Color (2-col, visible when strokes selected) */}
            {paintStore.selectedStrokeIds.value.size > 0 && (() => {
              // Read width and color from first selected stroke
              const frame = timelineStore.currentFrame.peek();
              const pf = paintStore.getFrame(layer.id, frame);
              const sel = paintStore.selectedStrokeIds.value;
              let currentWidth = paintStore.brushSize.value;
              let currentColor = paintStore.brushColor.value;
              if (pf) {
                for (const el of pf.elements) {
                  if ((el.tool === 'brush' || el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') && sel.has(el.id)) {
                    if (el.tool === 'brush') {
                      currentWidth = Math.round((el as any).size);
                    } else {
                      currentWidth = Math.round((el as any).strokeWidth) || currentWidth;
                    }
                    currentColor = (el as any).color || currentColor;
                    break;
                  }
                }
              }
              const applyWidth = (newSize: number, andRefreshFx = false) => {
                if (!pf) return;
                for (const el of pf.elements) {
                  if (!sel.has(el.id)) continue;
                  if (el.tool === 'brush') {
                    (el as any).size = newSize;
                  } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
                    (el as any).strokeWidth = newSize;
                  }
                }
                paintStore.setBrushSize(newSize);
                paintStore.markDirty(layer.id, frame);
                // Don't invalidate FX cache during drag -- keep showing old FX
                // Only invalidate + rebuild on release (andRefreshFx=true)
                if (andRefreshFx) {
                  paintStore.refreshFrameFx(layer.id, frame);
                } else {
                  paintStore.paintVersion.value++;
                }
              };
              // Use signal value for slider reactivity
              const sliderWidth = paintStore.brushSize.value;
              return (
                <div class="flex flex-col gap-2">
                  {/* Width -- full row */}
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] w-10 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Width</span>
                    <input
                      type="range"
                      min={1}
                      max={500}
                      step={1}
                      value={sliderWidth}
                      class="flex-1 min-w-0 h-1 cursor-pointer"
                      style={{accentColor: 'var(--color-accent)'}}
                      onInput={(e) => applyWidth(parseInt((e.target as HTMLInputElement).value, 10))}
                      onChange={(e) => applyWidth(parseInt((e.target as HTMLInputElement).value, 10), true)}
                    />
                    <input
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={sliderWidth}
                      class="w-12 text-[11px] rounded px-1 py-0.5 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)'}}
                      onInput={(e) => {
                        const v = parseInt((e.target as HTMLInputElement).value, 10);
                        if (!isNaN(v) && v > 0) applyWidth(v, true);
                      }}
                    />
                  </div>
                  {/* Color -- full row */}
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] w-10 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Color</span>
                    <button
                      class="w-6 h-6 rounded border cursor-pointer shrink-0"
                      style={{
                        backgroundColor: currentColor,
                        borderColor: 'var(--color-border-subtle)',
                      }}
                      title="Change stroke color"
                      onClick={() => paintStore.toggleInlineColorPicker()}
                    />
                    <span class="text-[11px] font-mono" style={{color: 'var(--sidebar-text-primary)'}}>
                      {currentColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Reorder buttons */}
            {paintStore.selectedStrokeIds.value.size > 0 && (() => {
              const doReorder = (action: 'toBack' | 'backward' | 'forward' | 'toFront') => {
                const currentFrame = timelineStore.currentFrame.peek();
                const selectedIds = paintStore.selectedStrokeIds.peek();
                switch (action) {
                  case 'toBack': paintStore.moveElementsToBack(layer.id, currentFrame, selectedIds); break;
                  case 'backward': paintStore.moveElementsBackward(layer.id, currentFrame, selectedIds); break;
                  case 'forward': paintStore.moveElementsForward(layer.id, currentFrame, selectedIds); break;
                  case 'toFront': paintStore.moveElementsToFront(layer.id, currentFrame, selectedIds); break;
                }
                paintStore.invalidateFrameFxCache(layer.id, currentFrame);
                paintStore.refreshFrameFx(layer.id, currentFrame);
              };
              const btnClass = 'paint-action-btn flex-1 text-[10px] py-1 rounded cursor-pointer transition-colors';
              return (
                <div class="flex gap-1 mt-1">
                  <button class={btnClass} onClick={() => doReorder('toBack')} title="Send to back">
                    To Back
                  </button>
                  <button class={btnClass} onClick={() => doReorder('backward')} title="Move one step backward">
                    Backward
                  </button>
                  <button class={btnClass} onClick={() => doReorder('forward')} title="Move one step forward">
                    Forward
                  </button>
                  <button class={btnClass} onClick={() => doReorder('toFront')} title="Bring to front">
                    To Front
                  </button>
                </div>
              );
            })()}

            {/* Convert to Brush -- only when shapes are selected */}
            {(() => {
              const frame = timelineStore.currentFrame.peek();
              const pf = paintStore.getFrame(layer.id, frame);
              const sel = paintStore.selectedStrokeIds.value;
              if (!pf) return null;
              const hasShapes = pf.elements.some(el =>
                (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') && sel.has(el.id)
              );
              if (!hasShapes) return null;
              return (
                <button
                  class="paint-action-btn w-full text-[11px] py-1 px-2 rounded cursor-pointer transition-colors mt-1"
                  onClick={() => {
                    const f = timelineStore.currentFrame.peek();
                    const pf2 = paintStore.getFrame(layer.id, f);
                    if (!pf2) return;
                    const sel2 = paintStore.selectedStrokeIds.peek();
                    const strokeOpts = paintStore.strokeOptions.peek();
                    const shapes = (pf2.elements.filter(el =>
                      (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') && sel2.has(el.id)
                    ) as PaintShape[]);
                    if (shapes.length === 0) return;
                    const newStrokes: PaintStroke[] = [];
                    for (const shape of shapes) {
                      newStrokes.push(...shapeToBrushStrokes(shape, strokeOpts));
                    }
                    // Remove original shapes
                    for (const shape of shapes) {
                      paintStore.removeElement(layer.id, f, shape.id);
                    }
                    // Add new brush strokes
                    for (const stroke of newStrokes) {
                      paintStore.addElement(layer.id, f, stroke);
                    }
                    // Select the new strokes
                    paintStore.clearSelection();
                    for (const s of newStrokes) {
                      paintStore.selectStroke(s.id);
                    }
                    paintStore.paintVersion.value++;
                    paintStore.invalidateFrameFxCache(layer.id, f);
                    paintStore.refreshFrameFx(layer.id, f);
                  }}
                >
                  Convert to Brush
                </button>
              );
            })()}
          </div>

        </div>
      )}

      {/* Copy to Next Frame + Animate -- visible in select mode */}
      {activeTool === 'select' && (
        <div class="px-1 pt-1 flex gap-2">
          <button
            class="paint-action-btn flex-1 text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
            onClick={() => {
              const layerId = layer.id;
              const frame = timelineStore.currentFrame.peek();
              const paintFrame = paintStore.getFrame(layerId, frame);
              if (!paintFrame || paintFrame.elements.length === 0) return;
              const nextFrame = frame + 1;
              // Deep copy all elements to next frame
              const copiedElements = JSON.parse(JSON.stringify(paintFrame.elements));
              // Assign new IDs to avoid conflicts
              for (const el of copiedElements) {
                el.id = crypto.randomUUID();
              }
              const existingNext = paintStore.getFrame(layerId, nextFrame);
              if (existingNext) {
                // Append to existing frame
                for (const el of copiedElements) {
                  paintStore.addElement(layerId, nextFrame, el);
                }
              } else {
                // Create new frame
                paintStore.setFrame(layerId, nextFrame, { elements: copiedElements });
              }
              paintStore.refreshFrameFx(layerId, nextFrame);
            }}
          >
            Copy to Next Frame
          </button>
          <button
            class="paint-action-btn flex-1 text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
            onClick={() => setShowAnimateDialog(true)}
            disabled={paintStore.selectedStrokeIds.value.size === 0}
            title="Animate selected stroke(s) (draw reveal)"
            style={{opacity: paintStore.selectedStrokeIds.value.size === 0 ? 0.4 : 1}}
          >
            Animate
          </button>
        </div>
      )}

      {/* Animate stroke dialog */}
      {showAnimateDialog && (() => {
        function getAnimationEndFrame(layerId: string, currentFrame: number, target: 'layer' | 'sequence'): number | null {
          const parentSeq = sequenceStore.sequences.value.find(
            s => s.layers.some(l => l.id === layerId)
          );
          if (!parentSeq) return null;

          if (target === 'layer') {
            const fxLayout = fxTrackLayouts.value.find(t => t.sequenceId === parentSeq.id);
            if (!fxLayout) return null;
            return fxLayout.outFrame - 1; // outFrame is exclusive
          } else {
            const contentTrack = trackLayouts.value.find(
              t => t.startFrame <= currentFrame && t.endFrame > currentFrame
            );
            if (!contentTrack) return null;
            return contentTrack.endFrame - 1; // endFrame is exclusive
          }
        }

        async function handleAnimate(target: 'layer' | 'sequence') {
          setShowAnimateDialog(false);

          const currentFrame = timelineStore.currentFrame.peek();
          const selectedIds = [...paintStore.selectedStrokeIds.value];
          if (selectedIds.length === 0) return;

          const pf = paintStore.getFrame(layer.id, currentFrame);
          if (!pf) return;

          // Get all selected strokes
          const strokes = selectedIds
            .map(id => pf.elements.find(e => e.id === id) as PaintStroke)
            .filter(s => s && 'points' in s);
          if (strokes.length === 0) return;

          // Calculate target frame range using real timeline data
          const endFrame = getAnimationEndFrame(layer.id, currentFrame, target);
          if (endFrame === null || endFrame <= currentFrame) return;

          const targetFrameCount = endFrame - currentFrame + 1;
          if (targetFrameCount < 2) return;

          // Generate animated stroke frames for ALL strokes
          const { distributeStrokeBySpeed } = await import('../../lib/strokeAnimation');
          const allStrokeFrames = strokes.map(stroke => ({
            id: stroke.id,
            frames: distributeStrokeBySpeed(stroke, targetFrameCount),
          }));

          // --- ATOMIC BATCH UNDO ---
          // Snapshot before-state for ALL affected frames
          const beforeSnapshots = new Map<number, PaintElement[]>();
          for (let f = currentFrame; f <= endFrame; f++) {
            const existing = paintStore.getFrame(layer.id, f);
            beforeSnapshots.set(f, existing ? existing.elements.map(e => ({...e})) : []);
          }

          // Apply: remove original strokes from current frame
          const currentElements = pf.elements;
          for (const stroke of strokes) {
            const idx = currentElements.findIndex(e => e.id === stroke.id);
            if (idx !== -1) currentElements.splice(idx, 1);
          }

          // Add progressive strokes for each animation to each frame
          for (const { frames: strokeFrames } of allStrokeFrames) {
            for (let i = 0; i < strokeFrames.length; i++) {
              const targetFrame = currentFrame + i;
              const frame = paintStore._getOrCreateFrame(layer.id, targetFrame);
              frame.elements.push(strokeFrames[i]);
            }
          }

          // Notify visual changes for all affected frames
          for (let f = currentFrame; f <= endFrame; f++) {
            paintStore.markDirty(layer.id, f);
            paintStore.invalidateFrameFxCache(layer.id, f);
            paintStore.refreshFrameFx(layer.id, f);
          }
          // CRITICAL: Bump paintVersion so canvas re-renders (markDirty does NOT do this)
          paintStore.paintVersion.value++;

          // Push SINGLE undo action that restores ALL frames atomically
          const layerId = layer.id;
          const selectedIdsCopy = [...selectedIds];
          pushAction({
            id: crypto.randomUUID(),
            description: `Animate ${strokes.length} stroke(s) across ${targetFrameCount} frames`,
            timestamp: Date.now(),
            undo: () => {
              // Restore all frames to their before-state
              for (const [f, elements] of beforeSnapshots) {
                const frame = paintStore._getOrCreateFrame(layerId, f);
                frame.elements = [...elements];
                paintStore.markDirty(layerId, f);
                paintStore.invalidateFrameFxCache(layerId, f);
                paintStore.refreshFrameFx(layerId, f);
              }
              // CRITICAL: Bump paintVersion so canvas re-renders after undo
              paintStore.paintVersion.value++;
            },
            redo: () => {
              // Re-apply: remove originals, add animated strokes
              const pf = paintStore._getOrCreateFrame(layerId, currentFrame);
              pf.elements = pf.elements.filter(e => !selectedIdsCopy.includes(e.id));
              for (const { frames: strokeFrames } of allStrokeFrames) {
                for (let i = 0; i < strokeFrames.length; i++) {
                  const targetFrame = currentFrame + i;
                  const frame = paintStore._getOrCreateFrame(layerId, targetFrame);
                  frame.elements.push(strokeFrames[i]);
                  paintStore.markDirty(layerId, targetFrame);
                  paintStore.invalidateFrameFxCache(layerId, targetFrame);
                  paintStore.refreshFrameFx(layerId, targetFrame);
                }
              }
              // CRITICAL: Bump paintVersion so canvas re-renders after redo
              paintStore.paintVersion.value++;
            },
          });

          paintStore.selectedStrokeIds.value = new Set();
        }

        return (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAnimateDialog(false); }}
          >
            <div style={{
              backgroundColor: 'var(--sidebar-bg)', borderRadius: '8px',
              padding: '16px', minWidth: '280px', maxWidth: '360px',
              border: '1px solid var(--color-border-subtle)',
            }}>
              <h3 style={{fontSize: '13px', fontWeight: 600, color: 'var(--sidebar-text-primary)', marginBottom: '8px'}}>
                Animate Stroke (Draw Reveal)
              </h3>
              <p style={{fontSize: '11px', color: 'var(--sidebar-text-secondary)', marginBottom: '12px'}}>
                Distribute stroke points across frames:
              </p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <button
                  class="paint-action-btn text-[11px] py-2 px-3 rounded cursor-pointer transition-colors"
                  onClick={() => handleAnimate('layer')}
                >
                  Current frame to end of layer
                </button>
                <button
                  class="paint-action-btn text-[11px] py-2 px-3 rounded cursor-pointer transition-colors"
                  onClick={() => handleAnimate('sequence')}
                >
                  Current frame to end of sequence
                </button>
              </div>
              <div style={{marginTop: '12px', textAlign: 'right'}}>
                <button
                  class="text-[11px] py-1 px-3 rounded cursor-pointer"
                  style={{color: 'var(--sidebar-text-secondary)', backgroundColor: 'transparent', border: 'none'}}
                  onClick={() => setShowAnimateDialog(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* BRUSH section -- style buttons + FX + size/color + opacity/clear + stroke sliders (per D-03, D-04, D-05, D-06) */}
      {showBrushSettings && (
        <div>
          <SectionLabel text="BRUSH" />
          <div class="flex flex-col gap-2 mt-1.5">
            {/* D-03/D-22: Style buttons -- only visible in FX paint mode */}
            {paintStore.activePaintMode.value === 'fx-paint' && (activeTool === 'brush' || activeTool === 'select') && (
              <>
                <div class="flex flex-wrap gap-1">
                  {BRUSH_STYLES.filter(s => s !== 'flat').map((style) => {
                    const isActive = paintStore.brushStyle.value === style;
                    return (
                      <button
                        key={style}
                        class={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${
                          isActive ? 'paint-style-btn-active' : 'paint-action-btn'
                        }`}
                        onClick={() => {
                          paintStore.brushStyle.value = style;
                          paintStore.brushFxParams.value = {...DEFAULT_BRUSH_FX_PARAMS[style]};
                        }}
                      >
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </button>
                    );
                  })}
                </div>
                {activeTool === 'select' && paintStore.selectedStrokeIds.value.size > 0 && (
                  <div class="text-[9px] px-1 opacity-60" style={{color: 'var(--sidebar-text-secondary)'}}>
                    Click a style to apply FX to {paintStore.selectedStrokeIds.value.size} selected stroke(s)
                  </div>
                )}
              </>
            )}

            {/* BRUSH FX PARAMS -- visible when non-flat style selected in FX mode */}
            {paintStore.activePaintMode.value === 'fx-paint' && (activeTool === 'brush' || activeTool === 'select') && (() => {
              const style = paintStore.brushStyle.value;
              const visibleParams = BRUSH_FX_VISIBLE_PARAMS[style] || [];
              if (visibleParams.length === 0) return null;
              const params = paintStore.brushFxParams.value;
              return (
                <div class="flex flex-col gap-2">
                  {visibleParams.map((paramKey) => (
                    <div key={paramKey} class="flex items-center gap-2">
                      <span class="text-[10px] w-16 shrink-0 capitalize" style={{color: 'var(--sidebar-text-secondary)'}}>
                        {paramKey}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={params[paramKey] ?? 0}
                        class="flex-1 min-w-0 h-1 cursor-pointer"
                        style={{accentColor: 'var(--color-accent)'}}
                        onInput={(e) => {
                          paintStore.brushFxParams.value = {
                            ...paintStore.brushFxParams.value,
                            [paramKey]: parseFloat((e.target as HTMLInputElement).value),
                          };
                        }}
                      />
                      <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                        {(params[paramKey] ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Spacer between style buttons/FX and size controls */}
            <div style={{ height: '4px' }} />

            {/* Size -- full row */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-8 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Size</span>
              <input
                type="range"
                min={BRUSH_SIZE_MIN}
                max={BRUSH_SIZE_MAX}
                step={1}
                value={brushSizeVal}
                class="flex-1 min-w-0 h-1 cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onInput={(e) => paintStore.setBrushSize(parseInt((e.target as HTMLInputElement).value, 10))}
              />
              <input
                type="number"
                min={BRUSH_SIZE_MIN}
                max={BRUSH_SIZE_MAX}
                step={1}
                value={brushSizeVal}
                class="w-12 text-[11px] rounded px-1.5 py-0.5 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)'}}
                onInput={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(v)) paintStore.setBrushSize(v);
                }}
              />
            </div>

            {/* Brush Color | Clear Brushes (2-col) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <div class="flex items-center gap-2">
                <span class="text-[10px] w-16 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Brush Color</span>
                <button
                  class="w-6 h-6 rounded border cursor-pointer shrink-0"
                  style={{
                    backgroundColor: brushColorVal,
                    borderColor: 'var(--color-border-subtle)',
                  }}
                  title="Change brush color"
                  onClick={() => paintStore.toggleInlineColorPicker()}
                />
                <span class="text-[11px] font-mono" style={{color: 'var(--sidebar-text-primary)'}}>
                  {brushColorVal.toUpperCase()}
                </span>
              </div>
              {/* Clear Brushes button -- D-03: no confirmation */}
              <div>
                <button
                  class="paint-action-btn"
                  onClick={() => paintStore.clearFrame(layer.id, timelineStore.currentFrame.peek())}
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Clear Brushes
                </button>
              </div>
            </div>

            {/* Spacer between Brush Color and Opacity */}
            <div style={{ height: '4px' }} />

            {/* Opacity -- full row */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-12 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(brushOpacityVal * 100)}
                class="flex-1 min-w-0 h-1 cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onInput={(e) => paintStore.setBrushOpacity(parseInt((e.target as HTMLInputElement).value, 10) / 100)}
              />
              <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                {Math.round(brushOpacityVal * 100)}%
              </span>
            </div>

            {/* D-06: Thinning/Smoothing/Streamline sliders (moved from STROKE, no section label) */}
            {showStrokeOptions && (
              <>
                {/* Thinning */}
                <div class="flex items-center gap-2">
                  <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Thinning</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={strokeOpts.thinning}
                    class="flex-1 min-w-0 h-1 cursor-pointer"
                    style={{accentColor: 'var(--color-accent)'}}
                    onInput={(e) => {
                      paintStore.strokeOptions.value = {...paintStore.strokeOptions.value, thinning: parseFloat((e.target as HTMLInputElement).value)};
                    }}
                  />
                  <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                    {strokeOpts.thinning.toFixed(1)}
                  </span>
                </div>

                {/* Smoothing */}
                <div class="flex items-center gap-2">
                  <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Smoothing</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={strokeOpts.smoothing}
                    class="flex-1 min-w-0 h-1 cursor-pointer"
                    style={{accentColor: 'var(--color-accent)'}}
                    onInput={(e) => {
                      paintStore.strokeOptions.value = {...paintStore.strokeOptions.value, smoothing: parseFloat((e.target as HTMLInputElement).value)};
                    }}
                  />
                  <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                    {strokeOpts.smoothing.toFixed(1)}
                  </span>
                </div>

                {/* Streamline */}
                <div class="flex items-center gap-2">
                  <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Streamline</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={strokeOpts.streamline}
                    class="flex-1 min-w-0 h-1 cursor-pointer"
                    style={{accentColor: 'var(--color-accent)'}}
                    onInput={(e) => {
                      paintStore.strokeOptions.value = {...paintStore.strokeOptions.value, streamline: parseFloat((e.target as HTMLInputElement).value)};
                    }}
                  />
                  <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                    {strokeOpts.streamline.toFixed(1)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* BRUSH STYLE -- visible for select tool in FX mode when brush settings are NOT shown (select+shape) */}
      {paintStore.activePaintMode.value === 'fx-paint' && !showBrushSettings && (activeTool === 'brush' || activeTool === 'select') && (
        <div>
          <SectionLabel text="BRUSH" />
          <div class="flex flex-col gap-2 mt-1.5">
            <div class="flex flex-wrap gap-1">
              {BRUSH_STYLES.map((style) => {
                const isActive = paintStore.brushStyle.value === style;
                return (
                  <button
                    key={style}
                    class={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${
                      isActive ? 'paint-style-btn-active' : 'paint-action-btn'
                    }`}
                    onClick={() => {
                      paintStore.brushStyle.value = style;
                      paintStore.brushFxParams.value = {...DEFAULT_BRUSH_FX_PARAMS[style]};
                    }}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                );
              })}
            </div>
            {activeTool === 'select' && paintStore.selectedStrokeIds.value.size > 0 && (
              <div class="text-[9px] px-1 opacity-60" style={{color: 'var(--sidebar-text-secondary)'}}>
                Click a style to apply FX to {paintStore.selectedStrokeIds.value.size} selected stroke(s)
              </div>
            )}
            {/* BRUSH FX PARAMS -- visible when non-flat style selected */}
            {(() => {
              const style = paintStore.brushStyle.value;
              const visibleParams = BRUSH_FX_VISIBLE_PARAMS[style] || [];
              if (visibleParams.length === 0) return null;
              const params = paintStore.brushFxParams.value;
              return (
                <div class="flex flex-col gap-2">
                  {visibleParams.map((paramKey) => (
                    <div key={paramKey} class="flex items-center gap-2">
                      <span class="text-[10px] w-16 shrink-0 capitalize" style={{color: 'var(--sidebar-text-secondary)'}}>
                        {paramKey}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={params[paramKey] ?? 0}
                        class="flex-1 min-w-0 h-1 cursor-pointer"
                        style={{accentColor: 'var(--color-accent)'}}
                        onInput={(e) => {
                          paintStore.brushFxParams.value = {
                            ...paintStore.brushFxParams.value,
                            [paramKey]: parseFloat((e.target as HTMLInputElement).value),
                          };
                        }}
                      />
                      <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                        {(params[paramKey] ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SHAPE options (unchanged, conditional) */}
      {showShapeOptions && (
        <div>
          <SectionLabel text="SHAPE" />
          <div class="flex flex-col gap-2 mt-1.5">
            {/* Filled checkbox */}
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shapeFilledVal}
                class="cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onChange={(e) => {
                  paintStore.shapeFilled.value = (e.target as HTMLInputElement).checked;
                }}
              />
              <span class="text-[11px]" style={{color: 'var(--sidebar-text-primary)'}}>Filled</span>
            </label>

            {/* Stroke Width (for outline shapes) */}
            {!shapeFilledVal && (
              <div class="flex items-center gap-2">
                <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Width</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={brushSizeVal}
                  class="flex-1 min-w-0 h-1 cursor-pointer"
                  style={{accentColor: 'var(--color-accent)'}}
                  onInput={(e) => paintStore.setBrushSize(parseInt((e.target as HTMLInputElement).value, 10))}
                />
                <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                  {brushSizeVal}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FILL options (unchanged, conditional) */}
      {showFillOptions && (
        <div>
          <SectionLabel text="FILL" />
          <div class="flex flex-col gap-2 mt-1.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Tolerance</span>
              <input
                type="range"
                min={0}
                max={255}
                step={1}
                value={fillToleranceVal}
                class="flex-1 min-w-0 h-1 cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onInput={(e) => {
                  paintStore.fillTolerance.value = parseInt((e.target as HTMLInputElement).value, 10);
                }}
              />
              <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                {fillToleranceVal}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TABLET (collapsible, unchanged -- per D-07) */}
      {showStrokeOptions && (
        <div>
          <button
            class="flex items-center gap-1 cursor-pointer w-full"
            onClick={() => setTabletCollapsed(!tabletCollapsed)}
          >
            <span
              class="text-[10px] transition-transform"
              style={{
                color: 'var(--sidebar-text-secondary)',
                transform: tabletCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              }}
            >
              &#9660;
            </span>
            <SectionLabel text="TABLET" />
          </button>

          {!tabletCollapsed && (
            <div class="flex flex-col gap-2 mt-1.5">
              {/* Pressure Curve slider */}
              <div class="flex items-center gap-2">
                <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Curve</span>
                <input
                  type="range"
                  min={0.3}
                  max={4.0}
                  step={0.1}
                  value={strokeOpts.pressureCurve ?? 2.0}
                  class="flex-1 min-w-0 h-1 cursor-pointer"
                  style={{accentColor: 'var(--color-accent)'}}
                  onInput={(e) => {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    paintStore.strokeOptions.value = {
                      ...paintStore.strokeOptions.value,
                      pressureCurve: val,
                    };
                  }}
                />
                <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                  {(strokeOpts.pressureCurve ?? 2.0).toFixed(1)}
                </span>
              </div>

              {/* Tilt Influence */}
              <div class="flex items-center gap-2">
                <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Tilt</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={strokeOpts.tiltInfluence}
                  class="flex-1 min-w-0 h-1 cursor-pointer"
                  style={{accentColor: 'var(--color-accent)'}}
                  onInput={(e) => {
                    paintStore.strokeOptions.value = {...paintStore.strokeOptions.value, tiltInfluence: parseFloat((e.target as HTMLInputElement).value)};
                  }}
                />
                <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                  {strokeOpts.tiltInfluence.toFixed(1)}
                </span>
              </div>

              {/* Taper Start */}
              <div class="flex items-center gap-2">
                <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Taper In</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={strokeOpts.taperStart}
                  class="flex-1 min-w-0 h-1 cursor-pointer"
                  style={{accentColor: 'var(--color-accent)'}}
                  onInput={(e) => {
                    paintStore.strokeOptions.value = {...paintStore.strokeOptions.value, taperStart: parseInt((e.target as HTMLInputElement).value, 10)};
                  }}
                />
                <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                  {strokeOpts.taperStart}
                </span>
              </div>

              {/* Taper End */}
              <div class="flex items-center gap-2">
                <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Taper Out</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={strokeOpts.taperEnd}
                  class="flex-1 min-w-0 h-1 cursor-pointer"
                  style={{accentColor: 'var(--color-accent)'}}
                  onInput={(e) => {
                    paintStore.strokeOptions.value = {...paintStore.strokeOptions.value, taperEnd: parseInt((e.target as HTMLInputElement).value, 10)};
                  }}
                />
                <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                  {strokeOpts.taperEnd}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ONION SKIN (collapsible, unchanged -- per D-07) */}
      <div>
        <button
          class="flex items-center gap-1 cursor-pointer w-full"
          onClick={() => setOnionCollapsed(!onionCollapsed)}
        >
          <span
            class="text-[10px] transition-transform"
            style={{
              color: 'var(--sidebar-text-secondary)',
              transform: onionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            &#9660;
          </span>
          <SectionLabel text="ONION SKIN" />
        </button>

        {!onionCollapsed && (
          <div class="flex flex-col gap-2 mt-1.5">
            {/* Enabled */}
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={paintStore.onionSkinEnabled.value}
                class="cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onChange={(e) => {
                  paintStore.onionSkinEnabled.value = (e.target as HTMLInputElement).checked;
                }}
              />
              <span class="text-[11px]" style={{color: 'var(--sidebar-text-primary)'}}>Enabled</span>
            </label>

            {/* Previous frames */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Previous</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={paintStore.onionSkinPrevRange.value}
                class="flex-1 min-w-0 h-1 cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onInput={(e) => {
                  paintStore.onionSkinPrevRange.value = parseInt((e.target as HTMLInputElement).value, 10);
                }}
              />
              <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                {paintStore.onionSkinPrevRange.value}
              </span>
            </div>

            {/* Next frames */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Next</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={paintStore.onionSkinNextRange.value}
                class="flex-1 min-w-0 h-1 cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onInput={(e) => {
                  paintStore.onionSkinNextRange.value = parseInt((e.target as HTMLInputElement).value, 10);
                }}
              />
              <span class="text-[11px] w-6 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                {paintStore.onionSkinNextRange.value}
              </span>
            </div>

            {/* Ghost opacity */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-14 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(paintStore.onionSkinOpacity.value * 100)}
                class="flex-1 min-w-0 h-1 cursor-pointer"
                style={{accentColor: 'var(--color-accent)'}}
                onInput={(e) => {
                  paintStore.onionSkinOpacity.value = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                }}
              />
              <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
                {Math.round(paintStore.onionSkinOpacity.value * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
