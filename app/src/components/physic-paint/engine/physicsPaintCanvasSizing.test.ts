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
});
