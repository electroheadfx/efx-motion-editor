// ============================================================
//  scriptTimelineCodec.test.ts — RED-first suite for the
//  watercolor timeline codec prototype (quick 261023-f9c).
//
//  Two formats over the SAME in-memory timeline:
//    - JSON baseline: exact JSON.stringify / JSON.parse round-trip.
//    - AQTL v2 packed binary (61-05): versioned header, packed stroke
//      metadata, quantized point records (documented tolerances), and
//      the vector path inside the engine block — anchor block plus the
//      optional render-mode byte.
//  Every corrupt-input case must fail closed with a typed
//  ScriptTimelineCodecError — never a raw RangeError. Version 1 is
//  REFUSED outright (no upgrade path, per the project's clean-break law).
// ============================================================

import { describe, expect, it } from 'vitest';
import type {
  AquarelleAnchor,
  AquarellePayloadEvent,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  POINT_DEGREE_STEP,
  POINT_UV_STEP,
  SCRIPT_TIMELINE_BINARY_MAGIC,
  SCRIPT_TIMELINE_BINARY_VERSION,
  ScriptTimelineCodecError,
  decodeScriptTimelineBinary,
  decodeScriptTimelineJson,
  encodeScriptTimelineBinary,
  encodeScriptTimelineJson,
  type ScriptTimelineCodecErrorCode,
} from './scriptTimelineCodec';

// ---------------------------------------------------------------------------
// Representative fixture: 3 play frames, 5 strokes (3/17/64/100/1 points),
// one Dry event, varied tools/params/overrides, one null playFrame.
// ---------------------------------------------------------------------------

const FULL_OVERRIDES = {
  tip: 1.2,
  aspect: 0.8,
  rotation: 15,
  sizeCurve: 2,
  scatter: 0.5,
  capacity: 0.75,
  grain: 3,
  wetRound: 1,
};

const PARTIAL_OVERRIDES = { tip: 1.25, grain: 0.5 };

function fixturePoint(index: number, total: number): StudioPoint {
  const t = total <= 1 ? 0 : index / (total - 1);
  return {
    x: 0.05 + 0.8 * t,
    y: 0.15 + 0.7 * (((index * 7) % 11) / 10),
    p: 0.2 + 0.7 * (((index * 3) % 9) / 8),
    tx: -20 + (index % 5) * 10,
    ty: 15 - (index % 4) * 5,
    tw: (index % 7) * 3,
    tick: index,
  };
}

interface StrokeSpec {
  playFrame: number | null;
  ticks: number;
  cuisson: number;
  brushId: string;
  toolOverrides: Record<string, number>;
  traceSeed: number;
  recordedOrder: number;
  color: string | null;
  tool: 'brush' | 'water' | 'pen' | 'lift';
  params: Record<string, number>;
  mutationId?: number;
  diffusionFrames?: number;
  timestamp: number;
  enginePlayFrame?: number;
  engineOverrides?: Record<string, number>;
}

function makeStroke(spec: StrokeSpec, pointCount: number): StudioStroke<AquarelleStrokePayload> {
  const pts = Array.from({ length: pointCount }, (_, index) => fixturePoint(index, pointCount));
  return {
    pts,
    ticks: spec.ticks,
    cuisson: spec.cuisson,
    motion: null,
    brushId: spec.brushId,
    toolOverrides: spec.toolOverrides,
    traceSeed: spec.traceSeed,
    recordedOrder: spec.recordedOrder,
    playFrame: spec.playFrame,
    color: spec.color,
    engine: {
      tool: spec.tool,
      color: spec.color,
      params: spec.params,
      brushId: spec.brushId,
      toolOverrides: spec.engineOverrides as unknown as AquarelleStrokePayload['toolOverrides'],
      mutationId: spec.mutationId,
      diffusionFrames: spec.diffusionFrames,
      timestamp: spec.timestamp,
      playFrame: spec.enginePlayFrame,
    },
  };
}

const STROKE_A: StrokeSpec = {
  playFrame: 0,
  ticks: 2,
  cuisson: 0,
  brushId: 'round-soft',
  toolOverrides: {},
  traceSeed: 111,
  recordedOrder: 1.5,
  color: '#112233',
  tool: 'brush',
  params: { size: 12, water: 50 },
  mutationId: 101,
  timestamp: 1000,
  enginePlayFrame: 0,
};

const STROKE_B: StrokeSpec = {
  playFrame: 0,
  ticks: 16,
  cuisson: 3,
  brushId: 'flat-wet',
  toolOverrides: FULL_OVERRIDES,
  traceSeed: 222,
  recordedOrder: 2.25,
  color: '#445566',
  tool: 'water',
  params: { size: 24, flow: 30, water: 60 },
  mutationId: 102,
  diffusionFrames: 3,
  timestamp: 1001.25,
  enginePlayFrame: 0,
  engineOverrides: FULL_OVERRIDES,
};

