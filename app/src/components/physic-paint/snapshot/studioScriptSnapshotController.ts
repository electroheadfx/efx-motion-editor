// ============================================================
//  studioScriptSnapshotController — the never-rejecting save /
//  restore seam for the Studio script snapshot
//  (quick 261023-l35).
//
//  PURITY: no Preact component, no effect, no Studio import. The
//  Studio supplies the ports; the controller owns the bound
//  identity, the dirty baseline, the restore generation guard
//  and the failure reporting policy. Module stores are applied
//  through their own exports (`restoreAquarelleRecordTimeline`),
//  so a restore is one atomic seed rather than a stream of
//  per-stroke recordings.
//
//  FAILURE POLICY: restore/save NEVER reject. A missing file is a
//  silent no-op (the first session on a project has no snapshot).
//  A refused / foreign / corrupt read is reported ONCE per bound
//  identity and never mutates a store. A failed write reports and
//  stops; painting is never blocked.
//
//  PRUNE LAW: stroke events (and brush frames) whose frame is not a
//  live real-key app frame are dropped at save and at restore; Dry
//  events are sheet actions with no frame anchor and are always
//  kept. An UNKNOWN live-frame set (null or empty) disables pruning
//  instead of wiping the script — an empty set at launch-restore
//  time means the key records are not loaded yet, not that the
//  script is empty.
// ============================================================

import { isAquarelleDryEvent, type AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import {
  StudioScriptSnapshotCodecError,
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotBrushFrame,
  type StudioScriptSnapshotIdentity,
} from '../performance/studioScriptSnapshotCodec';
import { restoreAquarelleRecordTimeline } from '../view/aquarelleRecordState';
import { restoreBrushScriptFrames } from '../view/brushScriptRecordState';

export type StudioScriptSnapshotFailureKind = 'missing' | 'refused' | 'io';

export interface StudioScriptSnapshotWritePayload {
  byteLength: number;
  digest: string;
}

export interface StudioScriptSnapshotReadPayload {
  bytes: Uint8Array;
  digest: string;
  byteLength: number;
}

export type StudioScriptSnapshotOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { kind: StudioScriptSnapshotFailureKind } };

export interface StudioScriptSnapshotControllerDeps {
  /** The current launch identity, or null while none is known. */
  getIdentity: () => StudioScriptSnapshotIdentity | null;
  getWatercolorEvents: () => readonly AquarellePayloadEvent[];
  getBrushFrames: () => readonly StudioScriptSnapshotBrushFrame[];
  /** Opaque content fingerprint; any script mutation must change it. */
  getContentSignature: () => string;
  /**
   * Live real-key app frames for the bound track. `null` (or an empty set)
   * means unknown — pruning is DISABLED rather than wiping the script.
   */
  getLiveFrames: () => ReadonlySet<number> | null;
  /** Status-capsule sink. Called only for failures. */
  report: (message: string) => void;
  write: (
    identity: StudioScriptSnapshotIdentity,
    bytes: Uint8Array,
  ) => Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotWritePayload>>;
  read: (
    identity: StudioScriptSnapshotIdentity,
  ) => Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>>;
}

export interface StudioScriptSnapshotRestoreResult {
  status: 'restored' | 'empty' | 'refused';
  /** Highest restored watercolor mutationId (0 when none). */
  maxRestoredMutationId: number;
}

export interface StudioScriptSnapshotController {
  /** Bind a key, or clear the binding. Resets the dirty baseline. */
  bind(identity: StudioScriptSnapshotIdentity | null): void;
  /** Read + decode + prune + seed the stores. Never rejects. */
  restore(): Promise<StudioScriptSnapshotRestoreResult>;
  /** Encode + write the bound key. Never rejects. */
  saveNow(): Promise<void>;
  /** True when the content changed since the last successful save / restore. */
  isDirty(): boolean;
  /** Drop the binding and every internal baseline (Studio disposal). */
  reset(): void;
  getBoundIdentity(): StudioScriptSnapshotIdentity | null;
  getLastSavedSignature(): string | null;
}

function normalizeIdentity(
  identity: StudioScriptSnapshotIdentity | null,
): StudioScriptSnapshotIdentity | null {
  if (!identity) return null;
  const { projectId, layerId, trackId } = identity;
  if (!projectId || !layerId || !trackId) return null;
  return { projectId, layerId, trackId };
}

/**
 * Keep only events anchored on a live real-key app frame. Dry events stay
 * (sheet actions have no frame anchor). An unknown live set keeps everything.
 */
export function pruneWatercolorEventsToLiveFrames(
  events: readonly AquarellePayloadEvent[],
  liveFrames: ReadonlySet<number> | null,
): AquarellePayloadEvent[] {
  if (!liveFrames || liveFrames.size === 0) return [...events];
  return events.filter((event) => {
    if (isAquarelleDryEvent(event)) return true;
    return typeof event.playFrame === 'number' && liveFrames.has(event.playFrame);
  });
}

export function pruneBrushFramesToLiveFrames<T extends { frame: number }>(
  frames: readonly T[],
  liveFrames: ReadonlySet<number> | null,
): T[] {
  if (!liveFrames || liveFrames.size === 0) return [...frames];
  return frames.filter((frame) => liveFrames.has(frame.frame));
}

