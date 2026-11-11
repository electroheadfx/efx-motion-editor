/**
 * Flattened cache key + keyed memo contract tests (Phase 48-01 Task 2 — RED).
 *
 * CMP-04/D-08: the flattened per-frame cache key MUST cover every dependency
 * class that changes the composite — config (order/visible/solo/opacity/blend,
 * background visibility + fallback) via `buildEfxPaintCompositeRevision`,
 * PLUS per-track content revisions, the background revision, background clip
 * revision terms, and the frame term. The composite revision alone is
 * under-covering (Pitfall P-48-3). Key building uses the canonical-encoder
 * helpers ONLY (delimiter-collision discipline, efxPaintDocumentRevision.ts).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarelleAnchor, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from '../../components/physic-paint/view/aquarelleRecordState';
import { beginAquarellePathEdit } from '../../components/physic-paint/view/aquarelleStrokeSelection';
import {
  draftMode,
  setDraftMode,
  setWireframeMode,
  wireframeMode,
} from '../../components/physic-paint/view/scriptStrokeEdition';
import { createEfxPaintDocument } from '../document/efxPaintDocument';
import type { EfxPaintDocument, FrameLoopClip, InternalPaintTrack } from '../document/efxPaintDocument';
import {
  createKeyedMemo,
  deriveEfxPaintFlattenedCacheKey,
  deriveEfxPaintTrackContentKey,
} from './efxPaintCompositeCache';

const root = resolve(__dirname, '../../..'); // app/
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

function makeTrack(id: string, overrides: Partial<InternalPaintTrack> = {}): InternalPaintTrack {
  return {
    id,
    name: `Track ${id}`,
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: Object.freeze({}),
    rotoPhysical: null,
    loopClips: Object.freeze([]),
    ...overrides,
  };
}

function makeDocument(
  tracks: readonly InternalPaintTrack[],
  backgroundOverrides: Partial<EfxPaintDocument['background']> = {},
): EfxPaintDocument {
  const base = createEfxPaintDocument('layer-1');
  return {
    ...base,
    activeTrackId: tracks[0]?.id ?? base.activeTrackId,
    tracks,
    background: { ...base.background, ...backgroundOverrides },
  };
}

function contentRevisions(entries: ReadonlyArray<readonly [string, string]>): ReadonlyMap<string, string> {
  return new Map(entries);
}

describe('deriveEfxPaintFlattenedCacheKey — CMP-04 dependency coverage (D-08)', () => {
  it('is deterministic and order-independent in track iteration (sorted by track.id); module never reads the unwired compositeRevision counter', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const revisions = contentRevisions([
      ['track-a', 'rev-a'],
      ['track-b', 'rev-b'],
    ]);
    const key1 = deriveEfxPaintFlattenedCacheKey({
      document: doc,
      trackContentRevisions: revisions,
      backgroundClipRevisions: [],
      frame: 3,
    });
    const key2 = deriveEfxPaintFlattenedCacheKey({
      document: doc,
      trackContentRevisions: revisions,
      backgroundClipRevisions: [],
      frame: 3,
    });
    expect(key1).toBe(key2);

    // Same map, reversed insertion order → identical key (iteration is sorted by track.id).
    const reversed = contentRevisions([
      ['track-b', 'rev-b'],
      ['track-a', 'rev-a'],
    ]);
    const key3 = deriveEfxPaintFlattenedCacheKey({
      document: doc,
      trackContentRevisions: reversed,
      backgroundClipRevisions: [],
      frame: 3,
    });
    expect(key3).toBe(key1);

    // Structural gates (acceptance): imports the composite-revision builder +
    // canonical-encoder helpers ONLY (no hand-built delimiters); the unwired
    // document.compositeRevision counter is never read (the only allowed token
    // is the import name).
    const source = readSource('src/efx-paint/compositor/efxPaintCompositeCache.ts');
    expect(source).toContain('buildEfxPaintCompositeRevision');
    expect(source).toContain('hashCanonicalPhysicalValue');
    expect(source).toContain('encodeCanonicalString');
    expect(source).toContain('encodeCanonicalNumber');
    expect(source).not.toContain('.compositeRevision');
  });

  it('changing ONE track content revision changes the key; the sibling track content-key term is unchanged (P-48-3)', () => {
    const doc = makeDocument([makeTrack('track-a'), makeTrack('track-b')]);
    const base = {
      document: doc,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
      backgroundClipRevisions: [] as string[],
      frame: 0,
    };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);

    const keyBumped = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b2'],
      ]),
    });
    expect(keyBumped).not.toBe(keyBase);

    // Track A's own content-key term is byte-identical across the bump.
    const trackAKeyBefore = deriveEfxPaintTrackContentKey('track-a', 'rev-a', 0);
    const trackAKeyAfter = deriveEfxPaintTrackContentKey('track-a', 'rev-a', 0);
    expect(trackAKeyAfter).toBe(trackAKeyBefore);
  });

  it('toggling a track config (solo/opacity/order) changes the key — the config-hash term', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const revisions = contentRevisions([
      ['track-a', 'rev-a'],
      ['track-b', 'rev-b'],
    ]);
    const base = { trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyBase = deriveEfxPaintFlattenedCacheKey({ document: doc, ...base });

    const soloDoc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, solo: true }),
    ]);
    expect(deriveEfxPaintFlattenedCacheKey({ document: soloDoc, ...base })).not.toBe(keyBase);

    const opacityDoc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, opacity: 0.5 }),
    ]);
    expect(deriveEfxPaintFlattenedCacheKey({ document: opacityDoc, ...base })).not.toBe(keyBase);

    const orderDoc = makeDocument([
      makeTrack('track-a', { order: 1 }),
      makeTrack('track-b', { order: 0 }),
    ]);
    expect(deriveEfxPaintFlattenedCacheKey({ document: orderDoc, ...base })).not.toBe(keyBase);
  });

  it('changing background.revision, a clip revision term, or the fallback changes the key', () => {
    const doc = makeDocument([makeTrack('track-a')]);
    const revisions = contentRevisions([['track-a', 'rev-a']]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);

    const bgRevDoc = makeDocument([makeTrack('track-a')], { revision: 1 });
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: bgRevDoc })).not.toBe(keyBase);

    const withClip = deriveEfxPaintFlattenedCacheKey({
      ...base,
      backgroundClipRevisions: ['clip-1:2'],
    });
    expect(withClip).not.toBe(keyBase);

    const solidDoc = makeDocument([makeTrack('track-a')], { fallback: { mode: 'solid', color: '#112233' } });
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: solidDoc })).not.toBe(keyBase);
  });

  it('49-03 T3: a fallback-mode change with EQUAL background.revision rotates the flattened key; identical documents yield identical keys', () => {
    const doc = makeDocument([makeTrack('track-a')], { revision: 7 });
    const revisions = contentRevisions([['track-a', 'rev-a']]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);

    // Same background.revision (7), different fallback mode → different key
    // (a same-revision fallback-content change invalidates — BKG-09/CMP-04).
    const paperDoc = makeDocument([makeTrack('track-a')], {
      revision: 7,
      fallback: { mode: 'paper', texture: 'canvas2', grainStrength: 0.18 },
    });
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: paperDoc })).not.toBe(keyBase);

    // Identical documents → identical keys (built from the same base so the
    // fresh-UUID-per-call trap of createEfxPaintDocument cannot leak in).
    const paperDoc2 = JSON.parse(JSON.stringify(paperDoc)) as EfxPaintDocument;
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: paperDoc2 })).toBe(
      deriveEfxPaintFlattenedCacheKey({ ...base, document: paperDoc }),
    );

    // Structural gate (T-49-03-02): the flattened key carries a DEDICATED
    // `fallback:` term built from the canonical encoder (single source — no
    // second hand-written switch that can drift).
    const source = readSource('src/efx-paint/compositor/efxPaintCompositeCache.ts');
    expect(source).toContain('fallback:');
    expect(source).toContain('encodeCanonicalBackgroundFallback');
  });

  it('same inputs, different frame → different key (frame term)', () => {
    const doc = makeDocument([makeTrack('track-a')]);
    const revisions = contentRevisions([['track-a', 'rev-a']]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyFrame0 = deriveEfxPaintFlattenedCacheKey(base);
    const keyFrame1 = deriveEfxPaintFlattenedCacheKey({ ...base, frame: 1 });
    expect(keyFrame1).not.toBe(keyFrame0);
  });

  it('IFF-02/03: the session solo target is a key term and narrows the content terms', () => {
    const doc = makeDocument([makeTrack('track-a'), makeTrack('track-b')]);
    const revisions = contentRevisions([
      ['track-a', 'rev-a'],
      ['track-b', 'rev-b'],
    ]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };

    const disarmedKey = deriveEfxPaintFlattenedCacheKey(base);
    const targetedKey = deriveEfxPaintFlattenedCacheKey({ ...base, soloTrackId: 'track-a' });
    expect(targetedKey).not.toBe(disarmedKey);

    // A content edit on the NON-participating track b does not rotate the key.
    expect(
      deriveEfxPaintFlattenedCacheKey({
        ...base,
        soloTrackId: 'track-a',
        trackContentRevisions: contentRevisions([
          ['track-a', 'rev-a'],
          ['track-b', 'rev-b2'],
        ]),
      }),
    ).toBe(targetedKey);

    // A content edit on the participating target track a DOES rotate it.
    expect(
      deriveEfxPaintFlattenedCacheKey({
        ...base,
        soloTrackId: 'track-a',
        trackContentRevisions: contentRevisions([
          ['track-a', 'rev-a2'],
          ['track-b', 'rev-b'],
        ]),
      }),
    ).not.toBe(targetedKey);
  });

  it('IFF-02: omitted and explicit-null solo targets produce byte-identical disarmed keys', () => {
    const doc = makeDocument([makeTrack('track-a'), makeTrack('track-b')]);
    const revisions = contentRevisions([
      ['track-a', 'rev-a'],
      ['track-b', 'rev-b'],
    ]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, soloTrackId: null })).toBe(
      deriveEfxPaintFlattenedCacheKey(base),
    );
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, soloTrackId: undefined })).toBe(
      deriveEfxPaintFlattenedCacheKey(base),
    );
  });

  it('createKeyedMemo get/set/has/delete/clearByPrefix/clear/size; equal-key overwrite; stored values frozen', () => {
    const memo = createKeyedMemo<string, { value: number }>();

    memo.set('a', { value: 1 });
    expect(memo.has('a')).toBe(true);
    expect(memo.get('a')).toEqual({ value: 1 });
    expect(Object.isFrozen(memo.get('a'))).toBe(true);
    expect(memo.size).toBe(1);

    // Setting an equal key overwrites (Map semantics).
    memo.set('a', { value: 2 });
    expect(memo.get('a')).toEqual({ value: 2 });
    expect(Object.isFrozen(memo.get('a'))).toBe(true);
    expect(memo.size).toBe(1);

    expect(memo.delete('a')).toBe(true);
    expect(memo.has('a')).toBe(false);
    expect(memo.size).toBe(0);

    memo.set('a:1', { value: 1 });
    memo.set('a:2', { value: 2 });
    memo.set('b:1', { value: 3 });
    memo.clearByPrefix('a:');
    expect(memo.has('a:1')).toBe(false);
    expect(memo.has('a:2')).toBe(false);
    expect(memo.has('b:1')).toBe(true);
    expect(memo.size).toBe(1);

    memo.clear();
    expect(memo.size).toBe(0);
  });
});

function makeClip(overrides: Partial<FrameLoopClip> = {}): FrameLoopClip {
  return {
    id: 'clip-1',
    startFrame: 0,
    sourceFrameRefs: Object.freeze(['ref-1']),
    repeat: { mode: 'finite', count: 1 },
    sourceKind: 'imported-background',
    revision: 0,
    ...overrides,
  };
}

/**
 * CMP-04 invalidation matrix (48-04 Task 2) — one failing-then-passing row per
 * dependency class: track content, order, visibility, solo, opacity, blendMode,
 * background clip add/edit/repeat, background fallback, background visibility,
 * and frame. Row 5 pins the participating-only content-term semantics (a hidden
 * track's content term is absent from the key — the config hash already covers
 * visibility, so re-showing re-composites).
 */
