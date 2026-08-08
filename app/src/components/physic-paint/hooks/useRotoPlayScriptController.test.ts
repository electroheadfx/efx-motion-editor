import { computed, signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
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

type HookPorts = Parameters<typeof useRotoPlayScriptController>[0];

function renderHook(ports: HookPorts): RotoPlayScriptController {
  hookState.cursor = 0;
  return useRotoPlayScriptController(ports, 'Browser fallback');
}

function ports(version: number): HookPorts {
  const context: PhysicPaintLaunchContext = {
    operationId: `launch-${version}`,
    layerId: `layer-${version}`,
    startFrame: version,
    width: 100 + version,
    height: 200 + version,
    project: { name: `Project ${version}`, saved: true, contextId: `context-${version}` },
  };
  return {
    library: { selected: signal({ id: 'script' }), selectedId: signal('script'), busy: signal(false) } as unknown as RotoPlayScriptControllerPorts['library'],
    getLaunchContext: () => context,
    getSelection: () => version === 1
      ? { kind: 'real-key' as const, keyId: 'key-4', appFrame: 4 }
      : { kind: 'generated-interpolation' as const, keyId: null, appFrame: 9 },
    getMotion: () => ({ deformation: version * 10, position: version * 20 }),
    getBrushColor: () => (version === 1 ? '#103c65' : '#aa5500'),
    getOperationLocked: () => version === 2,
    getSize: () => ({ width: 100 + version, height: 200 + version }),
    getRotoLoopClips: () => [{
      loopId: `loop-${version}`,
      placementStart: version,
      sourceKeyIds: [`key-${version}`],
      repeat: 2,
      mode: 'static' as const,
    }],
    getLoopEditSnapshot: (placementStart) => ({
      identities: [{ keyId: `key-${version}`, appFrame: version }],
      physicalCapacity: 100 + version,
      layerEndExclusive: 100 + version,
      interpolationEnabled: false,
      remainingCapacity: 100 + version - placementStart,
    }),
    stopPlayback: vi.fn(),
    log: vi.fn(),
    executePhysicalEdit: vi.fn(async () => true),
    pendingOperationId: signal<string | null>(null),
    acceptedOutput: signal(null),
  };
}

describe('useRotoPlayScriptController', () => {
  beforeEach(() => {
    hookState.refs = [];
    hookState.cursor = 0;
    captured.ports = null;
  });

  it('proxies every dynamic port and refreshes availability after rerender', () => {
    const firstPorts = ports(1);
    const controller = renderHook(firstPorts);
    const stablePorts = captured.ports!;

    expect(controller.disabledReason.value).toBeNull();
    expect(stablePorts.getSelection()).toMatchObject({ kind: 'real-key', keyId: 'key-4', appFrame: 4 });
    expect(typeof stablePorts.requestAuthority).toBe('function');
    expect(typeof stablePorts.commit).toBe('function');
    const initialAvailabilityRevision = stablePorts.availabilityRevision?.value;

    expect(renderHook(ports(1))).toBe(controller);
    expect(stablePorts.availabilityRevision?.value).toBe(initialAvailabilityRevision);

    const secondPorts = ports(2);
    const rerendered = renderHook(secondPorts);

    expect(rerendered).toBe(controller);
    expect(controller.disabledReason.value).toBe('generated-disabled');
    expect(stablePorts.getSelection()).toMatchObject({ kind: 'generated-interpolation', keyId: null, appFrame: 9 });
    expect(stablePorts.getLaunchContext()).toMatchObject({ layerId: 'layer-2', project: { contextId: 'context-2' } });
    expect(stablePorts.getMotion()).toEqual({ deformation: 20, position: 40 });
    expect(stablePorts.getBrushColor()).toBe('#aa5500');
    expect(stablePorts.getOperationLocked()).toBe(true);
    expect(stablePorts.getSize()).toEqual({ width: 102, height: 202 });
    expect(stablePorts.getRotoLoopClips?.()).toEqual([{
      loopId: 'loop-2',
      placementStart: 2,
      sourceKeyIds: ['key-2'],
      repeat: 2,
      mode: 'static',
    }]);
    expect(stablePorts.getLoopEditSnapshot?.(9)).toEqual({
      identities: [{ keyId: 'key-2', appFrame: 2 }],
      physicalCapacity: 102,
      layerEndExclusive: 102,
      remainingCapacity: 93,
      interpolationEnabled: false,
    });

    stablePorts.stopPlayback();
    stablePorts.log('current');
    expect(firstPorts.stopPlayback).not.toHaveBeenCalled();
    expect(firstPorts.log).not.toHaveBeenCalled();
    expect(secondPorts.stopPlayback).toHaveBeenCalledOnce();
    expect(secondPorts.log).toHaveBeenCalledWith('current');
  });
});
