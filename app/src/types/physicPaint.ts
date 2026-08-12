import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { FadeCurve } from './audio';
import type { PersistedRotoScriptV1, RotoScriptLibraryRow } from '../components/physic-paint/roto/physicsPaintRotoScriptSchema';
import { isCanonicalRotoScriptId, isPersistedRotoScriptV1, normalizeRotoScriptName } from '../components/physic-paint/roto/physicsPaintRotoScriptSchema';
import { getPhysicsPaintRotoSourceCycleId } from '../components/physic-paint/roto/physicsPaintRotoSpacingSelection';
import {
  isPhysicPaintRotoLoopClip,
  isPhysicPaintRotoRealKeyPayload,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoInterpolationMode,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

export type { PhysicPaintRotoInterpolationMode } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

export type PhysicPaintActionTransactionDirection = 'forward' | 'undo' | 'redo';
export type PhysicPaintActionTransactionMode = 'keep-groups' | 'delete-action-and-groups';
export type PhysicPaintActionHistoryReleaseReason = 'eviction' | 'redo-branch-truncation' | 'session-history-clear';

export interface PhysicPaintActionTransactionAuthority {
  readonly projectContextId: string;
  readonly layerId: string;
  readonly launchOperationId: string;
  readonly actionId: string;
  readonly expectedActionPresent: boolean;
  readonly expectedActionRevision: string;
  readonly expectedPhysicalRevision: string;
  readonly expectedPhysicalHash: string;
}

export interface PhysicPaintActionRetainedArtifactReference {
  readonly commandId: string;
  readonly generation: number;
  readonly actionId: string;
  readonly managedPath: string;
  readonly originalRevision: string;
  readonly integritySha256: string;
}

export interface PhysicPaintActionTransactionTarget {
  readonly physicalRevision: string;
  readonly physicalHash: string;
  readonly physicalDocument: PhysicPaintRotoPhysicalDocument;
  readonly selectedGroupId: string | null;
  readonly cursorAppFrame: number;
}

export interface PhysicPaintActionTransactionPrepareRequest {
  readonly token: string;
  readonly commandId: string;
  readonly generation: number;
  readonly operationId: string;
  readonly leaseToken: string;
  readonly direction: PhysicPaintActionTransactionDirection;
  readonly mode: PhysicPaintActionTransactionMode;
  readonly authority: PhysicPaintActionTransactionAuthority;
  readonly impactDigest: string;
  readonly retainedArtifact: PhysicPaintActionRetainedArtifactReference;
  readonly target: PhysicPaintActionTransactionTarget;
}

export interface PhysicPaintActionTransactionTokenRequest {
  readonly token: string;
}

export interface PhysicPaintActionTransactionAcknowledgeRequest {
  readonly token: string;
  readonly commandId: string;
  readonly generation: number;
  readonly operationId: string;
  readonly leaseToken: string;
  readonly direction: PhysicPaintActionTransactionDirection;
}

export interface PhysicPaintActionHistoryReleaseRequest {
  readonly projectContextId: string;
  readonly launchOperationId: string;
  readonly commandId: string;
  readonly generation: number;
  readonly reason: PhysicPaintActionHistoryReleaseReason;
}

export type PhysicPaintActionTransactionFailureCode =
  | 'active-recovery-blocked'
  | 'invoke-failed'
  | 'malformed-response'
  | 'correlation-mismatch'
  | 'transaction-failed';

export interface PhysicPaintActionTransactionFailure {
  readonly state: 'failed';
  readonly code: PhysicPaintActionTransactionFailureCode;
  readonly error: string;
}

export type PhysicPaintActionTransactionRecord = PhysicPaintActionTransactionPrepareRequest & {
  readonly schemaVersion: 1;
  readonly state: 'prepared' | 'committed' | 'recovery-required';
};

export interface PhysicPaintActionRecoveredPreparedResult {
  readonly state: 'recovered-prepared';
  readonly token: string;
  readonly actionPresent: boolean;
}

export interface PhysicPaintActionTransactionCleanupPendingResult extends PhysicPaintActionTransactionAcknowledgeRequest {
  readonly schemaVersion: 1;
  readonly state: 'cleanup-pending';
}

export interface PhysicPaintActionTransactionAcknowledgedReceipt extends PhysicPaintActionTransactionAcknowledgeRequest {
  readonly schemaVersion: 1;
  readonly state: 'acknowledged';
}

export interface PhysicPaintActionTransactionAcknowledgedResult extends PhysicPaintActionTransactionAcknowledgeRequest {
  readonly state: 'acknowledged';
  readonly cleaned: boolean;
}

export interface PhysicPaintActionHistoryCleanupPendingResult extends PhysicPaintActionHistoryReleaseRequest {
  readonly schemaVersion: 1;
  readonly state: 'cleanup-pending';
}

export interface PhysicPaintActionHistoryReleasedResult extends PhysicPaintActionHistoryReleaseRequest {
  readonly state: 'released';
  readonly released: boolean;
}

export interface PhysicPaintActionRetainedArtifactStatus extends PhysicPaintActionRetainedArtifactReference {
  readonly schemaVersion: 1;
  readonly state: 'retained';
  readonly projectContextId: string;
  readonly launchOperationId: string;
  readonly byteLength: number;
}

export type PhysicPaintActionTransactionResult =
  | PhysicPaintActionTransactionRecord
  | PhysicPaintActionRecoveredPreparedResult
  | PhysicPaintActionTransactionCleanupPendingResult
  | PhysicPaintActionTransactionAcknowledgedReceipt
  | PhysicPaintActionTransactionAcknowledgedResult
  | PhysicPaintActionHistoryCleanupPendingResult
  | PhysicPaintActionHistoryReleasedResult
  | PhysicPaintActionRetainedArtifactStatus
  | PhysicPaintActionTransactionFailure;

const ACTION_TRANSACTION_PREPARE_KEYS = [
  'token', 'commandId', 'generation', 'operationId', 'leaseToken', 'direction',
  'mode', 'authority', 'impactDigest', 'retainedArtifact', 'target',
] as const;

function isPhysicPaintActionTransactionDirection(value: unknown): value is PhysicPaintActionTransactionDirection {
  return value === 'forward' || value === 'undo' || value === 'redo';
}

function isPhysicPaintActionTransactionMode(value: unknown): value is PhysicPaintActionTransactionMode {
  return value === 'keep-groups' || value === 'delete-action-and-groups';
}

function isPhysicPaintActionHistoryReleaseReason(value: unknown): value is PhysicPaintActionHistoryReleaseReason {
  return value === 'eviction' || value === 'redo-branch-truncation' || value === 'session-history-clear';
}

function isActionTransactionText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    });
}

function isActionTransactionToken(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function isActionTransactionGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isActionTransactionSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value);
}

function isPhysicPaintActionTransactionAuthority(value: unknown): value is PhysicPaintActionTransactionAuthority {
  return isRecord(value)
    && hasOnlyKeys(value, [
      'projectContextId', 'layerId', 'launchOperationId', 'actionId',
      'expectedActionPresent', 'expectedActionRevision', 'expectedPhysicalRevision',
      'expectedPhysicalHash',
    ])
    && isActionTransactionText(value.projectContextId)
    && isActionTransactionText(value.layerId)
    && isActionTransactionText(value.launchOperationId)
    && isActionTransactionText(value.actionId)
    && typeof value.expectedActionPresent === 'boolean'
    && isActionTransactionText(value.expectedActionRevision)
    && isActionTransactionText(value.expectedPhysicalRevision)
    && isActionTransactionText(value.expectedPhysicalHash);
}

function isPhysicPaintActionRetainedArtifactReference(value: unknown): value is PhysicPaintActionRetainedArtifactReference {
  return isRecord(value)
    && hasOnlyKeys(value, ['commandId', 'generation', 'actionId', 'managedPath', 'originalRevision', 'integritySha256'])
    && isActionTransactionText(value.commandId)
    && isActionTransactionGeneration(value.generation)
    && isActionTransactionText(value.actionId)
    && value.managedPath === `scripts/${value.actionId}.efx-roto-script.json`
    && isActionTransactionText(value.originalRevision)
    && isActionTransactionSha256(value.integritySha256);
}

function isPhysicPaintActionTransactionTarget(value: unknown): value is PhysicPaintActionTransactionTarget {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ['physicalRevision', 'physicalHash', 'physicalDocument', 'selectedGroupId', 'cursorAppFrame'])
    || !isActionTransactionText(value.physicalRevision)
    || !isActionTransactionText(value.physicalHash)
    || (value.selectedGroupId !== null && !isActionTransactionText(value.selectedGroupId))
    || !isNonNegativeInteger(value.cursorAppFrame)) return false;
  try {
    const physicalDocument = parsePhysicPaintRotoPhysicalDocument(value.physicalDocument);
    return value.physicalRevision === physicalDocument.revision
      && value.cursorAppFrame === physicalDocument.cursorAppFrame;
  } catch {
    return false;
  }
}

