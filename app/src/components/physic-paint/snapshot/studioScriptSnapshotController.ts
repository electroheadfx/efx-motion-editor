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
//  PRUNE LAW: pruning is a SESSION law, never a file law
//  (studio-snapshot-empty-save). At RESTORE, stroke events (and
//  brush frames) are kept OUT OF THE SESSION unless they are proven
//  to belong to a live key — identity, never a frame number. A
//  watercolor stroke seeds only when its v3 file anchor equals the
//  live key at its playFrame; a brush row seeds only when its stored
//  keyId equals the live key at its frame. Dry events are sheet
//  actions with no frame anchor and are always seeded. The RAW
//  decoded content is retained for the binding, and a routine save
//  writes the union of the session and that retained content — the
//  session wins for every identity it still owns, so a deleted key's
//  script cannot reappear in the session, yet deleting the key never
//  erases its script from the authoritative snapshot (undo / a later
//  restore can recover it).
//
//  UNKNOWN vs KNOWN-EMPTY: a null live key map means the key records
//  are not loaded yet — pruning falls back to the frame set so a
//  launch race cannot wipe the session. A Map, even an EMPTY one, is
//  a KNOWN identity set (the user deleted every key): nothing
//  unproven seeds. Only an EXPLICIT purge (persistAfterPurge) writes
//  the session alone and drops retained entries.
//
//  RESTORE-SETTLEMENT LAW (studio-snapshot-empty-save): a bind
//  starts a new generation whose session is empty. NO save may be
//  prepared until that generation's restore has settled (including a
//  missing / refused / corrupt outcome). A save prepared inside the
//  rebind window encodes an empty payload under the INCOMING identity
//  and overwrites the surviving rail's good file (16,512 B -> 162 B).
//  A routine save additionally never writes an empty payload: an
//  empty session does not prove the snapshot is empty. Only
//  persistAfterPurge (explicit, confirmed purge) may land one.
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

import { signal } from '@preact/signals';
import { isAquarelleDryEvent, type AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import {
  StudioScriptSnapshotCodecError,
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotBrushFrame,
  type StudioScriptSnapshotDurableBase,
  type StudioScriptSnapshotIdentity,
  type StudioScriptSnapshotWatercolorKeyAnchor,
} from '../performance/studioScriptSnapshotCodec';
import { restoreAquarelleRecordTimeline } from '../view/aquarelleRecordState';
import {
  isAquarelleGuideGroup,
  restoreBrushScriptFrames,
} from '../view/brushScriptRecordState';

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

/**
 * quick-261023-ors: which persisted leg a delete touches. `cache` is the
 * purge's post-rewrite cleanup (the package copy was just rewritten and must
 * stay); `both` is the rail-deletion cascade.
 */
export type StudioScriptSnapshotDeleteScope = 'cache' | 'both';

export interface StudioScriptSnapshotDeletePayload {
  cacheRemoved: boolean;
  packageRemoved: boolean;
}

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
   * The live key identity per app frame for the bound track. A v2 brush row
   * and a v3 watercolor anchor are seeded only when the keyId still matches
   * the key now occupying that frame — a rail/bake/new key can never inherit
   * the old script. `null` means UNKNOWN (fall back to the frame set); an
   * EMPTY Map means known-empty and seeds nothing.
   */
  getLiveKeyIds?: () => ReadonlyMap<number, string> | null;
  /**
   * 261027: the session's mutationId → keyId anchors (record-state port).
   * Every saved watercolor stroke keeps the key it was captured on. Absent /
   * null keeps the retained file anchors only.
   */
  getWatercolorKeyAnchors?: () => ReadonlyMap<number, string> | null;
  /**
   * 261027 UAT round 4: the session's durable base per ordinary keyId —
   * `Uint8Array` = known base, `null` = known empty, ABSENT = unknown (the
   * publish fails closed). The map is launch-scoped and spans tracks; a save
   * writes only the keys this bound track owns.
   */
  getDurableBases?: () => ReadonlyMap<string, Uint8Array | null> | null;
  /**
   * Seed the launch map from a successful restore. A base the session already
   * holds wins (a stroke painted in THIS session re-pinned it); the file only
   * fills missing keyIds. Never called for a missing / refused / corrupt read.
   */
  seedDurableBases?: (bases: ReadonlyMap<string, Uint8Array | null>) => void;
  /**
   * Frames covered by the bound track's Loop Clip rails (Play Script / Reveal).
   * A legacy (v1) brush row carries no keyId, so on a rail frame its identity
   * cannot be proven — rail bakes are pixel-only by law and such rows are
   * dropped. `null`/absent disables the legacy rail rule.
   */
  getPixelOnlyFrames?: () => ReadonlySet<number> | null;
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
  /**
   * quick-261023-ors: delete one key's persisted legs. `cache` removes the
   * fallback only (the purge rewrote the authoritative leg first); `both`
   * removes the cache and, when `authority` resolves in Rust, the package leg.
   */
  remove: (
    identity: StudioScriptSnapshotIdentity,
    authority: string | null,
    scope: StudioScriptSnapshotDeleteScope,
  ) => Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotDeletePayload>>;
}

