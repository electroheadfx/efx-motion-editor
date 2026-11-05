import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  /** Quick 261105-sk3: no ref state (a live draft) may leak across tests. */
  reset() {
    this.cursor = 0;
    this.slots = [];
    this.pendingEffects = [];
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

beforeEach(() => runtime.reset());

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

  it('allowOutOfRangeEntry accepts typed values and ± steps beyond max, while the track still ends at max', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      value: 50,
      min: 1,
      max: 80,
      step: 1,
      onChange,
      ariaLabel: 'Size',
      allowOutOfRangeEntry: true,
    });
    const value = byClass(tree, 'slider-stepper-value')!;
    (value.props as any).onBlur({ currentTarget: { value: '1200' } });
    expect(onChange).toHaveBeenCalledWith(1200);

    const plus = findAll(tree, (vnode) => vnode.props?.['data-testid'] === 'slider-stepper-plus')[0]!;
    (plus.props as any).onClick({ detail: 0 });
    expect(onChange).toHaveBeenLastCalledWith(51);

    // The track is display-only: regardless of the free entry, dragging
    // cannot produce a value outside the track's own range.
    const track = byClass(tree, 'slider-stepper-track')!;
    track.props.onPointerDown({
      clientX: 100,
      preventDefault: () => {},
      currentTarget: {
        setPointerCapture: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 22, right: 100, bottom: 22 }),
      },
    });
    expect(onChange).toHaveBeenLastCalledWith(80);
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
 * 261024-p5q — mixed display. A mixed stepper shows "Mixed" instead of a
 * number, neutralizes the track, and bypasses the equality guards so the
 * first gesture always writes (the dialog's whole point: an untouched field
 * never writes, but one gesture writes every selected stroke even when it
 * lands on the representative value). Every non-mixed path is byte-identical.
 */