export function isPhysicPaintActionTransactionPrepareRequest(value: unknown): value is PhysicPaintActionTransactionPrepareRequest {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ACTION_TRANSACTION_PREPARE_KEYS)
    || !isActionTransactionToken(value.token)
    || !isActionTransactionText(value.commandId)
    || !isActionTransactionGeneration(value.generation)
    || !isActionTransactionText(value.operationId)
    || !isActionTransactionText(value.leaseToken)
    || !isPhysicPaintActionTransactionDirection(value.direction)
    || !isPhysicPaintActionTransactionMode(value.mode)
    || !isPhysicPaintActionTransactionAuthority(value.authority)
    || !isActionTransactionSha256(value.impactDigest)
    || !isPhysicPaintActionRetainedArtifactReference(value.retainedArtifact)
    || !isPhysicPaintActionTransactionTarget(value.target)) return false;
  const expectedActionPresent = value.direction !== 'undo';
  return value.authority.expectedActionPresent === expectedActionPresent
    && value.retainedArtifact.commandId === value.commandId
    && value.retainedArtifact.generation === value.generation
    && value.retainedArtifact.actionId === value.authority.actionId
    && value.retainedArtifact.originalRevision === value.authority.expectedActionRevision;
}

export function isPhysicPaintActionTransactionTokenRequest(value: unknown): value is PhysicPaintActionTransactionTokenRequest {
  return isRecord(value) && hasOnlyKeys(value, ['token']) && isActionTransactionToken(value.token);
}

export function isPhysicPaintActionTransactionAcknowledgeRequest(value: unknown): value is PhysicPaintActionTransactionAcknowledgeRequest {
  return isRecord(value)
    && hasOnlyKeys(value, ['token', 'commandId', 'generation', 'operationId', 'leaseToken', 'direction'])
    && isActionTransactionToken(value.token)
    && isActionTransactionText(value.commandId)
    && isActionTransactionGeneration(value.generation)
    && isActionTransactionText(value.operationId)
    && isActionTransactionText(value.leaseToken)
    && isPhysicPaintActionTransactionDirection(value.direction);
}

export function isPhysicPaintActionHistoryReleaseRequest(value: unknown): value is PhysicPaintActionHistoryReleaseRequest {
  return isRecord(value)
    && hasOnlyKeys(value, ['projectContextId', 'launchOperationId', 'commandId', 'generation', 'reason'])
    && isActionTransactionText(value.projectContextId)
    && isActionTransactionText(value.launchOperationId)
    && isActionTransactionText(value.commandId)
    && isActionTransactionGeneration(value.generation)
    && isPhysicPaintActionHistoryReleaseReason(value.reason);
}

export function isPhysicPaintActionRetainedArtifactStatus(value: unknown): value is PhysicPaintActionRetainedArtifactStatus {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'schemaVersion', 'state', 'projectContextId', 'launchOperationId', 'commandId',
    'generation', 'actionId', 'managedPath', 'originalRevision', 'integritySha256', 'byteLength',
  ])) return false;
  return value.schemaVersion === 1
    && value.state === 'retained'
    && isActionTransactionText(value.projectContextId)
    && isActionTransactionText(value.launchOperationId)
    && isPhysicPaintActionRetainedArtifactReference({
      commandId: value.commandId,
      generation: value.generation,
      actionId: value.actionId,
      managedPath: value.managedPath,
      originalRevision: value.originalRevision,
      integritySha256: value.integritySha256,
    })
    && isActionTransactionGeneration(value.byteLength);
}

function isPhysicPaintActionTransactionFailure(value: Record<string, unknown>): value is Record<string, unknown> & PhysicPaintActionTransactionFailure {
  return hasOnlyKeys(value, ['state', 'code', 'error'])
    && value.state === 'failed'
    && (value.code === 'active-recovery-blocked'
      || value.code === 'invoke-failed'
      || value.code === 'malformed-response'
      || value.code === 'correlation-mismatch'
      || value.code === 'transaction-failed')
    && isNonEmptyString(value.error);
}

export function isPhysicPaintActionTransactionResult(value: unknown): value is PhysicPaintActionTransactionResult {
  if (!isRecord(value) || typeof value.state !== 'string') return false;
  if (value.state === 'prepared' || value.state === 'committed' || value.state === 'recovery-required') {
    const { schemaVersion, state: _state, ...request } = value;
    return schemaVersion === 1 && isPhysicPaintActionTransactionPrepareRequest(request);
  }
  if (value.state === 'recovered-prepared') {
    return hasOnlyKeys(value, ['state', 'token', 'actionPresent'])
      && isActionTransactionToken(value.token)
      && typeof value.actionPresent === 'boolean';
  }
  if (value.state === 'cleanup-pending') {
    if (hasOnlyKeys(value, ['schemaVersion', 'state', 'token', 'commandId', 'generation', 'operationId', 'leaseToken', 'direction'])) {
      const { schemaVersion, state: _state, ...request } = value;
      return schemaVersion === 1 && isPhysicPaintActionTransactionAcknowledgeRequest(request);
    }
    if (hasOnlyKeys(value, ['schemaVersion', 'state', 'projectContextId', 'launchOperationId', 'commandId', 'generation', 'reason'])) {
      const { schemaVersion, state: _state, ...request } = value;
      return schemaVersion === 1 && isPhysicPaintActionHistoryReleaseRequest(request);
    }
    return false;
  }
  if (value.state === 'acknowledged') {
    if (hasOnlyKeys(value, ['schemaVersion', 'state', 'token', 'commandId', 'generation', 'operationId', 'leaseToken', 'direction'])) {
      const { schemaVersion, state: _state, ...request } = value;
      return schemaVersion === 1 && isPhysicPaintActionTransactionAcknowledgeRequest(request);
    }
    const { state: _state, cleaned, ...request } = value;
    return typeof cleaned === 'boolean' && isPhysicPaintActionTransactionAcknowledgeRequest(request);
  }
  if (value.state === 'released') {
    const { state: _state, released, ...request } = value;
    return typeof released === 'boolean' && isPhysicPaintActionHistoryReleaseRequest(request);
  }
  if (value.state === 'retained') return isPhysicPaintActionRetainedArtifactStatus(value);
  if (value.state === 'failed') return isPhysicPaintActionTransactionFailure(value);
  return false;
}

export const PHYSIC_PAINT_MAX_APPLY_FRAMES = 600;
export const PHYSIC_PAINT_DEFAULT_APPLY_FRAMES = 4;

export const PHYSIC_PAINT_MIN_APPLY_FRAMES = 1;

/** Transport-safe target for one ordinary physical key move. */
export type PhysicPaintRotoPhysicalEditTarget =
  | { readonly kind: 'physical-cell'; readonly appFrame: number }
  | { readonly kind: 'before-key'; readonly targetKeyId: string }
  | { readonly kind: 'after-key'; readonly targetKeyId: string };

/** Ordered authorization for one linked source-cycle spacing group. */
export interface PhysicPaintRotoLinkedSourceSpacingScope {
  readonly sourceCycleId: string;
  readonly sourceKeyIds: readonly string[];
  readonly selectedSourceKeyIds: readonly string[];
}

/**
 * Closed transport-safe authorization request for every ordinary physical edit.
 * This standalone contract is intentionally not part of the active apply payload
 * until the producer/consumer activation cutover.
 */
export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | {
      readonly kind: 'insert-empty-segment';
      readonly destinationAppFrame: number;
      readonly insertedKeyId: string;
      readonly blankPayload: PhysicPaintRotoRealKeyPayload;
    }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key-group'; readonly keyIds: readonly string[] }
  | {
      readonly kind: 'move-key';
      readonly movedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    }
  | {
      readonly kind: 'move-key-group';
      readonly movedKeyIds: readonly string[];
      readonly grabbedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    }
  | {
      readonly kind: 'force-spacing';
      readonly emptyFrames: number;
      readonly selectedKeyId: string | null;
      readonly scopeKeyIds?: readonly string[] | null;
      readonly linkedSourceSpacingScopes?: readonly PhysicPaintRotoLinkedSourceSpacingScope[] | null;
    }
  | {
      readonly kind: 'duplicate-key';
      readonly sourceKeyId: string;
      readonly newKeyId: string;
    }
  | {
      readonly kind: 'paste-key';
      readonly destinationAppFrame: number;
      readonly destinationKeyId: string | null;
      readonly newKeyId: string | null;
      readonly clipboardPayload: PhysicPaintRotoRealKeyPayload;
    }
  | {
      readonly kind: 'paste-key-group';
      readonly destinationAppFrame: number;
      readonly entries: readonly {
        readonly payload: PhysicPaintRotoRealKeyPayload;
        readonly sourceAppFrame: number;
        readonly sourceKeyId: string;
        readonly newKeyId: string;
      }[];
    };

