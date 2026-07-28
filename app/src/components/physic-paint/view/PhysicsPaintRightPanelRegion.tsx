import type { ComponentProps } from 'preact';
import { memo } from 'preact/compat';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { MemoizedPhysicsPaintRightPanel } from './MemoizedPhysicsPaintRightPanel';

export interface PhysicsPaintRightPanelRegionProps {
  collapsed: boolean;
  onSetCollapsed: (collapsed: boolean) => void;
  rightPanel: ComponentProps<typeof MemoizedPhysicsPaintRightPanel>;
}

function PhysicsPaintRightPanelRegionImpl({
  collapsed,
  onSetCollapsed,
  rightPanel,
}: PhysicsPaintRightPanelRegionProps) {
  recordPhysicsPaintPerformanceCounter('render.rightPanelRegion');
  return collapsed ? (
    <aside class="physics-paint-right-panel-rail" aria-label="Physics Paint right panel collapsed">
      <button type="button" class="physics-paint-panel-toggle" aria-label="Open brush options panel" title="Open brush options panel" onClick={() => onSetCollapsed(false)}>▸</button>
    </aside>
  ) : (
    <div class="physics-paint-right-panel-shell">
      <button type="button" class="physics-paint-panel-toggle" aria-label="Close brush options panel" title="Close brush options panel" onClick={() => onSetCollapsed(true)}>▸</button>
      <MemoizedPhysicsPaintRightPanel {...rightPanel} />
    </div>
  );
}

export const PhysicsPaintRightPanelRegion = memo(PhysicsPaintRightPanelRegionImpl);
