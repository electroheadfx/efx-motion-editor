import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  efxPaintVersion,
  getDocument,
  registerDocument,
  reset,
  setPhotoReferenceMode,
  setPhotoReferenceOpacity,
  setPhotoReferenceSource,
  setPhotoReferenceTransform,
  setPhotoReferenceTransformLocked,
  setPhotoReferenceVisible,
} from './efxPaintStore';
import type { BackgroundEditDescriptor } from './efxPaintStore';

// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

const makeFrame = (frameIndex: number, appFrame: number): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
  width: 100,
  height: 50,
});

type OkPhotoReferenceMutation = { ok: true; descriptor: BackgroundEditDescriptor | null };

describe('photo reference CRUD (50-02 Task 1)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('setPhotoReferenceSource creates the track with locked defaults, replaces it, and records undo by reference (D-03)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    const preCreate = getDocument(layerId)!;

    const createResult = setPhotoReferenceSource(layerId, ['a', 'b']);
    expect(createResult.ok).toBe(true);
    const createDescriptor = (createResult as OkPhotoReferenceMutation).descriptor!;
    expect(createDescriptor.before).toBe(preCreate);
    expect(createDescriptor.after).toBe(getDocument(layerId));

    const created = getDocument(layerId)!.photoReference!;
    expect(created.mode).toBe('reference-only');
    expect(created.visibleInStudio).toBe(true);
    expect(created.opacity).toBe(0.5);
    expect(created.transform).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    expect(created.transformLocked).toBe(true);
    expect(created.revision).toBe(0);
    expect(created.sourceFrameRefs).toEqual(['a', 'b']);
    expect(getDocument(layerId)!.documentRevision).toBe(preCreate.documentRevision + 1);

    // replace: bumps track revision AND documentRevision, records a second undo entry
    const preReplace = getDocument(layerId)!;
    const replaceResult = setPhotoReferenceSource(layerId, ['c']);
    expect(replaceResult.ok).toBe(true);
    const replaceDescriptor = (replaceResult as OkPhotoReferenceMutation).descriptor!;
    expect(replaceDescriptor.before).toBe(preReplace);
    expect(replaceDescriptor.after).toBe(getDocument(layerId));
    const replaced = getDocument(layerId)!.photoReference!;
    expect(replaced.sourceFrameRefs).toEqual(['c']);
    expect(replaced.revision).toBe(1);
    expect(getDocument(layerId)!.documentRevision).toBe(preReplace.documentRevision + 1);

    // undo restores ['a','b'] by reference
    registerDocument(replaceDescriptor.before);
    expect(getDocument(layerId)!.photoReference!.sourceFrameRefs).toEqual(['a', 'b']);
    expect(getDocument(layerId)!.photoReference!.revision).toBe(0);
  });

  it('setPhotoReferenceMode records one undo entry and bumps track + document revision (D-07)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['a']);
    const preMode = getDocument(layerId)!;

    const result = setPhotoReferenceMode(layerId, 'reveal-source');
    expect(result.ok).toBe(true);
    const descriptor = (result as OkPhotoReferenceMutation).descriptor!;
    expect(descriptor.before).toBe(preMode);
    expect(descriptor.after).toBe(getDocument(layerId));
    expect(getDocument(layerId)!.photoReference!.mode).toBe('reveal-source');
    expect(getDocument(layerId)!.photoReference!.revision).toBe(1);
    expect(getDocument(layerId)!.documentRevision).toBe(preMode.documentRevision + 1);

    // undo restores reference-only
    registerDocument(descriptor.before);
    expect(getDocument(layerId)!.photoReference!.mode).toBe('reference-only');
  });

  it('display-preference setters persist without undo or revision bump (D-11/D-12/D-13)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['a']);
    const docBefore = getDocument(layerId)!;
    const revBefore = docBefore.documentRevision;
    const trackRevBefore = docBefore.photoReference!.revision;

    expect(setPhotoReferenceOpacity(layerId, 0.8).ok).toBe(true);
    expect(getDocument(layerId)!.photoReference!.opacity).toBe(0.8);
    expect(setPhotoReferenceVisible(layerId, false).ok).toBe(true);
    expect(getDocument(layerId)!.photoReference!.visibleInStudio).toBe(false);
    expect(setPhotoReferenceTransform(layerId, { x: 1, y: 2, scaleX: 1.5, scaleY: 0.5, rotation: 45 }).ok).toBe(true);
    expect(getDocument(layerId)!.photoReference!.transform).toEqual({ x: 1, y: 2, scaleX: 1.5, scaleY: 0.5, rotation: 45 });
    expect(setPhotoReferenceTransformLocked(layerId, false).ok).toBe(true);
    expect(getDocument(layerId)!.photoReference!.transformLocked).toBe(false);

    // no documentRevision bump, no track revision bump (display prefs are not mutations)
    expect(getDocument(layerId)!.documentRevision).toBe(revBefore);
    expect(getDocument(layerId)!.photoReference!.revision).toBe(trackRevBefore);
  });

  it('setters are idempotent no-ops on same-value writes (no revision bump, no undo, no dirty)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['a']);
    const docBefore = getDocument(layerId)!;
    const revBefore = docBefore.documentRevision;
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);
    const versionBefore = efxPaintVersion.value;

    const sourceNoOp = setPhotoReferenceSource(layerId, ['a']);
    expect(sourceNoOp.ok).toBe(true);
    expect((sourceNoOp as OkPhotoReferenceMutation).descriptor).toBeNull();

    const modeNoOp = setPhotoReferenceMode(layerId, 'reference-only');
    expect(modeNoOp.ok).toBe(true);
    expect((modeNoOp as OkPhotoReferenceMutation).descriptor).toBeNull();

    expect(setPhotoReferenceOpacity(layerId, 0.5).ok).toBe(true);
    expect(setPhotoReferenceVisible(layerId, true).ok).toBe(true);
    expect(setPhotoReferenceTransform(layerId, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }).ok).toBe(true);
    expect(setPhotoReferenceTransformLocked(layerId, true).ok).toBe(true);

    expect(getDocument(layerId)).toBe(docBefore);
    expect(getDocument(layerId)!.documentRevision).toBe(revBefore);
    expect(efxPaintVersion.value).toBe(versionBefore);
    expect(dirty).not.toHaveBeenCalled();
  });
});