function hasUniqueBoundedPhysicalKeyIds(value: unknown, minimumLength = 1): value is readonly string[] {
  return Array.isArray(value)
    && value.length >= minimumLength
    && value.length <= PHYSIC_PAINT_MAX_APPLY_FRAMES
    && value.every(isBoundedPhysicalKeyId)
    && new Set(value).size === value.length;
}

function isPhysicPaintRotoPhysicalEditTarget(value: unknown): value is PhysicPaintRotoPhysicalEditTarget {
  if (!isRecord(value)) return false;
  if (value.kind === 'physical-cell') {
    return hasOnlyKeys(value, ['kind', 'appFrame']) && isNonNegativeInteger(value.appFrame);
  }
  if (value.kind === 'before-key' || value.kind === 'after-key') {
    return hasOnlyKeys(value, ['kind', 'targetKeyId']) && isBoundedPhysicalKeyId(value.targetKeyId);
  }
  return false;
}

function isPhysicPaintRotoLinkedSourceSpacingScopes(
  value: unknown,
  scopeKeyIds: unknown,
): value is readonly PhysicPaintRotoLinkedSourceSpacingScope[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > PHYSIC_PAINT_MAX_APPLY_FRAMES) return false;
  const seenCycleIds = new Set<string>();
  const seenSelectedKeyIds = new Set<string>();
  const flattenedSelectedKeyIds: string[] = [];
  for (const scope of value) {
    if (!isRecord(scope) || !hasOnlyKeys(scope, ['sourceCycleId', 'sourceKeyIds', 'selectedSourceKeyIds'])) return false;
    const sourceKeyIds = scope.sourceKeyIds;
    const selectedSourceKeyIds = scope.selectedSourceKeyIds;
    if (!hasUniqueBoundedPhysicalKeyIds(sourceKeyIds, 2)) return false;
    if (!hasUniqueBoundedPhysicalKeyIds(selectedSourceKeyIds, 2)) return false;
    const sourceCycleId = getPhysicsPaintRotoSourceCycleId(sourceKeyIds);
    if (scope.sourceCycleId !== sourceCycleId || seenCycleIds.has(sourceCycleId)) return false;
    const selectedSet = new Set(selectedSourceKeyIds);
    const orderedSelectedKeyIds = sourceKeyIds.filter((keyId) => selectedSet.has(keyId));
    if (orderedSelectedKeyIds.length !== selectedSourceKeyIds.length
      || orderedSelectedKeyIds.some((keyId, index) => keyId !== selectedSourceKeyIds[index])) return false;
    if (selectedSourceKeyIds.some((keyId) => seenSelectedKeyIds.has(keyId))) return false;
    seenCycleIds.add(sourceCycleId);
    selectedSourceKeyIds.forEach((keyId) => {
      seenSelectedKeyIds.add(keyId);
      flattenedSelectedKeyIds.push(keyId);
    });
  }
  return hasUniqueBoundedPhysicalKeyIds(scopeKeyIds)
    && scopeKeyIds.length === flattenedSelectedKeyIds.length
    && scopeKeyIds.every((keyId, index) => keyId === flattenedSelectedKeyIds[index]);
}

function isPhysicPaintRotoPasteKeyGroupEntries(value: unknown): value is Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key-group' }>['entries'] {
  if (!Array.isArray(value) || value.length < 2 || value.length > PHYSIC_PAINT_MAX_APPLY_FRAMES) return false;
  const sourceKeyIds = new Set<string>();
  const newKeyIds = new Set<string>();
  let previousSourceAppFrame = -1;
  for (const entry of value) {
    if (!isRecord(entry) || !hasOnlyKeys(entry, ['payload', 'sourceAppFrame', 'sourceKeyId', 'newKeyId'])) return false;
    if (!isPhysicPaintRotoRealKeyPayload(entry.payload)) return false;
    if (!isNonNegativeInteger(entry.sourceAppFrame) || entry.sourceAppFrame <= previousSourceAppFrame) return false;
    if (!isBoundedPhysicalKeyId(entry.sourceKeyId) || !isBoundedPhysicalKeyId(entry.newKeyId)) return false;
    if (sourceKeyIds.has(entry.sourceKeyId) || newKeyIds.has(entry.newKeyId)) return false;
    sourceKeyIds.add(entry.sourceKeyId);
    newKeyIds.add(entry.newKeyId);
    previousSourceAppFrame = entry.sourceAppFrame;
  }
  return true;
}

/** Strict standalone parser for every ordinary physical-edit authorization request. */
export function isPhysicPaintRotoPhysicalEditIntent(value: unknown): value is PhysicPaintRotoPhysicalEditIntent {
  if (!isRecord(value)) return false;
  if (value.kind === 'insert-slot' || value.kind === 'delete-key') {
    return hasOnlyKeys(value, ['kind', 'selectedKeyId']) && isBoundedPhysicalKeyId(value.selectedKeyId);
  }
  if (value.kind === 'insert-empty-segment') {
    return hasOnlyKeys(value, ['kind', 'destinationAppFrame', 'insertedKeyId', 'blankPayload'])
      && isNonNegativeInteger(value.destinationAppFrame)
      && isBoundedPhysicalKeyId(value.insertedKeyId)
      && isPhysicPaintRotoRealKeyPayload(value.blankPayload);
  }
  if (value.kind === 'delete-key-group') {
    return hasOnlyKeys(value, ['kind', 'keyIds']) && hasUniqueBoundedPhysicalKeyIds(value.keyIds);
  }
  if (value.kind === 'move-key') {
    return hasOnlyKeys(value, ['kind', 'movedKeyId', 'target'])
      && isBoundedPhysicalKeyId(value.movedKeyId)
      && isPhysicPaintRotoPhysicalEditTarget(value.target);
  }
  if (value.kind === 'move-key-group') {
    return hasOnlyKeys(value, ['kind', 'movedKeyIds', 'grabbedKeyId', 'target'])
      && hasUniqueBoundedPhysicalKeyIds(value.movedKeyIds)
      && isBoundedPhysicalKeyId(value.grabbedKeyId)
      && value.movedKeyIds.includes(value.grabbedKeyId)
      && isPhysicPaintRotoPhysicalEditTarget(value.target);
  }
  if (value.kind === 'force-spacing') {
    if (!hasOnlyKeys(value, ['kind', 'emptyFrames', 'selectedKeyId', 'scopeKeyIds', 'linkedSourceSpacingScopes'])) return false;
    if (!isNonNegativeInteger(value.emptyFrames)) return false;
    if (value.selectedKeyId !== null && !isBoundedPhysicalKeyId(value.selectedKeyId)) return false;
    if (value.scopeKeyIds !== undefined && value.scopeKeyIds !== null && !hasUniqueBoundedPhysicalKeyIds(value.scopeKeyIds)) return false;
    if (value.linkedSourceSpacingScopes === undefined || value.linkedSourceSpacingScopes === null) return true;
    return isPhysicPaintRotoLinkedSourceSpacingScopes(value.linkedSourceSpacingScopes, value.scopeKeyIds);
  }
  if (value.kind === 'duplicate-key') {
    return hasOnlyKeys(value, ['kind', 'sourceKeyId', 'newKeyId'])
      && isBoundedPhysicalKeyId(value.sourceKeyId)
      && isBoundedPhysicalKeyId(value.newKeyId)
      && value.sourceKeyId !== value.newKeyId;
  }
  if (value.kind === 'paste-key') {
    if (!hasOnlyKeys(value, ['kind', 'destinationAppFrame', 'destinationKeyId', 'newKeyId', 'clipboardPayload'])) return false;
    if (!isNonNegativeInteger(value.destinationAppFrame) || !isPhysicPaintRotoRealKeyPayload(value.clipboardPayload)) return false;
    if (value.destinationKeyId !== null && !isBoundedPhysicalKeyId(value.destinationKeyId)) return false;
    if (value.newKeyId !== null && !isBoundedPhysicalKeyId(value.newKeyId)) return false;
    return (value.destinationKeyId === null) !== (value.newKeyId === null);
  }
  if (value.kind === 'paste-key-group') {
    return hasOnlyKeys(value, ['kind', 'destinationAppFrame', 'entries'])
      && isNonNegativeInteger(value.destinationAppFrame)
      && isPhysicPaintRotoPasteKeyGroupEntries(value.entries);
  }
  return false;
}

