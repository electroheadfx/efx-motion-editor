// @vitest-environment node
import {effect} from '@preact/signals';
import {beforeEach, describe, expect, it} from 'vitest';
import {canvasStore} from './canvasStore';
import {projectStore} from './projectStore';

/**
 * 261113-o26: the main editor's free-pan law.
 *
 * The canvas pans without a bound at Fit, at 1:1 and at every zoom between, so
 * it can be pushed entirely off-screen; Fit is the recovery. A non-finite
 * value never reaches a pan signal, and every write is compare-then-write.
 */

describe('canvasStore — free pan', () => {
  beforeEach(() => {
    canvasStore.reset();
    projectStore.setResolution(1920, 1080);
    canvasStore.updateContainerSize(800, 600);
    canvasStore.fitToWindow();
  });

  it('keeps any finite pan at Fit: the canvas can be pushed off-screen', () => {
    // 1920x1080 in 800x600 fits at 5/12.
    expect(canvasStore.zoom.value).toBeCloseTo(5 / 12, 9);
    canvasStore.setPan(5000, -5000);
    expect(canvasStore.panX.value).toBe(5000);
    expect(canvasStore.panY.value).toBe(-5000);
  });

  it('keeps any finite pan when zoomed in, past the old half-overflow', () => {
    canvasStore.setSmoothZoom(2);
    expect(canvasStore.zoom.value).toBe(2);
    canvasStore.setPan(9999, -9999);
    expect(canvasStore.panX.value).toBe(9999);
    expect(canvasStore.panY.value).toBe(-9999);
  });

  it('sanitizes a non-finite pan to zero and normalizes -0', () => {
    canvasStore.setPan(Number.NaN, Number.POSITIVE_INFINITY);
    expect(canvasStore.panX.value).toBe(0);
    expect(canvasStore.panY.value).toBe(0);
    canvasStore.setPan(-0, 0);
    expect(Object.is(canvasStore.panX.value, 0)).toBe(true);
    expect(Object.is(canvasStore.panY.value, 0)).toBe(true);
  });

  it('Fit restores the pan to (0, 0) and keeps the fit lock', () => {
    canvasStore.setPan(5000, -5000);
    canvasStore.fitToWindow();
    expect(canvasStore.panX.value).toBe(0);
    expect(canvasStore.panY.value).toBe(0);
    expect(canvasStore.fitLocked.value).toBe(true);
  });

  it('a zoom step keeps the pan', () => {
    canvasStore.setPan(500, -400);
    expect(canvasStore.panX.value).toBe(500);
    canvasStore.zoomIn();
    expect(canvasStore.zoom.value).toBe(0.5);
    expect(canvasStore.panX.value).toBe(500);
    expect(canvasStore.panY.value).toBe(-400);
  });

  it('a repeated identical pan write notifies zero additional times', async () => {
    canvasStore.setPan(120, -80);
    let runs = 0;
    const stop = effect(() => {
      void canvasStore.panX.value;
      runs += 1;
    });
    const base = runs;
    canvasStore.setPan(120, -80);
    canvasStore.setPan(120, -80);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(base);
    stop();
  });
});
