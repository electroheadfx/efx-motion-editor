// ============================================================
//  studioScriptSnapshotCodec — the SNAP v1 container
//  (quick 261023-l35). Pure TS: no DOM, no IPC, no filesystem.
//
//  One file holds BOTH Studio script stores for one
//  project/layer/track key, so restore is a single disk read:
//
//    magic 'SNP1' (4) | u16 version=1 | u16 flags=0
//    u16 + UTF-8 projectId
//    u16 + UTF-8 layerId
//    u16 + UTF-8 trackId
//    u32 watercolorByteLength | watercolor body
//    u32 brushByteLength      | brush body
//
//  The watercolor body IS the proven AQTL v1 buffer
//  (encodeScriptTimelineBinary) — the IDs, order, playFrame,
//  params, toolOverrides, cuisson and Dry events all ride there.
//  There is deliberately no JSON fallback.
//
//  The brush body is its own versioned block:
//    u16 version=1 | u16 reserved=0 | u32 frameCount | frames...
//  BRUSH POINTS ARE PIXEL COORDINATES. They are never clamped or
//  normalized to [0,1] like the AQTL point records: the engine
//  produces 3-decimal pixel coordinates and f32 is at least as
//  precise for them, while a UV projection would destroy them.
//
//  Fail closed: magic, version, flags, the three identity strings,
//  every declared length and any trailing byte are validated
//  BEFORE a section is decoded; an unvalidated count never drives
//  an allocation. Every failure is a typed
//  StudioScriptSnapshotCodecError, never a raw RangeError.
// ============================================================

import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import type { PaintRenderSettings } from '@efxlab/efx-physic-paint';
import {
  decodeScriptTimelineBinary,
  encodeScriptTimelineBinary,
} from './scriptTimelineCodec';
import type { RecordedStrokeGroup } from '../view/recordedStrokeGroups';

/** ASCII magic carried by every SNAP buffer. */
export const STUDIO_SCRIPT_SNAPSHOT_MAGIC = 'SNP1';

/** The one container version this module encodes and accepts. */
export const STUDIO_SCRIPT_SNAPSHOT_VERSION = 1;

/** The brush section's own version (it evolves independently). */
export const STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSION = 1;

export type StudioScriptSnapshotCodecErrorCode =
  | 'magic'
  | 'version'
  | 'flags'
  | 'identity'
  | 'truncated'
  | 'length'
  | 'count'
  | 'trailing'
  | 'brush'
  | 'watercolor';

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

/** One decoded brush frame — the store's entry shape, structurally. */
export interface StudioScriptSnapshotBrushFrame {
  frame: number;
  groups: readonly Readonly<RecordedStrokeGroup>[];
  complete: boolean;
  paintSettings?: PaintRenderSettings | null;
}

export interface StudioScriptSnapshotEncodeInput extends StudioScriptSnapshotIdentity {
  watercolorEvents: readonly AquarellePayloadEvent[];
  /** Task 2 fills the per-frame records; v1 reserves the section today. */
  brushFrames?: readonly StudioScriptSnapshotBrushFrame[];
}

export interface StudioScriptSnapshotDecodeResult {
  watercolorEvents: AquarellePayloadEvent[];
  brushFrames: StudioScriptSnapshotBrushFrame[];
}

const CONTAINER_HEADER_BYTE_LENGTH = 8;
const BRUSH_HEADER_BYTE_LENGTH = 8;

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

/**
 * The v1 brush block. Task 1 reserves the section (frameCount 0); Task 2
 * writes one record per captured frame.
 */
function encodeBrushSection(frames: readonly StudioScriptSnapshotBrushFrame[]): Uint8Array {
  const writer = new Writer();
  writer.u16(STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSION);
  writer.u16(0);
  writer.u32(frames.length === 0 ? 0 : frames.length);
  if (frames.length > 0) {
    // Fail closed rather than silently dropping a caller's brush frames.
    fail('brush', 'the SNAP v1 brush records are not implemented yet');
  }
  return writer.finish();
}

function decodeBrushSection(bytes: Uint8Array): StudioScriptSnapshotBrushFrame[] {
  const reader = new Reader(bytes);
  if (bytes.byteLength < BRUSH_HEADER_BYTE_LENGTH) {
    fail('truncated', 'brush section is shorter than its 8-byte header');
  }
  const version = reader.u16();
  if (version !== STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSION) {
    fail('version', `unsupported brush section version ${version}`);
  }
  const reserved = reader.u16();
  if (reserved !== 0) fail('flags', 'brush section reserved word must be 0');
  const frameCount = reader.u32();
  if (frameCount > 0) {
    // v1's per-frame records land with the brush work; a forward file must
    // fail closed rather than restore an empty ledger over real pixels.
    fail('brush', 'the SNAP v1 brush records are not implemented yet');
  }
  if (reader.remaining !== 0) {
    fail('trailing', 'unread bytes remain in the brush section');
  }
  return [];
}

export function encodeStudioScriptSnapshot(
  input: StudioScriptSnapshotEncodeInput,
): Uint8Array {
  const projectId = validateIdentityValue(input.projectId, 'projectId');
  const layerId = validateIdentityValue(input.layerId, 'layerId');
  const trackId = validateIdentityValue(input.trackId, 'trackId');
  const watercolor = encodeScriptTimelineBinary(input.watercolorEvents);
  const brush = encodeBrushSection(input.brushFrames ?? []);

  const writer = new Writer();
  for (let index = 0; index < STUDIO_SCRIPT_SNAPSHOT_MAGIC.length; index += 1) {
    writer.u8(STUDIO_SCRIPT_SNAPSHOT_MAGIC.charCodeAt(index));
  }
  writer.u16(STUDIO_SCRIPT_SNAPSHOT_VERSION);
  writer.u16(0); // flags
  writer.string(projectId, 'projectId');
  writer.string(layerId, 'layerId');
  writer.string(trackId, 'trackId');
  writer.u32(watercolor.byteLength);
  writer.raw(watercolor);
  writer.u32(brush.byteLength);
  writer.raw(brush);
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
  if (version !== STUDIO_SCRIPT_SNAPSHOT_VERSION) {
    fail('version', `unsupported SNAP version ${version}`, 4);
  }
  const flags = reader.u16();
  if (flags !== 0) fail('flags', `unsupported flags ${flags}`, 6);

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
  const brushByteLength = reader.u32();
  const brushBody = reader.slice(brushByteLength, 'brush body');
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

  return { watercolorEvents, brushFrames: decodeBrushSection(brushBody) };
}
