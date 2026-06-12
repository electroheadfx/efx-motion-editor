import type { ToolType } from '@efxlab/efx-physic-paint';

export type PhysicsPaintRailAction =
  | 'paint'
  | 'paint-physics'
  | 'erase'
  | 'undo'
  | 'clear-frame'
  | 'physics-last'
  | 'physics-all'
  | 'dry';

export interface PhysicsPaintToolRailItem {
  id: PhysicsPaintRailAction;
  label: string;
  icon: string;
  kind: 'tool' | 'action' | 'press-action';
}

export const PHYSICS_PAINT_TOOL_RAIL_ITEMS: PhysicsPaintToolRailItem[] = [
  { id: 'paint', label: 'Paint', icon: '/SPECS/physics-paint-ui/icons/paint-mode-normal.svg', kind: 'tool' },
  { id: 'paint-physics', label: 'Paint with physics', icon: '/SPECS/physics-paint-ui/icons/paint-mode-physics.svg', kind: 'tool' },
  { id: 'erase', label: 'Erase', icon: '/SPECS/physics-paint-ui/icons/LineiconsEraser.svg', kind: 'tool' },
  { id: 'undo', label: 'Undo', icon: '/SPECS/physics-paint-ui/icons/MaterialSymbolsUndo.svg', kind: 'action' },
  { id: 'clear-frame', label: 'Clear frame', icon: '/SPECS/physics-paint-ui/icons/clear-canvas-pencil.svg', kind: 'action' },
  { id: 'physics-last', label: 'Apply physics to last stroke', icon: '/SPECS/physics-paint-ui/icons/physics-last-stroke.svg', kind: 'press-action' },
  { id: 'physics-all', label: 'Apply physics to all strokes', icon: '/SPECS/physics-paint-ui/icons/physics-all-active-paint.svg', kind: 'press-action' },
  { id: 'dry', label: 'Dry / freeze paint', icon: '/SPECS/physics-paint-ui/icons/physics-dry-paint.svg', kind: 'action' },
];

export interface PhysicsPaintToolRailProps {
  activeTool: ToolType;
  physicsMode: 'local' | null;
  activePhysicsAction?: 'last' | 'all' | null;
  canUndo?: boolean;
  disabled?: boolean;
  onSelectTool: (tool: ToolType, physicsMode: 'local' | null) => void;
  onUndo: () => void;
  onClearFrame: () => void;
  onPhysicsStart: (mode: 'last' | 'all') => void;
  onPhysicsStop: () => void;
  onDryPaint: () => void;
}

function isItemActive(
  item: PhysicsPaintToolRailItem,
  activeTool: ToolType,
  physicsMode: 'local' | null,
  activePhysicsAction?: 'last' | 'all' | null,
) {
  if (item.id === 'paint') return activeTool === 'paint' && physicsMode === null;
  if (item.id === 'paint-physics') return activeTool === 'paint' && physicsMode === 'local';
  if (item.id === 'erase') return activeTool === 'erase';
  if (item.id === 'physics-last') return activePhysicsAction === 'last';
  if (item.id === 'physics-all') return activePhysicsAction === 'all';
  return false;
}

export function PhysicsPaintToolRail({
  activeTool,
  physicsMode,
  activePhysicsAction = null,
  canUndo = true,
  disabled = false,
  onSelectTool,
  onUndo,
  onClearFrame,
  onPhysicsStart,
  onPhysicsStop,
  onDryPaint,
}: PhysicsPaintToolRailProps) {
  const runAction = (item: PhysicsPaintToolRailItem) => {
    if (disabled) return;
    if (item.id === 'paint') onSelectTool('paint', null);
    if (item.id === 'paint-physics') onSelectTool('paint', 'local');
    if (item.id === 'erase') onSelectTool('erase', physicsMode);
    if (item.id === 'undo') onUndo();
    if (item.id === 'clear-frame') onClearFrame();
    if (item.id === 'dry') onDryPaint();
  };

  const isDisabled = (item: PhysicsPaintToolRailItem) => disabled || (item.id === 'undo' && !canUndo);

  return (
    <nav class="physics-paint-tool-rail" aria-label="Physics Paint tools">
      {PHYSICS_PAINT_TOOL_RAIL_ITEMS.map((item) => {
        const active = isItemActive(item, activeTool, physicsMode, activePhysicsAction);
        const buttonDisabled = isDisabled(item);
        const className = `physics-paint-icon-button${active ? ' active' : ''}`;

        if (item.id === 'physics-last' || item.id === 'physics-all') {
          const mode = item.id === 'physics-last' ? 'last' : 'all';
          return (
            <button
              key={item.id}
              type="button"
              class={className}
              disabled={buttonDisabled}
              title={item.label}
              aria-label={item.label}
              aria-pressed={active}
              onMouseDown={() => !buttonDisabled && onPhysicsStart(mode)}
              onMouseUp={onPhysicsStop}
              onMouseLeave={onPhysicsStop}
              onTouchStart={() => !buttonDisabled && onPhysicsStart(mode)}
              onTouchEnd={onPhysicsStop}
            >
              <img src={item.icon} alt="" aria-hidden="true" />
            </button>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            class={className}
            disabled={buttonDisabled}
            title={item.label}
            aria-label={item.label}
            aria-pressed={item.kind === 'tool' ? active : undefined}
            onClick={() => runAction(item)}
          >
            <img src={item.icon} alt="" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