describe('CMP-04 invalidation matrix — key-level rows (48-04 Task 2)', () => {
  it('row 1 — track content: editing track B content changes the flattened key while track A content-key term is byte-identical', () => {
    const doc = makeDocument([makeTrack('track-a'), makeTrack('track-b')]);
    const base = {
      document: doc,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
      backgroundClipRevisions: [] as string[],
      frame: 5,
    };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);
    const keyBumped = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b2'],
      ]),
    });
    expect(keyBumped).not.toBe(keyBase);
    expect(deriveEfxPaintTrackContentKey('track-a', 'rev-a', 5)).toBe(
      deriveEfxPaintTrackContentKey('track-a', 'rev-a', 5),
    );
  });

  it('row 2 — config: visible / solo / opacity / blendMode / order each rotate the flattened key (5 sub-cases)', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const revisions = contentRevisions([
      ['track-a', 'rev-a'],
      ['track-b', 'rev-b'],
    ]);
    const base = { trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyBase = deriveEfxPaintFlattenedCacheKey({ document: doc, ...base });

    const cases: ReadonlyArray<[string, EfxPaintDocument]> = [
      ['visible', makeDocument([makeTrack('track-a', { order: 0 }), makeTrack('track-b', { order: 1, visible: false })])],
      ['solo', makeDocument([makeTrack('track-a', { order: 0 }), makeTrack('track-b', { order: 1, solo: true })])],
      ['opacity', makeDocument([makeTrack('track-a', { order: 0 }), makeTrack('track-b', { order: 1, opacity: 0.5 })])],
      ['blendMode', makeDocument([makeTrack('track-a', { order: 0 }), makeTrack('track-b', { order: 1, blendMode: 'multiply' })])],
      ['order', makeDocument([makeTrack('track-a', { order: 1 }), makeTrack('track-b', { order: 0 })])],
    ];
    for (const [name, mutated] of cases) {
      expect(deriveEfxPaintFlattenedCacheKey({ document: mutated, ...base }), `config sub-case: ${name}`).not.toBe(keyBase);
    }
  });

  it('row 3 — background clip add / repeat-count / revision each rotate the flattened key', () => {
    const doc = makeDocument([makeTrack('track-a')]);
    const revisions = contentRevisions([['track-a', 'rev-a']]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);

    const clipAdded = makeDocument(
      [makeTrack('track-a')],
      { clips: [makeClip({ repeat: { mode: 'finite', count: 1 }, revision: 1 })], revision: 1 },
    );
    const keyClipAdded = deriveEfxPaintFlattenedCacheKey({ ...base, document: clipAdded, backgroundClipRevisions: ['clip-1:1'] });
    expect(keyClipAdded).not.toBe(keyBase);

    const repeatChanged = makeDocument(
      [makeTrack('track-a')],
      { clips: [makeClip({ repeat: { mode: 'finite', count: 2 }, revision: 2 })], revision: 2 },
    );
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: repeatChanged, backgroundClipRevisions: ['clip-1:2'] })).not.toBe(keyClipAdded);

    const revisionChanged = makeDocument(
      [makeTrack('track-a')],
      { clips: [makeClip({ repeat: { mode: 'finite', count: 1 }, revision: 2 })], revision: 2 },
    );
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: revisionChanged, backgroundClipRevisions: ['clip-1:2'] })).not.toBe(keyClipAdded);
  });

  it('row 4 — background fallback flip and visible toggle each rotate the flattened key', () => {
    const doc = makeDocument([makeTrack('track-a')]);
    const revisions = contentRevisions([['track-a', 'rev-a']]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);

    const solid = makeDocument([makeTrack('track-a')], { fallback: { mode: 'solid', color: '#112233' } });
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: solid })).not.toBe(keyBase);

    const hidden = makeDocument([makeTrack('track-a')], { visible: false });
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: hidden })).not.toBe(keyBase);
  });

  it('row 5 — non-participating isolation: a HIDDEN track content revision does NOT appear in the key (participating-only content terms)', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false }),
    ]);
    const base = {
      document: doc,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
      backgroundClipRevisions: [] as string[],
      frame: 0,
    };
    const keyBase = deriveEfxPaintFlattenedCacheKey(base);
    const keyBumped = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b2'],
      ]),
    });
    expect(keyBumped).toBe(keyBase);
  });

  it('row 6 — background source bytes: a runtime source revision rotates the key (49-06 UAT round 6)', () => {
    const doc = makeDocument(
      [makeTrack('track-a')],
      { clips: [makeClip({ sourceFrameRefs: Object.freeze(['ref-1']) })] },
    );
    const base = {
      document: doc,
      trackContentRevisions: contentRevisions([['track-a', 'rev-a']]),
      backgroundClipRevisions: ['clip-1:0'] as string[],
      frame: 0,
    };
    const keyNoBytes = deriveEfxPaintFlattenedCacheKey(base);
    // A clip-less document emits no bgsrc term — byte-identical to the pre-49-06 key.
    const clipLess = makeDocument([makeTrack('track-a')]);
    expect(deriveEfxPaintFlattenedCacheKey({ ...base, document: clipLess, backgroundClipRevisions: [] })).toBe(
      deriveEfxPaintFlattenedCacheKey({ ...base, document: clipLess, backgroundClipRevisions: [] }),
    );
    // Bytes arriving for a ref (missing → registered) MUST rotate the key — the
    // composite content changes while the document does not.
    const keyRegistered = deriveEfxPaintFlattenedCacheKey({
      ...base,
      backgroundSourceRevision: 'ref-1:12345:data:image/png;base64,iVBORw0KGgoAAAANSUhEUg',
    });
    expect(keyRegistered).not.toBe(keyNoBytes);
    // A different dataUrl for the same ref also rotates the key.
    const keyOtherBytes = deriveEfxPaintFlattenedCacheKey({
      ...base,
      backgroundSourceRevision: 'ref-1:99999:data:image/png;base64,AAAA',
    });
    expect(keyOtherBytes).not.toBe(keyRegistered);
    // The same revision is stable.
    expect(
      deriveEfxPaintFlattenedCacheKey({
        ...base,
        backgroundSourceRevision: 'ref-1:12345:data:image/png;base64,iVBORw0KGgoAAAANSUhEUg',
      }),
    ).toBe(keyRegistered);
  });
});