const STROKE_C: StrokeSpec = {
  playFrame: 7,
  ticks: 63,
  cuisson: 0,
  brushId: 'ink',
  toolOverrides: PARTIAL_OVERRIDES,
  traceSeed: 333,
  recordedOrder: 2.75,
  color: null,
  tool: 'pen',
  params: {},
  timestamp: 1002.5,
  enginePlayFrame: 7,
};

const STROKE_D: StrokeSpec = {
  playFrame: 7,
  ticks: 99,
  cuisson: 12,
  brushId: 'lift-broad',
  toolOverrides: {},
  traceSeed: 444,
  recordedOrder: 3.5,
  color: '#778899',
  tool: 'lift',
  params: { size: 40 },
  mutationId: 104,
  diffusionFrames: 12,
  timestamp: 1003.75,
  enginePlayFrame: 7,
};

const STROKE_E: StrokeSpec = {
  playFrame: null,
  ticks: 1,
  cuisson: 0,
  brushId: 'dot',
  toolOverrides: { sizeCurve: 2, capacity: 0.75 },
  traceSeed: 555,
  recordedOrder: 4.125,
  color: '#aabbcc',
  tool: 'brush',
  params: { size: 2, dry: 10 },
  mutationId: 105,
  timestamp: 1004,
};

const FIXTURE: AquarellePayloadEvent[] = [
  makeStroke(STROKE_A, 3),
  makeStroke(STROKE_B, 17),
  { kind: 'dry', tick: 42, recordedOrder: 2.0 },
  makeStroke(STROKE_C, 64),
  makeStroke(STROKE_D, 100),
  makeStroke(STROKE_E, 1),
];

const TOTAL_POINTS = 3 + 17 + 64 + 100 + 1;

// Pinned after the first measured run — never guessed.
// 61-05: the watercolor binary grew by one vector-flags byte per stroke
// (5 strokes in FIXTURE): the measured v1 length was 3737.
const JSON_BYTE_LENGTH = 18068;
const BINARY_BYTE_LENGTH = 3742;
const MEASURED_RATIO = 4.83;

const asStroke = (event: AquarellePayloadEvent): StudioStroke<AquarelleStrokePayload> =>
  event as StudioStroke<AquarelleStrokePayload>;

const isDry = (event: AquarellePayloadEvent): boolean =>
  (event as { kind?: string }).kind === 'dry';

function expectedCode(run: () => unknown): ScriptTimelineCodecErrorCode | 'no-throw' {
  try {
    run();
    return 'no-throw';
  } catch (error) {
    expect(error).toBeInstanceOf(ScriptTimelineCodecError);
    return (error as ScriptTimelineCodecError).code;
  }
}

// ---------------------------------------------------------------------------
// Minimal one-stroke buffer: a documented fixed layout so corrupt-byte tests
// can address exact fields. Header 24 bytes, then (AQTL v2):
//   24 kind | 25 mutation presence | 26 play presence | 27 ticks | 31 cuisson
//   35 traceSeed | 39 recordedOrder(f64) | 47 brushId len | 49 brushId
//   50 color presence | 51 overrides mask | 52 engine tool
//   53 engine color presence | 54 engine brushId len | 56 engine brushId
//   57 params count | 61 engine overrides mask | 62 engine mutation presence
//   63 engine diffusion presence | 64 timestamp(f64) | 72 engine play presence
//   73 vectorFlags | 74 pointCount | 78 point record (16 bytes each)
// ---------------------------------------------------------------------------

const MINIMAL_RECORDED_ORDER_OFFSET = 39;
const MINIMAL_BRUSH_ID_LENGTH_OFFSET = 47;
const MINIMAL_TOOL_OFFSET = 52;
const MINIMAL_POINT_COUNT_OFFSET = 74;
// 61-30: when a curve mode is present it is written AFTER the render-mode byte
// (which is itself absent here), so the code byte sits directly after the
// vectorFlags byte at 73 and pointCount shifts one byte later.
const MINIMAL_CURVE_MODE_OFFSET = 74;

// ---------------------------------------------------------------------------
// Vector-stroke layout (61-05): same prefix, then the anchor block.
//   73 vectorFlags (bit 0 anchors, bit 1 render mode) | 74 anchorCount(u16)
//   per anchor: x(f32) y(f32) kind(u8) handleFlags(u8)
//               [in.xy(f32 pair)] [out.xy(f32 pair)] widthPresent(u8) [width(f32)]
//   118 pointCount | 122 point record (16 bytes each)
// Anchor scalars are f32 on the wire, so every value below is exactly
// representable in binary32 — including the 1.8 factor, stored through
// Math.fround so the whole-stroke deep equality is exact rather than a
// tolerance check. The sparse profile keeps exactly ONE width key.
// ---------------------------------------------------------------------------

