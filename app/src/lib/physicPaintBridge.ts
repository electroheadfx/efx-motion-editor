import type { Result } from './ipc';
import type { Layer } from '../types/layer';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintPlayScriptCacheStatus, PhysicPaintRotoAuthorityRequest, PhysicPaintRotoAuthorityResult, PhysicPaintScriptLibraryResult, PhysicPaintStateSaveRequest, PhysicPaintStateSaveResult, PhysicPaintThumbnailEncodeResult, PhysicPaintWorkflowMode } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, isPhysicPaintApplyPayload, isPhysicPaintFrameSyncMessage, isPhysicPaintLaunchContext, isPhysicPaintScriptLibraryRequest, isPhysicPaintThumbnailEncodeRequest, isPhysicPaintThumbnailEncodeResult } from '../types/physicPaint';
import { GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE } from '../components/physic-paint/roto/physicsPaintRotoKeyController';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore } from '../stores/physicPaintStore';
import { sequenceStore } from '../stores/sequenceStore';
import { timelineStore } from '../stores/timelineStore';
import { projectStore } from '../stores/projectStore';
import { scriptLibraryDelete, scriptLibraryEncodeThumbnailWebp, scriptLibraryLoad, scriptLibraryRename, scriptLibrarySave, scriptLibraryScan } from './ipc';

export const PHYSIC_PAINT_LAUNCH_EVENT = 'physic-paint:launch';
export const PHYSIC_PAINT_PROJECT_CONTEXT_EVENT = 'physic-paint:project-context';
/**
 * Standalone sends rendered-output-only PhysicPaintApplyPayload here; the app
 * validates/applies it and returns PhysicPaintApplyResult on
 * PHYSIC_PAINT_APPLY_RESULT_EVENT with the same operationId.
 */
export const PHYSIC_PAINT_APPLY_EVENT = 'physic-paint:apply';
export const PHYSIC_PAINT_APPLY_RESULT_EVENT = 'physic-paint:apply-result';
export const PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT = 'physic-paint:script-library-request';
export const PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT = 'physic-paint:script-library-result';
export const PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT = 'physic-paint:roto-authority-request';
export const PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT = 'physic-paint:roto-authority-result';
export const PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT = 'physic-paint:state-save-request';
export const PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT = 'physic-paint:state-save-result';
export const PHYSIC_PAINT_THUMBNAIL_ENCODE_REQUEST_EVENT = 'physic-paint:thumbnail-encode-request';
export const PHYSIC_PAINT_THUMBNAIL_ENCODE_RESULT_EVENT = 'physic-paint:thumbnail-encode-result';

const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';
const PHYSIC_PAINT_FALLBACK_PATH = '/physics-paint';

export interface PhysicPaintCanvasSize {
  width?: number;
  height?: number;
}

export interface PhysicPaintOpenRequest {
  layer: Layer | null | undefined;
  frame: number | null | undefined;
  canvas?: PhysicPaintCanvasSize | null;
  fps?: number | null;
  requestedWorkflowMode?: PhysicPaintWorkflowMode;
}

interface TauriEventApi {
  emitTo?: (target: string, event: string, payload?: unknown) => Promise<void>;
  emit?: (event: string, payload?: unknown) => Promise<void>;
  listen?: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;
}

interface TauriWindowApi {
  Window?: {
    getByLabel?: (label: string) => Promise<{ close?: () => Promise<void>; destroy?: () => Promise<void> } | null>;
  };
}

interface TauriCoreApi {
  isTauri?: () => boolean;
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
}

interface TauriPhysicsPaintLaunchResult {
  label: string;
  visibleBefore: boolean;
  minimizedBefore: boolean;
  visible: boolean;
  minimized: boolean;
}

function shouldCloseNativeWindowAfterApply(payload: PhysicPaintApplyPayload): boolean {
  return payload.kind === 'apply-canvas' && payload.closeWindowAfterApply === true;
}

const APPLY_ERROR = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
const deliveredOperationIds = new Set<string>();

