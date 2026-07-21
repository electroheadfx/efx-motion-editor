import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { PersistedRotoScriptV1, RotoScriptLibraryRow } from '../components/physic-paint/roto/physicsPaintRotoScriptSchema';
import { isCanonicalRotoScriptId, isPersistedRotoScriptV1, normalizeRotoScriptName } from '../components/physic-paint/roto/physicsPaintRotoScriptSchema';

export const PHYSIC_PAINT_MAX_APPLY_FRAMES = 600;
export const PHYSIC_PAINT_DEFAULT_APPLY_FRAMES = 4;

export const PHYSIC_PAINT_MIN_APPLY_FRAMES = 1;

// ---------------------------------------------------------------------------
// Standalone generic physical-edit request/result envelope (Plan 36.14-04
// Task 1). These successor interfaces are INACTIVE additions: they are NOT
// members of the active `PhysicPaintApplyPayload` union or `PhysicPaintApplyResult`
// below, and they are NOT routed through `isPhysicPaintApplyPayload` bridge
// validation. Plan 36.14-04 Task 3 will activate them as the sole physical
// branch and remove the current `replace-roto-key-frames` move-era branch in
// the same atomic cutover; until then the current move path remains the only
// live transaction route.
//
// Locked decisions honored:
// - D-01/D-03: payload remains owned by stable `keyId` while a complete
//   validated map changes direct physical `appFrame` placement; no
//   source/display alias, migration adapter, generated durable record,
//   fallback transaction, or dual publication path participates.
// - D-09: the request carries the complete immutable final records, enabled
//   interpolation state, selected identity, and selected direct frame; the
//   result echoes the exact settlement tuple and carries accepted revision
//   only on success.
// - D-10: direct physical downstream authority; no source/display coordinate
//   translation.
// ---------------------------------------------------------------------------

/**
 * Operation kind literal for the generic acknowledged physical-edit
 * transaction. Plan 36.14-06 through 36.14-08 will route Insert, Delete,
 * Drag, and Force Spacing intents through this single kind after the Task 3
 * cutover. Plan 36.14-05 Task 1 adds the `undo` and `redo` replay kinds so
 * the generic physical history hook can route Undo/Redo through the same
 * coordinator execute seam; Task 2 attaches replay provenance to these
 * kinds only.
 */
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'delete-key'
  | 'move-key'
  | 'force-spacing'
  | 'undo'
  | 'redo';

/**
 * Replay provenance for Undo/Redo physical-edit requests (Plan 36.14-05
 * Task 2). Per D-05/D-06/D-08/D-09: attached to the closed physical apply
 * envelope only when `operationKind === 'undo' | 'redo'`. The parent
 * authority retains a canonical accepted-operation ledger keyed by
 * `historyCommandId` (the original accepted operation ID); on replay, it
 * requires the current authoritative state to match `sourceRevision` and
 * the submitted complete target state to match `targetRevision` before
 * one store replacement. Undo carries `historyDirection: 'undo'`,
 * `sourceRevision = original.acceptedRevision`, `targetRevision =
 * revision(original.before)`; Redo is the inverse. Forbidden on ordinary
 * kinds; required on replay kinds; no second transport branch.
 */
export interface PhysicPaintRotoPhysicalEditReplayProvenance {
  readonly historyCommandId: string;
  readonly historyDirection: 'undo' | 'redo';
  readonly sourceRevision: string;
  readonly targetRevision: string;
}

/**
 * Standalone generic physical-edit apply payload (inactive successor of the
 * current `replace-roto-key-frames` move-era branch).
 *
 * Per D-09: the request carries operation ID, operation kind, layer,
 * launch/project context identity, expected revision, immutable complete
 * final records, enabled-only interpolation state, selected `keyId | null`,
 * and selected direct `appFrame`. The parent independently revalidates every
 * field before one store replacement.
 *
 * Per D-05/D-06/D-08/D-09 (Plan 36.14-05 Task 2): the request carries
 * `historyProvenance` only when `operationKind` is `'undo'` or `'redo'`,
 * and the parent revalidates it against the accepted-operation ledger
 * before authorizing an identity-set replay.
 *
 * This interface is NOT a member of `PhysicPaintApplyPayload`. It is the one
 * successor contract that Plan 36.14-04 Task 3 activates while removing the
 * old `replace-roto-key-frames` branch.
 */
export interface PhysicPaintRotoPhysicalEditApplyPayload {
  readonly kind: 'replace-roto-physical-map';
  readonly operationId: string;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  readonly layerId: string;
  readonly startFrame: number;
  readonly launchOperationId: string;
  readonly projectContextId?: string;
  readonly expectedRevision: string;
  readonly records: readonly PhysicPaintRotoPhysicalEditRecord[];
  readonly interpolationEnabled: boolean;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  readonly historyProvenance?: PhysicPaintRotoPhysicalEditReplayProvenance;
}

/**
 * Immutable real-key record carried by the generic apply payload. Composed
 * from the same strict allowlisted fields as the canonical physical model:
 * stable `keyId`, direct `appFrame`, and the rendered payload (`frameIndex`,
 * `appFrame`, `dataUrl`, `width`, `height`). No source/display provenance,
 * generated-cell discriminator, or timing override survives.
 */