const VECTOR_WIDTH_1_8 = Math.fround(1.8);
const VECTOR_ANCHOR_COUNT_OFFSET = 74;

const VECTOR_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto', width: VECTOR_WIDTH_1_8 },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

/** The minimal one-stroke timeline carrying the two-anchor vector path. */
function vectorStroke(): StudioStroke<AquarelleStrokePayload> {
  const base = minimalStroke();
  return { ...base, engine: { ...base.engine, anchors: VECTOR_ANCHORS } };
}

/** A hand-painted stroke that carries an explicit curve-evaluation mode. */
function handPaintedWithCurveMode(
  mode: 'bezier' | 'spline',
): StudioStroke<AquarelleStrokePayload> {
  const base = minimalStroke();
  return { ...base, engine: { ...base.engine, curveMode: mode } };
}

/** The same path with NO width keys: every anchor uses the default factor. */
function uniformVectorStroke(): StudioStroke<AquarelleStrokePayload> {
  const base = minimalStroke();
  return {
    ...base,
    engine: {
      ...base.engine,
      anchors: [
        { x: 0.25, y: 0.5, kind: 'auto' },
        { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
      ],
    },
  };
}

function minimalStroke(): StudioStroke<AquarelleStrokePayload> {
  return {
    // Quantization-exact values (0 and 1 survive round(u16 / 65535)).
    // p = -1 is the live no-pressure sentinel; it survives the AQTL wire.
    pts: [{ x: 1, y: 0, p: -1, tx: 0, ty: 0, tw: 0, tick: 0 }],
    ticks: 1,
    cuisson: 0,
    motion: null,
    brushId: 'b',
    toolOverrides: {},
    traceSeed: 7,
    recordedOrder: 1,
    playFrame: null,
    color: null,
    engine: {
      tool: 'brush',
      color: null,
      params: {},
      brushId: 'b',
      toolOverrides: undefined,
      mutationId: undefined,
      diffusionFrames: undefined,
      timestamp: 1,
      playFrame: undefined,
    },
  };
}

const MINIMAL_EVENTS: AquarellePayloadEvent[] = [minimalStroke()];
const MINIMAL_BYTES = encodeScriptTimelineBinary(MINIMAL_EVENTS);

function corruptMinimal(mutate: (bytes: Uint8Array, view: DataView) => void): Uint8Array {
  const bytes = MINIMAL_BYTES.slice();
  mutate(bytes, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  return bytes;
}

// ---------------------------------------------------------------------------
// JSON baseline
// ---------------------------------------------------------------------------

describe('JSON baseline codec', () => {
  it('round-trips the fixture exactly', () => {
    const decoded = decodeScriptTimelineJson(encodeScriptTimelineJson(FIXTURE));
    expect(decoded).toEqual(FIXTURE);
  });

  it('encodes an empty timeline as "[]" (2 bytes)', () => {
    const encoded = encodeScriptTimelineJson([]);
    expect(encoded.byteLength).toBe(2);
    expect(new TextDecoder().decode(encoded)).toBe('[]');
    expect(decodeScriptTimelineJson(encoded)).toEqual([]);
  });

  it('rejects malformed JSON with a typed error', () => {
    const encoder = new TextEncoder();
    expect(expectedCode(() => decodeScriptTimelineJson(encoder.encode('not json')))).toBe('json-invalid');
    expect(expectedCode(() => decodeScriptTimelineJson(encoder.encode('{"nope":true}')))).toBe('json-invalid');
    expect(expectedCode(() => decodeScriptTimelineJson(new Uint8Array([0xff, 0xfe])))).toBe('json-invalid');
  });

  it('rejects structurally invalid parsed events', () => {
    const encoder = new TextEncoder();
    expect(expectedCode(() => decodeScriptTimelineJson(encoder.encode('[{"kind":"dry","tick":1}]')))).toBe('json-invalid');
    expect(expectedCode(() => decodeScriptTimelineJson(encoder.encode('[{"kind":"dry","tick":1,"recordedOrder":1e999}]')))).toBe('json-invalid');
  });
});

// ---------------------------------------------------------------------------
// Binary round-trip
// ---------------------------------------------------------------------------

describe('AQTL packed binary codec', () => {
  it('pins the magic/version constants', () => {
    expect(SCRIPT_TIMELINE_BINARY_MAGIC).toBe('AQTL');
    // 61-05: AQTL v2 is the one accepted version; v1 is refused below.
    expect(SCRIPT_TIMELINE_BINARY_VERSION).toBe(2);
    expect(POINT_UV_STEP).toBeCloseTo(1 / 65535, 12);
    expect(POINT_DEGREE_STEP).toBeCloseTo(0.02, 12);
  });

  it('round-trips every metadata field exactly and points within tolerance', () => {
    const decoded = decodeScriptTimelineBinary(encodeScriptTimelineBinary(FIXTURE));

    expect(decoded).toHaveLength(FIXTURE.length);
    const decodedPointTotal = decoded.reduce(
      (sum, event) => sum + (isDry(event) ? 0 : asStroke(event).pts.length),
      0,
    );
    expect(decodedPointTotal).toBe(TOTAL_POINTS);
    expect(decoded.map((event) => (isDry(event) ? 'dry' : 'stroke'))).toEqual([
      'stroke',
      'stroke',
      'dry',
      'stroke',
      'stroke',
      'stroke',
    ]);

    for (let index = 0; index < FIXTURE.length; index += 1) {
      const original = FIXTURE[index];
      const roundTripped = decoded[index];

      if (isDry(original)) {
        expect(roundTripped).toEqual(original);
        continue;
      }

      const originalStroke = asStroke(original);
      const decodedStroke = asStroke(roundTripped);

      // Every scalar/string/record/engine field is f64/u32/UTF-8 exact.
      expect({ ...decodedStroke, pts: [] }).toEqual({ ...originalStroke, pts: [] });
      expect(decodedStroke.pts).toHaveLength(originalStroke.pts.length);

      for (let pointIndex = 0; pointIndex < originalStroke.pts.length; pointIndex += 1) {
        const expected = originalStroke.pts[pointIndex];
        const actual = decodedStroke.pts[pointIndex];
        expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(POINT_UV_STEP / 2 + 1e-12);
        expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(POINT_UV_STEP / 2 + 1e-12);
        expect(Math.abs(actual.p - expected.p)).toBeLessThanOrEqual(POINT_UV_STEP / 2 + 1e-12);
        expect(Math.abs(actual.tx - expected.tx)).toBeLessThanOrEqual(POINT_DEGREE_STEP / 2 + 1e-12);
        expect(Math.abs(actual.ty - expected.ty)).toBeLessThanOrEqual(POINT_DEGREE_STEP / 2 + 1e-12);
        expect(Math.abs(actual.tw - expected.tw)).toBeLessThanOrEqual(POINT_DEGREE_STEP / 2 + 1e-12);
        expect(actual.tick).toBe(expected.tick);
      }
    }
  });

  it('preserves playFrame 0 versus null', () => {
    const decoded = decodeScriptTimelineBinary(encodeScriptTimelineBinary(FIXTURE));
    expect(asStroke(decoded[0]).playFrame).toBe(0);
    expect(asStroke(decoded[5]).playFrame).toBeNull();
  });

  it('decodes an empty timeline from the 24-byte header', () => {
    const encoded = encodeScriptTimelineBinary([]);
    expect(encoded.byteLength).toBe(24);
    expect(decodeScriptTimelineBinary(encoded)).toEqual([]);
  });

  it('is byte-deterministic and reports real encoded sizes', () => {
    const firstBinary = encodeScriptTimelineBinary(FIXTURE);
    const secondBinary = encodeScriptTimelineBinary(FIXTURE);
    expect(firstBinary).toEqual(secondBinary);

    const json = encodeScriptTimelineJson(FIXTURE);
    const binary = encodeScriptTimelineBinary(FIXTURE);

    expect(json.byteLength).toBe(JSON_BYTE_LENGTH);
    expect(binary.byteLength).toBe(BINARY_BYTE_LENGTH);
    expect(binary.byteLength).toBeLessThan(json.byteLength);
    expect(Number((json.byteLength / binary.byteLength).toFixed(2))).toBe(MEASURED_RATIO);
  });

  it('clamps out-of-range point fields on decode (documented lossy policy)', () => {
    const wild: AquarellePayloadEvent = {
      ...minimalStroke(),
      pts: [{ x: 1.5, y: -0.5, p: 2, tx: 900, ty: -900, tw: 655.5, tick: 3 }],
    };
    const [decoded] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([wild]));
    const point = asStroke(decoded).pts[0];

    expect(point.x).toBe(1);
    expect(point.y).toBe(0);
    expect(point.p).toBe(1);
    expect(point.tx).toBeCloseTo(655.34, 6);
    expect(point.ty).toBeCloseTo(-655.34, 6);
    expect(point.tw).toBeCloseTo(655.34, 6);
    expect(point.tick).toBe(3);
  });

  it('keeps the live no-pressure sentinel -1 across the wire (261027 UAT round 10)', () => {
    // The live mouse path records p = -1 and the engine derives pressure from
    // speed. Clamping it to 0 on save made every post-restore re-bake paint at
    // minimum pressure — the Move/Apply "lost stroke properties" thinning.
    const stroke = minimalStroke();
    const mixed: AquarellePayloadEvent = {
      ...stroke,
      pts: [
        { x: 0.5, y: 0.5, p: -1, tx: 0, ty: 0, tw: 0, tick: 0 },
        { x: 0.5, y: 0.6, p: 0.6, tx: 0, ty: 0, tw: 0, tick: 1 },
      ],
    };
    const [decoded] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([mixed]));
    const points = asStroke(decoded).pts;
    expect(points[0]!.p).toBe(-1);
    expect(points[1]!.p).toBeCloseTo(0.6, 4);
  });
});

