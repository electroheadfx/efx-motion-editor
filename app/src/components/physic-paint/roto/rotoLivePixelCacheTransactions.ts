import { onInteractionIdle, readInteractionIdle, readLastInteractionAt } from '../bridge/gestureIdleScheduler';

/**
 * 52.1 (Part 3): a capture produces its capture→encode→commit pipeline only
 * when the gesture has been quiet for this long. Between rapid strokes each
 * inter-stroke idle transition otherwise starts a full WebP encode whose
 * result is superseded by the next stroke's capture — during continuous
 * drawing N strokes burned N encodes while only the last could commit. A quiet
 * window collapses a burst to a single encode of the settled canvas; the
 * navigation/close/save/export flush paths bypass the window via forceFlush.
 *
 * The window must exceed the user's inter-stroke pause, not just the 400ms
 * idle flip: the cache save on a FRESH key is a full-frame readback (~83ms
 * synchronous main-thread getImageData) + WebP encode + parent push whose
 * parent-side decode re-saturates the shared GPU process — and a long string of
 * ~80ms rAF stutter follows every save. The user's own diagnosis (cache save
 * slows the main thread from the first stroke): at any quiet shorter than their
 * stroke cadence the save fires between strokes and the next stroke lands in
 * its drain. 6000ms collocates the save only at a LONG genuine stop; save /
 * export / navigation / Apply flush pending captures synchronously via
 * forceFlush, so nothing is ever lost.
 */
export const CAPTURE_PRODUCE_QUIET_MS = 6000;

export interface RotoLivePixelIdentity {
  readonly launchId: string;
  readonly layerId: string;
  readonly keyId: string;
  readonly contentRevision: string;
  readonly appFrame: number;
}

export interface RotoLivePixelCapture<T> {
  identity: RotoLivePixelIdentity;
  mutationId?: number;
  resolveCurrent: () => RotoLivePixelIdentity | null;
  produce: () => Promise<T> | T;
  commit: (value: T, current: RotoLivePixelIdentity) => void | boolean | Promise<void | boolean>;
  recordPerformance?: (sample: { stage: string; category: 'sync-cpu' | 'scheduled-wait' | 'async-elapsed'; durationMs: number; timestamp: number; mutationId?: number; sourceFrame: number; outcome?: string }) => void;
}

interface RotoLegacyLivePixelCapture<T> {
  sourceFrame: number;
  mutationId?: number;
  produce: () => Promise<T> | T;
  commit: (value: T) => void;
  recordPerformance?: RotoLivePixelCapture<T>['recordPerformance'];
}

type RotoLivePixelIdentityInput = Pick<RotoLivePixelIdentity, 'launchId' | 'layerId' | 'keyId'> | number;

const IDENTITY_SEPARATOR = String.fromCharCode(0);

export interface RotoLivePixelCacheTransactions {
  capture: {
    <T>(input: RotoLivePixelCapture<T>): Promise<boolean>;
    <T>(input: RotoLegacyLivePixelCapture<T>): Promise<boolean>;
  };
  invalidate: (identity: RotoLivePixelIdentityInput) => number;
  invalidateLaunch: (launchId: string, layerId: string) => void;
  revision: (identity: RotoLivePixelIdentityInput) => number;
  flush: (identity?: RotoLivePixelIdentityInput) => Promise<void>;
  hasPending: (identity?: RotoLivePixelIdentityInput) => boolean;
  remove: (identity: RotoLivePixelIdentityInput, commit: () => void) => boolean;
  /**
   * Synchronously start the produce step (canvas readback + encode) for a
   * pending capture, so the canvas copy happens BEFORE the caller clears the
   * engine. The encode promise is stored and the pending work's produce reuses
   * it instead of re-copying the (now-cleared) live canvas. No-op when there is
   * no pending capture for the identity.
   */
  snapshot: (identity: RotoLivePixelIdentityInput) => void;
}

function identityKey(identity: RotoLivePixelIdentityInput): string {
  return typeof identity === 'number'
    ? ['legacy', 'legacy', String(identity)].join(IDENTITY_SEPARATOR)
    : [identity.launchId, identity.layerId, identity.keyId].join(IDENTITY_SEPARATOR);
}

function matchesIdentity(expected: RotoLivePixelIdentity, current: RotoLivePixelIdentity | null): current is RotoLivePixelIdentity {
  return current !== null
    && current.launchId === expected.launchId
    && current.layerId === expected.layerId
    && current.keyId === expected.keyId
    && current.contentRevision === expected.contentRevision
    && current.appFrame === expected.appFrame;
}

