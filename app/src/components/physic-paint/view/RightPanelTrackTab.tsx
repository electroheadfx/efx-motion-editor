// ============================================================
//  RightPanelTrackTab — Track opacity + blend (TML-04).
//  Opacity commits on release (48-06) — the slider display
//  clamps to the declared 0..1 range (47-03).
// ============================================================

import type { BlendMode } from '../../../efx-paint/document/efxPaintDocument';
import { SliderStepper } from '../../shared/SliderStepper';

const TRACK_BLEND_MODES: readonly BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

export function RightPanelTrackTab(props: {
  trackName: string;
  trackOpacity: number;
  trackBlendMode: BlendMode;
  onTrackOpacityChange: (opacity: number) => void;
  onTrackBlendChange: (mode: BlendMode) => void;
}) {
  const clampedValue = Math.max(0, Math.min(1, props.trackOpacity));
  return (
    <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-track" role="tabpanel" aria-label="Track options">
      <div class="physics-paint-option-group">
        <span class="physics-paint-right-label">Track: {props.trackName}</span>
        <div class="physics-paint-option-row">
          <SliderStepper
            id="physics-track-opacity"
            label="Opacity"
            value={clampedValue}
            onChange={props.onTrackOpacityChange}
            step={0.01}
            min={0}
            max={1}
            ariaLabel="Opacity"
            commitOnRelease
          />
        </div>
        <label class="physics-paint-option-row" for="physics-track-blend">
          <span class="physics-paint-right-label">Blend</span>
          <select
            id="physics-track-blend"
            class="physics-paint-roto-interpolation-select"
            value={props.trackBlendMode}
            onChange={(event) => props.onTrackBlendChange((event.currentTarget as HTMLSelectElement).value as BlendMode)}
          >
            {TRACK_BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
