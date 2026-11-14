/**
 * 260923-bcm Task 1 (RED): the paper grain SCALE member on the physical
 * document's background metadata — optional on input (finite, in range, else
 * refused), ALWAYS normalized to 1 on parse output, and a term of the persisted
 * project-equality fingerprint so a scale change never shares a save-cache key.
 */
import { describe, expect, it } from 'vitest';
import { isPhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import {
  buildPhysicPaintRotoProjectEquality,
  buildPhysicPaintRotoProjectEqualitySource,
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';

const documentWith = (background: unknown) => {
  const realKeyRecords: unknown[] = [];
  const interpolation = { enabled: false, mode: 'duplicate' } as const;
  const scriptMotion = { deformation: 0, position: 0 } as const;
  return {
    capacity: 8,
    realKeyRecords,
    groupOverrideRecords: [],
    interpolation,
    scriptMotion,
    background,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
    revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], [], []),
  };
};

const PAPER = { background: 'canvas1', grainStrength: 0.45 } as const;

/**
 * 261108-gh0: the per-channel byte order is ONE authority across the language
 * boundary — id string, wiggle canonical number, wiggleGlobal canonical
 * boolean, key count, keys. Rust's `canonical_rail_motions` emits the same
 * four leading terms.
 */
const railMotionDocumentWithChannel = (
  wiggle: number,
  wiggleGlobal: boolean,
): unknown => {
  const realKeyRecords: unknown[] = [];
  const interpolation = { enabled: false, mode: 'duplicate' } as const;
  const railMotions = [{
    railId: 'rail',
    anchorKeyId: 'k1',
    channels: [{
      id: 'scale',
      wiggle,
      wiggleGlobal,
      keys: [{ frame: 0, value: 1, easing: 'ease', wiggle: 0 }],
    }],
  }];
  return {
    capacity: 24,
    realKeyRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
    revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], [], [], railMotions),
    railMotions,
  };
};

describe('261108-gh0 channel wiggle canonical bytes', () => {
  it('emits id, wiggle, wiggleGlobal, key count then the unchanged key terms', () => {
    const nonDefault = buildPhysicPaintRotoProjectEqualitySource(
      railMotionDocumentWithChannel(12, false),
    );
    expect(nonDefault).toContain(
      's5:scale;n4028000000000000;0;1:n0000000000000000;n3ff0000000000000;s4:ease;n0000000000000000;',
    );

    const defaults = buildPhysicPaintRotoProjectEqualitySource(
      railMotionDocumentWithChannel(0, true),
    );
    expect(defaults).toContain(
      's5:scale;n0000000000000000;1;1:n0000000000000000;n3ff0000000000000;s4:ease;n0000000000000000;',
    );

    // Only the two inserted terms differ: the key terms after the count are
    // byte-identical between the two documents.
    const keyTerms = '1:n0000000000000000;n3ff0000000000000;s4:ease;n0000000000000000;';
    expect(nonDefault.slice(nonDefault.indexOf(keyTerms))).toBe(
      defaults.slice(defaults.indexOf(keyTerms)),
    );
  });

  it('rotates the revision when only the channel wiggle pair changes', () => {
    const defaults = buildPhysicPaintRotoProjectEquality(railMotionDocumentWithChannel(0, true));
    const wiggle = buildPhysicPaintRotoProjectEquality(railMotionDocumentWithChannel(12, true));
    const global = buildPhysicPaintRotoProjectEquality(railMotionDocumentWithChannel(0, false));
    expect(wiggle).not.toBe(defaults);
    expect(global).not.toBe(defaults);
  });
});

/**
 * Phase 62 (CRV-03, D-11): the source-scoped real cache identity is built in
 * exactly ONE place — `buildRotoRealCacheRevision`. The dynamic import keeps
 * RED a behavioural failure (the planned export is absent) rather than a
 * module-load failure, following the 62-01/62-02 precedent.
 */
type RealCacheRevisionBuilder = (contentRevision: string, keyId: string, suffix?: string) => string;

interface RealCacheRevisionModuleShape {
  readonly buildRotoRealCacheRevision: RealCacheRevisionBuilder;
}

async function realCacheRevisionBuilder(): Promise<RealCacheRevisionBuilder> {
  const module = (await import('./physicsPaintRotoPhysicalModel')) as unknown as Partial<RealCacheRevisionModuleShape>;
  const builder = module.buildRotoRealCacheRevision;
  expect(builder).toBeTypeOf('function');
  if (typeof builder !== 'function') throw new Error('buildRotoRealCacheRevision is not exported.');
  return builder;
}

