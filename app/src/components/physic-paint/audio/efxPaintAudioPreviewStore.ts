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
 * D-13 Audio Preview toggle: session-local, default Off, resets on each EFX
 * Paint window open (a fresh bundle per window gives the reset for free).
 * Never written to project data, .mce files, app config, or localStorage
 * (AUDIO-05 prohibition). The monitor gates its play funnel on this signal;
 * the setter with the immediate mid-playback effect lands with the toggle UI.
 *
 * 52.5 UAT: this is "hear the MAIN APP's audio while previewing in the Studio"
 * — preview-only, it never touches main-editor playback or the exported mix
 * (those always carry both the document clip and the main tracks). The
 * document clip has its OWN switch (`DocumentSoundClip.enabled`) and is
 * unaffected here. Default Off so the Studio previews the studio sound alone;
 * turn it On to hear the main app's tracks underneath.
 */
export const AUDIO_PREVIEW_DEFAULT = false;
export const audioPreviewEnabled = signal(AUDIO_PREVIEW_DEFAULT);

/**
 * The feature's copy contract, relocated here (261009-6ee one-switch law): the
 * modal header surface was dropped — the strip's Audio Preview toggle is the
 * live surface; these constants stay pinned by efxPaintAudioPreview.test.ts.
 */
export const AUDIO_MAIN_APP_AUDIO_ON = 'Main app audio On — preview only, click to mute';
export const AUDIO_MAIN_APP_AUDIO_OFF = 'Main app audio Off — preview only, click to hear';
export const AUDIO_MAIN_APP_AUDIO_ARIA_ON = 'Mute main app audio in the Studio preview';
export const AUDIO_MAIN_APP_AUDIO_ARIA_OFF = 'Hear main app audio in the Studio preview';

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
