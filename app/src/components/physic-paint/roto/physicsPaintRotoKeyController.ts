import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';

export type RotoKeyUtilityOperation = 'copy' | 'duplicate' | 'insert' | 'delete' | 'paste';
export type RotoKeyUtilityActionStateExposure =
  | RotoKeyUtilityOperation
  | 'dirty-save-before-action'
  | 'active-restore-intent'
  | 'generated-target-cleanup'
  | 'background-only-support-cleanup'
  | 'deleted-frame-cleanup';

export interface RotoKeyUtilityActionState {
  canCopy: boolean;
  canDuplicate: boolean;
  canInsert: boolean;
  canDelete: boolean;
  canPaste: boolean;
  currentIsRealKey: boolean;
  currentIsGenerated: boolean;
  hasCopiedRotoKey: boolean;
  busy: boolean;
  disabledReason: string | null;
  pasteDisabledReason: string | null;
  operationsRequiringRealSource: RotoKeyUtilityOperation[];
  dirtySaveBeforeAction: {
    required: boolean;
    sourceFrame: number | null;
  };
  exposes: RotoKeyUtilityActionStateExposure[];
}

export type RotoKeyUtilityActiveRestore =
  | { kind: 'none'; frame: number }
  | { kind: 'blank-real-key'; frame: number }
  | { kind: 'load-real-key'; frame: number }
  | { kind: 'clear-blank'; frame: number };

export interface RotoKeyUtilityCleanup {
  generatedFrames: number[];
  referenceFrames: number[];
  backgroundOnlySupportFrames: number[];
  deletedFrames: number[];
}

export interface RotoKeyUtilityFrameMapping {
  fromFrame: number;
  toFrame: number;
  mode: 'copy' | 'move';
}

export interface RotoKeyUtilityTransaction {
  operation: Exclude<RotoKeyUtilityOperation, 'copy'>;
  realKeyFrames: PhysicPaintRotoCacheFrame[];
  realKeyFrameNumbers: number[];
  removedFrames: number[];
  changedFrames: number[];
  activeFrame: number;
  activeRestore: RotoKeyUtilityActiveRestore;
  cleanup: RotoKeyUtilityCleanup;
  frameMappings: RotoKeyUtilityFrameMapping[];
  segmentSpacingOverrides: PhysicPaintRotoSegmentSpacingOverride[];
  successMessage: string;
}

export interface RotoKeyUtilityActionStateInput {
  currentFrame: number;
  realKeyFrameNumbers: readonly number[];
  generatedFrameNumbers?: readonly number[] | ReadonlySet<number>;
  hasCopiedRotoKey: boolean;
  dirtyFrameNumbers?: readonly number[] | ReadonlySet<number>;
  keyActionInFlight?: boolean;
  applyStatus?: 'idle' | 'applying' | 'success' | 'error';
  flushInFlight?: boolean;
}

export interface RotoKeyUtilityPasteTarget {
  displayFrame: number;
  sourceFrame: number;
  previousSegmentOverride: PhysicPaintRotoSegmentSpacingOverride | null;
}

export interface RotoKeyUtilityTransactionInput {
  operation: Exclude<RotoKeyUtilityOperation, 'copy'>;
  currentFrame: number;
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  copiedKeyFrame?: PhysicPaintRotoCacheFrame | null;
  pasteTarget?: RotoKeyUtilityPasteTarget | null;
  segmentSpacingOverrides?: readonly PhysicPaintRotoSegmentSpacingOverride[];
  canvasSize?: { width: number; height: number };
  buildBlankRotoFrame: (appFrame: number) => PhysicPaintRotoCacheFrame;
}

export interface ApplyRotoKeyUtilityTransactionToLocalStateInput<TEditable = unknown, TPreview extends { appFrame: number } = PhysicPaintRotoCacheFrame> {
  editableStates: ReadonlyMap<number, TEditable>;
  previewFrames: ReadonlyMap<number, TPreview>;
  transaction: RotoKeyUtilityTransaction;
  copiedEditableState?: TEditable;
}

export interface ApplyRotoKeyUtilityTransactionToLocalStateResult<TEditable = unknown, TPreview extends { appFrame: number } = PhysicPaintRotoCacheFrame> {
  editableStates: Map<number, TEditable>;
  previewFrames: Map<number, TPreview | PhysicPaintRotoCacheFrame>;
}

