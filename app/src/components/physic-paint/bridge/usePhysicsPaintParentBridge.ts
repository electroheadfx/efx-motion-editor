import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintProjectContext, PhysicPaintProjectContextLayer, PhysicPaintRotoAuthorityResult, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYERS, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_ID_LENGTH, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_NAME_LENGTH, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_SCOPE_LENGTH, isPhysicPaintApplyResult, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext, isPhysicPaintScriptLibraryResult, isPhysicPaintScriptLibraryResultMessage } from '../../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_AUDIO_CONTEXT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT, PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, requestPhysicPaintProjectContext } from '../../../lib/physicPaintBridge';
import { fromTransportPayload, isWebpBytes } from '../../../lib/webpBytes';

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
            // 52.1 (D-05): the parent serialized the document's real-key bytes
            // as base64 (invoke JSON). Decode back to Uint8Array before the
            // launch validator so the in-memory shape matches the direct path.
            const restored = fromTransportPayload(event.payload);
            if (isPhysicPaintLaunchContext(restored)) {
              launchEventReceived = true;
              console.info('[PhysicsPaintStudio] launch context received', restored);
              applyIncomingLaunchContextRef.current(restored);
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
          const restored = fromTransportPayload(storedContext);
          if (!disposed && !launchEventReceived && isPhysicPaintLaunchContext(restored)) {
            console.info('[PhysicsPaintStudio] launch context fetched', restored);
            applyIncomingLaunchContextRef.current(restored);
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

/**
 * quick-260922-al1: tolerant normalizer for the project-context `layers` field.
 * The child realm owns no layer list of its own, so it accepts whatever the
 * main realm sends — but one malformed entry must never poison the payload:
 * entries that are not `{ id, name }` strings are dropped individually, the
 * list is capped, and names are truncated to the wire bound. Anything that is
 * not an array degrades to `[]`, which is exactly the All-only rendering the
 * pre-al1 child already produced.
 */
export function normalizeProjectContextLayers(value: unknown): PhysicPaintProjectContextLayer[] {
  if (!Array.isArray(value)) return [];
  const layers: PhysicPaintProjectContextLayer[] = [];
  for (const entry of value) {
    if (layers.length >= PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYERS) break;
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as { id?: unknown; name?: unknown };
    if (typeof candidate.id !== 'string' || candidate.id.length === 0 || candidate.id.length > PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_ID_LENGTH) continue;
    if (typeof candidate.name !== 'string') continue;
    layers.push({ id: candidate.id, name: candidate.name.slice(0, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_NAME_LENGTH) });
  }
  return layers;
}

/**
 * quick-260922-al1: the wider shape the child now accepts. The three-field
 * contract (`name`/`saved`/`contextId`) stays byte-identical and mandatory; the
 * two new fields are ADDITIVE — absent or malformed values degrade to
 * `[]` / `'all'` rather than rejecting the payload, so a main realm that
 * predates the field still drives the panel. Returns null for a payload the
 * pre-al1 child would also have rejected.
 */
export function acceptPhysicPaintProjectContextPayload(value: unknown): PhysicPaintProjectContext | null {
  if (!value || typeof value !== 'object') return null;
  const project = value as { name?: unknown; saved?: unknown; contextId?: unknown; layers?: unknown; scriptScope?: unknown };
  if (typeof project.name !== 'string' || typeof project.saved !== 'boolean' || typeof project.contextId !== 'string') return null;
  const scriptScope = typeof project.scriptScope === 'string' && project.scriptScope.length > 0 && project.scriptScope.length <= PHYSIC_PAINT_PROJECT_CONTEXT_MAX_SCOPE_LENGTH
    ? project.scriptScope
    : 'all';
  return {
    name: project.name,
    saved: project.saved,
    contextId: project.contextId,
    layers: normalizeProjectContextLayers(project.layers),
    scriptScope,
  };
}

export function usePhysicsPaintProjectContextBridge(handleProject: (project: PhysicPaintLaunchContext['project']) => void): void {
  const handleRef = useRef(handleProject); handleRef.current = handleProject;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => {
      const project = acceptPhysicPaintProjectContextPayload(value);
      if (project) handleRef.current(project);
    };
    const custom = (event: Event) => accept((event as CustomEvent).detail);
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_PROJECT_CONTEXT_EVENT) accept(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, (event) => accept(event.payload));
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    // quick-260922-al1: the main realm PUSHES the project context only at bind
    // and clear (projectStore.ts:106-121) — both of which happen before this
    // Studio exists, because the child webview is navigated/re-booted on every
    // layer switch (lib.rs:186). Without this one-shot pull a Studio opened
    // after the bind renders with no live layer list and only snapshotted
    // provenance. NO ARGUMENT ON PURPOSE: the pull is a READ-ONLY republish, so
    // reopening the Studio can never overwrite the stored filter with the
    // child's default.
    void requestPhysicPaintProjectContext();
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
    const accept = (value: unknown) => {
      // 52.1 (D-05): the parent serialized physicalRecords bytes as base64
      // (emitTo JSON). Decode back to Uint8Array before handing to the consumer.
      const restored = fromTransportPayload(value);
      if (restored && typeof restored === 'object' && typeof (restored as PhysicPaintRotoAuthorityResult).operationId === 'string') handleRef.current(restored as PhysicPaintRotoAuthorityResult);
    };
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT) accept(event.data.payload); };
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => { unlisten = await eventApi.listen?.(PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, (event) => accept(event.payload)); if (disposed) unlisten?.(); }).catch(() => undefined);
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
          // 52.1 (D-05): the parent serialized the result's semanticDelta bytes as
          // base64 (emitTo JSON). Decode back to Uint8Array before validation so
          // the in-memory shape matches the direct (non-transported) path.
          const result = fromTransportPayload(event.payload);
          if (isPhysicPaintApplyResult(result)) handleApplyResult(result);
          else {
            const record = result && typeof result === 'object' ? result as Record<string, unknown> : null;
            const semanticDelta = record?.semanticDelta && typeof record.semanticDelta === 'object'
              ? record.semanticDelta as Record<string, unknown>
              : undefined;
            const clipboardPayload = semanticDelta?.clipboardPayload && typeof semanticDelta.clipboardPayload === 'object'
              ? semanticDelta.clipboardPayload as Record<string, unknown>
              : undefined;
            const bytes = clipboardPayload?.bytes;
            console.warn('[PhysicsPaintStudio] invalid Tauri apply result', {
              operationKind: record?.operationKind,
              semanticDeltaKind: semanticDelta?.kind,
              clipboardPayloadKeys: clipboardPayload ? Object.keys(clipboardPayload) : null,
              bytesType: bytes instanceof Uint8Array ? 'Uint8Array' : typeof bytes,
              bytesIsWebp: bytes instanceof Uint8Array ? isWebpBytes(bytes) : false,
              semanticDelta,
              raw: event.payload,
            });
          }
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
