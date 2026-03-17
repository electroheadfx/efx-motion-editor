import { useCallback, useEffect } from 'preact/hooks';
import { Toolbar } from './Toolbar';
import { LeftPanel } from './LeftPanel';
import { CanvasArea } from './CanvasArea';
import { TimelinePanel } from './TimelinePanel';
import { ImportedView } from '../views/ImportedView';
import { SettingsView } from '../views/SettingsView';
import { DropZone } from '../import/DropZone';
import { ShortcutsOverlay } from '../overlay/ShortcutsOverlay';
import { CollapseHandle } from '../sidebar/CollapseHandle';
import { useFileDrop } from '../../lib/dragDrop';
import { imageStore } from '../../stores/imageStore';
import { layerStore } from '../../stores/layerStore';
import { projectStore } from '../../stores/projectStore';
import { uiStore } from '../../stores/uiStore';
import { tempProjectDir } from '../../lib/projectDir';

/** Interactive element selectors that should NOT trigger deselection */
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, [role="button"], [data-interactive], [contenteditable]';

export function EditorShell() {
  // Initialize sidebar layout from persisted config on mount
  useEffect(() => { uiStore.initSidebarLayout(); }, []);

  const handleDrop = useCallback((paths: string[]) => {
    const dir = projectStore.dirPath.value ?? tempProjectDir.value;
    if (dir) imageStore.importFiles(paths, dir);
  }, []);

  const handleReject = useCallback((rejected: string[]) => {
    const names = rejected.map((p) => p.split('/').pop()).join(', ');
    imageStore.importErrors.value = [
      `Unsupported file(s) skipped: ${names}. Only JPEG, PNG, TIFF, and HEIC are accepted.`,
    ];
  }, []);

  useFileDrop(handleDrop, handleReject);

  /** Deselect the active layer when clicking on non-interactive chrome outside the canvas */
  const handleShellPointerDown = useCallback((e: PointerEvent) => {
    // Nothing to deselect
    if (layerStore.selectedLayerId.peek() === null) return;

    const target = e.target as HTMLElement;

    // Click is inside the canvas area -- let TransformOverlay handle it
    if (target.closest('[data-canvas-area]')) return;

    // Click is on an interactive control -- don't interfere
    if (target.closest(INTERACTIVE_SELECTOR)) return;

    // Dead space click -- deselect
    layerStore.setSelected(null);
    uiStore.selectLayer(null);
  }, []);

  return (
    <div
      class="flex flex-col w-full h-full bg-[var(--color-bg-shell)] font-primary"
      onPointerDown={handleShellPointerDown}
    >
      <Toolbar />
      {/* Body Area */}
      <div class="flex flex-1 min-h-0">
        {/* Sidebar (collapsible) */}
        {!uiStore.sidebarCollapsed.value ? (
          <div class="relative shrink-0" data-sidebar style={{ width: `${uiStore.sidebarWidth.value}px` }}>
            <LeftPanel />
            <CollapseHandle />
          </div>
        ) : (
          <div class="relative shrink-0" data-sidebar style={{ width: '20px', backgroundColor: 'var(--sidebar-bg)' }}>
            <CollapseHandle />
          </div>
        )}

        {/* Right Area: mode-dependent content */}
        {uiStore.editorMode.value === 'editor' && (
          <div class="flex flex-col flex-1 min-w-0">
            <CanvasArea />
            <div class="w-full h-px bg-[var(--color-separator)]" />
            <TimelinePanel />
          </div>
        )}
        {uiStore.editorMode.value === 'imported' && <ImportedView />}
        {uiStore.editorMode.value === 'settings' && <SettingsView />}
      </div>
      {/* Drop overlay -- renders on top of everything when dragging files */}
      <DropZone />
      {/* Shortcuts help overlay */}
      {uiStore.shortcutsOverlayOpen.value && <ShortcutsOverlay />}
    </div>
  );
}
