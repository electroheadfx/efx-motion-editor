// ============================================================
//  WatercolorBrushLibrary — the Brush tab's 15-card playground
//  brush grid (261017-xa0 I-03; chalk added by 261027-gh9).
//
//  Exactly the BRUSH_PRESETS catalog (chalk … stipple), nothing
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

/**
 * The painted stroke thumbnail, shared by the Brush tab cards and the Studio
 * top bar. Paint-once cache fill (module-level Map keyed by preset id): first
 * call paints, later renders are a Map hit — no repaint, no toDataURL.
 */
export function WatercolorBrushThumb(props: {
  presetId: string;
  class?: string;
  testId?: string;
}) {
  getStrokeThumb(props.presetId);
  return (
    <canvas
      class={props.class ?? 'watercolor-brush-thumb'}
      data-testid={props.testId}
      width={STROKE_THUMB_WIDTH}
      height={STROKE_THUMB_HEIGHT}
      ref={(el: HTMLCanvasElement | null) => {
        if (el) blitStrokeThumb(el, props.presetId);
      }}
    />
  );
}

function BrushCard(props: { preset: BrushPreset; selected: boolean }) {
  const preset = props.preset;
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
      <WatercolorBrushThumb
        presetId={preset.id}
        testId={`watercolor-brush-thumb-${preset.id}`}
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
