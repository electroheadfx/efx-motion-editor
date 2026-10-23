import { testWebpBytes } from '../../../testUtils/testWebpBytes';
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
import { ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR, type RotoDisplayedKeyPaint } from '../roto/physicsPaintRotoDuplicateSourcePaint';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import { isRotoSessionCopiedKeyGroup, type RotoSessionCopiedKey } from '../roto/physicsPaintRotoSession';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';

const createdRefs = (preactHooks as unknown as { __createdRefs: Array<{ current: unknown }> }).__createdRefs;

const BLANK_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function realKeyFrame(appFrame: number): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame,
    bytes: testWebpBytes(BLANK_PNG_DATA_URL),
    width: 100,
    height: 80,
    source: 'real-key',
  } as PhysicPaintRotoCacheFrame;
}

function realKeyRecord(keyId: string, appFrame: number, seed = BLANK_PNG_DATA_URL): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: Object.freeze({
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes(seed),
      width: 100,
      height: 80,
    }) as PhysicPaintRotoRealKeyPayload,
  }) as PhysicPaintRotoRealKeyRecord;
}

function realKeyRecordWithoutBytes(keyId: string, appFrame: number, empty = false): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: Object.freeze({
      frameIndex: 0,
      appFrame,
      ...(empty ? { bytes: new Uint8Array(0) } : {}),
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
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  buildBlankRotoFrame?: (frame: number) => Promise<PhysicPaintRotoCacheFrame>;
  selectedKeyIds?: readonly string[];
  applyStatus?: 'idle' | 'applying' | 'success' | 'error';
  flushInFlight?: boolean;
  resolveDisplayedKeyPaint?: (appFrame: number) => RotoDisplayedKeyPaint | null;
  bakeRotoKeyPaint?: (paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => Promise<boolean>;
}

function createHarness(options: HarnessOptions = {}) {
  const refIndex = createdRefs.length;
  const setApplyMessage = vi.fn();
  const setApplyStatus = vi.fn();
  const setLastError = vi.fn();
  const addEmptyKey = vi.fn(async (_appFrame: number, _payload: PhysicPaintRotoRealKeyPayload) => true);
  const buildBlankRotoFrame = vi.fn(options.buildBlankRotoFrame ?? (async (frame: number) => realKeyFrame(frame)));
  const input: RotoKeyUtilitiesInput = {
    currentFrame: options.currentFrame ?? 3,
    currentKeyId: options.currentKeyId ?? 'key-a',
    physicalKeyUtilities: {
      duplicateKey: vi.fn(async () => true),
      pasteKey: vi.fn(async () => true),
      pasteKeyGroup: vi.fn(async () => true),
      addEmptyKey,
    } as never,
    getSelectedKeyIds: () => options.selectedKeyIds ?? [],
    getRotoKeyRecords: () => options.records ?? [],
    realKeyFrames: options.realKeyFrames ?? [realKeyFrame(3)],
    cachedRotoFrames: options.cachedRotoFrames,
    dirtyFrames: new Set<number>(),
    canvasSize: { width: 100, height: 80 },
    applyStatus: options.applyStatus ?? 'idle',
    flushInFlight: options.flushInFlight ?? false,
    buildBlankRotoFrame,
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
    resolveDisplayedKeyPaint: options.resolveDisplayedKeyPaint,
    bakeRotoKeyPaint: options.bakeRotoKeyPaint,
  };
  const utils = useRotoKeyUtilities(input);
  const copiedKeyRef = createdRefs[refIndex] as { current: unknown };
  return { utils, input, copiedKeyRef, addEmptyKey, buildBlankRotoFrame, setApplyMessage, setApplyStatus, setLastError };
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
    expect((clipboard as RotoSessionCopiedKey).cachedFrame.bytes).toEqual(testWebpBytes(BLANK_PNG_DATA_URL));
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

describe('useRotoKeyUtilities rail-set clipboard (quick 260820-bjw)', () => {
  const railPayload = () => ({
    anchorAppFrame: 0,
    // '' = legacy payload with no track context (46-03).
    sourceTrackId: '',
    members: [{
      kind: 'key-rail' as const,
      firstKeyId: 'k0',
      firstKeyFrame: 0,
      firstKeyOwnsIncomingBreak: false,
      entries: [{
        sourceKeyId: 'k0',
        sourceAppFrame: 0,
        ownsIncomingBreak: false,
        payload: {
          frameIndex: 0,
          appFrame: 0,
          bytes: testWebpBytes(BLANK_PNG_DATA_URL),
          width: 100,
          height: 80,
        } as PhysicPaintRotoRealKeyPayload,
      }],
    }],
  });

  it('RED: copyRailSet stores the rail-set clipboard on the session slot and the rebuild ref', () => {
    const { utils, copiedKeyRef } = createHarness({ currentFrame: 3, realKeyFrames: [realKeyFrame(3)] });
    const payload = railPayload();

    utils.copyRailSet(payload);

    const copied = utils.session.copiedKey.value;
    expect(copied).not.toBeNull();
    expect((copied as { kind?: unknown }).kind).toBe('rail-set');
    expect((copied as { payload?: unknown }).payload).toEqual(payload);
    expect(copiedKeyRef.current).toEqual(copied);
  });

  it('RED: pasteKey fails closed on a rail-set clipboard — never the single-key payload cast', () => {
    const harness = createHarness({ currentFrame: 3, realKeyFrames: [realKeyFrame(3)] });
    harness.utils.session.copiedKey.value = { kind: 'rail-set', payload: railPayload() };

    harness.utils.pasteKey();

    expect(harness.input.physicalKeyUtilities.pasteKey).not.toHaveBeenCalled();
    expect(harness.input.physicalKeyUtilities.pasteKeyGroup).not.toHaveBeenCalled();
    expect(harness.setApplyMessage).toHaveBeenCalled();
  });
});

// Quick 261019-mj2 Task 4 (D-04): +Key on a non-real cell clones the NEAREST
// PREVIOUS REAL key's paint — never the displayed interpolated frame. Cached
// real-key bytes win; durable record bytes are the fallback; blank only when
// no previous real key exists; a previous key whose bytes are unavailable
// fails closed (never a silent blank key).
describe('useRotoKeyUtilities addKey nearest previous real key (261019-mj2 Task 4)', () => {
  it('clones the nearest previous real record and keeps the destination at the cursor', async () => {
    const durableNearest = testWebpBytes('durable-nearest');
    const harness = createHarness({
      currentFrame: 8,
      realKeyFrames: [realKeyFrame(2), realKeyFrame(5)],
      records: [
        realKeyRecord('key-2', 2, 'durable-earlier'),
        realKeyRecord('key-5', 5, 'durable-nearest'),
        realKeyRecord('key-later', 9, 'durable-later'),
      ],
      cachedRotoFrames: [],
    });

    harness.utils.addKey();
    await flushAsync();

    expect(harness.addEmptyKey).toHaveBeenCalledTimes(1);
    const [destinationAppFrame, payload] = harness.addEmptyKey.mock.calls[0];
    expect(destinationAppFrame).toBe(8);
    expect(payload.appFrame).toBe(8);
    expect(payload.bytes).toEqual(durableNearest);
    expect(payload.width).toBe(100);
    expect(payload.height).toBe(80);
    // The later key never moves: only the destination paste runs.
    expect(harness.buildBlankRotoFrame).not.toHaveBeenCalled();
  });

  it('prefers the cached real-key bytes at the previous frame over durable record bytes', async () => {
    const cachedBytes = testWebpBytes('cached-previous');
    const harness = createHarness({
      currentFrame: 8,
      realKeyFrames: [realKeyFrame(5)],
      records: [realKeyRecord('key-5', 5, 'durable-previous')],
      cachedRotoFrames: [
        { ...realKeyFrame(5), bytes: testWebpBytes('other-frame'), appFrame: 2 },
        { ...realKeyFrame(5), bytes: cachedBytes, width: 120, height: 90 },
      ],
    });

    harness.utils.addKey();
    await flushAsync();

    expect(harness.addEmptyKey).toHaveBeenCalledTimes(1);
    const [destinationAppFrame, payload] = harness.addEmptyKey.mock.calls[0];
    expect(destinationAppFrame).toBe(8);
    expect(payload.appFrame).toBe(8);
    expect(payload.bytes).toEqual(cachedBytes);
    expect(payload.width).toBe(120);
    expect(payload.height).toBe(90);
  });

  it('uses a blank payload only when no previous real key exists', async () => {
    const blankBytes = testWebpBytes('blank-payload');
    const buildBlankRotoFrame = vi.fn(async (_frame: number) => ({
      ...realKeyFrame(0),
      bytes: blankBytes,
      width: 64,
      height: 64,
    }));
    const harness = createHarness({
      currentFrame: 0,
      realKeyFrames: [realKeyFrame(3)],
      records: [realKeyRecord('key-later', 3)],
      cachedRotoFrames: [],
      buildBlankRotoFrame,
    });

    harness.utils.addKey();
    await flushAsync();

    expect(buildBlankRotoFrame).toHaveBeenCalledWith(0);
    expect(harness.addEmptyKey).toHaveBeenCalledTimes(1);
    const [destinationAppFrame, payload] = harness.addEmptyKey.mock.calls[0];
    expect(destinationAppFrame).toBe(0);
    expect(payload.bytes).toEqual(blankBytes);
  });

  it.each([
    ['missing', realKeyRecordWithoutBytes('key-prev', 5)],
    ['empty', realKeyRecordWithoutBytes('key-prev', 5, true)],
  ])('fails closed when the previous key bytes are %s — no blank key is created', async (_label, previousRecord) => {
    const buildBlankRotoFrame = vi.fn(async (frame: number) => realKeyFrame(frame));
    const harness = createHarness({
      currentFrame: 8,
      realKeyFrames: [realKeyFrame(5)],
      records: [previousRecord],
      cachedRotoFrames: [],
      buildBlankRotoFrame,
    });

    harness.utils.addKey();
    await flushAsync();

    expect(buildBlankRotoFrame).not.toHaveBeenCalled();
    expect(harness.addEmptyKey).not.toHaveBeenCalled();
    expect(harness.setApplyStatus).toHaveBeenCalledWith('error');
    expect(String(harness.setLastError.mock.calls[0]?.[0])).toContain('previous key bytes unavailable');
    expect(String(harness.setApplyMessage.mock.calls[0]?.[0])).toContain('previous key bytes unavailable');
  });
});

// Quick 261023-bxm Task 1: Duplicate settles the source key's DISPLAYED paint
// before cloning when the record carries no inline bytes, so a script result,
// an unfinished settle, or a dirty preview is never cloned as a blank key.
describe('useRotoKeyUtilities duplicateKey source paint (261023-bxm Task 1)', () => {
  it('settles the displayed paint onto the source key, then duplicates it', async () => {
    const displayedBytes = testWebpBytes('displayed-paint');
    const displayed: RotoDisplayedKeyPaint = { keyId: 'key-a', bytes: displayedBytes, width: 100, height: 80 };
    const records: PhysicPaintRotoRealKeyRecord[] = [realKeyRecordWithoutBytes('key-a', 3)];
    let settleBake: (() => void) | null = null;
    const bakeRotoKeyPaint = vi.fn((_paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => new Promise<boolean>((resolve) => {
      settleBake = () => {
        records[0] = realKeyRecord('key-a', 3, 'settled');
        resolve(true);
      };
    }));
    const harness = createHarness({
      currentFrame: 3,
      records,
      realKeyFrames: [realKeyFrame(3)],
      resolveDisplayedKeyPaint: () => displayed,
      bakeRotoKeyPaint,
    });

    harness.utils.duplicateKey();
    await flushAsync();

    // The source is settled first and the duplicate has not run yet.
    expect(bakeRotoKeyPaint).toHaveBeenCalledTimes(1);
    expect(bakeRotoKeyPaint).toHaveBeenCalledWith({
      keyId: 'key-a',
      appFrame: 3,
      bytes: displayedBytes,
      width: 100,
      height: 80,
    });
    expect(harness.input.physicalKeyUtilities.duplicateKey).not.toHaveBeenCalled();

    if (!settleBake) throw new Error('expected a pending bake');
    (settleBake as () => void)();
    await flushAsync();

    // Only after the settlement lands is the unchanged duplicate issued.
    expect(harness.input.physicalKeyUtilities.duplicateKey).toHaveBeenCalledTimes(1);
    expect(harness.input.physicalKeyUtilities.duplicateKey).toHaveBeenCalledWith('key-a');
  });

  it('fails closed without baking or duplicating when no displayed paint resolves', async () => {
    const bakeRotoKeyPaint = vi.fn(async (_paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => true);
    const resolveDisplayedKeyPaint = vi.fn(() => null);
    const harness = createHarness({
      currentFrame: 3,
      records: [realKeyRecordWithoutBytes('key-a', 3)],
      realKeyFrames: [realKeyFrame(3)],
      resolveDisplayedKeyPaint,
      bakeRotoKeyPaint,
    });

    harness.utils.duplicateKey();
    await flushAsync();

    expect(resolveDisplayedKeyPaint).toHaveBeenCalledWith(3);
    expect(bakeRotoKeyPaint).not.toHaveBeenCalled();
    expect(harness.input.physicalKeyUtilities.duplicateKey).not.toHaveBeenCalled();
    expect(harness.setApplyStatus).toHaveBeenCalledWith('error');
    expect(String(harness.setApplyMessage.mock.calls[0]?.[0])).toContain('source key paint unavailable');
    expect(harness.setLastError).toHaveBeenCalledWith(ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR);
  });

  it('fails closed when the displayed paint belongs to another key', async () => {
    const bakeRotoKeyPaint = vi.fn(async (_paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => true);
    const harness = createHarness({
      currentFrame: 3,
      records: [realKeyRecordWithoutBytes('key-a', 3)],
      realKeyFrames: [realKeyFrame(3)],
      resolveDisplayedKeyPaint: () => ({ keyId: 'key-other', bytes: testWebpBytes('other-key-paint') }),
      bakeRotoKeyPaint,
    });

    harness.utils.duplicateKey();
    await flushAsync();

    expect(bakeRotoKeyPaint).not.toHaveBeenCalled();
    expect(harness.input.physicalKeyUtilities.duplicateKey).not.toHaveBeenCalled();
    expect(harness.setApplyStatus).toHaveBeenCalledWith('error');
    expect(String(harness.setApplyMessage.mock.calls[0]?.[0])).toContain('source key paint unavailable');
  });

  it('fails closed when the bake settles without bytes on the source record', async () => {
    const bakeRotoKeyPaint = vi.fn(async (_paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => false);
    const harness = createHarness({
      currentFrame: 3,
      records: [realKeyRecordWithoutBytes('key-a', 3)],
      realKeyFrames: [realKeyFrame(3)],
      resolveDisplayedKeyPaint: () => ({ keyId: 'key-a', bytes: testWebpBytes('displayed-paint') }),
      bakeRotoKeyPaint,
    });

    harness.utils.duplicateKey();
    await flushAsync();

    expect(bakeRotoKeyPaint).toHaveBeenCalledTimes(1);
    expect(harness.input.physicalKeyUtilities.duplicateKey).not.toHaveBeenCalled();
    expect(harness.setApplyStatus).toHaveBeenCalledWith('error');
    expect(harness.setApplyMessage).toHaveBeenCalledWith('Could not duplicate the Roto key — source key paint unavailable.');
    expect(harness.setLastError).toHaveBeenCalledWith(ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR);
  });

  it('proceeds when a false bake result nevertheless settled the source bytes', async () => {
    const records: PhysicPaintRotoRealKeyRecord[] = [realKeyRecordWithoutBytes('key-a', 3)];
    const bakeRotoKeyPaint = vi.fn(async (_paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => {
      records[0] = realKeyRecord('key-a', 3, 'settled');
      return false;
    });
    const harness = createHarness({
      currentFrame: 3,
      records,
      realKeyFrames: [realKeyFrame(3)],
      resolveDisplayedKeyPaint: () => ({ keyId: 'key-a', bytes: testWebpBytes('displayed-paint') }),
      bakeRotoKeyPaint,
    });

    harness.utils.duplicateKey();
    await flushAsync();

    expect(harness.input.physicalKeyUtilities.duplicateKey).toHaveBeenCalledTimes(1);
    expect(harness.input.physicalKeyUtilities.duplicateKey).toHaveBeenCalledWith('key-a');
    expect(harness.setApplyStatus).not.toHaveBeenCalledWith('error');
  });

  it('duplicates immediately without baking when the source record already carries bytes', async () => {
    const bakeRotoKeyPaint = vi.fn(async (_paint: { keyId: string; appFrame: number; bytes: Uint8Array; width?: number; height?: number }) => true);
    const harness = createHarness({
      currentFrame: 3,
      records: [realKeyRecord('key-a', 3)],
      realKeyFrames: [realKeyFrame(3)],
      resolveDisplayedKeyPaint: () => ({ keyId: 'key-a', bytes: testWebpBytes('displayed-paint') }),
      bakeRotoKeyPaint,
    });

    harness.utils.duplicateKey();
    await flushAsync();

    expect(bakeRotoKeyPaint).not.toHaveBeenCalled();
    expect(harness.input.physicalKeyUtilities.duplicateKey).toHaveBeenCalledTimes(1);
    expect(harness.input.physicalKeyUtilities.duplicateKey).toHaveBeenCalledWith('key-a');
  });
});
