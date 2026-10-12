/**
 * 261012-c9a Task 1 RED — display-class save-token rotation.
 *
 * Requirements: SAVE-01 (background transform + background lock-only survive
 * save → close → reopen), SAVE-02 (photo-reference display prefs do too),
 * SAVE-03 (the regression suite saves TWICE per case — the first save masks the
 * bug). Known Gaps closed by this quick: PKG-06 (Phase 52.2) and BKG-09
 * (Phase 49).
 *
 * Why the bug exists: `visibleInStudio` / `opacity` / `transform` /
 * `transformLocked` (photo) and `transform` / `transformLocked` (background)
 * are excluded from BOTH revision legs by design (D-07 vs D-11/D-12/D-13), so
 * after a settled save the second save computes an empty change set,
 * `layers/<layerId>.json` is never rewritten, and reopen silently reverts the
 * edit. The three change-detection carriers — the layer change token, the save
 * fingerprint and the sync fingerprint — must therefore rotate on every
 * display-class edit while both revision legs STAY PUT.
 *
 * TDD RED first: this file is test-only. Against the pre-fix builders the
 * `encodeCanonicalPhotoReferenceDisplay` export does not exist yet (module-
 * private), `encodeCanonicalBackgroundDisplay` does not exist at all, and the
 * layer change token takes an audios ARRAY where this suite passes the parsed
 * document — so that leg fails HARD (a TypeError from `encodeCanonicalAudios`
 * receiving a document) and that throw IS the red evidence for the token leg.
 * The not-yet-existing surfaces are reached through the t4 house idiom:
 * dynamic `await import()` inside the test body cast to a local duck-type
 * interface, so each RED failure keeps its own test name instead of killing
 * collection.
 *
 * Pair-building law (260922-rd4): EVERY A/B pair derives from ONE
 * `createEfxPaintDocument('layer-261012-c9a')` call — a second factory call
 * mints fresh background/track UUIDs and makes every comparison vacuously
 * unequal. The baseline carries a populated `photoReference` (the factory
 * default is `photoReference: null`, and a null track contributes an EMPTY
 * term, which would make the four photo legs vacuous).
 */
import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import type {
  BackgroundTrack,
  EfxPaintDocument,
  PhotoReferenceTrack,
  PhotoReferenceTransform,
} from './efxPaintDocument';
import {
  buildEfxPaintCompositeRevision,
  buildEfxPaintDocumentRevision,
  buildEfxPaintDocumentSyncFingerprint,
  encodeCanonicalBackgroundTransform,
} from './efxPaintDocumentRevision';
import { buildEfxPaintSaveFingerprint } from '../../lib/efxPaintPersistence';
import type { EfxPaintDocumentSaveInput } from '../../lib/efxPaintPersistence';

