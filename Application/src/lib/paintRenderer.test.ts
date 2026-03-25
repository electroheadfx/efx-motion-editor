import {describe, it, expect} from 'vitest';

describe('paintRenderer conditional routing', () => {
  // Note: WebGL2 rendering tests are visual-only (jsdom has no WebGL2).
  // These tests validate the routing logic and type guards.

  it.todo('isStyledStroke returns false for PaintShape elements');
  it.todo('isStyledStroke returns false for PaintFill elements');
  it.todo('isStyledStroke returns false for eraser strokes');
  it.todo('isStyledStroke returns false for flat brush strokes');
  it.todo('isStyledStroke returns false for strokes without brushStyle');
  it.todo('isStyledStroke returns true for watercolor brush strokes');
  it.todo('isStyledStroke returns true for ink brush strokes');
  it.todo('renderPaintFrame processes elements in correct order');
});
