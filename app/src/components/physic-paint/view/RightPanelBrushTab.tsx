// ============================================================
//  RightPanelBrushTab — the restored Brush tab (UI checklist
//  row 6). Water color only.
//
//  261028-k03d: the tab is the brush CATALOG plus the brush
//  response the top bar exposes.
//
//  261029-hy2: the Settings tab is retired. The tab's FIRST child
//  is now the Settings button that opens the floating Settings
//  sheet (the eight response multipliers); a 15px gap separates
//  it from the catalog. The cloned Brush size slider and the
//  globals panel are removed — neither control has a second home
//  here (globals stay in the Paint tool tab).
//
//  261018-0ox I-10: adopted into PhysicsPaintRightPanel.
//  The activeModule branch stays inside this tab component.
// ============================================================

import { SlidersHorizontal } from 'lucide-preact';
import { activeModule } from '../../shared/activeModule';
import { setAquarelleSettingsModalOpen } from './aquarelleRecordState';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';

export function RightPanelBrushTab() {
  if (activeModule.value === 'watercolor') {
    return (
      <div data-testid="right-panel-brush-tab" data-module="watercolor">
        <div class="physics-paint-brush-tab-body">
          <button
            type="button"
            class="physics-paint-text-button physics-paint-brush-tab-settings"
            data-testid="brush-tab-open-settings"
            onClick={() => setAquarelleSettingsModalOpen(true)}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            Settings
          </button>
          <WatercolorBrushLibrary />
        </div>
      </div>
    );
  }
  return null;
}
