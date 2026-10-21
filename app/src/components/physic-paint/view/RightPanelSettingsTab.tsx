// ============================================================
//  RightPanelSettingsTab — the Settings tab content (I-11 / D).
//  Water color only: the eight per-brush multipliers for the
//  selected brush. The Brush tab is the brush catalog; the Paint
//  tool tab owns the globals. Per-brush values persist across
//  brush switches via aquarelleBrushResponseMemory
//  (aquarelleRecordState).
// ============================================================

import { activeModule } from '../../shared/activeModule';
import { BrushResponsePanel } from './BrushResponsePanel';

export function RightPanelSettingsTab() {
  if (activeModule.value === 'watercolor') {
    return (
      <div data-testid="right-panel-settings-tab" data-module="watercolor">
        <BrushResponsePanel />
      </div>
    );
  }
  return null;
}
