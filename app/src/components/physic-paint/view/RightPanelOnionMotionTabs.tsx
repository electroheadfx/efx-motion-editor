// ============================================================
//  RightPanelOnionTab / RightPanelMotionTab — onion skin and
//  play-wiggle controls (260905-epb scroll hierarchy).
//
//  261018-0ox I-10: Motion retargeted to SliderStepper so its
//  markup matches the live PanelSlider rows (physics-play-deform
//  / physics-play-move, Deform / Move, 0..100) before adoption.
// ============================================================

import { SliderStepper } from '../../shared/SliderStepper';
import { clampOnionCount, clampOnionOpacity, type PhysicsPaintOnionState } from './physicsPaintWorkflowPresentation';

export function RightPanelOnionTab(props: {
  onion: PhysicsPaintOnionState;
  onionDisabled?: boolean;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
}) {
  const onionCount = clampOnionCount(props.onion.count);
  const onionOpacity = clampOnionOpacity(props.onion.opacity);
  const update = (next: Partial<PhysicsPaintOnionState>) => {
    props.onOnionChange({
      ...props.onion,
      ...next,
      count: clampOnionCount(next.count ?? props.onion.count),
      opacity: clampOnionOpacity(next.opacity ?? props.onion.opacity),
    });
  };
  return (
    <div class={`physics-paint-options-tab-panel physics-paint-options-tab-panel-onion physics-paint-onion-tab-panel${props.onionDisabled ? ' disabled-control' : ''}`} role="tabpanel" aria-label="Onion skin controls">
      <label class="physics-paint-onion-toggle-row">
        <input type="checkbox" checked={props.onion.enabled} disabled={props.onionDisabled} onChange={(event) => update({ enabled: (event.currentTarget as HTMLInputElement).checked })} />
        <span>Onion skin</span>
      </label>
      <div class="physics-paint-onion-toggle-grid">
        <label><input type="checkbox" checked={props.onion.previous} disabled={props.onionDisabled} onChange={(event) => update({ previous: (event.currentTarget as HTMLInputElement).checked })} /> Previous</label>
        <label><input type="checkbox" checked={props.onion.next} disabled={props.onionDisabled} onChange={(event) => update({ next: (event.currentTarget as HTMLInputElement).checked })} /> Next</label>
      </div>
      {/* The shared SliderStepper stacks label+value over a full-width bar —
          native ranges in the old 2-column grid overflowed the sidebar. */}
      <div class="physics-paint-option-row">
        <SliderStepper
          id="physics-onion-count"
          label="Onion frames"
          value={onionCount}
          onChange={(value) => update({ count: value })}
          step={1}
          min={1}
          max={3}
          disabled={props.onionDisabled}
          ariaLabel="Onion frames"
        />
      </div>
      <div class="physics-paint-option-row">
        <SliderStepper
          id="physics-onion-opacity"
          label="Onion value"
          value={onionOpacity}
          onChange={(value) => update({ opacity: value })}
          step={1}
          min={0}
          max={100}
          disabled={props.onionDisabled}
          ariaLabel="Onion value"
        />
      </div>
    </div>
  );
}

function clampWiggleValue(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(numeric)));
}

export function RightPanelMotionTab(props: {
  playWiggle: { strokeDeformation: number; strokePosition: number; strokeRotation: number; strokeScale: number };
  onPlayWiggleChange: (wiggle: { strokeDeformation: number; strokePosition: number; strokeRotation: number; strokeScale: number }) => void;
}) {
  // SliderStepper rows mirror PanelSlider's rendered markup
  // (physics-paint-option-row > SliderStepper, clamp 0..100).
  return (
    <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-motion" role="tabpanel" aria-label="Motion controls">
      <div class="physics-paint-option-row">
        <SliderStepper
          id="physics-play-deform"
          label="Deform"
          value={clampWiggleValue(props.playWiggle.strokeDeformation)}
          onChange={(value) => props.onPlayWiggleChange({ ...props.playWiggle, strokeDeformation: clampWiggleValue(value) })}
          step={1}
          min={0}
          max={100}
          ariaLabel="Deform"
        />
      </div>
      <div class="physics-paint-option-row">
        <SliderStepper
          id="physics-play-move"
          label="Move"
          value={clampWiggleValue(props.playWiggle.strokePosition)}
          onChange={(value) => props.onPlayWiggleChange({ ...props.playWiggle, strokePosition: clampWiggleValue(value) })}
          step={1}
          min={0}
          max={100}
          ariaLabel="Move"
        />
      </div>
      <div class="physics-paint-option-row">
        <SliderStepper
          id="physics-play-rotate"
          label="Rotate"
          value={clampWiggleValue(props.playWiggle.strokeRotation)}
          onChange={(value) => props.onPlayWiggleChange({ ...props.playWiggle, strokeRotation: clampWiggleValue(value) })}
          step={1}
          min={0}
          max={100}
          ariaLabel="Rotate"
        />
      </div>
      <div class="physics-paint-option-row">
        <SliderStepper
          id="physics-play-scale"
          label="Scale"
          value={clampWiggleValue(props.playWiggle.strokeScale)}
          onChange={(value) => props.onPlayWiggleChange({ ...props.playWiggle, strokeScale: clampWiggleValue(value) })}
          step={1}
          min={0}
          max={100}
          ariaLabel="Scale"
        />
      </div>
    </div>
  );
}
