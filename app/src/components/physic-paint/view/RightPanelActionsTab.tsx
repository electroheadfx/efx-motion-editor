// ============================================================
//  RightPanelActionsTab — Undo | Redo | Clear frame
//  (UI checklist row 6: Actions tab). These actions moved here
//  from the left tool rail (row 9).
//
//  260815-bmg / T-261018-0OX-01: Undo/Redo stay COUNT-FREE —
//  disable rides the `disabled` prop only (engineControlsDisabled).
//  Never gate on an undo/redo count.
// ============================================================

export function RightPanelActionsTab(props: {
  onUndo: () => void;
  onRedo: () => void;
  onClearFrame: () => void;
  disabled?: boolean;
}) {
  return (
    <div data-testid="right-panel-actions-tab" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        class="physics-paint-text-button"
        data-testid="actions-undo"
        disabled={props.disabled}
        onClick={props.onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        class="physics-paint-text-button"
        data-testid="actions-redo"
        disabled={props.disabled}
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
