import { computed, signal } from '@preact/signals';
import type { EfxPaintAudioPreviewContext } from '../../../types/physicPaint';

/**
 * Session-only EFX Paint audio preview store (soloStore-shaped, D-13
 * discipline): holds the currently applied revisioned audioPreview section for
 * this child window. Nothing is persisted; each window load starts empty and
 * is hydrated from the launch context / push events.
 */
const section = signal<EfxPaintAudioPreviewContext | null>(null);

/**
 * D-13 Audio Preview toggle: session-local, default On, resets on each EFX
 * Paint window open (a fresh bundle per window gives the reset for free).
 * Never written to project data, .mce files, app config, or localStorage
 * (AUDIO-05 prohibition). The monitor gates its play funnel on this signal;
 * the setter with the immediate mid-playback effect lands with the toggle UI.
 */
export const audioPreviewEnabled = signal(true);

type AudioPreviewToggleEffect = (enabled: boolean) => void;
let toggleEffect: AudioPreviewToggleEffect | null = null;

/**
 * D-14 effect channel: the monitor registers its toggle funnel here at module
 * scope. The store cannot import the monitor (the monitor already imports
 * this store), so the immediate mid-playback effect travels through this
 * injected slot.
 */
export function configureAudioPreviewToggleEffect(effect: AudioPreviewToggleEffect | null): void {
  toggleEffect = effect;
}

/**
 * Session toggle setter (AUDIO-05). Idempotent: setting the current value is
 * a no-op with zero engine calls — no double engine start, no doubled stopAll
 * side effects. A real change routes through the monitor funnel: Off silences
 * audio immediately while visual playback continues; On resumes at the live
 * Paint cursor only when playback is running silent.
 */
export function setAudioPreviewEnabled(next: boolean): void {
  if (audioPreviewEnabled.peek() === next) return;
  audioPreviewEnabled.value = next;
  toggleEffect?.(next);
}

export const efxPaintAudioPreviewStore = {
  section,
  hasAudio: computed(() => (section.value?.tracks.length ?? 0) > 0),

  getSection(): EfxPaintAudioPreviewContext | null {
    return section.peek();
  },

  setSection(next: EfxPaintAudioPreviewContext): void {
    section.value = next;
  },

  clear(): void {
    section.value = null;
  },
};
