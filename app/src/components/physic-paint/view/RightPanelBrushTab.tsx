// ============================================================
//  RightPanelBrushTab — the Brush tab content (UI checklist
//  row 6). Water color: BrushesDocker + AQUA-04 globals +
//  Brush response (D-04/D-08). Brush module: physics params.
// ============================================================

import type { ToolType } from '@efxlab/efx-physic-paint';
import { activeModule } from '../../shared/activeModule';
import { AquarelleParamsPanel } from './AquarelleParamsPanel';
import { BrushesDocker } from './BrushesDocker';
import { BrushModuleSection } from './BrushModuleSection';

export function RightPanelBrushTab(props: {
  activeTool: ToolType;
  edgeDetail: number;
  pickup: number;
  spread: number;
  smoothing: number;
  eraseStrength: number;
  physicsMode: 'local' | null;
  engineControlsDisabled?: boolean;
  onEdgeDetailChange: (value: number) => void;
  onPickupChange: (value: number) => void;
  onSpreadChange: (value: number) => void;
  onSmoothingChange: (value: number) => void;
  onEraseStrengthChange: (value: number) => void;
}) {
  if (activeModule.value === 'watercolor') {
    return (
      <div data-testid="right-panel-brush-tab" data-module="watercolor">
        <BrushesDocker />
        <AquarelleParamsPanel />
      </div>
    );
  }
  return (
    <div data-testid="right-panel-brush-tab" data-module="brush">
      <BrushModuleSection
        activeTool={props.activeTool}
        edgeDetail={props.edgeDetail}
        pickup={props.pickup}
        spread={props.spread}
        smoothing={props.smoothing}
        eraseStrength={props.eraseStrength}
        physicsMode={props.physicsMode}
        engineControlsDisabled={props.engineControlsDisabled}
        onEdgeDetailChange={props.onEdgeDetailChange}
        onPickupChange={props.onPickupChange}
        onSpreadChange={props.onSpreadChange}
        onSmoothingChange={props.onSmoothingChange}
        onEraseStrengthChange={props.onEraseStrengthChange}
      />
    </div>
  );
}