export function applyPhysicPaintPayload(payload: unknown): PhysicPaintApplyResult {
  const base = resultBase(payload);
  if (!isPhysicPaintApplyPayload(payload)) {
    return failureResult(base, 'Invalid physics paint apply payload');
  }

  const targetLayer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find(layer => {
    if (layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') return false;
    const sourceLayerId = typeof layer.source.layerId === 'string' && layer.source.layerId.length > 0
      ? layer.source.layerId
      : layer.id;
    return sourceLayerId === payload.layerId || layer.id === payload.layerId;
  });
  if (!targetLayer) {
    return failureResult(payload, `Unknown physics paint layer: ${payload.layerId}`);
  }
  if (!Number.isInteger(payload.startFrame) || payload.startFrame < 0) {
    return failureResult(payload, 'Invalid physics paint start frame');
  }
  const mutationDisplayFrame = payload.kind === 'apply-canvas'
    ? payload.displayFrame ?? payload.startFrame
    : payload.startFrame;
  const generatedGuard = payload.kind === 'update-roto-interpolation-settings' ? null : getGeneratedRotoMutationGuard(payload.layerId, mutationDisplayFrame);
  if (generatedGuard) {
    return failureResult(payload, generatedGuard);
  }

  try {
    if (deliveredOperationIds.has(payload.operationId)) {
      return successResult(payload, payload.kind === 'apply-canvas' ? 1 : payload.kind === 'delete-roto-frame' ? 0 : payload.kind === 'replace-roto-key-frames' ? payload.frames.length : payload.kind === 'convert-roto-to-play' ? payload.frameCount : payload.kind === 'update-play-render-options' || payload.kind === 'update-roto-interpolation-settings' ? 0 : payload.frames.length);
    }

    let result: PhysicPaintApplyResult;
    if (payload.kind === 'apply-canvas') {
      result = physicPaintStore.applyCanvas(payload);
    } else if (payload.kind === 'update-roto-interpolation-settings') {
      const generatedFrames = physicPaintStore.setRotoInterpolationSettings(payload.layerId, payload.settings);
      result = successResult(payload, generatedFrames.length);
    } else if (payload.kind === 'delete-roto-frame') {
      result = physicPaintStore.deleteRotoFrame(payload);
    } else if (payload.kind === 'replace-roto-key-frames') {
      if (payload.projectContextId && payload.frameCount !== undefined && payload.expectedLayerEndExclusive !== undefined && payload.expectedRotoRevision) {
        const authority = getPhysicPaintRotoAuthority({
          operationId: payload.operationId,
          projectContextId: payload.projectContextId,
          layerId: payload.layerId,
          canonicalStart: payload.startFrame,
        });
        if (!authority.ok) return failureResult(payload, authority.error ?? 'Roto authority rejected the batch.');
        if (authority.layerEndExclusive !== payload.expectedLayerEndExclusive || authority.rotoRevision !== payload.expectedRotoRevision) return failureResult(payload, 'Roto authority became stale before commit.');
        if (payload.frameCount <= 0 || payload.frameCount > authority.capacity) return failureResult(payload, 'Play Script exceeds the current layer capacity.');
        const incomingSources = payload.frames.map((frame) => frame.sourceFrame ?? frame.appFrame);
        if (new Set(incomingSources).size !== incomingSources.length) return failureResult(payload, 'Play Script batch contains duplicate real keys.');
        for (let index = 0; index < payload.frameCount; index += 1) {
          if (!incomingSources.includes(payload.startFrame + index)) return failureResult(payload, 'Play Script batch is incomplete.');
        }
      }
      result = physicPaintStore.replaceRotoKeyFrames(payload);
    } else if (payload.kind === 'apply-play-canvas') {
      result = physicPaintStore.applySequence(payload);
    } else if (payload.kind === 'convert-play-to-roto') {
      result = physicPaintStore.convertPlayToRoto(payload);
    } else if (payload.kind === 'convert-roto-to-play') {
      result = physicPaintStore.convertRotoToPlay(payload);
    } else {
      result = physicPaintStore.updatePlayScriptRenderOptions(payload.layerId, payload.playScriptId, payload.renderOptions, payload.operationId);
    }
    if (result.ok) deliveredOperationIds.add(payload.operationId);
    return result.ok ? result : { ...result, error: `${APPLY_ERROR} ${result.error ?? ''}`.trim() };
  } catch (error) {
    return failureResult(payload, `${APPLY_ERROR} ${String(error)}`);
  }
}

export function getPhysicPaintRotoAuthority(request: PhysicPaintRotoAuthorityRequest): PhysicPaintRotoAuthorityResult {
  const failure = (error: string): PhysicPaintRotoAuthorityResult => ({
    operationId: request.operationId,
    ok: false,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    canonicalStart: request.canonicalStart,
    layerEndExclusive: request.canonicalStart,
    capacity: 0,
    rotoRevision: '',
    frames: [],
    interpolationSettings: physicPaintStore.getRotoInterpolationSettings(request.layerId),
    error,
  });
  if (request.projectContextId !== projectStore.projectContextId.peek()) return failure('Project context changed.');
  const layer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find((candidate) => candidate.id === request.layerId || (candidate.type === 'physic-paint' && candidate.source.type === 'physic-paint' && candidate.source.layerId === request.layerId));
  if (!layer || layer.type !== 'physic-paint') return failure('Physics Paint layer is unavailable.');
  if (!Number.isInteger(request.canonicalStart) || request.canonicalStart < 0) return failure('Canonical Roto start is invalid.');
  if (getGeneratedRotoMutationGuard(request.layerId, request.canonicalStart)) return failure('Select a real Roto key to generate a Play Script.');
  const capacity = getTimelineRangeFrameCount(layer, request.canonicalStart) ?? PHYSIC_PAINT_MAX_APPLY_FRAMES;
  const frames = physicPaintStore.getRotoCacheFrames(request.layerId).filter((frame) => frame.source === 'real-key');
  return {
    operationId: request.operationId,
    ok: true,
    projectContextId: request.projectContextId,
    layerId: request.layerId,
    canonicalStart: request.canonicalStart,
    layerEndExclusive: request.canonicalStart + capacity,
    capacity,
    rotoRevision: buildRotoRevision(frames),
    frames,
    interpolationSettings: physicPaintStore.getRotoInterpolationSettings(request.layerId),
  };
}

function buildRotoRevision(frames: readonly { sourceFrame?: number; appFrame: number; dataUrl: string }[]): string {
  const source = frames.map((frame) => `${frame.sourceFrame ?? frame.appFrame}:${frame.dataUrl.length}:${frame.dataUrl.slice(-24)}`).sort().join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `${frames.length}-${(hash >>> 0).toString(16)}`;
}

export async function applyPhysicPaintScriptLibraryRequest(value: unknown): Promise<PhysicPaintScriptLibraryResult> {
  const request = isPhysicPaintScriptLibraryRequest(value) ? value : null;
  const operationId = request?.operationId ?? 'invalid-operation';
  const kind = request?.kind ?? 'scan';
  const failure = (error: string): PhysicPaintScriptLibraryResult => ({ operationId, kind, ok: false, rows: [], skippedInvalidCount: 0, diagnostics: [], error });
  if (!request) return failure('Invalid script library request');
  const authority = projectStore.scriptLibraryAuthority.peek();
  if (!authority || !projectStore.filePath.peek()) return failure('Save the project first.');
  try {
    const result = request.kind === 'scan'
      ? await scriptLibraryScan(authority)
      : request.kind === 'save'
        ? await scriptLibrarySave(authority, request.script)
        : request.kind === 'load'
          ? await scriptLibraryLoad(authority, request.scriptId)
          : request.kind === 'rename'
            ? await scriptLibraryRename(authority, request.scriptId, request.expectedRevision, request.name)
            : await scriptLibraryDelete(authority, request.scriptId, request.expectedRevision);
    if (!result.ok) return failure(result.error);
    const operation = 'scan' in result.data ? result.data : { scan: result.data };
    return {
      operationId,
      kind,
      ok: true,
      rows: operation.scan.rows,
      skippedInvalidCount: operation.scan.skippedInvalidCount,
      diagnostics: operation.scan.diagnostics,
      ...('script' in operation && operation.script ? { script: operation.script } : {}),
    };
  } catch (error) {
    return failure(String(error));
  }
}

export async function publishPhysicPaintProjectContext(): Promise<void> {
  const project = { name: projectStore.name.peek(), saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()), contextId: projectStore.projectContextId.peek() };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, project);
  }
  if (typeof window !== 'undefined') {
    const message = { type: PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, payload: project };
    window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, { detail: project }));
    window.opener?.postMessage?.(message, window.location.origin);
  }
}

