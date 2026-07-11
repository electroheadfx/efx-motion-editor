import type { PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';
import {
  getExpandedRotoRealKeyFrames,
  normalizeRotoSegmentSpacingOverrides,
  type RotoExpandedRealKeyFrame,
  type RotoFarEmptyDisplaySaveTarget,
  type RotoInterpolationSettings,
  type RotoSegmentSpacingOverride,
} from '../physicsPaintWorkflowState';

export interface RotoSourceDisplayModel {
  realSourceFrames: number[];
  settings: RotoInterpolationSettings;
}

export interface RotoSourceDisplayModelInput {
  realSourceFrames: readonly number[];
  settings: RotoInterpolationSettings;
}

export interface RotoDisplayProjection {
  cells: RotoExpandedRealKeyFrame[];
  realKeys: Extract<RotoExpandedRealKeyFrame, { kind: 'real-key' }>[];
  generatedFrames: Extract<RotoExpandedRealKeyFrame, { kind: 'generated-interpolation' }>[];
}

export function createRotoSourceDisplayModel(input: RotoSourceDisplayModelInput): RotoSourceDisplayModel {
  const realSourceFrames = normalizeRealSourceFrames(input.realSourceFrames);
  const settings: RotoInterpolationSettings = {
    ...input.settings,
    segmentSpacingOverrides: normalizeRotoSegmentSpacingOverrides(input.settings.segmentSpacingOverrides, realSourceFrames),
  };

  return { realSourceFrames, settings };
}

export function getRotoDisplayProjection(
  model: RotoSourceDisplayModel,
  settingsPatch: Partial<RotoInterpolationSettings> = {},
): RotoDisplayProjection {
  const settings: RotoInterpolationSettings = {
    ...model.settings,
    ...settingsPatch,
    segmentSpacingOverrides: normalizeRotoSegmentSpacingOverrides(
      settingsPatch.segmentSpacingOverrides ?? model.settings.segmentSpacingOverrides,
      model.realSourceFrames,
    ),
  };
  const cells = settings.enabled === true
    ? getExpandedRotoRealKeyFrames(model.realSourceFrames, settings)
    : model.realSourceFrames.map((sourceFrame) => ({ sourceFrame, frame: sourceFrame, displayFrame: sourceFrame, kind: 'real-key' as const }));
  return {
    cells,
    realKeys: cells.filter((cell): cell is Extract<RotoExpandedRealKeyFrame, { kind: 'real-key' }> => cell.kind === 'real-key'),
    generatedFrames: cells.filter((cell): cell is Extract<RotoExpandedRealKeyFrame, { kind: 'generated-interpolation' }> => cell.kind === 'generated-interpolation'),
  };
}

export function resolveRotoRealKeySaveTarget(
  model: RotoSourceDisplayModel,
  displayFrame: number,
): RotoFarEmptyDisplaySaveTarget {
  const safeDisplayFrame = normalizeDisplayFrame(displayFrame);
  if (model.settings.enabled !== true || model.realSourceFrames.length === 0) {
    return { displayFrame: safeDisplayFrame, sourceFrame: safeDisplayFrame, previousSegmentOverride: null };
  }

  const realKeys = getRotoDisplayProjection(model).realKeys;
  const previous = [...realKeys].reverse().find((entry) => entry.displayFrame < safeDisplayFrame) ?? realKeys[realKeys.length - 1];
  if (!previous) return { displayFrame: safeDisplayFrame, sourceFrame: safeDisplayFrame, previousSegmentOverride: null };

  const globalInBetweenCount = normalizeInBetweenCount(model.settings.inBetweenCount);
  const normalNextDisplayFrame = previous.displayFrame + globalInBetweenCount + 1;
  if (safeDisplayFrame === normalNextDisplayFrame) {
    return {
      displayFrame: safeDisplayFrame,
      sourceFrame: previous.sourceFrame + 1,
      previousSegmentOverride: null,
    };
  }

  const customInBetweenCount = normalizeInBetweenCount(Math.max(1, safeDisplayFrame - previous.displayFrame - 1));
  const sourceFrame = previous.sourceFrame + Math.max(1, customInBetweenCount - globalInBetweenCount);
  return {
    displayFrame: safeDisplayFrame,
    sourceFrame,
    previousSegmentOverride: {
      fromSourceFrame: previous.sourceFrame,
      toSourceFrame: sourceFrame,
      inBetweenCount: customInBetweenCount,
    },
  };
}

export function upsertRotoRealKeySource(
  model: RotoSourceDisplayModel,
  target: Pick<RotoFarEmptyDisplaySaveTarget, 'sourceFrame' | 'previousSegmentOverride'>,
): RotoSourceDisplayModel {
  const realSourceFrames = normalizeRealSourceFrames([...model.realSourceFrames, target.sourceFrame]);
  const segmentSpacingOverrides = mergeRotoSegmentSpacingOverride(
    model.settings.segmentSpacingOverrides,
    target.previousSegmentOverride,
    realSourceFrames,
  );

  return createRotoSourceDisplayModel({
    realSourceFrames,
    settings: {
      ...model.settings,
      segmentSpacingOverrides,
    },
  });
}

function mergeRotoSegmentSpacingOverride(
  existing: RotoInterpolationSettings['segmentSpacingOverrides'],
  override: RotoSegmentSpacingOverride | PhysicPaintRotoSegmentSpacingOverride | null,
  realSourceFrames: readonly number[],
): RotoSegmentSpacingOverride[] {
  const withoutReplacement = (existing ?? []).filter((candidate) => (
    override === null
      || candidate.fromSourceFrame !== override.fromSourceFrame
      || candidate.toSourceFrame !== override.toSourceFrame
  ));
  return normalizeRotoSegmentSpacingOverrides(
    override ? [...withoutReplacement, override] : withoutReplacement,
    realSourceFrames,
  );
}

function normalizeRealSourceFrames(frames: readonly number[]): number[] {
  return Array.from(new Set(frames.filter((frame) => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
}

function normalizeDisplayFrame(frame: number): number {
  return Number.isInteger(frame) && frame >= 0 ? frame : 0;
}

function normalizeInBetweenCount(value: unknown): number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 ? value : 1;
}
