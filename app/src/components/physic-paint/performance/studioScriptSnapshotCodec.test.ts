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

  it('round-trips the v2 rail-cleanup marker', () => {
    const notDone = encodeStudioScriptSnapshot({ ...IDENTITY, watercolorEvents: fixtureEvents() });
    expect(decodeStudioScriptSnapshot(notDone, IDENTITY).railCleanupDone).toBe(false);
    const done = encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: fixtureEvents(),
      railCleanupDone: true,
    });
    expect(decodeStudioScriptSnapshot(done, IDENTITY).railCleanupDone).toBe(true);
  });

  it('rejects an unknown container version with the version code', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 4, 5), IDENTITY))).toBe(
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
    // Header is 9 bytes (v2: magic + version + flags + rail-cleanup marker)
    // plus three u16-prefixed identities; corrupt the AQTL magic that starts
    // the watercolor body.
    const identityByteLength = 2 * 3 + IDENTITY.projectId.length + IDENTITY.layerId.length + IDENTITY.trackId.length;
    const watercolorStart = 9 + identityByteLength + 4;
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
  // v2 adds the rail-cleanup marker byte after the flags word.
  const version = view.getUint16(4, true);
  let offset = version >= 2 ? 9 : 8;
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

/** v3 anchor body start (after the u32 anchor-section length). */
function anchorBodyOffset(container: Uint8Array): number {
  const brushStart = brushBodyOffset(container);
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const brushLength = view.getUint32(brushStart - 4, true);
  return brushStart + brushLength + 4;
}

/** Rewrite a v3+ container's anchor body (length word included), keeping any v4 tail. */
function replaceAnchorBody(container: Uint8Array, anchorBody: Uint8Array): Uint8Array {
  const offset = anchorBodyOffset(container);
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const oldLength = view.getUint32(offset - 4, true);
  const head = container.subarray(0, offset - 4);
  const tail = container.subarray(offset + oldLength);
  const out = new Uint8Array(head.byteLength + 4 + anchorBody.byteLength + tail.byteLength);
  out.set(head, 0);
  new DataView(out.buffer).setUint32(head.byteLength, anchorBody.byteLength, true);
  out.set(anchorBody, head.byteLength + 4);
  out.set(tail, head.byteLength + 4 + anchorBody.byteLength);
  return out;
}

/** The same snapshot with the anchor section removed and the header marked v2. */
function containerAsV2(container: Uint8Array): Uint8Array {
  const anchorLengthOffset = anchorBodyOffset(container) - 4;
  const out = container.slice(0, anchorLengthOffset);
  new DataView(out.buffer, out.byteOffset, out.byteLength).setUint16(4, 2, true);
  return out;
}

function anchorBody(entries: readonly { mutationId: number; keyId: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const records = entries.map((entry) => ({
    mutationId: entry.mutationId,
    keyId: encoder.encode(entry.keyId),
  }));
  const length = 8 + records.reduce((sum, entry) => sum + 4 + 2 + entry.keyId.byteLength, 0);
  const body = new Uint8Array(length);
  const view = new DataView(body.buffer);
  let offset = 0;
  view.setUint16(offset, 1, true); offset += 2; // anchor version
  view.setUint16(offset, 0, true); offset += 2; // reserved
  view.setUint32(offset, records.length, true); offset += 4;
  for (const record of records) {
    view.setUint32(offset, record.mutationId, true); offset += 4;
    view.setUint16(offset, record.keyId.byteLength, true); offset += 2;
    body.set(record.keyId, offset); offset += record.keyId.byteLength;
  }
  return body;
}

/** v4 durable-base body start (after the u32 durable-section length word). */
function durableBaseBodyOffset(container: Uint8Array): number {
  const anchorStart = anchorBodyOffset(container);
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const anchorLength = view.getUint32(anchorStart - 4, true);
  return anchorStart + anchorLength + 4;
}

/** Rewrite a v4 container's durable-base body (length word included). */
function replaceDurableBaseBody(container: Uint8Array, durableBody: Uint8Array): Uint8Array {
  const offset = durableBaseBodyOffset(container);
  const head = container.subarray(0, offset - 4);
  const out = new Uint8Array(head.byteLength + 4 + durableBody.byteLength);
  out.set(head, 0);
  new DataView(out.buffer).setUint32(head.byteLength, durableBody.byteLength, true);
  out.set(durableBody, head.byteLength + 4);
  return out;
}

/** The same v4 snapshot without the durable-base section, marked as a v3 file. */
function containerAsV3(container: Uint8Array): Uint8Array {
  const durableLengthOffset = durableBaseBodyOffset(container) - 4;
  const out = container.slice(0, durableLengthOffset);
  new DataView(out.buffer, out.byteOffset, out.byteLength).setUint16(4, 3, true);
  return out;
}

function durableBaseBody(
  entries: readonly { keyId: string; bytes: Uint8Array | null }[],
): Uint8Array {
  const encoder = new TextEncoder();
  const records = entries.map((entry) => ({
    keyId: encoder.encode(entry.keyId),
    bytes: entry.bytes,
  }));
  const length = 8 + records.reduce(
    (sum, record) =>
      sum + 1 + 2 + record.keyId.byteLength + (record.bytes ? 4 + record.bytes.byteLength : 0),
    0,
  );
  const body = new Uint8Array(length);
  const view = new DataView(body.buffer);
  let offset = 0;
  view.setUint16(offset, 1, true); offset += 2; // durable-base version
  view.setUint16(offset, 0, true); offset += 2; // reserved
  view.setUint32(offset, records.length, true); offset += 4;
  for (const record of records) {
    body[offset] = record.bytes ? 1 : 0; offset += 1;
    view.setUint16(offset, record.keyId.byteLength, true); offset += 2;
    body.set(record.keyId, offset); offset += record.keyId.byteLength;
    if (record.bytes) {
      view.setUint32(offset, record.bytes.byteLength, true); offset += 4;
      body.set(record.bytes, offset); offset += record.bytes.byteLength;
    }
  }
  return body;
}

function durableContainer(
  bases: readonly { keyId: string; bytes: Uint8Array | null }[],
): Uint8Array {
  return encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: fixtureEvents(),
    durableBases: bases,
  });
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

// ------------------------------------------------------------
//  261027 UAT round 2 — the v3 watercolor key-anchor section.
//  AQTL events carry no key identity, so SNAP v3 binds every
//  stroke mutationId to the physical KEY it was captured on.
//  Without it a deleted key's strokes re-seed into the key that
//  later arrives at the same frame number.
// ------------------------------------------------------------

describe('studioScriptSnapshotCodec — watercolor key anchors (261027)', () => {
  function anchoredContainer(
    anchors: readonly { mutationId: number; keyId: string }[],
  ): Uint8Array {
    return encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: fixtureEvents(),
      watercolorKeyAnchors: anchors,
    });
  }

  it('round-trips the anchors and stays byte-stable', () => {
    const anchors = [
      { mutationId: 101, keyId: 'key-101' },
      { mutationId: 202, keyId: 'key with spaces/é' },
    ];
    const bytes = anchoredContainer(anchors);
    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);

    expect(decoded.watercolorKeyAnchors).toEqual(anchors);
    expect(
      encodeStudioScriptSnapshot({
        ...IDENTITY,
        watercolorEvents: decoded.watercolorEvents,
        watercolorKeyAnchors: decoded.watercolorKeyAnchors,
      }),
    ).toEqual(bytes);
  });

  it('decodes a v2 container (no anchor section) as unanchored', () => {
    const decoded = decodeStudioScriptSnapshot(containerAsV2(anchoredContainer([
      { mutationId: 101, keyId: 'key-101' },
    ])), IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(2);
    expect(decoded.watercolorKeyAnchors).toEqual([]);
  });

  it('refuses two anchors for the same stroke', () => {
    const bytes = replaceAnchorBody(
      anchoredContainer([]),
      anchorBody([
        { mutationId: 7, keyId: 'key-a' },
        { mutationId: 7, keyId: 'key-b' },
      ]),
    );
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('anchor');
  });

  it('refuses an empty anchor key id', () => {
    const bytes = replaceAnchorBody(
      anchoredContainer([]),
      anchorBody([{ mutationId: 7, keyId: '' }]),
    );
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('anchor');
  });

  it('refuses an over-declared anchor count before allocating', () => {
    const body = anchorBody([]);
    new DataView(body.buffer, body.byteOffset, body.byteLength).setUint32(4, 0xffffff, true);
    expect(
      codeOf(() => decodeStudioScriptSnapshot(
        replaceAnchorBody(anchoredContainer([]), body),
        IDENTITY,
      )),
    ).toBe('count');
  });
});

