// ============================================================
//  studioScriptSnapshotCodec — the SNAP v5 container
//  (quick 261023-l35; v5 = quick 261027-klx). Pure TS: no DOM,
//  no IPC, no filesystem.
//
//  One file holds the Studio's watercolor script for one
//  project/layer/track key, so restore is a single disk read:
//
//    magic 'SNP1' (4) | u16 version=5 | u16 flags=0 | u8 railCleanupDone
//    u16 + UTF-8 projectId
//    u16 + UTF-8 layerId
//    u16 + UTF-8 trackId
//    u32 watercolorByteLength  | watercolor body
//    u32 anchorByteLength      | anchor body
//    u32 durableBaseByteLength | durable-base body
//
//  The watercolor body IS the proven AQTL v1 buffer
//  (encodeScriptTimelineBinary) — the IDs, order, playFrame,
//  params, toolOverrides, cuisson and Dry events all ride there.
//  There is deliberately no JSON fallback.
//
//  The key-anchor section: AQTL carries no key identity, so every
//  stroke mutationId is bound to the physical KEY it was captured
//  on. A restore seeds a stroke only when the file anchor equals
//  the live key at that playFrame.
//
//  The durable-base section: the pre-script raster per key (or a
//  known-empty marker), so "Move after reopen" has a base.
//
//  CLEAN BREAK (261027-klx): engine-1's brush body is GONE. The
//  retired container versions 1-4 all carried (or implied) a brush
//  body; keeping them decodable would mean keeping the brush skip
//  logic and risking silent seeding into a watercolor session, so
//  they raise the dedicated `snap-v4-retired` code and seed
//  nothing. An unknown version (0, or >= 6) keeps the generic
//  `version` code.
//
//  Fail closed: magic, version, flags, the three identity strings,
//  every declared length and any trailing byte are validated
//  BEFORE a section is decoded; an unvalidated count never drives
//  an allocation. Every failure is a typed
//  StudioScriptSnapshotCodecError, never a raw RangeError.
// ============================================================

import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import {
  decodeScriptTimelineBinary,
  encodeScriptTimelineBinary,
} from './scriptTimelineCodec';

/** ASCII magic carried by every SNAP buffer. */
export const STUDIO_SCRIPT_SNAPSHOT_MAGIC = 'SNP1';

/**
 * v5 is the watercolor-only container: no brush body, and ONLY v5 is
 * accepted. The retired versions keep their number here solely so the
 * decoder can name the clean break explicitly.
 */
export const STUDIO_SCRIPT_SNAPSHOT_VERSION = 5;

const STUDIO_SCRIPT_SNAPSHOT_VERSIONS = new Set([STUDIO_SCRIPT_SNAPSHOT_VERSION]);

/** Every container version that predates the watercolor-only format. */
const STUDIO_SCRIPT_SNAPSHOT_RETIRED_VERSIONS = new Set([1, 2, 3, 4]);

/**
 * The anchor section's own version:
 *   u16 version=1 | u16 reserved=0 | u32 count |
 *   count x (u32 mutationId, u16 UTF-8 byte length, keyId bytes)
 */
export const STUDIO_SCRIPT_SNAPSHOT_ANCHOR_VERSION = 1;

const STUDIO_SCRIPT_SNAPSHOT_ANCHOR_VERSIONS = new Set([
  STUDIO_SCRIPT_SNAPSHOT_ANCHOR_VERSION,
]);

/** One watercolor stroke's owning physical key. */
export interface StudioScriptSnapshotWatercolorKeyAnchor {
  readonly mutationId: number;
  readonly keyId: string;
}

/**
 * The durable-base section's own version:
 *   u16 version=1 | u16 reserved=0 | u32 count |
 *   count x (u8 state, u16 UTF-8 keyId length, keyId bytes,
 *            state=1 only: u32 byte length, base bytes)
 *
 * `state=0` is a KNOWN-EMPTY base (blank promotion); `state=1` carries the
 * pre-script raster. An ABSENT key is UNKNOWN and keeps the publish
 * fail-closed — the distinction is the whole contract.
 */
export const STUDIO_SCRIPT_SNAPSHOT_DURABLE_BASE_VERSION = 1;

const STUDIO_SCRIPT_SNAPSHOT_DURABLE_BASE_VERSIONS = new Set([
  STUDIO_SCRIPT_SNAPSHOT_DURABLE_BASE_VERSION,
]);

/** One key's pre-script raster (bytes) or a known-empty base (null). */
export interface StudioScriptSnapshotDurableBase {
  readonly keyId: string;
  readonly bytes: Uint8Array | null;
}