export async function installPhysicPaintStateSaveListener(): Promise<() => void> {
  const saveRequest = async (value: unknown): Promise<PhysicPaintStateSaveResult> => {
    const request = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<PhysicPaintStateSaveRequest> : null;
    const operationId = typeof request?.operationId === 'string' ? request.operationId : 'invalid-operation';
    if (!request || typeof request.operationId !== 'string' || typeof request.filename !== 'string' || typeof request.contents !== 'string') {
      return { operationId, status: 'error', error: 'Invalid Physics Paint state save request' };
    }
    if (request.contents.length > 32 * 1024 * 1024) return { operationId, status: 'error', error: 'Physics Paint state exceeds the save limit' };
    try {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ]);
      const selectedPath = await save({ defaultPath: request.filename, filters: [{ name: 'Physics paint state', extensions: ['json'] }] });
      if (!selectedPath) return { operationId, status: 'cancelled' };
      await writeTextFile(selectedPath, request.contents);
      return { operationId, status: 'saved' };
    } catch (error) {
      return { operationId, status: 'error', error: String(error) };
    }
  };
  const emitResult = async (result: PhysicPaintStateSaveResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') source?.postMessage?.({ type: PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT, payload: result }, window.location.origin);
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT, async (event) => emitResult(await saveRequest(event.payload)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void saveRequest(event.data.payload).then((result) => emitResult(result, source));
  };
  window.addEventListener('message', message);
  return () => window.removeEventListener('message', message);
}

