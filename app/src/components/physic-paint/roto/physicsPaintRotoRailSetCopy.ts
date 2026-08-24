/**
 * Pure multi-rail set COPY / DUPLICATE (quick 260820-bjw; 43.6 extension).
 *
 * ONE pure law shared by the child coordinator AND the parent bridge recompute
 * (mirror `proposePhysicPaintRotoDeleteRails`, 43.6-04): `proposeRails` builds
 * the complete next document + impact from the frozen copy payload. This module
 * is intentionally free of Preact and store imports so the proposer stays pure
 * and trivially auditable.
 *
 * Clipboard contract (43.3/43.2): the set copy payload is built at COPY time by
 * `buildRotoRailSetCopyPayload`, freezing per-key paint payloads + loop
 * placement facts; Paste reads the frozen payload (copy-on-write from the copy
 * moment). Identity contract: fresh `createPhysicPaintRotoKeyId()` identities
 * are allocated per key/loop — source keyIds are never reused.
 */

import type { RailSetIdentity } from './physicsPaintRotoRailSetSelection';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import {
  buildPhysicPaintRotoPhysicalRevision,
  createPhysicPaintRotoKeyId,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';

/** One copied Key Rail entry: frozen payload + relative frame + source identity. */
export interface RotoRailSetCopyKeyEntry {
  readonly sourceKeyId: string;
  readonly sourceAppFrame: number;
  readonly payload: PhysicPaintRotoRealKeyPayload;
  /** The source key owned an incoming interpolation break; relocated onto the fresh key. */
  readonly ownsIncomingBreak: boolean;
}

/** One copied Key Rail member (maximal derived segment at copy time). */
export interface RotoRailSetCopyKeyRailMember {
  readonly kind: 'key-rail';
  readonly firstKeyId: string;
  /** First key frame in the source document (relative to the payload anchor). */
  readonly firstKeyFrame: number;
  /** Ordered by sourceAppFrame ascending. */
  readonly entries: readonly RotoRailSetCopyKeyEntry[];
  /** The member's first key owned an incoming break in the source set. */
  readonly firstKeyOwnsIncomingBreak: boolean;
}

/** One copied Motion/Static Rail (Loop Clip placement facts, frozen at copy time). */
export interface RotoRailSetCopyLoopMember {
  readonly kind: 'loop';
  readonly loopId: string;
  readonly placementStart: number;
  /** Frozen Loop Clip snapshot; paste duplicates the shared-source placement. */
  readonly clip: PhysicPaintRotoLoopClip;
  /**
   * Resolver-resolved source end-exclusive (computed against the source
   * document at copy time). For a plain infinity clip the resolver would
   * otherwise re-resolve `naturalEnd = capacity` against the empty paste
   * destination and expand beyond the source's visible duration (UAT
   * paste-repeat regression). Capturing the true source end lets occupancy,
   * range checks, and the pasted extent all mirror what the source actually
   * rendered.
   */
  readonly effectiveEndExclusive: number;
  /**
   * Finite repeat applied on paste for an infinity-repeat source — the
   * source's visible cycle count, so the pasted copy is frozen to the finite
   * duration it effectively had instead of staying 'infinity' and growing with
   * the destination's parent end. Undefined for finite sources (their own
   * `clip.repeat` is reused verbatim).
   */
  readonly repeat?: number;
}

export type RotoRailSetCopyMember = RotoRailSetCopyKeyRailMember | RotoRailSetCopyLoopMember;

/** Frozen set clipboard payload (copy-on-write from the copy moment). */
export interface RotoRailSetCopyPayload {
  /** Minimum first frame across the set (canonical anchor). */
  readonly anchorAppFrame: number;
  /** Members in canonical order (placementStart asc, then kind/id tie-break). */
  readonly members: readonly RotoRailSetCopyMember[];
  /**
   * The stable track id the set was copied from (46-03 D-06). Empty string on
   * legacy payloads built without track context — those never trigger
   * cross-track re-pointing.
   */
  readonly sourceTrackId: string;
}

export type RotoRailSetCopyPlacementMode = 'paste' | 'duplicate';

/**
 * The complete fresh-identity allocation for one paste: sourceKeyId -> fresh
 * keyId per pasted real key and source loopId -> fresh loopId per pasted loop.
 * The parent recompute passes the child's allocation back into `proposeRails`
 * so the shared law reproduces the EXACT child proposal (fresh IDs are random
 * UUIDs, so the allocation must travel in the semantic delta for the parent to
 * be deterministic — mirror the delete-rails delta carrying `members`).
 */
export interface RotoRailSetFreshIdentityAllocation {
  readonly keyIds: Readonly<Record<string, string>>;
  readonly loopIds: Readonly<Record<string, string>>;
}

export interface RotoRailSetPasteInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly payload: RotoRailSetCopyPayload;
  readonly placementMode: RotoRailSetCopyPlacementMode;
  /** Required for 'paste' (the cursor frame); absent for 'duplicate'. */
  readonly destinationAppFrame?: number;
  /**
   * The destination track id (46-03 D-06). When present and different from
   * `payload.sourceTrackId`, loop members are re-pointed onto the
   * destination's freshly allocated source frames — a referenced source
   * outside the pasted set fails the paste closed instead of dangling.
   * Absent on pre-46-03 callers: verbatim shared-source placement.
   */
  readonly targetTrackId?: string;
  /**
   * Optional prescribed fresh identities. Absent on the child Copy propose
   * (fresh UUIDs allocated); present on the parent recompute (replay the
   * child's allocation for exact equality).
   */
  readonly freshIdentityAllocation?: RotoRailSetFreshIdentityAllocation;
}

