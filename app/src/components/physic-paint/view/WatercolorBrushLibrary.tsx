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
      class="watercolor-brush-card"
      data-testid={`watercolor-brush-card-${preset.id}`}
      data-selected={props.selected ? 'true' : 'false'}
      aria-pressed={props.selected}
      title={preset.hint}
      onClick={() => selectAquarelleTip(preset.id)}
    >
      <canvas
        class="watercolor-brush-thumb"
        data-testid={`watercolor-brush-thumb-${preset.id}`}
        width={STROKE_THUMB_WIDTH}
        height={STROKE_THUMB_HEIGHT}
        ref={(el: HTMLCanvasElement | null) => {
          if (el) blitStrokeThumb(el, preset.id);
        }}
      />
      <span class="watercolor-brush-name">
        {preset.name}
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
