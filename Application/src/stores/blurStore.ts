import {signal} from '@preact/signals';

// --- Signals ---

const hqPreview = signal(false);
const bypassBlur = signal(false);

// --- Store ---

export const blurStore = {
  hqPreview,
  bypassBlur,

  /** Toggle HQ preview mode (StackBlur vs fast downscale-upscale) */
  toggleHQ() {
    hqPreview.value = !hqPreview.value;
  },

  /** Toggle bypass -- disables all blur rendering everywhere */
  toggleBypass() {
    bypassBlur.value = !bypassBlur.value;
  },

  /** Read HQ state without subscribing (for use in render loop) */
  isHQ(): boolean {
    return hqPreview.peek();
  },

  /** Read bypass state without subscribing (for use in render loop) */
  isBypassed(): boolean {
    return bypassBlur.peek();
  },

  /** Reset both signals to defaults */
  reset() {
    hqPreview.value = false;
    bypassBlur.value = false;
  },
};
