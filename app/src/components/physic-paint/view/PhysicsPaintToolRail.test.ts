/**
 * 61-08 Task 1 — the rail's fifth entry (D-05, corrected by C-01 to
 * `WATERCOLOR_RAIL_TOOLS` in `PhysicsPaintToolRail.tsx`).
 *
 * Laws pinned here:
 *   - exactly one `aquarelle-vector-pen-toggle`, after the four paint buttons
 *   - a 1px `#5a5e63` `.physics-paint-rail-separator` sits immediately before it
 *   - `aria-pressed` follows the session signal; the title is the approved copy
 *   - it is a HOST tool: latching it never changes the paint tool
 *
 * Plain `.test.ts`: the repo's vitest config collects `src\/**\/*.test.ts`
 * only, so this walks the vnode tree the same way `AquarelleToolRow.test.tsx`
 * does — without JSX and without a DOM environment.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signal } from '@preact/signals';
import { WatercolorRail } from './PhysicsPaintToolRail';
import { resetForStudioOpen, vectorPenActive } from './vectorPathSession';
import { aquarelleActiveTool, setAquarelleTool } from './aquarelleRecordState';
import { setAquarellePickerLatched } from './aquarelleColorPicker';
import { draftMode, draftPixelsDirty, wireframeMode, wireframeSettleInFlight } from './scriptStrokeEdition';

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, () => {}],
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
  };
});

vi.mock('lucide-preact', () => {
  const Icon = (props: Record<string, unknown>) => ({
    type: 'span',
    props: { 'data-icon': true, ...props },
  });
  return {
    Droplet: Icon,
    Eraser: Icon,
    Paintbrush: Icon,
    Pen: Icon,
    PenTool: Icon,
    Pipette: Icon,
    RefreshCcwDot: Icon,
    Scan: Icon,
    VectorSquare: Icon,
    Wind: Icon,
  };
});

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function materialize(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(materialize);
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  if (typeof vnode.type === 'function') {
    try {
      return materialize((vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props));
    } catch {
      return vnode;
    }
  }
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: childrenOf(vnode).map(materialize),
    },
  } as TestVNode;
}

function* walk(node: unknown): Generator<TestVNode> {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (typeof node !== 'object') return;
  const vnode = node as TestVNode;
  yield vnode;
  for (const child of childrenOf(vnode)) yield* walk(child);
}

/** Direct children in document order, with child arrays flattened one level. */
function directChildren(node: TestVNode): TestVNode[] {
  const out: TestVNode[] = [];
  const push = (value: unknown) => {
    if (value === null || value === undefined || typeof value === 'boolean') return;
    if (Array.isArray(value)) {
      for (const item of value) push(item);
      return;
    }
    if (typeof value === 'object') out.push(value as TestVNode);
  };
  push(node.props?.children);
  return out;
}

/**
 * 61-13 needs one prop the 61-08 rail did not have yet. The 61-08 type stays
 * untouched so the 61-08 test file still typechecks either side of the GREEN
 * commit; `railProps` is a variable (never a fresh literal at the call site),
 * so no excess-property check fires.
 */
type RailPropsWithWireframe = Parameters<typeof WatercolorRail>[0] & { onToggleWireframe?: () => void };

function railProps(overrides: Partial<RailPropsWithWireframe> = {}): RailPropsWithWireframe {
  return {
    disabled: false,
    selectAvailable: signal(false),
    rebakeAvailable: signal(false),
    onClearFrame: () => {},
    onRebakeScript: () => {},
    onActiveColorChanged: () => {},
    onToggleMotionBoundaries: () => {},
    onToggleWireframe: () => {},
    ...overrides,
  };
}

function renderRail(overrides: Partial<RailPropsWithWireframe> = {}): TestVNode {
  const tree = materialize(WatercolorRail(railProps(overrides))) as TestVNode;
  const nav = [...walk(tree)].find((node) => node.type === 'nav');
  expect(nav, 'the rail mounts a nav').toBeTruthy();
  return nav!;
}