export async function installPhysicPaintThumbnailEncodeListener(): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  const eventApi = await import('@tauri-apps/api/event');
  const unlisten = await eventApi.listen?.(PHYSIC_PAINT_THUMBNAIL_ENCODE_REQUEST_EVENT, async (event) => {
    const request = isPhysicPaintThumbnailEncodeRequest(event.payload) ? event.payload : null;
    const operationId = request?.operationId ?? 'invalid-operation';
    let result: PhysicPaintThumbnailEncodeResult;
    if (!request) {
      result = { operationId, ok: false, width: 1, height: 1, mimeType: 'image/webp', error: 'Invalid thumbnail encode request' };
    } else {
      const encoded = await scriptLibraryEncodeThumbnailWebp(request);
      const candidate: PhysicPaintThumbnailEncodeResult = encoded.ok
        ? { operationId, ok: true, ...encoded.data }
        : { operationId, ok: false, width: request.width, height: request.height, mimeType: 'image/webp', error: encoded.error };
      result = isPhysicPaintThumbnailEncodeResult(candidate)
        ? candidate
        : { operationId, ok: false, width: request.width, height: request.height, mimeType: 'image/webp', error: 'Native thumbnail encoder returned an invalid result' };
    }
    await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_THUMBNAIL_ENCODE_RESULT_EVENT, result);
  });
  return unlisten ?? (() => {});
}

export async function installPhysicPaintScriptLibraryListener(): Promise<() => void> {
  const emitResult = async (result: PhysicPaintScriptLibraryResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emit?.(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, result);
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') {
      const message = { type: PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, payload: result };
      window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, { detail: result }));
      source?.postMessage?.(message, window.location.origin);
      window.opener?.postMessage?.(message, window.location.origin);
    }
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, async (event) => emitResult(await applyPhysicPaintScriptLibraryRequest(event.payload)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const custom = (event: Event) => { void applyPhysicPaintScriptLibraryRequest((event as CustomEvent).detail).then((result) => emitResult(result)); };
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void applyPhysicPaintScriptLibraryRequest(event.data.payload).then((result) => emitResult(result, source));
  };
  window.addEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, custom);
  window.addEventListener('message', message);
  return () => { window.removeEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, custom); window.removeEventListener('message', message); };
}

export async function installPhysicPaintRotoAuthorityListener(): Promise<() => void> {
  const emitResult = async (result: PhysicPaintRotoAuthorityResult, source?: Pick<Window, 'postMessage'> | null) => {
    if (isTauriRuntime()) {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, result);
    }
    if (typeof window !== 'undefined') source?.postMessage?.({ type: PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, payload: result }, window.location.origin);
  };
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen?.(PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, async (event) => emitResult(getPhysicPaintRotoAuthority(event.payload as PhysicPaintRotoAuthorityRequest)));
    if (unlisten) return unlisten;
  }
  if (typeof window === 'undefined') return () => {};
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    void emitResult(getPhysicPaintRotoAuthority(event.data.payload as PhysicPaintRotoAuthorityRequest), source);
  };
  window.addEventListener('message', message);
  return () => window.removeEventListener('message', message);
}

export function handlePhysicPaintFrameSyncMessage(value: unknown): boolean {
  if (!isPhysicPaintFrameSyncMessage(value)) return false;
  timelineStore.seek(value.frame);
  timelineStore.ensureFrameVisible(value.frame);
  return true;
}

export function installPhysicPaintFrameSyncListener(target: Window = window): () => void {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const listener = (event: MessageEvent) => {
    handlePhysicPaintFrameSyncMessage(event.data);
  };
  target.addEventListener('message', listener);
  return () => target.removeEventListener('message', listener);
}

async function closeNativePhysicPaintWindow(): Promise<void> {
  try {
    const windowApi = await import('@tauri-apps/api/window') as TauriWindowApi;
    const paintWindow = await windowApi.Window?.getByLabel?.(PHYSIC_PAINT_WINDOW_LABEL);
    if (!paintWindow) return;
    if (typeof paintWindow.destroy === 'function') {
      await paintWindow.destroy();
      return;
    }
    await paintWindow.close?.();
  } catch (error) {
    console.warn('[physicPaintBridge] Could not close physics paint window after apply:', error);
  }
}