function canonicalPhysicalEditPayload(payload: PhysicPaintRotoRealKeyPayload): PhysicPaintRotoRealKeyPayload {
  return payload.width === undefined
    ? { frameIndex: payload.frameIndex, appFrame: payload.appFrame, dataUrl: payload.dataUrl }
    : { frameIndex: payload.frameIndex, appFrame: payload.appFrame, dataUrl: payload.dataUrl, width: payload.width, height: payload.height };
}

function canonicalPhysicalEditTarget(target: PhysicPaintRotoPhysicalEditTarget): PhysicPaintRotoPhysicalEditTarget {
  return target.kind === 'physical-cell'
    ? { kind: 'physical-cell', appFrame: target.appFrame }
    : { kind: target.kind, targetKeyId: target.targetKeyId };
}

/** Canonical stable JSON serialization for one validated ordinary edit intent. */
export function serializePhysicPaintRotoPhysicalEditIntent(intent: PhysicPaintRotoPhysicalEditIntent): string {
  if (!isPhysicPaintRotoPhysicalEditIntent(intent)) {
    throw new Error('PhysicPaintRotoPhysicalEditIntent: malformed intent.');
  }
  switch (intent.kind) {
    case 'insert-slot':
    case 'delete-key':
      return JSON.stringify({ kind: intent.kind, selectedKeyId: intent.selectedKeyId });
    case 'insert-empty-segment':
      return JSON.stringify({ kind: intent.kind, destinationAppFrame: intent.destinationAppFrame, insertedKeyId: intent.insertedKeyId, blankPayload: canonicalPhysicalEditPayload(intent.blankPayload) });
    case 'delete-key-group':
      return JSON.stringify({ kind: intent.kind, keyIds: [...intent.keyIds] });
    case 'move-key':
      return JSON.stringify({ kind: intent.kind, movedKeyId: intent.movedKeyId, target: canonicalPhysicalEditTarget(intent.target) });
    case 'move-key-group':
      return JSON.stringify({ kind: intent.kind, movedKeyIds: [...intent.movedKeyIds], grabbedKeyId: intent.grabbedKeyId, target: canonicalPhysicalEditTarget(intent.target) });
    case 'force-spacing': {
      const canonical: Record<string, unknown> = { kind: intent.kind, emptyFrames: intent.emptyFrames, selectedKeyId: intent.selectedKeyId };
      if (intent.scopeKeyIds !== undefined) canonical.scopeKeyIds = intent.scopeKeyIds === null ? null : [...intent.scopeKeyIds];
      if (intent.linkedSourceSpacingScopes !== undefined) {
        canonical.linkedSourceSpacingScopes = intent.linkedSourceSpacingScopes === null
          ? null
          : intent.linkedSourceSpacingScopes.map((scope) => ({
              sourceCycleId: scope.sourceCycleId,
              sourceKeyIds: [...scope.sourceKeyIds],
              selectedSourceKeyIds: [...scope.selectedSourceKeyIds],
            }));
      }
      return JSON.stringify(canonical);
    }
    case 'duplicate-key':
      return JSON.stringify({ kind: intent.kind, sourceKeyId: intent.sourceKeyId, newKeyId: intent.newKeyId });
    case 'paste-key':
      return JSON.stringify({ kind: intent.kind, destinationAppFrame: intent.destinationAppFrame, destinationKeyId: intent.destinationKeyId, newKeyId: intent.newKeyId, clipboardPayload: canonicalPhysicalEditPayload(intent.clipboardPayload) });
    case 'paste-key-group':
      return JSON.stringify({
        kind: intent.kind,
        destinationAppFrame: intent.destinationAppFrame,
        entries: intent.entries.map((entry) => ({
          payload: canonicalPhysicalEditPayload(entry.payload),
          sourceAppFrame: entry.sourceAppFrame,
          sourceKeyId: entry.sourceKeyId,
          newKeyId: entry.newKeyId,
        })),
      });
  }
}

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
// - D-09: the request carries the complete immutable final records, canonical
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
 * kinds only. Plan 36.14-22 adds the non-history canonical interpolation
 * operations to that same acknowledged envelope. Phase 37 adds the group
 * kinds `move-key-group` and `delete-key-group`; they ride the same generic
 * acknowledged envelope as ordinary mapping-only edits with no semantic
 * delta and no multi-selection field crossing the bridge.
 */
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'insert-empty-segment'
  | 'delete-key'
  | 'delete-key-group'
  | 'move-key'
  | 'move-key-group'
  | 'force-spacing'
  | 'duplicate-key'
  | 'paste-key'
  | 'paste-key-group'
  | 'play-script'
  | 'paint-group-frame'
  | 'delete-group-frame'
  | 'delete-group'
  | 'regenerate-group'
  | 'detach-action-groups'
  | 'delete-action-groups'
  | 'set-interpolation-enabled'
  | 'set-interpolation-mode'
  | 'undo'
  | 'redo';

/**
 * Declared semantic delta for ordinary identity/payload-changing edits.
 * The parent validates this declaration against its authoritative current
 * records and the submitted complete next records before mutation.
 */
export type PhysicPaintRotoPhysicalEditSemanticDelta =
  | {
      readonly kind: 'insert-empty-segment';
      readonly insertedKeyId: string;
      readonly destinationAppFrame: number;
    }
  | {
      readonly kind: 'duplicate-key';
      readonly sourceKeyId: string;
      readonly newKeyId: string;
    }
  | {
      readonly kind: 'paste-key';
      readonly destinationAppFrame: number;
      readonly destinationKeyId: string | null;
      readonly newKeyId: string | null;
      readonly clipboardPayload: PhysicPaintRotoPhysicalEditRecord['payload'];
    }
  | {
      readonly kind: 'paste-key-group';
      readonly destinationAppFrame: number;
      readonly entries: readonly {
        readonly payload: PhysicPaintRotoPhysicalEditRecord['payload'];
        readonly sourceAppFrame: number;
        readonly sourceKeyId: string;
        readonly newKeyId: string;
      }[];
    }
  | {
      readonly kind: 'play-script';
      readonly affectedStartAppFrame: number;
      readonly affectedEndAppFrame: number;
      readonly expectedLayerCapacity: number;
      readonly expectedLayerEndExclusive: number;
      readonly proposedRecords: readonly PhysicPaintRotoPhysicalEditRecord[];
      readonly freshKeyIds: readonly string[];
      /**
       * Phase 43-06 loop-only declaration (D-01/D-03/D-05/D-10/D-31): the op
       * changes ONLY the Loop Clip collection (payload.loopClips required) and
       * leaves every physical record byte-identical. Encoded as the empty
       * affected range `affectedEndAppFrame === affectedStartAppFrame - 1`
       * anchored at the loop's placement start; freshKeyIds is empty.
       */
      readonly loopOnly?: true;
      /**
       * Phase 43-06 source-edit/repair regeneration (D-02/D-31): records
       * change inside the affected range but the op was opened from a Loop
       * Clip, not from a timeline selection at the start — the current
       * selection is preserved instead of selecting the range start.
       */
      readonly preserveSelection?: true;
    }
  | {
      readonly kind: 'paint-group-frame';
      readonly groupId: string;
      readonly appFrame: number;
      readonly phaseAppFrame: number;
      readonly affectedAppFrames: readonly number[];
      readonly overrideKeyId: string;
      readonly createdOverride: boolean;
      readonly filledDeletedOccurrence: boolean;
      readonly previousRevision: string;
      readonly nextRevision: string;
    }
  | {
      readonly kind: 'delete-group-frame';
      readonly groupId: string;
      readonly appFrame: number;
      readonly phaseAppFrame: number;
      readonly affectedAppFrames: readonly number[];
      readonly cleanupKeyIds: readonly string[];
      readonly previousRevision: string;
      readonly nextRevision: string;
    }
  | {
      readonly kind: 'delete-group';
      readonly groupId: string;
      readonly cleanupKeyIds: readonly string[];
      readonly previousRevision: string;
      readonly nextRevision: string;
    }
  | {
      readonly kind: 'regenerate-group';
      readonly groupId: string;
      readonly expectedActionRevision: string;
      readonly cleanupKeyIds: readonly string[];
      readonly previousRevision: string;
      readonly nextRevision: string;
    }
  | {
      readonly kind: 'detach-action-groups' | 'delete-action-groups';
      readonly actionId: string;
      readonly expectedActionRevision: string;
      readonly affectedGroupIds: readonly string[];
      readonly cleanupKeyIds: readonly string[];
      readonly previousRevision: string;
      readonly nextRevision: string;
    };

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
 * Active generic physical-edit apply payload for the closed
 * `replace-roto-physical-map` branch.
 *
 * Per D-09: the request carries operation ID, operation kind, layer,
 * launch/project context identity, expected revision, immutable complete
 * final records, canonical interpolation state, selected `keyId | null`,
 * and selected direct `appFrame`. The parent independently revalidates every
 * field before one store replacement.
 *
 * Per D-05/D-06/D-08/D-09 (Plan 36.14-05 Task 2): the request carries
 * `historyProvenance` only when `operationKind` is `'undo'` or `'redo'`,
 * and the parent revalidates it against the accepted-operation ledger
 * before authorizing an identity-set replay.
 *
 * This interface is the exact physical branch carried by
 * `PhysicPaintApplyPayload`; unrelated apply kinds retain their generic shape.
 */
