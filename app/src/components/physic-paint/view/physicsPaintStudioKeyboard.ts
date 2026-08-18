import type { PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';
import { RAIL_TARGET_SELECTOR } from './physicsPaintRailKeyboardNavigation';

export interface PhysicsPaintStudioKeyboardState {
  currentFrame: number;
  isPlaying: boolean;
  mutationLocked: boolean;
  /** True when a real key is in the primary selection (43.4 defect 9 gate). */
  hasSelectedRotoKey: boolean;
  /** True while the toolbox popover is open (role="dialog" aria-modal="false"). */
  toolboxPopoverOpen?: boolean;
}

export interface PhysicsPaintStudioKeyboardActions {
  navigateRotoFrame: (frame: number) => void;
  toggleOnion: () => void;
  adjustOnionCount: (delta: -1 | 1) => void;
  toggleRotoPlayback: () => void;
  toggleShortcuts: () => void;
  undo: () => void;
  redo: () => void;
  copyRotoKey?: () => void;
  cutRotoKey?: () => void;
  pasteRotoKey?: () => void;
  deleteRotoKey?: () => void;
  selectAllRotoKeys?: () => void;
  collapseRotoSelection?: () => void;
  /** Dismiss the toolbox popover; handled on Escape before collapseRotoSelection
   *  so one Escape closes at most one layer (Pitfall 2). */
  closeToolboxPopover?: () => void;
  /** 43.4 defect 9: with a real key selected, jump to the adjacent REAL KEY
   *  frame (never generated/interpolated/empty); no wrap at the first/last. */
  selectAdjacentRotoKey?: (direction: -1 | 1) => void;
  /** 43.5-05: disarm the armed Push tool. Returns true ONLY when a tool was
   *  actually armed, so the Escape layer consumes at most one layer (Pitfall 2).
   *  Select All also disarms via this action (D-20). No Push key binding
   *  exists — activation is toolbar-only (D-10). */
  disarmPushTool?: () => boolean;
  /** 43.6-06: disarm the armed Solo arm. Returns true ONLY when solo was
   *  actually armed, so the Escape layer consumes at most one layer (D-04) —
   *  the solo layer sits between the push disarm layer and selection collapse.
   *  No Solo key binding exists — activation is toolbar-only. */
  disarmSolo?: () => boolean;
}

export function isPhysicsPaintShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return false;
  if (target.isContentEditable) return false;
  return !Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function isPhysicsPaintRotoDeleteTarget(target: EventTarget | null): boolean {
  if (!isPhysicsPaintShortcutTarget(target)) return false;
  if (!(target instanceof Element)) return true;
  // 43.5-02 (Pitfall 1): only a real modal suspends Delete/Backspace. The toolbox
  // popover is role="dialog" aria-modal="false", so it must NOT suspend routing.
  if (target.ownerDocument.querySelector('[aria-modal="true"]')) return false;
  if (target.closest('.physics-paint-roto-cell.current')) return true;
  // A selected Key Rail or Motion/Static Rail button is a valid delete target:
  // the selection-scope classifier (classifyRotoDeleteTarget) decides the
  // exact scope (43.4 defect 5). Unselected rail buttons stay protected so
  // Delete/Backspace never fires while a plain rail button merely has focus.
  if (target.closest('.physics-paint-key-rail-target.selected, .physics-paint-loop-clip-rail-target.selected')) return true;
  return !Boolean(target.closest([
    'button',
    'a[href]',
    'area[href]',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="combobox"]',
    '[role="link"]',
    '[role="listbox"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="radio"]',
    '[role="searchbox"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="textbox"]',
    '[role="treeitem"]',
  ].join(', ')));
}