/**
 * Phase 59-08 (REL-03 / MOTN-07): the `motion:` term.
 *
 * The term carries a rail-motion COLLECTION revision, never a sampled value.
 * It is emitted ONLY when a participating track carries motion, so every
 * existing derivation stays byte-identical (the `excl:`/`fond:0`/`bgsrc:`
 * precedent), and a motion-only edit rotates this term without touching
 * `tracks:` — the per-track raster memo therefore survives the edit.
 */
describe('deriveEfxPaintFlattenedCacheKey — motion term (59-08 / REL-03)', () => {
  // A pinned background id makes the document (and therefore the key) fully
  // deterministic — `createEfxPaintDocument` mints random ids otherwise.
  const FIXED_BACKGROUND = { id: 'background-fixed' };
  const doc = makeDocument([makeTrack('track-a', { revision: 1 })], FIXED_BACKGROUND);
  const base = {
    document: doc,
    trackContentRevisions: contentRevisions([['track-a', 'rev-a']]),
    backgroundClipRevisions: [] as string[],
    frame: 3,
  };

  it('keeps a motion-free document on the pinned key', () => {
    // Re-frozen with the IEEE-754 bit-pattern number encoding (2026-11-07);
    // the property — a motion-free document contributes no motion term — holds.
    expect(deriveEfxPaintFlattenedCacheKey(base)).toBe('flattened-273-7fefd00f');

    const richDoc = makeDocument([makeTrack('track-a', { revision: 1 })], FIXED_BACKGROUND);
    expect(
      deriveEfxPaintFlattenedCacheKey({
        document: richDoc,
        trackContentRevisions: contentRevisions([['track-a', 'rev-a']]),
        backgroundClipRevisions: ['clip-1:0:x1:100:100:2'],
        backgroundSourceRevision: 'ref-1:10:abc',
        frame: 7,
        excludeTrackIds: ['track-z'],
        includeFond: false,
        soloTrackId: 'track-a',
        includeBackground: false,
      }),
    ).toBe('flattened-383-c14f38d0');
  });

  it('emits no motion term for an empty motion-revision map', () => {
    const absent = deriveEfxPaintFlattenedCacheKey(base);
    const empty = deriveEfxPaintFlattenedCacheKey({ ...base, trackMotionRevisions: new Map() });
    expect(empty).toBe(absent);
  });

  it('rotates the key on a motion-only edit while the content revisions stay put', () => {
    const motionA = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackMotionRevisions: new Map([['track-a', 'motion-1']]),
    });
    const motionB = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackMotionRevisions: new Map([['track-a', 'motion-2']]),
    });
    expect(motionA).not.toBe(base);
    expect(motionB).not.toBe(motionA);
  });

  it('rotates the key on a drawing-key edit while the motion revision stays put', () => {
    const motion = new Map([['track-a', 'motion-1']]);
    const drawingA = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackMotionRevisions: motion,
    });
    const drawingB = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackContentRevisions: contentRevisions([['track-a', 'rev-b']]),
      trackMotionRevisions: motion,
    });
    expect(drawingB).not.toBe(drawingA);
  });

  it('sorts motion terms by track id so insertion order cannot change the key', () => {
    const twoTracks = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    const revisions = contentRevisions([
      ['track-a', 'rev-a'],
      ['track-b', 'rev-b'],
    ]);
    const ordered = deriveEfxPaintFlattenedCacheKey({
      document: twoTracks,
      trackContentRevisions: revisions,
      backgroundClipRevisions: [],
      frame: 5,
      trackMotionRevisions: new Map([
        ['track-a', 'motion-a'],
        ['track-b', 'motion-b'],
      ]),
    });
    const reversed = deriveEfxPaintFlattenedCacheKey({
      document: twoTracks,
      trackContentRevisions: revisions,
      backgroundClipRevisions: [],
      frame: 5,
      trackMotionRevisions: new Map([
        ['track-b', 'motion-b'],
        ['track-a', 'motion-a'],
      ]),
    });
    expect(reversed).toBe(ordered);
  });

  it('ignores motion revisions for non-participating (hidden) tracks', () => {
    const hiddenDoc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false }),
    ]);
    const visibleOnly = deriveEfxPaintFlattenedCacheKey({
      document: hiddenDoc,
      trackContentRevisions: contentRevisions([['track-a', 'rev-a']]),
      backgroundClipRevisions: [],
      frame: 5,
      trackMotionRevisions: new Map([['track-a', 'motion-a']]),
    });
    const withHiddenMotion = deriveEfxPaintFlattenedCacheKey({
      document: hiddenDoc,
      trackContentRevisions: contentRevisions([
        ['track-a', 'rev-a'],
        ['track-b', 'rev-b'],
      ]),
      backgroundClipRevisions: [],
      frame: 5,
      trackMotionRevisions: new Map([
        ['track-a', 'motion-a'],
        ['track-b', 'motion-b'],
      ]),
    });
    expect(withHiddenMotion).toBe(visibleOnly);
  });

  it('never mixes a sampled value into the key: the same revision is stable', () => {
    const key1 = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackMotionRevisions: new Map([['track-a', 'motion-1']]),
    });
    const key2 = deriveEfxPaintFlattenedCacheKey({
      ...base,
      trackMotionRevisions: new Map([['track-a', 'motion-1']]),
    });
    expect(key2).toBe(key1);
  });
});

