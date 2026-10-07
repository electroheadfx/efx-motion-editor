import {signal} from '@preact/signals';
import type {WaveformPeaks} from '../types/audio';

/** Revision counter — incremented on every set/delete/clear so computed signals re-evaluate. */
export const peaksCacheRevision = signal(0);

/** Global cache of decoded waveform peaks, keyed by audio track ID.
 *  Lives in lib/ so both components and stores can import without layering violations.
 *  Wrap mutations via the exported helpers so the revision signal stays in sync. */
const _cache = new Map<string, WaveformPeaks>();
/**
 * 52.5 UAT round 4: the source length in frames, keyed like the peaks. The
 * waveform is drawn once in SOURCE space and windowed by `in..out` through the
 * SVG viewBox, so trimming reveals the cut instead of rescaling the whole
 * source — the exact frame count is what makes that window faithful.
 */
const _sourceFrames = new Map<string, number>();

export const audioPeaksCache = {
  get(id: string) { return _cache.get(id); },
  /** Optional `sourceFrames` powers the sound band's trim window. */
  set(id: string, peaks: WaveformPeaks, sourceFrames?: number) {
    _cache.set(id, peaks);
    if (typeof sourceFrames === 'number' && Number.isFinite(sourceFrames) && sourceFrames > 0) {
      _sourceFrames.set(id, sourceFrames);
    }
    peaksCacheRevision.value++;
  },
  getSourceFrames(id: string): number | undefined { return _sourceFrames.get(id); },
  delete(id: string) { _cache.delete(id); _sourceFrames.delete(id); peaksCacheRevision.value++; },
  clear() { _cache.clear(); _sourceFrames.clear(); peaksCacheRevision.value++; },
};
