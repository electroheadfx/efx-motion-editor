import {signal} from '@preact/signals';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {playbackEngine, isFullSpeed} from './playbackEngine';
import {timelineStore} from '../stores/timelineStore';

export const isFullscreen = signal(false);

export async function enterFullscreen(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen();
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
  if (document.fullscreenElement) {
    await document.exitFullscreen();
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

// Listen for external fullscreen exit (e.g., browser ESC handling).
// Must be called once at app startup.
export function initFullscreenListener(): void {
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isFullscreen.peek()) {
      // External exit detected -- clean up state
      if (timelineStore.isPlaying.peek()) {
        playbackEngine.stop();
      }
      getCurrentWindow().setFullscreen(false).catch(() => {});
      isFullscreen.value = false;
    }
  });
}
