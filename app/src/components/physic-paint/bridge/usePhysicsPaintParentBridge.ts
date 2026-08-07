import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintLoopOperationRequest, PhysicPaintLoopOperationResult, PhysicPaintRotoAuthorityResult, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { isPhysicPaintApplyResult, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext, isPhysicPaintLoopOperationRequest, isPhysicPaintOpenLoopEditRequest, isPhysicPaintScriptLibraryResult, isPhysicPaintScriptLibraryResultMessage } from '../../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT, PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT, PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT } from '../../../lib/physicPaintBridge';
import { sendPhysicPaintLoopOperationResult } from './physicsPaintBridgeTransport';

export type PhysicsPaintBridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';

export async function detectPhysicsPaintBridgeMode(): Promise<PhysicsPaintBridgeMode> {
  try {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emit === 'function') return 'Tauri';
  } catch {
    // Browser fallback below is expected outside Tauri.
  }
  if (typeof window !== 'undefined' && window.opener) return 'Browser fallback';
  return 'Unavailable';
}

export function usePhysicsPaintCloseFlush(hasPending: () => boolean, flush: () => Promise<void>, onClose?: () => void): void {
  const hasPendingRef = useRef(hasPending);
  const flushRef = useRef(flush);
  const onCloseRef = useRef(onClose);
  hasPendingRef.current = hasPending;
  flushRef.current = flush;
  onCloseRef.current = onClose;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onCloseRequested(async (event) => {
        // 41-05 (D-08): the unconditional close hook (audio engine release)
        // runs BEFORE the flush gate — the hasPending early-return below must
        // never skip it.
        onCloseRef.current?.();
        if (!hasPendingRef.current()) return;
        event.preventDefault();
        try {
          await flushRef.current();
          if (!disposed) await appWindow.destroy();
        } catch (error) {
          console.error('[PhysicsPaintStudio] Could not flush pending Roto pixels before close', error);
        }
      });
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, []);
}

export function usePhysicsPaintBridgeMode(): PhysicsPaintBridgeMode {
  const [bridgeMode, setBridgeMode] = useState<PhysicsPaintBridgeMode>('Unavailable');
  useEffect(() => {
    let disposed = false;
    void detectPhysicsPaintBridgeMode()
      .then((mode) => { if (!disposed) setBridgeMode(mode); })
      .catch(() => { if (!disposed) setBridgeMode('Unavailable'); });
    return () => { disposed = true; };
  }, []);
  return bridgeMode;
}

export function usePhysicsPaintLaunchBridge(applyIncomingLaunchContext: (context: PhysicPaintLaunchContext) => void): void {
  const applyIncomingLaunchContextRef = useRef(applyIncomingLaunchContext);
  applyIncomingLaunchContextRef.current = applyIncomingLaunchContext;
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installLaunchListener = async () => {
      try {
        let launchEventReceived = false;
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen === 'function') {
          unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
            if (isPhysicPaintLaunchContext(event.payload)) {
              launchEventReceived = true;
              console.info('[PhysicsPaintStudio] launch context received', event.payload);
              applyIncomingLaunchContextRef.current(event.payload);
            } else {
              console.warn('[PhysicsPaintStudio] invalid launch context', event.payload);
            }
          });
          if (disposed) {
            unlisten?.();
            return;
          }
        }
        const coreApi = await import('@tauri-apps/api/core');
        if (typeof coreApi.invoke === 'function') {
          const storedContext = await coreApi.invoke('get_physics_paint_launch_context');
          if (!disposed && !launchEventReceived && isPhysicPaintLaunchContext(storedContext)) {
            console.info('[PhysicsPaintStudio] launch context fetched', storedContext);
            applyIncomingLaunchContextRef.current(storedContext);
          }
        }
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri launch listener unavailable', error);
      }
    };
    void installLaunchListener();
    return () => { disposed = true; unlisten?.(); };
  }, []);
}

export function usePhysicsPaintProjectContextBridge(handleProject: (project: PhysicPaintLaunchContext['project']) => void): void {
  const handleRef = useRef(handleProject); handleRef.current = handleProject;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const project = value as { name?: unknown; saved?: unknown; contextId?: unknown };
      if (typeof project.name === 'string' && typeof project.saved === 'boolean' && typeof project.contextId === 'string') handleRef.current({ name: project.name, saved: project.saved, contextId: project.contextId });
    };
    const custom = (event: Event) => accept((event as CustomEvent).detail);
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_PROJECT_CONTEXT_EVENT) accept(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, (event) => accept(event.payload));
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom); window.removeEventListener('message', message); };
  }, []);
}

/**
 * 41-03 (D-02/D-03): child listener for pushed revisioned audio-context
 * updates — same triple-transport + disposed-guard idiom as
 * usePhysicsPaintProjectContextBridge (Tauri listen + CustomEvent +
 * origin-checked postMessage). Validation, the strict newer-than revision
 * guard, and the mid-playback restart live inside the handler funnel
 * (handleEfxPaintAudioContextEvent); stale or invalid payloads are dropped
 * silently with zero audio dispatch.
 */
