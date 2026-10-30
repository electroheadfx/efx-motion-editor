import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { toPhysicPaintRotoInterpolationSettingsLegacy } from './physicsPaintRotoKeyController';

const FALLBACK: PhysicPaintRotoInterpolationSettings = {
  enabled: false,
  inBetweenCount: 1,
  mode: 'duplicate',
  deform: 0,
  position: 0,
  rotation: 0,
  scale: 0,
};

// 261030-ey9 Step 2: the legacy mapper reconstructs the settings object from the
// source/display model. Any unrelated interpolation edit went through it, so a
// dropped rotation/scale channel would silently zero the slider on next open.
describe('toPhysicPaintRotoInterpolationSettingsLegacy (261030-ey9)', () => {
  it('keeps rotation and scale when the source model carries them', () => {
    const settings = toPhysicPaintRotoInterpolationSettingsLegacy(
      { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 10, position: 5, rotation: 40, scale: 25 },
      FALLBACK,
    );
    expect(settings).toEqual({ enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 10, position: 5, rotation: 40, scale: 25 });
  });

  it('falls back to the fallback object values when the source model omits them', () => {
    const settings = toPhysicPaintRotoInterpolationSettingsLegacy(
      { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 10, position: 5 },
      { ...FALLBACK, rotation: 33, scale: 66 },
    );
    expect(settings.rotation).toBe(33);
    expect(settings.scale).toBe(66);
  });

  it('leaves both channels absent when neither source nor fallback carries them', () => {
    const settings = toPhysicPaintRotoInterpolationSettingsLegacy(
      { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 10, position: 5 },
      { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 },
    );
    expect('rotation' in settings).toBe(false);
    expect('scale' in settings).toBe(false);
  });
});
