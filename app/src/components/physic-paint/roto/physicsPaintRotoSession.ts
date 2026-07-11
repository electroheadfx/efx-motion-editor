import { batch, computed, signal, type Signal } from '@preact/signals';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';
import {
  buildRotoKeyUtilityTransaction,
  deriveRotoKeyUtilityActionState,
  type RotoKeyUtilityActionState,
  type RotoKeyUtilityActiveRestore,
  type RotoKeyUtilityOperation,
  type RotoKeyUtilityTransaction,
} from '../roto/physicsPaintRotoKeyController';
import { getRotoReplacementSuccessLabel } from '../physicsPaintWorkflowState';

export type RotoSessionActionName = 'duplicateKey' | 'insertBlankKey' | 'deleteKey' | 'copyKey' | 'pasteKey' | 'requestFrame' | 'markDirty' | 'markCachedBaseLoaded' | 'markLiveOverlayDirty' | 'markLiveOverlayEmpty' | 'onSaveSucceeded' | 'onSaveFailed';
export type RotoSessionSaveReason = 'beforeNavigate' | 'beforeAction';
export type RotoSessionRestoreIntent = RotoKeyUtilityActiveRestore;

export interface RotoSessionCopiedKey {
  frame: number;
  cachedFrame: PhysicPaintRotoCacheFrame;
}

export type RotoSessionPendingKeyAction = Exclude<RotoKeyUtilityOperation, 'copy'>;
export type RotoSessionSaveContinuation =
  | { type: 'navigate'; frame: number }
  | { type: 'keyAction'; operation: RotoSessionPendingKeyAction };

export interface RotoSessionFailedSaveFeedback {
  frame: number;
  message: string;
}

export type RotoSessionEffect =
  | { type: 'saveFrame'; frame: number; reason: RotoSessionSaveReason; after: RotoSessionSaveContinuation }
  | { type: 'replaceKeys'; frames: PhysicPaintRotoCacheFrame[]; changedFrames: number[]; removedFrames: number[]; transaction: RotoKeyUtilityTransaction }
  | { type: 'restoreFrame'; frame: number; restore: RotoSessionRestoreIntent }
  | { type: 'clearCanvas'; frame: number }
  | { type: 'showCachedReference'; frame: number; frameData: PhysicPaintRotoCacheFrame }
  | { type: 'navigate'; frame: number }
  | { type: 'clearGeneratedFrames'; frames: number[] }
  | { type: 'clearCachedReferences'; frames: number[] }
  | { type: 'clearBackgroundOnlySupport'; frames: number[] }
  | { type: 'clearDeletedFrames'; frames: number[] };

export interface RotoSessionActionResult {
  action: RotoSessionActionName;
  ok: boolean;
  message: string | null;
  effects: RotoSessionEffect[];
  transaction?: RotoKeyUtilityTransaction;
}

export interface RotoSessionInput {
  currentFrame: number;
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  dirtyFrames?: readonly number[] | ReadonlySet<number>;
  copiedKey?: RotoSessionCopiedKey | null;
  canvasSize?: { width: number; height: number };
  buildBlankRotoFrame: (appFrame: number) => PhysicPaintRotoCacheFrame;
  resolveSourceFrameForDisplayFrame?: (displayFrame: number) => number | null;
  resolvePasteTargetForDisplayFrame?: (displayFrame: number) => { displayFrame: number; sourceFrame: number; previousSegmentOverride: PhysicPaintRotoSegmentSpacingOverride | null } | null;
  segmentSpacingOverrides?: readonly PhysicPaintRotoSegmentSpacingOverride[];
  keyActionInFlight?: boolean;
  applyStatus?: 'idle' | 'applying' | 'success' | 'error';
  flushInFlight?: boolean;
}

