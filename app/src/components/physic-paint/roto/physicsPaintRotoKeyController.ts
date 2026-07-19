import {
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  type PhysicPaintRotoCacheFrame,
  type PhysicPaintRotoInterpolationSettings,
  type PhysicPaintRotoSegmentSpacingOverride,
} from '../../../types/physicPaint';
import {
  createRotoSourceDisplayModel,
  getRotoDisplayProjection,
  resolveRotoRealKeySaveTarget,
} from './rotoSourceDisplayModel';
import type { RotoInterpolationSettings } from './physicsPaintRotoWorkflow';

export type RotoKeyUtilityOperation = 'copy' | 'duplicate' | 'insert' | 'delete' | 'paste';
export type RotoKeyTransactionOperation = Exclude<RotoKeyUtilityOperation, 'copy'> | 'move';
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
  operation: RotoKeyTransactionOperation;
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

export interface RotoKeyMoveTimingInput {
  fromDisplayFrame: number;
  toDisplayFrame: number;
  sourceFrame: number;
  realSourceFrames: readonly number[];
  interpolationSettings: RotoInterpolationSettings;
}

export interface RotoKeyMoveTimingPlan {
  destinationSourceFrame: number;
  requestedDestinationDisplayFrame: number;
  effectiveDestinationDisplayFrame: number;
  segmentSpacingOverrides: PhysicPaintRotoSegmentSpacingOverride[];
}

export type RotoKeyMoveTimingResolution =
  | { valid: true; plan: RotoKeyMoveTimingPlan }
  | { valid: false; error: string };

export interface RotoKeyMoveTransactionInput {
  fromDisplayFrame: number;
  toDisplayFrame: number;
  sourceFrame: number;
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
  canvasSize?: { width: number; height: number };
}

