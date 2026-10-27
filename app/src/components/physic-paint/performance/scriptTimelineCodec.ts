// ============================================================
//  scriptTimelineCodec — watercolor timeline codec prototype
//  (quick 261023-f9c). Pure TS: no DOM, no IPC, no file output.
//
//  Two formats over the SAME projected timeline
//  (`AquarellePayloadEvent[]`: StudioStroke<AquarelleStrokePayload> |
//  AquarelleDryEvent):
//
//  1. JSON baseline — JSON.stringify / JSON.parse, UTF-8.
//     Exact and simple; repeats keys and writes decimal numbers.
//
//  2. AQTL v1 packed binary — little-endian, 24-byte fixed header,
//     packed stroke metadata and quantized point records.
//
//  HEADER (24 bytes):
//    magic 'AQTL' (4) | u16 version=1 | u16 flags=0 | u32 eventCount |
//    u32 totalPointCount | u32 bodyByteLength | u32 reserved=0
//  bodyByteLength counts the bytes AFTER the header, so
//  bodyByteLength + 24 must equal the buffer length (no trailing bytes).
//
//  EVENT: u8 kind (1 = stroke, 2 = dry).
//    Dry body: u32 tick, f64 recordedOrder.
//    Stroke body: u8 mutationId presence + u32 id; u8 playFrame presence
//      + i32 frame (absence means null); u32 ticks; u32 cuisson;
//      u32 traceSeed; f64 recordedOrder; u16-length UTF-8 brushId;
//      u8 color presence + u16-length UTF-8 color; u8 toolOverrides
//      mask (bit order tip, aspect, rotation, sizeCurve, scatter,
//      capacity, grain, wetRound) + one f64 per set bit; engine block;
//      u32 pointCount; point records.
//    Engine block: u8 tool (brush=0, water=1, pen=2, lift=3); u8 color
//      presence + string; brushId string; u32 params count + (u16 key,
//      f64 value) in sorted key order; u8 toolOverrides mask + f64
//      values; u8 mutationId presence + u32; u8 diffusionFrames
//      presence + u32; f64 timestamp; u8 playFrame presence + i32.
//    Point record (16 bytes): u16 x, u16 y, u16 p, i16 tx, i16 ty,
//      i16 tw, u32 tick.
//
//  QUANTIZATION (points only; every metadata scalar is f64/u32 exact):
//    x/y: clamp [0,1], round(v * 65535) -> u16.
//           Half-step error = 1/65535/2 ≈ 7.6e-6.
//    p: the live sentinel (-1 = no device pressure, the engine derives it
//       from speed) rides the wire as 0 and decodes back to -1. Real
//       pressures clamp [0,1], round(v * 65535) -> u16. A real 0 cannot
//       occur (a pressureless pen records 0.5, a mouse -1), so 0 is ours.
//    tx/ty/tw: clamp ±655.34, round(v * 50) -> i16.
//           Half-step error = 0.02/2 = 0.01 degrees.
//
//  The decoder validates magic, version, flags, exact body length,
//  eventCount <= bodyByteLength, totalPointCount * 16 <= bodyByteLength,
//  per-stroke pointCount * 16 <= remaining, string lengths <= remaining,
//  and no trailing bytes BEFORE allocating or reading. Every failure is a
//  typed ScriptTimelineCodecError — never a raw RangeError.
//
//  NOTE on the point-record size: the field list above (three u16 +
//  three i16 + one u32) is 16 bytes; the plan's 14-byte lower bound in
//  its validation prose is subsumed by this exact 16-byte check.
// ============================================================

