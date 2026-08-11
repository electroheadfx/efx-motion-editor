import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoGroupVisibleRange,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';

export type PhysicPaintRotoGroupPaintFailureReason =
  | 'group-not-found'
  | 'group-lifecycle-unavailable'
  | 'frame-outside-group-extent'
  | 'duplicate-override-key-id'
  | 'override-identity-mismatch'
  | 'unresolved-precedence'
  | 'cleanup-reference-mismatch'
  | 'malformed-proposal';

export interface PhysicPaintRotoGroupFramePaintImpact {
  readonly kind: 'paint-group-frame';
  readonly groupId: string;
  readonly appFrame: number;
  readonly overrideKeyId: string;
  readonly createdOverride: boolean;
  readonly filledDeletedOccurrence: boolean;
  readonly previousRevision: string;
  readonly nextRevision: string;
}

export type PhysicPaintRotoGroupFramePaintResult =
  | Readonly<{
      ok: true;
      proposal: PhysicPaintRotoPhysicalDocument;
      impact: PhysicPaintRotoGroupFramePaintImpact;
    }>
  | Readonly<{
      ok: false;
      reason: PhysicPaintRotoGroupPaintFailureReason;
    }>;

export interface PhysicPaintRotoGroupFramePaintInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly groupId: string;
  readonly appFrame: number;
  readonly overrideKeyId: string;
  readonly renderedPayload: PhysicPaintRotoRealKeyPayload;
  readonly unresolvedPrecedence?: boolean;
  readonly claimedCleanupKeyIds?: readonly string[];
}

function reject(reason: PhysicPaintRotoGroupPaintFailureReason): PhysicPaintRotoGroupFramePaintResult {
  return Object.freeze({ ok: false, reason });
}

function includesFrame(ranges: readonly PhysicPaintRotoGroupVisibleRange[], appFrame: number): boolean {
  return ranges.some((range) => appFrame >= range.start && appFrame < range.endExclusive);
}

function mergeFrameIntoRanges(
  ranges: readonly PhysicPaintRotoGroupVisibleRange[],
  appFrame: number,
): readonly PhysicPaintRotoGroupVisibleRange[] {
  const candidates = [...ranges, { start: appFrame, endExclusive: appFrame + 1 }]
    .sort((left, right) => left.start - right.start);
  const merged: PhysicPaintRotoGroupVisibleRange[] = [];
  for (const range of candidates) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.endExclusive) {
      merged[merged.length - 1] = {
        start: previous.start,
        endExclusive: Math.max(previous.endExclusive, range.endExclusive),
      };
    } else {
      merged.push({ start: range.start, endExclusive: range.endExclusive });
    }
  }
  return Object.freeze(merged.map((range) => Object.freeze(range)));
}

/**
 * Build one exact-occurrence Group Paint candidate without publishing authority.
 *
 * The helper is intentionally pure: it owns no store, Signal, version, history,
 * cache, selection, rendering, filesystem, DOM, lease, or settlement state.
 */
export function proposePhysicPaintRotoGroupFramePaint(
  input: PhysicPaintRotoGroupFramePaintInput,
): PhysicPaintRotoGroupFramePaintResult {
  if (input.unresolvedPrecedence) return reject('unresolved-precedence');
  const groupIndex = input.document.loopClips.findIndex((group) => group.loopId === input.groupId);
  if (groupIndex < 0) return reject('group-not-found');
  const group = input.document.loopClips[groupIndex];
  if (group.syncState === undefined
    || group.provenanceState === undefined
    || group.phaseOrigin === undefined
    || group.originalEndExclusive === undefined
    || group.visibleRanges === undefined
    || group.frameOverrides === undefined) return reject('group-lifecycle-unavailable');
  if (!Number.isSafeInteger(input.appFrame)
    || input.appFrame < group.phaseOrigin
    || input.appFrame >= group.originalEndExclusive) return reject('frame-outside-group-extent');

  const existingOverride = group.frameOverrides.find((override) => override.appFrame === input.appFrame);
  if (existingOverride && existingOverride.keyId !== input.overrideKeyId) {
    return reject('override-identity-mismatch');
  }
  const recordWithRequestedId = input.document.realKeyRecords.find((record) => record.keyId === input.overrideKeyId);
  if (!existingOverride && recordWithRequestedId) return reject('duplicate-override-key-id');

  const referencedKeyIds = new Set(input.document.loopClips.flatMap((candidate) => [
    ...candidate.sourceKeyIds,
    ...(candidate.frameOverrides?.map((override) => override.keyId) ?? []),
  ]));
  if ((input.claimedCleanupKeyIds ?? []).some((keyId) => referencedKeyIds.has(keyId))) {
    return reject('cleanup-reference-mismatch');
  }

  const overrideKeyId = existingOverride?.keyId ?? input.overrideKeyId;
  const overrideRecord: PhysicPaintRotoRealKeyRecord = {
    kind: 'real-key',
    keyId: overrideKeyId,
    appFrame: input.appFrame,
    payload: input.renderedPayload,
  };
  const nextRecords = existingOverride
    ? input.document.realKeyRecords.map((record) => record.keyId === overrideKeyId ? overrideRecord : record)
    : [...input.document.realKeyRecords, overrideRecord];
  const filledDeletedOccurrence = !includesFrame(group.visibleRanges, input.appFrame);
  const nextGroup = {
    ...group,
    syncState: 'modified' as const,
    visibleRanges: filledDeletedOccurrence
      ? mergeFrameIntoRanges(group.visibleRanges, input.appFrame)
      : group.visibleRanges,
    frameOverrides: existingOverride
      ? group.frameOverrides
      : Object.freeze([
          ...group.frameOverrides,
          Object.freeze({ appFrame: input.appFrame, keyId: overrideKeyId }),
        ].sort((left, right) => left.appFrame - right.appFrame)),
  };
  const nextLoopClips = input.document.loopClips.map((candidate, index) => index === groupIndex ? nextGroup : candidate);
  try {
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(
      nextRecords,
      input.document.interpolation,
      nextLoopClips,
      input.document.incomingInterpolationBreakKeyIds,
    );
    const proposal = parsePhysicPaintRotoPhysicalDocument({
      ...input.document,
      realKeyRecords: nextRecords,
      loopClips: nextLoopClips,
      revision: nextRevision,
    });
    const impact = Object.freeze<PhysicPaintRotoGroupFramePaintImpact>({
      kind: 'paint-group-frame',
      groupId: input.groupId,
      appFrame: input.appFrame,
      overrideKeyId,
      createdOverride: !existingOverride,
      filledDeletedOccurrence,
      previousRevision: input.document.revision,
      nextRevision: proposal.revision,
    });
    return Object.freeze({ ok: true, proposal, impact });
  } catch {
    return reject('malformed-proposal');
  }
}
