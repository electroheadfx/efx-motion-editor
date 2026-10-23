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
import {
  STUDIO_SCRIPT_SNAPSHOT_MAGIC,
  STUDIO_SCRIPT_SNAPSHOT_VERSION,
  StudioScriptSnapshotCodecError,
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
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
