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

import type {
  PhysicPaintRenderedFrame,
  PhysicPaintRotoBackgroundMetadata,
} from '../../../types/physicPaint';

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
 * Complete durable physical layer document used by project persistence and
 * standalone launch reconstruction. Generated interpolation cells and runtime
 * cache objects are deliberately absent.
 */
export interface PhysicPaintRotoPhysicalDocument extends PhysicPaintRotoPhysicalState {
  readonly capacity: number;
  readonly background: PhysicPaintRotoBackgroundMetadata | null;
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly revision: string;
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

// ---------------------------------------------------------------------------
// Fail-closed validators and reconstructing parsers (Task 2).
//
// Every guard below uses an exact allowlist: it rejects unknown members and
// removed timing/projection members (`inBetweenCount`, `mode`, `deform`,
// `position` outside the separate Motion contract, `sourceFrame`,
// `displayFrame`, `segmentSpacingOverrides`, etc.). It requires bounded
// non-empty IDs and nonnegative integer frames, valid rendered payload/data
// dimensions under the existing limits, and finite in-range Motion values.
//
// Reconstructing parsers (`parsePhysicPaintRotoRealKeyRecordCollection`,
// `parsePhysicPaintRotoPhysicalState`) construct fresh immutable records from
// allowlisted fields only. They never delete unknown properties, normalize an
// old shape, allocate an ID, or mutate caller-owned data. Invalid input throws
// a closed validation failure and leaves caller-owned data untouched.
//
// These validators are pure and inactive in Plan 01: they perform no project,
// bridge, persistence, store, launch, Script schema, Clipboard, Play Script,
// or Studio wiring. Owning consumer plans (36.14-02 through 36.14-10) call
// this exact module when they replace their complete consumer slice.
// ---------------------------------------------------------------------------

const PHYSIC_PAINT_ROTO_KEY_ID_MAX_LENGTH = 256;
const PHYSIC_PAINT_ROTO_REVISION_MAX_LENGTH = 256;
const PHYSIC_PAINT_ROTO_MAX_PNG_DATA_URL_LENGTH = 64 * 1024 * 1024;
const RENDERED_DATA_URL_PREFIX = 'data:image/png;base64,';

const PHYSIC_PAINT_ROTO_KEY_IDENTITY_KEYS = new Set(['keyId', 'appFrame']);
const PHYSIC_PAINT_ROTO_REAL_KEY_PAYLOAD_KEYS = new Set(['frameIndex', 'appFrame', 'dataUrl', 'width', 'height']);
const PHYSIC_PAINT_ROTO_REAL_KEY_RECORD_KEYS = new Set(['kind', 'keyId', 'appFrame', 'payload']);
const PHYSIC_PAINT_ROTO_GENERATED_CELL_KEYS = new Set(['kind', 'appFrame', 'leftKeyId', 'rightKeyId']);
const PHYSIC_PAINT_ROTO_INTERPOLATION_STATE_KEYS = new Set(['enabled']);
const PHYSIC_PAINT_ROTO_SCRIPT_MOTION_KEYS = new Set(['deformation', 'position']);
const PHYSIC_PAINT_ROTO_PHYSICAL_STATE_KEYS = new Set(['realKeyRecords', 'interpolation', 'scriptMotion']);
const PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS = new Set([
  'capacity',
  'realKeyRecords',
  'interpolation',
  'scriptMotion',
  'background',
  'selectedKeyId',
  'cursorAppFrame',
  'revision',
]);
const PHYSIC_PAINT_ROTO_BACKGROUND_KEYS = new Set(['background', 'paperGrain', 'grainStrength', 'color']);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBoundedKeyId(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= PHYSIC_PAINT_ROTO_KEY_ID_MAX_LENGTH;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPercentInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isRenderedPngDataUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith(RENDERED_DATA_URL_PREFIX)) return false;
  if (value.length <= RENDERED_DATA_URL_PREFIX.length || value.length > PHYSIC_PAINT_ROTO_MAX_PNG_DATA_URL_LENGTH) return false;
  const encoded = value.slice(RENDERED_DATA_URL_PREFIX.length);
  return encoded.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(encoded);
}

function optionalDimension(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

function isPhysicPaintRotoBackground(value: unknown): value is PhysicPaintRotoBackgroundMetadata {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_BACKGROUND_KEYS)) return false;
  if (value.background !== 'transparent' && value.background !== 'white' && value.background !== 'canvas1' && value.background !== 'canvas2' && value.background !== 'canvas3') return false;
  if (!isNonEmptyString(value.paperGrain)) return false;
  if (typeof value.grainStrength !== 'number' || !Number.isFinite(value.grainStrength) || value.grainStrength < 0 || value.grainStrength > 1) return false;
  return value.color === undefined || typeof value.color === 'string';
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

