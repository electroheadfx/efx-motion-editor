import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { SliderStepper } from './SliderStepper';

type AnyVNode = VNode<Record<string, any>>;

class HookRuntime {
  private cursor = 0;
  private slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }> = [];
  private pendingEffects: Array<() => void> = [];

  beginRender() {
    this.cursor = 0;
    this.pendingEffects = [];
  }

  finishRender() {
    for (const effect of this.pendingEffects) effect();
  }

  useRef<T>(initial: T) {
    const index = this.cursor++;
    const slot = this.slots[index] ??= { value: { current: initial } };
    return slot.value as { current: T };
  }

  useEffect(effect: () => void | (() => void), deps?: unknown[]) {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (deps && slot.deps && slot.deps.length === deps.length && deps.every((value, i) => Object.is(value, slot.deps![i]))) return;
    this.pendingEffects.push(() => {
      slot.cleanup?.();
      const cleanup = effect();
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      slot.deps = deps;
    });
  }
}

let runtime = new HookRuntime();

vi.mock('preact/hooks', () => ({
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

function renderStepper(props: Partial<Parameters<typeof SliderStepper>[0]> = {}): AnyVNode {
  runtime.beginRender();
  const tree = SliderStepper({
    label: 'POSITION (FRAMES)',
    value: 13,
    onChange: vi.fn(),
    ariaLabel: 'Position',
    ...props,
  } as Parameters<typeof SliderStepper>[0]) as AnyVNode;
  runtime.finishRender();
  return tree;
}

function findAll(node: unknown, predicate: (vnode: AnyVNode) => boolean): AnyVNode[] {
  const found: AnyVNode[] = [];
  const walk = (current: unknown) => {
    if (Array.isArray(current)) {
      for (const child of current) walk(child);
      return;
    }
    if (!current || typeof current !== 'object') return;
    const vnode = current as AnyVNode;
    if (predicate(vnode)) found.push(vnode);
    if (typeof vnode.type === 'function') return;
    walk(vnode.props?.children);
  };
  walk(node);
  return found;
}

function byClass(tree: AnyVNode, className: string): AnyVNode | undefined {
  return findAll(tree, (vnode) =>
    typeof vnode.type !== 'function' && String(vnode.props?.class ?? '').split(/\s+/).includes(className),
  )[0];
}

/**
 * SPECS/slider-stepper — the blended chrome pins ("BLENDED — VALUE ON TOP").
 *
 * Exactly ONE element draws a box (the 22px bar). The `−` / `+` glyphs are bare
 * text cells with no box keys of their own, and the value sits ON TOP of the bar
 * in the label row — never inside it.
 */
describe('slider-stepper — blended chrome pins', () => {
  function styleOf(vnode: AnyVNode): Record<string, unknown> {
    return (vnode.props.style ?? {}) as Record<string, unknown>;
  }

  /** Outlined / bordered containers — the mock's chrome. Track paint is not chrome. */
  const CHROME_KEYS = ['border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'] as const;

  function drawsChrome(vnode: AnyVNode): boolean {
    return CHROME_KEYS.some((key) => {
      const value = styleOf(vnode)[key];
      return value !== undefined && value !== 'none';
    });
  }

  it('borders only the value box — the bar and the glyph cells are borderless', () => {
    const tree = renderStepper({});
    const chrome = findAll(tree, drawsChrome).map((vnode) => vnode.props.class);
    expect(chrome).toEqual(['slider-stepper-value']);

    const bar = byClass(tree, 'slider-stepper-bar');
    expect(styleOf(bar!).border).toBeUndefined();
    // The bar still carries its fill + radius so it reads as one soft pill.
    expect(styleOf(bar!).background).toBeDefined();
    expect(styleOf(bar!).borderRadius).toBeDefined();
  });

  it('puts bare − / + text glyphs in the bar — no boxed buttons', () => {
    const tree = renderStepper({});
    const minus = byClass(tree, 'slider-stepper-cell');
    expect(minus, 'minus cell').toBeDefined();
    const cells = findAll(tree, (vnode) =>
      typeof vnode.type !== 'function' && String(vnode.props?.class ?? '').split(/\s+/).includes('slider-stepper-cell'),
    );
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(drawsChrome(cell), 'glyph cell must carry no box chrome').toBe(false);
    }
    // The glyphs are the mock's MINUS SIGN / plus text, not icon nodes.
    expect(cells[0].props.children).toBe('−');
    expect(cells[1].props.children).toBe('+');
  });

  it('puts the value readout in the label row ON TOP of the bar, not inside it', () => {
    const tree = renderStepper({ label: 'GAIN' });
    const labelRow = byClass(tree, 'slider-stepper-label-row');
    const bar = byClass(tree, 'slider-stepper-bar');
    expect(labelRow).toBeDefined();
    expect(bar).toBeDefined();

    const value = byClass(tree, 'slider-stepper-value');
    expect(value, 'value readout').toBeDefined();
    expect(value!.type).toBe('input');

    // The bar holds exactly [cell, track, cell] — no value input inside it.
    const barKids = (bar!.props.children as unknown[]).filter(Boolean).map((child) => (child as AnyVNode).props.class);
    expect(barKids).toEqual(['slider-stepper-cell', 'slider-stepper-track', 'slider-stepper-cell']);
  });

  it('renders the label in the label cell', () => {
    const tree = renderStepper({ label: 'Gain (0 = unity)' });
    expect((byClass(tree, 'slider-stepper-label') as AnyVNode).props.children).toBe('Gain (0 = unity)');
    expect(byClass(tree, 'slider-stepper-hint')).toBeUndefined();
  });

  it('paints the track as line + progress + knob', () => {
    const tree = renderStepper({});
    expect(byClass(tree, 'slider-stepper-track-line')).toBeDefined();
    expect(byClass(tree, 'slider-stepper-progress')).toBeDefined();
    expect(byClass(tree, 'slider-stepper-knob')).toBeDefined();
  });

  it('centers line, progress and knob on the track midline — the −/+ glyph row', () => {
    // UAT: fixed px offsets left the rail ~1px above the glyph centers; the
    // rail must track the midline whatever the bar/track height renders at.
    const tree = renderStepper({});
    expect(styleOf(byClass(tree, 'slider-stepper-track-line')!).top).toBe('calc(50% - 2px)');
    expect(styleOf(byClass(tree, 'slider-stepper-progress')!).top).toBe('calc(50% - 2px)');
    expect(styleOf(byClass(tree, 'slider-stepper-knob')!).top).toBe('calc(50% - 5.5px)');
  });

  it('renders the below slot as a second row under the bar (fade-curve select)', () => {
    const tree = renderStepper({ below: <select class="curve-select" /> });
    const field = tree;
    const kids = (field.props.children as unknown[]).filter(Boolean);
    expect(kids).toHaveLength(3);
    const below = kids[2] as AnyVNode;
    expect(below.props.class).toBe('slider-stepper-below');
    expect((below.props.children as AnyVNode).props.class).toBe('curve-select');

    // The bar row itself never holds the select — it is not a trailing sibling.
    const barRow = byClass(tree, 'slider-stepper-bar-row');
    const rawBarKids = barRow!.props.children;
    const barKids = (Array.isArray(rawBarKids) ? rawBarKids : [rawBarKids]).filter(Boolean);
    expect(barKids).toHaveLength(1);
    expect((barKids[0] as AnyVNode).props.class).toBe('slider-stepper-bar');
  });

  it('omits the below row entirely when no slot is passed', () => {
    const tree = renderStepper({});
    expect(byClass(tree, 'slider-stepper-below')).toBeUndefined();
  });
});

describe('slider-stepper — track range and commit law stay separate', () => {
  it('sliderMax widens the TRACK without clamping typed commits (Position has no upper clamp)', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      value: 13,
      min: 0,
      sliderMax: 120,
      onChange,
      ariaLabel: 'Position',
    });
    const value = byClass(tree, 'slider-stepper-value') as AnyVNode;
    // A typed 999 commits — the track range is display-only.
    (value.props as any).onBlur({ currentTarget: { value: '999' } });
    expect(onChange).toHaveBeenCalledWith(999);
  });

  it('max still clamps typed commits when the field declares one', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      value: 0,
      min: -100,
      max: 100,
      step: 5,
      onChange,
      ariaLabel: 'Gain',
    });
    const value = byClass(tree, 'slider-stepper-value') as AnyVNode;
    (value.props as any).onBlur({ currentTarget: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('an unparseable entry reverts to the displayed value', () => {
    const onChange = vi.fn();
    const tree = renderStepper({ value: 13, min: 0, onChange });
    const value = byClass(tree, 'slider-stepper-value') as AnyVNode;
    const element = { value: 'abc', ...value.props };
    (value.props as any).onBlur({ currentTarget: element });
    expect(onChange).not.toHaveBeenCalled();
    expect(element.value).toBe('13');
  });
});

