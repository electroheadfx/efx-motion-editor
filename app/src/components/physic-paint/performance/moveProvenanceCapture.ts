// ============================================================
//  quick-261026-odd Move provenance capture — DEV ONLY.
//
//  Answers "where do these Move handles come from?" without a
//  console copy: the app writes one JSON report to
//  /tmp/efx-move-provenance.json (the established app-writes-/tmp
//  convention). Every listed group is named in all three layers:
//  the live engine ledger, the session Brush store and the
//  aquarelle registry, plus the frame's cell kind, owner and
//  snapshot identity.
//
//  Triggers: Move entry (the Studio calls captureMoveProvenanceNow)
//  and the manual global window.__EFX_MOVE_PROVENANCE__(). Installs
//  nothing in a production build.
// ============================================================

import type { PaintStroke } from '@efxlab/efx-physic-paint';
import { isAquarelleDryEvent } from '@efxlab/efx-watercolor/payload';
import {
  getBrushScriptFrameEntries,
  getBrushScriptFrameEntry,
  isAquarelleGuideGroup,
  purgedBrushScriptFrame,
} from '../view/brushScriptRecordState';
import {
  getAquarelleEventsForFrame,
  getRecordedAquarelleStroke,
  hasAquarelleScriptForFrame,
} from '../view/aquarelleRecordState';
import { engineHoldsBrushScriptFrame } from '../view/brushScriptHydration';

export const MOVE_PROVENANCE_PATH = '/tmp/efx-move-provenance.json';
/** Bumped by every diagnostic revision so the report names its build. */
export const MOVE_PROVENANCE_BUILD = 'quick-261026-odd-diag-1';

export interface MoveProvenanceEngine {
  getStrokes(): readonly PaintStroke[];
  getStrokeSerials(): Map<number, number>;
  getStrokeCount?(): number;
}

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
  getEngine(): MoveProvenanceEngine | null;
  /** The live key occupying the current frame (identity truth). */
  getCellKeyId?(): string | null;
  getLiveKeyIdForFrame?(frame: number): string | null;
  /** True on a Play Script / Reveal rail frame (pixels only by law). */
  isPixelOnlyFrame?(frame: number): boolean;
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

function engineStrokeReport(
  stroke: Readonly<PaintStroke>,
  serials: ReadonlyMap<number, number>,
): Record<string, unknown> {
  return {
    mutationId: stroke.mutationId ?? null,
    guideProxy: stroke.guideProxy === true,
    tool: stroke.tool,
    color: stroke.color ?? null,
    points: stroke.points.length,
    paramsSize: stroke.params?.size ?? null,
    hasPenInput: stroke.hasPenInput === true,
    playFrame: stroke.playFrame ?? null,
    serial: stroke.mutationId === undefined ? null : serials.get(stroke.mutationId) ?? null,
  };
}

export async function captureMoveProvenance(reason: string): Promise<void> {
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
    const engine = readOr(() => deps.getEngine(), null, errors, 'engine');
    let strokes: readonly PaintStroke[] = [];
    let serials: Map<number, number> = new Map();
    if (engine) {
      strokes = readOr(() => engine.getStrokes(), [], errors, 'engine.strokes');
      serials = readOr(() => engine.getStrokeSerials(), new Map(), errors, 'engine.serials');
    }
    const entry = getBrushScriptFrameEntry(frame);
    const groups = entry?.groups ?? [];
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
      store: {
        hasEntry: entry !== undefined,
        keyId: entry?.keyId ?? null,
        complete: entry?.complete ?? null,
        strokes: entry?.strokes ?? 0,
        points: entry?.points ?? 0,
        purged: purgedBrushScriptFrame(frame),
        engineHoldsFrame: engine ? engineHoldsBrushScriptFrame(engine, frame) : false,
        groups: groups.map((group) => {
          const primary = group.primary;
          const mutationId = primary.mutationId;
          const registered =
            typeof mutationId === 'number' ? getRecordedAquarelleStroke(mutationId) : undefined;
          return {
            mutationId: mutationId ?? null,
            guideProxy: primary.guideProxy === true,
            classifiedGuide: isAquarelleGuideGroup(group),
            registryMatch: registered
              ? {
                  color: registered.color ?? null,
                  points: registered.points.length,
                  playFrame: registered.playFrame ?? null,
                  paramsSize: registered.params['size'] ?? null,
                }
              : null,
            points: primary.points.length,
            color: primary.color ?? null,
            paramsSize: primary.params?.size ?? null,
            inEngine:
              typeof mutationId === 'number' ? serials.has(mutationId) : false,
            serial:
              typeof mutationId === 'number' ? serials.get(mutationId) ?? null : null,
          };
        }),
      },
      engine: {
        strokeCount: engine
          ? readOr(() => engine.getStrokeCount?.() ?? strokes.length, strokes.length, errors, 'engine.count')
          : 0,
        serialCount: serials.size,
        strokes: strokes.map((stroke) => engineStrokeReport(stroke, serials)),
      },
      aquarelle: {
        hasScript: readOr(() => hasAquarelleScriptForFrame(frame), false, errors, 'aquarelle.hasScript'),
        events: events.map((event) => {
          if (isAquarelleDryEvent(event)) return { dry: true };
          const payload = event.engine;
          return {
            dry: false,
            mutationId: payload.mutationId ?? null,
            color: payload.color ?? null,
            points: Array.isArray(event.pts) ? event.pts.length : null,
            paramsSize: payload.params?.['size'] ?? null,
            playFrame: event.playFrame ?? null,
          };
        }),
      },
      storeFrames: getBrushScriptFrameEntries().map((frameEntry) => {
        let guides = 0;
        for (const group of frameEntry.groups) {
          if (isAquarelleGuideGroup(group)) guides += 1;
        }
        return {
          frame: frameEntry.frame,
          keyId: frameEntry.keyId ?? null,
          liveKeyId: deps.getLiveKeyIdForFrame
            ? readOr(() => deps.getLiveKeyIdForFrame!(frameEntry.frame), null, errors, 'liveKeyId')
            : null,
          pixelOnly: deps.isPixelOnlyFrame
            ? readOr(() => deps.isPixelOnlyFrame!(frameEntry.frame), false, errors, 'pixelOnly')
            : null,
          strokes: frameEntry.strokes,
          guideGroups: guides,
          realGroups: frameEntry.strokes - guides,
          complete: frameEntry.complete,
        };
      }),
      errors,
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
export function captureMoveProvenanceNow(reason: string): void {
  if (!import.meta.env.DEV) return;
  void captureMoveProvenance(reason);
}

export function installMoveProvenanceProbe(deps: MoveProvenanceDeps): void {
  if (!import.meta.env.DEV) return;
  installedDeps = deps;
  (window as unknown as { __EFX_MOVE_PROVENANCE__?: () => void }).__EFX_MOVE_PROVENANCE__ = () => {
    void captureMoveProvenance('manual');
  };
}
