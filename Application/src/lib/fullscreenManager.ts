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

// Listen for Tauri window fullscreen changes (e.g., macOS green button or system ESC).
// Must be called once at app startup.
export function initFullscreenListener(): void {
  getCurrentWindow().onResized(async () => {
    const fs = await getCurrentWindow().isFullscreen();
    if (!fs && isFullscreen.peek()) {
      // External exit detected -- clean up state
      if (timelineStore.isPlaying.peek()) {
        playbackEngine.stop();
      }
      isFullscreen.value = false;
    }
  });
}
