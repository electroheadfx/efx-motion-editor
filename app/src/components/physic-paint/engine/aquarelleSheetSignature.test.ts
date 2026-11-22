// ============================================================
//  aquarelleSheetSignature — the sheet cache's SCRIPT identity
//  (64-28, IN-05).
//
//  KEY = CACHE: a cached sheet may only be restored under the exact
//  script that produced it. The shipped signature hashes only event
//  count, mutation id and point count, so a script edit with equal
//  counts restored a stale sheet. The identity here is a canonical
//  digest of the WHOLE event list — every field of every event,
//  key-order independent, total on malformed payloads.
// ============================================================

import { describe, expect, it } from 'vitest';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import type {
  AquarelleDryEvent,
  AquarellePayloadEvent,
  AquarelleStrokePayload,
  AquarelleToolOverrides,
} from '@efxlab/efx-watercolor';
import { aquarelleSheetSignature } from './aquarelleSheetSignature';

type Stroke = StudioStroke<AquarelleStrokePayload>;

/** One valid override bag; `tip` is the member the variants perturb. */
function overrides(tip = 1.2): AquarelleToolOverrides {
  return {
    tip,
    aspect: 1,
    rotation: 1,
    sizeCurve: 1,
    scatter: 1,
    capacity: 1,
    grain: 0.8,
    wetRound: 1,
  };
}

function baseStroke(): Stroke {
  return {
    pts: [
      { x: 0.25, y: 0.5, p: 0.6, tx: 10, ty: -4, tw: 0, tick: 0 },
      { x: 0.3, y: 0.55, p: 0.7, tx: 12, ty: -2, tw: 0.1, tick: 3 },
    ],
    ticks: 3,
    cuisson: 12,
    motion: null,
    brushId: 'bristle-flat',
    toolOverrides: { width: 1.2, flow: 0.8 },
    traceSeed: 0x1234abcd,
    recordedOrder: 1000,
    playFrame: 7,
    color: '#204060',
    engine: {
      tool: 'brush',
      color: '#204060',
      params: { width: 40, flow: 0.7, Body: 100 },
      brushId: 'bristle-flat',
      toolOverrides: overrides(),
      mutationId: 9,
      diffusionFrames: 12,
      timestamp: 1000,
      playFrame: 7,
    },
  };
}

function baseDry(): AquarelleDryEvent {
  return { kind: 'dry', tick: 5, recordedOrder: 1001 };
}

function baseEvents(): AquarellePayloadEvent[] {
  return [baseStroke(), baseDry()];
}

function digestOf(events: readonly AquarellePayloadEvent[]): number {
  return aquarelleSheetSignature(events);
}

function withPoint(field: 'x' | 'y' | 'p' | 'tx' | 'ty' | 'tw' | 'tick', value: number): Stroke {
  const stroke = baseStroke();
  const pts = stroke.pts.map((point, index) =>
    index === 0 ? { ...point, [field]: value } : point,
  );
  return { ...stroke, pts };
}

function withStroke(patch: Partial<Stroke>): Stroke {
  return { ...baseStroke(), ...patch };
}

function withEngine(patch: Partial<AquarelleStrokePayload>): Stroke {
  const stroke = baseStroke();
  return { ...stroke, engine: { ...stroke.engine, ...patch } };
}

