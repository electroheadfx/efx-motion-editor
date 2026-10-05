// ============================================================
//  studio-track-physical-edits debug capture — MEASURE-ONLY.
//
//  App-writes-/tmp convention (never console-copy): every physical-edit
//  event rewrites one JSON file per window scope, and the debugger reads
//  it from disk:
//    /tmp/efx-physical-edit-studio.json  (child window: coordinator,
//                                         status port, lease, track CRUD)
//    /tmp/efx-physical-edit-main.json    (parent window: apply rejects,
//                                         accepts, replay-snapshot diffs)
//
//  Throwaway instrumentation for the debug session; safe to delete once
//  the truth table is collected. Never throws into the edit path.
// ============================================================

import { exportWritePng } from './ipc';

export type PhysicalEditCaptureScope = 'studio' | 'main';

export interface PhysicalEditCaptureEvent {
  /** ISO timestamp. */
  t: string;
  scope: PhysicalEditCaptureScope;
  type: string;
  [key: string]: unknown;
}

const buffers: Record<PhysicalEditCaptureScope, PhysicalEditCaptureEvent[]> = {
  studio: [],
  main: [],
};
const flushChains: Record<PhysicalEditCaptureScope, Promise<void>> = {
  studio: Promise.resolve(),
  main: Promise.resolve(),
};

function fileNameFor(scope: PhysicalEditCaptureScope): string {
  return scope === 'studio' ? 'efx-physical-edit-studio.json' : 'efx-physical-edit-main.json';
}

function enqueueFlush(scope: PhysicalEditCaptureScope): void {
  flushChains[scope] = flushChains[scope].then(async () => {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(buffers[scope], null, 2));
      const result = await exportWritePng('/tmp', fileNameFor(scope), Array.from(bytes));
      if (!result.ok) console.warn('[physical-edit-capture] write failed', result.error);
    } catch (error) {
      console.warn('[physical-edit-capture] write failed', error);
    }
  });
}

/** Append one event and rewrite the scope's capture file. Never throws. */
export function capturePhysicalEdit(
  scope: PhysicalEditCaptureScope,
  type: string,
  data: Record<string, unknown> = {},
): void {
  try {
    buffers[scope].push({ t: new Date().toISOString(), scope, type, ...data });
    // Bounded: a pathological edit loop must not grow the capture without limit.
    if (buffers[scope].length > 500) buffers[scope].splice(0, buffers[scope].length - 500);
    enqueueFlush(scope);
  } catch (error) {
    console.warn('[physical-edit-capture] append failed', error);
  }
}

export interface CapturedRecordSummary {
  keyId: unknown;
  appFrame: unknown;
  kind: unknown;
  recordKeys: string[];
  payloadKeys: string[];
  frameIndex: unknown;
  payloadAppFrame: unknown;
  width: unknown;
  height: unknown;
  hasBytes: boolean;
  bytesKind: string | null;
  bytesLen: number | null;
  hasMedia: boolean;
}

/**
 * Shape-only summary of real-key records: keys, identity fields and payload
 * carrier presence/length. NEVER inlines byte content — the capture must stay
 * small and must not duplicate rasters.
 */
export function summarizeRealKeyRecordsForCapture(records: readonly unknown[]): CapturedRecordSummary[] {
  return records.map((raw) => {
    const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const payload = (typeof record.payload === 'object' && record.payload !== null
      ? record.payload
      : {}) as Record<string, unknown>;
    const bytes = payload.bytes;
    let bytesKind: string | null = null;
    let bytesLen: number | null = null;
    if (bytes instanceof Uint8Array) {
      bytesKind = 'uint8array';
      bytesLen = bytes.byteLength;
    } else if (typeof bytes === 'string') {
      bytesKind = 'string';
      bytesLen = bytes.length;
    } else if (bytes !== undefined) {
      bytesKind = typeof bytes;
    }
    return {
      keyId: record.keyId,
      appFrame: record.appFrame,
      kind: record.kind,
      recordKeys: Object.keys(record),
      payloadKeys: Object.keys(payload),
      frameIndex: payload.frameIndex,
      payloadAppFrame: payload.appFrame,
      width: payload.width,
      height: payload.height,
      hasBytes: bytes !== undefined,
      bytesKind,
      bytesLen,
      hasMedia: payload.media !== undefined,
    };
  });
}
