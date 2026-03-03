import {useCallback} from 'preact/hooks';
import {Toolbar} from './Toolbar';
import {LeftPanel} from './LeftPanel';
import {CanvasArea} from './CanvasArea';
import {TimelinePanel} from './TimelinePanel';
import {PropertiesPanel} from './PropertiesPanel';
import {DropZone} from '../import/DropZone';
import {useFileDrop} from '../../lib/dragDrop';
import {imageStore} from '../../stores/imageStore';

// Temporary project directory for Phase 2 -- will use actual project path in Phase 3
const TEMP_PROJECT_DIR = '/tmp/efx-motion-project';

export function EditorShell() {
  const handleDrop = useCallback((paths: string[]) => {
    imageStore.importFiles(paths, TEMP_PROJECT_DIR);
  }, []);

  const handleReject = useCallback((rejected: string[]) => {
    const names = rejected.map((p) => p.split('/').pop()).join(', ');
    imageStore.importErrors.value = [
      `Unsupported file(s) skipped: ${names}. Only JPEG, PNG, TIFF, and HEIC are accepted.`,
    ];
  }, []);

  useFileDrop(handleDrop, handleReject);

  return (
    <div class="flex flex-col w-full h-full bg-[#151515] font-primary">
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
    </div>
  );
}
