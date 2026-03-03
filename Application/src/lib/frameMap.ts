import {computed} from '@preact/signals';
import {sequenceStore} from '../stores/sequenceStore';
import type {FrameEntry, TrackLayout, KeyPhotoRange} from '../types/timeline';

/** Flattened frame array: every frame maps to a sequence, key photo, and image */
export const frameMap = computed<FrameEntry[]>(() => {
  const entries: FrameEntry[] = [];
  let globalFrame = 0;
  for (const seq of sequenceStore.sequences.value) {
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

/** Track layout data for timeline rendering (one track per sequence) */
export const trackLayouts = computed<TrackLayout[]>(() => {
  const tracks: TrackLayout[] = [];
  let globalFrame = 0;
  for (const seq of sequenceStore.sequences.value) {
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
