import type {
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { classifyPhysicPaintRotoGroupFrameTarget } from './physicsPaintRotoGroupLifecycle';

export interface RotoPhysicalOwnedFrame {
  readonly appFrame: number;
  readonly keyId?: string;
  readonly contentRevision?: string;
  readonly cacheRevision?: string;
}

export interface RotoPhysicalReferenceState<TFrame extends RotoPhysicalOwnedFrame> {
  readonly url: string | null;
  readonly cachedRepaintBase: TFrame | null;
}

export interface RotoPhysicalOwnershipSnapshot<TState, TFrame extends RotoPhysicalOwnedFrame> {
  readonly frameStates: ReadonlyMap<number, TState>;
  readonly previewFrames: ReadonlyMap<number, TFrame>;
  readonly capturedFrames: ReadonlyMap<number, TFrame>;
  readonly confirmedFrames: ReadonlyMap<number, TFrame>;
  readonly dirtyFrames: ReadonlySet<number>;
  readonly liveOverlayActionCounts: ReadonlyMap<number, number>;
  readonly editableFrames: readonly number[];
  readonly reference: RotoPhysicalReferenceState<TFrame>;
}

export interface RotoPhysicalOwnershipResult<TState, TFrame extends RotoPhysicalOwnedFrame> {
  readonly frameStates: Map<number, TState>;
  readonly previewFrames: Map<number, TFrame>;
  readonly capturedFrames: Map<number, TFrame>;
  readonly confirmedFrames: Map<number, TFrame>;
  readonly dirtyFrames: Set<number>;
  readonly liveOverlayActionCounts: Map<number, number>;
  readonly editableFrames: number[];
  readonly reference: RotoPhysicalReferenceState<TFrame>;
}

export type RotoPhysicalOwnershipResolution<TState, TFrame extends RotoPhysicalOwnedFrame> =
  | { readonly ok: true; readonly value: RotoPhysicalOwnershipResult<TState, TFrame> }
  | { readonly ok: false; readonly error: string };

export function collectDiscardableRotoGroupOwnedFrames(input: {
  readonly beforeDocument: PhysicPaintRotoPhysicalDocument;
  readonly afterDocument: PhysicPaintRotoPhysicalDocument;
  readonly snapshotFrames: readonly number[];
}): number[] {
  const directBeforeFrames = new Set(input.beforeDocument.realKeyRecords.map((record) => record.appFrame));
  return [...new Set(input.snapshotFrames)]
    .filter((appFrame) => {
      if (directBeforeFrames.has(appFrame)) return false;
      const beforeTarget = classifyPhysicPaintRotoGroupFrameTarget({
        document: input.beforeDocument,
        appFrame,
      });
      const afterTarget = classifyPhysicPaintRotoGroupFrameTarget({
        document: input.afterDocument,
        appFrame,
      });
      const beforeGroupId = 'groupId' in beforeTarget ? beforeTarget.groupId : null;
      const afterGroupId = 'groupId' in afterTarget ? afterTarget.groupId : null;
      return beforeGroupId !== null && beforeGroupId === afterGroupId;
    })
    .sort((left, right) => left - right);
}

function buildIdentityByFrame(records: readonly PhysicPaintRotoRealKeyRecord[]): Map<number, string> | null {
  const identities = new Set<string>();
  const byFrame = new Map<number, string>();
  for (const record of records) {
    if (identities.has(record.keyId) || byFrame.has(record.appFrame)) return null;
    identities.add(record.keyId);
    byFrame.set(record.appFrame, record.keyId);
  }
  return byFrame;
}

function buildFrameByIdentity(records: readonly PhysicPaintRotoRealKeyRecord[]): Map<string, number> | null {
  const frames = new Set<number>();
  const byIdentity = new Map<string, number>();
  for (const record of records) {
    if (byIdentity.has(record.keyId) || frames.has(record.appFrame)) return null;
    byIdentity.set(record.keyId, record.appFrame);
    frames.add(record.appFrame);
  }
  return byIdentity;
}

function remapOwnedMap<T>(
  source: ReadonlyMap<number, T>,
  ownerByOldFrame: ReadonlyMap<number, string>,
  frameByIdentity: ReadonlyMap<string, number>,
  discardUnownedAppFrames: ReadonlySet<number>,
  project: (value: T, appFrame: number, keyId: string) => T,
): Map<number, T> | null {
  const result = new Map<number, T>();
  for (const [oldFrame, value] of source) {
    const keyId = ownerByOldFrame.get(oldFrame);
    if (!keyId) {
      if (discardUnownedAppFrames.has(oldFrame)) continue;
      return null;
    }
    const nextFrame = frameByIdentity.get(keyId);
    if (nextFrame === undefined) continue;
    if (result.has(nextFrame)) return null;
    result.set(nextFrame, project(value, nextFrame, keyId));
  }
  return result;
}

function remapOwnedSet(
  source: ReadonlySet<number>,
  ownerByOldFrame: ReadonlyMap<number, string>,
  frameByIdentity: ReadonlyMap<string, number>,
  discardUnownedAppFrames: ReadonlySet<number>,
): Set<number> | null {
  const result = new Set<number>();
  for (const oldFrame of source) {
    const keyId = ownerByOldFrame.get(oldFrame);
    if (!keyId) {
      if (discardUnownedAppFrames.has(oldFrame)) continue;
      return null;
    }
    const nextFrame = frameByIdentity.get(keyId);
    if (nextFrame === undefined) continue;
    if (result.has(nextFrame)) return null;
    result.add(nextFrame);
  }
  return result;
}

/**
 * Rebuild every mutable frame-indexed child collection from one immutable
 * pre-state and one complete accepted stable-identity placement.
 *
 * Entries normally belong to pre-state real keys. Accepted callers may name
 * exact Group-owned virtual frames whose derived buffers must be discarded
 * before reconstruction; every other unowned frame still fails closed.
 */
export function rebuildRotoPhysicalOwnership<TState, TFrame extends RotoPhysicalOwnedFrame>(input: {
  readonly beforeRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly afterRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly contentRevision: string;
  readonly discardUnownedAppFrames?: readonly number[];
  readonly snapshot: RotoPhysicalOwnershipSnapshot<TState, TFrame>;
}): RotoPhysicalOwnershipResolution<TState, TFrame> {
  const ownerByOldFrame = buildIdentityByFrame(input.beforeRecords);
  const frameByIdentity = buildFrameByIdentity(input.afterRecords);
  if (!ownerByOldFrame || !frameByIdentity) return { ok: false, error: 'Physical ownership records contain duplicate identity or frame.' };
  if (!input.contentRevision) return { ok: false, error: 'Physical ownership rebuild requires the accepted content revision.' };

  const discardUnownedAppFrames = new Set(input.discardUnownedAppFrames ?? []);
  const remapFrame = (frame: TFrame, appFrame: number, keyId: string): TFrame => ({
    ...frame,
    appFrame,
    keyId,
    contentRevision: input.contentRevision,
    cacheRevision: `${input.contentRevision}:real:${keyId}`,
  });
  const frameStates = remapOwnedMap(input.snapshot.frameStates, ownerByOldFrame, frameByIdentity, discardUnownedAppFrames, (value) => value);
  const previewFrames = remapOwnedMap(input.snapshot.previewFrames, ownerByOldFrame, frameByIdentity, discardUnownedAppFrames, remapFrame);
  const capturedFrames = remapOwnedMap(input.snapshot.capturedFrames, ownerByOldFrame, frameByIdentity, discardUnownedAppFrames, remapFrame);
  const confirmedFrames = remapOwnedMap(input.snapshot.confirmedFrames, ownerByOldFrame, frameByIdentity, discardUnownedAppFrames, remapFrame);
  const dirtyFrames = remapOwnedSet(input.snapshot.dirtyFrames, ownerByOldFrame, frameByIdentity, discardUnownedAppFrames);
  const liveOverlayActionCounts = remapOwnedMap(input.snapshot.liveOverlayActionCounts, ownerByOldFrame, frameByIdentity, discardUnownedAppFrames, (value) => value);
  const editableFrames = remapOwnedSet(new Set(input.snapshot.editableFrames), ownerByOldFrame, frameByIdentity, discardUnownedAppFrames);
  if (!frameStates || !previewFrames || !capturedFrames || !confirmedFrames || !dirtyFrames || !liveOverlayActionCounts || !editableFrames) {
    return { ok: false, error: 'Frame-indexed child state is not completely owned by the pre-state real-key identities.' };
  }

  const repaintBase = input.snapshot.reference.cachedRepaintBase;
  let nextRepaintBase: TFrame | null = null;
  if (repaintBase) {
    const owner = ownerByOldFrame.get(repaintBase.appFrame);
    if (!owner) {
      if (!discardUnownedAppFrames.has(repaintBase.appFrame)) {
        return { ok: false, error: 'Cached reference is not owned by a pre-state real key.' };
      }
    } else {
      const nextFrame = frameByIdentity.get(owner);
      if (nextFrame !== undefined) nextRepaintBase = remapFrame(repaintBase, nextFrame, owner);
    }
  }

  return {
    ok: true,
    value: {
      frameStates,
      previewFrames,
      capturedFrames,
      confirmedFrames,
      dirtyFrames,
      liveOverlayActionCounts,
      editableFrames: [...editableFrames].sort((a, b) => a - b),
      reference: {
        url: nextRepaintBase ? input.snapshot.reference.url : null,
        cachedRepaintBase: nextRepaintBase,
      },
    },
  };
}
