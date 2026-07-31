import { describe, expect, it, vi } from 'vitest';

vi.mock('preact/hooks', () => {
  const createdRefs: Array<{ current: unknown }> = [];
  return {
    useCallback: <Value>(callback: Value) => callback,
    useMemo: <Value>(factory: () => Value) => factory(),
    useState: <Value>(initial: Value) => {
      let value = initial;
      const setter = (next: Value | ((previous: Value) => Value)) => {
        value = typeof next === 'function' ? (next as (previous: Value) => Value)(value) : next;
      };
      return [value, setter];
    },
    useRef: <Value>(initial: Value) => {
      const ref = { current: initial };
      createdRefs.push(ref);
      return ref;
    },
    __createdRefs: createdRefs,
  };
});

import * as preactHooks from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import { isRotoSessionCopiedKeyGroup, type RotoSessionCopiedKey } from '../roto/physicsPaintRotoSession';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';

const createdRefs = (preactHooks as unknown as { __createdRefs: Array<{ current: unknown }> }).__createdRefs;

const BLANK_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function realKeyFrame(appFrame: number): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: BLANK_PNG_DATA_URL,
    width: 100,
    height: 80,
    source: 'real-key',
  } as PhysicPaintRotoCacheFrame;
}

function realKeyRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: Object.freeze({
      frameIndex: 0,
      appFrame,
      dataUrl: BLANK_PNG_DATA_URL,
      width: 100,
      height: 80,
    }) as PhysicPaintRotoRealKeyPayload,
  }) as PhysicPaintRotoRealKeyRecord;
}

interface HarnessOptions {
  currentFrame?: number;
  currentKeyId?: string | null;
  realKeyFrames?: PhysicPaintRotoCacheFrame[];
  records?: PhysicPaintRotoRealKeyRecord[];
  selectedKeyIds?: readonly string[];
  applyStatus?: 'idle' | 'applying' | 'success' | 'error';
  flushInFlight?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const refIndex = createdRefs.length;
  const setApplyMessage = vi.fn();
  const setApplyStatus = vi.fn();
  const setLastError = vi.fn();
  const input: RotoKeyUtilitiesInput = {
    currentFrame: options.currentFrame ?? 3,
    currentKeyId: options.currentKeyId ?? 'key-a',
    physicalKeyUtilities: {
      duplicateKey: vi.fn(async () => true),
      pasteKey: vi.fn(async () => true),
      pasteKeyGroup: vi.fn(async () => true),
      addEmptyKey: vi.fn(async () => true),
    } as never,
    getSelectedKeyIds: () => options.selectedKeyIds ?? [],
    getRotoKeyRecords: () => options.records ?? [],
    realKeyFrames: options.realKeyFrames ?? [realKeyFrame(3)],
    dirtyFrames: new Set<number>(),
    canvasSize: { width: 100, height: 80 },
    applyStatus: options.applyStatus ?? 'idle',
    flushInFlight: options.flushInFlight ?? false,
    buildBlankRotoFrame: (frame) => realKeyFrame(frame),
    setDirtyFrames: vi.fn(),
    syncPendingRotoFrames: vi.fn(),
    restoreFrame: vi.fn(),
    clearCanvas: vi.fn(),
    showCachedReference: vi.fn(),
    navigate: vi.fn(async () => true),
    clearGeneratedFrame: vi.fn(),
    clearCachedReferenceFrame: vi.fn(),
    clearDeletedFrame: vi.fn(),
    setApplyMessage,
    setApplyStatus,
    setLastError,
  };
  const utils = useRotoKeyUtilities(input);
  const copiedKeyRef = createdRefs[refIndex] as { current: unknown };
  return { utils, input, copiedKeyRef, setApplyMessage, setApplyStatus, setLastError };
}

async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
}