/**
 * Strict guard for {@link PhysicPaintRotoKeyIdentity}.
 *
 * Rejects non-records, unknown members, empty/oversized `keyId`, and
 * non-integer or negative `appFrame`.
 */
export function isPhysicPaintRotoKeyIdentity(value: unknown): value is PhysicPaintRotoKeyIdentity {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_KEY_IDENTITY_KEYS)) return false;
  return isBoundedKeyId(value.keyId) && isNonNegativeInteger(value.appFrame);
}

/**
 * Strict guard for {@link PhysicPaintRotoRealKeyPayload}.
 *
 * Rejects unknown members, non-PNG data URLs, non-integer or negative frame
 * indices/frames, and non-finite width/height. Composed from the existing
 * rendered-frame allowlist; `source` and `nearestRealKeyFrame` are excluded
 * so a payload cannot carry source/display or generated-cell provenance.
 */
export function isPhysicPaintRotoRealKeyPayload(value: unknown): value is PhysicPaintRotoRealKeyPayload {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_REAL_KEY_PAYLOAD_KEYS)) return false;
  if (!isNonNegativeInteger(value.frameIndex)) return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  if (!isRenderedPngDataUrl(value.dataUrl)) return false;
  if (!optionalDimension(value.width) || !optionalDimension(value.height)) return false;
  return (value.width === undefined) === (value.height === undefined);
}

/**
 * Strict guard for {@link PhysicPaintRotoRealKeyRecord}.
 *
 * Rejects non-records, unknown members, wrong `kind`, partial identity, and
 * malformed payloads. A generated descriptor (`kind: 'generated-interpolation'`)
 * cannot satisfy this guard, keeping the two interfaces structurally distinct.
 */
export function isPhysicPaintRotoRealKeyRecord(value: unknown): value is PhysicPaintRotoRealKeyRecord {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_REAL_KEY_RECORD_KEYS)) return false;
  if (value.kind !== 'real-key') return false;
  if (!isBoundedKeyId(value.keyId)) return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  return isPhysicPaintRotoRealKeyPayload(value.payload);
}

/**
 * Strict guard for {@link PhysicPaintRotoGeneratedCell}.
 *
 * Rejects non-records, unknown members, wrong `kind`, non-integer or negative
 * `appFrame`, and invalid adjacent key IDs. A generated cell carries no
 * durable payload or identity and cannot satisfy the real-key record guard.
 */
export function isPhysicPaintRotoGeneratedCell(value: unknown): value is PhysicPaintRotoGeneratedCell {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_GENERATED_CELL_KEYS)) return false;
  if (value.kind !== 'generated-interpolation') return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  return isBoundedKeyId(value.leftKeyId) && isBoundedKeyId(value.rightKeyId);
}

/**
 * Strict guard for {@link PhysicPaintRotoInterpolationState}.
 *
 * Rejects non-records, unknown members (including removed timing/projection
 * fields like `inBetweenCount`, `mode`, `deform`, `position`, and
 * `segmentSpacingOverrides`), and non-boolean `enabled`.
 */
export function isPhysicPaintRotoInterpolationState(value: unknown): value is PhysicPaintRotoInterpolationState {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_INTERPOLATION_STATE_KEYS)) return false;
  return typeof value.enabled === 'boolean';
}

/**
 * Strict guard for {@link PhysicPaintRotoScriptMotionSettings}.
 *
 * Rejects non-records, unknown members, and Motion values that are not bounded
 * integer percentages (0-100). Motion lives in this separate sibling contract,
 * never inside interpolation timing state (D-04).
 */
export function isPhysicPaintRotoScriptMotionSettings(value: unknown): value is PhysicPaintRotoScriptMotionSettings {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_SCRIPT_MOTION_KEYS)) return false;
  return isPercentInteger(value.deformation) && isPercentInteger(value.position);
}

/**
 * Reconstruct a fresh, deterministically sorted, deeply immutable real-key
 * record collection from untrusted input.
 *
 * Rejects:
 * - non-array input;
 * - malformed real-key records (including generated descriptors, which fail
 *   the `kind: 'real-key'` check);
 * - duplicate `keyId`;
 * - duplicate `appFrame`;
 * - partial identity (caught by the record guard);
 * - out-of-capacity `appFrame` when `capacity` is supplied.
 *
 * Only after full validation does it construct a fresh array of fresh frozen
 * records, sorted deterministically by `appFrame`. Caller-owned input is
 * never mutated; unknown properties are never deleted or normalized; no ID is
 * ever allocated by this parser.
 *
 * Throws a closed validation failure on any invalid input.
 */
