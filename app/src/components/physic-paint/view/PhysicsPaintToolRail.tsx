import { memo } from 'preact/compat';
import type { PaintHistoryAvailability } from '../types/paintCore';
import type { ReadonlySignal } from '@preact/signals';
import { Droplet, Eraser, Paintbrush, Pen, Wind } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import moveToolIcon from '../../../assets/physics-paint-ui/icons/move-tool.svg';
import undoIcon from '../../../assets/physics-paint-ui/icons/MaterialSymbolsUndo.svg';
import clearCanvasIcon from '../../../assets/physics-paint-ui/icons/clear-canvas-pencil.svg';
import { ForegroundBackgroundSwatch } from '../../sidebar/ForegroundBackgroundSwatch';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { aquarelleActiveTool, setAquarelleTool, emitAquarelleDry, aquarelleRecordClock } from './aquarelleRecordState';
import {
  aquarelleSelectMode,
  setAquarelleSelectMode,
  toggleAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';

export type PhysicsPaintRailAction = 'undo' | 'redo' | 'clear-frame';

export interface PhysicsPaintToolRailItem {
  id: PhysicsPaintRailAction;
  label: string;
  /** Optional hover text; the label stays the short accessible name. */
  tooltip?: string;
  icon: string;
  kind: 'action';
}

/**
 * 261027-klx: engine-1 removal leaves the shared history/clear actions. The
 * Brush tool set (Paint / Paint with physics / Erase / Move) and its engine-1
 * dispatch are gone — Water color is the only paint surface and its tool row
 * (Brush | Water | Pen | Lift) lives in `WatercolorRail` below.
 */
export const PHYSICS_PAINT_TOOL_RAIL_ITEMS: PhysicsPaintToolRailItem[] = [
  { id: 'undo', label: 'Undo', icon: undoIcon, kind: 'action' },
  { id: 'redo', label: 'Redo', icon: undoIcon, kind: 'action' },
  { id: 'clear-frame', label: 'Clear current Roto frame', icon: clearCanvasIcon, kind: 'action' },
];

/** UI checklist rows 8/9: Water color rail = Brush | Water | Pen | Lift | Dry. */
const WATERCOLOR_RAIL_TOOLS: ReadonlyArray<{
  id: AquarelleTool;
  label: string;
  shortcut?: string;
  Icon: (props: { size?: number }) => ComponentChildren;
}> = Object.freeze([
  { id: 'brush', label: 'Brush', shortcut: 'B', Icon: Paintbrush },
  { id: 'water', label: 'Water', shortcut: 'W', Icon: Droplet },
  { id: 'pen', label: 'Pen', Icon: Pen },
  { id: 'lift', label: 'Eraser', shortcut: 'E', Icon: Eraser },
]);

function WatercolorRail({
  disabled,
  historyAvailability,
  selectAvailable,
  onUndo,
  onRedo,
  onClearFrame,
  onActiveColorChanged,
}: {
  disabled: boolean;
  historyAvailability?: ReadonlySignal<PaintHistoryAvailability>;
  /** Frame-scoped: the current key must own a Water color script. */
  selectAvailable: ReadonlySignal<boolean>;
  onUndo: () => void;
  onRedo: () => void;
  onClearFrame: () => void;
  onActiveColorChanged?: (color: string) => void;
}) {
  const active = aquarelleActiveTool.value;
  // Select/Move is the ONLY active tool while select mode is on; the previous
  // paint tool is shown deselected.
  const selectActive = aquarelleSelectMode.value;
  const undoItem = PHYSICS_PAINT_TOOL_RAIL_ITEMS.find((item) => item.id === 'undo')!;
  const redoItem = PHYSICS_PAINT_TOOL_RAIL_ITEMS.find((item) => item.id === 'redo')!;
  const clearItem = PHYSICS_PAINT_TOOL_RAIL_ITEMS.find((item) => item.id === 'clear-frame')!;
  return (
    <nav class="physics-paint-tool-rail" aria-label="Water color tools">
      {WATERCOLOR_RAIL_TOOLS.map(({ id, label, shortcut, Icon }) => {
        const isActive = !selectActive && active === id;
        return (
          <button
            key={id}
            type="button"
            class={`physics-paint-icon-button${isActive ? ' active' : ''}`}
            disabled={disabled}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => {
              setAquarelleSelectMode(false);
              setAquarelleTool(id);
            }}
          >
            <Icon size={18} />
          </button>
        );
      })}
      {/* 261022-pim: Move/Select toggle. While on, an overlay above the sheet
          outlines every recorded stroke of the frame and blocks painting. */}
      <button
        type="button"
        class={`physics-paint-icon-button${selectActive ? ' active' : ''}`}
        data-testid="aquarelle-select-toggle"
        disabled={disabled || !selectAvailable.value}
        title="Select (A) — click toggles Select on/off · A enters Select, then cycles the filter Paint → Eraser → All → Paint · Drag moves the selected stroke · Corner handles scale · Edge handles resize width or height · Top handle rotates · Backspace deletes the selected stroke · < sends the selected stroke one step back · > one step forward"
        aria-label="Select"
        aria-pressed={selectActive}
        onClick={() => toggleAquarelleSelectMode()}
      >
        <img src={moveToolIcon} alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="physics-paint-icon-button"
        data-testid="aquarelle-dry"
        disabled={disabled}
        title="Flash-dry the sheet. Recorded in the script."
        aria-label="Dry"
        onClick={() => emitAquarelleDry(aquarelleRecordClock())}
      >
        <Wind size={18} />
      </button>
      {/* Global history actions (261018-cy1): same disable semantics as before;
          Trash is the existing clear-frame action. */}
      <PhysicsPaintHistoryActionButton
        item={undoItem}
        historyAvailability={historyAvailability}
        disabled={disabled}
        onAction={onUndo}
      />
      <PhysicsPaintHistoryActionButton
        item={redoItem}
        historyAvailability={historyAvailability}
        disabled={disabled}
        onAction={onRedo}
      />
      <button
        type="button"
        class="physics-paint-icon-button"
        disabled={disabled}
        title={clearItem.label}
        aria-label="Trash"
        onClick={onClearFrame}
      >
        <img src={clearItem.icon} alt="" aria-hidden="true" />
      </button>
      <div style={{ marginTop: '8px' }}>
        <ForegroundBackgroundSwatch onActiveColorChanged={onActiveColorChanged} />
      </div>
    </nav>
  );
}

export interface PhysicsPaintToolRailProps {
  historyAvailability?: ReadonlySignal<PaintHistoryAvailability>;
  /** quick-261026-odd — gates Water color Select; the current key must own a script. */
  selectAvailable: ReadonlySignal<boolean>;
  disabled?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearFrame: () => void;
  /** Fired after a swatch swap/promote with the new foreground hex so the engine color follows. */
  onActiveColorChanged?: (color: string) => void;
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
  historyAvailability,
  selectAvailable,
  disabled = false,
  onUndo,
  onRedo,
  onClearFrame,
  onActiveColorChanged,
}: PhysicsPaintToolRailProps) {
  recordPhysicsPaintPerformanceCounter('render.toolRailImpl');
  // 261027-klx: Water color is the only module — the rail is the aquarelle
  // tool row, Dry, Move/Select and the shared history/clear actions.
  return (
    <WatercolorRail
      disabled={disabled}
      historyAvailability={historyAvailability}
      selectAvailable={selectAvailable}
      onUndo={onUndo}
      onRedo={onRedo}
      onClearFrame={onClearFrame}
      onActiveColorChanged={onActiveColorChanged}
    />
  );
}

export const PhysicsPaintToolRail = memo(PhysicsPaintToolRailImpl);
