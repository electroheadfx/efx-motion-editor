import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoGroupVisibleRange,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { deriveDeleteKeyRailIncomingInterpolationBreakKeyIds } from './physicsPaintRotoPhysicalResolver';
import { deriveKeyRailSegments, type KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';
import type { RailSetDeleteMember } from '../../../types/physicPaint';

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
  readonly phaseAppFrame: number;
  readonly affectedAppFrames: readonly number[];
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
 * Build one source-phase Group Paint candidate without publishing authority.
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
  if (!isLifecycleGroup(group)) return reject('group-lifecycle-unavailable');
  if (!Number.isSafeInteger(input.appFrame)
    || input.appFrame < group.phaseOrigin
    || input.appFrame >= group.originalEndExclusive) return reject('frame-outside-group-extent');

  const phase = resolveGroupPhaseAuthority(input.document, group, input.appFrame);
  if (!phase) return reject('malformed-proposal');
  const phaseOverrides = group.frameOverrides.filter((override) => (
    positiveModulo(override.appFrame - group.phaseOrigin, phase.cycleLength) === phase.cycleOffset
  ));
  if (phaseOverrides.length > 1) return reject('override-identity-mismatch');
  const existingOverride = phaseOverrides[0];
  if (existingOverride && existingOverride.keyId !== input.overrideKeyId) {
    return reject('override-identity-mismatch');
  }
  const groupOverrideRecords = input.document.groupOverrideRecords ?? [];
  const recordWithRequestedId = [...input.document.realKeyRecords, ...groupOverrideRecords]
    .find((record) => record.keyId === input.overrideKeyId);
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
    appFrame: phase.phaseAppFrame,
    payload: {
      ...input.renderedPayload,
      appFrame: phase.phaseAppFrame,
    },
  };
  const nextGroupOverrideRecords = existingOverride
    ? groupOverrideRecords.map((record) => record.keyId === overrideKeyId ? overrideRecord : record)
    : [...groupOverrideRecords, overrideRecord];
  const filledDeletedOccurrence = phase.affectedAppFrames
    .some((appFrame) => !includesFrame(group.visibleRanges, appFrame));
  const visibleRanges = phase.affectedAppFrames.reduce(
    (ranges, appFrame) => mergeFrameIntoRanges(ranges, appFrame),
    group.visibleRanges,
  );
  const nextGroup = {
    ...group,
    syncState: 'modified' as const,
    visibleRanges,
    frameOverrides: Object.freeze([
      ...group.frameOverrides.filter((override) => override.keyId !== overrideKeyId),
      Object.freeze({ appFrame: phase.phaseAppFrame, keyId: overrideKeyId }),
    ].sort((left, right) => left.appFrame - right.appFrame)),
  };
  const nextLoopClips = input.document.loopClips.map((candidate, index) => index === groupIndex ? nextGroup : candidate);
  try {
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(
      input.document.realKeyRecords,
      input.document.interpolation,
      nextLoopClips,
      input.document.incomingInterpolationBreakKeyIds,
      nextGroupOverrideRecords,
    );
    const proposal = parsePhysicPaintRotoPhysicalDocument({
      ...input.document,
      groupOverrideRecords: nextGroupOverrideRecords,
      loopClips: nextLoopClips,
      revision: nextRevision,
    });
    const impact = Object.freeze<PhysicPaintRotoGroupFramePaintImpact>({
      kind: 'paint-group-frame',
      groupId: input.groupId,
      appFrame: input.appFrame,
      phaseAppFrame: phase.phaseAppFrame,
      affectedAppFrames: phase.affectedAppFrames,
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
  | Readonly<{
      kind: 'override';
      groupId: string;
      appFrame: number;
      keyId: string;
      phaseAppFrame: number;
      cycleOffset: number;
      repeatInstance: number;
    }>
  | Readonly<{
      kind: 'group-gap';
      groupId: string;
      appFrame: number;
      phaseAppFrame: number;
      cycleOffset: number;
      repeatInstance: number;
    }>
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
  readonly document: Pick<PhysicPaintRotoPhysicalDocument, 'loopClips' | 'realKeyRecords'>
    & Partial<Omit<PhysicPaintRotoPhysicalDocument, 'loopClips' | 'realKeyRecords'>>;
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

interface PhysicPaintRotoGroupPhaseAuthority {
  readonly cycleOffset: number;
  readonly cycleLength: number;
  readonly phaseAppFrame: number;
  readonly affectedAppFrames: readonly number[];
}

function resolveGroupPhaseAuthority(
  document: Pick<PhysicPaintRotoPhysicalDocument, 'realKeyRecords'>,
  group: PhysicPaintRotoLoopClip & Required<Pick<
    PhysicPaintRotoLoopClip,
    'phaseOrigin' | 'originalEndExclusive'
  >>,
  appFrame: number,
): PhysicPaintRotoGroupPhaseAuthority | null {
  const recordsById = new Map(document.realKeyRecords.map((record) => [record.keyId, record]));
  const sourceFrames = group.sourceKeyIds.map((keyId) => recordsById.get(keyId)?.appFrame);
  if (sourceFrames.some((frame) => frame === undefined)
    || sourceFrames.some((frame, index) => index > 0 && sourceFrames[index - 1]! >= frame!)) {
    return null;
  }
  const firstSourceFrame = sourceFrames[0]!;
  const cycleLength = sourceFrames[sourceFrames.length - 1]! - firstSourceFrame + 1;
  if (!Number.isSafeInteger(cycleLength) || cycleLength <= 0) return null;
  const cycleOffset = positiveModulo(appFrame - group.phaseOrigin, cycleLength);
  const phaseAppFrame = group.phaseOrigin + cycleOffset;
  const affectedAppFrames: number[] = [];
  for (
    let candidate = phaseAppFrame;
    candidate < group.originalEndExclusive;
    candidate += cycleLength
  ) {
    affectedAppFrames.push(candidate);
  }
  return Object.freeze({
    cycleOffset,
    cycleLength,
    phaseAppFrame,
    affectedAppFrames: Object.freeze(affectedAppFrames),
  });
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
  const phase = resolveGroupPhaseAuthority(input.document, group, appFrame);
  if (!phase) {
    const missingSourceKeyIds = group.sourceKeyIds.filter((keyId) => (
      !input.document.realKeyRecords.some((record) => record.keyId === keyId)
    ));
    return Object.freeze({
      kind: 'unresolved-group',
      groupId: group.loopId,
      appFrame,
      missingSourceKeyIds: Object.freeze(missingSourceKeyIds),
      ...(missingSourceKeyIds.length === 0 ? { invalidSourceTiming: true as const } : {}),
    });
  }
  const repeatInstance = Math.floor((appFrame - group.phaseOrigin) / phase.cycleLength);
  const phaseOverrides = group.frameOverrides.filter((candidate) => (
    positiveModulo(candidate.appFrame - group.phaseOrigin, phase.cycleLength) === phase.cycleOffset
  ));
  if (phaseOverrides.length === 1 && includesFrame(group.visibleRanges, appFrame)) {
    return Object.freeze({
      kind: 'override',
      groupId: group.loopId,
      appFrame,
      keyId: phaseOverrides[0].keyId,
      phaseAppFrame: phase.phaseAppFrame,
      cycleOffset: phase.cycleOffset,
      repeatInstance,
    });
  }
  if (!includesFrame(group.visibleRanges, appFrame)) {
    return Object.freeze({
      kind: 'group-gap',
      groupId: group.loopId,
      appFrame,
      phaseAppFrame: phase.phaseAppFrame,
      cycleOffset: phase.cycleOffset,
      repeatInstance,
    });
  }
  if (phaseOverrides.length > 1) {
    return Object.freeze({
      kind: 'unresolved-group',
      groupId: group.loopId,
      appFrame,
      missingSourceKeyIds: Object.freeze([]),
      invalidSourceTiming: true as const,
    });
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
  const cycleOffset = phase.cycleOffset;
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
  readonly phaseAppFrame?: number;
  readonly affectedAppFrames?: readonly number[];
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
  const groupOverrideRecords = (document.groupOverrideRecords ?? []).filter((record) => !cleanup.has(record.keyId));
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
    groupOverrideRecords,
  );
  return parsePhysicPaintRotoPhysicalDocument({
    ...document,
    realKeyRecords,
    groupOverrideRecords,
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
  const phase = resolveGroupPhaseAuthority(input.document, group, input.appFrame);
  if (!phase) return rejectLifecycle('malformed-proposal');
  const visibleTargets = phase.affectedAppFrames
    .filter((appFrame) => includesFrame(group.visibleRanges, appFrame));
  if (visibleTargets.length === 0) return rejectLifecycle('frame-not-visible');
  const visibleCount = group.visibleRanges.reduce((count, range) => count + range.endExclusive - range.start, 0);
  if (visibleTargets.length === visibleCount) {
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
        phaseAppFrame: phase.phaseAppFrame,
        affectedAppFrames: phase.affectedAppFrames,
      }),
    });
  }

  const removedOverrides = group.frameOverrides.filter((override) => (
    positiveModulo(override.appFrame - group.phaseOrigin, phase.cycleLength) === phase.cycleOffset
  ));
  const visibleRanges = phase.affectedAppFrames.reduce(
    (ranges, appFrame) => normalizeRangesAfterFrameRemoval(ranges, appFrame),
    group.visibleRanges,
  );
  const removedOverrideKeyIds = new Set(removedOverrides.map((override) => override.keyId));
  const nextGroup = {
    ...group,
    syncState: 'modified' as const,
    visibleRanges,
    frameOverrides: Object.freeze(group.frameOverrides.filter((override) => !removedOverrideKeyIds.has(override.keyId))),
  };
  const loopClips = input.document.loopClips.map((candidate, index) => index === groupIndex ? nextGroup : candidate);
  const remainingReferences = referencedKeyIds(loopClips);
  const cleanupKeyIds = Object.freeze([...removedOverrideKeyIds]
    .filter((keyId) => !remainingReferences.has(keyId))
    .sort());
  try {
    const proposal = buildLifecycleProposal(input.document, loopClips, cleanupKeyIds);
    return Object.freeze({
      ok: true,
      proposal,
      impact: Object.freeze({
        kind: 'delete-group-frame',
        groupId: input.groupId,
        appFrame: input.appFrame,
        phaseAppFrame: phase.phaseAppFrame,
        affectedAppFrames: phase.affectedAppFrames,
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
  const affectedGroupIds = Object.freeze([...affected]
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId))
    .map((group) => group.loopId));
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

export interface PhysicPaintRotoDeleteRailsInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly members: readonly RailSetDeleteMember[];
}

export interface PhysicPaintRotoDeleteRailsImpact {
  readonly kind: 'delete-rails';
  /** The validated member descriptors in deterministic composition order. */
  readonly members: readonly RailSetDeleteMember[];
  readonly cleanupKeyIds: readonly string[];
  readonly previousRevision: string;
  readonly nextRevision: string;
}

export type PhysicPaintRotoDeleteRailsFailureReason =
  | 'empty-member-set'
  | 'malformed-member'
  | 'duplicate-member'
  | 'unknown-member'
  | 'stale-member'
  | 'malformed-proposal';

export type PhysicPaintRotoDeleteRailsResult =
  | Readonly<{ ok: true; proposal: PhysicPaintRotoPhysicalDocument; impact: PhysicPaintRotoDeleteRailsImpact }>
  | Readonly<{ ok: false; reason: PhysicPaintRotoDeleteRailsFailureReason }>;

function rejectDeleteRails(reason: PhysicPaintRotoDeleteRailsFailureReason): PhysicPaintRotoDeleteRailsResult {
  return Object.freeze({ ok: false, reason });
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function groupOwnedKeyIdsOf(document: PhysicPaintRotoPhysicalDocument): ReadonlySet<string> {
  const owned = new Set<string>();
  for (const clip of document.loopClips) {
    clip.sourceKeyIds.forEach((keyId) => owned.add(keyId));
    (clip.frameOverrides ?? []).forEach((override) => owned.add(override.keyId));
  }
  return owned;
}

function matchingKeyRailSegment(
  document: PhysicPaintRotoPhysicalDocument,
  member: Extract<RailSetDeleteMember, { kind: 'key-rail' }>,
): KeyRailSegment | null {
  const segments = deriveKeyRailSegments({
    orderedRealKeys: document.realKeyRecords,
    incomingInterpolationBreakKeyIds: new Set(document.incomingInterpolationBreakKeyIds),
    groupOwnedKeyIds: groupOwnedKeyIdsOf(document),
  });
  return segments.find((candidate) => (
    candidate.firstKeyId === member.firstKeyId
    && candidate.keyIds.length === member.keyIds.length
    && candidate.keyIds.every((keyId, index) => keyId === member.keyIds[index])
  )) ?? null;
}

/**
 * Apply one Key Rail member's deletion to the accumulating document with the
 * EXACT 43.4 delete-key-rail semantics: remove the member records, re-select
 * the nearest surviving key (successor first, then previous), and normalize
 * the complete break collection (breaks owned by removed keys drop; the first
 * surviving non-group key at/after the vacated end owns the successor break).
 * The segment is re-derived against the accumulating state so a member that
 * became stale mid-composition fails closed — parity with the sequential
 * single-authority path.
 */
function applyKeyRailDeletion(
  document: PhysicPaintRotoPhysicalDocument,
  member: Extract<RailSetDeleteMember, { kind: 'key-rail' }>,
): { ok: true; proposal: PhysicPaintRotoPhysicalDocument } | { ok: false } {
  const segment = matchingKeyRailSegment(document, member);
  if (segment === null) return { ok: false };
  const removalSet = new Set(member.keyIds);
  const mapping = new Map<string, number>();
  let successorKeyId: string | null = null;
  let previousKeyId: string | null = null;
  for (const record of document.realKeyRecords) {
    if (removalSet.has(record.keyId)) continue;
    mapping.set(record.keyId, record.appFrame);
    if (successorKeyId === null && record.appFrame > segment.lastKeyFrame) {
      successorKeyId = record.keyId;
    }
    if (record.appFrame < segment.firstKeyFrame) previousKeyId = record.keyId;
  }
  const nextIncomingInterpolationBreakKeyIds = deriveDeleteKeyRailIncomingInterpolationBreakKeyIds({
    memberKeyIds: member.keyIds,
    lastKeyFrame: segment.lastKeyFrame,
    groupOwnedKeyIds: groupOwnedKeyIdsOf(document),
    mapping,
    incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
  });
  const selectedKeyId = successorKeyId ?? previousKeyId;
  const selectedAppFrame = selectedKeyId === null ? null : mapping.get(selectedKeyId) ?? null;
  const realKeyRecords = document.realKeyRecords.filter((record) => !removalSet.has(record.keyId));
  try {
    const revision = buildPhysicPaintRotoPhysicalRevision(
      realKeyRecords,
      document.interpolation,
      document.loopClips,
      nextIncomingInterpolationBreakKeyIds,
      document.groupOverrideRecords ?? [],
    );
    const proposal = parsePhysicPaintRotoPhysicalDocument({
      ...document,
      realKeyRecords,
      loopClips: document.loopClips,
      incomingInterpolationBreakKeyIds: nextIncomingInterpolationBreakKeyIds,
      selectedKeyId,
      cursorAppFrame: selectedAppFrame ?? document.cursorAppFrame,
      revision,
    });
    return { ok: true, proposal };
  } catch {
    return { ok: false };
  }
}

/**
 * One pure proposer for the atomic mixed-set Delete Rails operation (43.6-04).
 *
 * Input: the accepted physical document + the ordered member list (Group Rail
 * loopIds + Key Rail firstKeyId/keyIds). Output: ONE complete proposal
 * (records, overrides, loopClips, breaks, interpolation, selection, cursor,
 * revision) + a 'delete-rails' impact, or a fail-closed rejection — never a
 * partial proposal.
 *
 * Composition contract (D-23): every member is validated against the input
 * document first (all-or-nothing — a stale loopId or stale segment rejects the
 * WHOLE set), then the deletions compose sequentially over the accumulating
 * document state in deterministic order (placementStart asc, then loopId asc).
 * Group members apply the EXACT 43.2 Delete Group semantics through the
 * existing exported proposer (visibleRanges/provenance/sync/Action-retention
 * cannot fork); Key Rail members apply the EXACT 43.4 delete-key-rail rules.
 * cleanupKeyIds collects every removed key except those still referenced by
 * surviving Groups. The referenced Action library and script-library authority
 * are never touched.
 */
export function proposePhysicPaintRotoDeleteRails(
  input: PhysicPaintRotoDeleteRailsInput,
): PhysicPaintRotoDeleteRailsResult {
  const { document, members } = input;
  if (!Array.isArray(members) || members.length === 0) {
    return rejectDeleteRails('empty-member-set');
  }

  interface ResolvedMember {
    readonly member: RailSetDeleteMember;
    readonly placementStart: number;
    readonly loopId: string;
  }
  const resolved: ResolvedMember[] = [];
  const seenRailIds = new Set<string>();
  for (const member of members) {
    if (member.kind === 'key-rail') {
      if (!isBoundedKeyId(member.firstKeyId)
        || !Array.isArray(member.keyIds)
        || member.keyIds.length === 0
        || member.keyIds.some((keyId: string) => !isBoundedKeyId(keyId))) {
        return rejectDeleteRails('malformed-member');
      }
      if (member.keyIds.some((keyId: string) => !document.realKeyRecords.some((record) => record.keyId === keyId))) {
        return rejectDeleteRails('unknown-member');
      }
      const segment = matchingKeyRailSegment(document, member);
      if (segment === null) return rejectDeleteRails('stale-member');
      if (seenRailIds.has(segment.firstKeyId)) return rejectDeleteRails('duplicate-member');
      seenRailIds.add(segment.firstKeyId);
      resolved.push({ member, placementStart: segment.firstKeyFrame, loopId: member.firstKeyId });
    } else {
      if (!isBoundedKeyId(member.loopId)) return rejectDeleteRails('malformed-member');
      const group = document.loopClips.find((candidate) => candidate.loopId === member.loopId);
      if (!group) return rejectDeleteRails('unknown-member');
      if (!isLifecycleGroup(group)) return rejectDeleteRails('malformed-member');
      if (seenRailIds.has(member.loopId)) return rejectDeleteRails('duplicate-member');
      seenRailIds.add(member.loopId);
      resolved.push({ member, placementStart: group.placementStart, loopId: member.loopId });
    }
  }

  const ordered = [...resolved].sort((left, right) => (
    left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId)
  ));

  let current = document;
  const cleanupKeyIds = new Set<string>();
  for (const { member } of ordered) {
    if (member.kind === 'loop') {
      const deleted = proposePhysicPaintRotoDeleteGroup({ document: current, groupId: member.loopId });
      if (!deleted.ok) return rejectDeleteRails('malformed-proposal');
      deleted.impact.cleanupKeyIds.forEach((keyId) => cleanupKeyIds.add(keyId));
      current = deleted.proposal;
    } else {
      const step = applyKeyRailDeletion(current, member);
      if (!step.ok) return rejectDeleteRails('stale-member');
      member.keyIds.forEach((keyId) => cleanupKeyIds.add(keyId));
      current = step.proposal;
    }
  }

  const impact = Object.freeze<PhysicPaintRotoDeleteRailsImpact>({
    kind: 'delete-rails',
    members: Object.freeze(ordered.map(({ member }) => member)),
    cleanupKeyIds: Object.freeze([...cleanupKeyIds].sort()),
    previousRevision: document.revision,
    nextRevision: current.revision,
  });
  return Object.freeze({ ok: true, proposal: current, impact });
}
