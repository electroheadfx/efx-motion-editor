import { memo } from 'preact/compat';
import type { PaintHistoryAvailability, ToolType } from '@efxlab/efx-physic-paint';
import type { ReadonlySignal } from '@preact/signals';
import paintModeNormalIcon from '../../../assets/physics-paint-ui/icons/paint-mode-normal.svg';
import paintModePhysicsIcon from '../../../assets/physics-paint-ui/icons/paint-mode-physics.svg';
import eraserIcon from '../../../assets/physics-paint-ui/icons/LineiconsEraser.svg';
import moveToolIcon from '../../../assets/physics-paint-ui/icons/move-tool.svg';
import undoIcon from '../../../assets/physics-paint-ui/icons/MaterialSymbolsUndo.svg';
import clearCanvasIcon from '../../../assets/physics-paint-ui/icons/clear-canvas-pencil.svg';
import { ForegroundBackgroundSwatch } from '../../sidebar/ForegroundBackgroundSwatch';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { readEffectiveTool } from './physicsPaintTemporaryErase';

export type PhysicsPaintRailAction =
  | 'paint'
  | 'paint-physics'
  | 'erase'
  | 'move'
  | 'undo'
  | 'redo'
  | 'clear-frame';

export interface PhysicsPaintToolRailItem {
  id: PhysicsPaintRailAction;
  label: string;
  icon: string;
  kind: 'tool' | 'action' | 'press-action';
}

export const PHYSICS_PAINT_TOOL_RAIL_ITEMS: PhysicsPaintToolRailItem[] = [
  { id: 'paint', label: 'Paint', icon: paintModeNormalIcon, kind: 'tool' },
  { id: 'paint-physics', label: 'Paint with physics', icon: paintModePhysicsIcon, kind: 'tool' },
  { id: 'erase', label: 'Erase', icon: eraserIcon, kind: 'tool' },
  { id: 'move', label: 'Move', icon: moveToolIcon, kind: 'tool' },
  { id: 'undo', label: 'Undo', icon: undoIcon, kind: 'action' },
  { id: 'redo', label: 'Redo', icon: undoIcon, kind: 'action' },
  { id: 'clear-frame', label: 'Clear current Roto frame', icon: clearCanvasIcon, kind: 'action' },
];

export interface PhysicsPaintToolRailProps {
  activeTool: ToolType;
  physicsMode: 'local' | null;
  historyAvailability?: ReadonlySignal<PaintHistoryAvailability>;
  /** quick 261004-dn5: gates the Move icon — a move needs a script entry to translate. */
  strokeScriptInMemory: ReadonlySignal<boolean>;
  disabled?: boolean;
  onSelectTool: (tool: ToolType, physicsMode: 'local' | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearFrame: () => void;
  /** Fired after a swatch swap/promote with the new foreground hex so the engine color follows. */
  onActiveColorChanged?: (color: string) => void;
}

function isItemActive(
  item: PhysicsPaintToolRailItem,
  activeTool: ToolType,
  physicsMode: 'local' | null,
) {
  if (item.id === 'paint') return activeTool === 'paint' && physicsMode === null;
  if (item.id === 'paint-physics') return activeTool === 'paint' && physicsMode === 'local';
  if (item.id === 'erase') return activeTool === 'erase';
  if (item.id === 'move') return activeTool === 'move';
  return false;
}

function PhysicsPaintHistoryActionButton({
  item,
  historyAvailability,
  disabled,
  onAction,
}: {
  item: PhysicsPaintToolRailItem;
  historyAvailability?: ReadonlySignal<PaintHistoryAvailability>;
  disabled: boolean;
  onAction: () => void;
}) {
  const availability = historyAvailability?.value;
  const count = item.id === 'undo' ? availability?.undo ?? 0 : availability?.redo ?? 0;
  return (
    <button
      type="button"
      class="physics-paint-icon-button"
      disabled={disabled || count === 0}
      title={item.label}
      aria-label={item.label}
      onClick={onAction}
    >
      <img src={item.icon} alt="" aria-hidden="true" style={item.id === 'redo' ? { transform: 'scaleX(-1)' } : undefined} />
    </button>
  );
}

// 38-11: the rail is wrapped in preact/compat memo — a startFrame-only Studio
// render feeds referentially stable props (38-11 identity memo in the Studio),
// the default shallow compare returns equal, and Preact skips this subtree.
// Undo/Redo read historyAvailability in narrow child subscribers so history
// updates bypass the memo without rendering the rail shell or unrelated tools.
function PhysicsPaintToolRailImpl({
  activeTool,
  physicsMode,
  historyAvailability,
  strokeScriptInMemory,
  disabled = false,
  onSelectTool,
  onUndo,
  onRedo,
  onClearFrame,
  onActiveColorChanged,
}: PhysicsPaintToolRailProps) {
  recordPhysicsPaintPerformanceCounter('render.toolRailImpl');
  // Held-Alt/Cmd display only: this narrow read re-renders just this rail (7
  // buttons) so the active highlight can show Erase/Move while Paint stays
  // selected.
  const displayTool = readEffectiveTool(activeTool);
  // quick 261004-dn5: the Move icon is enabled only while a stroke script is
  // in memory — same narrow-leaf signal precedent as readEffectiveTool above.
  const moveDisabled = !strokeScriptInMemory.value;
  const runAction = (item: PhysicsPaintToolRailItem) => {
    if (disabled) return;
    if (item.id === 'paint') onSelectTool('paint', null);
    if (item.id === 'paint-physics') onSelectTool('paint', 'local');
    if (item.id === 'erase') onSelectTool('erase', physicsMode);
    if (item.id === 'move') onSelectTool('move', physicsMode);
    if (item.id === 'clear-frame') onClearFrame();
  };

  return (
    <nav class="physics-paint-tool-rail" aria-label="Physics Paint tools">
      {PHYSICS_PAINT_TOOL_RAIL_ITEMS.map((item) => {
        if (item.id === 'undo' || item.id === 'redo') {
          return (
            <PhysicsPaintHistoryActionButton
              key={item.id}
              item={item}
              historyAvailability={historyAvailability}
              disabled={disabled}
              onAction={item.id === 'undo' ? onUndo : onRedo}
            />
          );
        }

        const active = isItemActive(item, displayTool, physicsMode);
        const className = `physics-paint-icon-button${active ? ' active' : ''}`;

        return (
          <button
            key={item.id}
            type="button"
            class={className}
            disabled={disabled || (item.id === 'move' && moveDisabled)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={item.kind === 'tool' ? active : undefined}
            onClick={() => runAction(item)}
          >
            <img src={item.icon} alt="" aria-hidden="true" />
          </button>
        );
      })}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <ForegroundBackgroundSwatch onActiveColorChanged={onActiveColorChanged} />
      </div>
    </nav>
  );
}

export const PhysicsPaintToolRail = memo(PhysicsPaintToolRailImpl);
