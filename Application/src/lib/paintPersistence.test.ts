import {describe, it, expect} from 'vitest';
import type {PaintStroke, PaintFrame, BrushFxParams} from '../types/paint';

describe('paintPersistence brush FX round-trip', () => {
  const makeStroke = (overrides: Partial<PaintStroke> = {}): PaintStroke => ({
    id: 'test-stroke',
    tool: 'brush',
    points: [[10, 20, 0.5], [30, 40, 0.7]],
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

  it('PaintStroke with brushStyle serializes to JSON correctly', () => {
    const stroke = makeStroke({brushStyle: 'watercolor'});
    const json = JSON.stringify(stroke);
    const parsed = JSON.parse(json);
    expect(parsed.brushStyle).toBe('watercolor');
  });

  it('PaintStroke with brushParams serializes all FX param values', () => {
    const params: BrushFxParams = {bleed: 0.6, grain: 0.4, fieldStrength: 0.3};
    const stroke = makeStroke({brushStyle: 'watercolor', brushParams: params});
    const json = JSON.stringify(stroke);
    const parsed = JSON.parse(json);
    expect(parsed.brushParams.bleed).toBe(0.6);
    expect(parsed.brushParams.grain).toBe(0.4);
    expect(parsed.brushParams.fieldStrength).toBe(0.3);
  });

  it('PaintStroke fxState serializes and deserializes correctly', () => {
    const stroke = makeStroke({fxState: 'fx-applied', brushStyle: 'ink'});
    const json = JSON.stringify(stroke);
    const parsed = JSON.parse(json);
    expect(parsed.fxState).toBe('fx-applied');
  });

  it('PaintStroke without brushStyle deserializes with undefined (backward compat)', () => {
    const stroke = makeStroke();
    delete (stroke as any).brushStyle;
    const json = JSON.stringify(stroke);
    const parsed = JSON.parse(json);
    expect(parsed.brushStyle).toBeUndefined();
  });

  it('Old sidecar JSON without brushStyle/brushParams/fxState loads without error', () => {
    const oldJson = JSON.stringify({
      elements: [{
        id: 'old-stroke', tool: 'brush',
        points: [[0, 0, 0.5]], color: '#000', opacity: 1, size: 5,
        options: {thinning: 0.5, smoothing: 0.5, streamline: 0.5,
          simulatePressure: true, pressureEasing: 'linear',
          pressureCurve: 2, taperStart: 0, taperEnd: 0, tiltInfluence: 0.3},
      }],
    });
    const parsed: PaintFrame = JSON.parse(oldJson);
    expect(parsed.elements).toHaveLength(1);
    const s = parsed.elements[0] as PaintStroke;
    expect(s.brushStyle).toBeUndefined();
    expect(s.brushParams).toBeUndefined();
    expect(s.fxState).toBeUndefined();
  });

  it('Round-trip: serialize then deserialize preserves brushStyle, brushParams, and fxState', () => {
    const frame: PaintFrame = {
      elements: [
        makeStroke({id: 's1', brushStyle: 'ink', brushParams: {edgeDarken: 0.7, fieldStrength: 0.15}, fxState: 'fx-applied'}),
        makeStroke({id: 's2', brushStyle: 'charcoal', brushParams: {grain: 0.6, scatter: 0.4}, fxState: 'fx-applied'}),
      ],
    };
    const json = JSON.stringify(frame);
    const parsed: PaintFrame = JSON.parse(json);
    const s1 = parsed.elements[0] as PaintStroke;
    const s2 = parsed.elements[1] as PaintStroke;
    expect(s1.brushStyle).toBe('ink');
    expect(s1.brushParams?.edgeDarken).toBe(0.7);
    expect(s1.fxState).toBe('fx-applied');
    expect(s2.brushStyle).toBe('charcoal');
    expect(s2.brushParams?.grain).toBe(0.6);
    expect(s2.fxState).toBe('fx-applied');
  });

  it('Serialized PaintStroke has no fxCachedCanvas field (per-frame caching, not per-stroke)', () => {
    const stroke = makeStroke({fxState: 'fx-applied', brushStyle: 'watercolor'});
    const json = JSON.stringify(stroke);
    const parsed = JSON.parse(json);
    expect(parsed.fxCachedCanvas).toBeUndefined();
    expect(Object.keys(parsed)).not.toContain('fxCachedCanvas');
  });
});
