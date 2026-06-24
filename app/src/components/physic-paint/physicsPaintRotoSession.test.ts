import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import { buildRotoKeyUtilityTransaction } from './physicsPaintRotoKeyController';
import { createRotoSession, type RotoSessionEffect } from './physicsPaintRotoSession';

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

function effectTypes(effects: readonly RotoSessionEffect[]): string[] {
  return effects.map((effect) => effect.type);
}

describe('physicsPaintRotoSession save orchestration boundary', () => {
  it('36.8-REG-05 D-10 saves the dirty source before navigation and resumes only after success', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [5],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const saveResult = session.requestFrame(8);

    expect(saveResult.ok).toBe(true);
    expect(effectTypes(saveResult.effects)).toEqual(['saveFrame']);
    expect(saveResult.effects[0]).toMatchObject({ type: 'saveFrame', frame: 5, reason: 'beforeNavigate', after: { type: 'navigate', frame: 8 } });
    expect(session.currentFrame.value).toBe(5);
    expect(session.savingFrame.value).toBe(5);
    expect(session.pendingNavigationFrame.value).toBe(8);
    expect(session.currentFrameIsDirty.value).toBe(true);

    const resumed = session.onSaveSucceeded(5);

    expect(resumed.ok).toBe(true);
    expect(effectTypes(resumed.effects)).toEqual(['navigate']);
    expect(resumed.effects[0]).toMatchObject({ type: 'navigate', frame: 8 });
    expect(session.currentFrame.value).toBe(8);
    expect(session.dirtyFrames.value).not.toContain(5);
    expect(session.savingFrame.value).toBeNull();
    expect(session.pendingNavigationFrame.value).toBeNull();
  });

  it('36.8-REG-05 D-10 saves the dirty source before a key action and defers mutation until save success', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [5],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const saveResult = session.deleteKey();

    expect(saveResult.ok).toBe(true);
    expect(effectTypes(saveResult.effects)).toEqual(['saveFrame']);
    expect(saveResult.effects[0]).toMatchObject({ type: 'saveFrame', frame: 5, reason: 'beforeAction', after: { type: 'keyAction', operation: 'delete' } });
    expect(session.realKeyFrameNumbers.value).toEqual([5, 8]);
    expect(session.dirtyFrames.value).toContain(5);
    expect(session.savingFrame.value).toBe(5);
    expect(session.pendingKeyAction.value).toBe('delete');

    const resumed = session.onSaveSucceeded(5);

    expect(resumed.ok).toBe(true);
    expect(effectTypes(resumed.effects)).toEqual(['replaceKeys', 'clearCanvas', 'restoreFrame', 'clearDeletedFrames']);
    expect(session.realKeyFrameNumbers.value).toEqual([7]);
    expect(session.realKeyFrames.value.find((candidate) => candidate.dataUrl === 'data:image/png;base64,real-five')).toBeUndefined();
    expect(session.dirtyFrames.value).not.toContain(5);
    expect(session.pendingKeyAction.value).toBeNull();
  });

  it('36.8-REG-05 D-11 keeps failed save dirty, clears queued work, and requires explicit retry', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [5],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    session.requestFrame(8);
    const failed = session.onSaveFailed(5, 'bridge unavailable');

    expect(failed.ok).toBe(false);
    expect(failed.effects).toEqual([]);
    expect(session.currentFrame.value).toBe(5);
    expect(session.dirtyFrames.value).toContain(5);
    expect(session.savingFrame.value).toBeNull();
    expect(session.pendingNavigationFrame.value).toBeNull();
    expect(session.pendingKeyAction.value).toBeNull();
    expect(session.feedback.value).toContain('frame 5');
    expect(session.feedback.value).toContain('bridge unavailable');
    expect(session.failedSaveFeedback.value).toMatchObject({ frame: 5, message: expect.stringContaining('bridge unavailable') });

    const retry = session.requestFrame(8);
    expect(effectTypes(retry.effects)).toEqual(['saveFrame']);
    expect(retry.effects[0]).toMatchObject({ type: 'saveFrame', frame: 5, reason: 'beforeNavigate', after: { type: 'navigate', frame: 8 } });
  });

  it('36.8-REG-05 D-11 clears a failed queued key action without mutating ownership', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [5],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    session.deleteKey();
    const failed = session.onSaveFailed(5, 'disk full');

    expect(failed.ok).toBe(false);
    expect(session.realKeyFrameNumbers.value).toEqual([5, 8]);
    expect(session.dirtyFrames.value).toContain(5);
    expect(session.savingFrame.value).toBeNull();
    expect(session.pendingKeyAction.value).toBeNull();
    expect(session.pendingNavigationFrame.value).toBeNull();

    const retry = session.deleteKey();
    expect(effectTypes(retry.effects)).toEqual(['saveFrame']);
    expect(retry.effects[0]).toMatchObject({ type: 'saveFrame', frame: 5, reason: 'beforeAction', after: { type: 'keyAction', operation: 'delete' } });
  });

  it('D-13 exposes dirty current-frame state without owning close-window prompt APIs', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,real-five')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,real-five')],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    expect(session.currentFrameIsDirty.value).toBe(false);
    session.markDirty(5);
    expect(session.currentFrameIsDirty.value).toBe(true);
    expect('requestClose' in session).toBe(false);
    expect('confirmClose' in session).toBe(false);
    expect('closeWindow' in session).toBe(false);
    expect('tauriClose' in session).toBe(false);
  });
});