export interface RotoSession {
  currentFrame: Signal<number>;
  realKeyFrames: Signal<PhysicPaintRotoCacheFrame[]>;
  realKeyFrameNumbers: Signal<number[]>;
  cachedRotoFrames: Signal<PhysicPaintRotoCacheFrame[]>;
  generatedFrameNumbers: Signal<number[]>;
  backgroundOnlySupportFrameNumbers: Signal<number[]>;
  playbackFrameNumbers: Signal<number[]>;
  dirtyFrames: Signal<number[]>;
  cachedBaseFrames: Signal<number[]>;
  copiedKey: Signal<RotoSessionCopiedKey | null>;
  restoreIntent: Signal<RotoSessionRestoreIntent>;
  feedback: Signal<string | null>;
  savingFrame: Signal<number | null>;
  pendingNavigationFrame: Signal<number | null>;
  pendingKeyAction: Signal<RotoSessionPendingKeyAction | null>;
  failedSaveFeedback: Signal<RotoSessionFailedSaveFeedback | null>;
  currentFrameIsDirty: Signal<boolean>;
  actionAvailability: Signal<RotoKeyUtilityActionState>;
  duplicateKey: () => RotoSessionActionResult;
  insertBlankKey: () => RotoSessionActionResult;
  deleteKey: () => RotoSessionActionResult;
  copyKey: () => RotoSessionActionResult;
  pasteKey: () => RotoSessionActionResult;
  requestFrame: (frame: number) => RotoSessionActionResult;
  markDirty: (frame?: number) => RotoSessionActionResult;
  markCachedBaseLoaded: (frame?: number) => RotoSessionActionResult;
  markLiveOverlayDirty: (frame?: number) => RotoSessionActionResult;
  markLiveOverlayEmpty: (frame?: number) => RotoSessionActionResult;
  onSaveSucceeded: (frame: number) => RotoSessionActionResult;
  onSaveFailed: (frame: number, message: string) => RotoSessionActionResult;
}

