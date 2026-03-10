import {computed} from '@preact/signals';
import {sequenceStore} from '../stores/sequenceStore';
import type {FrameEntry, TrackLayout, FxTrackLayout, KeyPhotoRange} from '../types/timeline';
import type {LayerType} from '../types/layer';

/** Flattened frame array: every frame maps to a sequence, key photo, and image (GLOBAL) */
export const frameMap = computed<FrameEntry[]>(() => {
  const entries: FrameEntry[] = [];
  let globalFrame = 0;
  for (const seq of sequenceStore.sequences.value) {
    if (seq.kind === 'fx') continue; // FX sequences don't contribute frames to the global timeline
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

/** Track layout data for timeline rendering (one track per content sequence) */
export const trackLayouts = computed<TrackLayout[]>(() => {
  const tracks: TrackLayout[] = [];
  let globalFrame = 0;
  for (const seq of sequenceStore.sequences.value) {
    if (seq.kind === 'fx') continue; // FX sequences render via fxTrackLayouts
    const startFrame = globalFrame;
    const ranges: KeyPhotoRange[] = [];
    for (const kp of seq.keyPhotos) {
      ranges.push({
        keyPhotoId: kp.id,
        imageId: kp.imageId,
        startFrame: globalFrame,
        endFrame: globalFrame + kp.holdFrames,
        holdFrames: kp.holdFrames,
      });
      globalFrame += kp.holdFrames;
    }
    tracks.push({
      sequenceId: seq.id,
      sequenceName: seq.name,
      startFrame,
      endFrame: globalFrame,
      keyPhotoRanges: ranges,
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

/** FX track layout data for timeline rendering (one track per FX sequence) */
export const fxTrackLayouts = computed<FxTrackLayout[]>(() => {
  const layouts: FxTrackLayout[] = [];
  for (const seq of sequenceStore.sequences.value) {
    if (seq.kind !== 'fx') continue;
    const primaryLayer = seq.layers[0];
    const color = primaryLayer ? fxColorForLayerType(primaryLayer.type) : FX_DEFAULT_COLOR;
    layouts.push({
      sequenceId: seq.id,
      sequenceName: seq.name,
      kind: 'fx',
      inFrame: seq.inFrame ?? 0,
      outFrame: seq.outFrame ?? 100,
      color,
    });
  }
  return layouts;
});