/**
 * 261010-nzu — color-only token migration. Every color slot resolves through a
 * sidebar theme var whose CSS fallback is the exact pre-quick Studio literal,
 * so a surface that does not define the vars (Studio) renders byte-identical
 * colors. Pin the full `var(TOKEN, literal)` string — not just the token name —
 * so a fallback drift is a test failure, not a silent Studio regression.
 */
describe('slider-stepper — theme tokens carry Studio fallbacks (261010-nzu)', () => {
  function styleOf(vnode: AnyVNode): Record<string, unknown> {
    return (vnode.props.style ?? {}) as Record<string, unknown>;
  }

  it('bar background is the input-bg var with the pre-quick bar literal as fallback', () => {
    const tree = renderStepper({});
    expect(styleOf(byClass(tree, 'slider-stepper-bar')!).background).toBe(
      'var(--sidebar-input-bg, #4c4e51)',
    );
  });

  it('value box background and border carry the pre-quick translucent Studio literals', () => {
    const tree = renderStepper({});
    const value = byClass(tree, 'slider-stepper-value')!;
    expect(styleOf(value).background).toBe('var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))');
    expect(styleOf(value).border).toBe(
      '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
    );
  });

  it('label color is the text-secondary var with the pre-quick label literal as fallback', () => {
    const tree = renderStepper({});
    expect(styleOf(byClass(tree, 'slider-stepper-label')!).color).toBe(
      'var(--sidebar-text-secondary, #9aa5b1)',
    );
  });

  it('knob background is the slider-thumb var with the pre-quick knob literal as fallback', () => {
    const tree = renderStepper({});
    const knob = byClass(tree, 'slider-stepper-knob')!;
    expect(styleOf(knob).background).toBe('var(--sidebar-slider-thumb, #f1f3f5)');
    // Geometry/chrome pins from the one-box law stay untouched.
    expect(styleOf(knob).outline).toBe('1px solid #ffffff');
    expect(styleOf(knob).boxShadow).toBe('0 1px 3px rgba(0, 0, 0, 0.4)');
  });

  it('track line and progress carry the border-unselected and accent vars', () => {
    const tree = renderStepper({});
    expect(styleOf(byClass(tree, 'slider-stepper-track-line')!).background).toBe(
      'var(--sidebar-border-unselected, #363c47)',
    );
    expect(styleOf(byClass(tree, 'slider-stepper-progress')!).background).toBe(
      'var(--color-accent, #2f67e8)',
    );
  });

  it('value text color stays on the already-themed text-primary var', () => {
    const tree = renderStepper({});
    expect(styleOf(byClass(tree, 'slider-stepper-value')!).color).toBe(
      'var(--sidebar-text-primary, #eceff2)',
    );
  });
});

