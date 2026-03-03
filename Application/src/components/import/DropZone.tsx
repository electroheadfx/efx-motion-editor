import {isDraggingOver} from '../../lib/dragDrop';

/**
 * Full-window overlay that appears when dragging files over the app.
 * Does not handle the drop itself -- that's done by useFileDrop in EditorShell.
 * This is purely visual feedback.
 */
export function DropZone() {
  if (!isDraggingOver.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#000000CC] pointer-events-none">
      <div class="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-[var(--color-accent)] bg-[#1A1A1ACC]">
        <div class="text-4xl">&#128247;</div>
        <span class="text-lg font-medium text-[var(--color-text-primary)]">
          Drop images to import
        </span>
        <span class="text-sm text-[var(--color-text-secondary)]">
          JPEG, PNG, TIFF, HEIC supported
        </span>
      </div>
    </div>
  );
}
