import {open, save} from '@tauri-apps/plugin-dialog';
import {useState, useRef, useEffect} from 'preact/hooks';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {guardUnsavedChanges} from '../../lib/unsavedGuard';
import {NewProjectDialog} from '../project/NewProjectDialog';
import {blurStore} from '../../stores/blurStore';
import {motionBlurStore} from '../../stores/motionBlurStore';
import {ThemeSwitcher} from './ThemeSwitcher';
import { FilePlus, FolderOpen, Save as SaveIcon, Ban, Images, Settings, Download, Zap, ChevronDown } from 'lucide-preact';

export function Toolbar() {
  const showNewDialog = uiStore.showNewProjectDialog.value;
  const [showMbPopover, setShowMbPopover] = useState(false);
  const mbPopoverRef = useRef<HTMLDivElement>(null);
  const mbButtonRef = useRef<HTMLButtonElement>(null);

  // Click-outside handler for motion blur popover
  useEffect(() => {
    if (!showMbPopover) return;
    const handler = (e: MouseEvent) => {
      if (mbPopoverRef.current && !mbPopoverRef.current.contains(e.target as Node)
          && mbButtonRef.current && !mbButtonRef.current.contains(e.target as Node)) {
        setShowMbPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMbPopover]);

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
    <div class="flex items-center gap-1 h-11 w-full bg-(--color-bg-toolbar) px-3 shrink-0">
      {/* New button */}
      <button
        class="flex items-center justify-center rounded-[5px] bg-(--color-accent) w-8 h-8 hover:bg-(--color-accent-hover) transition-colors"
        onClick={handleNew}
        title="New (Cmd+N)"
      >
        <FilePlus size={16} class="text-white" />
      </button>
      {/* Open button */}
      <button
        class="flex items-center justify-center rounded-[5px] bg-(--color-bg-settings) w-8 h-8 hover:bg-(--color-bg-input) transition-colors text-(--color-text-button)"
        onClick={handleOpen}
        title="Open (Cmd+O)"
      >
        <FolderOpen size={16} />
      </button>
      {/* Save button */}
      <button
        class={`flex items-center justify-center rounded-[5px] bg-(--color-bg-settings) w-8 h-8 hover:bg-(--color-bg-input) transition-colors text-(--color-text-button) ${
          projectStore.isSaving.value ? 'opacity-60' : ''
        }`}
        onClick={handleSave}
        title={projectStore.isSaving.value ? 'Saving...' : 'Save (Cmd+S)'}
      >
        <SaveIcon size={16} />
      </button>
      {/* Dirty indicator */}
      {projectStore.isDirty.value && (
        <div class="w-2 h-2 rounded-full bg-(--color-dot-orange) shrink-0" title="Unsaved changes" />
      )}
      <div class="w-px h-6 bg-(--color-border-subtle)" />
      {/* Blur Controls */}
      <button
        class={`flex items-center justify-center rounded-[5px] w-8 h-8 transition-colors ${
          blurStore.bypassBlur.value
            ? 'bg-(--color-dot-orange) text-white'
            : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) text-(--color-text-secondary)'
        }`}
        onClick={() => blurStore.toggleBypass()}
        title="Bypass All Blur (Shift+B)"
      >
        <Ban size={16} />
      </button>
      <div class="w-px h-6 bg-(--color-border-subtle)" />
      {/* Motion Blur Controls (per D-06) */}
      <div class="relative">
        <div class="flex items-center">
          <button
            ref={mbButtonRef}
            class={`flex items-center justify-center rounded-l-[5px] w-8 h-8 transition-colors ${
              motionBlurStore.enabled.value
                ? 'bg-(--color-accent) text-white'
                : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) text-(--color-text-secondary)'
            }`}
            onClick={() => motionBlurStore.toggleEnabled()}
            title="Toggle Motion Blur (M)"
          >
            <Zap size={16} />
          </button>
          <button
            class={`flex items-center justify-center rounded-r-[5px] w-5 h-8 transition-colors border-l border-(--color-border-subtle) ${
              motionBlurStore.enabled.value
                ? 'bg-(--color-accent) text-white'
                : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) text-(--color-text-secondary)'
            }`}
            onClick={() => setShowMbPopover(!showMbPopover)}
            title="Motion Blur Settings"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Popover dropdown */}
        {showMbPopover && (
          <div
            ref={mbPopoverRef}
            class="absolute top-full left-0 mt-1 w-56 bg-(--color-bg-toolbar) border border-(--color-border-subtle) rounded-lg shadow-xl p-3 z-[100] space-y-3"
          >
            {/* Shutter Angle slider (per D-07) */}
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-(--color-text-muted)">Shutter Angle</span>
                <span class="text-xs text-(--color-text-secondary) font-mono">{motionBlurStore.shutterAngle.value}deg</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={motionBlurStore.shutterAngle.value}
                onInput={(e) => motionBlurStore.setShutterAngle(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-(--color-accent)"
              />
              <div class="flex justify-between text-[10px] text-(--color-text-muted)">
                <span>0deg</span>
                <span>180deg</span>
                <span>360deg</span>
              </div>
            </div>

            {/* Preview Quality tier selector (per D-08) */}
            <div class="space-y-1">
              <span class="text-xs font-semibold text-(--color-text-muted)">Preview Quality</span>
              <div class="flex gap-1">
                {(['off', 'low', 'medium'] as const).map((q) => (
                  <button
                    key={q}
                    class={`flex-1 px-2 py-1 rounded-[4px] text-xs capitalize transition-colors ${
                      motionBlurStore.previewQuality.value === q
                        ? 'bg-(--color-accent) text-white'
                        : 'bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input)'
                    }`}
                    onClick={() => motionBlurStore.setPreviewQuality(q)}
                  >
                    {q === 'off' ? 'Off' : q === 'low' ? 'Low (16)' : 'Med (32)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div class="w-px h-6 bg-(--color-border-subtle)" />
      <ThemeSwitcher />
      {/* Spacer */}
      <div class="flex-1" />
      {/* Imported button */}
      <button
        class={`flex items-center justify-center rounded-[5px] w-8 h-8 transition-colors ${
          uiStore.editorMode.value === 'imported'
            ? 'bg-(--color-accent) text-white'
            : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) text-(--color-text-button)'
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
            ? 'bg-(--color-accent) text-white'
            : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) text-(--color-text-button)'
        }`}
        onClick={() => uiStore.setEditorMode(
          uiStore.editorMode.value === 'settings' ? 'editor' : 'settings'
        )}
        title="Settings"
      >
        <Settings size={16} />
      </button>
      <button
        class="flex items-center justify-center rounded-[5px] bg-[#F97316] hover:brightness-125 w-8 h-8 cursor-pointer transition-colors"
        onClick={() => uiStore.setEditorMode(
          uiStore.editorMode.value === 'export' ? 'editor' : 'export'
        )}
        title="Export (Cmd+Shift+E)"
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
