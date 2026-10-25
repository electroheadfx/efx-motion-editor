import { describe, expect, it } from 'vitest';
import { shouldClearSelectionOnCanvasRegionPointerDown } from './scriptSelectionDeselect';

const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false };

function targetMatching(match: string | null) {
  return {
    closest: (selector: string) => (match !== null && selector.includes(match) ? {} : null),
  };
}

describe('shouldClearSelectionOnCanvasRegionPointerDown', () => {
  it('clears the selection on a plain click in the canvas-region background', () => {
    expect(shouldClearSelectionOnCanvasRegionPointerDown(plainClick, targetMatching(null))).toBe(true);
  });

  it('keeps the selection on non-primary buttons and additive modifiers', () => {
    expect(shouldClearSelectionOnCanvasRegionPointerDown({ ...plainClick, button: 1 }, targetMatching(null))).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown({ ...plainClick, button: 2 }, targetMatching(null))).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown({ ...plainClick, metaKey: true }, targetMatching(null))).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown({ ...plainClick, ctrlKey: true }, targetMatching(null))).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown({ ...plainClick, shiftKey: true }, targetMatching(null))).toBe(false);
  });

  it('keeps the selection inside the canvas sheet and selection-scoped chrome', () => {
    expect(shouldClearSelectionOnCanvasRegionPointerDown(plainClick, targetMatching('.demo-canvas-shell'))).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown(plainClick, targetMatching('[role="dialog"]'))).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown(plainClick, targetMatching('.physics-paint-background-picker'))).toBe(false);
  });

  it('is inert without a real element target', () => {
    expect(shouldClearSelectionOnCanvasRegionPointerDown(plainClick, null)).toBe(false);
    expect(shouldClearSelectionOnCanvasRegionPointerDown(plainClick, {})).toBe(false);
  });
});