export function createRotoSession(input: RotoSessionInput): RotoSession {
  const initialCurrentFrame = normalizeFrame(input.currentFrame) ?? 0;
  const currentFrame = signal(initialCurrentFrame);
  const realKeyFrames = signal(normalizeRealKeyFrames(input.realKeyFrames, input.canvasSize));
  const cachedRotoFrames = signal(normalizeCachedFrames(input.cachedRotoFrames, input.canvasSize));
  const dirtyFrames = signal(normalizeFrameNumbers(toArray(input.dirtyFrames)));
  const cachedBaseFrames = signal<number[]>([]);
  const copiedKey = signal<RotoSessionCopiedKey | null>(input.copiedKey ? normalizeCopiedKey(input.copiedKey, input.canvasSize) : null);
  const restoreIntent = signal<RotoSessionRestoreIntent>({ kind: 'none', frame: initialCurrentFrame });
  const feedback = signal<string | null>(null);
  const savingFrame = signal<number | null>(null);
  const pendingNavigationFrame = signal<number | null>(null);
  const pendingKeyAction = signal<RotoSessionPendingKeyAction | null>(null);
  const failedSaveFeedback = signal<RotoSessionFailedSaveFeedback | null>(null);

  const realKeyFrameNumbers = computed(() => realKeyFrames.value.map((frame) => frame.appFrame));
  const generatedFrameNumbers = computed(() => collectGeneratedFrames(cachedRotoFrames.value));
  const backgroundOnlySupportFrameNumbers = computed(() => collectBackgroundOnlySupportFrames(cachedRotoFrames.value));
  const playbackFrameNumbers = computed(() => normalizeFrameNumbers([
    ...realKeyFrameNumbers.value,
    ...generatedFrameNumbers.value,
  ]));
  const currentFrameIsDirty = computed(() => hasFrame(dirtyFrames.value, currentFrame.value));
  const actionAvailability = computed(() => deriveRotoKeyUtilityActionState({
    currentFrame: currentFrame.value,
    realKeyFrameNumbers: realKeyFrameNumbers.value,
    generatedFrameNumbers: generatedFrameNumbers.value,
    hasCopiedRotoKey: copiedKey.value !== null,
    dirtyFrameNumbers: dirtyFrames.value,
    keyActionInFlight: input.keyActionInFlight,
    applyStatus: input.applyStatus,
    flushInFlight: input.flushInFlight,
  }));

  function requestFrame(frame: number): RotoSessionActionResult {
    const targetFrame = normalizeFrame(frame);
    if (targetFrame === null) return failed('requestFrame', 'Select a valid Roto frame.');
    const sourceFrame = currentFrame.peek();
    if (hasFrame(dirtyFrames.peek(), sourceFrame) && targetFrame !== sourceFrame) {
      return queueSaveBeforeContinuation('requestFrame', sourceFrame, 'beforeNavigate', { type: 'navigate', frame: targetFrame });
    }
    batch(() => {
      currentFrame.value = targetFrame;
      restoreIntent.value = { kind: 'none', frame: targetFrame };
      feedback.value = null;
      failedSaveFeedback.value = null;
    });
    return { action: 'requestFrame', ok: true, message: null, effects: [{ type: 'navigate', frame: targetFrame }] };
  }

  function markDirty(frame = currentFrame.peek()): RotoSessionActionResult {
    return markLiveOverlayDirty(frame, 'markDirty');
  }

  function markCachedBaseLoaded(frame = currentFrame.peek()): RotoSessionActionResult {
    const cachedFrame = normalizeFrame(frame);
    if (cachedFrame === null) return failed('markCachedBaseLoaded', 'Select a valid Roto frame.');
    const message = `Cached key base loaded — visible and non-editable. Add paint to update frame ${cachedFrame}.`;
    batch(() => {
      cachedBaseFrames.value = normalizeFrameNumbers([...cachedBaseFrames.peek(), cachedFrame]);
      dirtyFrames.value = removeFrames(dirtyFrames.peek(), [cachedFrame]);
      feedback.value = message;
      failedSaveFeedback.value = null;
    });
    return { action: 'markCachedBaseLoaded', ok: true, message, effects: [] };
  }

  function markLiveOverlayDirty(frame = currentFrame.peek(), action: RotoSessionActionName = 'markLiveOverlayDirty'): RotoSessionActionResult {
    const dirtyFrame = normalizeFrame(frame);
    if (dirtyFrame === null) return failed(action, 'Select a valid Roto frame.');
    dirtyFrames.value = normalizeFrameNumbers([...dirtyFrames.peek(), dirtyFrame]);
    return { action, ok: true, message: null, effects: [] };
  }

  function markLiveOverlayEmpty(frame = currentFrame.peek()): RotoSessionActionResult {
    const emptyFrame = normalizeFrame(frame);
    if (emptyFrame === null) return failed('markLiveOverlayEmpty', 'Select a valid Roto frame.');
    dirtyFrames.value = removeFrames(dirtyFrames.peek(), [emptyFrame]);
    return { action: 'markLiveOverlayEmpty', ok: true, message: null, effects: [] };
  }

  function copyKey(): RotoSessionActionResult {
    const displayFrame = currentFrame.peek();
    const sourcePayload = realKeyFrames.peek().find((frame) => frame.appFrame === displayFrame);
    if (!sourcePayload) return failed('copyKey', actionAvailability.peek().disabledReason ?? 'Select a real Roto key to copy.');
    const sourceFrame = sourcePayload.sourceFrame ?? sourcePayload.appFrame;
    const normalized = normalizeRealKeyFrame(sourcePayload, sourceFrame, input.canvasSize);
    copiedKey.value = { frame: sourceFrame, cachedFrame: normalized };
    const message = `Copied key ${sourceFrame}.`;
    feedback.value = message;
    return { action: 'copyKey', ok: true, message, effects: [] };
  }

  function duplicateKey(): RotoSessionActionResult {
    return applyTransaction('duplicateKey', 'duplicate');
  }

  function insertBlankKey(): RotoSessionActionResult {
    return applyTransaction('insertBlankKey', 'insert');
  }

  function deleteKey(): RotoSessionActionResult {
    return applyTransaction('deleteKey', 'delete');
  }

  function pasteKey(): RotoSessionActionResult {
    return applyTransaction('pasteKey', 'paste');
  }

  function applyTransaction(action: RotoSessionActionName, operation: Exclude<RotoKeyUtilityOperation, 'copy'>): RotoSessionActionResult {
    const sourceFrame = currentFrame.peek();
    const actionState = actionAvailability.peek();
    const hasRealSource = realKeyFrames.peek().some((frame) => frame.appFrame === sourceFrame);
    if (operation !== 'paste' && !hasRealSource) {
      return failed(action, actionState.disabledReason ?? 'Select a real Roto key to use key tools.');
    }
    if (operation === 'paste' && !actionState.canPaste) {
      return failed(action, actionState.pasteDisabledReason ?? 'Copy a real Roto key before pasting.');
    }
    if (hasFrame(dirtyFrames.peek(), sourceFrame)) {
      return queueSaveBeforeContinuation(action, sourceFrame, 'beforeAction', { type: 'keyAction', operation });
    }

    return runKeyTransaction(action, operation);
  }

  function queueSaveBeforeContinuation(
    action: RotoSessionActionName,
    sourceFrame: number,
    reason: RotoSessionSaveReason,
    after: RotoSessionSaveContinuation,
  ): RotoSessionActionResult {
    batch(() => {
      savingFrame.value = sourceFrame;
      pendingNavigationFrame.value = after.type === 'navigate' ? after.frame : null;
      pendingKeyAction.value = after.type === 'keyAction' ? after.operation : null;
      failedSaveFeedback.value = null;
      feedback.value = null;
    });
    return { action, ok: true, message: null, effects: [{ type: 'saveFrame', frame: sourceFrame, reason, after }] };
  }

  function runKeyTransaction(action: RotoSessionActionName, operation: RotoSessionPendingKeyAction): RotoSessionActionResult {
    const displayFrame = currentFrame.peek();
    const pasteTarget = operation === 'paste' ? input.resolvePasteTargetForDisplayFrame?.(displayFrame) ?? null : null;
    const sourceFrame = pasteTarget?.sourceFrame ?? input.resolveSourceFrameForDisplayFrame?.(displayFrame) ?? displayFrame;
    const effects: RotoSessionEffect[] = [];
    try {
      const transaction = buildRotoKeyUtilityTransaction({
        operation,
        currentFrame: sourceFrame,
        realKeyFrames: realKeyFrames.peek(),
        cachedRotoFrames: cachedRotoFrames.peek(),
        copiedKeyFrame: copiedKey.peek()?.cachedFrame ?? null,
        pasteTarget,
        segmentSpacingOverrides: input.segmentSpacingOverrides,
        canvasSize: input.canvasSize,
        buildBlankRotoFrame: input.buildBlankRotoFrame,
      });
      batch(() => {
        realKeyFrames.value = transaction.realKeyFrames;
        cachedRotoFrames.value = mergeCachedFrames(cachedRotoFrames.peek(), transaction);
        dirtyFrames.value = removeFrames(dirtyFrames.peek(), transaction.removedFrames);
        currentFrame.value = transaction.activeFrame;
        restoreIntent.value = transaction.activeRestore;
        feedback.value = getTransactionSuccessMessage(transaction);
        failedSaveFeedback.value = null;
      });
      effects.push(...effectsForTransaction(transaction));
      return { action, ok: true, message: getTransactionSuccessMessage(transaction), effects, transaction };
    } catch (error) {
      return failed(action, error instanceof Error ? error.message : String(error));
    }
  }

  function onSaveSucceeded(frame: number): RotoSessionActionResult {
    const savedFrame = normalizeFrame(frame);
    if (savedFrame === null) return failed('onSaveSucceeded', 'Select a valid Roto frame.');
    if (savingFrame.peek() !== savedFrame) return failed('onSaveSucceeded', `No pending save for frame ${savedFrame}.`);
    const targetFrame = pendingNavigationFrame.peek();
    const queuedAction = pendingKeyAction.peek();
    batch(() => {
      dirtyFrames.value = removeFrames(dirtyFrames.peek(), [savedFrame]);
      savingFrame.value = null;
      pendingNavigationFrame.value = null;
      pendingKeyAction.value = null;
      failedSaveFeedback.value = null;
      feedback.value = null;
    });
    if (targetFrame !== null) {
      batch(() => {
        currentFrame.value = targetFrame;
        restoreIntent.value = { kind: 'none', frame: targetFrame };
      });
      return { action: 'onSaveSucceeded', ok: true, message: null, effects: [{ type: 'navigate', frame: targetFrame }] };
    }
    if (queuedAction !== null) {
      return runKeyTransaction('onSaveSucceeded', queuedAction);
    }
    return { action: 'onSaveSucceeded', ok: true, message: null, effects: [] };
  }

  function onSaveFailed(frame: number, detail: string): RotoSessionActionResult {
    const failedFrame = normalizeFrame(frame);
    if (failedFrame === null) return failed('onSaveFailed', 'Select a valid Roto frame.');
    const message = `Could not save frame ${failedFrame}. ${detail}`.trim();
    batch(() => {
      dirtyFrames.value = normalizeFrameNumbers([...dirtyFrames.peek(), failedFrame]);
      savingFrame.value = null;
      pendingNavigationFrame.value = null;
      pendingKeyAction.value = null;
      failedSaveFeedback.value = { frame: failedFrame, message };
      feedback.value = message;
    });
    return { action: 'onSaveFailed', ok: false, message, effects: [] };
  }

  return {
    currentFrame,
    realKeyFrames,
    realKeyFrameNumbers,
    cachedRotoFrames,
    generatedFrameNumbers,
    backgroundOnlySupportFrameNumbers,
    playbackFrameNumbers,
    dirtyFrames,
    cachedBaseFrames,
    copiedKey,
    restoreIntent,
    feedback,
    savingFrame,
    pendingNavigationFrame,
    pendingKeyAction,
    failedSaveFeedback,
    currentFrameIsDirty,
    actionAvailability,
    duplicateKey,
    insertBlankKey,
    deleteKey,
    copyKey,
    pasteKey,
    requestFrame,
    markDirty,
    markCachedBaseLoaded,
    markLiveOverlayDirty,
    markLiveOverlayEmpty,
    onSaveSucceeded,
    onSaveFailed,
  };

  function failed(action: RotoSessionActionName, message: string): RotoSessionActionResult {
    feedback.value = message;
    return { action, ok: false, message, effects: [] };
  }
}

