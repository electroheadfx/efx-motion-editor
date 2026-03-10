import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {uiStore} from '../stores/uiStore';
import {projectStore} from '../stores/projectStore';
import {totalFrames, frameMap} from './frameMap';
import {shuttleDirection, shuttleSpeed, resetShuttle} from './jklShuttle';

/**
 * PlaybackEngine: rAF-based frame-rate-limited playback tick loop.
 *
 * Uses performance.now() delta accumulation for accurate frame timing.
 * Reads shuttle speed/direction signals in the tick loop for variable-rate
 * playback. Auto-loops at frame boundaries (forward wraps to start,
 * reverse wraps to end).
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
    timelineStore.syncDisplayFrame();
    this.syncActiveSequence();
    resetShuttle();
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
    timelineStore.syncDisplayFrame();
    this.syncActiveSequence();
    this.syncPlayer();
  }

  stepForward() {
    timelineStore.stepForward();
    timelineStore.syncDisplayFrame();
    this.syncActiveSequence();
    this.syncPlayer();
  }

  stepBackward() {
    timelineStore.stepBackward();
    timelineStore.syncDisplayFrame();
    this.syncActiveSequence();
    this.syncPlayer();
  }

  /** Switch active sequence when playhead crosses into a different sequence */
  private syncActiveSequence() {
    const cf = timelineStore.currentFrame.peek();
    const entry = frameMap.peek()[cf];
    if (entry) {
      const activeId = sequenceStore.activeSequenceId.peek();
      if (entry.sequenceId !== activeId) {
        sequenceStore.setActive(entry.sequenceId);
        uiStore.selectSequence(entry.sequenceId);
      }
    }
  }

  private syncPlayer() {
    const player = this.getInternalPlayer();
    if (player) {
      player.requestSeek(timelineStore.currentFrame.peek());
    }
  }

  private tick = (now: number) => {
    const fps = projectStore.fps.peek();
    const speed = shuttleSpeed.peek();
    const direction = shuttleDirection.peek();
    const frameDuration = 1000 / (fps * speed);
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.accumulator += delta;

    const maxFrames = totalFrames.peek();

    while (this.accumulator >= frameDuration) {
      this.accumulator -= frameDuration;
      const currentFrame = timelineStore.currentFrame.peek();

      if (direction > 0) {
        // Forward playback
        if (currentFrame >= maxFrames - 1) {
          timelineStore.seek(0); // auto-loop to start
        } else {
          timelineStore.stepForward();
        }
      } else {
        // Reverse playback
        if (currentFrame <= 0) {
          timelineStore.seek(maxFrames - 1); // auto-loop to end
        } else {
          timelineStore.stepBackward();
        }
      }
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
