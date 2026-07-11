import { PHYSIC_PAINT_MAX_APPLY_FRAMES, type PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import {
  resolveRotoRealKeySaveTarget,
  upsertRotoRealKeySource,
  type RotoSourceDisplayModel,
} from '../roto/rotoSourceDisplayModel';

export interface RotoSaveRealKeyTransactionInput {
  model: RotoSourceDisplayModel;
  displayFrame: number;
  currentSettings: PhysicPaintRotoInterpolationSettings;
}

export interface RotoSaveRealKeyTransaction {
  target: ReturnType<typeof resolveRotoRealKeySaveTarget>;
  model: RotoSourceDisplayModel;
  sourceFrameOverride: number;
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

export function saveRotoRealKeyTransaction(input: RotoSaveRealKeyTransactionInput): RotoSaveRealKeyTransaction {
  const target = resolveRotoRealKeySaveTarget(input.model, input.displayFrame);
  const model = upsertRotoRealKeySource(input.model, target);
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