export type StudioScriptSnapshotCodecErrorCode =
  | 'magic'
  | 'version'
  /** Container versions 1-4: the retired pre-watercolor-only format. */
  | 'snap-v4-retired'
  | 'flags'
  | 'identity'
  | 'truncated'
  | 'length'
  | 'count'
  | 'trailing'
  | 'watercolor'
  | 'anchor'
  | 'durableBase';

/** Every container failure is this typed error. */
export class StudioScriptSnapshotCodecError extends Error {
  readonly code: StudioScriptSnapshotCodecErrorCode;
  readonly offset?: number;

  constructor(code: StudioScriptSnapshotCodecErrorCode, message?: string, offset?: number) {
    super(message ?? code);
    this.name = 'StudioScriptSnapshotCodecError';
    this.code = code;
    this.offset = offset;
  }
}

/** The cache key. Every component must round-trip through the header. */
export interface StudioScriptSnapshotIdentity {
  projectId: string;
  layerId: string;
  trackId: string;
}

export interface StudioScriptSnapshotEncodeInput extends StudioScriptSnapshotIdentity {
  watercolorEvents: readonly AquarellePayloadEvent[];
  /** The owning physical key per watercolor stroke mutationId. */
  watercolorKeyAnchors?: readonly StudioScriptSnapshotWatercolorKeyAnchor[];
  /** The pre-script base per ordinary keyId (bytes, or null = empty). */
  durableBases?: readonly StudioScriptSnapshotDurableBase[];
  /** The durable one-time rail-cleanup marker. Absent = not done yet. */
  railCleanupDone?: boolean;
}

export interface StudioScriptSnapshotDecodeResult {
  watercolorEvents: AquarellePayloadEvent[];
  /** The owning key per watercolor stroke. */
  watercolorKeyAnchors: StudioScriptSnapshotWatercolorKeyAnchor[];
  /** The pre-script base per key. */
  durableBases: StudioScriptSnapshotDurableBase[];
  /** True once the rail cleanup ran for this project/layer/track. */
  railCleanupDone: boolean;
}

const CONTAINER_HEADER_BYTE_LENGTH = 8;
const ANCHOR_HEADER_BYTE_LENGTH = 8;
/** u32 mutationId + a u16 keyId length (an empty keyId is invalid, so this is a true minimum). */
const ANCHOR_RECORD_MIN_BYTES = 4 + 2;
const DURABLE_BASE_HEADER_BYTE_LENGTH = 8;
/** u8 state + u16 keyId length + one keyId byte (an empty keyId is invalid). */
const DURABLE_BASE_RECORD_MIN_BYTES = 1 + 2 + 1;

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function fail(
  code: StudioScriptSnapshotCodecErrorCode,
  message: string,
  offset?: number,
): never {
  throw new StudioScriptSnapshotCodecError(code, message, offset);
}

class Writer {
  private bytes = new Uint8Array(256);
  private view = new DataView(this.bytes.buffer);
  private cursor = 0;

  get length(): number {
    return this.cursor;
  }

  private ensure(extra: number): void {
    const needed = this.cursor + extra;
    if (needed <= this.bytes.byteLength) return;
    let capacity = this.bytes.byteLength;
    while (capacity < needed) capacity *= 2;
    const grown = new Uint8Array(capacity);
    grown.set(this.bytes.subarray(0, this.cursor));
    this.bytes = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(value: number): void {
    this.ensure(1);
    this.view.setUint8(this.cursor, value & 0xff);
    this.cursor += 1;
  }

  u16(value: number): void {
    this.ensure(2);
    this.view.setUint16(this.cursor, value, true);
    this.cursor += 2;
  }

  u32(value: number): void {
    this.ensure(4);
    this.view.setUint32(this.cursor, value, true);
    this.cursor += 4;
  }

  f32(value: number): void {
    this.ensure(4);
    this.view.setFloat32(this.cursor, value, true);
    this.cursor += 4;
  }

  f64(value: number): void {
    this.ensure(8);
    this.view.setFloat64(this.cursor, value, true);
    this.cursor += 8;
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.byteLength);
    this.bytes.set(bytes, this.cursor);
    this.cursor += bytes.byteLength;
  }

  string(value: string, what: string): void {
    const encoded = UTF8_ENCODER.encode(value);
    if (encoded.byteLength > 0xffff) {
      fail('length', `${what} exceeds 65535 UTF-8 bytes`);
    }
    this.u16(encoded.byteLength);
    this.raw(encoded);
  }

