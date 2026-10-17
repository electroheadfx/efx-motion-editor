/**
 * 261017-dc2 — validator divergence pin: the document-parser background
 * contract and the apply-payload background contract must accept / reject the
 * IDENTICAL sets.
 *
 * 56-05 (PAPER-01) made `paper/<id>` a first-class `PhysicPaintRotoBackgroundMode`
 * and migrated `isPhysicPaintRotoBackgroundMetadata` (types/physicPaint.ts), but
 * the document parser's `isPhysicPaintRotoBackground` stayed on the five-literal
 * closed set — so `parsePhysicPaintRotoPhysicalDocument` threw
 * `PhysicPaintRotoPhysicalDocument: invalid background metadata.` on every
 * navigation read of a paper-backed document (the live PHYSIC PAINT STUDIO
 * frame / key-rail click death).
 *
 * This suite is the anti-divergence mechanism: one accept set, one reject set,
 * asserted against BOTH contracts. Acceptance also covers the `_writePaperDisplay`
 * empty-string fallback (the second live wire) — the write path must never
 * construct `background: ''`.
 *
 * `.test.ts` on purpose — Vitest only collects `*.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../../../stores/physicPaintStore';
import {
  getDocument as getEfxPaintDocument,
  registerDocument,
  reset as resetEfxPaintStore,
} from '../../../stores/efxPaintStore';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';

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

/** The locked legal background set both contracts must accept. */
const LEGAL_BACKGROUNDS = [
  'transparent',
  'white',
  'canvas1',
  'canvas2',
  'canvas3',
  'paper/cold-press',
  'paper/real-1',
] as const;

describe('document-parser and apply-payload background contracts stay in parity', () => {
  it('PARITY ACCEPT — the identical seven legal backgrounds pass both contracts', () => {
    for (const background of LEGAL_BACKGROUNDS) {
      const metadata = { background, grainStrength: 0.45 };
      expect(isPhysicPaintRotoBackgroundMetadata(metadata)).toBe(true);
      expect(() => parsePhysicPaintRotoPhysicalDocument(documentWith(metadata), 'runtime')).not.toThrow();
      const parsed = parsePhysicPaintRotoPhysicalDocument(documentWith(metadata), 'runtime');
      expect(parsed.background?.background).toBe(background);
    }
  });

  it('PARITY REJECT — the identical illegal shapes fail both contracts', () => {
    const illegal: readonly unknown[] = [
      { background: 'photo', grainStrength: 0.45 },
      { background: '', grainStrength: 0.45 },
      { background: 'canvas3', grainStrength: 2 },
      { background: 'canvas3' },
    ];
    for (const metadata of illegal) {
      expect(isPhysicPaintRotoBackgroundMetadata(metadata)).toBe(false);
      expect(() => parsePhysicPaintRotoPhysicalDocument(documentWith(metadata), 'runtime')).toThrow(/invalid background metadata/);
    }
  });

  it('GRAIN RANGE STAYS FAIL-CLOSED — out-of-range grainScale is refused by both contracts', () => {
    for (const grainScale of [0, 11]) {
      const metadata = { background: 'paper/cold-press', grainStrength: 0.45, grainScale };
      expect(isPhysicPaintRotoBackgroundMetadata(metadata)).toBe(false);
      expect(() => parsePhysicPaintRotoPhysicalDocument(documentWith(metadata), 'runtime')).toThrow(/invalid background metadata/);
    }
  });
});

describe('NO EMPTY-STRING WRITE — _writePaperDisplay never stores background: \'\'', () => {
  const LAYER = 'layer-261017-dc2-parity';

  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    resetEfxPaintStore();
    physicPaintStore.reset();
    // Fresh layer, transparent document fallback — do NOT pre-seed a paper.
    registerDocument(createEfxPaintDocument(LAYER));
  });

  afterEach(() => {
    resetEfxPaintStore();
    physicPaintStore.reset();
  });

  it('strength / scale-only edits on a non-paper source never write an empty-string background', () => {
    const activeTrackId = getEfxPaintDocument(LAYER)!.activeTrackId;
    expect(physicPaintStore.setPaperStrength(LAYER, 0.8)).toBe(false);
    expect(physicPaintStore.setPaperScale(LAYER, 2)).toBe(false);
    const mirror = physicPaintStore.getRotoBackgroundMetadata(LAYER, activeTrackId);
    expect(mirror === null || mirror.background !== '').toBe(true);
    if (mirror) expect(isPhysicPaintRotoBackgroundMetadata(mirror)).toBe(true);
  });

  it('setPaperId writes a legal paper/* mirror; an explicit transparent clear writes the legal no-paper encoding', () => {
    const activeTrackId = getEfxPaintDocument(LAYER)!.activeTrackId;
    expect(physicPaintStore.setPaperId(LAYER, 'paper/rough')).toBe(true);
    const paperMirror = physicPaintStore.getRotoBackgroundMetadata(LAYER, activeTrackId);
    expect(paperMirror?.background).toBe('paper/rough');

    expect(physicPaintStore.setPaperId(LAYER, 'transparent')).toBe(true);
    const cleared = physicPaintStore.getRotoBackgroundMetadata(LAYER, activeTrackId);
    expect(cleared?.background).toBe('transparent');
    expect(cleared === null || cleared.background !== '').toBe(true);
  });
});