describe('64-28 canonical sheet signature (IN-05)', () => {
  it('hashes identical event lists equally', () => {
    expect(digestOf(baseEvents())).toBe(digestOf(baseEvents()));
    expect(digestOf([baseStroke()])).toBe(digestOf([baseStroke()]));
  });

  it('is an unsigned 32-bit digest', () => {
    for (const digest of [digestOf([]), digestOf(baseEvents()), digestOf([baseDry()])]) {
      expect(Number.isInteger(digest)).toBe(true);
      expect(digest).toBeGreaterThanOrEqual(0);
      expect(digest).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('separates two equal-count scripts whose point payload differs', () => {
    const base = digestOf([baseStroke()]);
    const variants: Array<[string, Stroke]> = [
      ['x', withPoint('x', 0.251)],
      ['y', withPoint('y', 0.501)],
      ['pressure', withPoint('p', 0.61)],
      ['tilt x', withPoint('tx', 11)],
      ['tilt y', withPoint('ty', -3)],
      ['tick', withPoint('tick', 1)],
      ['wetness', withPoint('tw', 0.2)],
    ];
    for (const [field, variant] of variants) {
      expect(digestOf([variant]), `point ${field} did not change the digest`).not.toBe(base);
    }
  });

  it('separates two equal-count scripts whose stroke fields differ', () => {
    const base = digestOf([baseStroke()]);
    const variants: Array<[string, Stroke]> = [
      ['ticks', withStroke({ ticks: 4 })],
      ['cuisson', withStroke({ cuisson: 13 })],
      ['traceSeed', withStroke({ traceSeed: 0x1234abce })],
      ['recordedOrder', withStroke({ recordedOrder: 1001 })],
      ['playFrame', withStroke({ playFrame: 8 })],
      ['color', withStroke({ color: '#204061' })],
      ['brushId', withStroke({ brushId: 'bristle-round' })],
    ];
    for (const [field, variant] of variants) {
      expect(digestOf([variant]), `stroke ${field} did not change the digest`).not.toBe(base);
    }
  });

  it('separates two equal-count scripts whose engine payload differs', () => {
    const base = digestOf([baseStroke()]);
    const variants: Array<[string, Stroke]> = [
      ['tool', withEngine({ tool: 'watercolor' })],
      ['mutationId', withEngine({ mutationId: 10 })],
      ['diffusionFrames', withEngine({ diffusionFrames: 11 })],
      ['textureId', withEngine({ textureId: 'canvas-weave' })],
      ['textureRotation', withEngine({ textureRotation: 45 })],
      ['params value', withEngine({ params: { width: 41, flow: 0.7, Body: 100 } })],
      ['params key set', withEngine({ params: { width: 40, flow: 0.7 } })],
      ['toolOverrides', withEngine({ toolOverrides: overrides(1.3) })],
      [
        'anchors',
        withEngine({
          anchors: [
            { x: 0.2, y: 0.2, kind: 'auto' },
            { x: 0.6, y: 0.4, kind: 'bezier' },
          ],
        }),
      ],
      ['curveMode', withEngine({ curveMode: 'spline' })],
      ['vectorDrawn', withEngine({ vectorDrawn: true })],
      ['engine color', withEngine({ color: '#204061' })],
    ];
    for (const [field, variant] of variants) {
      expect(digestOf([variant]), `engine ${field} did not change the digest`).not.toBe(base);
    }
  });

  it('separates Dry events that differ in tick or recordedOrder', () => {
    const base = digestOf([baseDry()]);
    expect(digestOf([{ ...baseDry(), tick: 6 }])).not.toBe(base);
    expect(digestOf([{ ...baseDry(), recordedOrder: 1002 }])).not.toBe(base);
  });

  it('separates event lists that differ only in order', () => {
    expect(digestOf([baseStroke(), baseDry()])).not.toBe(digestOf([baseDry(), baseStroke()]));
  });

  it('is independent of key insertion order in nested records', () => {
    const ordered = withEngine({
      params: { width: 40, flow: 0.7, Body: 100 },
      toolOverrides: overrides(),
    });
    const reordered: Stroke = {
      ...ordered,
      toolOverrides: { flow: 0.8, width: 1.2 },
      engine: {
        ...ordered.engine,
        params: { Body: 100, flow: 0.7, width: 40 },
        toolOverrides: {
          wetRound: 1,
          grain: 0.8,
          capacity: 1,
          scatter: 1,
          sizeCurve: 1,
          rotation: 1,
          aspect: 1,
          tip: 1.2,
        },
        anchors: [
          { y: 0.2, x: 0.2, kind: 'auto', in: { y: 0.1, x: 0.1 }, out: { y: 0.3, x: 0.3 } },
        ],
      },
    };
    const anchorsOrdered = withEngine({
      anchors: [
        { x: 0.2, y: 0.2, kind: 'auto', in: { x: 0.1, y: 0.1 }, out: { x: 0.3, y: 0.3 } },
      ],
    });
    expect(digestOf([reordered])).toBe(digestOf([anchorsOrdered]));
    expect(digestOf([ordered])).toBe(digestOf([{ ...ordered }]));
  });

  it('is total: absent, null, non-finite and empty values never throw', () => {
    const malformed = [
      { kind: 'dry', tick: Number.NaN, recordedOrder: Number.POSITIVE_INFINITY },
      { kind: 'dry', tick: Number.NEGATIVE_INFINITY, recordedOrder: -0 },
    ] as unknown as AquarellePayloadEvent[];
    expect(() => digestOf([])).not.toThrow();
    expect(() => digestOf(malformed)).not.toThrow();
    expect(digestOf([])).toBeTypeOf('number');
    expect(digestOf(malformed)).toBeTypeOf('number');
    const stroke = baseStroke();
    const sparse = {
      ...stroke,
      color: null,
      playFrame: null,
      engine: { ...stroke.engine, params: {}, toolOverrides: undefined, textureId: undefined },
    };
    expect(digestOf([sparse])).toBeTypeOf('number');
  });

  it('encodes an explicit undefined like an absent key', () => {
    const explicit = {
      ...baseStroke(),
      engine: { ...baseStroke().engine, textureId: undefined },
    } as Stroke;
    expect(digestOf([explicit])).toBe(digestOf([baseStroke()]));
  });
});
