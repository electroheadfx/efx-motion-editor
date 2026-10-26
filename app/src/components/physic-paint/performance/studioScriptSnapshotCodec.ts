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
import type { BrushOpts, PaintRenderSettings, PaintStroke } from '@efxlab/efx-physic-paint';
import {
  decodeScriptTimelineBinary,
  encodeScriptTimelineBinary,
} from './scriptTimelineCodec';
import type { RecordedStrokeGroup } from '../view/recordedStrokeGroups';

/** ASCII magic carried by every SNAP buffer. */
export const STUDIO_SCRIPT_SNAPSHOT_MAGIC = 'SNP1';

/** The one container version this module encodes and accepts. */
export const STUDIO_SCRIPT_SNAPSHOT_VERSION = 1;

/**
 * The brush section's own version (it evolves independently).
 *
 * v2 adds the owning key identity per frame: a script follows the physical
 * KEY, so a restore must never re-attach a frame's script to whatever key now
 * occupies that frame. v1 files stay readable (their rows carry no keyId and
 * are treated as unknown identity by the restore policy).
 */
export const STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSION = 2;

/** Every brush-section version this module decodes. */
const STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSIONS = new Set([1, STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSION]);

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
  /**
   * v2: the physical key this script was captured on. `null`/absent means
   * unknown identity (a v1 row or a capture with no live key) — the restore
   * policy treats such a row as untrusted on a rail/loop-clip frame.
   */
  keyId?: string | null;
}