export interface PhysicPaintRotoPhysicalEditRecord {
  readonly keyId: string;
  readonly appFrame: number;
  readonly payload: {
    readonly frameIndex: number;
    readonly appFrame: number;
    readonly dataUrl: string;
    readonly width?: number;
    readonly height?: number;
  };
}

/**
 * Standalone generic physical-edit apply result (inactive successor of the
 * current move-era apply result). The result echoes the exact settlement
 * tuple (operation ID, kind, layer, launch/project context) and carries the
 * accepted revision only on success.
 *
 * This interface is NOT a member of `PhysicPaintApplyResult`. The active
 * apply result contract remains unchanged until Plan 36.14-04 Task 3
 * activates this successor.
 */
export interface PhysicPaintRotoPhysicalEditApplyResult {
  readonly operationId: string;
  readonly kind: 'replace-roto-physical-map';
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  readonly layerId: string;
  readonly startFrame: number;
  readonly launchOperationId: string;
  readonly projectContextId?: string;
  readonly expectedRevision: string;
  readonly stagedRevision: string;
  readonly acceptedRevision: string | null;
  readonly ok: boolean;
  readonly error?: string;
  readonly historyProvenance?: PhysicPaintRotoPhysicalEditReplayProvenance;
}

const PHYSIC_PAINT_ROTO_PHYSICAL_EDIT_RECORD_PAYLOAD_KEYS = new Set(['frameIndex', 'appFrame', 'dataUrl', 'width', 'height']);

/**
 * Strict guard for {@link PhysicPaintRotoPhysicalEditRecord}. Rejects
 * non-records, unknown members, malformed identity, and malformed payload
 * (composed from the existing rendered-frame allowlist).
 */
export function isPhysicPaintRotoPhysicalEditRecord(value: unknown): value is PhysicPaintRotoPhysicalEditRecord {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['keyId', 'appFrame', 'payload'])) return false;
  if (!isNonEmptyString(value.keyId)) return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  const payload = value.payload;
  if (!isRecord(payload)) return false;
  if (!hasOnlyKeys(payload, [...PHYSIC_PAINT_ROTO_PHYSICAL_EDIT_RECORD_PAYLOAD_KEYS])) return false;
  if (!isNonNegativeInteger(payload.frameIndex)) return false;
  if (!isNonNegativeInteger(payload.appFrame)) return false;
  if (!isRenderedPngDataUrl(payload.dataUrl)) return false;
  return optionalNumber(payload.width) && optionalNumber(payload.height);
}

/**
 * Strict guard for {@link PhysicPaintRotoPhysicalEditReplayProvenance}.
 * Rejects non-records, unknown members, malformed identifiers, and
 * unknown directions. Used by the payload/result validators to authorize
 * identity-changing Undo/Redo against the original accepted command.
 */
export function isPhysicPaintRotoPhysicalEditReplayProvenance(value: unknown): value is PhysicPaintRotoPhysicalEditReplayProvenance {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['historyCommandId', 'historyDirection', 'sourceRevision', 'targetRevision'])) return false;
  if (!isNonEmptyString(value.historyCommandId)) return false;
  if (value.historyDirection !== 'undo' && value.historyDirection !== 'redo') return false;
  if (!isNonEmptyString(value.sourceRevision)) return false;
  if (!isNonEmptyString(value.targetRevision)) return false;
  return true;
}

/**
 * Strict guard for {@link PhysicPaintRotoPhysicalEditApplyPayload}. Rejects
 * non-records, unknown members, wrong kind, malformed operation/layer IDs,
 * missing expected revision, malformed records, and invalid selection
 * state. This is a closed allowlist validator: it does not normalize, alias,
 * or fall back to any move-era shape.
 *
 * Per Plan 36.14-05 Task 2: replay provenance is required when
 * `operationKind` is `'undo'` or `'redo'` and forbidden on ordinary
 * kinds; the validator rejects unknown fields and accepts only the two
 * directions.
 */
export function isPhysicPaintRotoPhysicalEditApplyPayload(value: unknown): value is PhysicPaintRotoPhysicalEditApplyPayload {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['kind', 'operationId', 'operationKind', 'layerId', 'startFrame', 'launchOperationId', 'projectContextId', 'expectedRevision', 'records', 'interpolationEnabled', 'selectedKeyId', 'selectedAppFrame', 'historyProvenance'])) return false;
  if (value.kind !== 'replace-roto-physical-map') return false;
  if (!isNonEmptyString(value.operationId)) return false;
  if (value.operationKind !== 'insert-slot' && value.operationKind !== 'delete-key' && value.operationKind !== 'move-key' && value.operationKind !== 'force-spacing' && value.operationKind !== 'undo' && value.operationKind !== 'redo') return false;
  if (!isNonEmptyString(value.layerId)) return false;
  if (!isNonNegativeInteger(value.startFrame)) return false;
  if (!isNonEmptyString(value.launchOperationId)) return false;
  if (value.projectContextId !== undefined && !isNonEmptyString(value.projectContextId)) return false;
  if (!isNonEmptyString(value.expectedRevision)) return false;
  if (!Array.isArray(value.records) || !value.records.every(isPhysicPaintRotoPhysicalEditRecord)) return false;
  if (typeof value.interpolationEnabled !== 'boolean') return false;
  if (value.selectedKeyId !== null && !isNonEmptyString(value.selectedKeyId)) return false;
  if (value.selectedAppFrame !== null && !isNonNegativeInteger(value.selectedAppFrame)) return false;
  const isReplay = value.operationKind === 'undo' || value.operationKind === 'redo';
  if (isReplay) {
    if (!isPhysicPaintRotoPhysicalEditReplayProvenance(value.historyProvenance)) return false;
    if (value.historyProvenance.historyDirection !== value.operationKind) return false;
  } else {
    if (value.historyProvenance !== undefined) return false;
  }
  return true;
}

