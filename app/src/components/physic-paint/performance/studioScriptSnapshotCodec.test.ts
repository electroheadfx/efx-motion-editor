// ============================================================
//  studioScriptSnapshotCodec.test.ts — RED-first suite for the
//  SNAP v1 container (quick 261023-l35).
//
//  The container carries the AQTL watercolor timeline plus the
//  versioned brush section under one project/layer/track key.
//  Every corrupt-input case must fail closed with a typed
//  StudioScriptSnapshotCodecError — never a raw RangeError.
// ============================================================

import { describe, expect, it } from 'vitest';
import type {
  AquarelleDryEvent,
  AquarellePayloadEvent,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import type { PaintRenderSettings, PaintStroke } from '@efxlab/efx-physic-paint';
import {
  STUDIO_SCRIPT_SNAPSHOT_MAGIC,
  STUDIO_SCRIPT_SNAPSHOT_VERSION,
  StudioScriptSnapshotCodecError,
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotBrushFrame,
  type StudioScriptSnapshotIdentity,
} from './studioScriptSnapshotCodec';

const IDENTITY: StudioScriptSnapshotIdentity = {
  projectId: 'project-1',
  layerId: 'layer-1',
  trackId: 'track-1',
};

function fixturePoint(index: number): StudioPoint {
  return {
    x: 0.1 + index * 0.05,
    y: 0.2 + index * 0.04,
    p: 0.25 + index * 0.1,
    tx: -10 + index,
    ty: 5 - index,
    tw: index * 2,
    tick: index,
  };
}

const FIXTURE_OVERRIDES = {
  tip: 1.2,
  aspect: 1,
  rotation: 0,
  sizeCurve: 1,
  scatter: 0.5,
  capacity: 1,
  grain: 0.5,
  wetRound: 1,
} as const;

function fixtureStroke(): StudioStroke<AquarelleStrokePayload> {
  return {
    pts: [fixturePoint(0), fixturePoint(1), fixturePoint(2)],
    ticks: 2,
    cuisson: 4,
    motion: null,
    brushId: 'round-soft',
    toolOverrides: FIXTURE_OVERRIDES,
    traceSeed: 4242,
    recordedOrder: 1.5,
    playFrame: 7,
    color: '#112233',
    engine: {
      tool: 'brush',
      color: '#112233',
      params: { size: 12, water: 50 },
      brushId: 'round-soft',
      toolOverrides: FIXTURE_OVERRIDES,
      mutationId: 101,
      diffusionFrames: 4,
      timestamp: 1.5,
      playFrame: 7,
    },
  };
}

function fixtureDry(): AquarelleDryEvent {
  return { kind: 'dry', tick: 9, recordedOrder: 2.5 };
}

function fixtureEvents(): AquarellePayloadEvent[] {
  return [fixtureStroke(), fixtureDry()];
}

function encodeFixture(
  overrides: Partial<{ identity: StudioScriptSnapshotIdentity; events: AquarellePayloadEvent[] }> = {},
): Uint8Array {
  const identity = overrides.identity ?? IDENTITY;
  return encodeStudioScriptSnapshot({
    ...identity,
    watercolorEvents: overrides.events ?? fixtureEvents(),
  });
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(StudioScriptSnapshotCodecError);
    return (error as StudioScriptSnapshotCodecError).code;
  }
  throw new Error('expected a StudioScriptSnapshotCodecError');
}

function withByte(bytes: Uint8Array, index: number, value: number): Uint8Array {
  const copy = bytes.slice();
  copy[index] = value;
  return copy;
}

