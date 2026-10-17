// ============================================================
//  RightPanelPaperTab — the Paper tab content (UI checklist
//  rows 6/7/10). The display-paper picker (paperPass fond,
//  D-09/D-10/D-12 + PAPER-01/04) — NOT Dry / cuisson.
// ============================================================

import { PaperPicker } from './PaperPicker';

export function RightPanelPaperTab(props: {
  paperId?: string;
  paperStrength?: number;
  paperScale?: number;
  onPaperIdChange?: (id: string) => void;
  onPaperStrengthChange?: (value: number) => void;
  onPaperScaleChange?: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div data-testid="right-panel-paper-tab">
      <PaperPicker
        paperId={props.paperId ?? 'paper/cold-press'}
        strength={props.paperStrength ?? 0.65}
        scale={props.paperScale ?? 1}
        onPaperIdChange={(id) => props.onPaperIdChange?.(id)}
        onStrengthChange={(value) => props.onPaperStrengthChange?.(value)}
        onScaleChange={(value) => props.onPaperScaleChange?.(value)}
        disabled={props.disabled}
      />
    </div>
  );
}
