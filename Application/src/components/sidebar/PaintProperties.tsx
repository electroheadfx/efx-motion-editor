import {useState} from 'preact/hooks';
import {SectionLabel} from '../shared/SectionLabel';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import {paintStore} from '../../stores/paintStore';
import {timelineStore} from '../../stores/timelineStore';
import {BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, DEFAULT_PAINT_BG_COLOR, BRUSH_STYLES, BRUSH_FX_VISIBLE_PARAMS, DEFAULT_BRUSH_FX_PARAMS} from '../../types/paint';
import type {PaintToolType} from '../../types/paint';
import type {Layer} from '../../types/layer';

const SHAPE_TOOLS: PaintToolType[] = ['line', 'rect', 'ellipse'];
const BRUSH_TOOLS: PaintToolType[] = ['brush', 'eraser'];
const STROKE_TOOLS: PaintToolType[] = ['brush', 'eraser'];

export function PaintProperties({layer}: {layer: Layer}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [onionCollapsed, setOnionCollapsed] = useState(true);
  const [tabletCollapsed, setTabletCollapsed] = useState(true);

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
      {/* Layer name + exit paint mode */}
      <div class="flex items-center justify-between px-1">
        <div class="text-[12px] font-medium" style={{color: 'var(--sidebar-text-primary)'}}>
          {layer.name}
        </div>
        <button
          class="paint-action-btn text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors"
          onClick={() => paintStore.paintMode.value = false}
          title="Exit paint mode (P)"
        >
          Exit Paint Mode
        </button>
      </div>

      {/* Rendering indicator */}
      {paintStore.isRenderingFx.value && (
        <div class="flex items-center gap-2 px-1 py-1 rounded text-[10px]"
          style={{backgroundColor: 'var(--color-accent)', color: 'white'}}>
          <span class="animate-pulse">Rendering FX...</span>
        </div>
      )}

      {/* Flat preview mode indicator */}
      {paintStore.showFlatPreview.value && (
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

      {/* Background + Clear Brushes row (per D-01) */}
      <div style={{ padding: '4px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* BG Color swatch with label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--sidebar-text-secondary)' }}>Background Color</span>
            <div
              style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: bgColor, cursor: 'pointer', border: '1px solid var(--color-border-subtle)' }}
              onClick={() => setShowBgColorPicker(true)}
              title="Paint background color"
            />
          </div>
          {/* Show Seq BG checkbox */}
          <label style={{ fontSize: '10px', color: 'var(--sidebar-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={paintStore.showSequenceOverlay.value}
              onChange={() => paintStore.toggleSequenceOverlay()}
              style={{ width: 12, height: 12 }}
            />
            Show Seq BG
          </label>
          {/* Reset button */}
          {bgColor !== DEFAULT_PAINT_BG_COLOR && (
            <button
              onClick={() => paintStore.setPaintBgColor(DEFAULT_PAINT_BG_COLOR)}
              style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-secondary)', cursor: 'pointer', border: 'none' }}
            >
              Reset
            </button>
          )}
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
          onLiveChange={(c) => paintStore.setPaintBgColor(c)}
          onCommit={(c) => {
            paintStore.setPaintBgColor(c);
            setShowBgColorPicker(false);
          }}
          onClose={() => setShowBgColorPicker(false)}
        />
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
                    if (el.tool === 'brush') {
                      paintStore.selectStroke(el.id);
                    }
                  }
                }}
              >
                Select All Strokes
              </button>
              {paintStore.selectedStrokeIds.value.size > 0 ? (
                <button
                  class="paint-action-btn text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
                  style={{ color: '#dc2626' }}
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
                  if (el.tool === 'brush' && sel.has(el.id)) {
                    currentWidth = Math.round((el as any).size);
                    currentColor = (el as any).color || currentColor;
                    break;
                  }
                }
              }
              const applyWidth = (newSize: number, andRefreshFx = false) => {
                if (!pf) return;
                for (const el of pf.elements) {
                  if (el.tool !== 'brush') continue;
                  if (!sel.has(el.id)) continue;
                  (el as any).size = newSize;
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
                      onClick={() => setShowColorPicker(true)}
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
          </div>
        </div>
      )}

      {/* Copy to Next Frame -- visible in select mode (Flatten is auto on exit paint mode) */}
      {activeTool === 'select' && (
        <div class="px-1 pt-1">
          <button
            class="paint-action-btn w-full text-[11px] py-1 px-2 rounded cursor-pointer transition-colors"
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
        </div>
      )}

      {/* BRUSH section -- style buttons + FX + size/color + opacity/clear + stroke sliders (per D-03, D-04, D-05, D-06) */}
      {showBrushSettings && (
        <div>
          <SectionLabel text="BRUSH" />
          <div class="flex flex-col gap-2 mt-1.5">
            {/* D-03: Style buttons (moved from separate BRUSH STYLE section) */}
            {(activeTool === 'brush' || activeTool === 'select') && (
              <>
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
              </>
            )}

            {/* BRUSH FX PARAMS -- visible when non-flat style selected */}
            {(activeTool === 'brush' || activeTool === 'select') && (() => {
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
                  onClick={() => setShowColorPicker(true)}
                />
                <span class="text-[11px] font-mono" style={{color: 'var(--sidebar-text-primary)'}}>
                  {brushColorVal.toUpperCase()}
                </span>
              </div>
              {/* Clear Brushes button */}
              <div>
                {confirmClear ? (
                  <div class="flex items-center gap-1">
                    <span class="text-[9px]" style={{color: 'var(--sidebar-text-secondary)'}}>Clear?</span>
                    <button
                      class="paint-action-btn text-[10px] px-2 py-0.5 rounded cursor-pointer"
                      style={{backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none'}}
                      onClick={() => {
                        paintStore.clearFrame(layer.id, timelineStore.currentFrame.peek());
                        setConfirmClear(false);
                      }}
                    >
                      Yes
                    </button>
                    <button
                      class="paint-action-btn text-[10px] px-2 py-0.5 rounded cursor-pointer"
                      onClick={() => setConfirmClear(false)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    class="paint-action-btn"
                    onClick={() => setConfirmClear(true)}
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
                )}
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

      {/* BRUSH STYLE -- visible for select tool when brush settings are NOT shown (select+shape) */}
      {!showBrushSettings && (activeTool === 'brush' || activeTool === 'select') && (
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

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPickerModal
          color={brushColorVal}
          onLiveChange={(c) => {
            paintStore.setBrushColor(c);
            // Also update selected strokes live
            if (activeTool === 'select' && paintStore.selectedStrokeIds.peek().size > 0) {
              const fr = timelineStore.currentFrame.peek();
              const pf2 = paintStore.getFrame(layer.id, fr);
              if (pf2) {
                const sel2 = paintStore.selectedStrokeIds.peek();
                for (const el of pf2.elements) {
                  if (el.tool === 'brush' && sel2.has(el.id)) (el as any).color = c;
                }
                paintStore.markDirty(layer.id, fr);
                paintStore.invalidateFrameFxCache(layer.id, fr);
                paintStore.paintVersion.value++;
              }
            }
          }}
          onCommit={(c) => {
            paintStore.setBrushColor(c);
            if (activeTool === 'select' && paintStore.selectedStrokeIds.peek().size > 0) {
              paintStore.refreshFrameFx(layer.id, timelineStore.currentFrame.peek());
            }
            setShowColorPicker(false);
          }}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