export function parsePhysicPaintRotoRealKeyRecordCollection(
  value: unknown,
  capacity?: number,
): readonly PhysicPaintRotoRealKeyRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('PhysicPaintRotoRealKeyRecordCollection: expected an array of real-key records.');
  }
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 0)) {
    throw new Error('PhysicPaintRotoRealKeyRecordCollection: capacity must be a nonnegative integer.');
  }

  const records: PhysicPaintRotoRealKeyRecord[] = [];
  const seenKeyIds = new Set<string>();
  const seenAppFrames = new Set<number>();

  for (const entry of value) {
    if (!isPhysicPaintRotoRealKeyRecord(entry)) {
      throw new Error('PhysicPaintRotoRealKeyRecordCollection: malformed real-key record.');
    }
    if (entry.payload.appFrame !== entry.appFrame) {
      throw new Error(`PhysicPaintRotoRealKeyRecordCollection: payload appFrame ${entry.payload.appFrame} does not match record appFrame ${entry.appFrame}.`);
    }
    if (seenKeyIds.has(entry.keyId)) {
      throw new Error(`PhysicPaintRotoRealKeyRecordCollection: duplicate keyId "${entry.keyId}".`);
    }
    if (seenAppFrames.has(entry.appFrame)) {
      throw new Error(`PhysicPaintRotoRealKeyRecordCollection: duplicate appFrame ${entry.appFrame}.`);
    }
    if (capacity !== undefined && entry.appFrame >= capacity) {
      throw new Error(`PhysicPaintRotoRealKeyRecordCollection: appFrame ${entry.appFrame} exceeds capacity ${capacity}.`);
    }
    seenKeyIds.add(entry.keyId);
    seenAppFrames.add(entry.appFrame);
    records.push(cloneAndFreezeRealKeyRecord(entry));
  }

  records.sort((a, b) => a.appFrame - b.appFrame);
  return Object.freeze(records);
}

/**
 * Reconstruct the aggregate {@link PhysicPaintRotoPhysicalState} successor
 * schema from untrusted input.
 *
 * Rejects:
 * - non-records;
 * - unknown or legacy siblings (`sourceFrame`, `displayFrame`, generated
 *   cells, count, overrides, etc.);
 * - invalid real-key records (delegates to
 *   {@link parsePhysicPaintRotoRealKeyRecordCollection});
 * - invalid enabled-only interpolation state;
 * - invalid separate Script Motion settings.
 *
 * Reconstructs exactly the validated real-key collection, enabled-only
 * interpolation, and separate Motion state. No generated records or legacy
 * siblings survive. Caller-owned input is never mutated; unknown properties
 * are never deleted or normalized; no ID is ever allocated by this parser.
 *
 * Throws a closed validation failure on any invalid input.
 */
export function parsePhysicPaintRotoPhysicalState(
  value: unknown,
  capacity?: number,
): PhysicPaintRotoPhysicalState {
  if (!isRecord(value)) {
    throw new Error('PhysicPaintRotoPhysicalState: expected a record.');
  }
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_PHYSICAL_STATE_KEYS)) {
    throw new Error('PhysicPaintRotoPhysicalState: unknown members; expected exactly realKeyRecords, interpolation, scriptMotion.');
  }
  if (!isPhysicPaintRotoInterpolationState(value.interpolation)) {
    throw new Error('PhysicPaintRotoPhysicalState: invalid enabled-only interpolation state.');
  }
  if (!isPhysicPaintRotoScriptMotionSettings(value.scriptMotion)) {
    throw new Error('PhysicPaintRotoPhysicalState: invalid Script Motion settings.');
  }
  if (!Array.isArray(value.realKeyRecords)) {
    throw new Error('PhysicPaintRotoPhysicalState: realKeyRecords must be an array.');
  }

  const realKeyRecords = parsePhysicPaintRotoRealKeyRecordCollection(value.realKeyRecords, capacity);
  const interpolation = Object.freeze<PhysicPaintRotoInterpolationState>({
    enabled: value.interpolation.enabled,
  });
  const scriptMotion = Object.freeze<PhysicPaintRotoScriptMotionSettings>({
    deformation: value.scriptMotion.deformation,
    position: value.scriptMotion.position,
  });

  return Object.freeze<PhysicPaintRotoPhysicalState>({
    realKeyRecords,
    interpolation,
    scriptMotion,
  });
}