/**
 * Strict guard for {@link PhysicPaintRotoPhysicalEditApplyResult}. Rejects
 * non-records, unknown members, wrong kind, malformed settlement tuple, and
 * missing accepted revision on success.
 *
 * Per Plan 36.14-05 Task 2: replay provenance is required on the result
 * when `operationKind` is `'undo'` or `'redo'` and forbidden on ordinary
 * kinds; the validator mirrors the payload contract.
 */
export function isPhysicPaintRotoPhysicalEditApplyResult(value: unknown): value is PhysicPaintRotoPhysicalEditApplyResult {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['operationId', 'kind', 'operationKind', 'layerId', 'startFrame', 'launchOperationId', 'projectContextId', 'expectedRevision', 'stagedRevision', 'acceptedRevision', 'ok', 'error', 'historyProvenance'])) return false;
  if (value.kind !== 'replace-roto-physical-map') return false;
  if (!isNonEmptyString(value.operationId)) return false;
  if (value.operationKind !== 'insert-slot' && value.operationKind !== 'delete-key' && value.operationKind !== 'move-key' && value.operationKind !== 'force-spacing' && value.operationKind !== 'undo' && value.operationKind !== 'redo') return false;
  if (!isNonEmptyString(value.layerId)) return false;
  if (!isNonNegativeInteger(value.startFrame)) return false;
  if (!isNonEmptyString(value.launchOperationId)) return false;
  if (value.projectContextId !== undefined && !isNonEmptyString(value.projectContextId)) return false;
  if (!isNonEmptyString(value.expectedRevision)) return false;
  if (!isNonEmptyString(value.stagedRevision)) return false;
  if (value.acceptedRevision !== null && !isNonEmptyString(value.acceptedRevision)) return false;
  if (typeof value.ok !== 'boolean') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (value.ok && value.acceptedRevision === null) return false;
  if (!value.ok && value.acceptedRevision !== null) return false;
  const isReplay = value.operationKind === 'undo' || value.operationKind === 'redo';
  if (isReplay) {
    if (!isPhysicPaintRotoPhysicalEditReplayProvenance(value.historyProvenance)) return false;
    if (value.historyProvenance.historyDirection !== value.operationKind) return false;
  } else {
    if (value.historyProvenance !== undefined) return false;
  }
  return true;
}
const RENDERED_DATA_URL_PREFIX = 'data:image/png';
const FORBIDDEN_APPLY_FIELDS = new Set(['engine', 'internals', 'strokes']);

export type PhysicPaintApplyKind = 'apply-canvas' | 'delete-roto-frame' | 'replace-roto-key-frames' | 'replace-roto-physical-map' | 'update-roto-interpolation-settings';
export type PhysicPaintRotoFrameSource = 'real-key' | 'generated-interpolation' | 'background-only-support';
export type PhysicPaintRotoInterpolationMode = 'duplicate' | 'blend';
export type PhysicPaintRotoBackgroundMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3';

export interface PhysicPaintRotoBackgroundMetadata {
  background: PhysicPaintRotoBackgroundMode;
  paperGrain: string;
  grainStrength: number;
  color?: string;
}

export interface PhysicPaintRotoSegmentSpacingOverride {
  fromSourceFrame: number;
  toSourceFrame: number;
  inBetweenCount: number;
}

export interface PhysicPaintRotoInterpolationSettings {
  enabled: boolean;
  inBetweenCount: number;
  mode: PhysicPaintRotoInterpolationMode;
  deform: number;
  position: number;
  segmentSpacingOverrides?: PhysicPaintRotoSegmentSpacingOverride[];
}

export interface PhysicPaintRotoCacheFrame extends PhysicPaintRenderedFrame {
  source: PhysicPaintRotoFrameSource;
  nearestRealKeyFrame?: number;
  sourceFrame?: number;
  displayFrame?: number;
  fromSourceFrame?: number;
  toSourceFrame?: number;
  interpolationT?: number;
  backgroundOnly?: boolean;
  onionDataUrl?: string;
}

export interface PhysicPaintProjectContext {
  name: string;
  saved: boolean;
  contextId: string;
}

export interface PhysicPaintLaunchContext {
  operationId: string;
  layerId: string;
  project?: PhysicPaintProjectContext;
  startFrame: number;
  layerName?: string;
  workflowLabel?: string;
  width?: number;
  height?: number;
  fps?: number;
  editableState?: SerializedProject;
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
}

export interface PhysicPaintFrameSyncMessage {
  type: 'physic-paint:seek-frame';
  frame: number;
}

export interface PhysicPaintStateSaveRequest {
  operationId: string;
  filename: string;
  contents: string;
}

export interface PhysicPaintStateSaveResult {
  operationId: string;
  status: 'saved' | 'cancelled' | 'error';
  error?: string;
}

export interface PhysicPaintThumbnailEncodeRequest {
  operationId: string;
  width: number;
  height: number;
  quality: number;
  rgbaBase64: string;
}

