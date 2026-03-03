import {timelineStore} from '../stores/timelineStore';
import {projectStore} from '../stores/projectStore';
import {totalFrames} from './frameMap';

/**
 * PlaybackEngine: rAF-based frame-rate-limited playback tick loop.
 *
 * Uses performance.now() delta accumulation for accurate frame timing.
 * This pattern prevents drift at both 15fps and 24fps and is essential
 * for PREV-05 audio sync readiness.
 *
 * CRITICAL: Uses .peek() (not .value) inside the rAF tick to avoid
 * Preact signal subscription tracking outside of effects.
 */
export class PlaybackEngine {
  private rafId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private playerRef: HTMLElement | null = null;

  setPlayerRef(el: HTMLElement | null) {
    this.playerRef = el;
  }

  start() {
    if (this.rafId !== null) return; // already running
    this.lastTime = performance.now();
    this.accumulator = 0;
    timelineStore.setPlaying(true);
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    timelineStore.setPlaying(false);
  }

  toggle() {
    if (timelineStore.isPlaying.peek()) {
      this.stop();
    } else {
      this.start();
    }
  }

  seekToFrame(frame: number) {
    timelineStore.seek(frame);
    this.syncPlayer();
  }

  stepForward() {
    timelineStore.stepForward();
    this.syncPlayer();
  }

  stepBackward() {
    timelineStore.stepBackward();
    this.syncPlayer();
  }

  private syncPlayer() {
    const player = this.getInternalPlayer();
    if (player) {
      player.requestSeek(timelineStore.currentFrame.peek());
    }
  }

  private tick = (now: number) => {
    const fps = projectStore.fps.peek();
    const frameDuration = 1000 / fps;
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.accumulator += delta;

    const maxFrames = totalFrames.peek();

    while (this.accumulator >= frameDuration) {
      this.accumulator -= frameDuration;
      const currentFrame = timelineStore.currentFrame.peek();
      if (currentFrame >= maxFrames - 1) {
        this.stop();
        return;
      }
      timelineStore.stepForward();
    }

    this.syncPlayer();

    if (timelineStore.isPlaying.peek()) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private getInternalPlayer(): any {
    return (this.playerRef as any)?.player ?? null;
  }
}

export const playbackEngine = new PlaybackEngine();