export interface StudioScriptSnapshotRestoreResult {
  status: 'restored' | 'empty' | 'refused';
  /** Highest restored watercolor mutationId (0 when none). */
  maxRestoredMutationId: number;
}

/**
 * studio-snapshot-empty-save: the explicit-purge door. A routine save is
 * never allowed to land an empty payload and always unions the retained file
 * content; only a confirmed purge passes `allowEmpty` + `sessionOnly`.
 */
export interface StudioScriptSnapshotSaveOptions {
  /** Explicit purge/delete intent: an empty payload may land. */
  allowEmpty?: boolean;
  /** Explicit purge: write the session alone, dropping retained entries. */
  sessionOnly?: boolean;
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
  flushNow(options?: StudioScriptSnapshotSaveOptions): Promise<void>;
  /** Encode + write the bound key now. Never rejects. */
  saveNow(): Promise<void>;
  /** True when the content changed since the last successful save / restore. */
  isDirty(): boolean;
  /** Drop the binding and every internal baseline (Studio disposal). */
  reset(): void;
  /** Clear the pending debounce timer; performs no write (effect cleanup). */
  dispose(): void;
  /**
   * quick-261023-ors: rewrite the authoritative leg with the pruned payload,
   * then delete the stale fallback cache leg. Never rejects.
   */
  persistAfterPurge(): Promise<void>;
  /**
   * quick-261026-odd: drop RETAINED content for specific frames (the one-time
   * rail-script cleanup). The session stores are the caller's responsibility;
   * this only stops the retained union from re-seeding the purged frames on
   * the next save/restore.
   */
  dropRetainedForFrames(frames: ReadonlySet<number>): void;
  /** quick-261026-odd: the durable rail-cleanup marker read from the file. */
  isRailCleanupDone(): boolean;
  /** Mark it done; the next save writes the marker into the container. */
  markRailCleanupDone(): void;
  getBoundIdentity(): StudioScriptSnapshotIdentity | null;
  getLastSavedSignature(): string | null;
}

/** Coalescing window for script mutations (Task 3). */
const STUDIO_SCRIPT_SNAPSHOT_DEBOUNCE_MS = 800;

/**
 * quick-261026-odd: bumped by markRailCleanupDone() so the Studio's content
 * signature changes even when the purge itself removed nothing — the durable
 * marker must still reach the file on the next save.
 */
export const studioScriptSnapshotRailCleanupRevision = signal(0);

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

/** What a restore may seed from a decoded watercolor timeline. */
export interface StudioWatercolorLiveSeed {
  events: AquarellePayloadEvent[];
  keyAnchors: StudioScriptSnapshotWatercolorKeyAnchor[];
}

/**
 * 261027 (studio-strokes-lost-redraw UAT round 2): a watercolor stroke seeds
 * only into the KEY it was captured on. AQTL carries no identity, so the v3
 * anchor is the proof: `anchor(mutationId) === liveKeyIds(playFrame)`. An
 * unanchored (pre-v3) stroke can never be proven and never seeds; a
 * known-empty key map seeds nothing but Dry.
 *
 * An UNKNOWN key map (null/absent — key records not loaded yet) falls back to
 * the frame-set prune so a launch race cannot wipe the session; anchors that
 * survive that prune are carried into the session unchanged.
 */
