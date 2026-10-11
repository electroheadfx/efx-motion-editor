/**
 * Theme-hex expansion regression (commit 6f60951f, ACC-03 / D-06 smoke).
 *
 * Prod CSS minify rewrites #3366EE → #36e. The renderer appends 2-digit alpha
 * suffixes to theme colors for canvas fillStyle ('40' on the physic-paint rail
 * bar, '4D' when hidden, '80' on the bar border). Appending an alpha byte to a
 * 3-digit hex yields an invalid fillStyle (e.g. "#36e40") and the rail falls
 * back to grey on the packaged build.
 *
 * expandHex / withAlpha / readCssColor are module-private, so these tests drive
 * the public rendering surface: a recording 2D context + stubbed CSS-variable
 * reads (node vitest environment — no jsdom, no config changes).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FxTrackLayout } from '../../types/timeline';

vi.mock('../../lib/previewRenderer', () => ({
  createCanvasGradient: vi.fn(),
}));

interface Harness {
  canvas: HTMLCanvasElement;
  fills: string[];
  strokes: string[];
}

/** Minimal recording 2D context + fake canvas: captures every fillStyle/strokeStyle assignment. */
function makeHarness(): Harness {
  const fills: string[] = [];
  const strokes: string[] = [];
  const noop = () => undefined;
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    createPattern: () => null,
    clearRect: noop,
    save: noop,
    restore: noop,
    scale: noop,
    setTransform: noop,
    translate: noop,
    beginPath: noop,
    rect: noop,
    clip: noop,
    fillRect: noop,
    strokeRect: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arc: noop,
    roundRect: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    strokeText: noop,
    drawImage: noop,
    setLineDash: noop,
    quadraticCurveTo: noop,
  };
  let fill = '';
  let stroke = '';
  Object.defineProperty(target, 'fillStyle', {
    get: () => fill,
    set: (value: unknown) => {
      fill = String(value);
      fills.push(fill);
    },
  });
  Object.defineProperty(target, 'strokeStyle', {
    get: () => stroke,
    set: (value: unknown) => {
      stroke = String(value);
      strokes.push(stroke);
    },
  });
  const ctx = target as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({
      width: 800,
      height: 240,
      top: 0,
      left: 0,
      right: 800,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLCanvasElement;
  (target as Record<string, unknown>).canvas = canvas;
  return { canvas, fills, strokes };
}

/** Stub the node-env globals getThemeColors touches: getComputedStyle + document + window. */
function stubTheme(vars: Record<string, string>) {
  const getComputedStyle = vi.fn(() => ({
    getPropertyValue: (name: string) => vars[name] ?? '',
  }));
  vi.stubGlobal('getComputedStyle', getComputedStyle);
  vi.stubGlobal('document', { documentElement: {} });
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  return getComputedStyle;
}

/** Minimal DrawState: empty content tracks, no audio, optional FX rail. */
function drawState(fxTracks: FxTrackLayout[]) {
  return {
    frame: 0,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    tracks: [],
    fxTracks,
    imageStore: undefined as never,
    totalFrames: 30,
  };
}

/** The D-06 rail: physic-paint FX row whose color resolves through --color-accent. */
function physicPaintRail(visible: boolean): FxTrackLayout {
  return {
    sequenceId: 'fx-pp',
    sequenceName: 'Physic Paint',
    headerLabel: 'Physic Paint',
    kind: 'fx',
    inFrame: 0,
    outFrame: 10,
    color: 'var(--color-accent)',
    visible,
    layerType: 'physic-paint',
  };
}

/** Canvas-valid hex lengths: #RGB, #RGBA, #RRGGBB, #RRGGBBAA. "#36e40" (5 digits) is invalid. */
function assertValidHexColors(values: string[]) {
  const hexValues = values.filter((v) => v.startsWith('#'));
  expect(hexValues.length).toBeGreaterThan(0);
  for (const value of hexValues) {
    expect([4, 5, 7, 9], `invalid canvas hex color: ${value}`).toContain(value.length);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('theme hex expansion at the canvas color boundary (6f60951f, ACC-03 D-06)', () => {
  it('expands a minified 3-digit accent before appending the rail alpha suffix (D-06 exact defect)', async () => {
    stubTheme({ '--color-accent': '#36e' });
    const { TimelineRenderer, invalidateColorCache } = await import('./TimelineRenderer');
    invalidateColorCache();

    const harness = makeHarness();
    const renderer = new TimelineRenderer(harness.canvas);
    renderer.draw(drawState([physicPaintRail(true)]));

    // Bar fill: expanded 6-digit + '40' — never "#36e40".
    expect(harness.fills).toContain('#3366ee40');
    // Bar border: expanded 6-digit + '80'.
    expect(harness.strokes).toContain('#3366ee80');
    // Header dot / edge handles use the bare expanded accent.
    expect(harness.fills).toContain('#3366ee');
    // The pre-fix defect value must never be produced.
    expect(harness.fills).not.toContain('#36e40');
    expect(harness.fills).not.toContain('#36e');
    assertValidHexColors([...harness.fills, ...harness.strokes]);
  });

  it('expands the accent before the hidden-rail alpha suffixes too', async () => {
    stubTheme({ '--color-accent': '#36e' });
    const { TimelineRenderer, invalidateColorCache } = await import('./TimelineRenderer');
    invalidateColorCache();

    const harness = makeHarness();
    const renderer = new TimelineRenderer(harness.canvas);
    renderer.draw(drawState([physicPaintRail(false)]));

    // Hidden rail: header text color suffix '4D', bar fill '26', border '40'.
    expect(harness.fills).toContain('#3366ee4D');
    expect(harness.fills).toContain('#3366ee26');
    expect(harness.strokes).toContain('#3366ee40');
    expect(harness.fills).not.toContain('#36e4D');
    expect(harness.fills).not.toContain('#36e26');
    assertValidHexColors([...harness.fills, ...harness.strokes]);
  });

  it('reads and expands CSS variables once at the cache boundary, not per draw', async () => {
    const getComputedStyle = stubTheme({ '--color-timeline-track-bg': '#36e' });
    const { TimelineRenderer, invalidateColorCache } = await import('./TimelineRenderer');
    invalidateColorCache();

    const harness = makeHarness();
    const renderer = new TimelineRenderer(harness.canvas);
    const state = drawState([]);
    renderer.draw(state);
    renderer.draw(state);

    // drawLinearTrack paints colors.trackBg on every draw.
    expect(harness.fills).toContain('#3366ee');
    expect(harness.fills).not.toContain('#36e');
    // The CSS-variable read happens once: the second draw hits the cache.
    expect(getComputedStyle).toHaveBeenCalledTimes(1);
    assertValidHexColors([...harness.fills, ...harness.strokes]);
  });

  it('expands a minified 4-digit #RGBA theme value to its 8-digit form', async () => {
    stubTheme({ '--color-timeline-track-bg': '#36ef' });
    const { TimelineRenderer, invalidateColorCache } = await import('./TimelineRenderer');
    invalidateColorCache();

    const harness = makeHarness();
    const renderer = new TimelineRenderer(harness.canvas);
    renderer.draw(drawState([]));

    expect(harness.fills).toContain('#3366eeff');
    expect(harness.fills).not.toContain('#36ef');
    assertValidHexColors([...harness.fills, ...harness.strokes]);
  });
});
