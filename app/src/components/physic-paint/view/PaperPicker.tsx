/**
 * 56-05 (D-09..D-12 / PAPER-01 / PAPER-04): the shared-panel Paper section.
 *
 * Trigger shows `Paper` + the current paper name. Clicking opens a thumbnail
 * grid popover: 3 columns, 64×64 cells, groups Procedural then Real (D-12 one
 * library, never tabs). Strength + scale SliderStepper rows sit directly under
 * the trigger, always reachable (D-10 / D-06).
 *
 * Cells show the RAW paper tile only (D-11) — height-map lit relief for
 * procedural papers, the shipped jpg for real scans. No engine involvement in
 * the picker (the composite seam is paperPass; this is presentation only).
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { PAPER_LIBRARY, proceduralHeightMap, type PaperDefinition } from '@efxlab/efx-watercolor/papers';
import { SliderStepper } from '../../shared/SliderStepper';
import { SectionLabel } from '../../shared/SectionLabel';

export interface PaperPickerProps {
  paperId: string;
  strength: number;
  scale: number;
  onPaperIdChange: (id: string) => void;
  onStrengthChange: (value: number) => void;
  onScaleChange: (value: number) => void;
  disabled?: boolean;
}

function paperName(paperId: string): string {
  return PAPER_LIBRARY.find((entry) => entry.id === paperId)?.name ?? paperId;
}

/** Cell size locked by UI-SPEC: 64×64 tiles, 8px grid gap. */
const CELL_SIZE = 64;
const GRID_GAP = 8;

/**
 * Height-map lit relief preview (D-11): a plain canvas shade of the
 * procedural height field. Pure presentation — no paperPass, no engine.
 * Cached per (id, size) so re-renders never regenerate.
 */
