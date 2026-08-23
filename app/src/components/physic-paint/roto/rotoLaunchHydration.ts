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
import { prepareRotoPhysicalRealKeyPngs } from './rotoCanvasFrames';

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

/** Decode canonical PNG sources first, then install exactly one complete physical document. */
export async function hydrateRotoPhysicalLaunchContext(
  context: PhysicPaintLaunchContext,
  store: RotoPhysicalLaunchHydrationStore,
): Promise<RotoPhysicalLaunchHydrationResult> {
  const prepared = prepareRotoPhysicalLaunch(context);
  if (!prepared.ok) return prepared;

  try {
    await prepareRotoPhysicalRealKeyPngs([
      ...prepared.document.realKeyRecords,
      ...(prepared.document.groupOverrideRecords ?? []),
    ]);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Canonical Roto PNG hydration failed.' };
  }

  // 46-01: install into the launch document's ACTIVE track (the launch IS the
  // document — D-03 — so the carried activeTrackId is the identity authority).
  const replacement = store.replaceRotoPhysicalDocument(context.layerId, context.document?.activeTrackId ?? '', prepared.document);
  if (!replacement.ok) return replacement;
  return { ok: true, context, document: replacement.document };
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