// ---------------------------------------------------------------------------
// 61-05 — the vector fields in AQTL v2
// ---------------------------------------------------------------------------

describe('AQTL v2 vector payload (61-05)', () => {
  it('round-trips a two-anchor vector stroke deep-equal, order preserved', () => {
    const original = vectorStroke();
    const [decoded] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([original]));

    // Whole-stroke deep equality, not a field spot-check: metadata, points and
    // the engine block all survive, anchors included.
    expect(decoded).toEqual(original);

    const anchors = asStroke(decoded).engine.anchors!;
    expect(anchors.map((anchor) => anchor.kind)).toEqual(['auto', 'bezier']);

    // Sparse width: exactly the one authored factor, at the first anchor.
    const widths = anchors.filter((anchor) => anchor.width !== undefined);
    expect(widths).toHaveLength(1);
    expect(anchors[0]!.width).toBe(VECTOR_WIDTH_1_8);
    expect(Math.abs(anchors[0]!.width! - 1.8)).toBeLessThan(1e-6);

    // Both anchor kinds survive with their exact shape: an auto anchor stores
    // no handle keys, a bezier anchor round-trips its stored pair.
    expect(Object.keys(anchors[0]!).sort()).toEqual(['kind', 'width', 'x', 'y']);
    expect(anchors[1]!.in).toEqual({ x: 0.5, y: 0.5 });
    expect(anchors[1]!.out).toEqual({ x: 1, y: 0 });
  });

  it('skips the legacy optional byte and decodes the same stroke', () => {
    // Files written while the removed render mode existed carry flag bit 1 and
    // one byte after the anchors. The decoder must read and ignore it.
    const plain = encodeScriptTimelineBinary([vectorStroke()]);
    const LEGACY_FLAG_OFFSET = VECTOR_ANCHOR_COUNT_OFFSET - 1;
    const POINT_COUNT_OFFSET = VECTOR_ANCHOR_COUNT_OFFSET + 43;
    const legacy = new Uint8Array(plain.byteLength + 1);
    legacy.set(plain.subarray(0, POINT_COUNT_OFFSET), 0);
    legacy[POINT_COUNT_OFFSET] = 0; // legacy mode byte
    legacy.set(plain.subarray(POINT_COUNT_OFFSET), POINT_COUNT_OFFSET + 1);
    const view = new DataView(legacy.buffer);
    view.setUint8(LEGACY_FLAG_OFFSET, view.getUint8(LEGACY_FLAG_OFFSET) | 0x02);
    view.setUint32(16, legacy.byteLength - 24, true);

    const [decoded] = decodeScriptTimelineBinary(legacy);
    expect(decoded).toEqual(decodeScriptTimelineBinary(plain)[0]);
  });

  it('costs a hand-painted stroke one vector-flags byte', () => {
    // The version field keeps its u16 width, so bumping it costs nothing: the
    // ONLY structural addition for a hand-painted stroke is the single u8
    // vector-flags byte.
    const V1_MINIMAL_BYTE_LENGTH = 93;
    const handPainted = minimalStroke();
    expect(encodeScriptTimelineBinary([handPainted]).byteLength).toBe(
      V1_MINIMAL_BYTE_LENGTH + 1,
    );
  });

  it('decodes the same bytes twice to deep-equal objects (idempotence)', () => {
    const bytes = encodeScriptTimelineBinary([vectorStroke()]);
    const first = decodeScriptTimelineBinary(bytes);
    const second = decodeScriptTimelineBinary(bytes);
    expect(second).toEqual(first);
    expect(decodeScriptTimelineBinary(bytes.slice())).toEqual(first);
  });

  it('fails closed when the stream is cut inside the anchor block', () => {
    const bytes = encodeScriptTimelineBinary([vectorStroke()]);
    // Cut inside the second anchor's handle block. The header is patched to the
    // new body length, so this is a genuine anchor-block truncation and not a
    // header length mismatch.
    const cut = bytes.slice(0, 100);
    new DataView(cut.buffer, cut.byteOffset, cut.byteLength).setUint32(
      16,
      cut.byteLength - 24,
      true,
    );
    expect(expectedCode(() => decodeScriptTimelineBinary(cut))).toBe('truncated');
  });

  it('rejects a hostile anchor count before reading any anchor', () => {
    const bytes = encodeScriptTimelineBinary([vectorStroke()]);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(
      VECTOR_ANCHOR_COUNT_OFFSET,
      0xffff,
      true,
    );
    expect(expectedCode(() => decodeScriptTimelineBinary(bytes))).toBe('invalid-count');
  });
});