const reliefCache = new Map<string, string>();
function proceduralReliefDataUrl(id: string): string | null {
  const key = `${id}:${CELL_SIZE}`;
  const cached = reliefCache.get(key);
  if (cached !== undefined) return cached || null;
  const height = proceduralHeightMap(id, 1, CELL_SIZE, CELL_SIZE);
  if (!height) {
    reliefCache.set(key, '');
    return null;
  }
  // Lightweight relief shade: h as luminance, one-sided slope toward light.
  const canvas = document.createElement('canvas');
  canvas.width = CELL_SIZE;
  canvas.height = CELL_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    reliefCache.set(key, '');
    return null;
  }
  const image = ctx.createImageData(CELL_SIZE, CELL_SIZE);
  for (let y = 0; y < CELL_SIZE; y++) {
    for (let x = 0; x < CELL_SIZE; x++) {
      const i = y * CELL_SIZE + x;
      const h = height[i];
      const hx = height[y * CELL_SIZE + Math.min(x + 1, CELL_SIZE - 1)];
      const hy = height[Math.min(y + 1, CELL_SIZE - 1) * CELL_SIZE + x];
      const slope = (hx - h) + (hy - h);
      const shade = Math.max(0, Math.min(1, 0.55 + (h - 0.5) * 0.7 - slope * 2.2));
      const channel = Math.round(shade * 255);
      const offset = i * 4;
      image.data[offset] = channel;
      image.data[offset + 1] = channel;
      image.data[offset + 2] = channel;
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const dataUrl = canvas.toDataURL();
  reliefCache.set(key, dataUrl);
  return dataUrl;
}

function PaperCell(props: {
  entry: PaperDefinition;
  active: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}): JSX.Element {
  const isReal = props.entry.group === 'real';
  const relief = isReal ? null : proceduralReliefDataUrl(props.entry.id);
  // Loading / decode-failure share one placeholder: --color-bg-input + name
  // (UI-SPEC loading + error rows — never a blank cell, never a crash).
  const showPlaceholder = isReal || relief === null;
  return (
    <button
      type="button"
      class={`paper-picker-cell${props.active ? ' active' : ''}`}
      data-paper-id={props.entry.id}
      data-paper-group={props.entry.group}
      aria-pressed={props.active}
      title={props.entry.name}
      disabled={props.disabled}
      onClick={() => props.onSelect(props.entry.id)}
      style={{
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        padding: 0,
        border: props.active ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: props.disabled ? 'default' : 'pointer',
        background: 'var(--color-bg-input)',
        position: 'relative',
      }}
    >
      {showPlaceholder ? (
        isReal ? (
          <img
            src={props.entry.source}
            alt={props.entry.name}
            data-paper-tile="real"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(event) => {
              // Decode failure keeps the placeholder fill + name (UI-SPEC
              // error row) — hide the broken image, never a blank crash.
              (event.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null
      ) : (
        <img
          src={relief!}
          alt={props.entry.name}
          data-paper-tile="procedural"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      <span
        class="paper-picker-cell-name"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 600,
          textAlign: 'center',
          padding: '2px',
          pointerEvents: 'none',
          // The name stays visible on the placeholder; over a decoded tile it
          // sits as a quiet caption strip so the raw tile still reads.
          background: showPlaceholder ? 'transparent' : 'linear-gradient(transparent 55%, rgba(0,0,0,0.45))',
          color: showPlaceholder ? 'var(--color-text-secondary)' : '#fff',
        }}
      >
        {props.entry.name}
      </span>
    </button>
  );
}

export function PaperPicker(props: PaperPickerProps): JSX.Element {
  const open = signal(false);
  const procedural = PAPER_LIBRARY.filter((entry) => entry.group === 'procedural');
  const real = PAPER_LIBRARY.filter((entry) => entry.group === 'real');

  const trigger = (
    <button
      type="button"
      class="paper-picker-trigger"
      data-paper-picker-trigger
      disabled={props.disabled}
      aria-expanded={open.value}
      onClick={() => { open.value = !open.value; }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
        width: '100%',
        padding: '6px 8px',
        borderRadius: '5px',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-settings)',
        cursor: props.disabled ? 'default' : 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Paper</span>
      <span
        data-paper-picker-current
        style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}
      >
        {paperName(props.paperId)}
      </span>
    </button>
  );

  return (
    <div class="paper-picker" data-paper-picker style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {trigger}
      {open.value ? (
        <div
          class="paper-picker-popover"
          data-paper-picker-popover
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            width: 'min(280px, calc(100vw - 32px))',
            maxHeight: '320px',
            overflowY: 'auto',
            background: 'var(--color-bg-toolbar)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            padding: '12px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            class="paper-picker-group-header"
            data-paper-group-header="procedural"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: 'var(--color-bg-toolbar)',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.2,
              color: 'var(--color-text-primary)',
              padding: '4px 0',
            }}
          >
            Procedural
          </div>
          <div
            class="paper-picker-grid"
            data-paper-group-grid="procedural"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
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
          <div
            class="paper-picker-group-header"
            data-paper-group-header="real"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: 'var(--color-bg-toolbar)',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.2,
              color: 'var(--color-text-primary)',
              padding: '4px 0',
            }}
          >
            Real
          </div>
          <div
            class="paper-picker-grid"
            data-paper-group-grid="real"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
              gap: `${GRID_GAP}px`,
            }}
          >
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
        </div>
      ) : null}
      {/* D-10: Strength + Scale sit directly under the trigger, always
          reachable — never inside the popover. */}
      <div class="paper-picker-sliders" data-paper-picker-sliders style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <SliderStepper
          id="paper-strength"
          label="Strength"
          value={props.strength}
          onChange={props.onStrengthChange}
          step={0.05}
          min={0}
          max={1}
          ariaLabel="Strength"
          disabled={props.disabled}
        />
        <SliderStepper
          id="paper-scale"
          label="Scale"
          value={props.scale}
          onChange={props.onScaleChange}
          step={0.1}
          min={0.1}
          max={10}
          ariaLabel="Scale"
          disabled={props.disabled}
        />
      </div>
    </div>
  );
}

/** Test seam: the picker's section label (shared-panel mount copy). */
export function PaperSectionLabel(): JSX.Element {
  return <SectionLabel text="Paper" />;
}