export function createRotoLivePixelCacheTransactions(): RotoLivePixelCacheTransactions {
  const revisions = new Map<string, number>();
  const pending = new Map<string, Promise<boolean>>();
  // 52.1 (scrub regression): the produce step (canvas readback + encode) is
  // deferred to the idle/settled microtask, but the navigation flush must copy
  // the canvas BEFORE engine.clear() runs. `snapshot` starts the produce
  // synchronously and stores its result so the pending work reuses it.
  const producers = new Map<string, () => unknown>();
  const snapshots = new Map<string, unknown>();
  // 52.1 (gesture-idle scheduler): the encode (produce) + apply (commit) of a
  // stroke capture is deferred to the idle transition so it never overlaps the
  // next gesture. `forceFlush` is set by the navigation/close/save/export flush
  // paths, which must run the pending captures synchronously.
  let forceFlush = false;
  const idleWaiters = new Set<() => void>();
  onInteractionIdle(() => {
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  });

  const waitForIdleOrForce = (): Promise<void> => {
    if (forceFlush) return Promise.resolve();
    // Preserve the original macrotask yield (setTimeout 0) when already idle so
    // the encode never runs on the microtask queue ahead of pending input.
    if (readInteractionIdle()) return new Promise<void>((resolve) => setTimeout(resolve, 0));
    return new Promise<void>((resolve) => {
      idleWaiters.add(resolve);
    });
  };

  const invalidate = (identity: RotoLivePixelIdentityInput) => {
    const key = identityKey(identity);
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    return revision;
  };

  return {
    capture<T>(captureInput: RotoLivePixelCapture<T> | RotoLegacyLivePixelCapture<T>): Promise<boolean> {
      const legacy = 'sourceFrame' in captureInput;
      const identity: RotoLivePixelIdentity = legacy
        ? { launchId: 'legacy', layerId: 'legacy', keyId: String(captureInput.sourceFrame), contentRevision: 'legacy', appFrame: captureInput.sourceFrame }
        : captureInput.identity;
      const input: RotoLivePixelCapture<T> = legacy
        ? { identity, mutationId: captureInput.mutationId, resolveCurrent: () => identity, produce: captureInput.produce, commit: (value) => captureInput.commit(value), recordPerformance: captureInput.recordPerformance }
        : captureInput;
      const key = identityKey(identity);
      const pixelRevision = invalidate(identity);
      producers.set(key, input.produce as () => unknown);
      const queuedAt = input.recordPerformance ? performance.now() : 0;
      const reject = (outcome: string) => {
        input.recordPerformance?.({ stage: 'cache-revision-check', category: 'sync-cpu', durationMs: 0, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.identity.appFrame, outcome });
        return false;
      };
      const work = (async () => {
        // Produce waits for idle AND the quiet window (Part 3): a mid-burst
        // pause (< CAPTURE_PRODUCE_QUIET_MS) re-enters the loop instead of
        // starting an encode the next stroke would supersede. forceFlush skips
        // the window — save/export/navigation/close must drain immediately.
        for (;;) {
          await waitForIdleOrForce();
          if (revisions.get(key) !== pixelRevision || !matchesIdentity(input.identity, input.resolveCurrent())) return reject('stale-before-produce');
          if (forceFlush) break;
          const quietFor = performance.now() - readLastInteractionAt();
          if (quietFor >= CAPTURE_PRODUCE_QUIET_MS) break;
          await new Promise<void>((resolve) => setTimeout(resolve, CAPTURE_PRODUCE_QUIET_MS - quietFor));
        }
        const producerStartedAt = input.recordPerformance ? performance.now() : 0;
        input.recordPerformance?.({ stage: 'cache-task-handoff', category: 'scheduled-wait', durationMs: producerStartedAt - queuedAt, timestamp: producerStartedAt, mutationId: input.mutationId, sourceFrame: input.identity.appFrame });
        const snapshot = snapshots.get(key) as Promise<T> | T | undefined;
        const value = await (snapshot ?? input.produce());
        input.recordPerformance?.({ stage: 'cache-producer', category: 'async-elapsed', durationMs: performance.now() - producerStartedAt, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.identity.appFrame });
        const current = input.resolveCurrent();
        if (revisions.get(key) !== pixelRevision || !matchesIdentity(input.identity, current)) return reject('stale-before-commit');
        const commitStartedAt = input.recordPerformance ? performance.now() : 0;
        const committed = await input.commit(value, current);
        if (committed === false) return reject('commit-rejected');
        input.recordPerformance?.({ stage: 'cache-accepted-commit', category: 'sync-cpu', durationMs: performance.now() - commitStartedAt, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: current.appFrame, outcome: 'accepted' });
        return true;
      })();
      pending.set(key, work);
      const clearPending = () => {
        // A superseded capture must never touch the LIVE capture's entries:
        // `producers`/`snapshots` hold only the latest produce/snapshot per key,
        // so a stale work settling (stale-before-produce) would otherwise wipe the
        // pre-clear snapshot the live work still needs, forcing it to re-read the
        // cleared canvas and commit an empty frame (52.1 paint-loss on leave).
        if (pending.get(key) !== work) return;
        pending.delete(key);
        producers.delete(key);
        snapshots.delete(key);
      };
      void work.then(clearPending, clearPending);
      return work;
    },
    remove(identity, commit) {
      invalidate(identity);
      commit();
      return true;
    },
    invalidate,
    invalidateLaunch(launchId, layerId) {
      for (const key of new Set([...revisions.keys(), ...pending.keys()])) {
        if (key.startsWith([launchId, layerId, ''].join(IDENTITY_SEPARATOR))) revisions.set(key, (revisions.get(key) ?? 0) + 1);
      }
    },
    revision: (identity) => revisions.get(identityKey(identity)) ?? 0,
    async flush(identity) {
      forceFlush = true;
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
      try {
        if (identity) {
          await pending.get(identityKey(identity));
          return;
        }
        await Promise.all(pending.values());
      } finally {
        forceFlush = false;
      }
    },
    hasPending: (identity) => identity ? pending.has(identityKey(identity)) : pending.size > 0,
    snapshot(identity) {
      const key = identityKey(identity);
      if (!pending.has(key)) return;
      const produce = producers.get(key);
      if (!produce) return;
      snapshots.set(key, produce());
    },
  };
}