// ------------------------------------------------------------
//  261027 UAT round 4 — the v4 durable-base section.
//
//  A scripted aquarelle key is a multiply composite over its
//  PRE-SCRIPT base. Move after a Studio reopen needs that base
//  again, but the key record holds the flattened composite, not
//  the base. SNAP v4 persists the per-key base (bytes = known
//  base, null = known-empty) so a restore can seed the launch map
//  without ever reconstructing it from the committed sheet.
// ------------------------------------------------------------

describe('studioScriptSnapshotCodec — durable bases (261027 UAT round 4)', () => {
  const BASE_BYTES = Uint8Array.of(1, 2, 3, 4);

  it('round-trips durable base bytes and known-empty entries, byte-stable', () => {
    const bytes = durableContainer([
      { keyId: 'key-b', bytes: BASE_BYTES },
      { keyId: 'key-a', bytes: null },
    ]);
    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
    // Sorted by keyId on write so the file is deterministic.
    expect(decoded.durableBases).toEqual([
      { keyId: 'key-a', bytes: null },
      { keyId: 'key-b', bytes: BASE_BYTES },
    ]);
    expect(
      encodeStudioScriptSnapshot({
        ...IDENTITY,
        watercolorEvents: decoded.watercolorEvents,
        durableBases: decoded.durableBases,
      }),
    ).toEqual(bytes);
  });

  it('sorts durable bases by key id regardless of input order', () => {
    const forward = durableContainer([
      { keyId: 'key-a', bytes: null },
      { keyId: 'key-b', bytes: BASE_BYTES },
    ]);
    const reversed = durableContainer([
      { keyId: 'key-b', bytes: BASE_BYTES },
      { keyId: 'key-a', bytes: null },
    ]);
    expect(reversed).toEqual(forward);
  });

  it('returns durable base bytes as copies, not views into the source buffer', () => {
    const container = durableContainer([{ keyId: 'key-a', bytes: BASE_BYTES }]);
    const decoded = decodeStudioScriptSnapshot(container, IDENTITY);
    container.fill(0, 40);
    expect(decoded.durableBases[0]!.bytes).toEqual(BASE_BYTES);
  });

  it('decodes a v3 container as carrying no durable bases', () => {
    const v4 = encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: fixtureEvents(),
      watercolorKeyAnchors: [{ mutationId: 101, keyId: 'key-101' }],
      durableBases: [{ keyId: 'key-a', bytes: BASE_BYTES }],
    });
    const decoded = decodeStudioScriptSnapshot(containerAsV3(v4), IDENTITY);
    expect(decoded.watercolorKeyAnchors).toEqual([{ mutationId: 101, keyId: 'key-101' }]);
    expect(decoded.durableBases).toEqual([]);
  });

  it('refuses two durable bases for the same key', () => {
    const bytes = replaceDurableBaseBody(
      durableContainer([]),
      durableBaseBody([
        { keyId: 'key-a', bytes: BASE_BYTES },
        { keyId: 'key-a', bytes: null },
      ]),
    );
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('durableBase');
  });

  it('refuses an empty durable-base key id', () => {
    const bytes = replaceDurableBaseBody(
      durableContainer([]),
      durableBaseBody([{ keyId: '', bytes: BASE_BYTES }]),
    );
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('durableBase');
  });

  it('refuses a durable base entry with zero bytes', () => {
    const bytes = replaceDurableBaseBody(
      durableContainer([]),
      durableBaseBody([{ keyId: 'key-a', bytes: new Uint8Array(0) }]),
    );
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('durableBase');
  });

  it('refuses an unknown durable-base state byte', () => {
    const body = durableBaseBody([{ keyId: 'key-a', bytes: null }]);
    body[8] = 2; // first record state (8-byte header)
    const bytes = replaceDurableBaseBody(durableContainer([]), body);
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('durableBase');
  });

  it('refuses an over-declared durable-base count before allocating', () => {
    const body = durableBaseBody([]);
    new DataView(body.buffer, body.byteOffset, body.byteLength).setUint32(4, 0xffffff, true);
    const bytes = replaceDurableBaseBody(durableContainer([]), body);
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('count');
  });

  it('refuses trailing bytes inside the durable-base section', () => {
    const body = durableBaseBody([{ keyId: 'key-a', bytes: null }]);
    const padded = new Uint8Array(body.byteLength + 1);
    padded.set(body);
    const bytes = replaceDurableBaseBody(durableContainer([]), padded);
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('trailing');
  });

  it('refuses a duplicate, empty or zero-byte entry at encode time', () => {
    expect(codeOf(() => encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: [],
      durableBases: [
        { keyId: 'key-a', bytes: null },
        { keyId: 'key-a', bytes: null },
      ],
    }))).toBe('durableBase');
    expect(codeOf(() => encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: [],
      durableBases: [{ keyId: '', bytes: null }],
    }))).toBe('durableBase');
    expect(codeOf(() => encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: [],
      durableBases: [{ keyId: 'key-a', bytes: new Uint8Array(0) }],
    }))).toBe('durableBase');
  });
});
