import { describe, expect, it, vi } from 'vitest';
import {
  createPhysicsPaintEngineActions,
  type PhysicsPaintEngineActionsInput,
} from './usePhysicsPaintEngineActions';
import { makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './physicsPaintStudioSettings';

/**
 * 261027-klx — retargeted, not deleted. The engine-1 tool/physics cases
 * (selectTool, setBrushColor/Size/Opacity, setEdgeDetail, setPickup,
 * setSpread, setSmoothing, setEraseStrength, startPhysics, stopPhysics) died
 * with the Brush engine they exercised. The PAPER-DISPLAY cases survive
 * because background + grain are composite-only Studio state that must keep
 * working across the single-engine cutover:
 *
 *  - 56-05 (PAPER-01): a library paper id reaches the settings slot verbatim
 *    but never the engine's BgMode (library papers are paperPass, not engine).
 *  - 260923-bcm: grain SCALE is project-side only — no engine call at all.
 *  - studio-reopen-paper-washout: paper display must survive a NOT-YET-READY
 *    engine (null) or the store mirror and settings diverge and the next
 *    background-metadata sync clobbers the pick.
 *
 * The engine is structurally faked: `PhysicsPaintEngineActionsInput['engine']`
 * is the source of truth for the accepted shape, so this file carries no
 * engine-1 package import (Wave 2 clean break).
 */
type HarnessEngine = NonNullable<PhysicsPaintEngineActionsInput['engine']>;

function makeHarness(options: { locked?: boolean; engine?: 'present' | 'null' } = {}) {
  let locked = options.locked ?? false;
  let settings = makeInitialPhysicsPaintStudioSettings();
  const spies = {
    setBgMode: vi.fn(),
    setEmbossStrength: vi.fn(),
  };
  const setSettings = vi.fn(
    (update: PhysicsPaintStudioSettings | ((current: PhysicsPaintStudioSettings) => PhysicsPaintStudioSettings)) => {
      settings = typeof update === 'function' ? update(settings) : update;
    },
  );
  const actions = createPhysicsPaintEngineActions({
    engine: options.engine === 'null' ? null : (spies as unknown as HarnessEngine),
    settings,
    setSettings,
    isMutationLocked: () => locked,
  });
  return {
    actions,
    spies,
    setSettings,
    getSettings: () => settings,
    lock: () => {
      locked = true;
    },
  };
}

const PAPER_KEYS = ['background', 'grainStrength', 'grainScale'] as const;

function paperSnapshot(settings: PhysicsPaintStudioSettings) {
  return Object.fromEntries(PAPER_KEYS.map((key) => [key, settings[key]]));
}

describe('Physics Paint engine actions — paper display', () => {
  it('setBackground / setGrainStrength write the settings and mirror to a present engine', () => {
    const harness = makeHarness();

    harness.actions.setBackground('canvas2');
    harness.actions.setGrainStrength(0.65);

    expect(harness.spies.setBgMode).toHaveBeenCalledTimes(1);
    expect(harness.spies.setBgMode).toHaveBeenCalledWith('canvas2');
    expect(harness.spies.setEmbossStrength).toHaveBeenCalledTimes(1);
    expect(harness.spies.setEmbossStrength).toHaveBeenCalledWith(0.65);
    expect(harness.getSettings()).toMatchObject({ background: 'canvas2', grainStrength: 0.65 });
  });

  it('never sends a library paper id to engine.setBgMode (PAPER-01: papers are paperPass)', () => {
    const harness = makeHarness();

    harness.actions.setBackground('paper/kraft');

    expect(harness.spies.setBgMode).toHaveBeenCalledWith('transparent');
    expect(harness.getSettings().background).toBe('paper/kraft');
  });

  it('setGrainScale writes the setting with NO engine call (260923-bcm: project-side scale only)', () => {
    const harness = makeHarness();

    harness.actions.setGrainScale(2.5);

    expect(harness.spies.setBgMode).not.toHaveBeenCalled();
    expect(harness.spies.setEmbossStrength).not.toHaveBeenCalled();
    expect(harness.getSettings().grainScale).toBe(2.5);
  });

  it('setBackground / setGrainStrength / setGrainScale still write settings with no engine (composite-only)', () => {
    const harness = makeHarness({ engine: 'null' });

    harness.actions.setBackground('paper/kraft');
    harness.actions.setGrainStrength(0.8);
    harness.actions.setGrainScale(3);

    expect(harness.setSettings).toHaveBeenCalledTimes(3);
    expect(harness.getSettings()).toMatchObject({
      background: 'paper/kraft',
      grainStrength: 0.8,
      grainScale: 3,
    });
  });

  it('blocks every paper-display write while the controller lock is active', () => {
    const harness = makeHarness({ locked: true });
    const initialPaper = paperSnapshot(harness.getSettings());

    harness.actions.setBackground('white');
    harness.actions.setGrainStrength(0.65);
    harness.actions.setGrainScale(2);
    harness.actions.updateSetting('grainScale', 2);

    expect(harness.setSettings).not.toHaveBeenCalled();
    expect(harness.spies.setBgMode).not.toHaveBeenCalled();
    expect(harness.spies.setEmbossStrength).not.toHaveBeenCalled();
    expect(paperSnapshot(harness.getSettings())).toEqual(initialPaper);
  });

  it('updateSetting applies a single-key patch once the lock releases', () => {
    const harness = makeHarness();

    harness.actions.updateSetting('grainScale', 4);

    expect(harness.setSettings).toHaveBeenCalledTimes(1);
    expect(harness.getSettings().grainScale).toBe(4);
    expect(harness.getSettings().background).toBe(
      makeInitialPhysicsPaintStudioSettings().background,
    );
  });
});
