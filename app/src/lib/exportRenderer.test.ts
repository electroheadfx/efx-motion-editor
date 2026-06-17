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
    expect(source).toContain('physicPaintStore.getFrame(paintLayerId, paintLookupFrame)');
    expect(source).not.toMatch(/renderFromStrokes/);
  });

  it('keeps export delegated through PreviewRenderer without importing the physics paint engine', () => {
    const source = readSource('src/lib/exportRenderer.ts');

    expect(source).toContain('renderer.renderFrame(');
    expect(source).not.toMatch(/@efxlab\/efx-physic-paint/);
    expect(source).not.toMatch(/renderFromStrokes/);
  });

  it('resolves missing transparent Roto frames as playback-only no-op without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');
    const upsertRealRotoKeyFrame = vi.spyOn(physicPaintStore, 'upsertRealRotoKeyFrame');
    const replaceGeneratedRotoCache = vi.spyOn(physicPaintStore, 'replaceGeneratedRotoCache');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 24, { mode: 'transparent' });

    expect(result).toEqual({ kind: 'transparent' });
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

    expect(result).toEqual({ kind: 'background-only', color: '#ffffff' });
    expect(setFrame).not.toHaveBeenCalled();
    expect(upsertRealRotoKeyFrame).not.toHaveBeenCalled();
    expect(replaceGeneratedRotoCache).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
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