function cloneAndFreezeRealKeyPayload(payload: PhysicPaintRotoRealKeyPayload): PhysicPaintRotoRealKeyPayload {
  return Object.freeze({
    frameIndex: payload.frameIndex,
    appFrame: payload.appFrame,
    dataUrl: payload.dataUrl,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  }) as PhysicPaintRotoRealKeyPayload;
}

function cloneAndFreezeRealKeyRecord(record: PhysicPaintRotoRealKeyRecord): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: cloneAndFreezeRealKeyPayload(record.payload),
  }) as PhysicPaintRotoRealKeyRecord;
}

// ---------------------------------------------------------------------------
// Deterministic physical content revision (Plan 36.14-04 Task 1).
//
// Per D-09: the parent and child agree on expected/staged/accepted physical
// revisions before acceptance. The revision is a deterministic fingerprint of
// the validated authoritative real-key records plus enabled-only
// interpolation state; it is distinct from `physicPaintVersion`, which
// remains a monotonic visual invalidation signal.
//
// The revision is computed only from a validated immutable real-key
// collection plus enabled-only interpolation state. Canonicalization is
// performed in stable `keyId` order so equal content produces equal
// revisions regardless of input order. The fingerprint covers every durable
// payload field and the direct `appFrame`. Malformed, duplicate, generated,
// or removed-shape input is rejected via the existing validators rather than
// normalized.
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic physical content revision for a validated
 * immutable real-key collection plus enabled-only interpolation state.
 *
 * Per D-09: this revision is the canonical expected/staged/accepted
 * fingerprint used by the generic acknowledged physical-edit transaction. It
 * is independent from `physicPaintVersion` (a monotonic visual invalidation
 * signal) and contains no source/display, generated-cell, or timing-override
 * metadata.
 *
 * Canonicalization:
 * - records are sorted by stable `keyId` so equal content produces equal
 *   revisions regardless of input order;
 * - every durable payload field (`frameIndex`, `appFrame`, `dataUrl`,
 *   `width`, `height`) and the direct `appFrame` contribute to the
 *   fingerprint;
 * - the enabled-only interpolation flag contributes as a single boolean.
 *
 * Rejection:
 * - non-array input;
 * - duplicate `keyId`;
 * - malformed real-key records (including generated descriptors, which fail
 *   the `kind: 'real-key'` check);
 * - invalid enabled-only interpolation state.
 *
 * Throws a closed validation failure on any invalid input; caller-owned data
 * is never mutated.
 */
export function buildPhysicPaintRotoPhysicalRevision(
  records: unknown,
  interpolation: unknown,
): string {
  const source = encodePhysicPaintRotoPhysicalContent(records, interpolation);
  return `physical-${hashCanonicalPhysicalValue(source)}`;
}

/**
 * Canonical allowlisted encoding shared by content revision and persisted
 * project equality. Strings are length-prefixed, so payload text cannot create
 * delimiter collisions. Records are ordered by stable identity, not input or
 * presentation order.
 */
export function encodePhysicPaintRotoPhysicalContent(
  records: unknown,
  interpolation: unknown,
): string {
  const validated = parsePhysicPaintRotoRealKeyRecordCollection(records);
  if (!isPhysicPaintRotoInterpolationState(interpolation)) {
    throw new Error('PhysicPaintRotoPhysicalRevision: invalid enabled-only interpolation state.');
  }
  const orderedByIdentity = [...validated].sort((a, b) => a.keyId.localeCompare(b.keyId));
  const encodedRecords = orderedByIdentity.map((record) => [
    encodeCanonicalString(record.keyId),
    encodeCanonicalNumber(record.appFrame),
    encodeCanonicalNumber(record.payload.frameIndex),
    encodeCanonicalNumber(record.payload.appFrame),
    encodeCanonicalString(record.payload.dataUrl),
    encodeCanonicalOptionalNumber(record.payload.width),
    encodeCanonicalOptionalNumber(record.payload.height),
  ].join('')).join('');
  return `records:${orderedByIdentity.length}:${encodedRecords}interpolation:${validatedBoolean(interpolation.enabled)}`;
}