function penButton(nav: TestVNode): TestVNode {
  return directChildren(nav).find((node) => node.props?.['data-testid'] === 'aquarelle-vector-pen-toggle')!;
}

function button(nav: TestVNode, testId: string): TestVNode | undefined {
  return directChildren(nav).find((node) => node.props?.['data-testid'] === testId);
}

function click(node: TestVNode): void {
  const onClick = node.props?.onClick as (() => void) | undefined;
  expect(onClick, 'button has no onClick').toBeTypeOf('function');
  onClick!();
}

function resetWireframeSignals(): void {
  wireframeSettleInFlight.value = false;
  wireframeMode.value = false;
  draftPixelsDirty.value = false;
  draftMode.value = false;
}

afterEach(() => {
  resetForStudioOpen();
  setAquarelleTool('brush');
  setAquarellePickerLatched(false);
  resetWireframeSignals();
});

describe('WatercolorRail — the fifth entry (D-05 / C-01)', () => {
  it('renders exactly one vector-pen entry after the four paint buttons', () => {
    const nav = renderRail();
    const ordered = directChildren(nav);
    const matches = [...walk(nav)].filter(
      (node) => node.props?.['data-testid'] === 'aquarelle-vector-pen-toggle',
    );
    expect(matches).toHaveLength(1);

    const paintTitles = ordered.slice(0, 4).map((node) => String(node.props?.title ?? ''));
    expect(paintTitles[0]?.startsWith('Brush')).toBe(true);
    expect(paintTitles[1]?.startsWith('Water')).toBe(true);
    expect(paintTitles[2]?.startsWith('Pen')).toBe(true);
    expect(paintTitles[3]?.startsWith('Eraser')).toBe(true);
    for (const node of ordered.slice(0, 4)) expect(node.type).toBe('button');

    const penIndex = ordered.indexOf(penButton(nav));
    expect(penIndex).toBeGreaterThan(3);
  });

  it('draws the separator immediately before the pen, aria-hidden', () => {
    const nav = renderRail();
    const ordered = directChildren(nav);
    const penIndex = ordered.indexOf(penButton(nav));
    const separator = ordered[penIndex - 1]!;
    expect(separator.type).toBe('div');
    expect(separator.props?.class).toBe('physics-paint-rail-separator');
    expect(separator.props?.['aria-hidden']).toBe('true');
  });

  it('carries the approved label, title and button grammar', () => {
    const nav = renderRail();
    const pen = penButton(nav);
    expect(pen.props?.['aria-label']).toBe('Vector pen');
    // 61-25 (UI-01): the Copywriting Contract's Primary CTA, verbatim — the
    // tooltip is the phase's only teaching surface for the draw law.
    expect(pen.props?.title).toBe(
      'Vector pen (V) — click to place a smooth anchor · hold Alt for a corner · Enter or double-click to finish · click the first anchor to finish there',
    );
    expect(pen.props?.class).toBe('physics-paint-icon-button');
    expect(pen.props?.disabled).toBe(false);
  });

  it('reports aria-pressed from the session and latches on click', () => {
    expect(penButton(renderRail()).props?.['aria-pressed']).toBe(false);

    click(penButton(renderRail()));
    expect(vectorPenActive.value).toBe(true);

    const latched = penButton(renderRail());
    expect(latched.props?.['aria-pressed']).toBe(true);
    expect(String(latched.props?.class)).toContain('active');

    click(latched);
    expect(vectorPenActive.value).toBe(false);
  });

  it('is a host tool: latching it never changes the paint tool', () => {
    setAquarelleTool('brush');
    click(penButton(renderRail()));
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(vectorPenActive.value).toBe(true);
  });

  it('is disabled with the rail', () => {
    const nav = renderRail({ disabled: true });
    expect(penButton(nav).props?.disabled).toBe(true);
  });
});