export const GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE = 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.';

const SOURCE_OPERATIONS: RotoKeyUtilityOperation[] = ['copy', 'duplicate', 'insert', 'delete'];
const EXPOSURES: RotoKeyUtilityActionStateExposure[] = [
  'copy',
  'duplicate',
  'insert',
  'delete',
  'paste',
  'dirty-save-before-action',
  'active-restore-intent',
  'generated-target-cleanup',
  'background-only-support-cleanup',
  'deleted-frame-cleanup',
];

export function deriveRotoKeyUtilityActionState({
  currentFrame,
  realKeyFrameNumbers,
  generatedFrameNumbers,
  hasCopiedRotoKey,
  dirtyFrameNumbers,
  keyActionInFlight = false,
  applyStatus = 'idle',
  flushInFlight = false,
}: RotoKeyUtilityActionStateInput): RotoKeyUtilityActionState {
  const safeCurrentFrame = normalizeFrame(currentFrame);
  const realKeys = normalizeFrameNumbers(realKeyFrameNumbers);
  const currentIsRealKey = safeCurrentFrame !== null && realKeys.includes(safeCurrentFrame) && !hasFrame(generatedFrameNumbers, safeCurrentFrame);
  const currentIsGenerated = safeCurrentFrame !== null && hasFrame(generatedFrameNumbers, safeCurrentFrame);
  const busy = keyActionInFlight || flushInFlight || applyStatus === 'applying';
  const dirtyRequired = safeCurrentFrame !== null && hasFrame(dirtyFrameNumbers, safeCurrentFrame);
  const sourceDisabledReason = busy
    ? safeCurrentFrame !== null
      ? `Finish saving frame ${safeCurrentFrame} before using key tools.`
      : 'Finish saving before using key tools.'
    : currentIsGenerated && safeCurrentFrame !== null
      ? GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE.replace('{frame}', String(safeCurrentFrame))
      : currentIsRealKey
        ? null
        : 'Select a real Roto key to use key tools.';
  const pasteDisabledReason = busy
    ? sourceDisabledReason
    : hasCopiedRotoKey
      ? null
      : 'Copy a real Roto key before pasting.';

  return {
    canCopy: currentIsRealKey && !busy,
    canDuplicate: currentIsRealKey && !busy,
    canInsert: currentIsRealKey && !busy,
    canDelete: currentIsRealKey && !busy,
    canPaste: hasCopiedRotoKey && safeCurrentFrame !== null && !busy,
    currentIsRealKey,
    currentIsGenerated,
    hasCopiedRotoKey,
    busy,
    disabledReason: sourceDisabledReason,
    pasteDisabledReason,
    operationsRequiringRealSource: [...SOURCE_OPERATIONS],
    dirtySaveBeforeAction: {
      required: dirtyRequired,
      sourceFrame: dirtyRequired ? safeCurrentFrame : null,
    },
    exposes: [...EXPOSURES],
  };
}

