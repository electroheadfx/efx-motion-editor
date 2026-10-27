// ============================================================
//  studioScriptSnapshotCodec.test.ts — the SNAP v5 container
//  (quick 261023-l35; v5 = quick 261027-klx).
//
//  The container carries the AQTL watercolor timeline plus the
//  key-anchor and durable-base sections under one
//  project/layer/track key. v5 is the watercolor-only clean break:
//  retired versions 1-4 raise `snap-v4-retired` and seed nothing.
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
import {
  STUDIO_SCRIPT_SNAPSHOT_MAGIC,
  STUDIO_SCRIPT_SNAPSHOT_VERSION,
  StudioScriptSnapshotCodecError,
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotDecodeResult,
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

function errorOf(fn: () => unknown): StudioScriptSnapshotCodecError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(StudioScriptSnapshotCodecError);
    return error as StudioScriptSnapshotCodecError;
  }
  throw new Error('expected a StudioScriptSnapshotCodecError');
}

function withByte(bytes: Uint8Array, index: number, value: number): Uint8Array {
  const copy = bytes.slice();
  copy[index] = value;
  return copy;
}

/** Rewrite only the container version word — enough for a version gate. */
function asVersion(bytes: Uint8Array, version: number): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer, copy.byteOffset, copy.byteLength).setUint16(4, version, true);
  return copy;
}

/**
 * v5 layout offsets. Header: magic(4) + version(2) + flags(2) +
 * railCleanup(1) = 9, then three u16-prefixed identities.
 */
function sectionsOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 9;
  for (let index = 0; index < 3; index += 1) {
    const length = view.getUint16(offset, true);
    offset += 2 + length;
  }
  return offset;
}

/** Start of the anchor BODY (after its u32 length word). */
function anchorBodyOffset(container: Uint8Array): number {
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const offset = sectionsOffset(container);
  const watercolorLength = view.getUint32(offset, true);
  return offset + 4 + watercolorLength + 4;
}

/** Start of the durable-base BODY (after its u32 length word). */
function durableBaseBodyOffset(container: Uint8Array): number {
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const anchorLength = view.getUint32(anchorBodyOffset(container) - 4, true);
  return anchorBodyOffset(container) + anchorLength + 4;
}

function replaceSectionBody(container: Uint8Array, bodyOffset: number, body: Uint8Array): Uint8Array {
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const oldLength = view.getUint32(bodyOffset - 4, true);
  const head = container.subarray(0, bodyOffset - 4);
  const tail = container.subarray(bodyOffset + oldLength);
  const out = new Uint8Array(head.byteLength + 4 + body.byteLength + tail.byteLength);
  out.set(head, 0);
  new DataView(out.buffer).setUint32(head.byteLength, body.byteLength, true);
  out.set(body, head.byteLength + 4);
  out.set(tail, head.byteLength + 4 + body.byteLength);
  return out;
}

function replaceAnchorBody(container: Uint8Array, anchorBody: Uint8Array): Uint8Array {
  return replaceSectionBody(container, anchorBodyOffset(container), anchorBody);
}

function replaceDurableBaseBody(container: Uint8Array, durableBody: Uint8Array): Uint8Array {
  return replaceSectionBody(container, durableBaseBodyOffset(container), durableBody);
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

describe('studioScriptSnapshotCodec', () => {
  it('round-trips a watercolor stroke and a Dry event by value', () => {
    const bytes = encodeFixture();
    // Magic + version live at the documented offsets.
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe(STUDIO_SCRIPT_SNAPSHOT_MAGIC);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint16(4, true)).toBe(
      STUDIO_SCRIPT_SNAPSHOT_VERSION,
    );
    expect(STUDIO_SCRIPT_SNAPSHOT_VERSION).toBe(5);

    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(2);

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

  it('carries no brush body: the decoded result is exactly the watercolor container', () => {
    const decoded: StudioScriptSnapshotDecodeResult = decodeStudioScriptSnapshot(
      encodeFixture(),
      IDENTITY,
    );
    // The v1-v4 brush section is gone from the type AND the wire: a decode
    // can only ever produce these four members.
    expect(Object.keys(decoded).sort()).toEqual([
      'durableBases',
      'railCleanupDone',
      'watercolorEvents',
      'watercolorKeyAnchors',
    ]);
  });

  it('rejects a magic mismatch with the magic code', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 0, 0x58), IDENTITY))).toBe(
      'magic',
    );
  });

  it('round-trips the rail-cleanup marker', () => {
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
    expect(codeOf(() => decodeStudioScriptSnapshot(asVersion(encodeFixture(), 0), IDENTITY))).toBe(
      'version',
    );
    expect(codeOf(() => decodeStudioScriptSnapshot(asVersion(encodeFixture(), 6), IDENTITY))).toBe(
      'version',
    );
  });

  it('names the clean break for every retired container version (1-4)', () => {
    // The retired versions carried (or implied) a brush body. They must raise
    // the dedicated code — NOT the generic `version` code — so the controller
    // can show the pinned notice.
    const bytes = encodeFixture();
    for (const version of [1, 2, 3, 4] as const) {
      const error = errorOf(() => decodeStudioScriptSnapshot(asVersion(bytes, version), IDENTITY));
      expect(error.code, `version ${version}`).toBe('snap-v4-retired');
      expect(error.message).toBe('SNAP predates the watercolor-only format');
      expect(error.offset).toBe(4);
    }
  });

  it('rejects a non-zero flags word', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 6, 1), IDENTITY))).toBe(
      'flags',
    );
  });

  it('rejects a rail-cleanup byte outside 0/1', () => {
    expect(codeOf(() => decodeStudioScriptSnapshot(withByte(encodeFixture(), 8, 2), IDENTITY))).toBe(
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
    // Header is 9 bytes (magic + version + flags + rail-cleanup marker)
    // plus three u16-prefixed identities; corrupt the AQTL magic that starts
    // the watercolor body.
    const watercolorStart = sectionsOffset(bytes) + 4;
    const corrupted = withByte(bytes, watercolorStart, 0x00);
    expect(codeOf(() => decodeStudioScriptSnapshot(corrupted, IDENTITY))).toBe('watercolor');
  });
});

// ------------------------------------------------------------
//  261027 UAT round 2 — the watercolor key-anchor section.
//  AQTL events carry no key identity, so SNAP v5 binds every
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

  it('decodes an empty anchor section as unanchored', () => {
    const decoded = decodeStudioScriptSnapshot(encodeFixture(), IDENTITY);
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

  it('refuses trailing bytes inside the anchor section', () => {
    const body = anchorBody([{ mutationId: 7, keyId: 'key-a' }]);
    const padded = new Uint8Array(body.byteLength + 1);
    padded.set(body);
    const bytes = replaceAnchorBody(anchoredContainer([]), padded);
    expect(codeOf(() => decodeStudioScriptSnapshot(bytes, IDENTITY))).toBe('trailing');
  });
});

// ------------------------------------------------------------
//  261027 UAT round 4 — the durable-base section.
//
//  A scripted aquarelle key is a multiply composite over its
//  PRE-SCRIPT base. Move after a Studio reopen needs that base
//  again, but the key record holds the flattened composite, not
//  the base. SNAP persists the per-key base (bytes = known base,
//  null = known-empty) so a restore can seed the launch map
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

  it('decodes an empty durable-base section as carrying no bases', () => {
    const decoded = decodeStudioScriptSnapshot(encodeFixture(), IDENTITY);
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
