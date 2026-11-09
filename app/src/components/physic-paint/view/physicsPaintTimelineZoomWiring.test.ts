// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  resolveTimelineMetrics,
  TIMELINE_LANE_ORIGIN_PX,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
} from './physicsPaintTimelineZoom';

/**
 * Phase 60 (ZOOM-01..05) read-only wiring pins for the Studio timeline zoom.
 *
 * The pitch authority itself is unit-tested in physicsPaintTimelineZoom.test.ts;
 * this file pins the STRIP seam: one live-metrics read feeding the lane extent,
 * the cells grid, the adaptive ruler and the playhead; the modifier wheel branch
 * ahead of the plain-wheel guards; the mount-effect reset/register/unregister;
 * and the CSS split between scaling width and fixed vertical geometry.
 */

const strip = readFileSync(fileURLToPath(new URL('./PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');
const bar = readFileSync(fileURLToPath(new URL('./PhysicsPaintTimelineZoomBar.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('}', start);
  expect(end, `${selector} rule end`).toBeGreaterThan(start);
  return source.slice(start, end);
}

function wheelHandlerBlock(): string {
  const start = strip.indexOf('const handleTimelineWheel');
  expect(start, 'wheel handler').toBeGreaterThanOrEqual(0);
  const end = strip.indexOf("el.addEventListener('wheel', handleTimelineWheel", start);
  expect(end, 'wheel handler end').toBeGreaterThan(start);
  return strip.slice(start, end);
}

describe('Timeline zoom wiring — mount seam (D-05, D-12)', () => {
  it('resets the session scale and registers the scroll port, unregistering both on cleanup', () => {
    const resetIndex = strip.indexOf('timelineZoom.resetForStudioOpen();');
    const registerIndex = strip.indexOf('registerTimelineZoomScrollPort({');
    const unregisterIndex = strip.indexOf('registerTimelineZoomScrollPort(null)');
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(registerIndex).toBeGreaterThan(resetIndex);
    expect(unregisterIndex).toBeGreaterThan(registerIndex);
    // The reset precedes the registration so no stale scale survives a reopen.
    expect(strip).toContain("import {\n  nextTimelineZoomWheelScale,\n  registerTimelineZoomScrollPort,\n  resolveRulerStep,\n  TIMELINE_LANE_ORIGIN_PX,\n  timelineZoom,\n} from './physicsPaintTimelineZoom';");
  });

  it('supplies every port member from the live scroller, the playhead signal and the live extent', () => {
    expect(strip).toContain('getScrollLeft: () => timelineScrollRef.current?.scrollLeft ?? 0,');
    expect(strip).toContain('getScrollerLeft: () => timelineScrollRef.current?.getBoundingClientRect().left ?? 0,');
    expect(strip).toContain('getClientWidth: () => timelineScrollRef.current?.clientWidth ?? 0,');
    expect(strip).toContain('if (el) el.scrollLeft = value;');
    expect(strip).toContain('getPlayheadFrame: () => currentFrameSignal.peek(),');
    expect(strip).toContain('getFrameCount: () => timelineFrameCountRef.current,');
    // The live extent is refreshed once per render, never captured at mount.
    expect(strip).toContain('timelineFrameCountRef.current = frameCells.length;');
  });
});

describe('Timeline zoom wiring — modifier wheel (ZOOM-01, D-05, D-07)', () => {
  it('branches on metaKey/ctrlKey BEFORE the plain-wheel guards and returns', () => {
    const handler = wheelHandlerBlock();
    const modifier = handler.indexOf('if (event.metaKey || event.ctrlKey) {');
    const shiftGuard = handler.indexOf('if (event.shiftKey) return;');
    expect(modifier).toBeGreaterThanOrEqual(0);
    expect(shiftGuard).toBeGreaterThanOrEqual(0);
    expect(modifier).toBeLessThan(shiftGuard);
    const branch = handler.slice(modifier, shiftGuard);
    expect(branch).toContain('event.preventDefault();');
    expect(branch).toContain('queueTimelineZoom(event);');
    expect(branch).toContain('return;');
    // Still the FIRST guard after the mountedRef check.
    const mountedGuard = handler.indexOf('if (!mountedRef.current) return;');
    expect(mountedGuard).toBeGreaterThanOrEqual(0);
    const afterMountedGuard = handler.indexOf('\n', mountedGuard);
    expect(afterMountedGuard).toBeGreaterThan(mountedGuard);
    expect(handler.slice(afterMountedGuard, modifier)).not.toContain('if (');
  });

  it('leaves the three plain-wheel statements byte-identical and in order', () => {
    const handler = wheelHandlerBlock();
    const shiftGuard = handler.indexOf('if (event.shiftKey) return;');
    const diagonalGuard = handler.indexOf('if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;');
    const write = handler.indexOf('el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1);');
    expect(shiftGuard).toBeGreaterThanOrEqual(0);
    expect(diagonalGuard).toBeGreaterThan(shiftGuard);
    expect(write).toBeGreaterThan(diagonalGuard);
    expect(handler.slice(diagonalGuard, write)).toContain('event.preventDefault();');
  });

  it('coalesces through one animation frame accumulated from the queued target', () => {
    expect(strip).toContain('const wheelZoomRafRef = useRef(0);');
    expect(strip).toContain('pendingWheelZoomRef.current?.scale ?? timelineZoom.scale.peek()');
    expect(strip).toContain('nextTimelineZoomWheelScale(base, event.deltaY, event.deltaMode)');
    expect(strip).toContain('wheelZoomRafRef.current = window.requestAnimationFrame(flushTimelineZoom);');
    expect(strip).toContain('if (wheelZoomRafRef.current !== 0) return;');
    expect(strip).toContain('timelineZoom.setScaleAtCursor(job.scale, job.clientX);');
    expect(strip).toContain('window.cancelAnimationFrame(wheelZoomRafRef.current);');
    expect(strip).toContain('pendingWheelZoomRef.current = null;');
  });
});

describe('Timeline zoom wiring — live geometry (D-09, D-12, D-14)', () => {
  it('reads the metrics ONCE and derives the lane extent, ruler step and tick basis from it', () => {
    expect(strip).toContain('const timelineMetrics = timelineZoom.metrics.value;');
    expect(strip).toContain('const rotoLaneWidthPx = frameCells.length * timelineMetrics.pitch;');
    expect(strip).toContain('const rotoRulerStep = resolveRulerStep(timelineMetrics.pitch);');
    expect(strip).toContain('const rotoRulerTickWidthPx = rotoRulerStep * timelineMetrics.pitch;');
    expect(strip).toContain('flex: `0 0 ${rotoRulerTickWidthPx}px`');
  });

  it('makes the ruler step adaptive and keeps every drawn tick labelled', () => {
    expect(strip).toContain('function buildRulerTicks(frameCells: number[], step: number): number[] {');
    expect(strip).toContain('const resolvedStep = Number.isFinite(step) && step >= RULER_STEP ? step : RULER_STEP;');
    expect(strip).toContain('return frameCells.filter((frame) => frame % resolvedStep === 0);');
    expect(strip).toContain('buildRulerTicks(frameCells, rotoRulerStep), [frameCells, rotoRulerStep]');
    // The minimum step and the base pitch constant survive the conversion.
    expect(strip).toContain('const RULER_STEP = 3;');
    expect(strip).not.toContain('RULER_TICK_WIDTH_PX');
  });

  it('drives the cells grid and both rails from the live pitch, carrying the cell-width variable', () => {
    expect(strip).toContain('gridTemplateColumns: `repeat(${frameCells.length}, ${timelineMetrics.pitch}px)`,' );
    expect(strip).toContain("'--timeline-cell-width': `${timelineMetrics.cellWidth}px`,");
    // Phase 60 (ZOOM-05): exactly five render sites consume the live pitch —
    // both rails, the active motion block and both track rows. The authority
    // audit pins the same count, so a sixth site (or a dropped one) fails both.
    expect(strip.split('framePitch={timelineMetrics.pitch}').length - 1).toBe(5);
    // D-14: no density threshold — every frame cell still renders.
    expect(strip).not.toContain('timelineMetrics.pitch <');
  });

  it('positions the playhead from the live pitch and reproduces the 1x offset exactly', () => {
    const block = strip.slice(strip.indexOf('function PhysicsPaintPlayheadBar'));
    expect(block).toContain('const pitch = timelineZoom.metrics.value.pitch;');
    expect(block).toContain('const left = TIMELINE_LANE_ORIGIN_PX + clampedFrame * pitch + pitch / 2 - 1;');
    // The acceptance figure: frame 10 at 1x sits at 194px (the former 6+10*18+8).
    const pitch = resolveTimelineMetrics(1).pitch;
    expect(TIMELINE_LANE_ORIGIN_PX + 10 * pitch + pitch / 2 - 1).toBe(194);
    // And the range never escapes the module's documented ladder.
    expect(resolveTimelineMetrics(0.25).pitch).toBeLessThan(resolveTimelineMetrics(4).pitch);
    expect(TIMELINE_ZOOM_MIN).toBe(0.25);
    expect(TIMELINE_ZOOM_MAX).toBe(4);
  });

  it('reads the visible frame window in live-pitch frames, not the 1x constant', () => {
    expect(strip).toContain('const pitch = timelineZoom.metrics.peek().pitch;');
    expect(strip).toContain('visStart: el.scrollLeft / pitch,');
    expect(strip).toContain('visEnd: (el.scrollLeft + el.clientWidth) / pitch,');
  });
});

describe('Timeline zoom wiring — header pill (D-01..D-04)', () => {
  it('imports and renders the pill exactly once, after playback and before the live status', () => {
    expect(strip).toContain("import { PhysicsPaintTimelineZoomBar } from './PhysicsPaintTimelineZoomBar';");
    expect(strip.split('<PhysicsPaintTimelineZoomBar />').length - 1).toBe(1);
    const playbackIndex = strip.indexOf('physics-paint-pill--playback');
    const barIndex = strip.indexOf('<PhysicsPaintTimelineZoomBar />');
    const liveStatusIndex = strip.indexOf('<PhysicsPaintWorkflowLiveStatus', barIndex);
    expect(playbackIndex).toBeGreaterThanOrEqual(0);
    expect(barIndex).toBeGreaterThan(playbackIndex);
    expect(liveStatusIndex).toBeGreaterThan(barIndex);
  });

  it('reads only the three display signals in its own body', () => {
    expect(bar).toContain('const percent = timelineZoom.percent.value;');
    expect(bar).toContain('const isAtMin = timelineZoom.isAtMin.value;');
    expect(bar).toContain('const isAtMax = timelineZoom.isAtMax.value;');
    expect(bar).not.toContain('timelineZoom.scale');
    expect(bar).not.toContain('timelineZoom.metrics');
    expect(bar).not.toContain('registerTimelineZoomScrollPort');
  });

  it('binds minus/plus to the end signals and steps the ladder', () => {
    expect(bar).toContain('aria-label="Zoom out"');
    expect(bar).toContain('disabled={isAtMin}');
    expect(bar).toContain('onClick={() => timelineZoom.zoomOut()}');
    expect(bar).toContain('aria-label="Zoom in"');
    expect(bar).toContain('disabled={isAtMax}');
    expect(bar).toContain('onClick={() => timelineZoom.zoomIn()}');
  });

  it('keeps the percent display-only and Fit a one-shot action', () => {
    const percentStart = bar.indexOf('class="physics-paint-canvas-zoom-percent"');
    expect(percentStart).toBeGreaterThanOrEqual(0);
    const percentSpan = bar.slice(percentStart, bar.indexOf('</span>', percentStart));
    expect(percentSpan).toContain('{percent}%');
    expect(percentSpan).not.toContain('onClick');
    const fitStart = bar.indexOf('title="Fit the whole frame range"');
    expect(fitStart).toBeGreaterThanOrEqual(0);
    const fitButton = bar.slice(fitStart, bar.indexOf('</button>', fitStart));
    expect(fitButton).toContain('onClick={() => timelineZoom.fit()}');
    expect(fitButton).not.toContain('aria-pressed');
  });

  it('wears the pill modifier with the navigation treatment', () => {
    expect(bar).toContain('physics-paint-pill physics-paint-pill--timeline-zoom');
    const rule = ruleBody(css, '.physics-paint-pill--timeline-zoom');
    expect(rule).toContain('border-color: #575e66');
    expect(rule).toContain('background: #34383c');
  });
});

describe('Timeline zoom wiring — CSS split (D-12, D-14)', () => {
  it('scales the cell WIDTH through the variable while the height stays fixed', () => {
    const cell = ruleBody(css, '.physics-paint-roto-cell');
    expect(cell).toContain('width: var(--timeline-cell-width, 16px);');
    expect(cell).toContain('height: 22px');
  });

  it('carries no fixed flex basis on the ruler tick', () => {
    const tick = ruleBody(css, '.physics-paint-ruler-tick');
    expect(tick).not.toContain('flex:');
    expect(tick).not.toContain('54px');
    // Positioning stays: the rule survives with its tick mark.
    expect(css).toContain('.physics-paint-ruler-tick::after {');
  });

  it('leaves every vertical value untouched', () => {
    expect(ruleBody(css, '.physics-paint-timeline-scroll')).toContain('padding-left: 6px');
    expect(ruleBody(css, '.physics-paint-ruler')).toContain('height: 36px');
  });

  it('centres the ruler label and tick on the live half-cell, not the 1x 8px', () => {
    for (const selector of ['.physics-paint-ruler-label', '.physics-paint-ruler-tick::after']) {
      expect(ruleBody(css, selector)).toContain('left: calc(var(--timeline-cell-width, 16px) / 2);');
    }
  });

  it('publishes the cell width on the scroller so the ruler inherits the live pitch', () => {
    expect(strip).toContain("'--timeline-cell-width': `${timelineMetrics.cellWidth}px`");
    const scrollerStart = strip.indexOf('class="physics-paint-timeline-scroll"');
    expect(scrollerStart).toBeGreaterThanOrEqual(0);
    const scroller = strip.slice(scrollerStart, strip.indexOf('>', scrollerStart) + 1);
    expect(scroller).toContain("'--timeline-cell-width': `${timelineMetrics.cellWidth}px`");
  });
});
