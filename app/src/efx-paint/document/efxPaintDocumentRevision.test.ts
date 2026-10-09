/**
 * 261008-ig1 Task 1 RED — audios-list fingerprint rotation with stable revision.
 *
 * Legs:
 * - (t1) an audios-member edit rotates buildEfxPaintDocumentSyncFingerprint while
 *   buildEfxPaintDocumentRevision stays byte-identical (SYNC-01, T-52.5-02:
 *   clip edits ship through the sync guards, never through the pixel revision).
 * - (t2) an EMPTY audios list appends an EMPTY `|audios:` term (photoDisplay
 *   idiom).
 * - (t3) encodeCanonicalAudios serializes the list canonically: length-prefixed,
 *   per-clip full-field encoding, same output for equal lists regardless of
 *   member insertion order inside a clip, distinct output when ANY field of ANY
 *   clip changes, and array ORDER is canonical (swap two clips -> rotate).
 * - (t4) [Rule 2 — PERSIST-01] an audios-only edit rotates the savePackage
 *   layer change-token value: the authoritative layer write gate is
 *   `${documentRevision}+${compositeRevision}`, both of which stay put for a
 *   display-class clip edit, so without an audios term the layers/<id>.json
 *   write is skipped and save/reopen silently drops the clips.
 *
 * TDD RED first: these assertions fail against the singleton-era surface
 * (fingerprint has a `sound:` term, not `audios:`; encodeCanonicalAudios and
 * the audios-aware layer change-token builder do not exist yet). Dynamic
 * `await import()` inside the test bodies keeps each failing test's own name
 * in the TAP report (01a pattern) — no collection-level load failure.
 */

import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import type { DocumentSoundClip, EfxPaintDocument } from './efxPaintDocument';

/** Baseline clip — every field populated (full-field-set contract). */
const CLIP: DocumentSoundClip = {
  id: 'snd-clip-1',
  sourceId: 'asset-1',
  relativePath: 'audio/scene-one.wav',
  sourceRevision: 3,
  startFrame: 12,
  inFrame: 0,
  outFrame: 48,
  gain: 0,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  fadeInCurve: 'linear',
  fadeOutCurve: 'linear',
  enabled: true,
};

/** Second clip sharing CLIP.sourceId — the alt+drag duplicate identity law. */
const CLIP_B: DocumentSoundClip = { ...CLIP, id: 'snd-clip-2', startFrame: 120 };

/**
 * One shared factory call for the WHOLE test run: two factory calls would mint
 * fresh background/track UUIDs and make every A/B comparison vacuously
 * unequal (260922-rd4 lesson). The document with EXACTLY the given audios
 * member, everything else identical.
 */
const BASE_DOC = createEfxPaintDocument('layer-snd-rev');

function docWithAudios(audios: readonly DocumentSoundClip[]): EfxPaintDocument {
  return { ...BASE_DOC, audios };
}

/** The same record with one field overridden (canonical-A/B pair builder). */
function clipWith(patch: Partial<DocumentSoundClip>): DocumentSoundClip {
  return { ...CLIP, ...patch };
}

/** An encoder duck-type: absent until GREEN defines the real export. */
interface RevisionModuleWithAudios {
  buildEfxPaintDocumentRevision: (value: unknown) => string;
  buildEfxPaintDocumentSyncFingerprint: (value: unknown) => string;
  buildEfxPaintCompositeRevision: (value: unknown) => string;
  encodeCanonicalAudios?: (audios: readonly DocumentSoundClip[]) => string;
}

