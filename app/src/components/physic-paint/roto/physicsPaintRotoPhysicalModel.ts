/**
 * Canonical physical Roto model — stable key identity plus direct physical frame.
 *
 * This module is intentionally INACTIVE after Plan 01. It defines the closed
 * physical identity, real-key payload, generated-cell, enabled-only
 * interpolation, separate Script Motion, aggregate durable successor state,
 * ID creation, and (in Task 2) fail-closed validation interfaces that later
 * plans adopt directly. The current shared live timing contract in
 * `physicPaint.ts`, `rotoSourceDisplayModel.ts`, and related modules remains
 * the sole active production timing authority until owning consumer plans
 * (36.14-02 through 36.14-10) perform coherent cutovers; destructive
 * shared-contract removal is owned by Plan 11 after its production
 * reachability audit proves zero live consumers.
 *
 * Locked decisions honored:
 * - D-01: every durable real Roto key has one stable `keyId` and one physical
 *   `appFrame`. Source, stored, displayed, selected, cached, reopened,
 *   previewed, and exported position are the same coordinate; every
 *   key-owned payload moves with the identity.
 * - D-02: automatic interpolation persists only `enabled` state and derives
 *   exactly `max(0, rightFrame - leftFrame - 1)` interior frames at runtime.
 *   Generated cells are runtime-only derived values and never durable records.
 * - D-04: Script Motion `deformation` and `position` are a separate sibling
 *   Script Motion settings contract, never members of interpolation timing
 *   state.
 * - D-03/D-11/D-12: this plan introduces no adapter, alias, fallback,
 *   dual-write, synchronization path, or alternate publication route. It
 *   changes no regression file and invokes neither Vitest nor an application
 *   server.
 *
 * This module is dependency-light: it imports only a type from the existing
 * rendered-frame contract for payload composition. It does not import the
 * current source/display model, store, persistence, bridge, project schema,
 * Studio, or any Script controller.
 */

import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';

/**
 * Stable durable real-key identity.
 *
 * - `keyId`: stable unique identifier allocated only at an explicit new
 *   real-key creation seam via {@link createPhysicPaintRotoKeyId}. Once
 *   created, the ID remains attached to its durable real-key payload across
 *   physical moves, cache publication, save/reopen, rollback, Undo, and Redo.
 * - `appFrame`: direct nonnegative integer physical frame. There is no
 *   source/display projection; this single coordinate is the sole authority.
 *
 * Both fields are required and bounded; validators reject unknown,
 * partial, malformed, duplicate, or out-of-range identity.
 */
export interface PhysicPaintRotoKeyIdentity {
  readonly keyId: string;
  readonly appFrame: number;
}

/**
 * Allowlisted immutable rendered payload composed from the existing
 * rendered-frame contract.
 *
 * The payload is intentionally a strict subset of {@link PhysicPaintRenderedFrame}:
 * it carries the rendered PNG data and its frame index/dimensions only. It
 * omits `source` (the record discriminator owns "real-key") and
 * `nearestRealKeyFrame` (a generated-cell concept). This keeps a generated
 * descriptor from satisfying a real-key record and prevents old timing
 * metadata from surviving inside the durable payload.
 *
 * All fields are readonly; validators reconstruct a fresh immutable record
 * rather than passing through caller-owned data.
 */
export interface PhysicPaintRotoRealKeyPayload {
  /** Generated sequence-local frame index; 0 for still real-key applies. */
  readonly frameIndex: number;
  /** Direct editor timeline frame that receives this rendered output. */
  readonly appFrame: number;
  /** Rendered PNG output only. Editable stroke/engine state is never transported here. */
  readonly dataUrl: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Durable real-key record: stable identity plus an explicit real-key
 * discriminator and an allowlisted immutable rendered payload.
 *
 * The `kind: 'real-key'` discriminator keeps this structurally distinct from
 * {@link PhysicPaintRotoGeneratedCell}; a generated descriptor cannot
 * satisfy the real-key record interface. Payload follows identity: when a
 * real key moves, its `keyId` is preserved and only `appFrame` changes.
 */
export interface PhysicPaintRotoRealKeyRecord extends PhysicPaintRotoKeyIdentity {
  readonly kind: 'real-key';
  readonly payload: PhysicPaintRotoRealKeyPayload;
}

/**
 * Runtime-only generated interpolation cell.
 *
 * Generated cells carry only runtime derivation metadata: direct
 * `appFrame`, plus the stable key IDs of the adjacent real keys that bound
 * the strict interior gap. They carry no durable payload, no `keyId`, and
 * cannot satisfy the real-key record interface.
 *
 * Per D-02, generated cells are derived exactly as
 * `max(0, rightFrame - leftFrame - 1)` interiors between adjacent ordered
 * real keys. None exist before the first or after the last real key. They
 * are excluded from durable serialization, bridge mapping authority,
 * history identity sets, persisted metadata, and cache ownership.
 */
export interface PhysicPaintRotoGeneratedCell {
  readonly kind: 'generated-interpolation';
  readonly appFrame: number;
  readonly leftKeyId: string;
  readonly rightKeyId: string;
}

/**
 * Enabled-only interpolation state.
 *
 * Per D-02, this is exactly one durable member: `enabled`. There is no
 * persisted `inBetweenCount`, `mode`, `deform`, `position`, or spacing
 * override. Interiors are runtime-derived from adjacent physical real keys.
 * Toggling `enabled` cannot move real keys.
 */
export interface PhysicPaintRotoInterpolationState {
  readonly enabled: boolean;
}

/**
 * Separate Script Motion settings contract.
 *
 * Per D-04, Script Motion `deformation` and `position` are sibling
 * bounded integer percentages (0-100). They are NOT members of
 * {@link PhysicPaintRotoInterpolationState}; they move into this separate
 * contract so the physical interpolation contract can collapse to
 * enabled-only without losing the approved held-pose behavior.
 */
export interface PhysicPaintRotoScriptMotionSettings {
  readonly deformation: number;
  readonly position: number;
}

/**
 * Aggregate durable successor schema: real-key records, enabled-only
 * interpolation, and separate Script Motion.
 *
 * There is no generated-cell member (generated cells are runtime-derived
 * only) and no source/display member. This is the closed shape that owning
 * consumer plans (36.14-03 through 36.14-10) adopt directly for store,
 * persistence, hydration, selection, session, Studio, and Script consumer
 * reconstruction.
 */
export interface PhysicPaintRotoPhysicalState {
  readonly realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly scriptMotion: PhysicPaintRotoScriptMotionSettings;
}

/**
 * Immutable disabled interpolation default.
 *
 * Per D-02: enabled-only state, no count/override/mode fields.
 */
export const PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED: PhysicPaintRotoInterpolationState = Object.freeze({
  enabled: false,
});

/**
 * Immutable zero Script Motion default.
 *
 * Per D-04: separate sibling contract, bounded integer percentages.
 */
export const PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO: PhysicPaintRotoScriptMotionSettings = Object.freeze({
  deformation: 0,
  position: 0,
});

/**
 * Allocate a fresh stable `keyId` for a new durable real key.
 *
 * Uses the supported runtime's native `crypto.randomUUID()` only. Per D-01,
 * ID allocation happens only at an explicit new-real-key creation seam.
 * Validators, decoders, persistence hydration, launch hydration, reopen, and
 * generated-cell construction must never allocate or repair identities.
 *
 * If the production target lacks `crypto.randomUUID()`, callers should stop
 * and record the assumption delta rather than substituting a fallback
 * identifier (per Plan 01 assumptions).
 */
export function createPhysicPaintRotoKeyId(): string {
  return crypto.randomUUID();
}