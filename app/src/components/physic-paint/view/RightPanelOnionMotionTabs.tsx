// ============================================================
//  RightPanelOnionTab / RightPanelMotionTab — onion skin and
//  play-wiggle controls (260905-epb scroll hierarchy).
// ============================================================

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
      <label class="physics-paint-option-row physics-paint-onion-value-row" for="physics-onion-count">
        <span class="physics-paint-right-label">Onion frames</span>
        <input id="physics-onion-count" type="range" min={1} max={3} value={onionCount} disabled={props.onionDisabled} onInput={(event) => update({ count: Number((event.currentTarget as HTMLInputElement).value) })} />
        <output>{onionCount}</output>
      </label>
      <label class="physics-paint-option-row physics-paint-onion-value-row" for="physics-onion-opacity">
        <span class="physics-paint-right-label">Onion value</span>
        <input id="physics-onion-opacity" type="range" min={0} max={100} step={1} value={onionOpacity} disabled={props.onionDisabled} onInput={(event) => update({ opacity: Number((event.currentTarget as HTMLInputElement).value) })} />
        <output>{onionOpacity}%</output>
      </label>
    </div>
  );
}

export function RightPanelMotionTab(props: {
  playWiggle: { strokeDeformation: number; strokePosition: number };
  onPlayWiggleChange: (wiggle: { strokeDeformation: number; strokePosition: number }) => void;
}) {
  const clamp = (value: unknown): number => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.trunc(numeric)));
  };
  return (
    <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-motion" role="tabpanel" aria-label="Motion controls">
      <div class="physics-paint-option-row">
        <label class="physics-paint-right-label" for="physics-play-deform">Deform</label>
        <input id="physics-play-deform" type="range" min={0} max={100} value={props.playWiggle.strokeDeformation} onChange={(event) => props.onPlayWiggleChange({ ...props.playWiggle, strokeDeformation: clamp((event.currentTarget as HTMLInputElement).value) })} />
      </div>
      <div class="physics-paint-option-row">
        <label class="physics-paint-right-label" for="physics-play-move">Move</label>
        <input id="physics-play-move" type="range" min={0} max={100} value={props.playWiggle.strokePosition} onChange={(event) => props.onPlayWiggleChange({ ...props.playWiggle, strokePosition: clamp((event.currentTarget as HTMLInputElement).value) })} />
      </div>
    </div>
  );
}
