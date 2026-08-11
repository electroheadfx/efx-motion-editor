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
  commit: (value: T, current: RotoLivePixelIdentity) => void | Promise<void>;
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
      const queuedAt = input.recordPerformance ? performance.now() : 0;
      const reject = (outcome: string) => {
        input.recordPerformance?.({ stage: 'cache-revision-check', category: 'sync-cpu', durationMs: 0, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.identity.appFrame, outcome });
        return false;
      };
      const work = (async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const producerStartedAt = input.recordPerformance ? performance.now() : 0;
        input.recordPerformance?.({ stage: 'cache-task-handoff', category: 'scheduled-wait', durationMs: producerStartedAt - queuedAt, timestamp: producerStartedAt, mutationId: input.mutationId, sourceFrame: input.identity.appFrame });
        if (revisions.get(key) !== pixelRevision || !matchesIdentity(input.identity, input.resolveCurrent())) return reject('stale-before-produce');
        const value = await input.produce();
        input.recordPerformance?.({ stage: 'cache-producer', category: 'async-elapsed', durationMs: performance.now() - producerStartedAt, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.identity.appFrame });
        const current = input.resolveCurrent();
        if (revisions.get(key) !== pixelRevision || !matchesIdentity(input.identity, current)) return reject('stale-before-commit');
        const commitStartedAt = input.recordPerformance ? performance.now() : 0;
        await input.commit(value, current);
        input.recordPerformance?.({ stage: 'cache-accepted-commit', category: 'sync-cpu', durationMs: performance.now() - commitStartedAt, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: current.appFrame, outcome: 'accepted' });
        return true;
      })();
      pending.set(key, work);
      const clearPending = () => {
        if (pending.get(key) === work) pending.delete(key);
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
      if (identity) {
        await pending.get(identityKey(identity));
        return;
      }
      await Promise.all(pending.values());
    },
    hasPending: (identity) => identity ? pending.has(identityKey(identity)) : pending.size > 0,
  };
}
