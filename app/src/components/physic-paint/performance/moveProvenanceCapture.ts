// ============================================================
//  quick-261026-odd Move provenance capture — DEV ONLY.
//
//  Answers "where do these Move handles come from?" without a
//  console copy: the app writes one JSON report to
//  /tmp/efx-move-provenance.json (the established app-writes-/tmp
//  convention). After engine-1 removal the report names the ONE
//  surviving layer — the aquarelle record registry — plus the
//  frame's cell kind, owner and snapshot identity. The Brush store
//  and the engine-1 stroke ledger are gone with the package.
//
//  Triggers: Move entry (the Studio calls captureMoveProvenanceNow)
//  and the manual global window.__EFX_MOVE_PROVENANCE__(). Installs
//  nothing in a production build.
// ============================================================

import { isAquarelleDryEvent } from '@efxlab/efx-watercolor/payload';
import {
  getAquarelleEventsForFrame,
  hasAquarelleScriptForFrame,
} from '../view/aquarelleRecordState';

export const MOVE_PROVENANCE_PATH = '/tmp/efx-move-provenance.json';
/** Bumped by every diagnostic revision so the report names its build. */
export const MOVE_PROVENANCE_BUILD = 'quick-261027-klx-diag-11-watercolor-only';

export interface MoveProvenanceIdentity {
  projectId: string | null;
  layerId: string | null;
  activeTrackId: string | null;
  snapshotTrackId: string | null;
}

export interface MoveProvenanceDeps {
  getIdentity(): MoveProvenanceIdentity;
  getFrame(): number;
  getCellKind(): string;
  getModule(): string;
  getTool(): string;
  getMoveAvailable(): boolean;
  getOwner(): string | null;
  /** The live key occupying the current frame (identity truth). */
  getCellKeyId?(): string | null;
  getLiveKeyIdForFrame?(frame: number): string | null;
  /** True on a Play Script / Reveal rail frame (pixels only by law). */
  isPixelOnlyFrame?(frame: number): boolean;
  /** Which script-edition surface is armed and why. */
  getOverlayArmed?(): { selectMode: boolean; heldArm: boolean };
  /** The one-time rail cleanup's state at this moment. */
  getRailCleanupState?(): {
    done: boolean;
    railFrameCount: number | null;
  };
}

let installedDeps: MoveProvenanceDeps | null = null;
let writeInFlight = false;

function readOr<T>(read: () => T, fallback: T, errors: string[], label: string): T {
  try {
    return read();
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

export async function captureMoveProvenance(
  reason: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const deps = installedDeps;
  if (!deps) return;
  if (writeInFlight) return;
  writeInFlight = true;
  try {
    const errors: string[] = [];
    const frame = readOr(() => deps.getFrame(), 0, errors, 'frame');
    const identity = readOr(
      () => deps.getIdentity(),
      { projectId: null, layerId: null, activeTrackId: null, snapshotTrackId: null },
      errors,
      'identity',
    );
    const events = readOr(() => getAquarelleEventsForFrame(frame), [], errors, 'aquarelle.events');
    const report = {
      build: MOVE_PROVENANCE_BUILD,
      reason,
      capturedAt: new Date().toISOString(),
      frame,
      identity,
      cellKind: readOr(() => deps.getCellKind(), 'unknown', errors, 'cellKind'),
      module: readOr(() => deps.getModule(), 'unknown', errors, 'module'),
      owner: readOr(() => deps.getOwner(), null, errors, 'owner'),
      tool: readOr(() => deps.getTool(), 'unknown', errors, 'tool'),
      moveAvailable: readOr(() => deps.getMoveAvailable(), false, errors, 'moveAvailable'),
      cellKeyId: deps.getCellKeyId ? readOr(() => deps.getCellKeyId!(), null, errors, 'cellKeyId') : null,
      cellInsideRail: deps.isPixelOnlyFrame ? readOr(() => deps.isPixelOnlyFrame!(frame), false, errors, 'cellInsideRail') : null,
      overlayArmed: deps.getOverlayArmed
        ? readOr(() => deps.getOverlayArmed!(), { selectMode: false, heldArm: false }, errors, 'overlayArmed')
        : null,
      railCleanup: deps.getRailCleanupState
        ? readOr(() => deps.getRailCleanupState!(), null, errors, 'railCleanup')
        : null,
      aquarelle: {
        hasScript: readOr(() => hasAquarelleScriptForFrame(frame), false, errors, 'aquarelle.hasScript'),
        events: events.map((event) => {
          if (isAquarelleDryEvent(event)) return { dry: true };
          const payload = event.engine;
          const pts = Array.isArray(event.pts) ? event.pts : [];
          // Document UV bounds: a stroke wholly outside 0..1 cannot paint on
          // the sheet — the "handle but no render" signature.
          let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
          for (const point of pts) {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            bounds = bounds === null
              ? { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
              : {
                  minX: Math.min(bounds.minX, point.x),
                  minY: Math.min(bounds.minY, point.y),
                  maxX: Math.max(bounds.maxX, point.x),
                  maxY: Math.max(bounds.maxY, point.y),
                };
          }
          return {
            dry: false,
            mutationId: payload.mutationId ?? null,
            color: payload.color ?? null,
            points: Array.isArray(event.pts) ? event.pts.length : null,
            paramsSize: payload.params?.['size'] ?? null,
            load: payload.params?.['load'] ?? null,
            water: payload.params?.['water'] ?? null,
            brushId: payload.brushId ?? null,
            boundsUv: bounds,
            playFrame: event.playFrame ?? null,
          };
        }),
      },
      errors,
      ...(extra ?? {}),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
    const { exportWritePng } = await import('../../../lib/ipc');
    const result = await exportWritePng('/tmp', 'efx-move-provenance.json', Array.from(bytes));
    if (!result.ok) console.warn('[move-provenance] write failed', result.error);
  } catch (error) {
    console.warn('[move-provenance] capture failed', error);
  } finally {
    writeInFlight = false;
  }
}

/** Fire-and-forget from event seams — a no-op until the probe is installed. */
export function captureMoveProvenanceNow(reason: string, extra?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  void captureMoveProvenance(reason, extra);
}

/**
 * Proof-of-load beacon: the Studio writes this at probe install time so a
 * stale window can be distinguished from a bug without any user interaction.
 */
async function writeBuildBeacon(): Promise<void> {
  try {
    const beacon = {
      build: MOVE_PROVENANCE_BUILD,
      installedAt: new Date().toISOString(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(beacon, null, 2));
    const { exportWritePng } = await import('../../../lib/ipc');
    await exportWritePng('/tmp', 'efx-build-check.json', Array.from(bytes));
  } catch (error) {
    console.warn('[move-provenance] beacon write failed', error);
  }
}

export function installMoveProvenanceProbe(deps: MoveProvenanceDeps): void {
  if (!import.meta.env.DEV) return;
  installedDeps = deps;
  void writeBuildBeacon();
  (window as unknown as { __EFX_MOVE_PROVENANCE__?: () => void }).__EFX_MOVE_PROVENANCE__ = () => {
    void captureMoveProvenance('manual');
  };
}
