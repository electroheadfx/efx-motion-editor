import { PHYSIC_PAINT_MAX_APPLY_FRAMES, type PhysicPaintRotoInterpolationSettings, type PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';
import {
  normalizeRotoSegmentSpacingOverrides,
  resolveRotoFarEmptyDisplaySaveTarget,
  type RotoFarEmptyDisplaySaveTarget,
  type RotoInterpolationSettings,
  type RotoSegmentSpacingOverride,
} from './physicsPaintRotoWorkflow';

// Inlined source/display model helpers (formerly from rotoSourceDisplayModel.ts).
// These remain temporarily for legacy operation delivery and will be removed
// when 36.14-06 through 36.14-08 migrate these modules to the physical resolver.

interface RotoSourceDisplayModel {
  realSourceFrames: number[];
  settings: RotoInterpolationSettings;
}

function normalizeRealSourceFrames(frames: readonly number[]): number[] {
  return Array.from(new Set(frames.filter((frame) => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
}

function createRotoSourceDisplayModelLegacy(input: { realSourceFrames: readonly number[]; settings: RotoInterpolationSettings }): RotoSourceDisplayModel {
  const realSourceFrames = normalizeRealSourceFrames(input.realSourceFrames);
  const settings: RotoInterpolationSettings = {
    ...input.settings,
    segmentSpacingOverrides: normalizeRotoSegmentSpacingOverrides(input.settings.segmentSpacingOverrides, realSourceFrames),
  };
  return { realSourceFrames, settings };
}

function resolveRotoRealKeySaveTargetLegacy(
  model: RotoSourceDisplayModel,
  displayFrame: number,
): RotoFarEmptyDisplaySaveTarget {
  const projected = resolveRotoFarEmptyDisplaySaveTarget(displayFrame, model.realSourceFrames, {
    ...model.settings,
    enabled: true,
  });
  const previousSourceFrame = [...model.realSourceFrames].reverse().find((sourceFrame) => sourceFrame < displayFrame);
  const isAdjacentOffSave = model.settings.enabled !== true && previousSourceFrame !== undefined && displayFrame === previousSourceFrame + 1;
  return {
    ...projected,
    sourceFrame: projected.displayFrame,
    previousSegmentOverride: projected.previousSegmentOverride && !isAdjacentOffSave
      ? { ...projected.previousSegmentOverride, toSourceFrame: projected.displayFrame }
      : null,
  };
}

function upsertRotoRealKeySourceLegacy(
  model: RotoSourceDisplayModel,
  target: Pick<RotoFarEmptyDisplaySaveTarget, 'sourceFrame' | 'previousSegmentOverride'>,
): RotoSourceDisplayModel {
  const realSourceFrames = normalizeRealSourceFrames([...model.realSourceFrames, target.sourceFrame]);
  const segmentSpacingOverrides = mergeRotoSegmentSpacingOverrideLegacy(
    model.settings.segmentSpacingOverrides,
    target.previousSegmentOverride,
    realSourceFrames,
  );
  return createRotoSourceDisplayModelLegacy({
    realSourceFrames,
    settings: { ...model.settings, segmentSpacingOverrides },
  });
}

function mergeRotoSegmentSpacingOverrideLegacy(
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

export interface RotoSaveRealKeyTransactionInput {
  model: RotoSourceDisplayModel;
  displayFrame: number;
  currentSettings: PhysicPaintRotoInterpolationSettings;
}

export interface RotoSaveRealKeyTransaction {
  target: ReturnType<typeof resolveRotoRealKeySaveTargetLegacy>;
  model: RotoSourceDisplayModel;
  sourceFrameOverride: number;
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
}

export interface RotoSelectedFrameClaimInput {
  model: RotoSourceDisplayModel;
  selectedFrame: number;
  currentSettings: PhysicPaintRotoInterpolationSettings;
}

export interface RotoSelectedFrameClaim {
  sourceFrame: number;
  displayFrame: number;
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
}

export interface RotoInterpolationToggleTransactionInput {
  currentFrame: number;
  currentSettings: PhysicPaintRotoInterpolationSettings;
  patch: Partial<PhysicPaintRotoInterpolationSettings>;
  sourceFrameBeforeUpdate: number | null;
  storeRotoFrames: readonly { source?: string }[];
  refreshedSettings: PhysicPaintRotoInterpolationSettings;
  failureStatus: string | null;
}

export interface RotoInterpolationToggleTransaction {
  settings: PhysicPaintRotoInterpolationSettings;
  nextCurrentFrame: number;
  status: string;
  failureStatus: string | null;
}

export function claimRotoSelectedFrame(input: RotoSelectedFrameClaimInput): RotoSelectedFrameClaim {
  const selectedFrame = Math.max(0, Math.trunc(input.selectedFrame));
  const target = resolveRotoRealKeySaveTargetLegacy(input.model, selectedFrame);
  const model = upsertRotoRealKeySourceLegacy(input.model, {
    sourceFrame: selectedFrame,
    previousSegmentOverride: target.previousSegmentOverride
      ? { ...target.previousSegmentOverride, toSourceFrame: selectedFrame }
      : null,
  });
  return {
    sourceFrame: selectedFrame,
    displayFrame: selectedFrame,
    interpolationSettings: toPhysicPaintRotoInterpolationSettings(model.settings, input.currentSettings),
  };
}

export function saveRotoRealKeyTransaction(input: RotoSaveRealKeyTransactionInput): RotoSaveRealKeyTransaction {
  const target = resolveRotoRealKeySaveTargetLegacy(input.model, input.displayFrame);
  const model = upsertRotoRealKeySourceLegacy(input.model, target);
  return {
    target,
    model,
    sourceFrameOverride: Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, target.sourceFrame),
    interpolationSettings: toPhysicPaintRotoInterpolationSettings(model.settings, input.currentSettings),
  };
}

function toPhysicPaintRotoInterpolationSettings(
  settings: RotoSourceDisplayModel['settings'],
  fallback: PhysicPaintRotoInterpolationSettings,
): PhysicPaintRotoInterpolationSettings {
  return {
    ...fallback,
    enabled: settings.enabled === true,
    inBetweenCount: settings.inBetweenCount ?? fallback.inBetweenCount,
    mode: settings.mode === 'blend' ? 'blend' : 'duplicate',
    deform: settings.deform ?? fallback.deform,
    position: settings.position ?? fallback.position,
    ...(settings.segmentSpacingOverrides ? { segmentSpacingOverrides: settings.segmentSpacingOverrides.map((override) => ({ ...override })) } : {}),
  };
}

export function updateRotoInterpolationSettingsTransaction(input: RotoInterpolationToggleTransactionInput): RotoInterpolationToggleTransaction {
  const enabled = input.patch.enabled ?? input.currentSettings.enabled;
  const settings: PhysicPaintRotoInterpolationSettings = {
    ...input.currentSettings,
    ...input.patch,
    enabled,
    mode: 'duplicate',
  };
  const nextCurrentFrame = !input.refreshedSettings.enabled && input.sourceFrameBeforeUpdate !== null
    ? input.sourceFrameBeforeUpdate
    : input.currentFrame;
  const hasGeneratedInBetweens = input.storeRotoFrames.some((frame) => frame.source === 'generated-interpolation');
  const status = input.failureStatus
    ?? (enabled
      ? hasGeneratedInBetweens
        ? 'Generated in-betweens on — render-only frames refresh from real keys.'
        : 'Generated in-betweens on — save at least two real Roto keys.'
      : 'Generated in-betweens off — real Roto keys only.');

  return {
    settings,
    nextCurrentFrame,
    status,
    failureStatus: input.failureStatus,
  };
}