import type {
  AquarelleDryEvent,
  AquarellePayloadEvent,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';

/** ASCII magic carried by every AQTL buffer. */
export const SCRIPT_TIMELINE_BINARY_MAGIC = 'AQTL';

/** The one binary version this module encodes and accepts. */
export const SCRIPT_TIMELINE_BINARY_VERSION = 1;

/** UV/pressure quantization step (u16 over [0,1]). */
export const POINT_UV_STEP = 1 / 65535;

/** Degree quantization step (i16 at 50 ticks per degree). */
export const POINT_DEGREE_STEP = 0.02;

export type ScriptTimelineCodecErrorCode =
  | 'magic-mismatch'
  | 'unsupported-version'
  | 'truncated'
  | 'invalid-length'
  | 'invalid-count'
  | 'invalid-tag'
  | 'invalid-string'
  | 'invalid-value'
  | 'unsupported-motion'
  | 'trailing-bytes'
  | 'json-invalid';

/** Every codec failure is this typed error. */
export class ScriptTimelineCodecError extends Error {
  readonly code: ScriptTimelineCodecErrorCode;
  readonly offset?: number;

  constructor(code: ScriptTimelineCodecErrorCode, message?: string, offset?: number) {
    super(message ?? code);
    this.name = 'ScriptTimelineCodecError';
    this.code = code;
    this.offset = offset;
  }
}

const HEADER_BYTE_LENGTH = 24;
const POINT_RECORD_BYTE_LENGTH = 16;
const UV_MAX = 65535;
const TILT_LIMIT = 655.34;
const TILT_SCALE = 50;

/** Bit order of the shared tool-override mask (one f64 per set bit). */
const OVERRIDE_KEYS = [
  'tip',
  'aspect',
  'rotation',
  'sizeCurve',
  'scatter',
  'capacity',
  'grain',
  'wetRound',
] as const;

const TOOL_NAMES = ['brush', 'water', 'pen', 'lift'] as const;

const TOOL_CODE_BY_NAME: Readonly<Record<string, number>> = {
  brush: 0,
  water: 1,
  pen: 2,
  lift: 3,
};

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function isDryEvent(event: AquarellePayloadEvent): event is AquarelleDryEvent {
  return (event as { kind?: unknown }).kind === 'dry';
}

function fail(
  code: ScriptTimelineCodecErrorCode,
  message: string,
  offset?: number,
): never {
  throw new ScriptTimelineCodecError(code, message, offset);
}

function assertFinite(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('invalid-value', `${what} must be a finite number`);
  }
  return value;
}

function assertUint(value: unknown, what: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xffffffff
  ) {
    fail('invalid-value', `${what} must be an unsigned 32-bit integer`);
  }
  return value;
}