describe('slider-stepper — commitOnRelease (48-06)', () => {
  function trackOf(tree: AnyVNode): AnyVNode {
    const track = byClass(tree, 'slider-stepper-track');
    expect(track).toBeDefined();
    return track!;
  }

  /** A 100px-wide track starting at x=0 — `clientX` maps straight to a fraction. */
  function trackTarget(width = 100) {
    return {
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height: 22, right: width, bottom: 22 }),
    };
  }

  it('defers the commit to pointerup and emits exactly once', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      commitOnRelease: true,
      onChange,
      ariaLabel: 'Opacity',
    });
    const track = trackOf(tree);

    // A drag on the track never commits while the pointer is down.
    track.props.onPointerDown({
      clientX: 80,
      preventDefault: () => {},
      currentTarget: trackTarget(),
    });
    expect(onChange).not.toHaveBeenCalled();

    track.props.onPointerUp();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0]).toBeGreaterThan(0.5);
  });

  it('without commitOnRelease the track commits on every move', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      value: 0,
      min: 0,
      max: 100,
      step: 1,
      onChange,
      ariaLabel: 'Shape detail',
    });
    const track = trackOf(tree);
    track.props.onPointerDown({
      clientX: 40,
      preventDefault: () => {},
      currentTarget: trackTarget(),
    });
    track.props.onPointerMove({ clientX: 40, currentTarget: trackTarget() });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBe(40);
    track.props.onPointerUp();
  });
});