  finish(): Uint8Array {
    return this.bytes.slice(0, this.cursor);
  }
}

class Reader {
  private readonly view: DataView;
  private cursor: number;

  constructor(
    private readonly bytes: Uint8Array,
    start = 0,
  ) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.cursor = start;
  }

  get offset(): number {
    return this.cursor;
  }

  get remaining(): number {
    return this.bytes.byteLength - this.cursor;
  }

  private need(count: number): void {
    if (count < 0 || this.cursor + count > this.bytes.byteLength) {
      fail('truncated', 'read past the end of the buffer', this.cursor);
    }
  }

  u8(): number {
    this.need(1);
    const value = this.view.getUint8(this.cursor);
    this.cursor += 1;
    return value;
  }

  u16(): number {
    this.need(2);
    const value = this.view.getUint16(this.cursor, true);
    this.cursor += 2;
    return value;
  }

  u32(): number {
    this.need(4);
    const value = this.view.getUint32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  f32(): number {
    this.need(4);
    const value = this.view.getFloat32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  f64(): number {
    this.need(8);
    const value = this.view.getFloat64(this.cursor, true);
    this.cursor += 8;
    return value;
  }

  slice(length: number, what: string): Uint8Array {
    if (length < 0 || length > this.remaining) {
      fail('length', `${what} declared length ${length} exceeds the remaining bytes`, this.cursor);
    }
    const start = this.cursor;
    this.cursor += length;
    return this.bytes.subarray(start, start + length);
  }

  string(what: string): string {
    const byteLength = this.u16();
    if (byteLength > this.remaining) {
      fail('length', `${what} exceeds the remaining bytes`, this.cursor);
    }
    const slice = this.bytes.subarray(this.cursor, this.cursor + byteLength);
    const offset = this.cursor;
    this.cursor += byteLength;
    try {
      return UTF8_DECODER.decode(slice);
    } catch {
      fail('identity', `${what} is not valid UTF-8`, offset);
    }
  }
}

function validateIdentityValue(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail('identity', `${what} must be a non-empty string`);
  }
  if (UTF8_ENCODER.encode(value).byteLength > 0xffff) {
    fail('length', `${what} exceeds 65535 UTF-8 bytes`);
  }
  return value;
}

// --- Anchor section v1 ----------------------------------------------------

function encodeAnchorSection(
  anchors: readonly StudioScriptSnapshotWatercolorKeyAnchor[],
): Uint8Array {
  const writer = new Writer();
  writer.u16(STUDIO_SCRIPT_SNAPSHOT_ANCHOR_VERSION);
  writer.u16(0);
  writer.u32(anchors.length);
  const seen = new Set<number>();
  for (const anchor of anchors) {
    if (!Number.isInteger(anchor.mutationId) || anchor.mutationId < 0) {
      fail('anchor', `invalid anchor mutationId ${String(anchor.mutationId)}`);
    }
    if (seen.has(anchor.mutationId)) {
      fail('anchor', `duplicate watercolor key anchor ${anchor.mutationId}`);
    }
    seen.add(anchor.mutationId);
    if (typeof anchor.keyId !== 'string' || anchor.keyId.length === 0) {
      fail('anchor', 'an anchor keyId must be a non-empty string');
    }
    const encodedKeyId = UTF8_ENCODER.encode(anchor.keyId);
    if (encodedKeyId.byteLength > 0xffff) {
      fail('length', 'anchor keyId exceeds 65535 UTF-8 bytes');
    }
    writer.u32(anchor.mutationId);
    writer.u16(encodedKeyId.byteLength);
    writer.raw(encodedKeyId);
  }
  return writer.finish();
}

function decodeAnchorSection(bytes: Uint8Array): StudioScriptSnapshotWatercolorKeyAnchor[] {
  const reader = new Reader(bytes);
  if (bytes.byteLength < ANCHOR_HEADER_BYTE_LENGTH) {
    fail('truncated', 'anchor section is shorter than its 8-byte header');
  }
  const version = reader.u16();
  if (!STUDIO_SCRIPT_SNAPSHOT_ANCHOR_VERSIONS.has(version)) {
    fail('version', `unsupported anchor section version ${version}`);
  }
  const reserved = reader.u16();
  if (reserved !== 0) fail('flags', 'anchor section reserved word must be 0');
  const count = reader.u32();
  if (count > Math.floor(reader.remaining / ANCHOR_RECORD_MIN_BYTES)) {
    fail('count', `anchor section declares ${count} anchors beyond the remaining bytes`, reader.offset);
  }
  const anchors: StudioScriptSnapshotWatercolorKeyAnchor[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    const mutationId = reader.u32();
    const keyId = reader.string('anchor keyId');
    if (keyId.length === 0) {
      fail('anchor', 'an anchor keyId must be a non-empty string', reader.offset);
    }
    if (seen.has(mutationId)) {
      fail('anchor', `duplicate watercolor key anchor ${mutationId}`, reader.offset);
    }
    seen.add(mutationId);
    anchors.push({ mutationId, keyId });
  }
  if (reader.remaining !== 0) {
    fail('trailing', 'unread bytes remain in the anchor section');
  }
  return anchors;
}

