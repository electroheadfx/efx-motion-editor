/**
 * Canonical physical Roto model — stable key identity plus direct physical frame.
 *
 * This module is intentionally INACTIVE after Plan 01. It defines the closed
 * physical identity, real-key payload, generated-cell, canonical
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
 * - D-02: automatic interpolation persists `enabled` plus canonical render
 *   `mode` and derives exactly `max(0, rightFrame - leftFrame - 1)` interior
 *   frames at runtime. Generated cells are runtime-only derived values and
 *   never durable records.
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
 * Identity/revision-aware runtime render source shared by Studio, preview, and
 * export.
 *
 * Phase 43 (D-26/D-27): linked Loop Clip occurrences resolve through the SAME
 * 'real' variant as their source key — `keyId` is the source keyId and the
 * cache revision is source-scoped (`${contentRevision}:real:${sourceKeyId}`),
 * so one source cache entry serves every occurrence and one source edit
 * invalidates them all. A frame inside an unresolvable loop range surfaces the
 * 'loop-placeholder' variant (43-09, D-28) carrying the full 43-02 typed
 * 'linked-unresolved' contract payload (loopId, placementStart, source keyIds,
 * missing source keyIds) — enough for the capsule error state, the
 * destination-frame placeholder, the missing-source tooltip, the export
 * preflight, and the repair/relink actions. It carries no rendered payload and
 * is NEVER Paint content: preview renders it as a marked placeholder frame,
 * export blocks the range before the first frame renders, and renderable-only
 * consumers narrow it away via {@link PhysicPaintRotoPhysicalRenderableSource}.
 */
export type PhysicPaintRotoPhysicalRenderSource =
  | {
      readonly kind: 'real';
      readonly layerId: string;
      readonly appFrame: number;
      readonly keyId: string;
      readonly contentRevision: string;
      readonly cacheRevision: string;
      readonly renderedFrame: PhysicPaintRotoRealKeyPayload;
    }
  | {
      readonly kind: 'generated';
      readonly layerId: string;
      readonly appFrame: number;
      readonly leftKeyId: string;
      readonly rightKeyId: string;
      readonly interpolationMode: PhysicPaintRotoInterpolationMode;
      /** Present only for a generated frame projected from a linked source cycle. */
      readonly sourceCycleId?: string;
      /** Present only for a generated frame projected from a linked source cycle. */
      readonly cycleOffset?: number;
      readonly contentRevision: string;
      readonly cacheRevision: string;
      readonly renderedFrame: PhysicPaintRotoRealKeyPayload;
    }
  | {
      readonly kind: 'loop-placeholder';
      readonly layerId: string;
      readonly appFrame: number;
      readonly loopId: string;
      readonly placementStart: number;
      readonly sourceKeyIds: readonly string[];
      readonly missingSourceKeyIds: readonly string[];
    };

/** The renderable subset of {@link PhysicPaintRotoPhysicalRenderSource} (carries a payload). */
export type PhysicPaintRotoPhysicalRenderableSource = Exclude<
  PhysicPaintRotoPhysicalRenderSource,
  { readonly kind: 'loop-placeholder' }
>;

/** Canonical render behavior for runtime-derived interpolation cells. */
export type PhysicPaintRotoInterpolationMode = 'duplicate' | 'blend';

/**
 * Canonical physical interpolation state.
 *
 * Interiors are runtime-derived from adjacent physical real keys. The durable
 * state controls whether those interiors exist and how they render; it carries
 * no count, Motion values, or spacing override. Changing either field cannot
 * move real keys.
 */
export interface PhysicPaintRotoInterpolationState {
  readonly enabled: boolean;
  readonly mode: PhysicPaintRotoInterpolationMode;
}

/**
 * Separate Script Motion settings contract.
 *
 * Per D-04, Script Motion `deformation` and `position` are sibling
 * bounded integer percentages (0-100). They are NOT members of
 * {@link PhysicPaintRotoInterpolationState}; they move into this separate
 * contract so the physical interpolation contract can collapse to
 * focused on render behavior without losing the approved held-pose behavior.
 */
export interface PhysicPaintRotoScriptMotionSettings {
  readonly deformation: number;
  readonly position: number;
}