export function useEfxPaintAudioContextBridge(handleSection: (value: unknown) => void): void {
  const handleRef = useRef(handleSection); handleRef.current = handleSection;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => { handleRef.current(value); };
    const custom = (event: Event) => accept((event as CustomEvent).detail);
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_AUDIO_CONTEXT_EVENT) accept(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, (event) => accept(event.payload));
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener(PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, custom); window.removeEventListener('message', message); };
  }, []);
}

export function usePhysicsPaintScriptLibraryResultBridge(handleResult: (result: PhysicPaintScriptLibraryResult) => void): void {  const handleRef = useRef(handleResult); handleRef.current = handleResult;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const custom = (event: Event) => { const result = (event as CustomEvent).detail; if (isPhysicPaintScriptLibraryResult(result)) handleRef.current(result); };
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && isPhysicPaintScriptLibraryResultMessage(event.data)) handleRef.current(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, (event) => { if (isPhysicPaintScriptLibraryResult(event.payload)) handleRef.current(event.payload); });
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, custom); window.removeEventListener('message', message); };
  }, []);
}

export function usePhysicsPaintRotoAuthorityResultBridge(handleResult: (result: PhysicPaintRotoAuthorityResult) => void): void {
  const handleRef = useRef(handleResult); handleRef.current = handleResult;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => { if (value && typeof value === 'object' && typeof (value as PhysicPaintRotoAuthorityResult).operationId === 'string') handleRef.current(value as PhysicPaintRotoAuthorityResult); };
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT) accept(event.data.payload); };
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => { unlisten = await eventApi.listen?.(PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, (event) => accept(event.payload)); if (disposed) unlisten?.(); }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener('message', message); };
  }, []);
}

/**
 * 43-06 (D-01/Q3): child-side listener for the parent→child open-loop-edit
 * message — routes a validated loopId to the Play Script controller's
 * openLoopEdit. Malformed payloads are rejected by the typed guard and
 * ignored (T-43-06-01). Same install idiom as the sibling bridges.
 */
export function usePhysicsPaintOpenLoopEditBridge(handleRequest: (loopId: string) => void): void {
  const handleRef = useRef(handleRequest); handleRef.current = handleRequest;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => { if (isPhysicPaintOpenLoopEditRequest(value)) handleRef.current(value.loopId); };
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT) accept(event.data.payload); };
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => { unlisten = await eventApi.listen?.(PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT, (event) => accept(event.payload)); if (disposed) unlisten?.(); }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener('message', message); };
  }, []);
}

export interface PhysicsPaintLoopOperationController {
  readonly duplicateLinkedLoop: (loopId: string, destinationStart: number) => Promise<{ok: boolean; reason: string | null}>;
  readonly unlinkLoop: (loopId: string) => Promise<{ok: boolean; reason: string | null}>;
  readonly repairLoop: (loopId: string) => Promise<{ok: boolean; reason: string | null}>;
  readonly relinkLoop: (loopId: string, sourceKeyIds: readonly string[]) => Promise<{ok: boolean; reason: string | null}>;
}

interface PhysicsPaintLoopOperationHandlerPorts {
  readonly getLaunchContext: () => {readonly projectContextId: string; readonly layerId: string} | null;
  readonly operations: PhysicsPaintLoopOperationController;
  readonly sendResult: (result: PhysicPaintLoopOperationResult, parentWindow?: Window | null) => Promise<void>;
}

function loopOperationResult(
  request: PhysicPaintLoopOperationRequest,
  outcome: {readonly ok: boolean; readonly reason: string | null},
): PhysicPaintLoopOperationResult {
  return {
    operationId: request.operationId,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    loopId: request.loopId,
    kind: request.kind,
    ok: outcome.ok,
    reason: outcome.reason,
  };
}

function fingerprintLoopOperationRequest(request: PhysicPaintLoopOperationRequest): string {
  const payload = request.kind === 'duplicate-linked-loop'
    ? `:${request.destinationStart}`
    : request.kind === 'relink-loop'
      ? `:${request.sourceKeyIds.map((keyId) => `${keyId.length}:${keyId}`).join('|')}`
      : '';
  return `${request.operationId}:${request.projectContextId}:${request.layerId}:${request.loopId}:${request.kind}${payload}`;
}

/** One handler instance lives for one Studio mount. Its in-flight promise map
 * makes bounded parent retries replay one result without a second history op. */