export interface RotoKeyMoveTransaction extends RotoKeyUtilityTransaction {
  operation: 'move';
  sourceDisplayFrame: number;
  requestedDestinationDisplayFrame: number;
  destinationDisplayFrame: number;
  sourceFrame: number;
  destinationSourceFrame: number;
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
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

export function resolveRotoKeyMoveTiming(input: RotoKeyMoveTimingInput): RotoKeyMoveTimingResolution {
  const fromDisplayFrame = normalizeFrame(input.fromDisplayFrame);
  const requestedDestinationDisplayFrame = normalizeFrame(input.toDisplayFrame);
  const sourceFrame = normalizeFrame(input.sourceFrame);
  if (fromDisplayFrame === null || requestedDestinationDisplayFrame === null || sourceFrame === null) {
    return { valid: false, error: 'Choose valid Roto key frames to move.' };
  }
  if (fromDisplayFrame === requestedDestinationDisplayFrame) {
    return { valid: false, error: 'Move the Roto key to a different frame.' };
  }

  const realSourceFrames = normalizeFrameNumbers(input.realSourceFrames);
  if (!realSourceFrames.includes(sourceFrame)) return { valid: false, error: 'The dragged Roto key is no longer available.' };
  const latestModel = createRotoSourceDisplayModel({ realSourceFrames, settings: input.interpolationSettings });
  const currentProjection = getRotoDisplayProjection(latestModel);
  const projectedSource = currentProjection.realKeys.find((cell) => cell.displayFrame === fromDisplayFrame);
  if (!projectedSource || projectedSource.sourceFrame !== sourceFrame) {
    return { valid: false, error: 'The dragged Roto key is no longer available.' };
  }
  const occupiedDestination = currentProjection.realKeys.find((cell) => cell.displayFrame === requestedDestinationDisplayFrame);
  if (occupiedDestination) {
    return { valid: false, error: `Frame ${requestedDestinationDisplayFrame} already contains a real Roto key.` };
  }

  const timingModel = createRotoSourceDisplayModel({
    realSourceFrames,
    settings: { ...input.interpolationSettings, enabled: true },
  });
  const intendedDisplays = new Map(getRotoDisplayProjection(timingModel).realKeys.map((cell) => [cell.sourceFrame, cell.displayFrame]));
  const globalInBetweenCount = normalizeMoveInBetweenCount(input.interpolationSettings.inBetweenCount);
  const existingOverrides = new Map((timingModel.settings.segmentSpacingOverrides ?? []).map((override) => [`${override.fromSourceFrame}:${override.toSourceFrame}`, override]));
  const remainingSourceFrames = realSourceFrames.filter((frame) => frame !== sourceFrame);
  const remainingOverrideResult = buildMoveSpacingOverrides({
    sourceFrames: remainingSourceFrames,
    intendedDisplays,
    globalInBetweenCount,
    existingOverrides,
  });
  if (!remainingOverrideResult.valid) return remainingOverrideResult;

  const destinationModel = createRotoSourceDisplayModel({
    realSourceFrames: remainingSourceFrames,
    settings: {
      ...input.interpolationSettings,
      segmentSpacingOverrides: remainingOverrideResult.overrides,
    },
  });
  const target = resolveRotoRealKeySaveTarget(destinationModel, requestedDestinationDisplayFrame);
  const destinationSourceFrame = normalizeFrame(target.sourceFrame);
  if (destinationSourceFrame === null || destinationSourceFrame === sourceFrame) {
    return { valid: false, error: 'The Roto key move has no canonical destination.' };
  }
  if (remainingSourceFrames.includes(destinationSourceFrame)) {
    return { valid: false, error: `Frame ${requestedDestinationDisplayFrame} already contains a real Roto key.` };
  }

  const finalSourceFrames = normalizeFrameNumbers([...remainingSourceFrames, destinationSourceFrame]);
  if (finalSourceFrames.length !== realSourceFrames.length) {
    return { valid: false, error: 'The Roto key move has no canonical destination.' };
  }
  const destinationIndex = finalSourceFrames.indexOf(destinationSourceFrame);
  const previousSourceFrame = destinationIndex > 0 ? finalSourceFrames[destinationIndex - 1] : null;
  const nextSourceFrame = destinationIndex < finalSourceFrames.length - 1 ? finalSourceFrames[destinationIndex + 1] : null;
  const previousDisplay = previousSourceFrame === null ? null : intendedDisplays.get(previousSourceFrame) ?? null;
  const nextDisplay = nextSourceFrame === null ? null : intendedDisplays.get(nextSourceFrame) ?? null;
  if (previousSourceFrame !== null && previousDisplay === null) return { valid: false, error: 'The previous Roto key timing is unavailable.' };
  if (nextSourceFrame !== null && nextDisplay === null) return { valid: false, error: 'The next Roto key timing is unavailable.' };

  const lowerBound = previousDisplay === null ? null : previousDisplay + 2;
  const upperBound = nextDisplay === null ? null : nextDisplay - 2;
  if (lowerBound !== null && upperBound !== null && lowerBound > upperBound) {
    return { valid: false, error: `Frame ${requestedDestinationDisplayFrame} has no legal Roto timing interval.` };
  }
  const firstDisplayFrame = finalSourceFrames[0] ?? 0;
  let effectiveDestinationDisplayFrame = destinationIndex === 0
    ? firstDisplayFrame
    : requestedDestinationDisplayFrame;
  if (lowerBound !== null) effectiveDestinationDisplayFrame = Math.max(effectiveDestinationDisplayFrame, lowerBound);
  if (upperBound !== null) effectiveDestinationDisplayFrame = Math.min(effectiveDestinationDisplayFrame, upperBound);
  if (destinationIndex === 0 && effectiveDestinationDisplayFrame !== firstDisplayFrame) {
    return { valid: false, error: `Frame ${requestedDestinationDisplayFrame} cannot preserve first-key Roto timing.` };
  }

  const finalIntendedDisplays = new Map(intendedDisplays);
  finalIntendedDisplays.delete(sourceFrame);
  finalIntendedDisplays.set(destinationSourceFrame, effectiveDestinationDisplayFrame);
  const finalOverrideResult = buildMoveSpacingOverrides({
    sourceFrames: finalSourceFrames,
    intendedDisplays: finalIntendedDisplays,
    globalInBetweenCount,
    existingOverrides,
  });
  if (!finalOverrideResult.valid) return finalOverrideResult;

  const finalModel = createRotoSourceDisplayModel({
    realSourceFrames: finalSourceFrames,
    settings: {
      ...input.interpolationSettings,
      enabled: true,
      segmentSpacingOverrides: finalOverrideResult.overrides,
    },
  });
  const finalProjection = getRotoDisplayProjection(finalModel);
  const movedProjection = finalProjection.realKeys.find((cell) => cell.sourceFrame === destinationSourceFrame);
  if (!movedProjection || movedProjection.displayFrame !== effectiveDestinationDisplayFrame) {
    return { valid: false, error: `Frame ${requestedDestinationDisplayFrame} cannot preserve canonical Roto timing.` };
  }
  for (const frame of remainingSourceFrames) {
    if (finalProjection.realKeys.find((cell) => cell.sourceFrame === frame)?.displayFrame !== intendedDisplays.get(frame)) {
      return { valid: false, error: `Frame ${requestedDestinationDisplayFrame} would move an unaffected Roto key.` };
    }
  }

  return {
    valid: true,
    plan: {
      destinationSourceFrame,
      requestedDestinationDisplayFrame,
      effectiveDestinationDisplayFrame,
      segmentSpacingOverrides: finalModel.settings.segmentSpacingOverrides?.map((override) => ({ ...override })) ?? [],
    },
  };
}

export function buildRotoKeyMoveTransaction(input: RotoKeyMoveTransactionInput): RotoKeyMoveTransaction {
  const canvasSize = normalizeCanvasSize(input.canvasSize);
  const realKeyFrames = normalizeMoveRealKeyFrames(input.realKeyFrames, canvasSize);
  const realFramesBySource = new Map(realKeyFrames.map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
  const realSourceFrames = Array.from(realFramesBySource.keys()).sort((a, b) => a - b);
  const timing = resolveRotoKeyMoveTiming({
    fromDisplayFrame: input.fromDisplayFrame,
    toDisplayFrame: input.toDisplayFrame,
    sourceFrame: input.sourceFrame,
    realSourceFrames,
    interpolationSettings: input.interpolationSettings,
  });
  if (!timing.valid) throw new Error(timing.error);

  const fromDisplayFrame = normalizeFrame(input.fromDisplayFrame) ?? 0;
  const sourceFrame = normalizeFrame(input.sourceFrame) ?? 0;
  const {
    destinationSourceFrame,
    requestedDestinationDisplayFrame,
    effectiveDestinationDisplayFrame,
    segmentSpacingOverrides,
  } = timing.plan;
  const remainingSourceFrames = realSourceFrames.filter((frame) => frame !== sourceFrame);
  const frameMapping: RotoKeyUtilityFrameMapping = { fromFrame: sourceFrame, toFrame: destinationSourceFrame, mode: 'move' };
  const sourcePayload = realFramesBySource.get(sourceFrame);
  if (!sourcePayload) throw new Error(`No cached payload for source frame ${sourceFrame}.`);
  const nextRealKeyFrames = remainingSourceFrames.map((frame) => {
    const payload = realFramesBySource.get(frame);
    if (!payload) throw new Error(`No cached payload for real key ${frame}.`);
    return normalizeMoveRealKeyFrame(payload, frame, canvasSize);
  });
  nextRealKeyFrames.push(normalizeMoveRealKeyFrame(sourcePayload, destinationSourceFrame, canvasSize));

  const generatedFrames = collectGeneratedFrames(input.cachedRotoFrames);
  const referenceFrames = normalizeFrameNumbers((input.cachedRotoFrames ?? [])
    .filter((frame) => frame.source === 'generated-interpolation' || frame.nearestRealKeyFrame !== undefined)
    .map((frame) => frame.appFrame));
  const backgroundOnlySupportFrames = collectBackgroundOnlySupportFrames(input.cachedRotoFrames);
  const interpolationSettings: PhysicPaintRotoInterpolationSettings = {
    ...input.interpolationSettings,
    segmentSpacingOverrides,
  };
  const destinationWasClamped = requestedDestinationDisplayFrame !== effectiveDestinationDisplayFrame;
  const transaction = makeTransaction({
    operation: 'move',
    realKeyFrames: nextRealKeyFrames,
    activeFrame: effectiveDestinationDisplayFrame,
    activeRestore: { kind: 'load-real-key', frame: effectiveDestinationDisplayFrame },
    cleanup: cleanup(generatedFrames, referenceFrames, backgroundOnlySupportFrames, [sourceFrame]),
    frameMappings: [frameMapping],
    changedFrames: [sourceFrame, destinationSourceFrame],
    removedFrames: normalizeFrameNumbers([sourceFrame, ...generatedFrames]),
    segmentSpacingOverrides,
    successMessage: destinationWasClamped
      ? `Moved key ${fromDisplayFrame} to frame ${effectiveDestinationDisplayFrame} (requested ${requestedDestinationDisplayFrame}).`
      : `Moved key ${fromDisplayFrame} to frame ${effectiveDestinationDisplayFrame}.`,
  });
  return {
    ...transaction,
    operation: 'move',
    sourceDisplayFrame: fromDisplayFrame,
    requestedDestinationDisplayFrame,
    destinationDisplayFrame: effectiveDestinationDisplayFrame,
    sourceFrame,
    destinationSourceFrame,
    interpolationSettings,
  };
}

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

interface BuildMoveSpacingOverridesInput {
  sourceFrames: readonly number[];
  intendedDisplays: ReadonlyMap<number, number>;
  globalInBetweenCount: number;
  existingOverrides: ReadonlyMap<string, PhysicPaintRotoSegmentSpacingOverride>;
}

type BuildMoveSpacingOverridesResult =
  | { valid: true; overrides: PhysicPaintRotoSegmentSpacingOverride[] }
  | { valid: false; error: string };

function buildMoveSpacingOverrides({
  sourceFrames,
  intendedDisplays,
  globalInBetweenCount,
  existingOverrides,
}: BuildMoveSpacingOverridesInput): BuildMoveSpacingOverridesResult {
  if (sourceFrames.length === 0) return { valid: true, overrides: [] };
  const firstSourceFrame = sourceFrames[0];
  const firstDisplayFrame = intendedDisplays.get(firstSourceFrame);
  const canonicalFirstDisplayFrame = firstSourceFrame > 0 ? firstSourceFrame : 0;
  if (firstDisplayFrame !== canonicalFirstDisplayFrame) {
    return { valid: false, error: `Frame ${firstSourceFrame} cannot preserve first-key Roto timing.` };
  }

  const overrides: PhysicPaintRotoSegmentSpacingOverride[] = [];
  for (let index = 0; index < sourceFrames.length - 1; index++) {
    const fromSourceFrame = sourceFrames[index];
    const toSourceFrame = sourceFrames[index + 1];
    const leftDisplay = intendedDisplays.get(fromSourceFrame);
    const rightDisplay = intendedDisplays.get(toSourceFrame);
    if (leftDisplay === undefined || rightDisplay === undefined) {
      return { valid: false, error: 'The Roto key timing anchors are incomplete.' };
    }
    const inBetweenCount = rightDisplay - leftDisplay - 1;
    if (inBetweenCount < 1) {
      return { valid: false, error: `Frames ${leftDisplay} and ${rightDisplay} are too close for Roto interpolation.` };
    }
    if (inBetweenCount > PHYSIC_PAINT_MAX_APPLY_FRAMES) {
      return { valid: false, error: `Frames ${leftDisplay} and ${rightDisplay} exceed the maximum Roto interpolation span.` };
    }
    if (inBetweenCount === globalInBetweenCount) continue;
    const key = `${fromSourceFrame}:${toSourceFrame}`;
    const existing = existingOverrides.get(key);
    overrides.push(existing?.inBetweenCount === inBetweenCount
      ? { ...existing }
      : { fromSourceFrame, toSourceFrame, inBetweenCount });
  }
  return { valid: true, overrides };
}

function normalizeMoveInBetweenCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, Math.trunc(numeric)));
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

function normalizeMoveRealKeyFrames(frames: readonly PhysicPaintRotoCacheFrame[], canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame[] {
  const byFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of frames) {
    const sourceFrame = normalizeFrame(frame.sourceFrame ?? frame.appFrame);
    if (sourceFrame === null || frame.source !== 'real-key') continue;
    byFrame.set(sourceFrame, normalizeMoveRealKeyFrame(frame, sourceFrame, canvasSize));
  }
  return Array.from(byFrame.values()).sort((a, b) => a.appFrame - b.appFrame);
}

function normalizeMoveRealKeyFrame(frame: PhysicPaintRotoCacheFrame, appFrame: number, canvasSize?: { width: number; height: number }): PhysicPaintRotoCacheFrame {
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
  delete next.fromSourceFrame;
  delete next.toSourceFrame;
  delete next.interpolationT;
  return next;
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