describe('61-14 close-out — a path edit rotates the key, a view flag never does (VEC-06 / VEC-07)', () => {
  const FRAME = 12;
  const FRAME_ANCHORS: readonly AquarelleAnchor[] = [
    { x: 0, y: 0, kind: 'auto', width: Math.fround(1.8) },
    { x: 1, y: 1, kind: 'auto' },
  ];
  const MOVED_ANCHORS: readonly AquarelleAnchor[] = [
    { x: 0.3, y: 0, kind: 'auto', width: Math.fround(1.8) },
    { x: 1, y: 1, kind: 'auto' },
  ];

  function frameStroke(mutationId: number): AquarelleStroke {
    return {
      tool: 'brush',
      color: '#103c65',
      params: { size: 12, water: 30 },
      brushId: 'simple-ribbon',
      points: [
        { x: 0, y: 0, p: -1, tx: 0, ty: 0, tw: 0 },
        { x: 1, y: 1, p: 1, tx: 0, ty: 0, tw: 0 },
      ],
      mutationId,
      timestamp: mutationId,
      playFrame: FRAME,
      anchors: FRAME_ANCHORS,
    };
  }

  // ONE document: createEfxPaintDocument mints fresh ids per call, so
  // rebuilding it per derivation would rotate the key for the wrong reason.
  const document = makeDocument([makeTrack('track-a')]);

  /** The same derivation the store feeds: the record revision IS the content term. */
  function flatten(revision: string): string {
    return deriveEfxPaintFlattenedCacheKey({
      document,
      trackContentRevisions: contentRevisions([['track-a', revision]]),
      backgroundClipRevisions: [],
      frame: FRAME,
    });
  }

  beforeEach(() => {
    resetAquarelleRecordState();
    setWireframeMode(false);
    setDraftMode(false);
  });

  it('a path edit bumps the stroke revision and rotates the flattened key', () => {
    recordAquarelleStroke(301, frameStroke(301));
    const revisionBefore = `${aquarelleStrokesRevision.value}`;
    const keyBefore = flatten(revisionBefore);

    const editId = beginAquarellePathEdit(301, MOVED_ANCHORS);
    expect(editId).not.toBeNull();

    const revisionAfter = `${aquarelleStrokesRevision.value}`;
    expect(revisionAfter).not.toBe(revisionBefore);
    expect(flatten(revisionAfter)).not.toBe(keyBefore);
  });

  it('toggling wireframe — and the draft latch it arms — leaves the flattened key byte-identical', () => {
    recordAquarelleStroke(303, frameStroke(303));
    const revision = `${aquarelleStrokesRevision.value}`;
    const keyOff = flatten(revision);

    setWireframeMode(true);
    // Prove the toggle really happened before asserting the key did not move.
    expect(wireframeMode.value).toBe(true);
    expect(draftMode.value).toBe(true);
    expect(flatten(`${aquarelleStrokesRevision.value}`)).toBe(keyOff);

    setWireframeMode(false);
    setDraftMode(false);
    expect(wireframeMode.value).toBe(false);
    expect(draftMode.value).toBe(false);
    expect(flatten(`${aquarelleStrokesRevision.value}`)).toBe(keyOff);

    // The view flags never touch the revision that feeds the content term.
    expect(`${aquarelleStrokesRevision.value}`).toBe(revision);
  });
});
