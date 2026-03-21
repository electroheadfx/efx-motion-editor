import type {WaveformPeaks} from '../types/audio';

/** Global cache of decoded waveform peaks, keyed by audio track ID.
 *  Lives in lib/ so both components and stores can import without layering violations. */
export const audioPeaksCache = new Map<string, WaveformPeaks>();
