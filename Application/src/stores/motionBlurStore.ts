import {signal} from '@preact/signals';

// --- Signals ---

const enabled = signal(false);
const shutterAngle = signal(180);
const previewQuality = signal<'off' | 'low' | 'medium'>('medium');

// --- Store ---

export const motionBlurStore = {
  enabled,
  shutterAngle,
  previewQuality,

  /** Toggle motion blur on/off */
  toggleEnabled() {
    enabled.value = !enabled.value;
  },

  /** Set shutter angle (clamped 0-360 degrees) */
  setShutterAngle(angle: number) {
    shutterAngle.value = Math.max(0, Math.min(360, angle));
  },

  /** Set preview quality tier */
  setPreviewQuality(q: 'off' | 'low' | 'medium') {
    previewQuality.value = q;
  },

  /** Read enabled state without subscribing (for use in render loop) */
  isEnabled(): boolean {
    return enabled.peek();
  },

  /** Get blur strength from shutter angle (0.0 - 1.0) */
  getStrength(): number {
    return shutterAngle.peek() / 360;
  },

  /** Get sample count for current quality tier */
  getSamples(): number {
    const q = previewQuality.peek();
    return q === 'low' ? 4 : q === 'medium' ? 8 : 0;
  },

  /** Reset signals to defaults */
  reset() {
    enabled.value = false;
    shutterAngle.value = 180;
    previewQuality.value = 'medium';
  },
};