export type PhysicPaintRotoPhysicalOperationLeaseOwner = 'exclusive' | 'recovery';

export interface PhysicPaintRotoPhysicalOperationLeaseToken {
  readonly projectContextId: string;
  readonly layerId: string;
  readonly generation: number;
  readonly owner: PhysicPaintRotoPhysicalOperationLeaseOwner;
}

interface PhysicPaintRotoPhysicalEditApplyPayloadBase {
  readonly kind: 'replace-roto-physical-map';
  readonly operationId: string;
  readonly layerId: string;
  /** Required by runtime validation; optional in construction-only test fixtures. */
  readonly leaseToken?: PhysicPaintRotoPhysicalOperationLeaseToken;
  readonly startFrame: number;
  readonly launchOperationId: string;
  readonly projectContextId?: string;
  readonly expectedRevision: string;
  readonly records: readonly PhysicPaintRotoPhysicalEditRecord[];
  readonly groupOverrideRecords?: readonly PhysicPaintRotoPhysicalEditRecord[];
  readonly interpolationEnabled: boolean;
  readonly interpolationMode: PhysicPaintRotoInterpolationMode;
  readonly rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  /** Complete physical cursor authority, independent from selection and operation target. */
  readonly cursorAppFrame: number;
  readonly semanticDelta?: PhysicPaintRotoPhysicalEditSemanticDelta;
  readonly historyProvenance?: PhysicPaintRotoPhysicalEditReplayProvenance;
  /**
   * Complete staged Loop Clip collection (Phase 43, D-29). When present, the
   * parent validates it fail-closed and delivers it to the store apply path
   * unchanged; when absent, the layer's current loopClips are preserved.
   */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  /** Complete stable-key-owned incoming interpolation break collection. */
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}

type PhysicPaintRotoOrdinaryPhysicalEditApplyPayload = {
  [Kind in PhysicPaintRotoPhysicalEditIntent['kind']]: PhysicPaintRotoPhysicalEditApplyPayloadBase & {
    readonly operationKind: Kind;
    readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: Kind }>;
  };
}[PhysicPaintRotoPhysicalEditIntent['kind']];

type PhysicPaintRotoSpecializedPhysicalEditApplyPayload = PhysicPaintRotoPhysicalEditApplyPayloadBase & {
  readonly operationKind: Exclude<PhysicPaintRotoPhysicalEditOperationKind, PhysicPaintRotoPhysicalEditIntent['kind']>;
  readonly intent?: never;
};

/**
 * Active physical apply payload. Ordinary mapping operations require the exact
 * typed resolver intent; specialized Play Script, interpolation, and replay
 * operations remain separate discriminants and cannot carry ordinary intent.
 */
export type PhysicPaintRotoPhysicalEditApplyPayload =
  | PhysicPaintRotoOrdinaryPhysicalEditApplyPayload
  | PhysicPaintRotoSpecializedPhysicalEditApplyPayload;

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
  readonly payload: PhysicPaintRotoRealKeyPayload;
}

/**
 * Active parent-authoritative physical-edit acknowledgement. The result
 * echoes the exact settlement tuple (operation ID, kind, layer,
 * launch/project context), staged and accepted revisions, selection, outcome,
 * semantic declaration for Duplicate/Paste, and replay provenance only for
 * Undo/Redo.
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
  readonly interpolationMode: PhysicPaintRotoInterpolationMode;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  /** Echo of the accepted complete physical cursor authority. */
  readonly cursorAppFrame: number;
  readonly appliedFrameCount: number;
  readonly ok: boolean;
  readonly error?: string;
  readonly semanticDelta?: PhysicPaintRotoPhysicalEditSemanticDelta;
  readonly historyProvenance?: PhysicPaintRotoPhysicalEditReplayProvenance;
  /** Echo of the submitted loopClips collection when the payload carried one. */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  /** Echo of the submitted incoming break collection when the payload carried one. */
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}

const PHYSIC_PAINT_ROTO_PHYSICAL_KEY_ID_MAX_LENGTH = 256;

function isBoundedPhysicalKeyId(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= PHYSIC_PAINT_ROTO_PHYSICAL_KEY_ID_MAX_LENGTH;
}

function isPhysicPaintRotoPhysicalEditOperationKind(value: unknown): value is PhysicPaintRotoPhysicalEditOperationKind {
  return value === 'insert-slot'
    || value === 'insert-empty-segment'
    || value === 'delete-key'
    || value === 'delete-key-group'
    || value === 'move-key'
    || value === 'move-key-group'
    || value === 'force-spacing'
    || value === 'duplicate-key'
    || value === 'paste-key'
    || value === 'paste-key-group'
    || value === 'play-script'
    || value === 'paint-group-frame'
    || value === 'delete-group-frame'
    || value === 'delete-group'
    || value === 'regenerate-group'
    || value === 'detach-action-groups'
    || value === 'delete-action-groups'
    || value === 'set-interpolation-enabled'
    || value === 'set-interpolation-mode'
    || value === 'undo'
    || value === 'redo';
}

function isPhysicPaintRotoOrdinaryOperationKind(
  value: PhysicPaintRotoPhysicalEditOperationKind,
): value is PhysicPaintRotoPhysicalEditIntent['kind'] {
  return value === 'insert-slot'
    || value === 'insert-empty-segment'
    || value === 'delete-key'
    || value === 'delete-key-group'
    || value === 'move-key'
    || value === 'move-key-group'
    || value === 'force-spacing'
    || value === 'duplicate-key'
    || value === 'paste-key'
    || value === 'paste-key-group';
}

function isPhysicPaintRotoPhysicalEditPayload(value: unknown): value is PhysicPaintRotoPhysicalEditRecord['payload'] {
  return isPhysicPaintRotoRealKeyPayload(value);
}

export function isPhysicPaintRotoPhysicalOperationLeaseToken(
  value: unknown,
): value is PhysicPaintRotoPhysicalOperationLeaseToken {
  return isRecord(value)
    && hasOnlyKeys(value, ['projectContextId', 'layerId', 'generation', 'owner'])
    && isNonEmptyString(value.projectContextId)
    && isNonEmptyString(value.layerId)
    && Number.isSafeInteger(value.generation)
    && (value.generation as number) >= 1
    && (value.owner === 'exclusive' || value.owner === 'recovery');
}

function isLifecycleCompletePhysicPaintRotoLoopClip(value: unknown): value is PhysicPaintRotoLoopClip {
  return isPhysicPaintRotoLoopClip(value)
    && value.syncState !== undefined
    && value.provenanceState !== undefined
    && value.phaseOrigin !== undefined
    && value.originalEndExclusive !== undefined
    && value.visibleRanges !== undefined
    && value.frameOverrides !== undefined;
}

/**
 * Strict guard for {@link PhysicPaintRotoPhysicalEditRecord}. Rejects
 * non-records, unknown members, overlong identity, malformed payload, and a
 * payload placement that disagrees with the record's direct physical frame.
 */
export function isPhysicPaintRotoPhysicalEditRecord(value: unknown): value is PhysicPaintRotoPhysicalEditRecord {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['keyId', 'appFrame', 'payload'])) return false;
  if (!isBoundedPhysicalKeyId(value.keyId)) return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  if (!isPhysicPaintRotoPhysicalEditPayload(value.payload)) return false;
  return value.payload.appFrame === value.appFrame;
}

function isUniqueBoundedPhysicalKeyIdCollection(value: unknown, allowEmpty = true): value is readonly string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isBoundedPhysicalKeyId)
    && new Set(value).size === value.length;
}