/** One ordered pasted identity consumed by selection seeding + the accepted mapper. */
export interface RotoRailSetPasteIdentity {
  readonly kind: 'loop' | 'key-rail';
  /** Fresh firstKeyId for a key-rail; fresh loopId for a loop. */
  readonly id: string;
  readonly firstFrame: number;
  readonly effectiveEndExclusive: number;
}

/**
 * The impact doubles as the `paste` semantic delta (parent recompute
 * authority). It carries the FULL frozen copy payload + placement facts so the
 * parent bridge can re-run the same pure `proposeRails` (one shared law) —
 * mirror `proposePhysicPaintRotoDeleteRails`, whose delta carries `members`.
 */
export interface RotoRailSetPasteImpact {
  readonly kind: 'paste';
  /** The frozen copy payload read at copy time (copy-on-write). */
  readonly payload: RotoRailSetCopyPayload;
  /** 'paste' anchors at the cursor; 'duplicate' derives the anchor from document facts. */
  readonly placementMode: RotoRailSetCopyPlacementMode;
  /** Cursor frame for 'paste'; null for 'duplicate' (derived on both sides). */
  readonly destinationAppFrame: number | null;
  /** The exact fresh identities the proposal allocated (parent recompute replay). */
  readonly freshIdentityAllocation: RotoRailSetFreshIdentityAllocation;
  /** Ordered pasted identities in canonical set order. */
  readonly identities: readonly RotoRailSetPasteIdentity[];
  readonly previousRevision: string;
  readonly nextRevision: string;
}

export type RotoRailSetPasteFailureReason =
  | 'empty-payload'
  | 'malformed-payload'
  | 'unknown-member'
  | 'stale-member'
  | 'out-of-range-frame'
  | 'over-capacity'
  | 'duplicate-destination-frame'
  /**
   * 46-03 D-06: a cross-track paste whose Loop Clip references a source key
   * that is not part of the pasted set cannot re-point — rejected closed
   * rather than producing a dangling or foreign-track reference.
   */
  | 'loop-source-outside-pasted-set';

export type RotoRailSetPasteResult =
  | Readonly<{ ok: true; proposal: PhysicPaintRotoPhysicalDocument; impact: RotoRailSetPasteImpact }>
  | Readonly<{ ok: false; reason: RotoRailSetPasteFailureReason; conflictingAppFrames?: readonly number[] }>;

export type RotoRailSetCopyPayloadResult =
  | Readonly<{ ok: true; payload: RotoRailSetCopyPayload }>
  | Readonly<{ ok: false; reason: 'empty-set' | 'malformed-member' | 'stale-member' }>;