export function dispatchPhysicsPaintStudioKeyDown(
  event: KeyboardEvent,
  state: PhysicsPaintStudioKeyboardState,
  actions: PhysicsPaintStudioKeyboardActions,
  savedRotoFrames: PhysicsPaintWorkflowStripFrameMarker[],
): void {
  if (!isPhysicsPaintShortcutTarget(event.target)) return;
  const key = event.key.toLowerCase();
  const meta = event.metaKey || event.ctrlKey;

  if (meta && event.shiftKey && key === 'z') {
    event.preventDefault();
    if (state.mutationLocked) return;
    actions.redo();
    return;
  }
  if (event.ctrlKey && key === 'y') {
    event.preventDefault();
    if (state.mutationLocked) return;
    actions.redo();
    return;
  }
  if (meta && key === 'z') {
    event.preventDefault();
    if (state.mutationLocked) return;
    actions.undo();
    return;
  }
  if (meta && !event.shiftKey && !event.altKey && !event.repeat && (key === 'c' || key === 'x' || key === 'v')) {
    const action = key === 'c' ? actions.copyRotoKey : key === 'x' ? actions.cutRotoKey : actions.pasteRotoKey;
    if (!action) return;
    event.preventDefault();
    if (state.mutationLocked) return;
    action();
    return;
  }
  if (event.key === '?' || (event.shiftKey && event.key === '/')) {
    event.preventDefault();
    actions.toggleShortcuts();
    return;
  }
  if (
    (event.key === 'Backspace' || event.key === 'Delete')
    && !event.repeat
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
  ) {
    if (!actions.deleteRotoKey || !isPhysicsPaintRotoDeleteTarget(event.target)) return;
    event.preventDefault();
    if (state.mutationLocked) return;
    actions.deleteRotoKey();
    return;
  }

  if (meta && !event.shiftKey && !event.altKey && key === 'a') {
    // Select All (D-03): strip-focus scoped so LOG text selection keeps its
    // native select-all (Pitfall 5); blocked while mutations are locked. An
    // armed Push tool is any-other-toolbar-action disarmed here (D-20); it
    // stays armed only when the Select All itself was blocked (locked / not a
    // strip target) — a blocked action never disarms.
    if (!actions.selectAllRotoKeys || state.mutationLocked) return;
    if (!(event.target instanceof Element) || event.target.closest('.physics-paint-workflow-strip') === null) return;
    event.preventDefault();
    actions.disarmPushTool?.();
    actions.selectAllRotoKeys();
    return;
  }

  if (
    event.key === 'Escape'
    && !event.repeat
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
  ) {
    // Escape layering (Pitfall 2): popover dismiss before collapseRotoSelection —
    // one Escape handles at most one layer. No new window-level or capture-phase
    // listener — the drag session's existing capture listener already wins during
    // gestures via stopImmediatePropagation, so drag-cancel keeps precedence
    // (Pitfall 4); the toolbox popover registers its own capture listener only
    // while open, so the ordering here never competes with a live drag.
    if (state.toolboxPopoverOpen && actions.closeToolboxPopover) {
      event.preventDefault();
      actions.closeToolboxPopover();
      return;
    }
    // Armed Push disarm layer (43.5-05, D-06): consumes the Escape only when a
    // tool was actually armed — and never also collapses the selection
    // (Pitfall 2). One Escape handles at most one layer.
    if (actions.disarmPushTool?.()) {
      event.preventDefault();
      return;
    }
    // Armed Solo disarm layer (43.6-06, D-04): consumes the Escape only when
    // solo was actually armed — between the push disarm layer and selection
    // collapse. One Escape handles at most one layer.
    if (actions.disarmSolo?.()) {
      event.preventDefault();
      return;
    }
    if (!actions.collapseRotoSelection) return;
    event.preventDefault();
    actions.collapseRotoSelection();
    return;
  }

    if (event.key === ' ') {
      event.preventDefault();
      actions.toggleRotoPlayback();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      // 43.4 defect 9: a focused rail target owns its Arrow/Tab cycling in the
      // shared roving rail group, so frame navigation never starts from a rail
      // (belt-and-suspenders behind the rail handler's stopPropagation).
      if (event.target instanceof Element && event.target.closest(RAIL_TARGET_SELECTOR)) return;
      if (!event.shiftKey && state.hasSelectedRotoKey && actions.selectAdjacentRotoKey) {
        // Selection-gated real-key cycling on plain arrows: the landing frame
        // becomes the new selection/focus through navigation, so repeated
        // presses chain across every real key in canonical order. Shift+Arrow
        // keeps its validated saved-frame jump below.
        actions.selectAdjacentRotoKey(direction);
        return;
      }
      const nextFrame = event.shiftKey
        ? findAdjacentSavedFrame(savedRotoFrames, state.currentFrame, direction)
        : Math.max(0, state.currentFrame + direction);
      if (nextFrame !== null) actions.navigateRotoFrame(nextFrame);
      return;
    }
    if (key === 'g') {
      event.preventDefault();
      actions.navigateRotoFrame(state.currentFrame);
      return;
    }
    if (key === 'o') {
      event.preventDefault();
      actions.toggleOnion();
      return;
    }
    if (event.key === '[' || event.key === ']') {
      event.preventDefault();
      actions.adjustOnionCount(event.key === ']' ? 1 : -1);
      return;
    }
}

export function findAdjacentRealKeyFrame(
  realKeyFrames: readonly number[],
  currentFrame: number,
  direction: -1 | 1,
): number | null {
  if (direction < 0) {
    for (let index = realKeyFrames.length - 1; index >= 0; index -= 1) {
      const frame = realKeyFrames[index]!;
      if (frame < currentFrame) return frame;
    }
    return null;
  }
  for (const frame of realKeyFrames) {
    if (frame > currentFrame) return frame;
  }
  return null;
}

function findAdjacentSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[], currentFrame: number, direction: -1 | 1): number | null {
  const sorted = markers.filter((marker) => marker.saved !== false).map((marker) => marker.frame).sort((a, b) => a - b);
  if (direction < 0) return [...sorted].reverse().find((frame) => frame < currentFrame) ?? null;
  return sorted.find((frame) => frame > currentFrame) ?? null;
}
