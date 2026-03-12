import {useCallback} from 'preact/hooks';
import {Toolbar} from './Toolbar';
import {LeftPanel} from './LeftPanel';
import {CanvasArea} from './CanvasArea';
import {TimelinePanel} from './TimelinePanel';
import {PropertiesPanel} from './PropertiesPanel';
import {DropZone} from '../import/DropZone';
import {ShortcutsOverlay} from '../overlay/ShortcutsOverlay';
import {useFileDrop} from '../../lib/dragDrop';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {tempProjectDir} from '../../lib/projectDir';

export function EditorShell() {
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

  return (
    <div class="flex flex-col w-full h-full bg-[var(--color-bg-shell)] font-primary">
      <Toolbar />
      {/* Body Area */}
      <div class="flex flex-1 min-h-0">
        <LeftPanel />
        {/* Right Area: Canvas + Timeline */}
        <div class="flex flex-col flex-1 min-w-0">
          <CanvasArea />
          <div class="w-full h-px bg-[var(--color-separator)]" />
          <TimelinePanel />
        </div>
      </div>
      {/* Properties Divider */}
      <div class="w-full h-px bg-[var(--color-bg-card)]" />
      <PropertiesPanel />
      {/* Drop overlay -- renders on top of everything when dragging files */}
      <DropZone />
      {/* Shortcuts help overlay */}
      {uiStore.shortcutsOverlayOpen.value && <ShortcutsOverlay />}
    </div>
  );
}
