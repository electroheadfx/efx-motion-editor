import { computed, signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import type { RotoPlayScriptController, RotoPlayScriptControllerPorts } from '../roto/physicsPaintRotoPlayScriptController';

const hookState = vi.hoisted(() => ({ refs: [] as Array<{ current: unknown }>, cursor: 0 }));
const captured = vi.hoisted(() => ({ ports: null as RotoPlayScriptControllerPorts | null }));

vi.mock('preact/hooks', () => ({
  useEffect: vi.fn((effect: () => void | (() => void)) => { effect(); }),
  useRef: <T,>(initial: T) => {
    const index = hookState.cursor++;
    if (!hookState.refs[index]) hookState.refs[index] = { current: initial };
    return hookState.refs[index] as { current: T };
  },
}));
vi.mock('../bridge/usePhysicsPaintParentBridge', () => ({
  detectPhysicsPaintBridgeMode: vi.fn(),
  usePhysicsPaintApplyResultBridge: vi.fn(),
  usePhysicsPaintRotoAuthorityResultBridge: vi.fn(),
}));
vi.mock('../bridge/physicsPaintBridgeTransport', () => ({
  sendPhysicPaintApplyPayload: vi.fn(),
  sendPhysicPaintRotoAuthorityRequest: vi.fn(),
}));
vi.mock('../roto/physicsPaintRotoPlayScriptController', async () => {
  const actual = await vi.importActual<typeof import('../roto/physicsPaintRotoPlayScriptController')>('../roto/physicsPaintRotoPlayScriptController');
  return {
    ...actual,
    createRotoPlayScriptController: vi.fn((ports: RotoPlayScriptControllerPorts) => {
      captured.ports = ports;
      return {
        disabledReason: computed(() => {
          ports.availabilityRevision?.value;
          return ports.getSelection().kind === 'generated-interpolation' ? 'generated-disabled' : null;
        }),
        dispose: vi.fn(),
      } as unknown as RotoPlayScriptController;
    }),
  };
});

import { useRotoPlayScriptController } from './useRotoPlayScriptController';

function renderHook(ports: Omit<RotoPlayScriptControllerPorts, 'requestAuthority' | 'commit'>): RotoPlayScriptController {
  hookState.cursor = 0;
  return useRotoPlayScriptController(ports, 'Browser fallback');
}

function ports(version: number, mirrorAccepted: RotoPlayScriptControllerPorts['mirrorAccepted']) {
  const context: PhysicPaintLaunchContext = {
    operationId: `launch-${version}`,
    layerId: `layer-${version}`,
    startFrame: version,
    width: 100 + version,
    height: 200 + version,
    project: { name: `Project ${version}`, saved: true, contextId: `context-${version}` },
  };
  const background: PhysicPaintRotoBackgroundMetadata = { background: version === 1 ? 'canvas1' : 'canvas3', paperGrain: `canvas${version}`, grainStrength: version / 10 };
  return {
    library: { selected: signal({ id: 'script' }), selectedId: signal('script'), busy: signal(false) } as unknown as RotoPlayScriptControllerPorts['library'],
    getLaunchContext: () => context,
    getSelection: () => version === 1
      ? { kind: 'real-key' as const, sourceFrame: 4, displayFrame: 4 }
      : { kind: 'generated-interpolation' as const, sourceFrame: 9, displayFrame: 12 },
    getMotion: () => ({ deformation: version * 10, position: version * 20 }),
    getBackground: () => background,
    getOperationLocked: () => version === 2,
    getSize: () => ({ width: 100 + version, height: 200 + version }),
    mirrorAccepted,
    stopPlayback: vi.fn(),
    log: vi.fn(),
  };
}

describe('useRotoPlayScriptController', () => {
  beforeEach(() => {
    hookState.refs = [];
    hookState.cursor = 0;
    captured.ports = null;
  });

  it('proxies every dynamic port and refreshes availability after rerender', () => {
    const firstMirror = vi.fn();
    const secondMirror = vi.fn();
    const controller = renderHook(ports(1, firstMirror));
    const stablePorts = captured.ports!;

    expect(controller.disabledReason.value).toBeNull();
    expect(stablePorts.getSelection()).toMatchObject({ kind: 'real-key', sourceFrame: 4 });
    const initialAvailabilityRevision = stablePorts.availabilityRevision?.value;

    expect(renderHook(ports(1, firstMirror))).toBe(controller);
    expect(stablePorts.availabilityRevision?.value).toBe(initialAvailabilityRevision);

    const rerendered = renderHook(ports(2, secondMirror));

    expect(rerendered).toBe(controller);
    expect(controller.disabledReason.value).toBe('generated-disabled');
    expect(stablePorts.getSelection()).toMatchObject({ kind: 'generated-interpolation', sourceFrame: 9, displayFrame: 12 });
    expect(stablePorts.getLaunchContext()).toMatchObject({ layerId: 'layer-2', project: { contextId: 'context-2' } });
    expect(stablePorts.getMotion()).toEqual({ deformation: 20, position: 40 });
    expect(stablePorts.getBackground()).toEqual({ background: 'canvas3', paperGrain: 'canvas2', grainStrength: 0.2 });
    expect(stablePorts.getOperationLocked()).toBe(true);
    expect(stablePorts.getSize()).toEqual({ width: 102, height: 202 });

    stablePorts.mirrorAccepted([], 9, stablePorts.getBackground());
    stablePorts.stopPlayback();
    stablePorts.log('current');
    expect(firstMirror).not.toHaveBeenCalled();
    expect(secondMirror).toHaveBeenCalledWith([], 9, expect.objectContaining({ background: 'canvas3' }));
  });
});