function rejectPaste(
  reason: RotoRailSetPasteFailureReason,
  conflictingAppFrames?: readonly number[],
): RotoRailSetPasteResult {
  return conflictingAppFrames === undefined
    ? Object.freeze({ ok: false, reason })
    : Object.freeze({ ok: false, reason, conflictingAppFrames: Object.freeze([...conflictingAppFrames]) });
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function freezePayload(payload: RotoRailSetCopyPayload): RotoRailSetCopyPayload {
  return Object.freeze({
    anchorAppFrame: payload.anchorAppFrame,
    members: Object.freeze([...payload.members]),
    // '' = a legacy payload with no track context (never emit `undefined` —
    // the bridge's structured-clone-plain-data check rejects undefined values).
    sourceTrackId: payload.sourceTrackId ?? '',
  }) as RotoRailSetCopyPayload;
}

// ---------------------------------------------------------------------------
// 2a: the shared pure law (copy payload builder + complete paste proposer).
// ---------------------------------------------------------------------------

function frameOfMember(member: RotoRailSetCopyMember): number {
  return member.kind === 'key-rail' ? member.firstKeyFrame : member.placementStart;
}

function idOfMember(member: RotoRailSetCopyMember): string {
  return member.kind === 'key-rail' ? member.firstKeyId : member.loopId;
}

/** Canonical order: first frame asc, then 'key-rail' before 'loop', then identity id asc. */
function orderMembers(members: readonly RotoRailSetCopyMember[]): readonly RotoRailSetCopyMember[] {
  return Object.freeze([...members].sort((left, right) => {
    const leftFrame = frameOfMember(left);
    const rightFrame = frameOfMember(right);
    if (leftFrame !== rightFrame) return leftFrame - rightFrame;
    if (left.kind !== right.kind) return left.kind === 'key-rail' ? -1 : 1;
    return idOfMember(left).localeCompare(idOfMember(right));
  }));
}

/**
 * Resolve a Loop Clip's copied extent. The freeze-to-finite behavior (46 UAT
 * paste-repeat regression) applies ONLY to infinity-repeat sources: their
 * extent must be mirrored from the resolver's boundary scan (next unowned real
 * key, then next loop-start to the right, clamped to capacity) so the pasted
 * copy reproduces the visible duration it actually had instead of re-resolving
 * `naturalEnd = capacity`. Finite/static clips keep the established v0.9
 * extent semantics verbatim — `sourceKeyIds.length`-based cycle, or
 * `originalEndExclusive` when lifecycle is present — so copying them is
 * byte-for-byte unchanged (46 UAT R1).
 */
function resolveLoopCopyExtent(
  document: PhysicPaintRotoPhysicalDocument,
  clip: PhysicPaintRotoLoopClip,
): { readonly effectiveEndExclusive: number; readonly repeat: number | undefined } {
  if (clip.repeat !== 'infinity') {
    return {
      effectiveEndExclusive: typeof clip.originalEndExclusive === 'number'
        ? clip.originalEndExclusive
        : clip.placementStart + clip.sourceKeyIds.length * clip.repeat,
      repeat: undefined,
    };
  }

  const recordByKeyId = new Map(document.realKeyRecords.map((record) => [record.keyId, record]));
  // Mirror the resolver's sourceOffsets-derived cycle length exactly (falls
  // back to the source key count when the source cycle is dangling/unsorted).
  const sourceFrameCount = clip.sourceKeyIds.length;
  const sourcePositions = clip.sourceKeyIds.map((keyId) => recordByKeyId.get(keyId)?.appFrame);
  const missingSourceKeyIds = clip.sourceKeyIds.filter((keyId) => !recordByKeyId.has(keyId));
  const sourceTimingIsValid = missingSourceKeyIds.length === 0
    && sourcePositions.every((position): position is number => position !== undefined)
    && sourcePositions.every((position, index) => index === 0 || sourcePositions[index - 1]! < position);
  const cycleLength = sourceTimingIsValid
    ? sourcePositions[sourcePositions.length - 1]! - sourcePositions[0]! + 1
    : sourceFrameCount;

  const ownedSourceKeyIds = new Set([
    ...clip.sourceKeyIds,
    ...(clip.frameOverrides?.map((override) => override.keyId) ?? []),
  ]);
  let boundary = document.capacity;
  for (const record of document.realKeyRecords) {
    if (record.appFrame < clip.placementStart) continue;
    if (ownedSourceKeyIds.has(record.keyId)) continue;
    if (record.appFrame < boundary) boundary = record.appFrame;
  }
  for (const other of document.loopClips) {
    if (other.loopId === clip.loopId) continue;
    if (other.placementStart <= clip.placementStart) continue;
    if (other.placementStart < boundary) boundary = other.placementStart;
  }
  const effectiveEndExclusive = Math.max(clip.placementStart, Math.min(document.capacity, boundary));
  return {
    effectiveEndExclusive,
    repeat: Math.max(1, Math.round((effectiveEndExclusive - clip.placementStart) / cycleLength)),
  };
}

export function buildRotoRailSetCopyPayload(input: {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly members: readonly RailSetIdentity[];
  /** 46-03 D-06: the stable track id the set is copied from. */
  readonly trackId?: string;
}): RotoRailSetCopyPayloadResult {
  const { document, members, trackId } = input;
  if (!Array.isArray(members) || members.length === 0) {
    return Object.freeze({ ok: false, reason: 'empty-set' });
  }

  const breakOwners = new Set(document.incomingInterpolationBreakKeyIds);
  const recordByKeyId = new Map(document.realKeyRecords.map((record) => [record.keyId, record]));
  const segments = deriveKeyRailSegments({
    orderedRealKeys: document.realKeyRecords,
    incomingInterpolationBreakKeyIds: breakOwners,
    groupOwnedKeyIds: new Set(),
  });
  const segmentByFirstKeyId = new Map(segments.map((segment) => [segment.firstKeyId, segment]));
  const clipByLoopId = new Map(document.loopClips.map((clip) => [clip.loopId, clip]));

  const built: RotoRailSetCopyMember[] = [];
  for (const member of members) {
    if (member.kind === 'key-rail') {
      if (!isBoundedKeyId(member.firstKeyId)) {
        return Object.freeze({ ok: false, reason: 'malformed-member' });
      }
      const segment = segmentByFirstKeyId.get(member.firstKeyId);
      if (segment === undefined) {
        return Object.freeze({ ok: false, reason: 'stale-member' });
      }
      const entries = segment.keyIds.map((keyId) => {
        const record = recordByKeyId.get(keyId);
        if (record === undefined) {
          throw new Error('physicsPaintRotoRailSetCopy: segment key missing a real-key record.');
        }
        return Object.freeze({
          sourceKeyId: record.keyId,
          sourceAppFrame: record.appFrame,
          payload: record.payload,
          ownsIncomingBreak: breakOwners.has(record.keyId),
        });
      });
      built.push(Object.freeze({
        kind: 'key-rail',
        firstKeyId: segment.firstKeyId,
        firstKeyFrame: segment.firstKeyFrame,
        entries: Object.freeze(entries),
        firstKeyOwnsIncomingBreak: breakOwners.has(segment.keyIds[0]),
      }));
    } else {
      // member.kind === 'loop'
      if (!isBoundedKeyId(member.loopId)) {
        return Object.freeze({ ok: false, reason: 'malformed-member' });
      }
      const clip = clipByLoopId.get(member.loopId);
      if (clip === undefined) {
        return Object.freeze({ ok: false, reason: 'stale-member' });
      }
      const extent = resolveLoopCopyExtent(document, clip);
      built.push(Object.freeze({
        kind: 'loop',
        loopId: member.loopId,
        placementStart: clip.placementStart,
        clip: Object.freeze(clip),
        effectiveEndExclusive: extent.effectiveEndExclusive,
        ...(extent.repeat !== undefined ? { repeat: extent.repeat } : {}),
      }));
    }
  }

  if (built.length === 0) return Object.freeze({ ok: false, reason: 'empty-set' });
  const ordered = orderMembers(built);
  const anchor = Math.min(...ordered.map(frameOfMember));
  if (!Number.isInteger(anchor) || anchor < 0) {
    return Object.freeze({ ok: false, reason: 'malformed-member' });
  }
  return Object.freeze({
    ok: true,
    payload: freezePayload({ anchorAppFrame: anchor, members: ordered, sourceTrackId: trackId ?? '' }),
  });
}

/**
 * 46-03 D-06: remap a loop body's track-local source key references onto the
 * destination track's freshly allocated keyIds (cross-track paste). Returns
 * null when any referenced source is outside the pasted set — the caller
 * rejects the paste closed instead of producing a dangling or foreign-track
 * reference. Both `sourceKeyIds` and group `frameOverrides` key refs are
 * re-pointed (they live on the same track dimension).
 */
function repointLoopClipSources(
  clip: PhysicPaintRotoLoopClip,
  freshKeyIds: Readonly<Record<string, string>>,
): { readonly sourceKeyIds: readonly string[]; readonly frameOverrides: readonly { appFrame: number; keyId: string }[] | undefined } | null {
  const sourceKeyIds: string[] = [];
  for (const sourceKeyId of clip.sourceKeyIds) {
    const fresh = freshKeyIds[sourceKeyId];
    if (fresh === undefined) return null;
    sourceKeyIds.push(fresh);
  }
  let frameOverrides: readonly { appFrame: number; keyId: string }[] | undefined;
  if (clip.frameOverrides !== undefined) {
    const repointed: { appFrame: number; keyId: string }[] = [];
    for (const override of clip.frameOverrides) {
      const fresh = freshKeyIds[override.keyId];
      if (fresh === undefined) return null;
      repointed.push(Object.freeze({ appFrame: override.appFrame, keyId: fresh }));
    }
    frameOverrides = Object.freeze(repointed);
  }
  return { sourceKeyIds: Object.freeze(sourceKeyIds), frameOverrides };
}

/** Translate a loop body by the same signed delta used for the key records. */
function buildDuplicatedLoopClip(
  clip: PhysicPaintRotoLoopClip,
  freshLoopId: string,
  destinationStart: number,
  delta: number,
  repeatOverride?: number,
  sourceEffectiveEndExclusive?: number,
  repoint?: { readonly sourceKeyIds: readonly string[]; readonly frameOverrides?: readonly { appFrame: number; keyId: string }[] },
): PhysicPaintRotoLoopClip {
  const sourceKeyIds = repoint?.sourceKeyIds ?? clip.sourceKeyIds;
  const frameOverrides = repoint?.frameOverrides ?? clip.frameOverrides;
  // 46 UAT R5: the bridge apply validator requires every loop clip in a
  // replace-roto-physical-map payload to be lifecycle-complete
  // (isLifecycleCompletePhysicPaintRotoLoopClip). An infinity source frozen to
  // a finite repeat carries no lifecycle (infinity clips never do), and a
  // finite source with syncState === undefined (never synchronized) carries
  // none either. Synthesize a complete lifecycle for ANY pasted clip that
  // lacks one, pinned to its effective end — the copied member's resolved
  // extent translated by delta — so the pasted clip passes apply validation
  // and renders to exactly the source's visible duration.
  const synthesizedEndExclusive = sourceEffectiveEndExclusive !== undefined
    ? destinationStart + (sourceEffectiveEndExclusive - clip.placementStart)
    : undefined;
  return Object.freeze({
    loopId: freshLoopId,
    placementStart: destinationStart,
    sourceKeyIds: Object.freeze([...sourceKeyIds]),
    repeat: repeatOverride ?? clip.repeat,
    mode: clip.mode,
    ...(clip.scriptId !== undefined
      ? {
          scriptId: clip.scriptId,
          motion: clip.motion,
          overrideColor: clip.overrideColor ?? null,
        }
      : {}),
    ...(clip.syncState !== undefined
      ? {
          syncState: clip.syncState,
          provenanceState: clip.provenanceState!,
          phaseOrigin: clip.phaseOrigin! + delta,
          originalEndExclusive: clip.originalEndExclusive! + delta,
          visibleRanges: Object.freeze(clip.visibleRanges!.map((range) => Object.freeze({
            start: range.start + delta,
            endExclusive: range.endExclusive + delta,
          }))),
          frameOverrides: Object.freeze(frameOverrides!.map((override) => Object.freeze({
            appFrame: override.appFrame + delta,
            keyId: override.keyId,
          }))),
        }
      : synthesizedEndExclusive !== undefined
        ? {
            syncState: 'synchronized',
            provenanceState: 'attached',
            phaseOrigin: destinationStart,
            originalEndExclusive: synthesizedEndExclusive,
            visibleRanges: Object.freeze([Object.freeze({ start: destinationStart, endExclusive: synthesizedEndExclusive })]),
            frameOverrides: Object.freeze([]),
          }
        : {}),
  }) as PhysicPaintRotoLoopClip;
}

function buildFreshKeyRecord(
  sourcePayload: PhysicPaintRotoRealKeyPayload,
  freshKeyId: string,
  freshFrame: number,
): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId: freshKeyId,
    appFrame: freshFrame,
    payload: Object.freeze({
      frameIndex: sourcePayload.frameIndex,
      appFrame: freshFrame,
      dataUrl: sourcePayload.dataUrl,
      ...(sourcePayload.width !== undefined ? { width: sourcePayload.width } : {}),
      ...(sourcePayload.height !== undefined ? { height: sourcePayload.height } : {}),
    }),
  }) as PhysicPaintRotoRealKeyRecord;
}

