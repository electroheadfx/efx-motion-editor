/**
 * Physical launch hydration — atomic reopen and initialization in the physical
 * coordinate.
 *
 * Per D-01/D-03: Hydration accepts only the already-decoded new-format real-key
 * records, enabled-only interpolation state, and separate Script Motion settings
 * produced by 36.14-01. It validates the complete collection and derived
 * projection before any store or launch mutation. A rejected hydration leaves
 * records, interpolation, launch context, selection, dirty state, and version
 * unchanged.
 *
 * Locked decisions honored:
 * - D-01: stable `keyId` plus direct `appFrame` is the only real-key authority.
 * - D-02: enabled-only interpolation state; generated cells are runtime-derived.
 * - D-03: no source/display projection, compatibility alias, or fallback.
 * - D-04: Script Motion remains a separate store/controller contract.
 * - D-10: one shared physical projection for all current-state consumers.
 * - D-11/D-12: production-only pre-UAT; no regression artifact or server process.
 */

import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { mergeRotoCacheFramesPreservingLaunchRealKeys, normalizeCachedRotoRealKeySourceFrame } from '../roto/rotoCacheTransactions';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  isPhysicPaintRotoInterpolationState,
  isPhysicPaintRotoScriptMotionSettings,
  parsePhysicPaintRotoRealKeyRecordCollection,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoRealKeyRecord,
  type PhysicPaintRotoScriptMotionSettings,
} from './physicsPaintRotoPhysicalModel';
import { projectPhysicPaintRotoPhysicalTimeline } from './physicsPaintRotoPhysicalResolver';

// ---------------------------------------------------------------------------
// Legacy launch hydration (source/display model).
//
// These helpers remain temporarily for the legacy launch-context wiring that
// has not yet migrated to the physical hydration contract. They will be removed
// when the remaining caller in PhysicsPaintStudio.tsx completes its cutover.
// ---------------------------------------------------------------------------

export interface RotoLaunchHydrationStore {
  getRealRotoKeyFrames(layerId: string): number[];
  upsertRealRotoKeyFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame, backgroundOnly?: boolean): void;
  setRotoInterpolationSettings(layerId: string, settings: Partial<PhysicPaintRotoInterpolationSettings>): void;
  getRotoInterpolationSettings(layerId: string): PhysicPaintRotoInterpolationSettings;
  getRotoCacheFrames(layerId: string): PhysicPaintRotoCacheFrame[];
}

export function seedRotoLaunchRealKeys(
  context: PhysicPaintLaunchContext,
  store: RotoLaunchHydrationStore,
): void {
  const existingSources = new Set(store.getRealRotoKeyFrames(context.layerId));
  for (const frame of context.cachedRotoFrames ?? []) {
    if (frame.source !== 'real-key') continue;
    const sourceFrame = frame.sourceFrame ?? frame.appFrame;
    if (existingSources.has(sourceFrame)) continue;
    store.upsertRealRotoKeyFrame(context.layerId, sourceFrame, frame, frame.backgroundOnly === true);
    existingSources.add(sourceFrame);
  }
}

export function hydrateRotoLaunchContext(
  context: PhysicPaintLaunchContext,
  store: RotoLaunchHydrationStore,
): PhysicPaintLaunchContext {
  if (!context.rotoInterpolationSettings) return context;
  seedRotoLaunchRealKeys(context, store);
  store.setRotoInterpolationSettings(context.layerId, context.rotoInterpolationSettings);
  const settings = store.getRotoInterpolationSettings(context.layerId);
  const storeFrames = store.getRotoCacheFrames(context.layerId);
  const fallbackFrames = mergeRotoCacheFramesPreservingLaunchRealKeys(context.cachedRotoFrames, storeFrames);
  const cachedRotoFrames = settings.enabled && storeFrames.length > 0
    ? storeFrames
    : fallbackFrames.filter((frame) => frame.source === 'real-key').map(normalizeCachedRotoRealKeySourceFrame);
  return { ...context, cachedRotoFrames, rotoInterpolationSettings: settings };
}

// ---------------------------------------------------------------------------
// Physical launch hydration (D-01/D-03/D-10).
//
// This contract sources all state from the 36.14-01 physical model and the
// shared projection seam. It validates the complete collection and projection
// before any store mutation, then publishes one atomic transition.
// ---------------------------------------------------------------------------

/**
 * Physical store boundary consumed by hydration. These methods are the same
 * ones added to `physicPaintStore` in Task 1.
 */
export interface RotoPhysicalLaunchHydrationStore {
  replaceRotoPhysicalRecords(
    layerId: string,
    records: unknown,
    interpolation: unknown,
    capacity: number,
  ): { ok: true } | { ok: false; error: string };
  getRotoRealKeyRecords(layerId: string): PhysicPaintRotoRealKeyRecord[];
  getRotoRealKeyRecord(layerId: string, keyId: string): PhysicPaintRotoRealKeyRecord | null;
  getRotoRealKeyRecordByAppFrame(layerId: string, appFrame: number): PhysicPaintRotoRealKeyRecord | null;
  getRotoPhysicalInterpolationState(layerId: string): PhysicPaintRotoInterpolationState;
  getRotoPhysicalCapacity(layerId: string): number;
}

/**
 * Immutable physical hydration input: the already-decoded new-format real-key
 * records, enabled-only interpolation state, separate Script Motion settings,
 * bounded capacity, navigation frame, and optional persisted selection identity.
 */
export interface RotoPhysicalLaunchHydrationInput {
  readonly layerId: string;
  readonly rotoKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly rotoInterpolationState: PhysicPaintRotoInterpolationState;
  readonly scriptMotion: PhysicPaintRotoScriptMotionSettings;
  readonly capacity: number;
  readonly currentAppFrame: number;
  readonly persistedSelectedKeyId?: string | null;
}