export function buildRotoKeyUtilityTransaction(input: RotoKeyUtilityTransactionInput): RotoKeyUtilityTransaction {
  const requestedFrame = normalizeFrame(input.currentFrame) ?? 0;
  const canvasSize = normalizeCanvasSize(input.canvasSize);
  const displayToSourceFrame = new Map(input.realKeyFrames
    .filter((frame) => frame.source === 'real-key')
    .map((frame) => [frame.displayFrame ?? frame.appFrame, frame.sourceFrame ?? frame.appFrame]));
  const currentFrame = normalizeFrame(input.pasteTarget?.sourceFrame) ?? displayToSourceFrame.get(requestedFrame) ?? requestedFrame;
  const realFramesByFrame = new Map(normalizeRealKeyFrames(input.realKeyFrames, canvasSize).map((frame) => [frame.appFrame, frame]));
  const generatedFrames = collectGeneratedFrames(input.cachedRotoFrames);
  const referenceFrames = collectReferenceFrames(input.cachedRotoFrames, currentFrame);
  const backgroundOnlySupportFrames = collectBackgroundOnlySupportFrames(input.cachedRotoFrames);
  const realKeyNumbers = Array.from(realFramesByFrame.keys()).sort((a, b) => a - b);

  if (input.operation === 'duplicate') {
    const sourceFrame = realKeyNumbers.includes(currentFrame) ? currentFrame : nearestFrame(realKeyNumbers, currentFrame);
    if (sourceFrame === null) throw new Error('Select a real Roto key to duplicate.');
    const sourcePayload = realFramesByFrame.get(sourceFrame);
    if (!sourcePayload) throw new Error(`No cached payload for source frame ${sourceFrame}.`);
    const targetFrame = sourceFrame + 1;
    const frameMappings: RotoKeyUtilityFrameMapping[] = realKeyNumbers
      .filter((frame) => frame >= targetFrame)
      .sort((a, b) => b - a)
      .map((frame) => ({ fromFrame: frame, toFrame: frame + 1, mode: 'move' as const }));
    frameMappings.push({ fromFrame: sourceFrame, toFrame: targetFrame, mode: 'copy' });
    const nextFrames = realKeyNumbers
      .map((frame) => frame >= targetFrame ? frame + 1 : frame)
      .concat(targetFrame);
    const realKeyFrames = normalizeFrameNumbers(nextFrames).map((frame) => {
      if (frame === targetFrame) return normalizeRealKeyFrame(sourcePayload, targetFrame, canvasSize);
      const originalFrame = frame > targetFrame ? frame - 1 : frame;
      const payload = realFramesByFrame.get(originalFrame);
      if (!payload) throw new Error(`No cached payload for shifted frame ${originalFrame}.`);
      return normalizeRealKeyFrame(payload, frame, canvasSize);
    });
    return makeTransaction({
      operation: input.operation,
      realKeyFrames,
      activeFrame: targetFrame,
      activeRestore: { kind: 'load-real-key', frame: targetFrame },
      cleanup: cleanup(generatedFrames, referenceFrames, backgroundOnlySupportFrames, []),
      frameMappings,
      changedFrames: normalizeFrameNumbers([targetFrame, ...frameMappings.filter((mapping) => mapping.mode === 'move').map((mapping) => mapping.toFrame)]),
      removedFrames: generatedFrames,
      segmentSpacingOverrides: rebaseRotoSegmentSpacingOverrides({
        overrides: input.segmentSpacingOverrides,
        frameMappings,
        deletedFrame: null,
        preserveToFrame: sourceFrame,
      }),
      successMessage: `Duplicated to frame ${targetFrame}.`,
    });
  }

  if (input.operation === 'insert') {
    const shiftedFrames = realKeyNumbers.filter((frame) => frame >= currentFrame).sort((a, b) => b - a);
    const blankFrame = normalizeRealKeyFrame(input.buildBlankRotoFrame(currentFrame), currentFrame, canvasSize);
    const realKeyFrames = normalizeFrameNumbers([...realKeyNumbers.map((frame) => frame >= currentFrame ? frame + 1 : frame), currentFrame]).map((frameNumber) => {
      if (frameNumber === currentFrame) return blankFrame;
      const originalFrame = frameNumber > currentFrame ? frameNumber - 1 : frameNumber;
      const payload = realFramesByFrame.get(originalFrame);
      if (!payload) throw new Error(`No cached payload for shifted frame ${originalFrame}.`);
      return normalizeRealKeyFrame(payload, frameNumber, canvasSize);
    });
    const frameMappings = shiftedFrames.map((frame) => ({ fromFrame: frame, toFrame: frame + 1, mode: 'move' as const }));
    return makeTransaction({
      operation: input.operation,
      realKeyFrames,
      activeFrame: currentFrame,
      activeRestore: { kind: 'blank-real-key', frame: currentFrame },
      cleanup: cleanup(generatedFrames, normalizeFrameNumbers([...referenceFrames, currentFrame]), backgroundOnlySupportFrames, []),
      frameMappings,
      changedFrames: normalizeFrameNumbers([currentFrame, ...shiftedFrames.map((frame) => frame + 1)]),
      removedFrames: normalizeFrameNumbers([...generatedFrames, currentFrame]),
      segmentSpacingOverrides: rebaseRotoSegmentSpacingOverrides({
        overrides: input.segmentSpacingOverrides,
        frameMappings,
        deletedFrame: null,
        preserveToFrame: currentFrame,
      }),
      successMessage: `Inserted blank key before frame ${currentFrame}.`,
    });
  }

  if (input.operation === 'delete') {
    if (!realKeyNumbers.includes(currentFrame)) throw new Error('Select a real Roto key to delete.');
    const shiftedFrames = realKeyNumbers.filter((frame) => frame > currentFrame);
    const realKeyFrames = realKeyNumbers
      .filter((frame) => frame !== currentFrame)
      .map((frame) => {
        const payload = realFramesByFrame.get(frame);
        if (!payload) throw new Error(`No cached payload for shifted frame ${frame}.`);
        return normalizeRealKeyFrame(payload, frame > currentFrame ? frame - 1 : frame, canvasSize);
      })
      .sort((a, b) => a.appFrame - b.appFrame);
    const nextHasCurrentFrame = realKeyFrames.some((frame) => frame.appFrame === currentFrame);
    const frameMappings = shiftedFrames.map((frame) => ({ fromFrame: frame, toFrame: frame - 1, mode: 'move' as const }));
    return makeTransaction({
      operation: input.operation,
      realKeyFrames,
      activeFrame: currentFrame,
      activeRestore: nextHasCurrentFrame ? { kind: 'load-real-key', frame: currentFrame } : { kind: 'clear-blank', frame: currentFrame },
      cleanup: cleanup(generatedFrames, referenceFrames, backgroundOnlySupportFrames, [currentFrame]),
      frameMappings,
      changedFrames: normalizeFrameNumbers(shiftedFrames.map((frame) => frame - 1)),
      removedFrames: normalizeFrameNumbers([currentFrame, ...shiftedFrames, ...generatedFrames]),
      segmentSpacingOverrides: rebaseRotoSegmentSpacingOverrides({
        overrides: input.segmentSpacingOverrides,
        frameMappings,
        deletedFrame: currentFrame,
        preserveDeletedFrame: frameMappings.some((mapping) => mapping.mode === 'move' && mapping.toFrame === currentFrame),
      }),
      successMessage: `Deleted key ${currentFrame}.`,
    });
  }

  const copiedKeyFrame = input.copiedKeyFrame;
  if (!copiedKeyFrame) throw new Error('Copy a real Roto key before pasting.');
  const pastedFrame = normalizeRealKeyFrame(copiedKeyFrame, currentFrame, canvasSize);
  const realKeyFrames = normalizeRealKeyFrames([...Array.from(realFramesByFrame.values()).filter((frame) => frame.appFrame !== currentFrame), pastedFrame], canvasSize);
  const frameMappings: RotoKeyUtilityFrameMapping[] = [{ fromFrame: copiedKeyFrame.appFrame, toFrame: currentFrame, mode: 'copy' }];
  const nextOverrides = rebaseRotoSegmentSpacingOverrides({
    overrides: input.segmentSpacingOverrides,
    frameMappings,
    deletedFrame: null,
    replacementOverride: input.pasteTarget?.previousSegmentOverride ?? null,
  });
  return makeTransaction({
    operation: input.operation,
    realKeyFrames,
    activeFrame: currentFrame,
    activeRestore: { kind: 'load-real-key', frame: currentFrame },
    cleanup: cleanup(generatedFrames.filter((frame) => frame === currentFrame), referenceFrames.filter((frame) => frame === currentFrame), backgroundOnlySupportFrames.filter((frame) => frame === currentFrame), []),
    frameMappings,
    changedFrames: [currentFrame],
    removedFrames: generatedFrames.filter((frame) => frame === currentFrame),
    segmentSpacingOverrides: nextOverrides,
    successMessage: `Pasted key to frame ${currentFrame}.`,
  });
}