export function pruneWatercolorEventsToLiveKeys(
  events: readonly AquarellePayloadEvent[],
  liveFrames: ReadonlySet<number> | null,
  liveKeyIds: ReadonlyMap<number, string> | null | undefined,
  fileAnchors: readonly StudioScriptSnapshotWatercolorKeyAnchor[],
): StudioWatercolorLiveSeed {
  const anchorById = new Map<number, string>();
  for (const anchor of fileAnchors) {
    if (anchor.keyId.length > 0) anchorById.set(anchor.mutationId, anchor.keyId);
  }

  if (liveKeyIds === null || liveKeyIds === undefined) {
    const pruned = pruneWatercolorEventsToLiveFrames(events, liveFrames);
    const keyAnchors: StudioScriptSnapshotWatercolorKeyAnchor[] = [];
    for (const event of pruned) {
      if (isAquarelleDryEvent(event)) continue;
      const mutationId = eventMutationId(event);
      if (mutationId === undefined) continue;
      const keyId = anchorById.get(mutationId);
      if (keyId !== undefined) keyAnchors.push({ mutationId, keyId });
    }
    return { events: pruned, keyAnchors };
  }

  const seeded: AquarellePayloadEvent[] = [];
  const keyAnchors: StudioScriptSnapshotWatercolorKeyAnchor[] = [];
  for (const event of events) {
    if (isAquarelleDryEvent(event)) {
      seeded.push(event);
      continue;
    }
    if (typeof event.playFrame !== 'number') continue;
    const mutationId = eventMutationId(event);
    if (mutationId === undefined) continue;
    const liveKeyId = liveKeyIds.get(event.playFrame);
    if (liveKeyId === undefined) continue;
    const anchorKeyId = anchorById.get(mutationId);
    if (anchorKeyId === undefined || anchorKeyId !== liveKeyId) continue;
    seeded.push(event);
    keyAnchors.push({ mutationId, keyId: anchorKeyId });
  }
  return { events: seeded, keyAnchors };
}

/**
 * 261027: the brush SESSION seed. A row seeds only when its stored keyId is
 * the live key now occupying that frame; a legacy (no-keyId) row is
 * unprovable on every frame, and a known-empty key map seeds nothing. An
 * unknown (null) map keeps the caller's frame-pruned set (launch safety).
 * The retained/save cleaning uses `withoutForeignKeyFrames` instead — it
 * deliberately keeps unowned file content for undo.
 */
export function selectLiveBrushFrames(
  frames: readonly StudioScriptSnapshotBrushFrame[],
  liveKeyIds: ReadonlyMap<number, string> | null | undefined,
): StudioScriptSnapshotBrushFrame[] {
  if (liveKeyIds === null || liveKeyIds === undefined) return [...frames];
  const kept: StudioScriptSnapshotBrushFrame[] = [];
  for (const frame of frames) {
    const liveKeyId = liveKeyIds.get(frame.frame);
    if (liveKeyId === undefined) continue;
    if (typeof frame.keyId !== 'string' || frame.keyId.length === 0) continue;
    if (frame.keyId !== liveKeyId) continue;
    kept.push(frame);
  }
  return kept;
}

/**
 * quick-261026-odd follow-up: a snapshot saved before the guide-capture guard
 * can still carry Water color guide proxies as Brush groups. The aquarelle
 * registry must be restored FIRST (the predicate reads it); a frame left with
 * no real groups is dropped so the file is cleaned on the next save.
 */
function withoutAquarelleGuideFrames(
  frames: readonly StudioScriptSnapshotBrushFrame[],
): StudioScriptSnapshotBrushFrame[] {
  const cleaned: StudioScriptSnapshotBrushFrame[] = [];
  for (const frame of frames) {
    const groups = frame.groups.filter((group) => !isAquarelleGuideGroup(group));
    if (groups.length === 0) continue;
    cleaned.push({ ...frame, groups });
  }
  return cleaned;
}

/**
 * quick-261026-odd follow-up: RETAINED/FILE cleaning only (never the session
 * seed — that is `selectLiveBrushFrames`). Scripts are per KEY, never per
 * frame number.
 *  - a v2 row (stored keyId) survives in the file only while the live key at
 *    that frame has the SAME identity — a rail/bake replacement drops it;
 *  - a legacy/unknown row (v1, no keyId) cannot be proven, so it is dropped on
 *    a rail/loop-clip frame (rails bake pixels only) and kept elsewhere for
 *    undo/retime — it will never seed a key (see `selectLiveBrushFrames`);
 *  - a frame with no live key is kept (the retained-union design preserves a
 *    disappeared key's script for undo/retime).
 */
function withoutForeignKeyFrames(
  frames: readonly StudioScriptSnapshotBrushFrame[],
  liveKeyIds: ReadonlyMap<number, string> | null | undefined,
  pixelOnlyFrames: ReadonlySet<number> | null | undefined,
): StudioScriptSnapshotBrushFrame[] {
  if (!liveKeyIds || liveKeyIds.size === 0) return [...frames];
  const kept: StudioScriptSnapshotBrushFrame[] = [];
  for (const frame of frames) {
    const liveKeyId = liveKeyIds.get(frame.frame);
    if (liveKeyId === undefined) {
      kept.push(frame);
      continue;
    }
    if (typeof frame.keyId === 'string') {
      if (frame.keyId === liveKeyId) kept.push(frame);
      continue;
    }
    if (pixelOnlyFrames?.has(frame.frame) === true) continue;
    kept.push(frame);
  }
  return kept;
}

