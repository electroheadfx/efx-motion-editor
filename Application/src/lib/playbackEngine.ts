import {signal} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {uiStore} from '../stores/uiStore';
import {projectStore} from '../stores/projectStore';
import {totalFrames, frameMap} from './frameMap';
import {shuttleDirection, shuttleSpeed, resetShuttle} from './jklShuttle';

export const isFullSpeed = signal(false);

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
  /** Internal frame counter used during full-speed mode to avoid updating timeline signals */
  private fullSpeedFrame: number = 0;

  setPlayerRef(el: HTMLElement | null) {
    this.playerRef = el;
  }

  start() {
    if (this.rafId !== null) return; // already running
    this.lastTime = performance.now();
    this.accumulator = 0;
    // Deselect sidebar sequence during playback to avoid expensive re-renders
    uiStore.selectSequence(null);
    timelineStore.setPlaying(true);
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    const wasFullSpeed = isFullSpeed.peek();
    isFullSpeed.value = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Re-sync timeline to where full-speed playback reached
    if (wasFullSpeed) {
      timelineStore.seek(this.fullSpeedFrame);
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

  toggleFullSpeed() {
    if (timelineStore.isPlaying.peek()) {
      if (isFullSpeed.peek()) {
        // Turning OFF: sync timeline to where full-speed reached
        timelineStore.seek(this.fullSpeedFrame);
        timelineStore.syncDisplayFrame();
        isFullSpeed.value = false;
      } else {
        // Turning ON: capture current frame as starting point
        this.fullSpeedFrame = timelineStore.currentFrame.peek();
        isFullSpeed.value = true;
      }
    } else {
      // Not playing: start in full-speed mode
      this.fullSpeedFrame = timelineStore.currentFrame.peek();
      isFullSpeed.value = true;
      this.start();
    }
  }

  seekToFrame(frame: number) {
    timelineStore.seek(frame);
    timelineStore.syncDisplayFrame();
    timelineStore.ensureFrameVisible(timelineStore.currentFrame.peek());
    this.syncActiveSequence();
    this.syncPlayer();
  }

  stepForward() {
    timelineStore.stepForward();
    timelineStore.syncDisplayFrame();
    timelineStore.ensureFrameVisible(timelineStore.currentFrame.peek());
    this.syncActiveSequence();
    this.syncPlayer();
  }

  stepBackward() {
    timelineStore.stepBackward();
    timelineStore.syncDisplayFrame();
    timelineStore.ensureFrameVisible(timelineStore.currentFrame.peek());
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
        timelineStore.ensureTrackVisible(entry.sequenceId);
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
    const fullSpeed = isFullSpeed.peek();

    while (this.accumulator >= frameDuration) {
      this.accumulator -= frameDuration;

      if (fullSpeed) {
        // Full-speed: advance internal counter only (no timeline signal updates)
        if (direction > 0) {
          this.fullSpeedFrame = this.fullSpeedFrame >= maxFrames - 1 ? 0 : this.fullSpeedFrame + 1;
        } else {
          this.fullSpeedFrame = this.fullSpeedFrame <= 0 ? maxFrames - 1 : this.fullSpeedFrame - 1;
        }
      } else {
        // Normal: advance via timelineStore (triggers UI updates)
        const currentFrame = timelineStore.currentFrame.peek();
        if (direction > 0) {
          if (currentFrame >= maxFrames - 1) {
            timelineStore.seek(0);
          } else {
            timelineStore.stepForward();
          }
        } else {
          if (currentFrame <= 0) {
            timelineStore.seek(maxFrames - 1);
          } else {
            timelineStore.stepBackward();
          }
        }
      }
    }

    if (fullSpeed) {
      // Render canvas directly from internal counter
      const player = this.getInternalPlayer();
      if (player) player.requestSeek(this.fullSpeedFrame);
    } else {
      // Normal UI sync
      timelineStore.ensureFrameVisiblePaged(timelineStore.currentFrame.peek());
      const cf = timelineStore.currentFrame.peek();
      const entry = frameMap.peek()[cf];
      if (entry) {
        timelineStore.ensureTrackVisible(entry.sequenceId);
      }
      this.syncPlayer();
    }

    if (timelineStore.isPlaying.peek()) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private getInternalPlayer(): any {
    return (this.playerRef as any)?.player ?? null;
  }
}

export const playbackEngine = new PlaybackEngine();
