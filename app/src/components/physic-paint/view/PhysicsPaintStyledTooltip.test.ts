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

import {
  computeTooltipPlacement,
  STYLED_TOOLTIP_DELAY_MS,
  TOOLTIP_PILL_MAX_WIDTH,
  TOOLTIP_VIEWPORT_MARGIN,
  useStyledTooltip,
} from './PhysicsPaintStyledTooltip';

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

describe('computeTooltipPlacement — viewport placement contract (38-08, D-11/D-13, post-UAT)', () => {
  const pill = { width: 120, height: 24 };
  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  }) as DOMRect;

  beforeEach(() => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 700 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps every UI region to its opposite-side direction when room is available (TP-1)', () => {
    const anchor = rect(400, 300, 40, 20);
    expect(computeTooltipPlacement(anchor, 'bottom', pill).direction).toBe('above');
    expect(computeTooltipPlacement(anchor, 'top', pill).direction).toBe('below');
    expect(computeTooltipPlacement(anchor, 'left-edge', pill).direction).toBe('right');
    expect(computeTooltipPlacement(anchor, 'right-edge', pill).direction).toBe('left');
  });

  it('flips each preferred direction when its side lacks room (TP-2)', () => {
    expect(computeTooltipPlacement(rect(400, 10, 40, 20), 'bottom', pill).direction).toBe('below');
    expect(computeTooltipPlacement(rect(400, 670, 40, 20), 'top', pill).direction).toBe('above');
    expect(computeTooltipPlacement(rect(10, 300, 40, 20), 'right-edge', pill).direction).toBe('right');
    expect(computeTooltipPlacement(rect(950, 300, 40, 20), 'left-edge', pill).direction).toBe('left');
  });

  it('clamps pill coordinates to the exact 8px viewport bounds (TP-3)', () => {
    expect(computeTooltipPlacement(rect(2, 300, 40, 20), 'bottom', pill).left).toBe(8);
    expect(computeTooltipPlacement(rect(978, 300, 20, 20), 'bottom', pill).left).toBe(872);
    expect(computeTooltipPlacement(rect(400, 0, 40, 20), 'left-edge', pill).top).toBe(8);
    expect(computeTooltipPlacement(rect(400, 690, 40, 10), 'left-edge', pill).top).toBe(668);
  });

  it('derives notch offsets from the anchor after pill clamping (TP-4)', () => {
    const centered = computeTooltipPlacement(rect(400, 300, 40, 20), 'bottom', pill);
    expect(centered.left).toBe(360);
    expect(centered.notchOffset).toBe(60);

    const horizontallyClamped = computeTooltipPlacement(rect(2, 300, 40, 20), 'bottom', pill);
    expect(horizontallyClamped.left).toBe(8);
    expect(horizontallyClamped.notchOffset).toBe(14);

    const verticallyClamped = computeTooltipPlacement(
      rect(400, 2, 40, 40),
      'left-edge',
      { width: 120, height: 60 },
    );
    expect(verticallyClamped.direction).toBe('right');
    expect(verticallyClamped.top).toBe(8);
    expect(verticallyClamped.notchOffset).toBe(14);
  });
});

describe('PhysicsPaintStyledTooltip surface contract', () => {
  it('renders a physics-paint-styled-tooltip surface with pointer-events: none and text children only', () => {
    const code = source();
    expect(code).toContain('physics-paint-styled-tooltip');
    expect(code).toContain('role="tooltip"');
    expect(code).not.toContain('dangerouslySetInnerHTML');
    const styles = css();
    const tooltipCss = styles.slice(
      styles.indexOf('.physics-paint-styled-tooltip'),
      styles.indexOf('.physics-paint-roto-interpolation-controls'),
    );
    const surface = tooltipCss.slice(0, tooltipCss.indexOf('}'));
    expect(TOOLTIP_VIEWPORT_MARGIN).toBe(8);
    expect(TOOLTIP_PILL_MAX_WIDTH).toBe(280);
    expect(surface).toContain('position: fixed');
    expect(surface).toContain('max-width: 280px');
    expect(surface).toContain('max-height: 96px');
    expect(surface).toContain('white-space: normal');
    expect(surface).toContain('pointer-events: none');
    expect(surface).toContain('background: #62666d');
    expect(surface).toContain('border: 0');
    expect(surface).toContain('border-radius: 4px');
    expect(surface).toContain('font-size: 12px');
    expect(surface).toContain('font-weight: 400');
    expect(surface).not.toContain('border-radius: 999px');
    expect(tooltipCss).not.toContain('white-space: nowrap');
    expect(tooltipCss).not.toContain('text-overflow: ellipsis');
    expect(tooltipCss).toContain('.physics-paint-styled-tooltip-notch');
    expect(tooltipCss).toContain('.physics-paint-styled-tooltip--above');
    expect(tooltipCss).toContain('.physics-paint-styled-tooltip--below');
    expect(tooltipCss).toContain('.physics-paint-styled-tooltip--left');
    expect(tooltipCss).toContain('.physics-paint-styled-tooltip--right');
    expect(tooltipCss).toContain('border-top: 6px solid #62666d');
    expect(tooltipCss).toContain('border-bottom: 6px solid #62666d');
    expect(tooltipCss).toContain('border-left: 6px solid #62666d');
    expect(tooltipCss).toContain('border-right: 6px solid #62666d');
    expect(tooltipCss.match(/#62666d/g)).toHaveLength(5);
  });
});
