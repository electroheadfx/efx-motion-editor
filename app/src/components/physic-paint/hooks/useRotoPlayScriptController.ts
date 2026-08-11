import { signal, type ReadonlySignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import {
  createRotoPlayScriptController,
  type RotoPlayScriptController,
  type RotoPlayScriptControllerPorts,
} from '../roto/physicsPaintRotoPlayScriptController';
import { PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalEditAcceptedOutput } from '../roto/rotoCoordinatorPorts';
import type { RotoPlayScriptExecuteInput } from './useRotoPhysicalEditCoordinator';
import { sendPhysicPaintRotoAuthorityRequest } from '../bridge/physicsPaintBridgeTransport';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintRotoAuthorityResultBridge, type PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

interface RotoPlayScriptCoordinatorPort<EngineState> {
  executePhysicalEdit: (input: RotoPlayScriptExecuteInput) => Promise<boolean>;
  readonly pendingOperationId: ReadonlySignal<string | null>;
  readonly acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>;
}

export function useRotoPlayScriptController<EngineState = unknown>(
  ports: Omit<RotoPlayScriptControllerPorts, 'requestAuthority' | 'commit'> & RotoPlayScriptCoordinatorPort<EngineState>,
  bridgeMode: PhysicsPaintBridgeMode,
): RotoPlayScriptController {
  const portsRef = useRef(ports); portsRef.current = ports;
  const modeRef = useRef(bridgeMode); modeRef.current = bridgeMode;
  const availabilityRevision = useRef(signal(0));
  const nextAvailabilitySnapshot = readAvailabilitySnapshot(ports);
  const availabilitySnapshot = useRef(nextAvailabilitySnapshot);
  useEffect(() => {
    if (sameAvailabilitySnapshot(availabilitySnapshot.current, nextAvailabilitySnapshot)) return;
    availabilitySnapshot.current = nextAvailabilitySnapshot;
    availabilityRevision.current.value += 1;
  }, [nextAvailabilitySnapshot.operationLocked, nextAvailabilitySnapshot.projectSaved, nextAvailabilitySnapshot.selectionKind, nextAvailabilitySnapshot.keyId, nextAvailabilitySnapshot.appFrame]);
  const authorityPending = useRef(new Map<string, (result: PhysicPaintRotoAuthorityResult) => void>());
  usePhysicsPaintRotoAuthorityResultBridge((result) => { authorityPending.current.get(result.operationId)?.(result); authorityPending.current.delete(result.operationId); });

  const controllerRef = useRef<RotoPlayScriptController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRotoPlayScriptController({
      library: ports.library,
      getLaunchContext: () => portsRef.current.getLaunchContext(),
      getSelection: () => portsRef.current.getSelection(),
      getMotion: () => portsRef.current.getMotion(),
      getBrushColor: () => portsRef.current.getBrushColor(),
      getBackgroundMetadata: () => portsRef.current.getBackgroundMetadata(),
      getOperationLocked: () => portsRef.current.getOperationLocked(),
      getSize: () => portsRef.current.getSize(),
      getRotoLoopClips: () => portsRef.current.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
      getLoopEditSnapshot: (placementStart) => portsRef.current.getLoopEditSnapshot?.(placementStart) ?? null,
      getPhysicalDocument: () => portsRef.current.getPhysicalDocument?.() ?? null,
      availabilityRevision: availabilityRevision.current,
      stopPlayback: () => portsRef.current.stopPlayback(),
      log: (...args) => portsRef.current.log(...args),
      requestAuthority: (operationId, start) => requestWithTimeout(authorityPending.current, operationId, async () => {
        const context = portsRef.current.getLaunchContext();
        if (!context?.project) throw new Error('Project authority is unavailable.');
        const mode = modeRef.current === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : modeRef.current;
        await sendPhysicPaintRotoAuthorityRequest({ operationId, projectContextId: context.project.contextId, layerId: context.layerId, canonicalStart: start }, mode);
      }, authorityFailure(operationId, portsRef.current)),
      commit: async (publication, revalidateUnderLease) => {
        let leaseRejection: string | null = null;
        const accepted = await dispatchAndWaitForAcceptedPlayScript(
          portsRef.current.pendingOperationId,
          portsRef.current.acceptedOutput,
          () => portsRef.current.executePhysicalEdit({
            operationKind: 'play-script',
            expectedLaunch: publication.expectedLaunch,
            expectedRevision: publication.expectedRevision,
            records: publication.records,
            interpolationEnabled: publication.interpolationEnabled,
            interpolationMode: publication.interpolationMode,
            rotoBackground: publication.rotoBackground,
            semanticDelta: publication.semanticDelta,
            selectedKeyId: publication.selectedKeyId,
            selectedAppFrame: publication.selectedAppFrame,
            // 43-06: loop state rides the same staged commit (HOLD-03).
            ...(publication.loopClips ? { loopClips: publication.loopClips } : {}),
            ...(revalidateUnderLease ? {
              revalidateAfterLease: async () => {
                leaseRejection = await revalidateUnderLease();
                return leaseRejection === null;
              },
            } : {}),
          }),
        );
        if (!accepted || accepted.operationKind !== 'play-script') {
          return { ok: false, error: leaseRejection ?? 'Play Script physical commit was rejected or timed out.' };
        }
        return {
          ok: true,
          operationId: accepted.operationId,
          acceptedRevision: accepted.acceptedRevision,
          records: accepted.after.records,
          interpolationMode: accepted.after.interpolation.mode,
          selectedKeyId: accepted.after.selectedKeyId,
          selectedAppFrame: accepted.after.selectedAppFrame,
          ...(publication.loopClips ? { loopClips: accepted.after.loopClips } : {}),
        };
      },
    });
  }
  useEffect(() => () => {
    controllerRef.current?.dispose();
    authorityPending.current.clear();
  }, []);
  return controllerRef.current;
}

