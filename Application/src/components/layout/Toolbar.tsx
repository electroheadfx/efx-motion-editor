import {open, save} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {guardUnsavedChanges} from '../../lib/unsavedGuard';
import {NewProjectDialog} from '../project/NewProjectDialog';

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
    <div class="flex items-center gap-1 h-11 w-full bg-[#1C1C1C] px-3 shrink-0">
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
        <span class="text-xs text-[#CCCCCC]">Open</span>
      </button>
      {/* Save button */}
      <button
        class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5 hover:bg-[var(--color-bg-input)] transition-colors"
        onClick={handleSave}
      >
        <span class="text-xs text-[#CCCCCC]">
          {projectStore.isSaving.value ? 'Saving...' : 'Save'}
        </span>
      </button>
      {/* Dirty indicator */}
      {projectStore.isDirty.value && (
        <div class="w-2 h-2 rounded-full bg-[var(--color-dot-orange)] shrink-0" title="Unsaved changes" />
      )}
      <div class="w-px h-6 bg-[#333333]" />
      {/* FPS Toggle -- wired to projectStore */}
      <div class="flex items-center gap-0.5 rounded-[5px] bg-[var(--color-bg-settings)] p-1">
        <div
          class={`flex items-center rounded px-2.5 py-1 cursor-pointer ${projectStore.fps.value === 15 ? 'bg-[var(--color-accent)]' : ''}`}
          onClick={() => projectStore.setFps(15)}
        >
          <span class={`text-[11px] ${projectStore.fps.value === 15 ? 'text-white' : 'text-[var(--color-text-secondary)]'}`}>15fps</span>
        </div>
        <div
          class={`flex items-center rounded px-2.5 py-1 cursor-pointer ${projectStore.fps.value === 24 ? 'bg-[var(--color-accent)]' : ''}`}
          onClick={() => projectStore.setFps(24)}
        >
          <span class={`text-[11px] ${projectStore.fps.value === 24 ? 'text-white' : 'text-[var(--color-text-secondary)]'}`}>24fps</span>
        </div>
      </div>
      {/* Spacer */}
      <div class="flex-1" />
      <span class="text-[11px] text-[var(--color-text-secondary)]">100%</span>
      <button class="rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1">
        <span class="text-sm text-[#CCCCCC]">-</span>
      </button>
      <button class="rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1">
        <span class="text-sm text-[#CCCCCC]">+</span>
      </button>
      <div class="w-px h-6 bg-[#333333]" />
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
