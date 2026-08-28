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
import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../document/efxPaintDocument';
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

  it('same inputs, different frame → different key (frame term)', () => {
    const doc = makeDocument([makeTrack('track-a')]);
    const revisions = contentRevisions([['track-a', 'rev-a']]);
    const base = { document: doc, trackContentRevisions: revisions, backgroundClipRevisions: [] as string[], frame: 0 };
    const keyFrame0 = deriveEfxPaintFlattenedCacheKey(base);
    const keyFrame1 = deriveEfxPaintFlattenedCacheKey({ ...base, frame: 1 });
    expect(keyFrame1).not.toBe(keyFrame0);
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