export interface StudioScriptSnapshotEncodeInput extends StudioScriptSnapshotIdentity {
  watercolorEvents: readonly AquarellePayloadEvent[];
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

// --- Brush section v1 -----------------------------------------------------

/** frame u32 + flags u8 + reserved u8 + paintSettingsPresent u8 + groupCount u32. */
// v1's minimum: the v2 keyId byte only makes a frame larger, so the looser
// guard accepts both versions.
const BRUSH_FRAME_MIN_BYTES = 4 + 1 + 1 + 1 + 4;
/** continuationCount u32 + one minimum stroke record. */
const BRUSH_GROUP_MIN_BYTES = 4 + (4 + 8 + 1 + 1 + 1 + 9 * 8 + 1 + 1 + 1 + 1);
/** 7 f32 per point (x, y, p, tx, ty, tw, spd). */
const BRUSH_POINT_BYTES = 7 * 4;

const TOOL_CODES: readonly PaintStroke['tool'][] = ['paint', 'erase', 'move'];
/** 0 = absent (null/undefined), 1 local, 2 last, 3 all. */
const PHYSICS_MODE_CODES: readonly (PaintStroke['physicsMode'] | 'absent')[] = [
  'absent',
  'local',
  'last',
  'all',
];
const PARAM_KEYS = [
  'size',
  'opacity',
  'pressure',
  'waterAmount',
  'dryAmount',
  'edgeDetail',
  'pickup',
  'eraseStrength',
  'antiAlias',
] as const;

function writeOptionalU32(writer: Writer, value: number | undefined): void {
  if (typeof value === 'number') {
    writer.u8(1);
    writer.u32(value);
  } else {
    writer.u8(0);
  }
}

function encodeStroke(writer: Writer, stroke: Readonly<PaintStroke>): void {
  writer.u32(stroke.points.length);
  writer.f64(stroke.timestamp);
  const toolIndex = TOOL_CODES.indexOf(stroke.tool);
  if (toolIndex < 0) fail('brush', `unsupported stroke tool "${String(stroke.tool)}"`);
  writer.u8(toolIndex);
  const physicsMode = stroke.physicsMode ?? 'absent';
  const physicsIndex = PHYSICS_MODE_CODES.indexOf(physicsMode);
  if (physicsIndex < 0) {
    fail('brush', `unsupported physics mode "${String(physicsMode)}"`);
  }
  writer.u8(physicsIndex);
  if (stroke.color === null || stroke.color === undefined) {
    writer.u8(0);
  } else {
    writer.u8(1);
    const encoded = UTF8_ENCODER.encode(stroke.color);
    if (encoded.byteLength > 0xffff) fail('length', 'stroke color exceeds 65535 UTF-8 bytes');
    writer.u16(encoded.byteLength);
    writer.raw(encoded);
  }
  for (const key of PARAM_KEYS) writer.f64(stroke.params[key]);
  writeOptionalU32(writer, stroke.mutationId);
  writeOptionalU32(writer, stroke.diffusionFrames);
  writeOptionalU32(writer, stroke.playFrame);
  writer.u8(stroke.hasPenInput === true ? 1 : 0);
  for (const point of stroke.points) {
    writer.f32(point.x);
    writer.f32(point.y);
    writer.f32(point.p);
    writer.f32(point.tx);
    writer.f32(point.ty);
    writer.f32(point.tw);
    writer.f32(point.spd);
  }
}

function encodeGroup(writer: Writer, group: Readonly<RecordedStrokeGroup>): void {
  if (group.primary.points.length === 0) {
    fail('brush', 'a brush group primary must carry points');
  }
  const continuations = group.continuations ?? [];
  for (const continuation of continuations) {
    if (continuation.points.length !== 0 || (continuation.diffusionFrames ?? 0) <= 0) {
      // The engine's own baseline rule: a continuation is a zero-point
      // positive-diffusion record. Never write a file decode would refuse.
      fail('brush', 'a brush continuation must have no points and a positive diffusion count');
    }
  }
  writer.u32(continuations.length);
  encodeStroke(writer, group.primary);
  for (const continuation of continuations) encodeStroke(writer, continuation);
}

/**
 * The v1 brush block. BRUSH POINTS ARE PIXEL COORDINATES: encoded as f32,
 * never clamped or normalized to [0,1] like the AQTL watercolor records
 * (a UV projection would destroy the 3-decimal pixel coordinates the
 * engine produces).
 */
function encodeBrushSection(frames: readonly StudioScriptSnapshotBrushFrame[]): Uint8Array {
  const writer = new Writer();
  writer.u16(STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSION);
  writer.u16(0);
  writer.u32(frames.length);
  const seenFrames = new Set<number>();
  for (const frame of frames) {
    if (!Number.isInteger(frame.frame) || frame.frame < 0) {
      fail('brush', `invalid brush frame ${String(frame.frame)}`);
    }
    if (seenFrames.has(frame.frame)) {
      fail('brush', `duplicate brush frame ${frame.frame}`);
    }
    seenFrames.add(frame.frame);
    writer.u32(frame.frame);
    writer.u8(frame.complete ? 1 : 0);
    writer.u8(0);
    // v2: the owning physical key identity. A script is per key, never per
    // frame number — a row without an identity can only be trusted where the
    // key layout is known to be unchanged (see the restore policy).
    const keyId = frame.keyId;
    if (typeof keyId === 'string' && keyId.length > 0) {
      const encodedKeyId = UTF8_ENCODER.encode(keyId);
      if (encodedKeyId.byteLength > 0xffff) fail('length', 'brush frame keyId exceeds 65535 UTF-8 bytes');
      writer.u8(1);
      writer.u16(encodedKeyId.byteLength);
      writer.raw(encodedKeyId);
    } else {
      writer.u8(0);
    }
    const settings = frame.paintSettings ?? null;
    if (settings === null) {
      writer.u8(0);
    } else {
      writer.u8(1);
      writer.f32(settings.localSpreadStrength);
      writer.u8(settings.wetPaper ? 1 : 0);
      writer.f32(settings.physicsStrength);
      const encoded = UTF8_ENCODER.encode(settings.paperGrain);
      if (encoded.byteLength > 0xffff) fail('length', 'paperGrain exceeds 65535 UTF-8 bytes');
      writer.u16(encoded.byteLength);
      writer.raw(encoded);
    }
    writer.u32(frame.groups.length);
    for (const group of frame.groups) encodeGroup(writer, group);
  }
  return writer.finish();
}

function readOptionalU32(reader: Reader, what: string): number | undefined {
  const present = reader.u8();
  if (present > 1) fail('flags', `${what} presence must be 0 or 1`);
  return present === 1 ? reader.u32() : undefined;
}

function decodeStroke(reader: Reader): PaintStroke {
  const pointCount = reader.u32();
  // Guard the allocation BEFORE reading anything: 7 f32 per point.
  if (pointCount > Math.floor(reader.remaining / BRUSH_POINT_BYTES)) {
    fail('count', `stroke declares ${pointCount} points beyond the remaining bytes`, reader.offset);
  }
  const timestamp = reader.f64();
  const toolCode = reader.u8();
  const tool = TOOL_CODES[toolCode];
  if (!tool) fail('brush', `unsupported stroke tool code ${toolCode}`);
  const physicsCode = reader.u8();
  if (physicsCode >= PHYSICS_MODE_CODES.length) {
    fail('brush', `unsupported physics mode code ${physicsCode}`);
  }
  const physicsMode = PHYSICS_MODE_CODES[physicsCode]!;
  const colorPresent = reader.u8();
  if (colorPresent > 1) fail('flags', 'stroke color presence must be 0 or 1');
  const color = colorPresent === 1 ? reader.string('stroke color') : null;
  const values = PARAM_KEYS.map(() => reader.f64());
  const params: BrushOpts = {
    size: values[0]!,
    opacity: values[1]!,
    pressure: values[2]!,
    waterAmount: values[3]!,
    dryAmount: values[4]!,
    edgeDetail: values[5]!,
    pickup: values[6]!,
    eraseStrength: values[7]!,
    antiAlias: values[8]!,
  };
  const mutationId = readOptionalU32(reader, 'mutationId');
  const diffusionFrames = readOptionalU32(reader, 'diffusionFrames');
  const playFrame = readOptionalU32(reader, 'playFrame');
  const hasPenInput = reader.u8();
  if (hasPenInput > 1) fail('flags', 'stroke hasPenInput must be 0 or 1');
  // The points are LAST: re-check precisely before the loop.
  if (pointCount > Math.floor(reader.remaining / BRUSH_POINT_BYTES)) {
    fail('count', `stroke declares ${pointCount} points beyond the remaining bytes`, reader.offset);
  }
  const points: PaintStroke['points'] = [];
  for (let index = 0; index < pointCount; index += 1) {
    points.push({
      x: reader.f32(),
      y: reader.f32(),
      p: reader.f32(),
      tx: reader.f32(),
      ty: reader.f32(),
      tw: reader.f32(),
      spd: reader.f32(),
    });
  }
  const stroke: PaintStroke = { tool, points, color, params, timestamp };
  if (mutationId !== undefined) stroke.mutationId = mutationId;
  if (diffusionFrames !== undefined) stroke.diffusionFrames = diffusionFrames;
  if (playFrame !== undefined) stroke.playFrame = playFrame;
  if (hasPenInput === 1) stroke.hasPenInput = true;
  if (physicsMode !== 'absent') stroke.physicsMode = physicsMode;
  return stroke;
}

function decodeGroup(reader: Reader): Readonly<RecordedStrokeGroup> {
  const continuationCount = reader.u32();
  if (continuationCount > Math.floor(reader.remaining / BRUSH_GROUP_MIN_BYTES)) {
    fail('count', `group declares ${continuationCount} continuations beyond the remaining bytes`, reader.offset);
  }
  const primary = decodeStroke(reader);
  if (primary.points.length === 0) fail('count', 'a brush group primary must carry points');
  const continuations: PaintStroke[] = [];
  for (let index = 0; index < continuationCount; index += 1) {
    const continuation = decodeStroke(reader);
    if (continuation.points.length !== 0 || (continuation.diffusionFrames ?? 0) <= 0) {
      fail('count', 'a brush continuation must have no points and a positive diffusion count');
    }
    continuations.push(continuation);
  }
  return { primary, continuations };
}

function decodeBrushSection(bytes: Uint8Array): StudioScriptSnapshotBrushFrame[] {
  const reader = new Reader(bytes);
  if (bytes.byteLength < BRUSH_HEADER_BYTE_LENGTH) {
    fail('truncated', 'brush section is shorter than its 8-byte header');
  }
  const version = reader.u16();
  if (!STUDIO_SCRIPT_SNAPSHOT_BRUSH_VERSIONS.has(version)) {
    fail('version', `unsupported brush section version ${version}`);
  }
  const reserved = reader.u16();
  if (reserved !== 0) fail('flags', 'brush section reserved word must be 0');
  const frameCount = reader.u32();
  if (frameCount > Math.floor(reader.remaining / BRUSH_FRAME_MIN_BYTES)) {
    fail('count', `brush declares ${frameCount} frames beyond the remaining bytes`, reader.offset);
  }
  const frames: StudioScriptSnapshotBrushFrame[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const frame = reader.u32();
    const flags = reader.u8();
    if ((flags & ~1) !== 0) fail('flags', 'unsupported brush frame flags');
    if (reader.u8() !== 0) fail('flags', 'brush frame reserved byte must be 0');
    // v1 carried no key identity; its rows decode as unknown (absent).
    const keyIdPresent = version >= 2 ? reader.u8() : 0;
    if (keyIdPresent > 1) fail('flags', 'brush frame keyId presence must be 0 or 1');
    const keyId = keyIdPresent === 1 ? reader.string('brush frame keyId') : undefined;
    const settingsPresent = reader.u8();
    if (settingsPresent > 1) fail('flags', 'paint settings presence must be 0 or 1');
    let paintSettings: PaintRenderSettings | null = null;
    if (settingsPresent === 1) {
      const localSpreadStrength = reader.f32();
      const wetPaperCode = reader.u8();
      if (wetPaperCode > 1) fail('flags', 'wetPaper must be 0 or 1');
      const physicsStrength = reader.f32();
      paintSettings = {
        localSpreadStrength,
        wetPaper: wetPaperCode === 1,
        physicsStrength,
        paperGrain: reader.string('paperGrain'),
      };
    }
    const groupCount = reader.u32();
    if (groupCount > Math.floor(reader.remaining / BRUSH_GROUP_MIN_BYTES)) {
      fail('count', `frame declares ${groupCount} groups beyond the remaining bytes`, reader.offset);
    }
    const groups: Readonly<RecordedStrokeGroup>[] = [];
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
      groups.push(decodeGroup(reader));
    }
    frames.push({
      frame,
      complete: (flags & 1) === 1,
      paintSettings,
      ...(keyId !== undefined ? { keyId } : {}),
      groups,
    });
  }
  if (reader.remaining !== 0) {
    fail('trailing', 'unread bytes remain in the brush section');
  }
  return frames;
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