/** The raw content of one snapshot: what the FILE holds, not the session. */
export interface StudioScriptSnapshotContent {
  watercolorEvents: AquarellePayloadEvent[];
  watercolorKeyAnchors: StudioScriptSnapshotWatercolorKeyAnchor[];
  brushFrames: StudioScriptSnapshotBrushFrame[];
  durableBases: StudioScriptSnapshotDurableBase[];
}

function eventMutationId(event: AquarellePayloadEvent): number | undefined {
  if (isAquarelleDryEvent(event)) return undefined;
  return event.engine?.mutationId;
}

/**
 * studio-snapshot-empty-save: union the session with the content the file is
 * already known to hold. The session WINS for every identity it still owns
 * (an edited stroke, a recaptured frame); entries the session no longer holds
 * — a deleted key's restore-time or apply-time prune — survive in the file.
 * Retained strokes without a mutationId cannot be matched safely and are
 * dropped (the record path always assigns one); Dry events carry no frame
 * anchor and are kept from both sides.
 */
export function mergeStudioScriptSnapshotContent(
  retained: StudioScriptSnapshotContent | null,
  sessionEvents: readonly AquarellePayloadEvent[],
  sessionBrushFrames: readonly StudioScriptSnapshotBrushFrame[],
  sessionKeyAnchors?: ReadonlyMap<number, string> | null,
  sessionDurableBases?: ReadonlyMap<string, Uint8Array | null> | null,
  liveKeyIds?: ReadonlyMap<number, string> | null,
): StudioScriptSnapshotContent {
  const watercolorEvents: AquarellePayloadEvent[] = [];
  if (!retained) {
    watercolorEvents.push(...sessionEvents);
  } else {
    const sessionStrokesById = new Map<number, AquarellePayloadEvent>();
    for (const event of sessionEvents) {
      const id = eventMutationId(event);
      if (id !== undefined) sessionStrokesById.set(id, event);
    }
    const retainedStrokeIds = new Set<number>();
    const retainedDryRefs = new Set<AquarellePayloadEvent>();
    for (const event of retained.watercolorEvents) {
      if (isAquarelleDryEvent(event)) {
        retainedDryRefs.add(event);
        watercolorEvents.push(event);
        continue;
      }
      const id = eventMutationId(event);
      if (id === undefined) continue;
      retainedStrokeIds.add(id);
      watercolorEvents.push(sessionStrokesById.get(id) ?? event);
    }
    for (const event of sessionEvents) {
      if (isAquarelleDryEvent(event)) {
        if (!retainedDryRefs.has(event)) watercolorEvents.push(event);
        continue;
      }
      const id = eventMutationId(event);
      if (id !== undefined && retainedStrokeIds.has(id)) continue;
      watercolorEvents.push(event);
    }
  }

  // 261027: every saved stroke keeps the KEY it was captured on. The session
  // anchor wins (the stroke may have been re-recorded), else the retained
  // anchor survives untouched so a routine save never strips identity.
  const retainedAnchorsById = new Map<number, string>();
  if (retained) {
    for (const anchor of retained.watercolorKeyAnchors) {
      if (anchor.keyId.length > 0) retainedAnchorsById.set(anchor.mutationId, anchor.keyId);
    }
  }
  const watercolorKeyAnchors: StudioScriptSnapshotWatercolorKeyAnchor[] = [];
  const emittedAnchorIds = new Set<number>();
  for (const event of watercolorEvents) {
    if (isAquarelleDryEvent(event)) continue;
    const id = eventMutationId(event);
    if (id === undefined || emittedAnchorIds.has(id)) continue;
    emittedAnchorIds.add(id);
    const sessionKeyId = sessionKeyAnchors?.get(id);
    const keyId = typeof sessionKeyId === 'string' && sessionKeyId.length > 0
      ? sessionKeyId
      : retainedAnchorsById.get(id);
    if (keyId !== undefined && keyId.length > 0) {
      watercolorKeyAnchors.push({ mutationId: id, keyId });
    }
  }

  const sessionByFrame = new Map<number, StudioScriptSnapshotBrushFrame>();
  for (const frame of sessionBrushFrames) {
    if (frame.groups.length > 0) sessionByFrame.set(frame.frame, frame);
  }
  const brushFrames: StudioScriptSnapshotBrushFrame[] = [];
  const seenFrames = new Set<number>();
  if (retained) {
    const retainedFrames = [...retained.brushFrames]
      .filter((frame) => frame.groups.length > 0)
      .sort((left, right) => left.frame - right.frame);
    for (const frame of retainedFrames) {
      if (seenFrames.has(frame.frame)) continue;
      seenFrames.add(frame.frame);
      brushFrames.push(sessionByFrame.get(frame.frame) ?? frame);
    }
  }
  for (const frame of [...sessionByFrame.values()].sort((left, right) => left.frame - right.frame)) {
    if (seenFrames.has(frame.frame)) continue;
    brushFrames.push(frame);
  }

  // 261027 UAT round 4: the durable base follows the KEY, like the anchors
  // above. A retained base for a deleted key survives for undo. A retained
  // base for a LIVE key the session no longer holds is DROPPED — the raster
  // action replaced the key's content, so the stored pre-script base would
  // resurrect a stale multiply on the next reopen.
  const liveKeyIdValues = new Set<string>();
  if (liveKeyIds) {
    for (const keyId of liveKeyIds.values()) liveKeyIdValues.add(keyId);
  }
  const retainedBaseIds = new Set<string>();
  if (retained) {
    for (const base of retained.durableBases) retainedBaseIds.add(base.keyId);
  }
  const mergedBases = new Map<string, Uint8Array | null>();
  if (retained) {
    for (const base of retained.durableBases) {
      if (
        sessionDurableBases !== null
        && sessionDurableBases !== undefined
        && liveKeyIds !== null
        && liveKeyIds !== undefined
        && liveKeyIdValues.has(base.keyId)
        && !sessionDurableBases.has(base.keyId)
      ) {
        continue;
      }
      mergedBases.set(base.keyId, base.bytes);
    }
  }
  if (sessionDurableBases !== null && sessionDurableBases !== undefined) {
    // The launch map spans tracks; a save may only write the keys this bound
    // track owns. Identity comes from the live key map, the merged anchors and
    // the retained bases — never from an array index or a frame number. An
    // unknown (null) live key map disables scoping rather than losing a base.
    const scopedKeyIds = new Set<string>([
      ...liveKeyIdValues,
      ...watercolorKeyAnchors.map((anchor) => anchor.keyId),
      ...retainedBaseIds,
    ]);
    for (const [keyId, bytes] of sessionDurableBases) {
      if (keyId.length === 0) continue;
      if (liveKeyIds !== null && liveKeyIds !== undefined && !scopedKeyIds.has(keyId)) continue;
      mergedBases.set(keyId, bytes);
    }
  }
  const durableBases: StudioScriptSnapshotDurableBase[] = [...mergedBases.entries()]
    .map(([keyId, bytes]) => ({ keyId, bytes }))
    .sort((left, right) => {
      if (left.keyId < right.keyId) return -1;
      if (left.keyId > right.keyId) return 1;
      return 0;
    });
  return { watercolorEvents, watercolorKeyAnchors, brushFrames, durableBases };
}