// ---------------------------------------------------------------------------
// 61-30 — curve mode in AQTL v2 (G-20)
//
//  A new flag bit and a code byte written LAST in the vector block. A body
//  written without a mode keeps today's exact bytes: no flag bit, no byte.
// ---------------------------------------------------------------------------

describe('AQTL v2 curve mode (61-30 G-20)', () => {
  it("round-trips curveMode 'spline' and leaves an absent mode absent", () => {
    const withMode = handPaintedWithCurveMode('spline');
    const [decoded] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([withMode]));
    expect(asStroke(decoded).engine.curveMode).toBe('spline');
    expect(decoded).toEqual(withMode);

    const [without] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([minimalStroke()]));
    expect('curveMode' in asStroke(without).engine).toBe(false);
  });

  it('costs exactly one byte for a curve mode and nothing when absent', () => {
    const absent = encodeScriptTimelineBinary([minimalStroke()]);
    const spline = encodeScriptTimelineBinary([handPaintedWithCurveMode('spline')]);
    expect(spline.byteLength).toBe(absent.byteLength + 1);
  });

  it('refuses an unmapped curve-mode code (fail closed, never defaults)', () => {
    const bytes = encodeScriptTimelineBinary([handPaintedWithCurveMode('spline')]);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint8(
      MINIMAL_CURVE_MODE_OFFSET,
      7,
    );
    expect(expectedCode(() => decodeScriptTimelineBinary(bytes))).toBe('invalid-value');
  });
});

