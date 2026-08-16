import type { PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';
import { RAIL_TARGET_SELECTOR } from './physicsPaintRailKeyboardNavigation';

export interface PhysicsPaintStudioKeyboardState {
  currentFrame: number;
  isPlaying: boolean;
  mutationLocked: boolean;
  /** True when a real key is in the primary selection (43.4 defect 9 gate). */
  hasSelectedRotoKey: boolean;
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
  /** 43.4 defect 9: with a real key selected, jump to the adjacent REAL KEY
   *  frame (never generated/interpolated/empty); no wrap at the first/last. */
  selectAdjacentRotoKey?: (direction: -1 | 1) => void;
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
  if (target.ownerDocument.querySelector('[role="dialog"], [aria-modal="true"]')) return false;
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
    // native select-all (Pitfall 5); blocked while mutations are locked.
    if (!actions.selectAllRotoKeys || state.mutationLocked) return;
    if (!(event.target instanceof Element) || event.target.closest('.physics-paint-workflow-strip') === null) return;
    event.preventDefault();
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
    // Escape-collapse (D-02): no modifiers, bubble-phase only. No new
    // window-level or capture-phase listener — the drag session's existing
    // capture listener already wins during gestures via
    // stopImmediatePropagation, so drag-cancel keeps precedence (Pitfall 4).
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
      if (state.hasSelectedRotoKey && actions.selectAdjacentRotoKey) {
        // Selection-gated real-key cycling: the landing frame becomes the new
        // selection/focus through navigation, so repeated presses chain across
        // every real key in canonical order.
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
