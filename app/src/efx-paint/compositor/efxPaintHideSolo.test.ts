/**
 * Hide/solo truth-table contract tests (Phase 48-01 Task 1 — RED; quick
 * 261022-iff extends it with the session solo target).
 *
 * CMP-02 / D-04: the pure `participatingPaintTracks` predicate is the single
 * source of truth for which Paint tracks join the flattened composite, and the
 * fixed Background track is governed ONLY by its own `visible` flag.
 *
 * 261022-iff IFF-02..05: the optional `soloTrackId` is the session focus (the
 * document's active track). When present only that track participates; hide
 * always wins; the persisted `track.solo` flag is inert; an unknown target
 * fails closed.
 */

import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../document/efxPaintDocument';
import { backgroundParticipates, participatingPaintTracks } from './efxPaintHideSolo';

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

describe('participatingPaintTracks — hide/solo truth table (CMP-02)', () => {
  it('no solo armed → every track with visible !== false participates, order ascending', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
      makeTrack('track-c', { order: 2, visible: false }),
    ]);
    expect(participatingPaintTracks(doc).map((track) => track.id)).toEqual(['track-a', 'track-b']);
  });

  it('IFF-02: a solo target → exactly that track participates', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    expect(participatingPaintTracks(doc, 'track-a').map((track) => track.id)).toEqual(['track-a']);
    expect(participatingPaintTracks(doc, 'track-b').map((track) => track.id)).toEqual(['track-b']);
  });

  it('IFF-05: hide wins over solo — a hidden solo target means NO track participates (D-04)', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false }),
    ]);
    expect(participatingPaintTracks(doc, 'track-b').map((track) => track.id)).toEqual([]);
  });

  it('IFF-04: the persisted `solo: true` flag is inert — an unrelated soloed track never participates', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, solo: true }),
    ]);
    expect(participatingPaintTracks(doc, 'track-a').map((track) => track.id)).toEqual(['track-a']);
    // …and with NO target, the persisted flag arms nothing: every visible track stays in.
    expect(participatingPaintTracks(doc).map((track) => track.id)).toEqual(['track-a', 'track-b']);
  });

  it('IFF-02: an unknown solo target fails closed (no participation)', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1 }),
    ]);
    expect(participatingPaintTracks(doc, 'not-a-track').map((track) => track.id)).toEqual([]);
  });

  it('IFF-02: omitted and explicit-null targets are byte-identical to the pre-change result', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0 }),
      makeTrack('track-b', { order: 1, visible: false }),
      makeTrack('track-c', { order: 2 }),
    ]);
    const omitted = participatingPaintTracks(doc).map((track) => track.id);
    expect(omitted).toEqual(['track-a', 'track-c']);
    expect(participatingPaintTracks(doc, null).map((track) => track.id)).toEqual(omitted);
  });

  it('order ties break deterministically by track.id localeCompare — never insertion order (edge CMP-01/CMP-02 ordering)', () => {
    const doc = makeDocument([
      makeTrack('track-b', { order: 5 }),
      makeTrack('track-a', { order: 5 }),
    ]);
    expect(participatingPaintTracks(doc).map((track) => track.id)).toEqual(['track-a', 'track-b']);
  });

  it('Background participation is governed only by background.visible — never the Paint solo target (D-04)', () => {
    const soloDoc = makeDocument([
      makeTrack('track-a'),
      makeTrack('track-b'),
    ]);
    expect(backgroundParticipates(soloDoc)).toBe(true);

    const hiddenBackground = makeDocument([makeTrack('track-a')], { visible: false });
    expect(backgroundParticipates(hiddenBackground)).toBe(false);
  });
});
