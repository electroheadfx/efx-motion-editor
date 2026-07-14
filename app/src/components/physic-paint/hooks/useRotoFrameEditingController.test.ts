import { describe, expect, it, vi } from 'vitest';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: () => {},
}));

import { useRotoFrameEditingController } from './useRotoFrameEditingController';

function createHarness() {
  const dirtyFrames = new Set<number>();
  const resetBackground = vi.fn();
  const clearReference = vi.fn();
  const markDirty = vi.fn((frame: number) => dirtyFrames.add(frame));
  const markLiveOverlayDirty = vi.fn();
  const stop = vi.fn();
  const syncPendingFrames = vi.fn();

  const controller = useRotoFrameEditingController({
    workflowMode: 'roto',
    currentFrame: 4,
    currentFrameSelectionKind: 'real-key',
    canvasSize: { width: 1000, height: 650 },
    engine: { resetBackground } as never,
    launchContext: null,
    editBuffer: {
      dirtyFramesRef: { current: dirtyFrames },
      markDirty,
      undoOverlay: vi.fn((_frame: number): 'unchanged' => 'unchanged'),
      clearCachedOverlay: vi.fn(),
      clearFrame: vi.fn(),
      snapshotFrame: vi.fn(() => false),
    },
    session: {
      markLiveOverlayDirty,
      markLiveOverlayEmpty: vi.fn(),
    },
    reference: {
      cachedReferenceUrl: null,
      cachedRepaintBaseFrame: null,
      clearReference,
      resetReference: vi.fn(),
      setReferenceUrl: vi.fn(),
      loadReferenceFrame: vi.fn(),
    },
    clearCachedFrame: vi.fn(),
    playback: { stop },
    syncPendingFrames,
    status: {
      setApplyStatus: vi.fn(),
      setApplyMessage: vi.fn(),
    },
  });

  return {
    controller,
    resetBackground,
    clearReference,
    markDirty,
    markLiveOverlayDirty,
    stop,
    syncPendingFrames,
  };
}

describe('Roto frame editing controller', () => {
  it('transitions the cached reference only on the first edit intent for a dirty frame', () => {
    const harness = createHarness();

    harness.controller.beginFrameEdit();
    harness.controller.beginFrameEdit();

    expect(harness.resetBackground).toHaveBeenCalledTimes(1);
    expect(harness.clearReference).toHaveBeenCalledTimes(1);
    expect(harness.markDirty).toHaveBeenCalledTimes(2);
    expect(harness.markLiveOverlayDirty).toHaveBeenCalledTimes(2);
    expect(harness.syncPendingFrames).toHaveBeenCalledTimes(2);
  });
});