// 61-13 Task 1: the wireframe latch entry. Position, grammar, aria and the
// settle-in-flight disable window are the rail's whole contribution to D-16;
// the paint-row reasons and the picker disarm arrive with Task 3.
describe('WatercolorRail — the wireframe latch (61-13)', () => {
  it('renders exactly one wireframe entry right after the motion boundary', () => {
    const nav = renderRail();
    const ordered = directChildren(nav);
    const matches = [...walk(nav)].filter(
      (node) => node.props?.['data-testid'] === 'aquarelle-wireframe-toggle',
    );
    expect(matches).toHaveLength(1);

    const motionIndex = ordered.findIndex(
      (node) => node.props?.['data-testid'] === 'aquarelle-motion-boundary-toggle',
    );
    const wireIndex = ordered.findIndex(
      (node) => node.props?.['data-testid'] === 'aquarelle-wireframe-toggle',
    );
    // quick-261112: Dry left for the top-bar action cluster — re-bake follows.
    const rebakeIndex = ordered.findIndex((node) => node.props?.['data-testid'] === 'aquarelle-rebake-script');
    expect(motionIndex, 'the motion boundary is above it').toBeGreaterThan(-1);
    expect(rebakeIndex, 're-bake is below it').toBeGreaterThan(-1);
    expect(wireIndex).toBe(motionIndex + 1);
    expect(rebakeIndex).toBe(wireIndex + 1);
  });

  it('carries the approved wireframe grammar, label and title', () => {
    const wire = button(renderRail(), 'aquarelle-wireframe-toggle');
    expect(wire, 'the wireframe button is rendered').toBeTruthy();
    expect(wire!.type).toBe('button');
    expect(wire!.props?.['aria-label']).toBe('Wireframe');
    expect(wire!.props?.title).toBe(
      "Wireframe — show every stroke's spine and width envelope, and suspend the bake",
    );
    expect(wire!.props?.class).toBe('physics-paint-icon-button');
    expect(wire!.props?.disabled).toBe(false);
    // Icon-only: exactly one vnode child, never a text label.
    const children = childrenOf(wire!);
    expect(children).toHaveLength(1);
    expect(typeof children[0]).toBe('object');
  });

  it('reports aria-pressed from the latch and fires the toggle handler', () => {
    expect(button(renderRail(), 'aquarelle-wireframe-toggle')!.props?.['aria-pressed']).toBe(false);

    const onToggleWireframe = vi.fn();
    click(button(renderRail({ onToggleWireframe }), 'aquarelle-wireframe-toggle')!);
    expect(onToggleWireframe).toHaveBeenCalledTimes(1);

    wireframeMode.value = true;
    const on = button(renderRail(), 'aquarelle-wireframe-toggle')!;
    expect(on.props?.['aria-pressed']).toBe(true);
    expect(String(on.props?.class)).toContain('active');
  });

  it('is disabled with the rail and while the OFF settle is in flight (E6 backstop)', () => {
    expect(button(renderRail({ disabled: true }), 'aquarelle-wireframe-toggle')!.props?.disabled).toBe(true);

    // A second click during the re-bake window must reach nothing: the whole
    // rail shares the in-flight gate, not only the wireframe button.
    wireframeSettleInFlight.value = true;
    const nav = renderRail();
    expect(button(nav, 'aquarelle-wireframe-toggle')!.props?.disabled).toBe(true);
    expect(penButton(nav).props?.disabled).toBe(true);
    expect(button(nav, 'aquarelle-motion-boundary-toggle')!.props?.disabled).toBe(true);
    expect(button(nav, 'aquarelle-rebake-script')!.props?.disabled).toBe(true);
  });
});

