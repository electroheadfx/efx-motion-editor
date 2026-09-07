import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintApplyPayload, PhysicPaintRotoAuthorityRequest, PhysicPaintScriptLibraryRequest } from '../../../types/physicPaint';
import { toTransportPayload } from '../../../lib/webpBytes';
import { toUint8Array } from '../../../lib/webpFrameCodec';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT } from '../../../lib/physicPaintBridge';
import type { RotoScriptThumbnailNativeEncoder } from '../roto/physicsPaintRotoScriptThumbnail';
import type { PhysicsPaintBridgeMode } from './usePhysicsPaintParentBridge';

/** sessionStorage key for the crash-recovery document checkpoint (survives reload). */
export const PHYSIC_PAINT_SESSION_DOCUMENT_KEY = 'efx-paint-session-document';

export { encodeWebpFrame, decodeWebpFrame, type DecodedWebpFrame } from '../../../lib/webpFrameCodec';

export async function sendPhysicPaintFrameSyncMessage(frame: number, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  const message = { type: 'physic-paint:seek-frame' as const, frame };
  if (bridgeMode === 'Tauri') {
    try {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emit?.('physic-paint:seek-frame', message);
      await eventApi.emitTo?.('main', 'physic-paint:seek-frame', message);
      return;
    } catch {
      // Browser fallback below keeps development and non-Tauri windows synced.
    }
  }
  window.opener?.postMessage?.(message, '*');
  window.dispatchEvent?.(new MessageEvent('message', { data: message }));
}

/**
 * 41-04 (D-05): child→main audio ownership claim/release — a lightweight
 * transient event (locked A5: never revisioned), targeting the 'main' window
 * label like the sibling request senders.
 */
export async function sendPhysicPaintAudioOwnership(claim: boolean, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  const message = { claim };
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, message);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, payload: message }, window.location.origin);
    return;
  }
  throw new Error('Audio ownership bridge is unavailable');
}

export async function sendPhysicPaintScriptLibraryRequest(request: PhysicPaintScriptLibraryRequest, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, request);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, payload: request }, window.location.origin);
    return;
  }
  throw new Error('Project script library is unavailable');
}

/**
 * The child→main document sync payload (49-06 UAT round 11). The child carries
 * its runtime background source bytes alongside the document: the main window's
 * source registry is only hydrated at project load, so a clip added during the
 * child session (the Bg-picker import) would resolve 'missing' in the main
 * composite without this transfer (the "main app has no Bg render" symptom).
 */
export interface EfxPaintDocumentSyncPayload {
  readonly document: EfxPaintDocument;
  /** sourceRef → decoded dataUrl, for the refs this document's clips use. */
  readonly backgroundSources?: Readonly<Record<string, string>>;
}

/**
 * 47-01: child→main document sync. The Studio window owns its own
 * efxPaintStore instance; track CRUD (add/rename/reorder/duplicate/delete,
 * display props, active-track switch) mutates the CHILD document only. The
 * main window's save path serializes ITS document, so the child pushes its
 * current document here on every efxPaintVersion bump — the main window
 * re-registers it (idempotency guarded by revision) and the project save
 * re-projects frames/rotoPhysical from the main window's own runtime.
 */
export async function sendEfxPaintDocumentSync(
  document: EfxPaintDocument,
  bridgeMode: PhysicsPaintBridgeMode,
  backgroundSources?: Readonly<Record<string, string>>,
): Promise<void> {
  const payload: EfxPaintDocumentSyncPayload = backgroundSources
    ? { document, backgroundSources }
    : { document };
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    // 52.1 (D-05): emitTo serializes as JSON, turning the document's real-key
    // `bytes` (Uint8Array) into index objects. Convert bytes -> base64 so the
    // main-window parser sees the canonical string form.
    await eventApi.emitTo('main', PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, toTransportPayload(payload));
    return;
  }
  if (bridgeMode === 'Browser fallback') {
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, payload: toTransportPayload(payload) }, window.location.origin);
    return;
  }
  throw new Error('App bridge is not connected');
}

export async function sendPhysicPaintRotoAuthorityRequest(request: PhysicPaintRotoAuthorityRequest, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, request);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, payload: request }, window.location.origin);
    return;
  }
  throw new Error('Roto authority is unavailable');
}

export function createPhysicPaintThumbnailNativeEncoder(): RotoScriptThumbnailNativeEncoder {
  return {
    async encodeWebp({ width, height, quality, rgba }) {
      const core = await import('@tauri-apps/api/core');
      if (typeof core.invoke !== 'function') throw new Error('Tauri thumbnail encoder invoke is unavailable');
      // 52.1 (D-05/D-07): raw byte-body invoke, mirroring encode_webp_frame —
      // never the event bridge, whose JSON serialization turns the rgba
      // Uint8Array into an index object the main-window validator rejects,
      // orphaning the request until the (silent) timeout kills the save.
      const result = await core.invoke('script_library_encode_thumbnail_webp', rgba, {
        headers: {
          operationid: `physics-paint-thumbnail-${Date.now()}-${crypto.randomUUID()}`,
          width: String(width),
          height: String(height),
          quality: String(quality),
        },
      });
      return { width, height, mimeType: 'image/webp', bytes: toUint8Array(result) };
    },
  };
}

export async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    // 52.1 (D-05): emitTo serializes as JSON, which turns Uint8Array frame
    // bytes into index objects. Convert bytes -> base64 so the parent-side
    // validators see the canonical string form instead of a corrupted array.
    await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, toTransportPayload(payload));
    return;
  }

  if (bridgeMode === 'Browser fallback') {
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_APPLY_EVENT, payload }, window.location.origin);
    return;
  }

  throw new Error('App bridge is not connected');
}