export interface PhysicPaintThumbnailEncodeResult {
  operationId: string;
  ok: boolean;
  width: number;
  height: number;
  mimeType: 'image/webp';
  webpBase64?: string;
  error?: string;
}

export interface PhysicPaintRenderedFrame {
  /** Generated sequence-local frame index. For still applies this is 0. */
  frameIndex: number;
  /** Editor timeline frame that should receive this rendered output. */
  appFrame: number;
  /** Rendered PNG output only. Editable stroke/engine state is never transported here. */
  dataUrl: string;
  width?: number;
  height?: number;
  /** Roto cache provenance; generated frames are render-only and never editable. */
  source?: PhysicPaintRotoFrameSource;
  nearestRealKeyFrame?: number;
}

export interface PhysicPaintApplyCanvasPayload {
  kind: 'apply-canvas';
  operationId: string;
  layerId: string;
  startFrame: number;
  sourceFrame?: number;
  displayFrame?: number;
  renderedFrame: PhysicPaintRenderedFrame;
  editableState?: SerializedProject;
  backgroundOnly?: boolean;
  onionDataUrl?: string;
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
  closeWindowAfterApply?: boolean;
}

export interface PhysicPaintDeleteRotoFramePayload {
  kind: 'delete-roto-frame';
  operationId: string;
  layerId: string;
  startFrame: number;
  sourceFrame?: number;
}

export interface PhysicPaintReplaceRotoKeyFramesPayload {
  kind: 'replace-roto-key-frames';
  operationId: string;
  layerId: string;
  startFrame: number;
  projectContextId?: string;
  frameCount?: number;
  expectedLayerEndExclusive?: number;
  expectedRotoRevision?: string;
  frames: PhysicPaintRotoCacheFrame[];
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
}

export interface PhysicPaintRotoAuthorityRequest {
  operationId: string;
  projectContextId: string;
  layerId: string;
  canonicalStart: number;
}

export interface PhysicPaintRotoAuthorityResult {
  operationId: string;
  ok: boolean;
  projectContextId: string;
  layerId: string;
  canonicalStart: number;
  layerEndExclusive: number;
  capacity: number;
  rotoRevision: string;
  frames: PhysicPaintRotoCacheFrame[];
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
  error?: string;
}

export interface PhysicPaintRotoAuthorityRequestMessage {
  type: 'physic-paint:roto-authority-request';
  payload: PhysicPaintRotoAuthorityRequest;
}

export interface PhysicPaintRotoAuthorityResultMessage {
  type: 'physic-paint:roto-authority-result';
  payload: PhysicPaintRotoAuthorityResult;
}

export interface PhysicPaintUpdateRotoInterpolationSettingsPayload {
  kind: 'update-roto-interpolation-settings';
  operationId: string;
  layerId: string;
  startFrame: number;
  settings: PhysicPaintRotoInterpolationSettings;
}

/**
 * Active apply payload for the generic acknowledged physical-edit
 * transaction (Plan 36.14-04 Task 3). Replaces the move-era use of
 * `replace-roto-key-frames` for the acknowledged move path; non-acknowledged
 * insert/delete/duplicate/paste operations continue to use
 * `replace-roto-key-frames` until Plans 36.14-06 through 36.14-08 migrate
 * them. The parent revalidates project/launch/layer identity, expected
 * revision, complete records, unique identity/frame placement, payload
 * ownership, capacity, interpolation, and selected identity before one
 * store replacement.
 */
export interface PhysicPaintReplaceRotoPhysicalMapPayload {
  kind: 'replace-roto-physical-map';
  operationId: string;
  operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  layerId: string;
  startFrame: number;
  launchOperationId: string;
  projectContextId?: string;
  expectedRevision: string;
  records: readonly PhysicPaintRotoPhysicalEditRecord[];
  interpolationEnabled: boolean;
  selectedKeyId: string | null;
  selectedAppFrame: number | null;
  /**
   * Replay provenance (Plan 36.14-05 Task 2). Required when `operationKind`
   * is `'undo'` or `'redo'`; forbidden for ordinary kinds. Carries the
   * original accepted operation ID, the replay direction, the source
   * revision (the original command's accepted `after` for undo, its
   * `before` for redo), and the target revision (the original command's
   * `before` for undo, its `after` for redo). The parent authority looks
   * up `historyCommandId` in its accepted-operation ledger and validates
   * both revisions against the stored canonical states before mutation.
   */
  historyProvenance?: PhysicPaintRotoPhysicalEditReplayProvenance;
}

export type PhysicPaintApplyPayload = PhysicPaintApplyCanvasPayload | PhysicPaintDeleteRotoFramePayload | PhysicPaintReplaceRotoKeyFramesPayload | PhysicPaintReplaceRotoPhysicalMapPayload | PhysicPaintUpdateRotoInterpolationSettingsPayload;

export interface PhysicPaintApplyResult {
  operationId: string;
  kind: PhysicPaintApplyKind;
  layerId: string;
  startFrame: number;
  appliedFrameCount: number;
  ok: boolean;
  error?: string;
}

export interface PhysicPaintApplyResultMessage {
  type: 'physic-paint:apply-result';
  payload: PhysicPaintApplyResult;
}