// 61-13 Task 3: the wireframe gates. A gated control states WHY it is inert in
// its `title` instead of starting an implicit exit (D-16); every reason below
// is the approved literal. E7 overflow (flagged assumption): the wireframe
// overlay draws every stroke on the sheet with no cap — the Wave 0 probe's
// measured reference count (10 strokes at 1920x1080, 61-01 result.json) is the
// threshold; a viewport limit is the stated fallback ONLY if a real sheet
// exceeds it, so the row stays open until then.
describe('WatercolorRail — the wireframe gates (61-13 Task 3)', () => {
  it('disables the whole paint row with its reason and renders it deselected', () => {
    wireframeMode.value = true;
    const nav = renderRail();
    const paint = directChildren(nav).slice(0, 4);
    expect(paint.map((node) => node.props?.title)).toEqual([
      'Brush (B) — turn wireframe off to paint',
      'Water (W) — turn wireframe off to paint',
      'Pen (P) — turn wireframe off to paint',
      'Eraser (E) — turn wireframe off to paint',
    ]);
    for (const node of paint) {
      expect(node.props?.disabled).toBe(true);
      expect(node.props?.['aria-pressed']).toBe(false);
      expect(String(node.props?.class)).not.toContain('active');
    }
  });

  it('keeps the picker disarmed, not disabled (Dry now lives in the top bar)', () => {
    wireframeMode.value = true;
    const nav = renderRail();
    // 61-25 (UI-05 / §5): the contract disarms the picker; it never removes the
    // function, so the button stays pressable with its shipped title.
    const picker = button(nav, 'aquarelle-picker-toggle')!;
    expect(picker.props?.disabled).toBe(false);
    expect(picker.props?.title).toBe(
      'Picker (I) — click the canvas to sample the color under the cursor · hold Alt for a temporary picker',
    );
  });

  it('keeps the vector pen and the latch itself available — an empty sheet never locks', () => {
    wireframeMode.value = true;
    const nav = renderRail();
    expect(penButton(nav).props?.disabled).toBe(false);
    const toggle = button(nav, 'aquarelle-wireframe-toggle')!;
    expect(toggle.props?.disabled).toBe(false);
    expect(toggle.props?.['aria-pressed']).toBe(true);
  });

  it('restores the paint row when the latch clears', () => {
    wireframeMode.value = true;
    renderRail();
    wireframeMode.value = false;
    const nav = renderRail();
    const paint = directChildren(nav).slice(0, 4);
    expect(paint.map((node) => node.props?.title)).toEqual([
      'Brush (B)',
      'Water (W) — needs standing water',
      'Pen (P)',
      'Eraser (E)',
    ]);
    expect(paint[0]!.props?.disabled).toBe(false);
  });

  // 61-18 (D-16): the rail's visible half of the Select law. 61-17 already
  // refuses the entry at the ONE choke point; this suite pins the rendered
  // props — a click case would prove nothing because click() fires onClick
  // directly and ignores `disabled`.
  it('disables Select with its reason while the wireframe is on', () => {
    wireframeMode.value = true;
    const nav = renderRail({ selectAvailable: signal(true) });
    const select = button(nav, 'aquarelle-select-toggle')!;
    expect(select, 'the Select button is rendered').toBeTruthy();
    // `selectAvailable` is TRUE: the disable reason is the wireframe gate alone.
    expect(select.props?.disabled).toBe(true);
    expect(select.props?.title).toBe('Select (A) — turn wireframe off to select');
    // The rendered bindings are the shipped ones — only the inert state and
    // its reason change.
    expect(select.props?.['aria-label']).toBe('Select');
    expect(select.props?.['aria-pressed']).toBe(false);
    expect(select.props?.onClick).toBeTypeOf('function');
  });

  it('restores the shipped Select copy and enablement when the latch clears', () => {
    const SHIPPED_SELECT_TITLE = 'Select (A) — click or A toggles Select on/off and returns to the previous tool · Shift+A enters Select and selects every stroke (press again to deselect all) · Tab cycles the filter Paint → Eraser → All while Select is on · Drag moves the selected stroke · Corner handles scale · Edge handles resize width or height · Top handle rotates · Backspace deletes the selected stroke · < sends the selected stroke one step back · > one step forward';
    const enabled = button(renderRail({ selectAvailable: signal(true) }), 'aquarelle-select-toggle')!;
    expect(enabled.props?.title).toBe(SHIPPED_SELECT_TITLE);
    expect(enabled.props?.disabled).toBe(false);

    // selectAvailable still gates it — with the shipped title intact.
    const unavailable = button(renderRail({ selectAvailable: signal(false) }), 'aquarelle-select-toggle')!;
    expect(unavailable.props?.title).toBe(SHIPPED_SELECT_TITLE);
    expect(unavailable.props?.disabled).toBe(true);

    // railDisabled still gates it — with the shipped title intact.
    const railOff = button(
      renderRail({ disabled: true, selectAvailable: signal(true) }),
      'aquarelle-select-toggle',
    )!;
    expect(railOff.props?.title).toBe(SHIPPED_SELECT_TITLE);
    expect(railOff.props?.disabled).toBe(true);
  });
});

