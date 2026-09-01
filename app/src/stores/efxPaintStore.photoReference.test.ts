import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
  _setPhysicPaintCompositorSizeProvider,
  registerReferenceSourceImage,
  _referenceSourceRevision,
  hydrateReferenceSourceImages,
} from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  efxPaintVersion,
  getDocument,
  hydrateRuntimeFromDocument,
  registerDocument,
  reset,
  serializeRuntimeIntoDocument,
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

describe('photo reference registry + resolution (50-02 Task 2)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('resolves frame N to source frame N, clamped at sequence end (D-15)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0', 'f1', 'f2']);
    registerReferenceSourceImage('f0', 'data:f0');
    registerReferenceSourceImage('f1', 'data:f1');
    registerReferenceSourceImage('f2', 'data:f2');

    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 0)).toEqual({ ref: 'f0', dataUrl: 'data:f0', clamped: false });
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 1)).toEqual({ ref: 'f1', dataUrl: 'data:f1', clamped: false });
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 2)).toEqual({ ref: 'f2', dataUrl: 'data:f2', clamped: false });
    // frame 3 clamps to the last source frame (sequence end holds)
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 3)).toEqual({ ref: 'f2', dataUrl: 'data:f2', clamped: true });

    // a single-image track is a cycle of length 1
    setPhotoReferenceSource(layerId, ['solo']);
    registerReferenceSourceImage('solo', 'data:solo');
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 0)).toEqual({ ref: 'solo', dataUrl: 'data:solo', clamped: false });
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 5)).toEqual({ ref: 'solo', dataUrl: 'data:solo', clamped: true });
  });

  it('missing source resolves to null with a :missing revision suffix (D-04)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['present', 'absent']);
    registerReferenceSourceImage('present', 'data:present');

    // present resolves
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 0)).toEqual({ ref: 'present', dataUrl: 'data:present', clamped: false });
    // absent resolves to null (never a placeholder, never silent transparency)
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 1)).toBeNull();

    // the revision term carries a :missing suffix for the absent ref
    const revision = _referenceSourceRevision(getDocument(layerId)!);
    expect(revision).toContain('present:');
    expect(revision).toContain('absent:missing');
  });

  it('_referenceSourceRevision changes on source/dataUrl change, is stable otherwise, and is empty when null', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    // null track → empty term
    expect(_referenceSourceRevision(getDocument(layerId)!)).toBe('');

    setPhotoReferenceSource(layerId, ['a']);
    const empty = _referenceSourceRevision(getDocument(layerId)!);
    expect(empty).toBe('a:missing');

    registerReferenceSourceImage('a', 'data:aaa');
    const withBytes = _referenceSourceRevision(getDocument(layerId)!);
    expect(withBytes).not.toBe(empty);
    expect(withBytes).toContain('a:');

    // stable when the registry is unchanged
    expect(_referenceSourceRevision(getDocument(layerId)!)).toBe(withBytes);

    // changes when the dataUrl changes
    registerReferenceSourceImage('a', 'data:bbb');
    expect(_referenceSourceRevision(getDocument(layerId)!)).not.toBe(withBytes);

    // changes when the source ref is replaced
    setPhotoReferenceSource(layerId, ['b']);
    registerReferenceSourceImage('b', 'data:bbb');
    expect(_referenceSourceRevision(getDocument(layerId)!)).toContain('b:');
  });
});

