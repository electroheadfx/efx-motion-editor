import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = vi.hoisted(() => ({
  values: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  cursor: 0,
  reset() {
    this.values = [];
    this.refs = [];
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useState: <Value>(initial: Value | (() => Value)) => {
    const index = hookRuntime.cursor++;
    if (!(index in hookRuntime.values)) hookRuntime.values[index] = typeof initial === 'function' ? (initial as () => Value)() : initial;
    return [hookRuntime.values[index] as Value, (value: Value | ((current: Value) => Value)) => {
      hookRuntime.values[index] = typeof value === 'function'
        ? (value as (current: Value) => Value)(hookRuntime.values[index] as Value)
        : value;
    }] as const;
  },
  useRef: <Value>(initial: Value) => {
    const index = hookRuntime.cursor++;
    hookRuntime.refs[index] ??= { current: initial };
    return hookRuntime.refs[index] as { current: Value };
  },
  useCallback: <Value>(callback: Value) => callback,
  useEffect: () => {},
}));

import { STYLED_TOOLTIP_DELAY_MS, useStyledTooltip } from './PhysicsPaintStyledTooltip';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintStyledTooltip.tsx');
const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const source = () => readFileSync(sourcePath, 'utf8');
const css = () => readFileSync(cssPath, 'utf8');

type KeydownHandler = (event: { key: string }) => void;

function installWindowStub() {
  const listeners = new Map<string, Set<KeydownHandler>>();
  vi.stubGlobal('window', {
    addEventListener: (type: string, handler: KeydownHandler) => {
      const bucket = listeners.get(type) ?? new Set<KeydownHandler>();
      bucket.add(handler);
      listeners.set(type, bucket);
    },
    removeEventListener: (type: string, handler: KeydownHandler) => {
      listeners.get(type)?.delete(handler);
    },
  });
  return {
    dispatchKeydown(key: string) {
      listeners.get('keydown')?.forEach((handler) => handler({ key }));
    },
    keydownListenerCount() {
      return listeners.get('keydown')?.size ?? 0;
    },
  };
}

function createHarness() {
  const render = () => {
    hookRuntime.cursor = 0;
    return useStyledTooltip();
  };
  return { render };
}

describe('useStyledTooltip', () => {
  let windowStub: ReturnType<typeof installWindowStub>;

  beforeEach(() => {
    vi.useFakeTimers();
    hookRuntime.reset();
    windowStub = installWindowStub();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows only after exactly 1000ms of pointer hover, never instantly (D-17)', () => {
    expect(STYLED_TOOLTIP_DELAY_MS).toBe(1000);
    const harness = createHarness();
    const initial = harness.render();
    expect(initial.visible).toBe(false);
    initial.onPointerEnter();
    expect(harness.render().visible).toBe(false);
    vi.advanceTimersByTime(999);
    expect(harness.render().visible).toBe(false);
    vi.advanceTimersByTime(1);
    expect(harness.render().visible).toBe(true);
  });

  it('shows immediately on keyboard focus and hides on blur (D-14)', () => {
    const harness = createHarness();
    const initial = harness.render();
    initial.onFocus();
    expect(harness.render().visible).toBe(true);
    expect(windowStub.keydownListenerCount()).toBe(1);
    harness.render().onBlur();
    expect(harness.render().visible).toBe(false);
    expect(windowStub.keydownListenerCount()).toBe(0);
  });

  it('hides on Escape while visible and never appears when the pointer leaves before 1000ms', () => {
    const harness = createHarness();
    const initial = harness.render();
    initial.onPointerEnter();
    vi.advanceTimersByTime(500);
    harness.render().onPointerLeave();
    vi.advanceTimersByTime(1000);
    expect(harness.render().visible).toBe(false);

    harness.render().onPointerEnter();
    vi.advanceTimersByTime(1000);
    expect(harness.render().visible).toBe(true);
    windowStub.dispatchKeydown('Escape');
    expect(harness.render().visible).toBe(false);
    expect(windowStub.keydownListenerCount()).toBe(0);
  });

  it('hides via the imperative hide() used on activation', () => {
    const harness = createHarness();
    harness.render().onFocus();
    expect(harness.render().visible).toBe(true);
    harness.render().hide();
    expect(harness.render().visible).toBe(false);
  });
});

describe('PhysicsPaintStyledTooltip surface contract', () => {
  it('renders a physics-paint-styled-tooltip surface with pointer-events: none and text children only', () => {
    const code = source();
    expect(code).toContain('physics-paint-styled-tooltip');
    expect(code).toContain('role="tooltip"');
    expect(code).not.toContain('dangerouslySetInnerHTML');
    const styles = css();
    const block = styles.slice(styles.indexOf('.physics-paint-styled-tooltip'));
    const surface = block.slice(0, block.indexOf('}'));
    expect(surface).toContain('pointer-events: none');
    expect(surface).toContain('background: #62666d');
    expect(surface).toContain('border: 0');
    expect(surface).toContain('border-radius: 4px');
    expect(surface).not.toContain('border-radius: 999px');
  });
});