export type PhysicPaintScriptLibraryKind = 'scan' | 'save' | 'load' | 'rename' | 'delete';
export type PhysicPaintScriptLibraryRequest =
  | { kind: 'scan'; operationId: string }
  | { kind: 'save'; operationId: string; script: PersistedRotoScriptV1 }
  | { kind: 'load'; operationId: string; scriptId: string }
  | { kind: 'rename'; operationId: string; scriptId: string; expectedRevision: string; name: string }
  | { kind: 'delete'; operationId: string; scriptId: string; expectedRevision: string };

export interface PhysicPaintScriptLibraryDiagnostic {
  code: string;
  message: string;
  filename?: string;
}

export interface PhysicPaintScriptLibraryResult {
  operationId: string;
  kind: PhysicPaintScriptLibraryKind;
  ok: boolean;
  rows: RotoScriptLibraryRow[];
  skippedInvalidCount: number;
  diagnostics: PhysicPaintScriptLibraryDiagnostic[];
  script?: PersistedRotoScriptV1;
  error?: string;
}

export interface PhysicPaintScriptLibraryRequestMessage {
  type: 'physic-paint:script-library-request';
  payload: PhysicPaintScriptLibraryRequest;
}

export interface PhysicPaintScriptLibraryResultMessage {
  type: 'physic-paint:script-library-result';
  payload: PhysicPaintScriptLibraryResult;
}

export interface PhysicPaintReadinessState {
  ready: boolean;
  engineReady: boolean;
  canvasMounted: boolean;
  hasLaunchContext: boolean;
  bridgeAvailable: boolean;
  applying: boolean;
  missingReasons: string[];
  lastError?: string;
}

export function clampPhysicPaintFrameCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return PHYSIC_PAINT_DEFAULT_APPLY_FRAMES;
  const integer = Math.trunc(numeric);
  if (integer < PHYSIC_PAINT_MIN_APPLY_FRAMES) return PHYSIC_PAINT_MIN_APPLY_FRAMES;
  if (integer > PHYSIC_PAINT_MAX_APPLY_FRAMES) return PHYSIC_PAINT_MAX_APPLY_FRAMES;
  return integer;
}

export function isPhysicPaintLaunchContext(value: unknown): value is PhysicPaintLaunchContext {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.operationId) &&
    isNonEmptyString(value.layerId) &&
    optionalProjectContext(value.project) &&
    isNonNegativeInteger(value.startFrame) &&
    optionalNumber(value.width) &&
    optionalNumber(value.height) &&
    optionalPositiveNumber(value.fps) &&
    (value.editableState === undefined || isSerializedProject(value.editableState)) &&
    optionalRotoBackgroundMetadata(value.rotoBackground) &&
    optionalRotoCacheFrames(value.cachedRotoFrames) &&
    optionalRotoInterpolationSettings(value.rotoInterpolationSettings) &&
    optionalNonEmptyString(value.workflowLabel) &&
    (value.layerName === undefined || typeof value.layerName === 'string')
  );
}

export function isPhysicPaintFrameSyncMessage(value: unknown): value is PhysicPaintFrameSyncMessage {
  return Boolean(
    isRecord(value) &&
      value.type === 'physic-paint:seek-frame' &&
      isNonNegativeInteger(value.frame)
  );
}

export function isPhysicPaintApplyPayload(value: unknown): value is PhysicPaintApplyPayload {
  if (!isRecord(value) || containsForbiddenApplyField(value)) return false;

  if (!isBaseApplyPayload(value)) return false;


  if (value.kind === 'update-roto-interpolation-settings') {
    return isPhysicPaintRotoInterpolationSettings(value.settings);
  }

  if (value.kind === 'delete-roto-frame') return optionalNonNegativeInteger(value.sourceFrame);

  if (value.kind === 'replace-roto-key-frames') {
    return Array.isArray(value.frames) &&
      value.frames.every((frame) => isPhysicPaintRotoCacheFrame(frame) && frame.source === 'real-key') &&
      (value.projectContextId === undefined || isNonEmptyString(value.projectContextId)) &&
      (value.frameCount === undefined || optionalFrameCount(value.frameCount)) &&
      optionalNonNegativeInteger(value.expectedLayerEndExclusive) &&
      (value.expectedRotoRevision === undefined || isNonEmptyString(value.expectedRotoRevision)) &&
      optionalRotoBackgroundMetadata(value.rotoBackground) &&
      optionalRotoInterpolationSettings(value.rotoInterpolationSettings);
  }

  if (value.kind === 'apply-canvas') {
    const sourceFrame = typeof value.sourceFrame === 'number' ? value.sourceFrame : value.startFrame;
    return (value.editableState === undefined || isSerializedProject(value.editableState)) &&
      optionalNonNegativeInteger(value.sourceFrame) &&
      optionalNonNegativeInteger(value.displayFrame) &&
      isPhysicPaintRenderedFrame(value.renderedFrame, sourceFrame, 0) &&
      (value.backgroundOnly === undefined || typeof value.backgroundOnly === 'boolean') &&
      (value.onionDataUrl === undefined || isRenderedPngDataUrl(value.onionDataUrl)) &&
      optionalRotoBackgroundMetadata(value.rotoBackground) &&
      optionalRotoInterpolationSettings(value.rotoInterpolationSettings) &&
      (value.closeWindowAfterApply === undefined || typeof value.closeWindowAfterApply === 'boolean');
  }

  if (value.kind === 'replace-roto-physical-map') {
    const isReplay = value.operationKind === 'undo' || value.operationKind === 'redo';
    return isNonEmptyString(value.operationId)
      && (value.operationKind === 'insert-slot' || value.operationKind === 'delete-key' || value.operationKind === 'move-key' || value.operationKind === 'force-spacing' || value.operationKind === 'undo' || value.operationKind === 'redo')
      && isNonEmptyString(value.layerId)
      && isNonNegativeInteger(value.startFrame)
      && isNonEmptyString(value.launchOperationId)
      && (value.projectContextId === undefined || isNonEmptyString(value.projectContextId))
      && isNonEmptyString(value.expectedRevision)
      && Array.isArray(value.records)
      && value.records.every(isPhysicPaintRotoPhysicalEditRecord)
      && typeof value.interpolationEnabled === 'boolean'
      && (value.selectedKeyId === null || isNonEmptyString(value.selectedKeyId))
      && (value.selectedAppFrame === null || isNonNegativeInteger(value.selectedAppFrame))
      && (isReplay
        ? (isPhysicPaintRotoPhysicalEditReplayProvenance(value.historyProvenance)
          && value.historyProvenance.historyDirection === value.operationKind)
        : value.historyProvenance === undefined);
  }


  return false;
}