interface PastedExtent {
  readonly keyDestinations: readonly number[];
  readonly loopEndExclusives: readonly number[];
  readonly lastFrame: number;
}

/** Compute every fresh destination frame for one anchor delta (no mutation). */
function computePastedExtent(
  members: readonly RotoRailSetCopyMember[],
  delta: number,
): PastedExtent {
  const keyDestinations: number[] = [];
  const loopEndExclusives: number[] = [];
  let lastFrame = -1;
  for (const member of members) {
    if (member.kind === 'key-rail') {
      for (const entry of member.entries) {
        const destinationFrame = entry.sourceAppFrame + delta;
        keyDestinations.push(destinationFrame);
        if (destinationFrame > lastFrame) lastFrame = destinationFrame;
      }
    } else {
      const endExclusive = member.effectiveEndExclusive + delta;
      loopEndExclusives.push(endExclusive);
      if (endExclusive - 1 > lastFrame) lastFrame = endExclusive - 1;
    }
  }
  return { keyDestinations, loopEndExclusives, lastFrame };
}

/** Source last frame of the set (for the duplicate scan start). */
function computeLastSetEnd(members: readonly RotoRailSetCopyMember[]): number {
  let last = -1;
  for (const member of members) {
    if (member.kind === 'key-rail') {
      const lastEntry = member.entries[member.entries.length - 1];
      if (lastEntry && lastEntry.sourceAppFrame > last) last = lastEntry.sourceAppFrame;
    } else {
      const end = member.effectiveEndExclusive - 1;
      if (end > last) last = end;
    }
  }
  return last;
}