// ---------------------------------------------------------------------------
// 261111-wd6 — the per-vertex colour block in AQTL v2.
//
//  A new vector flag bit (1 << 3) and, per anchor, a presence byte plus the
//  verbatim colour string written LAST inside that anchor (after the width).
//  A path with no anchor colour never sets the bit and never writes a block
//  byte, so every pre-existing byte stays put. The reader validates the
//  presence marker and the u16 length before reading, exactly like every
//  other string on this wire.
// ---------------------------------------------------------------------------

describe('AQTL v2 per-vertex colour (261111-wd6)', () => {
  // Same prefix as every one-stroke fixture: the vector-flags byte sits just
  // before the anchor count.
  const VECTOR_FLAG_OFFSET = 73;
  const VECTOR_FLAG_ANCHOR_COLOR = 1 << 3;

  /** Two `auto` anchors, no widths, no handles; the first may carry a colour. */
  function coloredVectorStroke(color?: string): StudioStroke<AquarelleStrokePayload> {
    const base = minimalStroke();
    return {
      ...base,
      engine: {
        ...base.engine,
        anchors: [
          { x: 0.25, y: 0.5, kind: 'auto', ...(color === undefined ? {} : { color }) },
          { x: 0.75, y: 0.125, kind: 'auto' },
        ],
      },
    };
  }

  it('leaves an anchor-colourless path byte-identical (bit 3 clear)', () => {
    const plain = encodeScriptTimelineBinary([minimalStroke()]);
    expect(plain.byteLength).toBe(94);
    expect(plain[VECTOR_FLAG_OFFSET]).toBe(0);

    const colourless = encodeScriptTimelineBinary([coloredVectorStroke()]);
    expect(colourless[VECTOR_FLAG_OFFSET] & VECTOR_FLAG_ANCHOR_COLOR).toBe(0);
    // Every anchor pays exactly one presence byte; nothing else grows.
    expect(colourless.byteLength).toBe(120);
  });

  it('costs one presence byte per anchor plus 1 + 2 + UTF-8 bytes for a colour', () => {
    const colourless = encodeScriptTimelineBinary([coloredVectorStroke()]);
    const coloured = encodeScriptTimelineBinary([coloredVectorStroke('#ff0000')]);
    // presence marker + u16 length + 7 UTF-8 bytes for `#ff0000`.
    expect(coloured.byteLength).toBe(colourless.byteLength + 1 + 2 + 7);

    const short = encodeScriptTimelineBinary([coloredVectorStroke('#0f0')]);
    expect(short.byteLength).toBe(colourless.byteLength + 1 + 2 + 4);

    expect(coloured[VECTOR_FLAG_OFFSET] & VECTOR_FLAG_ANCHOR_COLOR).not.toBe(0);
  });

  it('round-trips the colour verbatim and materialises no key on a colourless anchor', () => {
    const stroke = coloredVectorStroke('#ff0000');
    const [decoded] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([stroke]));
    expect(decoded).toEqual(stroke);
    const anchors = asStroke(decoded).engine.anchors!;
    expect(anchors[0]!.color).toBe('#ff0000');
    expect('color' in anchors[1]!).toBe(false);

    // The wire is verbatim: this layer never canonicalises a colour.
    const upper = coloredVectorStroke('#FF0000');
    const [upperDecoded] = decodeScriptTimelineBinary(encodeScriptTimelineBinary([upper]));
    expect(asStroke(upperDecoded).engine.anchors![0]!.color).toBe('#FF0000');
  });

  it('is byte-identical when a decoded coloured stroke is re-encoded', () => {
    const first = encodeScriptTimelineBinary([coloredVectorStroke('#103c65')]);
    const decoded = decodeScriptTimelineBinary(first);
    expect(encodeScriptTimelineBinary(decoded)).toEqual(first);
  });

  it('fails closed when the stream is cut inside the colour string', () => {
    const bytes = encodeScriptTimelineBinary([coloredVectorStroke('#ff0000')]);
    // Single anchor from 76: x/y/kind/handleFlags/widthPresence (11 bytes),
    // then colour presence (87), u16 length (88), UTF-8 (90..96).
    // Cutting at 94 leaves 4 of the 7 string bytes.
    const cut = bytes.slice(0, 94);
    new DataView(cut.buffer, cut.byteOffset, cut.byteLength).setUint32(
      16,
      cut.byteLength - 24,
      true,
    );
    expect(expectedCode(() => decodeScriptTimelineBinary(cut))).toBe('truncated');
  });

  it('refuses a colour presence marker that is not 0 or 1', () => {
    const bytes = encodeScriptTimelineBinary([coloredVectorStroke('#ff0000')]);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint8(87, 2);
    expect(expectedCode(() => decodeScriptTimelineBinary(bytes))).toBe('invalid-value');
  });

  it('refuses a non-string anchor colour at encode (fail closed)', () => {
    const stroke = coloredVectorStroke();
    (asStroke(stroke).engine.anchors![0] as unknown as { color?: unknown }).color = 42;
    expect(expectedCode(() => encodeScriptTimelineBinary([stroke]))).toBe('invalid-value');
  });

  it('still refuses an unknown vector flag bit', () => {
    const bytes = encodeScriptTimelineBinary([coloredVectorStroke()]);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint8(
      VECTOR_FLAG_OFFSET,
      VECTOR_FLAG_ANCHOR_COLOR | 0x10,
    );
    expect(expectedCode(() => decodeScriptTimelineBinary(bytes))).toBe('invalid-value');
  });
});