/** Build the broader persisted equality fingerprint for one complete layer. */
export function buildPhysicPaintRotoProjectEquality(value: unknown): string {
  const document = parsePhysicPaintRotoPhysicalDocument(value);
  const source = [
    encodePhysicPaintRotoPhysicalContent(document.realKeyRecords, document.interpolation),
    `capacity:${encodeCanonicalNumber(document.capacity)}`,
    `motion:${encodeCanonicalNumber(document.scriptMotion.deformation)}${encodeCanonicalNumber(document.scriptMotion.position)}`,
    `background:${encodeCanonicalBackground(document.background)}`,
    `selection:${document.selectedKeyId === null ? 'null;' : encodeCanonicalString(document.selectedKeyId)}`,
    `cursor:${encodeCanonicalNumber(document.cursorAppFrame)}`,
  ].join('');
  return `project-${hashCanonicalPhysicalValue(source)}`;
}

/**
 * Reconstruct and freeze one complete physical layer document. The persisted
 * revision is checked against canonical content before any caller can publish
 * the candidate.
 */
export function parsePhysicPaintRotoPhysicalDocument(value: unknown): PhysicPaintRotoPhysicalDocument {
  if (!isRecord(value) || !hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS)) {
    throw new Error('PhysicPaintRotoPhysicalDocument: unknown or missing document members.');
  }
  if (!Number.isInteger(value.capacity) || (value.capacity as number) < 1) {
    throw new Error('PhysicPaintRotoPhysicalDocument: capacity must be a positive integer.');
  }
  const capacity = value.capacity as number;
  const state = parsePhysicPaintRotoPhysicalState({
    realKeyRecords: value.realKeyRecords,
    interpolation: value.interpolation,
    scriptMotion: value.scriptMotion,
  }, capacity);
  if (value.background !== null && !isPhysicPaintRotoBackground(value.background)) {
    throw new Error('PhysicPaintRotoPhysicalDocument: invalid background metadata.');
  }
  if (value.selectedKeyId !== null && !isBoundedKeyId(value.selectedKeyId)) {
    throw new Error('PhysicPaintRotoPhysicalDocument: selectedKeyId must be null or a bounded identity.');
  }
  if (!isNonNegativeInteger(value.cursorAppFrame) || value.cursorAppFrame >= capacity) {
    throw new Error('PhysicPaintRotoPhysicalDocument: cursorAppFrame is outside physical capacity.');
  }
  if (!isNonEmptyString(value.revision) || value.revision.length > PHYSIC_PAINT_ROTO_REVISION_MAX_LENGTH) {
    throw new Error('PhysicPaintRotoPhysicalDocument: revision must be a bounded non-empty string.');
  }
  const selectedRecord = value.selectedKeyId === null
    ? null
    : state.realKeyRecords.find((record) => record.keyId === value.selectedKeyId) ?? null;
  if (value.selectedKeyId !== null && selectedRecord === null) {
    throw new Error('PhysicPaintRotoPhysicalDocument: selectedKeyId does not exist in realKeyRecords.');
  }
  if (selectedRecord && selectedRecord.appFrame !== value.cursorAppFrame) {
    throw new Error('PhysicPaintRotoPhysicalDocument: selected identity and cursorAppFrame disagree.');
  }
  const revision = buildPhysicPaintRotoPhysicalRevision(state.realKeyRecords, state.interpolation);
  if (value.revision !== revision) {
    throw new Error('PhysicPaintRotoPhysicalDocument: canonical revision mismatch.');
  }
  const background = value.background === null ? null : Object.freeze({ ...value.background }) as PhysicPaintRotoBackgroundMetadata;
  return Object.freeze({
    capacity,
    realKeyRecords: state.realKeyRecords,
    interpolation: state.interpolation,
    scriptMotion: state.scriptMotion,
    background,
    selectedKeyId: value.selectedKeyId,
    cursorAppFrame: value.cursorAppFrame,
    revision,
  });
}

function encodeCanonicalString(value: string): string {
  return `s${value.length}:${value};`;
}

function encodeCanonicalNumber(value: number): string {
  return `n${String(value)};`;
}

function encodeCanonicalOptionalNumber(value: number | undefined): string {
  return value === undefined ? 'u;' : encodeCanonicalNumber(value);
}

function validatedBoolean(value: boolean): string {
  return value ? '1;' : '0;';
}

function encodeCanonicalBackground(value: PhysicPaintRotoBackgroundMetadata | null): string {
  if (value === null) return 'null;';
  return [
    encodeCanonicalString(value.background),
    encodeCanonicalString(value.paperGrain),
    encodeCanonicalNumber(value.grainStrength),
    value.color === undefined ? 'u;' : encodeCanonicalString(value.color),
  ].join('');
}

function hashCanonicalPhysicalValue(source: string): string {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}-${(hash >>> 0).toString(16)}`;
}