export async function installPhysicPaintApplyListener(onResult?: (result: PhysicPaintApplyResult) => void): Promise<() => void> {
  const handlePayload = (payload: unknown, source?: Pick<Window, 'postMessage'> | null) => {
    const result = applyPhysicPaintPayload(payload);
    onResult?.(result);
    sendBrowserApplyResult(result, source);
    return result;
  };

  if (isTauriRuntime()) {
    try {
      const eventApi = await import('@tauri-apps/api/event') as TauriEventApi;
      const unlisten = await eventApi.listen?.(PHYSIC_PAINT_APPLY_EVENT, async (event) => {
        const payload = event.payload;
        const result = applyPhysicPaintPayload(payload);
        onResult?.(result);
        await eventApi.emit?.(PHYSIC_PAINT_APPLY_RESULT_EVENT, result);
        await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_APPLY_RESULT_EVENT, result);
        sendBrowserApplyResult(result);
        if (result.ok && isPhysicPaintApplyPayload(payload) && shouldCloseNativeWindowAfterApply(payload)) await closeNativePhysicPaintWindow();
      });
      if (unlisten) return unlisten;
    } catch (error) {
      console.warn('[physicPaintBridge] Falling back to browser apply listener:', error);
    }
  }

  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const customEventListener = (event: Event) => {
    const customEvent = event as CustomEvent;
    handlePayload(customEvent.detail, undefined);
  };
  const messageListener = (event: MessageEvent) => {
    if (event.origin !== window.location?.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const message = data as { type?: unknown; payload?: unknown };
    if (message.type !== PHYSIC_PAINT_APPLY_EVENT) return;
    const source = event.source && 'postMessage' in event.source ? event.source as Pick<Window, 'postMessage'> : undefined;
    handlePayload(message.payload, source);
  };
  window.addEventListener(PHYSIC_PAINT_APPLY_EVENT, customEventListener);
  window.addEventListener('message', messageListener);
  return () => {
    window.removeEventListener(PHYSIC_PAINT_APPLY_EVENT, customEventListener);
    window.removeEventListener('message', messageListener);
  };
}

