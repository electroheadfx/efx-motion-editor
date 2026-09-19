import { signal, type ReadonlySignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import {
  createRotoPlayScriptController,
  type RotoPlayScriptController,
  type RotoPlayScriptControllerPorts,
  type RotoPlayScriptPhysicalPublication,
  type RotoRegenerateGroupPhysicalPublication,
} from '../roto/physicsPaintRotoPlayScriptController';
import { PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalEditAcceptedOutput, RotoPhysicalEditFailureOutput } from '../roto/rotoCoordinatorPorts';
import type {
  RotoPlayScriptExecuteInput,
  RotoRegenerateGroupExecuteInput,
} from './useRotoPhysicalEditCoordinator';
import { sendPhysicPaintRotoAuthorityRequest } from '../bridge/physicsPaintBridgeTransport';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintRotoAuthorityResultBridge, type PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

interface RotoPlayScriptCoordinatorPort<EngineState> {
  executePhysicalEdit: (
    input: RotoPlayScriptExecuteInput | RotoRegenerateGroupExecuteInput,
  ) => Promise<boolean>;
  readonly pendingOperationId: ReadonlySignal<string | null>;
  readonly acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>;
  readonly failureOutput: ReadonlySignal<RotoPhysicalEditFailureOutput<EngineState> | null>;
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
      getActiveTrackId: (layerId) => portsRef.current.getActiveTrackId(layerId),
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
      // 52-05 (G-52-3): the Reveal Photo Rail tab ports — the D-12 reference
      // guard (proactive modal open) and the shared create-reveal-rail mutation.
      hasPhotoReference: () => portsRef.current.hasPhotoReference?.() ?? false,
      photoReferenceRevision: ports.photoReferenceRevision,
      openPhotoReference: () => portsRef.current.openPhotoReference?.(),
      createReveal: (input) => portsRef.current.createReveal?.(input) ?? Promise.resolve({ ok: false, reason: 'Reveal unavailable — create-reveal port is not wired.' }),
      getScriptNaturalDuration: (scriptId) => portsRef.current.getScriptNaturalDuration?.(scriptId) ?? null,
      stopPlayback: () => portsRef.current.stopPlayback(),
      log: (...args) => portsRef.current.log(...args),
      requestAuthority: (operationId, start) => requestWithTimeout(authorityPending.current, operationId, async () => {
        const context = portsRef.current.getLaunchContext();
        if (!context?.project) throw new Error('Project authority is unavailable.');
        const mode = modeRef.current === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : modeRef.current;
        // 46-04: the launch IS the document (D-03) — the child names the
        // document's current active track (47-01: the live document, not the
        // launch snapshot); the parent revalidates the track dimension and
        // fails closed on a foreign trackId.
        await sendPhysicPaintRotoAuthorityRequest({ operationId, projectContextId: context.project.contextId, layerId: context.layerId, canonicalStart: start, trackId: portsRef.current.getActiveTrackId(context.layerId) }, mode);
      }, authorityFailure(operationId, portsRef.current)),
      commit: async (publication, revalidateUnderLease) => {
        let leaseRejection: string | null = null;
        const operationKind = publication.semanticDelta.kind;
        const regeneratePublication = operationKind === 'regenerate-group'
          ? publication as RotoRegenerateGroupPhysicalPublication
          : null;
        const playScriptPublication = regeneratePublication
          ? null
          : publication as RotoPlayScriptPhysicalPublication;
        const action = regeneratePublication ? 'Group Regenerate' : 'Group update';
        const baseInput = {
          expectedLaunch: publication.expectedLaunch,
          expectedRevision: publication.expectedRevision,
          records: publication.records,
          interpolationEnabled: publication.interpolationEnabled,
          interpolationMode: publication.interpolationMode,
          semanticDelta: publication.semanticDelta,
          selectedKeyId: publication.selectedKeyId,
          selectedAppFrame: publication.selectedAppFrame,
          ...(revalidateUnderLease ? {
            revalidateAfterLease: async () => {
              leaseRejection = await revalidateUnderLease();
              return leaseRejection === null;
            },
          } : {}),
        };
        const input: RotoPlayScriptExecuteInput | RotoRegenerateGroupExecuteInput = regeneratePublication
          ? {
              ...baseInput,
              operationKind: 'regenerate-group',
              semanticDelta: regeneratePublication.semanticDelta,
              groupOverrideRecords: regeneratePublication.groupOverrideRecords,
              loopClips: regeneratePublication.loopClips,
            }
          : {
              ...baseInput,
              operationKind: 'play-script',
              rotoBackground: playScriptPublication!.rotoBackground,
              semanticDelta: playScriptPublication!.semanticDelta,
              ...(playScriptPublication!.loopClips ? { loopClips: playScriptPublication!.loopClips } : {}),
              ...(playScriptPublication!.incomingInterpolationBreakKeyIds
                ? { incomingInterpolationBreakKeyIds: playScriptPublication!.incomingInterpolationBreakKeyIds }
                : {}),
            };
        const settlement = await dispatchAndWaitForPlayScriptSettlement(
          portsRef.current.pendingOperationId,
          portsRef.current.acceptedOutput,
          portsRef.current.failureOutput,
          () => portsRef.current.executePhysicalEdit(input),
        );
        if (!settlement.ok || settlement.accepted.operationKind !== operationKind) {
          return {
            ok: false,
            error: leaseRejection ?? formatPhysicalCommitFailure(action, settlement),
          };
        }
        const accepted = settlement.accepted;
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
    const timeout = globalThis.setTimeout(() => { pending.delete(operationId); resolve(fallback); }, 15_000);
    pending.set(operationId, (result) => { globalThis.clearTimeout(timeout); resolve(result); });
    void send().catch(() => { globalThis.clearTimeout(timeout); pending.delete(operationId); resolve(fallback); });
  });
}
function authorityFailure(operationId: string, ports: Pick<RotoPlayScriptControllerPorts, 'getLaunchContext' | 'getActiveTrackId' | 'getSelection'>): PhysicPaintRotoAuthorityResult {
  const context = ports.getLaunchContext(); const selection = ports.getSelection();
  return {
    operationId,
    ok: false,
    projectContextId: context?.project?.contextId ?? '',
    layerId: context?.layerId ?? '',
    trackId: context?.layerId ? ports.getActiveTrackId(context.layerId) : '',
    trackRevision: '',
    documentRevision: '',
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

type RotoPlayScriptSettlement<EngineState> =
  | Readonly<{ ok: true; accepted: RotoPhysicalEditAcceptedOutput<EngineState> }>
  | Readonly<{ ok: false; failure: RotoPhysicalEditFailureOutput<EngineState> | null; timedOut: boolean }>;

async function dispatchAndWaitForPlayScriptSettlement<EngineState>(
  pendingOperationId: ReadonlySignal<string | null>,
  acceptedOutput: ReadonlySignal<RotoPhysicalEditAcceptedOutput<EngineState> | null>,
  failureOutput: ReadonlySignal<RotoPhysicalEditFailureOutput<EngineState> | null>,
  dispatch: () => Promise<boolean>,
): Promise<RotoPlayScriptSettlement<EngineState>> {
  let expectedOperationId = pendingOperationId.peek();
  const captureOperationId = pendingOperationId.subscribe((operationId) => {
    if (expectedOperationId === null && operationId !== null) expectedOperationId = operationId;
  });
  try {
    const dispatched = await dispatch();
    if (expectedOperationId === null) return { ok: false, failure: null, timedOut: false };
    const existingAccepted = acceptedOutput.peek();
    if (existingAccepted?.operationId === expectedOperationId) return { ok: true, accepted: existingAccepted };
    const existingFailure = failureOutput.peek();
    if (existingFailure?.operationId === expectedOperationId) return { ok: false, failure: existingFailure, timedOut: false };
    if (!dispatched) return { ok: false, failure: null, timedOut: false };
    return await new Promise<RotoPlayScriptSettlement<EngineState>>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
      let unsubscribeAccepted = () => {};
      let unsubscribeFailure = () => {};
      const finish = (result: RotoPlayScriptSettlement<EngineState>) => {
        if (settled) return;
        settled = true;
        if (timeout !== null) globalThis.clearTimeout(timeout);
        unsubscribeAccepted();
        unsubscribeFailure();
        resolve(result);
      };
      unsubscribeAccepted = acceptedOutput.subscribe((accepted) => {
        if (accepted?.operationId === expectedOperationId) finish({ ok: true, accepted });
      });
      unsubscribeFailure = failureOutput.subscribe((failure) => {
        if (failure?.operationId === expectedOperationId) finish({ ok: false, failure, timedOut: false });
      });
      timeout = globalThis.setTimeout(() => finish({ ok: false, failure: null, timedOut: true }), 5_500);
    });
  } finally {
    captureOperationId();
  }
}

function formatPhysicalCommitFailure<EngineState>(
  action: string,
  settlement: RotoPlayScriptSettlement<EngineState>,
): string {
  if (settlement.ok) return `${action} returned a mismatched acknowledgement.`;
  if (settlement.timedOut) return `${action} timed out before canonical settlement.`;
  const failure = settlement.failure;
  if (!failure) return `${action} was not dispatched.`;
  const detail = failure.error instanceof Error
    ? failure.error.message
    : failure.error === undefined
      ? null
      : String(failure.error);
  if (detail) return `${action} rejected — ${detail}`;
  if (failure.reason === 'transport') return `${action} could not reach the parent authority.`;
  if (failure.reason === 'settlement-mismatch') return `${action} settlement did not match the accepted Group document.`;
  if (failure.reason === 'timeout') return `${action} timed out before canonical settlement.`;
  return `${action} failed during canonical settlement.`;
}