function readAvailabilitySnapshot(ports: Pick<RotoPlayScriptControllerPorts, 'getLaunchContext' | 'getSelection' | 'getOperationLocked'>) {
  const context = ports.getLaunchContext();
  const selection = ports.getSelection();
  return {
    operationLocked: ports.getOperationLocked(),
    projectSaved: context?.project?.saved ?? false,
    selectionKind: selection.kind,
    keyId: selection.keyId,
    appFrame: selection.appFrame,
  };
}

function sameAvailabilitySnapshot(left: ReturnType<typeof readAvailabilitySnapshot>, right: ReturnType<typeof readAvailabilitySnapshot>): boolean {
  return left.operationLocked === right.operationLocked
    && left.projectSaved === right.projectSaved
    && left.selectionKind === right.selectionKind
    && left.keyId === right.keyId
    && left.appFrame === right.appFrame;
}

function requestWithTimeout<T>(pending: Map<string, (result: T) => void>, operationId: string, send: () => Promise<void>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => { pending.delete(operationId); resolve(fallback); }, 15_000);
    pending.set(operationId, (result) => { window.clearTimeout(timeout); resolve(result); });
    void send().catch(() => { window.clearTimeout(timeout); pending.delete(operationId); resolve(fallback); });
  });
}
function authorityFailure(operationId: string, ports: Pick<RotoPlayScriptControllerPorts, 'getLaunchContext' | 'getSelection'>): PhysicPaintRotoAuthorityResult {
  const context = ports.getLaunchContext(); const selection = ports.getSelection();
  return {
    operationId,
    ok: false,
    projectContextId: context?.project?.contextId ?? '',
    layerId: context?.layerId ?? '',
    canonicalStart: selection.appFrame,
    layerEndExclusive: selection.appFrame,
    capacity: 0,
    physicalCapacity: 0,
    rotoRevision: '',
    physicalRevision: '',
    physicalRecords: [],
    interpolationEnabled: false,
    interpolationMode: 'duplicate',
    frames: [],
    interpolationSettings: { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 },
    error: 'Roto authority request timed out.',
  };
}

async function dispatchAndWaitForAcceptedPlayScript<EngineState>(
  pendingOperationId: ReadonlySignal<string | null>,
  acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>,
  dispatch: () => Promise<boolean>,
): Promise<RotoPhysicalEditAcceptedOutput<EngineState> | null> {
  let expectedOperationId = pendingOperationId.peek();
  const unsubscribe = pendingOperationId.subscribe((operationId) => {
    if (expectedOperationId === null && operationId !== null) expectedOperationId = operationId;
  });
  try {
    if (!await dispatch() || expectedOperationId === null) return null;
    const deadline = performance.now() + 5_500;
    while (performance.now() < deadline) {
      const accepted = acceptedOutput.peek();
      if (accepted?.operationId === expectedOperationId) return accepted;
      if (pendingOperationId.peek() === null) return null;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
    const accepted = acceptedOutput.peek();
    return accepted?.operationId === expectedOperationId ? accepted : null;
  } finally {
    unsubscribe();
  }
}