// 61-25 (UI-01 / UI-05): gap closure over the 61-UI-REVIEW warnings. The pen
// tooltip is the Copywriting Contract's Primary CTA verbatim; under wireframe
// the Picker is DISARMED (pressable, shipped title) while every depositing
// control stays disabled with its reason.
describe('WatercolorRail — 61-25 UI-01/UI-05', () => {
  const PEN_TOOLTIP =
    'Vector pen (V) — click to place a smooth anchor · hold Alt for a corner · Enter or double-click to finish · click the first anchor to finish there';

  it('teaches the whole draw law in the pen tooltip, character-for-character', () => {
    const pen = penButton(renderRail());
    expect(pen.props?.title).toBe(PEN_TOOLTIP);
    // The accessible name is unchanged — only the tooltip carries the law.
    expect(pen.props?.['aria-label']).toBe('Vector pen');
  });

  it('keeps the Picker pressable under wireframe with its shipped title and session verdict', () => {
    wireframeMode.value = true;
    const idle = button(renderRail(), 'aquarelle-picker-toggle')!;
    expect(idle, 'the picker is rendered').toBeTruthy();
    expect(idle.props?.disabled).toBe(false);
    expect(idle.props?.title).toBe(
      'Picker (I) — click the canvas to sample the color under the cursor · hold Alt for a temporary picker',
    );
    expect(idle.props?.['aria-pressed']).toBe(false);
    expect(String(idle.props?.class)).not.toContain('active');

    // Arming under wireframe lands exactly as outside it: the rendered
    // aria-pressed is the one armed verdict.
    setAquarellePickerLatched(true);
    const armed = button(renderRail(), 'aquarelle-picker-toggle')!;
    expect(armed.props?.disabled).toBe(false);
    expect(armed.props?.['aria-pressed']).toBe(true);
    expect(String(armed.props?.class)).toContain('active');
  });

  it('still disables every depositing control under wireframe and leaves the pen available', () => {
    wireframeMode.value = true;
    const nav = renderRail();
    const paint = directChildren(nav).slice(0, 4);
    expect(paint.map((node) => node.props?.title)).toEqual([
      'Brush (B) — turn wireframe off to paint',
      'Water (W) — turn wireframe off to paint',
      'Pen (P) — turn wireframe off to paint',
      'Eraser (E) — turn wireframe off to paint',
    ]);
    for (const node of paint) expect(node.props?.disabled).toBe(true);
    expect(penButton(nav).props?.disabled).toBe(false);
  });
});

describe('the rail separator rule (physicsPaintStudio.css)', () => {
  it('is the derived 1px #5a5e63 rule, 21px wide', () => {
    const css = readFileSync(resolve(__dirname, '../physicsPaintStudio.css'), 'utf8');
    const ruleStart = css.indexOf('.physics-paint-rail-separator');
    expect(ruleStart, 'the separator rule exists').toBeGreaterThan(-1);
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart));
    expect(rule).toContain('width: 21px');
    expect(rule).toContain('height: 1px');
    expect(rule).toContain('background: #5a5e63');
    expect(rule).toContain('margin: 1px 0');
  });
});
