import { useCallback } from 'preact/hooks';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';

export function usePhysicsPaintEngineActions(input: {
  engine: EfxPaintEngine | null;
  settings: PhysicsPaintStudioSettings;
  setSettings: Dispatch<StateUpdater<PhysicsPaintStudioSettings>>;
  isMutationLocked?: () => boolean;
}) {
  const updateSetting = useCallback(<K extends keyof PhysicsPaintStudioSettings>(key: K, value: PhysicsPaintStudioSettings[K]) => {
    input.setSettings((current) => ({ ...current, [key]: value }));
  }, [input.setSettings]);

  const selectTool = useCallback((tool: ToolType, physicsMode: 'local' | null = input.settings.physicsMode) => {
    if (!input.engine) return;
    input.engine.setTool(tool);
    input.engine.setPhysicsMode(physicsMode);
    input.setSettings((current) => ({ ...current, tool, physicsMode }));
  }, [input.engine, input.setSettings, input.settings.physicsMode]);

  const setBrushColor = useCallback((color: string, opacity: number) => {
    if (!input.engine) return;
    input.engine.setColorHex(color);
    input.engine.setBrushOpacity(opacity);
    input.setSettings((current) => ({ ...current, color, opacity }));
  }, [input.engine, input.setSettings]);

  const setBrushSize = useCallback((size: number) => {
    input.engine?.setBrushSize(size);
    updateSetting('size', size);
  }, [input.engine, updateSetting]);

  const setBrushOpacity = useCallback((opacity: number) => {
    input.engine?.setBrushOpacity(opacity);
    updateSetting('opacity', opacity);
  }, [input.engine, updateSetting]);

  const setBackground = useCallback((background: BgMode) => {
    input.engine?.setBgMode(background);
    updateSetting('background', background);
  }, [input.engine, updateSetting]);

  const setPaperGrain = useCallback((paperGrain: string) => {
    input.engine?.setPaperGrain(paperGrain);
    updateSetting('paperGrain', paperGrain);
  }, [input.engine, updateSetting]);

  const setGrainStrength = useCallback((grainStrength: number) => {
    input.engine?.setEmbossStrength(grainStrength);
    updateSetting('grainStrength', grainStrength);
  }, [input.engine, updateSetting]);

  const setEdgeDetail = useCallback((edgeDetail: number) => {
    input.engine?.setEdgeDetail(edgeDetail);
    updateSetting('edgeDetail', edgeDetail);
  }, [input.engine, updateSetting]);

  const setPickup = useCallback((pickup: number) => {
    input.engine?.setPickup(pickup);
    updateSetting('pickup', pickup);
  }, [input.engine, updateSetting]);

  const setSpread = useCallback((spread: number) => {
    input.engine?.setLocalSpreadStrength(spread);
    updateSetting('spread', spread);
  }, [input.engine, updateSetting]);

  const setSmoothing = useCallback((smoothing: number) => {
    input.engine?.setAntiAlias(smoothing);
    updateSetting('smoothing', smoothing);
  }, [input.engine, updateSetting]);

  const setEraseStrength = useCallback((eraseStrength: number) => {
    input.engine?.setEraseStrength(eraseStrength);
    updateSetting('eraseStrength', eraseStrength);
  }, [input.engine, updateSetting]);

  const startPhysics = useCallback((mode: 'last' | 'all') => {
    if (!input.engine || input.isMutationLocked?.()) return;
    input.setSettings((current) => ({ ...current, activePhysicsAction: mode }));
    input.engine.startPhysics(mode);
  }, [input.engine, input.isMutationLocked, input.setSettings]);

  const stopPhysics = useCallback(() => {
    if (!input.engine || input.isMutationLocked?.()) return;
    input.setSettings((current) => ({ ...current, activePhysicsAction: null }));
    input.engine.stopPhysics();
  }, [input.engine, input.isMutationLocked, input.setSettings]);

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
