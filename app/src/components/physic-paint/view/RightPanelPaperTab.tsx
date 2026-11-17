// ============================================================
//  RightPanelPaperTab — the Paper & Light tab content (UI
//  checklist rows 6/7/10). The display-paper picker (paperPass
//  fond, D-09/D-10/D-12 + PAPER-01/04) — NOT Dry / cuisson.
//  261017-vcn I-04 remainder: paper + background + grain pair.
//  Phase 64-09 (MED-17 / D-06): the three light rows sit BELOW
//  the paper-grain pair, in the tab that becomes `Paper & Light`.
//  The values ARE the paint-layer document's light — resolved by
//  the Studio and written through its one handler — never local
//  state, never a second signal, never a retyped default (D-09:
//  `DEFAULT_LIGHT` comes from the package).
// ============================================================

import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import type { LightSettings } from '@efxlab/efx-watercolor';
import { SliderStepper } from '../../shared/SliderStepper';
import { PaperPicker } from './PaperPicker';
import type { StudioBackgroundMode } from '../engine/physicsPaintStudioSettings';

export function RightPanelPaperTab(props: {
  paperId?: string;
  background?: StudioBackgroundMode;
  grainStrength?: number;
  grainScale?: number;
  onPaperIdChange?: (id: string) => void;
  onBackgroundChange?: (mode: StudioBackgroundMode) => void;
  onGrainStrengthChange?: (value: number) => void;
  onGrainScaleChange?: (scale: number) => void;
  /** 64-09 (D-06): the paint-layer document's emboss light (absent → the
   *  package default, exactly today's light). */
  light?: LightSettings;
  /** 64-09: one-field patch upward; the Studio handler owns the one write. */
  onLightChange?: (patch: Partial<LightSettings>) => void;
  disabled?: boolean;
}) {
  // The document IS the state: the row is controlled, never mirrored. The
  // fallback is the package's DEFAULT_LIGHT — the triple is never retyped here
  // (64-05's single source). D-09: zero thickness still lights to exactly 1.0,
  // so an absent light and the explicit default render identically.
  const light = props.light ?? DEFAULT_LIGHT;
  return (
    <div data-testid="right-panel-paper-tab">
      <PaperPicker
        paperId={props.paperId ?? 'paper/cold-press'}
        background={props.background ?? 'paper/cold-press'}
        grainStrength={props.grainStrength ?? 0.35}
        grainScale={props.grainScale ?? 1}
        onPaperIdChange={(id) => props.onPaperIdChange?.(id)}
        onBackgroundChange={(mode) => props.onBackgroundChange?.(mode)}
        onGrainStrengthChange={(value) => props.onGrainStrengthChange?.(value)}
        onGrainScaleChange={(scale) => props.onGrainScaleChange?.(scale)}
        disabled={props.disabled}
      />
      {/* 64-09 (D-06): the three light rows BELOW the grain pair — one option
          group, no second panel, no floating sheet. Each row is controlled by
          the document light and emits a ONE-FIELD patch upward. */}
      <div class="physics-paint-option-group" data-testid="right-panel-light-group">
        <span class="physics-paint-right-label">Light</span>
        <div class="physics-paint-option-row">
          <SliderStepper
            label="Azimuth"
            value={light.azimuth}
            onChange={(value) => props.onLightChange?.({ azimuth: value })}
            step={1}
            min={0}
            max={360}
            precision={1}
            ariaLabel="Azimuth"
            disabled={props.disabled}
          />
        </div>
        <div class="physics-paint-option-row">
          <SliderStepper
            label="Elevation"
            value={light.elevation}
            onChange={(value) => props.onLightChange?.({ elevation: value })}
            step={1}
            min={0}
            max={90}
            precision={2}
            ariaLabel="Elevation"
            disabled={props.disabled}
          />
        </div>
        <div class="physics-paint-option-row">
          <SliderStepper
            label="Intensity"
            value={light.intensity}
            onChange={(value) => props.onLightChange?.({ intensity: value })}
            step={0.1}
            min={0}
            max={4}
            precision={2}
            ariaLabel="Intensity"
            disabled={props.disabled}
          />
        </div>
      </div>
    </div>
  );
}
