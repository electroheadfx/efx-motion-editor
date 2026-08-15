import { memo } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import type { PaintHistoryAvailability, ToolType } from '@efxlab/efx-physic-paint';
import type { ReadonlySignal } from '@preact/signals';
import paintModeNormalIcon from '../../../assets/physics-paint-ui/icons/paint-mode-normal.svg';
import paintModePhysicsIcon from '../../../assets/physics-paint-ui/icons/paint-mode-physics.svg';
import eraserIcon from '../../../assets/physics-paint-ui/icons/LineiconsEraser.svg';
import undoIcon from '../../../assets/physics-paint-ui/icons/MaterialSymbolsUndo.svg';
import clearCanvasIcon from '../../../assets/physics-paint-ui/icons/clear-canvas-pencil.svg';
import physicsLastStrokeIcon from '../../../assets/physics-paint-ui/icons/physics-last-stroke.svg';
import physicsAllActivePaintIcon from '../../../assets/physics-paint-ui/icons/physics-all-active-paint.svg';
import physicsDryPaintIcon from '../../../assets/physics-paint-ui/icons/physics-dry-paint.svg';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

export type PhysicsPaintRailAction =
  | 'paint'
  | 'paint-physics'
  | 'erase'
  | 'undo'
  | 'redo'
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
  { id: 'paint', label: 'Paint', icon: paintModeNormalIcon, kind: 'tool' },
  { id: 'paint-physics', label: 'Paint with physics', icon: paintModePhysicsIcon, kind: 'tool' },
  { id: 'erase', label: 'Erase', icon: eraserIcon, kind: 'tool' },
  { id: 'undo', label: 'Undo', icon: undoIcon, kind: 'action' },
  { id: 'redo', label: 'Redo', icon: undoIcon, kind: 'action' },
  { id: 'clear-frame', label: 'Clear current Roto frame', icon: clearCanvasIcon, kind: 'action' },
  { id: 'physics-last', label: 'Apply physics to last stroke', icon: physicsLastStrokeIcon, kind: 'press-action' },
  { id: 'physics-all', label: 'Apply physics to all strokes', icon: physicsAllActivePaintIcon, kind: 'press-action' },
  { id: 'dry', label: 'Dry / freeze paint', icon: physicsDryPaintIcon, kind: 'action' },
];

export interface PhysicsPaintToolRailProps {
  activeTool: ToolType;
  physicsMode: 'local' | null;
  activePhysicsAction?: 'last' | 'all' | null;
  historyAvailability?: ReadonlySignal<PaintHistoryAvailability>;
  disabled?: boolean;
  onSelectTool: (tool: ToolType, physicsMode: 'local' | null) => void;
  onUndo: () => void;
  onRedo: () => void;
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

// CR-03: unified pointer lifecycle for the press-and-hold physics controls.
// Pointer capture keeps the gesture owned by the button; the engine action
// stops on pointerup, pointercancel, lostpointercapture, blur, and unmount so
// an interrupted touch can never leave physics running. Space/Enter provide
// intentional keyboard press-and-hold semantics: keydown starts, keyup stops,
// and auto-repeat is ignored.
function PhysicsPaintHoldButton({
  item,
  mode,
  active,
  disabled,
  onPhysicsStart,
  onPhysicsStop,
}: {
  item: PhysicsPaintToolRailItem;
  mode: 'last' | 'all';
  active: boolean;
  disabled: boolean;
  onPhysicsStart: (mode: 'last' | 'all') => void;
  onPhysicsStop: () => void;
}) {
  const holdActiveRef = useRef(false);

  const startHold = () => {
    if (disabled || holdActiveRef.current) return;
    holdActiveRef.current = true;
    onPhysicsStart(mode);
  };
  const stopHold = () => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    onPhysicsStop();
  };

  // Unmount cleanup: an interrupted gesture must not leave the engine action
  // active after the rail tears down.
  useEffect(() => () => {
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      onPhysicsStop();
    }
  }, [onPhysicsStop]);

  return (
    <button
      type="button"
      class={`physics-paint-icon-button${active ? ' active' : ''}`}
      disabled={disabled}
      title={item.label}
      aria-label={item.label}
      aria-pressed={active}
      onPointerDown={(event) => {
        if (disabled) return;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer already released or cancelled — the hold still stops via
          // the pointercancel/lostpointercapture handlers below.
        }
        startHold();
      }}
      onPointerUp={stopHold}
      onPointerCancel={stopHold}
      onLostPointerCapture={stopHold}
      onKeyDown={(event) => {
        if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
        event.preventDefault();
        startHold();
      }}
      onKeyUp={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        stopHold();
      }}
      onBlur={stopHold}
    >
      <img src={item.icon} alt="" aria-hidden="true" />
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
  activePhysicsAction = null,
  historyAvailability,
  disabled = false,
  onSelectTool,
  onUndo,
  onRedo,
  onClearFrame,
  onPhysicsStart,
  onPhysicsStop,
  onDryPaint,
}: PhysicsPaintToolRailProps) {
  recordPhysicsPaintPerformanceCounter('render.toolRailImpl');
  const runAction = (item: PhysicsPaintToolRailItem) => {
    if (disabled) return;
    if (item.id === 'paint') onSelectTool('paint', null);
    if (item.id === 'paint-physics') onSelectTool('paint', 'local');
    if (item.id === 'erase') onSelectTool('erase', physicsMode);
    if (item.id === 'clear-frame') onClearFrame();
    if (item.id === 'dry') onDryPaint();
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

        const active = isItemActive(item, activeTool, physicsMode, activePhysicsAction);
        const className = `physics-paint-icon-button${active ? ' active' : ''}`;

        if (item.id === 'physics-last' || item.id === 'physics-all') {
          const mode = item.id === 'physics-last' ? 'last' : 'all';
          return (
            <PhysicsPaintHoldButton
              key={item.id}
              item={item}
              mode={mode}
              active={active}
              disabled={disabled}
              onPhysicsStart={onPhysicsStart}
              onPhysicsStop={onPhysicsStop}
            />
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            class={className}
            disabled={disabled}
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

export const PhysicsPaintToolRail = memo(PhysicsPaintToolRailImpl);
