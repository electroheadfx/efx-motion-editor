import {useEffect, useRef} from 'preact/hooks';
import {exportStore} from '../../stores/exportStore';
import {projectStore} from '../../stores/projectStore';
import {totalFrames, frameMap, crossDissolveOverlaps} from '../../lib/frameMap';
import {sequenceStore} from '../../stores/sequenceStore';
import {PreviewRenderer} from '../../lib/previewRenderer';
import {renderGlobalFrame, preloadExportImages} from '../../lib/exportRenderer';
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

  // Preview canvas ref for rendering a sample frame
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render a sample frame (middle of timeline) into the preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames === 0) return;

    const fm = frameMap.peek();
    const allSeqs = sequenceStore.sequences.peek();
    const overlaps = crossDissolveOverlaps.peek();

    // Use a preview-sized canvas (max 300px wide, maintain aspect ratio)
    const previewWidth = Math.min(300, outWidth);
    const scale = previewWidth / outWidth;
    const previewHeight = Math.round(outHeight * scale);

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const renderer = new PreviewRenderer(canvas);
    const sampleFrame = Math.floor(frames / 2);

    preloadExportImages(renderer, fm).then(() => {
      renderGlobalFrame(renderer, canvas, sampleFrame, fm, allSeqs, overlaps);
    });

    return () => {
      renderer.dispose();
    };
  }, [frames, outWidth, outHeight]);

  const handlePickFolder = async () => {
    const selected = await open({directory: true, title: 'Choose Export Folder'});
    if (selected && typeof selected === 'string') {
      exportStore.setOutputFolder(selected);
    }
  };

  return (
    <div class="flex flex-col gap-6 h-full">
      {/* Preview thumbnail */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-[var(--color-text-muted)]">Preview</label>
        <div
          class="flex items-center justify-center rounded-[5px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-settings)] overflow-hidden"
          style={{aspectRatio: `${baseWidth}/${baseHeight}`, maxHeight: '240px'}}
        >
          {frames > 0 ? (
            <canvas ref={canvasRef} class="w-full h-full object-contain" />
          ) : (
            <span class="text-sm text-[var(--color-text-muted)]">
              {outWidth} x {outHeight}
            </span>
          )}
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