export function isPhysicPaintRotoCacheFrame(value: unknown): value is PhysicPaintRotoCacheFrame {
  if (!isPhysicPaintRenderedFrame(value)) return false;
  if (!isRecord(value)) return false;
  if (value.source !== 'real-key' && value.source !== 'generated-interpolation' && value.source !== 'background-only-support') return false;
  if (value.source === 'background-only-support' && value.backgroundOnly !== true) return false;
  if (!optionalNonNegativeInteger(value.nearestRealKeyFrame)) return false;
  if (!optionalNonNegativeInteger(value.sourceFrame)) return false;
  if (!optionalNonNegativeInteger(value.displayFrame)) return false;
  if (!optionalNonNegativeInteger(value.fromSourceFrame)) return false;
  if (!optionalNonNegativeInteger(value.toSourceFrame)) return false;
  if (value.interpolationT !== undefined && (typeof value.interpolationT !== 'number' || !Number.isFinite(value.interpolationT) || value.interpolationT < 0 || value.interpolationT > 1)) return false;
  if (value.onionDataUrl !== undefined && !isRenderedPngDataUrl(value.onionDataUrl)) return false;
  return value.backgroundOnly === undefined || typeof value.backgroundOnly === 'boolean';
}

export function isPhysicPaintRotoInterpolationSettings(value: unknown): value is PhysicPaintRotoInterpolationSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean' &&
    isRotoInBetweenFrameCount(value.inBetweenCount) &&
    (value.mode === 'duplicate' || value.mode === 'blend') &&
    isPercentInteger(value.deform) &&
    isPercentInteger(value.position) &&
    optionalRotoSegmentSpacingOverrides(value.segmentSpacingOverrides)
  );
}

export function normalizePhysicPaintRotoSegmentSpacingOverrides(value: unknown): PhysicPaintRotoSegmentSpacingOverride[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const overrides: PhysicPaintRotoSegmentSpacingOverride[] = [];
  for (const candidate of value) {
    if (!isPhysicPaintRotoSegmentSpacingOverride(candidate)) continue;
    const key = `${candidate.fromSourceFrame}:${candidate.toSourceFrame}`;
    if (seen.has(key)) continue;
    seen.add(key);
    overrides.push({
      fromSourceFrame: candidate.fromSourceFrame,
      toSourceFrame: candidate.toSourceFrame,
      inBetweenCount: candidate.inBetweenCount,
    });
  }
  return overrides.sort((a, b) => a.fromSourceFrame - b.fromSourceFrame || a.toSourceFrame - b.toSourceFrame);
}

export function isPhysicPaintRotoBackgroundMetadata(value: unknown): value is PhysicPaintRotoBackgroundMetadata {
  if (!isRecord(value)) return false;
  return (
    (value.background === 'transparent' || value.background === 'white' || value.background === 'canvas1' || value.background === 'canvas2' || value.background === 'canvas3') &&
    isNonEmptyString(value.paperGrain) &&
    typeof value.grainStrength === 'number' &&
    Number.isFinite(value.grainStrength) &&
    value.grainStrength >= 0 &&
    value.grainStrength <= 1 &&
    (value.color === undefined || typeof value.color === 'string')
  );
}

export function isPhysicPaintApplyResult(value: unknown): value is PhysicPaintApplyResult {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.operationId) &&
    (value.kind === 'apply-canvas' || value.kind === 'delete-roto-frame' || value.kind === 'replace-roto-key-frames' || value.kind === 'replace-roto-physical-map' || value.kind === 'update-roto-interpolation-settings') &&
    isNonEmptyString(value.layerId) &&
    isNonNegativeInteger(value.startFrame) &&
    isNonNegativeInteger(value.appliedFrameCount) &&
    typeof value.ok === 'boolean' &&
    (value.error === undefined || typeof value.error === 'string')
  );
}

export function isPhysicPaintApplyResultMessage(value: unknown): value is PhysicPaintApplyResultMessage {
  return Boolean(
    isRecord(value) &&
      value.type === 'physic-paint:apply-result' &&
      isPhysicPaintApplyResult(value.payload)
  );
}