// ---------------------------------------------------------------------------
// 61-05 task 3 — the codec-level determinism the reopen path relies on.
// ---------------------------------------------------------------------------

describe('AQTL v2 encode/decode fixed point (61-05)', () => {
  it('is byte-identical when a decoded vector stroke is re-encoded', () => {
    const stroke = vectorStroke();
    const first = encodeScriptTimelineBinary([stroke]);
    const decoded = decodeScriptTimelineBinary(first);

    const second = encodeScriptTimelineBinary(decoded);
    expect(second).toEqual(first);
    expect(decodeScriptTimelineBinary(second)).toEqual(decoded);
  });

  it('leaves no width residue on a uniform path', () => {
    const first = encodeScriptTimelineBinary([uniformVectorStroke()]);
    const decoded = decodeScriptTimelineBinary(first);

    // The decoder must not materialise a default `width` key the encoder
    // would then have to write — that residue would grow every reopen.
    const anchors = asStroke(decoded[0]!).engine.anchors!;
    expect(anchors.every((anchor) => !('width' in anchor))).toBe(true);

    const second = encodeScriptTimelineBinary(decoded);
    expect(second.byteLength).toBe(first.byteLength);
    expect(second).toEqual(first);
  });

  it('is byte-stable across three passes and decodes idempotently', () => {
    const first = encodeScriptTimelineBinary([vectorStroke()]);
    let bytes = first;
    for (let pass = 0; pass < 3; pass += 1) {
      bytes = encodeScriptTimelineBinary(decodeScriptTimelineBinary(bytes));
      expect(bytes).toEqual(first);
    }
    expect(decodeScriptTimelineBinary(first)).toEqual(decodeScriptTimelineBinary(first));
  });
});

// ---------------------------------------------------------------------------
// Fail-closed decode / encode
// ---------------------------------------------------------------------------

