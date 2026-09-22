import type {
  PhysicPaintLaunchContext,
  PhysicPaintRenderedFrame,
  PhysicPaintRotoCacheFrame,
  PhysicPaintRotoInterpolationSettings,
} from '../../../types/physicPaint';
import {
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';
import { projectPhysicPaintRotoPhysicalTimeline } from './physicsPaintRotoPhysicalResolver';
import { prepareRotoPhysicalRealKeyFrames } from './rotoCanvasFrames';
// quick-260921-qls: the DEV-only refusal capture that records which link of the
// launch→gesture chain refused. Same import direction as rotoCanvasFrames.ts:10
// (`roto/` → `../performance/`), so it introduces no cycle.
import { reportGestureRefusal } from '../performance/physicPaintGestureRefusalCapture';

export interface RotoPhysicalLaunchHydrationStore {
  replaceRotoPhysicalDocument(
    layerId: string,
    trackId: string,
    value: unknown,
  ): { ok: true; document: PhysicPaintRotoPhysicalDocument } | { ok: false; error: string };
}

export type RotoPhysicalLaunchHydrationResult =
  | {
      readonly ok: true;
      readonly context: PhysicPaintLaunchContext;
      readonly document: PhysicPaintRotoPhysicalDocument;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Read the physical Roto model from the carried v1.0 document's ACTIVE track
 * (D-03: the launch IS the document). The document parser already validated
 * the track's rotoPhysical through parsePhysicPaintRotoPhysicalDocument, so
 * the returned model is canonical; null only when the active track carries no
 * physical state (a fresh AddFxMenu document before the parent injects one).
 */
export function getCarriedRotoPhysical(
  context: PhysicPaintLaunchContext | null,
): PhysicPaintRotoPhysicalDocument | null {
  const document = context?.document;
  if (!document) return null;
  const activeTrack = document.tracks.find((track) => track.id === document.activeTrackId);
  return activeTrack?.rotoPhysical ?? null;
}

/**
 * Validate one complete canonical launch without mutating the store or current
 * launch. The physical model is parsed from the carried document's ACTIVE
 * track and the persisted revision is rechecked before publication.
 */
export function prepareRotoPhysicalLaunch(
  context: PhysicPaintLaunchContext,
): RotoPhysicalLaunchHydrationResult {
  const physical = getCarriedRotoPhysical(context);
  if (!physical) return { ok: false, error: 'Launch is missing the complete physical Roto document.' };
  try {
    const document = parsePhysicPaintRotoPhysicalDocument(physical);
    if (context.startFrame !== document.cursorAppFrame) {
      return { ok: false, error: 'Launch cursor does not match the canonical physical document.' };
    }
    const projection = projectPhysicPaintRotoPhysicalTimeline({
      identities: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      capacity: document.capacity,
      interpolationEnabled: document.interpolation.enabled,
      incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
    });
    if (!projection.ok) return { ok: false, error: projection.failure.text };
    return { ok: true, context, document };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid physical Roto launch.' };
  }
}

/** Decode canonical PNG sources first, then install every carried track's physical document. */
export async function hydrateRotoPhysicalLaunchContext(
  context: PhysicPaintLaunchContext,
  store: RotoPhysicalLaunchHydrationStore,
): Promise<RotoPhysicalLaunchHydrationResult> {
  const prepared = prepareRotoPhysicalLaunch(context);
  if (!prepared.ok) {
    // quick-260921-qls probe 1/3 (launch door): the launch was refused, so every
    // gesture on this layer is already dead. The `reason` field is what tells
    // this arm apart from the install refusal below — both carry the door's own
    // error string. Diagnostic only: no control flow change.
    //
    // The carried document is untrusted here (it crossed the webview boundary),
    // and a diagnostic read that throws would abort the launch BEFORE the
    // caller's loud failure path can report the refusal — the Studio would look
    // silently dead. Every read below is therefore guarded.
    const door = {
      ok: prepared.ok,
      error: prepared.error,
      layerId: context.layerId,
      startFrame: context.startFrame,
      activeTrackId: context.document?.activeTrackId ?? null,
      carriedCursorAppFrame: null as number | null,
      carriedRecordCount: -1,
    };
    try {
      const carried = getCarriedRotoPhysical(context);
      door.carriedCursorAppFrame = carried?.cursorAppFrame ?? null;
      door.carriedRecordCount = carried?.realKeyRecords?.length ?? -1;
    } catch {
      // A diagnostic never aborts launch hydration.
    }
    reportGestureRefusal('launch-door', { door });
    return prepared;
  }

  // quick-260913-52r (G): the alpha-canvas preparation requires inline bytes.
  // A reference-only record (its file was missing or refused at open, so the
  // runtime could not materialize it) must not kill the whole launch — the
  // structural install below still runs so keys and rails are correct, and
  // the affected frame renders as missing content. Loud per key, never a
  // silent drop, never an all-or-nothing refusal.
  const allRecords = [
    ...prepared.document.realKeyRecords,
    ...(prepared.document.groupOverrideRecords ?? []),
  ];
  const bytesCarrying = allRecords.filter((record) => record.payload.bytes !== undefined);
  for (const record of allRecords) {
    if (record.payload.bytes === undefined) {
      console.warn(
        `[PhysicsPaintStudio] Roto key "${record.keyId}" has no inline bytes at launch (reference-only, its package file could not be read). Its alpha canvas is skipped; the frame renders as missing content.`,
      );
    }
  }
  try {
    await prepareRotoPhysicalRealKeyFrames(bytesCarrying);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Canonical Roto PNG hydration failed.' };
  }

  // 47-01 UAT round 8: install EVERY carried track's physical document, not
  // just the active one — the strip renders every track's cells from the
  // child's runtime, so a non-active track with keys would otherwise show an
  // empty row after reopen. The active track's install is the launch
  // authority (its cursor/selection were overridden to the requested frame);
  // the other tracks install their carried state as-is.
  const activeTrackId = context.document?.activeTrackId ?? '';
  let activeDocument: PhysicPaintRotoPhysicalDocument | null = null;
  for (const track of context.document?.tracks ?? []) {
    if (!track.rotoPhysical) continue;
    const replacement = store.replaceRotoPhysicalDocument(context.layerId, track.id, track.rotoPhysical);
    if (!replacement.ok) return replacement;
    if (track.id === activeTrackId) activeDocument = replacement.document;
  }
  if (!activeDocument) {
    // quick-260921-qls probe 2/3 (carried-document install): the install loop
    // found no track whose id equals the carried activeTrackId, so the child
    // never received the physical document. The ids below name the mismatch.
    const install = {
      activeTrackId,
      carriedTrackIds: [] as string[],
      tracksCarryingPhysical: [] as string[],
      activeDocumentInstalled: activeDocument !== null,
    };
    try {
      const tracks = context.document?.tracks ?? [];
      install.carriedTrackIds = tracks.map((track) => track?.id ?? '<missing>');
      install.tracksCarryingPhysical = tracks.filter((track) => track?.rotoPhysical).map((track) => track?.id ?? '<missing>');
    } catch {
      // A diagnostic never aborts launch hydration.
    }
    reportGestureRefusal('launch-install', { install });
    return { ok: false, error: 'Launch is missing the complete physical Roto document.' };
  }
  return { ok: true, context, document: activeDocument };
}

// These signatures remain temporarily so existing pre-UAT regression sources
// continue to typecheck. The source/display hydration authority itself is
// retired: production callers must use hydrateRotoPhysicalLaunchContext.
export interface RotoLaunchHydrationStore {
  getRealRotoKeyFrames(layerId: string): number[];
  upsertRealRotoKeyFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame, backgroundOnly?: boolean): void;
  setRotoInterpolationSettings(layerId: string, settings: Partial<PhysicPaintRotoInterpolationSettings>): void;
  getRotoInterpolationSettings(layerId: string): PhysicPaintRotoInterpolationSettings;
  getRotoCacheFrames(layerId: string): PhysicPaintRotoCacheFrame[];
}

/** @deprecated Source/display launch seeding has no production implementation. */
export function seedRotoLaunchRealKeys(
  _context: PhysicPaintLaunchContext,
  _store: RotoLaunchHydrationStore,
): void {
  throw new Error('Legacy Roto launch seeding was retired by the physical persistence cutover.');
}

/** @deprecated Source/display launch merging has no production implementation. */
export function hydrateRotoLaunchContext(
  _context: PhysicPaintLaunchContext,
  _store: RotoLaunchHydrationStore,
): PhysicPaintLaunchContext {
  throw new Error('Legacy Roto launch hydration was retired by the physical persistence cutover.');
}