export function isPhysicPaintThumbnailEncodeRequest(value: unknown): value is PhysicPaintThumbnailEncodeRequest {
  if (!isRecord(value) || !hasOnlyKeys(value, ['operationId', 'width', 'height', 'quality', 'rgbaBase64'])) return false;
  if (!isBoundedOperationId(value.operationId) || !isBoundedThumbnailDimension(value.width, 96) || !isBoundedThumbnailDimension(value.height, 64)) return false;
  if (typeof value.quality !== 'number' || !Number.isFinite(value.quality) || value.quality < 0.75 || value.quality > 0.85) return false;
  if (typeof value.rgbaBase64 !== 'string') return false;
  const expectedBytes = value.width * value.height * 4;
  return isCanonicalBase64ForByteLength(value.rgbaBase64, expectedBytes);
}

export function isPhysicPaintThumbnailEncodeResult(value: unknown): value is PhysicPaintThumbnailEncodeResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ['operationId', 'ok', 'width', 'height', 'mimeType', 'webpBase64', 'error'])) return false;
  if (!isBoundedOperationId(value.operationId) || typeof value.ok !== 'boolean') return false;
  if (!isBoundedThumbnailDimension(value.width, 96) || !isBoundedThumbnailDimension(value.height, 64) || value.mimeType !== 'image/webp') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (!value.ok) return value.webpBase64 === undefined && isNonEmptyString(value.error);
  return typeof value.webpBase64 === 'string' && isCanonicalBase64WithinLimit(value.webpBase64, 512 * 1024) && value.error === undefined;
}

export function isPhysicPaintScriptLibraryRequest(value: unknown): value is PhysicPaintScriptLibraryRequest {
  if (!isRecord(value) || !isNonEmptyString(value.operationId)) return false;
  if (value.kind === 'scan') return Object.keys(value).every((key) => key === 'kind' || key === 'operationId');
  if (value.kind === 'save') return Object.keys(value).every((key) => key === 'kind' || key === 'operationId' || key === 'script') && isPersistedRotoScriptV1(value.script);
  if (value.kind === 'load') return Object.keys(value).every((key) => key === 'kind' || key === 'operationId' || key === 'scriptId') && isCanonicalRotoScriptId(value.scriptId);
  if (value.kind === 'delete') return Object.keys(value).every((key) => key === 'kind' || key === 'operationId' || key === 'scriptId' || key === 'expectedRevision') && isCanonicalRotoScriptId(value.scriptId) && isNonEmptyString(value.expectedRevision);
  if (value.kind === 'rename') return Object.keys(value).every((key) => key === 'kind' || key === 'operationId' || key === 'scriptId' || key === 'expectedRevision' || key === 'name') && isCanonicalRotoScriptId(value.scriptId) && isNonEmptyString(value.expectedRevision) && normalizeRotoScriptName(value.name) !== null;
  return false;
}

export function isPhysicPaintScriptLibraryResult(value: unknown): value is PhysicPaintScriptLibraryResult {
  if (!isRecord(value) || !isNonEmptyString(value.operationId)) return false;
  if (value.kind !== 'scan' && value.kind !== 'save' && value.kind !== 'load' && value.kind !== 'rename' && value.kind !== 'delete') return false;
  if (typeof value.ok !== 'boolean' || !Array.isArray(value.rows) || !isNonNegativeInteger(value.skippedInvalidCount) || !Array.isArray(value.diagnostics)) return false;
  if (!value.rows.every(isScriptLibraryRow) || !value.diagnostics.every(isScriptLibraryDiagnostic)) return false;
  if (value.script !== undefined && !isPersistedRotoScriptV1(value.script)) return false;
  return value.error === undefined || typeof value.error === 'string';
}

export function isPhysicPaintScriptLibraryResultMessage(value: unknown): value is PhysicPaintScriptLibraryResultMessage {
  return Boolean(isRecord(value) && value.type === 'physic-paint:script-library-result' && isPhysicPaintScriptLibraryResult(value.payload));
}

function isScriptLibraryRow(value: unknown): value is RotoScriptLibraryRow {
  if (!isRecord(value) || !isCanonicalRotoScriptId(value.id) || !isNonEmptyString(value.revision) || normalizeRotoScriptName(value.name) === null) return false;
  if (!isNonEmptyString(value.createdAt) || !isNonEmptyString(value.updatedAt) || !isNonNegativeInteger(value.brushCount)) return false;
  return isRecord(value.source) && isRecord(value.thumbnail);
}

function isScriptLibraryDiagnostic(value: unknown): value is PhysicPaintScriptLibraryDiagnostic {
  return isRecord(value) && isNonEmptyString(value.code) && isNonEmptyString(value.message) && (value.filename === undefined || typeof value.filename === 'string');
}

function isBaseApplyPayload(value: Record<string, unknown>): value is Record<string, unknown> & {
  kind: PhysicPaintApplyKind;
  operationId: string;
  layerId: string;
  startFrame: number;
} {
  return (
    (value.kind === 'apply-canvas' || value.kind === 'delete-roto-frame' || value.kind === 'replace-roto-key-frames' || value.kind === 'replace-roto-physical-map' || value.kind === 'update-roto-interpolation-settings') &&
    isNonEmptyString(value.operationId) &&
    isNonEmptyString(value.layerId) &&
    isNonNegativeInteger(value.startFrame) &&
    optionalNonEmptyString(value.playScriptId) &&
    true
  );
}

