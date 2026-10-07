/**
 * 52.5-01b Task 1 RED — sound fingerprint rotation with stable revision.
 *
 * Legs:
 * - (t1) a sound-member edit rotates buildEfxPaintDocumentSyncFingerprint while
 *   buildEfxPaintDocumentRevision stays byte-identical (SYNC-01, T-52.5-02:
 *   clip edits ship through the sync guards, never through the pixel revision).
 * - (t2) `sound: null` appends an EMPTY `|sound:` term (photoDisplay idiom).
 * - (t3) encodeCanonicalSound serializes the FULL DocumentSoundClip field set
 *   canonically: same output for equal records regardless of member insertion
 *   order, distinct output when ANY field changes (incl. gain and in/out).
 * - (t4) [Rule 2 — PERSIST-01] a sound-only edit rotates the savePackage
 *   layer change-token value: the authoritative layer write gate is
 *   `${documentRevision}+${compositeRevision}`, both of which stay put for a
 *   display-class sound edit, so without a sound term the layers/<id>.json
 *   write is skipped and save/reopen silently drops the clip.
 *
 * TDD RED first: these assertions fail against the pre-01b surface (fingerprint
 * has no sound term; encodeCanonicalSound and the layer change-token builder do
 * not exist yet). Dynamic `await import()` inside the test bodies keeps each
 * failing test's own name in the TAP report (01a pattern) — no collection-level
 * load failure.
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

/**
 * One shared factory call for the WHOLE test run: two factory calls would mint
 * fresh background/track UUIDs and make every A/B comparison vacuously
 * unequal (260922-rd4 lesson). The document with EXACTLY the given sound
 * member, everything else identical.
 */
const BASE_DOC = createEfxPaintDocument('layer-snd-rev');

function docWithSound(sound: DocumentSoundClip | null): EfxPaintDocument {
  return { ...BASE_DOC, sound };
}

/** The same record with one field overridden (canonical-A/B pair builder). */
function clipWith(patch: Partial<DocumentSoundClip>): DocumentSoundClip {
  return { ...CLIP, ...patch };
}

/** A 01b-encoder duck-type: absent until GREEN defines the real export. */
interface RevisionModuleWithSound {
  buildEfxPaintDocumentRevision: (value: unknown) => string;
  buildEfxPaintDocumentSyncFingerprint: (value: unknown) => string;
  buildEfxPaintCompositeRevision: (value: unknown) => string;
  encodeCanonicalSound?: (sound: DocumentSoundClip | null) => string;
}

describe('sound sync-fingerprint rotation with stable revision (52.5-01b Task 1 RED)', () => {
  it('(t1) a sound edit rotates buildEfxPaintDocumentSyncFingerprint while the document revision stays put', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithSound;
    const quiet = docWithSound(clipWith({ gain: 0 }));
    const loud = docWithSound(clipWith({ gain: 42 }));

    // Root-cause precondition: the sound member is EXCLUDED from the canonical
    // document revision (clip edits must never rotate pixel/cache keys) —
    // asserted so a future revision widening fails loudly here instead of
    // silently re-scoping t1.
    expect(module.buildEfxPaintDocumentRevision(loud))
      .toBe(module.buildEfxPaintDocumentRevision(quiet));

    // THE RED: today the sync fingerprint = revision + photoDisplay + bgDisplay,
    // so a sound-only edit is dropped and the two fingerprints match.
    expect(module.buildEfxPaintDocumentSyncFingerprint(loud))
      .not.toBe(module.buildEfxPaintDocumentSyncFingerprint(quiet));
  });

  it('(t2) sound: null appends an empty |sound: term as the LAST fingerprint term', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithSound;
    const nullDoc = docWithSound(null);

    // THE RED: the fingerprint carries no sound term at all, so it cannot end
    // with the empty `|sound:` suffix (photoDisplay idiom: null -> '').
    expect(module.buildEfxPaintDocumentSyncFingerprint(nullDoc).endsWith('|sound:')).toBe(true);
  });

  it('(t3) encodeCanonicalSound serializes the full field set canonically', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithSound;
    const encode = module.encodeCanonicalSound;

    // THE RED: the encoder does not exist yet.
    expect(typeof encode).toBe('function');

    const encoded = encode!(CLIP);

    // Canonical: member insertion order never changes the output.
    const reordered = Object.fromEntries(Object.entries(CLIP).reverse()) as DocumentSoundClip;
    expect(encode!(reordered)).toBe(encoded);

    // A null clip contributes an empty term (photoDisplay idiom).
    expect(encode!(null)).toBe('');

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
      expect(encode!(clipWith(patch))).not.toBe(encoded);
    }
  });
});

describe('save layer change token — sound-only edit rotation (52.5-01b Rule 2, PERSIST-01)', () => {
  it('(t4) a sound-only edit rotates the layer change-token value while both revision legs stay put', async () => {
    const revision = (await import('./efxPaintDocumentRevision')) as RevisionModuleWithSound;
    const persistence = (await import('../../lib/efxPaintPersistence')) as {
      buildEfxPaintLayerChangeTokenValue?: (
        documentRevision: string,
        compositeRevision: string,
        sound: DocumentSoundClip | null,
      ) => string;
    };
    const build = persistence.buildEfxPaintLayerChangeTokenValue;

    // THE RED: the authoritative save gate composes
    // `${documentRevision}+${compositeRevision}` inline — no sound-aware builder
    // exists, so a sound-only edit dedupes as a no-op save and the layer
    // sub-file never reaches the package (save/reopen would drop the clip).
    expect(typeof build).toBe('function');

    const withoutSound = docWithSound(null);
    const withSound = docWithSound(CLIP);

    // Both revision legs stay put across the sound edit (the whole reason the
    // token needs its own term).
    expect(revision.buildEfxPaintDocumentRevision(withSound))
      .toBe(revision.buildEfxPaintDocumentRevision(withoutSound));
    expect(revision.buildEfxPaintCompositeRevision(withSound))
      .toBe(revision.buildEfxPaintCompositeRevision(withoutSound));

    const tokenWithout = build!(
      revision.buildEfxPaintDocumentRevision(withoutSound),
      revision.buildEfxPaintCompositeRevision(withoutSound),
      withoutSound.sound,
    );
    const tokenWith = build!(
      revision.buildEfxPaintDocumentRevision(withSound),
      revision.buildEfxPaintCompositeRevision(withSound),
      withSound.sound,
    );
    expect(tokenWith).not.toBe(tokenWithout);

    // Idempotence: the same clip at the same revisions yields the same token,
    // so an identical re-save still dedupes to a no-op (D-11 preserved).
    const tokenWithAgain = build!(
      revision.buildEfxPaintDocumentRevision(withSound),
      revision.buildEfxPaintCompositeRevision(withSound),
      clipWith({ gain: 0 }),
    );
    expect(tokenWithAgain).toBe(tokenWith);
  });
});
