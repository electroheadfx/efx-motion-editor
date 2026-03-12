import {open} from '@tauri-apps/plugin-dialog';
import {sequenceStore} from '../../stores/sequenceStore';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {ImportGrid} from '../import/ImportGrid';
import {SequenceList} from '../sequence/SequenceList';
import {KeyPhotoStrip, AddKeyPhotoButton} from '../sequence/KeyPhotoStrip';
import {LayerList} from '../layer/LayerList';
import {AddLayerMenu} from '../layer/AddLayerMenu';
import {tempProjectDir} from '../../lib/projectDir';

export function LeftPanel() {
  const sequences = sequenceStore.sequences.value;
  const activeSeq = sequenceStore.getActiveSequence();

  return (
    <div class="flex flex-col w-[268px] h-full bg-[var(--color-bg-card-alt)] shrink-0">
      {/* Sequences Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[var(--color-bg-section-header)]">
        <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
          SEQUENCES
        </span>
        <button
          class="rounded px-2 py-1 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] transition-colors"
          onClick={() =>
            sequenceStore.createSequence(
              `Sequence ${sequences.length + 1}`,
            )
          }
        >
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            + Add
          </span>
        </button>
      </div>

      {/* Sequence List (sortable with context actions) */}
      <SequenceList />

      {/* Key Photo Strip (for active sequence) */}
      {activeSeq && (
        <>
          <div class="w-full h-px bg-[var(--color-bg-divider)]" />
          <div class="flex items-center justify-between h-7 px-3 bg-[var(--color-bg-subsection)]">
            <span class="text-[9px] font-semibold text-[var(--color-text-dim)]">
              KEY PHOTOS
            </span>
            <div class="flex items-center gap-1">
              {/* Move/delete buttons -- only visible when a key photo is selected */}
              <KeyPhotoHeaderActions sequenceId={activeSeq.id} />
              {/* Add button -- always visible */}
              <AddKeyPhotoButton sequenceId={activeSeq.id} />
            </div>
          </div>
          <KeyPhotoStrip />
          {/* Per-sequence settings */}
          <SequenceSettings />
        </>
      )}

      {/* Panel Divider */}
      <div class="w-full h-px bg-[var(--color-bg-divider)]" />

      {/* Layers Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[var(--color-bg-section-header)]">
        <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
          LAYERS
        </span>
        <AddLayerMenu />
      </div>

      {/* Layer List */}
      <LayerList />

      {/* Divider */}
      <div class="w-full h-px bg-[var(--color-bg-divider)]" />

      {/* Import Section Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[var(--color-bg-section-header)]">
        <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
          IMPORTED
        </span>
        <button
          class="rounded px-2 py-1 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] transition-colors"
          onClick={async () => {
            const selected = await open({
              multiple: true,
              filters: [
                {
                  name: 'Images',
                  extensions: [
                    'jpg',
                    'jpeg',
                    'png',
                    'tiff',
                    'tif',
                    'heic',
                    'heif',
                  ],
                },
              ],
            });
            if (selected) {
              const dir = projectStore.dirPath.value ?? tempProjectDir.value;
              if (!dir) return;
              const paths = Array.isArray(selected) ? selected : [selected];
              imageStore.importFiles(paths, dir);
            }
          }}
        >
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            + Import
          </span>
        </button>
      </div>

      {/* Import Status */}
      {imageStore.isImporting.value && (
        <div class="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-selected)]">
          <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            Importing...
          </span>
        </div>
      )}

      {/* Import Errors */}
      {imageStore.importErrors.value.length > 0 && (
        <div class="px-3 py-1.5 bg-[var(--color-error-bg)]">
          {imageStore.importErrors.value.map((err, i) => (
            <span key={i} class="text-[9px] text-[var(--color-error-text)] block truncate">
              {err}
            </span>
          ))}
        </div>
      )}

      {/* Thumbnail Grid */}
      <ImportGrid />
    </div>
  );
}

/** Header actions for key photos: move left, delete, move right (only when selected) */
function KeyPhotoHeaderActions({sequenceId}: {sequenceId: string}) {
  const selectedId = sequenceStore.selectedKeyPhotoId.value;
  if (!selectedId) return null;

  const seq = sequenceStore.getById(sequenceId);
  if (!seq) return null;

  const idx = seq.keyPhotos.findIndex(kp => kp.id === selectedId);
  if (idx === -1) return null;

  const canMoveLeft = idx > 0;
  const canMoveRight = idx < seq.keyPhotos.length - 1;

  const btnClass = "w-5 h-5 rounded flex items-center justify-center text-[10px] transition-colors";
  const enabledClass = "bg-[var(--color-bg-divider)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:text-white";
  const disabledClass = "bg-[var(--color-bg-card)] text-[var(--color-text-dimmer)] cursor-default";

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

/** Per-sequence settings: fps toggle and resolution display */
function SequenceSettings() {
  const activeSeq = sequenceStore.getActiveSequence();
  if (!activeSeq) return null;

  const commonResolutions: Array<{label: string; w: number; h: number}> = [
    {label: '1920x1080', w: 1920, h: 1080},
    {label: '1280x720', w: 1280, h: 720},
    {label: '3840x2160', w: 3840, h: 2160},
  ];

  const currentResLabel = `${activeSeq.width}x${activeSeq.height}`;

  return (
    <div class="flex items-center gap-3 px-3 py-1.5 bg-[var(--color-bg-subsection)]">
      {/* FPS toggle */}
      <div class="flex items-center gap-1">
        <span class="text-[9px] text-[var(--color-text-dim)]">FPS:</span>
        <div class="flex rounded overflow-hidden border border-[var(--color-border-subtle)]">
          {[15, 24].map((rate) => (
            <button
              key={rate}
              class={`px-1.5 py-0.5 text-[9px] ${
                activeSeq.fps === rate
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-dim)] hover:bg-[var(--color-bg-settings)]'
              }`}
              onClick={() =>
                sequenceStore.setSequenceFps(activeSeq.id, rate)
              }
            >
              {rate}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution dropdown */}
      <div class="flex items-center gap-1">
        <span class="text-[9px] text-[var(--color-text-dim)]">Res:</span>
        <select
          class="text-[9px] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] rounded px-1 py-0.5 outline-none cursor-pointer"
          value={currentResLabel}
          onChange={(e) => {
            const selected = commonResolutions.find(
              (r) => r.label === (e.target as HTMLSelectElement).value,
            );
            if (selected) {
              sequenceStore.setSequenceResolution(
                activeSeq.id,
                selected.w,
                selected.h,
              );
            }
          }}
        >
          {commonResolutions.map((r) => (
            <option key={r.label} value={r.label}>
              {r.label}
            </option>
          ))}
          {/* Show current if not in common list */}
          {!commonResolutions.find((r) => r.label === currentResLabel) && (
            <option value={currentResLabel}>{currentResLabel}</option>
          )}
        </select>
      </div>
    </div>
  );
}
