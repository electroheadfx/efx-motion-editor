import type { PhysicsPaintStudioViewProps } from '../view/PhysicsPaintStudioView';
import { isPhysicsPaintProfilingEnabled } from '../performance/physicsPaintPerformanceTrace';

export type PhysicsPaintStudioViewModel = PhysicsPaintStudioViewProps;

export function buildPhysicsPaintStudioViewModel(props: PhysicsPaintStudioViewProps): PhysicsPaintStudioViewModel {
  return props;
}

export function usePhysicsPaintStudioViewModel(props: PhysicsPaintStudioViewProps): PhysicsPaintStudioViewModel {
  return buildPhysicsPaintStudioViewModel(props);
}

/**
 * 38-11: pure identity memo — the component-scope twin of the 38.1-07 store
 * structural memo. Single-entry last-winner cache: if nextDeps has the same
 * length and every element Object.is-equals the previous entry, the cached
 * value is returned WITHOUT calling build; otherwise build runs and becomes
 * the new cached entry. No hooks, no module-level state — each Studio holds
 * its own instances in refs, so multiple Studios can never cross-pollinate.
 *
 * 260905-ibd follow-up (G-52-9): optional dep-diff diagnostics. When a
 * debugLabel + per-dep names are provided and profiling is enabled, a
 * re-resolve logs WHICH deps changed identity — an unstable dep (fresh object
 * per render) otherwise silently busts the memo every frame with no test
 * coverage able to see it. Throttled: first 20 busts, then one per 60.
 */
export function createIdentityMemo(debug?: { label: string }) {
  let lastDeps: readonly unknown[] | null = null;
  let lastValue: unknown = null;
  let bustCount = 0;
  return {
    resolve<T>(nextDeps: readonly unknown[], build: () => T, debugNames?: readonly string[]): T {
      const previous = lastDeps;
      if (
        previous !== null
        && previous.length === nextDeps.length
        && nextDeps.every((dep, index) => Object.is(dep, previous[index]))
      ) {
        return lastValue as T;
      }
      if (
        debug !== undefined
        && debugNames !== undefined
        && previous !== null
        && previous.length === nextDeps.length
        && isPhysicsPaintProfilingEnabled()
      ) {
        const changed = debugNames.filter((_, index) => index < nextDeps.length && !Object.is(nextDeps[index], previous[index]));
        bustCount += 1;
        if (bustCount <= 20 || bustCount % 60 === 0) {
          console.warn(`[physics-paint] ${debug.label} memo re-resolved (#${bustCount}) — changed deps: ${changed.join(', ') || '(length mismatch on first resolve)'}`);
        }
      }
      const value = build();
      lastDeps = nextDeps;
      lastValue = value;
      return value;
    },
  };
}
