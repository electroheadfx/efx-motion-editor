/**
 * 56-05 (D-09..D-12 / PAPER-01 / PAPER-04): the shared-panel Paper section.
 *
 * 261017-vcn I-04 remainder (Q6 + locked Paper-background decision): the Paper
 * tab is the SINGLE home for paper + background. Top to bottom (261018-f15
 * flatten):
 *   1. RuleSectionHeader "Texture" + Grain strength segmented row + Grain
 *      scale SliderStepper + Texture SliderStepper (names stay Grain strength
 *      + Grain scale; Texture is the oracle PaperPanel texture control, a
 *      continuous 0..1 view over the same grainStrength seam).
 *   2. RuleSectionHeader "Real" + a 2-column grid whose first two cells are
 *      the Transparent + White background arms (paper-card layout, still
 *      onBackgroundChange) followed by the real jpg scans (onPaperIdChange).
 *   3. RuleSectionHeader "Procedural" + the procedural papers in the same
 *      2-column grid.
 *
 * Section titles are the decorative rule-and-label headers — no tab-naming
 * heading, no black sticky group bars. Cards are thumb + name BELOW (the
 * WatercolorBrushLibrary label pattern), never a caption overlay. The outer
 * SidebarScrollArea owns scrolling (no inner maxHeight/overflowY).
 *
 * The former D-10 bottom Strength/Scale pair leaves so one grain pair survives.
 *
 * Cells show the RAW paper tile only (D-11) — the ported playground sheet
 * for procedural papers, the shipped jpg for real scans. No engine
 * involvement in the picker (the composite seam is paperPass; this is
 * presentation only).
 */
import type { JSX } from 'preact';
import {
  PAPER_LIBRARY,
  type PaperDefinition,
} from '@efxlab/efx-watercolor/papers';
import { getPaperThumb } from './paperThumb';
import { SliderStepper } from '../../shared/SliderStepper';
import { RuleSectionHeader } from '../../shared/RuleSectionHeader';
import {
  GRAIN_SCALE_MAX,
  GRAIN_SCALE_MIN,
} from '../../../efx-paint/document/efxPaintDocument';
import type { StudioBackgroundMode } from '../engine/physicsPaintStudioSettings';

export interface PaperPickerProps {
  paperId: string;
  background: StudioBackgroundMode;
  grainStrength: number;
  grainScale: number;
  onPaperIdChange: (id: string) => void;
  onBackgroundChange: (mode: StudioBackgroundMode) => void;
  onGrainStrengthChange: (value: number) => void;
  onGrainScaleChange: (scale: number) => void;
  disabled?: boolean;
}

/**
 * Oracle TEXTURE picker geometry (PaperPanel.tsx SWATCH_W = 112,
 * SWATCH_H = 64): large landscape ~2:1 cards in 2 columns, name BELOW.
 * The old UI-SPEC 64×64 square lock is overridden by the live oracle-look
 * instruction (261018-gqo move 1). GRID_GAP stays 8.
 */
const CARD_WIDTH = 112;
const THUMB_HEIGHT = 64;
const GRID_GAP = 8;

/** Q6: Grain strength segmented values (None / Soft / Med / Hard). */
const GRAIN_STRENGTH_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Soft', value: 0.35 },
  { label: 'Med', value: 0.65 },
  { label: 'Hard', value: 0.95 },
] as const;

/**
 * Locked Paper-background decision: Transparent + White are background, not
 * papers. 261018-f15: they join the Real section as its first two cells.
 */
const BACKGROUND_ARMS: { label: 'Transparent' | 'White'; value: 'transparent' | 'white'; swatch: string }[] = [
  { label: 'Transparent', value: 'transparent', swatch: 'repeating-conic-gradient(#777 0% 25%, #d8d8d8 0% 50%) 0 0 / 8px 8px' },
  { label: 'White', value: 'white', swatch: '#fff' },
];

/**
 * Grain scale step (UAT follow-up): 0.5 strictly inside ]0.5, 2.0[ — the default
 * 1.0 walks 1.5 ⇄ 0.5 in 0.5 jumps — and 0.1 at/below 0.5 and at/above 2.0
 * (0.5 − → 0.4, 2.0 + → 2.1). Pure so hold-to-repeat resolves it per emission.
 * 261017-vcn Q6: moved here with the grain widget from PhysicsPaintTopBar.
 */
export function grainScaleStep(value: number): number {
  return value > 0.5 && value < 2 ? 0.5 : 0.1;
}

function segmentedButtonClass(active: boolean) {
  return `physics-paint-segmented-button${active ? ' active' : ''}`;
}