describe('physicsPaintRotoSession boundary clean key transactions', () => {
  it('36.8-REG-01 D-01/D-04/D-06/D-07/D-12/D-14/D-15 inserts a blank key that stays clean until markDirty', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,real-five')],
      cachedRotoFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(5, 'data:image/png;base64,real-five'),
        frame(4, 'data:image/png;base64,generated-four', 'generated-interpolation'),
        { ...frame(5, 'data:image/png;base64,reference-five', 'generated-interpolation'), nearestRealKeyFrame: 5 },
      ],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const result = session.insertBlankKey();

    expect(result.ok).toBe(true);
    expect(effectTypes(result.effects)).toEqual(['replaceKeys', 'restoreFrame', 'clearGeneratedFrames', 'clearCachedReferences']);
    expect(result.effects.find((effect) => effect.type === 'replaceKeys')).toMatchObject({
      frames: [frame(2, 'data:image/png;base64,real-two'), blankFrame(5), frame(6, 'data:image/png;base64,real-five')],
    });
    expect(result.effects.find((effect) => effect.type === 'restoreFrame')).toMatchObject({ restore: { kind: 'blank-real-key', frame: 5 } });
    expect(session.realKeyFrameNumbers.value).toEqual([2, 5, 6]);
    expect(session.dirtyFrames.value).not.toContain(5);

    const stayResult = session.requestFrame(5);
    expect(stayResult.ok).toBe(true);
    expect(effectTypes(stayResult.effects)).toEqual(['navigate']);
    expect(session.dirtyFrames.value).not.toContain(5);

    session.markDirty(5);
    expect(session.dirtyFrames.value).toContain(5);
  });

  it('36.8-REG-02 D-01/D-04/D-06/D-07/D-12/D-14/D-15 deletes real keys and returns generated/reference/deleted cleanup descriptors', () => {
    const session = createRotoSession({
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
        { ...frame(5, 'data:image/png;base64,reference-five', 'generated-interpolation'), nearestRealKeyFrame: 5 },
        frame(7, 'data:image/png;base64,generated-seven', 'generated-interpolation'),
      ],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const result = session.deleteKey();

    expect(result.ok).toBe(true);
    expect(session.realKeyFrameNumbers.value).toEqual([2, 5]);
    expect(session.realKeyFrames.value.find((candidate) => candidate.dataUrl === 'data:image/png;base64,real-five')).toBeUndefined();
    expect(session.generatedFrameNumbers.value).not.toContain(5);
    expect(session.dirtyFrames.value).not.toContain(5);
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'replaceKeys', removedFrames: [4, 5, 6, 7] }),
      expect.objectContaining({ type: 'restoreFrame', restore: { kind: 'load-real-key', frame: 5 } }),
      expect.objectContaining({ type: 'clearGeneratedFrames', frames: [4, 5, 7] }),
      expect.objectContaining({ type: 'clearCachedReferences', frames: [5] }),
      expect.objectContaining({ type: 'clearDeletedFrames', frames: [5] }),
    ]));
  });

  it('36.8-REG-03 D-01/D-04/D-06/D-07/D-12/D-14/D-15/D-16 pastes onto empty or generated targets as clean real keys', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two')],
      cachedRotoFrames: [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,generated-five', 'generated-interpolation')],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const copyResult = session.copyKey();
    expect(copyResult.ok).toBe(true);
    expect(session.copiedKey.value?.frame).toBe(2);

    session.requestFrame(5);
    const pasteGeneratedResult = session.pasteKey();
    const pastedGenerated = session.realKeyFrames.value.find((candidate) => candidate.appFrame === 5);

    expect(pasteGeneratedResult.ok).toBe(true);
    expect(pastedGenerated).toMatchObject({ appFrame: 5, dataUrl: 'data:image/png;base64,real-two', source: 'real-key' });
    expect(pastedGenerated).not.toHaveProperty('nearestRealKeyFrame');
    expect(session.generatedFrameNumbers.value).not.toContain(5);
    expect(session.dirtyFrames.value).not.toContain(5);
    expect(pasteGeneratedResult.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'replaceKeys' }),
      expect.objectContaining({ type: 'clearGeneratedFrames', frames: [5] }),
      expect.objectContaining({ type: 'restoreFrame', restore: { kind: 'load-real-key', frame: 5 } }),
    ]));

    session.requestFrame(8);
    const pasteEmptyResult = session.pasteKey();
    const pastedEmpty = session.realKeyFrames.value.find((candidate) => candidate.appFrame === 8);

    expect(pasteEmptyResult.ok).toBe(true);
    expect(pastedEmpty).toMatchObject({ appFrame: 8, dataUrl: 'data:image/png;base64,real-two', source: 'real-key' });
    expect(pastedEmpty).not.toHaveProperty('nearestRealKeyFrame');
    expect(session.dirtyFrames.value).not.toContain(8);
  });

  it('36.8-REG-04 D-01/D-04/D-06/D-07/D-09/D-14/D-15 duplicateKey preserves public helper transaction parity', () => {
    const realKeyFrames = [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,real-five')];
    const cachedRotoFrames = [...realKeyFrames, frame(4, 'data:image/png;base64,generated-four', 'generated-interpolation')];
    const expected = buildRotoKeyUtilityTransaction({
      operation: 'duplicate',
      currentFrame: 2,
      realKeyFrames,
      cachedRotoFrames,
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames,
      cachedRotoFrames,
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const result = session.duplicateKey();

    expect(result.ok).toBe(true);
    expect(result.transaction).toMatchObject({
      realKeyFrameNumbers: expected.realKeyFrameNumbers,
      changedFrames: expected.changedFrames,
      removedFrames: expected.removedFrames,
      frameMappings: expected.frameMappings,
      successMessage: expected.successMessage,
    });
    expect(session.realKeyFrameNumbers.value).toEqual(expected.realKeyFrameNumbers);
    expect(result.effects.find((effect) => effect.type === 'replaceKeys')).toMatchObject({
      frames: expected.realKeyFrames,
      changedFrames: expected.changedFrames,
      removedFrames: expected.removedFrames,
    });
  });
});
