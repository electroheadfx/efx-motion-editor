import {useRef, useEffect} from 'preact/hooks';
import '@efxlab/motion-canvas-player';
import {timelineStore} from '../stores/timelineStore';
import {frameMap} from '../lib/frameMap';
import {imageStore} from '../stores/imageStore';
import {currentPreviewUrl} from '../lib/previewBridge';
import {playbackEngine} from '../lib/playbackEngine';
import {assetUrl} from '../lib/ipc';

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mount Motion Canvas player and wire playbackEngine ref
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = document.createElement('motion-canvas-player');
    player.setAttribute('auto', '');
    player.setAttribute('responsive', '');
    player.setAttribute('background', '#000000');
    player.style.width = '100%';
    player.style.height = '100%';
    // Hide the player visually -- image display is handled by the img overlay
    // The player is kept in the DOM for Phase 5 compositing readiness
    player.style.position = 'absolute';
    player.style.opacity = '0';
    player.style.pointerEvents = 'none';
    container.prepend(player);

    // Set src after appending to DOM
    player.setAttribute('src', '/src/project.ts?project');

    // Wire playback engine to the player element
    playbackEngine.setPlayerRef(player);

    return () => {
      playbackEngine.setPlayerRef(null);
      container.removeChild(player);
    };
  }, []);

  // Effect: update preview image URL when current frame changes
  useEffect(() => {
    const updatePreviewImage = () => {
      const frame = timelineStore.currentFrame.value;
      const frames = frameMap.value;

      if (frames.length === 0 || frame < 0 || frame >= frames.length) {
        currentPreviewUrl.value = '';
        return;
      }

      const entry = frames[frame];
      if (!entry) {
        currentPreviewUrl.value = '';
        return;
      }

      const image = imageStore.getById(entry.imageId);
      if (!image) {
        currentPreviewUrl.value = '';
        return;
      }

      // Use project_path for full-res preview display
      const url = assetUrl(image.project_path);
      if (url !== currentPreviewUrl.peek()) {
        currentPreviewUrl.value = url;
      }
    };

    // This effect subscribes to currentFrame and frameMap via .value access
    updatePreviewImage();
  });

  const imgUrl = currentPreviewUrl.value;

  return (
    <div class="relative w-full">
      <div
        ref={containerRef}
        class="relative w-full aspect-video bg-black rounded overflow-hidden"
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Preview frame"
            class="absolute inset-0 w-full h-full"
            style={{objectFit: 'contain'}}
          />
        ) : (
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-[var(--color-text-secondary)] text-sm">
              No frames to preview
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
