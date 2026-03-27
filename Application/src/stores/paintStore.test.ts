import {describe, it, expect, beforeEach, vi} from 'vitest';

// Mock projectStore to break circular import (paintStore -> projectStore -> paintStore)
vi.mock('./projectStore', () => ({
  projectStore: {
    markDirty: vi.fn(),
    width: {peek: () => 1920, value: 1920},
    height: {peek: () => 1080, value: 1080},
  },
}));

// Mock brushP5Adapter (uses DOM/canvas APIs unavailable in test)
vi.mock('../lib/brushP5Adapter', () => ({
  renderFrameFx: vi.fn(() => null),
}));

import {paintStore} from './paintStore';
import {historyStore} from './historyStore';
import {undo, redo, resetHistory} from '../lib/history';
import type {PaintElement, PaintStroke} from '../types/paint';

/** Create a minimal PaintStroke stub with the given id */
function makeStroke(id: string): PaintElement {
  return {
    id,
    tool: 'brush',
    points: [[0, 0, 0.5]],
    color: '#000000',
    opacity: 1,
    size: 8,
    options: {
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true,
      pressureEasing: 'linear',
      pressureCurve: 1.0,
      taperStart: 0,
      taperEnd: 0,
      tiltInfluence: 0,
    },
  } as PaintStroke;
}

const LAYER = 'test-layer';
const FRAME = 0;

describe('paintStore moveElements* bug fixes (D-12)', () => {
  beforeEach(() => {
    paintStore.reset();
    resetHistory();
  });

  function setupFrame(ids: string[]): void {
    const elements = ids.map(makeStroke);
    paintStore.setFrame(LAYER, FRAME, {elements});
  }

  function getIds(): string[] {
    const frame = paintStore.getFrame(LAYER, FRAME);
    return frame ? frame.elements.map((e) => e.id) : [];
  }

  // --- moveElementsForward ---

  describe('moveElementsForward', () => {
    it('increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      const before = paintStore.paintVersion.value;
      paintStore.moveElementsForward(LAYER, FRAME, new Set(['a']));
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('pushes an undo action onto the history stack', () => {
      setupFrame(['a', 'b', 'c']);
      const stackBefore = historyStore.stack.value.length;
      paintStore.moveElementsForward(LAYER, FRAME, new Set(['a']));
      expect(historyStore.stack.value.length).toBe(stackBefore + 1);
    });

    it('undo restores original element order', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsForward(LAYER, FRAME, new Set(['a']));
      // After forward: b, a, c
      expect(getIds()).toEqual(['b', 'a', 'c']);
      undo();
      expect(getIds()).toEqual(['a', 'b', 'c']);
    });

    it('redo re-applies the move', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsForward(LAYER, FRAME, new Set(['a']));
      undo();
      redo();
      expect(getIds()).toEqual(['b', 'a', 'c']);
    });

    it('undo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsForward(LAYER, FRAME, new Set(['a']));
      const before = paintStore.paintVersion.value;
      undo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('redo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsForward(LAYER, FRAME, new Set(['a']));
      undo();
      const before = paintStore.paintVersion.value;
      redo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });
  });

  // --- moveElementsBackward ---

  describe('moveElementsBackward', () => {
    it('increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      const before = paintStore.paintVersion.value;
      paintStore.moveElementsBackward(LAYER, FRAME, new Set(['c']));
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('pushes an undo action onto the history stack', () => {
      setupFrame(['a', 'b', 'c']);
      const stackBefore = historyStore.stack.value.length;
      paintStore.moveElementsBackward(LAYER, FRAME, new Set(['c']));
      expect(historyStore.stack.value.length).toBe(stackBefore + 1);
    });

    it('undo restores original element order', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsBackward(LAYER, FRAME, new Set(['c']));
      // After backward: a, c, b
      expect(getIds()).toEqual(['a', 'c', 'b']);
      undo();
      expect(getIds()).toEqual(['a', 'b', 'c']);
    });

    it('redo re-applies the move', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsBackward(LAYER, FRAME, new Set(['c']));
      undo();
      redo();
      expect(getIds()).toEqual(['a', 'c', 'b']);
    });

    it('undo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsBackward(LAYER, FRAME, new Set(['c']));
      const before = paintStore.paintVersion.value;
      undo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('redo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsBackward(LAYER, FRAME, new Set(['c']));
      undo();
      const before = paintStore.paintVersion.value;
      redo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });
  });

  // --- moveElementsToFront ---

  describe('moveElementsToFront', () => {
    it('increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      const before = paintStore.paintVersion.value;
      paintStore.moveElementsToFront(LAYER, FRAME, new Set(['a']));
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('pushes an undo action onto the history stack', () => {
      setupFrame(['a', 'b', 'c']);
      const stackBefore = historyStore.stack.value.length;
      paintStore.moveElementsToFront(LAYER, FRAME, new Set(['a']));
      expect(historyStore.stack.value.length).toBe(stackBefore + 1);
    });

    it('undo restores original element order', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToFront(LAYER, FRAME, new Set(['a']));
      // After toFront: b, c, a
      expect(getIds()).toEqual(['b', 'c', 'a']);
      undo();
      expect(getIds()).toEqual(['a', 'b', 'c']);
    });

    it('redo re-applies the move', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToFront(LAYER, FRAME, new Set(['a']));
      undo();
      redo();
      expect(getIds()).toEqual(['b', 'c', 'a']);
    });

    it('undo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToFront(LAYER, FRAME, new Set(['a']));
      const before = paintStore.paintVersion.value;
      undo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('redo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToFront(LAYER, FRAME, new Set(['a']));
      undo();
      const before = paintStore.paintVersion.value;
      redo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });
  });

  // --- moveElementsToBack ---

  describe('moveElementsToBack', () => {
    it('increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      const before = paintStore.paintVersion.value;
      paintStore.moveElementsToBack(LAYER, FRAME, new Set(['c']));
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('pushes an undo action onto the history stack', () => {
      setupFrame(['a', 'b', 'c']);
      const stackBefore = historyStore.stack.value.length;
      paintStore.moveElementsToBack(LAYER, FRAME, new Set(['c']));
      expect(historyStore.stack.value.length).toBe(stackBefore + 1);
    });

    it('undo restores original element order', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToBack(LAYER, FRAME, new Set(['c']));
      // After toBack: c, a, b
      expect(getIds()).toEqual(['c', 'a', 'b']);
      undo();
      expect(getIds()).toEqual(['a', 'b', 'c']);
    });

    it('redo re-applies the move', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToBack(LAYER, FRAME, new Set(['c']));
      undo();
      redo();
      expect(getIds()).toEqual(['c', 'a', 'b']);
    });

    it('undo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToBack(LAYER, FRAME, new Set(['c']));
      const before = paintStore.paintVersion.value;
      undo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('redo callback increments paintVersion', () => {
      setupFrame(['a', 'b', 'c']);
      paintStore.moveElementsToBack(LAYER, FRAME, new Set(['c']));
      undo();
      const before = paintStore.paintVersion.value;
      redo();
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });
  });
});