export function applyRotoKeyUtilityTransactionToLocalState<TEditable = unknown, TPreview extends { appFrame: number } = PhysicPaintRotoCacheFrame>({
  editableStates,
  previewFrames,
  transaction,
  copiedEditableState,
}: ApplyRotoKeyUtilityTransactionToLocalStateInput<TEditable, TPreview>): ApplyRotoKeyUtilityTransactionToLocalStateResult<TEditable, TPreview> {
  const nextEditableStates = new Map(editableStates);
  const nextPreviewFrames = new Map<number, TPreview | PhysicPaintRotoCacheFrame>(previewFrames);
  const originalEditableStates = new Map(editableStates);
  const originalPreviewFrames = new Map(previewFrames);

  for (const frame of [...transaction.cleanup.generatedFrames, ...transaction.cleanup.referenceFrames, ...transaction.cleanup.backgroundOnlySupportFrames, ...transaction.cleanup.deletedFrames, ...transaction.removedFrames]) {
    nextEditableStates.delete(frame);
    nextPreviewFrames.delete(frame);
  }

  for (const mapping of transaction.frameMappings.filter((entry) => entry.mode === 'move')) {
    const editableState = originalEditableStates.get(mapping.fromFrame);
    const previewFrame = originalPreviewFrames.get(mapping.fromFrame);
    if (editableState !== undefined) nextEditableStates.set(mapping.toFrame, cloneValue(editableState));
    else nextEditableStates.delete(mapping.toFrame);
    if (previewFrame) nextPreviewFrames.set(mapping.toFrame, { ...previewFrame, appFrame: mapping.toFrame });
    else nextPreviewFrames.delete(mapping.toFrame);
    nextEditableStates.delete(mapping.fromFrame);
    nextPreviewFrames.delete(mapping.fromFrame);
  }

  for (const mapping of transaction.frameMappings.filter((entry) => entry.mode === 'copy')) {
    const sourceEditableState = copiedEditableState ?? nextEditableStates.get(mapping.fromFrame);
    if (sourceEditableState !== undefined) nextEditableStates.set(mapping.toFrame, cloneValue(sourceEditableState));
    else nextEditableStates.delete(mapping.toFrame);
  }

  if (transaction.activeRestore.kind === 'blank-real-key' || transaction.activeRestore.kind === 'clear-blank') {
    nextEditableStates.delete(transaction.activeRestore.frame);
    if (transaction.activeRestore.kind === 'clear-blank') nextPreviewFrames.delete(transaction.activeRestore.frame);
  }

  return { editableStates: nextEditableStates, previewFrames: nextPreviewFrames };
}