function assertInt32(value: unknown, what: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < -0x80000000 ||
    value > 0x7fffffff
  ) {
    fail('invalid-value', `${what} must be a signed 32-bit integer`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

class BinaryWriter {
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

  i32(value: number): void {
    this.ensure(4);
    this.view.setInt32(this.cursor, value, true);
    this.cursor += 4;
  }

  i16(value: number): void {
    this.ensure(2);
    this.view.setInt16(this.cursor, value, true);
    this.cursor += 2;
  }

  f64(value: number): void {
    this.ensure(8);
    this.view.setFloat64(this.cursor, value, true);
    this.cursor += 8;
  }

  string(value: string, what: string): void {
    const encoded = UTF8_ENCODER.encode(value);
    if (encoded.byteLength > 0xffff) {
      fail('invalid-string', `${what} exceeds 65535 UTF-8 bytes`);
    }
    this.u16(encoded.byteLength);
    this.ensure(encoded.byteLength);
    this.bytes.set(encoded, this.cursor);
    this.cursor += encoded.byteLength;
  }

  patchU32(offset: number, value: number): void {
    this.view.setUint32(offset, value, true);
  }

  finish(): Uint8Array {
    return this.bytes.slice(0, this.cursor);
  }
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

class BinaryReader {
  private readonly view: DataView;
  private cursor: number;
  private readonly end: number;

  constructor(
    private readonly bytes: Uint8Array,
    start: number,
    end: number,
  ) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.cursor = start;
    this.end = end;
  }

  get offset(): number {
    return this.cursor;
  }

  get remaining(): number {
    return this.end - this.cursor;
  }

  atEnd(): boolean {
    return this.cursor === this.end;
  }

  private need(count: number): void {
    if (count < 0 || this.cursor + count > this.end) {
      fail('truncated', 'read past the declared body end', this.cursor);
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

  i32(): number {
    this.need(4);
    const value = this.view.getInt32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  i16(): number {
    this.need(2);
    const value = this.view.getInt16(this.cursor, true);
    this.cursor += 2;
    return value;
  }

  f64(): number {
    this.need(8);
    const value = this.view.getFloat64(this.cursor, true);
    this.cursor += 8;
    return value;
  }

  presence(what: string): boolean {
    const marker = this.u8();
    if (marker !== 0 && marker !== 1) {
      fail('invalid-value', `${what} presence marker must be 0 or 1`, this.cursor - 1);
    }
    return marker === 1;
  }

  string(what: string): string {
    const byteLength = this.u16();
    this.need(byteLength);
    const slice = this.bytes.subarray(this.cursor, this.cursor + byteLength);
    const offset = this.cursor;
    this.cursor += byteLength;
    try {
      return UTF8_DECODER.decode(slice);
    } catch {
      fail('invalid-string', `${what} is not valid UTF-8`, offset);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared encode helpers
// ---------------------------------------------------------------------------

function encodeOverrideMask(writer: BinaryWriter, rawOverrides: unknown, what: string): void {
  if (rawOverrides !== undefined && (typeof rawOverrides !== 'object' || rawOverrides === null)) {
    fail('invalid-value', `${what} must be an object`);
  }

  const overrides = rawOverrides as Readonly<Record<string, unknown>> | undefined;
  const values = new Array<number>(OVERRIDE_KEYS.length).fill(0);
  let mask = 0;
  if (overrides !== undefined) {
    for (const [key, rawValue] of Object.entries(overrides)) {
      const index = (OVERRIDE_KEYS as readonly string[]).indexOf(key);
      if (index < 0) fail('invalid-tag', `${what} has unknown override key "${key}"`);
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        fail('invalid-value', `${what}.${key} must be a finite number`);
      }
      mask |= 1 << index;
      values[index] = rawValue;
    }
  }

  writer.u8(mask);
  for (let index = 0; index < OVERRIDE_KEYS.length; index += 1) {
    if (mask & (1 << index)) writer.f64(values[index]);
  }
}

function quantizeUv(value: unknown, what: string): number {
  const finite = assertFinite(value, what);
  return Math.round(Math.min(1, Math.max(0, finite)) * UV_MAX);
}

/**
 * 261027 UAT round 10: the live pointer path records p = -1 when the device
 * reports no usable pressure (mouse / trackpad) and the engine then derives
 * pressure from speed. Clamping that sentinel to 0 stored a REAL minimum
 * pressure, so every snapshot round-trip re-baked mouse strokes as thin,
 * pale dabs — a Move after a restore shrank the text wash to a third of its
 * painted density. Wire value 0 IS the sentinel; a real 0 cannot occur
 * (a pressureless pen maps to 0.5, a mouse to -1).
 */
function quantizePressure(value: unknown): number {
  const finite = assertFinite(value, 'point.p');
  if (finite < 0) return 0;
  return Math.round(Math.min(1, Math.max(0, finite)) * UV_MAX);
}

function quantizeTilt(value: unknown, what: string): number {
  const finite = assertFinite(value, what);
  return Math.round(Math.min(TILT_LIMIT, Math.max(-TILT_LIMIT, finite)) * TILT_SCALE);
}

// ---------------------------------------------------------------------------
// Binary encode
// ---------------------------------------------------------------------------

function encodeStroke(writer: BinaryWriter, stroke: StudioStroke<AquarelleStrokePayload>): number {
  if (stroke.motion !== null && stroke.motion !== undefined) {
    fail('unsupported-motion', 'motion schedules are not encodable in AQTL v1');
  }

  const engine = stroke.engine;
  if (engine === null || typeof engine !== 'object') {
    fail('invalid-value', 'stroke.engine must be an AquarelleStrokePayload');
  }
  const toolCode = TOOL_CODE_BY_NAME[engine.tool];
  if (toolCode === undefined) fail('invalid-tag', `unknown tool "${String(engine.tool)}"`);

  if (typeof stroke.brushId !== 'string') fail('invalid-string', 'stroke.brushId must be a string');
  if (stroke.color !== null && typeof stroke.color !== 'string') {
    fail('invalid-string', 'stroke.color must be a string or null');
  }
  const ticks = assertUint(stroke.ticks, 'stroke.ticks');
  const cuisson = assertUint(stroke.cuisson, 'stroke.cuisson');
  const traceSeed = assertUint(stroke.traceSeed, 'stroke.traceSeed');
  const recordedOrder = assertFinite(stroke.recordedOrder, 'stroke.recordedOrder');

  const mutationId = engine.mutationId;
  writer.u8(mutationId === undefined ? 0 : 1);
  if (mutationId !== undefined) writer.u32(assertUint(mutationId, 'engine.mutationId'));

  const playFrame = stroke.playFrame;
  writer.u8(playFrame === null ? 0 : 1);
  if (playFrame !== null) writer.i32(assertInt32(playFrame, 'stroke.playFrame'));

  writer.u32(ticks);
  writer.u32(cuisson);
  writer.u32(traceSeed);
  writer.f64(recordedOrder);

  writer.string(stroke.brushId, 'stroke.brushId');

  if (stroke.color === null) {
    writer.u8(0);
  } else {
    writer.u8(1);
    writer.string(stroke.color, 'stroke.color');
  }

  encodeOverrideMask(writer, stroke.toolOverrides, 'stroke.toolOverrides');

  // Engine block.
  writer.u8(toolCode);
  if (engine.color === null) {
    writer.u8(0);
  } else {
    if (typeof engine.color !== 'string') fail('invalid-string', 'engine.color must be a string or null');
    writer.u8(1);
    writer.string(engine.color, 'engine.color');
  }

  if (typeof engine.brushId !== 'string') fail('invalid-string', 'engine.brushId must be a string');
  writer.string(engine.brushId, 'engine.brushId');

  const params = engine.params;
  if (params === null || typeof params !== 'object') {
    fail('invalid-value', 'engine.params must be an object');
  }
  const paramKeys = Object.keys(params).sort();
  writer.u32(assertUint(paramKeys.length, 'engine.params count'));
  for (const key of paramKeys) {
    writer.string(key, 'engine.params key');
    writer.f64(assertFinite(params[key], `engine.params.${key}`));
  }

  encodeOverrideMask(writer, engine.toolOverrides, 'engine.toolOverrides');

  const engineMutationId = engine.mutationId;
  writer.u8(engineMutationId === undefined ? 0 : 1);
  if (engineMutationId !== undefined) {
    writer.u32(assertUint(engineMutationId, 'engine.mutationId'));
  }

  const diffusionFrames = engine.diffusionFrames;
  writer.u8(diffusionFrames === undefined ? 0 : 1);
  if (diffusionFrames !== undefined) {
    writer.u32(assertUint(diffusionFrames, 'engine.diffusionFrames'));
  }

  writer.f64(assertFinite(engine.timestamp, 'engine.timestamp'));

  const enginePlayFrame = engine.playFrame;
  writer.u8(enginePlayFrame === undefined ? 0 : 1);
  if (enginePlayFrame !== undefined) {
    writer.i32(assertInt32(enginePlayFrame, 'engine.playFrame'));
  }

  const pts = stroke.pts;
  if (!Array.isArray(pts)) fail('invalid-value', 'stroke.pts must be an array');
  writer.u32(assertUint(pts.length, 'stroke.pts length'));

  for (const point of pts) {
    writer.u16(quantizeUv(point.x, 'point.x'));
    writer.u16(quantizeUv(point.y, 'point.y'));
    writer.u16(quantizePressure(point.p));
    writer.i16(quantizeTilt(point.tx, 'point.tx'));
    writer.i16(quantizeTilt(point.ty, 'point.ty'));
    writer.i16(quantizeTilt(point.tw, 'point.tw'));
    writer.u32(assertUint(point.tick, 'point.tick'));
  }

  return pts.length;
}

function encodeDry(writer: BinaryWriter, event: AquarelleDryEvent): void {
  writer.u32(assertUint(event.tick, 'dry.tick'));
  writer.f64(assertFinite(event.recordedOrder, 'dry.recordedOrder'));
}

export function encodeScriptTimelineBinary(
  events: readonly AquarellePayloadEvent[],
): Uint8Array {
  if (!Array.isArray(events)) fail('invalid-value', 'events must be an array');
  if (events.length > 0xffffffff) fail('invalid-count', 'too many events');

  const writer = new BinaryWriter();

  // Fixed header (eventCount / totalPointCount / bodyByteLength patched below).
  for (let index = 0; index < SCRIPT_TIMELINE_BINARY_MAGIC.length; index += 1) {
    writer.u8(SCRIPT_TIMELINE_BINARY_MAGIC.charCodeAt(index));
  }
  writer.u16(SCRIPT_TIMELINE_BINARY_VERSION);
  writer.u16(0); // flags
  writer.u32(0); // eventCount
  writer.u32(0); // totalPointCount
  writer.u32(0); // bodyByteLength
  writer.u32(0); // reserved
  const bodyStart = writer.length;

  let totalPoints = 0;
  for (const event of events) {
    if (isDryEvent(event)) {
      writer.u8(2);
      encodeDry(writer, event);
      continue;
    }
    writer.u8(1);
    totalPoints += encodeStroke(writer, event);
    if (totalPoints > 0xffffffff) fail('invalid-count', 'too many points');
  }

  const bodyByteLength = writer.length - bodyStart;
  writer.patchU32(8, events.length);
  writer.patchU32(12, totalPoints);
  writer.patchU32(16, bodyByteLength);
  return writer.finish();
}

// ---------------------------------------------------------------------------
// Binary decode
// ---------------------------------------------------------------------------

function decodeOverrideMask(
  reader: BinaryReader,
  what: string,
): Record<string, number> {
  const mask = reader.u8();
  const overrides: Record<string, number> = {};
  for (let index = 0; index < OVERRIDE_KEYS.length; index += 1) {
    if (!(mask & (1 << index))) continue;
    overrides[OVERRIDE_KEYS[index]] = assertFinite(reader.f64(), `${what}.${OVERRIDE_KEYS[index]}`);
  }
  return overrides;
}

function decodePoint(reader: BinaryReader): StudioPoint {
  const x = reader.u16() / UV_MAX;
  const y = reader.u16() / UV_MAX;
  const pRaw = reader.u16();
  // 0 is the live -1 sentinel (quantizePressure). Files written before the
  // sentinel existed stored clamped -1 as 0 too, so their mouse strokes also
  // regain speed-derived pressure on the next restore.
  const p = pRaw === 0 ? -1 : pRaw / UV_MAX;
  const tx = reader.i16() / TILT_SCALE;
  const ty = reader.i16() / TILT_SCALE;
  const tw = reader.i16() / TILT_SCALE;
  const tick = reader.u32();
  return { x, y, p, tx, ty, tw, tick };
}

function decodeStroke(reader: BinaryReader): {
  stroke: StudioStroke<AquarelleStrokePayload>;
  pointCount: number;
} {
  // The top-level mutationId is carried for layout symmetry with the engine
  // block; the engine payload member is the reconstructed source.
  if (reader.presence('stroke.mutationId')) reader.u32();

  const hasPlayFrame = reader.presence('stroke.playFrame');
  const playFrame = hasPlayFrame ? reader.i32() : null;

  const ticks = reader.u32();
  const cuisson = reader.u32();
  const traceSeed = reader.u32();
  const recordedOrder = assertFinite(reader.f64(), 'stroke.recordedOrder');

  const brushId = reader.string('stroke.brushId');

  const hasColor = reader.presence('stroke.color');
  const color = hasColor ? reader.string('stroke.color') : null;

  const toolOverrides = decodeOverrideMask(reader, 'stroke.toolOverrides');

  const toolCode = reader.u8();
  const tool = TOOL_NAMES[toolCode];
  if (tool === undefined) fail('invalid-tag', `unknown tool code ${toolCode}`, reader.offset - 1);

  const hasEngineColor = reader.presence('engine.color');
  const engineColor = hasEngineColor ? reader.string('engine.color') : null;
  const engineBrushId = reader.string('engine.brushId');

  const paramCount = reader.u32();
  // Each param is at least a 2-byte key length plus an 8-byte value.
  if (paramCount * 10 > reader.remaining) {
    fail('invalid-count', 'params count exceeds the remaining body bytes', reader.offset);
  }
  const params: Record<string, number> = {};
  for (let index = 0; index < paramCount; index += 1) {
    const key = reader.string('engine.params key');
    params[key] = assertFinite(reader.f64(), `engine.params.${key}`);
  }

  const engineMask = reader.u8();
  const engineOverrides: Record<string, number> = {};
  for (let index = 0; index < OVERRIDE_KEYS.length; index += 1) {
    if (!(engineMask & (1 << index))) continue;
    engineOverrides[OVERRIDE_KEYS[index]] = assertFinite(
      reader.f64(),
      `engine.toolOverrides.${OVERRIDE_KEYS[index]}`,
    );
  }

  const hasEngineMutationId = reader.presence('engine.mutationId');
  const engineMutationId = hasEngineMutationId ? reader.u32() : undefined;

  const hasDiffusionFrames = reader.presence('engine.diffusionFrames');
  const diffusionFrames = hasDiffusionFrames ? reader.u32() : undefined;

  const timestamp = assertFinite(reader.f64(), 'engine.timestamp');

  const hasEnginePlayFrame = reader.presence('engine.playFrame');
  const enginePlayFrame = hasEnginePlayFrame ? reader.i32() : undefined;

  const pointCount = reader.u32();
  if (pointCount * POINT_RECORD_BYTE_LENGTH > reader.remaining) {
    fail('invalid-count', 'point count exceeds the remaining body bytes', reader.offset);
  }
  const pts: StudioPoint[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    pts.push(decodePoint(reader));
  }

  const engine: AquarelleStrokePayload = {
    tool,
    color: engineColor,
    params,
    brushId: engineBrushId,
    toolOverrides:
      engineMask === 0
        ? undefined
        : (engineOverrides as unknown as AquarelleStrokePayload['toolOverrides']),
    mutationId: engineMutationId,
    diffusionFrames,
    timestamp,
    playFrame: enginePlayFrame,
  };

  return {
    stroke: {
      pts,
      ticks,
      cuisson,
      motion: null,
      brushId,
      toolOverrides,
      traceSeed,
      recordedOrder,
      playFrame,
      color,
      engine,
    },
    pointCount,
  };
}

function decodeDry(reader: BinaryReader): AquarelleDryEvent {
  const tick = reader.u32();
  const recordedOrder = assertFinite(reader.f64(), 'dry.recordedOrder');
  return { kind: 'dry', tick, recordedOrder };
}

export function decodeScriptTimelineBinary(input: Uint8Array): AquarellePayloadEvent[] {
  if (!(input instanceof Uint8Array)) {
    fail('truncated', 'input must be a Uint8Array');
  }
  if (input.byteLength < HEADER_BYTE_LENGTH) {
    fail('truncated', 'buffer is shorter than the 24-byte header', 0);
  }

  for (let index = 0; index < SCRIPT_TIMELINE_BINARY_MAGIC.length; index += 1) {
    if (input[index] !== SCRIPT_TIMELINE_BINARY_MAGIC.charCodeAt(index)) {
      fail('magic-mismatch', 'AQTL magic not found', 0);
    }
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const version = view.getUint16(4, true);
  if (version !== SCRIPT_TIMELINE_BINARY_VERSION) {
    fail('unsupported-version', `unsupported AQTL version ${version}`, 4);
  }
  const flags = view.getUint16(6, true);
  if (flags !== 0) fail('invalid-value', `unsupported flags ${flags}`, 6);

  const eventCount = view.getUint32(8, true);
  const totalPointCount = view.getUint32(12, true);
  const bodyByteLength = view.getUint32(16, true);
  const reserved = view.getUint32(20, true);
  if (reserved !== 0) fail('invalid-value', 'reserved header word must be 0', 20);

  const actualBodyByteLength = input.byteLength - HEADER_BYTE_LENGTH;
  if (bodyByteLength > actualBodyByteLength) {
    fail('invalid-length', 'declared body length exceeds the buffer', 16);
  }
  if (bodyByteLength < actualBodyByteLength) {
    fail(
      'trailing-bytes',
      'buffer is longer than the declared body length',
      HEADER_BYTE_LENGTH + bodyByteLength,
    );
  }

  // Validate counts BEFORE allocating or reading anything.
  if (eventCount > bodyByteLength) {
    fail('invalid-count', 'event count exceeds the body bytes', 8);
  }
  if (totalPointCount * POINT_RECORD_BYTE_LENGTH > bodyByteLength) {
    fail('invalid-count', 'total point count cannot fit in the body', 12);
  }

  const reader = new BinaryReader(input, HEADER_BYTE_LENGTH, HEADER_BYTE_LENGTH + bodyByteLength);
  const events: AquarellePayloadEvent[] = [];
  let summedPointCount = 0;

  for (let index = 0; index < eventCount; index += 1) {
    const kindOffset = reader.offset;
    const kind = reader.u8();
    if (kind === 1) {
      const decoded = decodeStroke(reader);
      summedPointCount += decoded.pointCount;
      events.push(decoded.stroke);
      continue;
    }
    if (kind === 2) {
      events.push(decodeDry(reader));
      continue;
    }
    fail('invalid-tag', `unknown event kind ${kind}`, kindOffset);
  }

  if (!reader.atEnd()) {
    fail('trailing-bytes', 'unread bytes remain inside the declared body', reader.offset);
  }
  if (summedPointCount !== totalPointCount) {
    fail(
      'invalid-count',
      `totalPointCount ${totalPointCount} != summed ${summedPointCount}`,
      12,
    );
  }

  return events;
}

// ---------------------------------------------------------------------------
// JSON baseline
// ---------------------------------------------------------------------------

export function encodeScriptTimelineJson(events: readonly AquarellePayloadEvent[]): Uint8Array {
  let json: string;
  try {
    json = JSON.stringify(events);
  } catch {
    fail('json-invalid', 'timeline is not JSON-serializable');
  }
  if (typeof json !== 'string') fail('json-invalid', 'timeline is not JSON-serializable');
  return UTF8_ENCODER.encode(json);
}

function validateJsonOverrides(value: unknown, what: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('json-invalid', `${what} must be an object`);
  }
  for (const [key, raw] of Object.entries(value)) {
    if (!(OVERRIDE_KEYS as readonly string[]).includes(key)) {
      fail('invalid-tag', `${what} has unknown override key "${key}"`);
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      fail('invalid-value', `${what}.${key} must be a finite number`);
    }
  }
}

function validateJsonEvent(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    fail('json-invalid', 'every timeline event must be an object');
  }
  const event = value as Record<string, unknown>;

  if (event['kind'] === 'dry') {
    const tick = event['tick'];
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
      fail('json-invalid', 'dry.tick must be a non-negative integer');
    }
    if (typeof event['recordedOrder'] !== 'number' || !Number.isFinite(event['recordedOrder'])) {
      fail('json-invalid', 'dry.recordedOrder must be finite');
    }
    return;
  }

  if (!Array.isArray(event['pts'])) fail('json-invalid', 'stroke.pts must be an array');
  for (const field of ['ticks', 'cuisson', 'traceSeed', 'recordedOrder']) {
    if (typeof event[field] !== 'number' || !Number.isFinite(event[field])) {
      fail('json-invalid', `stroke.${field} must be finite`);
    }
  }
  if (event['motion'] !== null && event['motion'] !== undefined) {
    fail('unsupported-motion', 'motion schedules are not supported by this codec');
  }
  if (typeof event['brushId'] !== 'string') fail('json-invalid', 'stroke.brushId must be a string');
  if (event['color'] !== null && typeof event['color'] !== 'string') {
    fail('json-invalid', 'stroke.color must be a string or null');
  }
  if (event['playFrame'] !== null && !Number.isInteger(event['playFrame'])) {
    fail('json-invalid', 'stroke.playFrame must be an integer or null');
  }
  validateJsonOverrides(event['toolOverrides'], 'stroke.toolOverrides');

  for (const point of event['pts']) {
    if (typeof point !== 'object' || point === null) fail('json-invalid', 'point must be an object');
    const fields = point as Record<string, unknown>;
    for (const field of ['x', 'y', 'p', 'tx', 'ty', 'tw']) {
      if (typeof fields[field] !== 'number' || !Number.isFinite(fields[field])) {
        fail('json-invalid', `point.${field} must be finite`);
      }
    }
    if (typeof fields['tick'] !== 'number' || !Number.isInteger(fields['tick'])) {
      fail('json-invalid', 'point.tick must be an integer');
    }
  }

  const engine = event['engine'];
  if (typeof engine !== 'object' || engine === null || Array.isArray(engine)) {
    fail('json-invalid', 'stroke.engine must be an object');
  }
  const payload = engine as Record<string, unknown>;
  if (
    typeof payload['tool'] !== 'string' ||
    !(TOOL_NAMES as readonly string[]).includes(payload['tool'])
  ) {
    fail('invalid-tag', `unknown tool "${String(payload['tool'])}"`);
  }
  if (payload['color'] !== null && typeof payload['color'] !== 'string') {
    fail('json-invalid', 'engine.color must be a string or null');
  }
  if (typeof payload['brushId'] !== 'string') {
    fail('json-invalid', 'engine.brushId must be a string');
  }
  if (
    typeof payload['params'] !== 'object' ||
    payload['params'] === null ||
    Array.isArray(payload['params'])
  ) {
    fail('json-invalid', 'engine.params must be an object');
  }
  for (const [key, raw] of Object.entries(payload['params'])) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      fail('json-invalid', `engine.params.${key} must be finite`);
    }
  }
  if (typeof payload['timestamp'] !== 'number' || !Number.isFinite(payload['timestamp'])) {
    fail('json-invalid', 'engine.timestamp must be finite');
  }
  if (payload['toolOverrides'] !== undefined) {
    validateJsonOverrides(payload['toolOverrides'], 'engine.toolOverrides');
  }
  for (const field of ['mutationId', 'diffusionFrames']) {
    const raw = payload[field];
    if (raw !== undefined && (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0)) {
      fail('json-invalid', `engine.${field} must be a non-negative integer`);
    }
  }
  if (
    payload['playFrame'] !== undefined &&
    payload['playFrame'] !== null &&
    !Number.isInteger(payload['playFrame'])
  ) {
    fail('json-invalid', 'engine.playFrame must be an integer');
  }
}

export function decodeScriptTimelineJson(bytes: Uint8Array): AquarellePayloadEvent[] {
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    fail('json-invalid', 'buffer is not valid UTF-8', 0);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('json-invalid', 'buffer is not valid JSON', 0);
  }
  if (!Array.isArray(parsed)) fail('json-invalid', 'timeline JSON must be an array');

  for (const event of parsed) validateJsonEvent(event);
  return parsed as AquarellePayloadEvent[];
}
