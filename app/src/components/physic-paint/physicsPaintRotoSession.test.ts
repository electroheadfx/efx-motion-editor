import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import { buildRotoKeyUtilityTransaction } from './physicsPaintRotoKeyController';
import { createRotoSession, type RotoSessionEffect } from './physicsPaintRotoSession';
import { resolveRotoFarEmptyDisplaySaveTarget } from './physicsPaintWorkflowState';

function frame(appFrame: number, dataUrl: string, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl,
    width: 100,
    height: 100,
    source,
    ...(source === 'generated-interpolation' ? { nearestRealKeyFrame: 2 } : {}),
    ...(source === 'background-only-support' ? { backgroundOnly: true, nearestRealKeyFrame: 2 } : {}),
  };
}

function blankFrame(appFrame: number): PhysicPaintRotoCacheFrame {
  return frame(appFrame, `data:image/png;base64,blank-${appFrame}`, 'real-key');
}

function effectTypes(effects: readonly RotoSessionEffect[]): string[] {
  return effects.map((effect) => effect.type);
}

describe('physicsPaintRotoSession cached-base repaint clean/no-change boundary', () => {
  it('36.11 D-04/D-09 keeps a loaded cached real key clean and preserves it on navigation with no save effect', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,cached-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,cached-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const loaded = session.markCachedBaseLoaded(5);
    const navigate = session.requestFrame(8);

    expect(loaded.ok).toBe(true);
    expect(loaded.effects).toEqual([]);
    expect(loaded.message).toContain('visible and non-editable');
    expect(session.currentFrameIsDirty.value).toBe(false);
    expect(session.dirtyFrames.value).not.toContain(5);
    expect(effectTypes(navigate.effects)).toEqual(['navigate']);
    expect(navigate.effects).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'saveFrame' })]));
    expect(session.currentFrame.value).toBe(8);
  });

  it('36.11 D-11 marks only the cached-base frame dirty on the first live overlay edit and queues save-before-navigation', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,cached-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,cached-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    session.markCachedBaseLoaded(5);
    const edited = session.markLiveOverlayDirty(5);
    const navigate = session.requestFrame(8);

    expect(edited.ok).toBe(true);
    expect(session.dirtyFrames.value).toEqual([5]);
    expect(session.currentFrameIsDirty.value).toBe(true);
    expect(effectTypes(navigate.effects)).toEqual(['saveFrame']);
    expect(navigate.effects[0]).toMatchObject({ type: 'saveFrame', frame: 5, reason: 'beforeNavigate', after: { type: 'navigate', frame: 8 } });
  });

  it('36.11 D-07/D-12 returns to clean cached-base state when Undo or Clear empties the live overlay', () => {
    const session = createRotoSession({
      currentFrame: 5,
      realKeyFrames: [frame(5, 'data:image/png;base64,cached-five'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [frame(5, 'data:image/png;base64,cached-five'), frame(8, 'data:image/png;base64,real-eight')],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    session.markCachedBaseLoaded(5);
    session.markLiveOverlayDirty(5);
    const emptied = session.markLiveOverlayEmpty(5);
    const navigate = session.requestFrame(8);

    expect(emptied.ok).toBe(true);
    expect(session.dirtyFrames.value).not.toContain(5);
    expect(session.currentFrameIsDirty.value).toBe(false);
    expect(effectTypes(navigate.effects)).toEqual(['navigate']);
    expect(navigate.effects).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'saveFrame' })]));
  });
});

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

describe('physicsPaintRotoSession generated interpolation render-only boundary', () => {
  it('36.12-GENERATED-FRAMES includes generated render-only frames in playback display order', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two'), frame(6, 'data:image/png;base64,real-six')],
      cachedRotoFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(4, 'data:image/png;base64,generated-four', 'generated-interpolation'),
        frame(6, 'data:image/png;base64,real-six'),
        frame(5, 'data:image/png;base64,background-five', 'background-only-support'),
      ],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    expect(session.realKeyFrameNumbers.value).toEqual([2, 6]);
    expect(session.generatedFrameNumbers.value).toEqual([4]);
    expect(session.backgroundOnlySupportFrameNumbers.value).toEqual([5]);
    expect(session.playbackFrameNumbers.value).toEqual([2, 4, 6]);
  });

  it('36.12 D-16 allows generated preview selection while keeping source key actions disabled', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two'), frame(6, 'data:image/png;base64,real-six')],
      cachedRotoFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(4, 'data:image/png;base64,generated-four', 'generated-interpolation'),
        frame(6, 'data:image/png;base64,real-six'),
      ],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    const selected = session.requestFrame(4);

    expect(selected.ok).toBe(true);
    expect(effectTypes(selected.effects)).toEqual(['navigate']);
    expect(selected.effects[0]).toMatchObject({ type: 'navigate', frame: 4 });
    expect(session.currentFrame.value).toBe(4);
    expect(session.generatedFrameNumbers.value).toEqual([4]);
    expect(session.realKeyFrameNumbers.value).toEqual([2, 6]);
    expect(session.actionAvailability.value).toMatchObject({
      canDuplicate: false,
      canInsert: false,
      canCopy: false,
      canDelete: false,
    });
    expect(session.actionAvailability.value.disabledReason).toBe('Generated frame 4 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.');
    expect(session.duplicateKey()).toMatchObject({ ok: false, message: 'Generated frame 4 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.' });
    expect(session.insertBlankKey()).toMatchObject({ ok: false, message: 'Generated frame 4 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.' });
    expect(session.copyKey()).toMatchObject({ ok: false, message: 'Generated frame 4 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.' });
    expect(session.deleteKey()).toMatchObject({ ok: false, message: 'Generated frame 4 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.' });
  });
});