function makeTransaction(input: Omit<RotoKeyUtilityTransaction, 'realKeyFrameNumbers'>): RotoKeyUtilityTransaction {
  const realKeyFrames = normalizeRealKeyFrames(input.realKeyFrames);
  return {
    ...input,
    realKeyFrames,
    realKeyFrameNumbers: realKeyFrames.map((frame) => frame.appFrame),
    removedFrames: normalizeFrameNumbers(input.removedFrames),
    changedFrames: normalizeFrameNumbers(input.changedFrames),
    cleanup: {
      generatedFrames: normalizeFrameNumbers(input.cleanup.generatedFrames),
      referenceFrames: normalizeFrameNumbers(input.cleanup.referenceFrames),
      backgroundOnlySupportFrames: normalizeFrameNumbers(input.cleanup.backgroundOnlySupportFrames),
      deletedFrames: normalizeFrameNumbers(input.cleanup.deletedFrames),
    },
  };
}

function cleanup(generatedFrames: readonly number[], referenceFrames: readonly number[], backgroundOnlySupportFrames: readonly number[], deletedFrames: readonly number[]): RotoKeyUtilityCleanup {
  return {
    generatedFrames: normalizeFrameNumbers(generatedFrames),
    referenceFrames: normalizeFrameNumbers(referenceFrames),
    backgroundOnlySupportFrames: normalizeFrameNumbers(backgroundOnlySupportFrames),
    deletedFrames: normalizeFrameNumbers(deletedFrames),
  };
}

interface RebaseRotoSegmentSpacingOverridesInput {
  overrides?: readonly PhysicPaintRotoSegmentSpacingOverride[];
  frameMappings: readonly RotoKeyUtilityFrameMapping[];
  deletedFrame: number | null;
  replacementOverride?: PhysicPaintRotoSegmentSpacingOverride | null;
  preserveToFrame?: number | null;
  preserveDeletedFrame?: boolean;
}

