import {signal, computed} from '@preact/signals';

// --- Constants ---

/** Speed multipliers for each tier */
const SPEED_TIERS = [1, 2, 4, 8];

/** How long the speed badge stays visible (ms) */
const BADGE_DURATION = 1200;

// --- Signals ---

/** Current direction: 1 = forward, -1 = reverse. Default: forward. */
export const shuttleDirection = signal<1 | -1>(1);

/** Current speed tier index (0-3 mapping to SPEED_TIERS). Default: 0 (1x). */
export const shuttleSpeedTier = signal(0);

/** Computed speed multiplier (always positive; direction is separate). */
export const shuttleSpeed = computed(() => SPEED_TIERS[shuttleSpeedTier.value] ?? 1);

/** Display label for current speed, e.g. "2x", "-1x", "" at default (1x forward) */
export const currentSpeedLabel = signal('');

/** Whether the speed badge should be visible */
export const showSpeedBadge = signal(false);

// --- Internal state ---

let badgeTimeout: ReturnType<typeof setTimeout> | null = null;

// --- Exported functions ---

/**
 * Press L: set forward direction / increase forward speed.
 * If already forward: increment speed tier (cap at max).
 * If currently reverse: reset speed tier to 0, set direction to forward.
 * Does NOT start or stop playback.
 */
export function pressL(): void {
  if (shuttleDirection.value === 1) {
    // Already forward: accelerate
    const maxTier = SPEED_TIERS.length - 1;
    if (shuttleSpeedTier.value < maxTier) {
      shuttleSpeedTier.value += 1;
    }
  } else {
    // Currently reverse: switch to forward, reset speed
    shuttleSpeedTier.value = 0;
    shuttleDirection.value = 1;
  }
  updateLabel();
  flashBadge();
}

/**
 * Press J: set reverse direction / increase reverse speed.
 * If already reverse: increment speed tier (cap at max).
 * If currently forward: reset speed tier to 0, set direction to reverse.
 * Does NOT start or stop playback.
 */
export function pressJ(): void {
  if (shuttleDirection.value === -1) {
    // Already reverse: accelerate
    const maxTier = SPEED_TIERS.length - 1;
    if (shuttleSpeedTier.value < maxTier) {
      shuttleSpeedTier.value += 1;
    }
  } else {
    // Currently forward: switch to reverse, reset speed
    shuttleSpeedTier.value = 0;
    shuttleDirection.value = -1;
  }
  updateLabel();
  flashBadge();
}

/**
 * Press K: reset speed to 1x forward.
 * Resets speed tier to 0 and direction to forward (1).
 * Does NOT stop playback (Space owns play/stop).
 */
export function pressK(): void {
  shuttleSpeedTier.value = 0;
  shuttleDirection.value = 1;
  updateLabel();
  flashBadge();
}

/**
 * Reset shuttle state completely.
 * Used when playback stops (e.g. Space pressed to stop).
 */
export function resetShuttle(): void {
  shuttleSpeedTier.value = 0;
  shuttleDirection.value = 1;
  currentSpeedLabel.value = '';
  showSpeedBadge.value = false;
  if (badgeTimeout !== null) {
    clearTimeout(badgeTimeout);
    badgeTimeout = null;
  }
}

// --- Internal helpers ---

function updateLabel(): void {
  const dir = shuttleDirection.value;
  const tier = shuttleSpeedTier.value;
  const speed = SPEED_TIERS[tier] ?? 1;

  if (dir === 1 && tier === 0) {
    // Default state (1x forward): no label
    currentSpeedLabel.value = '';
  } else if (dir === 1) {
    // Forward, speed > 1x
    currentSpeedLabel.value = `${speed}x`;
  } else if (tier === 0) {
    // Reverse, 1x
    currentSpeedLabel.value = '-1x';
  } else {
    // Reverse, speed > 1x
    currentSpeedLabel.value = `-${speed}x`;
  }
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
