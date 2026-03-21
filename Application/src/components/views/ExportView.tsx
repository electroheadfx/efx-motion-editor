import {FormatSelector} from '../export/FormatSelector';
import {ExportPreview} from '../export/ExportPreview';
import {ExportProgress} from '../export/ExportProgress';
import {uiStore} from '../../stores/uiStore';
import {exportStore} from '../../stores/exportStore';
import {startExport} from '../../lib/exportEngine';

export function ExportView() {
  return (
    <div class="relative flex flex-col flex-1 min-w-0 bg-[var(--color-bg-root)]">
      {/* Header bar */}
      <div class="flex items-center justify-between h-10 px-4 bg-[var(--color-bg-toolbar)] border-b border-[var(--color-separator)] shrink-0">
        <span class="text-sm font-semibold text-[var(--color-text-button)]">Export</span>
        <button
          class="w-6 h-6 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-button)] transition-colors"
          onClick={() => uiStore.setEditorMode('editor')}
          title="Close"
        >
          &times;
        </button>
      </div>
      {/* Body: format selector left, preview right */}
      <div class="flex flex-1 min-h-0 p-6 gap-8">
        <div class="shrink-0 w-80">
          <FormatSelector />
        </div>
        <div class="flex-1 min-w-0">
          <ExportPreview />
        </div>
      </div>
      {/* Bottom bar: Export button */}
      <div class="flex items-center justify-end h-14 px-6 bg-[var(--color-bg-toolbar)] border-t border-[var(--color-separator)] shrink-0">
        <button
          class="px-6 py-2 rounded-[5px] bg-[#F97316] hover:brightness-125 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          onClick={() => startExport()}
          disabled={exportStore.isExporting.value || !exportStore.outputFolder.value}
        >
          Export
        </button>
      </div>
      {/* Progress overlay */}
      <ExportProgress />
    </div>
  );
}