describe('studioScriptSnapshotCodec', () => {
  it('round-trips a watercolor stroke and a Dry event by value', () => {
    const bytes = encodeFixture();
    // Magic + version live at the documented offsets.
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe(STUDIO_SCRIPT_SNAPSHOT_MAGIC);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint16(4, true)).toBe(
      STUDIO_SCRIPT_SNAPSHOT_VERSION,
    );

    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(2);
    expect(decoded.brushFrames).toEqual([]);

    const stroke = decoded.watercolorEvents[0] as StudioStroke<AquarelleStrokePayload>;
    const dry = decoded.watercolorEvents[1] as AquarelleDryEvent;
    expect(stroke.brushId).toBe('round-soft');
    expect(stroke.toolOverrides).toEqual(FIXTURE_OVERRIDES);
    expect(stroke.engine.toolOverrides).toEqual(FIXTURE_OVERRIDES);
    expect(stroke.playFrame).toBe(7);
    expect(stroke.color).toBe('#112233');
    expect(stroke.engine.tool).toBe('brush');
    expect(stroke.engine.params).toEqual({ size: 12, water: 50 });
    expect(stroke.engine.mutationId).toBe(101);
    expect(stroke.engine.diffusionFrames).toBe(4);
    expect(stroke.cuisson).toBe(4);
    expect(dry).toEqual(fixtureDry());

    // Re-encoding the decoded timeline is byte-stable — the whole container.
    expect(
      encodeStudioScriptSnapshot({ ...IDENTITY, watercolorEvents: decoded.watercolorEvents }),
    ).toEqual(bytes);
  });

  it('rejects a magic mismatch with the magic code', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 0, 0x58), IDENTITY))).toBe(
      'magic',
    );
  });

  it('rejects version 2 with the version code', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 4, 2), IDENTITY))).toBe(
      'version',
    );
  });

  it('rejects a non-zero flags word', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 6, 1), IDENTITY))).toBe(
      'flags',
    );
  });

  it('rejects an identity mismatch on any of project, layer or track', () => {
    const bytes = encodeFixture();
    for (const identity of [
      { ...IDENTITY, projectId: 'project-2' },
      { ...IDENTITY, layerId: 'layer-2' },
      { ...IDENTITY, trackId: 'track-2' },
    ]) {
      expect(codeOf(() => decodeStudioScriptSnapshot(bytes, identity))).toBe('identity');
    }
  });

  it('rejects a buffer shorter than the container header as truncated', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(encodeFixture().subarray(0, 4), IDENTITY))).toBe(
      'truncated',
    );
  });

  it('rejects a section that claims more bytes than remain', () => {
    const bytes = encodeFixture();
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes.subarray(0, bytes.byteLength - 5), IDENTITY))).toBe(
      'length',
    );
  });

  it('rejects trailing bytes after the declared sections', () => {
    const bytes = encodeFixture();
    const padded = new Uint8Array(bytes.byteLength + 1);
    padded.set(bytes);
    expect(codeOf(() => decodeStudioScriptSnapshot(padded, IDENTITY))).toBe('trailing');
  });

  it('tags a corrupt watercolor section instead of leaking a raw RangeError', () => {
    const bytes = encodeFixture();
    // Header is 8 bytes + three u16-prefixed identities; corrupt the AQTL
    // magic that starts the watercolor body.
    const identityByteLength = 2 * 3 + IDENTITY.projectId.length + IDENTITY.layerId.length + IDENTITY.trackId.length;
    const watercolorStart = 8 + identityByteLength + 4;
    const corrupted = withByte(bytes, watercolorStart, 0x00);
    expect(codeOf(() => decodeStudioScriptSnapshot(corrupted, IDENTITY))).toBe('watercolor');
  });
});

// ------------------------------------------------------------
//  quick-261023-l35 Task 2 — the brush section.
//  Points are PIXEL coordinates: f32, never clamped to [0,1].
// ------------------------------------------------------------

function brushStroke(overrides: Partial<PaintStroke> = {}): PaintStroke {
  return {
    tool: 'paint',
    points: [
      { x: 812.125, y: 431.5, p: 0.625, tx: -4.5, ty: 3.25, tw: 1.5, spd: 0.375 },
      { x: 900.75, y: 512.375, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.5 },
    ],
    color: '#336699',
    params: {
      size: 12.5,
      opacity: 80,
      pressure: 55,
      waterAmount: 40,
      dryAmount: 30,
      edgeDetail: 20,
      pickup: 10,
      eraseStrength: 100,
      antiAlias: 1,
    },
    timestamp: 1729590000000.125,
    mutationId: 41,
    playFrame: 12,
    hasPenInput: true,
    ...overrides,
  };
}

function brushContinuation(mutationId: number, diffusionFrames = 3): PaintStroke {
  return {
    tool: 'paint',
    points: [],
    color: '#336699',
    params: {
      size: 12.5,
      opacity: 80,
      pressure: 55,
      waterAmount: 40,
      dryAmount: 30,
      edgeDetail: 20,
      pickup: 10,
      eraseStrength: 100,
      antiAlias: 1,
    },
    timestamp: 1729590000001.5,
    mutationId,
    diffusionFrames,
  };
}

const BRUSH_SETTINGS: PaintRenderSettings = {
  localSpreadStrength: 62,
  wetPaper: true,
  physicsStrength: 0.75,
  paperGrain: 'paper/rough-1',
};

function brushFramesFixture(): StudioScriptSnapshotBrushFrame[] {
  return [
    {
      frame: 12,
      complete: false,
      paintSettings: BRUSH_SETTINGS,
      keyId: 'key-12',
      groups: [
        {
          primary: brushStroke(),
          continuations: [brushContinuation(42, 3), brushContinuation(43, 7)],
        },
        { primary: brushStroke({ mutationId: 44, timestamp: 1729590000002 }), continuations: [] },
      ],
    },
  ];
}

function brushContainer(frames: readonly StudioScriptSnapshotBrushFrame[]): Uint8Array {
  return encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: fixtureEvents(),
    brushFrames: frames,
  });
}

function brushBodyOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  for (let index = 0; index < 3; index += 1) {
    const length = view.getUint16(offset, true);
    offset += 2 + length;
  }
  const watercolorLength = view.getUint32(offset, true);
  offset += 4 + watercolorLength;
  offset += 4; // the brush section length itself
  return offset;
}

function replaceBrushBody(container: Uint8Array, brushBody: Uint8Array): Uint8Array {
  const offset = brushBodyOffset(container);
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const oldLength = view.getUint32(offset - 4, true);
  const head = container.subarray(0, offset - 4);
  const tail = container.subarray(offset + oldLength);
  const out = new Uint8Array(head.byteLength + 4 + brushBody.byteLength + tail.byteLength);
  out.set(head, 0);
  new DataView(out.buffer).setUint32(head.byteLength, brushBody.byteLength, true);
  out.set(brushBody, head.byteLength + 4);
  out.set(tail, head.byteLength + 4 + brushBody.byteLength);
  return out;
}

