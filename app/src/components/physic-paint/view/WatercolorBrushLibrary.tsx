// ============================================================
//  WatercolorBrushLibrary — the playground brush grid
//  (261017-xa0 I-03; chalk added by 261027-gh9).
//
//  63-06 D-03: the grid is SECTIONED — the shipped BRUSH_PRESETS
//  first, then "Texture" (the three compile-time wc/builtin-*
//  tips, immediately after the presets), then "Custom" (the open
//  project's imports, rendered only when the project has any).
//  Every card is a painted stroke thumb (watercolorStrokeThumb,
//  generation-keyed paint-once cache) + name; a preset card also
//  carries its hint as a title tooltip.
//
//  Still absent by design: no category filter, no search field,
//  no wc/ size-variant rows. Cards are picked as a brush-tool
//  variant — a preset id or a mask-backed catalog tip id alike.
//
//  261027-gh9g: the retired right-sidebar Brush tab was its last
//  Studio mount; the grid now lives inside the floating brush
//  modal, while the top-bar dropdown uses the same preset list
//  with its own compact rows.
//
//  Picking a card is a brush-tool variant pick: it runs
//  selectAquarelleTip(preset.id), which keeps the id and forces
//  aquarelleActiveTool to 'brush' (Task 1 seam). Selection is the
//  existing aquarelleSelectedTipId signal — applied in the click
//  handler, never via useEffect.
//
//  261029-eur WR-03: a pick also leaves Edit (select) mode FIRST.
//  The right-panel Brush tab and the floating brush modal render
//  regardless of tool or select state, while the Edit switch only
//  renders inside the Eraser cluster — flipping the tool to Brush
//  without disarming select mode would strand it armed (painting
//  blocked) with no visible exit. Mirrors the rail/tool-row law
//  (`setAquarelleSelectMode(false)` before switching tool); the
//  tool switch itself stays inside selectAquarelleTip.
// ============================================================

import type { ComponentChildren } from 'preact';
import {
  BRUSH_PRESETS,
  BUILTIN_TIPS,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import { customBrushTips } from '../../../stores/aquarelleBrushCatalog';
import { aquarelleSelectedTipId } from './aquarelleRecordState';
import {
  aquarelleSelectionEditActive,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import { pickAquarelleBrush } from './aquarellePaintControls';
import {
  STROKE_THUMB_HEIGHT,
  STROKE_THUMB_WIDTH,
  blitStrokeThumb,
  getStrokeThumb,
} from './watercolorStrokeThumb';

/**
 * The painted stroke thumbnail, shared by the Brush tab cards and the Studio
 * top bar. `presetId` is the TIP id: a shipped preset id or a mask-backed
 * catalog id — the thumb module resolves either. Paint-once cache fill
 * (module-level Map keyed by tip id + mask generation): first call paints,
 * later renders are a Map hit — no repaint, no toDataURL.
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

/**
 * One card: a painted stroke preview plus the entry's name. `id` is the tip
 * id the pick records — a preset id (`round`, …) or a catalog tip id
 * (`wc/builtin-chalk`, `wc/custom-…`) — and the thumbnail module resolves
 * both. `title` is the hover tooltip (a preset hint, or the name).
 */
function BrushCard(props: {
  id: string;
  name: string;
  title: string;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      class="watercolor-brush-card"
      data-testid={`watercolor-brush-card-${props.id}`}
      data-selected={props.selected ? 'true' : 'false'}
      aria-pressed={props.selected}
      title={props.title}
      onClick={() => {
        // 261029-eur WR-03, two-part law: leave Edit mode before the pick
        // flips the tool UNLESS a non-empty selection is armed — leaving
        // Select mode clears the selection the pick is about to edit.
        if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false);
        void pickAquarelleBrush(props.id);
      }}
    >
      <WatercolorBrushThumb
        presetId={props.id}
        testId={`watercolor-brush-thumb-${props.id}`}
      />
      <span class="watercolor-brush-name">
        {props.name}
      </span>
    </button>
  );
}

/**
 * One catalog section (63-06 D-03). The section spans both library columns
 * and lays its own 2-column card grid, so section order is the visual order.
 */
function BrushSection(props: {
  id: 'presets' | 'texture' | 'custom';
  title: string;
  children?: ComponentChildren;
}) {
  return (
    <section
      data-testid={`watercolor-brush-section-${props.id}`}
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        class="watercolor-brush-section-title"
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--sidebar-text-secondary, #9aa5b1)',
        }}
      >
        {props.title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        {props.children}
      </div>
    </section>
  );
}

/**
 * The catalog grid. The root keeps its 2-column track set (the CSS contract
 * the card rules were written against) while every section spans both
 * columns; empty sections are skipped, exactly like the category grouping
 * law the retired docker used.
 */
export function WatercolorBrushLibrary() {
  // Narrow signal reads (efx-preact-reactivity rule 5): one selected-id read
  // and one catalog read per render; neither is written from this body.
  const selectedTipId = aquarelleSelectedTipId.value;
  const customTips: readonly AquarelleTip[] = customBrushTips.value;
  return (
    <div
      data-testid="watercolor-brush-library"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}
    >
      <BrushSection id="presets" title="Presets">
        {BRUSH_PRESETS.map((preset) => (
          <BrushCard
            key={preset.id}
            id={preset.id}
            name={preset.name}
            title={preset.hint}
            selected={preset.id === selectedTipId}
          />
        ))}
      </BrushSection>
      <BrushSection id="texture" title="Texture">
        {BUILTIN_TIPS.map((tip) => (
          <BrushCard
            key={tip.id}
            id={tip.id}
            name={tip.name}
            title={tip.name}
            selected={tip.id === selectedTipId}
          />
        ))}
      </BrushSection>
      {customTips.length > 0 ? (
        <BrushSection id="custom" title="Custom">
          {customTips.map((tip) => (
            <BrushCard
              key={tip.id}
              id={tip.id}
              name={tip.name}
              title={tip.name}
              selected={tip.id === selectedTipId}
            />
          ))}
        </BrushSection>
      ) : null}
    </div>
  );
}