/**
 * Duplicate anchor scan: start at the source set's last frame + 2 (one empty
 * separation frame so the fresh set never becomes adjacent to the source rail),
 * then scan forward until the WHOLE set fits on empty frames within capacity.
 */
function findDuplicateAnchor(
  document: PhysicPaintRotoPhysicalDocument,
  members: readonly RotoRailSetCopyMember[],
  payloadAnchor: number,
): number | null {
  const occupiedFrames = new Set(document.realKeyRecords.map((record) => record.appFrame));
  const lastSetEnd = computeLastSetEnd(members);
  for (let candidate = lastSetEnd + 2; candidate < document.capacity; candidate += 1) {
    const delta = candidate - payloadAnchor;
    const extent = computePastedExtent(members, delta);
    if (extent.keyDestinations.some((frame) => frame < 0 || frame >= document.capacity)) continue;
    if (extent.loopEndExclusives.some((end) => end > document.capacity)) continue;
    if (extent.keyDestinations.some((frame) => occupiedFrames.has(frame))) continue;
    return candidate;
  }
  return null;
}

interface FreshAllocation {
  readonly keyIds: Record<string, string>;
  readonly loopIds: Record<string, string>;
}

/** Allocate (or replay) every fresh identity in one pass, in canonical member order. */
function allocateFreshIdentities(
  payload: RotoRailSetCopyPayload,
  prescribed: RotoRailSetFreshIdentityAllocation | undefined,
): FreshAllocation {
  const keyIds: Record<string, string> = {};
  const loopIds: Record<string, string> = {};
  for (const member of payload.members) {
    if (member.kind === 'key-rail') {
      for (const entry of member.entries) {
        if (keyIds[entry.sourceKeyId] !== undefined) continue;
        keyIds[entry.sourceKeyId] = prescribed?.keyIds?.[entry.sourceKeyId] ?? createPhysicPaintRotoKeyId();
      }
    } else {
      if (loopIds[member.loopId] !== undefined) continue;
      loopIds[member.loopId] = prescribed?.loopIds?.[member.loopId] ?? createPhysicPaintRotoKeyId();
    }
  }
  return { keyIds, loopIds };
}

