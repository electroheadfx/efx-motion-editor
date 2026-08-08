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
 *   proposal.
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
 * - No payload mutation, payload cloning, key creation, store access, bridge
 *   call, history mutation, acknowledgement handling, or UI state.
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
import type { PhysicPaintRotoPhysicalEditSemanticDelta } from '../../../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';
import {
  getPhysicsPaintRotoSourceCycleId,
  type PhysicsPaintRotoSpacingProxy,
} from './physicsPaintRotoSpacingSelection';

// ---------------------------------------------------------------------------
// Closed edit intent, input, and result contracts.
// ---------------------------------------------------------------------------

/**
 * Discriminated physical edit target for Drag. Direct cells name the grabbed
 * key's desired final `appFrame`; occupied boundaries name a stable target
 * identity whose adjacent physical frame is resolved by the operation.
 */
export type PhysicPaintRotoPhysicalEditTarget =
  | { readonly kind: 'physical-cell'; readonly appFrame: number }
  | { readonly kind: 'before-key'; readonly targetKeyId: string }
  | { readonly kind: 'after-key'; readonly targetKeyId: string };

/**
 * Closed physical edit intent union. The union contains exactly Insert,
 * Delete, Move, Force Spacing, Duplicate, and Paste; Phase 37 adds the group
 * variants `move-key-group` and `delete-key-group` plus the optional scoped
 * `scopeKeyIds` input on `force-spacing` (null/undefined = full timeline).
 *
 * Group Drag: the grabbed key anchors the drop, every selected key shifts by
 * the same physical delta, and every unselected key keeps its frame.
 */
export interface PhysicPaintRotoLinkedSourceSpacingScope {
  readonly sourceCycleId: string;
  readonly sourceKeyIds: readonly string[];
  readonly selectedSourceKeyIds: readonly string[];
}

export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key-group'; readonly keyIds: readonly string[] }
  | {
      readonly kind: 'move-key';
      readonly movedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    }
  | {
      readonly kind: 'move-key-group';
      readonly movedKeyIds: readonly string[];
      readonly grabbedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    }
  | {
      readonly kind: 'force-spacing';
      readonly emptyFrames: number;
      readonly selectedKeyId: string | null;
      /** Phase 37 D-10..D-12: selected-keys-only scope; null/undefined = full timeline. */
      readonly scopeKeyIds?: readonly string[] | null;
      /** Phase 43: session-only authorization for exact linked source-cycle positions. */
      readonly linkedSourceSpacingScope?: PhysicPaintRotoLinkedSourceSpacingScope | null;
    }
  | {
      readonly kind: 'duplicate-key';
      readonly sourceKeyId: string;
      readonly newKeyId: string;
    }
  | {
      readonly kind: 'paste-key';
      readonly destinationAppFrame: number;
      readonly destinationKeyId: string | null;
      readonly newKeyId: string | null;
      readonly clipboardPayload: PhysicPaintRotoRealKeyPayload;
    }
  | {
      readonly kind: 'paste-key-group';
      readonly destinationAppFrame: number;
      readonly entries: readonly {
        readonly payload: PhysicPaintRotoRealKeyPayload;
        readonly sourceAppFrame: number;
        readonly sourceKeyId: string;
        readonly newKeyId: string;
      }[];
    };

/**
 * Operation kind literal union, grows alongside {@link PhysicPaintRotoPhysicalEditIntent}.
 */
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'delete-key'
  | 'delete-key-group'
  | 'move-key'
  | 'move-key-group'
  | 'force-spacing'
  | 'duplicate-key'
  | 'paste-key'
  | 'paste-key-group';

/**
 * Immutable resolver input: stable identities, typed intent, bounded capacity,
 * and interpolation-enabled flag only. No payload, store handle, bridge, or
 * preview/commit mode is accepted.
 */
