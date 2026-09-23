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

const PAPER = { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 } as const;

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
