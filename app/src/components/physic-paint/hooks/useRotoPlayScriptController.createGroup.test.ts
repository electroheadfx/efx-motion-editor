import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import type { RotoPlayScriptController, RotoPlayScriptControllerPorts } from '../roto/physicsPaintRotoPlayScriptController';

const hookState = vi.hoisted(() => ({ refs: [] as Array<{ current: unknown }>, cursor: 0 }));
const captured = vi.hoisted(() => ({
  ports: null as RotoPlayScriptControllerPorts | null,
  authorityListener: null as ((result: PhysicPaintRotoAuthorityResult) => void) | null,
  sentAuthorityRequests: [] as Array<{ operationId: string; canonicalStart: number }>,
}));

vi.mock('preact/hooks', () => ({
  useEffect: vi.fn((effect: () => void | (() => void)) => { effect(); }),
  useRef: <T,>(initial: T) => {
    const index = hookState.cursor++;
    if (!hookState.refs[index]) hookState.refs[index] = { current: initial };
    return hookState.refs[index] as { current: T };
  },
}));
vi.mock('../bridge/usePhysicsPaintParentBridge', () => ({
  detectPhysicsPaintBridgeMode: vi.fn(async () => 'Browser fallback'),
  usePhysicsPaintApplyResultBridge: vi.fn(),
  usePhysicsPaintRotoAuthorityResultBridge: vi.fn((listener: (result: PhysicPaintRotoAuthorityResult) => void) => {
    captured.authorityListener = listener;
  }),
}));
vi.mock('../bridge/physicsPaintBridgeTransport', () => ({
  sendPhysicPaintApplyPayload: vi.fn(),
  sendPhysicPaintRotoAuthorityRequest: vi.fn((request: { operationId: string; canonicalStart: number }) => {
    captured.sentAuthorityRequests.push(request);
  }),
}));

import { useRotoPlayScriptController } from './useRotoPlayScriptController';
import { getPhysicPaintRotoAuthority } from '../../../lib/physicPaintBridge';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { layerStore } from '../../../stores/layerStore';
import { sequenceStore } from '../../../stores/sequenceStore';
import { projectStore } from '../../../stores/projectStore';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

type HookPorts = Parameters<typeof useRotoPlayScriptController>[0];

const LAYER_ID = 'phys-layer-1';
const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

function blankPayload(appFrame: number): PhysicPaintRotoRealKeyPayload {
  return { frameIndex: 0, appFrame, dataUrl: pngDataUrl(`k${appFrame}`), width: 1, height: 1 };
}

function seedStoreWithKeys(): void {
  physicPaintStore.reset();
  projectStore.projectContextId.value = CONTEXT_ID;
  const layer = {
    id: LAYER_ID,
    name: 'Physics Paint',
    type: 'physic-paint' as const,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    source: { type: 'physic-paint' as const, layerId: LAYER_ID },
  };
  vi.spyOn(layerStore.layers, 'peek').mockReturnValue([layer] as never);
  vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([] as never);
  sequenceStore.sequences.value = [{
    id: 'parent-seq',
    kind: 'fx',
    name: 'Parent sequence',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [layer as never],
    inFrame: 0,
    outFrame: 100,
  } as never];
  const realKeyRecords: PhysicPaintRotoRealKeyRecord[] = [];
  for (let frame = 0; frame <= 99; frame += 4) {
    realKeyRecords.push({ kind: 'real-key', keyId: `k${frame}`, appFrame: frame, payload: blankPayload(frame) });
  }
  const revision = buildPhysicPaintRotoPhysicalRevision(realKeyRecords, { enabled: false, mode: 'duplicate' }, [], []);
  const result = physicPaintStore.replaceRotoPhysicalDocument(LAYER_ID, TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords,
    interpolation: { enabled: false, mode: 'duplicate' },
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision,
    incomingInterpolationBreakKeyIds: [],
  });
  if (!result.ok) throw new Error(result.error);
}

function renderHook(ports: HookPorts): RotoPlayScriptController {
  hookState.cursor = 0;
  return useRotoPlayScriptController(ports, 'Browser fallback');
}

