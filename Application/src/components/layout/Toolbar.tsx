import {open, save} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {guardUnsavedChanges} from '../../lib/unsavedGuard';
import {NewProjectDialog} from '../project/NewProjectDialog';
import {blurStore} from '../../stores/blurStore';
import {ThemeSwitcher} from './ThemeSwitcher';
import { FilePlus, FolderOpen, Save as SaveIcon, Ban, Images, Settings, Download } from 'lucide-preact';

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
        class="flex items-center justify-center rounded-[5px] bg-[var(--color-accent)] w-8 h-8 hover:bg-[var(--color-accent-hover)] transition-colors"
        onClick={handleNew}
        title="New (Cmd+N)"
      >
        <FilePlus size={16} class="text-white" />
      </button>
      {/* Open button */}
      <button
        class="flex items-center justify-center rounded-[5px] bg-[var(--color-bg-settings)] w-8 h-8 hover:bg-[var(--color-bg-input)] transition-colors text-[var(--color-text-button)]"
        onClick={handleOpen}
        title="Open (Cmd+O)"
      >
        <FolderOpen size={16} />
      </button>
      {/* Save button */}
      <button
        class={`flex items-center justify-center rounded-[5px] bg-[var(--color-bg-settings)] w-8 h-8 hover:bg-[var(--color-bg-input)] transition-colors text-[var(--color-text-button)] ${
          projectStore.isSaving.value ? 'opacity-60' : ''
        }`}
        onClick={handleSave}
        title={projectStore.isSaving.value ? 'Saving...' : 'Save (Cmd+S)'}
      >
        <SaveIcon size={16} />
      </button>
      {/* Dirty indicator */}
      {projectStore.isDirty.value && (
        <div class="w-2 h-2 rounded-full bg-[var(--color-dot-orange)] shrink-0" title="Unsaved changes" />
      )}
      <div class="w-px h-6 bg-[var(--color-border-subtle)]" />
      {/* Blur Controls */}
      <button
        class={`flex items-center justify-center rounded-[5px] w-8 h-8 transition-colors ${
          blurStore.bypassBlur.value
            ? 'bg-[var(--color-dot-orange)] text-white'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] text-[var(--color-text-secondary)]'
        }`}
        onClick={() => blurStore.toggleBypass()}
        title="Bypass All Blur (Shift+B)"
      >
        <Ban size={16} />
      </button>
      <div class="w-px h-6 bg-[var(--color-border-subtle)]" />
      <ThemeSwitcher />
      {/* Spacer */}
      <div class="flex-1" />
      {/* Imported button */}
      <button
        class={`flex items-center justify-center rounded-[5px] w-8 h-8 transition-colors ${
          uiStore.editorMode.value === 'imported'
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] text-[var(--color-text-button)]'
        }`}
        onClick={() => {
          if (uiStore.editorMode.value === 'imported') {
            uiStore.setAddLayerIntent(null);
            uiStore.setEditorMode('editor');
          } else {
            uiStore.setEditorMode('imported');
          }
        }}
        title="Imported"
      >
        <Images size={16} />
      </button>
      {/* Settings button */}
      <button
        class={`flex items-center justify-center rounded-[5px] w-8 h-8 transition-colors ${
          uiStore.editorMode.value === 'settings'
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] text-[var(--color-text-button)]'
        }`}
        onClick={() => uiStore.setEditorMode(
          uiStore.editorMode.value === 'settings' ? 'editor' : 'settings'
        )}
        title="Settings"
      >
        <Settings size={16} />
      </button>
      <button
        class="flex items-center justify-center rounded-[5px] bg-[#F97316] w-8 h-8"
        title="Export"
      >
        <Download size={16} class="text-white" />
      </button>

      {/* New Project Dialog */}
      {showNewDialog && (
        <NewProjectDialog onClose={() => { uiStore.showNewProjectDialog.value = false; }} />
      )}
    </div>
  );
}