describe('Phase 62 CRV-03 — the ONE source-scoped real cache identity', () => {
  it('builds the exact shipped identity string the store hand-built before the extraction', async () => {
    const buildRotoRealCacheRevision = await realCacheRevisionBuilder();
    const revision = 'physical-404-c22673ae';
    // The literal the store, the ownership remap and the persistence
    // projections hand-built before this extraction (byte for byte).
    expect(buildRotoRealCacheRevision(revision, 'D')).toBe(`${revision}:real:D`);
    expect(buildRotoRealCacheRevision(revision, 'D')).toBe('physical-404-c22673ae:real:D');
  });

  it('appends the suffix verbatim with no separator and no normalization', async () => {
    const buildRotoRealCacheRevision = await realCacheRevisionBuilder();
    const revision = 'physical-abc';
    expect(buildRotoRealCacheRevision(revision, 'D', ':paper:canvas1|str:0.45|scl:1')).toBe(
      'physical-abc:real:D:paper:canvas1|str:0.45|scl:1',
    );
    // No separator, no coercion: a raw suffix lands flush against the key.
    expect(buildRotoRealCacheRevision(revision, 'D', 'X')).toBe('physical-abc:real:DX');
    // The default suffix is the empty string, so the shipped strings cannot move.
    expect(buildRotoRealCacheRevision(revision, 'D', '')).toBe('physical-abc:real:D');
  });

  it('is deterministic for the same arguments and separates a distinct revision', async () => {
    const buildRotoRealCacheRevision = await realCacheRevisionBuilder();
    expect(buildRotoRealCacheRevision('physical-a', 'A')).toBe(buildRotoRealCacheRevision('physical-a', 'A'));
    expect(buildRotoRealCacheRevision('physical-a', 'A')).not.toBe(buildRotoRealCacheRevision('physical-b', 'A'));
  });

  it('separates a distinct source key so one cache entry cannot serve two sources', async () => {
    const buildRotoRealCacheRevision = await realCacheRevisionBuilder();
    expect(buildRotoRealCacheRevision('physical-a', 'A')).not.toBe(buildRotoRealCacheRevision('physical-a', 'D'));
  });
});

describe('physical background grainScale member (260923-bcm)', () => {
  it('260923-bcm: the physical parser accepts an in-range grainScale and normalizes a missing one to 1', () => {
    const scaled = parsePhysicPaintRotoPhysicalDocument(
      documentWith({ ...PAPER, grainScale: 2 }),
      'runtime',
    );
    expect(scaled.background?.grainScale).toBe(2);

    const absent = parsePhysicPaintRotoPhysicalDocument(documentWith(PAPER), 'runtime');
    expect(absent.background?.grainScale).toBe(1);
  });

  it('260923-bcm: the physical parser refuses an out-of-range grainScale fail-closed', () => {
    for (const bad of [0, -1, 11, NaN]) {
      expect(() => parsePhysicPaintRotoPhysicalDocument(
        documentWith({ ...PAPER, grainScale: bad }),
        'runtime',
      )).toThrow(/invalid background metadata/);
    }
  });

  it('260923-bcm: the apply-payload validator accepts an in-range grainScale and refuses an out-of-range one', () => {
    expect(isPhysicPaintRotoBackgroundMetadata({ ...PAPER, grainScale: 2 })).toBe(true);
    expect(isPhysicPaintRotoBackgroundMetadata({ ...PAPER, grainScale: 0 })).toBe(false);
    expect(isPhysicPaintRotoBackgroundMetadata({ ...PAPER, grainScale: 11 })).toBe(false);
    expect(isPhysicPaintRotoBackgroundMetadata({ ...PAPER, grainScale: '2' })).toBe(false);
    expect(isPhysicPaintRotoBackgroundMetadata({ ...PAPER, grainScale: NaN })).toBe(false);
  });

  it('260923-bcm: project equality rotates when only the grain scale changes and is stable at a fixed scale', () => {
    const scale1 = buildPhysicPaintRotoProjectEquality(documentWith({ ...PAPER, grainScale: 1 }));
    const scale2 = buildPhysicPaintRotoProjectEquality(documentWith({ ...PAPER, grainScale: 2 }));
    expect(scale2).not.toBe(scale1);
    const scale2Again = buildPhysicPaintRotoProjectEquality(documentWith({ ...PAPER, grainScale: 2 }));
    expect(scale2Again).toBe(scale2);
    // Absent normalizes to the same fingerprint as an explicit 1.
    const absent = buildPhysicPaintRotoProjectEquality(documentWith(PAPER));
    expect(absent).toBe(scale1);
  });
});