/**
 * Closed hydration result: success contains the accepted immutable records,
 * derived selected identity, and direct navigation frame; failure contains a
 * concise reason and no partial state.
 */
export type RotoPhysicalLaunchHydrationResult =
  | { readonly ok: true; readonly records: readonly PhysicPaintRotoRealKeyRecord[]; readonly interpolation: PhysicPaintRotoInterpolationState; readonly scriptMotion: PhysicPaintRotoScriptMotionSettings; readonly selectedKeyId: string | null; readonly currentAppFrame: number; readonly capacity: number }
  | { readonly ok: false; readonly error: string };

/**
 * Hydrate or reopen a Roto layer from one validated physical record set.
 *
 * Validates the complete record collection, interpolation state, Script Motion
 * settings, layer identity, capacity, and derived projection before any store
 * mutation. On success, performs one complete store replacement and derives
 * `selectedKeyId` from the current physical record at the navigation frame
 * (or from the persisted identity if it resolves). On failure, returns a typed
 * error and changes nothing.
 *
 * Per D-03: never allocates an ID, infers a coordinate, filters invalid
 * records into a partial success, or persists a generated cell.
 */
export function hydrateRotoPhysicalLaunch(
  input: RotoPhysicalLaunchHydrationInput,
  store: RotoPhysicalLaunchHydrationStore,
): RotoPhysicalLaunchHydrationResult {
  if (!input.layerId || typeof input.layerId !== 'string') {
    return { ok: false, error: 'Layer ID must be a non-empty string.' };
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    return { ok: false, error: 'Capacity must be a positive integer.' };
  }
  if (!isPhysicPaintRotoInterpolationState(input.rotoInterpolationState)) {
    return { ok: false, error: 'Interpolation state must be enabled-only (D-02).' };
  }
  if (!isPhysicPaintRotoScriptMotionSettings(input.scriptMotion)) {
    return { ok: false, error: 'Script Motion settings must be a separate D-04 contract.' };
  }
  if (!Number.isInteger(input.currentAppFrame) || input.currentAppFrame < 0 || input.currentAppFrame >= input.capacity) {
    return { ok: false, error: 'Current appFrame must be a nonnegative integer within capacity.' };
  }

  // Validate the complete record collection before any mutation.
  let validatedRecords: readonly PhysicPaintRotoRealKeyRecord[];
  try {
    validatedRecords = parsePhysicPaintRotoRealKeyRecordCollection(input.rotoKeyRecords, input.capacity);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid real-key record collection.' };
  }

  // Validate the derived projection before any mutation.
  const identities = validatedRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const projectionResult = projectPhysicPaintRotoPhysicalTimeline({
    identities,
    capacity: input.capacity,
    interpolationEnabled: input.rotoInterpolationState.enabled,
  });
  if (!projectionResult.ok) {
    return { ok: false, error: projectionResult.failure.text };
  }

  // Validate persisted selection identity if provided.
  if (input.persistedSelectedKeyId !== null && input.persistedSelectedKeyId !== undefined) {
    const persistedRecord = validatedRecords.find((record) => record.keyId === input.persistedSelectedKeyId);
    if (!persistedRecord) {
      return { ok: false, error: `Unknown selected keyId "${input.persistedSelectedKeyId}" — rejecting hydration.` };
    }
  }

  // Perform one complete store replacement. If the store rejects, nothing
  // changes (the store's replaceRotoPhysicalRecords validates again internally).
  const replacement = store.replaceRotoPhysicalRecords(
    input.layerId,
    validatedRecords,
    input.rotoInterpolationState,
    input.capacity,
  );
  if (!replacement.ok) {
    return { ok: false, error: replacement.error };
  }

  // Derive selectedKeyId from the current physical record at the navigation
  // frame, or from the persisted identity if it resolves.
  let selectedKeyId: string | null = null;
  if (input.persistedSelectedKeyId) {
    const persistedRecord = store.getRotoRealKeyRecord(input.layerId, input.persistedSelectedKeyId);
    if (persistedRecord) {
      selectedKeyId = persistedRecord.keyId;
    }
  }
  if (selectedKeyId === null) {
    const recordAtFrame = store.getRotoRealKeyRecordByAppFrame(input.layerId, input.currentAppFrame);
    if (recordAtFrame) {
      selectedKeyId = recordAtFrame.keyId;
    }
  }

  return {
    ok: true,
    records: store.getRotoRealKeyRecords(input.layerId),
    interpolation: store.getRotoPhysicalInterpolationState(input.layerId),
    scriptMotion: input.scriptMotion,
    selectedKeyId,
    currentAppFrame: input.currentAppFrame,
    capacity: input.capacity,
  };
}

/**
 * Initialize a new empty Roto layer. Per D-03: publishes an empty physical
 * record collection, disabled interpolation default, separate Script Motion
 * default, null selected identity, and the existing legal physical navigation
 * frame. Creates no placeholder real key and no generated cell.
 */
export function initializeEmptyRotoPhysicalLayer(
  input: { layerId: string; capacity: number; currentAppFrame: number },
  store: RotoPhysicalLaunchHydrationStore,
): RotoPhysicalLaunchHydrationResult {
  return hydrateRotoPhysicalLaunch(
    {
      layerId: input.layerId,
      rotoKeyRecords: [],
      rotoInterpolationState: PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
      scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
      capacity: input.capacity,
      currentAppFrame: input.currentAppFrame,
      persistedSelectedKeyId: null,
    },
    store,
  );
}