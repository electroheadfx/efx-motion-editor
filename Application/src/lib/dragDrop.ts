import {getCurrentWebview} from '@tauri-apps/api/webview';
import {useEffect} from 'preact/hooks';
import {signal} from '@preact/signals';

/** Accepted image file extensions (HEIC accepted but backend returns graceful error) */
const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
];

/** Whether a drag operation is currently over the window */
export const isDraggingOver = signal(false);

function isImagePath(p: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext));
}

/**
 * Hook that listens to Tauri's native drag-drop events.
 * Uses onDragDropEvent (NOT browser ondrop -- that doesn't work in Tauri).
 *
 * @param onDrop Callback receiving filtered image file paths
 * @param onReject Optional callback when non-image files are dropped
 */
export function useFileDrop(
  onDrop: (paths: string[]) => void,
  onReject?: (rejected: string[]) => void,
) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const type = event.payload.type;

        if (type === 'enter') {
          // Only show drop overlay for external file drags (paths > 0),
          // not for SortableJS internal element reorder drags
          if (event.payload.paths.length > 0) {
            isDraggingOver.value = true;
          }
        } else if (type === 'drop') {
          isDraggingOver.value = false;
          const paths = event.payload.paths;
          const imagePaths = paths.filter((p: string) => isImagePath(p));
          const rejectedPaths = paths.filter((p: string) => !isImagePath(p));

          if (imagePaths.length > 0) {
            onDrop(imagePaths);
          }
          if (rejectedPaths.length > 0 && onReject) {
            onReject(rejectedPaths);
          }
        } else if (type === 'leave') {
          isDraggingOver.value = false;
        }
        // 'over' events are ignored -- no paths available, and enter already activated
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, [onDrop, onReject]);
}