export function rebaseRotoSegmentSpacingOverrides({
  overrides,
  frameMappings,
  deletedFrame,
  replacementOverride = null,
  preserveToFrame = null,
  preserveDeletedFrame = false,
}: RebaseRotoSegmentSpacingOverridesInput): PhysicPaintRotoSegmentSpacingOverride[] {
  const mappedFrames = new Map<number, number>();
  for (const mapping of frameMappings) {
    const fromFrame = normalizeFrame(mapping.fromFrame);
    const toFrame = normalizeFrame(mapping.toFrame);
    if (fromFrame !== null && toFrame !== null) mappedFrames.set(fromFrame, toFrame);
  }

  const next = new Map<string, PhysicPaintRotoSegmentSpacingOverride>();
  for (const override of overrides ?? []) {
    if (!preserveDeletedFrame && deletedFrame !== null && (override.fromSourceFrame === deletedFrame || override.toSourceFrame === deletedFrame)) continue;
    const rebased = normalizeRotoSegmentSpacingOverride({
      ...override,
      fromSourceFrame: mappedFrames.get(override.fromSourceFrame) ?? override.fromSourceFrame,
      toSourceFrame: override.toSourceFrame === preserveToFrame
        ? override.toSourceFrame
        : mappedFrames.get(override.toSourceFrame) ?? override.toSourceFrame,
    });
    if (rebased) next.set(`${rebased.fromSourceFrame}:${rebased.toSourceFrame}`, rebased);
  }

  const normalizedReplacement = normalizeRotoSegmentSpacingOverride(replacementOverride);
  if (normalizedReplacement) next.set(`${normalizedReplacement.fromSourceFrame}:${normalizedReplacement.toSourceFrame}`, normalizedReplacement);

  return Array.from(next.values()).sort((a, b) => a.fromSourceFrame - b.fromSourceFrame || a.toSourceFrame - b.toSourceFrame);
}

function normalizeRotoSegmentSpacingOverride(value: PhysicPaintRotoSegmentSpacingOverride | null | undefined): PhysicPaintRotoSegmentSpacingOverride | null {
  if (!value) return null;
  const fromSourceFrame = normalizeFrame(value.fromSourceFrame);
  const toSourceFrame = normalizeFrame(value.toSourceFrame);
  if (fromSourceFrame === null || toSourceFrame === null || toSourceFrame <= fromSourceFrame) return null;
  if (!Number.isInteger(value.inBetweenCount) || value.inBetweenCount < 1) return null;
  return { fromSourceFrame, toSourceFrame, inBetweenCount: value.inBetweenCount };
}

function normalizeRealKeyFrames(frames: readonly PhysicPaintRotoCacheFrame[], canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  const byFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of frames) {
    const sourceFrame = normalizeFrame(frame.sourceFrame ?? frame.appFrame);
    if (sourceFrame === null) continue;
    if (frame.source !== 'real-key') continue;
    byFrame.set(sourceFrame, normalizeRealKeyFrame(frame, sourceFrame, canvasSize));
  }
  return Array.from(byFrame.values()).sort((a, b) => a.appFrame - b.appFrame);
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

function collectGeneratedFrames(frames: readonly PhysicPaintRotoCacheFrame[] | undefined): number[] {
  return normalizeFrameNumbers((frames ?? [])
    .filter((frame) => frame.source === 'generated-interpolation')
    .map((frame) => frame.appFrame));
}

function collectReferenceFrames(frames: readonly PhysicPaintRotoCacheFrame[] | undefined, currentFrame: number): number[] {
  return normalizeFrameNumbers((frames ?? [])
    .filter((frame) => frame.source === 'generated-interpolation' && frame.appFrame === currentFrame)
    .map((frame) => frame.appFrame));
}

function collectBackgroundOnlySupportFrames(frames: readonly PhysicPaintRotoCacheFrame[] | undefined): number[] {
  return normalizeFrameNumbers((frames ?? [])
    .filter((frame) => frame.source === 'background-only-support' || frame.backgroundOnly === true)
    .map((frame) => frame.appFrame));
}

function normalizeFrameNumbers(frames: readonly number[]): number[] {
  return Array.from(new Set(frames.map(normalizeFrame).filter((frame): frame is number => frame !== null))).sort((a, b) => a - b);
}

function normalizeFrame(frame: unknown): number | null {
  if (typeof frame !== 'number' || !Number.isInteger(frame) || frame < 0) return null;
  return frame;
}

function normalizeCanvasSize(size: { width: number; height: number } | undefined): { width: number; height: number } | undefined {
  if (!size) return undefined;
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return undefined;
  return { width: Math.trunc(size.width), height: Math.trunc(size.height) };
}

function nearestFrame(frames: readonly number[], target: number): number | null {
  if (frames.length === 0) return null;
  return frames.reduce((nearest, candidate) => Math.abs(candidate - target) < Math.abs(nearest - target) ? candidate : nearest, frames[0]);
}

function hasFrame(frames: readonly number[] | ReadonlySet<number> | undefined, frame: number): boolean {
  if (!frames) return false;
  if (typeof (frames as ReadonlySet<number>).has === 'function') return (frames as ReadonlySet<number>).has(frame);
  return (frames as readonly number[]).includes(frame);
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
