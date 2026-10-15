// ============================================================
//  AquarelleParamsPanel — the aquarelle module-only param
//  surface (AQUA-04 / D-04/05/06/08).
//
//  8 globals (size maps to the shared Size slider — D-05, no
//  local size control) + a collapsible "Brush response" with
//  8 ×multipliers (0.5–2.0, default 1.0) showing the computed
//  effective value (global × multiplier).
//
//  Slider commits go through the one record-path seam
//  (aquarelleRecordState) — never a second params channel.
// ============================================================

import { signal } from '@preact/signals';
import { SliderStepper } from '../../shared/SliderStepper';
import { RuleSectionHeader } from '../../shared/RuleSectionHeader';
import {
  MULTIPLIER_BASE_KEYS,
  MULTIPLIER_LABELS,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  aquarelleParams,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  effectiveMultiplierValue,
  setAquarelleMultiplier,
  setAquarelleParam,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';
import type { AquarelleToolOverrides } from '@efxlab/efx-watercolor/brushes';

/** Module-only global rows (D-05). `size` is NOT here — shared Size owns it. */
const GLOBAL_ROWS: ReadonlyArray<{ key: AquarelleGlobalKey; label: string }> = Object.freeze([
  { key: 'water', label: 'Water' },
  { key: 'load', label: 'Load' },
  { key: 'flow', label: 'Flow' },
  { key: 'bleed', label: 'Bleed' },
  { key: 'dry', label: 'Dry rate' },
  { key: 'edge', label: 'Edge' },
  { key: 'granulation', label: 'Granulation' },
]);

const MULTIPLIER_FIELDS: ReadonlyArray<keyof AquarelleToolOverrides> = Object.freeze([
  'tip',
  'aspect',
  'rotation',
  'sizeCurve',
  'scatter',
  'capacity',
  'grain',
  'wetRound',
]);

const GLOBAL_MIN = 0;
const GLOBAL_MAX = 100;

/** Collapsed-by-default Brush response (D-04). */
const brushResponseOpen = signal(false);

function GlobalSlider(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div class="physics-paint-option-row">
      <SliderStepper
        label={props.label}
        value={Math.max(GLOBAL_MIN, Math.min(GLOBAL_MAX, props.value))}
        onChange={props.onChange}
        step={1}
        min={GLOBAL_MIN}
        max={GLOBAL_MAX}
        ariaLabel={props.label}
      />
    </div>
  );
}

function MultiplierSlider(props: {
  field: keyof AquarelleToolOverrides;
  label: string;
  multiplier: number;
  effective: number;
  onChange: (value: number) => void;
}) {
  return (
    <div class="physics-paint-option-row">
      <SliderStepper
        label={props.label}
        value={props.multiplier}
        onChange={props.onChange}
        step={0.1}
        min={MULTIPLIER_MIN}
        max={MULTIPLIER_MAX}
        precision={1}
        ariaLabel={props.label}
        below={
          <span
            data-testid={`effective-${props.field}`}
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--sidebar-text-secondary, #9aa5b1)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {`→ ${props.effective}`}
          </span>
        }
      />
    </div>
  );
}

export function AquarelleParamsPanel() {
  // Narrow signal reads (efx-preact-reactivity rule 5) — each .value
  // read subscribes this panel to that bag only.
  const params = aquarelleParams.value;
  const overrides = aquarelleToolOverrides.value;
  const selectedTipId = aquarelleSelectedTipId.value;
  const open = brushResponseOpen.value;

  const onGlobalChange = (key: AquarelleGlobalKey) => (value: number) => {
    setAquarelleParam(key, value);
  };
  const onMultiplierChange = (field: keyof AquarelleToolOverrides) => (value: number) => {
    setAquarelleMultiplier(field, value);
  };

  return (
    <div data-testid="aquarelle-params-panel">
      {GLOBAL_ROWS.map((row) => (
        <GlobalSlider
          key={String(row.key)}
          label={row.label}
          value={params[row.key]}
          onChange={onGlobalChange(row.key)}
        />
      ))}

      <button
        type="button"
        data-testid="brush-response-toggle"
        aria-expanded={open}
        onClick={() => {
          brushResponseOpen.value = !brushResponseOpen.value;
        }}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          marginTop: '8px',
        }}
      >
        <RuleSectionHeader text="Brush response" />
      </button>

      {selectedTipId === null ? (
        <span
          data-testid="brush-response-placeholder"
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--sidebar-text-secondary, #9aa5b1)',
          }}
        >
          Select a brush to edit response
        </span>
      ) : open ? (
        MULTIPLIER_FIELDS.map((field) => {
          const baseKey = MULTIPLIER_BASE_KEYS[field];
          const base = baseKey === null ? 1 : (params[baseKey] as number);
          return (
            <MultiplierSlider
              key={field}
              field={field}
              label={MULTIPLIER_LABELS[field]}
              multiplier={overrides[field]}
              effective={effectiveMultiplierValue(base, overrides[field])}
              onChange={onMultiplierChange(field)}
            />
          );
        })
      ) : null}
    </div>
  );
}
