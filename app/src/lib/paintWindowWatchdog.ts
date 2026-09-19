// Compositor-death watchdog decision logic for the Physics Paint window.
// WKWebView pauses rAF for occluded/background windows even when
// visibilityState reports 'visible', so a stale rAF tick is EXPECTED while the
// window is out of focus — the watchdog must never reload there. It only
// reloads when the window is focused AND the user is actively interacting AND
// rAF has been stalled for 5s (the compositor is dead: the window is black).

export const PAINT_WINDOW_WATCHDOG_ACTIVITY_WINDOW_MS = 3000;
export const PAINT_WINDOW_WATCHDOG_RAF_STALL_MS = 5000;
export const PAINT_WINDOW_WATCHDOG_RELOAD_COOLDOWN_MS = 15000;

export interface PaintWindowWatchdogState {
  readonly now: number;
  readonly lastActivityAt: number;
  readonly lastRafTick: number;
  readonly lastReloadAt: number;
  readonly hasFocus: boolean;
}

export function shouldReloadPaintWindow(state: PaintWindowWatchdogState): boolean {
  return state.hasFocus
    && state.now - state.lastActivityAt < PAINT_WINDOW_WATCHDOG_ACTIVITY_WINDOW_MS
    && state.now - state.lastRafTick > PAINT_WINDOW_WATCHDOG_RAF_STALL_MS
    && state.now - state.lastReloadAt > PAINT_WINDOW_WATCHDOG_RELOAD_COOLDOWN_MS;
}
