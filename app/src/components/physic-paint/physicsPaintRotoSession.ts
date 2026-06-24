import { batch, computed, signal, type Signal } from '@preact/signals';
import type { PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import {
  buildRotoKeyUtilityTransaction,
  deriveRotoKeyUtilityActionState,
  type RotoKeyUtilityActionState,
  type RotoKeyUtilityActiveRestore,
  type RotoKeyUtilityOperation,
  type RotoKeyUtilityTransaction,
} from './physicsPaintRotoKeyController';

export type RotoSessionSaveReason = 'frame-navigation' | 'key-action';
export type RotoSessionRestoreIntent = RotoKeyUtilityActiveRestore;

export interface RotoSessionCopiedKey {
  frame: number;
  cachedFrame: PhysicPaintRotoCacheFrame;
}

export type RotoSessionEffect =
  | { type: 'saveFrame'; frame: number; reason: RotoSessionSaveReason; resumeFrame?: number; resumeAction?: RotoKeyUtilityOperation }
  | { type: 'replaceKeys'; frames: PhysicPaintRotoCacheFrame[]; changedFrames: number[]; removedFrames: number[]; transaction: RotoKeyUtilityTransaction }
  | { type: 'restoreFrame'; frame: number; restore: RotoSessionRestoreIntent }
  | { type: 'clearCanvas'; frame: number }
  | { type: 'showCachedReference'; frame: number; frameData: PhysicPaintRotoCacheFrame }
  | { type: 'navigate'; frame: number }
  | { type: 'clearGeneratedFrames'; frames: number[] }
  | { type: 'clearCachedReferences'; frames: number[] }
  | { type: 'clearDeletedFrames'; frames: number[] };

export interface RotoSessionActionResult {
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
  dirtyFrames: Signal<number[]>;
  copiedKey: Signal<RotoSessionCopiedKey | null>;
  restoreIntent: Signal<RotoSessionRestoreIntent>;
  feedback: Signal<string | null>;
  actionAvailability: Signal<RotoKeyUtilityActionState>;
  duplicateKey: () => RotoSessionActionResult;
  insertBlankKey: () => RotoSessionActionResult;
  deleteKey: () => RotoSessionActionResult;
  copyKey: () => RotoSessionActionResult;
  pasteKey: () => RotoSessionActionResult;
  requestFrame: (frame: number) => RotoSessionActionResult;
  markDirty: (frame?: number) => RotoSessionActionResult;
}

export function createRotoSession(input: RotoSessionInput): RotoSession {
  const initialCurrentFrame = normalizeFrame(input.currentFrame) ?? 0;
  const currentFrame = signal(initialCurrentFrame);
  const realKeyFrames = signal(normalizeRealKeyFrames(input.realKeyFrames, input.canvasSize));
  const cachedRotoFrames = signal(normalizeCachedFrames(input.cachedRotoFrames, input.canvasSize));
  const dirtyFrames = signal(normalizeFrameNumbers(toArray(input.dirtyFrames)));
  const copiedKey = signal<RotoSessionCopiedKey | null>(input.copiedKey ? normalizeCopiedKey(input.copiedKey, input.canvasSize) : null);
  const restoreIntent = signal<RotoSessionRestoreIntent>({ kind: 'none', frame: initialCurrentFrame });
  const feedback = signal<string | null>(null);

  const realKeyFrameNumbers = computed(() => realKeyFrames.value.map((frame) => frame.appFrame));
  const generatedFrameNumbers = computed(() => collectGeneratedFrames(cachedRotoFrames.value));
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
    if (targetFrame === null) return failed('Select a valid Roto frame.');
    const sourceFrame = currentFrame.peek();
    const effects: RotoSessionEffect[] = [];
    if (hasFrame(dirtyFrames.peek(), sourceFrame) && targetFrame !== sourceFrame) {
      effects.push({ type: 'saveFrame', frame: sourceFrame, reason: 'frame-navigation', resumeFrame: targetFrame });
    }
    batch(() => {
      currentFrame.value = targetFrame;
      restoreIntent.value = { kind: 'none', frame: targetFrame };
      feedback.value = null;
    });
    effects.push({ type: 'navigate', frame: targetFrame });
    return { ok: true, message: null, effects };
  }

  function markDirty(frame = currentFrame.peek()): RotoSessionActionResult {
    const dirtyFrame = normalizeFrame(frame);
    if (dirtyFrame === null) return failed('Select a valid Roto frame.');
    dirtyFrames.value = normalizeFrameNumbers([...dirtyFrames.peek(), dirtyFrame]);
    return { ok: true, message: null, effects: [] };
  }

  function copyKey(): RotoSessionActionResult {
    const sourceFrame = currentFrame.peek();
    const sourcePayload = realKeyFrames.peek().find((frame) => frame.appFrame === sourceFrame);
    if (!sourcePayload) return failed(actionAvailability.peek().disabledReason ?? 'Select a real Roto key to copy.');
    const normalized = normalizeRealKeyFrame(sourcePayload, sourceFrame, input.canvasSize);
    copiedKey.value = { frame: sourceFrame, cachedFrame: normalized };
    const message = `Copied key ${sourceFrame}.`;
    feedback.value = message;
    return { ok: true, message, effects: [] };
  }

  function duplicateKey(): RotoSessionActionResult {
    return applyTransaction('duplicate');
  }

  function insertBlankKey(): RotoSessionActionResult {
    return applyTransaction('insert');
  }

  function deleteKey(): RotoSessionActionResult {
    return applyTransaction('delete');
  }

  function pasteKey(): RotoSessionActionResult {
    return applyTransaction('paste');
  }

  function applyTransaction(operation: Exclude<RotoKeyUtilityOperation, 'copy'>): RotoSessionActionResult {
    const sourceFrame = currentFrame.peek();
    const actionState = actionAvailability.peek();
    const hasRealSource = realKeyFrames.peek().some((frame) => frame.appFrame === sourceFrame);
    if (operation !== 'paste' && !hasRealSource) {
      return failed(actionState.disabledReason ?? 'Select a real Roto key to use key tools.');
    }
    if (operation === 'paste' && !actionState.canPaste) {
      return failed(actionState.pasteDisabledReason ?? 'Copy a real Roto key before pasting.');
    }
    const effects: RotoSessionEffect[] = [];
    if (hasFrame(dirtyFrames.peek(), sourceFrame)) {
      effects.push({ type: 'saveFrame', frame: sourceFrame, reason: 'key-action', resumeAction: operation });
    }

    try {
      const transaction = buildRotoKeyUtilityTransaction({
        operation,
        currentFrame: sourceFrame,
        realKeyFrames: realKeyFrames.peek(),
        cachedRotoFrames: cachedRotoFrames.peek(),
        copiedKeyFrame: copiedKey.peek()?.cachedFrame ?? null,
        canvasSize: input.canvasSize,
        buildBlankRotoFrame: input.buildBlankRotoFrame,
      });
      batch(() => {
        realKeyFrames.value = transaction.realKeyFrames;
        cachedRotoFrames.value = mergeCachedFrames(cachedRotoFrames.peek(), transaction);
        dirtyFrames.value = removeFrames(dirtyFrames.peek(), transaction.removedFrames);
        currentFrame.value = transaction.activeFrame;
        restoreIntent.value = transaction.activeRestore;
        feedback.value = transaction.successMessage;
      });
      effects.push(...effectsForTransaction(transaction));
      return { ok: true, message: transaction.successMessage, effects, transaction };
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    currentFrame,
    realKeyFrames,
    realKeyFrameNumbers,
    cachedRotoFrames,
    generatedFrameNumbers,
    dirtyFrames,
    copiedKey,
    restoreIntent,
    feedback,
    actionAvailability,
    duplicateKey,
    insertBlankKey,
    deleteKey,
    copyKey,
    pasteKey,
    requestFrame,
    markDirty,
  };

  function failed(message: string): RotoSessionActionResult {
    feedback.value = message;
    return { ok: false, message, effects: [] };
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
  if (transaction.cleanup.deletedFrames.length > 0) effects.push({ type: 'clearDeletedFrames', frames: transaction.cleanup.deletedFrames });

  return effects;
}

function mergeCachedFrames(existing: readonly PhysicPaintRotoCacheFrame[], transaction: RotoKeyUtilityTransaction): PhysicPaintRotoCacheFrame[] {
  const removeSet = new Set([...transaction.removedFrames, ...transaction.cleanup.generatedFrames, ...transaction.cleanup.referenceFrames, ...transaction.cleanup.deletedFrames]);
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
    .map((frame) => frame.source === 'real-key' ? normalizeRealKeyFrame(frame, frame.appFrame, canvasSize) : { ...frame })
    .filter((frame) => normalizeFrame(frame.appFrame) !== null)
    .sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeRealKeyFrames(frames: readonly PhysicPaintRotoCacheFrame[], canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  const byFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of frames) {
    const appFrame = normalizeFrame(frame.appFrame);
    if (appFrame === null || frame.source !== 'real-key') continue;
    byFrame.set(appFrame, normalizeRealKeyFrame(frame, appFrame, canvasSize));
  }
  return Array.from(byFrame.values()).sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeRealKeyFrame(frame: PhysicPaintRotoCacheFrame, appFrame: number, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame {
  const next: PhysicPaintRotoCacheFrame = {
    ...frame,
    appFrame,
    frameIndex: 0,
    source: 'real-key',
    ...(canvasSize ? { width: canvasSize.width, height: canvasSize.height } : {}),
  };
  delete next.nearestRealKeyFrame;
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