function ports(): HookPorts {
  const context: PhysicPaintLaunchContext = {
    operationId: 'launch-1',
    layerId: LAYER_ID,
    startFrame: 96,
    width: 1920,
    height: 1080,
    project: { name: 'Project', saved: true, contextId: CONTEXT_ID },
  };
  return {
    library: { selected: signal({ id: 'script-1' }), selectedId: signal('script-1'), busy: signal(false) } as unknown as RotoPlayScriptControllerPorts['library'],
    getLaunchContext: () => context,
    getSelection: () => ({ kind: 'real-key' as const, keyId: 'k96', appFrame: 96 }),
    getMotion: () => ({ deformation: 0, position: 0 }),
    getBrushColor: () => '#103c65',
    getBackgroundMetadata: () => ({ background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.45 }),
    getOperationLocked: () => false,
    getSize: () => ({ width: 1920, height: 1080 }),
    getRotoLoopClips: () => physicPaintStore.getRotoPhysicalLoopClips(LAYER_ID, TEST_TRACK_ID),
    getLoopEditSnapshot: (placementStart) => {
      const document = physicPaintStore.getRotoPhysicalDocument(LAYER_ID, TEST_TRACK_ID);
      if (!document) return null;
      return {
        identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        physicalCapacity: 600,
        layerEndExclusive: 100,
        remainingCapacity: Math.max(0, 100 - placementStart),
        interpolationEnabled: document.interpolation.enabled,
      };
    },
    getPhysicalDocument: () => physicPaintStore.getRotoPhysicalDocument(LAYER_ID, TEST_TRACK_ID),
    stopPlayback: vi.fn(),
    log: vi.fn(),
    executePhysicalEdit: vi.fn(async () => true),
    pendingOperationId: signal<string | null>(null),
    acceptedOutput: signal(null),
    failureOutput: signal(null),
  };
}

describe('useRotoPlayScriptController Create Group modal (43.4 regression seam)', () => {
  beforeEach(() => {
    hookState.refs = [];
    hookState.cursor = 0;
    captured.ports = null;
    captured.authorityListener = null;
    captured.sentAuthorityRequests = [];
    seedStoreWithKeys();
  });

  it('opens the Create Group modal through the real bridge authority round-trip on a valid real key', async () => {
    const controller = renderHook(ports());
    expect(captured.authorityListener).not.toBeNull();
    expect(controller.disabledReason.value).toBeNull();

    const opening = controller.openConfirmation();
    expect(captured.sentAuthorityRequests).toHaveLength(1);
    const sent = captured.sentAuthorityRequests[0];

    // Drive the parent authority response through the captured listener with
    // the SAME operationId the bridge request carried.
    const authority = getPhysicPaintRotoAuthority({
      operationId: sent.operationId,
      projectContextId: CONTEXT_ID,
      layerId: LAYER_ID,
      canonicalStart: sent.canonicalStart,
    });
    captured.authorityListener!(authority);

    await opening;
    expect(controller.confirmationOpen.value).toBe(true);
    expect(controller.phase.value).toBe('idle');
  });

  it('opens the Create Group modal from a real key past the stale display outFrame (43.4 regression)', async () => {
    // The user dragged a Key Rail rightward into genuine free space past the
    // main-editor outFrame (100). The Create Group action must still open its
    // modal: the child document's single end authority is the physical
    // capacity, never the stale display outFrame.
    const controller = renderHook({
      ...ports(),
      getSelection: () => ({ kind: 'real-key' as const, keyId: 'k104', appFrame: 104 }),
      getLaunchContext: () => ({
        operationId: 'launch-1',
        layerId: LAYER_ID,
        startFrame: 104,
        width: 1920,
        height: 1080,
        project: { name: 'Project', saved: true, contextId: CONTEXT_ID },
      }),
    });
    expect(controller.disabledReason.value).toBeNull();

    const opening = controller.openConfirmation();
    expect(captured.sentAuthorityRequests).toHaveLength(1);
    const sent = captured.sentAuthorityRequests[0];

    const authority = getPhysicPaintRotoAuthority({
      operationId: sent.operationId,
      projectContextId: CONTEXT_ID,
      layerId: LAYER_ID,
      canonicalStart: sent.canonicalStart,
    });
    captured.authorityListener!(authority);

    await opening;
    expect(controller.confirmationOpen.value).toBe(true);
    expect(controller.phase.value).toBe('idle');
  });
});