function effectsForTransaction(transaction: RotoKeyUtilityTransaction): RotoSessionEffect[] {
  const effects: RotoSessionEffect[] = [
    {
      type: 'replaceKeys',
      frames: transaction.realKeyFrames,
      changedFrames: transaction.changedFrames,
      removedFrames: transaction.removedFrames,
      transaction,
    },
  ];

  if (transaction.activeRestore.kind === 'clear-blank') {
    effects.push({ type: 'clearCanvas', frame: transaction.activeRestore.frame });
  }
  effects.push({ type: 'restoreFrame', frame: transaction.activeRestore.frame, restore: transaction.activeRestore });

  if (transaction.cleanup.generatedFrames.length > 0) effects.push({ type: 'clearGeneratedFrames', frames: transaction.cleanup.generatedFrames });
  if (transaction.cleanup.referenceFrames.length > 0) effects.push({ type: 'clearCachedReferences', frames: transaction.cleanup.referenceFrames });
  if (transaction.cleanup.backgroundOnlySupportFrames.length > 0) effects.push({ type: 'clearBackgroundOnlySupport', frames: transaction.cleanup.backgroundOnlySupportFrames });
  if (transaction.cleanup.deletedFrames.length > 0) effects.push({ type: 'clearDeletedFrames', frames: transaction.cleanup.deletedFrames });

  return effects;
}