export function createPhysicsPaintLoopOperationRequestHandler(ports: PhysicsPaintLoopOperationHandlerPorts) {
  const delivered = new Map<string, {fingerprint: string; result: Promise<PhysicPaintLoopOperationResult>}>();
  return async (value: unknown, parentWindow?: Window | null): Promise<void> => {
    if (!isPhysicPaintLoopOperationRequest(value)) return;
    const request = value;
    const fingerprint = fingerprintLoopOperationRequest(request);
    const publish = (result: PhysicPaintLoopOperationResult) => parentWindow
      ? ports.sendResult(result, parentWindow)
      : ports.sendResult(result);
    const prior = delivered.get(request.operationId);
    if (prior && prior.fingerprint !== fingerprint) {
      await publish(loopOperationResult(request, {ok: false, reason: 'Operation ID was already used for a different loop-operation request.'}));
      return;
    }
    let pending = prior?.result;
    if (!pending) {
      pending = (async (): Promise<PhysicPaintLoopOperationResult> => {
        const context = ports.getLaunchContext();
        if (!context || context.projectContextId !== request.projectContextId) {
          return loopOperationResult(request, {ok: false, reason: 'Physics Paint project context changed.'});
        }
        if (context.layerId !== request.layerId) {
          return loopOperationResult(request, {ok: false, reason: 'Physics Paint layer context changed.'});
        }
        const operation = request.kind === 'duplicate-linked-loop'
          ? await ports.operations.duplicateLinkedLoop(request.loopId, request.destinationStart)
          : request.kind === 'relink-loop'
            ? await ports.operations.relinkLoop(request.loopId, request.sourceKeyIds)
            : request.kind === 'repair-loop'
              ? await ports.operations.repairLoop(request.loopId)
              : await ports.operations.unlinkLoop(request.loopId);
        return loopOperationResult(request, operation);
      })().catch((error) => loopOperationResult(request, {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      }));
      delivered.set(request.operationId, {fingerprint, result: pending});
    }
    await publish(await pending);
  };
}

export function usePhysicsPaintLoopOperationBridge(
  getLaunchContext: () => PhysicPaintLaunchContext | null,
  operations: PhysicsPaintLoopOperationController,
  bridgeMode: PhysicsPaintBridgeMode,
): void {
  const contextRef = useRef(getLaunchContext); contextRef.current = getLaunchContext;
  const operationsRef = useRef(operations); operationsRef.current = operations;
  const modeRef = useRef(bridgeMode); modeRef.current = bridgeMode;
  const handlerRef = useRef<ReturnType<typeof createPhysicsPaintLoopOperationRequestHandler> | null>(null);
  if (!handlerRef.current) {
    handlerRef.current = createPhysicsPaintLoopOperationRequestHandler({
      getLaunchContext: () => {
        const context = contextRef.current();
        if (!context?.project) return null;
        return {projectContextId: context.project.contextId, layerId: context.layerId};
      },
      operations: {
        duplicateLinkedLoop: (...args) => operationsRef.current.duplicateLinkedLoop(...args),
        unlinkLoop: (...args) => operationsRef.current.unlinkLoop(...args),
        repairLoop: (...args) => operationsRef.current.repairLoop(...args),
        relinkLoop: (...args) => operationsRef.current.relinkLoop(...args),
      },
      sendResult: (result, parentWindow) => sendPhysicPaintLoopOperationResult(result, modeRef.current, parentWindow),
    });
  }
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown, parentWindow?: Window | null) => {
      void handlerRef.current?.(value, parentWindow).catch((error) => {
        console.warn('[PhysicsPaintStudio] loop-operation result delivery failed', error);
      });
    };
    const message = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT) return;
      const source = event.source && 'postMessage' in event.source ? event.source as Window : undefined;
      accept(event.data.payload, source);
    };
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT, (event) => accept(event.payload));
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener('message', message); };
  }, []);
}

export function usePhysicsPaintApplyResultBridge(
  bridgeMode: PhysicsPaintBridgeMode,
  handleApplyResult: (result: PhysicPaintApplyResult) => void,
): void {
  useEffect(() => {
    const handleCustomResult = (event: Event) => {
      const result = (event as CustomEvent<unknown>).detail;
      if (isPhysicPaintApplyResult(result)) handleApplyResult(result);
      else console.warn('[PhysicsPaintStudio] invalid apply result', result);
    };
    const handleMessageResult = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (isPhysicPaintApplyResultMessage(event.data)) handleApplyResult(event.data.payload);
    };
    const targetWindow = window;
    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleCustomResult);
    window.addEventListener('message', handleMessageResult);
    return () => {
      targetWindow.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleCustomResult);
      targetWindow.removeEventListener('message', handleMessageResult);
    };
  }, [handleApplyResult]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installApplyResultListener = async () => {
      if (bridgeMode !== 'Tauri') return;
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_APPLY_RESULT_EVENT, (event) => {
          if (isPhysicPaintApplyResult(event.payload)) handleApplyResult(event.payload);
          else console.warn('[PhysicsPaintStudio] invalid Tauri apply result', event.payload);
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri apply-result listener unavailable', error);
      }
    };
    void installApplyResultListener();
    return () => { disposed = true; unlisten?.(); };
  }, [bridgeMode, handleApplyResult]);
}
