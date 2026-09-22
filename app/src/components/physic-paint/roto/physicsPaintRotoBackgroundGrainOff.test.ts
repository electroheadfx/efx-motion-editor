/**
 * debug layer-2-gestures (2026-09-22): a physic-paint layer whose document
 * fallback has `paperGrain: false` resolves its fond to `paperGrain: ''` — the
 * app's own "paper with the grain off" encoding (`_resolveFondSource`, the
 * missing-frame draw instruction, the top bar's grain selector, and the
 * `paperGrain || background` fallback every consumer uses).
 *
 * The studio then publishes that metadata back as the track's background, and
 * BOTH validators refused it (`isNonEmptyString`), so every document read on
 * that layer threw "invalid background metadata": navigation died before it
 * could set the key selection, which locked key move, rail edit and delete —
 * the "layers beyond the first added in the main app are interaction-dead"
 * defect, reproduced live on layer 2 at the first click.
 *
 * A paper without grain is a legitimate state, so both contracts accept it.
 */
import { describe, expect, it } from 'vitest';
import { isPhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';

const GRAIN_OFF = { background: 'canvas3', paperGrain: '', grainStrength: 0.45 } as const;
const GRAIN_ON = { background: 'canvas3', paperGrain: 'canvas1', grainStrength: 0.45 } as const;

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

describe('paper with the grain off survives both background contracts', () => {
  it('the apply-payload validator accepts it', () => {
    expect(isPhysicPaintRotoBackgroundMetadata(GRAIN_OFF)).toBe(true);
    expect(isPhysicPaintRotoBackgroundMetadata(GRAIN_ON)).toBe(true);
  });

  it('the physical document parser accepts it (the live throw site)', () => {
    expect(() => parsePhysicPaintRotoPhysicalDocument(documentWith(GRAIN_OFF), 'runtime')).not.toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(documentWith(GRAIN_ON), 'runtime')).not.toThrow();
    expect(parsePhysicPaintRotoPhysicalDocument(documentWith(GRAIN_OFF), 'runtime').background).toEqual(GRAIN_OFF);
  });

  it('still refuses metadata that is not a paper state at all', () => {
    expect(isPhysicPaintRotoBackgroundMetadata({ ...GRAIN_OFF, background: 'photo' })).toBe(false);
    expect(isPhysicPaintRotoBackgroundMetadata({ ...GRAIN_OFF, grainStrength: 2 })).toBe(false);
    expect(isPhysicPaintRotoBackgroundMetadata({ ...GRAIN_OFF, paperGrain: null })).toBe(false);
    expect(() => parsePhysicPaintRotoPhysicalDocument(documentWith({ ...GRAIN_OFF, background: 'photo' }), 'runtime')).toThrow(/invalid background metadata/);
  });
});
