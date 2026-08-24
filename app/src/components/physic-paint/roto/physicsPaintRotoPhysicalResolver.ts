/**
 * Pure physical timeline edit resolver — stable identity plus direct appFrame.
 *
 * This module defines the closed edit intent/result contracts and the sole
 * resolver entry point. It is the active canonical physical edit authority
 * after the Phase 36.14 cutovers: preview and commit callers both consume its
 * complete immutable proposals, and no other timing or transaction authority
 * exists.
 *
 * The closed intent union additionally admits `move-key-group`,
 * `delete-key-group`, and scoped `force-spacing` via `scopeKeyIds`. Every group
 * candidate feeds the same `finalizeProposal` finalizer; group intents exist
 * only inside this resolver boundary.
 *
 * Locked decisions honored:
 * - D-01/D-03: the resolver accepts stable `keyId` plus direct physical
 *   `appFrame` identities only; it has no source/display projection, compatibility
 *   normalization, or durable generated timing input.
 * - D-02: when interpolation is enabled, generated cells are exactly the strict
 *   integer interiors between adjacent ordered real keys; adjacent keys produce
 *   none and no generated cell exists before the first or after the last real key.
 * - D-05: Insert shifts the selected identity and every later real key right by
 *   exactly one physical slot, creates no key, preserves the selected identity,
 *   validates full capacity, and returns one immutable complete proposal.
 * - D-06: Delete removes the selected identity and its physical slot, shifts
 *   every later survivor left by exactly one, preserves survivor payload/
 *   identity, selects deterministically, and returns one immutable complete
 *   proposal. 43.2 amendment: when any surviving key after the removed slot
 *   is Group-referenced, the left ripple is suppressed — every survivor keeps
 *   its absolute physical position and the removed slot stays empty, so
 *   Group-owned source keys can never be compacted against their unchanged
 *   lifecycle records.
 * - D-07/D-29: single-key Drag to an empty/generated physical cell remains a
 *   source-closing cut-and-insert at the direct requested appFrame. Occupied
 *   before/after identity boundaries remove only the moved identity, preserve
 *   every survivor's source frame, resolve the stable target identity, and
 *   ripple only at the destination boundary. From A@1,B@3,C@5,D@8, moving B
 *   before D yields A@1,C@5,B@8,D@9, while moving B after D yields
 *   A@1,C@5,D@8,B@9; neither path overwrites a key.
 * - D-08: Force Spacing accepts every nonnegative integer `N`, anchors the
 *   first ordered real key, preserves deterministic identity order, and places
 *   key `i` at `first + i * (N + 1)`; `N = 0` produces adjacent keys.
 * - D-09: every successful intent returns one immutable complete identity-to-frame
 *   proposal used unchanged by later preview and commit callers; every invalid
 *   intent returns no proposal.
 * - D-30: the current rejected-UAT recovery uses bounded static production
 *   checks only; later regression/typecheck/build work requires exact native
 *   approval and separate planning.
 *
 * Prohibitions enforced:
 * - No sourceFrame, displayFrame, inBetweenCount, segment-spacing override,
 *   moved-key override, minimum-spacing rule, or nearest-key projection.
 * - No persisted generated cells or generated timing provenance.
 * - No legacy adapter, migration, compatibility alias, dual write, fallback
 *   coordinate, or silent normalization of malformed input.
 * - No pairwise frame-move list as the authoritative result; identity deltas
 *   are presentation metadata beside the complete mapping only.
 * - No payload mutation, store access, bridge call, history mutation,
 *   acknowledgement handling, or UI state. Identity/payload creation is limited
 *   to the explicit Duplicate, Paste, and blank `insert-empty-segment` intents.
 * - Group movement uses one rigid physical delta anchored by the grabbed key;
 *   selected offsets stay fixed, unselected identities never move, and any
 *   collision rejects atomically. Group delete and scoped Force Spacing remain
 *   separate intents. Occupied-key overwrite and operation-specific preview
 *   resolvers remain prohibited.
 *
 * This module is dependency-light: it imports only the canonical physical
 * identity/validator from the 36.14-01 model and the existing shared maximum
 * frame capacity. It does not import the current source/display model, store,
 * persistence, bridge, project schema, Studio, any Script controller, or any
 * Preact/hook module.
 */

import type {
  PhysicPaintRotoKeyIdentity,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  createPhysicPaintRotoKeyId,
  isPhysicPaintRotoKeyIdentity,
  isPhysicPaintRotoLoopClip,
  isPhysicPaintRotoRealKeyPayload,
  parsePhysicPaintRotoRealKeyRecordCollection,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
} from './physicsPaintRotoPhysicalModel';
import type {
  PhysicPaintRotoLinkedSourceSpacingScope,
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditSemanticDelta,
  PhysicPaintRotoPhysicalEditTarget,
} from '../../../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';
export type {
  PhysicPaintRotoLinkedSourceSpacingScope,
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditTarget,
} from '../../../types/physicPaint';
import {
  getPhysicsPaintRotoSourceCycleId,
  type PhysicsPaintRotoSpacingProxy,
} from './physicsPaintRotoSpacingSelection';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';

export function buildCanonicalMoveGroupOverrideRecords(input: {
  readonly currentLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly stagedLoopClips: readonly PhysicPaintRotoLoopClip[];
  readonly currentGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly movedLoopId: string;
  readonly capacity: number;
}): readonly PhysicPaintRotoRealKeyRecord[] | null {
  const currentClip = input.currentLoopClips.find((clip) => clip.loopId === input.movedLoopId);
  const stagedClip = input.stagedLoopClips.find((clip) => clip.loopId === input.movedLoopId);
  if (!currentClip || !stagedClip) return null;
  const currentReferences = new Map(
    (currentClip.frameOverrides ?? []).map((override) => [override.keyId, override.appFrame]),
  );
  const stagedReferences = new Map(
    (stagedClip.frameOverrides ?? []).map((override) => [override.keyId, override.appFrame]),
  );
  if (currentReferences.size !== stagedReferences.size) return null;
  if (currentReferences.size === 0) return input.currentGroupOverrideRecords;

  const referencedOutsideMovedGroup = new Set(input.currentLoopClips
    .filter((clip) => clip.loopId !== input.movedLoopId)
    .flatMap((clip) => clip.frameOverrides?.map((override) => override.keyId) ?? []));
  const movedRecords = input.currentGroupOverrideRecords.map((record) => {
    const currentAppFrame = currentReferences.get(record.keyId);
    if (currentAppFrame === undefined) return record;
    const stagedAppFrame = stagedReferences.get(record.keyId);
    if (stagedAppFrame === undefined
      || record.appFrame !== currentAppFrame
      || referencedOutsideMovedGroup.has(record.keyId)) return null;
    return {
      ...record,
      appFrame: stagedAppFrame,
      payload: {
        frameIndex: record.payload.frameIndex,
        appFrame: stagedAppFrame,
        dataUrl: record.payload.dataUrl,
        ...(record.payload.width !== undefined ? { width: record.payload.width } : {}),
        ...(record.payload.height !== undefined ? { height: record.payload.height } : {}),
      },
    } as PhysicPaintRotoRealKeyRecord;
  });
  if (movedRecords.some((record) => record === null)) return null;
  const movedRecordIds = new Set(movedRecords.flatMap((record) => record ? [record.keyId] : []));
  if ([...stagedReferences.keys()].some((keyId) => !movedRecordIds.has(keyId))) return null;
  try {
    return parsePhysicPaintRotoRealKeyRecordCollection(
      movedRecords as readonly PhysicPaintRotoRealKeyRecord[],
      input.capacity,
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Closed edit intent, input, and result contracts.
// ---------------------------------------------------------------------------

/**
 * The ordinary edit intent and target contracts live in the dependency-safe
 * transport module and are re-exported here for existing resolver callers.
 */

/**
 * Operation kind literal union, grows alongside {@link PhysicPaintRotoPhysicalEditIntent}.
 */
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'insert-empty-segment'
  | 'delete-key'
  | 'delete-key-group'
  | 'delete-key-rail'
  | 'scissor-key-rail'
  | 'move-key-rail'
  | 'move-key'
  | 'move-key-group'
  | 'move-group'
  | 'force-spacing'
  | 'duplicate-key'
  | 'paste-key'
  | 'paste-key-group'
  | 'push-rails'
  | 'move-rails'
  | 'spacing-on-set';

/**
 * Immutable resolver input: stable identities, optional complete records,
 * typed intent, bounded capacity, interpolation state, Loop Clips, and the
 * complete incoming-break collection. No store handle, bridge, or
 * preview/commit mode is accepted.
 */
export interface PhysicPaintRotoPhysicalEditInput {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  /** Required for identity/payload-changing Duplicate and Paste operations. */
  readonly records?: readonly PhysicPaintRotoRealKeyRecord[];
  readonly intent: PhysicPaintRotoPhysicalEditIntent;
  /** Authoritative parent sequence end, distinct from the physical storage capacity. */
  readonly parentEndExclusive: number;
  readonly capacity: number;
  readonly interpolationEnabled: boolean;
  /**
   * Phase 43 durable Loop Clip collection (D-07/D-11/D-13). When present, the
   * resolver rejects delete/move/force-spacing intents that target linked
   * source-cycle keys and carries rigid whole-cycle drag placementStart
   * updates on the proposal. Absent/empty preserves pre-43 behavior exactly.
   */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  /** Complete stable-key-owned incoming interpolation break collection. */
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}

/**
 * One `keyId` plus its final direct physical `appFrame`. The sorted array of
 * these assignments is the authoritative complete map.
 */
export interface PhysicPaintRotoPhysicalFrameAssignment {
  readonly keyId: string;
  readonly appFrame: number;
}

/**
 * Bounded real/generated/empty physical presentation cell derived from the
 * final map. Later views consume this array directly without recalculating
 * interpolation or occupancy.
 */
export type PhysicPaintRotoPhysicalCell =
  | { readonly kind: 'real'; readonly appFrame: number; readonly keyId: string }
  | {
      readonly kind: 'generated';
      readonly appFrame: number;
      readonly leftKeyId: string;
      readonly rightKeyId: string;
    }
  | { readonly kind: 'empty'; readonly appFrame: number };

/**
 * Presentation-only before/after delta for a moved or ripple-shifted identity.
 * The complete mapping remains the authority; this metadata is explanatory only.
 */
export interface PhysicPaintRotoPhysicalIdentityChange {
  readonly keyId: string;
  readonly beforeAppFrame: number;
  readonly afterAppFrame: number;
  readonly role: 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored';
}

/**
 * Drag presentation metadata. Names the original target kind, target identity
 * when present, before/after boundary when present, and the resolved final
 * insertion frame. The {@link movedKeyId} is repeated here for presentation
 * convenience and always equals the grabbed key; the authoritative mapping
 * remains the proposal's `mapping`.
 *
 * Phase 37 (Pitfall 2): {@link movedKeyIds} carries the complete moved set
 * (a one-member frozen array for single-key Drag) and {@link grabbedKeyId}
 * names the anchor identity, so group previews can apply the moved treatment
 * to every selected key and focus-follow the grabbed key.
 */
export interface PhysicPaintRotoPhysicalDragPresentation {
  readonly targetKind: 'physical-cell' | 'before-key' | 'after-key';
  readonly targetKeyId: string | null;
  readonly resolvedInsertionAppFrame: number;
  readonly movedKeyId: string;
  readonly movedKeyIds: readonly string[];
  readonly grabbedKeyId: string;
}

/**
 * Concise operation status derived from the validated complete map. The
 * `affectedKeyIds` array includes every identity whose frame changed plus the
 * removed identity when applicable; the `code` distinguishes a genuine change
 * from a valid no-change outcome.
 */
export interface PhysicPaintRotoPhysicalEditStatus {
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  readonly changed: boolean;
  readonly affectedKeyIds: readonly string[];
  readonly affectedCount: number;
  readonly code: 'ok' | 'ok-no-change';
  readonly text: string;
}

/**
 * Immutable complete proposal returned by every successful resolver branch.
 * Every array/map field is deeply frozen and derived from the same validated
 * candidate mapping.
 */
export interface PhysicPaintRotoPhysicalEditProposal {
  /** Complete identity-to-frame authority for this edit. */
  readonly mapping: ReadonlyMap<string, number>;
  /** Identity IDs in deterministic ascending physical-frame order. */
  readonly orderedKeyIds: readonly string[];
  /** Sorted {@link PhysicPaintRotoPhysicalFrameAssignment} view of the mapping. */
  readonly assignments: readonly PhysicPaintRotoPhysicalFrameAssignment[];
  /** Bounded `0 .. capacity - 1` physical cell projection (real/generated/empty). */
  readonly cells: readonly PhysicPaintRotoPhysicalCell[];
  /** Strict-interior generated cells only; empty when interpolation is disabled. */
  readonly generatedCells: readonly PhysicPaintRotoPhysicalCell[];
  /** Selected identity after the operation, or null when nothing remains. */
  readonly selectedKeyId: string | null;
  /** Final physical frame of the selected identity, or null. */
  readonly selectedAppFrame: number | null;
  /** Presentation-only deltas for every moved or ripple-shifted identity. */
  readonly changes: readonly PhysicPaintRotoPhysicalIdentityChange[];
  /** Removed identity for Delete, null for every other operation. */
  readonly removedKeyId: string | null;
  /** Complete removed identity set: the sole removed identity for `delete-key`, the full group for `delete-key-group`, empty otherwise. */
  readonly removedKeyIds: readonly string[];
  /** Drag presentation metadata for Move, null for every other operation. */
  readonly drag: PhysicPaintRotoPhysicalDragPresentation | null;
  /** Complete canonical next records for Duplicate/Paste; null for mapping-only edits and replay. */
  readonly nextRecords: readonly PhysicPaintRotoRealKeyRecord[] | null;
  /**
   * Phase 43 (D-04, placement/source correction): complete canonical next Loop
   * Clip collection when the edit moves loop placement — a rigid whole-cycle
   * group drag updates `placementStart` ONLY for loops whose placementStart
   * coincided with the cycle's pre-move first key frame (original loops
   * follow; duplicated loops keep their own placement and resolve the same
   * source keys by id). Null when no loop record changes.
   */
  readonly nextLoopClips: readonly PhysicPaintRotoLoopClip[] | null;
  /** Complete next incoming-break collection when ownership changes; null otherwise. */
  readonly nextIncomingInterpolationBreakKeyIds: readonly string[] | null;
  /** Declared operation-specific delta validated against current and next records. */
  readonly semanticDelta: PhysicPaintRotoPhysicalEditSemanticDelta | null;
  /** Concise status derived from the validated map. */
  readonly status: PhysicPaintRotoPhysicalEditStatus;
}

/**
 * Stable fail-closed codes covering malformed identity/intent, duplicates,
 * unknown IDs, invalid range/capacity/spacing/target, incomplete map,
 * duplicate destination, and overflow.
 */
export type PhysicPaintRotoPhysicalEditFailureCode =
  | 'invalid-capacity'
  | 'malformed-identity'
  | 'duplicate-id'
  | 'duplicate-frame'
  | 'out-of-range-frame'
  | 'empty-key-set'
  | 'unknown-operation-identity'
  | 'unknown-target-identity'
  | 'malformed-target'
  | 'invalid-spacing'
  | 'incomplete-mapping'
  | 'duplicate-destination-frame'
  | 'over-capacity'
  | 'moved-as-target'
  | 'malformed-records'
  | 'malformed-payload'
  | 'invalid-semantic-delta'
  | 'malformed-loop-clips'
  | 'loop-source-key-delete-rejected'
  | 'loop-source-key-insert-rejected'
  | 'loop-source-key-duplicate-rejected'
  | 'loop-source-key-move-rejected'
  | 'invalid-linked-source-spacing-scope'
  | 'linked-source-spacing-order-rejected'
  | 'linked-frame-delete-rejected'
  | 'no-free-space-in-direction'
  | 'push-source-straddle'
  | 'move-rails-source-straddle'
  | 'rails-spacing-source-straddle';

/**
 * Discriminated failure result. The failure branch cannot carry a partial
 * proposal.
 *
 * Phase 37 (Pitfall 1 / D-08): the optional {@link conflictingAppFrames}
 * carries the sorted colliding destination cells for
 * `duplicate-destination-frame` rejections so the blocked-target preview can
 * mark exactly those cells during the gesture. Existing failure construction
 * sites leave it absent.
 */
export interface PhysicPaintRotoPhysicalEditFailure {
  readonly code: PhysicPaintRotoPhysicalEditFailureCode;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind | null;
  readonly text: string;
  readonly conflictingAppFrames?: readonly number[];
}

/**
 * Closed success/failure resolution. The success branch carries one immutable
 * complete proposal; the failure branch carries only a stable code and concise
 * text. Later callers never receive a partial proposal.
 */
export type PhysicPaintRotoPhysicalEditResolution =
  | { readonly ok: true; readonly proposal: PhysicPaintRotoPhysicalEditProposal }
  | { readonly ok: false; readonly failure: PhysicPaintRotoPhysicalEditFailure };

// ---------------------------------------------------------------------------
// Shared read-only physical timeline projection seam (Task 1).
//
// `projectPhysicPaintRotoPhysicalTimeline` is the one exported read-only
// projection from validated physical identity placement, bounded capacity, and
// the interpolation-enabled projection flag to deterministic ordered assignments, exact
// runtime generated interiors, and bounded real/generated/empty physical cells.
// The edit resolver's `finalizeProposal` reuses the same private
// `buildProjectionFromMapping` helper so current display and edit proposals can
// never diverge on ordering, occupancy, or exact interiors.
// ---------------------------------------------------------------------------

/**
 * Immutable physical timeline projection: the shared read-only result shape
 * consumed by current-state callers (store, selectors, ports) and reused
 * internally by the edit resolver's finalizer.
 */
export interface PhysicPaintRotoPhysicalTimelineProjection {
  /** Identity IDs in deterministic ascending physical-frame order. */
  readonly orderedKeyIds: readonly string[];
  /** Sorted {@link PhysicPaintRotoPhysicalFrameAssignment} view of the mapping. */
  readonly assignments: readonly PhysicPaintRotoPhysicalFrameAssignment[];
  /** Bounded `0 .. capacity - 1` physical cell projection (real/generated/empty). */
  readonly cells: readonly PhysicPaintRotoPhysicalCell[];
  /** Strict-interior generated cells only; empty when interpolation is disabled. */
  readonly generatedCells: readonly PhysicPaintRotoPhysicalCell[];
  /** Direct lookup from `keyId` to physical `appFrame`. */
  readonly framesByKeyId: ReadonlyMap<string, number>;
}

/**
 * Closed success/failure projection resolution. The success branch carries one
 * internally consistent immutable projection; the failure branch carries a
 * stable code and concise text, never a partial projection.
 */
export type PhysicPaintRotoPhysicalTimelineProjectionResolution =
  | { readonly ok: true; readonly projection: PhysicPaintRotoPhysicalTimelineProjection }
  | { readonly ok: false; readonly failure: PhysicPaintRotoPhysicalEditFailure };

/**
 * Read-only projection input: immutable physical identity placement (stable
 * `keyId` plus direct `appFrame`), bounded capacity, and the interpolation-
 * enabled projection flag. No payload, store handle, bridge, or edit intent is
 * accepted.
 */
export interface PhysicPaintRotoPhysicalTimelineProjectionInput {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  readonly capacity: number;
  readonly interpolationEnabled: boolean;
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}

// ---------------------------------------------------------------------------
// Private helpers.
// ---------------------------------------------------------------------------

const KEY_ID_MAX_LENGTH = 256;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= KEY_ID_MAX_LENGTH;
}

function validateIncomingInterpolationBreakKeyIds(
  value: unknown,
  keyIds: ReadonlySet<string>,
): { ok: true; value: readonly string[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: Object.freeze([]) };
  if (!Array.isArray(value)) return { ok: false, error: 'Incoming interpolation breaks must be an array.' };
  const seen = new Set<string>();
  const validated: string[] = [];
  for (const keyId of value) {
    if (!isBoundedKeyId(keyId)) return { ok: false, error: 'Incoming interpolation break owner is malformed.' };
    if (seen.has(keyId)) return { ok: false, error: `Duplicate incoming interpolation break owner "${keyId}".` };
    if (!keyIds.has(keyId)) return { ok: false, error: `Incoming interpolation break owner "${keyId}" does not exist.` };
    seen.add(keyId);
    validated.push(keyId);
  }
  return { ok: true, value: Object.freeze(validated) };
}

function clonePayloadAtFrame(
  payload: PhysicPaintRotoRealKeyPayload,
  appFrame: number,
): PhysicPaintRotoRealKeyPayload {
  return Object.freeze({
    frameIndex: payload.frameIndex,
    appFrame,
    dataUrl: payload.dataUrl,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  }) as PhysicPaintRotoRealKeyPayload;
}

function payloadEqualsAtFrame(
  actual: PhysicPaintRotoRealKeyPayload,
  expected: PhysicPaintRotoRealKeyPayload,
  appFrame: number,
): boolean {
  return actual.frameIndex === expected.frameIndex
    && actual.appFrame === appFrame
    && actual.dataUrl === expected.dataUrl
    && actual.width === expected.width
    && actual.height === expected.height;
}

function recordsEqual(left: PhysicPaintRotoRealKeyRecord, right: PhysicPaintRotoRealKeyRecord): boolean {
  return left.keyId === right.keyId
    && left.appFrame === right.appFrame
    && payloadEqualsAtFrame(left.payload, right.payload, right.appFrame);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).length === allowed.size && Object.keys(value).every((key) => allowed.has(key));
}

export function createPhysicPaintRotoDuplicateKeyIntent(sourceKeyId: string): Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'duplicate-key' }> {
  if (!isBoundedKeyId(sourceKeyId)) throw new Error('Duplicate requires a bounded source key identity.');
  const newKeyId = createPhysicPaintRotoKeyId();
  return Object.freeze({ kind: 'duplicate-key', sourceKeyId, newKeyId });
}

export function createPhysicPaintRotoPasteKeyIntent(
  destinationAppFrame: number,
  clipboardPayload: PhysicPaintRotoRealKeyPayload,
  destinationKeyId: string | null,
  startsNewSegment = false,
): Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key' }> {
  if (!isNonNegativeInteger(destinationAppFrame)) throw new Error('Paste requires a nonnegative destination frame.');
  if (destinationKeyId !== null && !isBoundedKeyId(destinationKeyId)) throw new Error('Paste destination identity is malformed.');
  if (!isPhysicPaintRotoRealKeyPayload(clipboardPayload)) throw new Error('Paste clipboard payload is malformed.');
  const newKeyId = destinationKeyId === null ? createPhysicPaintRotoKeyId() : null;
  return Object.freeze({
    kind: 'paste-key',
    destinationAppFrame,
    destinationKeyId,
    newKeyId,
    clipboardPayload: clonePayloadAtFrame(clipboardPayload, clipboardPayload.appFrame),
    ...(startsNewSegment ? { startsNewSegment: true } : {}),
  });
}

/**
 * Frozen group-paste intent factory (Phase 38 D-04..D-07). The earliest copied
 * key anchors the group at `destinationAppFrame`; every other entry lands at
 * the destination plus its relative physical offset derived from source
 * appFrames at resolve time (D-03 — no offset table is stored here). Fresh
 * keyIds are allocated exactly once in this factory and never re-minted
 * downstream. Throws on malformed input; never returns a partial intent.
 */
export function createPhysicPaintRotoPasteKeyGroupIntent(
  destinationAppFrame: number,
  entries: readonly {
    readonly payload: PhysicPaintRotoRealKeyPayload;
    readonly sourceAppFrame: number;
    readonly sourceKeyId: string;
  }[],
): Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key-group' }> {
  if (!isNonNegativeInteger(destinationAppFrame)) throw new Error('Group paste requires a nonnegative destination frame.');
  if (!Array.isArray(entries) || entries.length < 2) throw new Error('Group paste requires at least two entries.');
  const frozenEntries = entries.map((entry) => {
    if (!isPhysicPaintRotoRealKeyPayload(entry.payload)) throw new Error('Group paste entry payload is malformed.');
    if (!isNonNegativeInteger(entry.sourceAppFrame)) throw new Error('Group paste entry source frame is malformed.');
    if (!isBoundedKeyId(entry.sourceKeyId)) throw new Error('Group paste entry source identity is malformed.');
    return Object.freeze({
      payload: clonePayloadAtFrame(entry.payload, entry.payload.appFrame),
      sourceAppFrame: entry.sourceAppFrame,
      sourceKeyId: entry.sourceKeyId,
      newKeyId: createPhysicPaintRotoKeyId(),
    });
  });
  return Object.freeze({
    kind: 'paste-key-group',
    destinationAppFrame,
    entries: Object.freeze(frozenEntries),
  });
}