function hasValidPhysicalRevisionTransition(value: Record<string, unknown>): boolean {
  return isNonEmptyString(value.previousRevision)
    && isNonEmptyString(value.nextRevision)
    && value.previousRevision !== value.nextRevision;
}

export function isPhysicPaintRotoPhysicalEditSemanticDelta(value: unknown): value is PhysicPaintRotoPhysicalEditSemanticDelta {
  if (!isRecord(value)) return false;
  if (value.kind === 'insert-empty-segment') {
    return hasOnlyKeys(value, ['kind', 'insertedKeyId', 'destinationAppFrame'])
      && isBoundedPhysicalKeyId(value.insertedKeyId)
      && isNonNegativeInteger(value.destinationAppFrame);
  }
  if (value.kind === 'duplicate-key') {
    return hasOnlyKeys(value, ['kind', 'sourceKeyId', 'newKeyId'])
      && isBoundedPhysicalKeyId(value.sourceKeyId)
      && isBoundedPhysicalKeyId(value.newKeyId)
      && value.sourceKeyId !== value.newKeyId;
  }
  if (value.kind === 'paste-key') {
    if (!hasOnlyKeys(value, ['kind', 'destinationAppFrame', 'destinationKeyId', 'newKeyId', 'clipboardPayload'])) return false;
    if (!isNonNegativeInteger(value.destinationAppFrame)) return false;
    if (value.destinationKeyId !== null && !isBoundedPhysicalKeyId(value.destinationKeyId)) return false;
    if (value.newKeyId !== null && !isBoundedPhysicalKeyId(value.newKeyId)) return false;
    if ((value.destinationKeyId === null) === (value.newKeyId === null)) return false;
    return isPhysicPaintRotoPhysicalEditPayload(value.clipboardPayload);
  }
  if (value.kind === 'paste-key-group') {
    if (!hasOnlyKeys(value, ['kind', 'destinationAppFrame', 'entries'])) return false;
    if (!isNonNegativeInteger(value.destinationAppFrame)) return false;
    if (!Array.isArray(value.entries) || value.entries.length < 2) return false;
    return value.entries.every((entry) => {
      if (!isRecord(entry)) return false;
      if (!hasOnlyKeys(entry, ['payload', 'sourceAppFrame', 'sourceKeyId', 'newKeyId'])) return false;
      if (!isPhysicPaintRotoPhysicalEditPayload(entry.payload)) return false;
      if (!isNonNegativeInteger(entry.sourceAppFrame)) return false;
      if (!isBoundedPhysicalKeyId(entry.sourceKeyId)) return false;
      return isBoundedPhysicalKeyId(entry.newKeyId);
    });
  }
  if (value.kind === 'play-script') {
    if (!hasOnlyKeys(value, ['kind', 'affectedStartAppFrame', 'affectedEndAppFrame', 'expectedLayerCapacity', 'expectedLayerEndExclusive', 'proposedRecords', 'freshKeyIds', 'loopOnly', 'preserveSelection'])) return false;
    if (!isNonNegativeInteger(value.affectedStartAppFrame)) return false;
    if (value.loopOnly !== undefined && value.loopOnly !== true) return false;
    if (value.preserveSelection !== undefined && value.preserveSelection !== true) return false;
    if (value.loopOnly === true) {
      // Empty affected range convention: affectedEnd === affectedStart - 1
      // (may be -1 when the loop sits at frame 0).
      if (!Number.isInteger(value.affectedEndAppFrame) || value.affectedEndAppFrame !== value.affectedStartAppFrame - 1) return false;
    } else {
      if (!isNonNegativeInteger(value.affectedEndAppFrame)) return false;
      if (value.affectedEndAppFrame < value.affectedStartAppFrame) return false;
    }
    if (!isNonNegativeInteger(value.expectedLayerCapacity) || value.expectedLayerCapacity <= 0) return false;
    if (!isNonNegativeInteger(value.expectedLayerEndExclusive) || value.expectedLayerEndExclusive <= value.affectedEndAppFrame || value.expectedLayerEndExclusive > value.expectedLayerCapacity) return false;
    if (!Array.isArray(value.proposedRecords) || !value.proposedRecords.every(isPhysicPaintRotoPhysicalEditRecord)) return false;
    if (!Array.isArray(value.freshKeyIds) || !value.freshKeyIds.every(isBoundedPhysicalKeyId)) return false;
    return new Set(value.freshKeyIds).size === value.freshKeyIds.length;
  }
  if (value.kind === 'paint-group-frame') {
    return hasOnlyKeys(value, ['kind', 'groupId', 'appFrame', 'phaseAppFrame', 'affectedAppFrames', 'overrideKeyId', 'createdOverride', 'filledDeletedOccurrence', 'previousRevision', 'nextRevision'])
      && isBoundedPhysicalKeyId(value.groupId)
      && isNonNegativeInteger(value.appFrame)
      && isNonNegativeInteger(value.phaseAppFrame)
      && Array.isArray(value.affectedAppFrames)
      && value.affectedAppFrames.length > 0
      && value.affectedAppFrames.every(isNonNegativeInteger)
      && new Set(value.affectedAppFrames).size === value.affectedAppFrames.length
      && value.affectedAppFrames.includes(value.phaseAppFrame)
      && isBoundedPhysicalKeyId(value.overrideKeyId)
      && typeof value.createdOverride === 'boolean'
      && typeof value.filledDeletedOccurrence === 'boolean'
      && hasValidPhysicalRevisionTransition(value);
  }
  if (value.kind === 'delete-group-frame') {
    return hasOnlyKeys(value, ['kind', 'groupId', 'appFrame', 'phaseAppFrame', 'affectedAppFrames', 'cleanupKeyIds', 'previousRevision', 'nextRevision'])
      && isBoundedPhysicalKeyId(value.groupId)
      && isNonNegativeInteger(value.appFrame)
      && isNonNegativeInteger(value.phaseAppFrame)
      && Array.isArray(value.affectedAppFrames)
      && value.affectedAppFrames.length > 0
      && value.affectedAppFrames.every(isNonNegativeInteger)
      && new Set(value.affectedAppFrames).size === value.affectedAppFrames.length
      && value.affectedAppFrames.includes(value.phaseAppFrame)
      && isUniqueBoundedPhysicalKeyIdCollection(value.cleanupKeyIds)
      && hasValidPhysicalRevisionTransition(value);
  }
  if (value.kind === 'delete-group') {
    return hasOnlyKeys(value, ['kind', 'groupId', 'cleanupKeyIds', 'previousRevision', 'nextRevision'])
      && isBoundedPhysicalKeyId(value.groupId)
      && isUniqueBoundedPhysicalKeyIdCollection(value.cleanupKeyIds)
      && hasValidPhysicalRevisionTransition(value);
  }
  if (value.kind === 'regenerate-group') {
    return hasOnlyKeys(value, ['kind', 'groupId', 'expectedActionRevision', 'cleanupKeyIds', 'previousRevision', 'nextRevision'])
      && isBoundedPhysicalKeyId(value.groupId)
      && isNonEmptyString(value.expectedActionRevision)
      && isUniqueBoundedPhysicalKeyIdCollection(value.cleanupKeyIds)
      && hasValidPhysicalRevisionTransition(value);
  }
  if (value.kind === 'detach-action-groups' || value.kind === 'delete-action-groups') {
    return hasOnlyKeys(value, ['kind', 'actionId', 'expectedActionRevision', 'affectedGroupIds', 'cleanupKeyIds', 'previousRevision', 'nextRevision'])
      && isBoundedPhysicalKeyId(value.actionId)
      && isNonEmptyString(value.expectedActionRevision)
      && isUniqueBoundedPhysicalKeyIdCollection(value.affectedGroupIds, false)
      && isUniqueBoundedPhysicalKeyIdCollection(value.cleanupKeyIds)
      && hasValidPhysicalRevisionTransition(value);
  }
  return false;
}

