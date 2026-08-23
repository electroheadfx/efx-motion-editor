import { describe, expect, it } from 'vitest';
import { EFX_PAINT_DOCUMENT_VERSION, createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import {
  buildEfxPaintCompositeRevision,
  buildEfxPaintDocumentRevision,
  buildEfxPaintTrackRevision,
} from './efxPaintDocumentRevision';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function validDocumentJson(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc')));
}

describe('createEfxPaintDocument', () => {
  it('round-trips a factory-produced document through JSON serialize/parse', () => {
    const document = createEfxPaintDocument('layer-abc');
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed).toEqual(document);
  });

  it('creates a v1.0 document with one default Paint track and one fixed Background track', () => {
    const document = createEfxPaintDocument('layer-abc');
    expect(EFX_PAINT_DOCUMENT_VERSION).toBe(1);
    expect(document.version).toBe(EFX_PAINT_DOCUMENT_VERSION);
    expect(document.parentLayerId).toBe('layer-abc');
    expect(document.documentRevision).toBe(0);
    expect(document.compositeRevision).toBe(0);
    expect(document.tracks).toHaveLength(1);
    const track = document.tracks[0];
    expect(track.id).toMatch(UUID_PATTERN);
    expect(track.name).toBe('Track 1');
    expect(track.order).toBe(0);
    expect(track.visible).toBe(true);
    expect(track.solo).toBe(false);
    expect(track.opacity).toBe(1);
    expect(track.blendMode).toBe('normal');
    expect(track.revision).toBe(0);
    expect(document.activeTrackId).toBe(track.id);
    expect(document.photoReference).toBeNull();
    expect(document.background.id).toMatch(UUID_PATTERN);
    expect(document.background.clips).toEqual([]);
    expect(document.background.fallback).toEqual({ mode: 'transparent' });
    expect(document.background.visible).toBe(true);
    expect(document.background.revision).toBe(0);
  });

  it('deep-freezes the document, tracks, background, and fallback', () => {
    const document = createEfxPaintDocument('layer-abc');
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document.tracks)).toBe(true);
    expect(Object.isFrozen(document.background)).toBe(true);
    expect(Object.isFrozen(document.background.fallback)).toBe(true);
  });

  it('allocates fresh track and background IDs per factory call', () => {
    const first = createEfxPaintDocument('layer-abc');
    const second = createEfxPaintDocument('layer-abc');
    expect(second.tracks[0].id).not.toBe(first.tracks[0].id);
    expect(second.background.id).not.toBe(first.background.id);
  });
});

describe('parseEfxPaintDocument fail-closed behavior', () => {
  it('throws on unknown top-level members', () => {
    const value = validDocumentJson();
    value.extra = true;
    expect(() => parseEfxPaintDocument(value)).toThrow(/EfxPaintDocument: unknown members/);
  });

  it('throws on unknown members inside track, background, fallback, or loopClip records', () => {
    const withTrackMember = validDocumentJson();
    withTrackMember.tracks[0].extra = 1;
    expect(() => parseEfxPaintDocument(withTrackMember)).toThrow(/InternalPaintTrack: unknown members/);

    const withBackgroundMember = validDocumentJson();
    withBackgroundMember.background.extra = 1;
    expect(() => parseEfxPaintDocument(withBackgroundMember)).toThrow(/BackgroundTrack: unknown members/);

    const withFallbackMember = validDocumentJson();
    withFallbackMember.background.fallback.extra = 1;
    expect(() => parseEfxPaintDocument(withFallbackMember)).toThrow(/BackgroundTrack: transparent fallback must contain exactly mode/);

    const withLoopClipMember = validDocumentJson();
    withLoopClipMember.background.clips.push({
      id: 'clip-1',
      startFrame: 0,
      sourceFrameRefs: ['ref-1'],
      repeat: { mode: 'finite', count: 1 },
      sourceKind: 'playscript-hold',
      revision: 0,
      extra: true,
    });
    expect(() => parseEfxPaintDocument(withLoopClipMember)).toThrow(/FrameLoopClip: unknown members/);
  });

  it('throws on a version other than 1 (no migration, no normalization)', () => {
    const value = validDocumentJson();
    value.version = 2;
    expect(() => parseEfxPaintDocument(value)).toThrow(/unsupported version/);
  });

  it('throws on duplicate track ids', () => {
    const value = validDocumentJson();
    const duplicate = JSON.parse(JSON.stringify(value.tracks[0]));
    value.tracks.push(duplicate);
    expect(() => parseEfxPaintDocument(value)).toThrow(/duplicate track id/);
  });

  it('throws when activeTrackId references no existing track', () => {
    const value = validDocumentJson();
    value.activeTrackId = 'no-such-track';
    expect(() => parseEfxPaintDocument(value)).toThrow(/activeTrackId/);
  });

  it('throws on fallback modes outside the union and solid without a color', () => {
    const withBadMode = validDocumentJson();
    withBadMode.background.fallback = { mode: 'striped' };
    expect(() => parseEfxPaintDocument(withBadMode)).toThrow(/fallback/);

    const withSolidNoColor = validDocumentJson();
    withSolidNoColor.background.fallback = { mode: 'solid' };
    expect(() => parseEfxPaintDocument(withSolidNoColor)).toThrow(/fallback/);
  });

  it('throws on non-record input', () => {
    expect(() => parseEfxPaintDocument(null)).toThrow(/expected a record/);
    expect(() => parseEfxPaintDocument([])).toThrow(/expected a record/);
    expect(() => parseEfxPaintDocument('layer-abc')).toThrow(/expected a record/);
  });

  it('never allocates IDs or normalizes — member order does not change the parsed document', () => {
    const canonical = parseEfxPaintDocument(validDocumentJson());
    const reordered = JSON.parse(JSON.stringify({
      compositeRevision: 0,
      photoReference: null,
      background: {
        revision: 0,
        visible: true,
        fallback: { mode: 'transparent' },
        clips: [],
        id: canonical.background.id,
      },
      tracks: [{
        loopClips: [],
        rotoPhysical: null,
        frames: {},
        revision: 0,
        blendMode: 'normal',
        opacity: 1,
        solo: false,
        visible: true,
        order: 0,
        name: 'Track 1',
        id: canonical.tracks[0].id,
      }],
      activeTrackId: canonical.activeTrackId,
      documentRevision: 0,
      parentLayerId: 'layer-abc',
      version: 1,
    }));
    expect(parseEfxPaintDocument(reordered)).toEqual(canonical);
  });
});

