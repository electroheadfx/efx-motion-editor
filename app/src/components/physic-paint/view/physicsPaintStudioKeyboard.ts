import type { PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';

export interface PhysicsPaintStudioKeyboardState {
  currentFrame: number;
  isPlaying: boolean;
  mutationLocked: boolean;
}

export interface PhysicsPaintStudioKeyboardActions {
  navigateRotoFrame: (frame: number) => void;
  toggleOnion: () => void;
  adjustOnionCount: (delta: -1 | 1) => void;
  toggleRotoPlayback: () => void;
  toggleShortcuts: () => void;
  undo: () => void;
  redo: () => void;
  deleteRotoKey?: () => void;
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
    actions.deleteRotoKey();
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

function findAdjacentSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[], currentFrame: number, direction: -1 | 1): number | null {
  const sorted = markers.filter((marker) => marker.saved !== false).map((marker) => marker.frame).sort((a, b) => a - b);
  if (direction < 0) return [...sorted].reverse().find((frame) => frame < currentFrame) ?? null;
  return sorted.find((frame) => frame > currentFrame) ?? null;
}
