import type { PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';
import {
  getExpandedRotoRealKeyFrames,
  normalizeRotoSegmentSpacingOverrides,
  resolveRotoFarEmptyDisplaySaveTarget,
  type RotoExpandedRealKeyFrame,
  type RotoFarEmptyDisplaySaveTarget,
  type RotoInterpolationSettings,
  type RotoSegmentSpacingOverride,
} from './physicsPaintRotoWorkflow';

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
  const projected = resolveRotoFarEmptyDisplaySaveTarget(displayFrame, model.realSourceFrames, {
    ...model.settings,
    enabled: true,
  });
  return {
    ...projected,
    sourceFrame: projected.displayFrame,
    previousSegmentOverride: projected.previousSegmentOverride
      ? { ...projected.previousSegmentOverride, toSourceFrame: projected.displayFrame }
      : null,
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