export function proposeRails(input: RotoRailSetPasteInput): RotoRailSetPasteResult {
  const { document, payload, placementMode } = input;

  if (!payload || !Array.isArray(payload.members) || payload.members.length === 0) {
    return rejectPaste('empty-payload');
  }
  if (!Number.isInteger(payload.anchorAppFrame) || payload.anchorAppFrame < 0) {
    return rejectPaste('malformed-payload');
  }
  for (const member of payload.members) {
    if (member.kind === 'key-rail') {
      if (!isBoundedKeyId(member.firstKeyId)
        || !Array.isArray(member.entries)
        || member.entries.length === 0) {
        return rejectPaste('unknown-member');
      }
    } else if (member.kind === 'loop') {
      if (!isBoundedKeyId(member.loopId) || !member.clip) return rejectPaste('unknown-member');
    } else {
      return rejectPaste('unknown-member');
    }
  }

  // Destination anchor.
  const anchor = placementMode === 'paste'
    ? (() => {
        if (input.destinationAppFrame === undefined
          || !Number.isSafeInteger(input.destinationAppFrame)
          || input.destinationAppFrame < 0) {
          return null;
        }
        return input.destinationAppFrame;
      })()
    : findDuplicateAnchor(document, payload.members, payload.anchorAppFrame);
  if (anchor === null) {
    return rejectPaste(placementMode === 'paste' ? 'malformed-payload' : 'out-of-range-frame');
  }

  const delta = anchor - payload.anchorAppFrame;
  const extent = computePastedExtent(payload.members, delta);
  const occupiedFrames = new Set(document.realKeyRecords.map((record) => record.appFrame));
  const conflicts = extent.keyDestinations.filter((frame) => occupiedFrames.has(frame));
  if (conflicts.length > 0) {
    return rejectPaste('duplicate-destination-frame', conflicts);
  }
  if (extent.keyDestinations.some((frame) => frame < 0 || frame >= document.capacity)
    || extent.loopEndExclusives.some((end) => end > document.capacity)) {
    return rejectPaste('out-of-range-frame');
  }

  // Fresh identities (replay the child allocation on the parent recompute).
  const allocation = allocateFreshIdentities(payload, input.freshIdentityAllocation);

  // Build fresh records, duplicated loops, breaks.
  const freshRecords: PhysicPaintRotoRealKeyRecord[] = [];
  const duplicatedLoopClips: PhysicPaintRotoLoopClip[] = [];
  const freshBreakOwners = new Set<string>();
  const memberFirstFrames: { readonly freshFirstFrame: number; readonly freshFirstKeyId: string }[] = [];
  for (const member of payload.members) {
    if (member.kind === 'key-rail') {
      let firstFrame: number | null = null;
      let firstKeyId: string | null = null;
      for (const entry of member.entries) {
        const freshKeyId = allocation.keyIds[entry.sourceKeyId] ?? createPhysicPaintRotoKeyId();
        const freshFrame = entry.sourceAppFrame + delta;
        freshRecords.push(buildFreshKeyRecord(entry.payload, freshKeyId, freshFrame));
        if (entry.ownsIncomingBreak) freshBreakOwners.add(freshKeyId);
        if (firstFrame === null) {
          firstFrame = freshFrame;
          firstKeyId = freshKeyId;
        }
      }
      if (firstFrame !== null && firstKeyId !== null) {
        memberFirstFrames.push({ freshFirstFrame: firstFrame, freshFirstKeyId: firstKeyId });
      }
    } else {
      const freshLoopId = allocation.loopIds[member.loopId] ?? createPhysicPaintRotoKeyId();
      const destinationStart = member.placementStart + delta;
      const crossTrack = input.targetTrackId !== undefined
        && payload.sourceTrackId !== ''
        && payload.sourceTrackId !== input.targetTrackId;
      if (crossTrack) {
        // 46-03 D-06: re-point every track-local source reference onto the
        // destination's freshly allocated frames; impossible re-pointing
        // fails the paste closed — never a dangling/foreign-track reference.
        const repoint = repointLoopClipSources(member.clip, allocation.keyIds);
        if (repoint === null) return rejectPaste('loop-source-outside-pasted-set');
        duplicatedLoopClips.push(buildDuplicatedLoopClip(member.clip, freshLoopId, destinationStart, delta, member.repeat, member.effectiveEndExclusive, repoint));
      } else {
        duplicatedLoopClips.push(buildDuplicatedLoopClip(member.clip, freshLoopId, destinationStart, delta, member.repeat, member.effectiveEndExclusive));
      }
    }
  }

  // Break relocation: keep ALL source breaks (the original set is unchanged by
  // the paste — its keys remain in the document, so their breaks stay); relocate
  // copied break owners onto the fresh keys; rail-boundary rule: the FIRST
  // pasted rail's first key owns a break whenever any existing content lies to
  // its left (the segmenter merges across empty frames, so a break is required
  // even when the paste is not immediately adjacent) — a pasted set never
  // silently merges into a neighbor's segment, whether that neighbor is
  // unrelated content or the original set the copy was taken from. Subsequent
  // pasted rails keep the immediate-adjacency rule (internal gaps are preserved
  // by their relocated source breaks).
  const nextBreaks = new Set<string>();
  for (const keyId of document.incomingInterpolationBreakKeyIds) {
    nextBreaks.add(keyId);
  }
  for (const freshKeyId of freshBreakOwners) nextBreaks.add(freshKeyId);
  for (let index = 0; index < memberFirstFrames.length; index += 1) {
    const firstOf = memberFirstFrames[index];
    if (index === 0) {
      const hasLeftContent = document.realKeyRecords.some((record) => record.appFrame < firstOf.freshFirstFrame);
      if (hasLeftContent) nextBreaks.add(firstOf.freshFirstKeyId);
    } else {
      const leftFrame = firstOf.freshFirstFrame - 1;
      if (leftFrame < 0) continue;
      const leftRecord = document.realKeyRecords.find((record) => record.appFrame === leftFrame);
      if (leftRecord) nextBreaks.add(firstOf.freshFirstKeyId);
    }
  }

  // Build the complete next document (single immutable proposal).
  const nextRealKeyRecords = Object.freeze(
    [...document.realKeyRecords, ...freshRecords].sort((left, right) => left.appFrame - right.appFrame),
  ) as readonly PhysicPaintRotoRealKeyRecord[];
  const nextLoopClips = Object.freeze([...document.loopClips, ...duplicatedLoopClips]) as readonly PhysicPaintRotoLoopClip[];
  const orderedBreaks = Object.freeze([...nextBreaks].sort((a, b) => a.localeCompare(b)));
  const revision = buildPhysicPaintRotoPhysicalRevision(
    nextRealKeyRecords,
    document.interpolation,
    nextLoopClips,
    orderedBreaks,
    document.groupOverrideRecords,
  );
  const proposal = Object.freeze({
    capacity: document.capacity,
    realKeyRecords: nextRealKeyRecords,
    groupOverrideRecords: document.groupOverrideRecords,
    interpolation: document.interpolation,
    scriptMotion: document.scriptMotion,
    background: document.background,
    selectedKeyId: document.selectedKeyId,
    cursorAppFrame: document.cursorAppFrame,
    revision,
    loopClips: nextLoopClips,
    incomingInterpolationBreakKeyIds: orderedBreaks,
  }) as PhysicPaintRotoPhysicalDocument;

  // Ordered pasted identities in canonical set order.
  const identities = payload.members.map((member) => {
    if (member.kind === 'key-rail') {
      const firstEntry = member.entries[0];
      const lastEntry = member.entries[member.entries.length - 1];
      return Object.freeze({
        kind: 'key-rail' as const,
        id: allocation.keyIds[member.firstKeyId] ?? '',
        firstFrame: firstEntry.sourceAppFrame + delta,
        effectiveEndExclusive: lastEntry.sourceAppFrame + delta + 1,
      });
    }
    const freshLoopId = allocation.loopIds[member.loopId] ?? '';
    return Object.freeze({
      kind: 'loop' as const,
      id: freshLoopId,
      firstFrame: member.placementStart + delta,
      effectiveEndExclusive: member.effectiveEndExclusive + delta,
    });
  });

  const impact = Object.freeze({
    kind: 'paste',
    payload: freezePayload(payload),
    placementMode,
    destinationAppFrame: placementMode === 'paste' ? anchor : null,
    freshIdentityAllocation: Object.freeze({
      keyIds: Object.freeze({ ...allocation.keyIds }),
      loopIds: Object.freeze({ ...allocation.loopIds }),
    }),
    identities: Object.freeze(identities),
    previousRevision: document.revision,
    nextRevision: revision,
  }) as RotoRailSetPasteImpact;

  return Object.freeze({ ok: true, proposal, impact });
}

