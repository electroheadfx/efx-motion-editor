// ============================================================
//  BrushResponsePanel — the "Brush response" block
//  (AQUA-04 / D-08, 261017-wmw I-02, 261018-l05). Brush-tab content.
//
//  8 ×multipliers (0.5–2.0, default 1.0) showing the computed
//  effective value (global × multiplier) per row, plus the
//  Select-a-brush placeholder when no tip is selected.
//
//  The block is NOT collapsible: 261018-l05 revokes the D-04
//  collapse (user decision). No toggle chrome, no chevron, no
//  replacement label — sliders render whenever a tip is selected.
//
//  Multiplier commits go through setAquarelleMultiplier — the
//  same record-path seam as before. The multiplier band and the
//  effective-value formula are unchanged (D-08).
// ============================================================

import { SliderStepper } from '../../shared/SliderStepper';
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
} from './aquarelleRecordState';
import type { AquarelleToolOverrides } from '@efxlab/efx-watercolor/brushes';

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

export function BrushResponsePanel() {
  // Narrow signal reads (efx-preact-reactivity rule 5).
  const params = aquarelleParams.value;
  const overrides = aquarelleToolOverrides.value;
  const selectedTipId = aquarelleSelectedTipId.value;

  const onMultiplierChange = (field: keyof AquarelleToolOverrides) => (value: number) => {
    setAquarelleMultiplier(field, value);
  };

  return (
    <div class="physics-paint-option-group" data-testid="brush-response-panel">
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
      ) : (
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
      )}
    </div>
  );
}
