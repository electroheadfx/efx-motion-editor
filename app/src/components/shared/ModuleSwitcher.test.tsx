/**
 * 56-02 (D-01, D-03): the top-bar module switcher — one shared component, one
 * active-module signal.
 *
 * 261027-gh9: under the WATERCOLOR_ONLY gate Brush AND Krita are native
 * disabled inert slots; Water color is the only selectable and active module
 * and no owner lock can disable it. The `lockedModule` prop and every
 * Brush/Krita surface stay in the tree for reversibility.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as NumericStepper.test.tsx / PhysicsPaintRightPanel.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeModule, setActiveModule, WATERCOLOR_ONLY, type ActiveModule } from './activeModule';
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
  it('renders three segments with the exact labels Brush, Water color, Krita', () => {
    const tree = renderSwitcher();
    const labels = buttonLabels(tree);
    expect(labels).toEqual(['Brush', 'Water color', 'Krita']);
  });

  it('replaces the inert Brush segment with the leading slot when one is passed (261027-gh9f)', () => {
    const tree = materialize(ModuleSwitcher({ leadingSlot: 'THUMB' })) as TestVNode;
    expect(buttonLabels(tree)).toEqual(['Water color', 'Krita']);
    const leading = [...walk(tree)].find(
      (node) => String(node.props?.class ?? '') === 'module-switcher-leading',
    );
    expect(leading, 'leading slot wrapper must render first').toBeTruthy();
  });

  it('makes Brush and Krita inert native-disabled slots and Water color the only active slot', () => {
    const tree = renderSwitcher();
    const [brush, watercolor, krita] = findButtons(tree);

    for (const inert of [brush!, krita!]) {
      expect(inert.props?.disabled).toBe(true);
      expect(inert.props?.['aria-disabled']).toBeUndefined();
      const cls = String(inert.props?.class ?? '');
      expect(cls).toContain('module-switcher-slot-inert');
      expect(cls).not.toMatch(/\bactive\b/);
      expect(inert.props?.['aria-pressed']).toBeUndefined();
    }
    expect(brush!.props?.title).toBe('Unavailable — Water color only');

    expect(watercolor!.props?.disabled).toBe(false);
    expect(watercolor!.props?.['aria-disabled']).toBeUndefined();
    expect(String(watercolor!.props?.class ?? '')).toMatch(/\bactive\b/);
    expect(watercolor!.props?.['aria-pressed']).toBe(true);
  });

  it('clicking the inert Brush and Krita slots leaves the module at watercolor', () => {
    const buttons = findButtons(renderSwitcher());
    clickButton(buttons[0]!);
    expect(activeModule.value).toBe('watercolor');
    clickButton(buttons[2]!);
    expect(activeModule.value).toBe('watercolor');
  });

  it('clicking Water color keeps the module at watercolor', () => {
    const buttons = findButtons(renderSwitcher());
    clickButton(buttons[1]!);
    expect(activeModule.value).toBe('watercolor');
  });

  it('Krita segment carries the Coming in v2.1.0 tooltip and is never active', () => {
    const tree = renderSwitcher();
    const krita = findButtons(tree)[2]!;
    expect(krita.props?.title).toBe('Coming in v2.1.0');
    // Krita is display-only: its class must never carry the active state.
    const cls = String(krita.props?.class ?? '');
    expect(cls).not.toMatch(/\bactive\b/);
  });

  it('ignores a raw brush signal value: Water color stays the only active slot', () => {
    // Hostile input: a stale/hand-edited write lands the raw signal on 'brush'.
    activeModule.value = 'brush';
    const tree = renderSwitcher();
    const [brush, watercolor, krita] = findButtons(tree);
    expect(String(watercolor!.props?.class ?? '')).toMatch(/\bactive\b/);
    for (const slot of [brush!, krita!]) {
      expect(slot.props?.disabled).toBe(true);
      expect(String(slot.props?.class ?? '')).not.toMatch(/\bactive\b/);
    }
    // The setter clamps the hostile value back home.
    setActiveModule('brush');
    expect(activeModule.value).toBe('watercolor');
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
    const tree = renderSwitcher();
    const buttons = findButtons(tree);
    clickButton(buttons[0]!);
    expect(activeModule.value).toBe('watercolor');
    clickButton(buttons[1]!);
    expect(activeModule.value).toBe('watercolor');
    clickButton(buttons[2]!);
    expect(activeModule.value).toBe('watercolor');
    // Restore
    activeModule.value = before;
  });
});

describe('Studio ownership lock under the watercolor-only gate (261027-gh9)', () => {
  it('never disables or locks Water color for a passed watercolor lock', () => {
    const tree = renderSwitcher({ lockedModule: 'watercolor' });
    const watercolor = findButtons(tree)[1]!;
    expect(watercolor.props?.disabled).toBe(false);
    const cls = String(watercolor.props?.class ?? '');
    expect(cls).not.toContain('module-switcher-slot-locked');
    expect(cls).toMatch(/\bactive\b/);
  });

  it('renders Brush inert (not locked) for a passed brush lock — the seam outranks the lock', () => {
    const tree = renderSwitcher({ lockedModule: 'brush' });
    const brush = findButtons(tree)[0]!;
    expect(brush.props?.disabled).toBe(true);
    const cls = String(brush.props?.class ?? '');
    expect(cls).toContain('module-switcher-slot-inert');
    expect(cls).not.toContain('module-switcher-slot-locked');
    expect(brush.props?.title).toBe('Unavailable — Water color only');
  });

  it('clicking a locked or inert slot leaves activeModule unchanged', () => {
    const tree = renderSwitcher({ lockedModule: 'watercolor' });
    const buttons = findButtons(tree);
    clickButton(buttons[1]!);
    expect(activeModule.value).toBe('watercolor');

    clickButton(buttons[0]!);
    expect(activeModule.value).toBe('watercolor');
  });

  it('removes the inert Brush slot from the tab order via the native disabled attribute', () => {
    const tree = renderSwitcher({ lockedModule: 'brush' });
    const brush = findButtons(tree)[0]!;
    // Native disabled: no keyboard activation, no focus, no custom key handler.
    expect(brush.props?.disabled).toBe(true);
    expect(brush.props?.onKeyDown).toBeUndefined();
  });

  it('keeps Water color enabled when no owner is locked', () => {
    const tree = renderSwitcher({ lockedModule: null });
    const watercolor = findButtons(tree)[1]!;
    expect(watercolor.props?.disabled).toBe(false);
    expect(watercolor.props?.['aria-disabled']).toBeUndefined();
    expect(String(watercolor.props?.class ?? '')).not.toContain('module-switcher-slot-locked');
  });

  it('keeps the gated behavior without the prop', () => {
    const tree = renderSwitcher();
    const [brush, watercolor] = findButtons(tree);
    expect(brush!.props?.disabled).toBe(true);
    expect(watercolor!.props?.disabled).toBe(false);
    expect(watercolor!.props?.['aria-disabled']).toBeUndefined();
    clickButton(watercolor!);
    expect(activeModule.value).toBe('watercolor');
  });

  it('keeps Krita inert and never locked', () => {
    const tree = renderSwitcher({ lockedModule: 'watercolor' });
    const krita = findButtons(tree)[2]!;
    expect(krita.props?.disabled).toBe(true);
    const cls = String(krita.props?.class ?? '');
    expect(cls).toContain('module-switcher-slot-inert');
    expect(cls).not.toContain('module-switcher-slot-locked');
    expect(krita.props?.['aria-disabled']).toBeUndefined();
  });
});

describe('activeModule signal', () => {
  it('exports the seam on and clamps a brush write through setActiveModule', () => {
    expect(WATERCOLOR_ONLY).toBe(true);
    expect(activeModule.value).toBe('watercolor');
    setActiveModule('brush');
    expect(activeModule.value).toBe('watercolor');
    expect(typeof activeModule).toBe('object');
    expect('value' in activeModule).toBe(true);
  });

  it('is the single shared signal imported by both top-bar mounts', () => {
    const toolbarSource = readFileSync(
      resolve(__dirname, '../layout/Toolbar.tsx'),
      'utf8',
    );
    const topBarSource = readFileSync(
      resolve(__dirname, '../physic-paint/view/PhysicsPaintTopBar.tsx'),
      'utf8',
    );
    expect(toolbarSource).toMatch(/from\s+['"].*shared\/ModuleSwitcher['"]/);
    expect(topBarSource).toMatch(/from\s+['"].*shared\/ModuleSwitcher['"]/);
    expect(toolbarSource).toMatch(/<ModuleSwitcher\s*\/>/);
    // quick-261025-awl: the Studio mount passes the ownership lock; the
    // Toolbar mount stays bare (different realm, no prop -> fully enabled).
    expect(topBarSource).not.toMatch(/<ModuleSwitcher\s*\/>/);
    // 261027-gh9f: the Studio mount also passes the leading brush thumbnail,
    // so the element spans multiple lines; the ownership lock stays pinned.
    expect(topBarSource).toMatch(
      /<ModuleSwitcher\s+lockedModule=\{lockedModuleForOwner\(frameScriptOwner\.value\)\}/,
    );
  });
});
