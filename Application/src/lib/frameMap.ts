import {computed} from '@preact/signals';
import {sequenceStore} from '../stores/sequenceStore';
import type {FrameEntry, TrackLayout, FxTrackLayout, KeyPhotoRange} from '../types/timeline';
import type {Layer, LayerType, EasingType} from '../types/layer';

/** Flattened frame array: every frame maps to a sequence, key photo, and image (GLOBAL).
 *  Cross dissolve shortens the timeline by skipping the incoming sequence's overlapped head frames (per D-14). */
export const frameMap = computed<FrameEntry[]>(() => {
  const entries: FrameEntry[] = [];
  let globalFrame = 0;
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');

  for (let seqIdx = 0; seqIdx < contentSeqs.length; seqIdx++) {
    const seq = contentSeqs[seqIdx];
    // Determine how many frames to skip at the start of this sequence
    // due to a cross dissolve from the PREVIOUS sequence
    let skipAtStart = 0;
    if (seqIdx > 0) {
      const prevSeq = contentSeqs[seqIdx - 1];
      if (prevSeq.crossDissolve) {
        const halfDuration = Math.floor(prevSeq.crossDissolve.duration / 2);
        skipAtStart = prevSeq.crossDissolve.duration - halfDuration; // ceil(D/2)
      }
    }

    let localFrameCounter = 0;
    for (const kp of seq.keyPhotos) {
      for (let f = 0; f < kp.holdFrames; f++) {
        if (localFrameCounter < skipAtStart) {
          // This frame is in the overlap zone — it is rendered via crossDissolveOverlaps,
          // not via frameMap. Skip it to shorten the timeline (per D-14).
          localFrameCounter++;
          continue;
        }
        entries.push({
          globalFrame,
          sequenceId: seq.id,
          keyPhotoId: kp.id,
          imageId: kp.imageId,
          localFrame: f,
        });
        globalFrame++;
        localFrameCounter++;
      }
    }
  }
  return entries;
});

/** Total number of frames across all sequences */
export const totalFrames = computed(() => frameMap.value.length);

/** Frame entries for only the active sequence (used by preview renderer) */
export const activeSequenceFrames = computed<FrameEntry[]>(() => {
  const activeId = sequenceStore.activeSequenceId.value;
  if (!activeId) return [];
  return frameMap.value.filter((e) => e.sequenceId === activeId);
});

/** Global start frame of the active sequence (for converting global ↔ local) */
export const activeSequenceStartFrame = computed<number>(() => {
  const activeId = sequenceStore.activeSequenceId.value;
  if (!activeId) return 0;
  const tracks = trackLayouts.value;
  const track = tracks.find((t) => t.sequenceId === activeId);
  return track?.startFrame ?? 0;
});

/** Track layout data for timeline rendering (one track per content sequence).
 *  Reflects shortened positions when cross dissolve is active (per D-14). */
export const trackLayouts = computed<TrackLayout[]>(() => {
  const tracks: TrackLayout[] = [];
  let globalFrame = 0;
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');

  for (let seqIdx = 0; seqIdx < contentSeqs.length; seqIdx++) {
    const seq = contentSeqs[seqIdx];
    // Determine how many frames to skip at the start due to previous cross dissolve
    let skipAtStart = 0;
    if (seqIdx > 0) {
      const prevSeq = contentSeqs[seqIdx - 1];
      if (prevSeq.crossDissolve) {
        const halfDuration = Math.floor(prevSeq.crossDissolve.duration / 2);
        skipAtStart = prevSeq.crossDissolve.duration - halfDuration; // ceil(D/2)
      }
    }

    const startFrame = globalFrame;
    const ranges: KeyPhotoRange[] = [];
    let localFrameCounter = 0;
    for (const kp of seq.keyPhotos) {
      const kpStartFrame = globalFrame;
      let kpFramesEmitted = 0;
      for (let f = 0; f < kp.holdFrames; f++) {
        if (localFrameCounter < skipAtStart) {
          localFrameCounter++;
          continue;
        }
        globalFrame++;
        localFrameCounter++;
        kpFramesEmitted++;
      }
      if (kpFramesEmitted > 0) {
        ranges.push({
          keyPhotoId: kp.id,
          imageId: kp.imageId,
          startFrame: kpStartFrame,
          endFrame: kpStartFrame + kpFramesEmitted,
          holdFrames: kpFramesEmitted,
        });
      }
    }
    tracks.push({
      sequenceId: seq.id,
      sequenceName: seq.name,
      startFrame,
      endFrame: globalFrame,
      keyPhotoRanges: ranges,
      fadeIn: seq.fadeIn ? { duration: seq.fadeIn.duration } : undefined,
      fadeOut: seq.fadeOut ? { duration: seq.fadeOut.duration } : undefined,
      crossDissolve: seq.crossDissolve ? { duration: seq.crossDissolve.duration } : undefined,
    });
  }
  return tracks;
});

