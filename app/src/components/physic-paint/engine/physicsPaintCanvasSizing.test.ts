import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT,
  DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH,
  PHYSICS_PAINT_WORKING_LONG_EDGE,
  getPhysicsPaintWorkingSize,
} from './physicsPaintCanvasSizing';

describe('physicsPaintCanvasSizing', () => {
  it('52.1-06 (D-15): raises the working cap to 1920 — a 1920×1080 project is no longer downscaled', () => {
    expect(getPhysicsPaintWorkingSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it('52.1-06 (D-15): still downscales 2K/4K to the 1920 long edge (2K/4K not yet activated)', () => {
    expect(getPhysicsPaintWorkingSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  it('52.1-06 (D-16): the cap is a single constant — the downscale threshold is exactly PHYSICS_PAINT_WORKING_LONG_EDGE', () => {
    expect(PHYSICS_PAINT_WORKING_LONG_EDGE).toBe(1920);
    // At the cap: no downscale.
    expect(getPhysicsPaintWorkingSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    // Just past the cap: downscaled to the long edge.
    expect(getPhysicsPaintWorkingSize(1921, 1080).width).toBe(1920);
  });

  it('keeps the degenerate-size fallback defaults', () => {
    expect(getPhysicsPaintWorkingSize(0, 0)).toEqual({
      width: DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH,
      height: DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT,
    });
  });

  it('260918-ovi: 1080x1920 vertical is identity (cap is long-edge, orientation-agnostic)', () => {
    expect(getPhysicsPaintWorkingSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
  });

  it('260918-ovi: 1080x1350 portrait and 1080x1080 square are identity', () => {
    expect(getPhysicsPaintWorkingSize(1080, 1350)).toEqual({ width: 1080, height: 1350 });
    expect(getPhysicsPaintWorkingSize(1080, 1080)).toEqual({ width: 1080, height: 1080 });
  });

  it('260918-ovi: 1081x1921 downscales to the 1920 long edge', () => {
    const result = getPhysicsPaintWorkingSize(1081, 1921);
    expect(Math.max(result.width, result.height)).toBe(1920);
    expect(result.width).toBe(Math.round(1081 * (1920 / 1921)));
  });
});
