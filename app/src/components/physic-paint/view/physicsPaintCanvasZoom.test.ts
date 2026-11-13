// @vitest-environment node
import { effect } from '@preact/signals';
import { describe, expect, it } from 'vitest';
import { getContainedCanvasDisplaySize } from '../engine/physicsPaintCanvasSizing';
import {
  PHYSICS_PAINT_ZOOM_BACKING_BUDGET,
  PHYSICS_PAINT_ZOOM_EPSILON,
  PHYSICS_PAINT_ZOOM_MAX,
  PHYSICS_PAINT_ZOOM_PRESETS,
  clampZoomScale,
  nextScalePreset,
  physicsPaintCanvasZoom,
  resolveCursorAnchoredPan,
  resolveDisplaySize,
  resolveFitScale,
  resolveMaxScale,
  resolveMinScale,
  resolveZoomPercent,
} from './physicsPaintCanvasZoom';

/**
 * 261104-uyv: the Studio canvas zoom surface's pure math + signals store.
 *
 * The window geometry is deliberately in DISPLAY (CSS) pixels: the engine
 * working size never changes, the shell grows by real CSS size, and every
 * bounds-anchored overlay is measured from client rects — so the pan is a
 * translate on an ancestor layer, never a scale transform (a scale would
 * double-scale every client-rect-derived mapping).
 */

function resetStore(workWidth: number, workHeight: number, containerWidth: number, containerHeight: number): void {
  physicsPaintCanvasZoom.setWorkSize(workWidth, workHeight);
  physicsPaintCanvasZoom.setContainerSize(containerWidth, containerHeight);
  physicsPaintCanvasZoom.resetForStudioOpen();
}

describe('physicsPaintCanvasZoom — fit / max / min resolution', () => {
  it('keeps Fit byte-identical to the sizing authority (getContainedCanvasDisplaySize)', () => {
    for (const [cw, ch, ww, wh] of [
      [800, 700, 1080, 1920],
      [1200, 500, 1000, 650],
      [400, 900, 512, 512],
    ]) {
      const contained = getContainedCanvasDisplaySize(cw, ch, ww, wh);
      expect(contained).not.toBeNull();
      expect(resolveFitScale(cw, ch, ww, wh)).toBeCloseTo((contained as { width: number }).width / ww, 9);
    }
    // The typical Studio region for a 1080x1920 sheet reads ~36%.
    expect(resolveZoomPercent(resolveFitScale(800, 700, 1080, 1920))).toBe(36);
    // Unmeasurable inputs resolve to 0, never NaN/Infinity.
    expect(resolveFitScale(0, 700, 1080, 1920)).toBe(0);
    expect(resolveFitScale(800, 700, 0, 0)).toBe(0);
  });

  it('bounds the max scale by the backing-pixel budget while always admitting 1:1', () => {
    // 1:1 must be reachable for EVERY reachable working size (long edge 1920).
    expect(resolveMaxScale(1920, 1920)).toBeGreaterThanOrEqual(1);
    expect(resolveMaxScale(1080, 1920)).toBeGreaterThanOrEqual(1);
    expect(resolveMaxScale(1080, 1920)).toBeLessThanOrEqual(PHYSICS_PAINT_ZOOM_MAX);
    // A small sheet reaches the 4x preset-ladder top (500x500 at DPR 2 is
    // exactly the 16 MP budget: 500*4*2 squared = 16,000,000).
    expect(resolveMaxScale(500, 500)).toBe(PHYSICS_PAINT_ZOOM_MAX);
    // 512x512 sits just above the budget for a flat 4x (3.9065x), so the 4x
    // preset is unreachable there — the budget, not the ladder, is the law.
    expect(resolveMaxScale(512, 512)).toBeCloseTo(3.9065, 3);
    expect(resolveMaxScale(512, 512)).toBeLessThanOrEqual(PHYSICS_PAINT_ZOOM_MAX);
    // The budget itself is the watercolor engine's WebGL backing bound: CSS
    // box x devicePixelRatio (capped at 2) squared.
    expect(PHYSICS_PAINT_ZOOM_BACKING_BUDGET).toBe(16_000_000);
    // Non-positive work sizes are defensively clamped to the ladder top.
    expect(resolveMaxScale(0, 0)).toBe(PHYSICS_PAINT_ZOOM_MAX);
  });

  it('floors the minimum at the ladder bottom so Fit is never the floor', () => {
    // A 36% fit zooms out to the 10% ladder bottom.
    expect(resolveMinScale(0.3646)).toBeCloseTo(0.1, 9);
    expect(resolveMinScale(1)).toBeCloseTo(0.1, 9);
    expect(resolveMinScale(1.4)).toBeCloseTo(0.1, 9);
    // A fit below the ladder bottom keeps Fit reachable as the floor.
    expect(resolveMinScale(0.05)).toBeCloseTo(0.05, 9);
    // unmeasured fit resolves to 0
    expect(resolveMinScale(0)).toBe(0);
  });

  it('clamps scales into the allowed range', () => {
    expect(clampZoomScale(0.01, 0.36, 2)).toBe(0.36);
    expect(clampZoomScale(9, 0.36, 2)).toBe(2);
    expect(clampZoomScale(1, 0.36, 2)).toBe(1);
    expect(clampZoomScale(Number.NaN, 0.36, 2)).toBe(0.36);
  });
});

