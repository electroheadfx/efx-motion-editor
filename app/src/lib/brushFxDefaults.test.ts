import {describe, it, expect} from 'vitest';
import {
  BRUSH_STYLES,
  DEFAULT_BRUSH_FX_PARAMS,
  BRUSH_FX_VISIBLE_PARAMS,
  type BrushFxParams,
} from '../types/paint';

const ALL_PARAM_KEYS: (keyof BrushFxParams)[] = ['grain', 'bleed', 'scatter', 'fieldStrength', 'edgeDarken'];

describe('Brush FX defaults', () => {
  it('each style in DEFAULT_BRUSH_FX_PARAMS has only its relevant params set', () => {
    // flat and marker should have no params
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS['flat'])).toHaveLength(0);
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS['marker'])).toHaveLength(0);

    // watercolor: bleed, grain, fieldStrength (3 keys)
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS['watercolor']).sort()).toEqual(
      ['bleed', 'fieldStrength', 'grain'].sort(),
    );

    // ink: edgeDarken, fieldStrength (2 keys)
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS['ink']).sort()).toEqual(
      ['edgeDarken', 'fieldStrength'].sort(),
    );

    // charcoal: grain, scatter (2 keys)
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS['charcoal']).sort()).toEqual(
      ['grain', 'scatter'].sort(),
    );

    // pencil: grain (1 key)
    expect(Object.keys(DEFAULT_BRUSH_FX_PARAMS['pencil'])).toEqual(['grain']);
  });

  it('all param values are in 0-1 range', () => {
    for (const style of BRUSH_STYLES) {
      const params = DEFAULT_BRUSH_FX_PARAMS[style];
      for (const key of ALL_PARAM_KEYS) {
        const val = params[key];
        if (val !== undefined) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('BRUSH_FX_VISIBLE_PARAMS keys match BRUSH_STYLES', () => {
    const visibleKeys = Object.keys(BRUSH_FX_VISIBLE_PARAMS).sort();
    const styleKeys = [...BRUSH_STYLES].sort();
    expect(visibleKeys).toEqual(styleKeys);
  });

  it('visible params for each style are valid BrushFxParams keys', () => {
    for (const style of BRUSH_STYLES) {
      const visibleParams = BRUSH_FX_VISIBLE_PARAMS[style];
      for (const param of visibleParams) {
        expect(ALL_PARAM_KEYS).toContain(param);
      }
    }
  });

  it('flat and marker have no visible params', () => {
    expect(BRUSH_FX_VISIBLE_PARAMS['flat']).toEqual([]);
    expect(BRUSH_FX_VISIBLE_PARAMS['marker']).toEqual([]);
  });

  it('charcoal visible params include grain and scatter', () => {
    expect(BRUSH_FX_VISIBLE_PARAMS['charcoal']).toContain('grain');
    expect(BRUSH_FX_VISIBLE_PARAMS['charcoal']).toContain('scatter');
  });

  it('pencil visible params include grain', () => {
    expect(BRUSH_FX_VISIBLE_PARAMS['pencil']).toContain('grain');
  });
});
