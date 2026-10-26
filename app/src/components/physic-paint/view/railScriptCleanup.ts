// ============================================================
//  railScriptCleanup — quick-261026-odd one-time migration.
//
//  Rails (Play Script / Motion / Static / Reveal) bake pixels INTO key
//  records. Every script recorded on those keys before the rail-bake
//  purge existed describes pixels the rail has since replaced, so it
//  kept phantom Move/Select handles over a render it never painted.
//
//  The once-per-project/layer/track marker lives INSIDE the script
//  snapshot container (studioScriptSnapshotCodec v2). A webview
//  localStorage marker was tried first and was not durable here.
//  Rail membership is deliberately NOT a permanent gate: a script
//  painted on a rail frame after this build is real content and must
//  survive every later launch.
//
//  This module is the pure carried-document rail-span reader; the
//  Studio owns the store purges and the controller owns the marker.
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