describe('physicsPaintCanvasZoom — preset stepping', () => {
  it('ladder matches the main editor presets', () => {
    expect(PHYSICS_PAINT_ZOOM_PRESETS).toEqual([0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);
    expect(PHYSICS_PAINT_ZOOM_EPSILON).toBe(0.001);
  });

  it('steps to the first preset beyond the current scale, clamped into range', () => {
    const min = 0.3646;
    const max = 4;
    expect(nextScalePreset(0.3646, 1, min, max)).toBe(0.5);
    // At the fit min, stepping down clamps back onto the min (a no-op value).
    expect(nextScalePreset(0.3646, -1, min, max)).toBeCloseTo(min, 9);
    expect(nextScalePreset(1, 1, min, max)).toBe(1.5);
    expect(nextScalePreset(1, -1, min, max)).toBe(0.75);
    expect(nextScalePreset(0.5, -1, min, max)).toBeCloseTo(min, 9);
    // The boundary is a no-op, never an overshoot.
    expect(nextScalePreset(4, 1, min, max)).toBe(4);
    expect(nextScalePreset(max, 1, min, max)).toBe(max);
  });

  it('drives the store buttons from the CURRENT effective scale', () => {
    resetStore(1080, 1920, 800, 700);
    expect(physicsPaintCanvasZoom.isFit.value).toBe(true);
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBeCloseTo(0.3646, 3);

    physicsPaintCanvasZoom.zoomIn();
    expect(physicsPaintCanvasZoom.mode.value).toBe('absolute');
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(0.5);
    expect(physicsPaintCanvasZoom.zoomPercent.value).toBe(50);

    // Fit is not the floor: 0.5 -> 0.25 -> 0.1 (the ladder bottom).
    physicsPaintCanvasZoom.zoomOut();
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(0.25);
    expect(physicsPaintCanvasZoom.isAtMin.value).toBe(false);
    physicsPaintCanvasZoom.zoomOut();
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(0.1);
    expect(physicsPaintCanvasZoom.isAtMin.value).toBe(true);
    // At the floor, another step is a no-op.
    physicsPaintCanvasZoom.zoomOut();
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(0.1);

    // A small sheet reaches the whole ladder (max 4), unlike 1080x1920 whose
    // backing budget caps the max at ~1.389.
    physicsPaintCanvasZoom.setWorkSize(500, 500);
    physicsPaintCanvasZoom.setContainerSize(800, 700);
    physicsPaintCanvasZoom.resetForStudioOpen();
    physicsPaintCanvasZoom.setZoomAtCursor(1, 0, 0);
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(1);
    physicsPaintCanvasZoom.zoomIn();
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(1.5);
    physicsPaintCanvasZoom.zoomOut();
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(1);
  });
});

describe('physicsPaintCanvasZoom — 1:1 and display size', () => {
  it('actualSize yields scale 1 and 100%, one working pixel per CSS pixel', () => {
    resetStore(1080, 1920, 800, 700);
    physicsPaintCanvasZoom.actualSize();
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(1);
    expect(physicsPaintCanvasZoom.zoomPercent.value).toBe(100);
    expect(physicsPaintCanvasZoom.displayWidth.value).toBe(1080);
    expect(physicsPaintCanvasZoom.displayHeight.value).toBe(1920);
    expect(physicsPaintCanvasZoom.isActualSize.value).toBe(true);
    expect(physicsPaintCanvasZoom.isFit.value).toBe(false);
  });

  it('reports the working-to-CSS ratio as an integer percent', () => {
    expect(resolveZoomPercent(1)).toBe(100);
    expect(resolveZoomPercent(0.36458)).toBe(36);
    expect(resolveZoomPercent(0)).toBe(0);
  });

  it('resolves the display box from the working size and scale', () => {
    expect(resolveDisplaySize(1080, 1920, 1)).toEqual({ width: 1080, height: 1920 });
    expect(resolveDisplaySize(1080, 1920, 0.5)).toEqual({ width: 540, height: 960 });
    expect(resolveDisplaySize(1080, 1920, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('physicsPaintCanvasZoom — free pan', () => {
  it('keeps any finite pan at Fit: the sheet can be pushed fully off-screen', () => {
    resetStore(1080, 1920, 800, 700);
    expect(physicsPaintCanvasZoom.hasOverflow.value).toBe(false);
    physicsPaintCanvasZoom.setPan(5000, -5000);
    expect(physicsPaintCanvasZoom.panX.value).toBe(5000);
    expect(physicsPaintCanvasZoom.panY.value).toBe(-5000);
  });

  it('keeps any finite pan at 1:1, past the old half-overflow', () => {
    resetStore(1080, 1920, 800, 700);
    physicsPaintCanvasZoom.actualSize();
    expect(physicsPaintCanvasZoom.hasOverflow.value).toBe(true);
    physicsPaintCanvasZoom.setPan(9999, -9999);
    expect(physicsPaintCanvasZoom.panX.value).toBe(9999);
    expect(physicsPaintCanvasZoom.panY.value).toBe(-9999);
  });

  it('sanitizes a non-finite pan to zero and normalizes -0', () => {
    resetStore(1080, 1920, 800, 700);
    physicsPaintCanvasZoom.setPan(Number.NaN, Number.POSITIVE_INFINITY);
    expect(physicsPaintCanvasZoom.panX.value).toBe(0);
    expect(physicsPaintCanvasZoom.panY.value).toBe(0);
    physicsPaintCanvasZoom.setPan(-0, 0);
    expect(Object.is(physicsPaintCanvasZoom.panX.value, 0)).toBe(true);
    expect(Object.is(physicsPaintCanvasZoom.panY.value, 0)).toBe(true);
  });
});

describe('physicsPaintCanvasZoom — cursor-anchored zoom', () => {
  it('keeps the sheet point under the cursor fixed', () => {
    // Display 1200x900 inside 1000x800 (both axes overflow so anchoring is not
    // clamped away), cursor 100px right / 50px up of the container center.
    physicsPaintCanvasZoom.setWorkSize(800, 600);
    physicsPaintCanvasZoom.setContainerSize(1000, 800);
    physicsPaintCanvasZoom.resetForStudioOpen();
    physicsPaintCanvasZoom.actualSize();
    physicsPaintCanvasZoom.setZoomAtCursor(1.5, 0, 0);
    expect(physicsPaintCanvasZoom.displayWidth.value).toBe(1200);
    expect(physicsPaintCanvasZoom.displayHeight.value).toBe(900);
    expect(physicsPaintCanvasZoom.panX.value).toBe(0);
    expect(physicsPaintCanvasZoom.panY.value).toBe(0);

    const beforeX = (100 + 1200 / 2 - physicsPaintCanvasZoom.panX.value) / 1200;
    const beforeY = (-50 + 900 / 2 - physicsPaintCanvasZoom.panY.value) / 900;
    physicsPaintCanvasZoom.setZoomAtCursor(2.25, 100, -50);
    expect(physicsPaintCanvasZoom.displayWidth.value).toBe(1800);
    expect(physicsPaintCanvasZoom.displayHeight.value).toBe(1350);
    const afterX = (100 + 1800 / 2 - physicsPaintCanvasZoom.panX.value) / 1800;
    const afterY = (-50 + 1350 / 2 - physicsPaintCanvasZoom.panY.value) / 1350;
    expect(afterX).toBeCloseTo(beforeX, 6);
    expect(afterY).toBeCloseTo(beforeY, 6);
  });

  it('resolves the anchored pan from the current display box (pure helper)', () => {
    expect(
      resolveCursorAnchoredPan({
        displayWidth: 1200,
        displayHeight: 900,
        panX: 0,
        panY: 0,
        nextDisplayWidth: 1800,
        nextDisplayHeight: 1350,
        cursorX: 100,
        cursorY: -50,
      }),
    ).toEqual({ x: -50, y: 25 });
  });

  it('returns the exact anchored pan and is a no-op before measurement', () => {
    expect(
      resolveCursorAnchoredPan({
        displayWidth: 400,
        displayHeight: 600,
        panX: 0,
        panY: 0,
        nextDisplayWidth: 600,
        nextDisplayHeight: 900,
        cursorX: 100,
        cursorY: -50,
      }),
    ).toEqual({ x: -50, y: 25 });

    physicsPaintCanvasZoom.setWorkSize(0, 0);
    physicsPaintCanvasZoom.setContainerSize(0, 0);
    physicsPaintCanvasZoom.setZoomAtCursor(2, 10, 10);
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(0);
  });
});

describe('physicsPaintCanvasZoom — resize behaviour', () => {
  it('tracks the container while in fit mode and keeps pan centered', () => {
    resetStore(1080, 1920, 800, 700);
    const fitScale = physicsPaintCanvasZoom.effectiveScale.value;
    physicsPaintCanvasZoom.setContainerSize(400, 350);
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBeCloseTo(fitScale / 2, 6);
    expect(physicsPaintCanvasZoom.panX.value).toBe(0);
    expect(physicsPaintCanvasZoom.panY.value).toBe(0);
    expect(physicsPaintCanvasZoom.isFit.value).toBe(true);
  });

  it('keeps the absolute scale and the pan on resize', () => {
    physicsPaintCanvasZoom.setWorkSize(1080, 1920);
    physicsPaintCanvasZoom.setContainerSize(800, 700);
    physicsPaintCanvasZoom.resetForStudioOpen();
    physicsPaintCanvasZoom.actualSize();
    physicsPaintCanvasZoom.setPan(140, 610);
    expect(physicsPaintCanvasZoom.panX.value).toBe(140);
    expect(physicsPaintCanvasZoom.panY.value).toBe(610);

    physicsPaintCanvasZoom.setContainerSize(1200, 1000);
    expect(physicsPaintCanvasZoom.effectiveScale.value).toBe(1);
    expect(physicsPaintCanvasZoom.panX.value).toBe(140);
    expect(physicsPaintCanvasZoom.panY.value).toBe(610);
  });
});

describe('physicsPaintCanvasZoom — reset and idempotence', () => {
  it('resetForStudioOpen restores the opening fit view without clearing measured sizes', () => {
    resetStore(1080, 1920, 800, 700);
    physicsPaintCanvasZoom.actualSize();
    physicsPaintCanvasZoom.setZoomAtCursor(2, 120, 60);
    physicsPaintCanvasZoom.resetForStudioOpen();
    expect(physicsPaintCanvasZoom.mode.value).toBe('fit');
    expect(physicsPaintCanvasZoom.absoluteScale.value).toBe(1);
    expect(physicsPaintCanvasZoom.panX.value).toBe(0);
    expect(physicsPaintCanvasZoom.panY.value).toBe(0);
    expect(physicsPaintCanvasZoom.containerWidth.value).toBe(800);
    expect(physicsPaintCanvasZoom.workWidth.value).toBe(1080);
    expect(physicsPaintCanvasZoom.isFit.value).toBe(true);
  });

  it('repeated identical writes notify zero additional times', async () => {
    resetStore(1080, 1920, 800, 700);

    let containerRuns = 0;
    let panRuns = 0;
    let workRuns = 0;
    const stopContainer = effect(() => {
      void physicsPaintCanvasZoom.containerWidth.value;
      containerRuns += 1;
    });
    const stopPan = effect(() => {
      void physicsPaintCanvasZoom.panX.value;
      panRuns += 1;
    });
    const stopWork = effect(() => {
      void physicsPaintCanvasZoom.workWidth.value;
      workRuns += 1;
    });
    const containerBase = containerRuns;
    const panBase = panRuns;
    const workBase = workRuns;

    physicsPaintCanvasZoom.setContainerSize(800, 700);
    physicsPaintCanvasZoom.setContainerSize(800, 700);
    physicsPaintCanvasZoom.setPan(0, 0);
    physicsPaintCanvasZoom.setWorkSize(1080, 1920);
    await Promise.resolve();
    await Promise.resolve();
    expect(containerRuns).toBe(containerBase);
    expect(panRuns).toBe(panBase);
    expect(workRuns).toBe(workBase);

    // A real change still notifies exactly once per value.
    physicsPaintCanvasZoom.setContainerSize(801, 700);
    await Promise.resolve();
    await Promise.resolve();
    expect(containerRuns).toBe(containerBase + 1);

    stopContainer();
    stopPan();
    stopWork();
  });
});
