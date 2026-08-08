import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintRotoPhysicalRenderSource } from '../roto/physicsPaintRotoPhysicalModel';
import {
  createRotoReferenceLoader,
  findCachedRotoDisplayFrame,
  findCachedRotoReferenceFrame,
  type RotoReferenceFrame,
} from './useRotoReferenceController';

const frame = (appFrame: number, source: 'real-key' | 'generated-interpolation', dataUrl = `data:${appFrame}`): RotoReferenceFrame => ({ appFrame, frameIndex: appFrame, source, dataUrl });

/** Minimal valid PNG data URL (real signature bytes) for canonical render sources. */
const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

function createEngine() {
  return {
    setBgMode: vi.fn(),
    clear: vi.fn(),
    setPreviewBaseImageUrl: vi.fn(),
    clearPreviewBaseImage: vi.fn(),
    resetBackground: vi.fn(),
  };
}

describe('Roto reference controller', () => {
  it('resolves cached frames through the exact physical cell: generated, real, dirty preview fallback, then null', () => {
    const generatedSource = {
      kind: 'generated' as const,
      layerId: 'layer-1',
      appFrame: 4,
      leftKeyId: 'key-1',
      rightKeyId: 'key-9',
      interpolationMode: 'duplicate' as const,
      contentRevision: 'rev-1',
      cacheRevision: 'rev-1:generated:duplicate:key-1:key-9:4',
      renderedFrame: { frameIndex: 0, appFrame: 4, dataUrl: pngDataUrl('generated') },
    };
    const realSource = {
      kind: 'real' as const,
      layerId: 'layer-1',
      appFrame: 4,
      keyId: 'key-4',
      contentRevision: 'rev-1',
      cacheRevision: 'rev-1:real:key-4',
      renderedFrame: { frameIndex: 0, appFrame: 4, dataUrl: pngDataUrl('real') },
    };

    // A current generated physical source resolves to the derived output at the exact appFrame.
    expect(findCachedRotoDisplayFrame(4, { getPhysicalRenderSource: () => generatedSource })).toMatchObject({
      appFrame: 4,
      dataUrl: generatedSource.renderedFrame.dataUrl,
      contentRevision: 'rev-1',
      cacheRevision: 'rev-1:generated:duplicate:key-1:key-9:4',
    });

    // A real physical source resolves with its stable key identity.
    expect(findCachedRotoDisplayFrame(4, { getPhysicalRenderSource: () => realSource, dirtyFrames: new Set() })).toMatchObject({
      appFrame: 4,
      keyId: 'key-4',
      contentRevision: 'rev-1',
    });

    // A dirty real key serves its matching live preview only when key identity and revision agree.
    const matchingPreview = { appFrame: 4, frameIndex: 0, dataUrl: 'data:preview', keyId: 'key-4', contentRevision: 'rev-1' };
    expect(findCachedRotoDisplayFrame(4, {
      getPhysicalRenderSource: () => realSource,
      previewFrames: new Map([[4, matchingPreview]]),
      dirtyFrames: new Set([4]),
    })).toBe(matchingPreview);
    const stalePreview = { appFrame: 4, frameIndex: 0, dataUrl: 'data:stale', keyId: 'key-other', contentRevision: 'rev-1' };
    expect(findCachedRotoDisplayFrame(4, {
      getPhysicalRenderSource: () => realSource,
      previewFrames: new Map([[4, stalePreview]]),
      dirtyFrames: new Set([4]),
    })).toMatchObject({ appFrame: 4, keyId: 'key-4', dataUrl: realSource.renderedFrame.dataUrl });

    // A stale generated source (revision mismatch) resolves to null, never to a generic store fallback.
    expect(findCachedRotoDisplayFrame(4, {
      getPhysicalRenderSource: () => ({ ...generatedSource, cacheRevision: 'rev-0:generated:duplicate:key-1:key-9:4' }),
      getFrame: () => frame(4, 'real-key', 'generic'),
    })).toBeNull();

    const linkedGeneratedSource = {
      ...generatedSource,
      appFrame: 18,
      sourceCycleId: '5:key-1|5:key-9',
      cycleOffset: 4,
      cacheRevision: 'rev-1:linked-generated:duplicate:5:key-1|5:key-9:key-1:key-9:4',
      renderedFrame: { ...generatedSource.renderedFrame, appFrame: 18 },
    };
    expect(findCachedRotoDisplayFrame(18, { getPhysicalRenderSource: () => linkedGeneratedSource })).toMatchObject({
      appFrame: 18,
      dataUrl: generatedSource.renderedFrame.dataUrl,
      cacheRevision: linkedGeneratedSource.cacheRevision,
    });
    for (const malformed of [
      { ...linkedGeneratedSource, sourceCycleId: undefined },
      { ...linkedGeneratedSource, cycleOffset: -1 },
      { ...linkedGeneratedSource, cacheRevision: 'rev-1:linked-generated:duplicate:key-1:key-9:4' },
      { ...linkedGeneratedSource, renderedFrame: { ...linkedGeneratedSource.renderedFrame, appFrame: 4 } },
    ]) {
      expect(findCachedRotoDisplayFrame(18, { getPhysicalRenderSource: () => malformed })).toBeNull();
    }

    // Without a physical source there is no generic-store fallback.
    expect(findCachedRotoReferenceFrame(4, {
      getPhysicalRenderSource: () => null,
      getRotoFrame: () => frame(4, 'real-key', 'launch-real'),
      getFrame: () => frame(4, 'real-key', 'generic'),
    })).toBeNull();
  });

  it('refuses dirty frames without clearing their repaint base, then loads a clean base through explicit engine operations', () => {
    const engine = createEngine();
    const dirtyFrames = new Set([4]);
    const setReferenceUrl = vi.fn();
    const setRepaintBaseFrame = vi.fn();
    const syncPending = vi.fn();
    const setApplyMessage = vi.fn();
    const cached = frame(4, 'real-key');
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames,
      liveOverlayActionCounts: new Map([[4, 1]]),
      getReferenceFrame: () => cached,
      setReferenceUrl,
      setRepaintBaseFrame,
      syncPending,
      setApplyMessage,
    });

    expect(loader.load(4, engine)).toBe(false);
    expect(setRepaintBaseFrame).toHaveBeenLastCalledWith(expect.any(Function));
    const preserveCurrent = setRepaintBaseFrame.mock.calls[setRepaintBaseFrame.mock.calls.length - 1]?.[0] as (value: RotoReferenceFrame | null) => RotoReferenceFrame | null;
    expect(preserveCurrent(frame(4, 'real-key', 'old'))).toMatchObject({ dataUrl: 'old' });
    expect(engine.clear).not.toHaveBeenCalled();

    dirtyFrames.clear();
    expect(loader.load(4, engine)).toBe(true);
    expect(setReferenceUrl).toHaveBeenLastCalledWith(null);
    expect(setRepaintBaseFrame).toHaveBeenLastCalledWith(cached);
    expect(engine.setBgMode).toHaveBeenCalledWith('white');
    expect(engine.clear).toHaveBeenCalledTimes(1);
    expect(engine.setPreviewBaseImageUrl).toHaveBeenCalledWith(cached.dataUrl);
    expect(syncPending).toHaveBeenCalledTimes(1);
    expect(setApplyMessage).toHaveBeenCalledWith('Cached physical base loaded for frame 4. Add paint to update this key.');
  });

  it('clears the preview base and resets background when no cached frame exists', () => {
    const engine = createEngine();
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'transparent',
      dirtyFrames: new Set(),
      liveOverlayActionCounts: new Map(),
      getReferenceFrame: () => null,
      setReferenceUrl: vi.fn(),
      setRepaintBaseFrame: vi.fn(),
      syncPending: vi.fn(),
      setApplyMessage: vi.fn(),
    });

    expect(loader.load(8, engine)).toBe(false);
    expect(engine.setBgMode).toHaveBeenCalledWith('transparent');
    expect(engine.clear).toHaveBeenCalledTimes(1);
    expect(engine.clearPreviewBaseImage).toHaveBeenCalledTimes(1);
    expect(engine.resetBackground).toHaveBeenCalledTimes(1);
  });

  it('excludes the loop placeholder variant from display/reference content (D-28, audit finding 6)', () => {
    const placeholderSource = {
      kind: 'loop-placeholder' as const,
      layerId: 'layer-1',
      appFrame: 6,
      loopId: 'loop-1',
      placementStart: 2,
      sourceKeyIds: ['key-4', 'missing-1'],
      missingSourceKeyIds: ['missing-1'],
    };

    expect(findCachedRotoDisplayFrame(6, { getPhysicalRenderSource: () => placeholderSource })).toBeNull();
    expect(findCachedRotoReferenceFrame(6, { getPhysicalRenderSource: () => placeholderSource })).toBeNull();
  });

  it('never-fallback: a future unknown render-source variant is a hard error, never silent content', () => {
    const forged = { kind: 'future-variant', layerId: 'layer-1', appFrame: 7 } as unknown as PhysicPaintRotoPhysicalRenderSource;
    expect(() => findCachedRotoDisplayFrame(7, { getPhysicalRenderSource: () => forged })).toThrow(/Unhandled Roto physical render-source kind/);
  });
});
