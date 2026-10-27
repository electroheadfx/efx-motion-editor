// ============================================================
//  scriptTimelineCodec.test.ts — RED-first suite for the
//  watercolor timeline codec prototype (quick 261023-f9c).
//
//  Two formats over the SAME in-memory timeline:
//    - JSON baseline: exact JSON.stringify / JSON.parse round-trip.
//    - AQTL v1 packed binary: versioned header, packed stroke
//      metadata, quantized point records (documented tolerances).
//  Every corrupt-input case must fail closed with a typed
//  ScriptTimelineCodecError — never a raw RangeError.
// ============================================================

import { describe, expect, it } from 'vitest';
import type {
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
const JSON_BYTE_LENGTH = 18068;
const BINARY_BYTE_LENGTH = 3737;
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
// can address exact fields. Header 24 bytes, then:
//   24 kind | 25 mutation presence | 26 play presence | 27 ticks | 31 cuisson
//   35 traceSeed | 39 recordedOrder(f64) | 47 brushId len | 49 brushId
//   50 color presence | 51 overrides mask | 52 engine tool
//   53 engine color presence | 54 engine brushId len | 56 engine brushId
//   57 params count | 61 engine overrides mask | 62 engine mutation presence
//   63 engine diffusion presence | 64 timestamp(f64) | 72 engine play presence
//   73 pointCount | 77 point record (16 bytes each)
// ---------------------------------------------------------------------------

const MINIMAL_RECORDED_ORDER_OFFSET = 39;
const MINIMAL_BRUSH_ID_LENGTH_OFFSET = 47;
const MINIMAL_TOOL_OFFSET = 52;
const MINIMAL_POINT_COUNT_OFFSET = 73;

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
    expect(SCRIPT_TIMELINE_BINARY_VERSION).toBe(1);
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
// Fail-closed decode / encode
// ---------------------------------------------------------------------------

describe('AQTL fail-closed validation', () => {
  it('pins the minimal one-stroke layout used by the corrupt-byte helpers', () => {
    expect(MINIMAL_BYTES.byteLength).toBe(93);
    expect(decodeScriptTimelineBinary(MINIMAL_BYTES)).toEqual(MINIMAL_EVENTS);
  });

  it('validates the header before allocating', () => {
    const badMagic = corruptMinimal((bytes) => {
      bytes[0] = 0x00;
    });
    expect(expectedCode(() => decodeScriptTimelineBinary(badMagic))).toBe('magic-mismatch');

    const badVersion = corruptMinimal((_bytes, view) => {
      view.setUint16(4, 2, true);
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
