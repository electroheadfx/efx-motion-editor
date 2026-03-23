import {Music} from 'lucide-preact';
import {uiStore} from '../../stores/uiStore';

export function AddAudioButton() {
  const handleAddAudio = () => {
    uiStore.setAddLayerIntent({type: 'audio', target: 'audio-track'});
    uiStore.setEditorMode('imported');
  };

  return (
    <button
      class="rounded px-2 py-[5px] bg-[var(--color-bg-input)] hover:bg-[var(--color-border-subtle)] cursor-pointer transition-colors"
      onClick={handleAddAudio}
      title="Add Audio"
    >
      <span class="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-1"><Music size={11} /> Audio</span>
    </button>
  );
}
