// ============================================================
//  RightPanelPaperTab — the Paper tab content (UI checklist
//  rows 6/7/10). The display-paper picker (paperPass fond,
//  D-09/D-10/D-12 + PAPER-01/04) — NOT Dry / cuisson.
//  261017-vcn I-04 remainder: paper + background + grain pair.
// ============================================================

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
  disabled?: boolean;
}) {
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
    </div>
  );
}
