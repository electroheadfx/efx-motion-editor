import { signal } from '@preact/signals';

/**
 * Display-only waveform amplification (x1..x4), 261010 UAT.
 *
 * Lives in its own module (not audioStore) so the Studio strip and modal can
 * read it without touching the paintStore/projectStore import graph. Never
 * persisted, never audible — it only scales the DRAWN peaks.
 */
export const audioWaveformGain = signal(1);

export function setAudioWaveformGain(gain: number): void {
  audioWaveformGain.value = Math.max(1, Math.min(4, Math.round(gain)));
}
