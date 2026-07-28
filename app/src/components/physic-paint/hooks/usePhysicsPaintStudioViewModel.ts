import type { PhysicsPaintStudioViewProps } from '../view/PhysicsPaintStudioView';

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
 */
export function createIdentityMemo() {
  let lastDeps: readonly unknown[] | null = null;
  let lastValue: unknown = null;
  return {
    resolve<T>(nextDeps: readonly unknown[], build: () => T): T {
      const previous = lastDeps;
      if (
        previous !== null
        && previous.length === nextDeps.length
        && nextDeps.every((dep, index) => Object.is(dep, previous[index]))
      ) {
        return lastValue as T;
      }
      const value = build();
      lastDeps = nextDeps;
      lastValue = value;
      return value;
    },
  };
}