describe('revision builders', () => {
  it('buildEfxPaintDocumentRevision returns a prefixed string and is pure', () => {
    const document = createEfxPaintDocument('layer-abc');
    const revision = buildEfxPaintDocumentRevision(document);
    expect(revision).toMatch(/^efxdoc-\d+-[0-9a-f]+$/);
    expect(buildEfxPaintDocumentRevision(document)).toBe(revision);
  });

  it('produces identical revisions for identical content with different member order', () => {
    const document = createEfxPaintDocument('layer-abc');
    const canonical = JSON.parse(JSON.stringify(document));
    const reordered = JSON.parse(JSON.stringify({
      compositeRevision: 0,
      photoReference: null,
      background: {
        revision: 0,
        visible: true,
        fallback: { mode: 'transparent' },
        clips: [],
        id: canonical.background.id,
      },
      tracks: [{
        loopClips: [],
        rotoPhysical: null,
        frames: {},
        revision: 0,
        blendMode: 'normal',
        opacity: 1,
        solo: false,
        visible: true,
        order: 0,
        name: 'Track 1',
        id: canonical.tracks[0].id,
      }],
      activeTrackId: canonical.activeTrackId,
      documentRevision: 0,
      parentLayerId: 'layer-abc',
      version: 1,
    }));
    expect(buildEfxPaintDocumentRevision(reordered)).toBe(buildEfxPaintDocumentRevision(canonical));
  });

  it('is sensitive to track id, track revision, fallback mode, and activeTrackId', () => {
    const base = createEfxPaintDocument('layer-abc');
    const baseRevision = buildEfxPaintDocumentRevision(base);

    const withNewTrackId = JSON.parse(JSON.stringify(base));
    withNewTrackId.tracks[0].id = 'track-2';
    withNewTrackId.activeTrackId = 'track-2';
    expect(buildEfxPaintDocumentRevision(withNewTrackId)).not.toBe(baseRevision);

    const withTrackRevision = JSON.parse(JSON.stringify(base));
    withTrackRevision.tracks[0].revision = 1;
    expect(buildEfxPaintDocumentRevision(withTrackRevision)).not.toBe(baseRevision);

    const withSolidFallback = JSON.parse(JSON.stringify(base));
    withSolidFallback.background.fallback = { mode: 'solid', color: '#ff0000' };
    expect(buildEfxPaintDocumentRevision(withSolidFallback)).not.toBe(baseRevision);

    const twoTrack = JSON.parse(JSON.stringify(base));
    const secondTrack = JSON.parse(JSON.stringify(base.tracks[0]));
    secondTrack.id = 'track-2';
    twoTrack.tracks.push(secondTrack);
    const withActiveA = buildEfxPaintDocumentRevision(twoTrack);
    twoTrack.activeTrackId = 'track-2';
    expect(buildEfxPaintDocumentRevision(twoTrack)).not.toBe(withActiveA);
  });

  it('treats empty loopClips and frames as contributing no term', () => {
    const withEmpty = createEfxPaintDocument('layer-abc');
    const without = JSON.parse(JSON.stringify(withEmpty));
    delete without.tracks[0].frames;
    delete without.tracks[0].loopClips;
    expect(buildEfxPaintDocumentRevision(without)).toBe(buildEfxPaintDocumentRevision(withEmpty));
  });

  it('builds deterministic, sensitive track and composite revisions', () => {
    const document = createEfxPaintDocument('layer-abc');
    const track = document.tracks[0];

    const trackRevision = buildEfxPaintTrackRevision(track);
    expect(trackRevision).toMatch(/^track-\d+-[0-9a-f]+$/);
    expect(buildEfxPaintTrackRevision(track)).toBe(trackRevision);
    const changedTrack = { ...track, revision: 1 };
    expect(buildEfxPaintTrackRevision(changedTrack)).not.toBe(trackRevision);

    const compositeRevision = buildEfxPaintCompositeRevision(document);
    expect(compositeRevision).toMatch(/^composite-\d+-[0-9a-f]+$/);
    expect(buildEfxPaintCompositeRevision(document)).toBe(compositeRevision);
    const changedComposite = JSON.parse(JSON.stringify(document));
    changedComposite.tracks[0].opacity = 0.5;
    expect(buildEfxPaintCompositeRevision(changedComposite)).not.toBe(compositeRevision);
  });
});
