import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintRotoPhysicalRenderSource } from '../roto/physicsPaintRotoPhysicalModel';
import {
  createRotoReferenceLoader,
  findCachedRotoDisplayFrame,
  findCachedRotoReferenceFrame,
  type RotoReferenceEngine,
  type RotoReferenceFrame,
} from './useRotoReferenceController';

const frame = (appFrame: number, source: 'real-key' | 'generated-interpolation', dataUrl = `data:${appFrame}`): RotoReferenceFrame => ({ appFrame, frameIndex: appFrame, source, dataUrl });

/** Minimal valid PNG data URL (real signature bytes) for canonical render sources. */
const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

function createEngine(): RotoReferenceEngine {
  return {
    setBgMode: vi.fn(),
    clear: vi.fn(),
    setPreviewBaseImageUrl: vi.fn(),
    clearPreviewBaseImage: vi.fn(),
    resetBackground: vi.fn(),
    getAppliedPreviewBaseDataUrl: vi.fn(() => null),
    getAppliedPreviewBaseAppFrame: vi.fn(() => null),
    getAppliedPreviewBaseExplicit: vi.fn(() => false),
    getAppliedPreviewBaseGeneration: vi.fn(() => null),
  };
}

/** Engine in the post-completion state: the reconcile settled the ACCEPTED
 * (full) render for an appFrame at an EXPLICIT session-monotonic generation. */