describe('audios sync-fingerprint rotation with stable revision (261008-ig1 Task 1 RED)', () => {
  it('(t1) an audios edit rotates buildEfxPaintDocumentSyncFingerprint while the document revision stays put', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithAudios;
    const quiet = docWithAudios([clipWith({ gain: 0 })]);
    const loud = docWithAudios([clipWith({ gain: 42 })]);

    // Root-cause precondition: the audios member is EXCLUDED from the canonical
    // document revision (clip edits must never rotate pixel/cache keys) —
    // asserted so a future revision widening fails loudly here instead of
    // silently re-scoping t1.
    expect(module.buildEfxPaintDocumentRevision(loud))
      .toBe(module.buildEfxPaintDocumentRevision(quiet));

    // THE RED: today the sync fingerprint ends with a `sound:` term (or none),
    // so an audios-only edit is dropped and the two fingerprints match.
    expect(module.buildEfxPaintDocumentSyncFingerprint(loud))
      .not.toBe(module.buildEfxPaintDocumentSyncFingerprint(quiet));
  });

  it('(t2) an empty audios list appends an empty |audios: term as the LAST fingerprint term', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithAudios;
    const emptyDoc = docWithAudios([]);

    // THE RED: the fingerprint carries no audios term at all, so it cannot end
    // with the empty `|audios:` suffix (photoDisplay idiom: empty -> '').
    expect(module.buildEfxPaintDocumentSyncFingerprint(emptyDoc).endsWith('|audios:')).toBe(true);
  });

  it('(t3) encodeCanonicalAudios serializes the list canonically, order-sensitive', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithAudios;
    const encode = module.encodeCanonicalAudios;

    // THE RED: the encoder does not exist yet.
    expect(typeof encode).toBe('function');

    const encoded = encode!([CLIP]);

    // Canonical: member insertion order inside a clip never changes the output.
    const reordered = Object.fromEntries(Object.entries(CLIP).reverse()) as DocumentSoundClip;
    expect(encode!([reordered])).toBe(encoded);

    // Empty list -> empty term (photoDisplay idiom).
    expect(encode!([])).toBe('');

    // Array ORDER is canonical: swapping two distinct clips rotates the output.
    expect(encode!([CLIP, CLIP_B])).not.toBe(encode!([CLIP_B, CLIP]));

    // A second clip is not a no-op: the list shape carries every entry.
    expect(encode!([CLIP, CLIP_B])).not.toBe(encoded);

    // FULL field set: every single field change must rotate the output —
    // a field dropped from the encoding is a fingerprint hole.
    const distinctPatches: readonly Partial<DocumentSoundClip>[] = [
      { id: 'snd-clip-2' },
      { sourceId: 'asset-2' },
      { relativePath: 'audio/scene-two.wav' },
      { sourceRevision: 4 },
      { startFrame: 13 },
      { inFrame: 1 },
      { outFrame: 49 },
      { gain: 42 },
      { fadeInFrames: 5 },
      { fadeOutFrames: 7 },
      { fadeInCurve: 'exponential' },
      { fadeOutCurve: 'logarithmic' },
      { enabled: false },
    ];
    for (const patch of distinctPatches) {
      expect(encode!([clipWith(patch)])).not.toBe(encoded);
    }
  });
});

describe('save layer change token — audios-only edit rotation (261008-ig1 Rule 2, PERSIST-01)', () => {
  it('(t4) an audios-only edit rotates the layer change-token value while both revision legs stay put', async () => {
    const revision = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithAudios;
    const persistence = (await import('../../lib/efxPaintPersistence')) as {
      buildEfxPaintLayerChangeTokenValue?: (
        documentRevision: string,
        compositeRevision: string,
        audios: readonly DocumentSoundClip[],
      ) => string;
    };
    const build = persistence.buildEfxPaintLayerChangeTokenValue;

    // THE RED: the authoritative save gate composes
    // `${documentRevision}+${compositeRevision}` inline — the singleton-era
    // builder takes `sound: DocumentSoundClip | null`, so an audios list cannot
    // rotate it and a clip-only edit dedupes as a no-op save (the layer
    // sub-file never reaches the package; save/reopen would drop the clips).
    expect(typeof build).toBe('function');

    const withoutAudio = docWithAudios([]);
    const withAudio = docWithAudios([CLIP]);

    // Both revision legs stay put across the audios edit (the whole reason the
    // token needs its own term).
    expect(revision.buildEfxPaintDocumentRevision(withAudio))
      .toBe(revision.buildEfxPaintDocumentRevision(withoutAudio));
    expect(revision.buildEfxPaintCompositeRevision(withAudio))
      .toBe(revision.buildEfxPaintCompositeRevision(withoutAudio));

    const tokenWithout = build!(
      revision.buildEfxPaintDocumentRevision(withoutAudio),
      revision.buildEfxPaintCompositeRevision(withoutAudio),
      withoutAudio.audios,
    );
    const tokenWith = build!(
      revision.buildEfxPaintDocumentRevision(withAudio),
      revision.buildEfxPaintCompositeRevision(withAudio),
      withAudio.audios,
    );
    expect(tokenWith).not.toBe(tokenWithout);

    // Idempotence: the same clips at the same revisions yield the same token,
    // so an identical re-save still dedupes to a no-op (D-11 preserved).
    const tokenWithAgain = build!(
      revision.buildEfxPaintDocumentRevision(withAudio),
      revision.buildEfxPaintCompositeRevision(withAudio),
      [clipWith({ gain: 0 })],
    );
    expect(tokenWithAgain).toBe(tokenWith);
  });
});