/** One member's visible interval, the minimal shape the operation-result copy
 *  needs (same first-frame/effective-end derivation as the strip's set copy). */
export interface RotoRailSetOperationResultMember {
  readonly kind: 'loop' | 'key-rail';
  readonly firstFrame: number;
  readonly effectiveEndExclusive: number;
}

/**
 * Pure operation-result capsule copy (UAT-3): "Pasted 2 Rails — frames {A}–{B}."
 * Built from the member intervals exactly like the locked M6 set copy — A = first
 * member first frame; B = last member effective end minus 1. The verb is the
 * caller-supplied past-tense action ('Copied' | 'Pasted' | 'Duplicated' |
 * 'Deleted'). The empty set contributes nothing.
 */
export function buildRotoRailSetOperationResult(
  verb: string,
  members: readonly RotoRailSetOperationResultMember[],
): string | null {
  if (members.length === 0) return null;
  const ordered = [...members].sort((left, right) => left.firstFrame - right.firstFrame);
  const firstFrame = ordered[0].firstFrame;
  const lastFrame = Math.max(...ordered.map((member) => member.effectiveEndExclusive)) - 1;
  const noun = members.length === 1 ? 'Rail' : 'Rails';
  return `${verb} ${members.length} ${noun} — frames ${firstFrame}–${lastFrame}.`;
}
