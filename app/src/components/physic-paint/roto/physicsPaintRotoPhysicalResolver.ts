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

import type { PhysicPaintRotoKeyIdentity } from './physicsPaintRotoPhysicalModel';
import { isPhysicPaintRotoKeyIdentity } from './physicsPaintRotoPhysicalModel';
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
 * Closed physical edit intent union. Grows across tasks 1-3; the final union
 * contains exactly Insert, Delete, Move, and Force Spacing.
 *
 * Task 1: `insert-slot` and `delete-key`.
 * Task 2: adds `move-key` with a discriminated {@link PhysicPaintRotoPhysicalEditTarget}.
 */
export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | {
      readonly kind: 'move-key';
      readonly movedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    };

/**
 * Operation kind literal union, grows alongside {@link PhysicPaintRotoPhysicalEditIntent}.
 */
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'delete-key'
  | 'move-key';

/**
 * Immutable resolver input: stable identities, typed intent, bounded capacity,
 * and interpolation-enabled flag only. No payload, store handle, bridge, or
 * preview/commit mode is accepted.
 */
export interface PhysicPaintRotoPhysicalEditInput {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
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
  | 'moved-as-target';

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
// Private helpers.
// ---------------------------------------------------------------------------

const KEY_ID_MAX_LENGTH = 256;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= KEY_ID_MAX_LENGTH;
}

function operationKindOf(intent: PhysicPaintRotoPhysicalEditIntent): PhysicPaintRotoPhysicalEditOperationKind {
  return intent.kind;
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

interface FinalizedProposal {
  readonly ok: true;
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
}
interface FinalizedFailure {
  readonly ok: false;
  readonly resolution: PhysicPaintRotoPhysicalEditResolution;
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

  // 3. Deterministic ascending physical order.
  const orderedPairs = Array.from(mapping.entries()).sort((a, b) => a[1] - b[1]);
  const orderedKeyIds = Object.freeze(orderedPairs.map((pair) => pair[0])) as readonly string[];
  const assignments = Object.freeze(
    orderedPairs.map((pair) =>
      Object.freeze({ keyId: pair[0], appFrame: pair[1] }) as PhysicPaintRotoPhysicalFrameAssignment,
    ),
  ) as readonly PhysicPaintRotoPhysicalFrameAssignment[];

  // 4. Derive generated cells per D-02: strict interiors only, no leading/trailing.
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

  // 5. Derive bounded physical cells for `0 .. capacity - 1`.
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

  // 6. Derive identity changes from the validated before/after frames.
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

  // 7. Resolve deterministic selection.
  const selectedKeyId = candidate.selectedKeyId;
  const selectedAppFrame = selectedKeyId === null ? null : mapping.get(selectedKeyId) ?? null;

  // 8. Build affectedKeyIds: shifted identities plus removed identity.
  const affectedList: string[] = changesFrozen.map((change) => change.keyId);
  if (candidate.removedKeyId !== null && !affectedList.includes(candidate.removedKeyId)) {
    affectedList.push(candidate.removedKeyId);
  }
  const affectedKeyIds = Object.freeze(affectedList) as readonly string[];

  // 9. Build concise status.
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
  return 'No change';
}

// ---------------------------------------------------------------------------
// Sole exported behavior seam.
// ---------------------------------------------------------------------------

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

  const operationKind = operationKindOf(input.intent);

  if (!validateCapacity(input.capacity)) {
    return fail('invalid-capacity', operationKind, 'Capacity must be an integer from 1 through PHYSIC_PAINT_MAX_APPLY_FRAMES.');
  }

  if (input.intent === null || typeof input.intent !== 'object') {
    return fail('malformed-target', operationKind, 'Intent must be a discriminated record.');
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

  // Exhaustive guard: any future intent kind must be added explicitly.
  return fail('malformed-target', operationKind, 'Unknown physical edit intent kind.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}