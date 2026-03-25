import {describe, it, expect} from 'vitest';

describe('BrushStyle type system', () => {
  it.todo('BrushStyle union includes all 6 styles: flat, watercolor, ink, charcoal, pencil, marker');
  it.todo('BRUSH_STYLES array contains all 6 styles in correct order');
  it.todo('BrushFxParams interface has 5 optional numeric fields: grain, bleed, scatter, fieldStrength, edgeDarken');
  it.todo('DEFAULT_BRUSH_FX_PARAMS has entry for each BrushStyle');
  it.todo('DEFAULT_BRUSH_FX_PARAMS flat has empty object (no FX params)');
  it.todo('DEFAULT_BRUSH_FX_PARAMS watercolor has bleed, grain, fieldStrength');
  it.todo('BRUSH_FX_VISIBLE_PARAMS flat has empty array');
  it.todo('BRUSH_FX_VISIBLE_PARAMS watercolor includes bleed, grain, fieldStrength');
  it.todo('BRUSH_FX_VISIBLE_PARAMS ink includes edgeDarken, fieldStrength');
  it.todo('PaintStroke interface accepts optional brushStyle and brushParams fields');
});
