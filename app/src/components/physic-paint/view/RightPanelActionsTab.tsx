// ============================================================
//  RightPanelActionsTab — Undo | Redo | Clear frame
//  (UI checklist row 6: Actions tab). These actions moved here
//  from the left tool rail (row 9).
// ============================================================

import type { ReadonlySignal } from '@preact/signals';

export function RightPanelActionsTab(props: {
  onUndo: () => void;
  onRedo: () => void;
  onClearFrame: () => void;
  historyAvailability?: ReadonlySignal<{ undo: number; redo: number }>;
  disabled?: boolean;
}) {
  const availability = props.historyAvailability?.value;
  const undoCount = availability?.undo ?? 0;
  const redoCount = availability?.redo ?? 0;

  return (
    <div data-testid="right-panel-actions-tab" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        class="physics-paint-text-button"
        data-testid="actions-undo"
        disabled={props.disabled || undoCount === 0}
        onClick={props.onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        class="physics-paint-text-button"
        data-testid="actions-redo"
        disabled={props.disabled || redoCount === 0}
        onClick={props.onRedo}
      >
        Redo
      </button>
      <button
        type="button"
        class="physics-paint-text-button"
        data-testid="actions-clear-frame"
        disabled={props.disabled}
        onClick={props.onClearFrame}
      >
        Clear frame
      </button>
    </div>
  );
}
