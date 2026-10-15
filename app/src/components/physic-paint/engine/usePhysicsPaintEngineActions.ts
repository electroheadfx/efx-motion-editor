import { useCallback, useMemo } from 'preact/hooks';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { PhysicsPaintStudioSettings, StudioBackgroundMode } from '../engine/physicsPaintStudioSettings';

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

  const setBackground = (background: StudioBackgroundMode) => {
    if (!canMutate()) return;
    // 56-05 (PAPER-01): library paper ids never reach the engine's BgMode —
    // the engine draws its own paper for the deposit role only; the display
    // fond is paperPass. Selector segments pass through unchanged.
    const engineMode: BgMode = (background === 'transparent' || background === 'white' || background === 'canvas1' || background === 'canvas2' || background === 'canvas3' || background === 'photo')
      ? background
      : 'transparent';
    input.engine!.setBgMode(engineMode);
    updateSetting('background', background);
  };

  const setGrainStrength = (grainStrength: number) => {
    if (!canMutate()) return;
    input.engine!.setEmbossStrength(grainStrength);
    updateSetting('grainStrength', grainStrength);
  };

  // 260923-bcm: grain SCALE is project-side paper pattern only — engine
  // visible background is suppressed (PhysicsPaintCanvasMount), so NO engine call.
  const setGrainScale = (grainScale: number) => {
    updateSetting('grainScale', grainScale);
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
    setGrainStrength,
    setGrainScale,
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
