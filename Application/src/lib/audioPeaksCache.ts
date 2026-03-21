import {signal} from '@preact/signals';
import type {WaveformPeaks} from '../types/audio';

/** Revision counter — incremented on every set/delete/clear so computed signals re-evaluate. */
export const peaksCacheRevision = signal(0);

/** Global cache of decoded waveform peaks, keyed by audio track ID.
 *  Lives in lib/ so both components and stores can import without layering violations.
 *  Wrap mutations via the exported helpers so the revision signal stays in sync. */
const _cache = new Map<string, WaveformPeaks>();

export const audioPeaksCache = {
  get(id: string) { return _cache.get(id); },
  set(id: string, peaks: WaveformPeaks) { _cache.set(id, peaks); peaksCacheRevision.value++; },
  delete(id: string) { _cache.delete(id); peaksCacheRevision.value++; },
  clear() { _cache.clear(); peaksCacheRevision.value++; },
};