/** The one factory call the whole file's A/B pairs derive from. */
const BASE: EfxPaintDocument = {
  ...createEfxPaintDocument('layer-261012-c9a'),
  photoReference: {
    id: 'photo-261012-c9a',
    sourceFrameRefs: ['asset-a'],
    revision: 0,
    visibleInStudio: true,
    opacity: 0.75,
    transform: { x: 0.1, y: -0.2, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: false,
  },
};

/** The display-class slice of a document — what a display edit may move. */
interface DisplaySnapshot {
  readonly photo: {
    readonly visibleInStudio: boolean;
    readonly opacity: number;
    readonly transform: PhotoReferenceTransform;
    readonly transformLocked: boolean;
  } | null;
  readonly background: {
    readonly transform: PhotoReferenceTransform;
    readonly transformLocked: boolean;
  };
}

function displaySnapshot(document: EfxPaintDocument): DisplaySnapshot {
  const photo: PhotoReferenceTrack | null = document.photoReference;
  return {
    photo: photo === null
      ? null
      : {
          visibleInStudio: photo.visibleInStudio,
          opacity: photo.opacity,
          transform: { ...photo.transform },
          transformLocked: photo.transformLocked,
        },
    background: {
      transform: { ...document.background.transform },
      transformLocked: document.background.transformLocked,
    },
  };
}

/** One display-field edit: a label and a patch touching EXACTLY ONE field. */
interface DisplayCase {
  readonly label: string;
  readonly patch: (document: EfxPaintDocument) => EfxPaintDocument;
}

const PHOTO_TRACK = (document: EfxPaintDocument): PhotoReferenceTrack => {
  const photo = document.photoReference;
  if (photo === null) throw new Error('baseline document has no photoReference');
  return photo;
};

/** The six display fields — the plan's `<feature><behavior>` case list verbatim. */
const DISPLAY_CASES: readonly DisplayCase[] = [
  {
    label: 'photo-visibleInStudio',
    patch: (document) => ({
      ...document,
      photoReference: { ...PHOTO_TRACK(document), visibleInStudio: false },
    }),
  },
  {
    label: 'photo-opacity',
    patch: (document) => ({
      ...document,
      photoReference: { ...PHOTO_TRACK(document), opacity: 0.35 },
    }),
  },
  {
    label: 'photo-transform',
    patch: (document) => ({
      ...document,
      photoReference: {
        ...PHOTO_TRACK(document),
        transform: { x: 40, y: -20, scaleX: 1.5, scaleY: 1.5, rotation: 15 },
      },
    }),
  },
  {
    label: 'photo-transformLocked',
    patch: (document) => ({
      ...document,
      photoReference: { ...PHOTO_TRACK(document), transformLocked: true },
    }),
  },
  {
    label: 'background-transform',
    patch: (document) => ({
      ...document,
      background: {
        ...document.background,
        transform: { x: 12, y: -8, scaleX: 1.25, scaleY: 1.25, rotation: 30 },
      },
    }),
  },
  {
    label: 'background-transformLocked',
    patch: (document) => ({
      ...document,
      background: { ...document.background, transformLocked: false },
    }),
  },
];

/** Save-fingerprint input shape: one layer, no runtime frames (document terms only). */
function saveInputs(document: EfxPaintDocument): ReadonlyMap<string, EfxPaintDocumentSaveInput> {
  return new Map([[BASE.parentLayerId, { document, frames: new Map() }]]);
}

/** Encoder duck-types: absent until GREEN defines the real exports. */
interface RevisionModuleWithDisplayEncoders {
  encodeCanonicalPhotoReferenceDisplay?: (track: PhotoReferenceTrack | null) => string;
  encodeCanonicalBackgroundDisplay?: (background: BackgroundTrack) => string;
}

/**
 * The grown token builder: `(documentRevision, compositeRevision, document)`.
 * `as unknown as` because at RED the live export still takes the audios ARRAY
 * as its third parameter — casting directly to the document-taking shape would
 * be a TS2352 conversion error and kill collection before any leg runs.
 */
interface PersistenceModuleWithDocumentToken {
  buildEfxPaintLayerChangeTokenValue?: (
    documentRevision: string,
    compositeRevision: string,
    document: EfxPaintDocument,
  ) => string;
}

describe('display-class save token — unit rotation pins (261012-c9a Task 1 RED)', () => {
  it('(encoders) encodeCanonicalPhotoReferenceDisplay and encodeCanonicalBackgroundDisplay exist as functions', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as unknown as RevisionModuleWithDisplayEncoders;

    // THE RED: the photo encoder is module-private and the background composer
    // does not exist at all.
    expect(typeof module.encodeCanonicalPhotoReferenceDisplay).toBe('function');
    expect(typeof module.encodeCanonicalBackgroundDisplay).toBe('function');
  });

  it('(single-encoder) the bare transform encoder is byte-identical across a lock-only change while the composer rotates', () => {
    const locked: BackgroundTrack = { ...BASE.background, transformLocked: true };
    const unlocked: BackgroundTrack = { ...BASE.background, transformLocked: false };

    // Non-regression (T-261012-C9A-02): the flattened cache key's `bgtransform:`
    // term calls the BARE encoder, so a lock flip must never rebake the
    // composite — this pin holds before AND after the fix.
    expect(encodeCanonicalBackgroundTransform(unlocked.transform))
      .toBe(encodeCanonicalBackgroundTransform(locked.transform));
  });

  it('(single-encoder) the background display composer appends the lock the bare encoder excludes', async () => {
    const module = (await import('./efxPaintDocumentRevision')) as unknown as RevisionModuleWithDisplayEncoders;
    const locked: BackgroundTrack = { ...BASE.background, transformLocked: true };
    const unlocked: BackgroundTrack = { ...BASE.background, transformLocked: false };

    // THE RED: the composer does not exist yet.
    expect(typeof module.encodeCanonicalBackgroundDisplay).toBe('function');

    const composer = module.encodeCanonicalBackgroundDisplay!;
    const lockedTerm = composer(locked);
    // Delegation, never re-encoding (single-encoder law T-49-03-02): the
    // composer's output STARTS FROM the bare encoder's output.
    expect(lockedTerm.startsWith(encodeCanonicalBackgroundTransform(locked.transform))).toBe(true);
    // The lock half: two backgrounds differing ONLY in the lock rotate.
    expect(composer(unlocked)).not.toBe(lockedTerm);
    // And a no-op input is stable (D-11 no-op contract).
    expect(composer(locked)).toBe(lockedTerm);
  });

  for (const displayCase of DISPLAY_CASES) {
    it(`(${displayCase.label}) all three carriers rotate while both revision legs stay put`, async () => {
      const persistence = (await import('../../lib/efxPaintPersistence')) as unknown as PersistenceModuleWithDocumentToken;
      const build = persistence.buildEfxPaintLayerChangeTokenValue;

      const edited = displayCase.patch(BASE);

      // The edit is real: each case moves exactly one display field, so the
      // two snapshots are relationships between named values, never a no-op.
      expect(displaySnapshot(edited)).not.toEqual(displaySnapshot(BASE));

      // Root-cause precondition: BOTH revision legs stay byte-identical across
      // the display edit (D-07 vs D-11/D-12/D-13) — asserted so a future
      // revision widening fails loudly here instead of silently re-scoping the
      // rotation legs below.
      expect(buildEfxPaintDocumentRevision(edited)).toBe(buildEfxPaintDocumentRevision(BASE));
      expect(buildEfxPaintCompositeRevision(edited)).toBe(buildEfxPaintCompositeRevision(BASE));

      // Carrier 2: the save fingerprint (the derived-frame cache leg's dedupe
      // key at savedCacheFingerprints).
      expect(buildEfxPaintSaveFingerprint('/project', saveInputs(edited)))
        .not.toBe(buildEfxPaintSaveFingerprint('/project', saveInputs(BASE)));

      // Carrier 3: the sync fingerprint (child push / parent register guards).
      expect(buildEfxPaintDocumentSyncFingerprint(edited))
        .not.toBe(buildEfxPaintDocumentSyncFingerprint(BASE));

      // Carrier 1: the authoritative `layers/<layerId>.json` write gate.
      // THE RED: the pre-fix builder's third parameter is the audios ARRAY, so
      // passing the document throws inside encodeCanonicalAudios — that throw
      // is this leg's red evidence.
      expect(typeof build).toBe('function');
      const tokenBaseline = build!(
        buildEfxPaintDocumentRevision(BASE),
        buildEfxPaintCompositeRevision(BASE),
        BASE,
      );
      const tokenEdited = build!(
        buildEfxPaintDocumentRevision(edited),
        buildEfxPaintCompositeRevision(edited),
        edited,
      );
      expect(tokenEdited).not.toBe(tokenBaseline);

      // D-11 no-op contract: the same document yields the same token twice, so
      // a genuinely unchanged second save still dedupes.
      expect(build!(
        buildEfxPaintDocumentRevision(edited),
        buildEfxPaintCompositeRevision(edited),
        edited,
      )).toBe(tokenEdited);
    });
  }
});
