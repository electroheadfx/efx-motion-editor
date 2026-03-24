import { exportStore } from '../../stores/exportStore';
import { exportOpenInFinder } from '../../lib/ipc';
import { resumeExport } from '../../lib/exportEngine';
import { uiStore } from '../../stores/uiStore';

function formatEta(seconds: number | null): string {
  if (seconds == null) return '';
  if (seconds < 60) return `${seconds}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s remaining`;
}

export function ExportProgress() {
  const p = exportStore.progress.value;
  const percent = p.totalFrames > 0 ? Math.round((p.currentFrame / p.totalFrames) * 100) : 0;

  // Don't render if idle
  if (p.status === 'idle') return null;

  return (
    <div class="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
      <div class="bg-(--color-bg-root) rounded-lg p-8 w-[480px] space-y-4 shadow-2xl border border-(--color-separator)">
        {/* Status text */}
        <div class="text-sm font-semibold text-(--color-text-button)">
          {p.status === 'preparing' && 'Preparing export...'}
          {p.status === 'rendering' && `Rendering frame ${p.currentFrame} of ${p.totalFrames}`}
          {p.status === 'encoding' && 'Encoding video...'}
          {p.status === 'complete' && 'Export complete!'}
          {p.status === 'cancelled' && 'Export cancelled'}
          {p.status === 'error' && 'Export failed'}
        </div>

        {/* Progress bar */}
        {(p.status === 'preparing' || p.status === 'rendering' || p.status === 'encoding') && (
          <div class="w-full h-2 bg-(--color-bg-input) rounded-full overflow-hidden">
            <div
              class="h-full bg-[#F97316] rounded-full transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        {/* ETA */}
        {p.status === 'rendering' && p.estimatedSecondsRemaining != null && (
          <div class="text-xs text-(--color-text-muted)">
            {formatEta(p.estimatedSecondsRemaining)} ({percent}%)
          </div>
        )}

        {/* Error message */}
        {p.status === 'error' && p.errorMessage && (
          <div class="text-xs text-red-400 bg-red-900/20 p-3 rounded">
            {p.errorMessage}
          </div>
        )}

        {/* Action buttons */}
        <div class="flex gap-3 justify-end">
          {/* Cancel button during rendering */}
          {(p.status === 'preparing' || p.status === 'rendering' || p.status === 'encoding') && (
            <button
              class="px-4 py-2 rounded-[5px] bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input) text-sm transition-colors"
              onClick={() => exportStore.cancel()}
            >
              Cancel
            </button>
          )}

          {/* Resume button on error (per D-29) */}
          {p.status === 'error' && p.resumeFromFrame != null && (
            <button
              class="px-4 py-2 rounded-[5px] bg-[#F97316] text-white text-sm font-semibold hover:brightness-125 transition-colors"
              onClick={() => resumeExport()}
            >
              Resume from frame {p.resumeFromFrame}
            </button>
          )}

          {/* Open in Finder on complete (per D-30) */}
          {p.status === 'complete' && p.outputPath && (
            <button
              class="px-4 py-2 rounded-[5px] bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input) text-sm transition-colors"
              onClick={() => exportOpenInFinder(p.outputPath!)}
            >
              Open in Finder
            </button>
          )}

          {/* Close button on complete/cancelled/error */}
          {(p.status === 'complete' || p.status === 'cancelled' || p.status === 'error') && (
            <button
              class="px-4 py-2 rounded-[5px] bg-(--color-accent) text-white text-sm font-semibold hover:brightness-110 transition-colors"
              onClick={() => {
                exportStore.resetProgress();
                uiStore.setEditorMode('editor');
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