export function isPhysicPaintRenderedFrame(value: unknown, expectedAppFrame?: number, expectedFrameIndex?: number): value is PhysicPaintRenderedFrame {
  if (!isRecord(value)) return false;
  if (!isNonNegativeInteger(value.frameIndex)) return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  if (expectedFrameIndex !== undefined && value.frameIndex !== expectedFrameIndex) return false;
  if (expectedAppFrame !== undefined && value.appFrame !== expectedAppFrame) return false;
  if (!isRenderedPngDataUrl(value.dataUrl)) return false;
  if (value.source !== undefined && value.source !== 'real-key' && value.source !== 'generated-interpolation' && value.source !== 'background-only-support') return false;
  return optionalNumber(value.width) && optionalNumber(value.height);
}

function containsForbiddenApplyField(value: Record<string, unknown>): boolean {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_APPLY_FIELDS.has(key)) return true;
  }
  return false;
}

export function isSerializedProject(value: unknown): value is SerializedProject {
  if (!isRecord(value)) return false;
  if (value.version !== 2) return false;
  if (typeof value.width !== 'number' || !Number.isFinite(value.width) || value.width <= 0) return false;
  if (typeof value.height !== 'number' || !Number.isFinite(value.height) || value.height <= 0) return false;
  if (!Array.isArray(value.strokes)) return false;
  if (!isRecord(value.settings)) return false;
  return value.strokes.every(isSerializedStroke);
}

function isSerializedStroke(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.tool !== 'string') return false;
  if (!Array.isArray(value.pts)) return false;
  if (value.color !== null && typeof value.color !== 'string') return false;
  if (!isRecord(value.params)) return false;
  if (typeof value.time !== 'number' || !Number.isFinite(value.time)) return false;
  if (value.playFrame !== undefined && !isNonNegativeInteger(value.playFrame)) return false;
  if (value.physicsMode !== undefined && value.physicsMode !== 'local' && value.physicsMode !== null) return false;
  return value.pts.every((point) => Array.isArray(point) && point.length === 7 && point.every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
}

function isRenderedPngDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(RENDERED_DATA_URL_PREFIX) && value.includes(',');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function isBoundedOperationId(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= 256 && !/[^\x20-\x7e]/.test(value);
}

function isBoundedThumbnailDimension(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;
}

function isCanonicalBase64ForByteLength(value: string, byteLength: number): boolean {
  const encodedLength = Math.ceil(byteLength / 3) * 4;
  if (value.length !== encodedLength || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  if (value.slice(0, -padding || undefined).includes('=')) return false;
  if (padding !== (3 - (byteLength % 3)) % 3) return false;
  try {
    const decoded = atob(value);
    if (decoded.length !== byteLength) return false;
    let binary = '';
    for (let index = 0; index < decoded.length; index += 1) binary += decoded[index];
    return btoa(binary) === value;
  } catch {
    return false;
  }
}

function isCanonicalBase64WithinLimit(value: string, maxBytes: number): boolean {
  if (value.length === 0 || value.length > Math.ceil(maxBytes / 3) * 4 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  if (value.slice(0, -padding || undefined).includes('=')) return false;
  const byteLength = (value.length / 4) * 3 - padding;
  return byteLength > 0 && byteLength <= maxBytes && isCanonicalBase64ForByteLength(value, byteLength);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function optionalPositiveNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function optionalProjectContext(value: unknown): boolean {
  return value === undefined || (isRecord(value) && isNonEmptyString(value.name) && typeof value.saved === 'boolean' && isNonEmptyString(value.contextId) && Object.keys(value).every((key) => key === 'name' || key === 'saved' || key === 'contextId'));
}

function optionalNonEmptyString(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}

function optionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || isNonNegativeInteger(value);
}

function optionalRotoCacheFrames(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((frame) => isPhysicPaintRotoCacheFrame(frame)));
}

function optionalRotoInterpolationSettings(value: unknown): boolean {
  return value === undefined || isPhysicPaintRotoInterpolationSettings(value);
}

function optionalRotoSegmentSpacingOverrides(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const candidate of value) {
    if (!isPhysicPaintRotoSegmentSpacingOverride(candidate)) return false;
    const key = `${candidate.fromSourceFrame}:${candidate.toSourceFrame}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function isPhysicPaintRotoSegmentSpacingOverride(value: unknown): value is PhysicPaintRotoSegmentSpacingOverride {
  if (!isRecord(value)) return false;
  if (!isNonNegativeInteger(value.fromSourceFrame)) return false;
  if (!isNonNegativeInteger(value.toSourceFrame)) return false;
  if (value.toSourceFrame <= value.fromSourceFrame) return false;
  return isRotoInBetweenFrameCount(value.inBetweenCount);
}

function optionalFrameCount(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= PHYSIC_PAINT_MIN_APPLY_FRAMES && value <= PHYSIC_PAINT_MAX_APPLY_FRAMES);
}

function optionalRotoBackgroundMetadata(value: unknown): value is PhysicPaintRotoBackgroundMetadata | undefined {
  return value === undefined || isPhysicPaintRotoBackgroundMetadata(value);
}

function isPercentInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isRotoInBetweenFrameCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PHYSIC_PAINT_MAX_APPLY_FRAMES;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
