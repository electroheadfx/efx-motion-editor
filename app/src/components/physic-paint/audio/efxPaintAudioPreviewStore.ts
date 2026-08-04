import { computed, signal } from '@preact/signals';
import type { EfxPaintAudioPreviewContext } from '../../../types/physicPaint';

/**
 * Session-only EFX Paint audio preview store (soloStore-shaped, D-13
 * discipline): holds the currently applied revisioned audioPreview section for
 * this child window. Nothing is persisted; each window load starts empty and
 * is hydrated from the launch context / push events.
 */
const section = signal<EfxPaintAudioPreviewContext | null>(null);

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
