import {useState, useCallback} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {ImportGrid} from '../import/ImportGrid';
import {tempProjectDir} from '../../lib/projectDir';

export function ImportedView() {
  const seqId = sequenceStore.activeSequenceId.value;
  const isPickingKeyPhoto = !!seqId;

  // Multi-select mode: active when pendingNewSequenceId is set (from + Add flow)
  const pendingId = uiStore.pendingNewSequenceId.value;
  const isMultiSelect = !!pendingId;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectForKeyPhoto = (imageId: string) => {
    const activeId = sequenceStore.activeSequenceId.peek();
    if (!activeId) return;
    sequenceStore.addKeyPhoto(activeId, imageId);
    uiStore.setEditorMode('editor');
  };

  const handleToggleSelect = useCallback((imageId: string) => {
    setSelectedIds(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  }, []);

  const handleConfirm = useCallback(() => {
    const targetSeqId = uiStore.pendingNewSequenceId.peek() ?? sequenceStore.activeSequenceId.peek();
    if (targetSeqId && selectedIds.length > 0) {
      for (const imageId of selectedIds) {
        sequenceStore.addKeyPhoto(targetSeqId, imageId);
      }
    }
    uiStore.setPendingNewSequenceId(null);
    setSelectedIds([]);
    uiStore.setEditorMode('editor');
  }, [selectedIds]);

  const handleClose = useCallback(() => {
    const pending = uiStore.pendingNewSequenceId.peek();
    if (pending) {
      sequenceStore.remove(pending);
      uiStore.setPendingNewSequenceId(null);
    }
    setSelectedIds([]);
    uiStore.setEditorMode('editor');
  }, []);

  const handleImport = async () => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: 'Images',
        extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif'],
      }],
    });
    if (selected) {
      const dir = projectStore.dirPath.value ?? tempProjectDir.value;
      if (!dir) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      imageStore.importFiles(paths, dir);
    }
  };

  return (
    <div class="flex flex-col flex-1 min-w-0 bg-[var(--color-bg-root)]">
      {/* Header bar */}
      <div class="flex items-center justify-between h-10 px-4 bg-[var(--color-bg-toolbar)] border-b border-[var(--color-separator)] shrink-0">
        <span class="text-sm font-semibold text-[var(--color-text-button)]">
          {isMultiSelect
            ? `Select key photos${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`
            : isPickingKeyPhoto
              ? 'Select a key photo'
              : 'Imported Assets'}
        </span>
        <div class="flex items-center gap-2">
          {isMultiSelect && (
            <button
              class="rounded-[5px] px-4 py-1.5 transition-colors"
              style={{
                backgroundColor: selectedIds.length > 0 ? 'var(--color-accent)' : 'var(--sidebar-input-bg)',
                opacity: selectedIds.length > 0 ? 1 : 0.5,
                cursor: selectedIds.length > 0 ? 'pointer' : 'default',
              }}
              onClick={selectedIds.length > 0 ? handleConfirm : undefined}
              disabled={selectedIds.length === 0}
            >
              <span class="text-xs text-white font-semibold">Confirm ({selectedIds.length})</span>
            </button>
          )}
          <button
            class="rounded-[5px] bg-[var(--color-accent)] px-3 py-1.5 hover:bg-[var(--color-accent-hover)] transition-colors"
            onClick={handleImport}
          >
            <span class="text-xs text-white">+ Import</span>
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-button)] transition-colors"
            onClick={handleClose}
            title={isMultiSelect ? 'Cancel' : 'Close'}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Import status */}
      {imageStore.isImporting.value && (
        <div class="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-bg-selected)]">
          <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span class="text-[10px] text-[var(--color-text-secondary)]">Importing...</span>
        </div>
      )}

      {/* Import errors */}
      {imageStore.importErrors.value.length > 0 && (
        <div class="px-4 py-1.5 bg-[var(--color-error-bg)]">
          {imageStore.importErrors.value.map((err, i) => (
            <span key={i} class="text-[9px] text-[var(--color-error-text)] block truncate">{err}</span>
          ))}
        </div>
      )}

      {/* Full-size import grid */}
      <div class="flex-1 overflow-y-auto p-4">
        <ImportGrid
          onSelect={!isMultiSelect && isPickingKeyPhoto ? handleSelectForKeyPhoto : undefined}
          multiSelect={isMultiSelect}
          selectedIds={isMultiSelect ? selectedIds : undefined}
          onToggleSelect={isMultiSelect ? handleToggleSelect : undefined}
        />
      </div>
    </div>
  );
}
