/**
 * 56-02 (D-01, D-03): the top-bar module switcher — one shared component, one
 * active-module signal.
 *
 * 261027-klx: @efxlab/efx-watercolor is the only paint engine, so the Brush
 * slot is gone. Water color is the only selectable and active module; Krita is
 * a native-disabled inert placeholder that never writes the signal.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as NumericStepper.test.tsx / PhysicsPaintRightPanel.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeModule, setActiveModule, type ActiveModule } from './activeModule';
import { ModuleSwitcher } from './ModuleSwitcher';

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, () => {}],
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

function renderSwitcher(props: { lockedModule?: ActiveModule | null } = {}): TestVNode {
  return materialize(ModuleSwitcher(props)) as TestVNode;
}

function findButtons(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((node) => node.type === 'button');
}

function buttonLabels(tree: TestVNode): string[] {
  return findButtons(tree).map((node) => {
    const children = childrenOf(node);
    return children.map((c) => (typeof c === 'string' ? c : '')).join('');
  });
}

function clickButton(node: TestVNode): void {
  const onClick = node.props?.onClick as ((event?: unknown) => void) | undefined;
  expect(onClick, 'button has no onClick').toBeTypeOf('function');
  onClick!({ type: 'click' });
}

beforeEach(() => {
  activeModule.value = 'watercolor';
});

afterEach(() => {
  activeModule.value = 'watercolor';
});

describe('ModuleSwitcher', () => {
  it('renders the two remaining segments Water color and Krita', () => {
    const tree = renderSwitcher();
    expect(buttonLabels(tree)).toEqual(['Water color', 'Krita']);
  });

  it('makes Krita an inert native-disabled slot and Water color the only active slot', () => {
    const tree = renderSwitcher();
    const [watercolor, krita] = findButtons(tree);

    expect(krita!.props?.disabled).toBe(true);
    expect(krita!.props?.['aria-disabled']).toBeUndefined();
    const kritaClass = String(krita!.props?.class ?? '');
    expect(kritaClass).toContain('module-switcher-slot-inert');
    expect(kritaClass).not.toMatch(/\bactive\b/);
    expect(krita!.props?.['aria-pressed']).toBeUndefined();

    expect(watercolor!.props?.disabled).toBe(false);
    expect(watercolor!.props?.['aria-disabled']).toBeUndefined();
    expect(String(watercolor!.props?.class ?? '')).toMatch(/\bactive\b/);
    expect(watercolor!.props?.['aria-pressed']).toBe(true);
  });

  it('clicking the inert Krita slot leaves the module at watercolor', () => {
    const buttons = findButtons(renderSwitcher());
    clickButton(buttons[1]!);
    expect(activeModule.value).toBe('watercolor');
  });

  it('clicking Water color keeps the module at watercolor', () => {
    const buttons = findButtons(renderSwitcher());
    clickButton(buttons[0]!);
    expect(activeModule.value).toBe('watercolor');
  });

  it('Krita segment carries the Coming in v2.1.0 tooltip and is never active', () => {
    const tree = renderSwitcher();
    const krita = findButtons(tree)[1]!;
    expect(krita.props?.title).toBe('Coming in v2.1.0');
    expect(String(krita.props?.class ?? '')).not.toMatch(/\bactive\b/);
  });

  it('switching module never calls a document or timeline store setter', () => {
    // The switch handler routes through setActiveModule — spy on the signal
    // write path and assert no other store receives a mutation. The component
    // is a pure leaf; any store import would be a contract violation.
    const moduleSource = readFileSync(
      resolve(__dirname, 'ModuleSwitcher.tsx'),
      'utf8',
    );
    // No store imports — the only state the switcher touches is activeModule.
    expect(moduleSource).not.toMatch(/from\s+['"].*stores\//);
    expect(moduleSource).not.toMatch(/projectStore|timelineStore|layerStore|paintStore|physicPaintStore/);
    expect(moduleSource).toContain('setActiveModule(slot.id)');
    expect(moduleSource).not.toContain('activeModule.value = id');

    // Behavioral: clicking each slot mutates nothing away from watercolor.
    const before: ActiveModule = activeModule.value;
    const buttons = findButtons(renderSwitcher());
    clickButton(buttons[0]!);
    expect(activeModule.value).toBe('watercolor');
    clickButton(buttons[1]!);
    expect(activeModule.value).toBe('watercolor');
    // Restore
    activeModule.value = before;
  });
});

describe('Studio ownership lock in the single-engine world (261027-klx)', () => {
  it('never disables or locks Water color for a passed watercolor lock', () => {
    const tree = renderSwitcher({ lockedModule: 'watercolor' });
    const watercolor = findButtons(tree)[0]!;
    expect(watercolor.props?.disabled).toBe(false);
    const cls = String(watercolor.props?.class ?? '');
    expect(cls).not.toContain('module-switcher-slot-locked');
    expect(cls).toMatch(/\bactive\b/);
  });

  it('keeps Water color enabled when no owner is locked', () => {
    const tree = renderSwitcher({ lockedModule: null });
    const watercolor = findButtons(tree)[0]!;
    expect(watercolor.props?.disabled).toBe(false);
    expect(watercolor.props?.['aria-disabled']).toBeUndefined();
    expect(String(watercolor.props?.class ?? '')).not.toContain('module-switcher-slot-locked');
  });

  it('keeps Krita inert and never locked', () => {
    const tree = renderSwitcher({ lockedModule: 'watercolor' });
    const krita = findButtons(tree)[1]!;
    expect(krita.props?.disabled).toBe(true);
    const cls = String(krita.props?.class ?? '');
    expect(cls).toContain('module-switcher-slot-inert');
    expect(cls).not.toContain('module-switcher-slot-locked');
    expect(krita.props?.['aria-disabled']).toBeUndefined();
  });

  it('removes the inert Krita slot from the tab order via the native disabled attribute', () => {
    const tree = renderSwitcher();
    const krita = findButtons(tree)[1]!;
    expect(krita.props?.disabled).toBe(true);
    expect(krita.props?.onKeyDown).toBeUndefined();
  });
});

describe('activeModule signal', () => {
  it('exposes watercolor as the only module and writes it back', () => {
    expect(activeModule.value).toBe('watercolor');
    setActiveModule('watercolor');
    expect(activeModule.value).toBe('watercolor');
    expect(typeof activeModule).toBe('object');
    expect('value' in activeModule).toBe(true);
  });

  it('stays mounted in the main Toolbar only — the Studio top bar uses the brush picker', () => {
    const toolbarSource = readFileSync(
      resolve(__dirname, '../layout/Toolbar.tsx'),
      'utf8',
    );
    const topBarSource = readFileSync(
      resolve(__dirname, '../physic-paint/view/PhysicsPaintTopBar.tsx'),
      'utf8',
    );
    expect(toolbarSource).toMatch(/from\s+['"].*shared\/ModuleSwitcher['"]/);
    expect(toolbarSource).toMatch(/<ModuleSwitcher\s*\/>/);
    // 261027-gh9g: the module switcher left the Studio top bar entirely —
    // the enlarged brush trigger owns that slot.
    expect(topBarSource).not.toContain('ModuleSwitcher');
    expect(topBarSource).toContain('TopBarBrushTrigger');
  });
});
