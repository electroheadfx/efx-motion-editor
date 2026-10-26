// ============================================================
//  railScriptCleanup — quick-261026-odd one-time migration.
//
//  Rails (Play Script / Motion / Static / Reveal) bake pixels INTO key
//  records. Every script recorded on those keys before the rail-bake
//  purge existed describes pixels the rail has since replaced, so it
//  kept phantom Move/Select handles over a render it never painted.
//
//  The migration purges those stale scripts ONCE per project/layer/
//  track (marker in localStorage). Rail membership is deliberately
//  NOT a permanent gate: a script painted on a rail frame after this
//  build is real content and must survive every later launch.
//
//  Pure + DOM-free ports: the caller supplies the carried v1.0
//  document and the Studio does the store purges.
// ============================================================

/** The carried v1.0 document's rail-bearing slice. */
export interface LaunchRailTrack {
  readonly id: string;
  readonly rotoPhysical?: {
    readonly capacity: number;
    readonly loopClips: readonly {
      readonly placementStart: number;
      readonly sourceKeyIds: readonly string[];
      readonly repeat: number | 'infinity';
    }[];
  } | null;
}

export interface LaunchRailDocument {
  readonly tracks?: readonly LaunchRailTrack[];
}

export interface RailCleanupIdentity {
  readonly projectId: string;
  readonly layerId: string;
  readonly trackId: string;
}

type RailCleanupStorage = Pick<Storage, 'getItem' | 'setItem'>;

const RAIL_SCRIPT_CLEANUP_KEY = 'efx.rail-script-cleanup.v1';

function defaultStorage(): RailCleanupStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function markerKey(identity: RailCleanupIdentity): string {
  return `${RAIL_SCRIPT_CLEANUP_KEY}:${identity.projectId}:${identity.layerId}:${identity.trackId}`;
}

/**
 * An unreadable/missing storage counts as DONE — a marker that cannot be
 * persisted must never authorize a repeat purge on every launch.
 */
export function railScriptCleanupDone(
  identity: RailCleanupIdentity,
  storage: RailCleanupStorage | null | undefined = defaultStorage(),
): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(markerKey(identity)) === '1';
  } catch {
    return true;
  }
}

export function markRailScriptCleanupDone(
  identity: RailCleanupIdentity,
  storage: RailCleanupStorage | null | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(markerKey(identity), '1');
  } catch {
    // Best effort: the purge already ran for this session.
  }
}

/**
 * Rail frames straight from the CARRIED document — the launch restore runs
 * before the store holds the physical state, so the store-based resolver is
 * not trustworthy at that moment.
 *
 * `null` = the track's physical state is absent (unknown). Callers must NOT
 * mark the cleanup done on `null`; the next launch retries.
 */
export function resolveCarriedRailFrames(
  document: unknown,
  trackId: string,
): Set<number> | null {
  const tracks = (document as LaunchRailDocument | null | undefined)?.tracks;
  if (!Array.isArray(tracks)) return null;
  const physical = tracks.find((track) => track.id === trackId)?.rotoPhysical ?? null;
  if (!physical) return null;
  const capacity = physical.capacity;
  const frames = new Set<number>();
  for (const clip of physical.loopClips) {
    const end = clip.repeat === 'infinity'
      ? capacity
      : clip.placementStart + clip.sourceKeyIds.length * clip.repeat;
    const last = Math.min(end, capacity);
    for (let frame = Math.max(0, clip.placementStart); frame < last; frame += 1) {
      frames.add(frame);
    }
  }
  return frames;
}