/**
 * Aggregate durable successor schema: real-key records, canonical
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
 * Durable linked Loop Clip record (Phase 43, D-29/D-30/D-31).
 *
 * - `loopId`: stable Loop Clip identity, allocated like a keyId at an
 *   explicit creation seam.
 * - `placementStart`: first frame of THIS Loop Clip's presentation on the
 *   destination timeline — the first source-cycle key frame for an original
 *   loop, the chosen destination frame for a duplicated loop. Placement and
 *   physical source location are two independent persisted identities; the
 *   source location is derived separately from `sourceKeyIds`. Parsers never
 *   derive or validate placement from source key frames.
 * - `sourceKeyIds`: ordered stable source-cycle keyId references; the
 *   collection length IS the cycle length. Dangling references are legal at
 *   parse time and are preserved verbatim (D-31) — never dropped, normalized,
 *   or rewritten at load.
 * - `repeat`: finite positive integer or the explicit `'infinity'` state.
 * - `mode`: source-cycle provenance for presentation (`'progressive'` or
 *   `'static'`).
 * - `scriptId` / `motion` / `overrideColor` (43-06, optional): source-cycle
 *   provenance required by the approved UI (D-29) — the S3 source-edit prefill
 *   reloads the script snapshot and restores the Motion/color options, and the
 *   S4 Link/Create matching compares them (D-05). All-or-nothing: when any
 *   provenance key is present, all three must be present and valid
 *   (`overrideColor` may be an explicit `null` for Original colors). Records
 *   created before the 43-06 provenance seam (in-phase fixtures) carry none
 *   and never participate in matching or source-edit.
 *
 * Derived loop state (effective duration, next-clip boundary, repeat-instance
 * mappings, resolved destination frames) is NEVER persisted (D-30).
 */
export interface PhysicPaintRotoGroupVisibleRange {
  readonly start: number;
  readonly endExclusive: number;
}

export interface PhysicPaintRotoGroupFrameOverride {
  readonly appFrame: number;
  readonly keyId: string;
}

export interface PhysicPaintRotoLoopClip {
  readonly loopId: string;
  readonly placementStart: number;
  readonly sourceKeyIds: readonly string[];
  readonly repeat: number | 'infinity';
  readonly mode: 'progressive' | 'static';
  readonly scriptId?: string;
  readonly motion?: PhysicPaintRotoScriptMotionSettings;
  readonly overrideColor?: string | null;
  /** Durable Group lifecycle facts. Canonical finite Groups always carry all six members. */
  readonly syncState?: 'synchronized' | 'modified';
  readonly provenanceState?: 'attached' | 'detached';
  readonly phaseOrigin?: number;
  readonly originalEndExclusive?: number;
  readonly visibleRanges?: readonly PhysicPaintRotoGroupVisibleRange[];
  readonly frameOverrides?: readonly PhysicPaintRotoGroupFrameOverride[];
}

/** Immutable empty Loop Clip collection shared by every absent-means-empty read. */
export const PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY: readonly PhysicPaintRotoLoopClip[] = Object.freeze([]);

/** Immutable empty stable-key-owned incoming interpolation break collection. */
export const PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY: readonly string[] = Object.freeze([]);

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
  /**
   * Additive linked Loop Clip collection (Phase 43, D-29). Always present on
   * the reconstructed document; a persisted document without the member loads
   * as the empty collection with no migration.
   */
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  /** Stable real-key IDs whose incoming interpolation span is intentionally broken. */
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}