describe('AQTL fail-closed validation', () => {
  it('pins the minimal one-stroke layout used by the corrupt-byte helpers', () => {
    // v1 measured 93 bytes; v2 adds the one vector-flags byte (the version
    // field keeps its u16 width, so its bump costs nothing).
    expect(MINIMAL_BYTES.byteLength).toBe(94);
    expect(decodeScriptTimelineBinary(MINIMAL_BYTES)).toEqual(MINIMAL_EVENTS);
  });

  it('validates the header before allocating', () => {
    const badMagic = corruptMinimal((bytes) => {
      bytes[0] = 0x00;
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(badMagic))).toBe('magic-mismatch');

    // 61-05: version 1 is refused outright — there is no upgrade path and no
    // v1 reader left behind (project law: no backward compatibility).
    const badVersion = corruptMinimal((_bytes, view) => {
      view.setUint16(4, 1, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(badVersion))).toBe('unsupported-version');

    expect(expectedCode(() => decodeScriptTimelineBinary(MINIMAL_BYTES.slice(0, 12)))).toBe('truncated');

    const badBodyLength = corruptMinimal((_bytes, view) => {
      view.setUint32(16, view.getUint32(16, true) + 1, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(badBodyLength))).toBe('invalid-length');

    const tooManyEvents = corruptMinimal((_bytes, view) => {
      view.setUint32(8, 0xffffffff, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(tooManyEvents))).toBe('invalid-count');
  });

  it('rejects trailing bytes', () => {
    const withTrailing = new Uint8Array(MINIMAL_BYTES.byteLength + 1);
    withTrailing.set(MINIMAL_BYTES);
    expect(expectedCode(() => decodeScriptTimelineBinary(withTrailing))).toBe('trailing-bytes');
  });

  it('fails closed on truncated strings', () => {
    const truncatedString = corruptMinimal((_bytes, view) => {
      view.setUint16(MINIMAL_BRUSH_ID_LENGTH_OFFSET, 0xffff, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(truncatedString))).toBe('truncated');
  });

  it('rejects a point count that cannot fit before reading points', () => {
    const tooManyPoints = corruptMinimal((_bytes, view) => {
      view.setUint32(MINIMAL_POINT_COUNT_OFFSET, 2, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(tooManyPoints))).toBe('invalid-count');
  });

  it('rejects a totalPointCount that disagrees with the event bodies', () => {
    const mismatched = corruptMinimal((_bytes, view) => {
      view.setUint32(12, 0, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(mismatched))).toBe('invalid-count');
  });

  it('rejects unknown tags and non-finite metadata', () => {
    const unknownKind = corruptMinimal((bytes) => {
      bytes[24] = 9;
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(unknownKind))).toBe('invalid-tag');

    const unknownTool = corruptMinimal((bytes) => {
      bytes[MINIMAL_TOOL_OFFSET] = 9;
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(unknownTool))).toBe('invalid-tag');

    const nonFinite = corruptMinimal((_bytes, view) => {
      view.setFloat64(MINIMAL_RECORDED_ORDER_OFFSET, Number.NaN, true);
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(nonFinite))).toBe('invalid-value');
  });

  it('refuses unsupported motion, unknown tools, and bad override entries on encode', () => {
    const withMotion: AquarellePayloadEvent = {
      ...minimalStroke(),
      motion: { strokeDeformation: 10, strokePosition: 5 },
    };
    expect(expectedCode(() => encodeScriptTimelineBinary([withMotion]))).toBe('unsupported-motion');

    const unknownTool = minimalStroke();
    (unknownTool.engine as unknown as { tool: string }).tool = 'crayon';
    expect(expectedCode(() => encodeScriptTimelineBinary([unknownTool]))).toBe('invalid-tag');

    const unknownOverride = {
      ...minimalStroke(),
      toolOverrides: { bogus: 1 },
    } as unknown as StudioStroke<AquarelleStrokePayload>;
    expect(expectedCode(() => encodeScriptTimelineBinary([unknownOverride]))).toBe('invalid-tag');

    const nonNumericOverride = {
      ...minimalStroke(),
      toolOverrides: { tip: 'x' },
    } as unknown as StudioStroke<AquarelleStrokePayload>;
    expect(expectedCode(() => encodeScriptTimelineBinary([nonNumericOverride]))).toBe('invalid-value');
  });

  it('refuses non-finite numeric state and oversized strings on encode', () => {
    const nonFiniteOrder = { ...minimalStroke(), recordedOrder: Number.POSITIVE_INFINITY };
    expect(expectedCode(() => encodeScriptTimelineBinary([nonFiniteOrder]))).toBe('invalid-value');

    const nonFinitePoint = {
      ...minimalStroke(),
      pts: [{ x: Number.NaN, y: 0, p: 0, tx: 0, ty: 0, tw: 0, tick: 0 }],
    };
    expect(expectedCode(() => encodeScriptTimelineBinary([nonFinitePoint]))).toBe('invalid-value');

    const longBrush = { ...minimalStroke(), brushId: 'x'.repeat(70000) };
    expect(expectedCode(() => encodeScriptTimelineBinary([longBrush]))).toBe('invalid-string');
  });
});
