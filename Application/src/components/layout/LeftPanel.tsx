import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { uiStore } from '../../stores/uiStore';
import { CollapsibleSection } from '../sidebar/CollapsibleSection';
import { SidebarProperties } from '../sidebar/SidebarProperties';
import { SidebarFxProperties } from '../sidebar/SidebarFxProperties';
import { SequenceList } from '../sequence/SequenceList';
import { KeyPhotoStrip, AddKeyPhotoButton } from '../sequence/KeyPhotoStrip';
import { LayerList } from '../layer/LayerList';
import { AddLayerMenu } from '../layer/AddLayerMenu';
import { isFxLayer } from '../../types/layer';

export function LeftPanel() {
  const sequences = sequenceStore.sequences.value;
  const activeSeq = sequenceStore.getActiveSequence();

  // Find selected layer across all sequences (FX layers live in FX sequences)
  const selectedId = layerStore.selectedLayerId.value;
  let selectedLayer = null;
  let fxSequenceId: string | null = null;
  if (selectedId) {
    for (const seq of sequenceStore.sequences.value) {
      const found = seq.layers.find((l) => l.id === selectedId);
      if (found) {
        selectedLayer = found;
        if (seq.kind === 'fx') fxSequenceId = seq.id;
        break;
      }
    }
  }

  const isFx = selectedLayer && isFxLayer(selectedLayer);

  return (
    <div class="flex flex-col w-[268px] h-full bg-[var(--color-bg-card-alt)] shrink-0 overflow-y-auto">
      {/* Sidebar collapse toggle */}
      <div class="flex items-center justify-end h-7 px-2 shrink-0">
        <button
          class="w-5 h-5 flex items-center justify-center text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-button)]"
          onClick={() => uiStore.toggleSidebar()}
          title="Collapse sidebar"
        >
          &laquo;
        </button>
      </div>

      {/* SEQUENCES section */}
      <CollapsibleSection
        title="SEQUENCES"
        collapsed={uiStore.sequencesSectionCollapsed}
        headerActions={
          <button
            class="rounded px-2 py-1 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] transition-colors"
            onClick={() => sequenceStore.createSequence(`Sequence ${sequences.length + 1}`)}
          >
            <span class="text-[10px] text-[var(--color-text-secondary)]">+ Add</span>
          </button>
        }
      >
        <SequenceList />
        {/* Key Photos inline under active sequence */}
        {activeSeq && (
          <>
            <div class="w-full h-px bg-[var(--color-bg-divider)]" />
            <div class="flex items-center justify-between h-7 px-3 bg-[var(--color-bg-subsection)]">
              <span class="text-[9px] font-semibold text-[var(--color-text-dim)]">KEY PHOTOS</span>
              <div class="flex items-center gap-1">
                <KeyPhotoHeaderActions sequenceId={activeSeq.id} />
                <AddKeyPhotoButton sequenceId={activeSeq.id} />
              </div>
            </div>
            <KeyPhotoStrip />
          </>
        )}
      </CollapsibleSection>

      {/* Divider */}
      <div class="w-full h-px bg-[var(--color-bg-divider)] shrink-0" />

      {/* LAYERS section -- replaced by FX properties when FX layer is selected */}
      {isFx ? (
        <>
          {/* FX layer selected: show "FX: [name]" header + FX properties */}
          <div class="flex items-center h-9 px-3 bg-[var(--color-bg-section-header)]">
            <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
              FX: {selectedLayer!.name}
            </span>
          </div>
          <SidebarFxProperties layer={selectedLayer!} fxSequenceId={fxSequenceId} />
        </>
      ) : (
        <CollapsibleSection
          title="LAYERS"
          collapsed={uiStore.layersSectionCollapsed}
          headerActions={<AddLayerMenu />}
        >
          <LayerList />
        </CollapsibleSection>
      )}

      {/* Divider */}
      <div class="w-full h-px bg-[var(--color-bg-divider)] shrink-0" />

      {/* PROPERTIES section -- only when a non-FX layer is selected */}
      {selectedLayer && !isFx && (
        <>
          <div class="flex items-center h-9 px-3 bg-[var(--color-bg-section-header)]">
            <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">PROPERTIES</span>
          </div>
          <SidebarProperties layer={selectedLayer} />
        </>
      )}
    </div>
  );
}

/** Header actions for key photos: move left, delete, move right (only when selected) */
function KeyPhotoHeaderActions({ sequenceId }: { sequenceId: string }) {
  const selectedId = sequenceStore.selectedKeyPhotoId.value;
  if (!selectedId) return null;

  const seq = sequenceStore.getById(sequenceId);
  if (!seq) return null;

  const idx = seq.keyPhotos.findIndex((kp) => kp.id === selectedId);
  if (idx === -1) return null;

  const canMoveLeft = idx > 0;
  const canMoveRight = idx < seq.keyPhotos.length - 1;

  const btnClass = 'w-5 h-5 rounded flex items-center justify-center text-[10px] transition-colors';
  const enabledClass = 'bg-[var(--color-bg-divider)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:text-white';
  const disabledClass = 'bg-[var(--color-bg-card)] text-[var(--color-text-dimmer)] cursor-default';

  return (
    <div class="flex items-center gap-0.5">
      {/* Move left */}
      <button
        class={`${btnClass} ${canMoveLeft ? enabledClass : disabledClass}`}
        onClick={() => canMoveLeft && sequenceStore.reorderKeyPhotos(sequenceId, idx, idx - 1)}
        disabled={!canMoveLeft}
        title="Move left"
      >
        &lt;
      </button>
      {/* Delete */}
      <button
        class={`${btnClass} bg-[var(--color-bg-divider)] text-[var(--color-error-text-faded)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-text)] transition-colors`}
        onClick={() => sequenceStore.removeKeyPhoto(sequenceId, selectedId)}
        title="Delete selected key photo"
      >
        x
      </button>
      {/* Move right */}
      <button
        class={`${btnClass} ${canMoveRight ? enabledClass : disabledClass}`}
        onClick={() => canMoveRight && sequenceStore.reorderKeyPhotos(sequenceId, idx, idx + 1)}
        disabled={!canMoveRight}
        title="Move right"
      >
        &gt;
      </button>
    </div>
  );
}
