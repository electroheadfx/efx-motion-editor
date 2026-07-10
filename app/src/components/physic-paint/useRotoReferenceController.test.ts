import { describe, expect, it, vi } from 'vitest';
import {
  createRotoReferenceLoader,
  findCachedRotoDisplayFrame,
  findCachedRotoReferenceFrame,
  type RotoReferenceFrame,
} from './useRotoReferenceController';

const frame = (appFrame: number, source: 'real-key' | 'generated-interpolation', dataUrl = `data:${appFrame}`): RotoReferenceFrame => ({ appFrame, frameIndex: appFrame, source, dataUrl });

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
  it('resolves cached display frames in generated, preview-real, launch/store-real, confirmed, then generic-store order', () => {
    const generated = frame(4, 'generated-interpolation', 'generated');
    const preview = frame(4, 'real-key', 'preview');
    const launchReal = frame(4, 'real-key', 'launch-real');
    const confirmed = { ...frame(9, 'real-key', 'confirmed'), displayFrame: 4 };
    const generic = frame(4, 'real-key', 'generic');
    const getRotoFrame = vi.fn(() => launchReal);

    expect(findCachedRotoDisplayFrame(4, {
      cachedRotoFrames: [launchReal, generated],
      previewFrames: new Map([[4, preview]]),
      confirmedFrames: new Map([[9, confirmed]]),
      getRotoFrame,
    })).toBe(generated);

    expect(findCachedRotoDisplayFrame(4, {
      cachedRotoFrames: [launchReal],
      previewFrames: new Map([[4, preview]]),
      confirmedFrames: new Map([[9, confirmed]]),
      getRotoFrame,
    })).toBe(preview);

    expect(findCachedRotoDisplayFrame(4, {
      cachedRotoFrames: [launchReal],
      previewFrames: new Map(),
      confirmedFrames: new Map([[9, confirmed]]),
      getRotoFrame,
    })).toBe(launchReal);

    expect(findCachedRotoDisplayFrame(4, {
      cachedRotoFrames: [],
      previewFrames: new Map(),
      confirmedFrames: new Map([[9, confirmed]]),
      getRotoFrame: () => null,
    })).toBe(confirmed);

    expect(findCachedRotoReferenceFrame(4, {
      cachedRotoFrames: [],
      previewFrames: new Map(),
      confirmedFrames: new Map(),
      getRotoFrame: () => null,
      getFrame: () => generic,
    })).toBe(generic);
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
    expect(setApplyMessage).toHaveBeenCalledWith('Cached key base loaded — visible and non-editable. Add paint to update frame 4.');
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
});
