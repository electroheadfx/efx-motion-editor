import {signal} from '@preact/signals';

// --- Signals ---

const bypassBlur = signal(false);

// --- Store ---

export const blurStore = {
  bypassBlur,

  /** Toggle bypass -- disables all blur rendering everywhere */
  toggleBypass() {
    bypassBlur.value = !bypassBlur.value;
  },

  /** Read bypass state without subscribing (for use in render loop) */
  isBypassed(): boolean {
    return bypassBlur.peek();
  },

  /** Reset signals to defaults */
  reset() {
    bypassBlur.value = false;
  },
};
