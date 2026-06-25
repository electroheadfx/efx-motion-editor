import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import {
  applyRotoKeyUtilityTransactionToLocalState,
  buildRotoKeyUtilityTransaction,
  deriveRotoKeyUtilityActionState,
  type RotoKeyUtilityOperation,
} from './physicsPaintRotoKeyController';

const controllerPath = fileURLToPath(new URL('./physicsPaintRotoKeyController.ts', import.meta.url));
const controllerSource = () => readFileSync(controllerPath, 'utf8');

function frame(appFrame: number, dataUrl: string, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl,
    width: 100,
    height: 100,
    source,
    ...(source === 'generated-interpolation' ? { nearestRealKeyFrame: 2 } : {}),
  };
}

function blankFrame(appFrame: number): PhysicPaintRotoCacheFrame {
  return frame(appFrame, `data:image/png;base64,blank-${appFrame}`, 'real-key');
}

function operationNames(operations: readonly RotoKeyUtilityOperation[]): string[] {
  return [...operations].sort();
}

describe('physicsPaintRotoKeyController transaction coherence', () => {
  it('D-02/D-04/D-10 inserts a clean blank real key and excludes stale generated/reference payloads', () => {
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'insert',
      currentFrame: 5,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,real-five')],
      cachedRotoFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(5, 'data:image/png;base64,real-five'),
        frame(4, 'data:image/png;base64,generated-five', 'generated-interpolation'),
        { ...frame(5, 'data:image/png;base64,yellow-reference', 'generated-interpolation'), nearestRealKeyFrame: 5 },
      ],
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrameNumbers).toEqual([2, 5, 6]);
    expect(transaction.realKeyFrames.map(({ appFrame, dataUrl }) => [appFrame, dataUrl])).toEqual([
      [2, 'data:image/png;base64,real-two'],
      [5, 'data:image/png;base64,blank-5'],
      [6, 'data:image/png;base64,real-five'],
    ]);
    expect(transaction.realKeyFrames.every((candidate) => candidate.source === 'real-key')).toBe(true);
    expect(transaction.realKeyFrames.map((candidate) => candidate.dataUrl)).not.toContain('data:image/png;base64,generated-five');
    expect(transaction.realKeyFrames.map((candidate) => candidate.dataUrl)).not.toContain('data:image/png;base64,yellow-reference');
    expect(transaction.changedFrames).toEqual([5, 6]);
    expect(transaction.cleanup.generatedFrames).toEqual([4, 5]);
    expect(transaction.cleanup.referenceFrames).toEqual([5]);
    expect(transaction.activeFrame).toBe(5);
    expect(transaction.activeRestore).toEqual({ kind: 'blank-real-key', frame: 5 });
  });

  it('D-03/D-04/D-07/D-10 deletes a real key, shifts later keys, and clears generated/deleted state', () => {
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'delete',
      currentFrame: 5,
      realKeyFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(5, 'data:image/png;base64,real-five'),
        frame(6, 'data:image/png;base64,real-six'),
      ],
      cachedRotoFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(5, 'data:image/png;base64,real-five'),
        frame(6, 'data:image/png;base64,real-six'),
        frame(4, 'data:image/png;base64,generated-four', 'generated-interpolation'),
        frame(7, 'data:image/png;base64,generated-seven', 'generated-interpolation'),
      ],
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrameNumbers).toEqual([2, 5]);
    expect(transaction.realKeyFrames.map(({ appFrame, dataUrl }) => [appFrame, dataUrl])).toEqual([
      [2, 'data:image/png;base64,real-two'],
      [5, 'data:image/png;base64,real-six'],
    ]);
    expect(transaction.removedFrames).toEqual([4, 5, 6, 7]);
    expect(transaction.cleanup.deletedFrames).toEqual([5]);
    expect(transaction.cleanup.generatedFrames).toEqual([4, 7]);
    expect(transaction.activeRestore).toEqual({ kind: 'load-real-key', frame: 5 });
  });

  it('D-03/D-07/D-10 deletes the last real key with clear-blank restore intent', () => {
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'delete',
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five')],
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrameNumbers).toEqual([]);
    expect(transaction.realKeyFrames).toEqual([]);
    expect(transaction.cleanup.deletedFrames).toEqual([5]);
    expect(transaction.activeRestore).toEqual({ kind: 'clear-blank', frame: 5 });
  });

  it('D-05/D-06/D-10 pastes to generated or empty targets as clean real-key cache truth', () => {
    const copiedFrame = frame(2, 'data:image/png;base64,real-two');
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'paste',
      currentFrame: 5,
      realKeyFrames: [copiedFrame],
      cachedRotoFrames: [
        copiedFrame,
        frame(5, 'data:image/png;base64,generated-five', 'generated-interpolation'),
      ],
      copiedKeyFrame: copiedFrame,
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrameNumbers).toEqual([2, 5]);
    expect(transaction.realKeyFrames.find((candidate) => candidate.appFrame === 5)).toMatchObject({
      appFrame: 5,
      dataUrl: 'data:image/png;base64,real-two',
      source: 'real-key',
    });
    expect(transaction.realKeyFrames.map((candidate) => candidate.dataUrl)).not.toContain('data:image/png;base64,generated-five');
    expect(transaction.cleanup.generatedFrames).toEqual([5]);
    expect(transaction.activeRestore).toEqual({ kind: 'load-real-key', frame: 5 });
  });

  it('D-01/D-04/D-10 preserves duplicate next-frame splice through the shared transaction builder', () => {
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'duplicate',
      currentFrame: 2,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,real-five')],
      cachedRotoFrames: [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,real-five')],
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrameNumbers).toEqual([2, 3, 6]);
    expect(transaction.realKeyFrames.map(({ appFrame, dataUrl }) => [appFrame, dataUrl])).toEqual([
      [2, 'data:image/png;base64,real-two'],
      [3, 'data:image/png;base64,real-two'],
      [6, 'data:image/png;base64,real-five'],
    ]);
    expect(transaction.changedFrames).toEqual([3, 6]);
    expect(transaction.activeRestore).toEqual({ kind: 'load-real-key', frame: 3 });
  });

  it('D-08/D-09 exposes derived action state for all key utilities and dirty save-before-action', () => {
    const state = deriveRotoKeyUtilityActionState({
      currentFrame: 5,
      realKeyFrameNumbers: [2, 5],
      generatedFrameNumbers: [4],
      hasCopiedRotoKey: true,
      dirtyFrameNumbers: [5],
      keyActionInFlight: false,
      applyStatus: 'idle',
      flushInFlight: false,
    });

    expect(operationNames(state.operationsRequiringRealSource)).toEqual(['copy', 'delete', 'duplicate', 'insert']);
    expect(state.canCopy).toBe(true);
    expect(state.canDuplicate).toBe(true);
    expect(state.canInsert).toBe(true);
    expect(state.canDelete).toBe(true);
    expect(state.canPaste).toBe(true);
    expect(state.dirtySaveBeforeAction).toEqual({ required: true, sourceFrame: 5 });
    expect(state.exposes).toEqual(expect.arrayContaining([
      'copy',
      'duplicate',
      'insert',
      'delete',
      'paste',
      'dirty-save-before-action',
      'active-restore-intent',
      'generated-target-cleanup',
      'deleted-frame-cleanup',
    ]));
  });

  it('36.8-REG-01/36.8-REG-02/36.8-REG-03/36.8-REG-04/36.8-REG-05/36.8-REG-06/36.8-REG-07 keeps Phase 36.8 source contracts searchable in focused gates', () => {
    const controller = controllerSource();

    for (const contract of [
      'dirty-save-before-action',
      'active-restore-intent',
      'generated-target-cleanup',
      'deleted-frame-cleanup',
      'copy',
      'duplicate',
      'insert',
      'delete',
      'paste',
    ]) {
      expect(controller).toContain(contract);
    }
  });

  it('D-10 keeps transaction frames at the launch canvas size instead of stale fitted cache dimensions', () => {
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'duplicate',
      currentFrame: 2,
      realKeyFrames: [
        { ...frame(2, 'data:image/png;base64,real-two'), width: 716, height: 468 },
        { ...frame(5, 'data:image/png;base64,real-five'), width: 716, height: 468 },
      ],
      cachedRotoFrames: [],
      canvasSize: { width: 773, height: 505 },
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrames.map(({ appFrame, width, height }) => [appFrame, width, height])).toEqual([
      [2, 773, 505],
      [3, 773, 505],
      [6, 773, 505],
    ]);
  });

  it('D-05/D-06/D-10 pastes copied keys with the target launch canvas size', () => {
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'paste',
      currentFrame: 5,
      realKeyFrames: [{ ...frame(2, 'data:image/png;base64,real-two'), width: 716, height: 468 }],
      copiedKeyFrame: { ...frame(2, 'data:image/png;base64,real-two'), width: 716, height: 468 },
      canvasSize: { width: 773, height: 505 },
      buildBlankRotoFrame: blankFrame,
    });

    expect(transaction.realKeyFrames.find((candidate) => candidate.appFrame === 5)).toMatchObject({ width: 773, height: 505 });
  });

  it('D-04/D-10 applies transaction cleanup to local editable and preview maps deterministically', () => {
    const editableStates = new Map<number, unknown>([[5, { state: 'deleted' }], [6, { state: 'shifted' }]]);
    const previewFrames = new Map<number, PhysicPaintRotoCacheFrame>([
      [5, frame(5, 'data:image/png;base64,real-five')],
      [6, frame(6, 'data:image/png;base64,real-six')],
      [7, frame(7, 'data:image/png;base64,generated-seven', 'generated-interpolation')],
    ]);
    const transaction = buildRotoKeyUtilityTransaction({
      operation: 'delete',
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five'), frame(6, 'data:image/png;base64,real-six')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five'), frame(6, 'data:image/png;base64,real-six'), frame(7, 'data:image/png;base64,generated-seven', 'generated-interpolation')],
      buildBlankRotoFrame: blankFrame,
    });

    const next = applyRotoKeyUtilityTransactionToLocalState({ editableStates, previewFrames, transaction });

    expect([...next.editableStates.keys()]).toEqual([5]);
    expect([...next.previewFrames.keys()]).toEqual([5]);
    expect(next.previewFrames.get(5)?.dataUrl).toBe('data:image/png;base64,real-six');
    expect(next.previewFrames.get(7)).toBeUndefined();
  });
});
