import { AudioWaveform, Trash2 } from 'lucide-preact';
import type { PhysicsPaintAudioController } from './physicsPaintAudioController';
import {
  AUDIO_ENABLE_OFF,
  AUDIO_ENABLE_ON,
  AUDIO_IMPORT_CTA,
  AUDIO_LOADING,
  AUDIO_REMOVE,
  AUDIO_REMOVE_ARMED,
} from './PhysicsPaintAudioModalView';

/**
 * 261008-ryq Task 1 — the Audio tab of the Studio tool pane: one row per
 * placed clip (the list moved OUT of the Document sounds modal, which now
 * edits only the selected clip). Thin render shell over the Studio's
 * `physicsPaintAudioController` (signals-only, no useState, no render-body
 * signal writes): row selection highlight reads `selectedSoundId.value` in the
 * render body so the section subscribes to selection changes; every mutation
 * happens IN the click handlers.
 *
 * Three deletion surfaces, ONE arm (T-261008-RYQ-01): the row Trash2 rides the
 * controller's existing `removeArmedClipId` two-step arm (first press selects
 * + arms, second confirms); Import disarms first. Keyboard Delete/Backspace
 * takes the one-shot `removeSelected` path in the Studio dispatcher — never a
 * second arm here.
 */

export interface AudioSectionPorts {
  /** The Studio's controller instance — resolved at child-render time. */
  getController: () => PhysicsPaintAudioController;
  /** Row click: select + reveal + open the modal (the Studio owns all three). */
  onSelectClip: (clipId: string) => void;
  /** Import intent — the Studio opens the shared gallery in audio mode. */
  onImportRequest: (mode: 'append' | 'replace') => void;
}

export interface PhysicsPaintAudioListSectionProps {
  ports: AudioSectionPorts;
}

export function PhysicsPaintAudioListSection({ ports }: PhysicsPaintAudioListSectionProps) {
  const controller = ports.getController();
  const busy = controller.busy;
  const selectedId = controller.selectedSoundId.value;
  return (
    <div
      class="physics-paint-options-tab-panel physics-paint-options-tab-panel-audio physics-paint-audio-clip-list"
      role="tabpanel"
      aria-label="Audio options"
      data-testid="audio-list-section"
    >
      {controller.audios.map((clip) => {
        const selected = selectedId === clip.id;
        const armedHere = selected && controller.removeArmed;
        return (
          <div
            key={clip.id}
            class={`physics-paint-audio-clip-row${selected ? ' physics-paint-audio-clip-row-selected' : ''}`}
          >
            <button
              type="button"
              class="physics-paint-audio-clip-select"
              aria-pressed={selected}
              disabled={busy}
              onClick={() => ports.onSelectClip(clip.id)}
            >
              <span class="physics-paint-audio-filename">
                {clip.relativePath.split('/').pop() ?? clip.relativePath}
              </span>
              <span class="physics-paint-audio-clip-span">
                {clip.startFrame} · {clip.inFrame}..{clip.outFrame}
              </span>
              <span class="physics-paint-audio-clip-toggle">{clip.enabled ? AUDIO_ENABLE_ON : AUDIO_ENABLE_OFF}</span>
            </button>
            <button
              type="button"
              class="physics-paint-audio-clip-trash"
              aria-label={armedHere ? AUDIO_REMOVE_ARMED : AUDIO_REMOVE}
              title={armedHere ? AUDIO_REMOVE_ARMED : AUDIO_REMOVE}
              disabled={busy}
              onClick={() => {
                if (armedHere) {
                  controller.confirmRemove();
                  return;
                }
                // First press: select + arm on the EXISTING two-step arm
                // (requestRemove stamps the live selection).
                controller.selectedSoundId.value = clip.id;
                controller.requestRemove();
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        class="physics-paint-photo-reference-import physics-paint-audio-clip-import"
        onClick={() => {
          controller.disarmRemove();
          ports.onImportRequest('append');
        }}
        disabled={busy}
      >
        <AudioWaveform size={13} aria-hidden="true" />
        <span>{busy ? AUDIO_LOADING : AUDIO_IMPORT_CTA}</span>
      </button>
    </div>
  );
}
