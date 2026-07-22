/**
 * Pure physical timeline edit resolver — stable identity plus direct appFrame.
 *
 * This module is intentionally INACTIVE after Plan 02. It defines the closed
 * edit intent/result contracts and the sole resolver entry point. The current
 * shared live timing graph (`rotoSourceDisplayModel.ts`, `rotoKeyTransactions.ts`,
 * `physicsPaintRotoKeyController.ts`, store, persistence, bridge, rendering, and
 * presentation) remains the active production authority until owning consumer
 * plans (36.14-03 through 36.14-10) perform coherent cutovers; destructive
 * shared-contract removal is owned by Plan 11 after its production
 * reachability audit proves zero live consumers.
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
 * - D-07: single-key Drag is one cut-and-insert operation for empty/generated
 *   physical cells and occupied before/after identity boundaries, never an
 *   overwrite.
 * - D-08: Force Spacing accepts every nonnegative integer `N`, anchors the
 *   first ordered real key, preserves deterministic identity order, and places
 *   key `i` at `first + i * (N + 1)`; `N = 0` produces adjacent keys.
 * - D-09: every successful intent returns one immutable complete identity-to-frame
 *   proposal used unchanged by later preview and commit callers; every invalid
 *   intent returns no proposal.
 * - D-11/D-12: this pre-UAT production plan changes no regression artifact and
 *   uses only the bounded production typecheck gate.
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
 * - No multi-selection, group movement, occupied-key overwrite, or
 *   operation-specific preview resolver.
 *
 * This module is dependency-light: it imports only the canonical physical
 * identity/validator from the 36.14-01 model and the existing shared maximum
 * frame capacity. It does not import the current source/display model, store,
 * persistence, bridge, project schema, Studio, any Script controller, or any
 * Preact/hook module.
 */

import type {
  PhysicPaintRotoKeyIdentity,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  createPhysicPaintRotoKeyId,
  isPhysicPaintRotoKeyIdentity,
  isPhysicPaintRotoRealKeyPayload,
  parsePhysicPaintRotoRealKeyRecordCollection,
} from './physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoPhysicalEditSemanticDelta } from '../../../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';

// ---------------------------------------------------------------------------
// Closed edit intent, input, and result contracts.
// ---------------------------------------------------------------------------

/**
 * Discriminated physical edit target for Drag. Direct cells name a desired
 * final `appFrame`; occupied boundaries name a stable target `keyId` resolved
 * after the source slot closes.
 */
export type PhysicPaintRotoPhysicalEditTarget =
  | { readonly kind: 'physical-cell'; readonly appFrame: number }
  | { readonly kind: 'before-key'; readonly targetKeyId: string }
  | { readonly kind: 'after-key'; readonly targetKeyId: string };

/**
 * Closed physical edit intent union. The final union contains exactly Insert,
 * Delete, Move, and Force Spacing.
 *
 * Task 1: `insert-slot` and `delete-key`.
 * Task 2: adds `move-key` with a discriminated {@link PhysicPaintRotoPhysicalEditTarget}.
 * Task 3: adds `force-spacing` with `emptyFrames` and an optional preserved
 * selection identity.
 */
export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | {
      readonly kind: 'move-key';
      readonly movedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    }
  | {
      readonly kind: 'force-spacing';
      readonly emptyFrames: number;
      readonly selectedKeyId: string | null;
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
    };

/**
 * Operation kind literal union, grows alongside {@link PhysicPaintRotoPhysicalEditIntent}.
 */
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'delete-key'
  | 'move-key'
  | 'force-spacing'
  | 'duplicate-key'
  | 'paste-key';

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
 * convenience; the authoritative mapping remains the proposal's `mapping`.
 */