function operationSemanticDeltaIsValid(
  operationKind: PhysicPaintRotoPhysicalEditOperationKind,
  semanticDelta: unknown,
  allowMissingOnFailure = false,
): boolean {
  if (operationKind === 'insert-empty-segment'
    || operationKind === 'duplicate-key'
    || operationKind === 'paste-key'
    || operationKind === 'paste-key-group'
    || operationKind === 'play-script'
    || operationKind === 'paint-group-frame'
    || operationKind === 'delete-group-frame'
    || operationKind === 'delete-group'
    || operationKind === 'regenerate-group'
    || operationKind === 'detach-action-groups'
    || operationKind === 'delete-action-groups') {
    if (semanticDelta === undefined) return allowMissingOnFailure;
    return isPhysicPaintRotoPhysicalEditSemanticDelta(semanticDelta) && semanticDelta.kind === operationKind;
  }
  return semanticDelta === undefined;
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
  if (!hasOnlyKeys(value, ['kind', 'operationId', 'operationKind', 'intent', 'layerId', 'leaseToken', 'startFrame', 'launchOperationId', 'projectContextId', 'expectedRevision', 'records', 'groupOverrideRecords', 'interpolationEnabled', 'interpolationMode', 'rotoBackground', 'selectedKeyId', 'selectedAppFrame', 'cursorAppFrame', 'semanticDelta', 'historyProvenance', 'loopClips', 'incomingInterpolationBreakKeyIds'])) return false;
  if (value.kind !== 'replace-roto-physical-map') return false;
  if (!isNonEmptyString(value.operationId)) return false;
  if (!isPhysicPaintRotoPhysicalEditOperationKind(value.operationKind)) return false;
  const intent = value.intent;
  const isOrdinary = isPhysicPaintRotoPhysicalEditIntent(intent);
  if (isOrdinary) {
    if (intent.kind !== value.operationKind) return false;
  } else if (intent !== undefined || isPhysicPaintRotoOrdinaryOperationKind(value.operationKind)) return false;
  if (!isNonEmptyString(value.layerId)) return false;
  if (!isPhysicPaintRotoPhysicalOperationLeaseToken(value.leaseToken)) return false;
  if (value.leaseToken.layerId !== value.layerId) return false;
  if (!isNonNegativeInteger(value.startFrame)) return false;
  if (!isNonEmptyString(value.launchOperationId)) return false;
  if (value.projectContextId !== undefined && !isNonEmptyString(value.projectContextId)) return false;
  if (value.projectContextId !== undefined
    && value.leaseToken.projectContextId !== value.projectContextId) return false;
  if (!isNonEmptyString(value.expectedRevision)) return false;
  if (!Array.isArray(value.records) || !value.records.every(isPhysicPaintRotoPhysicalEditRecord)) return false;
  if (value.groupOverrideRecords !== undefined
    && (!Array.isArray(value.groupOverrideRecords) || !value.groupOverrideRecords.every(isPhysicPaintRotoPhysicalEditRecord))) return false;
  if (value.loopClips !== undefined && (!Array.isArray(value.loopClips) || !value.loopClips.every(isLifecycleCompletePhysicPaintRotoLoopClip))) return false;
  if (value.incomingInterpolationBreakKeyIds !== undefined && (!Array.isArray(value.incomingInterpolationBreakKeyIds) || !value.incomingInterpolationBreakKeyIds.every(isBoundedPhysicalKeyId))) return false;
  if (typeof value.interpolationEnabled !== 'boolean') return false;
  if (value.interpolationMode !== 'duplicate' && value.interpolationMode !== 'blend') return false;
  if (value.operationKind === 'play-script') {
    if (!isPhysicPaintRotoBackgroundMetadata(value.rotoBackground)) return false;
  } else if (value.rotoBackground !== undefined) return false;
  if (value.selectedKeyId !== null && !isBoundedPhysicalKeyId(value.selectedKeyId)) return false;
  if (value.selectedAppFrame !== null && !isNonNegativeInteger(value.selectedAppFrame)) return false;
  if ((value.selectedKeyId === null) !== (value.selectedAppFrame === null)) return false;
  if (!isNonNegativeInteger(value.cursorAppFrame)) return false;
  if (!operationSemanticDeltaIsValid(value.operationKind, value.semanticDelta)) return false;
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
  if (!hasOnlyKeys(value, ['operationId', 'kind', 'operationKind', 'layerId', 'startFrame', 'launchOperationId', 'projectContextId', 'expectedRevision', 'stagedRevision', 'acceptedRevision', 'interpolationMode', 'selectedKeyId', 'selectedAppFrame', 'cursorAppFrame', 'appliedFrameCount', 'ok', 'error', 'semanticDelta', 'historyProvenance', 'loopClips', 'incomingInterpolationBreakKeyIds'])) return false;
  if (value.kind !== 'replace-roto-physical-map') return false;
  if (!isNonEmptyString(value.operationId)) return false;
  if (!isPhysicPaintRotoPhysicalEditOperationKind(value.operationKind)) return false;
  if (!isNonEmptyString(value.layerId)) return false;
  if (!isNonNegativeInteger(value.startFrame)) return false;
  if (!isNonEmptyString(value.launchOperationId)) return false;
  if (value.projectContextId !== undefined && !isNonEmptyString(value.projectContextId)) return false;
  if (!isNonEmptyString(value.expectedRevision)) return false;
  if (!isNonEmptyString(value.stagedRevision)) return false;
  if (value.acceptedRevision !== null && !isNonEmptyString(value.acceptedRevision)) return false;
  if (value.interpolationMode !== 'duplicate' && value.interpolationMode !== 'blend') return false;
  if (value.selectedKeyId !== null && !isBoundedPhysicalKeyId(value.selectedKeyId)) return false;
  if (value.selectedAppFrame !== null && !isNonNegativeInteger(value.selectedAppFrame)) return false;
  if ((value.selectedKeyId === null) !== (value.selectedAppFrame === null)) return false;
  if (!isNonNegativeInteger(value.cursorAppFrame)) return false;
  if (!isNonNegativeInteger(value.appliedFrameCount)) return false;
  if (typeof value.ok !== 'boolean') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (value.loopClips !== undefined && (!Array.isArray(value.loopClips) || !value.loopClips.every(isLifecycleCompletePhysicPaintRotoLoopClip))) return false;
  if (value.incomingInterpolationBreakKeyIds !== undefined && (!Array.isArray(value.incomingInterpolationBreakKeyIds) || !value.incomingInterpolationBreakKeyIds.every(isBoundedPhysicalKeyId))) return false;
  if (value.ok && value.acceptedRevision === null) return false;
  if (!value.ok && value.acceptedRevision !== null) return false;
  if (!operationSemanticDeltaIsValid(value.operationKind, value.semanticDelta, !value.ok)) return false;
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

export type PhysicPaintApplyKind = 'apply-canvas' | 'delete-roto-frame' | 'replace-roto-key-frames' | 'replace-roto-physical-map' | 'update-roto-interpolation-settings' | 'update-roto-playback-settings';
export type PhysicPaintRotoFrameSource = 'real-key' | 'generated-interpolation' | 'background-only-support';
export type PhysicPaintRotoBackgroundMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3';

export interface PhysicPaintRotoBackgroundMetadata {
  background: PhysicPaintRotoBackgroundMode;
  paperGrain: string;
  grainStrength: number;
  color?: string;
}

export interface PhysicPaintRotoPlaybackSettings {
  loop: boolean;
  fps: number;
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
  /** Opaque Rust capability forwarded only to the trusted Physics Paint webview. */
  scriptLibraryAuthority?: string;
}

/** Closed plain-data physical document carried by launch and bridge envelopes. */
export interface PhysicPaintRotoPhysicalDocumentPayload {
  readonly capacity: number;
  readonly records: readonly PhysicPaintRotoPhysicalEditRecord[];
  readonly groupOverrideRecords?: readonly PhysicPaintRotoPhysicalEditRecord[];
  readonly interpolationEnabled: boolean;
  readonly interpolationMode: PhysicPaintRotoInterpolationMode;
  readonly scriptMotion: {
    readonly deformation: number;
    readonly position: number;
  };
  readonly background: PhysicPaintRotoBackgroundMetadata | null;
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly revision: string;
  /** Additive Loop Clip collection (Phase 43, D-29); absent means empty. */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  /** Stable-key-owned incoming interpolation breaks; absent means empty. */
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}

export interface EfxPaintAudioPreviewTrack {
  id: string;
  assetUrl: string;
  offsetFrame: number;
  inFrame: number;
  outFrame: number;
  slipOffset: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  volume: number;
  muted: boolean;
  fadeInCurve: FadeCurve;
  fadeOutCurve: FadeCurve;
}

export interface EfxPaintAudioPreviewContext {
  revision: number;
  fps: number;
  tracks: EfxPaintAudioPreviewTrack[];
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
  rotoPhysical?: PhysicPaintRotoPhysicalDocumentPayload;
  rotoPlayback?: PhysicPaintRotoPlaybackSettings;
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
  audioPreview?: EfxPaintAudioPreviewContext;
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
  physicalCapacity: number;
  rotoRevision: string;
  physicalRevision: string;
  physicalRecords: readonly PhysicPaintRotoPhysicalEditRecord[];
  interpolationEnabled: boolean;
  interpolationMode: PhysicPaintRotoInterpolationMode;
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

export interface PhysicPaintUpdateRotoPlaybackSettingsPayload {
  kind: 'update-roto-playback-settings';
  operationId: string;
  layerId: string;
  startFrame: number;
  settings: PhysicPaintRotoPlaybackSettings;
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
export type PhysicPaintReplaceRotoPhysicalMapPayload = PhysicPaintRotoPhysicalEditApplyPayload;

export type PhysicPaintApplyPayload = PhysicPaintApplyCanvasPayload | PhysicPaintDeleteRotoFramePayload | PhysicPaintReplaceRotoKeyFramesPayload | PhysicPaintReplaceRotoPhysicalMapPayload | PhysicPaintUpdateRotoInterpolationSettingsPayload | PhysicPaintUpdateRotoPlaybackSettingsPayload;

export interface PhysicPaintGenericApplyResult {
  operationId: string;
  kind: PhysicPaintApplyKind;
  layerId: string;
  startFrame: number;
  appliedFrameCount: number;
  ok: boolean;
  error?: string;
}

/** Physical results use the exact parent-authoritative acknowledgement shape. */
export type PhysicPaintApplyResult = PhysicPaintGenericApplyResult | PhysicPaintRotoPhysicalEditApplyResult;

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
    (value.rotoPlayback === undefined || isPhysicPaintRotoPlaybackSettings(value.rotoPlayback)) &&
    (value.audioPreview === undefined || isEfxPaintAudioPreviewContext(value.audioPreview)) &&
    optionalRotoCacheFrames(value.cachedRotoFrames) &&
    optionalRotoPhysicalDocumentPayload(value.rotoPhysical) &&
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

  if (value.kind === 'update-roto-playback-settings') {
    return hasOnlyKeys(value, ['kind', 'operationId', 'layerId', 'startFrame', 'settings'])
      && isPhysicPaintRotoPlaybackSettings(value.settings);
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
    return isPhysicPaintRotoPhysicalEditApplyPayload(value);
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

export function isPhysicPaintRotoPlaybackSettings(value: unknown): value is PhysicPaintRotoPlaybackSettings {
  return isRecord(value)
    && hasOnlyKeys(value, ['loop', 'fps'])
    && typeof value.loop === 'boolean'
    && typeof value.fps === 'number'
    && Number.isFinite(value.fps)
    && value.fps >= 1
    && value.fps <= 60;
}

/**
 * D-04: the audio preview section is a read-only projection of the main
 * editor's audio tracks. It carries ONLY an efxasset:// protocol URL per
 * track — never filePath/relativePath fields and never raw bytes.
 */
export function isEfxPaintAudioPreviewTrack(value: unknown): value is EfxPaintAudioPreviewTrack {
  return isRecord(value)
    && hasOnlyKeys(value, ['id', 'assetUrl', 'offsetFrame', 'inFrame', 'outFrame', 'slipOffset', 'fadeInFrames', 'fadeOutFrames', 'volume', 'muted', 'fadeInCurve', 'fadeOutCurve'])
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.assetUrl)
    && isFiniteNumber(value.offsetFrame)
    && isFiniteNumber(value.inFrame)
    && isFiniteNumber(value.outFrame)
    && isFiniteNumber(value.slipOffset)
    && isFiniteNumber(value.fadeInFrames)
    && isFiniteNumber(value.fadeOutFrames)
    && isFiniteNumber(value.volume)
    && typeof value.muted === 'boolean'
    && isEfxPaintAudioFadeCurve(value.fadeInCurve)
    && isEfxPaintAudioFadeCurve(value.fadeOutCurve);
}

export function isEfxPaintAudioPreviewContext(value: unknown): value is EfxPaintAudioPreviewContext {
  return isRecord(value)
    && hasOnlyKeys(value, ['revision', 'fps', 'tracks'])
    && typeof value.revision === 'number'
    && Number.isInteger(value.revision)
    && value.revision >= 0
    && typeof value.fps === 'number'
    && Number.isFinite(value.fps)
    && value.fps > 0
    && Array.isArray(value.tracks)
    && value.tracks.every(isEfxPaintAudioPreviewTrack);
}

function isEfxPaintAudioFadeCurve(value: unknown): value is FadeCurve {
  return value === 'linear' || value === 'exponential' || value === 'logarithmic';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPhysicPaintApplyResult(value: unknown): value is PhysicPaintApplyResult {
  if (!isRecord(value)) return false;
  if (value.kind === 'replace-roto-physical-map') {
    return isPhysicPaintRotoPhysicalEditApplyResult(value);
  }
  return (
    isNonEmptyString(value.operationId) &&
    (value.kind === 'apply-canvas' || value.kind === 'delete-roto-frame' || value.kind === 'replace-roto-key-frames' || value.kind === 'update-roto-interpolation-settings' || value.kind === 'update-roto-playback-settings') &&
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

export function isPhysicPaintRotoAuthorityRequest(value: unknown): value is PhysicPaintRotoAuthorityRequest {
  return Boolean(
    isRecord(value) &&
      hasOnlyKeys(value, ['operationId', 'projectContextId', 'layerId', 'canonicalStart']) &&
      isBoundedOperationId(value.operationId) &&
      isNonEmptyString(value.projectContextId) &&
      isNonEmptyString(value.layerId) &&
      isNonNegativeInteger(value.canonicalStart)
  );
}

function isScriptLibraryRow(value: unknown): value is RotoScriptLibraryRow {
  if (!isRecord(value) || !isCanonicalRotoScriptId(value.id) || !isNonEmptyString(value.revision) || !isActionTransactionSha256(value.integritySha256) || normalizeRotoScriptName(value.name) === null) return false;
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
    (value.kind === 'apply-canvas' || value.kind === 'delete-roto-frame' || value.kind === 'replace-roto-key-frames' || value.kind === 'replace-roto-physical-map' || value.kind === 'update-roto-interpolation-settings' || value.kind === 'update-roto-playback-settings') &&
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
  return value === undefined || (isRecord(value)
    && isNonEmptyString(value.name)
    && typeof value.saved === 'boolean'
    && isNonEmptyString(value.contextId)
    && optionalNonEmptyString(value.scriptLibraryAuthority)
    && Object.keys(value).every((key) => key === 'name' || key === 'saved' || key === 'contextId' || key === 'scriptLibraryAuthority'));
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

function optionalRotoPhysicalDocumentPayload(value: unknown): value is PhysicPaintRotoPhysicalDocumentPayload | undefined {
  if (value === undefined) return true;
  if (!isRecord(value) || !hasOnlyKeys(value, ['capacity', 'records', 'groupOverrideRecords', 'interpolationEnabled', 'interpolationMode', 'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame', 'revision', 'loopClips', 'incomingInterpolationBreakKeyIds'])) return false;
  if (!isNonNegativeInteger(value.capacity) || value.capacity < 1) return false;
  if (!Array.isArray(value.records) || !value.records.every(isPhysicPaintRotoPhysicalEditRecord)) return false;
  if (value.groupOverrideRecords !== undefined
    && (!Array.isArray(value.groupOverrideRecords) || !value.groupOverrideRecords.every(isPhysicPaintRotoPhysicalEditRecord))) return false;
  if (value.loopClips !== undefined && (!Array.isArray(value.loopClips) || !value.loopClips.every(isLifecycleCompletePhysicPaintRotoLoopClip))) return false;
  if (value.incomingInterpolationBreakKeyIds !== undefined && (!Array.isArray(value.incomingInterpolationBreakKeyIds) || !value.incomingInterpolationBreakKeyIds.every(isBoundedPhysicalKeyId))) return false;
  if (typeof value.interpolationEnabled !== 'boolean') return false;
  if (value.interpolationMode !== 'duplicate' && value.interpolationMode !== 'blend') return false;
  if (!isRecord(value.scriptMotion) || !hasOnlyKeys(value.scriptMotion, ['deformation', 'position'])) return false;
  if (!isPercentInteger(value.scriptMotion.deformation) || !isPercentInteger(value.scriptMotion.position)) return false;
  if (value.background !== null && !isPhysicPaintRotoBackgroundMetadata(value.background)) return false;
  if (value.selectedKeyId !== null && !isBoundedPhysicalKeyId(value.selectedKeyId)) return false;
  if (!isNonNegativeInteger(value.cursorAppFrame) || value.cursorAppFrame >= value.capacity) return false;
  return isNonEmptyString(value.revision);
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
