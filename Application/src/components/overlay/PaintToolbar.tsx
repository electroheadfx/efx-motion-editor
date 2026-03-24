import {Pen, Eraser, Pipette, PaintBucket, Minus, Square, Circle} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import type {PaintToolType} from '../../types/paint';

const TOOLS: {type: PaintToolType; Icon: typeof Pen; label: string}[] = [
  {type: 'brush', Icon: Pen, label: 'Brush'},
  {type: 'eraser', Icon: Eraser, label: 'Eraser'},
  {type: 'eyedropper', Icon: Pipette, label: 'Eyedropper'},
  {type: 'fill', Icon: PaintBucket, label: 'Fill'},
  {type: 'line', Icon: Minus, label: 'Line'},
  {type: 'rect', Icon: Square, label: 'Rectangle'},
  {type: 'ellipse', Icon: Circle, label: 'Ellipse'},
];

/**
 * Compact floating toolbar shown on the canvas when paint mode is active.
 * Provides quick access to tool selection, brush size, color, and opacity.
 * Reads from the same paintStore signals as PaintProperties (stays in sync).
 */
export function PaintToolbar() {
  const activeTool = paintStore.activeTool.value;
  const brushSizeVal = paintStore.brushSize.value;
  const brushColorVal = paintStore.brushColor.value;
  const brushOpacityVal = paintStore.brushOpacity.value;

  return (
    <div
      class="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2 py-1.5 rounded-lg shadow-xl"
      style={{
        background: 'var(--color-bg-menu)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Tool buttons */}
      {TOOLS.map(({type, Icon, label}) => {
        const isActive = activeTool === type;
        return (
          <button
            key={type}
            class={`flex items-center justify-center rounded cursor-pointer transition-colors ${
              isActive
                ? 'bg-(--color-accent) text-white'
                : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-border-subtle)'
            }`}
            style={{width: '24px', height: '24px', padding: '3px'}}
            title={label}
            onClick={() => paintStore.setTool(type)}
          >
            <Icon size={14} />
          </button>
        );
      })}

      {/* Divider */}
      <div class="w-px h-5 mx-0.5" style={{backgroundColor: 'var(--color-border-subtle)'}} />

      {/* Brush size display with +/- buttons */}
      <div class="flex items-center gap-0.5">
        <button
          class="flex items-center justify-center w-4 h-4 rounded text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer"
          onClick={() => paintStore.setBrushSize(brushSizeVal - 1)}
          title="Decrease size"
        >
          <span class="text-[10px] font-bold leading-none">-</span>
        </button>
        <span
          class="text-[10px] font-mono min-w-[24px] text-center"
          style={{color: 'var(--color-text-primary)'}}
          title="Brush size"
        >
          {brushSizeVal}
        </span>
        <button
          class="flex items-center justify-center w-4 h-4 rounded text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer"
          onClick={() => paintStore.setBrushSize(brushSizeVal + 1)}
          title="Increase size"
        >
          <span class="text-[10px] font-bold leading-none">+</span>
        </button>
      </div>

      {/* Divider */}
      <div class="w-px h-5 mx-0.5" style={{backgroundColor: 'var(--color-border-subtle)'}} />

      {/* Color swatch with native color input */}
      <div class="relative" style={{width: '20px', height: '20px'}}>
        <div
          class="w-full h-full rounded border"
          style={{
            backgroundColor: brushColorVal,
            borderColor: 'var(--color-border-subtle)',
          }}
        />
        <input
          type="color"
          value={brushColorVal}
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Brush color"
          onInput={(e) => paintStore.setBrushColor((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Opacity display */}
      <span
        class="text-[10px] font-mono"
        style={{color: 'var(--color-text-secondary)'}}
        title="Brush opacity"
      >
        {Math.round(brushOpacityVal * 100)}%
      </span>
    </div>
  );
}