// --- Durable-base section v1 ---------------------------------------------

function compareKeyIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * The v4 durable-base section. Sorted by keyId so the file is byte-stable
 * regardless of launch-map insertion order.
 */
function encodeDurableBaseSection(
  bases: readonly StudioScriptSnapshotDurableBase[],
): Uint8Array {
  const writer = new Writer();
  writer.u16(STUDIO_SCRIPT_SNAPSHOT_DURABLE_BASE_VERSION);
  writer.u16(0);
  const sorted = [...bases].sort((left, right) => compareKeyIds(left.keyId, right.keyId));
  writer.u32(sorted.length);
  const seen = new Set<string>();
  for (const base of sorted) {
    if (typeof base.keyId !== 'string' || base.keyId.length === 0) {
      fail('durableBase', 'a durable-base keyId must be a non-empty string');
    }
    if (seen.has(base.keyId)) {
      fail('durableBase', `duplicate durable base ${base.keyId}`);
    }
    seen.add(base.keyId);
    const encodedKeyId = UTF8_ENCODER.encode(base.keyId);
    if (encodedKeyId.byteLength > 0xffff) {
      fail('length', 'durable-base keyId exceeds 65535 UTF-8 bytes');
    }
    if (base.bytes === null) {
      writer.u8(0);
    } else if (base.bytes instanceof Uint8Array && base.bytes.byteLength > 0) {
      writer.u8(1);
    } else {
      fail('durableBase', `durable base for ${base.keyId} must be non-empty bytes or null`);
    }
    writer.u16(encodedKeyId.byteLength);
    writer.raw(encodedKeyId);
    if (base.bytes !== null) {
      writer.u32(base.bytes.byteLength);
      writer.raw(base.bytes);
    }
  }
  return writer.finish();
}

function decodeDurableBaseSection(bytes: Uint8Array): StudioScriptSnapshotDurableBase[] {
  const reader = new Reader(bytes);
  if (bytes.byteLength < DURABLE_BASE_HEADER_BYTE_LENGTH) {
    fail('truncated', 'durable-base section is shorter than its 8-byte header');
  }
  const version = reader.u16();
  if (!STUDIO_SCRIPT_SNAPSHOT_DURABLE_BASE_VERSIONS.has(version)) {
    fail('version', `unsupported durable-base section version ${version}`);
  }
  if (reader.u16() !== 0) fail('flags', 'durable-base section reserved word must be 0');
  const count = reader.u32();
  if (count > Math.floor(reader.remaining / DURABLE_BASE_RECORD_MIN_BYTES)) {
    fail(
      'count',
      `durable-base section declares ${count} bases beyond the remaining bytes`,
      reader.offset,
    );
  }
  const bases: StudioScriptSnapshotDurableBase[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const state = reader.u8();
    if (state > 1) {
      fail('durableBase', 'durable-base state must be 0 (known empty) or 1 (bytes)', reader.offset);
    }
    const keyId = reader.string('durable-base keyId');
    if (keyId.length === 0) {
      fail('durableBase', 'a durable-base keyId must be a non-empty string', reader.offset);
    }
    if (seen.has(keyId)) {
      fail('durableBase', `duplicate durable base ${keyId}`, reader.offset);
    }
    seen.add(keyId);
    if (state === 1) {
      const byteLength = reader.u32();
      if (byteLength === 0) {
        fail('durableBase', `durable base ${keyId} declares empty bytes`, reader.offset);
      }
      // Copy, never a view: the decoded result must survive its source buffer.
      bases.push({ keyId, bytes: new Uint8Array(reader.slice(byteLength, 'durable base bytes')) });
    } else {
      bases.push({ keyId, bytes: null });
    }
  }
  if (reader.remaining !== 0) {
    fail('trailing', 'unread bytes remain in the durable-base section');
  }
  return bases;
}