describe('photo reference exclusion + persistence (50-02 Task 3)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  describe('D-06 exclusion', () => {
    type FlatOp =
      | { type: 'clearRect' }
      | { type: 'save' }
      | { type: 'restore' }
      | { type: 'fillRect'; fillStyle: string; globalAlpha: number; globalCompositeOperation: string }
      | { type: 'drawImage'; source: string; globalAlpha: number; globalCompositeOperation: string };

    class FlatRecordingContext {
      readonly ops: FlatOp[];
      constructor(ops: FlatOp[] = []) { this.ops = ops; }
      fillStyle: string = '#000000';
      globalAlpha = 1;
      globalCompositeOperation = 'source-over';
      private stack: Array<{ fillStyle: string; globalAlpha: number; globalCompositeOperation: string }> = [];
      save(): void { this.ops.push({ type: 'save' }); this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }
      restore(): void { this.ops.push({ type: 'restore' }); const top = this.stack.pop(); if (!top) return; this.fillStyle = top.fillStyle; this.globalAlpha = top.globalAlpha; this.globalCompositeOperation = top.globalCompositeOperation; }
      clearRect(): void { this.ops.push({ type: 'clearRect' }); }
      fillRect(): void { this.ops.push({ type: 'fillRect', fillStyle: String(this.fillStyle), globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }
      drawImage(source?: unknown, ..._args: number[]): void {
        const sourceLabel = source !== null && typeof source === 'object' && 'src' in source
          ? String((source as { src: unknown }).src)
          : 'canvas';
        this.ops.push({ type: 'drawImage', source: sourceLabel, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
      }
      createPattern(): CanvasPattern { return 'pattern' as unknown as CanvasPattern; }
    }

    class FlatTestCanvas {
      width = 0;
      height = 0;
      constructor(readonly ops: FlatOp[]) {}
      getContext(kind: string): FlatRecordingContext | null { return kind === '2d' ? new FlatRecordingContext(this.ops) : null; }
      toDataURL(): string {
        const log = this.ops.map((op) => {
          switch (op.type) {
            case 'clearRect': return 'clear';
            case 'save': return 'save';
            case 'restore': return 'restore';
            case 'fillRect': return `fill(${op.fillStyle},${op.globalAlpha},${op.globalCompositeOperation})`;
            case 'drawImage': return `draw(${op.source},${op.globalAlpha},${op.globalCompositeOperation})`;
          }
        }).join('|');
        return `data:image/png;base64,${log}`;
      }
    }

    class FlatTestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 4;
      height = 3;
      private currentSrc = '';
      set src(value: string) { this.currentSrc = value; this.onload?.(); }
      get src(): string { return this.currentSrc; }
    }

    beforeEach(() => {
      _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
      vi.stubGlobal('document', {
        createElement: (tag: string) => (tag === 'canvas' ? new FlatTestCanvas([]) : {}),
      });
      vi.stubGlobal('Image', FlatTestImage);
      vi.stubGlobal('HTMLImageElement', FlatTestImage);
      vi.stubGlobal('HTMLCanvasElement', FlatTestCanvas);
    });

    afterEach(() => {
      _setPhysicPaintCompositorSizeProvider(null);
      vi.unstubAllGlobals();
    });

    it('getFlattenedFrame output is byte-identical regardless of reference state (D-06)', () => {
      const layerId = 'layer-photo';
      registerDocument(makeTrackDocument(layerId));
      physicPaintStore.setFrame(layerId, TEST_TRACK_ID, 0, makeFrame(0, 0));

      const noReference = physicPaintStore.getFlattenedFrame(layerId, 0)!;
      expect(noReference).not.toBeNull();

      setPhotoReferenceSource(layerId, ['ref-a']);
      registerReferenceSourceImage('ref-a', 'data:ref-a');
      const withReference = physicPaintStore.getFlattenedFrame(layerId, 0)!;
      expect(withReference.renderedFrame.dataUrl).toBe(noReference.renderedFrame.dataUrl);

      setPhotoReferenceVisible(layerId, false);
      const hiddenReference = physicPaintStore.getFlattenedFrame(layerId, 0)!;
      expect(hiddenReference.renderedFrame.dataUrl).toBe(noReference.renderedFrame.dataUrl);
    });
  });

  it('serialize → hydrate → serialize is idempotent and preserves all track fields (REF-05)', () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['a', 'b']);
    setPhotoReferenceMode(layerId, 'reveal-source');
    setPhotoReferenceOpacity(layerId, 0.8);
    setPhotoReferenceVisible(layerId, false);
    setPhotoReferenceTransform(layerId, { x: 1, y: 2, scaleX: 1.5, scaleY: 0.5, rotation: 45 });
    setPhotoReferenceTransformLocked(layerId, false);

    const projected = serializeRuntimeIntoDocument(layerId);
    const photo = projected.photoReference!;
    expect(photo.sourceFrameRefs).toEqual(['a', 'b']);
    expect(photo.mode).toBe('reveal-source');
    expect(photo.opacity).toBe(0.8);
    expect(photo.visibleInStudio).toBe(false);
    expect(photo.transform).toEqual({ x: 1, y: 2, scaleX: 1.5, scaleY: 0.5, rotation: 45 });
    expect(photo.transformLocked).toBe(false);

    hydrateRuntimeFromDocument(projected, new Map([[TEST_TRACK_ID, physicPaintStore.getFrames(layerId, TEST_TRACK_ID)]]));
    const projected2 = serializeRuntimeIntoDocument(layerId);
    expect(projected2.photoReference).toEqual(projected.photoReference);
  });

  it('hydrateReferenceSourceImages registers the reference source images through the library path (REF-05)', async () => {
    const layerId = 'layer-photo';
    registerDocument(makeTrackDocument(layerId));
    setPhotoReferenceSource(layerId, ['f0', 'f1']);

    const result = await hydrateReferenceSourceImages(getDocument(layerId)!, {
      resolveAssetUrls: (ref) => [`asset://${ref}`],
      decodeBytes: async (url) => `data:${url}`,
      register: registerReferenceSourceImage,
    });

    expect(result.registered).toEqual(['f0', 'f1']);
    expect(result.missing).toEqual([]);
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 0)).toEqual({ ref: 'f0', dataUrl: 'data:asset://f0', clamped: false });
    expect(physicPaintStore.getReferenceSourceFrameVerdict(layerId, 1)).toEqual({ ref: 'f1', dataUrl: 'data:asset://f1', clamped: false });
  });
});
