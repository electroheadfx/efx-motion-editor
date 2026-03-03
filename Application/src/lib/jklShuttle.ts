import {signal} from '@preact/signals';
import {playbackEngine} from './playbackEngine';
import {timelineStore} from '../stores/timelineStore';
import {projectStore} from '../stores/projectStore';
import {totalFrames} from './frameMap';

// --- Constants ---

/** Speed multipliers for each tier — tuned for stop-motion frame rates (15/24fps) */
const SPEED_TIERS = [1, 2, 4, 8];

/** How long the speed badge stays visible (ms) */
const BADGE_DURATION = 1200;

// --- Signals ---

/** Current speed tier: 0 = stopped, positive = forward, negative = reverse */
const currentTier = signal(0);

/** Display label for current speed, e.g. "2x", "-4x", "" when at 1x or stopped */
export const currentSpeedLabel = signal('');

/** Whether the speed badge should be visible */
export const showSpeedBadge = signal(false);

// --- Internal state ---

let rafId: number | null = null;
let badgeTimeout: ReturnType<typeof setTimeout> | null = null;
let lastTime: number = 0;
let accumulator: number = 0;

// --- Exported functions ---

/**
 * Press L: shuttle forward.
 * If currently in reverse, decelerate toward zero first (DaVinci Resolve model).
 * If already forward, accelerate to next speed tier.
 */
export function pressL(): void {
  if (currentTier.value < 0) {
    // Decelerating from reverse
    currentTier.value += 1;
  } else if (currentTier.value < SPEED_TIERS.length) {
    // Accelerating forward
    currentTier.value += 1;
  }
  updatePlayback();
}

/**
 * Press J: shuttle reverse.
 * If currently forward, decelerate toward zero first (DaVinci Resolve model).
 * If already in reverse, accelerate to next reverse speed tier.
 */
export function pressJ(): void {
  if (currentTier.value > 0) {
    // Decelerating from forward
    currentTier.value -= 1;
  } else if (currentTier.value > -SPEED_TIERS.length) {
    // Accelerating reverse
    currentTier.value -= 1;
  }
  updatePlayback();
}

/**
 * Press K: full stop.
 * Stops shuttle rAF loop, stops playback engine, resets speed tier to zero.
 */
export function pressK(): void {
  currentTier.value = 0;
  stopShuttleLoop();
  playbackEngine.stop();
  currentSpeedLabel.value = '';
  flashBadge();
}

/**
 * Reset shuttle state without stopping playbackEngine.
 * Used when playback stops naturally (e.g. reaching end of timeline).
 */
export function resetShuttle(): void {
  currentTier.value = 0;
  stopShuttleLoop();
  currentSpeedLabel.value = '';
  showSpeedBadge.value = false;
  if (badgeTimeout !== null) {
    clearTimeout(badgeTimeout);
    badgeTimeout = null;
  }
  lastTime = 0;
  accumulator = 0;
}

// --- Internal helpers ---

function stopShuttleLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function getSpeedMultiplier(): number {
  const tier = currentTier.value;
  if (tier === 0) return 0;
  const absIndex = Math.min(Math.abs(tier) - 1, SPEED_TIERS.length - 1);
  const speed = SPEED_TIERS[absIndex];
  return tier > 0 ? speed : -speed;
}

function updatePlayback(): void {
  const tier = currentTier.value;
  const speed = getSpeedMultiplier();

  // Update speed label: show multiplier for speeds > 1x (or < -1x)
  if (tier === 0) {
    currentSpeedLabel.value = '';
  } else {
    const absSpeed = Math.abs(speed);
    if (absSpeed === 1) {
      currentSpeedLabel.value = tier > 0 ? '1x' : '-1x';
    } else {
      currentSpeedLabel.value = tier > 0 ? `${absSpeed}x` : `-${absSpeed}x`;
    }
  }

  // Flash the speed badge
  flashBadge();

  // Reset accumulator when speed changes (Pitfall 7: prevents frame burst)
  accumulator = 0;

  // Stop existing shuttle rAF loop
  stopShuttleLoop();

  if (speed === 0) {
    // Tier is zero — stop playback
    playbackEngine.stop();
    return;
  }

  // Stop playbackEngine's normal playback if running (shuttle takes over)
  if (timelineStore.isPlaying.peek()) {
    playbackEngine.stop();
  }

  // Start the shuttle's own rAF loop
  lastTime = performance.now();
  rafId = requestAnimationFrame(shuttleTick);
}

function flashBadge(): void {
  showSpeedBadge.value = true;
  if (badgeTimeout !== null) {
    clearTimeout(badgeTimeout);
  }
  badgeTimeout = setTimeout(() => {
    showSpeedBadge.value = false;
    badgeTimeout = null;
  }, BADGE_DURATION);
}

function shuttleTick(now: number): void {
  const speed = getSpeedMultiplier();
  if (speed === 0) {
    stopShuttleLoop();
    return;
  }

  const delta = now - lastTime;
  lastTime = now;

  const fps = projectStore.fps.peek();
  const absSpeed = Math.abs(speed);
  const frameDuration = 1000 / (fps * absSpeed);

  accumulator += delta;

  const maxFrames = totalFrames.peek();
  const direction = speed > 0 ? 1 : -1;

  while (accumulator >= frameDuration) {
    accumulator -= frameDuration;

    const frame = timelineStore.currentFrame.peek();
    const nextFrame = frame + direction;

    // Clamp to bounds
    if (nextFrame < 0 || nextFrame >= maxFrames) {
      // Hit boundary — stop shuttle
      timelineStore.seek(Math.max(0, Math.min(maxFrames - 1, nextFrame)));
      pressK();
      return;
    }

    timelineStore.seek(nextFrame);
  }

  // Continue loop
  rafId = requestAnimationFrame(shuttleTick);
}
