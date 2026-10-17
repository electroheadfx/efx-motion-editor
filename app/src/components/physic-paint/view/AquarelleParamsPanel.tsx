// ============================================================
//  AquarelleParamsPanel — the aquarelle module-only param
//  surface (AQUA-04 / D-04/05/06/08, 261017-wmw I-01).
//
//  7 globals (size maps to the shared Size slider — D-05, no
//  local size control) + a Reset control restoring the
//  playground DEFAULT_PARAMS on the 0-100 slider band.
//
//  Labels and row order follow the playground SettingsPanel
//  (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed).
//  Param keys stay water/load/flow/bleed/edge/granulation/dry.
//
//  Slider commits go through the one record-path seam
//  (aquarelleRecordState) — never a second params channel.
//
//  The Brush response block (8 ×multipliers) moved to
//  BrushResponsePanel (I-02) — this panel never renders it.
// ============================================================

import { DEFAULT_PARAMS } from '@efxlab/efx-watercolor';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  aquarelleParams,
  setAquarelleParam,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';

/** Module-only global rows (D-05 / I-01 playground order). `size` is NOT here — shared Size owns it. */
const GLOBAL_ROWS: ReadonlyArray<{ key: AquarelleGlobalKey; label: string }> = Object.freeze([
  { key: 'water', label: 'Water' },
  { key: 'load', label: 'Pigment' },
  { key: 'flow', label: 'Flow' },
  { key: 'bleed', label: 'Bleed' },
  { key: 'edge', label: 'Edges' },
  { key: 'granulation', label: 'Grain' },
  { key: 'dry', label: 'Dry speed' },
]);

const GLOBAL_MIN = 0;
const GLOBAL_MAX = 100;

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

export function AquarelleParamsPanel() {
  // Narrow signal reads (efx-preact-reactivity rule 5) — each .value
  // read subscribes this panel to that bag only.
  const params = aquarelleParams.value;

  const onGlobalChange = (key: AquarelleGlobalKey) => (value: number) => {
    setAquarelleParam(key, value);
  };

  // I-01 Reset: playground DEFAULT_PARAMS (0..1) mapped onto the app 0-100
  // slider band (×100), written once per non-size key through the one seam.
  // Never writes size (top-bar Brush size owns it, Q1a / T-261017-WMW-01).
  const onReset = () => {
    for (const row of GLOBAL_ROWS) {
      setAquarelleParam(row.key, Math.round(DEFAULT_PARAMS[row.key] * 100));
    }
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
        data-testid="aquarelle-params-reset"
        onClick={onReset}
        class="physics-paint-text-button"
        style={{
          display: 'block',
          width: '100%',
          marginTop: '8px',
        }}
      >
        Reset
      </button>
    </div>
  );
}
