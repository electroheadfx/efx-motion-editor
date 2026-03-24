import {useState} from 'preact/hooks';
import {Pen, Eraser, Pipette, PaintBucket, Minus, Square, Circle} from 'lucide-preact';
import {SectionLabel} from '../shared/SectionLabel';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import {paintStore} from '../../stores/paintStore';
import {timelineStore} from '../../stores/timelineStore';
import {BRUSH_SIZE_MIN, BRUSH_SIZE_MAX} from '../../types/paint';
import type {PaintToolType} from '../../types/paint';
import type {Layer} from '../../types/layer';

const TOOLS: {type: PaintToolType; Icon: typeof Pen; label: string}[] = [
  {type: 'brush', Icon: Pen, label: 'Brush'},
  {type: 'eraser', Icon: Eraser, label: 'Eraser'},
  {type: 'eyedropper', Icon: Pipette, label: 'Eyedropper'},
  {type: 'fill', Icon: PaintBucket, label: 'Fill'},
  {type: 'line', Icon: Minus, label: 'Line'},
  {type: 'rect', Icon: Square, label: 'Rectangle'},
  {type: 'ellipse', Icon: Circle, label: 'Ellipse'},
];

const SHAPE_TOOLS: PaintToolType[] = ['line', 'rect', 'ellipse'];
const BRUSH_TOOLS: PaintToolType[] = ['brush', 'eraser'];
const STROKE_TOOLS: PaintToolType[] = ['brush', 'eraser'];

export function PaintProperties({layer}: {layer: Layer}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [onionCollapsed, setOnionCollapsed] = useState(true);

  const activeTool = paintStore.activeTool.value;
  const brushSizeVal = paintStore.brushSize.value;
  const brushColorVal = paintStore.brushColor.value;
  const brushOpacityVal = paintStore.brushOpacity.value;
  const strokeOpts = paintStore.strokeOptions.value;
  const shapeFilledVal = paintStore.shapeFilled.value;
  const fillToleranceVal = paintStore.fillTolerance.value;

  const showBrushSettings = BRUSH_TOOLS.includes(activeTool) || SHAPE_TOOLS.includes(activeTool);
  const showStrokeOptions = STROKE_TOOLS.includes(activeTool);
  const showShapeOptions = SHAPE_TOOLS.includes(activeTool);
  const showFillOptions = activeTool === 'fill';

  return (
    <div class="px-3 py-2 space-y-3">
      {/* Layer name */}
      <div class="text-[12px] font-medium px-1" style={{color: 'var(--sidebar-text-primary)'}}>
        {layer.name}
      </div>

      {/* 1. Tool Selection */}
      <div>
        <SectionLabel text="TOOLS" />
        <div class="grid grid-cols-4 gap-1 mt-1.5">
          {TOOLS.map(({type, Icon, label}) => {
            const isActive = activeTool === type;
            return (
              <button
                key={type}
                class={`flex items-center justify-center w-full h-8 rounded cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-(--color-accent) text-white'
                    : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-border-subtle)'
                }`}
                title={label}
                onClick={() => paintStore.setTool(type)}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Brush Settings */}
      {showBrushSettings && (
        <div>
          <SectionLabel text="BRUSH" />
          <div class="flex flex-col gap-2 mt-1.5">
            {/* Size */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-10 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Size</span>
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

            {/* Color */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-10 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Color</span>
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

            {/* Opacity */}
            <div class="flex items-center gap-2">
              <span class="text-[10px] w-10 shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>Opacity</span>
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
          </div>
        </div>
      )}

      {/* 3. Stroke Options */}
      {showStrokeOptions && (
        <div>
          <SectionLabel text="STROKE" />
          <div class="flex flex-col gap-2 mt-1.5">
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
          </div>
        </div>
      )}

      {/* 4. Shape Options */}
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

      {/* 5. Fill Options */}
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

      {/* 6. Onion Skin */}
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

      {/* 7. Actions */}
      <div style={{paddingTop: '4px'}}>
        <SectionLabel text="ACTIONS" />
        <div class="mt-1.5">
          {confirmClear ? (
            <div class="flex items-center gap-2">
              <span class="text-[11px]" style={{color: 'var(--color-text-secondary)'}}>Clear all paint on this frame?</span>
              <button
                class="text-[11px] px-2 py-0.5 rounded cursor-pointer"
                style={{backgroundColor: '#dc2626', color: 'white'}}
                onClick={() => {
                  paintStore.clearFrame(layer.id, timelineStore.currentFrame.peek());
                  setConfirmClear(false);
                }}
              >
                Yes
              </button>
              <button
                class="text-[11px] px-2 py-0.5 rounded cursor-pointer"
                style={{backgroundColor: 'var(--color-bg-input)', color: 'var(--sidebar-text-primary)'}}
                onClick={() => setConfirmClear(false)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              class="text-[11px] px-2 py-1 rounded cursor-pointer transition-colors hover:opacity-80"
              style={{color: '#dc2626', backgroundColor: 'var(--color-bg-input)'}}
              onClick={() => setConfirmClear(true)}
            >
              Clear Frame
            </button>
          )}
        </div>
      </div>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPickerModal
          color={brushColorVal}
          onLiveChange={(c) => paintStore.setBrushColor(c)}
          onCommit={(c) => {
            paintStore.setBrushColor(c);
            setShowColorPicker(false);
          }}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