export interface PhysicPaintRotoPhysicalEditSemanticDeltaValidationInput {
  readonly operationKind: 'insert-empty-segment' | 'duplicate-key' | 'paste-key' | 'paste-key-group';
  readonly currentRecords: unknown;
  readonly nextRecords: unknown;
  readonly semanticDelta: unknown;
  readonly capacity: number;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

export type PhysicPaintRotoPhysicalEditSemanticDeltaValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * Pure shared proof for identity/payload-changing ordinary edits. Structural
 * record validation is necessary but insufficient: this function proves the
 * complete declared Duplicate or Paste delta and rejects every extra change.
 */
export function validatePhysicPaintRotoPhysicalEditSemanticDelta(
  input: PhysicPaintRotoPhysicalEditSemanticDeltaValidationInput,
): PhysicPaintRotoPhysicalEditSemanticDeltaValidation {
  if (!validateCapacity(input.capacity)) return { ok: false, error: 'Semantic delta capacity is invalid.' };
  let current: readonly PhysicPaintRotoRealKeyRecord[];
  let next: readonly PhysicPaintRotoRealKeyRecord[];
  try {
    current = parsePhysicPaintRotoRealKeyRecordCollection(input.currentRecords, input.capacity);
    next = parsePhysicPaintRotoRealKeyRecordCollection(input.nextRecords, input.capacity);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Semantic delta records are malformed.' };
  }
  if ((input.selectedKeyId === null) !== (input.selectedAppFrame === null)) {
    return { ok: false, error: 'Semantic delta selection identity and frame disagree.' };
  }
  if (!isRecord(input.semanticDelta) || input.semanticDelta.kind !== input.operationKind) {
    return { ok: false, error: 'Semantic delta kind does not match the operation.' };
  }
  const currentById = new Map(current.map((record) => [record.keyId, record]));
  const nextById = new Map(next.map((record) => [record.keyId, record]));

  if (input.operationKind === 'insert-empty-segment') {
    const delta = input.semanticDelta;
    if (!hasExactKeys(delta, ['kind', 'insertedKeyId', 'destinationAppFrame'])
      || !isBoundedKeyId(delta.insertedKeyId)
      || !isNonNegativeInteger(delta.destinationAppFrame)
      || delta.destinationAppFrame >= input.capacity) {
      return { ok: false, error: 'Empty-segment semantic declaration is malformed.' };
    }
    if (currentById.has(delta.insertedKeyId)) return { ok: false, error: 'Empty-segment identity is not fresh.' };
    if (current.some((record) => record.appFrame === delta.destinationAppFrame)) {
      return { ok: false, error: 'Empty-segment destination is occupied.' };
    }
    if (next.length !== current.length + 1) return { ok: false, error: 'Empty-segment insert must add exactly one record.' };
    if (input.selectedKeyId !== delta.insertedKeyId || input.selectedAppFrame !== delta.destinationAppFrame) {
      return { ok: false, error: 'Empty-segment insert must select the fresh identity.' };
    }
    for (const record of current) {
      const proposed = nextById.get(record.keyId);
      if (!proposed || !recordsEqual(proposed, record)) {
        return { ok: false, error: `Empty-segment insert changed existing identity "${record.keyId}".` };
      }
    }
    const inserted = nextById.get(delta.insertedKeyId);
    if (!inserted || inserted.appFrame !== delta.destinationAppFrame) {
      return { ok: false, error: 'Empty-segment record does not match the declared destination.' };
    }
    return { ok: true };
  }

  if (input.operationKind === 'duplicate-key') {
    const delta = input.semanticDelta;
    if (!hasExactKeys(delta, ['kind', 'sourceKeyId', 'newKeyId'])
      || !isBoundedKeyId(delta.sourceKeyId)
      || !isBoundedKeyId(delta.newKeyId)
      || delta.sourceKeyId === delta.newKeyId) {
      return { ok: false, error: 'Duplicate semantic declaration is malformed.' };
    }
    const source = currentById.get(delta.sourceKeyId);
    if (!source) return { ok: false, error: 'Duplicate source identity does not exist.' };
    if (currentById.has(delta.newKeyId)) return { ok: false, error: 'Duplicate new identity is not fresh.' };
    const destination = source.appFrame + 1;
    if (destination >= input.capacity) return { ok: false, error: 'Duplicate destination exceeds capacity.' };
    if (next.length !== current.length + 1) return { ok: false, error: 'Duplicate must add exactly one record.' };
    if (input.selectedKeyId !== delta.newKeyId || input.selectedAppFrame !== destination) {
      return { ok: false, error: 'Duplicate must select the fresh destination identity.' };
    }
    for (const record of current) {
      const proposed = nextById.get(record.keyId);
      if (!proposed) return { ok: false, error: `Duplicate omitted identity "${record.keyId}".` };
      const expectedFrame = record.appFrame >= destination ? record.appFrame + 1 : record.appFrame;
      if (proposed.appFrame !== expectedFrame || !payloadEqualsAtFrame(proposed.payload, record.payload, expectedFrame)) {
        return { ok: false, error: `Duplicate changed identity or paint ownership for "${record.keyId}".` };
      }
    }
    const duplicate = nextById.get(delta.newKeyId);
    if (!duplicate || duplicate.appFrame !== destination || !payloadEqualsAtFrame(duplicate.payload, source.payload, destination)) {
      return { ok: false, error: 'Duplicate record is not an immutable retargeted source clone.' };
    }
    for (const record of next) {
      if (record.keyId !== delta.newKeyId && !currentById.has(record.keyId)) {
        return { ok: false, error: 'Duplicate introduced an undeclared identity.' };
      }
    }
    return { ok: true };
  }

  if (input.operationKind === 'paste-key-group') {
    const delta = input.semanticDelta;
    if (!hasExactKeys(delta, ['kind', 'destinationAppFrame', 'entries'])
      || !isNonNegativeInteger(delta.destinationAppFrame)
      || delta.destinationAppFrame >= input.capacity
      || !Array.isArray(delta.entries)
      || delta.entries.length < 2) {
      return { ok: false, error: 'Group paste semantic declaration is malformed.' };
    }
    interface DeclaredGroupEntry {
      readonly payload: PhysicPaintRotoRealKeyPayload;
      readonly sourceAppFrame: number;
      readonly sourceKeyId: string;
      readonly newKeyId: string;
    }
    const declaredEntries: DeclaredGroupEntry[] = [];
    const seenNewKeyIds = new Set<string>();
    for (const rawEntry of delta.entries) {
      if (!isRecord(rawEntry)
        || !hasExactKeys(rawEntry, ['payload', 'sourceAppFrame', 'sourceKeyId', 'newKeyId'])
        || !isPhysicPaintRotoRealKeyPayload(rawEntry.payload)
        || !isNonNegativeInteger(rawEntry.sourceAppFrame)
        || !isBoundedKeyId(rawEntry.sourceKeyId)
        || !isBoundedKeyId(rawEntry.newKeyId)) {
        return { ok: false, error: 'Group paste semantic declaration entry is malformed.' };
      }
      if (currentById.has(rawEntry.newKeyId) || seenNewKeyIds.has(rawEntry.newKeyId)) {
        return { ok: false, error: 'Group paste new identity is not fresh.' };
      }
      seenNewKeyIds.add(rawEntry.newKeyId);
      declaredEntries.push({
        payload: rawEntry.payload,
        sourceAppFrame: rawEntry.sourceAppFrame,
        sourceKeyId: rawEntry.sourceKeyId,
        newKeyId: rawEntry.newKeyId,
      });
    }
    const anchorSourceAppFrame = Math.min(...declaredEntries.map((entry) => entry.sourceAppFrame));
    const occupiedFrames = new Set(current.map((record) => record.appFrame));
    const seenDestinations = new Set<number>();
    const destinationByNewKeyId = new Map<string, number>();
    for (const entry of declaredEntries) {
      const destination = delta.destinationAppFrame + (entry.sourceAppFrame - anchorSourceAppFrame);
      if (destination >= input.capacity) {
        return { ok: false, error: 'Group paste destination exceeds capacity.' };
      }
      if (occupiedFrames.has(destination) || seenDestinations.has(destination)) {
        return { ok: false, error: 'Group paste destination is occupied.' };
      }
      seenDestinations.add(destination);
      destinationByNewKeyId.set(entry.newKeyId, destination);
    }
    if (next.length !== current.length + declaredEntries.length) {
      return { ok: false, error: 'Group paste must add exactly the declared entries.' };
    }
    for (const record of current) {
      const proposed = nextById.get(record.keyId);
      if (!proposed || !recordsEqual(proposed, record)) {
        return { ok: false, error: `Group paste changed existing identity "${record.keyId}".` };
      }
    }
    for (const entry of declaredEntries) {
      const destination = destinationByNewKeyId.get(entry.newKeyId) as number;
      const pasted = nextById.get(entry.newKeyId);
      if (!pasted || pasted.appFrame !== destination || !payloadEqualsAtFrame(pasted.payload, entry.payload, destination)) {
        return { ok: false, error: 'Group paste record does not match the declared retargeted entry.' };
      }
    }
    for (const record of next) {
      if (!currentById.has(record.keyId) && !seenNewKeyIds.has(record.keyId)) {
        return { ok: false, error: 'Group paste introduced an undeclared identity.' };
      }
    }
    const anchorEntry = declaredEntries.find((entry) => entry.sourceAppFrame === anchorSourceAppFrame) as DeclaredGroupEntry;
    if (input.selectedKeyId !== anchorEntry.newKeyId || input.selectedAppFrame !== delta.destinationAppFrame) {
      return { ok: false, error: 'Group paste must select the earliest pasted fresh identity.' };
    }
    return { ok: true };
  }

  const delta = input.semanticDelta;
  if (!hasExactKeys(delta, ['kind', 'destinationAppFrame', 'destinationKeyId', 'newKeyId', 'clipboardPayload'])
    || !isNonNegativeInteger(delta.destinationAppFrame)
    || delta.destinationAppFrame >= input.capacity
    || (delta.destinationKeyId !== null && !isBoundedKeyId(delta.destinationKeyId))
    || (delta.newKeyId !== null && !isBoundedKeyId(delta.newKeyId))
    || ((delta.destinationKeyId === null) === (delta.newKeyId === null))
    || !isPhysicPaintRotoRealKeyPayload(delta.clipboardPayload)) {
    return { ok: false, error: 'Paste semantic declaration is malformed.' };
  }
  const retargetedClipboard = clonePayloadAtFrame(delta.clipboardPayload, delta.destinationAppFrame);
  if (delta.destinationKeyId === null) {
    const newKeyId = delta.newKeyId as string;
    if (currentById.has(newKeyId)) return { ok: false, error: 'Paste new identity is not fresh.' };
    if (current.some((record) => record.appFrame === delta.destinationAppFrame)) {
      return { ok: false, error: 'Paste-to-empty destination is occupied.' };
    }
    if (next.length !== current.length + 1) return { ok: false, error: 'Paste-to-empty must add exactly one record.' };
    if (input.selectedKeyId !== newKeyId || input.selectedAppFrame !== delta.destinationAppFrame) {
      return { ok: false, error: 'Paste-to-empty must select the fresh destination identity.' };
    }
    for (const record of current) {
      const proposed = nextById.get(record.keyId);
      if (!proposed || !recordsEqual(proposed, record)) return { ok: false, error: `Paste-to-empty changed existing identity "${record.keyId}".` };
    }
    const pasted = nextById.get(newKeyId);
    if (!pasted || pasted.appFrame !== delta.destinationAppFrame || !payloadEqualsAtFrame(pasted.payload, retargetedClipboard, delta.destinationAppFrame)) {
      return { ok: false, error: 'Paste-to-empty record does not match the retargeted clipboard.' };
    }
    for (const record of next) {
      if (record.keyId !== newKeyId && !currentById.has(record.keyId)) return { ok: false, error: 'Paste-to-empty introduced an undeclared identity.' };
    }
    return { ok: true };
  }

  const destination = currentById.get(delta.destinationKeyId);
  if (!destination || destination.appFrame !== delta.destinationAppFrame) {
    return { ok: false, error: 'Paste-to-existing destination identity and frame disagree.' };
  }
  if (next.length !== current.length || delta.newKeyId !== null) {
    return { ok: false, error: 'Paste-to-existing must preserve the complete identity set.' };
  }
  if (input.selectedKeyId !== destination.keyId || input.selectedAppFrame !== destination.appFrame) {
    return { ok: false, error: 'Paste-to-existing must preserve and select the destination identity.' };
  }
  for (const record of current) {
    const proposed = nextById.get(record.keyId);
    if (!proposed || proposed.appFrame !== record.appFrame) return { ok: false, error: 'Paste-to-existing changed the identity/frame set.' };
    if (record.keyId === destination.keyId) {
      if (!payloadEqualsAtFrame(proposed.payload, retargetedClipboard, destination.appFrame)) {
        return { ok: false, error: 'Paste-to-existing destination payload does not match the retargeted clipboard.' };
      }
    } else if (!recordsEqual(proposed, record)) {
      return { ok: false, error: `Paste-to-existing changed unrelated identity "${record.keyId}".` };
    }
  }
  return { ok: true };
}

function isResolverOperationKind(value: unknown): value is PhysicPaintRotoPhysicalEditOperationKind {
  return value === 'insert-slot'
    || value === 'insert-empty-segment'
    || value === 'delete-key'
    || value === 'delete-key-group'
    || value === 'delete-key-rail'
    || value === 'scissor-key-rail'
    || value === 'move-key-rail'
    || value === 'move-key'
    || value === 'move-key-group'
    || value === 'move-group'
    || value === 'force-spacing'
    || value === 'duplicate-key'
    || value === 'paste-key'
    || value === 'paste-key-group'
    || value === 'push-rails'
    || value === 'move-rails'
    || value === 'spacing-on-set';
}

function fail(
  code: PhysicPaintRotoPhysicalEditFailureCode,
  operationKind: PhysicPaintRotoPhysicalEditOperationKind | null,
  text: string,
  conflictingAppFrames?: readonly number[],
): PhysicPaintRotoPhysicalEditResolution {
  const failure = conflictingAppFrames === undefined
    ? Object.freeze({ code, operationKind, text })
    : Object.freeze({
        code,
        operationKind,
        text,
        conflictingAppFrames: Object.freeze([...conflictingAppFrames].sort((left, right) => left - right)),
      });
  return Object.freeze({
    ok: false as const,
    failure: failure as PhysicPaintRotoPhysicalEditFailure,
  }) as PhysicPaintRotoPhysicalEditResolution;
}

function validateCapacity(capacity: unknown): capacity is number {
  return (
    typeof capacity === 'number' &&
    Number.isInteger(capacity) &&
    capacity >= 1 &&
    capacity <= PHYSIC_PAINT_MAX_APPLY_FRAMES
  );
}

// ---------------------------------------------------------------------------
// Phase 43 loop-aware intent guards (D-07/D-11).
// ---------------------------------------------------------------------------

/** Locked D-11 rejection copy (single-key drag and Force Spacing on linked source keys). */
const LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT =
  'Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.';

/** Locked D-07 rejection copy; N counts every loop referencing the key's source cycle. */
function loopSourceKeyDeleteRejectedText(referencingLoopCount: number): string {
  return `This key belongs to a source cycle used by ${referencingLoopCount} linked loop(s). Unlink the loop(s) before deleting it.`;
}

/** Locked 43.2 insert guard copy; N counts the Group-referenced keys the right ripple would move. */
function loopSourceKeyInsertRejectedText(movedGroupKeyCount: number): string {
  return `Insert is unavailable because the right ripple would move ${movedGroupKeyCount} Group-referenced source key(s). Insert into an empty frame instead, or unlink the loop(s) first.`;
}

/** Locked 43.2 duplicate guard copy; N counts the Group-referenced keys the right ripple would move. */
function loopSourceKeyDuplicateRejectedText(movedGroupKeyCount: number): string {
  return `Duplicate is unavailable because the right ripple would move ${movedGroupKeyCount} Group-referenced source key(s). Unlink the loop(s) first.`;
}

/**
 * Validate the optional edit-input Loop Clip collection. Absent/null means the
 * pre-43 empty collection; malformed members fail closed — never silently
 * filtered or normalized (D-31).
 */
function validateEditLoopClips(
  value: unknown,
  operationKind: PhysicPaintRotoPhysicalEditOperationKind | null,
): { ok: true; value: readonly PhysicPaintRotoLoopClip[] } | { ok: false; resolution: PhysicPaintRotoPhysicalEditResolution } {
  if (value === undefined || value === null) {
    return { ok: true, value: PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY };
  }
  if (!Array.isArray(value) || !value.every(isPhysicPaintRotoLoopClip)) {
    return { ok: false, resolution: fail('malformed-loop-clips', operationKind, 'Loop Clips must be valid Loop Clip records.') };
  }
  return { ok: true, value };
}

/** Count every loop whose source cycle references the given keyId. */
function countLoopsReferencingSourceKey(
  loopClips: readonly PhysicPaintRotoLoopClip[],
  keyId: string,
): number {
  let count = 0;
  for (const clip of loopClips) {
    if (clip.sourceKeyIds.includes(keyId)) count += 1;
  }
  return count;
}

/**
 * D-04 rigid whole-cycle drag placement follow (placement/source correction):
 * a loop's placementStart tracks the drag ONLY when the moved set contains the
 * cycle's ENTIRE source key list AND the loop's placementStart coincided with
 * the cycle's pre-move first key frame (an original loop). A duplicated loop
 * keeps its own placementStart and keeps resolving the same source keys by id.
 * Authorized source-cycle spacing additionally rebuilds finite lifecycle extent
 * from post-mapping timing, even when the anchored first source key does not move.
 * Returns the complete next collection, or null when no loop record changes.
 */
function computeSourceAttachedLoopPlacementFollow(
  identities: ValidatedIdentities,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  mapping: ReadonlyMap<string, number>,
  eligible: (clip: PhysicPaintRotoLoopClip) => boolean,
  retimeFiniteLifecycle = false,
): readonly PhysicPaintRotoLoopClip[] | null {
  if (loopClips.length === 0) return null;
  let changed = false;
  const next = loopClips.map((clip) => {
    if (!eligible(clip)) return clip;
    const firstKeyId = clip.sourceKeyIds[0];
    if (firstKeyId === undefined) return clip;

    const preMoveFrame = identities.framesByKeyId.get(firstKeyId);
    const postMoveFrame = mapping.get(firstKeyId);
    const placementFollowsSource = preMoveFrame !== undefined
      && clip.placementStart === preMoveFrame
      && postMoveFrame !== undefined
      && postMoveFrame !== preMoveFrame;
    const placementStart = placementFollowsSource ? postMoveFrame : clip.placementStart;

    const hasFiniteLifecycle = retimeFiniteLifecycle
      && typeof clip.repeat === 'number'
      && clip.phaseOrigin !== undefined
      && clip.originalEndExclusive !== undefined
      && clip.visibleRanges !== undefined;
    if (hasFiniteLifecycle) {
      const sourcePositions = clip.sourceKeyIds.map((keyId) => mapping.get(keyId));
      const validSourceTiming = sourcePositions.every((frame): frame is number => frame !== undefined)
        && sourcePositions.every((frame, index) => index === 0 || sourcePositions[index - 1]! < frame);
      if (validSourceTiming) {
        const cycleLength = sourcePositions[sourcePositions.length - 1]! - sourcePositions[0]! + 1;
        const originalEndExclusive = placementStart + cycleLength * clip.repeat;
        const lifecycleChanged = placementStart !== clip.placementStart
          || clip.phaseOrigin !== placementStart
          || clip.originalEndExclusive !== originalEndExclusive
          || clip.visibleRanges.length !== 1
          || clip.visibleRanges[0]?.start !== placementStart
          || clip.visibleRanges[0]?.endExclusive !== originalEndExclusive;
        if (lifecycleChanged) {
          changed = true;
          return Object.freeze({
            ...clip,
            placementStart,
            phaseOrigin: placementStart,
            originalEndExclusive,
            visibleRanges: Object.freeze([
              Object.freeze({ start: placementStart, endExclusive: originalEndExclusive }),
            ]),
          }) as PhysicPaintRotoLoopClip;
        }
      }
    }

    if (!placementFollowsSource) return clip;
    changed = true;
    return Object.freeze({ ...clip, placementStart }) as PhysicPaintRotoLoopClip;
  });
  return changed ? (Object.freeze(next) as readonly PhysicPaintRotoLoopClip[]) : null;
}

interface ValidatedIdentities {
  readonly ordered: readonly PhysicPaintRotoKeyIdentity[];
  readonly keyIds: ReadonlySet<string>;
  readonly framesByKeyId: ReadonlyMap<string, number>;
}

/**
 * Validate every input identity, uniqueness of IDs and frames, and frame range.
 * Returns the ordered-by-appFrame identities plus lookup maps on success, or
 * a stable failure code on any malformed, duplicate, or out-of-range member.
 * Never silently filters, sorts into validity, deduplicates, clamps, or
 * translates input.
 */
function validateIdentities(
  input: readonly unknown[],
  capacity: number,
  operationKind: PhysicPaintRotoPhysicalEditOperationKind | null,
): { ok: true; value: ValidatedIdentities } | { ok: false; resolution: PhysicPaintRotoPhysicalEditResolution } {
  if (!Array.isArray(input)) {
    return { ok: false, resolution: fail('malformed-identity', operationKind, 'Identities must be an array.') };
  }

  const records: PhysicPaintRotoKeyIdentity[] = [];
  const seenKeyIds = new Set<string>();
  const seenFrames = new Set<number>();
  const framesByKeyId = new Map<string, number>();

  for (const entry of input) {
    if (!isPhysicPaintRotoKeyIdentity(entry)) {
      return { ok: false, resolution: fail('malformed-identity', operationKind, 'Malformed physical identity.') };
    }
    if (seenKeyIds.has(entry.keyId)) {
      return { ok: false, resolution: fail('duplicate-id', operationKind, `Duplicate keyId "${entry.keyId}".`) };
    }
    if (seenFrames.has(entry.appFrame)) {
      return { ok: false, resolution: fail('duplicate-frame', operationKind, `Duplicate appFrame ${entry.appFrame}.`) };
    }
    if (entry.appFrame >= capacity) {
      return { ok: false, resolution: fail('out-of-range-frame', operationKind, `appFrame ${entry.appFrame} exceeds capacity ${capacity}.`) };
    }
    seenKeyIds.add(entry.keyId);
    seenFrames.add(entry.appFrame);
    framesByKeyId.set(entry.keyId, entry.appFrame);
    records.push({ keyId: entry.keyId, appFrame: entry.appFrame });
  }

  records.sort((a, b) => a.appFrame - b.appFrame);
  return {
    ok: true,
    value: { ordered: records, keyIds: seenKeyIds, framesByKeyId },
  };
}

// ---------------------------------------------------------------------------
// Operation candidate builders (private).
// ---------------------------------------------------------------------------

/** Shared frozen empty removed-identity set for every non-delete operation. */
const EMPTY_REMOVED_KEY_IDS = Object.freeze([]) as readonly string[];

interface Candidate {
  /** Final identity-to-frame mapping for this operation. */
  readonly mapping: Map<string, number>;
  /** Expected survivor identity set; the finalizer verifies set equality. */
  readonly expectedKeyIds: ReadonlySet<string>;
  /** Removed identity for Delete, null for every other operation. */
  readonly removedKeyId: string | null;
  /** Complete removed identity set; the sole removed identity for `delete-key`, the full group for `delete-key-group`, empty otherwise. */
  readonly removedKeyIds: readonly string[];
  /** Selected identity after the operation, or null when nothing remains. */
  readonly selectedKeyId: string | null;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  readonly changed: boolean;
  /** Per-identity role for change metadata. */
  readonly roleByKeyId: ReadonlyMap<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>;
  /** Drag presentation metadata for Move, null for every other operation. */
  readonly drag: PhysicPaintRotoPhysicalDragPresentation | null;
  readonly nextRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  readonly semanticDelta?: PhysicPaintRotoPhysicalEditSemanticDelta;
  /** Phase 43: complete next Loop Clip collection for rigid whole-cycle group drags; absent/null otherwise. */
  readonly nextLoopClips?: readonly PhysicPaintRotoLoopClip[] | null;
  /** Complete next incoming-break collection when ownership changes; absent otherwise. */
  readonly nextIncomingInterpolationBreakKeyIds?: readonly string[];
}

/**
 * One unified directional-push Rail: either a Key Rail segment (ordinary real
 * keys) or a derived Group range (Motion/Static Rail). The anchor Rail's
 * interval is the pivot for the directional cut (RESEARCH A3); empty physical
 * space belongs to neither side.
 */
interface PushRail {
  readonly kind: 'key-rail' | 'group';
  /** firstKeyId for a Key Rail, loopId for a Group Rail. */
  readonly id: string;
  readonly intervalStart: number;
  readonly intervalEndExclusive: number;
  /** Member keys (Key Rail) or source keys (Group). */
  readonly keyIds: readonly string[];
  /** Group-only: canonical source-cycle identity for the straddle guard (Task 2). */
  readonly sourceCycleId?: string;
  /** Group-only: canonical attachment test — first source key frame equals placementStart. */
  readonly attached?: boolean;
  /** Group-only: the persisted Loop Clip record. */
  readonly clip?: PhysicPaintRotoLoopClip;
}

/**
 * D-05 Insert: shift the selected identity and every later real key right by
 * exactly one physical slot; earlier keys retain their frames; no key ID or
 * payload is created. Rejects the whole proposal when any final frame is
 * outside capacity (caught by the finalizer). Selection remains the selected
 * identity at its final frame.
 */
function buildInsertCandidate(
  identities: ValidatedIdentities,
  selectedKeyId: string,
): Candidate {
  const selectedFrame = identities.framesByKeyId.get(selectedKeyId);
  // Caller has already validated that selectedKeyId exists.
  const mapping = new Map<string, number>();
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();

  for (const identity of identities.ordered) {
    if (identity.appFrame >= (selectedFrame as number)) {
      const next = identity.appFrame + 1;
      mapping.set(identity.keyId, next);
      roleByKeyId.set(
        identity.keyId,
        identity.keyId === selectedKeyId ? 'moved' : 'ripple-right',
      );
    } else {
      mapping.set(identity.keyId, identity.appFrame);
    }
  }

  return {
    mapping,
    expectedKeyIds: identities.keyIds,
    removedKeyId: null,
    removedKeyIds: EMPTY_REMOVED_KEY_IDS,
    selectedKeyId,
    operationKind: 'insert-slot',
    changed: true,
    roleByKeyId,
    drag: null,
  };
}

/**
 * D-06 Delete: remove the requested identity, shift every later survivor left
 * by exactly one physical slot, and retain every earlier survivor. Select the
 * original successor when present, otherwise the previous survivor, otherwise
 * null. A deleted identity never appears in the complete map, ordered output,
 * cells, changes, or selection.
 */
function buildInsertEmptySegmentCandidate(
  identities: ValidatedIdentities,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  intent: Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'insert-empty-segment' }>,
  incomingInterpolationBreakKeyIds: readonly string[],
): Candidate {
  const inserted = Object.freeze({
    kind: 'real-key' as const,
    keyId: intent.insertedKeyId,
    appFrame: intent.destinationAppFrame,
    payload: clonePayloadAtFrame(intent.blankPayload, intent.destinationAppFrame),
  }) as PhysicPaintRotoRealKeyRecord;
  const nextRecords = [...records, inserted].sort((left, right) => left.appFrame - right.appFrame);
  const expectedKeyIds = new Set(identities.keyIds);
  expectedKeyIds.add(intent.insertedKeyId);
  return {
    mapping: new Map(nextRecords.map((record) => [record.keyId, record.appFrame])),
    expectedKeyIds,
    removedKeyId: null,
    removedKeyIds: EMPTY_REMOVED_KEY_IDS,
    selectedKeyId: intent.insertedKeyId,
    operationKind: 'insert-empty-segment',
    changed: true,
    roleByKeyId: new Map(),
    drag: null,
    nextRecords: Object.freeze(nextRecords),
    // Quick 260816-tv7: Insert always connects — the inserted key joins the
    // nearest left segment and adds no incoming break, so the collection is
    // passed through unchanged and any existing break on the right segment
    // survives.
    nextIncomingInterpolationBreakKeyIds: Object.freeze([...incomingInterpolationBreakKeyIds]),
    semanticDelta: Object.freeze({
      kind: 'insert-empty-segment',
      insertedKeyId: intent.insertedKeyId,
      destinationAppFrame: intent.destinationAppFrame,
    }),
  };
}

function buildDeleteCandidate(
  identities: ValidatedIdentities,
  selectedKeyId: string,
  loopReferencedKeyIds?: ReadonlySet<string>,
): Candidate {
  const selectedFrame = identities.framesByKeyId.get(selectedKeyId) as number;
  // 43.2 ordinary-delete ownership guard: when ANY surviving key after the
  // removed slot is Group-referenced, the left ripple is suppressed entirely —
  // every survivor keeps its absolute physical position and the removed slot
  // stays empty. Compacting Group-owned source keys against their unchanged
  // lifecycle records (placementStart/phaseOrigin/extent) corrupts the Group.
  const suppressRipple = loopReferencedKeyIds !== undefined
    && identities.ordered.some((identity) => (
      identity.appFrame > selectedFrame && loopReferencedKeyIds.has(identity.keyId)
    ));
  const mapping = new Map<string, number>();
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  const expectedKeyIds = new Set<string>();
  let successorKeyId: string | null = null;
  let previousKeyId: string | null = null;

  for (const identity of identities.ordered) {
    if (identity.keyId === selectedKeyId) continue;
    expectedKeyIds.add(identity.keyId);
    if (identity.appFrame > selectedFrame && !suppressRipple) {
      mapping.set(identity.keyId, identity.appFrame - 1);
      roleByKeyId.set(identity.keyId, 'ripple-left');
    } else {
      mapping.set(identity.keyId, identity.appFrame);
    }
    if (identity.appFrame > selectedFrame && successorKeyId === null) {
      // Track the smallest-frame survivor strictly after the removed slot.
      successorKeyId = identity.keyId;
    }
    if (identity.appFrame < selectedFrame) {
      previousKeyId = identity.keyId;
    }
  }

  const nextSelected = successorKeyId ?? previousKeyId;

  return {
    mapping,
    expectedKeyIds,
    removedKeyId: selectedKeyId,
    removedKeyIds: Object.freeze([selectedKeyId]) as readonly string[],
    selectedKeyId: nextSelected,
    operationKind: 'delete-key',
    changed: true,
    roleByKeyId,
    drag: null,
  };
}

/**
 * Phase 37 D-13..D-15 group Delete: remove every selected identity in one
 * atomic operation, shift each unselected survivor left by the count of
 * removed keys whose original frame is below its frame (GDel-1: D@10 - 2 →
 * D@8), and preserve every unselected identity at its rippled frame.
 *
 * Survivor selection (D-14): the smallest-frame unselected key with original
 * frame strictly greater than the group's last position becomes selected;
 * when the group was at the end, fall back to the largest-frame unselected
 * key below the group's first position; when nothing remains, the selection
 * is null (GDel-2 delete-to-empty, cursor returns to the launch frame).
 */
function buildDeleteGroupCandidate(
  identities: ValidatedIdentities,
  keyIds: readonly string[],
  loopReferencedKeyIds?: ReadonlySet<string>,
): Candidate {
  const removalSet = new Set(keyIds);
  let minRemovedFrame = Number.POSITIVE_INFINITY;
  let maxRemovedFrame = Number.NEGATIVE_INFINITY;
  const removedFramesAsc: number[] = [];
  for (const identity of identities.ordered) {
    if (!removalSet.has(identity.keyId)) continue;
    removedFramesAsc.push(identity.appFrame);
    if (identity.appFrame < minRemovedFrame) minRemovedFrame = identity.appFrame;
    if (identity.appFrame > maxRemovedFrame) maxRemovedFrame = identity.appFrame;
  }

  // 43.2 ownership guard (same rule as delete-key): when ANY surviving key
  // after the removed group's last position is Group-referenced, the left
  // ripple is suppressed entirely so Group-owned source keys keep absolute
  // physical positions against their unchanged lifecycle records.
  const suppressRipple = loopReferencedKeyIds !== undefined
    && identities.ordered.some((identity) => (
      !removalSet.has(identity.keyId)
      && identity.appFrame > maxRemovedFrame
      && loopReferencedKeyIds.has(identity.keyId)
    ));
  const mapping = new Map<string, number>();
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  const expectedKeyIds = new Set<string>();
  let successorKeyId: string | null = null;
  let previousKeyId: string | null = null;

  for (const identity of identities.ordered) {
    if (removalSet.has(identity.keyId)) continue;
    expectedKeyIds.add(identity.keyId);
    let shift = 0;
    if (!suppressRipple) {
      for (const removedFrame of removedFramesAsc) {
        if (removedFrame < identity.appFrame) shift += 1;
      }
    }
    mapping.set(identity.keyId, identity.appFrame - shift);
    if (shift > 0) roleByKeyId.set(identity.keyId, 'ripple-left');
    if (successorKeyId === null && identity.appFrame > maxRemovedFrame) {
      // Track the smallest-frame survivor strictly after the group's last position.
      successorKeyId = identity.keyId;
    }
    if (identity.appFrame < minRemovedFrame) {
      previousKeyId = identity.keyId;
    }
  }

  const nextSelected = successorKeyId ?? previousKeyId;

  return {
    mapping,
    expectedKeyIds,
    removedKeyId: null,
    removedKeyIds: Object.freeze([...keyIds]) as readonly string[],
    selectedKeyId: nextSelected,
    operationKind: 'delete-key-group',
    changed: true,
    roleByKeyId,
    drag: null,
  };
}

function buildDuplicateCandidate(
  identities: ValidatedIdentities,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  sourceKeyId: string,
  newKeyId: string,
): Candidate {
  const source = records.find((record) => record.keyId === sourceKeyId) as PhysicPaintRotoRealKeyRecord;
  const destination = source.appFrame + 1;
  const nextRecords = records.map((record) => {
    const nextFrame = record.appFrame >= destination ? record.appFrame + 1 : record.appFrame;
    return Object.freeze({
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: nextFrame,
      payload: clonePayloadAtFrame(record.payload, nextFrame),
    }) as PhysicPaintRotoRealKeyRecord;
  });
  nextRecords.push(Object.freeze({
    kind: 'real-key',
    keyId: newKeyId,
    appFrame: destination,
    payload: clonePayloadAtFrame(source.payload, destination),
  }) as PhysicPaintRotoRealKeyRecord);
  nextRecords.sort((left, right) => left.appFrame - right.appFrame);
  const mapping = new Map(nextRecords.map((record) => [record.keyId, record.appFrame]));
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  for (const identity of identities.ordered) {
    if (identity.appFrame >= destination) roleByKeyId.set(identity.keyId, 'ripple-right');
  }
  const expectedKeyIds = new Set(identities.keyIds);
  expectedKeyIds.add(newKeyId);
  return {
    mapping,
    expectedKeyIds,
    removedKeyId: null,
    removedKeyIds: EMPTY_REMOVED_KEY_IDS,
    selectedKeyId: newKeyId,
    operationKind: 'duplicate-key',
    changed: true,
    roleByKeyId,
    drag: null,
    nextRecords: Object.freeze(nextRecords),
    semanticDelta: Object.freeze({ kind: 'duplicate-key', sourceKeyId, newKeyId }),
  };
}

function buildPasteCandidate(
  identities: ValidatedIdentities,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  intent: Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key' }>,
  incomingInterpolationBreakKeyIds: readonly string[],
): Candidate {
  const selectedKeyId = intent.destinationKeyId ?? (intent.newKeyId as string);
  const nextRecords = records.map((record) => {
    if (record.keyId !== intent.destinationKeyId) return record;
    return Object.freeze({
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: clonePayloadAtFrame(intent.clipboardPayload, record.appFrame),
    }) as PhysicPaintRotoRealKeyRecord;
  });
  if (intent.destinationKeyId === null) {
    nextRecords.push(Object.freeze({
      kind: 'real-key',
      keyId: intent.newKeyId as string,
      appFrame: intent.destinationAppFrame,
      payload: clonePayloadAtFrame(intent.clipboardPayload, intent.destinationAppFrame),
    }) as PhysicPaintRotoRealKeyRecord);
  }
  nextRecords.sort((left, right) => left.appFrame - right.appFrame);
  const mapping = new Map(nextRecords.map((record) => [record.keyId, record.appFrame]));
  const expectedKeyIds = new Set(identities.keyIds);
  if (intent.newKeyId !== null) expectedKeyIds.add(intent.newKeyId);
  const destinationRecord = intent.destinationKeyId === null
    ? null
    : records.find((record) => record.keyId === intent.destinationKeyId) ?? null;
  const changed = destinationRecord === null
    || !payloadEqualsAtFrame(destinationRecord.payload, intent.clipboardPayload, destinationRecord.appFrame);
  return {
    mapping,
    expectedKeyIds,
    removedKeyId: null,
    removedKeyIds: EMPTY_REMOVED_KEY_IDS,
    selectedKeyId,
    operationKind: 'paste-key',
    changed,
    roleByKeyId: new Map(),
    drag: null,
    nextRecords: Object.freeze(nextRecords),
    // Quick 260816-tv7: paste-to-empty with startsNewSegment (Paint-on-empty /
    // + Key) makes the new key own a persistent incoming interpolation break,
    // starting a new segment and its own Key Rail. Ordinary Copy/Paste leaves
    // the collection unset so the pasted key stays connected.
    ...(intent.startsNewSegment === true && intent.destinationKeyId === null
      ? { nextIncomingInterpolationBreakKeyIds: Object.freeze([...incomingInterpolationBreakKeyIds, intent.newKeyId as string]) }
      : {}),
    semanticDelta: Object.freeze({
      kind: 'paste-key',
      destinationAppFrame: intent.destinationAppFrame,
      destinationKeyId: intent.destinationKeyId,
      newKeyId: intent.newKeyId,
      clipboardPayload: clonePayloadAtFrame(intent.clipboardPayload, intent.clipboardPayload.appFrame),
    }),
  };
}

