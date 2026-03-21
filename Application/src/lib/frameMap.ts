import {computed} from '@preact/signals';
import {sequenceStore} from '../stores/sequenceStore';
import {audioStore} from '../stores/audioStore';
import {audioPeaksCache, peaksCacheRevision} from './audioPeaksCache';
import type {FrameEntry, TrackLayout, FxTrackLayout, AudioTrackLayout, KeyPhotoRange} from '../types/timeline';
import type {Layer, LayerType, EasingType} from '../types/layer';

/** Flattened frame array: every frame maps to a sequence, key photo, and image (GLOBAL).
 *  Cross dissolve does NOT shorten the timeline — both sequences keep all their frames.
 *  The overlap is handled visually in Preview via crossDissolveOverlaps. */
export const frameMap = computed<FrameEntry[]>(() => {
  const entries: FrameEntry[] = [];
  let globalFrame = 0;
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');

  for (const seq of contentSeqs) {
    for (const kp of seq.keyPhotos) {
      for (let f = 0; f < kp.holdFrames; f++) {
        entries.push({
          globalFrame,
          sequenceId: seq.id,
          keyPhotoId: kp.id,
          imageId: kp.imageId,
          localFrame: f,
        });
        globalFrame++;
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
 *  Simple sequential layout — cross dissolve does not alter positions. */
export const trackLayouts = computed<TrackLayout[]>(() => {
  const tracks: TrackLayout[] = [];
  let globalFrame = 0;
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');

  for (const seq of contentSeqs) {
    const startFrame = globalFrame;
    const ranges: KeyPhotoRange[] = [];
    for (const kp of seq.keyPhotos) {
      const kpStartFrame = globalFrame;
      globalFrame += kp.holdFrames;
      ranges.push({
        keyPhotoId: kp.id,
        imageId: kp.imageId,
        startFrame: kpStartFrame,
        endFrame: globalFrame,
        holdFrames: kp.holdFrames,
      });
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

/** Audio track layout data for timeline rendering (one row per audio track) */
export const audioTrackLayouts = computed<AudioTrackLayout[]>(() => {
  // Read revision signal to re-evaluate when peaks are added/updated asynchronously
  peaksCacheRevision.value;
  const tracks = audioStore.tracks.value;
  const selectedId = audioStore.selectedTrackId.value;
  return tracks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(track => ({
      trackId: track.id,
      trackName: track.name,
      offsetFrame: track.offsetFrame,
      inFrame: track.inFrame,
      outFrame: track.outFrame,
      muted: track.muted,
      volume: track.volume,
      peaks: audioPeaksCache.get(track.id) ?? { tier1: new Float32Array(0), tier2: new Float32Array(0), tier3: new Float32Array(0) },
      trackHeight: track.trackHeight,
      fadeInFrames: track.fadeInFrames,
      fadeOutFrames: track.fadeOutFrames,
      fadeInCurve: track.fadeInCurve,
      fadeOutCurve: track.fadeOutCurve,
      slipOffset: track.slipOffset,
      totalAudioFrames: track.totalFramesInFile || track.outFrame,
      selected: track.id === selectedId,
    }));
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

/** Cross dissolve overlap zones in global frame coordinates for dual-render in Preview.
 *  The overlap zone spans halfDuration frames at end of seq1 + ceil(D/2) frames at start of seq2. */
export const crossDissolveOverlaps = computed<CrossDissolveOverlap[]>(() => {
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');
  const overlaps: CrossDissolveOverlap[] = [];
  const tracks = trackLayouts.value;

  for (let i = 0; i < contentSeqs.length - 1; i++) {
    const outSeq = contentSeqs[i];
    if (!outSeq.crossDissolve) continue;

    const cd = outSeq.crossDissolve;
    const halfDuration = Math.floor(cd.duration / 2);
    const outTrack = tracks.find(t => t.sequenceId === outSeq.id);
    if (!outTrack) continue;

    // Overlap centered on the boundary between outgoing and incoming
    const boundary = outTrack.endFrame;
    const overlapStart = boundary - halfDuration;
    const overlapEnd = boundary + (cd.duration - halfDuration);

    // Local frame offsets for rendering
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
