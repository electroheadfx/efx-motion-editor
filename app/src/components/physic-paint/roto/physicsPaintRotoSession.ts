import { batch, computed, signal, type Signal } from '@preact/signals';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import {
  deriveRotoKeyUtilityActionState,
  type RotoKeyUtilityActionState,
  type RotoKeyUtilityActiveRestore,
  type RotoKeyUtilityTransaction,
} from '../roto/physicsPaintRotoKeyController';
import type { PhysicPaintRotoRealKeyPayload } from './physicsPaintRotoPhysicalModel';

export type RotoSessionActionName = 'copyKey' | 'copyKeyGroup' | 'requestFrame' | 'markDirty' | 'markCachedBaseLoaded' | 'markLiveOverlayDirty' | 'markLiveOverlayEmpty';
export type RotoSessionRestoreIntent = RotoKeyUtilityActiveRestore;

export interface RotoSessionCopiedKey {
  frame: number;
  cachedFrame: PhysicPaintRotoCacheFrame;
}

export interface RotoSessionCopiedGroupEntry {
  readonly payload: PhysicPaintRotoRealKeyPayload;
  readonly sourceAppFrame: number;
  readonly sourceKeyId: string;
}

export interface RotoSessionCopiedKeyGroup {
  readonly kind: 'group';
  readonly entries: readonly RotoSessionCopiedGroupEntry[];
}

export type RotoSessionCopiedKeyValue = RotoSessionCopiedKey | RotoSessionCopiedKeyGroup;

export function isRotoSessionCopiedKeyGroup(value: RotoSessionCopiedKeyValue | null): value is RotoSessionCopiedKeyGroup {
  return value !== null && 'kind' in value && value.kind === 'group';
}

export type RotoSessionEffect =
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
}

export interface RotoSessionInput {
  currentFrame: number;
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  dirtyFrames?: readonly number[] | ReadonlySet<number>;
  copiedKey?: RotoSessionCopiedKeyValue | null;
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
  backgroundOnlySupportFrameNumbers: Signal<number[]>;
  playbackFrameNumbers: Signal<number[]>;
  dirtyFrames: Signal<number[]>;
  cachedBaseFrames: Signal<number[]>;
  copiedKey: Signal<RotoSessionCopiedKeyValue | null>;
  restoreIntent: Signal<RotoSessionRestoreIntent>;
  feedback: Signal<string | null>;
  currentFrameIsDirty: Signal<boolean>;
  actionAvailability: Signal<RotoKeyUtilityActionState>;
  copyKey: () => RotoSessionActionResult;
  copyKeyGroup: (entries: readonly RotoSessionCopiedGroupEntry[]) => RotoSessionActionResult;
  requestFrame: (frame: number) => RotoSessionActionResult;
  markDirty: (frame?: number) => RotoSessionActionResult;
  markCachedBaseLoaded: (frame?: number) => RotoSessionActionResult;
  markLiveOverlayDirty: (frame?: number) => RotoSessionActionResult;
  markLiveOverlayEmpty: (frame?: number) => RotoSessionActionResult;
}

export function createRotoSession(input: RotoSessionInput): RotoSession {
  const initialCurrentFrame = normalizeFrame(input.currentFrame) ?? 0;
  const currentFrame = signal(initialCurrentFrame);
  const realKeyFrames = signal(normalizeRealKeyFrames(input.realKeyFrames, input.canvasSize));
  const cachedRotoFrames = signal(normalizeCachedFrames(input.cachedRotoFrames, input.canvasSize));
  const dirtyFrames = signal(normalizeFrameNumbers(toArray(input.dirtyFrames)));
  const cachedBaseFrames = signal<number[]>([]);
  const copiedKey = signal<RotoSessionCopiedKeyValue | null>(input.copiedKey ? normalizeCopiedKey(input.copiedKey, input.canvasSize) : null);
  const restoreIntent = signal<RotoSessionRestoreIntent>({ kind: 'none', frame: initialCurrentFrame });
  const feedback = signal<string | null>(null);

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
    batch(() => {
      currentFrame.value = targetFrame;
      restoreIntent.value = { kind: 'none', frame: targetFrame };
      feedback.value = null;
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
    const appFrame = currentFrame.peek();
    const sourcePayload = realKeyFrames.peek().find((frame) => frame.appFrame === appFrame);
    if (!sourcePayload) return failed('copyKey', actionAvailability.peek().disabledReason ?? 'Select a real Roto key to copy.');
    const normalized = normalizeRealKeyFrame(sourcePayload, appFrame, input.canvasSize);
    copiedKey.value = { frame: appFrame, cachedFrame: normalized };
    const message = `Copied key ${appFrame}.`;
    feedback.value = message;
    return { action: 'copyKey', ok: true, message, effects: [] };
  }

  function copyKeyGroup(entries: readonly RotoSessionCopiedGroupEntry[]): RotoSessionActionResult {
    if (entries.length < 2) return failed('copyKeyGroup', 'Select at least two real Roto keys to copy.');
    copiedKey.value = Object.freeze({ kind: 'group', entries: Object.freeze([...entries]) });
    const message = `Copied ${entries.length} keys`;
    feedback.value = message;
    return { action: 'copyKeyGroup', ok: true, message, effects: [] };
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
    currentFrameIsDirty,
    actionAvailability,
    copyKey,
    copyKeyGroup,
    requestFrame,
    markDirty,
    markCachedBaseLoaded,
    markLiveOverlayDirty,
    markLiveOverlayEmpty,
  };

  function failed(action: RotoSessionActionName, message: string): RotoSessionActionResult {
    feedback.value = message;
    return { action, ok: false, message, effects: [] };
  }
}

function normalizeCachedFrames(frames: readonly PhysicPaintRotoCacheFrame[] | undefined, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  return (frames ?? [])
    .map((frame) => frame.source === 'real-key' ? normalizeRealKeyFrame(frame, frame.appFrame, canvasSize) : { ...frame })
    .filter((frame) => normalizeFrame(frame.appFrame) !== null)
    .sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeRealKeyFrames(frames: readonly PhysicPaintRotoCacheFrame[], canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  const byAppFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of frames) {
    if (frame.source !== 'real-key') continue;
    const appFrame = normalizeFrame(frame.appFrame);
    if (appFrame === null) continue;
    byAppFrame.set(appFrame, normalizeRealKeyFrame(frame, appFrame, canvasSize));
  }
  return Array.from(byAppFrame.values()).sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeRealKeyFrame(frame: PhysicPaintRotoCacheFrame, appFrame: number, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame {
  const next: PhysicPaintRotoCacheFrame = {
    ...frame,
    appFrame,
    frameIndex: 0,
    source: 'real-key',
    ...(canvasSize ? { width: canvasSize.width, height: canvasSize.height } : {}),
  };
  delete next.sourceFrame;
  delete next.displayFrame;
  delete next.nearestRealKeyFrame;
  delete next.backgroundOnly;
  return next;
}

function normalizeCopiedKey(copiedKey: RotoSessionCopiedKeyValue, canvasSize?: { width: number; height: number }): RotoSessionCopiedKeyValue | null {
  if (isRotoSessionCopiedKeyGroup(copiedKey)) {
    if (copiedKey.entries.length < 2) return null;
    if (!copiedKey.entries.every((entry) => normalizeFrame(entry.sourceAppFrame) !== null)) return null;
    return copiedKey;
  }
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
