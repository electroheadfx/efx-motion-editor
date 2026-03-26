import {describe, it, expect} from 'vitest';
import type {PaintStroke, PaintShape, PaintFill, PaintElement} from '../types/paint';

// The isStyledStroke function is not exported, so we test the routing behavior
// by checking type guard logic manually.

describe('paintRenderer conditional routing', () => {
  // Create test fixtures
  const makeStroke = (overrides: Partial<PaintStroke> = {}): PaintStroke => ({
    id: 'test-stroke',
    tool: 'brush',
    points: [[0, 0, 0.5]],
    color: '#FF0000',
    opacity: 1,
    size: 10,
    options: {
      thinning: 0.5, smoothing: 0.5, streamline: 0.5,
      simulatePressure: true, pressureEasing: 'linear',
      pressureCurve: 2, taperStart: 0, taperEnd: 0, tiltInfluence: 0.3,
    },
    ...overrides,
  });

  // Test isStyledStroke logic (replicated since not exported)
  function isStyledStroke(element: PaintElement): boolean {
    if (element.tool !== 'brush') return false;
    const stroke = element as PaintStroke;
    return !!stroke.brushStyle && stroke.brushStyle !== 'flat';
  }

  it('returns false for PaintShape elements', () => {
    const shape: PaintShape = {
      id: 's1', tool: 'line', x1: 0, y1: 0, x2: 100, y2: 100,
      color: '#000', opacity: 1, strokeWidth: 2, filled: false,
    };
    expect(isStyledStroke(shape)).toBe(false);
  });

  it('returns false for PaintFill elements', () => {
    const fill: PaintFill = {
      id: 'f1', tool: 'fill', x: 50, y: 50,
      color: '#000', opacity: 1, tolerance: 10,
    };
    expect(isStyledStroke(fill)).toBe(false);
  });

  it('returns false for eraser strokes', () => {
    expect(isStyledStroke(makeStroke({tool: 'eraser'}))).toBe(false);
  });

  it('returns false for flat brush strokes', () => {
    expect(isStyledStroke(makeStroke({brushStyle: 'flat'}))).toBe(false);
  });

  it('returns false for strokes without brushStyle', () => {
    expect(isStyledStroke(makeStroke({brushStyle: undefined}))).toBe(false);
  });

  it('returns true for watercolor brush strokes', () => {
    expect(isStyledStroke(makeStroke({brushStyle: 'watercolor'}))).toBe(true);
  });

  it('returns true for ink brush strokes', () => {
    expect(isStyledStroke(makeStroke({brushStyle: 'ink'}))).toBe(true);
  });

  it('processes elements in correct order by checking styled vs non-styled sequencing', () => {
    const elements: PaintElement[] = [
      makeStroke({id: '1', brushStyle: 'flat'}),
      makeStroke({id: '2', brushStyle: 'ink'}),
      makeStroke({id: '3', brushStyle: 'charcoal'}),
      makeStroke({id: '4', brushStyle: 'flat'}),
    ];
    const styled = elements.filter(isStyledStroke);
    const flat = elements.filter(e => !isStyledStroke(e));
    expect(styled).toHaveLength(2);
    expect(flat).toHaveLength(2);
    expect(styled.map(s => (s as PaintStroke).id)).toEqual(['2', '3']);
  });

  it('correctly identifies fxState for flat element filtering', () => {
    // This tests the logic used in renderFlatElements
    const elements: PaintElement[] = [
      makeStroke({id: '1', brushStyle: 'flat'}),
      makeStroke({id: '2', brushStyle: 'ink', fxState: 'fx-applied'}),
      makeStroke({id: '3', brushStyle: 'charcoal', fxState: 'flattened'}),
      makeStroke({id: '4', brushStyle: undefined}),
    ];

    // renderFlatElements skips elements with fxState === 'fx-applied' or 'flattened'
    const flatOnly = elements.filter(el => {
      if (el.tool === 'brush') {
        const stroke = el as PaintStroke;
        if (stroke.fxState === 'fx-applied' || stroke.fxState === 'flattened') {
          return false;
        }
      }
      return true;
    });

    expect(flatOnly).toHaveLength(2);
    expect(flatOnly.map(e => (e as PaintStroke).id)).toEqual(['1', '4']);
  });
});
