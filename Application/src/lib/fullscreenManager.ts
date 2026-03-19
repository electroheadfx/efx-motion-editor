import {signal} from '@preact/signals';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {playbackEngine} from './playbackEngine';
import {timelineStore} from '../stores/timelineStore';

export const isFullscreen = signal(false);

export async function enterFullscreen(): Promise<void> {
  try {
    await getCurrentWindow().setFullscreen(true);
    isFullscreen.value = true;
  } catch (err) {
    console.error('Failed to enter fullscreen:', err);
  }
}

export async function exitFullscreen(): Promise<void> {
  // Stop playback if running (this also clears isFullSpeed)
  if (timelineStore.isPlaying.peek()) {
    playbackEngine.stop();
  }
  try {
    await getCurrentWindow().setFullscreen(false);
  } catch (err) {
    console.error('Failed to exit Tauri fullscreen:', err);
  }
  isFullscreen.value = false;
}

export function toggleFullscreen(): void {
  if (isFullscreen.peek()) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
}

// Listen for external fullscreen exit (e.g., macOS green button or system ESC).
// Only checks when we believe we're in fullscreen, with debounce to avoid IPC spam.
export function initFullscreenListener(): void {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  getCurrentWindow().onResized(() => {
    // Skip IPC entirely when not in fullscreen
    if (!isFullscreen.peek()) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const fs = await getCurrentWindow().isFullscreen();
      if (!fs && isFullscreen.peek()) {
        if (timelineStore.isPlaying.peek()) {
          playbackEngine.stop();
        }
        isFullscreen.value = false;
      }
    }, 200);
  });
}