// ---------------------------------------------------------------------------
// Phase 38 group paste (paste-key-group) candidate builder. The earliest copied
// key anchors the group at the requested destination; every other entry lands
// at destination + (sourceAppFrame - anchor) with exact frames and zero ripple
// of existing keys (D-04/D-06). All-empty-or-reject (D-05): any occupied or
// mutually colliding computed destination rejects the whole proposal through
// the existing failure codes; the group candidate NEVER replaces or ripples an
// existing record. Fresh keyIds arrive pre-allocated from the frozen intent.
// ---------------------------------------------------------------------------

type PasteKeyGroupBuilderResult =
  | { readonly ok: true; readonly candidate: Candidate }
  | { readonly ok: false; readonly resolution: PhysicPaintRotoPhysicalEditResolution };

function buildPasteKeyGroupCandidate(
  identities: ValidatedIdentities,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  intent: Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key-group' }>,
  capacity: number,
): PasteKeyGroupBuilderResult {
  const anchorSourceAppFrame = Math.min(...intent.entries.map((entry) => entry.sourceAppFrame));
  const destinations = intent.entries.map((entry) => intent.destinationAppFrame + (entry.sourceAppFrame - anchorSourceAppFrame));
  for (const destination of destinations) {
    if (destination < 0 || destination >= capacity) {
      return {
        ok: false,
        resolution: fail('out-of-range-frame', 'paste-key-group', `Group paste destination frame ${destination} is outside capacity ${capacity}.`),
      };
    }
  }
  if (records.length + intent.entries.length > capacity) {
    return {
      ok: false,
      resolution: fail('over-capacity', 'paste-key-group', `Group paste would exceed capacity ${capacity}.`),
    };
  }
  const occupiedFrames = new Set(records.map((record) => record.appFrame));
  const seenDestinations = new Set<number>();
  const conflictingAppFrames: number[] = [];
  for (const destination of destinations) {
    if (occupiedFrames.has(destination) || seenDestinations.has(destination)) {
      conflictingAppFrames.push(destination);
    }
    seenDestinations.add(destination);
  }
  if (conflictingAppFrames.length > 0) {
    return {
      ok: false,
      resolution: fail('duplicate-destination-frame', 'paste-key-group', 'Group paste destination is occupied.', conflictingAppFrames),
    };
  }
  const anchorEntry = intent.entries.find((entry) => entry.sourceAppFrame === anchorSourceAppFrame) as (typeof intent.entries)[number];
  const nextRecords: PhysicPaintRotoRealKeyRecord[] = [...records];
  for (let index = 0; index < intent.entries.length; index += 1) {
    const entry = intent.entries[index];
    const destination = destinations[index];
    nextRecords.push(Object.freeze({
      kind: 'real-key',
      keyId: entry.newKeyId,
      appFrame: destination,
      payload: clonePayloadAtFrame(entry.payload, destination),
    }) as PhysicPaintRotoRealKeyRecord);
  }
  nextRecords.sort((left, right) => left.appFrame - right.appFrame);
  const mapping = new Map(nextRecords.map((record) => [record.keyId, record.appFrame]));
  const expectedKeyIds = new Set(identities.keyIds);
  for (const entry of intent.entries) expectedKeyIds.add(entry.newKeyId);
  return {
    ok: true,
    candidate: {
      mapping,
      expectedKeyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: anchorEntry.newKeyId,
      operationKind: 'paste-key-group',
      changed: true,
      roleByKeyId: new Map(),
      drag: null,
      nextRecords: Object.freeze(nextRecords),
      semanticDelta: Object.freeze({
        kind: 'paste-key-group',
        destinationAppFrame: intent.destinationAppFrame,
        entries: intent.entries,
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// D-07/D-29 Drag (move-key) candidate builder. Direct physical cells retain
// source-closing cut-and-insert behavior. Occupied identity boundaries remove
// only the moved identity, preserve every survivor's original frame, resolve
// the stable target in that remaining map, and ripple only at the destination
// before reinserting the moved identity. Neither path overwrites a real key.
// ---------------------------------------------------------------------------

type MoveBuilderResult =
  | { readonly ok: true; readonly candidate: Candidate }
  | { readonly ok: false; readonly resolution: PhysicPaintRotoPhysicalEditResolution };

function buildMoveCandidate(
  identities: ValidatedIdentities,
  movedKeyId: string,
  target: PhysicPaintRotoPhysicalEditTarget,
  capacity: number,
): MoveBuilderResult {
  const movedFrame = identities.framesByKeyId.get(movedKeyId) as number;

  if (target.kind === 'physical-cell') {
    if (!isNonNegativeInteger(target.appFrame) || target.appFrame >= capacity) {
      return {
        ok: false,
        resolution: fail('out-of-range-frame', 'move-key', `Direct target frame ${target.appFrame} is outside capacity ${capacity}.`),
      };
    }

    // Moved key's own current physical cell: valid immutable no-change.
    if (target.appFrame === movedFrame) {
      return { ok: true, candidate: buildMoveNoChangeCandidate(identities, movedKeyId, movedFrame, target) };
    }

    // A direct cell occupied in the original input by another real key is
    // invalid: occupied keys require an identity boundary, never an overwrite.
    for (const identity of identities.ordered) {
      if (identity.keyId !== movedKeyId && identity.appFrame === target.appFrame) {
        return {
          ok: false,
          resolution: fail('malformed-target', 'move-key', `Direct cell frame ${target.appFrame} is occupied by another real key; use before-key or after-key.`),
        };
      }
    }

    return { ok: true, candidate: cutAndInsert(identities, movedKeyId, movedFrame, target.appFrame, target) };
  }

  if (target.kind === 'before-key' || target.kind === 'after-key') {
    if (!isBoundedKeyId(target.targetKeyId)) {
      return {
        ok: false,
        resolution: fail('malformed-target', 'move-key', 'Drag target keyId must be a bounded non-empty string.'),
      };
    }
    if (!identities.keyIds.has(target.targetKeyId)) {
      return {
        ok: false,
        resolution: fail('unknown-target-identity', 'move-key', `Drag target identity "${target.targetKeyId}" does not exist.`),
      };
    }
    if (target.targetKeyId === movedKeyId) {
      return {
        ok: false,
        resolution: fail('moved-as-target', 'move-key', 'Moved identity cannot be its own before/after boundary; the boundary disappears during cut.'),
      };
    }

    // D-29 occupied boundary: remove only the moved identity. Every survivor
    // retains its direct physical frame, so the source slot remains open.
    const remaining = removeMovedIdentityWithoutClosingSource(identities, movedKeyId);
    // Resolve the destination by stable identity against the unchanged survivors.
    const targetFrame = remaining.get(target.targetKeyId) as number;
    const insertionFrame = target.kind === 'before-key' ? targetFrame : targetFrame + 1;
    if (insertionFrame >= capacity) {
      return {
        ok: false,
        resolution: fail('over-capacity', 'move-key', `Resolved insertion frame ${insertionFrame} is outside capacity ${capacity}.`),
      };
    }
    return { ok: true, candidate: openAndInsert(identities, remaining, movedKeyId, insertionFrame, target) };
  }

  return {
    ok: false,
    resolution: fail('malformed-target', 'move-key', 'Unknown drag target kind.'),
  };
}

/**
 * Build the no-change candidate for a Drag back to the moved identity's own
 * current physical cell. The complete mapping equals the input mapping; the
 * drag presentation still records the original target and resolved frame.
 */
function buildMoveNoChangeCandidate(
  identities: ValidatedIdentities,
  movedKeyId: string,
  movedFrame: number,
  target: PhysicPaintRotoPhysicalEditTarget,
): Candidate {
  const mapping = new Map<string, number>();
  for (const identity of identities.ordered) {
    mapping.set(identity.keyId, identity.appFrame);
  }
  return {
    mapping,
    expectedKeyIds: identities.keyIds,
    removedKeyId: null,
    removedKeyIds: EMPTY_REMOVED_KEY_IDS,
    selectedKeyId: movedKeyId,
    operationKind: 'move-key',
    changed: false,
    roleByKeyId: new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>(),
    drag: Object.freeze({
      targetKind: target.kind,
      targetKeyId: target.kind === 'physical-cell' ? null : target.targetKeyId,
      resolvedInsertionAppFrame: movedFrame,
      movedKeyId,
      movedKeyIds: Object.freeze([movedKeyId]) as readonly string[],
      grabbedKeyId: movedKeyId,
    }) as PhysicPaintRotoPhysicalDragPresentation,
  };
}

/**
 * D-29 occupied-boundary removal: exclude only the moved identity while
 * preserving every survivor's original direct physical frame. The destination
 * opener may then ripple at or after the resolved occupied boundary.
 */
function removeMovedIdentityWithoutClosingSource(
  identities: ValidatedIdentities,
  movedKeyId: string,
): Map<string, number> {
  const remaining = new Map<string, number>();
  for (const identity of identities.ordered) {
    if (identity.keyId === movedKeyId) continue;
    remaining.set(identity.keyId, identity.appFrame);
  }
  return remaining;
}

/**
 * Cut the moved identity and close its source slot by shifting every
 * remaining key originally after the moved frame left by exactly one slot.
 * Returns the post-cut identity-to-frame map for direct physical-cell Drag.
 */
function cutSource(
  identities: ValidatedIdentities,
  movedKeyId: string,
  movedFrame: number,
): Map<string, number> {
  const postCut = new Map<string, number>();
  for (const identity of identities.ordered) {
    if (identity.keyId === movedKeyId) continue;
    if (identity.appFrame > movedFrame) {
      postCut.set(identity.keyId, identity.appFrame - 1);
    } else {
      postCut.set(identity.keyId, identity.appFrame);
    }
  }
  return postCut;
}

/**
 * Open the destination slot by shifting every remaining identity at or after
 * the insertion frame right by exactly one, then reinsert the moved identity
 * at the insertion frame. Computes deterministic roles for change metadata:
 * the moved identity is `moved`; other identities whose frame increased are
 * `ripple-right`; those whose frame decreased are `ripple-left`.
 */
function openAndInsert(
  identities: ValidatedIdentities,
  remaining: Map<string, number>,
  movedKeyId: string,
  insertionFrame: number,
  target: PhysicPaintRotoPhysicalEditTarget,
): Candidate {
  const mapping = new Map<string, number>();
  for (const [keyId, frame] of remaining) {
    mapping.set(keyId, frame >= insertionFrame ? frame + 1 : frame);
  }
  mapping.set(movedKeyId, insertionFrame);

  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  for (const identity of identities.ordered) {
    if (identity.keyId === movedKeyId) {
      roleByKeyId.set(movedKeyId, 'moved');
      continue;
    }
    const before = identity.appFrame;
    const after = mapping.get(identity.keyId) as number;
    if (after > before) roleByKeyId.set(identity.keyId, 'ripple-right');
    else if (after < before) roleByKeyId.set(identity.keyId, 'ripple-left');
  }

  return {
    mapping,
    expectedKeyIds: identities.keyIds,
    removedKeyId: null,
    removedKeyIds: EMPTY_REMOVED_KEY_IDS,
    selectedKeyId: movedKeyId,
    operationKind: 'move-key',
    changed: computeChanged(identities, mapping),
    roleByKeyId,
    drag: Object.freeze({
      targetKind: target.kind,
      targetKeyId: target.kind === 'physical-cell' ? null : target.targetKeyId,
      resolvedInsertionAppFrame: insertionFrame,
      movedKeyId,
      movedKeyIds: Object.freeze([movedKeyId]) as readonly string[],
      grabbedKeyId: movedKeyId,
    }) as PhysicPaintRotoPhysicalDragPresentation,
  };
}

/**
 * Direct-cell variant: cut, then open the requested final frame. Closing the
 * source may cause a survivor to occupy the requested final cell; opening that
 * exact final cell shifts the survivor and preserves the destination.
 */
function cutAndInsert(
  identities: ValidatedIdentities,
  movedKeyId: string,
  movedFrame: number,
  insertionFrame: number,
  target: PhysicPaintRotoPhysicalEditTarget,
): Candidate {
  const postCut = cutSource(identities, movedKeyId, movedFrame);
  return openAndInsert(identities, postCut, movedKeyId, insertionFrame, target);
}

// ---------------------------------------------------------------------------
// Group Drag is one rigid physical-frame translation. The grabbed key anchors
// the delta; selected offsets stay fixed and unselected identities never move.
// ---------------------------------------------------------------------------

function buildMoveGroupCandidate(
  identities: ValidatedIdentities,
  movedKeyIds: readonly string[],
  grabbedKeyId: string,
  target: PhysicPaintRotoPhysicalEditTarget,
  capacity: number,
  loopClips: readonly PhysicPaintRotoLoopClip[],
): MoveBuilderResult {
  const movedSet = new Set(movedKeyIds);
  const grabbedOriginalFrame = identities.framesByKeyId.get(grabbedKeyId) as number;
  const movedKeyIdsFrozen = Object.freeze([...movedKeyIds]) as readonly string[];
  let resolvedTargetAppFrame: number;
  let targetKeyId: string | null = null;

  if (target.kind === 'physical-cell') {
    if (!isNonNegativeInteger(target.appFrame) || target.appFrame >= capacity) {
      return {
        ok: false,
        resolution: fail('out-of-range-frame', 'move-key-group', `Direct target frame ${target.appFrame} is outside capacity ${capacity}.`),
      };
    }
    resolvedTargetAppFrame = target.appFrame;
  } else if (target.kind === 'before-key' || target.kind === 'after-key') {
    if (!isBoundedKeyId(target.targetKeyId)) {
      return {
        ok: false,
        resolution: fail('malformed-target', 'move-key-group', 'Drag target keyId must be a bounded non-empty string.'),
      };
    }
    if (!identities.keyIds.has(target.targetKeyId)) {
      return {
        ok: false,
        resolution: fail('unknown-target-identity', 'move-key-group', `Drag target identity "${target.targetKeyId}" does not exist.`),
      };
    }
    if (movedSet.has(target.targetKeyId)) {
      return {
        ok: false,
        resolution: fail('moved-as-target', 'move-key-group', 'A selected identity cannot be its own group before/after boundary.'),
      };
    }
    targetKeyId = target.targetKeyId;
    const targetFrame = identities.framesByKeyId.get(target.targetKeyId) as number;
    resolvedTargetAppFrame = target.kind === 'before-key' ? targetFrame - 1 : targetFrame + 1;
  } else {
    return {
      ok: false,
      resolution: fail('malformed-target', 'move-key-group', 'Unknown drag target kind.'),
    };
  }

  const delta = resolvedTargetAppFrame - grabbedOriginalFrame;
  const mapping = new Map<string, number>();
  const unselectedFrames = new Set<number>();
  for (const identity of identities.ordered) {
    mapping.set(identity.keyId, identity.appFrame);
    if (!movedSet.has(identity.keyId)) unselectedFrames.add(identity.appFrame);
  }

  const destinations = new Map<string, number>();
  const conflictingAppFrames = new Set<number>();
  for (const identity of identities.ordered) {
    if (!movedSet.has(identity.keyId)) continue;
    const destination = identity.appFrame + delta;
    if (destination < 0 || destination >= capacity) {
      return {
        ok: false,
        resolution: fail('over-capacity', 'move-key-group', `Selected destination frame ${destination} is outside capacity ${capacity}.`),
      };
    }
    destinations.set(identity.keyId, destination);
    if (unselectedFrames.has(destination)) conflictingAppFrames.add(destination);
  }

  if (conflictingAppFrames.size > 0) {
    const conflicts = [...conflictingAppFrames];
    return {
      ok: false,
      resolution: fail(
        'duplicate-destination-frame',
        'move-key-group',
        `Selected destination frame ${conflicts[0]} is occupied by an unselected real key.`,
        conflicts,
      ),
    };
  }

  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  for (const [keyId, destination] of destinations) {
    mapping.set(keyId, destination);
    if (destination !== identities.framesByKeyId.get(keyId)) roleByKeyId.set(keyId, 'moved');
  }

  return {
    ok: true,
    candidate: {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: grabbedKeyId,
      operationKind: 'move-key-group',
      changed: computeChanged(identities, mapping),
      roleByKeyId,
      drag: Object.freeze({
        targetKind: target.kind,
        targetKeyId,
        resolvedInsertionAppFrame: resolvedTargetAppFrame,
        movedKeyId: grabbedKeyId,
        movedKeyIds: movedKeyIdsFrozen,
        grabbedKeyId,
      }) as PhysicPaintRotoPhysicalDragPresentation,
      // D-04: original loops follow a rigid whole-cycle drag; duplicated loops
      // keep their own placementStart (placement/source correction).
      nextLoopClips: computeSourceAttachedLoopPlacementFollow(
        identities,
        loopClips,
        mapping,
        (clip) => clip.sourceKeyIds.every((keyId) => movedSet.has(keyId)),
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Group Rail Drag (move-group) is one rigid physical-frame translation of a
// whole Loop Clip's source cycle. The delta is derived from the requested
// destination placement start minus the clip's current placement start; every
// source key and every durable lifecycle field (phaseOrigin,
// originalEndExclusive, every visibleRanges entry, every frameOverrides
// appFrame) translates by the same signed delta with relative offsets preserved
// verbatim (D-13). The single-range visibleRanges rebuild owned by Key Spacing
// retime (computeSourceAttachedLoopPlacementFollow) is deliberately NOT copied
// (Pitfall 6).
// ---------------------------------------------------------------------------

function buildMoveGroupNextLoopClips(
  loopClips: readonly PhysicPaintRotoLoopClip[],
  movedClip: PhysicPaintRotoLoopClip,
  delta: number,
  acceptedEffectiveEnd?: number,
): readonly PhysicPaintRotoLoopClip[] | null {
  if (loopClips.length === 0 || delta === 0) return null;
  let changed = false;
  const next = loopClips.map((clip) => {
    if (clip.loopId !== movedClip.loopId) return clip;
    const phaseOrigin = typeof clip.phaseOrigin === 'number' ? clip.phaseOrigin + delta : undefined;
    const pinsInfinityLifecycleEnd = clip.repeat === 'infinity'
      && acceptedEffectiveEnd !== undefined
      && clip.originalEndExclusive !== undefined
      && clip.visibleRanges !== undefined;
    const originalEndExclusive = typeof clip.originalEndExclusive === 'number'
      ? (pinsInfinityLifecycleEnd ? acceptedEffectiveEnd : clip.originalEndExclusive + delta)
      : undefined;
    let visibleRanges = clip.visibleRanges === undefined
      ? undefined
      : clip.visibleRanges.map((range) => (
          { start: range.start + delta, endExclusive: range.endExclusive + delta }
        ));
    if (pinsInfinityLifecycleEnd && visibleRanges !== undefined) {
      const translatedOriginalEndExclusive = clip.originalEndExclusive! + delta;
      visibleRanges = visibleRanges
        .map((range) => ({ ...range, endExclusive: Math.min(range.endExclusive, acceptedEffectiveEnd) }))
        .filter((range) => range.start < range.endExclusive);
      if (translatedOriginalEndExclusive < acceptedEffectiveEnd) {
        const lastIndex = visibleRanges.length - 1;
        const lastRange = visibleRanges[lastIndex];
        if (lastRange?.endExclusive === translatedOriginalEndExclusive) {
          visibleRanges[lastIndex] = { ...lastRange, endExclusive: acceptedEffectiveEnd };
        } else {
          visibleRanges.push({
            start: translatedOriginalEndExclusive,
            endExclusive: acceptedEffectiveEnd,
          });
        }
      }
    }
    const frozenVisibleRanges = visibleRanges === undefined
      ? undefined
      : Object.freeze(visibleRanges.map((range) => Object.freeze(range)));
    const frameOverrides = clip.frameOverrides === undefined
      ? undefined
      : Object.freeze(clip.frameOverrides.map((override) => (
          Object.freeze({ appFrame: override.appFrame + delta, keyId: override.keyId })
        )));
    changed = true;
    return Object.freeze({
      ...clip,
      placementStart: movedClip.placementStart + delta,
      ...(phaseOrigin !== undefined ? { phaseOrigin } : {}),
      ...(originalEndExclusive !== undefined ? { originalEndExclusive } : {}),
      ...(frozenVisibleRanges !== undefined ? { visibleRanges: frozenVisibleRanges } : {}),
      ...(frameOverrides !== undefined ? { frameOverrides } : {}),
    }) as PhysicPaintRotoLoopClip;
  });
  return changed ? (Object.freeze(next) as readonly PhysicPaintRotoLoopClip[]) : null;
}

function buildMoveGroupClipCandidate(
  identities: ValidatedIdentities,
  clip: PhysicPaintRotoLoopClip,
  destinationPlacementStart: number,
  capacity: number,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  acceptedEffectiveEnd: number,
): MoveBuilderResult {
  const movedKeyIds = clip.sourceKeyIds;
  const movedSet = new Set(movedKeyIds);
  const delta = destinationPlacementStart - clip.placementStart;
  const mapping = new Map<string, number>();
  const unselectedFrames = new Set<number>();
  for (const identity of identities.ordered) {
    mapping.set(identity.keyId, identity.appFrame);
    if (!movedSet.has(identity.keyId)) unselectedFrames.add(identity.appFrame);
  }

  const destinations = new Map<string, number>();
  const conflictingAppFrames = new Set<number>();
  for (const identity of identities.ordered) {
    if (!movedSet.has(identity.keyId)) continue;
    const destination = identity.appFrame + delta;
    if (destination < 0 || destination >= capacity) {
      return {
        ok: false,
        resolution: fail('over-capacity', 'move-group', `Selected destination frame ${destination} is outside capacity ${capacity}.`),
      };
    }
    destinations.set(identity.keyId, destination);
    if (unselectedFrames.has(destination)) conflictingAppFrames.add(destination);
  }

  if (conflictingAppFrames.size > 0) {
    const conflicts = [...conflictingAppFrames];
    return {
      ok: false,
      resolution: fail(
        'duplicate-destination-frame',
        'move-group',
        `Selected destination frame ${conflicts[0]} is occupied by an unselected real key.`,
        conflicts,
      ),
    };
  }

  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  for (const [keyId, destination] of destinations) {
    mapping.set(keyId, destination);
    if (destination !== identities.framesByKeyId.get(keyId)) roleByKeyId.set(keyId, 'moved');
  }

  return {
    ok: true,
    candidate: {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: null,
      operationKind: 'move-group',
      changed: computeChanged(identities, mapping),
      roleByKeyId,
      drag: null,
      nextLoopClips: buildMoveGroupNextLoopClips(loopClips, clip, delta, acceptedEffectiveEnd),
    },
  };
}

/**
 * Pure clamp authority for Group Rail drag destinations (D-05, D-08, RESEARCH
 * Open Question 2). The dragged Group's interval at the proposed placement must
 * overlap none of the D-08 collision boundaries: frame 0, physical
 * capacity/parent end, every unowned real key outside the Group's own current
 * interval, and every other Group's derived interval (including linked
 * occurrences). The moved Group's own current interval is pass-through space —
 * a drag crossing its original span is never blocked by it. Returns the nearest
 * free placement in the drag direction (never moving backward past the current
 * placement), or `ok: false` when zero valid movement exists in that direction
 * (the branch surfaces the dedicated `no-free-space-in-direction` code). One
 * exported authority, consumed by the resolver branch and (plan 03) the ghost
 * preview so preview-is-the-commit holds (D-05).
 */
export interface PhysicPaintRotoGroupDragClampInput {
  /** The dragged Loop Clip (`repeat: 'infinity'` pins the interval right edge). */
  readonly clip: PhysicPaintRotoLoopClip;
  /**
   * The dragged Group's current derived interval — phaseOrigin to resolved
   * effectiveEnd from `derivePhysicPaintRotoLoopRanges` (the same projection
   * the rail draws). Infinity Groups use the resolved effectiveEnd so rightward
   * drags legitimately shrink derived occurrences (Pitfall 7, D-19).
   */
  readonly draggedInterval: { readonly phaseOrigin: number; readonly effectiveEnd: number };
  readonly proposedDestinationPlacementStart: number;
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  /** Complete derived Loop Clip ranges (each other Group's full effective interval). */
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly capacity: number;
}

export type PhysicPaintRotoGroupDragClampResult =
  | { readonly ok: true; readonly destinationPlacementStart: number }
  | { readonly ok: false };

export function clampPhysicPaintGroupDragDestination(
  input: PhysicPaintRotoGroupDragClampInput,
): PhysicPaintRotoGroupDragClampResult {
  const {
    clip,
    draggedInterval,
    proposedDestinationPlacementStart: proposed,
    identities,
    loopRanges,
    capacity,
  } = input;
  const current = clip.placementStart;
  const span = Math.max(0, draggedInterval.effectiveEnd - draggedInterval.phaseOrigin);
  const infinity = clip.repeat === 'infinity';

  const ownedKeyIds = new Set<string>([
    ...clip.sourceKeyIds,
    ...(clip.frameOverrides ?? []).map((override) => override.keyId),
  ]);
  const frameByKeyId = new Map(identities.map((identity) => [identity.keyId, identity.appFrame] as const));
  // Attachment is derived from canonical facts only (Pitfall 4): a placement
  // that coincides with its first source key frame is source-attached, so its
  // keys move with the drag and must land free. A duplicated placement (D-11)
  // is a placement-only move — its keys never move, so only interval-free
  // applies. The dragged Group's own current interval is pass-through either way.
  const attached = frameByKeyId.get(clip.sourceKeyIds[0]) === clip.placementStart;
  const unownedKeyFrames = new Set<number>();
  const boundaryKeyFrames = new Set<number>();
  for (const identity of identities) {
    if (ownedKeyIds.has(identity.keyId)) continue;
    unownedKeyFrames.add(identity.appFrame);
    // D-08 pass-through: real keys inside the moved Group's own current
    // interval are not interval boundaries — the drag crossing its original
    // span is not blocked by them.
    if (identity.appFrame >= draggedInterval.phaseOrigin && identity.appFrame < draggedInterval.effectiveEnd) continue;
    boundaryKeyFrames.add(identity.appFrame);
  }

  const otherIntervals = loopRanges
    .filter((range) => range.loopId !== clip.loopId)
    .map((range) => ({ start: range.placementStart, end: range.effectiveEnd }));

  const intervalFree = (destination: number): boolean => {
    if (destination < 0) return false;
    // Infinity Groups pin the right edge at the resolved effectiveEnd, so a
    // rightward drag shrinks the derived interval instead of translating it.
    const end = infinity ? draggedInterval.effectiveEnd : destination + span;
    if (end > capacity) return false;
    if (span <= 0) return true; // zero-width interval overlaps nothing (Pitfall 7)
    for (const frame of boundaryKeyFrames) {
      if (frame >= destination && frame < end) return false;
    }
    for (const other of otherIntervals) {
      if (destination < other.end && other.start < end) return false;
    }
    return true;
  };

  const keysLandFree = (destination: number): boolean => {
    const delta = destination - current;
    for (const keyId of clip.sourceKeyIds) {
      const sourceFrame = frameByKeyId.get(keyId);
      if (sourceFrame === undefined) continue;
      const next = sourceFrame + delta;
      if (next < 0 || next >= capacity) return false;
      if (unownedKeyFrames.has(next)) return false;
    }
    return true;
  };

  const valid = (destination: number): boolean => {
    if (!intervalFree(destination)) return false;
    // Duplicated placements never move their (shared) source keys (D-11), so
    // the key-landing check is inapplicable — only the interval placement is
    // constrained.
    if (!attached) return true;
    return keysLandFree(destination);
  };

  if (proposed === current) {
    return { ok: true, destinationPlacementStart: current };
  }
  if (proposed > current) {
    // Rightward drag: nearest free placement at or before the proposed
    // destination, never moving left of the current placement.
    for (let destination = proposed; destination > current; destination -= 1) {
      if (valid(destination)) return { ok: true, destinationPlacementStart: destination };
    }
    return { ok: false };
  }
  // Leftward drag: nearest free placement at or after the proposed destination,
  // never moving right of the current placement.
  for (let destination = proposed; destination < current; destination += 1) {
    if (valid(destination)) return { ok: true, destinationPlacementStart: destination };
  }
  return { ok: false };
}

export interface PhysicPaintRotoKeyRailDragClampInput {
  readonly memberKeyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
  readonly proposedDestinationFirstKeyAppFrame: number;
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly capacity: number;
}

export type PhysicPaintRotoKeyRailDragClampResult =
  | { readonly ok: true; readonly destinationFirstKeyAppFrame: number }
  | { readonly ok: false };

/**
 * Pure Key Rail drag clamp. The rail's own stable identities are pass-through;
 * every external real key and every derived Group interval is a hard boundary.
 * The same directional nearest-free search is consumed by preview and commit.
 */
export function clampPhysicPaintKeyRailDragDestination(
  input: PhysicPaintRotoKeyRailDragClampInput,
): PhysicPaintRotoKeyRailDragClampResult {
  const current = input.firstKeyFrame;
  const proposed = input.proposedDestinationFirstKeyAppFrame;
  const span = input.lastKeyFrame - input.firstKeyFrame + 1;
  // The child document's single end authority is the physical capacity
  // (43.4 defect 1); the stale main-editor display outFrame never clamps.
  const endExclusive = input.capacity;
  if (span <= 0 || endExclusive <= 0) return { ok: false };

  const memberKeyIds = new Set(input.memberKeyIds);
  const boundaryKeyFrames = new Set<number>();
  for (const identity of input.identities) {
    if (memberKeyIds.has(identity.keyId)) continue;
    boundaryKeyFrames.add(identity.appFrame);
  }
  const groupIntervals = input.loopRanges.map((range) => ({
    start: range.placementStart,
    end: range.effectiveEnd,
  }));

  const intervalFree = (destination: number): boolean => {
    const end = destination + span;
    if (destination < 0 || end > endExclusive) return false;
    for (const frame of boundaryKeyFrames) {
      if (frame >= destination && frame < end) return false;
    }
    for (const interval of groupIntervals) {
      if (destination < interval.end && interval.start < end) return false;
    }
    return true;
  };

  const keysLandFree = (destination: number): boolean => {
    const delta = destination - current;
    for (const identity of input.identities) {
      if (!memberKeyIds.has(identity.keyId)) continue;
      const next = identity.appFrame + delta;
      if (next < 0 || next >= endExclusive || boundaryKeyFrames.has(next)) return false;
    }
    return true;
  };

  const valid = (destination: number): boolean => intervalFree(destination) && keysLandFree(destination);
  if (proposed === current) {
    return valid(current) ? { ok: true, destinationFirstKeyAppFrame: current } : { ok: false };
  }
  if (proposed > current) {
    for (let destination = proposed; destination > current; destination -= 1) {
      if (valid(destination)) return { ok: true, destinationFirstKeyAppFrame: destination };
    }
    return { ok: false };
  }
  for (let destination = proposed; destination < current; destination += 1) {
    if (valid(destination)) return { ok: true, destinationFirstKeyAppFrame: destination };
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
// Push-rails directional set / straddle / clamp / break authorities (43.5
// Task 2). All three derive exclusively from canonical records/loopClips —
// never from caller-supplied attachment or set flags (Pitfall 6). The set
// derivation and the clamp are exported so the strip hover preflight port
// (plan 05) consumes the SAME authority the resolver branch commits with:
// preflight and rejection can never disagree (D-17, Pitfall 4).
// ---------------------------------------------------------------------------

/**
 * One straddle verdict (D-16): a source-attached Group inside the moved set
 * shares its source cycle with a Group on the fixed side. The push fails
 * closed — zero mutation, zero partial proposal, no silent set expansion.
 */
export interface PhysicPaintPushStraddleVerdict {
  readonly straddled: true;
  readonly movedGroupLoopId: string;
  readonly fixedGroupLoopId: string;
  readonly sourceCycleId: string;
}

export interface PhysicPaintPushSetInput {
  readonly anchorKeyId?: string;
  readonly anchorLoopId?: string;
  readonly direction: 'right' | 'left';
  /** Ordered real keys (the resolver's validated identity order). */
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  /** Derived Group ranges — the same projection the rail strip draws. */
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}

export type PhysicPaintPushSetResult =
  | {
      readonly ok: true;
      readonly anchorRail: PushRail;
      readonly movedRails: readonly PushRail[];
      readonly fixedRails: readonly PushRail[];
      readonly movedKeyIds: ReadonlySet<string>;
      readonly movedSetBounds: { readonly firstFrame: number; readonly lastEndExclusive: number };
      /** Nearest fixed boundary on the left (max end of fixed rails, or frame 0). */
      readonly leftBoundary: number;
      readonly straddle: PhysicPaintPushStraddleVerdict | null;
    }
  | {
      readonly ok: false;
      readonly code: PhysicPaintRotoPhysicalEditFailureCode;
      readonly text: string;
    };

/**
 * Shared pure directional-set derivation (D-17): maps the anchor descriptor
 * (keyId or loopId), direction, ordered real keys, derived loop ranges, and
 * clips to the directional Rail set plus a straddle verdict. The anchor Rail's
 * interval is the pivot (RESEARCH A3); empty physical space belongs to neither
 * side. A frame inside a Group resolves to the complete Group — never an
 * implicit cut (D-07). Duplicated (shared-source) placements contribute no
 * moved keys and never straddle (43.3 algebra); only source-attached
 * straddles reject (D-16). Consumed by the resolver branch now and by the
 * strip hover preflight port in plan 05.
 */
export function derivePhysicPaintPushSet(input: PhysicPaintPushSetInput): PhysicPaintPushSetResult {
  const { identities, loopRanges, loopClips, incomingInterpolationBreakKeyIds } = input;

  const groupOwnedKeyIds = new Set<string>();
  for (const clip of loopClips) {
    clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  const framesByKeyId = new Map(identities.map((identity) => [identity.keyId, identity.appFrame] as const));

  const segments = deriveKeyRailSegments({
    orderedRealKeys: identities,
    incomingInterpolationBreakKeyIds: new Set(incomingInterpolationBreakKeyIds),
    groupOwnedKeyIds,
  });

  // Unified ordered Rail list: Key Rail segments plus derived Group ranges.
  const rails: PushRail[] = [];
  for (const segment of segments) {
    rails.push({
      kind: 'key-rail',
      id: segment.firstKeyId,
      intervalStart: segment.firstKeyFrame,
      intervalEndExclusive: segment.lastKeyFrame + 1,
      keyIds: segment.keyIds,
    });
  }
  for (const range of loopRanges) {
    const clip = loopClips.find((candidate) => candidate.loopId === range.loopId);
    if (clip === undefined) continue;
    const firstSourceFrame = framesByKeyId.get(clip.sourceKeyIds[0]);
    rails.push({
      kind: 'group',
      id: range.loopId,
      intervalStart: range.placementStart,
      intervalEndExclusive: range.effectiveEnd,
      keyIds: range.sourceKeyIds,
      sourceCycleId: range.sourceCycleId,
      // Canonical attachment test (Pitfall 4): the clip's first source key
      // must exist and its placement must coincide with that key's pre-move
      // frame. Never a caller-supplied attachment flag (Pitfall 6).
      attached: firstSourceFrame !== undefined && firstSourceFrame === clip.placementStart,
      clip,
    });
  }
  rails.sort((left, right) => (
    left.intervalStart - right.intervalStart || left.id.localeCompare(right.id)
  ));

  // D-07: anchor resolution accepts either a keyId (ordinary/Key Rail member)
  // or a loopId (Motion/Static Rail). A frame inside a Group resolves to the
  // complete Group — never an implicit cut.
  const anchorRail = input.anchorKeyId !== undefined
    ? rails.find((rail) => rail.kind === 'key-rail' && rail.keyIds.includes(input.anchorKeyId as string))
      ?? rails.find((rail) => rail.kind === 'group' && rail.keyIds.includes(input.anchorKeyId as string))
    : input.anchorLoopId !== undefined
      ? rails.find((rail) => rail.kind === 'group' && rail.id === input.anchorLoopId)
      : undefined;
  if (anchorRail === undefined) {
    const descriptor = input.anchorKeyId !== undefined
      ? `Push anchor key "${input.anchorKeyId}"`
      : `Push anchor loop "${input.anchorLoopId ?? ''}"`;
    return { ok: false, code: 'unknown-operation-identity', text: `${descriptor} is not a member of any Rail.` };
  }

  // Directional set (43.5-05 revised contract): the moved set is THE SAME for
  // both drag directions — the anchor Rail plus every Rail whose interval
  // starts at/after the anchor's start (suffix set). The drag direction only
  // sets the movement direction; it never changes set membership. Rails
  // starting before the anchor are the fixed side and never move. The opposite
  // side is byte-position fixed.
  const movedRails = rails.filter((rail) => rail.intervalStart >= anchorRail.intervalStart);
  const movedIds = new Set(movedRails.map((rail) => rail.id));
  const fixedRails = rails.filter((rail) => !movedIds.has(rail.id));

  // Nearest fixed boundary on the left (43.5-05 revised contract): the max end
  // of the fixed rails, or frame 0 when the anchor is the leftmost content.
  // Push Left clamps at this boundary — never at frame 0 when a fixed rail
  // precedes the anchor.
  let leftBoundary = 0;
  for (const rail of fixedRails) {
    leftBoundary = Math.max(leftBoundary, rail.intervalEndExclusive);
  }

  // Moved keys: Key Rail members plus source keys of source-attached Groups.
  // Duplicated placements contribute NO moved keys (their source keys stay).
  const movedKeyIds = new Set<string>();
  for (const rail of movedRails) {
    if (rail.kind === 'key-rail') {
      rail.keyIds.forEach((keyId) => movedKeyIds.add(keyId));
    } else if (rail.attached) {
      rail.keyIds.forEach((keyId) => movedKeyIds.add(keyId));
    }
  }

  // The moved set's byte interval bounds — the clamp's boundary input.
  let firstFrame = Number.POSITIVE_INFINITY;
  let lastEndExclusive = Number.NEGATIVE_INFINITY;
  for (const rail of movedRails) {
    firstFrame = Math.min(firstFrame, rail.intervalStart);
    lastEndExclusive = Math.max(lastEndExclusive, rail.intervalEndExclusive);
  }

  // D-16 straddle: a source-attached Group in the moved set sharing its source
  // cycle with a Group on the fixed side fails closed. Duplicated (shared
  // source) placements in the moved set own no source keys, so no straddle
  // arises (43.3 algebra) — only source-attached straddles reject.
  let straddle: PhysicPaintPushStraddleVerdict | null = null;
  for (const movedRail of movedRails) {
    if (movedRail.kind !== 'group' || movedRail.attached !== true || movedRail.sourceCycleId === undefined) continue;
    for (const fixedRail of fixedRails) {
      if (fixedRail.kind !== 'group' || fixedRail.sourceCycleId === undefined) continue;
      if (fixedRail.sourceCycleId === movedRail.sourceCycleId) {
        straddle = {
          straddled: true,
          movedGroupLoopId: movedRail.id,
          fixedGroupLoopId: fixedRail.id,
          sourceCycleId: movedRail.sourceCycleId,
        };
        break;
      }
    }
    if (straddle !== null) break;
  }

  return {
    ok: true,
    anchorRail,
    movedRails,
    fixedRails,
    movedKeyIds,
    movedSetBounds: { firstFrame, lastEndExclusive },
    leftBoundary,
    straddle,
  };
}

/**
 * Pure directional push clamp (PUSH-05). The moved set translates rigidly as
 * one byte interval, so the only boundaries are the nearest fixed boundary on
 * the left (leftBoundary — the previous rail/key end, or frame 0) for Push
 * Left and the physical capacity / parent end for Push Right (the child
 * document's single end authority, never the main-editor display outFrame,
 * 43.4 defect 1). Proposed delta 0 is a valid no-change (never a failure);
 * otherwise the directional nearest-free search scans from the proposed signed
 * delta toward 0 and returns the first delta that keeps the set in bounds, or
 * ok:false when zero valid movement exists. The dispatch branch commits this
 * clamped delta (preview-is-the-commit, D-14).
 */
export interface PhysicPaintPushClampInput {
  readonly direction: 'right' | 'left';
  /** Signed proposal: positive for Push Right, negative for Push Left. */
  readonly proposedDeltaFrames: number;
  readonly movedSetBounds: { readonly firstFrame: number; readonly lastEndExclusive: number };
  /** Nearest fixed boundary on the left (max end of fixed rails, or frame 0). */
  readonly leftBoundary: number;
  readonly capacity: number;
}

export type PhysicPaintPushClampResult =
  | { readonly ok: true; readonly deltaFrames: number }
  | { readonly ok: false };

export function clampPhysicPaintPushDestination(
  input: PhysicPaintPushClampInput,
): PhysicPaintPushClampResult {
  if (input.proposedDeltaFrames === 0) return { ok: true, deltaFrames: 0 };
  if (input.direction === 'right') {
    for (let delta = input.proposedDeltaFrames; delta > 0; delta -= 1) {
      if (input.movedSetBounds.lastEndExclusive + delta <= input.capacity) {
        return { ok: true, deltaFrames: delta };
      }
    }
    return { ok: false };
  }
  for (let delta = input.proposedDeltaFrames; delta < 0; delta += 1) {
    if (input.movedSetBounds.firstFrame + delta >= input.leftBoundary) {
      return { ok: true, deltaFrames: delta };
    }
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
// Explicit rail-set move authorities (43.6-02 Task 1). The explicit set is a
// NEW selection scope (43.6-01): members are exact Key Rail segments or Loop
// Clip ids — never directional suffixes. derivePhysicPaintRailSetMove validates
// the member list against freshly derived segments/ranges and computes the
// moved keys, set bounds, and the generalized straddle verdict (D-10);
// clampPhysicPaintRailSetMoveDelta scans the signed proposal toward 0 and
// returns the first delta keeping every moved member clear of unselected key
// frames, unselected Group occupancy (including linked occurrences from loop
// ranges), frame 0, and capacity. Both are exported so the Plan 03 drag
// preview consumes the SAME authority the resolver branch commits with
// (D-17 pattern): preflight and rejection can never disagree. Push never
// consumes the set (D-20): the push set is directional, the rail set is
// explicit.
// ---------------------------------------------------------------------------

/**
 * One explicit rail-set member (43.6-01): a Key Rail segment matched exactly
 * by firstKeyId + ordered keyIds, or a Group Rail matched by loopId.
 */
export type PhysicPaintRailSetMoveMember =
  | { readonly kind: 'key-rail'; readonly firstKeyId: string; readonly keyIds: readonly string[] }
  | { readonly kind: 'loop'; readonly loopId: string };

export interface PhysicPaintRailSetMoveInput {
  readonly members: readonly PhysicPaintRailSetMoveMember[];
  /** Ordered real keys (the resolver's validated identity order). */
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  /** Derived Group ranges — the same projection the rail strip draws. */
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}

export type PhysicPaintRailSetMoveResult =
  | {
      readonly ok: true;
      /** The validated member list (exact-match membership). */
      readonly members: readonly PhysicPaintRailSetMoveMember[];
      readonly movedKeyIds: ReadonlySet<string>;
      readonly movedSetBounds: { readonly firstFrame: number; readonly lastEndExclusive: number };
      readonly straddle: PhysicPaintPushStraddleVerdict | null;
    }
  | {
      readonly ok: false;
      readonly code: PhysicPaintRotoPhysicalEditFailureCode;
      readonly text: string;
    };

/**
 * Pure explicit-set derivation (D-07/D-10): validates the member list against
 * freshly derived Key Rail segments + loop ranges (exact-match membership,
 * fail-closed on stale or unknown members), computes the moved keys (Key Rail
 * members plus source keys of source-attached Groups; duplicated placements
 * contribute NO moved keys — 43.3 algebra), the set's byte bounds, and the
 * generalized straddle verdict: a source-attached selected Group sharing its
 * source cycle with an UNSELECTED Group fails closed; duplicated placements
 * never straddle. Consumed by the resolver branch now and by the Plan 03 drag
 * preview.
 */
export function derivePhysicPaintRailSetMove(input: PhysicPaintRailSetMoveInput): PhysicPaintRailSetMoveResult {
  const { members, identities, loopRanges, loopClips, incomingInterpolationBreakKeyIds } = input;
  if (!Array.isArray(members) || members.length === 0) {
    return { ok: false, code: 'malformed-identity', text: 'Rail set move requires a non-empty members array.' };
  }

  const groupOwnedKeyIds = new Set<string>();
  for (const clip of loopClips) {
    clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  const framesByKeyId = new Map(identities.map((identity) => [identity.keyId, identity.appFrame] as const));

  const segments = deriveKeyRailSegments({
    orderedRealKeys: identities,
    incomingInterpolationBreakKeyIds: new Set(incomingInterpolationBreakKeyIds),
    groupOwnedKeyIds,
  });

  // Resolve every member to exactly one rail (exact-match membership).
  const resolved: { readonly member: PhysicPaintRailSetMoveMember; readonly rail: PushRail }[] = [];
  const seenRailIds = new Set<string>();
  for (const member of members) {
    if (member.kind === 'key-rail') {
      if (!isBoundedKeyId(member.firstKeyId) || !Array.isArray(member.keyIds) || member.keyIds.length === 0) {
        return { ok: false, code: 'malformed-identity', text: 'Key Rail set members require a bounded firstKeyId and a non-empty keyIds array.' };
      }
      if (member.keyIds.some((keyId: string) => !identities.some((identity) => identity.keyId === keyId))) {
        return { ok: false, code: 'unknown-operation-identity', text: `Key Rail set member "${member.firstKeyId}" targets an unknown identity.` };
      }
      const segment = segments.find((candidate) => (
        candidate.firstKeyId === member.firstKeyId
        && candidate.keyIds.length === member.keyIds.length
        && candidate.keyIds.every((keyId, index) => keyId === member.keyIds[index])
      ));
      if (segment === undefined) {
        return { ok: false, code: 'malformed-target', text: `Key Rail set member "${member.firstKeyId}" must match exactly one current derived segment.` };
      }
      if (seenRailIds.has(segment.firstKeyId)) {
        return { ok: false, code: 'duplicate-id', text: `Duplicate Key Rail set member "${segment.firstKeyId}".` };
      }
      seenRailIds.add(segment.firstKeyId);
      resolved.push({
        member,
        rail: {
          kind: 'key-rail',
          id: segment.firstKeyId,
          intervalStart: segment.firstKeyFrame,
          intervalEndExclusive: segment.lastKeyFrame + 1,
          keyIds: segment.keyIds,
        },
      });
    } else {
      if (!isBoundedKeyId(member.loopId)) {
        return { ok: false, code: 'malformed-identity', text: 'Loop set members require a bounded loopId.' };
      }
      const range = loopRanges.find((candidate) => candidate.loopId === member.loopId);
      const clip = loopClips.find((candidate) => candidate.loopId === member.loopId);
      if (range === undefined || clip === undefined) {
        return { ok: false, code: 'unknown-operation-identity', text: `Loop set member "${member.loopId}" is not a member of any Group Rail.` };
      }
      if (seenRailIds.has(member.loopId)) {
        return { ok: false, code: 'duplicate-id', text: `Duplicate Loop set member "${member.loopId}".` };
      }
      seenRailIds.add(member.loopId);
      const firstSourceFrame = framesByKeyId.get(clip.sourceKeyIds[0]);
      resolved.push({
        member,
        rail: {
          kind: 'group',
          id: range.loopId,
          intervalStart: range.placementStart,
          intervalEndExclusive: range.effectiveEnd,
          keyIds: range.sourceKeyIds,
          sourceCycleId: range.sourceCycleId,
          // Canonical attachment test (Pitfall 4): the clip's first source key
          // must exist and its placement must coincide with that key's pre-move
          // frame. Never a caller-supplied attachment flag (Pitfall 6).
          attached: firstSourceFrame !== undefined && firstSourceFrame === clip.placementStart,
          clip,
        },
      });
    }
  }

  // Moved keys: Key Rail members plus source keys of source-attached Groups.
  // Duplicated placements contribute NO moved keys (their source keys stay).
  const movedKeyIds = new Set<string>();
  for (const { rail } of resolved) {
    if (rail.kind === 'key-rail') {
      rail.keyIds.forEach((keyId) => movedKeyIds.add(keyId));
    } else if (rail.attached) {
      rail.keyIds.forEach((keyId) => movedKeyIds.add(keyId));
    }
  }

  // The moved set's byte interval bounds — the clamp's boundary input.
  let firstFrame = Number.POSITIVE_INFINITY;
  let lastEndExclusive = Number.NEGATIVE_INFINITY;
  for (const { rail } of resolved) {
    firstFrame = Math.min(firstFrame, rail.intervalStart);
    lastEndExclusive = Math.max(lastEndExclusive, rail.intervalEndExclusive);
  }

  // D-10 straddle: a source-attached selected Group sharing its source cycle
  // with an UNSELECTED Group fails closed. Duplicated (shared-source)
  // placements in the set own no source keys, so no straddle arises (43.3
  // algebra) — only source-attached straddles reject.
  const selectedLoopIds = new Set(
    resolved.filter(({ rail }) => rail.kind === 'group').map(({ rail }) => rail.id),
  );
  let straddle: PhysicPaintPushStraddleVerdict | null = null;
  for (const { rail } of resolved) {
    if (rail.kind !== 'group' || rail.attached !== true || rail.sourceCycleId === undefined) continue;
    for (const range of loopRanges) {
      if (selectedLoopIds.has(range.loopId) || range.sourceCycleId === undefined) continue;
      if (range.sourceCycleId === rail.sourceCycleId) {
        straddle = {
          straddled: true,
          movedGroupLoopId: rail.id,
          fixedGroupLoopId: range.loopId,
          sourceCycleId: rail.sourceCycleId,
        };
        break;
      }
    }
    if (straddle !== null) break;
  }

  return {
    ok: true,
    members,
    movedKeyIds,
    movedSetBounds: { firstFrame, lastEndExclusive },
    straddle,
  };
}

export interface PhysicPaintRailSetMoveClampInput {
  readonly members: readonly PhysicPaintRailSetMoveMember[];
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly incomingInterpolationBreakKeyIds: readonly string[];
  /** Signed proposal: positive moves right, negative moves left. */
  readonly proposedDelta: number;
  readonly capacity: number;
}

export type PhysicPaintRailSetMoveClampResult =
  | {
      readonly ok: true;
      readonly delta: number;
      /** Which edge of the set is flush against the obstruction ('left'|'right'), or null for a no-change. */
      readonly blockedEdge: 'left' | 'right' | null;
      /** The member whose edge is flush against the obstruction (rightmost for rightward, leftmost for leftward). */
      readonly collidingMemberId: string | null;
    }
  | { readonly ok: false };

/**
 * Pure explicit-set clamp (D-07): the set translates rigidly as one unit, so
 * the scan checks every moved member against unselected key frames, unselected
 * Group occupancy intervals (including linked occurrences from loop ranges),
 * frame 0, and capacity. Proposed delta 0 is a valid no-change (never a
 * failure); otherwise the scan moves from the proposed signed delta toward 0
 * and returns the first delta keeping every member clear, or ok:false when
 * zero valid movement exists. The dispatch branch commits this clamped delta
 * (preview-is-the-commit, D-17).
 */
export function clampPhysicPaintRailSetMoveDelta(input: PhysicPaintRailSetMoveClampInput): PhysicPaintRailSetMoveClampResult {
  const { members, identities, loopRanges, loopClips, proposedDelta, capacity } = input;
  if (proposedDelta === 0) return { ok: true, delta: 0, blockedEdge: null, collidingMemberId: null };
  if (!Number.isInteger(proposedDelta)) return { ok: false };

  const groupOwnedKeyIds = new Set<string>();
  for (const clip of loopClips) {
    clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  const framesByKeyId = new Map(identities.map((identity) => [identity.keyId, identity.appFrame] as const));
  const segments = deriveKeyRailSegments({
    orderedRealKeys: identities,
    incomingInterpolationBreakKeyIds: new Set(input.incomingInterpolationBreakKeyIds),
    groupOwnedKeyIds,
  });

  // Resolve member intervals + moved keys with the same canonical rules as the
  // derivation authority. The resolver validates members via derive first, so
  // malformed members here fail closed.
  const intervals: { readonly memberId: string; readonly start: number; readonly endExclusive: number }[] = [];
  const movedKeyIds = new Set<string>();
  const selectedLoopIds = new Set<string>();
  for (const member of members) {
    if (member.kind === 'key-rail') {
      const segment = segments.find((candidate) => (
        candidate.firstKeyId === member.firstKeyId
        && candidate.keyIds.length === member.keyIds.length
        && candidate.keyIds.every((keyId, index) => keyId === member.keyIds[index])
      ));
      if (segment === undefined) return { ok: false };
      intervals.push({
        memberId: segment.firstKeyId,
        start: segment.firstKeyFrame,
        endExclusive: segment.lastKeyFrame + 1,
      });
      segment.keyIds.forEach((keyId) => movedKeyIds.add(keyId));
    } else {
      const range = loopRanges.find((candidate) => candidate.loopId === member.loopId);
      const clip = loopClips.find((candidate) => candidate.loopId === member.loopId);
      if (range === undefined || clip === undefined) return { ok: false };
      selectedLoopIds.add(member.loopId);
      intervals.push({
        memberId: member.loopId,
        start: range.placementStart,
        endExclusive: range.effectiveEnd,
      });
      const firstSourceFrame = framesByKeyId.get(clip.sourceKeyIds[0]);
      if (firstSourceFrame !== undefined && firstSourceFrame === clip.placementStart) {
        range.sourceKeyIds.forEach((keyId) => movedKeyIds.add(keyId));
      }
    }
  }

  // Unselected key frames and unselected Group occupancy intervals (the full
  // derived visible extent, including linked occurrences).
  const unselectedKeyFrames = identities
    .filter((identity) => !movedKeyIds.has(identity.keyId))
    .map((identity) => identity.appFrame)
    .sort((left, right) => left - right);
  const unselectedGroupIntervals = loopRanges
    .filter((range) => !selectedLoopIds.has(range.loopId))
    .map((range) => ({ start: range.placementStart, endExclusive: range.effectiveEnd }));

  const isClear = (delta: number): boolean => {
    for (const interval of intervals) {
      const start = interval.start + delta;
      const endExclusive = interval.endExclusive + delta;
      if (start < 0 || endExclusive > capacity) return false;
      for (const frame of unselectedKeyFrames) {
        if (frame >= start && frame < endExclusive) return false;
      }
      for (const group of unselectedGroupIntervals) {
        if (group.start < endExclusive && group.endExclusive > start) return false;
      }
    }
    return true;
  };

  if (proposedDelta > 0) {
    for (let delta = proposedDelta; delta > 0; delta -= 1) {
      if (isClear(delta)) {
        const rightmost = intervals.reduce((candidate, interval) => (
          interval.endExclusive > candidate.endExclusive ? interval : candidate
        ));
        return { ok: true, delta, blockedEdge: 'right', collidingMemberId: rightmost.memberId };
      }
    }
    return { ok: false };
  }
  for (let delta = proposedDelta; delta < 0; delta += 1) {
    if (isClear(delta)) {
      const leftmost = intervals.reduce((candidate, interval) => (
        interval.start < candidate.start ? interval : candidate
      ));
      return { ok: true, delta, blockedEdge: 'left', collidingMemberId: leftmost.memberId };
    }
  }
  return { ok: false };
}

/**
 * PUSH-03: derive the complete next incoming-interpolation-break collection
 * for a directional push — a complete-collection replacement, never a delta.
 * Rules: Push Right — the moved set's first key (min pre-move frame) owns the
 * opened-gap break (travels with the set, 43.1 D-14); Push Left — the anchor's
 * incoming break travels with its identity (43.4 D-19, never a silent merge
 * with the previous segment) and no successor break is manufactured because the
 * moved set is the suffix; a reverse push that returns the moved set to frame 0
 * closes the head gap and normalizes the collection by removing the break on
 * the moved set's first key. Every existing break is reused, never duplicated.
 * Duplicated placements move placement-only and manufacture no physical-key
 * breaks (D-11). Deterministic ascending post-move-frame sort.
 */
function derivePhysicPaintPushIncomingInterpolationBreakKeyIds(input: {
  readonly direction: 'right' | 'left';
  /** Signed, clamped delta: positive for Push Right, negative for Push Left. */
  readonly deltaFrames: number;
  readonly movedKeyIds: ReadonlySet<string>;
  readonly movedSetBounds: { readonly firstFrame: number; readonly lastEndExclusive: number };
  readonly preMoveFramesByKeyId: ReadonlyMap<string, number>;
  readonly mapping: ReadonlyMap<string, number>;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}): readonly string[] {
  const {
    direction,
    deltaFrames,
    movedKeyIds,
    movedSetBounds,
    preMoveFramesByKeyId,
    mapping,
    incomingInterpolationBreakKeyIds,
  } = input;
  const owners = new Set(incomingInterpolationBreakKeyIds);

  if (deltaFrames !== 0 && movedKeyIds.size > 0) {
    let firstMovedKey: string | null = null;
    let firstMovedFrame = Number.POSITIVE_INFINITY;
    for (const keyId of movedKeyIds) {
      const frame = preMoveFramesByKeyId.get(keyId) ?? Number.POSITIVE_INFINITY;
      if (frame < firstMovedFrame) {
        firstMovedKey = keyId;
        firstMovedFrame = frame;
      }
    }

    if (direction === 'right' && firstMovedKey !== null) {
      owners.add(firstMovedKey);
    } else if (direction === 'left' && firstMovedKey !== null) {
      // The anchor's incoming break travels with its identity (43.4 D-19) —
      // never a silent merge with the previous segment. The moved set is the
      // suffix, so the fixed side is before it and no successor break is
      // manufactured. Reverse-close normalization: when the reverse push
      // returns the moved set to frame 0 (leftmost content — provably no fixed
      // predecessor), the head-gap break on the moved set's first key is moot
      // and is removed.
      if (movedSetBounds.firstFrame + deltaFrames === 0) {
        owners.delete(firstMovedKey);
      }
    }
  }

  return [...owners].sort((left, right) => {
    const frameLeft = mapping.get(left) ?? Number.POSITIVE_INFINITY;
    const frameRight = mapping.get(right) ?? Number.POSITIVE_INFINITY;
    return frameLeft - frameRight || left.localeCompare(right);
  });
}

export function deriveDeleteKeyRailIncomingInterpolationBreakKeyIds(input: {
  readonly memberKeyIds: readonly string[];
  readonly lastKeyFrame: number;
  readonly groupOwnedKeyIds: ReadonlySet<string>;
  readonly mapping: ReadonlyMap<string, number>;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}): readonly string[] {
  const removedKeyIds = new Set(input.memberKeyIds);
  const owners = new Set(
    input.incomingInterpolationBreakKeyIds.filter((keyId) => !removedKeyIds.has(keyId)),
  );
  const vacatedEndExclusive = input.lastKeyFrame + 1;
  let successor: string | null = null;
  let successorFrame = Number.POSITIVE_INFINITY;
  for (const [keyId, frame] of input.mapping) {
    if (input.groupOwnedKeyIds.has(keyId)) continue;
    if (frame >= vacatedEndExclusive && frame < successorFrame) {
      successor = keyId;
      successorFrame = frame;
    }
  }
  if (successor !== null) owners.add(successor);

  return [...owners].sort((left, right) => {
    const frameLeft = input.mapping.get(left) ?? Number.POSITIVE_INFINITY;
    const frameRight = input.mapping.get(right) ?? Number.POSITIVE_INFINITY;
    return frameLeft - frameRight || left.localeCompare(right);
  });
}

function deriveMoveKeyRailIncomingInterpolationBreakKeyIds(input: {
  readonly memberKeyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
  readonly groupOwnedKeyIds: ReadonlySet<string>;
  readonly preMoveFramesByKeyId: ReadonlyMap<string, number>;
  readonly mapping: ReadonlyMap<string, number>;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}): readonly string[] {
  const owners = new Set(input.incomingInterpolationBreakKeyIds);
  const memberKeyIds = new Set(input.memberKeyIds);
  const vacatedEndExclusive = input.lastKeyFrame + 1;

  let successor: string | null = null;
  let successorFrame = Number.POSITIVE_INFINITY;
  for (const [keyId, frame] of input.preMoveFramesByKeyId) {
    if (memberKeyIds.has(keyId) || input.groupOwnedKeyIds.has(keyId)) continue;
    if (frame >= vacatedEndExclusive && frame < successorFrame) {
      successor = keyId;
      successorFrame = frame;
    }
  }
  if (successor !== null) owners.add(successor);

  const firstKeyId = input.memberKeyIds[0];
  const firstDestination = input.mapping.get(firstKeyId);
  if (firstDestination !== undefined) {
    let predecessorFrame = -1;
    for (const [keyId, frame] of input.mapping) {
      if (memberKeyIds.has(keyId) || input.groupOwnedKeyIds.has(keyId)) continue;
      if (frame < firstDestination && frame > predecessorFrame) predecessorFrame = frame;
    }
    if (predecessorFrame !== -1 && firstDestination - predecessorFrame > 1) owners.add(firstKeyId);
  }

  return [...owners].sort((left, right) => {
    const frameLeft = input.mapping.get(left) ?? Number.POSITIVE_INFINITY;
    const frameRight = input.mapping.get(right) ?? Number.POSITIVE_INFINITY;
    return frameLeft - frameRight || left.localeCompare(right);
  });
}

/**
 * D-11: derive the complete incoming-interpolation-break collection after an
 * explicit-set rigid move. Follows the move-key-rail authority (43.3 D-12 /
 * 43.4 D-19) generalized to the set: (a) internal breaks travel with moved key
 * identity; (b) when the set vacates its interval, the first surviving key at
 * or after the vacated end owns the opened-gap break; (c) when the set's first
 * key (minimum pre-move frame) lands more than one frame after its new
 * predecessor, it owns a new landing-gap break — landing adjacent to a
 * fixed-side neighbor (gap 1) never merges and never manufactures a break.
 * Group-owned keys never own key-owned breaks. Reuse-never-duplicate: the
 * output is a complete collection replacement, never a delta.
 */
function derivePhysicPaintRailSetMoveIncomingInterpolationBreakKeyIds(input: {
  readonly delta: number;
  readonly movedKeyIds: ReadonlySet<string>;
  readonly movedSetBounds: { readonly firstFrame: number; readonly lastEndExclusive: number };
  readonly groupOwnedKeyIds: ReadonlySet<string>;
  readonly preMoveFramesByKeyId: ReadonlyMap<string, number>;
  readonly mapping: ReadonlyMap<string, number>;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}): readonly string[] {
  const owners = new Set(input.incomingInterpolationBreakKeyIds);
  if (input.delta === 0 || input.movedKeyIds.size === 0) {
    return [...owners].sort((left, right) => {
      const frameLeft = input.mapping.get(left) ?? Number.POSITIVE_INFINITY;
      const frameRight = input.mapping.get(right) ?? Number.POSITIVE_INFINITY;
      return frameLeft - frameRight || left.localeCompare(right);
    });
  }

  // Vacated-successor rule (43.3 D-12): the first surviving key at or after
  // the vacated set end owns the opened-gap break.
  const vacatedEndExclusive = input.movedSetBounds.lastEndExclusive;
  let successor: string | null = null;
  let successorFrame = Number.POSITIVE_INFINITY;
  for (const [keyId, frame] of input.preMoveFramesByKeyId) {
    if (input.movedKeyIds.has(keyId) || input.groupOwnedKeyIds.has(keyId)) continue;
    if (frame >= vacatedEndExclusive && frame < successorFrame) {
      successor = keyId;
      successorFrame = frame;
    }
  }
  if (successor !== null) owners.add(successor);

  // Landing-gap rule: the set's first key (minimum pre-move frame) owns a new
  // break when it lands more than one frame after its new predecessor.
  let firstKeyId: string | null = null;
  let firstMovedFrame = Number.POSITIVE_INFINITY;
  for (const keyId of input.movedKeyIds) {
    const frame = input.preMoveFramesByKeyId.get(keyId) ?? Number.POSITIVE_INFINITY;
    if (frame < firstMovedFrame) {
      firstKeyId = keyId;
      firstMovedFrame = frame;
    }
  }
  if (firstKeyId !== null) {
    const firstDestination = input.mapping.get(firstKeyId);
    if (firstDestination !== undefined) {
      let predecessorFrame = -1;
      for (const [keyId, frame] of input.mapping) {
        if (input.movedKeyIds.has(keyId) || input.groupOwnedKeyIds.has(keyId)) continue;
        if (frame < firstDestination && frame > predecessorFrame) predecessorFrame = frame;
      }
      if (predecessorFrame !== -1 && firstDestination - predecessorFrame > 1) owners.add(firstKeyId);
    }
  }

  return [...owners].sort((left, right) => {
    const frameLeft = input.mapping.get(left) ?? Number.POSITIVE_INFINITY;
    const frameRight = input.mapping.get(right) ?? Number.POSITIVE_INFINITY;
    return frameLeft - frameRight || left.localeCompare(right);
  });
}

/**
 * D-09..D-13: derive the complete incoming-interpolation-break collection after
 * a Group drag. Stable-key-owned breaks only, under exact 43.1 semantics:
 * (a) the next real key at or after the vacated interval's end owns (or reuses)
 * the incoming break when one exists — never when the interval ends content
 * (D-12); (b) a source-attached move opens a landing gap when the first source
 * key lands more than one frame after its new predecessor, giving that key a new
 * incoming break (D-10); (c) every existing break is carried unchanged (43.1
 * D-14). Group-local fragments (visibleRanges gaps, frameOverrides) never
 * convert to key-owned breaks (D-13). A duplicated placement moves no physical
 * keys, so it manufactures neither a vacated-successor nor a landing-gap break;
 * existing stable-key-owned breaks remain unchanged (D-11). Reuse-never-duplicate:
 * the output is a complete collection
 * replacement, never a delta.
 */
function deriveMoveGroupIncomingInterpolationBreakKeyIds(input: {
  readonly clip: PhysicPaintRotoLoopClip;
  readonly draggedInterval: { readonly phaseOrigin: number; readonly effectiveEnd: number };
  readonly attached: boolean;
  readonly preMoveFramesByKeyId: ReadonlyMap<string, number>;
  readonly mapping: ReadonlyMap<string, number>;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}): readonly string[] {
  const {
    clip,
    draggedInterval,
    attached,
    preMoveFramesByKeyId,
    mapping,
    incomingInterpolationBreakKeyIds,
  } = input;
  const owners = new Set(incomingInterpolationBreakKeyIds);
  const groupOwnedKeyIds = new Set([
    ...clip.sourceKeyIds,
    ...(clip.frameOverrides ?? []).map((override) => override.keyId),
  ]);

  // (a) D-09/D-12: vacated-gap ownership is a pre-move fact. Select the next
  // external real key from stable identity frames, then carry only its keyId
  // through the translated mapping. Placement-only moves vacate no physical
  // keys, and Group-owned source/override identities can never own this break.
  const { phaseOrigin, effectiveEnd } = draggedInterval;
  if (attached && effectiveEnd > phaseOrigin) {
    let successor: string | null = null;
    let successorFrame = Number.POSITIVE_INFINITY;
    for (const [keyId, frame] of preMoveFramesByKeyId) {
      if (groupOwnedKeyIds.has(keyId)) continue;
      if (frame >= effectiveEnd && frame < successorFrame) {
        successor = keyId;
        successorFrame = frame;
      }
    }
    if (successor !== null) owners.add(successor);
  }

  // (b) D-10/D-12: a source-attached move opens a landing gap only against an
  // external predecessor. The break belongs to the first source key, so it can
  // suppress only the external landing segment, never an internal source span.
  if (attached) {
    const firstSourceKey = clip.sourceKeyIds[0];
    const firstSourceFrame = mapping.get(firstSourceKey);
    if (firstSourceFrame !== undefined) {
      let predecessorFrame = -1;
      for (const [keyId, frame] of mapping) {
        if (groupOwnedKeyIds.has(keyId)) continue;
        if (frame < firstSourceFrame && frame > predecessorFrame) predecessorFrame = frame;
      }
      if (predecessorFrame !== -1 && firstSourceFrame - predecessorFrame > 1) owners.add(firstSourceKey);
    }
  }

  // Deterministic ascending physical-frame order (the canonical fingerprint
  // sorts independently, so this is presentation-stable only).
  return [...owners].sort((left, right) => {
    const frameLeft = mapping.get(left) ?? Number.POSITIVE_INFINITY;
    const frameRight = mapping.get(right) ?? Number.POSITIVE_INFINITY;
    return frameLeft - frameRight || left.localeCompare(right);
  });
}

/**
 * Compute whether the final mapping differs from the input. Used by Drag and
 * Force Spacing so an already-exact request yields a valid no-change proposal.
 */
function computeChanged(
  identities: ValidatedIdentities,
  mapping: Map<string, number>,
): boolean {
  for (const identity of identities.ordered) {
    if (mapping.get(identity.keyId) !== identity.appFrame) return true;
  }
  return false;
}

function buildLinkedForceSpacingCandidate(
  identities: ValidatedIdentities,
  emptyFrames: number,
  selectedKeyId: string | null,
  scopes: readonly PhysicPaintRotoLinkedSourceSpacingScope[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
): MoveBuilderResult {
  const mapping = new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame]));
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  const step = emptyFrames + 1;
  let cumulativeGrowth = 0;

  for (const scope of scopes) {
    const selectedIdentities = scope.selectedSourceKeyIds.map((keyId) => ({
      keyId,
      appFrame: identities.framesByKeyId.get(keyId)!,
    }));
    const firstSelectedFrame = selectedIdentities[0].appFrame;
    const lastSelectedFrame = selectedIdentities[selectedIdentities.length - 1].appFrame;
    const anchor = firstSelectedFrame + cumulativeGrowth;
    for (let index = 0; index < selectedIdentities.length; index += 1) {
      const identity = selectedIdentities[index];
      const destination = anchor + index * step;
      mapping.set(identity.keyId, destination);
      if (destination !== identity.appFrame) roleByKeyId.set(identity.keyId, 'reanchored');
    }
    const newTail = anchor + (selectedIdentities.length - 1) * step;
    const currentOldTail = lastSelectedFrame + cumulativeGrowth;
    const growth = newTail - currentOldTail;
    if (growth !== 0) {
      for (const identity of identities.ordered) {
        if (identity.appFrame <= lastSelectedFrame) continue;
        const currentFrame = mapping.get(identity.keyId)!;
        const destination = currentFrame + growth;
        mapping.set(identity.keyId, destination);
        roleByKeyId.set(identity.keyId, growth > 0 ? 'ripple-right' : 'ripple-left');
      }
    }
    cumulativeGrowth += growth;
  }

  let previousFrame = -1;
  for (const identity of identities.ordered) {
    const frame = mapping.get(identity.keyId)!;
    if (frame === previousFrame) {
      return {
        ok: false,
        resolution: fail('duplicate-destination-frame', 'force-spacing', `Duplicate final frame ${frame}.`, [frame]),
      };
    }
    if (frame < previousFrame) {
      return {
        ok: false,
        resolution: fail(
          'linked-source-spacing-order-rejected',
          'force-spacing',
          'Key Spacing would cross an unselected Loop Clip source position.',
        ),
      };
    }
    previousFrame = frame;
  }

  return {
    ok: true,
    candidate: {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId,
      operationKind: 'force-spacing',
      changed: computeChanged(identities, mapping),
      roleByKeyId,
      drag: null,
      nextLoopClips: computeSourceAttachedLoopPlacementFollow(
        identities,
        loopClips,
        mapping,
        () => true,
        true,
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// D-08 Force Spacing candidate builder: anchor the first ordered key, preserve
// deterministic identity order, and map identity at index `i` to
// `firstAppFrame + i * (emptyFrames + 1)`. Accepts `N = 0` (adjacent keys).
// Rejects invalid spacing values, empty input, and unknown non-null selection
// before any proposal exists. Over-capacity outcomes fail at the common
// finalizer with no partial proposal.
// ---------------------------------------------------------------------------

function buildForceSpacingCandidate(
  identities: ValidatedIdentities,
  emptyFrames: number,
  selectedKeyId: string | null,
  scopeKeyIds?: readonly string[] | null,
  linkedSourceSpacingScopes?: readonly PhysicPaintRotoLinkedSourceSpacingScope[] | null,
  loopClips: readonly PhysicPaintRotoLoopClip[] = PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
): MoveBuilderResult {
  if (
    typeof emptyFrames !== 'number' ||
    !Number.isFinite(emptyFrames) ||
    !Number.isInteger(emptyFrames) ||
    emptyFrames < 0
  ) {
    return {
      ok: false,
      resolution: fail('invalid-spacing', 'force-spacing', 'emptyFrames must be a finite nonnegative integer.'),
    };
  }
  if (identities.ordered.length === 0) {
    return {
      ok: false,
      resolution: fail('empty-key-set', 'force-spacing', 'Force Spacing requires at least one real key to anchor.'),
    };
  }
  if (selectedKeyId !== null) {
    if (!isBoundedKeyId(selectedKeyId) || !identities.keyIds.has(selectedKeyId)) {
      return {
        ok: false,
        resolution: fail('unknown-operation-identity', 'force-spacing', `Selection identity "${selectedKeyId}" does not exist.`),
      };
    }
  }
  if (linkedSourceSpacingScopes !== undefined && linkedSourceSpacingScopes !== null) {
    return buildLinkedForceSpacingCandidate(
      identities,
      emptyFrames,
      selectedKeyId,
      linkedSourceSpacingScopes,
      loopClips,
    );
  }

  // Phase 37 D-10..D-12 scoped variant: the earliest selected key anchors at
  // its CURRENT frame, selected key `i` maps to `anchor + i * (N + 1)`, and
  // unselected keys keep their frames as hard walls (D-11) — any computed
  // selected destination equal to an unselected frame rejects atomically.
  // Over-capacity destinations are left for the common finalizer. The
  // null/undefined scope path below is the untouched 36.14 algorithm (GFS-3).
  if (scopeKeyIds !== undefined && scopeKeyIds !== null) {
    if (!Array.isArray(scopeKeyIds) || scopeKeyIds.length === 0) {
      return {
        ok: false,
        resolution: fail('malformed-identity', 'force-spacing', 'Scoped Force Spacing requires a non-empty scopeKeyIds array.'),
      };
    }
    const scopeSet = new Set<string>();
    for (const keyId of scopeKeyIds) {
      if (!isBoundedKeyId(keyId)) {
        return {
          ok: false,
          resolution: fail('malformed-identity', 'force-spacing', 'Scoped Force Spacing requires bounded scope keyIds.'),
        };
      }
      if (scopeSet.has(keyId)) {
        return {
          ok: false,
          resolution: fail('duplicate-id', 'force-spacing', `Duplicate scope keyId "${keyId}".`),
        };
      }
      scopeSet.add(keyId);
    }
    for (const keyId of scopeSet) {
      if (!identities.keyIds.has(keyId)) {
        return {
          ok: false,
          resolution: fail('unknown-operation-identity', 'force-spacing', `Scope identity "${keyId}" does not exist.`),
        };
      }
    }

    const scopedOrdered = identities.ordered.filter((identity) => scopeSet.has(identity.keyId));
    const anchor = scopedOrdered[0].appFrame;
    const step = emptyFrames + 1;
    const mapping = new Map<string, number>();
    const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
    const scopedDestinations: number[] = [];

    for (const identity of identities.ordered) {
      if (!scopeSet.has(identity.keyId)) {
        mapping.set(identity.keyId, identity.appFrame);
      }
    }
    for (let i = 0; i < scopedOrdered.length; i += 1) {
      const identity = scopedOrdered[i];
      const next = anchor + i * step;
      mapping.set(identity.keyId, next);
      scopedDestinations.push(next);
      if (next !== identity.appFrame) {
        roleByKeyId.set(identity.keyId, 'reanchored');
      }
    }

    const conflicts: number[] = [];
    for (const destination of scopedDestinations) {
      for (const identity of identities.ordered) {
        if (!scopeSet.has(identity.keyId) && identity.appFrame === destination) {
          conflicts.push(destination);
          break;
        }
      }
    }
    if (conflicts.length > 0) {
      return {
        ok: false,
        resolution: fail(
          'duplicate-destination-frame',
          'force-spacing',
          `Scoped Force Spacing destination frame ${conflicts[0]} is occupied by an unselected real key.`,
          conflicts,
        ),
      };
    }

    return {
      ok: true as const,
      candidate: {
        mapping,
        expectedKeyIds: identities.keyIds,
        removedKeyId: null,
        removedKeyIds: EMPTY_REMOVED_KEY_IDS,
        selectedKeyId,
        operationKind: 'force-spacing',
        changed: computeChanged(identities, mapping),
        roleByKeyId,
        drag: null,
      },
    };
  }

  const firstAppFrame = identities.ordered[0].appFrame;
  const step = emptyFrames + 1;
  const mapping = new Map<string, number>();
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();

  for (let i = 0; i < identities.ordered.length; i += 1) {
    const identity = identities.ordered[i];
    const next = firstAppFrame + i * step;
    mapping.set(identity.keyId, next);
    if (next !== identity.appFrame) {
      roleByKeyId.set(identity.keyId, 'reanchored');
    }
  }

  return {
    ok: true as const,
    candidate: {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId,
      operationKind: 'force-spacing',
      changed: computeChanged(identities, mapping),
      roleByKeyId,
      drag: null,
    },
  };
}

// ---------------------------------------------------------------------------

interface FinalizedProposal {
  readonly ok: true;
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
}
interface FinalizedFailure {
  readonly ok: false;
  readonly resolution: PhysicPaintRotoPhysicalEditResolution;
}

/**
 * Shared private helper: derive the immutable physical timeline projection from
 * a validated `keyId -> appFrame` mapping. Used by both the public
 * {@link projectPhysicPaintRotoPhysicalTimeline} seam and the edit resolver's
 * {@link finalizeProposal}, so current display and edit proposals can never
 * diverge on ordering, occupancy, or exact interiors.
 *
 * Caller is responsible for proving identity-set coverage and frame uniqueness
 * before calling this helper; it only derives the projection from the
 * validated mapping.
 */
/**
 * Runtime-immutable map for resolver outputs (WR-01). `ReadonlyMap` is a
 * compile-time cast only — the native instance keeps callable `set`/`delete`/
 * `clear` mutators, and freezing the containing proposal does not disable
 * them. This helper copies the source map and replaces the mutators with
 * throwing stubs before freezing the instance, so consumers of proposals and
 * projections cannot mutate resolver-owned state.
 */
function asImmutableMap<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const copy = new Map<K, V>(source);
  const immutable = (): never => {
    throw new TypeError('Resolver maps are immutable.');
  };
  copy.set = immutable;
  copy.delete = immutable;
  copy.clear = immutable;
  return Object.freeze(copy) as ReadonlyMap<K, V>;
}

function buildProjectionFromMapping(
  mapping: ReadonlyMap<string, number>,
  capacity: number,
  interpolationEnabled: boolean,
  incomingInterpolationBreakKeyIds: readonly string[] = [],
): PhysicPaintRotoPhysicalTimelineProjection {
  // 1. Deterministic ascending physical order.
  const orderedPairs = Array.from(mapping.entries()).sort((a, b) => a[1] - b[1]);
  const orderedKeyIds = Object.freeze(orderedPairs.map((pair) => pair[0])) as readonly string[];
  const assignments = Object.freeze(
    orderedPairs.map((pair) =>
      Object.freeze({ keyId: pair[0], appFrame: pair[1] }) as PhysicPaintRotoPhysicalFrameAssignment,
    ),
  ) as readonly PhysicPaintRotoPhysicalFrameAssignment[];

  // 2. Derive generated cells per D-02: strict interiors only, no leading/trailing.
  const generatedCells: PhysicPaintRotoPhysicalCell[] = [];
  const incomingBreakOwners = new Set(incomingInterpolationBreakKeyIds);
  if (interpolationEnabled && orderedPairs.length >= 2) {
    for (let i = 0; i < orderedPairs.length - 1; i += 1) {
      const left = orderedPairs[i];
      const right = orderedPairs[i + 1];
      if (incomingBreakOwners.has(right[0])) continue;
      const start = left[1] + 1;
      const end = right[1] - 1;
      for (let frame = start; frame <= end; frame += 1) {
        generatedCells.push(
          Object.freeze({
            kind: 'generated',
            appFrame: frame,
            leftKeyId: left[0],
            rightKeyId: right[0],
          }) as PhysicPaintRotoPhysicalCell,
        );
      }
    }
  }
  const generatedCellsFrozen = Object.freeze(generatedCells) as readonly PhysicPaintRotoPhysicalCell[];

  // 3. Derive bounded physical cells for `0 .. capacity - 1`.
  const frameToRealKeyId = new Map<number, string>();
  const frameToGenerated = new Map<number, PhysicPaintRotoPhysicalCell>();
  for (const pair of orderedPairs) frameToRealKeyId.set(pair[1], pair[0]);
  for (const cell of generatedCellsFrozen) frameToGenerated.set(cell.appFrame, cell);

  const cells: PhysicPaintRotoPhysicalCell[] = [];
  for (let frame = 0; frame < capacity; frame += 1) {
    const realKeyId = frameToRealKeyId.get(frame);
    if (realKeyId !== undefined) {
      cells.push(
        Object.freeze({ kind: 'real', appFrame: frame, keyId: realKeyId }) as PhysicPaintRotoPhysicalCell,
      );
      continue;
    }
    const generated = frameToGenerated.get(frame);
    if (generated !== undefined) {
      cells.push(generated);
      continue;
    }
    cells.push(Object.freeze({ kind: 'empty', appFrame: frame }) as PhysicPaintRotoPhysicalCell);
  }
  const cellsFrozen = Object.freeze(cells) as readonly PhysicPaintRotoPhysicalCell[];

  return Object.freeze({
    orderedKeyIds,
    assignments,
    cells: cellsFrozen,
    generatedCells: generatedCellsFrozen,
    framesByKeyId: asImmutableMap(mapping),
  }) as PhysicPaintRotoPhysicalTimelineProjection;
}

function finalizeProposal(
  candidate: Candidate,
  identities: ValidatedIdentities,
  capacity: number,
  interpolationEnabled: boolean,
  incomingInterpolationBreakKeyIds: readonly string[],
): FinalizedProposal | FinalizedFailure {
  const { mapping, expectedKeyIds, operationKind } = candidate;

  // 1. Prove exact identity-set coverage.
  if (mapping.size !== expectedKeyIds.size) {
    return {
      ok: false,
      resolution: fail('incomplete-mapping', operationKind, 'Final mapping size does not match the expected identity set.'),
    };
  }
  for (const keyId of expectedKeyIds) {
    if (!mapping.has(keyId)) {
      return {
        ok: false,
        resolution: fail('incomplete-mapping', operationKind, `Final mapping is missing identity "${keyId}".`),
      };
    }
  }
  for (const keyId of mapping.keys()) {
    if (!expectedKeyIds.has(keyId)) {
      return {
        ok: false,
        resolution: fail('incomplete-mapping', operationKind, `Final mapping carries unexpected identity "${keyId}".`),
      };
    }
  }

  // 2. Prove unique in-range final frames.
  const seenFrames = new Set<number>();
  for (const frame of mapping.values()) {
    if (!isNonNegativeInteger(frame) || frame >= capacity) {
      return {
        ok: false,
        resolution: fail('over-capacity', operationKind, `Final frame ${frame} is outside capacity ${capacity}.`),
      };
    }
    if (seenFrames.has(frame)) {
      return {
        ok: false,
        resolution: fail('duplicate-destination-frame', operationKind, `Duplicate final frame ${frame}.`),
      };
    }
    seenFrames.add(frame);
  }

  const semanticSelectedAppFrame = candidate.selectedKeyId === null ? null : mapping.get(candidate.selectedKeyId) ?? null;
  if ((candidate.nextRecords === undefined) !== (candidate.semanticDelta === undefined)) {
    return {
      ok: false,
      resolution: fail('invalid-semantic-delta', operationKind, 'Semantic operations require both complete next records and a declared delta.'),
    };
  }
  if (candidate.nextRecords && candidate.semanticDelta) {
    // Operation builders validate against their authoritative current records
    // before finalization. This branch independently proves that the complete
    // next-record collection and the final mapping describe the same exact
    // identity/frame set before projection metadata is derived.
    if (candidate.nextRecords.length !== mapping.size
      || candidate.nextRecords.some((record) => mapping.get(record.keyId) !== record.appFrame)) {
      return {
        ok: false,
        resolution: fail('invalid-semantic-delta', operationKind, 'Complete next records disagree with the final mapping.'),
      };
    }
  }

  const effectiveIncomingBreakKeyIds = candidate.nextIncomingInterpolationBreakKeyIds
    ?? incomingInterpolationBreakKeyIds;
  const breakValidation = validateIncomingInterpolationBreakKeyIds(
    effectiveIncomingBreakKeyIds,
    expectedKeyIds,
  );
  if (!breakValidation.ok) {
    return {
      ok: false,
      resolution: fail('invalid-semantic-delta', operationKind, breakValidation.error),
    };
  }

  // 3. Derive the shared physical projection (ordering, interiors, cells).
  const projection = buildProjectionFromMapping(
    mapping,
    capacity,
    interpolationEnabled,
    breakValidation.value,
  );
  const { orderedKeyIds, assignments, cells: cellsFrozen, generatedCells: generatedCellsFrozen } = projection;

  // 4. Derive identity changes from the validated before/after frames.
  const changes: PhysicPaintRotoPhysicalIdentityChange[] = [];
  for (const keyId of orderedKeyIds) {
    const before = identities.framesByKeyId.get(keyId);
    const after = mapping.get(keyId);
    if (before === undefined || after === undefined) continue;
    if (before === after) continue;
    const role = candidate.roleByKeyId.get(keyId) ?? 'moved';
    changes.push(
      Object.freeze({
        keyId,
        beforeAppFrame: before,
        afterAppFrame: after,
        role,
      }) as PhysicPaintRotoPhysicalIdentityChange,
    );
  }
  const changesFrozen = Object.freeze(changes) as readonly PhysicPaintRotoPhysicalIdentityChange[];

  // 5. Resolve deterministic selection.
  const selectedKeyId = candidate.selectedKeyId;
  const selectedAppFrame = semanticSelectedAppFrame;

  // 6. Build affectedKeyIds: shifted identities plus every removed identity.
  const affectedList: string[] = changesFrozen.map((change) => change.keyId);
  for (const removedKeyId of candidate.removedKeyIds) {
    if (!affectedList.includes(removedKeyId)) {
      affectedList.push(removedKeyId);
    }
  }
  if (candidate.semanticDelta?.kind === 'insert-empty-segment'
    && !affectedList.includes(candidate.semanticDelta.insertedKeyId)) {
    affectedList.push(candidate.semanticDelta.insertedKeyId);
  }
  if (candidate.semanticDelta?.kind === 'duplicate-key' && !affectedList.includes(candidate.semanticDelta.newKeyId)) {
    affectedList.push(candidate.semanticDelta.newKeyId);
  }
  if (candidate.semanticDelta?.kind === 'paste-key') {
    const affectedKeyId = candidate.semanticDelta.destinationKeyId ?? candidate.semanticDelta.newKeyId;
    if (affectedKeyId !== null && !affectedList.includes(affectedKeyId)) affectedList.push(affectedKeyId);
  }
  const affectedKeyIds = Object.freeze(affectedList) as readonly string[];

  // 7. Build concise status.
  const code: 'ok' | 'ok-no-change' = candidate.changed ? 'ok' : 'ok-no-change';
  const text = buildStatusText(operationKind, candidate.changed, selectedAppFrame, candidate.removedKeyIds);

  const status = Object.freeze({
    operationKind,
    changed: candidate.changed,
    affectedKeyIds,
    affectedCount: affectedKeyIds.length,
    code,
    text,
  }) as PhysicPaintRotoPhysicalEditStatus;

  const proposal = Object.freeze({
    mapping: asImmutableMap(mapping),
    orderedKeyIds,
    assignments,
    cells: cellsFrozen,
    generatedCells: generatedCellsFrozen,
    selectedKeyId,
    selectedAppFrame,
    changes: changesFrozen,
    removedKeyId: candidate.removedKeyId,
    removedKeyIds: candidate.removedKeyIds,
    drag: candidate.drag,
    nextRecords: candidate.nextRecords ?? null,
    nextLoopClips: candidate.nextLoopClips ?? null,
    nextIncomingInterpolationBreakKeyIds:
      candidate.nextIncomingInterpolationBreakKeyIds ?? null,
    semanticDelta: candidate.semanticDelta ?? null,
    status,
  }) as PhysicPaintRotoPhysicalEditProposal;

  return { ok: true, proposal };
}

function buildStatusText(
  operationKind: PhysicPaintRotoPhysicalEditOperationKind,
  changed: boolean,
  selectedAppFrame: number | null,
  removedKeyIds: readonly string[],
): string {
  if (operationKind === 'insert-slot') {
    if (!changed) return 'No change';
    return selectedAppFrame === null
      ? 'Inserted slot'
      : `Inserted slot at frame ${selectedAppFrame}`;
  }
  if (operationKind === 'insert-empty-segment') {
    return selectedAppFrame === null
      ? 'Inserted empty key'
      : `Inserted empty key at frame ${selectedAppFrame}`;
  }
  if (operationKind === 'delete-key') {
    if (removedKeyIds.length === 0) return 'No change';
    return 'Deleted key';
  }
  if (operationKind === 'delete-key-rail') {
    if (removedKeyIds.length === 0) return 'No change';
    return 'Key Rail deleted';
  }
  if (operationKind === 'delete-key-group') {
    if (removedKeyIds.length === 0) return 'No change';
    return 'Keys deleted';
  }
  if (operationKind === 'move-key') {
    if (!changed) return 'No change';
    return selectedAppFrame === null
      ? 'Moved key'
      : `Moved key to frame ${selectedAppFrame}`;
  }
  if (operationKind === 'move-key-rail') {
    if (!changed) return 'No change';
    return selectedAppFrame === null ? 'Key Rail moved' : `Key Rail moved to frame ${selectedAppFrame}`;
  }
  if (operationKind === 'move-key-group') {
    if (!changed) return 'No change';
    return 'Keys moved';
  }
  if (operationKind === 'move-group') {
    if (!changed) return 'No change';
    return 'Group moved';
  }
  if (operationKind === 'force-spacing') {
    if (!changed) return 'No change';
    return 'Force Spacing applied';
  }
  if (operationKind === 'duplicate-key') {
    return selectedAppFrame === null ? 'Duplicated key' : `Duplicated key to frame ${selectedAppFrame}`;
  }
  if (operationKind === 'paste-key') {
    return selectedAppFrame === null ? 'Pasted key' : `Pasted key at frame ${selectedAppFrame}`;
  }
  if (operationKind === 'scissor-key-rail') {
    return selectedAppFrame === null
      ? 'Split Key Rail'
      : `Split Key Rail before frame ${selectedAppFrame}`;
  }
  if (operationKind === 'push-rails') {
    if (!changed) return 'No change';
    return selectedAppFrame === null
      ? 'Rails pushed'
      : `Rails pushed to frame ${selectedAppFrame}`;
  }
  if (operationKind === 'move-rails') {
    if (!changed) return 'No change';
    return 'Rails moved';
  }
  if (operationKind === 'spacing-on-set') {
    if (!changed) return 'No change';
    return 'Key Spacing applied';
  }
  return 'No change';
}

function validateLinkedSourceSpacingScopes(
  value: unknown,
  scopeKeyIds: readonly string[] | null | undefined,
  identities: ValidatedIdentities,
  loopClips: readonly PhysicPaintRotoLoopClip[],
): { ok: true; scopes: readonly PhysicPaintRotoLinkedSourceSpacingScope[] } | { ok: false; resolution: PhysicPaintRotoPhysicalEditResolution } {
  const invalid = (text: string) => ({
    ok: false as const,
    resolution: fail('invalid-linked-source-spacing-scope', 'force-spacing', text),
  });
  if (!Array.isArray(value) || value.length === 0) {
    return invalid('Linked source spacing authorization must contain at least one ordered source cycle.');
  }
  const scopes: PhysicPaintRotoLinkedSourceSpacingScope[] = [];
  const seenCycleIds = new Set<string>();
  const seenSelectedKeyIds = new Set<string>();
  let previousSelectedTail = -1;
  for (const entry of value) {
    if (!isRecord(entry)) return invalid('Linked source spacing authorization members must be records.');
    const sourceKeyIds = entry.sourceKeyIds;
    const selectedSourceKeyIds = entry.selectedSourceKeyIds;
    if (!Array.isArray(sourceKeyIds) || sourceKeyIds.length < 2 || !sourceKeyIds.every(isBoundedKeyId)) {
      return invalid('Linked source spacing authorization requires an ordered source cycle.');
    }
    if (new Set(sourceKeyIds).size !== sourceKeyIds.length) {
      return invalid('Linked source spacing source cycle must contain unique identities.');
    }
    const sourceCycleId = getPhysicsPaintRotoSourceCycleId(sourceKeyIds);
    if (entry.sourceCycleId !== sourceCycleId || seenCycleIds.has(sourceCycleId)) {
      return invalid('Linked source spacing cycle identity is stale or duplicated.');
    }
    const exactCycleExists = loopClips.some((loopClip) => (
      loopClip.sourceKeyIds.length === sourceKeyIds.length
      && loopClip.sourceKeyIds.every((keyId, index) => keyId === sourceKeyIds[index])
    ));
    if (!exactCycleExists) return invalid('Linked source spacing source cycle is not current.');
    const sourceFrames = sourceKeyIds.map((keyId) => identities.framesByKeyId.get(keyId));
    if (sourceFrames.some((frame) => frame === undefined)
      || sourceFrames.some((frame, index) => index > 0 && frame! <= sourceFrames[index - 1]!)) {
      return invalid('Linked source spacing source cycle contains stale or reordered identities.');
    }
    if (!Array.isArray(selectedSourceKeyIds) || selectedSourceKeyIds.length < 2 || !selectedSourceKeyIds.every(isBoundedKeyId)) {
      return invalid('Linked source spacing requires at least two selected source positions.');
    }
    if (new Set(selectedSourceKeyIds).size !== selectedSourceKeyIds.length
      || selectedSourceKeyIds.some((keyId) => seenSelectedKeyIds.has(keyId))) {
      return invalid('Linked source spacing selected identities must be unique across cycles.');
    }
    const selectedSet = new Set(selectedSourceKeyIds);
    const orderedSelected = sourceKeyIds.filter((keyId) => selectedSet.has(keyId));
    if (orderedSelected.length !== selectedSourceKeyIds.length
      || orderedSelected.some((keyId, index) => keyId !== selectedSourceKeyIds[index])) {
      return invalid('Linked source spacing selection contains stale or reordered source identities.');
    }
    const selectedFrames = selectedSourceKeyIds.map((keyId) => identities.framesByKeyId.get(keyId)!);
    if (selectedFrames[0] <= previousSelectedTail) {
      return invalid('Linked source spacing cycle groups must be ordered left-to-right without overlap.');
    }
    previousSelectedTail = selectedFrames[selectedFrames.length - 1];
    seenCycleIds.add(sourceCycleId);
    selectedSourceKeyIds.forEach((keyId) => seenSelectedKeyIds.add(keyId));
    scopes.push(Object.freeze({
      sourceCycleId,
      sourceKeyIds: Object.freeze([...sourceKeyIds]),
      selectedSourceKeyIds: Object.freeze([...selectedSourceKeyIds]),
    }) as PhysicPaintRotoLinkedSourceSpacingScope);
  }
  const flattenedSelectedKeyIds = scopes.flatMap((scope) => scope.selectedSourceKeyIds);
  if (!Array.isArray(scopeKeyIds)
    || !scopeKeyIds.every(isBoundedKeyId)
    || scopeKeyIds.length !== flattenedSelectedKeyIds.length
    || scopeKeyIds.some((keyId, index) => keyId !== flattenedSelectedKeyIds[index])) {
    return invalid('Force Spacing scope does not match the authorized linked source selection.');
  }
  return { ok: true, scopes: Object.freeze(scopes) };
}

function validateSemanticInputRecords(
  input: unknown,
  identities: ValidatedIdentities,
  capacity: number,
  operationKind: 'insert-empty-segment' | 'duplicate-key' | 'paste-key' | 'paste-key-group',
): { ok: true; records: readonly PhysicPaintRotoRealKeyRecord[] } | { ok: false; resolution: PhysicPaintRotoPhysicalEditResolution } {
  let records: readonly PhysicPaintRotoRealKeyRecord[];
  try {
    records = parsePhysicPaintRotoRealKeyRecordCollection(input, capacity);
  } catch (error) {
    return { ok: false, resolution: fail('malformed-records', operationKind, error instanceof Error ? error.message : 'Physical records are malformed.') };
  }
  if (records.length !== identities.ordered.length) {
    return { ok: false, resolution: fail('malformed-records', operationKind, 'Physical records and identities have different sizes.') };
  }
  for (const record of records) {
    if (identities.framesByKeyId.get(record.keyId) !== record.appFrame) {
      return { ok: false, resolution: fail('malformed-records', operationKind, 'Physical records and identities disagree.') };
    }
  }
  return { ok: true, records };
}

// ---------------------------------------------------------------------------
// Sole exported behavior seam.
// ---------------------------------------------------------------------------

/**
 * Project the current physical timeline from validated identity placement,
 * bounded capacity, and the interpolation-enabled projection flag.
 *
 * This is the one shared read-only projection seam consumed by current-state
 * callers (store, selectors, `rotoPhysicalTimelinePorts`) and reused internally
 * by the edit resolver's finalizer. Its closed result either contains
 * deterministic ordered assignments/key IDs, exact runtime generated interiors,
 * and bounded real/generated/empty physical cells, or a typed failure with no
 * partial projection.
 *
 * Validation: capacity is bounded; every identity has a bounded non-empty
 * `keyId` and an integer `appFrame` in `0 .. capacity - 1`; IDs and frames are
 * unique. No invalid collection is silently filtered, sorted into validity,
 * deduplicated, clamped, or translated.
 */
export function projectPhysicPaintRotoPhysicalTimeline(
  input: PhysicPaintRotoPhysicalTimelineProjectionInput,
): PhysicPaintRotoPhysicalTimelineProjectionResolution {
  if (!isRecord(input)) {
    return projectionFailure('malformed-target', null, 'Projection input must be a record.');
  }

  if (!validateCapacity(input.capacity)) {
    return projectionFailure('invalid-capacity', null, 'Capacity must be an integer from 1 through PHYSIC_PAINT_MAX_APPLY_FRAMES.');
  }

  const identitiesResult = validateIdentities(input.identities, input.capacity, null);
  if (!identitiesResult.ok) {
    const failure = (identitiesResult.resolution as { ok: false; failure: PhysicPaintRotoPhysicalEditFailure }).failure;
    return projectionFailure(failure.code, failure.operationKind, failure.text);
  }
  const identities = identitiesResult.value;
  const incomingBreaksResult = validateIncomingInterpolationBreakKeyIds(
    input.incomingInterpolationBreakKeyIds,
    identities.keyIds,
  );
  if (!incomingBreaksResult.ok) {
    return projectionFailure('malformed-target', null, incomingBreaksResult.error);
  }

  const mapping = new Map<string, number>();
  for (const identity of identities.ordered) {
    mapping.set(identity.keyId, identity.appFrame);
  }

  const projection = buildProjectionFromMapping(
    mapping,
    input.capacity,
    input.interpolationEnabled,
    incomingBreaksResult.value,
  );
  return Object.freeze({
    ok: true as const,
    projection,
  }) as PhysicPaintRotoPhysicalTimelineProjectionResolution;
}

function projectionFailure(
  code: PhysicPaintRotoPhysicalEditFailureCode,
  operationKind: PhysicPaintRotoPhysicalEditOperationKind | null,
  text: string,
): PhysicPaintRotoPhysicalTimelineProjectionResolution {
  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({ code, operationKind, text }) as PhysicPaintRotoPhysicalEditFailure,
  }) as PhysicPaintRotoPhysicalTimelineProjectionResolution;
}

/**
 * Resolve a single physical timeline edit intent into one immutable complete
 * identity-to-frame proposal or a stable failure.
 *
 * Validation order: capacity is bounded per the plan assumptions; every input
 * identity has an allowed non-empty `keyId` and an integer `appFrame` in
 * `0 .. capacity - 1`; IDs and frames are unique; the operation identity
 * exists. No invalid collection is silently filtered, sorted into validity,
 * deduplicated, clamped, or translated.
 *
 * Every successful result routes through one common finalizer that proves
 * exact identity-set coverage, unique in-range final frames, and deterministic
 * ascending physical order before deriving strict-interior generated cells,
 * bounded physical cells, deterministic selection, and immutable change/status
 * metadata.
 */
export function resolvePhysicPaintRotoPhysicalEdit(
  input: PhysicPaintRotoPhysicalEditInput,
): PhysicPaintRotoPhysicalEditResolution {
  if (!isRecord(input)) {
    return fail('malformed-target', null, 'Resolver input must be a record.');
  }

  if (!isRecord(input.intent)) {
    return fail('malformed-target', null, 'Intent must be a discriminated record.');
  }
  const operationKind = isResolverOperationKind(input.intent.kind) ? input.intent.kind : null;
  if (operationKind === null) {
    return fail('malformed-target', null, 'Unknown physical edit intent kind.');
  }

  if (!validateCapacity(input.capacity)) {
    return fail('invalid-capacity', operationKind, 'Capacity must be an integer from 1 through PHYSIC_PAINT_MAX_APPLY_FRAMES.');
  }
  if (!isNonNegativeInteger(input.parentEndExclusive)) {
    return fail('malformed-target', operationKind, 'Parent end must be a nonnegative integer.');
  }

  const identitiesResult = validateIdentities(input.identities, input.capacity, operationKind);
  if (!identitiesResult.ok) return identitiesResult.resolution;
  const identities = identitiesResult.value;
  const incomingBreaksResult = validateIncomingInterpolationBreakKeyIds(
    input.incomingInterpolationBreakKeyIds,
    identities.keyIds,
  );
  if (!incomingBreaksResult.ok) {
    return fail('malformed-target', operationKind, incomingBreaksResult.error);
  }
  const incomingInterpolationBreakKeyIds = incomingBreaksResult.value;

  const loopClipsResult = validateEditLoopClips(input.loopClips, operationKind);
  if (!loopClipsResult.ok) return loopClipsResult.resolution;
  const loopClips = loopClipsResult.value;

  const intent = input.intent;
  if (intent.kind === 'insert-slot') {
    if (!isBoundedKeyId(intent.selectedKeyId)) {
      return fail('malformed-identity', operationKind, 'Insert requires a bounded selectedKeyId.');
    }
    if (!identities.keyIds.has(intent.selectedKeyId)) {
      return fail('unknown-operation-identity', operationKind, `Insert targets unknown identity "${intent.selectedKeyId}".`);
    }
    if (identities.ordered.length === 0) {
      return fail('empty-key-set', operationKind, 'Insert requires at least one real key.');
    }
    // 43.2 ordinary-edit ownership guard (CR-01): the right ripple moves every
    // key at appFrame >= selectedFrame. When ANY of them is Group-referenced,
    // the insert would shift Group-owned source keys against their unchanged
    // lifecycle records — fail closed. No suppression is possible for a right
    // ripple (the pinned key cannot share the opened slot), so the only safe
    // path is an empty-frame insert-empty-segment.
    const loopReferencedKeyIds = new Set(loopClips.flatMap((clip) => clip.sourceKeyIds));
    const selectedFrame = identities.framesByKeyId.get(intent.selectedKeyId) as number;
    const rippledGroupKeys = identities.ordered.filter(
      (identity) => identity.appFrame >= selectedFrame && loopReferencedKeyIds.has(identity.keyId),
    );
    if (rippledGroupKeys.length > 0) {
      return fail('loop-source-key-insert-rejected', operationKind, loopSourceKeyInsertRejectedText(rippledGroupKeys.length));
    }
    const candidate = buildInsertCandidate(identities, intent.selectedKeyId);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'insert-empty-segment') {
    if (!isNonNegativeInteger(intent.destinationAppFrame) || intent.destinationAppFrame >= input.capacity) {
      return fail('out-of-range-frame', operationKind, 'Empty-segment destination is outside capacity.');
    }
    if (!isBoundedKeyId(intent.insertedKeyId) || identities.keyIds.has(intent.insertedKeyId)) {
      return fail('duplicate-id', operationKind, 'Empty-segment insert requires one fresh bounded identity.');
    }
    if (!isPhysicPaintRotoRealKeyPayload(intent.blankPayload)) {
      return fail('malformed-payload', operationKind, 'Empty-segment blank payload is malformed.');
    }
    const recordsResult = validateSemanticInputRecords(
      input.records,
      identities,
      input.capacity,
      'insert-empty-segment',
    );
    if (!recordsResult.ok) return recordsResult.resolution;
    if (recordsResult.records.some((record) => record.appFrame === intent.destinationAppFrame)) {
      return fail('duplicate-destination-frame', operationKind, 'Empty-segment destination is occupied.');
    }
    const currentProjection = buildProjectionFromMapping(
      new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame])),
      input.capacity,
      input.interpolationEnabled,
      incomingInterpolationBreakKeyIds,
    );
    if (currentProjection.cells[intent.destinationAppFrame]?.kind !== 'empty') {
      return fail('malformed-target', operationKind, 'Empty-segment destination is generated or render-only.');
    }
    if (loopClips.length > 0) {
      const loopContext = derivePhysicPaintRotoLoopRanges({
        identities: identities.ordered,
        loopClips,
        capacity: input.capacity,
        interpolationEnabled: input.interpolationEnabled,
      });
      if (resolvePhysicPaintRotoLoopFrame(loopContext, intent.destinationAppFrame).kind !== 'empty') {
        return fail('malformed-target', operationKind, 'Empty-segment destination is linked.');
      }
    }
    const candidate = buildInsertEmptySegmentCandidate(
      identities,
      recordsResult.records,
      intent,
      incomingInterpolationBreakKeyIds,
    );
    const finalized = finalizeProposal(
      candidate,
      identities,
      input.capacity,
      input.interpolationEnabled,
      incomingInterpolationBreakKeyIds,
    );
    if (!finalized.ok) return finalized.resolution;
    const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
      operationKind: 'insert-empty-segment',
      currentRecords: recordsResult.records,
      nextRecords: finalized.proposal.nextRecords,
      semanticDelta: finalized.proposal.semanticDelta,
      capacity: input.capacity,
      selectedKeyId: finalized.proposal.selectedKeyId,
      selectedAppFrame: finalized.proposal.selectedAppFrame,
    });
    if (!semanticValidation.ok) return fail('invalid-semantic-delta', operationKind, semanticValidation.error);
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'delete-key') {
    if (!isBoundedKeyId(intent.selectedKeyId)) {
      return fail('malformed-identity', operationKind, 'Delete requires a bounded selectedKeyId.');
    }
    if (identities.ordered.length === 0) {
      return fail('empty-key-set', operationKind, 'Delete requires at least one real key.');
    }
    if (!identities.keyIds.has(intent.selectedKeyId)) {
      return fail('unknown-operation-identity', operationKind, `Delete targets unknown identity "${intent.selectedKeyId}".`);
    }
    // D-07: source-cycle key deletion is rejected while any loop references
    // the cycle — fail-closed with the locked copy (Cut-tool precedent).
    const referencingLoops = countLoopsReferencingSourceKey(loopClips, intent.selectedKeyId);
    if (referencingLoops > 0) {
      return fail('loop-source-key-delete-rejected', operationKind, loopSourceKeyDeleteRejectedText(referencingLoops));
    }
    const candidate = {
      ...buildDeleteCandidate(
        identities,
        intent.selectedKeyId,
        new Set(loopClips.flatMap((clip) => clip.sourceKeyIds)),
      ),
      nextIncomingInterpolationBreakKeyIds: Object.freeze(
        incomingInterpolationBreakKeyIds.filter((keyId) => keyId !== intent.selectedKeyId),
      ),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'delete-key-rail') {
    if (!Array.isArray(intent.keyIds) || intent.keyIds.length === 0) {
      return fail('malformed-identity', operationKind, 'Key Rail delete requires a non-empty keyIds array.');
    }
    const seenKeyIds = new Set<string>();
    for (const keyId of intent.keyIds) {
      if (!isBoundedKeyId(keyId)) {
        return fail('malformed-identity', operationKind, 'Key Rail delete requires bounded keyIds.');
      }
      if (seenKeyIds.has(keyId)) {
        return fail('duplicate-id', operationKind, `Duplicate keyId "${keyId}".`);
      }
      seenKeyIds.add(keyId);
      if (!identities.keyIds.has(keyId)) {
        return fail('unknown-operation-identity', operationKind, `Key Rail delete targets unknown identity "${keyId}".`);
      }
      const referencingLoops = countLoopsReferencingSourceKey(loopClips, keyId);
      if (referencingLoops > 0) {
        return fail('loop-source-key-delete-rejected', operationKind, loopSourceKeyDeleteRejectedText(referencingLoops));
      }
    }

    const groupOwnedKeyIds = new Set<string>();
    for (const clip of loopClips) {
      clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    if (intent.keyIds.some((keyId) => groupOwnedKeyIds.has(keyId))) {
      return fail('malformed-target', operationKind, 'Key Rail delete requires ordinary real-key members outside Group ownership.');
    }

    const segments = deriveKeyRailSegments({
      orderedRealKeys: identities.ordered,
      incomingInterpolationBreakKeyIds: new Set(incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds,
    });
    const matchingSegment = segments.find((segment) => (
      segment.keyIds.length === intent.keyIds.length
      && segment.keyIds.every((keyId, index) => keyId === intent.keyIds[index])
    ));
    if (!matchingSegment) {
      return fail('malformed-target', operationKind, 'Key Rail delete members must match exactly one current derived segment.');
    }

    const removalSet = new Set(intent.keyIds);
    const mapping = new Map<string, number>();
    const expectedKeyIds = new Set<string>();
    let successorKeyId: string | null = null;
    let previousKeyId: string | null = null;
    for (const identity of identities.ordered) {
      if (removalSet.has(identity.keyId)) continue;
      mapping.set(identity.keyId, identity.appFrame);
      expectedKeyIds.add(identity.keyId);
      if (successorKeyId === null && identity.appFrame > matchingSegment.lastKeyFrame) {
        successorKeyId = identity.keyId;
      }
      if (identity.appFrame < matchingSegment.firstKeyFrame) previousKeyId = identity.keyId;
    }

    const candidate: Candidate = {
      mapping,
      expectedKeyIds,
      removedKeyId: null,
      removedKeyIds: Object.freeze([...intent.keyIds]),
      selectedKeyId: successorKeyId ?? previousKeyId,
      operationKind: 'delete-key-rail',
      changed: true,
      roleByKeyId: new Map(),
      drag: null,
      nextIncomingInterpolationBreakKeyIds: Object.freeze(
        deriveDeleteKeyRailIncomingInterpolationBreakKeyIds({
          memberKeyIds: intent.keyIds,
          lastKeyFrame: matchingSegment.lastKeyFrame,
          groupOwnedKeyIds,
          mapping,
          incomingInterpolationBreakKeyIds,
        }),
      ),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'delete-key-group') {
    if (!Array.isArray(intent.keyIds) || intent.keyIds.length === 0) {
      return fail('malformed-identity', operationKind, 'Group delete requires a non-empty keyIds array.');
    }
    const seenKeyIds = new Set<string>();
    for (const keyId of intent.keyIds) {
      if (!isBoundedKeyId(keyId)) {
        return fail('malformed-identity', operationKind, 'Group delete requires bounded keyIds.');
      }
      if (seenKeyIds.has(keyId)) {
        return fail('duplicate-id', operationKind, `Duplicate keyId "${keyId}".`);
      }
      seenKeyIds.add(keyId);
    }
    if (identities.ordered.length === 0) {
      return fail('empty-key-set', operationKind, 'Group delete requires at least one real key.');
    }
    for (const keyId of seenKeyIds) {
      if (!identities.keyIds.has(keyId)) {
        // Idempotency guard: an already-absent or unknown identity fails
        // closed with no proposal (37-GROUP-DELETE).
        return fail('unknown-operation-identity', operationKind, `Group delete targets unknown identity "${keyId}".`);
      }
    }
    // D-07: any linked source-cycle member rejects the whole group delete.
    for (const keyId of intent.keyIds) {
      const referencingLoops = countLoopsReferencingSourceKey(loopClips, keyId);
      if (referencingLoops > 0) {
        return fail('loop-source-key-delete-rejected', operationKind, loopSourceKeyDeleteRejectedText(referencingLoops));
      }
    }
    const removedBreakOwners = new Set(intent.keyIds);
    const candidate = {
      ...buildDeleteGroupCandidate(
        identities,
        intent.keyIds,
        new Set(loopClips.flatMap((clip) => clip.sourceKeyIds)),
      ),
      nextIncomingInterpolationBreakKeyIds: Object.freeze(
        incomingInterpolationBreakKeyIds.filter((keyId) => !removedBreakOwners.has(keyId)),
      ),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'duplicate-key') {
    if (!isBoundedKeyId(intent.sourceKeyId) || !isBoundedKeyId(intent.newKeyId) || intent.sourceKeyId === intent.newKeyId) {
      return fail('malformed-identity', operationKind, 'Duplicate source and fresh identities must be distinct bounded IDs.');
    }
    if (!identities.keyIds.has(intent.sourceKeyId)) {
      return fail('unknown-operation-identity', operationKind, `Duplicate source identity "${intent.sourceKeyId}" does not exist.`);
    }
    if (identities.keyIds.has(intent.newKeyId)) {
      return fail('duplicate-id', operationKind, `Duplicate new identity "${intent.newKeyId}" is not fresh.`);
    }
    const recordsResult = validateSemanticInputRecords(input.records, identities, input.capacity, 'duplicate-key');
    if (!recordsResult.ok) return recordsResult.resolution;
    // 43.2 ordinary-edit ownership guard (CR-01): the right ripple moves every
    // key at appFrame >= destination (source + 1). When ANY of them is
    // Group-referenced, the duplicate would shift Group-owned source keys
    // against their unchanged lifecycle records — fail closed. The source key
    // itself never moves, so duplicating a Group source key stays legal when
    // no later key is pinned.
    const sourceRecord = recordsResult.records.find((record) => record.keyId === intent.sourceKeyId) as PhysicPaintRotoRealKeyRecord;
    const duplicateDestination = sourceRecord.appFrame + 1;
    const loopReferencedKeyIds = new Set(loopClips.flatMap((clip) => clip.sourceKeyIds));
    const rippledGroupKeys = identities.ordered.filter(
      (identity) => identity.appFrame >= duplicateDestination && loopReferencedKeyIds.has(identity.keyId),
    );
    if (rippledGroupKeys.length > 0) {
      return fail('loop-source-key-duplicate-rejected', operationKind, loopSourceKeyDuplicateRejectedText(rippledGroupKeys.length));
    }
    const candidate = buildDuplicateCandidate(identities, recordsResult.records, intent.sourceKeyId, intent.newKeyId);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
      operationKind: 'duplicate-key',
      currentRecords: recordsResult.records,
      nextRecords: finalized.proposal.nextRecords,
      semanticDelta: finalized.proposal.semanticDelta,
      capacity: input.capacity,
      selectedKeyId: finalized.proposal.selectedKeyId,
      selectedAppFrame: finalized.proposal.selectedAppFrame,
    });
    if (!semanticValidation.ok) return fail('invalid-semantic-delta', operationKind, semanticValidation.error);
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'paste-key') {
    if (!isNonNegativeInteger(intent.destinationAppFrame) || intent.destinationAppFrame >= input.capacity) {
      return fail('out-of-range-frame', operationKind, 'Paste destination is outside capacity.');
    }
    if (!isPhysicPaintRotoRealKeyPayload(intent.clipboardPayload)) {
      return fail('malformed-payload', operationKind, 'Paste clipboard payload is malformed.');
    }
    if ((intent.destinationKeyId === null) === (intent.newKeyId === null)) {
      return fail('invalid-semantic-delta', operationKind, 'Paste must declare either one existing destination identity or one fresh identity.');
    }
    const recordsResult = validateSemanticInputRecords(input.records, identities, input.capacity, 'paste-key');
    if (!recordsResult.ok) return recordsResult.resolution;
    if (intent.destinationKeyId === null) {
      if (!isBoundedKeyId(intent.newKeyId) || identities.keyIds.has(intent.newKeyId)) {
        return fail('duplicate-id', operationKind, 'Paste-to-empty requires one fresh bounded identity.');
      }
      if (recordsResult.records.some((record) => record.appFrame === intent.destinationAppFrame)) {
        return fail('duplicate-destination-frame', operationKind, 'Paste-to-empty destination is occupied.');
      }
    } else {
      if (!isBoundedKeyId(intent.destinationKeyId) || intent.newKeyId !== null) {
        return fail('malformed-identity', operationKind, 'Paste-to-existing destination identity is malformed.');
      }
      const destination = recordsResult.records.find((record) => record.keyId === intent.destinationKeyId);
      if (!destination || destination.appFrame !== intent.destinationAppFrame) {
        return fail('unknown-operation-identity', operationKind, 'Paste-to-existing destination identity and frame disagree.');
      }
    }
    const candidate = buildPasteCandidate(identities, recordsResult.records, intent, incomingInterpolationBreakKeyIds);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
      operationKind: 'paste-key',
      currentRecords: recordsResult.records,
      nextRecords: finalized.proposal.nextRecords,
      semanticDelta: finalized.proposal.semanticDelta,
      capacity: input.capacity,
      selectedKeyId: finalized.proposal.selectedKeyId,
      selectedAppFrame: finalized.proposal.selectedAppFrame,
    });
    if (!semanticValidation.ok) return fail('invalid-semantic-delta', operationKind, semanticValidation.error);
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'paste-key-group') {
    if (!isNonNegativeInteger(intent.destinationAppFrame) || intent.destinationAppFrame >= input.capacity) {
      return fail('out-of-range-frame', operationKind, 'Group paste destination is outside capacity.');
    }
    if (!Array.isArray(intent.entries) || intent.entries.length < 2) {
      return fail('invalid-semantic-delta', operationKind, 'Group paste requires at least two entries.');
    }
    const seenNewKeyIds = new Set<string>();
    for (const entry of intent.entries) {
      if (!isRecord(entry)) {
        return fail('malformed-target', operationKind, 'Group paste entries must be records.');
      }
      if (!isPhysicPaintRotoRealKeyPayload(entry.payload)) {
        return fail('malformed-payload', operationKind, 'Group paste entry payload is malformed.');
      }
      if (!isNonNegativeInteger(entry.sourceAppFrame)) {
        return fail('malformed-target', operationKind, 'Group paste entry source frame is malformed.');
      }
      if (!isBoundedKeyId(entry.sourceKeyId) || !isBoundedKeyId(entry.newKeyId)) {
        return fail('malformed-identity', operationKind, 'Group paste entry identities must be bounded IDs.');
      }
      if (identities.keyIds.has(entry.newKeyId) || seenNewKeyIds.has(entry.newKeyId)) {
        return fail('duplicate-id', operationKind, 'Group paste requires fresh bounded identities.');
      }
      seenNewKeyIds.add(entry.newKeyId);
    }
    const recordsResult = validateSemanticInputRecords(input.records, identities, input.capacity, 'paste-key-group');
    if (!recordsResult.ok) return recordsResult.resolution;
    const candidateResult = buildPasteKeyGroupCandidate(identities, recordsResult.records, intent, input.capacity);
    if (!candidateResult.ok) return candidateResult.resolution;
    const finalized = finalizeProposal(candidateResult.candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
      operationKind: 'paste-key-group',
      currentRecords: recordsResult.records,
      nextRecords: finalized.proposal.nextRecords,
      semanticDelta: finalized.proposal.semanticDelta,
      capacity: input.capacity,
      selectedKeyId: finalized.proposal.selectedKeyId,
      selectedAppFrame: finalized.proposal.selectedAppFrame,
    });
    if (!semanticValidation.ok) return fail('invalid-semantic-delta', operationKind, semanticValidation.error);
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'move-key') {
    if (!isBoundedKeyId(intent.movedKeyId)) {
      return fail('malformed-identity', operationKind, 'Move requires a bounded movedKeyId.');
    }
    if (identities.ordered.length === 0) {
      return fail('empty-key-set', operationKind, 'Move requires at least one real key.');
    }
    if (!identities.keyIds.has(intent.movedKeyId)) {
      return fail('unknown-operation-identity', operationKind, `Move targets unknown moved identity "${intent.movedKeyId}".`);
    }
    // D-11: a linked source key never moves alone — the cycle's internal
    // spacing IS the loop rhythm; only a rigid whole-cycle group drag moves it.
    if (countLoopsReferencingSourceKey(loopClips, intent.movedKeyId) > 0) {
      return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
    }
    if (intent.target === null || typeof intent.target !== 'object') {
      return fail('malformed-target', operationKind, 'Move target must be a discriminated record.');
    }
    const moveResult = buildMoveCandidate(identities, intent.movedKeyId, intent.target, input.capacity);
    if (!moveResult.ok) return moveResult.resolution;
    const finalized = finalizeProposal(moveResult.candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'force-spacing') {
    const linkedAuthorization = intent.linkedSourceSpacingScopes === undefined || intent.linkedSourceSpacingScopes === null
      ? null
      : validateLinkedSourceSpacingScopes(intent.linkedSourceSpacingScopes, intent.scopeKeyIds, identities, loopClips);
    if (linkedAuthorization !== null && !linkedAuthorization.ok) return linkedAuthorization.resolution;

    if (linkedAuthorization === null && loopClips.length > 0) {
      const scopeKeyIds = intent.scopeKeyIds ?? null;
      if (scopeKeyIds === null) {
        let linkedKeyId: string | null = null;
        for (const identity of identities.ordered) {
          if (countLoopsReferencingSourceKey(loopClips, identity.keyId) > 0) {
            linkedKeyId = identity.keyId;
            break;
          }
        }
        if (linkedKeyId !== null) {
          return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
        }
      } else {
        for (const keyId of scopeKeyIds) {
          if (countLoopsReferencingSourceKey(loopClips, keyId) > 0) {
            return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
          }
        }
      }
    }
    const spacingResult = buildForceSpacingCandidate(
      identities,
      intent.emptyFrames,
      intent.selectedKeyId,
      intent.scopeKeyIds,
      linkedAuthorization?.ok ? linkedAuthorization.scopes : null,
      loopClips,
    );
    if (!spacingResult.ok) return spacingResult.resolution;
    const finalized = finalizeProposal(spacingResult.candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'move-key-rail') {
    if (!Array.isArray(intent.memberKeyIds) || intent.memberKeyIds.length === 0) {
      return fail('malformed-identity', operationKind, 'Key Rail move requires a non-empty memberKeyIds array.');
    }
    const seenMemberKeyIds = new Set<string>();
    for (const keyId of intent.memberKeyIds) {
      if (!isBoundedKeyId(keyId)) {
        return fail('malformed-identity', operationKind, 'Key Rail move requires bounded member keyIds.');
      }
      if (seenMemberKeyIds.has(keyId)) {
        return fail('duplicate-id', operationKind, `Duplicate keyId "${keyId}".`);
      }
      seenMemberKeyIds.add(keyId);
      if (!identities.keyIds.has(keyId)) {
        return fail('unknown-operation-identity', operationKind, `Key Rail move targets unknown identity "${keyId}".`);
      }
    }
    if (!isNonNegativeInteger(intent.destinationFirstKeyAppFrame) || intent.destinationFirstKeyAppFrame >= input.capacity) {
      return fail('out-of-range-frame', operationKind, 'Key Rail move destination is outside capacity.');
    }

    const groupOwnedKeyIds = new Set<string>();
    for (const clip of loopClips) {
      clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    if (intent.memberKeyIds.some((keyId) => groupOwnedKeyIds.has(keyId))) {
      return fail('malformed-target', operationKind, 'Key Rail move requires ordinary real-key members outside Group ownership.');
    }

    const segments = deriveKeyRailSegments({
      orderedRealKeys: identities.ordered,
      incomingInterpolationBreakKeyIds: new Set(incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds,
    });
    const matchingSegment = segments.find((segment) => (
      segment.keyIds.length === intent.memberKeyIds.length
      && segment.keyIds.every((keyId, index) => keyId === intent.memberKeyIds[index])
    ));
    if (!matchingSegment) {
      return fail('malformed-target', operationKind, 'Key Rail move members must match exactly one current derived segment.');
    }

    const loopRangeContext = derivePhysicPaintRotoLoopRanges({
      identities: identities.ordered,
      loopClips,
      capacity: input.capacity,
      interpolationEnabled: input.interpolationEnabled,
    });
    const clampResult = clampPhysicPaintKeyRailDragDestination({
      memberKeyIds: intent.memberKeyIds,
      firstKeyFrame: matchingSegment.firstKeyFrame,
      lastKeyFrame: matchingSegment.lastKeyFrame,
      proposedDestinationFirstKeyAppFrame: intent.destinationFirstKeyAppFrame,
      identities: identities.ordered,
      loopRanges: loopRangeContext.ranges,
      capacity: input.capacity,
    });
    if (!clampResult.ok || clampResult.destinationFirstKeyAppFrame === matchingSegment.firstKeyFrame) {
      return fail('no-free-space-in-direction', operationKind, 'Key Rail drag has no free space in the dragged direction.');
    }

    const delta = clampResult.destinationFirstKeyAppFrame - matchingSegment.firstKeyFrame;
    const mapping = new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame] as const));
    const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
    for (const keyId of intent.memberKeyIds) {
      const currentFrame = identities.framesByKeyId.get(keyId) as number;
      mapping.set(keyId, currentFrame + delta);
      roleByKeyId.set(keyId, 'moved');
    }
    const candidate: Candidate = {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: intent.memberKeyIds[0],
      operationKind: 'move-key-rail',
      changed: true,
      roleByKeyId,
      drag: null,
      nextIncomingInterpolationBreakKeyIds: Object.freeze(
        deriveMoveKeyRailIncomingInterpolationBreakKeyIds({
          memberKeyIds: intent.memberKeyIds,
          firstKeyFrame: matchingSegment.firstKeyFrame,
          lastKeyFrame: matchingSegment.lastKeyFrame,
          groupOwnedKeyIds,
          preMoveFramesByKeyId: identities.framesByKeyId,
          mapping,
          incomingInterpolationBreakKeyIds,
        }),
      ),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'move-rails') {
    if (!Array.isArray(intent.members) || intent.members.length === 0) {
      return fail('malformed-identity', operationKind, 'Rail set move requires a non-empty members array.');
    }
    if (!Number.isInteger(intent.delta)) {
      return fail('malformed-target', operationKind, 'Rail set move requires an integer delta.');
    }

    const loopRangeContext = derivePhysicPaintRotoLoopRanges({
      identities: identities.ordered,
      loopClips,
      capacity: input.capacity,
      interpolationEnabled: input.interpolationEnabled,
    });

    // One shared pure authority validates the explicit set (exact-match
    // membership, fail-closed on stale members) AND derives the straddle
    // verdict from canonical attachment + sourceCycleId only (D-10). The Plan
    // 03 drag preview consumes the same exports, so preview-is-the-commit
    // holds (D-17).
    const setResult = derivePhysicPaintRailSetMove({
      members: intent.members,
      identities: identities.ordered,
      loopRanges: loopRangeContext.ranges,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    if (!setResult.ok) {
      return fail(setResult.code, operationKind, setResult.text);
    }
    const { movedKeyIds, movedSetBounds, straddle } = setResult;
    if (straddle !== null) {
      return fail('move-rails-source-straddle', operationKind,
        `Rail set move would move source keys shared with the fixed Group "${straddle.fixedGroupLoopId}".`);
    }

    // Clamp-and-commit: the committed delta IS the clamped delta, so the
    // preview is the commit (D-17). ok:false maps to the dedicated zero-space
    // code. This exported clamp is the ONLY set-delta authority — no second
    // clamp math anywhere.
    const clampResult = clampPhysicPaintRailSetMoveDelta({
      members: intent.members,
      identities: identities.ordered,
      loopRanges: loopRangeContext.ranges,
      loopClips,
      incomingInterpolationBreakKeyIds,
      proposedDelta: intent.delta,
      capacity: input.capacity,
    });
    if (!clampResult.ok) {
      return fail('no-free-space-in-direction', operationKind,
        'No empty space in the requested direction to move the selected set.');
    }
    const signedDelta = clampResult.delta;

    const mapping = new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame] as const));
    const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
    for (const identity of identities.ordered) {
      if (!movedKeyIds.has(identity.keyId)) continue;
      // The clamp already proved every moved member interval lands in bounds;
      // finalizeProposal re-validates every final frame.
      mapping.set(identity.keyId, identity.appFrame + signedDelta);
      roleByKeyId.set(identity.keyId, 'moved');
    }

    // Translate EVERY selected Group's lifecycle fields with the
    // buildMoveGroupNextLoopClips pattern (phaseOrigin, originalEndExclusive,
    // EVERY visibleRanges entry, EVERY frameOverrides appFrame, infinity
    // pinning) — source-attached AND duplicated placements move placement-only
    // per the 43.3 algebra. Chained across moved clips so each clip translates
    // once.
    let nextLoopClips: readonly PhysicPaintRotoLoopClip[] | null = null;
    let clipPlacementChanged = false;
    const movedClips = loopClips.filter((clip) => (
      setResult.members.some((member) => member.kind === 'loop' && member.loopId === clip.loopId)
    ));
    if (movedClips.length > 0) {
      let current = loopClips;
      for (const clip of movedClips) {
        const next = buildMoveGroupNextLoopClips(current, clip, signedDelta);
        if (next !== null) {
          current = next;
          clipPlacementChanged = true;
        }
      }
      // A zero-delta (no-change) move publishes NO clip translation: keep the
      // collection null so the prepare layer's changed === false maps to the
      // no-publish result. Only a real placement delta commits one.
      if (clipPlacementChanged) nextLoopClips = current;
    }

    // Pitfall 5: changed must account for clip placement deltas, not only the
    // key mapping — a moved set whose only movable content is duplicated
    // placements still reports changed from the placement delta.
    const changed = computeChanged(identities, mapping) || clipPlacementChanged;
    const groupOwnedKeyIds = new Set<string>();
    for (const clip of loopClips) {
      clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    const nextBreaks = derivePhysicPaintRailSetMoveIncomingInterpolationBreakKeyIds({
      delta: signedDelta,
      movedKeyIds,
      movedSetBounds,
      groupOwnedKeyIds,
      preMoveFramesByKeyId: identities.framesByKeyId,
      mapping,
      incomingInterpolationBreakKeyIds,
    });
    const candidate: Candidate = {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: null,
      operationKind: 'move-rails',
      changed,
      roleByKeyId,
      drag: null,
      ...(nextLoopClips !== null ? { nextLoopClips } : {}),
      nextIncomingInterpolationBreakKeyIds: Object.freeze(nextBreaks),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'spacing-on-set') {
    if (!Array.isArray(intent.members) || intent.members.length === 0) {
      return fail('malformed-identity', operationKind, 'Key Spacing on a rail set requires a non-empty members array.');
    }
    if (!isNonNegativeInteger(intent.emptyFrames)) {
      return fail('malformed-target', operationKind, 'Key Spacing on a rail set requires a finite non-negative emptyFrames integer.');
    }

    const loopRangeContext = derivePhysicPaintRotoLoopRanges({
      identities: identities.ordered,
      loopClips,
      capacity: input.capacity,
      interpolationEnabled: input.interpolationEnabled,
    });

    // Exact-match membership validation (move-rails precedent): stale or
    // unknown members fail closed before any destination is computed.
    const setResult = derivePhysicPaintRailSetMove({
      members: intent.members,
      identities: identities.ordered,
      loopRanges: loopRangeContext.ranges,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    if (!setResult.ok) {
      return fail(setResult.code, operationKind, setResult.text);
    }

    // D-10 straddle: a selected Loop member (source-attached OR duplicated)
    // whose source cycle is referenced by an UNSELECTED Group rejects the
    // whole intent — the family is never silently affected. Spacing resolves
    // the source cycle keys for BOTH attachment kinds (duplicated placements
    // keep placement and resolve the same source keys), so the move-rails
    // attached-only verdict does not apply here.
    const selectedLoopIds = new Set(
      setResult.members.filter((member) => member.kind === 'loop').map((member) => member.loopId),
    );
    let straddledLoopId: string | null = null;
    let fixedGroupLoopId: string | null = null;
    for (const member of setResult.members) {
      if (member.kind !== 'loop') continue;
      const range = loopRangeContext.ranges.find((candidate) => candidate.loopId === member.loopId);
      if (range === undefined) continue;
      for (const other of loopRangeContext.ranges) {
        if (selectedLoopIds.has(other.loopId) || other.sourceCycleId === undefined) continue;
        if (other.sourceCycleId === range.sourceCycleId) {
          straddledLoopId = member.loopId;
          fixedGroupLoopId = other.loopId;
          break;
        }
      }
      if (straddledLoopId !== null) break;
    }
    if (straddledLoopId !== null) {
      return fail('rails-spacing-source-straddle', operationKind,
        `Key Spacing would move source keys shared with the fixed Group "${fixedGroupLoopId}".`);
    }

    // D-24 per-rail fixed anchors: each rail anchors at its OWN first key's
    // CURRENT frame; member key i maps to anchor + i * (emptyFrames + 1). For
    // a Loop member the scope is its source cycle keys anchored at the first
    // source key's frame (placementStart === first source key frame for
    // attached Groups; duplicated placements keep placement and resolve the
    // same source keys).
    const step = intent.emptyFrames + 1;
    const mapping = new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame]));
    const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
    const selectedKeyIds = new Set<string>();
    const destinations: number[] = [];
    for (const member of setResult.members) {
      if (member.kind === 'key-rail') {
        const anchor = identities.framesByKeyId.get(member.firstKeyId);
        if (anchor === undefined) {
          return fail('unknown-operation-identity', operationKind, `Key Rail set member "${member.firstKeyId}" targets an unknown identity.`);
        }
        member.keyIds.forEach((keyId) => selectedKeyIds.add(keyId));
        member.keyIds.forEach((keyId, index) => {
          const next = anchor + index * step;
          mapping.set(keyId, next);
          destinations.push(next);
          if (next !== identities.framesByKeyId.get(keyId)) {
            roleByKeyId.set(keyId, 'reanchored');
          }
        });
      } else {
        const range = loopRangeContext.ranges.find((candidate) => candidate.loopId === member.loopId);
        if (range === undefined) {
          return fail('unknown-operation-identity', operationKind, `Loop set member "${member.loopId}" is not a member of any Group Rail.`);
        }
        const anchor = identities.framesByKeyId.get(range.sourceKeyIds[0]);
        if (anchor === undefined) {
          return fail('unknown-operation-identity', operationKind, `Loop set member "${member.loopId}" targets an unknown source identity.`);
        }
        range.sourceKeyIds.forEach((keyId) => selectedKeyIds.add(keyId));
        range.sourceKeyIds.forEach((keyId, index) => {
          const next = anchor + index * step;
          mapping.set(keyId, next);
          destinations.push(next);
          if (next !== identities.framesByKeyId.get(keyId)) {
            roleByKeyId.set(keyId, 'reanchored');
          }
        });
      }
    }

    // Hard walls (D-25): unselected keys keep their frames. Any computed
    // destination equal to an unselected key frame, or any moved key crossing
    // the left-to-right order of an unselected key, rejects the WHOLE intent
    // with zero partial proposal. Selected-selected collisions and
    // over-capacity are caught once by the common finalizer (all destinations
    // compose into ONE map — all-or-nothing by construction, Pitfall 5).
    const conflicts: number[] = [];
    for (const destination of destinations) {
      for (const identity of identities.ordered) {
        if (!selectedKeyIds.has(identity.keyId) && identity.appFrame === destination) {
          conflicts.push(destination);
          break;
        }
      }
    }
    for (const member of setResult.members) {
      const keyIds = member.kind === 'key-rail'
        ? member.keyIds
        : loopRangeContext.ranges.find((candidate) => candidate.loopId === member.loopId)!.sourceKeyIds;
      for (const keyId of keyIds) {
        const from = identities.framesByKeyId.get(keyId);
        const to = mapping.get(keyId);
        if (from === undefined || to === undefined || from === to) continue;
        for (const identity of identities.ordered) {
          if (selectedKeyIds.has(identity.keyId)) continue;
          if ((from < identity.appFrame && to > identity.appFrame)
            || (from > identity.appFrame && to < identity.appFrame)) {
            conflicts.push(identity.appFrame);
          }
        }
      }
    }
    if (conflicts.length > 0) {
      const uniqueConflicts = [...new Set(conflicts)].sort((left, right) => left - right);
      return fail('duplicate-destination-frame', operationKind,
        `Key Spacing destination frame ${uniqueConflicts[0]} is occupied by an unselected real key.`,
        uniqueConflicts);
    }

    // Break ownership travels with moved key identity (43.4 D-19). The
    // move-rails vacated-successor/landing-gap rules do NOT apply: spacing
    // never vacates the set's boundary as a block, and the landing-gap rule
    // would split respaced rails (a respaced interior key lands more than one
    // frame after its predecessor by design).
    const nextBreaks = [...incomingInterpolationBreakKeyIds].sort((left, right) => {
      const frameLeft = mapping.get(left) ?? Number.POSITIVE_INFINITY;
      const frameRight = mapping.get(right) ?? Number.POSITIVE_INFINITY;
      return frameLeft - frameRight || left.localeCompare(right);
    });

    const candidate: Candidate = {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: null,
      operationKind: 'spacing-on-set',
      changed: computeChanged(identities, mapping),
      roleByKeyId,
      drag: null,
      // 46 UAT R6: spacing moves the source cycle keys, so the loop's lifecycle
      // (originalEndExclusive/visibleRanges) must be retimed to cover the moved
      // keys — otherwise the rail band ends at the stale originalEndExclusive,
      // before the respaced keys. Mirrors force-spacing's retime (D-24).
      nextLoopClips: computeSourceAttachedLoopPlacementFollow(
        identities,
        loopClips,
        mapping,
        () => true,
        true,
      ),
      nextIncomingInterpolationBreakKeyIds: Object.freeze(nextBreaks),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'move-key-group') {
    if (!Array.isArray(intent.movedKeyIds) || intent.movedKeyIds.length === 0) {
      return fail('malformed-identity', operationKind, 'Group move requires a non-empty movedKeyIds array.');
    }
    const seenMovedKeyIds = new Set<string>();
    for (const movedKeyId of intent.movedKeyIds) {
      if (!isBoundedKeyId(movedKeyId)) {
        return fail('malformed-identity', operationKind, 'Group move requires bounded moved keyIds.');
      }
      if (seenMovedKeyIds.has(movedKeyId)) {
        return fail('duplicate-id', operationKind, `Duplicate moved keyId "${movedKeyId}".`);
      }
      seenMovedKeyIds.add(movedKeyId);
    }
    if (identities.ordered.length === 0) {
      return fail('empty-key-set', operationKind, 'Group move requires at least one real key.');
    }
    for (const movedKeyId of seenMovedKeyIds) {
      if (!identities.keyIds.has(movedKeyId)) {
        return fail('unknown-operation-identity', operationKind, `Group move targets unknown moved identity "${movedKeyId}".`);
      }
    }
    if (!isBoundedKeyId(intent.grabbedKeyId) || !seenMovedKeyIds.has(intent.grabbedKeyId)) {
      return fail('malformed-identity', operationKind, 'Group move grabbed keyId must be a bounded member of movedKeyIds.');
    }
    if (intent.target === null || typeof intent.target !== 'object') {
      return fail('malformed-target', operationKind, 'Group move target must be a discriminated record.');
    }
    const moveResult = buildMoveGroupCandidate(identities, intent.movedKeyIds, intent.grabbedKeyId, intent.target, input.capacity, loopClips);
    if (!moveResult.ok) return moveResult.resolution;
    const finalized = finalizeProposal(moveResult.candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'move-group') {
    if (!isBoundedKeyId(intent.loopId)) {
      return fail('malformed-identity', operationKind, 'Group move requires a bounded loopId.');
    }
    if (!isNonNegativeInteger(intent.destinationPlacementStart) || intent.destinationPlacementStart >= input.capacity) {
      return fail('out-of-range-frame', operationKind, 'Group move destination placement start is outside capacity.');
    }
    const matchingClips = loopClips.filter((clip) => clip.loopId === intent.loopId);
    if (matchingClips.length === 0) {
      return fail('unknown-operation-identity', operationKind, `Group move targets unknown loop "${intent.loopId}".`);
    }
    if (matchingClips.length !== 1) {
      return fail('malformed-loop-clips', operationKind, 'Group move loopId must be unique in the Loop Clip collection.');
    }
    const clip = matchingClips[0];
    if (clip.sourceKeyIds.length === 0) {
      return fail('malformed-identity', operationKind, 'Group move requires a Group with source keys.');
    }
    // Attachment is resolver-derived (Pitfall 4): the clip's first source key
    // must exist in the identity set, and the placement start either coincides
    // with that key's pre-move frame (source-attached) or differs (duplicated
    // shared-source placement, D-11). Never accept a UI-supplied attachment flag.
    const firstSourceFrame = identities.framesByKeyId.get(clip.sourceKeyIds[0]);
    if (firstSourceFrame === undefined) {
      return fail('malformed-identity', operationKind, 'Group move requires its first source key to exist in the identity set.');
    }
    // D-05 / D-08: derive the dragged Group's interval (the same projection the
    // rail draws) and clamp the proposed destination BEFORE computing delta.
    // The clamp is the single pure authority shared with the plan 03 preview,
    // so preview-is-the-commit holds. Rejection happens only when zero valid
    // movement exists in the dragged direction (D-06 substrate).
    const derivation = derivePhysicPaintRotoLoopRanges({
      identities: identities.ordered,
      loopClips,
      capacity: input.capacity,
      interpolationEnabled: input.interpolationEnabled,
    });
    const draggedRanges = derivation.ranges.filter((range) => range.loopId === clip.loopId);
    const phaseOrigin = clip.phaseOrigin ?? clip.placementStart;
    const resolvedEffectiveEnd = resolvePhysicPaintRotoGroupEffectiveEnd(clip, draggedRanges);
    const clampResult = clampPhysicPaintGroupDragDestination({
      clip,
      draggedInterval: { phaseOrigin, effectiveEnd: resolvedEffectiveEnd },
      proposedDestinationPlacementStart: intent.destinationPlacementStart,
      identities: identities.ordered,
      loopRanges: derivation.ranges,
      capacity: input.capacity,
    });
    if (!clampResult.ok) {
      return fail('no-free-space-in-direction', operationKind, 'Group drag has no free space in the dragged direction.');
    }
    const destination = clampResult.destinationPlacementStart;

    if (clip.placementStart === firstSourceFrame) {
      // Source-attached arm (plan-01 + Task-1 clamp): rigid translation — every
      // source key and the Group lifecycle fields translate by the same delta.
      const moveResult = buildMoveGroupClipCandidate(
        identities,
        clip,
        destination,
        input.capacity,
        loopClips,
        resolvedEffectiveEnd,
      );
      if (!moveResult.ok) return moveResult.resolution;
      // Task 3: emit the complete next incoming-break collection through the
      // existing finalizeProposal threading (D-09..D-13). The vacated interval's
      // successor owns/reuses the break; a landing gap before the first source
      // key creates a new break; breaks on moved keys travel unchanged.
      const candidate = {
        ...moveResult.candidate,
        nextIncomingInterpolationBreakKeyIds: Object.freeze(
          deriveMoveGroupIncomingInterpolationBreakKeyIds({
            clip,
            draggedInterval: { phaseOrigin, effectiveEnd: resolvedEffectiveEnd },
            attached: true,
            preMoveFramesByKeyId: identities.framesByKeyId,
            mapping: moveResult.candidate.mapping,
            incomingInterpolationBreakKeyIds,
          }),
        ) as readonly string[],
      };
      const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
      if (!finalized.ok) return finalized.resolution;
      return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
    }

    // Duplicated shared-source placement (D-11, D-19): a placement-only move.
    // Identity mapping — every key maps to its current frame, so shared source
    // keys and their owned breaks never move. nextLoopClips updates ONLY the
    // dragged clip's placementStart and lifecycle fields by the placement delta
    // (Group-local deleted phases keep their original relative source phases,
    // D-13). No materialization, no source duplication, repeat/mode unchanged.
    const delta = destination - clip.placementStart;
    const mapping = new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame] as const));
    const candidate = {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: null,
      operationKind: 'move-group' as const,
      // D-11 placement-only move: the key mapping is identity (shared source
      // keys never move), so computeChanged is always false — but the dragged
      // placement itself DID translate. `changed` must reflect the placement
      // delta, not the key mapping, or every duplicated placement drag would be
      // rejected as a no-change (43.3-03 Task 2 regression).
      changed: destination !== clip.placementStart,
      roleByKeyId: new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>(),
      drag: null,
      nextLoopClips: buildMoveGroupNextLoopClips(loopClips, clip, delta, resolvedEffectiveEnd),
      // Task 3: a placement-only move vacates no interval and moves no keys, so
      // the incoming breaks echo byte-identical (D-11); the helper still runs
      // with attached:false so the vacated-successor rule stays inert and the
      // landing-gap rule never fires on a duplicated placement.
      nextIncomingInterpolationBreakKeyIds: Object.freeze(
        deriveMoveGroupIncomingInterpolationBreakKeyIds({
          clip,
          draggedInterval: { phaseOrigin, effectiveEnd: resolvedEffectiveEnd },
          attached: false,
          preMoveFramesByKeyId: identities.framesByKeyId,
          mapping,
          incomingInterpolationBreakKeyIds,
        }),
      ) as readonly string[],
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'scissor-key-rail') {
    if (!isBoundedKeyId(intent.breakOwnerKeyId)) {
      return fail('malformed-identity', operationKind, 'Scissor requires a bounded breakOwnerKeyId.');
    }
    if (!identities.keyIds.has(intent.breakOwnerKeyId)) {
      return fail('unknown-operation-identity', operationKind, `Scissor targets unknown identity "${intent.breakOwnerKeyId}".`);
    }

    const groupOwnedKeyIds = new Set<string>();
    for (const loopClip of loopClips) {
      loopClip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (loopClip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    if (groupOwnedKeyIds.has(intent.breakOwnerKeyId)) {
      return fail('malformed-target', operationKind, 'Scissor requires an ordinary real key outside Group ownership.');
    }
    if (incomingInterpolationBreakKeyIds.includes(intent.breakOwnerKeyId)) {
      return fail('malformed-target', operationKind, 'Scissor target already owns an incoming interpolation break.');
    }

    const nextBreakOwners = new Set(incomingInterpolationBreakKeyIds);
    nextBreakOwners.add(intent.breakOwnerKeyId);
    const candidate: Candidate = {
      mapping: new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame] as const)),
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: intent.breakOwnerKeyId,
      operationKind: 'scissor-key-rail',
      changed: true,
      roleByKeyId: new Map(),
      drag: null,
      nextIncomingInterpolationBreakKeyIds: Object.freeze(
        identities.ordered
          .filter((identity) => nextBreakOwners.has(identity.keyId))
          .map((identity) => identity.keyId),
      ),
    };
    const finalized = finalizeProposal(
      candidate,
      identities,
      input.capacity,
      input.interpolationEnabled,
      incomingInterpolationBreakKeyIds,
    );
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'push-rails') {
    if (intent.direction !== 'right' && intent.direction !== 'left') {
      return fail('malformed-target', operationKind, 'Push requires a direction literal.');
    }
    if (!isNonNegativeInteger(intent.deltaFrames)) {
      return fail('malformed-target', operationKind, 'Push requires a nonnegative integer deltaFrames.');
    }
    const hasAnchorKeyId = intent.anchorKeyId !== undefined;
    const hasAnchorLoopId = intent.anchorLoopId !== undefined;
    if (hasAnchorKeyId === hasAnchorLoopId) {
      return fail('malformed-target', operationKind, 'Push requires exactly one anchor (keyId or loopId).');
    }
    if (hasAnchorKeyId && !isBoundedKeyId(intent.anchorKeyId)) {
      return fail('malformed-identity', operationKind, 'Push anchor keyId must be bounded.');
    }
    if (hasAnchorLoopId && !isBoundedKeyId(intent.anchorLoopId)) {
      return fail('malformed-identity', operationKind, 'Push anchor loopId must be bounded.');
    }
    if (identities.ordered.length === 0) {
      return fail('empty-key-set', operationKind, 'Push requires at least one real key.');
    }

    const loopRangeContext = derivePhysicPaintRotoLoopRanges({
      identities: identities.ordered,
      loopClips,
      capacity: input.capacity,
      interpolationEnabled: input.interpolationEnabled,
    });

    // One shared pure authority derives the directional set AND the straddle
    // verdict from canonical records/loopClips only (Pitfall 6). The strip
    // hover preflight port (plan 05) consumes the same export, so preflight
    // and rejection can never disagree (D-17).
    const setResult = derivePhysicPaintPushSet({
      anchorKeyId: intent.anchorKeyId,
      anchorLoopId: intent.anchorLoopId,
      direction: intent.direction,
      identities: identities.ordered,
      loopRanges: loopRangeContext.ranges,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    if (!setResult.ok) {
      return fail(setResult.code, operationKind, setResult.text);
    }
    const { anchorRail, movedRails, movedKeyIds, movedSetBounds, leftBoundary, straddle } = setResult;
    if (straddle !== null) {
      return fail('push-source-straddle', operationKind,
        `Push ${intent.direction} would move source keys shared with the fixed Group "${straddle.fixedGroupLoopId}".`);
    }

    // Clamp-and-commit: the committed delta IS the clamped delta, so the
    // preview is the commit (D-14). ok:false maps to the dedicated zero-space
    // code. This exported clamp is the ONLY push delta authority — no second
    // clamp math anywhere (preview-is-the-commit).
    const proposedSignedDelta = intent.direction === 'right' ? intent.deltaFrames : -intent.deltaFrames;
    const clampResult = clampPhysicPaintPushDestination({
      direction: intent.direction,
      proposedDeltaFrames: proposedSignedDelta,
      movedSetBounds,
      leftBoundary,
      capacity: input.capacity,
    });
    if (!clampResult.ok) {
      return fail('no-free-space-in-direction', operationKind,
        `No empty space in the ${intent.direction} direction to push the selected set.`);
    }
    const signedDelta = clampResult.deltaFrames;

    const mapping = new Map(identities.ordered.map((identity) => [identity.keyId, identity.appFrame] as const));
    const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
    for (const identity of identities.ordered) {
      if (!movedKeyIds.has(identity.keyId)) continue;
      // The clamp already proved the moved byte interval lands in bounds;
      // finalizeProposal re-validates every final frame.
      mapping.set(identity.keyId, identity.appFrame + signedDelta);
      roleByKeyId.set(identity.keyId, 'moved');
    }

    // Translate EVERY moved Group's lifecycle fields with the
    // buildMoveGroupNextLoopClips pattern (phaseOrigin, originalEndExclusive,
    // EVERY visibleRanges entry, EVERY frameOverrides appFrame, infinity
    // pinning) — source-attached AND duplicated placements move placement-only
    // per the 43.3 algebra. Chained across moved clips so each clip translates
    // once.
    let nextLoopClips: readonly PhysicPaintRotoLoopClip[] | null = null;
    let clipPlacementChanged = false;
    const movedClips = movedRails
      .filter((rail): rail is PushRail & { kind: 'group'; clip: PhysicPaintRotoLoopClip } => (
        rail.kind === 'group' && rail.clip !== undefined
      ))
      .map((rail) => rail.clip);
    if (movedClips.length > 0) {
      let current = loopClips;
      for (const clip of movedClips) {
        const next = buildMoveGroupNextLoopClips(current, clip, signedDelta);
        if (next !== null) {
          current = next;
          clipPlacementChanged = true;
        }
      }
      // A zero-delta (no-change) push publishes NO clip translation: keep the
      // collection null so the prepare layer's changed === false maps to the
      // no-publish result (Task 3). Only a real placement delta commits one.
      if (clipPlacementChanged) nextLoopClips = current;
    }

    // Pitfall 5: changed must account for clip placement deltas, not only the
    // key mapping — a moved set whose only movable content is duplicated
    // placements still reports changed from the placement delta.
    const changed = computeChanged(identities, mapping) || clipPlacementChanged;
    const nextBreaks = derivePhysicPaintPushIncomingInterpolationBreakKeyIds({
      direction: intent.direction,
      deltaFrames: signedDelta,
      movedKeyIds,
      movedSetBounds,
      preMoveFramesByKeyId: identities.framesByKeyId,
      mapping,
      incomingInterpolationBreakKeyIds,
    });
    const candidate: Candidate = {
      mapping,
      expectedKeyIds: identities.keyIds,
      removedKeyId: null,
      removedKeyIds: EMPTY_REMOVED_KEY_IDS,
      selectedKeyId: anchorRail.kind === 'key-rail' ? anchorRail.id : null,
      operationKind: 'push-rails',
      changed,
      roleByKeyId,
      drag: null,
      ...(nextLoopClips !== null ? { nextLoopClips } : {}),
      nextIncomingInterpolationBreakKeyIds: Object.freeze(nextBreaks),
    };
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  // Exhaustive guard: any future intent kind must be added explicitly.
  return fail('malformed-target', operationKind, 'Unknown physical edit intent kind.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Phase 43: linked Loop Clip resolution (HOLD-05).
//
// Two canonical pure layers extend this resolver per D-26:
//
//  (a) derivePhysicPaintRotoLoopRanges — ONE compact interval record per Loop
//      Clip (D-32, audit finding 2). Derivation cost is O(keys + loops):
//      independent of repeat count, repeat duration, and infinity state. No
//      frame list, projection entry, raster, cache entry, or any other
//      duration-proportional collection is ever created.
//
//  (b) resolvePhysicPaintRotoLoopFrame — the lazy per-frame query returning
//      the SINGLE typed contract shared by store, preview, timeline, Studio,
//      capsule, and export (audit finding 3):
//      'real' | 'linked' | 'linked-unresolved' | 'empty'.
//
// Locked algebra honored here:
// - D-24 boundaries: candidates are exactly a non-owned real key at or after
//   the placement start, another loop's placementStart strictly after this
//   loop's, and parentEndExclusive. The loop NEVER truncates itself: its own
//   placementStart, its virtual occurrences, and its referenced source keyIds
//   are excluded. Caches, previews, and interpolated render-only frames are
//   not physical keys and never appear in the identity input. A boundary at
//   the placement start yields Effective = 0f and the loop survives (D-08).
// - D-14 loop-loop priority: a later loop begins at its own placementStart
//   and is never pushed; the earlier loop's effective end truncates at the
//   later start. On an exact frame tie between a loop start and a real key,
//   the loop start wins attribution (an original loop's first source key
//   coincides with its placement start structurally).
// - D-25/Q4: an infinity loop's natural end tracks parentEndExclusive
//   dynamically and is bounded by PHYSIC_PAINT_MAX_APPLY_FRAMES; the capacity
//   clamp folds into the 'parent-end' boundary kind. Finite loops are bounded
//   by requested end, the D-24 candidates, and parentEndExclusive only.
// - D-26: real keys always win — the per-frame query checks the real-key map
//   first, which makes materialize-local-key (D-12) and shrink (D-06)
//   emergent rather than special-cased.
// - D-30/D-31: derivation is pure and deterministic; unresolved source
//   references keep their full interval record with the exact missing list,
//   never throw, and never poison unrelated loops or frames.
// ---------------------------------------------------------------------------

/** D-24 boundary kinds — the only three valid next-clip boundaries. */
export type PhysicPaintRotoLoopBoundaryKind = 'real-key' | 'loop-start' | 'parent-end';

/** The boundary that bounds (or would next bound) a loop's effective range. */
export interface PhysicPaintRotoLoopBoundary {
  readonly kind: PhysicPaintRotoLoopBoundaryKind;
  readonly frame: number;
}

/**
 * ONE compact derived interval record per Loop Clip (D-32). Half-open
 * effective range [placementStart, effectiveEnd). `requestedEnd` is the
 * finite placementStart + cycleLength × repeat, or the explicit 'infinity'
 * marker (D-25). `truncated` is true exactly when the effective end falls
 * short of the natural end (finite requested end, or the parent/capacity
 * bound for infinity). `partialCycle` distinguishes a mid-cycle truncation
 * from one landing exactly on a cycle boundary (D-21). `unresolved` carries
 * the verbatim missing source keyIds when any reference dangles (D-31).
 * Derived state is NEVER persisted (D-30) — this record is recomputed.
 */
export interface PhysicPaintRotoLoopRange {
  readonly loopId: string;
  /** Start of this derived visible fragment. Persisted Group identity remains loopId. */
  readonly placementStart: number;
  /** Immutable modulo origin shared by every visible fragment of the Group. */
  readonly phaseOrigin: number;
  /** Physical duration of one source cycle: last normalized source offset + 1. */
  readonly cycleLength: number;
  /** Number of durable source keys in the ordered cycle. */
  readonly sourceFrameCount: number;
  readonly sourceKeyIds: readonly string[];
  readonly sourceCycleId: string;
  /** Physical positions normalized to the first ordered source key. */
  readonly sourceOffsets: readonly number[];
  /** Canonical strict-interior timing policy, independent from visible/deleted fragments. */
  readonly strictInteriorPolicy: 'hold' | 'generate' | 'gap';
  readonly repeat: number | 'infinity';
  readonly requestedEnd: number | 'infinity';
  readonly effectiveEnd: number;
  readonly boundary: PhysicPaintRotoLoopBoundary;
  readonly truncated: boolean;
  readonly partialCycle: boolean;
  readonly unresolved: {
    readonly missingSourceKeyIds: readonly string[];
    readonly invalidSourceTiming?: true;
  } | null;
}

/**
 * Resolve one Group's canonical effective end from its already-derived ranges.
 * Lifecycle Infinity fragments share one boundary even when durable deletions
 * make the final visible fragment end earlier; finite Groups retain visible
 * fragment extent. Empty derivations preserve the lifecycle fallback.
 */
export function resolvePhysicPaintRotoGroupEffectiveEnd(
  clip: PhysicPaintRotoLoopClip,
  draggedRanges: readonly PhysicPaintRotoLoopRange[],
): number {
  const phaseOrigin = clip.phaseOrigin ?? clip.placementStart;
  if (draggedRanges.length === 0) return clip.originalEndExclusive ?? phaseOrigin;
  return clip.repeat === 'infinity'
    ? draggedRanges[0]!.boundary.frame
    : Math.max(...draggedRanges.map((range) => range.effectiveEnd));
}

/**
 * The single typed per-frame resolution contract (audit finding 3). Virtual
 * and never persisted: 'linked' and 'linked-unresolved' results exist only
 * as query answers for the requested frame — never as projection cells,
 * cache entries, or frame lists. A 'linked-unresolved' result carries
 * everything the capsule error state, destination placeholder, tooltip,
 * export preflight, and repair/relink actions need (D-31).
 */
export type PhysicPaintRotoFrameResolution =
  | { readonly kind: 'real'; readonly keyId: string; readonly appFrame: number }
  | {
      readonly kind: 'linked';
      readonly loopId: string;
      readonly appFrame: number;
      readonly sourceKeyId: string;
      readonly sourceIndex: number;
      readonly cycleOffset: number;
      readonly repeatInstance: number;
    }
  | {
      readonly kind: 'linked-generated';
      readonly loopId: string;
      readonly appFrame: number;
      readonly leftSourceKeyId: string;
      readonly rightSourceKeyId: string;
      readonly leftSourceIndex: number;
      readonly rightSourceIndex: number;
      readonly progress: number;
      readonly sourceCycleId: string;
      readonly cycleOffset: number;
      readonly repeatInstance: number;
    }
  | {
      readonly kind: 'linked-gap';
      readonly loopId: string;
      readonly appFrame: number;
      readonly leftSourceKeyId: string;
      readonly rightSourceKeyId: string;
      readonly leftSourceIndex: number;
      readonly rightSourceIndex: number;
      readonly cycleOffset: number;
      readonly repeatInstance: number;
    }
  | {
      readonly kind: 'linked-unresolved';
      readonly loopId: string;
      readonly appFrame: number;
      readonly placementStart: number;
      readonly sourceKeyIds: readonly string[];
      readonly missingSourceKeyIds: readonly string[];
      readonly invalidSourceTiming?: true;
    }
  | { readonly kind: 'empty' };

/**
 * Immutable derivation input: the same-authority physical identities, the
 * parsed Loop Clip collection, and the physical capacity — the single end
 * authority for the standalone child document (43.4 defect 1).
 */
export interface PhysicPaintRotoLoopDerivationInput {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly capacity: number;
  /** Whether strict interiors between physical source positions render generated frames or gaps. */
  readonly interpolationEnabled: boolean;
}

/**
 * Prepared resolution context: the sorted interval records plus the real-key
 * frame index. Build once per document revision, then query per requested
 * frame or visible window — never per effective-range frame (D-32).
 */
export interface PhysicPaintRotoLoopResolutionContext {
  /** Interval records sorted by placementStart (loopId tiebreak). */
  readonly ranges: readonly PhysicPaintRotoLoopRange[];
  /** Real-key lookup index, O(keys) — sized by key count, never by loops. */
  readonly keyIdByAppFrame: ReadonlyMap<number, string>;
  readonly interpolationEnabled: boolean;
}

const LOOP_BOUNDARY_KIND_RANK: Readonly<Record<PhysicPaintRotoLoopBoundaryKind, number>> = {
  'loop-start': 0,
  'real-key': 1,
  'parent-end': 2,
};

/**
 * Derive ONE compact interval record per Loop Clip. Pure and deterministic
 * (D-30): identical documents derive identical records. Runs in
 * O(keys + loops) — one pass over the identities, one pass per loop over the
 * candidate sets — independent of repeat count or infinity state (D-32).
 *
 * Fail-closed on malformed input (the parsed physical document already
 * guarantees shape); never throws on unresolved source references (D-31).
 */
export function derivePhysicPaintRotoLoopRanges(
  input: PhysicPaintRotoLoopDerivationInput,
): PhysicPaintRotoLoopResolutionContext {
  if (!isRecord(input)) {
    throw new Error('PhysicPaintRotoLoopRanges: derivation input must be a record.');
  }
  if (!validateCapacity(input.capacity)) {
    throw new Error('PhysicPaintRotoLoopRanges: capacity must be an integer from 1 through PHYSIC_PAINT_MAX_APPLY_FRAMES.');
  }
  if (!Array.isArray(input.identities) || !input.identities.every(isPhysicPaintRotoKeyIdentity)) {
    throw new Error('PhysicPaintRotoLoopRanges: identities must be valid physical identities.');
  }
  if (!Array.isArray(input.loopClips) || !input.loopClips.every(isPhysicPaintRotoLoopClip)) {
    throw new Error('PhysicPaintRotoLoopRanges: loopClips must be valid Loop Clip records.');
  }
  if (typeof input.interpolationEnabled !== 'boolean') {
    throw new Error('PhysicPaintRotoLoopRanges: interpolationEnabled must be boolean.');
  }

  const keyIdByAppFrame = new Map<number, string>();
  const appFrameByKeyId = new Map<string, number>();
  const existingKeyIds = new Set<string>();
  for (const identity of input.identities) {
    if (keyIdByAppFrame.has(identity.appFrame)) {
      throw new Error(`PhysicPaintRotoLoopRanges: duplicate appFrame ${identity.appFrame}.`);
    }
    if (existingKeyIds.has(identity.keyId)) {
      throw new Error(`PhysicPaintRotoLoopRanges: duplicate keyId "${identity.keyId}".`);
    }
    keyIdByAppFrame.set(identity.appFrame, identity.keyId);
    appFrameByKeyId.set(identity.keyId, identity.appFrame);
    existingKeyIds.add(identity.keyId);
  }

  // Q4: an infinity loop's natural end tracks the child document's single end
  // authority — the physical capacity (43.4 defect 1). The stale main-editor
  // display outFrame must never truncate physics-paint content.
  const infinityNaturalEnd = input.capacity;

  const ranges = input.loopClips.flatMap((clip) => {
    const sourceFrameCount = clip.sourceKeyIds.length;
    const sourcePositions = clip.sourceKeyIds.map((keyId) => appFrameByKeyId.get(keyId));
    const missingSourceKeyIds = clip.sourceKeyIds.filter((keyId) => !existingKeyIds.has(keyId));
    const sourceTimingIsValid = missingSourceKeyIds.length === 0
      && sourcePositions.every((position): position is number => position !== undefined)
      && sourcePositions.every((position, index) => index === 0 || sourcePositions[index - 1]! < position);
    const sourceOffsets = sourceTimingIsValid
      ? sourcePositions.map((position) => position - sourcePositions[0]!)
      : [];
    // Unresolved clips retain their prior compact placeholder duration so a
    // dangling or invalid source cycle remains visible and repairable.
    const cycleLength = sourceTimingIsValid
      ? sourceOffsets[sourceOffsets.length - 1]! + 1
      : sourceFrameCount;
    const ownedSourceKeyIds = new Set([
      ...clip.sourceKeyIds,
      ...(clip.frameOverrides?.map((override) => override.keyId) ?? []),
    ]);
    const lifecycleAvailable = clip.phaseOrigin !== undefined
      && clip.originalEndExclusive !== undefined
      && clip.visibleRanges !== undefined;
    const phaseOrigin = lifecycleAvailable ? clip.phaseOrigin! : clip.placementStart;
    const finite = typeof clip.repeat === 'number';
    const requestedEnd: number | 'infinity' = lifecycleAvailable && finite
      ? clip.originalEndExclusive!
      : finite
        ? clip.placementStart + cycleLength * (clip.repeat as number)
        : 'infinity';
    const naturalEnd = lifecycleAvailable && finite
      ? clip.originalEndExclusive!
      : finite ? (requestedEnd as number) : infinityNaturalEnd;
    let visibleFragments = lifecycleAvailable
      ? clip.visibleRanges!
      : [{ start: clip.placementStart, endExclusive: naturalEnd }];
    if (lifecycleAvailable && !finite && naturalEnd > clip.originalEndExclusive!) {
      const last = visibleFragments[visibleFragments.length - 1];
      visibleFragments = last?.endExclusive === clip.originalEndExclusive
        ? [...visibleFragments.slice(0, -1), { ...last, endExclusive: naturalEnd }]
        : [...visibleFragments, { start: clip.originalEndExclusive!, endExclusive: naturalEnd }];
    }

    const sharesGroupBoundary = lifecycleAvailable && !finite;
    const deriveBoundary = (scanStart: number): PhysicPaintRotoLoopBoundary => {
      let kind: PhysicPaintRotoLoopBoundaryKind = 'parent-end';
      let frame = finite ? input.capacity : infinityNaturalEnd;
      const consider = (candidateKind: PhysicPaintRotoLoopBoundaryKind, candidateFrame: number): void => {
        if (
          candidateFrame < frame
          || (candidateFrame === frame && LOOP_BOUNDARY_KIND_RANK[candidateKind] < LOOP_BOUNDARY_KIND_RANK[kind])
        ) {
          kind = candidateKind;
          frame = candidateFrame;
        }
      };
      for (const identity of input.identities) {
        if (identity.appFrame < scanStart) continue;
        if (ownedSourceKeyIds.has(identity.keyId)) continue;
        consider('real-key', identity.appFrame);
      }
      for (const other of input.loopClips) {
        if (other.loopId === clip.loopId) continue;
        if (other.placementStart <= scanStart) continue;
        consider('loop-start', other.placementStart);
      }
      return Object.freeze({ kind, frame }) as PhysicPaintRotoLoopBoundary;
    };
    // Finding 1 applies only to lifecycle Infinity: every durable fragment
    // shares one boundary from the Group phase so later fragments cannot
    // reappear beyond the next Group/real-key/parent end. Finite and ordinary
    // clips retain their established per-fragment boundary semantics.
    const sharedBoundary = sharesGroupBoundary
      ? deriveBoundary(phaseOrigin)
      : null;

    return visibleFragments.flatMap((fragment) => {
      const boundary = sharedBoundary ?? deriveBoundary(fragment.start);
      if (
        sharesGroupBoundary
        && fragment.start >= boundary.frame
        && fragment.start !== phaseOrigin
      ) return [];
      const effectiveEnd = Math.max(
        fragment.start,
        Math.min(naturalEnd, fragment.endExclusive, boundary.frame),
      );
      return [Object.freeze({
        loopId: clip.loopId,
        placementStart: fragment.start,
        phaseOrigin,
        cycleLength,
        sourceFrameCount,
        sourceKeyIds: Object.freeze([...clip.sourceKeyIds]),
        sourceCycleId: getPhysicsPaintRotoSourceCycleId(clip.sourceKeyIds),
        sourceOffsets: Object.freeze(sourceOffsets),
        strictInteriorPolicy: lifecycleAvailable
          ? (clip.mode === 'static' || !input.interpolationEnabled ? 'hold' : 'generate')
          : (input.interpolationEnabled ? 'generate' : 'gap'),
        repeat: clip.repeat,
        requestedEnd,
        effectiveEnd,
        boundary,
        truncated: effectiveEnd < naturalEnd,
        partialCycle: (effectiveEnd - phaseOrigin) % cycleLength !== 0,
        unresolved: !sourceTimingIsValid
          ? Object.freeze({
              missingSourceKeyIds: Object.freeze(missingSourceKeyIds),
              ...(missingSourceKeyIds.length === 0 ? { invalidSourceTiming: true as const } : {}),
            })
          : null,
      }) as PhysicPaintRotoLoopRange];
    });
  });

  ranges.sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId));

  return Object.freeze({
    ranges: Object.freeze(ranges),
    keyIdByAppFrame,
    interpolationEnabled: input.interpolationEnabled,
  }) as PhysicPaintRotoLoopResolutionContext;
}

const EMPTY_FRAME_RESOLUTION: PhysicPaintRotoFrameResolution = Object.freeze({ kind: 'empty' }) as PhysicPaintRotoFrameResolution;

/**
 * Lazy per-frame resolution — the single typed contract (audit finding 3).
 *
 * Order: real key first (real always wins, D-26), then the applicable
 * effective interval, then O(1) modulo. The interval lookup is a binary
 * search over the placementStart-sorted interval records — O(log loops) per
 * query (NOT O(1); no hashed interval index exists in the physical document
 * convention). The modulo step is O(1): sourceIndex = (frame -
 * placementStart) % cycleLength, repeatInstance = floor((frame -
 * placementStart) / cycleLength). Never throws on unresolved loops (D-31);
 * out-of-domain frames resolve 'empty'. Frames at or beyond effectiveEnd
 * resolve 'empty' (half-open ranges).
 */
export function resolvePhysicPaintRotoLoopFrame(
  context: PhysicPaintRotoLoopResolutionContext,
  appFrame: number,
): PhysicPaintRotoFrameResolution {
  if (
    !isRecord(context)
    || !Array.isArray(context.ranges)
    || !(context.keyIdByAppFrame instanceof Map)
    || typeof context.interpolationEnabled !== 'boolean'
  ) {
    throw new Error('PhysicPaintRotoLoopResolution: malformed resolution context.');
  }
  if (!isNonNegativeInteger(appFrame)) {
    return EMPTY_FRAME_RESOLUTION;
  }

  const realKeyId = context.keyIdByAppFrame.get(appFrame);
  if (realKeyId !== undefined) {
    return Object.freeze({ kind: 'real', keyId: realKeyId, appFrame }) as PhysicPaintRotoFrameResolution;
  }

  // Binary search: the last interval whose placementStart is <= appFrame is
  // the only possible container — effective ranges never overlap (D-14).
  const ranges = context.ranges;
  let low = 0;
  let high = ranges.length - 1;
  let candidateIndex = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (ranges[mid].placementStart <= appFrame) {
      candidateIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (candidateIndex >= 0) {
    const range = ranges[candidateIndex];
    if (appFrame < range.effectiveEnd) {
      if (range.unresolved !== null) {
        return Object.freeze({
          kind: 'linked-unresolved',
          loopId: range.loopId,
          appFrame,
          placementStart: range.placementStart,
          sourceKeyIds: range.sourceKeyIds,
          missingSourceKeyIds: range.unresolved.missingSourceKeyIds,
          ...(range.unresolved.invalidSourceTiming ? { invalidSourceTiming: true as const } : {}),
        }) as PhysicPaintRotoFrameResolution;
      }
      const offset = appFrame - range.phaseOrigin;
      const cycleOffset = offset % range.cycleLength;
      const repeatInstance = Math.floor(offset / range.cycleLength);

      // Binary-search the last source position at or before this physical cycle
      // offset. Exact positions share the source key; strict interiors are
      // generated or gaps according to the canonical interpolation state.
      let sourceLow = 0;
      let sourceHigh = range.sourceOffsets.length - 1;
      let leftSourceIndex = -1;
      while (sourceLow <= sourceHigh) {
        const mid = (sourceLow + sourceHigh) >> 1;
        if (range.sourceOffsets[mid] <= cycleOffset) {
          leftSourceIndex = mid;
          sourceLow = mid + 1;
        } else {
          sourceHigh = mid - 1;
        }
      }
      if (leftSourceIndex < 0) return EMPTY_FRAME_RESOLUTION;
      if (range.sourceOffsets[leftSourceIndex] === cycleOffset) {
        return Object.freeze({
          kind: 'linked',
          loopId: range.loopId,
          appFrame,
          sourceKeyId: range.sourceKeyIds[leftSourceIndex],
          sourceIndex: leftSourceIndex,
          cycleOffset,
          repeatInstance,
        }) as PhysicPaintRotoFrameResolution;
      }

      const rightSourceIndex = leftSourceIndex + 1;
      if (rightSourceIndex >= range.sourceOffsets.length) return EMPTY_FRAME_RESOLUTION;
      if (range.strictInteriorPolicy === 'hold') {
        return Object.freeze({
          kind: 'linked',
          loopId: range.loopId,
          appFrame,
          sourceKeyId: range.sourceKeyIds[leftSourceIndex],
          sourceIndex: leftSourceIndex,
          cycleOffset,
          repeatInstance,
        }) as PhysicPaintRotoFrameResolution;
      }
      const sharedInterior = {
        loopId: range.loopId,
        appFrame,
        leftSourceKeyId: range.sourceKeyIds[leftSourceIndex],
        rightSourceKeyId: range.sourceKeyIds[rightSourceIndex],
        leftSourceIndex,
        rightSourceIndex,
        cycleOffset,
        repeatInstance,
      };
      if (range.strictInteriorPolicy === 'gap') {
        return Object.freeze({ kind: 'linked-gap', ...sharedInterior }) as PhysicPaintRotoFrameResolution;
      }
      const leftOffset = range.sourceOffsets[leftSourceIndex];
      const rightOffset = range.sourceOffsets[rightSourceIndex];
      return Object.freeze({
        kind: 'linked-generated',
        ...sharedInterior,
        sourceCycleId: range.sourceCycleId,
        progress: (cycleOffset - leftOffset) / (rightOffset - leftOffset),
      }) as PhysicPaintRotoFrameResolution;
    }
  }
  return EMPTY_FRAME_RESOLUTION;
}

/**
 * Resolve a session-only Key Spacing proxy at an exact ordered source position.
 * This deliberately does not reuse ordinary key selectability: an original
 * source record under its Loop Clip resolves as `real`, while an equivalent
 * repeat resolves as `linked`; both name the same source-cycle position.
 * Strict interiors, unresolved ranges, non-loop real keys, and empty frames
 * fail closed to null.
 */
export function resolvePhysicPaintRotoSpacingProxy(
  context: PhysicPaintRotoLoopResolutionContext,
  appFrame: number,
): PhysicsPaintRotoSpacingProxy | null {
  const resolution = resolvePhysicPaintRotoLoopFrame(context, appFrame);
  if (resolution.kind !== 'real' && resolution.kind !== 'linked') return null;

  for (let index = context.ranges.length - 1; index >= 0; index -= 1) {
    const range = context.ranges[index];
    if (appFrame < range.placementStart || appFrame >= range.effectiveEnd) continue;
    if (range.unresolved !== null || range.sourceKeyIds.length < 2) return null;
    const cycleOffset = (appFrame - range.phaseOrigin) % range.cycleLength;
    const sourceIndex = range.sourceOffsets.indexOf(cycleOffset);
    if (sourceIndex < 0) return null;
    const sourceKeyId = range.sourceKeyIds[sourceIndex];
    if (resolution.kind === 'real' && resolution.keyId !== sourceKeyId) return null;
    if (resolution.kind === 'linked' && (
      resolution.loopId !== range.loopId
      || resolution.sourceKeyId !== sourceKeyId
      || resolution.sourceIndex !== sourceIndex
    )) return null;
    return Object.freeze({
      loopId: range.loopId,
      sourceCycleId: getPhysicsPaintRotoSourceCycleId(range.sourceKeyIds),
      sourceKeyIds: range.sourceKeyIds,
      sourceKeyId,
      sourceIndex,
    }) as PhysicsPaintRotoSpacingProxy;
  }
  return null;
}

/**
 * D-13 linked-frame Delete-key guard. Delete-key at a frame whose per-frame
 * resolution is 'linked' or 'linked-unresolved' (no local real key) is
 * rejected with the verbatim locked copy — it never touches the
 * modulo-resolved source key and never unlinks. Real and empty frames return
 * null so ordinary delete proceeds. Clear and paint materialize a local real
 * key instead (D-12/D-13).
 */
export function resolvePhysicPaintRotoLinkedFrameDeleteGuard(
  context: PhysicPaintRotoLoopResolutionContext,
  appFrame: number,
): PhysicPaintRotoPhysicalEditFailure | null {
  const resolution = resolvePhysicPaintRotoLoopFrame(context, appFrame);
  if (
    resolution.kind !== 'linked'
    && resolution.kind !== 'linked-generated'
    && resolution.kind !== 'linked-gap'
    && resolution.kind !== 'linked-unresolved'
  ) return null;
  return Object.freeze({
    code: 'linked-frame-delete-rejected',
    operationKind: 'delete-key',
    text: 'No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.',
  }) as PhysicPaintRotoPhysicalEditFailure;
}

/**
 * D-12 materialization base: the loop-resolved source payload a new local real
 * key is built from when painting or erasing at a linked repetition frame. The
 * payload is returned BY REFERENCE — one source cache entry serves every
 * occurrence (D-26); the caller retargets/composites it into the new key's own
 * payload through the existing paste-to-empty machinery. Real, empty, and
 * linked-unresolved frames return null — a base is never fabricated from a
 * missing source (D-31).
 */
export interface PhysicPaintRotoLoopMaterializationBase {
  readonly loopId: string;
  readonly sourceKeyId: string;
  readonly payload: PhysicPaintRotoRealKeyPayload;
}

export function resolvePhysicPaintRotoLoopMaterializationBase(
  context: PhysicPaintRotoLoopResolutionContext,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  appFrame: number,
): PhysicPaintRotoLoopMaterializationBase | null {
  const resolution = resolvePhysicPaintRotoLoopFrame(context, appFrame);
  if (resolution.kind !== 'linked') return null;
  const source = records.find((record) => record.keyId === resolution.sourceKeyId) ?? null;
  if (source === null) return null;
  return Object.freeze({
    loopId: resolution.loopId,
    sourceKeyId: resolution.sourceKeyId,
    payload: source.payload,
  }) as PhysicPaintRotoLoopMaterializationBase;
}

/**
 * D-06 preflight shorten report for batch generation. Computed ONLY through
 * the canonical interval derivation (Pitfall 4 — no caller-local boundary
 * math): the current document is derived once, then derived again with the
 * pending destination range added as real keys, and the two are compared per
 * loop. Destination frames already occupied keep their existing keyIds, so a
 * loop's own source keys stay owned and regenerating over the source cycle
 * never reports a self-shortening (D-24 self-exclusion). Cost is
 * O(keys + loops + destinationCount) — independent of repeat counts (D-32,
 * T-43-05-03).
 *
 * Returns null when no loop's effective range shrinks; otherwise the affected
 * loop count N and the earliest truncation frame F for the locked line:
 * `This operation will shorten {N} linked loop(s), starting at frame {F}.`
 */
export interface PhysicPaintRotoLoopShortenPreflightInput extends PhysicPaintRotoLoopDerivationInput {
  /** First destination frame of the pending generation (inclusive). */
  readonly destinationStart: number;
  /** Number of consecutive destination frames the generation will write. */
  readonly destinationCount: number;
}

export interface PhysicPaintRotoLoopShortenPreflight {
  readonly affectedLoopCount: number;
  readonly earliestShortenFrame: number;
}

export function derivePhysicPaintRotoLoopShortenPreflight(
  input: PhysicPaintRotoLoopShortenPreflightInput,
): PhysicPaintRotoLoopShortenPreflight | null {
  if (!isRecord(input)) {
    throw new Error('PhysicPaintRotoLoopShortenPreflight: input must be a record.');
  }
  if (!isNonNegativeInteger(input.destinationStart) || !isNonNegativeInteger(input.destinationCount) || input.destinationCount === 0) {
    throw new Error('PhysicPaintRotoLoopShortenPreflight: destinationStart/destinationCount must be nonnegative integers and the count must be positive.');
  }
  if (input.loopClips.length === 0) return null;

  const before = derivePhysicPaintRotoLoopRanges(input);

  // After-state identities: the pending generation writes a real key at every
  // destination frame. Occupied frames keep their keyIds (the commit reuses
  // them), so owned source keys remain owned; unoccupied frames gain a
  // synthetic non-owned key that acts as a D-24 boundary candidate.
  const occupiedFrames = new Set<number>();
  const takenKeyIds = new Set<string>();
  for (const identity of input.identities) {
    occupiedFrames.add(identity.appFrame);
    takenKeyIds.add(identity.keyId);
  }
  const afterIdentities: PhysicPaintRotoKeyIdentity[] = [...input.identities];
  const destinationEnd = Math.min(input.destinationStart + input.destinationCount, input.capacity);
  for (let appFrame = input.destinationStart; appFrame < destinationEnd; appFrame += 1) {
    if (occupiedFrames.has(appFrame)) continue;
    let syntheticKeyId = `__loop-shorten-preflight-${appFrame}`;
    while (takenKeyIds.has(syntheticKeyId)) syntheticKeyId = `_${syntheticKeyId}`;
    takenKeyIds.add(syntheticKeyId);
    afterIdentities.push({ keyId: syntheticKeyId, appFrame });
  }
  // A fully occupied destination adds no new boundaries — nothing can shrink.
  if (afterIdentities.length === input.identities.length) return null;

  const after = derivePhysicPaintRotoLoopRanges({ ...input, identities: afterIdentities });
  const beforeByLoopId = new Map(before.ranges.map((range) => [range.loopId, range]));
  let affectedLoopCount = 0;
  let earliestShortenFrame: number | null = null;
  for (const afterRange of after.ranges) {
    const beforeRange = beforeByLoopId.get(afterRange.loopId);
    if (!beforeRange || afterRange.effectiveEnd >= beforeRange.effectiveEnd) continue;
    affectedLoopCount += 1;
    if (earliestShortenFrame === null || afterRange.effectiveEnd < earliestShortenFrame) {
      earliestShortenFrame = afterRange.effectiveEnd;
    }
  }
  if (affectedLoopCount === 0 || earliestShortenFrame === null) return null;
  return Object.freeze({ affectedLoopCount, earliestShortenFrame }) as PhysicPaintRotoLoopShortenPreflight;
}