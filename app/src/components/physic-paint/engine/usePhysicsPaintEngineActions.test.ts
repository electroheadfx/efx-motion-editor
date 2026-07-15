import { describe, expect, it, vi } from 'vitest';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { createPhysicsPaintEngineActions } from './usePhysicsPaintEngineActions';
import { makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './physicsPaintStudioSettings';

function makeHarness() {
  let locked = true;
  let settings = makeInitialPhysicsPaintStudioSettings();
  const engine = {
    setTool: vi.fn(),
    setPhysicsMode: vi.fn(),
    setColorHex: vi.fn(),
    setBrushOpacity: vi.fn(),
    setBrushSize: vi.fn(),
    setBgMode: vi.fn(),
    setPaperGrain: vi.fn(),
    setEmbossStrength: vi.fn(),
    setEdgeDetail: vi.fn(),
    setPickup: vi.fn(),
    setLocalSpreadStrength: vi.fn(),
    setAntiAlias: vi.fn(),
    setEraseStrength: vi.fn(),
    startPhysics: vi.fn(),
    stopPhysics: vi.fn(),
  } as unknown as EfxPaintEngine;
  const setSettings = vi.fn((update: PhysicsPaintStudioSettings | ((current: PhysicsPaintStudioSettings) => PhysicsPaintStudioSettings)) => {
    settings = typeof update === 'function' ? update(settings) : update;
  });
  const actions = createPhysicsPaintEngineActions({
    engine,
    settings,
    setSettings,
    isMutationLocked: () => locked,
  });
  return { actions, engine, setSettings, getSettings: () => settings, unlock: () => { locked = false; } };
}

function invokeEveryMutation(actions: ReturnType<typeof createPhysicsPaintEngineActions>) {
  actions.selectTool('erase', 'local');
  actions.setBrushColor('#abcdef', 42);
  actions.setBrushSize(17);
  actions.setBrushOpacity(63);
  actions.setBackground('white');
  actions.setPaperGrain('canvas2');
  actions.setGrainStrength(0.65);
  actions.setEdgeDetail(71);
  actions.setPickup(29);
  actions.setSpread(36);
  actions.setSmoothing(3);
  actions.setEraseStrength(88);
  actions.startPhysics('all');
  actions.stopPhysics();
}

describe('Physics Paint engine actions', () => {
  it('blocks every engine-mutating action and setting update while the controller lock is active', () => {
    const harness = makeHarness();
    const initialSettings = harness.getSettings();

    invokeEveryMutation(harness.actions);

    for (const method of Object.values(harness.engine as unknown as Record<string, ReturnType<typeof vi.fn>>)) {
      expect(method).not.toHaveBeenCalled();
    }
    expect(harness.setSettings).not.toHaveBeenCalled();
    expect(harness.getSettings()).toEqual(initialSettings);
  });

  it('resumes every engine-mutating action immediately after the lock releases', () => {
    const harness = makeHarness();
    harness.unlock();

    invokeEveryMutation(harness.actions);

    expect(harness.engine.setTool).toHaveBeenCalledWith('erase');
    expect(harness.engine.setPhysicsMode).toHaveBeenCalledWith('local');
    expect(harness.engine.setColorHex).toHaveBeenCalledWith('#abcdef');
    expect(harness.engine.setBrushOpacity).toHaveBeenNthCalledWith(1, 42);
    expect(harness.engine.setBrushSize).toHaveBeenCalledWith(17);
    expect(harness.engine.setBrushOpacity).toHaveBeenNthCalledWith(2, 63);
    expect(harness.engine.setBgMode).toHaveBeenCalledWith('white');
    expect(harness.engine.setPaperGrain).toHaveBeenCalledWith('canvas2');
    expect(harness.engine.setEmbossStrength).toHaveBeenCalledWith(0.65);
    expect(harness.engine.setEdgeDetail).toHaveBeenCalledWith(71);
    expect(harness.engine.setPickup).toHaveBeenCalledWith(29);
    expect(harness.engine.setLocalSpreadStrength).toHaveBeenCalledWith(36);
    expect(harness.engine.setAntiAlias).toHaveBeenCalledWith(3);
    expect(harness.engine.setEraseStrength).toHaveBeenCalledWith(88);
    expect(harness.engine.startPhysics).toHaveBeenCalledWith('all');
    expect(harness.engine.stopPhysics).toHaveBeenCalledTimes(1);
    expect(harness.getSettings()).toMatchObject({
      tool: 'erase', physicsMode: 'local', color: '#abcdef', opacity: 63, size: 17,
      background: 'white', paperGrain: 'canvas2', grainStrength: 0.65,
      edgeDetail: 71, pickup: 29, spread: 36, smoothing: 3, eraseStrength: 88,
      activePhysicsAction: null,
    });
  });
});