export function encodeStudioScriptSnapshot(
  input: StudioScriptSnapshotEncodeInput,
): Uint8Array {
  const projectId = validateIdentityValue(input.projectId, 'projectId');
  const layerId = validateIdentityValue(input.layerId, 'layerId');
  const trackId = validateIdentityValue(input.trackId, 'trackId');
  const watercolor = encodeScriptTimelineBinary(input.watercolorEvents);
  const anchors = encodeAnchorSection(input.watercolorKeyAnchors ?? []);
  const durableBases = encodeDurableBaseSection(input.durableBases ?? []);

  const writer = new Writer();
  for (let index = 0; index < STUDIO_SCRIPT_SNAPSHOT_MAGIC.length; index += 1) {
    writer.u8(STUDIO_SCRIPT_SNAPSHOT_MAGIC.charCodeAt(index));
  }
  writer.u16(STUDIO_SCRIPT_SNAPSHOT_VERSION);
  writer.u16(0); // flags
  writer.u8(input.railCleanupDone === true ? 1 : 0); // durable rail-cleanup marker
  writer.string(projectId, 'projectId');
  writer.string(layerId, 'layerId');
  writer.string(trackId, 'trackId');
  writer.u32(watercolor.byteLength);
  writer.raw(watercolor);
  writer.u32(anchors.byteLength);
  writer.raw(anchors);
  writer.u32(durableBases.byteLength);
  writer.raw(durableBases);
  return writer.finish();
}

export function decodeStudioScriptSnapshot(
  bytes: Uint8Array,
  identity: StudioScriptSnapshotIdentity,
): StudioScriptSnapshotDecodeResult {
  if (!(bytes instanceof Uint8Array)) {
    fail('truncated', 'input must be a Uint8Array');
  }
  if (bytes.byteLength < CONTAINER_HEADER_BYTE_LENGTH) {
    fail('truncated', 'buffer is shorter than the 8-byte container header', 0);
  }
  for (let index = 0; index < STUDIO_SCRIPT_SNAPSHOT_MAGIC.length; index += 1) {
    if (bytes[index] !== STUDIO_SCRIPT_SNAPSHOT_MAGIC.charCodeAt(index)) {
      fail('magic', 'SNP1 magic not found', 0);
    }
  }

  const reader = new Reader(bytes, 4);
  const version = reader.u16();
  // The clean break (261027-klx): every retired container carried a brush
  // body. Name the retirement explicitly so the controller can show the pinned
  // notice without keeping a single brush decode path alive.
  if (STUDIO_SCRIPT_SNAPSHOT_RETIRED_VERSIONS.has(version)) {
    fail('snap-v4-retired', 'SNAP predates the watercolor-only format', 4);
  }
  if (!STUDIO_SCRIPT_SNAPSHOT_VERSIONS.has(version)) {
    fail('version', `unsupported SNAP version ${version}`, 4);
  }
  const flags = reader.u16();
  if (flags !== 0) fail('flags', `unsupported flags ${flags}`, 6);
  const railCleanupFlag = reader.u8();
  if (railCleanupFlag > 1) fail('flags', 'rail cleanup flag must be 0 or 1', 8);

  const projectId = reader.string('projectId');
  const layerId = reader.string('layerId');
  const trackId = reader.string('trackId');
  if (
    projectId !== identity.projectId ||
    layerId !== identity.layerId ||
    trackId !== identity.trackId
  ) {
    fail('identity', 'the snapshot identity does not match the requested key');
  }

  const watercolorByteLength = reader.u32();
  const watercolorBody = reader.slice(watercolorByteLength, 'watercolor body');
  const anchorByteLength = reader.u32();
  const anchorBody = reader.slice(anchorByteLength, 'anchor body');
  const durableBaseByteLength = reader.u32();
  const durableBaseBody = reader.slice(durableBaseByteLength, 'durable-base body');
  if (reader.remaining !== 0) {
    fail('trailing', 'buffer is longer than the declared sections', reader.offset);
  }

  let watercolorEvents: AquarellePayloadEvent[];
  try {
    watercolorEvents = decodeScriptTimelineBinary(watercolorBody);
  } catch (error) {
    // Keep the inner codec's precise diagnosis but tag the section.
    if (error instanceof Error) {
      fail('watercolor', `watercolor section is invalid: ${error.message}`);
    }
    fail('watercolor', 'watercolor section is invalid');
  }

  return {
    watercolorEvents,
    watercolorKeyAnchors: decodeAnchorSection(anchorBody),
    durableBases: decodeDurableBaseSection(durableBaseBody),
    railCleanupDone: railCleanupFlag === 1,
  };
}