export interface PhysicPaintRotoPhysicalEditInput {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  /** Required for identity/payload-changing Duplicate and Paste operations. */
  readonly records?: readonly PhysicPaintRotoRealKeyRecord[];
  readonly intent: PhysicPaintRotoPhysicalEditIntent;
  readonly capacity: number;
  readonly interpolationEnabled: boolean;
  /**
   * Phase 43 durable Loop Clip collection (D-07/D-11/D-13). When present, the
   * resolver rejects delete/move/force-spacing intents that target linked
   * source-cycle keys and carries rigid whole-cycle drag placementStart
   * updates on the proposal. Absent/empty preserves pre-43 behavior exactly.
   */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
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
  | 'loop-source-key-move-rejected'
  | 'invalid-linked-source-spacing-scope'
  | 'linked-source-spacing-order-rejected'
  | 'linked-frame-delete-rejected';

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
  readonly operationKind: 'duplicate-key' | 'paste-key' | 'paste-key-group';
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
    || value === 'delete-key'
    || value === 'delete-key-group'
    || value === 'move-key'
    || value === 'move-key-group'
    || value === 'force-spacing'
    || value === 'duplicate-key'
    || value === 'paste-key'
    || value === 'paste-key-group';
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
 * Returns the complete next collection, or null when no loop record changes.
 */
function computeRigidLoopPlacementFollow(
  identities: ValidatedIdentities,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  movedKeyIds: ReadonlySet<string>,
  mapping: ReadonlyMap<string, number>,
): readonly PhysicPaintRotoLoopClip[] | null {
  if (loopClips.length === 0) return null;
  let changed = false;
  const next = loopClips.map((clip) => {
    const firstKeyId = clip.sourceKeyIds[0];
    if (firstKeyId === undefined) return clip;
    if (!clip.sourceKeyIds.every((keyId) => movedKeyIds.has(keyId))) return clip;
    const preMoveFrame = identities.framesByKeyId.get(firstKeyId);
    if (preMoveFrame === undefined || clip.placementStart !== preMoveFrame) return clip;
    const postMoveFrame = mapping.get(firstKeyId);
    if (postMoveFrame === undefined || postMoveFrame === preMoveFrame) return clip;
    changed = true;
    return Object.freeze({ ...clip, placementStart: postMoveFrame }) as PhysicPaintRotoLoopClip;
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
function buildDeleteCandidate(
  identities: ValidatedIdentities,
  selectedKeyId: string,
): Candidate {
  const selectedFrame = identities.framesByKeyId.get(selectedKeyId) as number;
  const mapping = new Map<string, number>();
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  const expectedKeyIds = new Set<string>();
  let successorKeyId: string | null = null;
  let previousKeyId: string | null = null;

  for (const identity of identities.ordered) {
    if (identity.keyId === selectedKeyId) continue;
    expectedKeyIds.add(identity.keyId);
    if (identity.appFrame > selectedFrame) {
      mapping.set(identity.keyId, identity.appFrame - 1);
      roleByKeyId.set(identity.keyId, 'ripple-left');
      if (successorKeyId === null && identity.appFrame > selectedFrame) {
        // Track the smallest-frame survivor strictly after the removed slot.
        successorKeyId = identity.keyId;
      }
    } else {
      mapping.set(identity.keyId, identity.appFrame);
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

  const mapping = new Map<string, number>();
  const roleByKeyId = new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>();
  const expectedKeyIds = new Set<string>();
  let successorKeyId: string | null = null;
  let previousKeyId: string | null = null;

  for (const identity of identities.ordered) {
    if (removalSet.has(identity.keyId)) continue;
    expectedKeyIds.add(identity.keyId);
    let shift = 0;
    for (const removedFrame of removedFramesAsc) {
      if (removedFrame < identity.appFrame) shift += 1;
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
      nextLoopClips: computeRigidLoopPlacementFollow(identities, loopClips, movedSet, mapping),
    },
  };
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
  if (interpolationEnabled && orderedPairs.length >= 2) {
    for (let i = 0; i < orderedPairs.length - 1; i += 1) {
      const left = orderedPairs[i];
      const right = orderedPairs[i + 1];
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

  // 3. Derive the shared physical projection (ordering, interiors, cells).
  const projection = buildProjectionFromMapping(mapping, capacity, interpolationEnabled);
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
  if (operationKind === 'delete-key') {
    if (removedKeyIds.length === 0) return 'No change';
    return 'Deleted key';
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
  if (operationKind === 'move-key-group') {
    if (!changed) return 'No change';
    return 'Keys moved';
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
  return 'No change';
}

function validateLinkedSourceSpacingScope(
  value: unknown,
  scopeKeyIds: readonly string[] | null | undefined,
  identities: ValidatedIdentities,
  loopClips: readonly PhysicPaintRotoLoopClip[],
): { ok: true; scope: PhysicPaintRotoLinkedSourceSpacingScope } | { ok: false; resolution: PhysicPaintRotoPhysicalEditResolution } {
  const invalid = (text: string) => ({
    ok: false as const,
    resolution: fail('invalid-linked-source-spacing-scope', 'force-spacing', text),
  });
  if (!isRecord(value)) return invalid('Linked source spacing authorization must be a record.');
  const sourceKeyIds = value.sourceKeyIds;
  const selectedSourceKeyIds = value.selectedSourceKeyIds;
  if (!Array.isArray(sourceKeyIds) || sourceKeyIds.length < 2 || !sourceKeyIds.every(isBoundedKeyId)) {
    return invalid('Linked source spacing authorization requires an ordered source cycle.');
  }
  if (new Set(sourceKeyIds).size !== sourceKeyIds.length) {
    return invalid('Linked source spacing source cycle must contain unique identities.');
  }
  if (value.sourceCycleId !== getPhysicsPaintRotoSourceCycleId(sourceKeyIds)) {
    return invalid('Linked source spacing cycle identity does not match its ordered source keys.');
  }
  const exactCycleExists = loopClips.some((loopClip) => (
    loopClip.sourceKeyIds.length === sourceKeyIds.length
    && loopClip.sourceKeyIds.every((keyId, index) => keyId === sourceKeyIds[index])
  ));
  if (!exactCycleExists) return invalid('Linked source spacing source cycle is not current.');
  if (sourceKeyIds.some((keyId) => !identities.keyIds.has(keyId))) {
    return invalid('Linked source spacing source cycle contains a stale identity.');
  }
  if (!Array.isArray(selectedSourceKeyIds) || selectedSourceKeyIds.length < 2 || !selectedSourceKeyIds.every(isBoundedKeyId)) {
    return invalid('Linked source spacing requires at least two selected source positions.');
  }
  if (new Set(selectedSourceKeyIds).size !== selectedSourceKeyIds.length) {
    return invalid('Linked source spacing selected identities must be unique.');
  }
  if (selectedSourceKeyIds.some((keyId) => !sourceKeyIds.includes(keyId))) {
    return invalid('Linked source spacing selection contains a stale source identity.');
  }
  if (!Array.isArray(scopeKeyIds)
    || scopeKeyIds.length !== selectedSourceKeyIds.length
    || scopeKeyIds.some((keyId, index) => keyId !== selectedSourceKeyIds[index])) {
    return invalid('Force Spacing scope does not match the authorized linked source selection.');
  }
  return {
    ok: true,
    scope: Object.freeze({
      sourceCycleId: value.sourceCycleId,
      sourceKeyIds: Object.freeze([...sourceKeyIds]),
      selectedSourceKeyIds: Object.freeze([...selectedSourceKeyIds]),
    }) as PhysicPaintRotoLinkedSourceSpacingScope,
  };
}

function validateLinkedSourceSpacingOrder(
  mapping: ReadonlyMap<string, number>,
  sourceKeyIds: readonly string[],
): PhysicPaintRotoPhysicalEditResolution | null {
  let previousFrame = -1;
  for (const keyId of sourceKeyIds) {
    const frame = mapping.get(keyId);
    if (frame === undefined || frame <= previousFrame) {
      return fail(
        'linked-source-spacing-order-rejected',
        'force-spacing',
        'Key Spacing would cross an unselected Loop Clip source position.',
      );
    }
    previousFrame = frame;
  }
  return null;
}

function validateSemanticInputRecords(
  input: unknown,
  identities: ValidatedIdentities,
  capacity: number,
  operationKind: 'duplicate-key' | 'paste-key' | 'paste-key-group',
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

  const mapping = new Map<string, number>();
  for (const identity of identities.ordered) {
    mapping.set(identity.keyId, identity.appFrame);
  }

  const projection = buildProjectionFromMapping(mapping, input.capacity, input.interpolationEnabled);
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

  const identitiesResult = validateIdentities(input.identities, input.capacity, operationKind);
  if (!identitiesResult.ok) return identitiesResult.resolution;
  const identities = identitiesResult.value;

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
    const candidate = buildInsertCandidate(identities, intent.selectedKeyId);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled);
    if (!finalized.ok) return finalized.resolution;
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
    const candidate = buildDeleteCandidate(identities, intent.selectedKeyId);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled);
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
    const candidate = buildDeleteGroupCandidate(identities, intent.keyIds);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled);
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
    const candidate = buildDuplicateCandidate(identities, recordsResult.records, intent.sourceKeyId, intent.newKeyId);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled);
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
    const candidate = buildPasteCandidate(identities, recordsResult.records, intent);
    const finalized = finalizeProposal(candidate, identities, input.capacity, input.interpolationEnabled);
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
    const finalized = finalizeProposal(candidateResult.candidate, identities, input.capacity, input.interpolationEnabled);
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
    const finalized = finalizeProposal(moveResult.candidate, identities, input.capacity, input.interpolationEnabled);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  if (intent.kind === 'force-spacing') {
    const linkedAuthorization = intent.linkedSourceSpacingScope === undefined || intent.linkedSourceSpacingScope === null
      ? null
      : validateLinkedSourceSpacingScope(intent.linkedSourceSpacingScope, intent.scopeKeyIds, identities, loopClips);
    if (linkedAuthorization !== null && !linkedAuthorization.ok) return linkedAuthorization.resolution;

    // D-11: ordinary Force Spacing still rejects every affected linked source
    // key. The only exception is the independently validated session-only
    // source-position authorization above; it names the exact ordered cycle and
    // exact selected subset that may move.
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
    const spacingResult = buildForceSpacingCandidate(identities, intent.emptyFrames, intent.selectedKeyId, intent.scopeKeyIds);
    if (!spacingResult.ok) return spacingResult.resolution;
    if (linkedAuthorization?.ok) {
      const orderFailure = validateLinkedSourceSpacingOrder(
        spacingResult.candidate.mapping,
        linkedAuthorization.scope.sourceKeyIds,
      );
      if (orderFailure !== null) return orderFailure;
    }
    const finalized = finalizeProposal(spacingResult.candidate, identities, input.capacity, input.interpolationEnabled);
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
    const finalized = finalizeProposal(moveResult.candidate, identities, input.capacity, input.interpolationEnabled);
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
  readonly placementStart: number;
  /** Physical duration of one source cycle: last normalized source offset + 1. */
  readonly cycleLength: number;
  /** Number of durable source keys in the ordered cycle. */
  readonly sourceFrameCount: number;
  readonly sourceKeyIds: readonly string[];
  /** Physical positions normalized to the first ordered source key. */
  readonly sourceOffsets: readonly number[];
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
    }
  | { readonly kind: 'empty' };

/**
 * Immutable derivation input: the same-authority physical identities, the
 * parsed Loop Clip collection, the parent sequence end (exclusive, may exceed
 * the physical capacity on the main timeline), and the physical capacity.
 */
export interface PhysicPaintRotoLoopDerivationInput {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly parentEndExclusive: number;
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
  if (!isNonNegativeInteger(input.parentEndExclusive)) {
    throw new Error('PhysicPaintRotoLoopRanges: parentEndExclusive must be a nonnegative integer.');
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

  // Q4: an infinity loop's natural end tracks the parent end dynamically and
  // is bounded by the physical capacity; the clamp folds into 'parent-end'.
  const infinityNaturalEnd = Math.min(input.parentEndExclusive, input.capacity);

  const ranges = input.loopClips.map((clip) => {
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
    const ownedSourceKeyIds = new Set(clip.sourceKeyIds);
    const finite = typeof clip.repeat === 'number';
    const requestedEnd: number | 'infinity' = finite
      ? clip.placementStart + cycleLength * (clip.repeat as number)
      : 'infinity';
    const naturalEnd = finite ? (requestedEnd as number) : infinityNaturalEnd;

    // D-24 candidate scan. A loop never truncates itself: its own start, its
    // virtual occurrences, and its referenced source keyIds are excluded.
    let boundaryKind: PhysicPaintRotoLoopBoundaryKind = 'parent-end';
    let boundaryFrame = finite ? input.parentEndExclusive : infinityNaturalEnd;
    const consider = (kind: PhysicPaintRotoLoopBoundaryKind, frame: number): void => {
      if (
        frame < boundaryFrame
        || (frame === boundaryFrame && LOOP_BOUNDARY_KIND_RANK[kind] < LOOP_BOUNDARY_KIND_RANK[boundaryKind])
      ) {
        boundaryKind = kind;
        boundaryFrame = frame;
      }
    };
    for (const identity of input.identities) {
      if (identity.appFrame < clip.placementStart) continue;
      if (ownedSourceKeyIds.has(identity.keyId)) continue;
      consider('real-key', identity.appFrame);
    }
    for (const other of input.loopClips) {
      if (other.loopId === clip.loopId) continue;
      // D-14: only strictly later starts bound this loop; same-start
      // collisions are rejected at creation, never resolved by hidden order.
      if (other.placementStart <= clip.placementStart) continue;
      consider('loop-start', other.placementStart);
    }

    const effectiveEnd = Math.max(clip.placementStart, Math.min(naturalEnd, boundaryFrame));
    return Object.freeze({
      loopId: clip.loopId,
      placementStart: clip.placementStart,
      cycleLength,
      sourceFrameCount,
      sourceKeyIds: Object.freeze([...clip.sourceKeyIds]),
      sourceOffsets: Object.freeze(sourceOffsets),
      repeat: clip.repeat,
      requestedEnd,
      effectiveEnd,
      boundary: Object.freeze({ kind: boundaryKind, frame: boundaryFrame }) as PhysicPaintRotoLoopBoundary,
      truncated: effectiveEnd < naturalEnd,
      partialCycle: (effectiveEnd - clip.placementStart) % cycleLength !== 0,
      unresolved: !sourceTimingIsValid
        ? Object.freeze({
            missingSourceKeyIds: Object.freeze(missingSourceKeyIds),
            ...(missingSourceKeyIds.length === 0 ? { invalidSourceTiming: true as const } : {}),
          })
        : null,
    }) as PhysicPaintRotoLoopRange;
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
        }) as PhysicPaintRotoFrameResolution;
      }
      const offset = appFrame - range.placementStart;
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
      if (!context.interpolationEnabled) {
        return Object.freeze({ kind: 'linked-gap', ...sharedInterior }) as PhysicPaintRotoFrameResolution;
      }
      const leftOffset = range.sourceOffsets[leftSourceIndex];
      const rightOffset = range.sourceOffsets[rightSourceIndex];
      return Object.freeze({
        kind: 'linked-generated',
        ...sharedInterior,
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
    const cycleOffset = (appFrame - range.placementStart) % range.cycleLength;
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