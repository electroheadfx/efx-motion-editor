/**
 * Hide/solo truth-table contract tests (Phase 48-01 Task 1 — RED).
 *
 * CMP-02 / D-04: the pure `participatingPaintTracks` predicate is the single
 * source of truth for which Paint tracks join the flattened composite, and the
 * fixed Background track is governed ONLY by its own `visible` flag.
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

  it('any solo armed → only visible AND soloed tracks participate', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0, solo: true }),
      makeTrack('track-b', { order: 1 }),
      makeTrack('track-c', { order: 2, solo: true }),
    ]);
    expect(participatingPaintTracks(doc).map((track) => track.id)).toEqual(['track-a', 'track-c']);
  });

  it('hide always wins over solo — a hidden AND soloed track is excluded (edge CMP-02 adjacency)', () => {
    const doc = makeDocument([
      makeTrack('track-a', { order: 0, visible: false, solo: true }),
      makeTrack('track-b', { order: 1 }),
    ]);
    expect(participatingPaintTracks(doc).map((track) => track.id)).toEqual(['track-b']);
  });

  it('order ties break deterministically by track.id localeCompare — never insertion order (edge CMP-01/CMP-02 ordering)', () => {
    const doc = makeDocument([
      makeTrack('track-b', { order: 5 }),
      makeTrack('track-a', { order: 5 }),
    ]);
    expect(participatingPaintTracks(doc).map((track) => track.id)).toEqual(['track-a', 'track-b']);
  });

  it('Background participation is governed only by background.visible — never the Paint solo table (D-04)', () => {
    const soloDoc = makeDocument([
      makeTrack('track-a', { solo: true }),
      makeTrack('track-b', { solo: true }),
    ]);
    expect(backgroundParticipates(soloDoc)).toBe(true);

    const hiddenBackground = makeDocument([makeTrack('track-a')], { visible: false });
    expect(backgroundParticipates(hiddenBackground)).toBe(false);
  });
});