describe('paintStore luma key signals (Phase 25)', () => {
  beforeEach(() => {
    paintStore.reset();
  });

  describe('lumaKeyEnabled', () => {
    it('defaults to false', () => {
      expect(paintStore.lumaKeyEnabled.value).toBe(false);
    });

    it('setLumaKeyEnabled(true) bumps paintVersion', () => {
      const before = paintStore.paintVersion.value;
      paintStore.setLumaKeyEnabled(true);
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('setLumaKeyEnabled(false) bumps paintVersion', () => {
      paintStore.setLumaKeyEnabled(true);
      const before = paintStore.paintVersion.value;
      paintStore.setLumaKeyEnabled(false);
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('reset() sets to false', () => {
      paintStore.setLumaKeyEnabled(true);
      paintStore.reset();
      expect(paintStore.lumaKeyEnabled.value).toBe(false);
    });
  });

  describe('lumaInvertEnabled', () => {
    it('defaults to false', () => {
      expect(paintStore.lumaInvertEnabled.value).toBe(false);
    });

    it('setLumaInvertEnabled(true) bumps paintVersion', () => {
      const before = paintStore.paintVersion.value;
      paintStore.setLumaInvertEnabled(true);
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('setLumaInvertEnabled(false) bumps paintVersion', () => {
      paintStore.setLumaInvertEnabled(true);
      const before = paintStore.paintVersion.value;
      paintStore.setLumaInvertEnabled(false);
      expect(paintStore.paintVersion.value).toBe(before + 1);
    });

    it('reset() sets to false', () => {
      paintStore.setLumaInvertEnabled(true);
      paintStore.reset();
      expect(paintStore.lumaInvertEnabled.value).toBe(false);
    });
  });
});
