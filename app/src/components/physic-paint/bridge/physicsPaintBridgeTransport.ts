import type { PhysicPaintApplyPayload, PhysicPaintRotoAuthorityRequest, PhysicPaintScriptLibraryRequest, PhysicPaintThumbnailEncodeRequest, PhysicPaintThumbnailEncodeResult } from '../../../types/physicPaint';
import { isPhysicPaintThumbnailEncodeResult } from '../../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, PHYSIC_PAINT_THUMBNAIL_ENCODE_REQUEST_EVENT, PHYSIC_PAINT_THUMBNAIL_ENCODE_RESULT_EVENT } from '../../../lib/physicPaintBridge';
import type { RotoScriptThumbnailNativeEncoder } from '../roto/physicsPaintRotoScriptThumbnail';
import type { PhysicsPaintBridgeMode } from './usePhysicsPaintParentBridge';

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
      const eventApi = await import('@tauri-apps/api/event');
      if (typeof eventApi.emitTo !== 'function' || typeof eventApi.listen !== 'function') throw new Error('Tauri thumbnail encoder bridge is unavailable');
      const operationId = `physics-paint-thumbnail-${Date.now()}-${crypto.randomUUID()}`;
      const request: PhysicPaintThumbnailEncodeRequest = { operationId, width, height, quality, rgbaBase64: bytesToBase64(rgba) };
      let timeout = 0;
      let unlisten: (() => void) | undefined;
      try {
        let resolveResult: (result: PhysicPaintThumbnailEncodeResult) => void = () => {};
        let rejectResult: (error: Error) => void = () => {};
        const resultPromise = new Promise<PhysicPaintThumbnailEncodeResult>((resolve, reject) => {
          resolveResult = resolve;
          rejectResult = reject;
        });
        unlisten = await eventApi.listen(PHYSIC_PAINT_THUMBNAIL_ENCODE_RESULT_EVENT, (event) => {
          if (!isPhysicPaintThumbnailEncodeResult(event.payload) || event.payload.operationId !== operationId) return;
          resolveResult(event.payload);
        });
        timeout = window.setTimeout(() => rejectResult(new Error('Native WebP encoding timed out')), 10_000);
        await eventApi.emitTo('main', PHYSIC_PAINT_THUMBNAIL_ENCODE_REQUEST_EVENT, request);
        const result = await resultPromise;
        if (!result.ok || !result.webpBase64) throw new Error(result.error ?? 'Native WebP encoding failed');
        return { width: result.width, height: result.height, mimeType: result.mimeType, bytes: base64ToBytes(result.webpBase64) };
      } finally {
        if (timeout) window.clearTimeout(timeout);
        unlisten?.();
      }
    },
  };
}

export async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, payload);
    return;
  }

  if (bridgeMode === 'Browser fallback') {
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_APPLY_EVENT, payload }, window.location.origin);
    return;
  }

  throw new Error('App bridge is not connected');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