/** Immutable disabled interpolation default. */
export const PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED: PhysicPaintRotoInterpolationState = Object.freeze({
  enabled: false,
  mode: 'duplicate',
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
const PHYSIC_PAINT_ROTO_INTERPOLATION_STATE_KEYS = new Set(['enabled', 'mode']);
const PHYSIC_PAINT_ROTO_SCRIPT_MOTION_KEYS = new Set(['deformation', 'position']);
const PHYSIC_PAINT_ROTO_PHYSICAL_STATE_KEYS = new Set(['realKeyRecords', 'interpolation', 'scriptMotion']);
const PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS = new Set([
  'loopId',
  'placementStart',
  'sourceKeyIds',
  'repeat',
  'mode',
  'scriptId',
  'motion',
  'overrideColor',
  'syncState',
  'provenanceState',
  'phaseOrigin',
  'originalEndExclusive',
  'visibleRanges',
  'frameOverrides',
]);
const PHYSIC_PAINT_ROTO_GROUP_VISIBLE_RANGE_KEYS = new Set(['start', 'endExclusive']);
const PHYSIC_PAINT_ROTO_GROUP_FRAME_OVERRIDE_KEYS = new Set(['appFrame', 'keyId']);
const PHYSIC_PAINT_ROTO_GROUP_LIFECYCLE_KEYS = [
  'syncState',
  'provenanceState',
  'phaseOrigin',
  'originalEndExclusive',
  'visibleRanges',
  'frameOverrides',
] as const;
const PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS = new Set([
  'capacity',
  'realKeyRecords',
  'interpolation',
  'scriptMotion',
  'background',
  'selectedKeyId',
  'cursorAppFrame',
  'revision',
  'loopClips',
  'incomingInterpolationBreakKeyIds',
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
 * Rejects non-records, unknown members, missing fields, removed timing/Motion
 * fields, non-boolean `enabled`, and unknown render modes.
 */
export function isPhysicPaintRotoInterpolationState(value: unknown): value is PhysicPaintRotoInterpolationState {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_INTERPOLATION_STATE_KEYS)) return false;
  return typeof value.enabled === 'boolean'
    && (value.mode === 'duplicate' || value.mode === 'blend');
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

function hasValidPhysicPaintRotoGroupLifecycle(value: Record<string, unknown>): boolean {
  const lifecycleCount = PHYSIC_PAINT_ROTO_GROUP_LIFECYCLE_KEYS.reduce(
    (count, key) => count + (value[key] !== undefined ? 1 : 0),
    0,
  );
  if (lifecycleCount === 0) return true;
  if (lifecycleCount !== PHYSIC_PAINT_ROTO_GROUP_LIFECYCLE_KEYS.length) return false;
  if (value.syncState !== 'synchronized' && value.syncState !== 'modified') return false;
  if (value.provenanceState !== 'attached' && value.provenanceState !== 'detached') return false;
  if (!isNonNegativeInteger(value.phaseOrigin) || !isNonNegativeInteger(value.originalEndExclusive)) return false;
  const phaseOrigin = value.phaseOrigin as number;
  const originalEndExclusive = value.originalEndExclusive as number;
  if (originalEndExclusive <= phaseOrigin) return false;
  if (!Array.isArray(value.visibleRanges) || value.visibleRanges.length === 0) return false;
  let previousEndExclusive = -1;
  for (const range of value.visibleRanges) {
    if (!isRecord(range) || !hasOnlyAllowedKeys(range, PHYSIC_PAINT_ROTO_GROUP_VISIBLE_RANGE_KEYS)) return false;
    if (!isNonNegativeInteger(range.start) || !isNonNegativeInteger(range.endExclusive)) return false;
    if (range.start < phaseOrigin || range.endExclusive > originalEndExclusive || range.endExclusive <= range.start) return false;
    if (range.start <= previousEndExclusive) return false;
    previousEndExclusive = range.endExclusive;
  }
  if (!Array.isArray(value.frameOverrides)) return false;
  const overrideFrames = new Set<number>();
  const overrideKeyIds = new Set<string>();
  for (const override of value.frameOverrides) {
    if (!isRecord(override) || !hasOnlyAllowedKeys(override, PHYSIC_PAINT_ROTO_GROUP_FRAME_OVERRIDE_KEYS)) return false;
    if (!isNonNegativeInteger(override.appFrame)
      || override.appFrame < phaseOrigin
      || override.appFrame >= originalEndExclusive
      || !value.visibleRanges.some((range) => (
        isRecord(range)
        && typeof range.start === 'number'
        && typeof range.endExclusive === 'number'
        && override.appFrame >= range.start
        && override.appFrame < range.endExclusive
      ))
      || !isBoundedKeyId(override.keyId)
      || overrideFrames.has(override.appFrame)
      || overrideKeyIds.has(override.keyId)) return false;
    overrideFrames.add(override.appFrame);
    overrideKeyIds.add(override.keyId);
  }
  return true;
}

/**
 * Strict guard for {@link PhysicPaintRotoLoopClip}.
 *
 * Rejects non-records, unknown members (including the superseded overloaded
 * `canonicalStart` field name — there is no compatibility alias), missing
 * fields, empty or malformed `sourceKeyIds`, non-positive/non-integer finite
 * `repeat` values, any `repeat` other than a positive safe integer or the
 * explicit string `'infinity'`, and unknown modes. Source keyIds are NOT
 * validated against existing keys — dangling references are legal and
 * preserved verbatim (D-31). `placementStart` is NOT derived from or checked
 * against source key frames — placement and source location are independent
 * identities.
 */
export function isPhysicPaintRotoLoopClip(value: unknown): value is PhysicPaintRotoLoopClip {
  if (!isRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS)) return false;
  if (!isBoundedKeyId(value.loopId)) return false;
  if (!isNonNegativeInteger(value.placementStart)) return false;
  if (!Array.isArray(value.sourceKeyIds) || value.sourceKeyIds.length === 0) return false;
  if (!value.sourceKeyIds.every(isBoundedKeyId)) return false;
  if (value.repeat !== 'infinity') {
    if (typeof value.repeat !== 'number' || !Number.isSafeInteger(value.repeat) || value.repeat < 1) return false;
  }
  if (value.mode !== 'progressive' && value.mode !== 'static') return false;
  // 43-06 provenance: all-or-nothing — any provenance key requires all three.
  const hasProvenance = value.scriptId !== undefined || value.motion !== undefined || value.overrideColor !== undefined;
  if (hasProvenance) {
    if (!isBoundedKeyId(value.scriptId)) return false;
    if (!isPhysicPaintRotoScriptMotionSettings(value.motion)) return false;
    if (value.overrideColor !== null
      && !(typeof value.overrideColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.overrideColor))) return false;
  }
  return hasValidPhysicPaintRotoGroupLifecycle(value);
}

function buildDefaultPhysicPaintRotoGroupLifecycle(
  entry: PhysicPaintRotoLoopClip,
): Pick<PhysicPaintRotoLoopClip, 'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'> | null {
  if (entry.repeat === 'infinity') return null;
  const originalEndExclusive = entry.placementStart + entry.sourceKeyIds.length * entry.repeat;
  if (!Number.isSafeInteger(originalEndExclusive) || originalEndExclusive <= entry.placementStart) {
    throw new Error(`PhysicPaintRotoLoopClips: Group "${entry.loopId}" default extent is invalid.`);
  }
  return {
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: entry.placementStart,
    originalEndExclusive,
    visibleRanges: Object.freeze([Object.freeze({
      start: entry.placementStart,
      endExclusive: originalEndExclusive,
    })]),
    frameOverrides: Object.freeze([]),
  };
}

/**
 * Reconstruct a fresh, deeply immutable Loop Clip collection from untrusted
 * input. Preserves the persisted order and every source keyId reference
 * verbatim (D-31); rejects duplicate `loopId` identities. Finite pre-lifecycle
 * records hydrate to one synchronized, attached, contiguous Group so every
 * canonical consumer observes the complete lifecycle shape. Throws a closed
 * validation failure on any structurally malformed input.
 */
export function parsePhysicPaintRotoLoopClips(value: unknown): readonly PhysicPaintRotoLoopClip[] {
  if (!Array.isArray(value)) {
    throw new Error('PhysicPaintRotoLoopClips: expected an array of Loop Clip records.');
  }
  const clips: PhysicPaintRotoLoopClip[] = [];
  const seenLoopIds = new Set<string>();
  for (const entry of value) {
    if (!isPhysicPaintRotoLoopClip(entry)) {
      throw new Error('PhysicPaintRotoLoopClips: malformed Loop Clip record.');
    }
    if (seenLoopIds.has(entry.loopId)) {
      throw new Error(`PhysicPaintRotoLoopClips: duplicate loopId "${entry.loopId}".`);
    }
    seenLoopIds.add(entry.loopId);
    const defaultLifecycle = entry.syncState === undefined
      ? buildDefaultPhysicPaintRotoGroupLifecycle(entry)
      : null;
    clips.push(Object.freeze({
      loopId: entry.loopId,
      placementStart: entry.placementStart,
      sourceKeyIds: Object.freeze([...entry.sourceKeyIds]),
      repeat: entry.repeat,
      mode: entry.mode,
      ...(entry.scriptId !== undefined
        ? {
            scriptId: entry.scriptId,
            motion: Object.freeze({ deformation: entry.motion!.deformation, position: entry.motion!.position }),
            overrideColor: entry.overrideColor ?? null,
          }
        : {}),
      ...(entry.syncState !== undefined
        ? {
            syncState: entry.syncState,
            provenanceState: entry.provenanceState!,
            phaseOrigin: entry.phaseOrigin!,
            originalEndExclusive: entry.originalEndExclusive!,
            visibleRanges: Object.freeze(entry.visibleRanges!.map((range) => Object.freeze({
              start: range.start,
              endExclusive: range.endExclusive,
            }))),
            frameOverrides: Object.freeze(entry.frameOverrides!.map((override) => Object.freeze({
              appFrame: override.appFrame,
              keyId: override.keyId,
            }))),
          }
        : defaultLifecycle ?? {}),
    }) as PhysicPaintRotoLoopClip);
  }
  return Object.freeze(clips);
}

/**
 * Reconstruct the complete incoming interpolation break owner collection.
 * Owners are stable real-key IDs, unique, referentially valid, and immutable.
 */
export function parsePhysicPaintRotoIncomingInterpolationBreakKeyIds(
  value: unknown,
  records: readonly PhysicPaintRotoRealKeyRecord[],
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error('PhysicPaintRotoIncomingInterpolationBreakKeyIds: expected an array of key IDs.');
  }
  const recordKeyIds = new Set(records.map((record) => record.keyId));
  const seen = new Set<string>();
  const owners: string[] = [];
  for (const entry of value) {
    if (!isBoundedKeyId(entry)) {
      throw new Error('PhysicPaintRotoIncomingInterpolationBreakKeyIds: malformed key ID.');
    }
    if (seen.has(entry)) {
      throw new Error(`PhysicPaintRotoIncomingInterpolationBreakKeyIds: duplicate keyId "${entry}".`);
    }
    if (!recordKeyIds.has(entry)) {
      throw new Error(`PhysicPaintRotoIncomingInterpolationBreakKeyIds: orphan keyId "${entry}".`);
    }
    seen.add(entry);
    owners.push(entry);
  }
  return Object.freeze(owners);
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
 * - invalid canonical interpolation state;
 * - invalid separate Script Motion settings.
 *
 * Reconstructs exactly the validated real-key collection, canonical
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
    throw new Error('PhysicPaintRotoPhysicalState: invalid canonical interpolation state.');
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
    mode: value.interpolation.mode,
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
// the validated authoritative real-key records plus canonical interpolation
// state; it is distinct from `physicPaintVersion`, which
// remains a monotonic visual invalidation signal.
//
// The revision is computed only from a validated immutable real-key
// collection plus canonical interpolation state. Canonicalization is
// performed in stable `keyId` order so equal content produces equal
// revisions regardless of input order. The fingerprint covers every durable
// payload field and the direct `appFrame`. Malformed, duplicate, generated,
// or removed-shape input is rejected via the existing validators rather than
// normalized.
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic physical content revision for a validated
 * immutable real-key collection plus canonical interpolation state plus the
 * durable Loop Clip collection (Phase 43, Q1: loops join the single canonical
 * fingerprint — a loop-only edit is revision-visible).
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
 * - interpolation `enabled` and `mode` both contribute.
 *
 * Rejection:
 * - non-array input;
 * - duplicate `keyId`;
 * - malformed real-key records (including generated descriptors, which fail
 *   the `kind: 'real-key'` check);
 * - invalid canonical interpolation state.
 *
 * Throws a closed validation failure on any invalid input; caller-owned data
 * is never mutated.
 */
export function buildPhysicPaintRotoPhysicalRevision(
  records: unknown,
  interpolation: unknown,
  loopClips: unknown,
  incomingInterpolationBreakKeyIds: unknown = PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
): string {
  const source = encodePhysicPaintRotoPhysicalContent(records, interpolation, loopClips, incomingInterpolationBreakKeyIds);
  return `physical-${hashCanonicalPhysicalValue(source)}`;
}

/**
 * Canonical allowlisted encoding shared by content revision and persisted
 * project equality. Strings are length-prefixed, so payload text cannot create
 * delimiter collisions. Records are ordered by stable identity, not input or
 * presentation order. Loop Clips join the fingerprint (Phase 43, Q1): any
 * loop record change produces a different canonical revision.
 */
export function encodePhysicPaintRotoPhysicalContent(
  records: unknown,
  interpolation: unknown,
  loopClips: unknown,
  incomingInterpolationBreakKeyIds: unknown = PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
): string {
  const validated = parsePhysicPaintRotoRealKeyRecordCollection(records);
  if (!isPhysicPaintRotoInterpolationState(interpolation)) {
    throw new Error('PhysicPaintRotoPhysicalRevision: invalid canonical interpolation state.');
  }
  const validatedLoopClips = parsePhysicPaintRotoLoopClips(loopClips);
  const validatedIncomingBreaks = parsePhysicPaintRotoIncomingInterpolationBreakKeyIds(incomingInterpolationBreakKeyIds, validated);
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
  return [
    `records:${orderedByIdentity.length}:${encodedRecords}`,
    `interpolation:${validatedBoolean(interpolation.enabled)}`,
    `mode:${encodeCanonicalString(interpolation.mode)}`,
    // D-29 compatibility: the empty Loop Clip collection is semantically
    // identical to a pre-Phase-43 document with no loopClips member, so it
    // contributes NO term — v0.8.1 documents keep their legacy revision and
    // load with no migration. Any non-empty collection joins the fingerprint.
    ...(validatedLoopClips.length > 0 ? [`loops:${encodeCanonicalLoopClips(validatedLoopClips)}`] : []),
    ...(validatedIncomingBreaks.length > 0
      ? [`incoming-breaks:${encodeCanonicalIncomingInterpolationBreakKeyIds(validatedIncomingBreaks)}`]
      : []),
  ].join('');
}

/** Build the broader persisted equality fingerprint for one complete layer. */
export function buildPhysicPaintRotoProjectEquality(value: unknown): string {
  const document = parsePhysicPaintRotoPhysicalDocument(value);
  const source = [
    // The content encoding already covers the Loop Clip collection (Q1), so
    // two documents differing only in loops never share a save-cache key.
    encodePhysicPaintRotoPhysicalContent(
      document.realKeyRecords,
      document.interpolation,
      document.loopClips,
      document.incomingInterpolationBreakKeyIds,
    ),
    `capacity:${encodeCanonicalNumber(document.capacity)}`,
    `motion:${encodeCanonicalNumber(document.scriptMotion.deformation)}${encodeCanonicalNumber(document.scriptMotion.position)}`,
    `background:${encodeCanonicalBackground(document.background)}`,
    `selection:${document.selectedKeyId === null ? 'null;' : encodeCanonicalString(document.selectedKeyId)}`,
    `cursor:${encodeCanonicalNumber(document.cursorAppFrame)}`,
  ].join('');
  return `project-${hashCanonicalPhysicalValue(source)}`;
}

/**
 * Canonical Loop Clip encoding shared by persisted project equality and (in
 * Plan 43-01 Task 2) the content revision fingerprint. Clips are ordered by
 * stable `loopId`; `sourceKeyIds` encode in persisted order (order is the
 * cycle definition, not a sort key).
 */
function encodeCanonicalIncomingInterpolationBreakKeyIds(keyIds: readonly string[]): string {
  const ordered = [...keyIds].sort((a, b) => a.localeCompare(b));
  return `${ordered.length}:${ordered.map(encodeCanonicalString).join('')}`;
}

function encodeCanonicalLoopClips(loopClips: readonly PhysicPaintRotoLoopClip[]): string {
  const ordered = [...loopClips].sort((a, b) => a.loopId.localeCompare(b.loopId));
  const encoded = ordered.map((clip) => [
    encodeCanonicalString(clip.loopId),
    encodeCanonicalNumber(clip.placementStart),
    `ids:${clip.sourceKeyIds.length}:`,
    ...clip.sourceKeyIds.map(encodeCanonicalString),
    clip.repeat === 'infinity' ? encodeCanonicalString('infinity') : encodeCanonicalNumber(clip.repeat),
    encodeCanonicalString(clip.mode),
    // 43-06 provenance joins the fingerprint when present (all-or-nothing).
    ...(clip.scriptId !== undefined
      ? [
          encodeCanonicalString(clip.scriptId),
          encodeCanonicalNumber(clip.motion!.deformation),
          encodeCanonicalNumber(clip.motion!.position),
          encodeCanonicalString(clip.overrideColor ?? ''),
        ]
      : []),
    ...(clip.syncState !== undefined
      ? [
          encodeCanonicalString(clip.syncState),
          encodeCanonicalString(clip.provenanceState!),
          encodeCanonicalNumber(clip.phaseOrigin!),
          encodeCanonicalNumber(clip.originalEndExclusive!),
          `ranges:${clip.visibleRanges!.length}:`,
          ...clip.visibleRanges!.flatMap((range) => [
            encodeCanonicalNumber(range.start),
            encodeCanonicalNumber(range.endExclusive),
          ]),
          `overrides:${clip.frameOverrides!.length}:`,
          ...clip.frameOverrides!.flatMap((override) => [
            encodeCanonicalNumber(override.appFrame),
            encodeCanonicalString(override.keyId),
          ]),
        ]
      : []),
  ].join('')).join('');
  return `${ordered.length}:${encoded}`;
}

function validatePhysicPaintRotoGroupReferences(
  loopClips: readonly PhysicPaintRotoLoopClip[],
  records: readonly PhysicPaintRotoRealKeyRecord[],
  capacity: number,
): void {
  const recordsById = new Map(records.map((record) => [record.keyId, record]));
  for (const clip of loopClips) {
    if (clip.syncState === undefined) continue;
    if (clip.originalEndExclusive! > capacity) {
      throw new Error(`PhysicPaintRotoPhysicalDocument: Group "${clip.loopId}" exceeds capacity.`);
    }
    for (const override of clip.frameOverrides!) {
      const record = recordsById.get(override.keyId);
      if (!record || record.appFrame !== override.appFrame) {
        throw new Error(`PhysicPaintRotoPhysicalDocument: Group "${clip.loopId}" override reference mismatch.`);
      }
      if (clip.sourceKeyIds.includes(override.keyId)) {
        throw new Error(`PhysicPaintRotoPhysicalDocument: Group "${clip.loopId}" override reuses source identity.`);
      }
    }
  }

  for (let leftIndex = 0; leftIndex < loopClips.length; leftIndex += 1) {
    const left = loopClips[leftIndex];
    const leftIds = new Set(left.sourceKeyIds);
    for (let rightIndex = leftIndex + 1; rightIndex < loopClips.length; rightIndex += 1) {
      const right = loopClips[rightIndex];
      const overlaps = right.sourceKeyIds.some((keyId) => leftIds.has(keyId));
      if (!overlaps) continue;
      const identicalOrderedCycle = left.sourceKeyIds.length === right.sourceKeyIds.length
        && left.sourceKeyIds.every((keyId, index) => right.sourceKeyIds[index] === keyId);
      if (!identicalOrderedCycle) {
        throw new Error('PhysicPaintRotoPhysicalDocument: ambiguous source sharing between Groups.');
      }
    }
  }
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
  // loopClips is the first genuinely optional document member (D-29): absent
  // means the empty collection (v0.8.1-shaped documents load with no
  // migration); present means parsed fail-closed.
  const loopClips = value.loopClips === undefined
    ? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY
    : parsePhysicPaintRotoLoopClips(value.loopClips);
  validatePhysicPaintRotoGroupReferences(loopClips, state.realKeyRecords, capacity);
  const incomingInterpolationBreakKeyIds = value.incomingInterpolationBreakKeyIds === undefined
    ? PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY
    : parsePhysicPaintRotoIncomingInterpolationBreakKeyIds(
        value.incomingInterpolationBreakKeyIds,
        state.realKeyRecords,
      );
  const revision = buildPhysicPaintRotoPhysicalRevision(
    state.realKeyRecords,
    state.interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds,
  );
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
    loopClips,
    incomingInterpolationBreakKeyIds,
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