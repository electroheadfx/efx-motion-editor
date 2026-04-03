import {describe, it, expect} from 'vitest';
import {
  BRUSH_STYLES,
  DEFAULT_BRUSH_FX_PARAMS,
  BRUSH_FX_VISIBLE_PARAMS,
  DEFAULT_PAINT_BG_COLOR,
  type BrushStyle,
  type StrokeFxState,
  type PaintStroke,
} from './paint';

describe('BrushStyle type system', () => {
  it('BrushStyle union includes all 6 styles: flat, watercolor, ink, charcoal, pencil, marker', () => {
    const expected: BrushStyle[] = ['flat', 'watercolor', 'ink', 'charcoal', 'pencil', 'marker'];
    for (const style of expected) {
      // Type-level check: assigning each literal to BrushStyle compiles
      const s: BrushStyle = style;
      expect(s).toBe(style);
    }
  });

  it('BRUSH_STYLES array contains all 6 styles in correct order', () => {
    expect(BRUSH_STYLES).toEqual(['flat', 'watercolor', 'ink', 'charcoal', 'pencil', 'marker']);
    expect(BRUSH_STYLES).toHaveLength(6);
  });

  it('BrushFxParams interface has 5 optional numeric fields: grain, bleed, scatter, fieldStrength, edgeDarken', () => {
    // Verify DEFAULT_BRUSH_FX_PARAMS watercolor uses the expected keys from BrushFxParams
    const wc = DEFAULT_BRUSH_FX_PARAMS['watercolor'];
    expect(typeof wc.bleed).toBe('number');
    expect(typeof wc.grain).toBe('number');
    expect(typeof wc.fieldStrength).toBe('number');
    // ink uses edgeDarken
    const ink = DEFAULT_BRUSH_FX_PARAMS['ink'];
    expect(typeof ink.edgeDarken).toBe('number');
    // charcoal uses scatter
    const charcoal = DEFAULT_BRUSH_FX_PARAMS['charcoal'];
    expect(typeof charcoal.scatter).toBe('number');
  });

  it('DEFAULT_BRUSH_FX_PARAMS has entry for each BrushStyle', () => {
    for (const style of BRUSH_STYLES) {
      expect(DEFAULT_BRUSH_FX_PARAMS).toHaveProperty(style);
    }
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS)).toHaveLength(6);
  });

  it('DEFAULT_BRUSH_FX_PARAMS flat has empty object (no FX params)', () => {
    expect(DEFAULT_BRUSH_FX_PARAMS['flat']).toEqual({});
  });

  it('DEFAULT_BRUSH_FX_PARAMS watercolor has bleed, grain, fieldStrength', () => {
    const wc = DEFAULT_BRUSH_FX_PARAMS['watercolor'];
    expect(wc).toHaveProperty('bleed');
    expect(wc).toHaveProperty('grain');
    expect(wc).toHaveProperty('fieldStrength');
  });

  it('BRUSH_FX_VISIBLE_PARAMS flat has empty array', () => {
    expect(BRUSH_FX_VISIBLE_PARAMS['flat']).toEqual([]);
  });

  it('BRUSH_FX_VISIBLE_PARAMS watercolor includes bleed, grain, fieldStrength', () => {
    expect(BRUSH_FX_VISIBLE_PARAMS['watercolor']).toContain('bleed');
    expect(BRUSH_FX_VISIBLE_PARAMS['watercolor']).toContain('grain');
    expect(BRUSH_FX_VISIBLE_PARAMS['watercolor']).toContain('fieldStrength');
  });

  it('BRUSH_FX_VISIBLE_PARAMS ink includes edgeDarken, fieldStrength', () => {
    expect(BRUSH_FX_VISIBLE_PARAMS['ink']).toContain('edgeDarken');
    expect(BRUSH_FX_VISIBLE_PARAMS['ink']).toContain('fieldStrength');
  });

  it('PaintStroke interface accepts optional brushStyle and brushParams fields', () => {
    // Type-level check: a PaintStroke with optional fields compiles
    const stroke: PaintStroke = {
      id: 'test',
      tool: 'brush',
      points: [[0, 0, 1]],
      color: '#000000',
      opacity: 1,
      size: 8,
      options: {
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true,
        pressureEasing: 'linear',
        pressureCurve: 2.0,
        taperStart: 0,
        taperEnd: 0,
        tiltInfluence: 0.3,
      },
      brushStyle: 'watercolor',
      brushParams: {bleed: 0.6},
      fxState: 'flat',
    };
    expect(stroke.brushStyle).toBe('watercolor');
    expect(stroke.brushParams).toEqual({bleed: 0.6});
    expect(stroke.fxState).toBe('flat');
  });

  it('StrokeFxState type includes flat, fx-applied, flattened', () => {
    // Type-level assertion: all three values assignable to StrokeFxState
    const states: StrokeFxState[] = ['flat', 'fx-applied', 'flattened'];
    expect(states).toHaveLength(3);
    expect(states).toContain('flat');
    expect(states).toContain('fx-applied');
    expect(states).toContain('flattened');
  });

  it('DEFAULT_PAINT_BG_COLOR equals #FFFFFF', () => {
    expect(DEFAULT_PAINT_BG_COLOR).toBe('#FFFFFF');
  });
});