export interface PhysicPaintRotoPhysicalDragPresentation {
  readonly targetKind: 'physical-cell' | 'before-key' | 'after-key';
  readonly targetKeyId: string | null;
  readonly resolvedInsertionAppFrame: number;
  readonly movedKeyId: string;
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
  /** Drag presentation metadata for Move, null for every other operation. */
  readonly drag: PhysicPaintRotoPhysicalDragPresentation | null;
  /** Complete canonical next records for Duplicate/Paste; null for mapping-only edits and replay. */
  readonly nextRecords: readonly PhysicPaintRotoRealKeyRecord[] | null;
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
  | 'invalid-semantic-delta';

/**
 * Discriminated failure result. The failure branch cannot carry a partial
 * proposal.
 */
export interface PhysicPaintRotoPhysicalEditFailure {
  readonly code: PhysicPaintRotoPhysicalEditFailureCode;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind | null;
  readonly text: string;
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
// enabled-only interpolation state to deterministic ordered assignments, exact
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
 * `keyId` plus direct `appFrame`), bounded capacity, and enabled-only
 * interpolation state. No payload, store handle, bridge, or edit intent is
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

export interface PhysicPaintRotoPhysicalEditSemanticDeltaValidationInput {
  readonly operationKind: 'duplicate-key' | 'paste-key';
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
    || value === 'move-key'
    || value === 'force-spacing'
    || value === 'duplicate-key'
    || value === 'paste-key';
}

function fail(
  code: PhysicPaintRotoPhysicalEditFailureCode,
  operationKind: PhysicPaintRotoPhysicalEditOperationKind | null,
  text: string,
): PhysicPaintRotoPhysicalEditResolution {
  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({ code, operationKind, text }) as PhysicPaintRotoPhysicalEditFailure,
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

interface Candidate {
  /** Final identity-to-frame mapping for this operation. */
  readonly mapping: Map<string, number>;
  /** Expected survivor identity set; the finalizer verifies set equality. */
  readonly expectedKeyIds: ReadonlySet<string>;
  /** Removed identity for Delete, null for every other operation. */
  readonly removedKeyId: string | null;
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
    selectedKeyId: nextSelected,
    operationKind: 'delete-key',
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
// D-07 Drag (move-key) candidate builder: cut-and-insert for direct cells and
// occupied identity boundaries. The moved identity is removed first, its
// source slot is closed by shifting every later survivor left by one, the
// target is resolved by stable identity against the post-cut map, and the
// destination is opened by shifting every remaining identity at or after the
// insertion frame right by one before reinserting the moved identity. The
// operation never overwrites or replaces an occupied target.
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

    // Cut first: remove moved, close source slot.
    const postCut = cutSource(identities, movedKeyId, movedFrame);
    // Resolve the target by stable identity against the post-cut map.
    const targetPostCutFrame = postCut.get(target.targetKeyId) as number;
    const insertionFrame = target.kind === 'before-key' ? targetPostCutFrame : targetPostCutFrame + 1;
    if (insertionFrame >= capacity) {
      return {
        ok: false,
        resolution: fail('over-capacity', 'move-key', `Resolved insertion frame ${insertionFrame} is outside capacity ${capacity}.`),
      };
    }
    return { ok: true, candidate: openAndInsert(identities, postCut, movedKeyId, insertionFrame, target) };
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
    selectedKeyId: movedKeyId,
    operationKind: 'move-key',
    changed: false,
    roleByKeyId: new Map<string, 'moved' | 'ripple-right' | 'ripple-left' | 'reanchored'>(),
    drag: Object.freeze({
      targetKind: target.kind,
      targetKeyId: target.kind === 'physical-cell' ? null : target.targetKeyId,
      resolvedInsertionAppFrame: movedFrame,
      movedKeyId,
    }) as PhysicPaintRotoPhysicalDragPresentation,
  };
}

/**
 * Cut the moved identity and close its source slot by shifting every
 * remaining key originally after the moved frame left by exactly one slot.
 * Returns the post-cut identity-to-frame map.
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
  postCut: Map<string, number>,
  movedKeyId: string,
  insertionFrame: number,
  target: PhysicPaintRotoPhysicalEditTarget,
): Candidate {
  const mapping = new Map<string, number>();
  for (const [keyId, frame] of postCut) {
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
    selectedKeyId: movedKeyId,
    operationKind: 'move-key',
    changed: computeChanged(identities, mapping),
    roleByKeyId,
    drag: Object.freeze({
      targetKind: target.kind,
      targetKeyId: target.kind === 'physical-cell' ? null : target.targetKeyId,
      resolvedInsertionAppFrame: insertionFrame,
      movedKeyId,
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
    framesByKeyId: new Map<string, number>(mapping) as ReadonlyMap<string, number>,
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

  // 6. Build affectedKeyIds: shifted identities plus removed identity.
  const affectedList: string[] = changesFrozen.map((change) => change.keyId);
  if (candidate.removedKeyId !== null && !affectedList.includes(candidate.removedKeyId)) {
    affectedList.push(candidate.removedKeyId);
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
  const text = buildStatusText(operationKind, candidate.changed, selectedAppFrame, candidate.removedKeyId);

  const status = Object.freeze({
    operationKind,
    changed: candidate.changed,
    affectedKeyIds,
    affectedCount: affectedKeyIds.length,
    code,
    text,
  }) as PhysicPaintRotoPhysicalEditStatus;

  const proposal = Object.freeze({
    mapping: new Map<string, number>(mapping) as ReadonlyMap<string, number>,
    orderedKeyIds,
    assignments,
    cells: cellsFrozen,
    generatedCells: generatedCellsFrozen,
    selectedKeyId,
    selectedAppFrame,
    changes: changesFrozen,
    removedKeyId: candidate.removedKeyId,
    drag: candidate.drag,
    nextRecords: candidate.nextRecords ?? null,
    semanticDelta: candidate.semanticDelta ?? null,
    status,
  }) as PhysicPaintRotoPhysicalEditProposal;

  return { ok: true, proposal };
}

function buildStatusText(
  operationKind: PhysicPaintRotoPhysicalEditOperationKind,
  changed: boolean,
  selectedAppFrame: number | null,
  removedKeyId: string | null,
): string {
  if (operationKind === 'insert-slot') {
    if (!changed) return 'No change';
    return selectedAppFrame === null
      ? 'Inserted slot'
      : `Inserted slot at frame ${selectedAppFrame}`;
  }
  if (operationKind === 'delete-key') {
    if (removedKeyId === null) return 'No change';
    return 'Deleted key';
  }
  if (operationKind === 'move-key') {
    if (!changed) return 'No change';
    return selectedAppFrame === null
      ? 'Moved key'
      : `Moved key to frame ${selectedAppFrame}`;
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

function validateSemanticInputRecords(
  input: unknown,
  identities: ValidatedIdentities,
  capacity: number,
  operationKind: 'duplicate-key' | 'paste-key',
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
 * bounded capacity, and enabled-only interpolation state.
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
    const candidate = buildDeleteCandidate(identities, intent.selectedKeyId);
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
    const spacingResult = buildForceSpacingCandidate(identities, intent.emptyFrames, intent.selectedKeyId);
    if (!spacingResult.ok) return spacingResult.resolution;
    const finalized = finalizeProposal(spacingResult.candidate, identities, input.capacity, input.interpolationEnabled);
    if (!finalized.ok) return finalized.resolution;
    return Object.freeze({ ok: true as const, proposal: finalized.proposal }) as PhysicPaintRotoPhysicalEditResolution;
  }

  // Exhaustive guard: any future intent kind must be added explicitly.
  return fail('malformed-target', operationKind, 'Unknown physical edit intent kind.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}