function getTransactionSuccessMessage(transaction: RotoKeyUtilityTransaction): string {
  if (transaction.operation === 'paste' && transaction.cleanup.backgroundOnlySupportFrames.includes(transaction.activeFrame)) {
    return getRotoReplacementSuccessLabel(transaction.activeFrame);
  }
  return transaction.successMessage;
}

function mergeCachedFrames(existing: readonly PhysicPaintRotoCacheFrame[], transaction: RotoKeyUtilityTransaction): PhysicPaintRotoCacheFrame[] {
  const removeSet = new Set([...transaction.removedFrames, ...transaction.cleanup.generatedFrames, ...transaction.cleanup.referenceFrames, ...transaction.cleanup.backgroundOnlySupportFrames, ...transaction.cleanup.deletedFrames]);
  const byFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of existing) {
    if (!removeSet.has(frame.appFrame)) byFrame.set(frame.appFrame, { ...frame });
  }
  for (const frame of transaction.realKeyFrames) {
    byFrame.set(frame.appFrame, { ...frame });
  }
  return Array.from(byFrame.values()).sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeCachedFrames(frames: readonly PhysicPaintRotoCacheFrame[] | undefined, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  return (frames ?? [])
    .map((frame) => frame.source === 'real-key' ? normalizeRealKeyFrameForDisplay(frame, canvasSize) : { ...frame })
    .filter((frame) => normalizeFrame(frame.appFrame) !== null)
    .sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeRealKeyFrames(frames: readonly PhysicPaintRotoCacheFrame[], canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  const byDisplayFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of frames) {
    if (frame.source !== 'real-key') continue;
    const displayFrame = normalizeFrame(frame.displayFrame ?? frame.appFrame);
    if (displayFrame === null) continue;
    byDisplayFrame.set(displayFrame, normalizeRealKeyFrameForDisplay(frame, canvasSize));
  }
  return Array.from(byDisplayFrame.values()).sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeRealKeyFrame(frame: PhysicPaintRotoCacheFrame, appFrame: number, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame {
  const next: PhysicPaintRotoCacheFrame = {
    ...frame,
    appFrame,
    frameIndex: 0,
    source: 'real-key',
    sourceFrame: appFrame,
    displayFrame: appFrame,
    ...(canvasSize ? { width: canvasSize.width, height: canvasSize.height } : {}),
  };
  delete next.nearestRealKeyFrame;
  delete next.backgroundOnly;
  return next;
}

function normalizeRealKeyFrameForDisplay(frame: PhysicPaintRotoCacheFrame, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame {
  const displayFrame = normalizeFrame(frame.displayFrame ?? frame.appFrame);
  const sourceFrame = normalizeFrame(frame.sourceFrame ?? frame.appFrame);
  const appFrame = displayFrame ?? sourceFrame ?? 0;
  const source = sourceFrame ?? appFrame;
  const next: PhysicPaintRotoCacheFrame = {
    ...frame,
    appFrame,
    frameIndex: 0,
    source: 'real-key',
    sourceFrame: source,
    displayFrame: appFrame,
    ...(canvasSize ? { width: canvasSize.width, height: canvasSize.height } : {}),
  };
  delete next.nearestRealKeyFrame;
  delete next.backgroundOnly;
  return next;
}

function normalizeCopiedKey(copiedKey: RotoSessionCopiedKey, canvasSize?: { width: number; height: number }): RotoSessionCopiedKey | null {
  const frame = normalizeFrame(copiedKey.frame);
  if (frame === null) return null;
  return { frame, cachedFrame: normalizeRealKeyFrame(copiedKey.cachedFrame, frame, canvasSize) };
}

function collectGeneratedFrames(frames: readonly PhysicPaintRotoCacheFrame[]): number[] {
  return normalizeFrameNumbers(frames.filter((frame) => frame.source === 'generated-interpolation').map((frame) => frame.appFrame));
}

function collectBackgroundOnlySupportFrames(frames: readonly PhysicPaintRotoCacheFrame[]): number[] {
  return normalizeFrameNumbers(frames.filter((frame) => frame.source === 'background-only-support' || frame.backgroundOnly === true).map((frame) => frame.appFrame));
}

function removeFrames(frames: readonly number[], removedFrames: readonly number[]): number[] {
  const removed = new Set(removedFrames);
  return normalizeFrameNumbers(frames.filter((frame) => !removed.has(frame)));
}

function toArray(frames: readonly number[] | ReadonlySet<number> | undefined): number[] {
  if (!frames) return [];
  return Array.isArray(frames) ? [...frames] : [...frames.values()];
}

function hasFrame(frames: readonly number[], frame: number): boolean {
  return frames.includes(frame);
}

function normalizeFrameNumbers(frames: readonly number[]): number[] {
  return Array.from(new Set(frames.map(normalizeFrame).filter((frame): frame is number => frame !== null))).sort((a, b) => a - b);
}

function normalizeFrame(frame: unknown): number | null {
  if (typeof frame !== 'number' || !Number.isInteger(frame) || frame < 0) return null;
  return frame;
}
