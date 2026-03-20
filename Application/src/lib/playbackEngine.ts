import {signal} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {uiStore} from '../stores/uiStore';
import {projectStore} from '../stores/projectStore';
import {totalFrames, frameMap, trackLayouts} from './frameMap';
import {shuttleDirection, shuttleSpeed, resetShuttle} from './jklShuttle';
import {isolationStore} from '../stores/isolationStore';

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

  setPlayerRef(el: HTMLElement | null) {
    this.playerRef = el;
  }

  start() {
    if (this.rafId !== null) return; // already running
    this.lastTime = performance.now();
    this.accumulator = 0;

    // When isolation active, ensure playhead starts on an isolated frame
    const isolatedIds = isolationStore.isolatedSequenceIds.peek();
    if (isolatedIds.size > 0) {
      const ranges = this.getIsolatedRanges(isolatedIds);
      if (ranges.length > 0) {
        const cf = timelineStore.currentFrame.peek();
        const inRange = ranges.some(r => cf >= r.start && cf < r.end);
        if (!inRange) {
          timelineStore.seek(ranges[0].start);
        }
      }
    }

    // Deselect sidebar sequence during playback to avoid expensive re-renders
    uiStore.selectSequence(null);
    timelineStore.setPlaying(true);
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    isFullSpeed.value = false;
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

  toggleFullSpeed() {
    if (timelineStore.isPlaying.peek()) {
      // Already playing: toggle full-speed on/off
      isFullSpeed.value = !isFullSpeed.value;
    } else {
      // Not playing: start in full-speed mode
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

  /** Compute sorted frame ranges for isolated sequences from trackLayouts */
  private getIsolatedRanges(isolatedIds: Set<string>): Array<{ start: number; end: number }> {
    const tracks = trackLayouts.peek();
    return tracks
      .filter(t => isolatedIds.has(t.sequenceId))
      .map(t => ({ start: t.startFrame, end: t.endFrame }))
      .sort((a, b) => a.start - b.start);
  }

  /** Find the next frame in isolated ranges given current frame, or -1 if past end */
  private nextIsolatedFrame(frame: number, ranges: Array<{ start: number; end: number }>): number {
    for (const r of ranges) {
      if (frame >= r.start && frame < r.end - 1) {
        return frame + 1;
      }
      if (frame === r.end - 1) {
        // At end of this range -- find next range
        const nextRange = ranges.find(nr => nr.start > frame);
        if (nextRange) return nextRange.start;
        return -1; // past all ranges
      }
    }
    // Frame is in a gap -- find next range start
    const nextRange = ranges.find(r => r.start > frame);
    if (nextRange) return nextRange.start;
    return -1;
  }

  /** Find the previous frame in isolated ranges given current frame, or -1 if before start */
  private prevIsolatedFrame(frame: number, ranges: Array<{ start: number; end: number }>): number {
    for (let i = ranges.length - 1; i >= 0; i--) {
      const r = ranges[i];
      if (frame > r.start && frame < r.end) {
        return frame - 1;
      }
      if (frame === r.start) {
        // At start of this range -- find previous range end
        const prevRange = i > 0 ? ranges[i - 1] : null;
        if (prevRange) return prevRange.end - 1;
        return -1; // before all ranges
      }
    }
    // Frame is in a gap -- find previous range end
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (ranges[i].end <= frame) return ranges[i].end - 1;
    }
    return -1;
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
    const isolatedIds = isolationStore.isolatedSequenceIds.peek();
    const hasIsolation = isolatedIds.size > 0;
    const isLooping = isolationStore.loopEnabled.peek();

    while (this.accumulator >= frameDuration) {
      this.accumulator -= frameDuration;
      const currentFrame = timelineStore.currentFrame.peek();

      if (hasIsolation) {
        const ranges = this.getIsolatedRanges(isolatedIds);
        if (ranges.length === 0) break; // No valid ranges, stop consuming accumulator

        if (direction > 0) {
          const next = this.nextIsolatedFrame(currentFrame, ranges);
          if (next === -1) {
            // Past all isolated ranges
            if (isLooping) {
              timelineStore.seek(ranges[0].start);
            } else {
              timelineStore.seek(ranges[0].start);
              timelineStore.syncDisplayFrame();
              this.stop();
              return; // Don't schedule next rAF
            }
          } else {
            timelineStore.seek(next);
          }
        } else {
          const prev = this.prevIsolatedFrame(currentFrame, ranges);
          if (prev === -1) {
            // Before all isolated ranges
            if (isLooping) {
              timelineStore.seek(ranges[ranges.length - 1].end - 1);
            } else {
              timelineStore.seek(ranges[0].start);
              timelineStore.syncDisplayFrame();
              this.stop();
              return; // Don't schedule next rAF
            }
          } else {
            timelineStore.seek(prev);
          }
        }
      } else {
        // Normal playback (no isolation)
        if (direction > 0) {
          if (currentFrame >= maxFrames - 1) {
            if (isLooping) {
              timelineStore.seek(0);
            } else {
              this.stop();
              return; // Don't schedule next rAF
            }
          } else {
            timelineStore.stepForward();
          }
        } else {
          if (currentFrame <= 0) {
            if (isLooping) {
              timelineStore.seek(maxFrames - 1);
            } else {
              this.stop();
              return; // Don't schedule next rAF
            }
          } else {
            timelineStore.stepBackward();
          }
        }
      }
    }

    // In full-speed mode: skip all expensive UI sync (auto-scroll, track visibility)
    // The canvas still renders via Preview's own rAF loop reading currentFrame
    if (!isFullSpeed.peek()) {
      timelineStore.ensureFrameVisiblePaged(timelineStore.currentFrame.peek());

      // Auto vertical scroll: keep active track visible during playback
      // NOTE: Only scroll -- do NOT update sidebar sequence selection during playback
      // (sidebar re-syncs when playback stops via syncActiveSequence)
      const cf = timelineStore.currentFrame.peek();
      const entry = frameMap.peek()[cf];
      if (entry) {
        timelineStore.ensureTrackVisible(entry.sequenceId);
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
