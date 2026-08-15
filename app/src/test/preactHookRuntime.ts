type EffectCleanup = () => void;
type HookSlot = {
  value?: unknown;
  deps?: readonly unknown[];
  cleanup?: EffectCleanup;
};

function haveEqualDependencies(previous: readonly unknown[] | undefined, next: readonly unknown[]): boolean {
  return Boolean(
    previous
      && previous.length === next.length
      && previous.every((value, index) => Object.is(value, next[index])),
  );
}

/**
 * Minimal direct-component hook runtime for Node tests.
 *
 * It executes state/ref/memo/callback/effect behavior only. It deliberately does
 * not render child components or emulate Preact reconciliation, keys, or instance
 * ownership.
 */
export class PreactHookRuntime {
  private cursor = 0;
  private readonly slots: HookSlot[] = [];
  private pendingEffects: Array<() => void> = [];
  private unmounted = false;

  reset(): void {
    for (const slot of this.slots) slot.cleanup?.();
    this.slots.length = 0;
    this.cursor = 0;
    this.pendingEffects = [];
    this.unmounted = false;
  }

  beginRender(): void {
    this.cursor = 0;
    this.pendingEffects = [];
  }

  flushEffects(): void {
    if (this.unmounted) {
      this.pendingEffects = [];
      return;
    }

    const effects = this.pendingEffects;
    this.pendingEffects = [];
    for (const effect of effects) effect();
  }

  useState<T>(initial: T | (() => T)): [T, (next: T | ((current: T) => T)) => void] {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (!('value' in slot)) {
      slot.value = typeof initial === 'function' ? (initial as () => T)() : initial;
    }

    return [slot.value as T, (next) => {
      slot.value = typeof next === 'function'
        ? (next as (current: T) => T)(slot.value as T)
        : next;
    }];
  }

  useRef<T>(initial: T): { current: T } {
    const index = this.cursor++;
    const slot = this.slots[index] ??= { value: { current: initial } };
    return slot.value as { current: T };
  }

  useMemo<T>(factory: () => T, deps: readonly unknown[]): T {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (!haveEqualDependencies(slot.deps, deps)) {
      slot.value = factory();
      slot.deps = [...deps];
    }
    return slot.value as T;
  }

  useCallback<T>(callback: T, deps: readonly unknown[]): T {
    return this.useMemo(() => callback, deps);
  }

  useEffect(effect: () => void | EffectCleanup, deps?: readonly unknown[]): void {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (deps && haveEqualDependencies(slot.deps, deps)) return;

    this.pendingEffects.push(() => {
      const priorCleanup = slot.cleanup;
      slot.cleanup = undefined;
      priorCleanup?.();

      const cleanup = effect();
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      slot.deps = deps ? [...deps] : undefined;
    });
  }

  unmount(): void {
    if (this.unmounted) return;
    this.unmounted = true;
    this.pendingEffects = [];

    for (const slot of this.slots) {
      const cleanup = slot.cleanup;
      slot.cleanup = undefined;
      cleanup?.();
    }
  }
}
