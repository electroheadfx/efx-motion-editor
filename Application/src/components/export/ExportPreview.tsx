import {exportStore} from '../../stores/exportStore';
import {projectStore} from '../../stores/projectStore';
import {totalFrames} from '../../lib/frameMap';
import {open} from '@tauri-apps/plugin-dialog';

export function ExportPreview() {
  const format = exportStore.format.value;
  const resolution = exportStore.resolution.value;
  const folder = exportStore.outputFolder.value;
  const frames = totalFrames.value;
  const fps = projectStore.fps.value;
  const baseWidth = projectStore.width.value;
  const baseHeight = projectStore.height.value;

  const outWidth = Math.round(baseWidth * resolution);
  const outHeight = Math.round(baseHeight * resolution);
  const duration = fps > 0 ? (frames / fps).toFixed(2) : '0.00';

  // Rough size estimate: PNG ~4 bytes/pixel, video ~0.5 bytes/pixel/frame
  const bytesPerFrame = format === 'png'
    ? outWidth * outHeight * 4
    : outWidth * outHeight * 0.5;
  const totalBytes = bytesPerFrame * frames;
  const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);

  const handlePickFolder = async () => {
    const selected = await open({directory: true, title: 'Choose Export Folder'});
    if (selected && typeof selected === 'string') {
      exportStore.setOutputFolder(selected);
    }
  };

  return (
    <div class="flex flex-col gap-6 h-full">
      {/* Preview thumbnail placeholder */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-[var(--color-text-muted)]">Preview</label>
        <div
          class="flex items-center justify-center rounded-[5px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-settings)]"
          style={{aspectRatio: `${baseWidth}/${baseHeight}`, maxHeight: '240px'}}
        >
          <span class="text-sm text-[var(--color-text-muted)]">
            {outWidth} x {outHeight}
          </span>
        </div>
      </div>

      {/* Output summary */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-[var(--color-text-muted)]">Output Summary</label>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span class="text-[var(--color-text-muted)]">Frames</span>
          <span class="text-[var(--color-text-secondary)]">{frames}</span>

          <span class="text-[var(--color-text-muted)]">Duration</span>
          <span class="text-[var(--color-text-secondary)]">{duration}s @ {fps} fps</span>

          <span class="text-[var(--color-text-muted)]">Est. Size</span>
          <span class="text-[var(--color-text-secondary)]">~{sizeMB} MB</span>

          <span class="text-[var(--color-text-muted)]">Resolution</span>
          <span class="text-[var(--color-text-secondary)]">{outWidth} x {outHeight}</span>
        </div>
      </div>

      {/* Output folder */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-[var(--color-text-muted)]">Output Folder</label>
        {folder ? (
          <div class="flex items-center gap-2">
            <span class="text-sm text-[var(--color-text-secondary)] truncate flex-1 font-mono bg-[var(--color-bg-settings)] px-3 py-2 rounded-[5px]">
              {folder}
            </span>
            <button
              class="px-3 py-2 rounded-[5px] text-sm bg-[var(--color-bg-settings)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] transition-colors shrink-0"
              onClick={handlePickFolder}
            >
              Change
            </button>
          </div>
        ) : (
          <button
            class="px-4 py-2 rounded-[5px] text-sm bg-[var(--color-bg-settings)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)] transition-colors"
            onClick={handlePickFolder}
          >
            Choose Folder...
          </button>
        )}
      </div>
    </div>
  );
}