export function studioScriptSnapshotRestoreFailureMessage(kind: string): string {
  return `Studio script snapshot could not be restored (${kind}). The frame pixels are unchanged.`;
}

export function studioScriptSnapshotSaveFailureMessage(kind: string): string {
  return `Studio script snapshot could not be saved (${kind}). Painting is unaffected.`;
}

export function createStudioScriptSnapshotController(
  deps: StudioScriptSnapshotControllerDeps,
): StudioScriptSnapshotController {
  let boundIdentity: StudioScriptSnapshotIdentity | null = null;
  let lastSavedSignature: string | null = null;
  /** Invalidates an in-flight restore across a rebind / reset. */
  let generation = 0;
  /** One restore-failure report per bound identity. */
  let restoreFailureReported = false;

  function reportRestoreFailureOnce(kind: string): void {
    if (restoreFailureReported) return;
    restoreFailureReported = true;
    deps.report(studioScriptSnapshotRestoreFailureMessage(kind));
  }

  function bind(identity: StudioScriptSnapshotIdentity | null): void {
    generation += 1;
    boundIdentity = normalizeIdentity(identity);
    lastSavedSignature = null;
    restoreFailureReported = false;
  }

  async function restore(): Promise<StudioScriptSnapshotRestoreResult> {
    const identity = boundIdentity;
    if (!identity) return { status: 'empty', maxRestoredMutationId: 0 };
    const requestGeneration = generation;

    let result: StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>;
    try {
      result = await deps.read(identity);
    } catch {
      result = { ok: false, error: { kind: 'io' } };
    }
    // A track switch / reset while the read was in flight: discard it whole.
    if (requestGeneration !== generation) {
      return { status: 'empty', maxRestoredMutationId: 0 };
    }

    if (!result.ok) {
      if (result.error.kind === 'missing') {
        // Silent no-op: the first session on a project has no snapshot yet.
        lastSavedSignature = deps.getContentSignature();
        return { status: 'empty', maxRestoredMutationId: 0 };
      }
      reportRestoreFailureOnce(result.error.kind);
      return { status: 'refused', maxRestoredMutationId: 0 };
    }

    let decoded: ReturnType<typeof decodeStudioScriptSnapshot>;
    try {
      decoded = decodeStudioScriptSnapshot(result.data.bytes, identity);
    } catch (error) {
      const kind =
        error instanceof StudioScriptSnapshotCodecError ? `corrupt:${error.code}` : 'corrupt';
      reportRestoreFailureOnce(kind);
      return { status: 'refused', maxRestoredMutationId: 0 };
    }
    if (requestGeneration !== generation) {
      return { status: 'empty', maxRestoredMutationId: 0 };
    }

    const liveFrames = deps.getLiveFrames();
    const events = pruneWatercolorEventsToLiveFrames(decoded.watercolorEvents, liveFrames);
    // The brush ledger is pruned to the SAME live real-key set: a frame whose
    // key no longer exists must never reappear in the editable store.
    const brushFrames = pruneBrushFramesToLiveFrames(decoded.brushFrames, liveFrames);
    const maxRestoredMutationId = restoreAquarelleRecordTimeline(events);
    restoreBrushScriptFrames(brushFrames);
    lastSavedSignature = deps.getContentSignature();
    return { status: 'restored', maxRestoredMutationId };
  }

  async function saveNow(): Promise<void> {
    const identity = boundIdentity;
    if (!identity) return;
    const signature = deps.getContentSignature();
    const requestGeneration = generation;

    let bytes: Uint8Array;
    try {
      const liveFrames = deps.getLiveFrames();
      bytes = encodeStudioScriptSnapshot({
        ...identity,
        watercolorEvents: pruneWatercolorEventsToLiveFrames(
          deps.getWatercolorEvents(),
          liveFrames,
        ),
        brushFrames: pruneBrushFramesToLiveFrames(deps.getBrushFrames(), liveFrames),
      });
    } catch (error) {
      const kind =
        error instanceof StudioScriptSnapshotCodecError ? `corrupt:${error.code}` : 'io';
      deps.report(studioScriptSnapshotSaveFailureMessage(kind));
      return;
    }

    let result: StudioScriptSnapshotOperationResult<StudioScriptSnapshotWritePayload>;
    try {
      result = await deps.write(identity, bytes);
    } catch {
      result = { ok: false, error: { kind: 'io' } };
    }
    if (!result.ok) {
      deps.report(studioScriptSnapshotSaveFailureMessage(result.error.kind));
      return;
    }
    // Only a save that still represents the CURRENT identity and content
    // clears the dirty flag; a mutation during the write leaves it dirty.
    if (requestGeneration === generation && deps.getContentSignature() === signature) {
      lastSavedSignature = signature;
    }
  }

  function isDirty(): boolean {
    if (!boundIdentity) return false;
    return deps.getContentSignature() !== lastSavedSignature;
  }

  function reset(): void {
    generation += 1;
    boundIdentity = null;
    lastSavedSignature = null;
    restoreFailureReported = false;
  }

  return {
    bind,
    restore,
    saveNow,
    isDirty,
    reset,
    getBoundIdentity: () => boundIdentity,
    getLastSavedSignature: () => lastSavedSignature,
  };
}