/**
 * 261027 UAT round 7: a SESSION stroke with no anchor whose frame has a live
 * key NOW belongs to that key — it was painted before the key existed (an
 * auto-promoted fresh frame). Backfill it at save time so the file carries
 * proof of ownership and a later restore can seed it. Retained-only entries
 * are never passed here, and a frame with no live key gets no anchor: a
 * deleted key's script must never attach to a replacement.
 */
export function backfillSessionWatercolorAnchors(
  events: readonly AquarellePayloadEvent[],
  sessionAnchors: ReadonlyMap<number, string> | null | undefined,
  liveKeyIds: ReadonlyMap<number, string> | null | undefined,
): ReadonlyMap<number, string> | null {
  if (!liveKeyIds || liveKeyIds.size === 0) return sessionAnchors ?? null;
  let merged: Map<number, string> | null = null;
  for (const event of events) {
    if (isAquarelleDryEvent(event)) continue;
    const mutationId = event.engine?.mutationId;
    if (mutationId === undefined) continue;
    if (sessionAnchors?.has(mutationId)) continue;
    if (typeof event.playFrame !== 'number') continue;
    const keyId = liveKeyIds.get(event.playFrame);
    if (keyId === undefined || keyId.length === 0) continue;
    merged ??= new Map(sessionAnchors ?? []);
    merged.set(mutationId, keyId);
  }
  return merged ?? sessionAnchors ?? null;
}

