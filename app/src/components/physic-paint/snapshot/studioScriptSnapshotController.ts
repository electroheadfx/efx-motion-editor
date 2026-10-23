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
//
//  SAVE DISCIPLINE: markDirty() coalesces mutations into ONE 800 ms
//  debounced write — one timer, at most one in-flight write, at
//  most one queued follow-up. TERMINATION LAWS (written, not
//  implied): the timer is cleared by reset(), dispose() and bind();
//  a successful write whose content still matches the baseline
//  re-arms nothing; a FAILED write reports and stops — it never
//  re-arms itself, so a dead disk cannot spin a write loop; only a
//  NEW content-signature change re-arms. restore() suspends
//  markDirty() for its duration: the seeded stores bump their
//  revisions, and the seed IS the new saved baseline, not a
//  mutation to persist.
//
//  PACKAGE AUTHORITY (quick 261023-o3n): `getAuthority()` is read
//  LIVE at prepare time and at restore time — never at bind, never
//  frozen at launch — so a save-as rebind while the Studio is open
//  is followed by the NEXT save/restore. A prepared payload keeps
//  the authority it was prepared with. A null authority (unsaved
//  project) takes the app-cache leg in Rust; a stale token is
//  refused there and reported through the existing failure paths.
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
  /**
   * quick-261023-o3n: the OPAQUE `scriptLibraryAuthority` capability, or null
   * for an unsaved project (the cache leg). Read LIVE at prepare/restore time —
   * never captured at bind and never frozen at launch — so a save-as rebind is
   * followed by the next save/restore. A stale token is refused by Rust and
   * surfaces through the existing save/restore failure paths.
   */
  getAuthority: () => string | null;
  /** Status-capsule sink. Called only for failures. */
  report: (message: string) => void;
  write: (
    identity: StudioScriptSnapshotIdentity,
    bytes: Uint8Array,
    authority: string | null,
  ) => Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotWritePayload>>;
  read: (
    identity: StudioScriptSnapshotIdentity,
    authority: string | null,
  ) => Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>>;
}

export interface StudioScriptSnapshotRestoreResult {
  status: 'restored' | 'empty' | 'refused';
  /** Highest restored watercolor mutationId (0 when none). */
  maxRestoredMutationId: number;
}

export interface StudioScriptSnapshotController {
  /** Bind a key, or clear the binding. Resets the dirty baseline and the timer. */
  bind(identity: StudioScriptSnapshotIdentity | null): void;
  /** Read + decode + prune + seed the stores. Never rejects. */
  restore(): Promise<StudioScriptSnapshotRestoreResult>;
  /**
   * Arm the coalesced save when the content signature moved past the saved
   * baseline. Idempotent: repeated calls inside one window arm ONE timer.
   */
  markDirty(): void;
  /** Clear the timer, wait out any in-flight write, then write once if dirty. */
  flushNow(): Promise<void>;
  /** Encode + write the bound key now. Never rejects. */
  saveNow(): Promise<void>;
  /** True when the content changed since the last successful save / restore. */
  isDirty(): boolean;
  /** Drop the binding and every internal baseline (Studio disposal). */
  reset(): void;
  /** Clear the pending debounce timer; performs no write (effect cleanup). */
  dispose(): void;
  getBoundIdentity(): StudioScriptSnapshotIdentity | null;
  getLastSavedSignature(): string | null;
}

