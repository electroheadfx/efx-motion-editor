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

/**
 * Hook that listens to Tauri's native drag-drop events.
 * Uses onDragDropEvent (NOT browser ondrop -- that doesn't work in Tauri).
 *
 * @param onDrop Callback receiving filtered image file paths
 */
export function useFileDrop(onDrop: (paths: string[]) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const type = event.payload.type;

        if (type === 'enter' || type === 'over') {
          isDraggingOver.value = true;
        } else if (type === 'drop') {
          isDraggingOver.value = false;
          const paths = event.payload.paths;
          // Filter to supported image extensions only
          const imagePaths = paths.filter((p: string) =>
            IMAGE_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext)),
          );
          if (imagePaths.length > 0) {
            onDrop(imagePaths);
          }
        } else {
          // 'leave' event
          isDraggingOver.value = false;
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, [onDrop]);
}