function sendBrowserApplyResult(result: PhysicPaintApplyResult, source?: Pick<Window, 'postMessage'> | null): void {
  if (typeof window === 'undefined') return;
  const message = { type: PHYSIC_PAINT_APPLY_RESULT_EVENT, payload: result };
  const targetOrigin = window.location?.origin ?? '*';
  window.dispatchEvent?.(new CustomEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
  source?.postMessage?.(message, targetOrigin);
  window.opener?.postMessage?.(message, targetOrigin);
}

function resultBase(payload: unknown): Pick<PhysicPaintApplyResult, 'operationId' | 'kind' | 'layerId' | 'startFrame'> {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  return {
    operationId: typeof record.operationId === 'string' ? record.operationId : 'unknown-operation',
    kind: record.kind === 'apply-play-canvas'
      ? 'apply-play-canvas'
      : record.kind === 'convert-play-to-roto'
        ? 'convert-play-to-roto'
        : record.kind === 'convert-roto-to-play'
          ? 'convert-roto-to-play'
          : record.kind === 'update-play-render-options'
            ? 'update-play-render-options'
            : record.kind === 'update-roto-interpolation-settings'
              ? 'update-roto-interpolation-settings'
              : 'apply-canvas',
    layerId: typeof record.layerId === 'string' ? record.layerId : 'unknown-layer',
    startFrame: typeof record.startFrame === 'number' && Number.isFinite(record.startFrame) ? Math.max(0, Math.trunc(record.startFrame)) : 0,
  };
}

function failureResult(payload: Pick<PhysicPaintApplyResult, 'operationId' | 'kind' | 'layerId' | 'startFrame'>, error: string): PhysicPaintApplyResult {
  return { ...payload, appliedFrameCount: 0, ok: false, error };
}

function successResult(payload: PhysicPaintApplyPayload, appliedFrameCount: number): PhysicPaintApplyResult {
  return {
    operationId: payload.operationId,
    kind: payload.kind,
    layerId: payload.layerId,
    startFrame: payload.startFrame,
    appliedFrameCount,
    ok: true,
  };
}

function getGeneratedRotoRenderOnlyStatus(frame: number): string {
  return GENERATED_ROTO_RENDER_ONLY_STATUS_TEMPLATE.replace('{frame}', String(frame));
}

function getGeneratedRotoMutationGuard(layerId: string, startFrame: number): string | null {
  const target = physicPaintStore.getRotoCacheFrames(layerId).find((candidate) => candidate.appFrame === startFrame);
  if (target?.source !== 'generated-interpolation') return null;
  return getGeneratedRotoRenderOnlyStatus(startFrame);
}

export function createPhysicPaintLaunchContext(
  layer: Layer,
  frame: number,
  canvas?: PhysicPaintCanvasSize | null,
  fps?: number | null,
  requestedWorkflowMode?: PhysicPaintWorkflowMode,
): PhysicPaintLaunchContext {
  const layerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
  const currentFrame = Math.max(0, Math.trunc(frame));
  const cachedRotoFrames = physicPaintStore.getRotoCacheFrames(layerId);
  const currentRotoCacheFrame = cachedRotoFrames.find((candidate) => candidate.appFrame === currentFrame);
  const generatedRenderOnlyStatus = requestedWorkflowMode !== 'play' && currentRotoCacheFrame?.source === 'generated-interpolation'
    ? getGeneratedRotoRenderOnlyStatus(currentFrame)
    : null;
  const rotoLaunchFrame = currentFrame;
  const containingRange = physicPaintStore.findPlayScriptRangeAtFrame(layerId, currentFrame);
  const shouldOpenContainingPlay = Boolean(containingRange && requestedWorkflowMode !== 'roto');
  const playLimitFrame = shouldOpenContainingPlay && containingRange ? containingRange.startFrame : rotoLaunchFrame;
  const ignoredPlayScriptId = shouldOpenContainingPlay && containingRange ? containingRange.id : undefined;
  const playFrameCountLimit = getPlayFrameCountLimit(layerId, playLimitFrame, layer, ignoredPlayScriptId);
  const cachedPlayFrames = shouldOpenContainingPlay && containingRange
    ? collectCompleteCachedPlayFrames(layerId, containingRange)
    : [];
  const playCacheStatus: PhysicPaintPlayScriptCacheStatus | undefined = shouldOpenContainingPlay && containingRange
    ? cachedPlayFrames.length === containingRange.frameCount ? 'cached' : 'missing'
    : undefined;
  const rotoInterpolationSettings = physicPaintStore.getRotoInterpolationSettings(layerId);
  const rotoBackground = !shouldOpenContainingPlay && requestedWorkflowMode !== 'play'
    ? physicPaintStore.getRotoBackgroundMetadata(layerId)
    : null;
  const editableState = shouldOpenContainingPlay && containingRange?.editableState
    ? structuredClone(containingRange.editableState)
    : null;
  const launchSelection = shouldOpenContainingPlay && containingRange
    ? {
        workflowMode: 'play' as const,
        startFrame: containingRange.startFrame,
        playStartFrame: containingRange.startFrame,
        playFrameCount: containingRange.frameCount,
        editableSource: 'play' as const,
        selectedPlayScriptId: containingRange.id,
        playCacheStatus,
        ...(containingRange.motion ? { playMotion: { ...containingRange.motion } } : {}),
        ...(containingRange.renderOptions ? { playRenderOptions: structuredClone(containingRange.renderOptions) } : {}),
        previewFrame: currentFrame - containingRange.startFrame,
        cachedPlayFrames,
        ...(playFrameCountLimit ? playFrameCountLimit : {}),
      }
    : requestedWorkflowMode === 'play'
      ? {
          workflowMode: 'play' as const,
          startFrame: currentFrame,
          playStartFrame: currentFrame,
          playFrameCount: playFrameCountLimit?.maxPlayFrameCount ?? PHYSIC_PAINT_MAX_APPLY_FRAMES,
          editableSource: 'play' as const,
          previewFrame: 0,
          ...(playFrameCountLimit ? playFrameCountLimit : {}),
        }
      : {
          workflowMode: 'roto' as const,
          startFrame: rotoLaunchFrame,
          editableSource: 'roto' as const,
          ...(playFrameCountLimit ? playFrameCountLimit : {}),
        };

  return {
    operationId: `physic-paint-${Date.now()}-${crypto.randomUUID()}`,
    layerId,
    project: { name: projectStore.name.peek(), saved: Boolean(projectStore.filePath.peek() && projectStore.scriptLibraryAuthority.peek()), contextId: projectStore.projectContextId.peek() },
    layerName: layer.name,
    ...(isFinitePositiveNumber(canvas?.width) ? { width: canvas.width } : {}),
    ...(isFinitePositiveNumber(canvas?.height) ? { height: canvas.height } : {}),
    ...(isFinitePositiveNumber(fps) ? { fps } : {}),
    ...(requestedWorkflowMode ? { requestedWorkflowMode } : {}),
    ...launchSelection,
    ...(editableState ? { editableState } : {}),
    ...(cachedRotoFrames.length > 0 ? { cachedRotoFrames } : {}),
    ...(rotoInterpolationSettings ? { rotoInterpolationSettings } : {}),
    ...(rotoBackground ? { rotoBackground: structuredClone(rotoBackground) } : {}),
    ...(generatedRenderOnlyStatus ? { maxPlayFrameCountReason: generatedRenderOnlyStatus } : {}),
  };
}

export async function openPhysicPaintCanvas(request: PhysicPaintOpenRequest): Promise<Result<PhysicPaintLaunchContext>> {
  try {
    const validation = validateOpenRequest(request);
    if (!validation.ok) return validation;

    const context = createPhysicPaintLaunchContext(validation.data.layer, validation.data.frame, request.canvas, request.fps, request.requestedWorkflowMode);
    if (!isPhysicPaintLaunchContext(context)) {
      return { ok: false, error: 'Invalid physics paint launch context' };
    }

    const tauriRuntime = await detectTauriRuntime();
    console.info('[physicPaintBridge] launch branch', tauriRuntime ? 'tauri-native-command' : 'browser-fallback', context);
    if (tauriRuntime) {
      const tauriResult = await tryOpenTauriPhysicPaintWindow(context);
      if (!tauriResult.ok) return tauriResult;
      console.info('[physicPaintBridge] native launch result', tauriResult.data);
      return { ok: true, data: context };
    }

    const browserResult = openBrowserFallback(context);
    if (!browserResult.ok) return browserResult;

    return { ok: true, data: context };
  } catch (error) {
    return { ok: false, error: `Could not open physics paint canvas: ${String(error)}` };
  }
}

function validateOpenRequest(request: PhysicPaintOpenRequest): Result<{ layer: Layer; frame: number }> {
  const layer = request.layer;
  if (!layer || layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') {
    return { ok: false, error: 'Select a physic-paint layer before opening the physics paint canvas' };
  }

  const frame = request.frame;
  if (typeof frame !== 'number' || !Number.isFinite(frame) || frame < 0) {
    return { ok: false, error: 'Select a valid frame before opening the physics paint canvas' };
  }

  if (request.requestedWorkflowMode !== undefined && request.requestedWorkflowMode !== 'roto' && request.requestedWorkflowMode !== 'play') {
    return { ok: false, error: 'Invalid physics paint workflow mode' };
  }

  return { ok: true, data: { layer, frame: Math.trunc(frame) } };
}

async function tryOpenTauriPhysicPaintWindow(context: PhysicPaintLaunchContext): Promise<Result<TauriPhysicsPaintLaunchResult>> {
  try {
    const core = await import('@tauri-apps/api/core') as TauriCoreApi;
    if (!core.invoke) return { ok: false, error: 'Tauri invoke API unavailable' };
    const result = await core.invoke<TauriPhysicsPaintLaunchResult>('open_physics_paint_window', { context });
    if (!isTauriPhysicsPaintLaunchResult(result)) {
      return { ok: false, error: `Physics paint native command returned an invalid result: ${JSON.stringify(result)}` };
    }
    if (!result.visible || result.minimized) {
      return { ok: false, error: `Physics paint window did not become visible (visible=${result.visible}, minimized=${result.minimized})` };
    }
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function isTauriPhysicsPaintLaunchResult(value: unknown): value is TauriPhysicsPaintLaunchResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as TauriPhysicsPaintLaunchResult).label === 'string' &&
      typeof (value as TauriPhysicsPaintLaunchResult).visibleBefore === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).minimizedBefore === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).visible === 'boolean' &&
      typeof (value as TauriPhysicsPaintLaunchResult).minimized === 'boolean',
  );
}

