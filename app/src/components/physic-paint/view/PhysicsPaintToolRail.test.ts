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

function renderRail(): TestVNode {
  const tree = materialize(
    WatercolorRail({
      disabled: false,
      selectAvailable: signal(false),
      rebakeAvailable: signal(false),
      onUndo: () => {},
      onRedo: () => {},
      onClearFrame: () => {},
      onRebakeScript: () => {},
      onActiveColorChanged: () => {},
      onToggleMotionBoundaries: () => {},
    }),
  ) as TestVNode;
  const nav = [...walk(tree)].find((node) => node.type === 'nav');
  expect(nav, 'the rail mounts a nav').toBeTruthy();
  return nav!;
}

function penButton(nav: TestVNode): TestVNode {
  return directChildren(nav).find((node) => node.props?.['data-testid'] === 'aquarelle-vector-pen-toggle')!;
}

function click(node: TestVNode): void {
  const onClick = node.props?.onClick as (() => void) | undefined;
  expect(onClick, 'button has no onClick').toBeTypeOf('function');
  onClick!();
}

afterEach(() => {
  resetForStudioOpen();
  setAquarelleTool('brush');
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
    expect(pen.props?.title).toBe('Vector pen — draw a vector path (V)');
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
    const nav = materialize(
      WatercolorRail({
        disabled: true,
        selectAvailable: signal(false),
        rebakeAvailable: signal(false),
        onUndo: () => {},
        onRedo: () => {},
        onClearFrame: () => {},
        onRebakeScript: () => {},
        onToggleMotionBoundaries: () => {},
      }),
    ) as TestVNode;
    expect(penButton(nav).props?.disabled).toBe(true);
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