/**
 * Nearest GRAIN_STRENGTH_OPTIONS match (261018-cy1). A non-finite or missing
 * strength resolves to Soft 0.35 — the factory default in
 * physicsPaintStudioSettings.ts (which must not change).
 */
function activeGrainOptionValue(grainStrength: number): number {
  const value = Number.isFinite(grainStrength) ? grainStrength : 0.35;
  let best = GRAIN_STRENGTH_OPTIONS[0].value;
  let bestDistance = Math.abs(value - best);
  for (const option of GRAIN_STRENGTH_OPTIONS) {
    const distance = Math.abs(value - option.value);
    if (distance < bestDistance) {
      best = option.value;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Engine sheet preview (D-11) with the oracle wash (261018-f15 B2): the
 * paperThumb painter composites the diagonal granulating ultramarine wash
 * over the engine sheet in Canvas 2D. Cached as canvas per (id, size) so
 * re-renders never regenerate. Painted into a cell <canvas> — never a
 * toDataURL string (52.1 D-19). Thumb scale: a ~256-paper-unit-tall window
 * of the sheet so the grain reads at a glance the way the playground
 * preview does.
 */
const reliefCache = new Map<string, HTMLCanvasElement | null>();
function proceduralReliefImage(id: string): HTMLCanvasElement | null {
  const key = `${id}:${CARD_WIDTH}x${THUMB_HEIGHT}`;
  const cached = reliefCache.get(key);
  if (cached !== undefined) return cached;
  const thumb = getPaperThumb(id, CARD_WIDTH, THUMB_HEIGHT);
  reliefCache.set(key, thumb);
  return thumb;
}

/**
 * 261017-mdr: pre-fill the procedural thumb cache so the picker opens without
 * a first-open generation stall. 261018-f15 B2: warms the paperThumb cache
 * (sheet + wash) the cell painter reads. Does not touch the landscape card
 * constants / GRID_GAP / the 2-column grid.
 */
export function warmProceduralReliefThumbs(): void {
  for (const entry of PAPER_LIBRARY) {
    if (entry.group !== 'procedural') continue;
    getPaperThumb(entry.id, CARD_WIDTH, THUMB_HEIGHT);
  }
}

/**
 * Shared paper-card chrome (261018-f15 / 261018-gqo move 1): landscape
 * 112×64 thumb + small uppercase name BELOW it (oracle TEXTURE picker /
 * WatercolorBrushLibrary label pattern). Never a caption overlay.
 */
function PaperCard(props: {
  name: string;
  active: boolean;
  disabled?: boolean;
  title: string;
  attributes?: Record<string, string>;
  onSelect: () => void;
  thumb: JSX.Element;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`paper-picker-cell${props.active ? ' active' : ''}`}
      aria-pressed={props.active}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onSelect}
      {...props.attributes}
      style={{
        width: `${CARD_WIDTH}px`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        border: props.active ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: props.disabled ? 'default' : 'pointer',
        background: 'var(--color-bg-input)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${THUMB_HEIGHT}px`,
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
      >
        {props.thumb}
      </div>
      <span
        class="paper-picker-cell-name"
        style={{
          display: 'block',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '2px 1px',
          lineHeight: 1.2,
          color: props.active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}
      >
        {props.name}
      </span>
    </button>
  );
}

function PaperCell(props: {
  entry: PaperDefinition;
  active: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}): JSX.Element {
  const isReal = props.entry.group === 'real';
  const relief = isReal ? null : proceduralReliefImage(props.entry.id);
  // Loading / decode-failure share one placeholder: --color-bg-input (UI-SPEC
  // loading + error rows — never a blank cell, never a crash).
  const showPlaceholder = isReal || relief === null;
  return (
    <PaperCard
      name={props.entry.name}
      active={props.active}
      disabled={props.disabled}
      title={props.entry.name}
      attributes={{
        'data-paper-id': props.entry.id,
        'data-paper-group': props.entry.group,
      }}
      onSelect={() => props.onSelect(props.entry.id)}
      thumb={
        showPlaceholder ? (
          isReal ? (
            <img
              src={props.entry.source}
              alt={props.entry.name}
              data-paper-tile="real"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(event) => {
                // Decode failure keeps the placeholder fill (UI-SPEC error
                // row) — hide the broken image, never a blank crash.
                (event.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              data-paper-tile="procedural"
              aria-label={props.entry.name}
              style={{ width: '100%', height: '100%', background: 'var(--color-bg-input)' }}
            />
          )
        ) : (
          <canvas
            data-paper-tile="procedural"
            aria-label={props.entry.name}
            width={CARD_WIDTH}
            height={THUMB_HEIGHT}
            ref={(el: HTMLCanvasElement | null) => {
              if (!el) return;
              const ctx = el.getContext('2d');
              if (ctx && relief) ctx.drawImage(relief, 0, 0);
            }}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        )
      }
    />
  );
}

function BackgroundArmCell(props: {
  label: 'Transparent' | 'White';
  value: 'transparent' | 'white';
  swatch: string;
  active: boolean;
  disabled?: boolean;
  onSelect: (mode: StudioBackgroundMode) => void;
}): JSX.Element {
  return (
    <PaperCard
      name={props.label}
      active={props.active}
      disabled={props.disabled}
      title={props.label}
      attributes={{
        'data-paper-background': props.value,
        'aria-label': props.label,
      }}
      onSelect={() => props.onSelect(props.value)}
      thumb={
        <div
          class="physics-paint-paper-swatch"
          data-paper-tile="background"
          style={{ width: '100%', height: '100%', background: props.swatch }}
        />
      }
    />
  );
}

export function PaperPicker(props: PaperPickerProps): JSX.Element {
  const procedural = PAPER_LIBRARY.filter((entry) => entry.group === 'procedural');
  const real = PAPER_LIBRARY.filter((entry) => entry.group === 'real');
  const activeGrainValue = activeGrainOptionValue(props.grainStrength);

  return (
    <div class="paper-picker" data-paper-picker style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Texture titles the grain pair (oracle Texture slider naming). */}
      <RuleSectionHeader text="Texture" />
      <div
        class="paper-picker-grain"
        data-paper-picker-grain
        style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
      >
        <div class="physics-paint-segmented-row" role="group" aria-label="Grain strength">
          {GRAIN_STRENGTH_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={props.disabled}
              class={segmentedButtonClass(activeGrainValue === option.value)}
              onClick={() => props.onGrainStrengthChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <SliderStepper
          label="Grain scale"
          value={props.grainScale}
          step={grainScaleStep(props.grainScale)}
          resolveStep={grainScaleStep}
          min={GRAIN_SCALE_MIN}
          max={GRAIN_SCALE_MAX}
          ariaLabel="Grain scale"
          disabled={props.disabled}
          freeEntry
          onChange={props.onGrainScaleChange}
        />
        {/* Oracle PaperPanel Texture slider (261018-ias): continuous 0..1 view
            over the SAME grainStrength seam the segmented presets write. Rides
            handleGrainStrengthChange unchanged — no second strength store
            (261018-gqo). Tooltip is the oracle sentence on the row wrapper. */}
        <div
          class="paper-picker-texture-row"
          data-paper-picker-texture
          title="How strongly the paper's tooth, fibres and flecks show. Saved images use the same strength."
        >
          <SliderStepper
            label="Texture"
            value={props.grainStrength}
            step={0.01}
            min={0}
            max={1}
            ariaLabel="Texture"
            disabled={props.disabled}
            freeEntry
            onChange={props.onGrainStrengthChange}
          />
        </div>
      </div>

      {/* Flat list (261018-f15): rule-and-label section titles, no card
          chrome, no inner scroller — the outer SidebarScrollArea owns it. */}
      <div
        class="paper-picker-popover"
        data-paper-picker-popover
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div data-paper-group-header="real">
          <RuleSectionHeader text="Real" />
        </div>
        <div
          class="paper-picker-grid"
          data-paper-group-grid="real"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(2, ${CARD_WIDTH}px)`,
            gap: `${GRID_GAP}px`,
          }}
        >
          {/* Locked Paper-background decision: Transparent + White lead the
              Real section as paper cards; the hook keeps the pair findable. */}
          <div data-paper-picker-backgrounds style={{ display: 'contents' }}>
            {BACKGROUND_ARMS.map((option) => (
              <BackgroundArmCell
                key={option.value}
                label={option.label}
                value={option.value}
                swatch={option.swatch}
                active={props.background === option.value}
                disabled={props.disabled}
                onSelect={props.onBackgroundChange}
              />
            ))}
          </div>
          {real.map((entry) => (
            <PaperCell
              key={entry.id}
              entry={entry}
              active={entry.id === props.paperId}
              onSelect={props.onPaperIdChange}
              disabled={props.disabled}
            />
          ))}
        </div>
        <div data-paper-group-header="procedural">
          <RuleSectionHeader text="Procedural" />
        </div>
        <div
          class="paper-picker-grid"
          data-paper-group-grid="procedural"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(2, ${CARD_WIDTH}px)`,
            gap: `${GRID_GAP}px`,
          }}
        >
          {procedural.map((entry) => (
            <PaperCell
              key={entry.id}
              entry={entry}
              active={entry.id === props.paperId}
              onSelect={props.onPaperIdChange}
              disabled={props.disabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
