import {signal} from '@preact/signals';
import {playbackEngine} from './playbackEngine';
import {timelineStore} from '../stores/timelineStore';

export const isFullscreen = signal(false);

export function enterFullscreen(): void {
  isFullscreen.value = true;
}

export function exitFullscreen(): void {
  if (timelineStore.isPlaying.peek()) {
    playbackEngine.stop();
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

// App-level fullscreen — no system listener needed
export function initFullscreenListener(): void {}
