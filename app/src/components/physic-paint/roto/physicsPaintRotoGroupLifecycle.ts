import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoGroupVisibleRange,
  type PhysicPaintRotoLoopClip,
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

export type PhysicPaintRotoGroupLifecycleFailureReason =
  | 'group-not-found'
  | 'group-lifecycle-unavailable'
  | 'frame-outside-group-extent'
  | 'frame-not-visible'
  | 'last-visible-occurrence'
  | 'action-not-found'
  | 'action-revision-mismatch'
  | 'group-detached'
  | 'malformed-proposal';

export type PhysicPaintRotoGroupFrameTarget =
  | Readonly<{ kind: 'ordinary-key'; appFrame: number; keyId: string }>
  | Readonly<{
      kind: 'source-occurrence';
      groupId: string;
      appFrame: number;
      sourceKeyId: string;
      sourceIndex: number;
      cycleOffset: number;
      repeatInstance: number;
    }>
  | Readonly<{
      kind: 'generated-occurrence';
      groupId: string;
      appFrame: number;
      leftSourceKeyId: string;
      rightSourceKeyId: string;
      cycleOffset: number;
      repeatInstance: number;
      progress: number;
    }>
  | Readonly<{ kind: 'override'; groupId: string; appFrame: number; keyId: string }>
  | Readonly<{ kind: 'group-gap'; groupId: string; appFrame: number }>
  | Readonly<{
      kind: 'unresolved-group';
      groupId: string;
      appFrame: number;
      missingSourceKeyIds: readonly string[];
      invalidSourceTiming?: true;
    }>
  | Readonly<{ kind: 'ambiguous-group'; appFrame: number; groupIds: readonly string[] }>
  | Readonly<{ kind: 'empty'; appFrame: number }>;

export interface PhysicPaintRotoGroupFrameTargetInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly appFrame: number;
}

function isLifecycleGroup(group: PhysicPaintRotoLoopClip): group is PhysicPaintRotoLoopClip & Required<Pick<
  PhysicPaintRotoLoopClip,
  'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'