describe('useRotoKeyUtilities cutKey', () => {
  it('cuts a single real key: clipboard holds the payload and delete runs exactly once', async () => {
    const { utils, setApplyMessage, setLastError } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(3)],
    });
    const deleteSelection = vi.fn(async () => true);

    utils.cutKey(deleteSelection);
    await flushAsync();

    expect(deleteSelection).toHaveBeenCalledTimes(1);
    const clipboard = utils.session.copiedKey.value;
    expect(clipboard).not.toBeNull();
    expect(isRotoSessionCopiedKeyGroup(clipboard!)).toBe(false);
    expect((clipboard as RotoSessionCopiedKey).frame).toBe(3);
    expect((clipboard as RotoSessionCopiedKey).cachedFrame.dataUrl).toBe(BLANK_PNG_DATA_URL);
    expect(setApplyMessage).toHaveBeenCalledWith('Cut the Roto key to the clipboard.');
    expect(setLastError).toHaveBeenCalledWith(null);
  });

  it('cuts a selected key group: clipboard holds a frozen group sorted by sourceAppFrame and delete runs exactly once', async () => {
    const { utils, setApplyMessage } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(1), realKeyFrame(3)],
      records: [realKeyRecord('key-a', 3), realKeyRecord('key-b', 1)],
      selectedKeyIds: ['key-a', 'key-b'],
    });
    const deleteSelection = vi.fn(async () => true);

    utils.cutKey(deleteSelection);
    await flushAsync();

    expect(deleteSelection).toHaveBeenCalledTimes(1);
    const clipboard = utils.session.copiedKey.value;
    expect(clipboard).not.toBeNull();
    expect(isRotoSessionCopiedKeyGroup(clipboard!)).toBe(true);
    if (!clipboard || !isRotoSessionCopiedKeyGroup(clipboard)) throw new Error('expected a group clipboard');
    expect(Object.isFrozen(clipboard)).toBe(true);
    expect(clipboard.entries.map((entry) => entry.sourceAppFrame)).toEqual([1, 3]);
    expect(clipboard.entries.map((entry) => entry.sourceKeyId)).toEqual(['key-b', 'key-a']);
    expect(setApplyMessage).toHaveBeenCalledWith('Cut 2 Roto keys to the clipboard.');
  });

  it('restores the exact pre-cut clipboard and ref when the delete resolves false', async () => {
    const { utils, copiedKeyRef, setApplyMessage, setApplyStatus } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(3), realKeyFrame(7)],
    });
    utils.session.copyKey();
    const preCutClipboard = utils.session.copiedKey.value;
    expect(preCutClipboard).not.toBeNull();
    const deleteSelection = vi.fn(async () => false);

    utils.cutKey(deleteSelection);
    await flushAsync();

    expect(deleteSelection).toHaveBeenCalledTimes(1);
    expect(utils.session.copiedKey.value).toBe(preCutClipboard);
    expect(copiedKeyRef.current).toBe(preCutClipboard);
    expect(setApplyMessage).toHaveBeenCalledWith('Cut canceled — the selected keys could not be deleted. Clipboard unchanged.');
    expect(setApplyStatus).not.toHaveBeenCalledWith('error');
  });

  it('restores the clipboard and surfaces an error when the delete rejects', async () => {
    const { utils, copiedKeyRef, setApplyMessage, setApplyStatus, setLastError } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(3), realKeyFrame(7)],
    });
    utils.session.copyKey();
    const preCutClipboard = utils.session.copiedKey.value;
    const deleteSelection = vi.fn(async () => { throw new Error('bridge offline'); });

    utils.cutKey(deleteSelection);
    await flushAsync();

    expect(deleteSelection).toHaveBeenCalledTimes(1);
    expect(utils.session.copiedKey.value).toBe(preCutClipboard);
    expect(copiedKeyRef.current).toBe(preCutClipboard);
    expect(setApplyStatus).toHaveBeenCalledWith('error');
    expect(setApplyMessage).toHaveBeenCalledWith('Could not cut the selected Roto keys.');
    expect(setLastError).toHaveBeenCalledWith('bridge offline');
  });

  it('never deletes when the copy half is unavailable on a non-real-key frame', async () => {
    const { utils, setApplyMessage } = createHarness({
      currentFrame: 5,
      realKeyFrames: [realKeyFrame(3)],
    });
    const deleteSelection = vi.fn(async () => true);

    utils.cutKey(deleteSelection);
    await flushAsync();

    expect(deleteSelection).not.toHaveBeenCalled();
    expect(utils.session.copiedKey.value).toBeNull();
    expect(setApplyMessage).toHaveBeenCalledTimes(1);
  });

  it('never deletes when a selected group record is missing', async () => {
    const { utils, setApplyMessage } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(1), realKeyFrame(3)],
      records: [realKeyRecord('key-a', 3)],
      selectedKeyIds: ['key-a', 'key-gone'],
    });
    const deleteSelection = vi.fn(async () => true);

    utils.cutKey(deleteSelection);
    await flushAsync();

    expect(deleteSelection).not.toHaveBeenCalled();
    expect(utils.session.copiedKey.value).toBeNull();
    expect(setApplyMessage).toHaveBeenCalledWith('The selected Roto keys are no longer available.');
  });

  it('no-ops while a flush is in flight or an apply is running', async () => {
    for (const options of [{ flushInFlight: true }, { applyStatus: 'applying' as const }]) {
      const { utils, setApplyMessage } = createHarness({
        currentFrame: 3,
        realKeyFrames: [realKeyFrame(3)],
        ...options,
      });
      const deleteSelection = vi.fn(async () => true);

      utils.cutKey(deleteSelection);
      await flushAsync();

      expect(deleteSelection).not.toHaveBeenCalled();
      expect(utils.session.copiedKey.value).toBeNull();
      expect(setApplyMessage).not.toHaveBeenCalled();
    }
  });
});

