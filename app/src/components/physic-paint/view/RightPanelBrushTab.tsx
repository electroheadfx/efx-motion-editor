// ============================================================
//  RightPanelBrushTab — the Brush tab content (UI checklist
//  row 6). Water color only: WatercolorBrushLibrary + Brush
//  response (261017-xa0 I-03). 261018-cy1: the brush-module
//  duplicate arm is gone — the Paint tool tab owns the physics
//  param bag, and a stale 'brush' topPaneTab falls back to
//  Color at the panel when the module leaves watercolor.
//
//  261018-0ox I-10: adopted into PhysicsPaintRightPanel.
//  The activeModule branch stays inside this tab component.
// ============================================================

import { activeModule } from '../../shared/activeModule';
import { BrushResponsePanel } from './BrushResponsePanel';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';

export function RightPanelBrushTab() {
  if (activeModule.value === 'watercolor') {
    return (
      <div data-testid="right-panel-brush-tab" data-module="watercolor">
        <BrushResponsePanel />
        <WatercolorBrushLibrary />
      </div>
    );
  }
  return null;
}