>> {
  return group.syncState !== undefined
    && group.provenanceState !== undefined
    && group.phaseOrigin !== undefined
    && group.originalEndExclusive !== undefined
    && group.visibleRanges !== undefined
    && group.frameOverrides !== undefined;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Classify an activation frame from one complete accepted document. */
export function classifyPhysicPaintRotoGroupFrameTarget(
  input: PhysicPaintRotoGroupFrameTargetInput,
): PhysicPaintRotoGroupFrameTarget {
  const appFrame = input.appFrame;
  const containingGroups = input.document.loopClips.filter((group): group is PhysicPaintRotoLoopClip & Required<Pick<
    PhysicPaintRotoLoopClip,
    'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'
  >> => (
    isLifecycleGroup(group)
    && Number.isSafeInteger(appFrame)
    && appFrame >= group.phaseOrigin
    && appFrame < group.originalEndExclusive
  ));
  if (containingGroups.length > 1) {
    return Object.freeze({
      kind: 'ambiguous-group',
      appFrame,
      groupIds: Object.freeze(containingGroups.map((group) => group.loopId).sort()),
    });
  }
  const group = containingGroups[0];
  if (!group) {
    const record = input.document.realKeyRecords.find((candidate) => candidate.appFrame === appFrame);
    return record
      ? Object.freeze({ kind: 'ordinary-key', appFrame, keyId: record.keyId })
      : Object.freeze({ kind: 'empty', appFrame });
  }
  const override = group.frameOverrides.find((candidate) => candidate.appFrame === appFrame);
  if (override) {
    return Object.freeze({ kind: 'override', groupId: group.loopId, appFrame, keyId: override.keyId });
  }
  if (!includesFrame(group.visibleRanges, appFrame)) {
    return Object.freeze({ kind: 'group-gap', groupId: group.loopId, appFrame });
  }

  const recordsById = new Map(input.document.realKeyRecords.map((record) => [record.keyId, record]));
  const missingSourceKeyIds = group.sourceKeyIds.filter((keyId) => !recordsById.has(keyId));
  const sourceFrames = group.sourceKeyIds.map((keyId) => recordsById.get(keyId)?.appFrame);
  const validTiming = missingSourceKeyIds.length === 0
    && sourceFrames.every((frame): frame is number => frame !== undefined)
    && sourceFrames.every((frame, index) => index === 0 || sourceFrames[index - 1]! < frame);
  if (!validTiming) {
    return Object.freeze({
      kind: 'unresolved-group',
      groupId: group.loopId,
      appFrame,
      missingSourceKeyIds: Object.freeze(missingSourceKeyIds),
      ...(missingSourceKeyIds.length === 0 ? { invalidSourceTiming: true as const } : {}),
    });
  }

  const firstSourceFrame = sourceFrames[0]!;
  const sourceOffsets = sourceFrames.map((frame) => frame! - firstSourceFrame);
  const cycleLength = sourceOffsets[sourceOffsets.length - 1]! + 1;
  const phaseOffset = appFrame - group.phaseOrigin;
  const cycleOffset = positiveModulo(phaseOffset, cycleLength);
  const repeatInstance = Math.floor(phaseOffset / cycleLength);
  const exactSourceIndex = sourceOffsets.indexOf(cycleOffset);
  if (exactSourceIndex >= 0) {
    return Object.freeze({
      kind: 'source-occurrence',
      groupId: group.loopId,
      appFrame,
      sourceKeyId: group.sourceKeyIds[exactSourceIndex],
      sourceIndex: exactSourceIndex,
      cycleOffset,
      repeatInstance,
    });
  }
  let leftSourceIndex = sourceOffsets.length - 1;
  for (let index = 0; index < sourceOffsets.length; index += 1) {
    if (sourceOffsets[index] > cycleOffset) {
      leftSourceIndex = index - 1;
      break;
    }
  }
  const rightSourceIndex = leftSourceIndex + 1;
  if (leftSourceIndex < 0 || rightSourceIndex >= sourceOffsets.length) {
    return Object.freeze({ kind: 'empty', appFrame });
  }
  const leftOffset = sourceOffsets[leftSourceIndex];
  const rightOffset = sourceOffsets[rightSourceIndex];
  return Object.freeze({
    kind: 'generated-occurrence',
    groupId: group.loopId,
    appFrame,
    leftSourceKeyId: group.sourceKeyIds[leftSourceIndex],
    rightSourceKeyId: group.sourceKeyIds[rightSourceIndex],
    cycleOffset,
    repeatInstance,
    progress: (cycleOffset - leftOffset) / (rightOffset - leftOffset),
  });
}

export interface PhysicPaintRotoGroupLifecycleImpact {
  readonly kind: 'delete-group-frame' | 'delete-group' | 'regenerate-group';
  readonly groupId: string;
  readonly appFrame?: number;
  readonly expectedActionRevision?: string;
  readonly cleanupKeyIds: readonly string[];
  readonly previousRevision: string;
  readonly nextRevision: string;
}

export interface PhysicPaintRotoActionGroupLifecycleImpact {
  readonly kind: 'detach-action-groups' | 'delete-action-groups';
  readonly actionId: string;
  readonly expectedActionRevision: string;
  readonly affectedGroupIds: readonly string[];
  readonly cleanupKeyIds: readonly string[];
  readonly previousRevision: string;
  readonly nextRevision: string;
}

export type PhysicPaintRotoGroupLifecycleResult<TImpact> =
  | Readonly<{ ok: true; proposal: PhysicPaintRotoPhysicalDocument; impact: TImpact }>
  | Readonly<{ ok: false; reason: PhysicPaintRotoGroupLifecycleFailureReason }>;

function rejectLifecycle<TImpact>(
  reason: PhysicPaintRotoGroupLifecycleFailureReason,
): PhysicPaintRotoGroupLifecycleResult<TImpact> {
  return Object.freeze({ ok: false, reason });
}

function normalizeRangesAfterFrameRemoval(
  ranges: readonly PhysicPaintRotoGroupVisibleRange[],
  appFrame: number,
): readonly PhysicPaintRotoGroupVisibleRange[] {
  const next: PhysicPaintRotoGroupVisibleRange[] = [];
  for (const range of ranges) {
    if (appFrame < range.start || appFrame >= range.endExclusive) {
      next.push({ start: range.start, endExclusive: range.endExclusive });
      continue;
    }
    if (range.start < appFrame) next.push({ start: range.start, endExclusive: appFrame });
    if (appFrame + 1 < range.endExclusive) next.push({ start: appFrame + 1, endExclusive: range.endExclusive });
  }
  return Object.freeze(next.map((range) => Object.freeze(range)));
}

function referencedKeyIds(groups: readonly PhysicPaintRotoLoopClip[]): ReadonlySet<string> {
  return new Set(groups.flatMap((group) => [
    ...group.sourceKeyIds,
    ...(group.frameOverrides?.map((override) => override.keyId) ?? []),
  ]));
}

function cleanupCandidates(
  removedGroups: readonly PhysicPaintRotoLoopClip[],
  remainingGroups: readonly PhysicPaintRotoLoopClip[],
): readonly string[] {
  const remaining = referencedKeyIds(remainingGroups);
  return Object.freeze([...new Set(removedGroups.flatMap((group) => [
    ...group.sourceKeyIds,
    ...(group.frameOverrides?.map((override) => override.keyId) ?? []),
  ]))].filter((keyId) => !remaining.has(keyId)).sort());
}

function buildLifecycleProposal(
  document: PhysicPaintRotoPhysicalDocument,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  cleanupKeyIds: readonly string[],
): PhysicPaintRotoPhysicalDocument {
  const cleanup = new Set(cleanupKeyIds);
  const realKeyRecords = document.realKeyRecords.filter((record) => !cleanup.has(record.keyId));
  const incomingInterpolationBreakKeyIds = document.incomingInterpolationBreakKeyIds
    .filter((keyId) => !cleanup.has(keyId));
  const selectedKeyId = document.selectedKeyId !== null && cleanup.has(document.selectedKeyId)
    ? null
    : document.selectedKeyId;
  const revision = buildPhysicPaintRotoPhysicalRevision(
    realKeyRecords,
    document.interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds,
  );
  return parsePhysicPaintRotoPhysicalDocument({
    ...document,
    realKeyRecords,
    loopClips,
    incomingInterpolationBreakKeyIds,
    selectedKeyId,
    revision,
  });
}

export interface PhysicPaintRotoDeleteGroupFrameInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly groupId: string;
  readonly appFrame: number;
}

