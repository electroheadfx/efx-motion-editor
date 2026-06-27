import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from '../stores/physicPaintStore';

vi.mock('../stores/paintStore', () => ({
  paintStore: { getFrame: vi.fn(() => null) },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
  },
}));

import { PreviewRenderer } from './previewRenderer';

const root = resolve(__dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');
let offscreenOperations: RecordedCanvasOp[] = [];

type RecordedCanvasOp =
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'drawImage'; source: string; args: number[] }
  | { type: 'createPattern'; source: string; repetition: string | null }
  | { type: 'clearRect' }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'scale' };

class RecordingCanvasContext {
  operations: RecordedCanvasOp[];
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private stateStack: Array<Pick<RecordingCanvasContext, 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'>> = [];

  constructor(operations: RecordedCanvasOp[] = []) {
    this.operations = operations;
  }

  save(): void {
    this.operations.push({ type: 'save' });
    this.stateStack.push({
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  restore(): void {
    this.operations.push({ type: 'restore' });
    const state = this.stateStack.pop();
    if (!state) return;
    this.fillStyle = state.fillStyle;
    this.globalAlpha = state.globalAlpha;
    this.globalCompositeOperation = state.globalCompositeOperation;
  }

  scale(): void {
    this.operations.push({ type: 'scale' });
  }

  clearRect(): void {
    this.operations.push({ type: 'clearRect' });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({
      type: 'fillRect',
      x,
      y,
      w,
      h,
      fillStyle: String(this.fillStyle),
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  drawImage(source?: CanvasImageSource, ...args: number[]): void {
    this.operations.push({ type: 'drawImage', source: source instanceof TestImage ? source.src : source instanceof TestCanvas ? 'canvas' : 'unknown', args });
  }

  createPattern(source: CanvasImageSource, repetition: string | null): CanvasPattern {
    this.operations.push({ type: 'createPattern', source: source instanceof TestImage ? source.src : 'unknown', repetition });
    return `pattern:${source instanceof TestImage ? source.src : 'unknown'}` as unknown as CanvasPattern;
  }
}

class TestCanvas {
  width = 0;
  height = 0;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;

  constructor(private operations: RecordedCanvasOp[]) {}

  getContext(contextId: string): RecordingCanvasContext | null {
    return contextId === '2d' ? new RecordingCanvasContext(this.operations) : null;
  }
}

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  width = 4;
  height = 3;
  private currentSrc = '';

  set src(value: string) {
    this.currentSrc = value;
    this.onload?.();
  }

  get src(): string {
    return this.currentSrc;
  }
}

function makeCanvas(ctx: RecordingCanvasContext): HTMLCanvasElement {
  return {
    width: 4,
    height: 3,
    clientWidth: 4,
    clientHeight: 3,
    offsetWidth: 4,
    offsetHeight: 3,
    getContext: (contextId: string) => contextId === '2d' ? ctx : null,
  } as unknown as HTMLCanvasElement;
}

function makeRotoLayer(): Layer {
  return {
    id: 'roto-layer',
    name: 'Roto',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'roto-layer' },
  };
}

function seedRotoPaper(): void {
  physicPaintStore.setRotoBackgroundMetadata('roto-layer', { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 });
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  offscreenOperations = [];
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? new TestCanvas(offscreenOperations) : {} });
  vi.stubGlobal('Image', TestImage);
  vi.stubGlobal('HTMLImageElement', TestImage);
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
});

afterEach(() => {
  physicPaintStore.reset();
  vi.unstubAllGlobals();
});

describe('PreviewRenderer missing Roto frame source contract', () => {
  it('owns the shared missing-frame resolver and background draw path', () => {
    const source = readSource('src/lib/previewRenderer.ts');

    expect(source).toContain("import {drawMissingRotoBackground, resolveMissingRotoFrameDraw} from './rotoFrameDraw'");
    expect(source).toContain('resolveMissingRotoFrameDrawForLayer(layer, paintLookupFrame)');
    expect(source).toContain('drawMissingRotoBackground(ctx, backgroundDraw, logicalW, logicalH, paperTexture, paperCanvas)');
  });

  it('checks cached real frames before resolving missing transparent or background-only frames', () => {
    const source = readSource('src/lib/previewRenderer.ts');
    const branchStart = source.lastIndexOf("layer.type === 'physic-paint'");
    const physicPaintBranch = source.slice(branchStart, source.indexOf("} else if (layer.type === 'paint')", branchStart));

    expect(physicPaintBranch).toContain('getPhysicPaintFrameForLayer(paintLayerId, paintLookupFrame)');
    expect(physicPaintBranch.indexOf('getPhysicPaintFrameForLayer(paintLayerId, paintLookupFrame)')).toBeLessThan(
      physicPaintBranch.indexOf('resolveMissingRotoFrameDrawForLayer(layer, paintLookupFrame)'),
    );
    expect(physicPaintBranch).toContain("const backgroundDraw = realKeyBackgroundDraw ?? (missingDraw?.kind === 'background-only' ? missingDraw : null)");
    expect(physicPaintBranch).not.toContain('setFrame(');
    expect(physicPaintBranch).not.toContain('upsertRealRotoKeyFrame(');
    expect(physicPaintBranch).not.toContain('replaceGeneratedRotoCache(');
  });

  it('renders the real paper texture for an interior missing Roto frame in the main app renderer', () => {
    seedRotoPaper();
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 1, { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 3, { frameIndex: 0, appFrame: 3, dataUrl: 'data:image/png;base64,cmVhbC0z' });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);
    renderer.renderFrame([makeRotoLayer()], 2, [], 24, true, 1, 2);

    expect(offscreenOperations).toContainEqual(expect.objectContaining({
      type: 'fillRect',
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      fillStyle: '#fff',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    }));
    expect(offscreenOperations).toContainEqual(expect.objectContaining({
      type: 'createPattern',
      source: '/img/paper_1.jpg',
      repetition: 'repeat',
    }));
    expect(ctx.operations).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas', args: [0, 0, 4, 3] }));
    expect(ctx.operations).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'data:image/png;base64,cmVhbC0x' }));
  });

  it('draws paper baseline before transparent real Roto frame pixels in the main app renderer', () => {
    seedRotoPaper();
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 1, { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' });
    const ctx = new RecordingCanvasContext();
    const renderer = new PreviewRenderer(makeCanvas(ctx));

    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);
    renderer.renderFrame([makeRotoLayer()], 1, [], 24, true, 1, 1);

    const paperIndex = ctx.operations.findIndex((op) => op.type === 'drawImage' && op.source === 'canvas');
    const imageIndex = ctx.operations.findIndex((op) => op.type === 'drawImage' && op.source === 'data:image/png;base64,cmVhbC0x');

    expect(paperIndex).toBeGreaterThanOrEqual(0);
    expect(imageIndex).toBeGreaterThanOrEqual(0);
    expect(paperIndex).toBeLessThan(imageIndex);
  });
});
