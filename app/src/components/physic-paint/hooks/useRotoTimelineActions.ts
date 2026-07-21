import { useCallback } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { getSourceRotoFrameForDisplayFrame, type RotoInterpolationSettings } from '../roto/physicsPaintRotoWorkflow';
import { saveRotoRealKeyTransaction, updateRotoInterpolationSettingsTransaction } from '../roto/rotoKeyTransactions';
import type { PhysicPaintRotoRealKeyRecord, PhysicPaintRotoInterpolationState } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';

// Local type alias for the legacy source/display model shape. Operation delivery
// modules (36.14-06 through 36.14-08) will replace this with direct physical
// record/projection ports.
interface RotoSourceDisplayModel {
  realSourceFrames: number[];
  settings: RotoInterpolationSettings;
}

export interface RotoTimelineActionsInput {
  getModel: () => RotoSourceDisplayModel;
  getStoreRealKeyFrames?: () => number[];
  getCurrentSettings?: () => PhysicPaintRotoInterpolationSettings;
  getStoreRotoFrames?: () => PhysicPaintRotoCacheFrame[];
  getFailureStatus?: () => string | null;
  setInterpolationSettings?: (settings: PhysicPaintRotoInterpolationSettings) => PhysicPaintRotoInterpolationSettings;
  /** Physical real-key records from the store (D-01/D-10). */
  getRotoKeyRecords?: () => readonly PhysicPaintRotoRealKeyRecord[];
  /** Enabled-only interpolation state from the store (D-02). */
  getRotoInterpolationState?: () => PhysicPaintRotoInterpolationState;
  /** Current physical projection cells (D-10). */
  getPhysicalCells?: () => readonly RotoPhysicalTimelineCell[];
  /** Selected stable keyId (D-01). */
  getSelectedKeyId?: () => string | null;
  /** Current direct physical navigation frame. */
  getCurrentAppFrame?: () => number;
}

export function useRotoTimelineActions(input: RotoTimelineActionsInput) {
  const saveRealKeyAtDisplayFrame = useCallback((displayFrame: number) => (
    saveRotoRealKeyTransaction({
      model: input.getModel(),
      displayFrame,
      currentSettings: input.getCurrentSettings?.() ?? toPhysicPaintRotoInterpolationSettings(input.getModel().settings),
    })
  ), [input]);

  const updateInterpolationSettings = useCallback((currentFrame: number, patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    const currentSettings = input.getCurrentSettings?.() ?? toPhysicPaintRotoInterpolationSettings(input.getModel().settings);
    const sourceFrameBeforeUpdate = getSourceRotoFrameForDisplayFrame(
      currentFrame,
      input.getStoreRealKeyFrames?.() ?? input.getModel().realSourceFrames,
      currentSettings,
      'existing-only',
    );
    const nextSettings = updateRotoInterpolationSettingsTransaction({
      currentFrame,
      currentSettings,
      patch,
      sourceFrameBeforeUpdate,
      storeRotoFrames: [],
      refreshedSettings: { ...currentSettings, ...patch, mode: 'duplicate' },
      failureStatus: null,
    }).settings;
    const refreshedSettings = input.setInterpolationSettings?.(nextSettings) ?? nextSettings;
    const storeRotoFrames = input.getStoreRotoFrames?.() ?? [];
    return updateRotoInterpolationSettingsTransaction({
      currentFrame,
      currentSettings,
      patch,
      sourceFrameBeforeUpdate,
      storeRotoFrames,
      refreshedSettings,
      failureStatus: input.getFailureStatus?.() ?? null,
    });
  }, [input]);

  return { saveRealKeyAtDisplayFrame, updateInterpolationSettings };
}

function toPhysicPaintRotoInterpolationSettings(settings: RotoSourceDisplayModel['settings']): PhysicPaintRotoInterpolationSettings {
  return {
    enabled: settings.enabled === true,
    inBetweenCount: settings.inBetweenCount ?? 1,
    mode: settings.mode === 'blend' ? 'blend' : 'duplicate',
    deform: settings.deform ?? 0,
    position: settings.position ?? 0,
    ...(settings.segmentSpacingOverrides ? { segmentSpacingOverrides: settings.segmentSpacingOverrides.map((override) => ({ ...override })) } : {}),
  };
}