export function proposePhysicPaintRotoDeleteGroupFrame(
  input: PhysicPaintRotoDeleteGroupFrameInput,
): PhysicPaintRotoGroupLifecycleResult<PhysicPaintRotoGroupLifecycleImpact> {
  const groupIndex = input.document.loopClips.findIndex((group) => group.loopId === input.groupId);
  if (groupIndex < 0) return rejectLifecycle('group-not-found');
  const group = input.document.loopClips[groupIndex];
  if (!isLifecycleGroup(group)) return rejectLifecycle('group-lifecycle-unavailable');
  if (input.appFrame < group.phaseOrigin || input.appFrame >= group.originalEndExclusive) {
    return rejectLifecycle('frame-outside-group-extent');
  }
  if (!includesFrame(group.visibleRanges, input.appFrame)) return rejectLifecycle('frame-not-visible');
  const visibleCount = group.visibleRanges.reduce((count, range) => count + range.endExclusive - range.start, 0);
  if (visibleCount === 1) {
    const deleted = proposePhysicPaintRotoDeleteGroup({
      document: input.document,
      groupId: input.groupId,
    });
    if (!deleted.ok) return deleted;
    return Object.freeze({
      ok: true,
      proposal: deleted.proposal,
      impact: Object.freeze({
        ...deleted.impact,
        kind: 'delete-group-frame',
        appFrame: input.appFrame,
      }),
    });
  }

  const removedOverride = group.frameOverrides.find((override) => override.appFrame === input.appFrame);
  const nextGroup = {
    ...group,
    syncState: 'modified' as const,
    visibleRanges: normalizeRangesAfterFrameRemoval(group.visibleRanges, input.appFrame),
    frameOverrides: Object.freeze(group.frameOverrides.filter((override) => override.appFrame !== input.appFrame)),
  };
  const loopClips = input.document.loopClips.map((candidate, index) => index === groupIndex ? nextGroup : candidate);
  const cleanupKeyIds = removedOverride && !referencedKeyIds(loopClips).has(removedOverride.keyId)
    ? Object.freeze([removedOverride.keyId])
    : Object.freeze([] as string[]);
  try {
    const proposal = buildLifecycleProposal(input.document, loopClips, cleanupKeyIds);
    return Object.freeze({
      ok: true,
      proposal,
      impact: Object.freeze({
        kind: 'delete-group-frame',
        groupId: input.groupId,
        appFrame: input.appFrame,
        cleanupKeyIds,
        previousRevision: input.document.revision,
        nextRevision: proposal.revision,
      }),
    });
  } catch {
    return rejectLifecycle('malformed-proposal');
  }
}

export interface PhysicPaintRotoDeleteGroupInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly groupId: string;
}

export function proposePhysicPaintRotoDeleteGroup(
  input: PhysicPaintRotoDeleteGroupInput,
): PhysicPaintRotoGroupLifecycleResult<PhysicPaintRotoGroupLifecycleImpact> {
  const removed = input.document.loopClips.find((group) => group.loopId === input.groupId);
  if (!removed) return rejectLifecycle('group-not-found');
  if (!isLifecycleGroup(removed)) return rejectLifecycle('group-lifecycle-unavailable');
  const loopClips = input.document.loopClips.filter((group) => group.loopId !== input.groupId);
  const cleanupKeyIds = cleanupCandidates([removed], loopClips);
  try {
    const proposal = buildLifecycleProposal(input.document, loopClips, cleanupKeyIds);
    return Object.freeze({
      ok: true,
      proposal,
      impact: Object.freeze({
        kind: 'delete-group',
        groupId: input.groupId,
        cleanupKeyIds,
        previousRevision: input.document.revision,
        nextRevision: proposal.revision,
      }),
    });
  } catch {
    return rejectLifecycle('malformed-proposal');
  }
}

