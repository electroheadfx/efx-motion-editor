import { beforeEach, describe, expect, it, vi } from 'vitest';

const effectState = vi.hoisted(() => ({
  dependencies: undefined as readonly unknown[] | undefined,
}));

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (effect: () => void, dependencies: readonly unknown[]) => {
    const previous = effectState.dependencies;
    const changed = !previous
      || previous.length !== dependencies.length
      || dependencies.some((dependency, index) => !Object.is(dependency, previous[index]));
    effectState.dependencies = dependencies;
    if (changed) effect();
  },
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
  beforeEach(() => {
    effectState.dependencies = undefined;
  });

  it('does not reload the current frame when only cached launch data changes', () => {
    const loadReferenceFrame = vi.fn();
    const engine = { resetBackground: vi.fn() } as never;
    const reference = {
      cachedReferenceUrl: null,
      cachedRepaintBaseFrame: null,
      clearReference: vi.fn(),
      resetReference: vi.fn(),
      setReferenceUrl: vi.fn(),
      loadReferenceFrame,
    };
    const sharedInput = {
      workflowMode: 'roto' as const,
      currentFrame: 4,
      currentFrameSelectionKind: 'real-key' as const,
      canvasSize: { width: 1000, height: 650 },
      engine,
      editBuffer: {
        dirtyFramesRef: { current: new Set<number>() },
        markDirty: vi.fn(),
        undoOverlay: vi.fn((_frame: number): 'unchanged' => 'unchanged'),
        clearCachedOverlay: vi.fn(),
        clearFrame: vi.fn(),
        snapshotFrame: vi.fn(() => false),
      },
      session: {
        markLiveOverlayDirty: vi.fn(),
        markLiveOverlayEmpty: vi.fn(),
      },
      reference,
      clearCachedFrame: vi.fn(),
      playback: { stop: vi.fn() },
      syncPendingFrames: vi.fn(),
      status: {
        setApplyStatus: vi.fn(),
        setApplyMessage: vi.fn(),
      },
    };

    useRotoFrameEditingController({
      ...sharedInput,
      launchContext: { layerId: 'layer-1', operationId: 'operation-1', cachedRotoFrames: [] } as never,
    });
    useRotoFrameEditingController({
      ...sharedInput,
      launchContext: { layerId: 'layer-1', operationId: 'operation-1', cachedRotoFrames: [{ appFrame: 4 }] } as never,
    });

    expect(loadReferenceFrame).toHaveBeenCalledTimes(1);
    expect(loadReferenceFrame).toHaveBeenCalledWith(4, engine);
  });

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