/** Color palette for FX track range bars, keyed by layer type */
const FX_TRACK_COLORS: Record<string, string> = {
  'generator-grain': '#A0522D',
  'generator-particles': '#6A5ACD',
  'generator-lines': '#20B2AA',
  'generator-dots': '#DA70D6',
  'generator-vignette': '#708090',
  'adjustment-color-grade': '#CD853F',
};
const FX_DEFAULT_COLOR = '#888888';

function fxColorForLayerType(type: LayerType): string {
  return FX_TRACK_COLORS[type] ?? FX_DEFAULT_COLOR;
}

/** Extract a thumbnail image ID from a content layer (for content-overlay range bar icons) */
function getThumbnailImageId(layer: Layer | undefined): string | undefined {
  if (!layer) return undefined;
  if (layer.source.type === 'static-image') return (layer.source as { imageId: string }).imageId;
  if (layer.source.type === 'image-sequence') {
    const ids = (layer.source as { imageIds: string[] }).imageIds;
    return ids.length > 0 ? ids[0] : undefined;
  }
  return undefined; // video has no thumbnail imageId
}

/** FX track layout data for timeline rendering (one track per FX or content-overlay sequence) */
export const fxTrackLayouts = computed<FxTrackLayout[]>(() => {
  const layouts: FxTrackLayout[] = [];
  for (const seq of sequenceStore.sequences.value) {
    if (seq.kind === 'content') continue; // content sequences render via trackLayouts
    const primaryLayer = seq.layers[0];
    let color: string;
    if (seq.kind === 'content-overlay') {
      color = primaryLayer?.type === 'static-image' ? 'var(--sidebar-dot-green)'
            : primaryLayer?.type === 'image-sequence' ? 'var(--sidebar-dot-blue)'
            : '#8B5CF6'; // video - purple
    } else {
      color = primaryLayer ? fxColorForLayerType(primaryLayer.type) : FX_DEFAULT_COLOR;
    }
    layouts.push({
      sequenceId: seq.id,
      sequenceName: seq.name,
      kind: seq.kind as 'fx' | 'content-overlay',
      inFrame: seq.inFrame ?? 0,
      outFrame: seq.outFrame ?? 100,
      color,
      visible: seq.visible !== false,
      thumbnailImageId: seq.kind === 'content-overlay' ? getThumbnailImageId(primaryLayer) : undefined,
      layerType: primaryLayer?.type,
      fadeIn: seq.fadeIn ? { duration: seq.fadeIn.duration } : undefined,
      fadeOut: seq.fadeOut ? { duration: seq.fadeOut.duration } : undefined,
    });
  }
  return layouts;
});

/** Describes a cross dissolve overlap zone in shortened-timeline coordinates */
export interface CrossDissolveOverlap {
  outgoingSequenceId: string;  // sequence that's fading out
  incomingSequenceId: string;  // sequence that's fading in
  overlapStart: number;        // global frame where overlap begins (shortened timeline)
  overlapEnd: number;          // global frame where overlap ends (exclusive, shortened timeline)
  duration: number;            // frames of overlap
  curve: EasingType;           // from the crossDissolve transition
  // Local frame offsets for rendering each sequence's content during overlap
  outgoingLocalFrameStart: number;  // local frame in outgoing seq where overlap starts
  incomingLocalFrameStart: number;  // always 0 — incoming seq starts from its first frame
}

/** Cross dissolve overlap zones in shortened-timeline coordinates for dual-render in Preview */
export const crossDissolveOverlaps = computed<CrossDissolveOverlap[]>(() => {
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');
  const overlaps: CrossDissolveOverlap[] = [];

  // We need the shortened-timeline track positions to compute overlap coordinates
  const tracks = trackLayouts.value;

  for (let i = 0; i < contentSeqs.length - 1; i++) {
    const outSeq = contentSeqs[i];
    if (!outSeq.crossDissolve) continue;

    const cd = outSeq.crossDissolve;
    const halfDuration = Math.floor(cd.duration / 2);
    const outTrack = tracks.find(t => t.sequenceId === outSeq.id);
    if (!outTrack) continue;

    // In the shortened timeline, the overlap zone occupies the last halfDuration
    // frames of the outgoing track (its tail was NOT removed — only incoming's head was)
    const overlapStart = outTrack.endFrame - halfDuration;
    const overlapEnd = overlapStart + cd.duration;

    // Local frame in outgoing sequence where overlap starts
    const outSeqTotalFrames = outSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
    const outgoingLocalFrameStart = outSeqTotalFrames - halfDuration;

    overlaps.push({
      outgoingSequenceId: outSeq.id,
      incomingSequenceId: contentSeqs[i + 1].id,
      overlapStart,
      overlapEnd,
      duration: cd.duration,
      curve: cd.curve,
      outgoingLocalFrameStart,
      incomingLocalFrameStart: 0,
    });
  }

  return overlaps;
});
