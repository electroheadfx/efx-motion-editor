import type { PhysicsPaintWorkflowMode } from '../physicsPaintWorkflowState';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../PhysicsPaintWorkflowStrip';

export interface PhysicsPaintStudioKeyboardState {
  currentFrame: number;
  framesToApply: number;
  isPlaying: boolean;
  savedPlayCacheDirty: boolean;
  workflowMode: PhysicsPaintWorkflowMode;
}

export interface PhysicsPaintStudioKeyboardActions {
  findCachedPlayFrames: (frameCount: number) => unknown;
  navigateRotoFrame: (frame: number) => void;
  playPreview: (frameCount: number) => void;
  savePlay: () => void;
  saveRotoFrame: () => void;
  stopPreview: () => void;
  toggleOnion: () => void;
  adjustOnionCount: (delta: -1 | 1) => void;
  toggleRotoPlayback: () => void;
  toggleShortcuts: () => void;
  undo: () => void;
}

export function isPhysicsPaintShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return false;
  if (target.isContentEditable) return false;
  return !Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
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

  if (meta && key === 'z') {
    event.preventDefault();
    actions.undo();
    return;
  }
  if (event.key === 'Escape') {
    if (state.isPlaying) {
      event.preventDefault();
      actions.stopPreview();
    }
    return;
  }
  if (meta && key === 's') {
    event.preventDefault();
    if (state.workflowMode === 'play') actions.savePlay();
    else actions.saveRotoFrame();
    return;
  }
  if (event.key === '?' || (event.shiftKey && event.key === '/')) {
    event.preventDefault();
    actions.toggleShortcuts();
    return;
  }

  if (state.workflowMode === 'roto') {
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
    if (meta && event.key === 'Enter') {
      event.preventDefault();
      actions.saveRotoFrame();
      return;
    }
  }

  if (state.workflowMode === 'play' && (event.key === ' ' || event.key === 'Enter')) {
    event.preventDefault();
    if (state.isPlaying) actions.stopPreview();
    else if (!state.savedPlayCacheDirty && actions.findCachedPlayFrames(state.framesToApply)) actions.playPreview(state.framesToApply);
    else actions.savePlay();
  }
}

function findAdjacentSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[], currentFrame: number, direction: -1 | 1): number | null {
  const sorted = markers
    .filter((marker) => marker.saved !== false)
    .map((marker) => marker.frame)
    .sort((a, b) => a - b);
  if (direction < 0) return [...sorted].reverse().find((frame) => frame < currentFrame) ?? null;
  return sorted.find((frame) => frame > currentFrame) ?? null;
}