function collectCompleteCachedPlayFrames(layerId: string, range: { startFrame: number; frameCount: number }): NonNullable<ReturnType<typeof physicPaintStore.getFrame>>[] {
  return Array.from({ length: range.frameCount }, (_, index) => physicPaintStore.getFrame(layerId, range.startFrame + index))
    .filter((frame): frame is NonNullable<ReturnType<typeof physicPaintStore.getFrame>> => Boolean(frame));
}

function getTimelineRangeFrameCount(layer: Layer, frame: number): number | null {
  const sequence = sequenceStore.sequences.peek().find((candidate) => candidate.layers.some((candidateLayer) => candidateLayer.id === layer.id));
  if (!sequence) return null;
  const rangeStart = Number.isInteger(sequence.inFrame) && sequence.inFrame !== undefined ? sequence.inFrame : 0;
  const rangeEnd = Number.isInteger(sequence.outFrame) && sequence.outFrame !== undefined
    ? sequence.outFrame
    : sequence.kind === 'content'
      ? sequence.keyPhotos.reduce((total, photo) => total + Math.max(0, photo.holdFrames), 0)
      : null;
  if (rangeEnd === null || rangeEnd <= frame) return null;
  return Math.max(1, rangeEnd - Math.max(frame, rangeStart));
}

