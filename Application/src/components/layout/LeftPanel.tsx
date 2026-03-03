import {open} from '@tauri-apps/plugin-dialog';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {ImportGrid} from '../import/ImportGrid';
import {SequenceList} from '../sequence/SequenceList';
import {KeyPhotoStrip} from '../sequence/KeyPhotoStrip';
import {tempProjectDir} from '../../lib/projectDir';

// TODO(Phase 6): Replace layer mock data with real layer operations from layerStore.
// Layers are Phase 6 scope -- this mock seeding exists only for visual completeness.
// NOTE: With layerStore now derived from sequenceStore, mock data will only appear
// when an active sequence exists. The base layer is auto-generated per sequence.

export function LeftPanel() {
  const sequences = sequenceStore.sequences.value;
  const allLayers = layerStore.layers.value;
  const activeSeq = sequenceStore.getActiveSequence();

  return (
    <div class="flex flex-col w-[268px] h-full bg-[var(--color-bg-card-alt)] shrink-0">
      {/* Sequences Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[#111111]">
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
          <div class="w-full h-px bg-[#2A2A2A]" />
          <div class="flex items-center justify-between h-7 px-3 bg-[#131313]">
            <span class="text-[9px] font-semibold text-[var(--color-text-dim)]">
              KEY PHOTOS
            </span>
          </div>
          <KeyPhotoStrip />
          {/* Per-sequence settings */}
          <SequenceSettings />
        </>
      )}

      {/* Panel Divider */}
      <div class="w-full h-px bg-[#2A2A2A]" />

      {/* Layers Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[#111111]">
        <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
          LAYERS
        </span>
        <button class="rounded px-2 py-1 bg-[var(--color-bg-settings)]">
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            + Add FX
          </span>
        </button>
      </div>

      {/* Layers List -- TODO(Phase 5): Replace with LayerList component */}
      <div class="flex flex-col gap-0.5 p-2">
        {allLayers.map((layer) => {
          const isBase = layer.isBase ?? false;
          const thumbColor =
            layer.blendMode === 'screen'
              ? '#5B3A8F'
              : layer.blendMode === 'overlay'
                ? '#3A5F3A'
                : '#2E4A8F';
          return (
            <div
              key={layer.id}
              class={`flex items-center gap-2 rounded-md px-2.5 h-11 cursor-pointer ${
                isBase ? 'bg-[#1E1E1E]' : 'bg-[#252525]'
              }`}
              onClick={() => uiStore.selectLayer(layer.id)}
            >
              <div
                class="w-3.5 h-3.5 rounded-full shrink-0"
                style={{
                  backgroundColor: layer.visible ? '#555555' : '#333333',
                }}
              />
              <div
                class="w-8 h-6 rounded-[3px] shrink-0"
                style={{backgroundColor: thumbColor}}
              />
              <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                <span
                  class={`text-[11px] truncate ${
                    isBase
                      ? 'text-[#E0E0E0] font-medium'
                      : 'text-[#AAAAAA]'
                  }`}
                >
                  {layer.name}
                </span>
                <span class="text-[9px] text-[var(--color-text-dim)] truncate">
                  {layer.type === 'video'
                    ? 'FX Video'
                    : layer.type === 'image-sequence'
                      ? 'Keyframes'
                      : 'Static'}{' '}
                  &middot;{' '}
                  {layer.blendMode.charAt(0).toUpperCase() +
                    layer.blendMode.slice(1)}
                </span>
              </div>
              <div class="w-1.5 h-5 rounded-sm bg-[#333333] shrink-0" />
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div class="w-full h-px bg-[#2A2A2A]" />

      {/* Import Section Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[#111111]">
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
        <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A2A]">
          <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            Importing...
          </span>
        </div>
      )}

      {/* Import Errors */}
      {imageStore.importErrors.value.length > 0 && (
        <div class="px-3 py-1.5 bg-[#2A1A1A]">
          {imageStore.importErrors.value.map((err, i) => (
            <span key={i} class="text-[9px] text-[#FF6666] block truncate">
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
    <div class="flex items-center gap-3 px-3 py-1.5 bg-[#131313]">
      {/* FPS toggle */}
      <div class="flex items-center gap-1">
        <span class="text-[9px] text-[var(--color-text-dim)]">FPS:</span>
        <div class="flex rounded overflow-hidden border border-[#333]">
          {[15, 24].map((rate) => (
            <button
              key={rate}
              class={`px-1.5 py-0.5 text-[9px] ${
                activeSeq.fps === rate
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[#1A1A1A] text-[var(--color-text-dim)] hover:bg-[#252525]'
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
          class="text-[9px] bg-[#1A1A1A] text-[var(--color-text-secondary)] border border-[#333] rounded px-1 py-0.5 outline-none cursor-pointer"
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
