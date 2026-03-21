import {exportStore} from '../../stores/exportStore';
import {projectStore} from '../../stores/projectStore';
import type {ExportFormat, ExportResolution} from '../../types/export';

const FORMATS: {value: ExportFormat; label: string; ext: string}[] = [
  {value: 'png', label: 'PNG Sequence', ext: '.png'},
  {value: 'prores', label: 'ProRes', ext: '.mov'},
  {value: 'h264', label: 'H.264', ext: '.mp4'},
  {value: 'av1', label: 'AV1', ext: '.mp4'},
];

const RESOLUTIONS: ExportResolution[] = [0.15, 0.25, 0.5, 1, 2];

export function FormatSelector() {
  const currentFormat = exportStore.format.value;
  const currentResolution = exportStore.resolution.value;
  const baseWidth = projectStore.width.value;
  const baseHeight = projectStore.height.value;
  const projectName = projectStore.name.value;

  return (
    <div class="flex flex-col gap-6">
      {/* Format selector */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-[var(--color-text-muted)]">Format</label>
        <div class="flex flex-wrap gap-2">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              class={`px-4 py-2 rounded-[5px] text-sm transition-colors ${
                currentFormat === fmt.value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-settings)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)]'
              }`}
              onClick={() => exportStore.setFormat(fmt.value)}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution multiplier */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-[var(--color-text-muted)]">Resolution</label>
        <div class="flex flex-wrap gap-2">
          {RESOLUTIONS.map((res) => (
            <button
              key={res}
              class={`px-4 py-2 rounded-[5px] text-sm transition-colors ${
                currentResolution === res
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-settings)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)]'
              }`}
              onClick={() => exportStore.setResolution(res)}
            >
              {res}x
            </button>
          ))}
        </div>
        <div class="text-xs text-[var(--color-text-muted)]">
          {Math.round(baseWidth * currentResolution)} x {Math.round(baseHeight * currentResolution)} px
        </div>
      </div>

      {/* Video quality (shown only for video formats) */}
      {currentFormat !== 'png' && (
        <div class="space-y-2">
          <label class="text-xs font-semibold text-[var(--color-text-muted)]">Quality</label>
          <div class="text-sm text-[var(--color-text-secondary)]">
            {currentFormat === 'h264' && `CRF ${exportStore.videoQuality.value.h264Crf} (lower = better)`}
            {currentFormat === 'av1' && `CRF ${exportStore.videoQuality.value.av1Crf} (lower = better)`}
            {currentFormat === 'prores' && `ProRes ${exportStore.videoQuality.value.proresProfile.toUpperCase()}`}
          </div>
        </div>
      )}

      {/* PNG naming pattern */}
      {currentFormat === 'png' && (
        <div class="space-y-2">
          <label class="text-xs font-semibold text-[var(--color-text-muted)]">Naming Pattern</label>
          <div class="text-sm text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-settings)] px-3 py-2 rounded-[5px]">
            {projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_0001.png
          </div>
        </div>
      )}
    </div>
  );
}