function getPlayFrameCountLimit(layerId: string, frame: number, layer: Layer, ignoredPlayScriptId?: string): Pick<PhysicPaintLaunchContext, 'maxPlayFrameCount' | 'maxPlayFrameCountReason'> | null {
  const maxPlayFrameCount = getMaxPlayFrameCount(layerId, frame, layer, ignoredPlayScriptId);
  if (maxPlayFrameCount >= PHYSIC_PAINT_MAX_APPLY_FRAMES) return null;
  return {
    maxPlayFrameCount,
    maxPlayFrameCountReason: buildMaxPlayFrameCountReason(layerId, frame, layer, ignoredPlayScriptId),
  };
}

function getMaxPlayFrameCount(layerId: string, frame: number, layer: Layer, ignoredPlayScriptId?: string): number {
  const gapLimit = getMaxPlayFrameCountFromGap(layerId, frame, ignoredPlayScriptId);
  const timelineLimit = getTimelineRangeFrameCount(layer, frame);
  return Math.min(gapLimit, timelineLimit ?? PHYSIC_PAINT_MAX_APPLY_FRAMES);
}

function getMaxPlayFrameCountFromGap(layerId: string, frame: number, ignoredPlayScriptId?: string): number {
  if (!Number.isInteger(frame) || frame < 0) return PHYSIC_PAINT_MAX_APPLY_FRAMES;
  const ranges = physicPaintStore.getPlayScriptRanges(layerId).filter((range) => range.id !== ignoredPlayScriptId);
  const containing = ranges.find((range) => frame >= range.startFrame && frame < range.startFrame + range.frameCount);
  if (containing) return 0;
  const next = ranges.find((range) => range.startFrame > frame);
  return next ? Math.max(0, next.startFrame - frame) : PHYSIC_PAINT_MAX_APPLY_FRAMES;
}

function buildMaxPlayFrameCountReason(layerId: string, frame: number, layer: Layer, ignoredPlayScriptId?: string): string {
  const maxPlayFrameCount = getMaxPlayFrameCount(layerId, frame, layer, ignoredPlayScriptId);
  const gapLimit = getMaxPlayFrameCountFromGap(layerId, frame, ignoredPlayScriptId);
  const timelineLimit = getTimelineRangeFrameCount(layer, frame);
  const nextRange = physicPaintStore.getPlayScriptRanges(layerId).find((range) => range.id !== ignoredPlayScriptId && range.startFrame > frame);
  if (nextRange && maxPlayFrameCount === gapLimit) {
    if (maxPlayFrameCount === 1) return `Only frame ${frame} is available before the next saved script.`;
    return `Maximum Play duration from this frame: ${maxPlayFrameCount} frame(s), until the next saved script.`;
  }
  if (timelineLimit !== null && maxPlayFrameCount === timelineLimit) {
    if (maxPlayFrameCount === 1) return `Only frame ${frame} is available in this timeline layer range.`;
    return `Maximum Play duration from this timeline layer range: ${maxPlayFrameCount} frame(s).`;
  }
  return `Limited to the maximum allowed Play script duration of ${PHYSIC_PAINT_MAX_APPLY_FRAMES} frames.`;
}

function openBrowserFallback(context: PhysicPaintLaunchContext): Result<null> {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { ok: false, error: 'No browser window API is available for physics paint canvas' };
  }

  const opened = window.open(buildPhysicsPaintUrl(context), PHYSIC_PAINT_WINDOW_LABEL, 'width=1280,height=900');
  if (!opened) {
    return { ok: false, error: 'Physics paint window was blocked or could not be opened' };
  }

  opened.focus?.();
  return { ok: true, data: null };
}

function buildPhysicsPaintUrl(context: PhysicPaintLaunchContext): string {
  const encodedContext = encodeURIComponent(JSON.stringify(context));
  const baseUrl = typeof window !== 'undefined' && window.location?.origin
    ? new URL(PHYSIC_PAINT_FALLBACK_PATH, window.location.origin)
    : new URL(PHYSIC_PAINT_FALLBACK_PATH, 'http://localhost');
  baseUrl.searchParams.set('context', encodedContext);
  return `${baseUrl.pathname}${baseUrl.search}`;
}

async function detectTauriRuntime(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const core = await import('@tauri-apps/api/core') as TauriCoreApi;
    if (core.isTauri?.()) return true;
  } catch {
    // Fall back to injected globals below.
  }
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window);
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