export function studioScriptSnapshotRestoreFailureMessage(kind: string): string {
  return `Studio script snapshot could not be restored (${kind}). The frame pixels are unchanged.`;
}

export function studioScriptSnapshotSaveFailureMessage(kind: string): string {
  return `Studio script snapshot could not be saved (${kind}). Painting is unaffected.`;
}

/** quick-261023-ors: the purge applied in memory but the stale leg may remain. */
export function studioScriptSnapshotPurgeFailureMessage(kind: string): string {
  return `Studio script snapshot could not be cleaned after the purge (${kind}). The script is purged in this session; painting is unaffected.`;
}

export function createStudioScriptSnapshotController(
  deps: StudioScriptSnapshotControllerDeps,
): StudioScriptSnapshotController {
  let boundIdentity: StudioScriptSnapshotIdentity | null = null;
  let lastSavedSignature: string | null = null;
  /** Invalidates an in-flight restore across a rebind / reset. */
  let generation = 0;
  /**
   * studio-snapshot-empty-save: the generation whose restore has settled.
   * A save prepared before this matches the current generation would encode
   * the empty post-reset session under the incoming key.
   */
  let restoreSettledGeneration: number | null = null;
  /**
   * The raw content last read from / written to the bound key's file. Routine
   * saves union it with the session so a deleted-key prune never erases the
   * script from the authoritative snapshot; an explicit purge drops it.
   */
  let retainedContent: StudioScriptSnapshotContent | null = null;
  /** quick-261026-odd: the file's durable rail-cleanup marker. */
  let railCleanupDone = false;
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
    // A new binding has NO settled restore and NO retained content: an empty
    // session must never be saved under it until its own restore has run.
    restoreSettledGeneration = null;
    retainedContent = null;
    railCleanupDone = false;
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
        // No readable file content is retained: a missing file IS empty, a
        // refused one is UNKNOWN and must never be overwritten by an empty
        // session. The empty-save guard covers both.
        retainedContent = null;
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
        retainedContent = null;
        reportRestoreFailureOnce(kind);
        return { status: 'refused', maxRestoredMutationId: 0 };
      }
      if (requestGeneration !== generation) {
        return { status: 'empty', maxRestoredMutationId: 0 };
      }
      railCleanupDone = decoded.railCleanupDone;

      // 261027 UAT round 4: seed the launch map from the persisted per-key
      // bases. A key with no entry stays UNKNOWN (publish fails closed); null
      // is a known-empty base. The Studio's port keeps any base this session
      // already pinned, so a restore never overwrites fresher evidence.
      if (deps.seedDurableBases) {
        const restoredBases = new Map<string, Uint8Array | null>();
        for (const base of decoded.durableBases) {
          restoredBases.set(
            base.keyId,
            base.bytes === null ? null : new Uint8Array(base.bytes),
          );
        }
        deps.seedDurableBases(restoredBases);
      }

      const liveFrames = deps.getLiveFrames();
      const liveKeyIds = deps.getLiveKeyIds?.() ?? null;
      const pixelOnlyFrames = deps.getPixelOnlyFrames?.() ?? null;
      // 261027: a watercolor stroke seeds only when its file anchor names the
      // key now living at its playFrame. Frame numbers alone are NOT identity:
      // a deleted key's strokes must never seed the replacement key.
      const watercolorSeed = pruneWatercolorEventsToLiveKeys(
        decoded.watercolorEvents,
        liveFrames,
        liveKeyIds,
        decoded.watercolorKeyAnchors,
      );
      // The brush ledger is pruned to the live real-key frames, then to the
      // exact key identity: a frame whose key no longer exists (or whose key
      // was replaced) must never reappear in the editable store.
      const liveBrushFrames = pruneBrushFramesToLiveFrames(decoded.brushFrames, liveFrames);
      const seededAnchors = new Map<number, string>();
      for (const anchor of watercolorSeed.keyAnchors) {
        seededAnchors.set(anchor.mutationId, anchor.keyId);
      }
      const maxRestoredMutationId = restoreAquarelleRecordTimeline(
        watercolorSeed.events,
        seededAnchors,
      );
      // Guide filtering reads the restored aquarelle registry — run it AFTER
      // the timeline seed, on both the session and the retained file content.
      const brushFrames = withoutAquarelleGuideFrames(
        selectLiveBrushFrames(liveBrushFrames, liveKeyIds),
      );
      restoreBrushScriptFrames(brushFrames);
      // The FILE holds the UNPRUNED content: pruning was a session seed, not
      // a file rewrite. Retain it so a later routine save cannot drop a
      // deleted key's script from the authoritative snapshot. Rows proven
      // foreign to a live key (or legacy rows on rail frames) are the ONE
      // exception — they are corruption, not content, and are cleaned here.
      retainedContent = {
        watercolorEvents: [...decoded.watercolorEvents],
        watercolorKeyAnchors: [...decoded.watercolorKeyAnchors],
        brushFrames: withoutAquarelleGuideFrames(
          withoutForeignKeyFrames(decoded.brushFrames, liveKeyIds, pixelOnlyFrames),
        ),
        durableBases: [...decoded.durableBases],
      };
      lastSavedSignature = deps.getContentSignature();
      return { status: 'restored', maxRestoredMutationId };
    } finally {
      restoringCount -= 1;
      // Settles even a missing / refused / corrupt restore: the generation's
      // session is now a known state and routine saves may proceed (subject
      // to the empty-payload guard).
      if (requestGeneration === generation) restoreSettledGeneration = generation;
    }
  }

  interface PreparedSave {
    identity: StudioScriptSnapshotIdentity;
    bytes: Uint8Array;
    signature: string;
    generation: number;
    /** Captured at prepare time; a later change never retargets this payload. */
    authority: string | null;
    /** Exactly what these bytes carry — the new retained baseline on success. */
    content: StudioScriptSnapshotContent;
  }

  /**
   * Encode the bound key NOW. Null when nothing changed (the baseline case),
   * when the current generation's restore has not settled, when a routine
   * save would land an EMPTY payload, or when the encode itself failed
   * (reported here, once per attempt).
   */
  function prepareSave(options?: StudioScriptSnapshotSaveOptions): PreparedSave | null {
    const identity = boundIdentity;
    if (!identity) return null;
    // studio-snapshot-empty-save: the rebind window's empty session must never
    // be encoded under the incoming identity.
    if (restoreSettledGeneration !== generation) return null;
    const signature = deps.getContentSignature();
    if (signature === lastSavedSignature) return null;
    const sessionOnly = options?.sessionOnly === true;
    const allowEmpty = options?.allowEmpty === true;
    // The authority is captured WITH the identity and bytes: the prepared
    // payload is already bound to the package it was prepared for.
    const authority = deps.getAuthority();
    try {
      // No save-time pruning: the session is unioned with what the file is
      // known to hold, so a deleted key's script survives in the snapshot.
      // 261027 UAT round 7: unanchored SESSION strokes whose frame now holds
      // a live key are backfilled here — the last proof-of-ownership seam.
      const sessionEvents = deps.getWatercolorEvents();
      const liveKeyIds = deps.getLiveKeyIds?.() ?? null;
      const sessionAnchors = backfillSessionWatercolorAnchors(
        sessionEvents,
        deps.getWatercolorKeyAnchors?.() ?? null,
        liveKeyIds,
      );
      const content = mergeStudioScriptSnapshotContent(
        sessionOnly ? null : retainedContent,
        sessionEvents,
        deps.getBrushFrames(),
        sessionAnchors,
        deps.getDurableBases?.() ?? null,
        liveKeyIds,
      );
      // A guide proxy is engine-1 render input, never Brush script content.
      // The codec never carries the guideProxy flag, so a persisted guide row
      // would restore as an ordinary Brush stroke and resurrect Move handles
      // over a Water color key. The registry was seeded by this generation's
      // restore, so the filter can identify them here too.
      content.brushFrames = withoutAquarelleGuideFrames(content.brushFrames);
      // A retained row that no longer matches the live key at its frame is
      // never written back: the merge preserved it for undo, not for a
      // replacement key to inherit. Legacy rows on rail frames are cleaned
      // on the same pass.
      content.brushFrames = withoutForeignKeyFrames(
        content.brushFrames,
        deps.getLiveKeyIds?.() ?? null,
        deps.getPixelOnlyFrames?.() ?? null,
      );
      if (
        !allowEmpty
        && content.watercolorEvents.length === 0
        && content.brushFrames.length === 0
        && content.durableBases.length === 0
      ) {
        // An empty session proves nothing about the file (refused read, or a
        // rebind whose restore has not seeded it). Never overwrite with it.
        return null;
      }
      const bytes = encodeStudioScriptSnapshot({
        ...identity,
        watercolorEvents: content.watercolorEvents,
        watercolorKeyAnchors: content.watercolorKeyAnchors,
        brushFrames: content.brushFrames,
        durableBases: content.durableBases,
        railCleanupDone,
      });
      return { identity, bytes, signature, generation, authority, content };
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
    if (prepared.generation !== generation) return;
    // The file now holds exactly this content. A purge's session-only
    // rewrite intentionally replaces the retained set (that is the
    // destructive path); a routine save's union becomes the new baseline.
    retainedContent = prepared.content;
    // Only a save that still represents the CURRENT identity and content
    // clears the dirty flag; a mutation during the write leaves it dirty.
    if (deps.getContentSignature() === prepared.signature) {
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

  async function flushNow(options?: StudioScriptSnapshotSaveOptions): Promise<void> {
    // The close path's flush: clear the timer, wait out every write already
    // queued for this key, then write once if the content is still newer.
    clearSaveTimer();
    try {
      await writeTail;
    } catch {
      // commitSave never rejects; defensive only.
    }
    followUpRequested = false;
    const prepared = prepareSave(options);
    if (!prepared) return;
    await enqueueSave(prepared);
  }

  /**
   * quick-261023-ors: the purge's persistence cleanup, ordered so a purged
   * script can never come back.
   *
   * 1. Rewrite the AUTHORITATIVE leg synchronously at prepare time (flushNow):
   *    with an authority bound that is the package sidecar; without one it is
   *    the cache itself, so the pruned payload overwrites the stale file.
   * 2. Only when that rewrite left the store clean (a failed write leaves it
   *    dirty and must NOT delete the fallback) AND an authority is currently
   *    bound, delete the stale app-cache leg. The package copy is the
   *    authority's; deleting the cache is the whole point.
   *
   * A rebind during the await (track switch) abandons the cleanup: the purge
   * belonged to the outgoing key and must not delete the incoming key's cache.
   * Never rejects; a failed delete reports once through the capsule.
   */
  async function persistAfterPurge(): Promise<void> {
    if (!boundIdentity) return;
    const generationBefore = generation;
    // The EXPLICIT destructive path: the session is the whole truth, so the
    // purged entries cannot be resurrected from the retained baseline, and an
    // empty result (purge everything) is allowed to land.
    await flushNow({ allowEmpty: true, sessionOnly: true });
    if (generationBefore !== generation) return;
    const identity = boundIdentity;
    if (!identity) return;
    if (isDirty()) return;
    const authority = deps.getAuthority();
    if (!authority) return;
    let result: StudioScriptSnapshotOperationResult<StudioScriptSnapshotDeletePayload>;
    try {
      result = await deps.remove(identity, authority, 'cache');
    } catch {
      result = { ok: false, error: { kind: 'io' } };
    }
    if (!result.ok) deps.report(studioScriptSnapshotPurgeFailureMessage(result.error.kind));
  }

  /**
   * quick-261026-odd: the one-time rail cleanup's file half. Removes only the
   * listed frames' retained content — every other retained entry (a deleted
   * key's script, kept for undo) survives. Dry events carry no frame anchor
   * and are always kept.
   */
  function dropRetainedForFrames(frames: ReadonlySet<number>): void {
    if (!retainedContent || frames.size === 0) return;
    const watercolorEvents = retainedContent.watercolorEvents.filter((event) =>
      isAquarelleDryEvent(event)
      || typeof event.playFrame !== 'number'
      || !frames.has(event.playFrame));
    // An anchor is only meaningful for a surviving stroke; dropping the
    // stroke's frame must drop its identity with it.
    const survivingIds = new Set<number>();
    for (const event of watercolorEvents) {
      const mutationId = eventMutationId(event);
      if (mutationId !== undefined) survivingIds.add(mutationId);
    }
    retainedContent = {
      watercolorEvents,
      watercolorKeyAnchors: retainedContent.watercolorKeyAnchors.filter(
        (anchor) => survivingIds.has(anchor.mutationId),
      ),
      brushFrames: retainedContent.brushFrames.filter((frame) => !frames.has(frame.frame)),
      // A durable base is key-scoped, not frame-scoped: purging a rail frame's
      // script leaves the key's pre-script base as its multiply base.
      durableBases: retainedContent.durableBases,
    };
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
    restoreSettledGeneration = null;
    retainedContent = null;
    railCleanupDone = false;
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
    persistAfterPurge,
    dropRetainedForFrames,
    isRailCleanupDone: () => railCleanupDone,
    markRailCleanupDone: () => {
      if (railCleanupDone) return;
      railCleanupDone = true;
      studioScriptSnapshotRailCleanupRevision.value += 1;
    },
    getBoundIdentity: () => boundIdentity,
    getLastSavedSignature: () => lastSavedSignature,
  };
}