describe('slider-stepper — mixed display and first-gesture commit (261024-p5q)', () => {
  function styleOf(vnode: AnyVNode): Record<string, unknown> {
    return (vnode.props.style ?? {}) as Record<string, unknown>;
  }

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

  it('shows Mixed, carries the mixed class and neutralizes the progress fill', () => {
    const tree = renderStepper({ mixed: true, value: 12, min: 1, max: 80, commitOnRelease: true });
    expect(String(tree.props.class ?? '').split(/\s+/)).toContain('slider-stepper-mixed');

    const value = byClass(tree, 'slider-stepper-value')!;
    expect(value.props.value).toBe('Mixed');

    const progress = byClass(tree, 'slider-stepper-progress')!;
    expect(styleOf(progress).width).toBe('0px');
    // The value box carries the red/italic mixed treatment inline.
    expect(styleOf(value).fontStyle).toBe('italic');
    expect(styleOf(value).color).toBe('#ef4444');
  });

  it('Escape and an invalid entry both restore the Mixed readout', () => {
    const tree = renderStepper({ mixed: true, value: 12, min: 1, max: 80 });
    const value = byClass(tree, 'slider-stepper-value')!;

    const escapeTarget = { value: '12', blur: vi.fn() };
    (value.props as any).onKeyDown({ key: 'Escape', currentTarget: escapeTarget });
    expect(escapeTarget.value).toBe('Mixed');

    const invalidTarget = { value: 'abc', ...value.props };
    (value.props as any).onBlur({ currentTarget: invalidTarget });
    expect(invalidTarget.value).toBe('Mixed');
  });

  it('a track release on the representative value still emits when mixed', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      mixed: true,
      value: 50,
      min: 0,
      max: 100,
      step: 1,
      commitOnRelease: true,
      onChange,
      ariaLabel: 'Opacity',
    });
    const track = trackOf(tree);
    track.props.onPointerDown({
      clientX: 50,
      preventDefault: () => {},
      currentTarget: trackTarget(),
    });
    // No commit while the pointer is down.
    expect(onChange).not.toHaveBeenCalled();
    track.props.onPointerUp();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('typed entry and the plus/minus step emit even at the representative value', () => {
    const onChange = vi.fn();
    const tree = renderStepper({
      mixed: true,
      value: 80,
      min: 1,
      max: 80,
      step: 1,
      onChange,
      ariaLabel: 'Size',
    });
    const value = byClass(tree, 'slider-stepper-value')!;
    const typed = { value: '80' };
    (value.props as any).onBlur({ currentTarget: typed });
    expect(onChange).toHaveBeenCalledWith(80);

    const plus = findAll(tree, (vnode) => vnode.props?.['data-testid'] === 'slider-stepper-plus')[0]!;
    (plus.props as any).onClick({ detail: 0 });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(80);
  });

  it('a non-mixed stepper keeps every equality guard', () => {
    const onChange = vi.fn();
    const tree = renderStepper({ value: 80, min: 1, max: 80, step: 1, onChange, ariaLabel: 'Size' });
    expect(String(tree.props.class ?? '')).not.toContain('slider-stepper-mixed');

    const value = byClass(tree, 'slider-stepper-value')!;
    const typed = { value: '80' };
    (value.props as any).onBlur({ currentTarget: typed });
    expect(onChange).not.toHaveBeenCalled();

    const plus = findAll(tree, (vnode) => vnode.props?.['data-testid'] === 'slider-stepper-plus')[0]!;
    (plus.props as any).onClick({ detail: 0 });
    expect(onChange).not.toHaveBeenCalled();
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

/**
 * quick 261105-sk3 — the live `commitOnInput` opt-in.
 *
 * Default OFF keeps today's blur/Enter-only contract (no `onInput` prop at
 * all). Opted in, every keystroke emits through the same `commitStepperInput`
 * law as blur, while the raw text keeps ownership of the box until
 * blur/Enter/Escape runs the authoritative rewrite.
 */
describe('slider-stepper — commitOnInput live commit (261105-sk3)', () => {
  function valueOf(tree: AnyVNode): AnyVNode {
    const value = byClass(tree, 'slider-stepper-value');
    expect(value, 'value readout').toBeDefined();
    return value!;
  }

  it('defaults off — no onInput handler and value is exactly the display', () => {
    const tree = renderStepper({ value: 13 });
    const value = valueOf(tree);
    expect(value.props.onInput).toBeUndefined();
    expect(value.props.value).toBe('13');
  });

  it('emits on every keystroke through the shared commit law and never rewrites the element text', () => {
    const onChange = vi.fn();
    const tree = renderStepper({ value: 3, min: 1, max: 24, step: 1, commitOnInput: true, onChange, ariaLabel: 'Frames' });
    const value = valueOf(tree);
    expect(typeof value.props.onInput).toBe('function');

    const first = { value: '1' };
    value.props.onInput({ currentTarget: first });
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(first.value).toBe('1');

    const second = { value: '12' };
    value.props.onInput({ currentTarget: second });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(12);
    expect(second.value).toBe('12');
  });

  it('keeps the raw draft across a clamp re-render, then blur rewrites the formatted value and clears it', () => {
    const onChange = vi.fn();
    const first = renderStepper({ value: 5, min: 1, max: 10, step: 1, commitOnInput: true, onChange, ariaLabel: 'Frames' });
    valueOf(first).props.onInput({ currentTarget: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(10);

    // The parent applied 10; the controlled display would say "10", but the
    // draft owns the box while typing.
    const second = renderStepper({ value: 10, min: 1, max: 10, step: 1, commitOnInput: true, onChange, ariaLabel: 'Frames' });
    const reRendered = valueOf(second);
    expect(reRendered.props.value).toBe('99');

    const element = { value: '99' };
    reRendered.props.onBlur({ currentTarget: element });
    expect(element.value).toBe('10');
    expect(onChange).toHaveBeenCalledTimes(1);

    const third = renderStepper({ value: 10, min: 1, max: 10, step: 1, commitOnInput: true, onChange, ariaLabel: 'Frames' });
    expect(valueOf(third).props.value).toBe('10');
  });

  it('emits nothing for empty or unparseable text and keeps the raw text across a re-render', () => {
    const onChange = vi.fn();
    const first = renderStepper({ value: 7, min: 1, max: 24, commitOnInput: true, onChange });
    valueOf(first).props.onInput({ currentTarget: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();

    const second = renderStepper({ value: 7, min: 1, max: 24, commitOnInput: true, onChange });
    const reRendered = valueOf(second);
    expect(reRendered.props.value).toBe('');

    reRendered.props.onInput({ currentTarget: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();

    const third = renderStepper({ value: 7, min: 1, max: 24, commitOnInput: true, onChange });
    expect(valueOf(third).props.value).toBe('abc');
  });

  it('keeps the clamp, step-grid and EU-comma law on the live path', () => {
    const clampedMin = vi.fn();
    const minTree = renderStepper({ value: 5, min: 1, max: 24, step: 1, commitOnInput: true, onChange: clampedMin });
    valueOf(minTree).props.onInput({ currentTarget: { value: '0' } });
    expect(clampedMin).toHaveBeenCalledWith(1);

    const comma = vi.fn();
    const commaTree = renderStepper({ value: 1, min: 0, max: 24, step: 1, commitOnInput: true, onChange: comma });
    valueOf(commaTree).props.onInput({ currentTarget: { value: '2,5' } });
    expect(comma).toHaveBeenCalledWith(3);

    const clampedMax = vi.fn();
    const maxTree = renderStepper({ value: 1, min: 1, max: 24, step: 1, commitOnInput: true, onChange: clampedMax });
    valueOf(maxTree).props.onInput({ currentTarget: { value: '999' } });
    expect(clampedMax).toHaveBeenCalledWith(24);
  });

  it('never emits when the parsed value equals the current value; mixed still bypasses the guard', () => {
    const same = vi.fn();
    const sameTree = renderStepper({ value: 12, min: 1, max: 24, step: 1, commitOnInput: true, onChange: same });
    valueOf(sameTree).props.onInput({ currentTarget: { value: '12' } });
    expect(same).not.toHaveBeenCalled();

    const mixedChange = vi.fn();
    const mixedTree = renderStepper({ value: 12, min: 1, max: 24, step: 1, commitOnInput: true, mixed: true, onChange: mixedChange });
    valueOf(mixedTree).props.onInput({ currentTarget: { value: '12' } });
    expect(mixedChange).toHaveBeenCalledWith(12);
  });

  it('Escape restores the display text and clears the draft', () => {
    const onChange = vi.fn();
    const first = renderStepper({ value: 6, min: 1, max: 24, commitOnInput: true, onChange });
    valueOf(first).props.onInput({ currentTarget: { value: '99' } });

    const second = renderStepper({ value: 24, min: 1, max: 24, commitOnInput: true, onChange });
    const input = valueOf(second);
    expect(input.props.value).toBe('99');

    const target = { value: '99', blur: vi.fn() };
    input.props.onKeyDown({ key: 'Escape', currentTarget: target });
    expect(target.value).toBe('24');
    expect(target.blur).toHaveBeenCalled();

    const third = renderStepper({ value: 24, min: 1, max: 24, commitOnInput: true, onChange });
    expect(valueOf(third).props.value).toBe('24');
  });
});
