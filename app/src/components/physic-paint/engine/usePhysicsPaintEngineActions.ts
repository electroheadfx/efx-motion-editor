import { useCallback, useMemo } from 'preact/hooks';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';

export interface PhysicsPaintEngineActionsInput {
  engine: EfxPaintEngine | null;
  settings: PhysicsPaintStudioSettings;
  setSettings: Dispatch<StateUpdater<PhysicsPaintStudioSettings>>;
  isMutationLocked?: () => boolean;
}

export function createPhysicsPaintEngineActions(input: PhysicsPaintEngineActionsInput) {
  const canMutate = () => Boolean(input.engine) && !input.isMutationLocked?.();
  const updateSetting = <K extends keyof PhysicsPaintStudioSettings>(key: K, value: PhysicsPaintStudioSettings[K]) => {
    if (!canMutate()) return;
    input.setSettings((current) => ({ ...current, [key]: value }));
  };

  const selectTool = (tool: ToolType, physicsMode: 'local' | null = input.settings.physicsMode) => {
    if (!canMutate()) return;
    input.engine!.setTool(tool);
    input.engine!.setPhysicsMode(physicsMode);
    input.setSettings((current) => ({ ...current, tool, physicsMode }));
  };

  const setBrushColor = (color: string, opacity: number) => {
    if (!canMutate()) return;
    input.engine!.setColorHex(color);
    input.engine!.setBrushOpacity(opacity);
    input.setSettings((current) => ({ ...current, color, opacity }));
  };

  const setBrushSize = (size: number) => {
    if (!canMutate()) return;
    input.engine!.setBrushSize(size);
    updateSetting('size', size);
  };

  const setBrushOpacity = (opacity: number) => {
    if (!canMutate()) return;
    input.engine!.setBrushOpacity(opacity);
    updateSetting('opacity', opacity);
  };

  const setBackground = (background: BgMode) => {
    if (!canMutate()) return;
    input.engine!.setBgMode(background);
    updateSetting('background', background);
  };

  const setPaperGrain = (paperGrain: string) => {
    if (!canMutate()) return;
    input.engine!.setPaperGrain(paperGrain);
    updateSetting('paperGrain', paperGrain);
  };

  const setGrainStrength = (grainStrength: number) => {
    if (!canMutate()) return;
    input.engine!.setEmbossStrength(grainStrength);
    updateSetting('grainStrength', grainStrength);
  };

  const setEdgeDetail = (edgeDetail: number) => {
    if (!canMutate()) return;
    input.engine!.setEdgeDetail(edgeDetail);
    updateSetting('edgeDetail', edgeDetail);
  };

  const setPickup = (pickup: number) => {
    if (!canMutate()) return;
    input.engine!.setPickup(pickup);
    updateSetting('pickup', pickup);
  };

  const setSpread = (spread: number) => {
    if (!canMutate()) return;
    input.engine!.setLocalSpreadStrength(spread);
    updateSetting('spread', spread);
  };

  const setSmoothing = (smoothing: number) => {
    if (!canMutate()) return;
    input.engine!.setAntiAlias(smoothing);
    updateSetting('smoothing', smoothing);
  };

  const setEraseStrength = (eraseStrength: number) => {
    if (!canMutate()) return;
    input.engine!.setEraseStrength(eraseStrength);
    updateSetting('eraseStrength', eraseStrength);
  };

  const startPhysics = (mode: 'last' | 'all') => {
    if (!canMutate()) return;
    input.setSettings((current) => ({ ...current, activePhysicsAction: mode }));
    input.engine!.startPhysics(mode);
  };

  const stopPhysics = () => {
    if (!canMutate()) return;
    input.setSettings((current) => ({ ...current, activePhysicsAction: null }));
    input.engine!.stopPhysics();
  };

  return {
    updateSetting,
    selectTool,
    setBrushColor,
    setBrushSize,
    setBrushOpacity,
    setBackground,
    setPaperGrain,
    setGrainStrength,
    setEdgeDetail,
    setPickup,
    setSpread,
    setSmoothing,
    setEraseStrength,
    startPhysics,
    stopPhysics,
  };
}

export function usePhysicsPaintEngineActions(input: PhysicsPaintEngineActionsInput) {
  const isMutationLocked = useCallback(() => input.isMutationLocked?.() ?? false, [input.isMutationLocked]);
  return useMemo(
    () => createPhysicsPaintEngineActions({ ...input, isMutationLocked }),
    [input.engine, input.setSettings, input.settings.physicsMode, isMutationLocked],
  );
}
