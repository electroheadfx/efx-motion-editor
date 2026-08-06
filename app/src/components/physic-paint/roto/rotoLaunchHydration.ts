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
 * Validate one complete canonical launch without mutating the store or current
 * launch. The bridge payload is converted to the model's durable record shape
 * and the persisted revision is rechecked before publication.
 */
export function prepareRotoPhysicalLaunch(
  context: PhysicPaintLaunchContext,
): RotoPhysicalLaunchHydrationResult {
  const physical = context.rotoPhysical;
  if (!physical) return { ok: false, error: 'Launch is missing the complete physical Roto document.' };
  try {
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: physical.capacity,
      realKeyRecords: physical.records.map((record) => ({
        kind: 'real-key' as const,
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: record.payload,
      })),
      interpolation: {
        enabled: physical.interpolationEnabled,
        mode: physical.interpolationMode,
      },
      scriptMotion: physical.scriptMotion,
      background: physical.background,
      selectedKeyId: physical.selectedKeyId,
      cursorAppFrame: physical.cursorAppFrame,
      revision: physical.revision,
      loopClips: physical.loopClips,
    });
    if (context.startFrame !== document.cursorAppFrame) {
      return { ok: false, error: 'Launch cursor does not match the canonical physical document.' };
    }
    const projection = projectPhysicPaintRotoPhysicalTimeline({
      identities: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      capacity: document.capacity,
      interpolationEnabled: document.interpolation.enabled,
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
    await prepareRotoPhysicalRealKeyPngs(prepared.document.realKeyRecords);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Canonical Roto PNG hydration failed.' };
  }

  const replacement = store.replaceRotoPhysicalDocument(context.layerId, prepared.document);
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