function createSettledCompletionEngine(appFrame: number, appliedDataUrl: string, appliedGeneration = 7) {
  const engine = createEngine();
  engine.getAppliedPreviewBaseDataUrl = () => appliedDataUrl;
  engine.getAppliedPreviewBaseGeneration = () => appliedGeneration;
  engine.getAppliedPreviewBaseAppFrame = () => appFrame;
  engine.getAppliedPreviewBaseExplicit = () => true;
  return engine;
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
    expect(engine.setPreviewBaseImageUrl).toHaveBeenCalledWith(cached.dataUrl, undefined, 4);
    expect(syncPending).toHaveBeenCalledTimes(1);
    expect(setApplyMessage).toHaveBeenCalledWith('Cached physical base loaded for frame 4. Add paint to update this key.');
  });

  it('replaces rejected dirty pixels with one explicitly accepted physical base', () => {
    const engine = createEngine();
    const dirtyFrames = new Set([4]);
    const liveOverlayActionCounts = new Map([[4, 2]]);
    const accepted = frame(4, 'real-key', 'data:accepted');
    const syncPending = vi.fn();
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames,
      liveOverlayActionCounts,
      getReferenceFrame: () => accepted,
      setReferenceUrl: vi.fn(),
      setRepaintBaseFrame: vi.fn(),
      syncPending,
      setApplyMessage: vi.fn(),
      replaceDirtyFrame: true,
    });

    expect(loader.load(4, engine)).toBe(true);
    expect(dirtyFrames.has(4)).toBe(false);
    expect(liveOverlayActionCounts.has(4)).toBe(false);
    expect(engine.clear).toHaveBeenCalledOnce();
    expect(engine.setPreviewBaseImageUrl).toHaveBeenCalledWith('data:accepted', undefined, 4);
    expect(syncPending).toHaveBeenCalledOnce();
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

  it('no-ops a late effect-driven reload that would paint a cached PARTIAL over a settled accepted full render (regression-refresh-multi-paint 3rd rejection)', () => {
    // The completion reconcile settled the ACCEPTED (full) render for frame 4
    // at an explicit generation — the engine holds it as the applied preview base.
    const engine = createSettledCompletionEngine(4, 'data:full');

    // The frame-editing effect re-fires ~1s later and reloads frame 4 with NO
    // explicit generation (replaceDirtyFrame=false, no explicitDataUrl). The
    // reference source still resolves the cached PARTIAL first-stroke render.
    const partial = frame(4, 'real-key', 'data:partial');
    const setReferenceUrl = vi.fn();
    const setRepaintBaseFrame = vi.fn();
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames: new Set(), // NOT dirty — the loader would normally paint
      liveOverlayActionCounts: new Map(),
      getReferenceFrame: () => partial,
      setReferenceUrl,
      setRepaintBaseFrame,
      syncPending: vi.fn(),
      setApplyMessage: vi.fn(),
    });

    const result = loader.load(4, engine);
    expect(result, 'the stale refresh must not paint').toBe(false);
    expect(engine.setPreviewBaseImageUrl, 'the partial must never reach the engine').not.toHaveBeenCalled();
    expect(engine.clear, 'the settled full render must stay on the canvas (no clear)').not.toHaveBeenCalled();
    expect(engine.setBgMode, 'the settled full render must stay on the canvas (no bgMode swap)').not.toHaveBeenCalled();
    // The reference base is preserved so any later legit load still resolves it.
    expect(setRepaintBaseFrame).toHaveBeenLastCalledWith(expect.any(Function));
    expect(setReferenceUrl).toHaveBeenLastCalledWith(null);
  });

  it('no-ops the pixel-cache fallback retry (replaceDirtyFrame=true) when a completion render already settled for the same frame (regression-refresh-multi-paint 4th rejection)', () => {
    // The completion reconcile settled the ACCEPTED (full) render for frame 20
    // at an explicit generation — the engine holds it as the applied preview base.
    const engine = createSettledCompletionEngine(20, 'data:full');
    // The pixel-cache retry re-fires ~13s after completion: captureLivePixels
    // failed, so it reloads frame 20 with replaceDirtyFrame=true (no explicit
    // generation, no explicitDataUrl). Its cached source still resolves the
    // PARTIAL first-stroke render. This must NOT clobber the settled full render.
    const partial = frame(20, 'real-key', 'data:partial');
    const setReferenceUrl = vi.fn();
    const setRepaintBaseFrame = vi.fn();
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames: new Set(), // not dirty: with replaceDirtyFrame the loader would otherwise paint
      liveOverlayActionCounts: new Map(),
      getReferenceFrame: () => partial,
      setReferenceUrl,
      setRepaintBaseFrame,
      syncPending: vi.fn(),
      setApplyMessage: vi.fn(),
      replaceDirtyFrame: true,
    });

    const result = loader.load(20, engine);
    expect(result, 'the stale cache-retry must not paint').toBe(false);
    expect(engine.setPreviewBaseImageUrl, 'the partial must never reach the engine').not.toHaveBeenCalled();
    expect(engine.clear, 'the settled full render must stay on the canvas (no clear)').not.toHaveBeenCalled();
    expect(engine.setBgMode, 'the settled full render must stay on the canvas (no bgMode swap)').not.toHaveBeenCalled();
  });

  it('does not block a NEW stroke repaint on a settled frame: the authoritative accept (explicit generation) still paints the new render (regression-refresh-multi-paint safety case)', () => {
    // A completed heavy Action settled the FULL render for frame 4 at gen 7.
    const engine = createSettledCompletionEngine(4, 'data:full-before', 7);
    // The user paints a NEW stroke on frame 4: the frame goes dirty and, once
    // accepted, carries a NEWER render. This is an AUTHORITATIVE repaint — it
    // passes an explicit generation, so the plain-refresh no-op (added for the
    // pixel-cache retry) must NOT swallow it.
    const newRender = frame(4, 'real-key', 'data:full-after-new-stroke');
    const dirtyFrames = new Set([4]);
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames,
      liveOverlayActionCounts: new Map([[4, 1]]),
      getReferenceFrame: () => newRender,
      setReferenceUrl: vi.fn(),
      setRepaintBaseFrame: vi.fn(),
      syncPending: vi.fn(),
      setApplyMessage: vi.fn(),
      replaceDirtyFrame: true,
      generation: 8,
    });

    expect(loader.load(4, engine), 'the authoritative new-stroke accept must still repaint').toBe(true);
    expect(engine.setPreviewBaseImageUrl, 'the new render must be painted over the old settled base').toHaveBeenCalledWith('data:full-after-new-stroke', 8, 4);
    expect(dirtyFrames.has(4), 'the accepted repaint clears the dirty flag').toBe(false);
  });

  it('still paints a plain refresh for a DIFFERENT appFrame than the settled completion render', () => {
    const engine = createSettledCompletionEngine(9, 'data:frame9-full');
    const target = frame(4, 'real-key', 'data:frame4');
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames: new Set(),
      liveOverlayActionCounts: new Map(),
      getReferenceFrame: () => target,
      setReferenceUrl: vi.fn(),
      setRepaintBaseFrame: vi.fn(),
      syncPending: vi.fn(),
      setApplyMessage: vi.fn(),
    });

    expect(loader.load(4, engine), 'a different-frame load is legit navigation/editing').toBe(true);
    expect(engine.setPreviewBaseImageUrl).toHaveBeenCalledWith('data:frame4', undefined, 4);
  });

  it('paints an explicit-generation reconcile (replaceDirtyFrame) even while a settled render is applied', () => {
    const engine = createSettledCompletionEngine(4, 'data:old-full', 7);
    const accepted = frame(4, 'real-key', 'data:new-full');
    const dirtyFrames = new Set([4]);
    const loader = createRotoReferenceLoader({
      getWorkflowMode: () => 'roto',
      getSettingsBackground: () => 'white',
      dirtyFrames,
      liveOverlayActionCounts: new Map([[4, 2]]),
      getReferenceFrame: () => accepted,
      setReferenceUrl: vi.fn(),
      setRepaintBaseFrame: vi.fn(),
      syncPending: vi.fn(),
      setApplyMessage: vi.fn(),
      replaceDirtyFrame: true,
      generation: 8,
    });

    expect(loader.load(4, engine), 'the completion reconcile always paints').toBe(true);
    expect(dirtyFrames.has(4)).toBe(false);
    expect(engine.setPreviewBaseImageUrl).toHaveBeenCalledWith('data:new-full', 8, 4);
  });

  it('returns the accepted (full) frame, not a lingering progressive partial, once the accepted render settles', () => {
    const realSource = {
      kind: 'real' as const,
      layerId: 'layer-1',
      appFrame: 4,
      keyId: 'key-4',
      contentRevision: 'rev-1',
      cacheRevision: 'rev-1:real:key-4',
      renderedFrame: { frameIndex: 0, appFrame: 4, dataUrl: pngDataUrl('full') },
    };
    // A progressive/partial preview captured during generation lingers in the
    // edit buffer. Once the accepted (full) render settles, the reconcile has
    // cleared the dirty flag, so the reference source must resolve the accepted
    // frame — never the partial.
    const partialPreview = { appFrame: 4, frameIndex: 0, dataUrl: pngDataUrl('partial'), keyId: 'key-4', contentRevision: 'rev-1' };
    expect(findCachedRotoReferenceFrame(4, {
      getPhysicalRenderSource: () => realSource,
      previewFrames: new Map([[4, partialPreview]]),
      dirtyFrames: new Set(), // accepted render settled → frame no longer dirty
    })).toMatchObject({ appFrame: 4, dataUrl: pngDataUrl('full') });
  });

  it('never-fallback: a future unknown render-source variant is a hard error, never silent content', () => {
    const forged = { kind: 'future-variant', layerId: 'layer-1', appFrame: 7 } as unknown as PhysicPaintRotoPhysicalRenderSource;
    expect(() => findCachedRotoDisplayFrame(7, { getPhysicalRenderSource: () => forged })).toThrow(/Unhandled Roto physical render-source kind/);
  });
});
