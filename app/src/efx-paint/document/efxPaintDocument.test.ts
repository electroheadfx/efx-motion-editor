import { describe, expect, it } from 'vitest';
import { EFX_PAINT_DOCUMENT_VERSION, createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
