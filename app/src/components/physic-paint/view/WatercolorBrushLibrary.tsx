// ============================================================
//  WatercolorBrushLibrary — the Brush tab's 14-card playground
//  brush grid (261017-xa0 I-03).
//
//  Exactly the BRUSH_PRESETS catalog (round … stipple), nothing
//  else: no category filter, no search, no import affordance, no
//  wc/ size-variant rows. Each card is a painted stroke thumb
//  (watercolorStrokeThumb, paint-once cache) + name + hint.
//
//  Picking a card is a brush-tool variant pick: it runs
//  selectAquarelleTip(preset.id), which keeps the id and forces
//  aquarelleActiveTool to 'brush' (Task 1 seam). Selection is the
//  existing aquarelleSelectedTipId signal — applied in the click
//  handler, never via useEffect.
// ============================================================

import {
  BRUSH_PRESETS,
  type BrushPreset,
} from '@efxlab/efx-watercolor';
import {
  aquarelleSelectedTipId,
  selectAquarelleTip,
} from './aquarelleRecordState';
import {
  STROKE_THUMB_HEIGHT,
  STROKE_THUMB_WIDTH,
  blitStrokeThumb,
  getStrokeThumb,
} from './watercolorStrokeThumb';

function BrushCard(props: { preset: BrushPreset; selected: boolean }) {
  const preset = props.preset;
  // Paint-once cache fill (module-level Map keyed by preset id).
  // First call paints; later renders are a Map hit — no repaint,
  // no toDataURL (52.1 D-19).
  getStrokeThumb(preset.id);
  return (
    <button
      type="button"
      data-testid={`watercolor-brush-card-${preset.id}`}
      data-selected={props.selected ? 'true' : 'false'}
      aria-pressed={props.selected}
      title={preset.hint}
      onClick={() => selectAquarelleTip(preset.id)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px',
        borderRadius: '6px',
        border: props.selected
          ? '1px solid var(--sidebar-accent, #6ea8fe)'
          : '1px solid var(--sidebar-border, #2a3340)',
        background: props.selected
          ? 'var(--sidebar-accent-soft, rgba(110, 168, 254, 0.16))'
          : 'transparent',
        boxSizing: 'border-box',
      }}
    >
      <canvas
        data-testid={`watercolor-brush-thumb-${preset.id}`}
        width={STROKE_THUMB_WIDTH}
        height={STROKE_THUMB_HEIGHT}
        ref={(el: HTMLCanvasElement | null) => {
          if (el) blitStrokeThumb(el, preset.id);
        }}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '4px',
          background: 'var(--sidebar-canvas, #1b222c)',
        }}
      />
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--sidebar-text, #e6edf5)',
        }}
      >
        {preset.name}
      </span>
      <span
        style={{
          fontSize: '10px',
          color: 'var(--sidebar-text-secondary, #9aa5b1)',
        }}
      >
        {preset.hint}
      </span>
    </button>
  );
}

export function WatercolorBrushLibrary() {
  // Narrow signal read (efx-preact-reactivity rule 5).
  const selectedTipId = aquarelleSelectedTipId.value;
  return (
    <div
      data-testid="watercolor-brush-library"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}
    >
      {BRUSH_PRESETS.map((preset) => (
        <BrushCard
          key={preset.id}
          preset={preset}
          selected={preset.id === selectedTipId}
        />
      ))}
    </div>
  );
}
