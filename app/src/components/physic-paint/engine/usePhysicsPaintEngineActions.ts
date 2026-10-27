import { useCallback, useMemo } from 'preact/hooks';
import type { BgMode } from '../types/paintCore';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { PhysicsPaintStudioSettings, StudioBackgroundMode } from '../engine/physicsPaintStudioSettings';

/**
 * 261027-klx: the ONLY engine surface these settings actions may touch.
 *
 * Paper display is composite-only — the document fond / paperPass own the
 * visible paper — so the actions mirror the selector mode into whatever
 * narrow surface the Studio holds (the app-owned Roto preview-base port) and
 * write the settings. Every engine-1 tool setter is gone with the Brush
 * engine.
 */
export interface PhysicsPaintPaperDisplayEngine {
  setBgMode: (mode: BgMode) => void;
  setEmbossStrength?: (strength: number) => void;
}

export interface PhysicsPaintEngineActionsInput {
  engine: PhysicsPaintPaperDisplayEngine | null;
  settings: PhysicsPaintStudioSettings;
  setSettings: Dispatch<StateUpdater<PhysicsPaintStudioSettings>>;
  isMutationLocked?: () => boolean;
}

export function createPhysicsPaintEngineActions(input: PhysicsPaintEngineActionsInput) {
  const canMutate = () => Boolean(input.engine) && !input.isMutationLocked?.();
  // studio-reopen-paper-washout: paper-display fields (background id, grain
  // strength/scale) are COMPOSITE-ONLY — the document fond / paperPass own the
  // visible paper. They must survive an engine that is not ready yet, or the
  // store mirror (written unconditionally by setPaperId) and the Studio
  // settings diverge and the next background-metadata sync clobbers the pick.
  const canUpdatePaperDisplay = () => !input.isMutationLocked?.();
  const updateSetting = <K extends keyof PhysicsPaintStudioSettings>(key: K, value: PhysicsPaintStudioSettings[K]) => {
    if (!canMutate()) return;
    input.setSettings((current) => ({ ...current, [key]: value }));
  };
  const updatePaperDisplaySetting = <K extends keyof PhysicsPaintStudioSettings>(key: K, value: PhysicsPaintStudioSettings[K]) => {
    if (!canUpdatePaperDisplay()) return;
    input.setSettings((current) => ({ ...current, [key]: value }));
  };

  const setBackground = (background: StudioBackgroundMode) => {
    if (!canUpdatePaperDisplay()) return;
    // 56-05 (PAPER-01): library paper ids never reach the engine's BgMode —
    // the display fond is paperPass. Selector segments pass through unchanged.
    if (input.engine) {
      const engineMode: BgMode = (background === 'transparent' || background === 'white' || background === 'canvas1' || background === 'canvas2' || background === 'canvas3' || background === 'photo')
        ? background
        : 'transparent';
      input.engine.setBgMode(engineMode);
    }
    updatePaperDisplaySetting('background', background);
  };

  const setGrainStrength = (grainStrength: number) => {
    if (!canUpdatePaperDisplay()) return;
    input.engine?.setEmbossStrength?.(grainStrength);
    updatePaperDisplaySetting('grainStrength', grainStrength);
  };

  // 260923-bcm: grain SCALE is project-side paper pattern only — NO engine call.
  const setGrainScale = (grainScale: number) => {
    updatePaperDisplaySetting('grainScale', grainScale);
  };

  return {
    updateSetting,
    setBackground,
    setGrainStrength,
    setGrainScale,
  };
}

export function usePhysicsPaintEngineActions(input: PhysicsPaintEngineActionsInput) {
  const isMutationLocked = useCallback(() => input.isMutationLocked?.() ?? false, [input.isMutationLocked]);
  return useMemo(
    () => createPhysicsPaintEngineActions({ ...input, isMutationLocked }),
    [input.engine, input.setSettings, isMutationLocked],
  );
}
