import {open, save} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {guardUnsavedChanges} from '../../lib/unsavedGuard';
import {NewProjectDialog} from '../project/NewProjectDialog';
import {blurStore} from '../../stores/blurStore';

export function Toolbar() {
  const showNewDialog = uiStore.showNewProjectDialog.value;

  const handleNew = async () => {
    const guard = await guardUnsavedChanges();
    if (guard === 'cancelled') return;
    uiStore.showNewProjectDialog.value = true;
  };

  const handleOpen = async () => {
    const guard = await guardUnsavedChanges();
    if (guard === 'cancelled') return;

    const selected = await open({
      multiple: false,
      filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
    });
    if (selected && typeof selected === 'string') {
      try {
        await projectStore.openProject(selected);
      } catch (err) {
        console.error('Failed to open project:', err);
      }
    }
  };

  const handleSave = async () => {
    if (projectStore.isSaving.value) return;

    if (!projectStore.filePath.value) {
      // Never saved -- prompt for file path
      const filePath = await save({
        filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
        defaultPath: `${projectStore.name.value}.mce`,
      });
      if (filePath) {
        try {
          await projectStore.saveProjectAs(filePath);
        } catch (err) {
          console.error('Failed to save project:', err);
        }
      }
    } else {
      try {
        await projectStore.saveProject();
      } catch (err) {
        console.error('Failed to save project:', err);
      }
    }
  };

  return (
    <div class="flex items-center gap-1 h-11 w-full bg-[var(--color-bg-toolbar)] px-3 shrink-0">
      {/* New button */}
      <button
        class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-accent)] px-3 py-1.5 hover:bg-[var(--color-accent-hover)] transition-colors"
        onClick={handleNew}
      >
        <span class="text-xs text-white">New</span>
      </button>
      {/* Open button */}
      <button
        class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5 hover:bg-[var(--color-bg-input)] transition-colors"
        onClick={handleOpen}
      >
        <span class="text-xs text-[var(--color-text-button)]">Open</span>
      </button>
      {/* Save button */}
      <button
        class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5 hover:bg-[var(--color-bg-input)] transition-colors"
        onClick={handleSave}
      >
        <span class="text-xs text-[var(--color-text-button)]">
          {projectStore.isSaving.value ? 'Saving...' : 'Save'}
        </span>
      </button>
      {/* Dirty indicator */}
      {projectStore.isDirty.value && (
        <div class="w-2 h-2 rounded-full bg-[var(--color-dot-orange)] shrink-0" title="Unsaved changes" />
      )}
      <div class="w-px h-6 bg-[var(--color-border-subtle)]" />
      {/* Blur Controls */}
      <button
        class={`rounded-[5px] px-2.5 py-1 transition-colors ${
          blurStore.bypassBlur.value
            ? 'bg-[var(--color-dot-orange)]'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)]'
        }`}
        onClick={() => blurStore.toggleBypass()}
        title="Bypass All Blur (Shift+B)"
      >
        <span class={`text-[10px] font-semibold ${
          blurStore.bypassBlur.value ? 'text-white' : 'text-[var(--color-text-secondary)]'
        }`}>Blur Off</span>
      </button>
      {/* Spacer */}
      <div class="flex-1" />
      {/* Imported button */}
      <button
        class={`flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 transition-colors ${
          uiStore.editorMode.value === 'imported'
            ? 'bg-[var(--color-accent)]'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)]'
        }`}
        onClick={() => {
          if (uiStore.editorMode.value === 'imported') {
            uiStore.setAddLayerIntent(null);
            uiStore.setEditorMode('editor');
          } else {
            uiStore.setEditorMode('imported');
          }
        }}
      >
        <span class={`text-xs ${
          uiStore.editorMode.value === 'imported' ? 'text-white' : 'text-[var(--color-text-button)]'
        }`}>Imported</span>
      </button>
      {/* Settings button */}
      <button
        class={`flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 transition-colors ${
          uiStore.editorMode.value === 'settings'
            ? 'bg-[var(--color-accent)]'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)]'
        }`}
        onClick={() => uiStore.setEditorMode(
          uiStore.editorMode.value === 'settings' ? 'editor' : 'settings'
        )}
      >
        <span class={`text-xs ${
          uiStore.editorMode.value === 'settings' ? 'text-white' : 'text-[var(--color-text-button)]'
        }`}>Settings</span>
      </button>
      <button class="flex items-center gap-1.5 rounded-[5px] bg-[#F97316] px-4 py-1.5">
        <span class="text-xs font-semibold text-white">Export</span>
      </button>

      {/* New Project Dialog */}
      {showNewDialog && (
        <NewProjectDialog onClose={() => { uiStore.showNewProjectDialog.value = false; }} />
      )}
    </div>
  );
}