/** A brush body whose single stroke declares an impossible point count. */
function brushBodyWithOversizedPointCount(): Uint8Array {
  const body = new Uint8Array(4 + 4 + 4 + 3 + 4 + 4 + 4);
  const view = new DataView(body.buffer);
  let offset = 0;
  view.setUint16(offset, 1, true); offset += 2; // version
  view.setUint16(offset, 0, true); offset += 2; // reserved
  view.setUint32(offset, 1, true); offset += 4; // frameCount
  view.setUint32(offset, 7, true); offset += 4; // frame
  body[offset] = 0; offset += 1; // flags
  body[offset] = 0; offset += 1; // reserved
  body[offset] = 0; offset += 1; // paintSettingsPresent
  view.setUint32(offset, 1, true); offset += 4; // groupCount
  view.setUint32(offset, 0, true); offset += 4; // continuationCount
  view.setUint32(offset, 0xffffff, true); // pointCount
  return body;
}

describe('studioScriptSnapshotCodec — brush section', () => {
  it('round-trips frames, groups, continuations and sticky settings by value', () => {
    const frames = brushFramesFixture();
    const bytes = brushContainer(frames);
    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);

    expect(decoded.watercolorEvents).toHaveLength(2);
    expect(decoded.brushFrames).toEqual(frames);
    // Pixel coordinates survive verbatim — never normalized into [0,1].
    const primary = decoded.brushFrames[0]!.groups[0]!.primary;
    expect(primary.points[0]!.x).toBe(812.125);
    expect(primary.points[0]!.y).toBe(431.5);
    expect(primary.points[1]!.x).toBe(900.75);
    expect(decoded.brushFrames[0]!.complete).toBe(false);
    expect(decoded.brushFrames[0]!.paintSettings).toEqual(BRUSH_SETTINGS);
    // v2: the owning key identity survives the crossing.
    expect(decoded.brushFrames[0]!.keyId).toBe('key-12');

    // The whole container is byte-stable through a decode/encode cycle.
    expect(
      encodeStudioScriptSnapshot({
        ...IDENTITY,
        watercolorEvents: decoded.watercolorEvents,
        brushFrames: decoded.brushFrames,
      }),
    ).toEqual(bytes);
  });

  it('still decodes a v1 brush body (no keyId byte) as unknown identity', () => {
    const body = new Uint8Array(2 + 2 + 4 + 4 + 1 + 1 + 1 + 4);
    const view = new DataView(body.buffer);
    let offset = 0;
    view.setUint16(offset, 1, true); offset += 2; // v1 section
    view.setUint16(offset, 0, true); offset += 2; // reserved
    view.setUint32(offset, 1, true); offset += 4; // frameCount
    view.setUint32(offset, 7, true); offset += 4; // frame
    body[offset] = 1; offset += 1; // complete
    body[offset] = 0; offset += 1; // reserved (v1 has no keyId byte)
    body[offset] = 0; offset += 1; // paint settings absent
    view.setUint32(offset, 0, true); // groupCount
    const decoded = decodeStudioScriptSnapshot(
      replaceBrushBody(brushContainer([]), body),
      IDENTITY,
    );
    expect(decoded.brushFrames).toEqual([
      { frame: 7, complete: true, paintSettings: null, groups: [] },
    ]);
    expect(decoded.brushFrames[0]!.keyId).toBeUndefined();
  });

  it('refuses an over-declared frame count before allocating', () => {
    const bytes = brushContainer(brushFramesFixture());
    const body = bytes.slice(brushBodyOffset(bytes));
    new DataView(body.buffer, body.byteOffset, body.byteLength).setUint32(4, 0xffffff, true);
    expect(codeOf(() => decodeStudioScriptSnapshot(replaceBrushBody(bytes, body), IDENTITY))).toBe(
      'count',
    );
  });

  it('refuses an oversized point count with the count code', () => {
    const bytes = replaceBrushBody(brushContainer([]), brushBodyWithOversizedPointCount());
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('count');
  });

  it('refuses unknown frame flags with the flags code', () => {
    const bytes = brushContainer(brushFramesFixture());
    const body = bytes.slice(brushBodyOffset(bytes));
    // Header (8) + frame u32 = 12; the flags byte follows.
    body[12] = 0b0000_0010;
    expect(codeOf(() => decodeStudioScriptSnapshot(replaceBrushBody(bytes, body), IDENTITY))).toBe(
      'flags',
    );
  });

  it('refuses a brush body shorter than its header', () => {
    const bytes = brushContainer(brushFramesFixture());
    const body = bytes.slice(brushBodyOffset(bytes), brushBodyOffset(bytes) + 6);
    expect(codeOf(() => decodeStudioScriptSnapshot(replaceBrushBody(bytes, body), IDENTITY))).toBe(
      'truncated',
    );
  });
});
