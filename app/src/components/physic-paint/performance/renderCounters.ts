/**
 * 52.2 D-18 (render-churn inventory): the three worst render surfaces — tracks
 * strip, right panel, canvas area — counted ON the existing profile channel
 * rather than beside it.
 *
 * One gate (`efx.physicsPaint.profile`), one registry, one snapshot surface:
 * `countRender` delegates to `recordPhysicsPaintPerformanceCounter`, so the
 * counts appear under their `render.*` names in
 * `window.__EFX_PHYSICS_PAINT_PROFILE__.snapshot().counters` — the same surface
 * the native capture reads (plan 52.2-16's after capture diffs the same pair).
 *
 * Discipline (efx-preact-reactivity): the call sits unconditionally at the top
 * of a component body and is a no-op — no allocation, no signal write, no
 * subscription — while the gate is off. An always-on counter would itself be
 * render churn and would invalidate the measurement it exists to make, which
 * is why the gating lives in the trace's single `profilingEnabled()` read
 * instead of a second gate with its own storage access.
 */
import {
  clearPhysicsPaintPerformance,
  recordPhysicsPaintPerformanceCounter,
  snapshotPhysicsPaintPerformance,
  type PhysicsPaintPerformanceCounterName,
} from './physicsPaintPerformanceTrace';

export type PhysicsPaintRenderSurface = 'tracksStrip' | 'rightPanel' | 'canvas';

/** Surface → its counter name in `PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES`. */
export const PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES = Object.freeze({
  tracksStrip: 'render.tracksStrip',
  rightPanel: 'render.rightPanel',
  canvas: 'render.canvas',
} as const satisfies Readonly<Record<PhysicsPaintRenderSurface, PhysicsPaintPerformanceCounterName>>);

export type PhysicsPaintRenderCounterName =
  typeof PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES[PhysicsPaintRenderSurface];

export type PhysicsPaintRenderCountSnapshot = Readonly<Record<PhysicsPaintRenderCounterName, number>>;

const RENDER_COUNTER_NAMES = Object.freeze([
  PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES.tracksStrip,
  PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES.rightPanel,
  PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES.canvas,
] as const);

/**
 * Count one render of `surface`. A no-op with no allocation and no signal write
 * while profiling is disabled — call it unconditionally in the component body;
 * never wrap it in a conditional subscription, which would change the
 * component's reactive reads and therefore the render behavior being measured.
 */
export function countRender(surface: PhysicsPaintRenderSurface): void {
  recordPhysicsPaintPerformanceCounter(PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES[surface]);
}

/** The `render.*` subset of the shared profile snapshot — stable, diffable JSON. */
export function snapshotRenderCounts(): PhysicsPaintRenderCountSnapshot {
  const { counters } = snapshotPhysicsPaintPerformance();
  return Object.freeze(Object.fromEntries(
    RENDER_COUNTER_NAMES.map((name) => [name, counters[name]]),
  ) as Record<PhysicsPaintRenderCounterName, number>);
}

/**
 * Reset so a before/after capture pair is comparable. Delegates to the
 * profile-wide clear the native capture already uses (`clear()` on the global),
 * so the render pair is measured over a clean window rather than over whatever
 * the previous capture left behind — one reset surface, not two.
 */
export function resetRenderCounts(): void {
  clearPhysicsPaintPerformance();
}
