import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { physicPaintStore } from '../stores/physicPaintStore';
import { resolveMissingRotoFrameDraw } from './rotoFrameDraw';

const root = resolve(__dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('physics paint cache-first preview/export contract', () => {
  it('uses cached physics paint frame lookup and subscribes to physics paint mutations in previewRenderer', () => {
    const source = readSource('src/lib/previewRenderer.ts');

    expect(source).toContain('void physicPaintVersion.value');
    expect(source).toContain('getPhysicPaintFrameForLayer(paintLayerId, paintLookupFrame)');
    expect(source).toContain('physicPaintStore.getRotoFrame(layerId, frame)');
    expect(source).toContain('resolveMissingRotoFrameDrawForLayer(layer, paintLookupFrame)');
    expect(source).toContain('physicPaintStore.getRealRotoKeyFrames(paintLayerId)');
    expect(source).toContain('drawMissingRotoBackground(ctx, backgroundDraw, logicalW, logicalH, paperTexture, paperCanvas)');
    expect(source).not.toMatch(/renderFromStrokes/);
  });

  it('keeps export delegated through PreviewRenderer without importing missing-frame or physics paint rendering', () => {
    const source = readSource('src/lib/exportRenderer.ts');

    expect(source).toContain('renderer.renderFrame(');
    expect(source).not.toMatch(/rotoFrameDraw/);
    expect(source).not.toMatch(/resolveMissingRotoFrameDraw/);
    expect(source).not.toMatch(/drawMissingRotoBackground/);
    expect(source).not.toMatch(/physicPaintStore/);
    expect(source).not.toMatch(/@efxlab\/efx-physic-paint/);
    expect(source).not.toMatch(/renderFromStrokes/);
    expect(source).not.toMatch(/forceDryAll/);
  });

  it('delegates both normal and transition export renders through PreviewRenderer frame rendering', () => {
    const source = readSource('src/lib/exportRenderer.ts');
    const renderFrameCalls = source.match(/\.renderFrame\(/g) ?? [];

    expect(renderFrameCalls.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain('renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps, true, fadeOpacity, globalFrame)');
    expect(source).not.toMatch(/if \([^)]*missing/i);
    expect(source).not.toMatch(/background-only/);
  });

  it('resolves missing transparent Roto frames as playback-only no-op without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');
    const upsertRealRotoKeyFrame = vi.spyOn(physicPaintStore, 'upsertRealRotoKeyFrame');
    const replaceGeneratedRotoCache = vi.spyOn(physicPaintStore, 'replaceGeneratedRotoCache');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 24, { mode: 'transparent' });

    expect(result).toEqual({ kind: 'transparent', span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(upsertRealRotoKeyFrame).not.toHaveBeenCalled();
    expect(replaceGeneratedRotoCache).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('resolves missing background Roto frames as virtual background-only draw without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');
    const upsertRealRotoKeyFrame = vi.spyOn(physicPaintStore, 'upsertRealRotoKeyFrame');
    const replaceGeneratedRotoCache = vi.spyOn(physicPaintStore, 'replaceGeneratedRotoCache');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 25, { mode: 'color', color: '#ffffff' });

    expect(result).toEqual({ kind: 'background-only', color: '#ffffff', span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(upsertRealRotoKeyFrame).not.toHaveBeenCalled();
    expect(replaceGeneratedRotoCache).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('resolves persisted paper and canvas grain metadata for missing Roto frames without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 26, { mode: 'paper', metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } });

    expect(result).toEqual({ kind: 'background-only', color: '#ebe3d2', paperTexture: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('keeps trailing background-only export resolution dynamic without serialized cache growth', () => {
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 6, { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cmVhbC02' });
    const before = structuredClone(physicPaintStore.toMceOutputs());

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 9, {
      backgroundState: { mode: 'paper', metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } },
      realKeyFrames: physicPaintStore.getRealRotoKeyFrames('phys-layer-1'),
    });

    expect(result).toEqual({ kind: 'background-only', color: '#ebe3d2', paperTexture: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, span: { kind: 'trailing', previousRealKeyFrame: 6 }, materialize: false });
    expect(physicPaintStore.getFrame('phys-layer-1', 9)).toBeNull();
    expect(physicPaintStore.toMceOutputs()).toEqual(before);
  });
});

describe('exportRenderer', () => {
  describe('renderGlobalFrame', () => {
    it.todo('renders a single content frame identically to Preview.tsx');
    it.todo('renders cross-dissolve overlap with correct blending');
    it.todo('renders FX overlay sequences with keyframe interpolation');
    it.todo('renders content-overlay sequences with fade opacity');
    it.todo('handles solid fade overlay with computed alpha');
  });

  describe('preloadExportImages', () => {
    it.todo('resolves when all images are loaded');
    it.todo('resolves immediately if all images already cached');
  });

  // buildSequenceFrames is module-internal (not exported).
  // These tests require buildSequenceFrames to be exported or tested indirectly via renderGlobalFrame.
  // Plan 01/03 may export it or test solid behavior through renderGlobalFrame integration tests.
  describe('buildSequenceFrames solid/transparent', () => {
    it.todo('carries solidColor field from KeyPhoto to FrameEntry');
    it.todo('carries isTransparent field from KeyPhoto to FrameEntry');
    it.todo('produces empty imageId for solid/transparent entries');
  });

  describe('preloadExportImages with solids', () => {
    it.todo('filters empty imageId strings from preload set');
  });

  describe('solo mode (ENH-03)', () => {
    it.todo('renderGlobalFrame with soloActive=true skips overlay sequences entirely');
    it.todo('renderGlobalFrame with soloActive=false renders overlay sequences normally');
    it.todo('cross-dissolve transitions still render in solo mode');
  });

  describe('GL transition rendering (GLT-04)', () => {
    it.todo('renders GL transition overlap via dual-capture when overlap has glTransition');
    it.todo('calls renderGlslTransition with correct shader, canvases, and progress');
    it.todo('preserves existing cross-dissolve rendering when overlap has no glTransition');
    it.todo('creates and reuses offscreen canvases for dual-capture');
    it.todo('computes eased progress via computeTransitionProgress');
  });
});