export interface PhysicPaintRotoRegenerateGroupInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly groupId: string;
  readonly expectedActionRevision: string;
  readonly currentActionRevision: string;
}

export function proposePhysicPaintRotoRegenerateGroup(
  input: PhysicPaintRotoRegenerateGroupInput,
): PhysicPaintRotoGroupLifecycleResult<PhysicPaintRotoGroupLifecycleImpact> {
  if (input.expectedActionRevision !== input.currentActionRevision) {
    return rejectLifecycle('action-revision-mismatch');
  }
  const groupIndex = input.document.loopClips.findIndex((group) => group.loopId === input.groupId);
  if (groupIndex < 0) return rejectLifecycle('group-not-found');
  const group = input.document.loopClips[groupIndex];
  if (!isLifecycleGroup(group)) return rejectLifecycle('group-lifecycle-unavailable');
  if (group.provenanceState !== 'attached' || group.scriptId === undefined) return rejectLifecycle('group-detached');
  const nextGroup = {
    ...group,
    placementStart: group.phaseOrigin,
    syncState: 'synchronized' as const,
    provenanceState: 'attached' as const,
    visibleRanges: Object.freeze([Object.freeze({
      start: group.phaseOrigin,
      endExclusive: group.originalEndExclusive,
    })]),
    frameOverrides: Object.freeze([]),
  };
  const loopClips = input.document.loopClips.map((candidate, index) => index === groupIndex ? nextGroup : candidate);
  const removedOverrideIds = group.frameOverrides.map((override) => override.keyId);
  const remainingReferences = referencedKeyIds(loopClips);
  const cleanupKeyIds = Object.freeze(removedOverrideIds.filter((keyId) => !remainingReferences.has(keyId)).sort());
  try {
    const proposal = buildLifecycleProposal(input.document, loopClips, cleanupKeyIds);
    return Object.freeze({
      ok: true,
      proposal,
      impact: Object.freeze({
        kind: 'regenerate-group',
        groupId: input.groupId,
        expectedActionRevision: input.expectedActionRevision,
        cleanupKeyIds,
        previousRevision: input.document.revision,
        nextRevision: proposal.revision,
      }),
    });
  } catch {
    return rejectLifecycle('malformed-proposal');
  }
}

export interface PhysicPaintRotoActionGroupLifecycleInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly actionId: string;
  readonly expectedActionRevision: string;
  readonly currentActionRevision: string;
  readonly mode: 'detach' | 'delete';
}

export function proposePhysicPaintRotoActionGroupLifecycle(
  input: PhysicPaintRotoActionGroupLifecycleInput,
): PhysicPaintRotoGroupLifecycleResult<PhysicPaintRotoActionGroupLifecycleImpact> {
  if (input.expectedActionRevision !== input.currentActionRevision) {
    return rejectLifecycle('action-revision-mismatch');
  }
  const affected = input.document.loopClips.filter((group) => (
    group.scriptId === input.actionId
    && isLifecycleGroup(group)
    && group.provenanceState === 'attached'
  ));
  if (affected.length === 0) return rejectLifecycle('action-not-found');
  const affectedGroupIds = Object.freeze(affected.map((group) => group.loopId).sort());
  const loopClips = input.mode === 'detach'
    ? input.document.loopClips.map((group) => affectedGroupIds.includes(group.loopId)
      ? { ...group, provenanceState: 'detached' as const }
      : group)
    : input.document.loopClips.filter((group) => !affectedGroupIds.includes(group.loopId));
  const cleanupKeyIds = input.mode === 'delete'
    ? cleanupCandidates(affected, loopClips)
    : Object.freeze([] as string[]);
  try {
    const proposal = buildLifecycleProposal(input.document, loopClips, cleanupKeyIds);
    return Object.freeze({
      ok: true,
      proposal,
      impact: Object.freeze({
        kind: input.mode === 'detach' ? 'detach-action-groups' : 'delete-action-groups',
        actionId: input.actionId,
        expectedActionRevision: input.expectedActionRevision,
        affectedGroupIds,
        cleanupKeyIds,
        previousRevision: input.document.revision,
        nextRevision: proposal.revision,
      }),
    });
  } catch {
    return rejectLifecycle('malformed-proposal');
  }
}