/** Coalescing window for script mutations (Task 3). */
const STUDIO_SCRIPT_SNAPSHOT_DEBOUNCE_MS = 800;

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
  /** Coalescing timer — at most one armed at a time. */
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Serialized write queue. A payload is prepared SYNCHRONOUSLY at every
   * enqueue site (so the track-switch save captures the outgoing script
   * before any reset), then committed strictly in enqueue order — an older
   * debounced payload can never land last and un-write a newer one.
   */
  let writeTail: Promise<void> = Promise.resolve();
  /** True while drainSaves owns a queued write (coalescing flag). */
  let writeBusy = false;
  /** Set while a write is in flight and the content moved again. */
  let followUpRequested = false;
  /** Non-zero while restore() seeds the stores — seeding is not a mutation. */
  let restoringCount = 0;

  function clearSaveTimer(): void {
    if (saveTimer === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  function reportRestoreFailureOnce(kind: string): void {
    if (restoreFailureReported) return;
    restoreFailureReported = true;
    deps.report(studioScriptSnapshotRestoreFailureMessage(kind));
  }

  function bind(identity: StudioScriptSnapshotIdentity | null): void {
    generation += 1;
    // A pending debounce belongs to the OUTGOING key: a track switch must
    // never let it fire against the incoming identity.
    clearSaveTimer();
    followUpRequested = false;
    boundIdentity = normalizeIdentity(identity);
    lastSavedSignature = null;
    restoreFailureReported = false;
  }

  async function restore(): Promise<StudioScriptSnapshotRestoreResult> {
    const identity = boundIdentity;
    if (!identity) return { status: 'empty', maxRestoredMutationId: 0 };
    const requestGeneration = generation;
    restoringCount += 1;
    try {
      // The authority is read LIVE here (after the bound-identity guard, right
      // before the read) so a save-as rebind is followed by this restore.
      const authority = deps.getAuthority();
      let result: StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>;
      try {
        result = await deps.read(identity, authority);
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
    } finally {
      restoringCount -= 1;
    }
  }

  interface PreparedSave {
    identity: StudioScriptSnapshotIdentity;
    bytes: Uint8Array;
    signature: string;
    generation: number;
    /** Captured at prepare time; a later change never retargets this payload. */
    authority: string | null;
  }

  /**
   * Encode the bound key NOW. Null when nothing changed (the baseline case)
   * or when the encode itself failed (reported here, once per attempt).
   */
  function prepareSave(): PreparedSave | null {
    const identity = boundIdentity;
    if (!identity) return null;
    const signature = deps.getContentSignature();
    if (signature === lastSavedSignature) return null;
    // The authority is captured WITH the identity and bytes: the prepared
    // payload is already bound to the package it was prepared for.
    const authority = deps.getAuthority();
    try {
      const liveFrames = deps.getLiveFrames();
      const bytes = encodeStudioScriptSnapshot({
        ...identity,
        watercolorEvents: pruneWatercolorEventsToLiveFrames(
          deps.getWatercolorEvents(),
          liveFrames,
        ),
        brushFrames: pruneBrushFramesToLiveFrames(deps.getBrushFrames(), liveFrames),
      });
      return { identity, bytes, signature, generation, authority };
    } catch (error) {
      const kind =
        error instanceof StudioScriptSnapshotCodecError ? `corrupt:${error.code}` : 'io';
      deps.report(studioScriptSnapshotSaveFailureMessage(kind));
      return null;
    }
  }

  /** One write attempt. Never rejects; reports once per failed save. */
  async function commitSave(prepared: PreparedSave): Promise<void> {
    let result: StudioScriptSnapshotOperationResult<StudioScriptSnapshotWritePayload>;
    try {
      result = await deps.write(prepared.identity, prepared.bytes, prepared.authority);
    } catch {
      result = { ok: false, error: { kind: 'io' } };
    }
    if (!result.ok) {
      // A failed write reports ONCE and stops — it never re-arms itself.
      deps.report(studioScriptSnapshotSaveFailureMessage(result.error.kind));
      return;
    }
    // Only a save that still represents the CURRENT identity and content
    // clears the dirty flag; a mutation during the write leaves it dirty.
    if (prepared.generation === generation && deps.getContentSignature() === prepared.signature) {
      lastSavedSignature = prepared.signature;
    }
  }

  /** FIFO write queue: exactly one commit is in flight at any time. */
  function enqueueSave(prepared: PreparedSave): Promise<void> {
    const run = writeTail.then(
      () => commitSave(prepared),
      () => commitSave(prepared),
    );
    writeTail = run;
    return run;
  }

  /** Timer callback: one prepared write, draining at most one follow-up. */
  async function drainSaves(): Promise<void> {
    if (writeBusy) {
      followUpRequested = true;
      try {
        await writeTail;
      } catch {
        // commitSave never rejects; defensive only.
      }
      return;
    }
    const prepared = prepareSave();
    if (!prepared) return;
    writeBusy = true;
    try {
      await enqueueSave(prepared);
    } finally {
      writeBusy = false;
    }
    if (followUpRequested) {
      followUpRequested = false;
      if (isDirty()) await drainSaves();
    }
  }

  function markDirty(): void {
    if (!boundIdentity) return;
    // The restore's seed bumps are the new baseline, not a mutation.
    if (restoringCount > 0) return;
    if (deps.getContentSignature() === lastSavedSignature) return;
    if (writeBusy) {
      // In flight: request at most ONE queued follow-up.
      followUpRequested = true;
      return;
    }
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void drainSaves();
    }, STUDIO_SCRIPT_SNAPSHOT_DEBOUNCE_MS);
  }

  async function flushNow(): Promise<void> {
    // The close path's flush: clear the timer, wait out every write already
    // queued for this key, then write once if the content is still newer.
    clearSaveTimer();
    try {
      await writeTail;
    } catch {
      // commitSave never rejects; defensive only.
    }
    followUpRequested = false;
    const prepared = prepareSave();
    if (!prepared) return;
    await enqueueSave(prepared);
  }

  function saveNow(): Promise<void> {
    // Synchronous capture: the track switch calls this fire-and-forget BEFORE
    // the stores are reset, and the prepared payload must be the OUTGOING
    // script. The queue guarantees it lands after any older debounced write.
    const prepared = prepareSave();
    if (!prepared) return Promise.resolve();
    return enqueueSave(prepared);
  }

  function isDirty(): boolean {
    if (!boundIdentity) return false;
    return deps.getContentSignature() !== lastSavedSignature;
  }

  function dispose(): void {
    clearSaveTimer();
    followUpRequested = false;
  }

  function reset(): void {
    generation += 1;
    clearSaveTimer();
    followUpRequested = false;
    boundIdentity = null;
    lastSavedSignature = null;
    restoreFailureReported = false;
  }

  return {
    bind,
    restore,
    markDirty,
    flushNow,
    saveNow,
    isDirty,
    reset,
    dispose,
    getBoundIdentity: () => boundIdentity,
    getLastSavedSignature: () => lastSavedSignature,
  };
}
