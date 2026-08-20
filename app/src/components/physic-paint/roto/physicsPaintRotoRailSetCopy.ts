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
import {
  buildPhysicPaintRotoPhysicalRevision,
  createPhysicPaintRotoKeyId,
  parsePhysicPaintRotoPhysicalDocument,
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
}

export type RotoRailSetCopyMember = RotoRailSetCopyKeyRailMember | RotoRailSetCopyLoopMember;

/** Frozen set clipboard payload (copy-on-write from the copy moment). */
export interface RotoRailSetCopyPayload {
  /** Minimum first frame across the set (canonical anchor). */
  readonly anchorAppFrame: number;
  /** Members in canonical order (placementStart asc, then kind/id tie-break). */
  readonly members: readonly RotoRailSetCopyMember[];
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
  | 'duplicate-destination-frame';

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

// ---------------------------------------------------------------------------
// RED stubs (Task 1): the real signatures above are the intended contract. The
// bodies land in Task 2 (2a) so the RED gate below fails deterministically.
// ---------------------------------------------------------------------------

export function buildRotoRailSetCopyPayload(input: {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly members: readonly RailSetIdentity[];
}): RotoRailSetCopyPayloadResult {
  // RED stub — Task 2 (2a) fills the body.
  throw new Error('buildRotoRailSetCopyPayload is not implemented yet (Task 2a).');
}

export function proposeRails(input: RotoRailSetPasteInput): RotoRailSetPasteResult {
  // RED stub — Task 2 (2a) fills the body.
  throw new Error('proposeRails is not implemented yet (Task 2a).');
}
