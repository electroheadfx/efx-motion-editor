// ============================================================
//  261002 look-delta capture — MEASURE-ONLY, throwaway.
//
//  App half of the Studio-paint-canvas look-delta probe: it only
//  attaches the engine's read-only reporter and drops the report
//  at /tmp/efx-look-delta.json (the established app-writes-/tmp
//  convention — never console-copy).
//
//  The measurement protocol (5 moments, one pinned pixel) and the
//  signature law that names the writer live in
//  packages/efx-physic-paint/src/engine/lookDeltaProbe.ts.
// ============================================================

import type { EfxPaintEngine, LookDeltaReport } from '@efxlab/efx-physic-paint';

export const LOOK_DELTA_PATH = '/tmp/efx-look-delta.json';

async function writeLookDeltaReport(report: LookDeltaReport): Promise<void> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
    const { exportWritePng } = await import('../../../lib/ipc');
    // export_write_png writes arbitrary bytes to dir/filename (atomic
    // tmp+rename) — same path the bake-parity capture uses. The filename
    // must stay exact: the plan reads /tmp/efx-look-delta.json verbatim.
    const result = await exportWritePng('/tmp', 'efx-look-delta.json', Array.from(bytes));
    if (!result.ok) console.warn('[look-delta] write failed', result.error);
  } catch (error) {
    console.warn('[look-delta] write failed', error);
  }
}

/**
 * Attach the read-only probe to a freshly-ready engine. Each recorded moment
 * rewrites the whole report, so the file on disk is always the latest state
 * even if the session is cut short mid-measure.
 */
export function installLookDeltaCapture(engine: EfxPaintEngine): void {
  engine.setLookDeltaReporter((report) => { void writeLookDeltaReport(report); });
}
