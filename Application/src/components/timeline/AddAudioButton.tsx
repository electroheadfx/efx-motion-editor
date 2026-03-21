import {Music} from 'lucide-preact';
import {uiStore} from '../../stores/uiStore';

export function AddAudioButton() {
  const handleAddAudio = () => {
    uiStore.setAddLayerIntent({type: 'audio', target: 'audio-track'});
    uiStore.setEditorMode('imported');
  };

  return (
    <button
      class="rounded bg-[var(--color-bg-input)] px-2 py-[5px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors"
      onClick={handleAddAudio}
      title="Add Audio"
    >
      <Music size={14} />
    </button>
  );
}
