import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 261010-ht0 F3 — export fade law must match preview: every curve is applied
 * via setValueCurveAtTime of the sampled fadeCurves array. No linear-ramp
 * stand-in for logarithmic (or any other curve).
 */

const readSource = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('audioExportMixer — sampled setValueCurveAtTime ramps (F3)', () => {
  const source = readSource('./audioExportMixer.ts');

  it('imports the shared fadeCurves law (no private shape table)', () => {
    expect(source).toContain("from './fadeCurves'");
    expect(source).toContain('sampleFadeCurve');
  });

  it('schedules setValueCurveAtTime for the fade-out ramp', () => {
    expect(source).toContain('setValueCurveAtTime');
    expect(source).toContain("sampleFadeCurve(curve, 'out'");
  });

  it('schedules setValueCurveAtTime for the fade-in ramp', () => {
    expect(source).toContain("sampleFadeCurve(track.fadeInCurve, 'in'");
  });

  it('keeps no linearRampToValueAtTime stand-in', () => {
    expect(source).not.toContain('linearRampToValueAtTime');
    expect(source).not.toContain('exponentialRampToValueAtTime');
  });

  it('fade-out targets the 0.001 floor constant from fadeCurves', () => {
    expect(source).toContain('FADE_OUT_FLOOR');
    expect(source).not.toMatch(/applyRamp\(\s*gain,\s*0\.001/);
  });
});