describe('physicsPaintRotoSession segment spacing override transactions', () => {
  it('36.13 D-10 propagates rebased duplicate overrides through replaceKeys transaction output', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [
        frame(0, 'data:image/png;base64,real-zero'),
        frame(2, 'data:image/png;base64,real-two'),
        frame(6, 'data:image/png;base64,real-six'),
      ],
      cachedRotoFrames: [],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }],
      buildBlankRotoFrame: blankFrame,
    });

    const result = session.duplicateKey();
    const replaceKeys = result.effects.find((effect) => effect.type === 'replaceKeys');

    expect(result.ok).toBe(true);
    expect(replaceKeys).toMatchObject({
      transaction: {
        segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 7, inBetweenCount: 4 }],
      },
    });
    expect(result.transaction?.segmentSpacingOverrides).toEqual([{ fromSourceFrame: 3, toSourceFrame: 7, inBetweenCount: 4 }]);
    expect(session.realKeyFrameNumbers.value).toEqual([0, 2, 3, 7]);
  });

  it('36.13 D-11 propagates deleted-key override drops without custom merged timing', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [
        frame(0, 'data:image/png;base64,real-zero'),
        frame(2, 'data:image/png;base64,real-two'),
        frame(6, 'data:image/png;base64,real-six'),
      ],
      cachedRotoFrames: [],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }],
      buildBlankRotoFrame: blankFrame,
    });

    const result = session.deleteKey();
    const replaceKeys = result.effects.find((effect) => effect.type === 'replaceKeys');

    expect(result.ok).toBe(true);
    expect(replaceKeys).toMatchObject({ transaction: { segmentSpacingOverrides: [] } });
    expect(result.transaction?.segmentSpacingOverrides).toEqual([]);
    expect(session.realKeyFrameNumbers.value).toEqual([0, 5]);
  });

  it('36.13 D-12 resolves far-empty paste targets and propagates previous-segment custom spacing', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [
        frame(0, 'data:image/png;base64,real-zero'),
        frame(2, 'data:image/png;base64,real-two'),
      ],
      cachedRotoFrames: [],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      segmentSpacingOverrides: [],
      resolvePasteTargetForDisplayFrame: (displayFrame) => displayFrame === 11
        ? { displayFrame, sourceFrame: 6, previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 } }
        : null,
      buildBlankRotoFrame: blankFrame,
    });

    expect(session.copyKey().ok).toBe(true);
    session.requestFrame(11);
    const result = session.pasteKey();
    const replaceKeys = result.effects.find((effect) => effect.type === 'replaceKeys');

    expect(result.ok).toBe(true);
    expect(session.currentFrame.value).toBe(6);
    expect(session.realKeyFrameNumbers.value).toEqual([0, 2, 6]);
    expect(replaceKeys).toMatchObject({
      transaction: {
        segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }],
      },
    });
  });

  it('UAT truth table pastes at normal display #9 exactly like Save current', () => {
    const settings = { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const };
    const saveTarget = resolveRotoFarEmptyDisplaySaveTarget(9, [0, 1, 2], settings);
    const realKeyFrames = [
      { ...frame(0, 'data:image/png;base64,real-zero'), sourceFrame: 0, displayFrame: 0 },
      { ...frame(3, 'data:image/png;base64,real-one'), sourceFrame: 1, displayFrame: 3 },
      { ...frame(6, 'data:image/png;base64,real-two'), sourceFrame: 2, displayFrame: 6 },
    ];
    const session = createRotoSession({
      currentFrame: 6,
      realKeyFrames,
      cachedRotoFrames: realKeyFrames,
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      segmentSpacingOverrides: [],
      resolvePasteTargetForDisplayFrame: (displayFrame) => resolveRotoFarEmptyDisplaySaveTarget(displayFrame, [0, 1, 2], settings),
      buildBlankRotoFrame: blankFrame,
    });

    expect(saveTarget).toEqual({ displayFrame: 9, sourceFrame: 3, previousSegmentOverride: null });
    expect(session.copyKey().ok).toBe(true);
    session.requestFrame(9);
    const result = session.pasteKey();

    expect(result.ok).toBe(true);
    expect(result.transaction).toMatchObject({
      realKeyFrameNumbers: [0, 1, 2, 3],
      activeFrame: 3,
      segmentSpacingOverrides: [],
    });
    expect(result.transaction?.frameMappings).toEqual([{ fromFrame: 2, toFrame: 3, mode: 'copy' }]);
  });

  it('UAT truth table pastes at custom display #14 exactly like Save current', () => {
    const settings = { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const };
    const saveTarget = resolveRotoFarEmptyDisplaySaveTarget(14, [0, 1, 2], settings);
    const realKeyFrames = [
      { ...frame(0, 'data:image/png;base64,real-zero'), sourceFrame: 0, displayFrame: 0 },
      { ...frame(3, 'data:image/png;base64,real-one'), sourceFrame: 1, displayFrame: 3 },
      { ...frame(6, 'data:image/png;base64,real-two'), sourceFrame: 2, displayFrame: 6 },
    ];
    const session = createRotoSession({
      currentFrame: 6,
      realKeyFrames,
      cachedRotoFrames: realKeyFrames,
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      segmentSpacingOverrides: [],
      resolvePasteTargetForDisplayFrame: (displayFrame) => resolveRotoFarEmptyDisplaySaveTarget(displayFrame, [0, 1, 2], settings),
      buildBlankRotoFrame: blankFrame,
    });

    expect(saveTarget).toEqual({
      displayFrame: 14,
      sourceFrame: 9,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 9, inBetweenCount: 7 },
    });
    expect(session.copyKey().ok).toBe(true);
    session.requestFrame(14);
    const result = session.pasteKey();

    expect(result.ok).toBe(true);
    expect(result.transaction).toMatchObject({
      realKeyFrameNumbers: [0, 1, 2, 9],
      activeFrame: 9,
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 9, inBetweenCount: 7 }],
    });
    expect(result.transaction?.frameMappings).toEqual([{ fromFrame: 2, toFrame: 9, mode: 'copy' }]);
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

  it('36.10 D-09 pastes over background-only support as a real key with exact replacement feedback', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two')],
      cachedRotoFrames: [frame(2, 'data:image/png;base64,real-two'), frame(5, 'data:image/png;base64,background-five', 'background-only-support')],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    expect(session.realKeyFrameNumbers.value).toEqual([2]);
    expect(session.backgroundOnlySupportFrameNumbers.value).toEqual([5]);
    expect(session.generatedFrameNumbers.value).toEqual([]);
    expect(session.playbackFrameNumbers.value).toEqual([2]);

    expect(session.copyKey().ok).toBe(true);
    session.requestFrame(5);
    const result = session.pasteKey();

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Frame 5 saved as a real Roto key');
    expect(session.feedback.value).toBe('Frame 5 saved as a real Roto key');
    expect(session.realKeyFrameNumbers.value).toEqual([2, 5]);
    expect(session.backgroundOnlySupportFrameNumbers.value).toEqual([]);
    expect(session.playbackFrameNumbers.value).toEqual([2, 5]);
    expect(session.cachedRotoFrames.value.find((candidate) => candidate.appFrame === 5)).toMatchObject({ appFrame: 5, source: 'real-key' });
    expect(session.cachedRotoFrames.value.find((candidate) => candidate.appFrame === 5)).not.toHaveProperty('backgroundOnly');
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'replaceKeys' }),
      expect.objectContaining({ type: 'clearBackgroundOnlySupport', frames: [5] }),
      expect.objectContaining({ type: 'restoreFrame', restore: { kind: 'load-real-key', frame: 5 } }),
    ]));
  });

  it('36.10 D-10/D-11 excludes background-only support from real-key playback and clears support on transactions', () => {
    const session = createRotoSession({
      currentFrame: 2,
      realKeyFrames: [frame(2, 'data:image/png;base64,real-two'), frame(8, 'data:image/png;base64,real-eight')],
      cachedRotoFrames: [
        frame(2, 'data:image/png;base64,real-two'),
        frame(5, 'data:image/png;base64,background-five', 'background-only-support'),
        frame(8, 'data:image/png;base64,real-eight'),
      ],
      dirtyFrames: [],
      canvasSize: { width: 100, height: 100 },
      buildBlankRotoFrame: blankFrame,
    });

    expect(session.realKeyFrameNumbers.value).toEqual([2, 8]);
    expect(session.playbackFrameNumbers.value).toEqual([2, 8]);
    expect(session.backgroundOnlySupportFrameNumbers.value).toEqual([5]);

    const result = session.duplicateKey();

    expect(result.ok).toBe(true);
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'clearBackgroundOnlySupport', frames: [5] }),
    ]));
    expect(session.backgroundOnlySupportFrameNumbers.value).toEqual([]);
    expect(session.playbackFrameNumbers.value).toEqual([2, 3, 9]);
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