describe('useRotoKeyUtilities copyKey regression (shared selection resolution)', () => {
  it('still copies a single real key with the existing feedback', () => {
    const { utils, setApplyMessage } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(3)],
    });

    utils.copyKey();

    const clipboard = utils.session.copiedKey.value;
    expect(clipboard).not.toBeNull();
    expect(isRotoSessionCopiedKeyGroup(clipboard!)).toBe(false);
    expect((clipboard as RotoSessionCopiedKey).frame).toBe(3);
    expect(setApplyMessage).toHaveBeenCalledWith('Copied key 3.');
  });

  it('still copies a selected group sorted by sourceAppFrame with the existing feedback', () => {
    const { utils, setApplyMessage } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(1), realKeyFrame(3)],
      records: [realKeyRecord('key-a', 3), realKeyRecord('key-b', 1)],
      selectedKeyIds: ['key-a', 'key-b'],
    });

    utils.copyKey();

    const clipboard = utils.session.copiedKey.value;
    expect(clipboard).not.toBeNull();
    if (!clipboard || !isRotoSessionCopiedKeyGroup(clipboard)) throw new Error('expected a group clipboard');
    expect(clipboard.entries.map((entry) => entry.sourceAppFrame)).toEqual([1, 3]);
    expect(setApplyMessage).toHaveBeenCalledWith('Copied 2 keys');
  });

  it('keeps the clipboard reusable for repeated paste after a cut', async () => {
    const { utils } = createHarness({
      currentFrame: 3,
      realKeyFrames: [realKeyFrame(3)],
    });
    const deleteSelection = vi.fn(async () => true);

    utils.cutKey(deleteSelection);
    await flushAsync();

    const cutClipboard = utils.session.copiedKey.value;
    expect(cutClipboard).not.toBeNull();
    // The clipboard survives the cut unchanged across subsequent reads.
    expect(utils.session.copiedKey.value).toBe(cutClipboard);
    expect(utils.session.actionAvailability.value.canPaste).toBe(true);
  });
});
