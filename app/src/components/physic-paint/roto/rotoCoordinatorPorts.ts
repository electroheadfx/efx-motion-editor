import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRotoCacheFrame, PhysicPaintLaunchContext, PhysicPaintRotoPhysicalEditApplyPayload } from '../../../types/physicPaint';
import type { RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { RotoSessionEffect } from '../roto/physicsPaintRotoSession';
import type { PhysicPaintRotoRealKeyRecord, PhysicPaintRotoInterpolationState } from './physicsPaintRotoPhysicalModel';
import type { RenderedFramePayload } from './rotoCanvasFrames';
import type { PendingPhysicPaintRotoPhysicalEdit } from './rotoApplyTransactions';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

export interface RotoKeyPersistencePort {
  syncKeyFrameLists: (cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  applyKeyFrames: (transaction: RotoKeyUtilityTransaction) => readonly PhysicPaintRotoCacheFrame[];
  persistKeyFrameTransaction: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
}

export interface RotoFrameDisplayPort {
  restoreFrame: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, refreshedCacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  clearCanvas: (frame: number) => void;
  navigate: (frame: number) => Promise<void | boolean>;
  clearCachedReferenceFrame: (frame: number) => void;
}

export function createRotoKeyPersistencePort(): RotoKeyPersistencePort {
  return {
    syncKeyFrameLists: () => {},
    applyKeyFrames: () => [],
    persistKeyFrameTransaction: async () => {},
  };
}

export function createRotoFrameDisplayPort(): RotoFrameDisplayPort {
  return {
    restoreFrame: () => {},
    clearCanvas: () => {},
    navigate: async () => false,
    clearCachedReferenceFrame: () => {},
  };
}

// ---------------------------------------------------------------------------
// Generic acknowledged physical-edit coordinator ports (Plan 36.14-04
// Task 2). Inactive in this task: no production caller imports these types
// yet. The current move-era snapshot/publication flow remains solely active
// until Task 3 rewires every live consumer in one atomic cutover.
//
// Per D-09/D-10: the ports expose explicit current reads and whole immutable
// replacements only. There is no pairwise map mutation, no move-named method,
// and no compatibility adapter. The coordinator owns:
// - authoritative records/interpolation and content revision;
// - latest/confirmed rendered caches;
// - editable, preview, captured, dirty, and live-overlay ownership;
// - editable-frame list;
// - selected `keyId`;
// - current physical frame;
// - engine serialized state;
// - cached reference URL and repaint base;
// - launch/project/layer identity;
// - bridge availability;
// - paint/publication barriers;
// - generic settlement registration/result consumption;
// - one complete payload send;
// - concise status;
// - detailed LOG output.
//
// Script Motion remains outside the transaction per D-04.
// ---------------------------------------------------------------------------

/**
 * Mutable deep-cloned snapshot captured by the coordinator before staging.
 * Restoration republishes the captured state through the established
 * monotonic invalidation path rather than assigning a captured numeric
 * visual-version value.
 */
export interface RotoPhysicalEditSnapshot<EngineState> {
  readonly launchOperationId: string;
  readonly layerId: string;
  readonly projectContextId: string | null;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly capacity: number;
  readonly expectedRevision: string;
  readonly stagedRevision: string;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  readonly currentAppFrame: number;
  readonly dirtyFrames: ReadonlySet<number>;
  readonly editableFrames: readonly number[];
  readonly liveOverlayActionCounts: ReadonlyMap<number, number>;
  readonly frameStates: ReadonlyMap<number, RenderedFramePayload>;
  readonly previewFrames: ReadonlyMap<number, RenderedFramePayload>;
  readonly capturedFrames: ReadonlyMap<number, RenderedFramePayload>;
  readonly cachedReference: { url: string | null; cachedRepaintBase: RenderedFramePayload | null };
  readonly engineState: EngineState | null;
}

/**
 * Immutable accepted edit output exposed by the coordinator on successful
 * settlement. Carries the before/after snapshots so Plan 36.14-05 can record
 * accepted-only history without re-deriving from the store.
 */
export interface RotoPhysicalEditAcceptedOutput<EngineState> {
  readonly before: RotoPhysicalEditSnapshot<EngineState>;
  readonly after: RotoPhysicalEditSnapshot<EngineState>;
  readonly acceptedRevision: string;
}

/**
 * Immutable failure output exposed by the coordinator on unsuccessful
 * settlement. Carries the restored snapshot for diagnostic LOG-only routing.
 */
export interface RotoPhysicalEditFailureOutput<EngineState> {
  readonly restored: RotoPhysicalEditSnapshot<EngineState>;
  readonly reason: 'transport' | 'parent-rejection' | 'timeout' | 'settlement-mismatch' | 'exception';
  readonly error?: unknown;
}

/**
 * Concise pending presentation state for the compact status capsule. Per
 * D-25/D-26: pending and success expose one concise user status; complete
 * transport, validation, and settlement diagnostics go only to existing LOG
 * state without automatic tab changes.
 */
export interface RotoPhysicalEditPresentation {
  readonly status: 'idle' | 'pending' | 'accepted' | 'failed';
  readonly conciseMessage: string | null;
}

/**
 * Authoritative records/interpolation reads plus complete replacement.
 * The coordinator revalidates records against the resolver proposal and
 * replaces the entire collection via one store mutation.
 */
export interface RotoPhysicalEditRecordsPort {
  getRecords: (layerId: string) => readonly PhysicPaintRotoRealKeyRecord[];
  getInterpolation: (layerId: string) => PhysicPaintRotoInterpolationState;
  getCapacity: (layerId: string) => number;
  replaceRecords: (
    layerId: string,
    records: readonly PhysicPaintRotoRealKeyRecord[],
    interpolation: PhysicPaintRotoInterpolationState,
  ) => { ok: true } | { ok: false; error: string };
}

/**
 * Edit-buffer ownership: editable state, preview frames, captured frames,
 * dirty frames, live-overlay action counts, and editable-frame list.
 */
export interface RotoPhysicalEditBufferPort {
  readonly frameStates: ReadonlyMap<number, RenderedFramePayload>;
  readonly previewFrames: ReadonlyMap<number, RenderedFramePayload>;
  readonly capturedFrames: ReadonlyMap<number, RenderedFramePayload>;
  readonly dirtyFrames: ReadonlySet<number>;
  readonly liveOverlayActionCounts: ReadonlyMap<number, number>;
  readonly editableFrames: readonly number[];
  replaceFrameStates: (frames: ReadonlyMap<number, RenderedFramePayload>) => void;
  replacePreviewFrames: (frames: ReadonlyMap<number, RenderedFramePayload>) => void;
  replaceCapturedFrames: (frames: ReadonlyMap<number, RenderedFramePayload>) => void;
  replaceDirtyFrames: (frames: ReadonlySet<number>) => void;
  replaceLiveOverlayActionCounts: (counts: ReadonlyMap<number, number>) => void;
  setEditableFrameList: (frames: readonly number[]) => void;
}

/**
 * Selection + current frame ownership.
 */
export interface RotoPhysicalEditSelectionPort {
  getSelectedKeyId: () => string | null;
  setSelectedKeyId: (keyId: string | null) => void;
  getCurrentAppFrame: () => number;
  setCurrentAppFrame: (frame: number) => void;
}

/**
 * Cached reference URL and repaint base ownership. The `cachedReference` pair
 * bundles the cached reference URL with the cached repaint base; the
 * snapshot captures both so rollback can republish the prior cached
 * reference without writing an older visual-version value.
 */
export interface RotoPhysicalEditReferencePort {
  getCachedReference: () => { url: string | null; cachedRepaintBase: RenderedFramePayload | null };
  setCachedReference: (reference: { url: string | null; cachedRepaintBase: RenderedFramePayload | null }) => void;
}

/**
 * Engine serialized state ownership.
 */
export interface RotoPhysicalEditEnginePort<EngineState> {
  saveEngineState: () => EngineState | null;
  loadEngineState: (state: EngineState) => void;
}

/**
 * Launch/project/layer identity ownership.
 */
export interface RotoPhysicalEditLaunchPort {
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  setLaunchContextStartFrame: (frame: number) => void;
  setLaunchContextCachedFrames: (frames: readonly PhysicPaintRotoRealKeyRecord[]) => void;
}

/**
 * Paint/publication barriers.
 */
export interface RotoPhysicalEditPaintBarrierPort {
  flushPendingStrokeFinalizations: () => void;
  flushLivePixels: (sourceFrame: number) => Promise<void>;
}

/**
 * Bridge availability + payload send.
 */
export interface RotoPhysicalEditBridgePort {
  getBridgeMode: () => PhysicsPaintBridgeMode;
  sendPhysicalEditPayload: (payload: PhysicPaintRotoPhysicalEditApplyPayload) => Promise<void>;
}

/**
 * Generic settlement registration + result consumption.
 */
export interface RotoPhysicalEditSettlementPort {
  registerPendingSettlement: (pending: PendingPhysicPaintRotoPhysicalEdit) => void;
  clearPendingSettlement: () => void;
}

/**
 * Concise status + detailed LOG output.
 */
export interface RotoPhysicalEditStatusPort {
  setApplyStatus: (status: 'idle' | 'applying' | 'success' | 'error') => void;
  setConciseMessage: (message: string | null) => void;
  setLastError: (message: string | null) => void;
  logDiagnostic: (message: string) => void;
}

/**
 * Complete coordinator port bundle. Satisfiable by the existing Studio
 * owners in Task 3 without introducing an adapter module or alternate
 * transaction implementation.
 */
export interface RotoPhysicalEditCoordinatorPorts<EngineState = SerializedProject> {
  readonly engine: EfxPaintEngine | null;
  readonly records: RotoPhysicalEditRecordsPort;
  readonly buffer: RotoPhysicalEditBufferPort;
  readonly selection: RotoPhysicalEditSelectionPort;
  readonly reference: RotoPhysicalEditReferencePort;
  readonly engineState: RotoPhysicalEditEnginePort<EngineState>;
  readonly launch: RotoPhysicalEditLaunchPort;
  readonly paint: RotoPhysicalEditPaintBarrierPort;
  readonly bridge: RotoPhysicalEditBridgePort;
  readonly settlement: RotoPhysicalEditSettlementPort;
  readonly status: RotoPhysicalEditStatusPort;
}

/**
 * Input to `executePhysicalEdit`. The proposal carries the complete
 * validated identity-to-frame mapping; `expectedLaunch` is the launch
 * context identity at dispatch time; `selectedKeyId`/`selectedAppFrame`
 * are the post-edit selection state the parent will acknowledge.
 */
export interface RotoPhysicalEditExecuteInput<Proposal> {
  readonly proposal: Proposal;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly operationKind: PhysicPaintRotoPhysicalEditApplyPayload['operationKind'];
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}