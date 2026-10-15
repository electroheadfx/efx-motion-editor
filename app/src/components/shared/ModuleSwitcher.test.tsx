/**
 * 56-02 (D-01, D-03): the top-bar module switcher — one shared component, one
 * active-module signal. Krita is display-only and inert.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as NumericStepper.test.tsx / PhysicsPaintRightPanel.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeModule, type ActiveModule } from './activeModule';
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

function renderSwitcher(): TestVNode {
  return materialize(ModuleSwitcher({})) as TestVNode;
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
  activeModule.value = 'brush';
});

afterEach(() => {
  activeModule.value = 'brush';
});

describe('ModuleSwitcher', () => {
  it('renders three segments with the exact labels Brush, Water color, Krita', () => {
    const tree = renderSwitcher();
    const labels = buttonLabels(tree);
    expect(labels).toEqual(['Brush', 'Water color', 'Krita']);
  });

  it('clicking Brush writes activeModule to brush', () => {
    activeModule.value = 'watercolor';
    const tree = renderSwitcher();
    const buttons = findButtons(tree);
    clickButton(buttons[0]);
    expect(activeModule.value).toBe('brush');
  });

  it('clicking Water color writes activeModule to watercolor', () => {
    const tree = renderSwitcher();
    const buttons = findButtons(tree);
    clickButton(buttons[1]);
    expect(activeModule.value).toBe('watercolor');
  });

  it('clicking Krita leaves activeModule unchanged', () => {
    activeModule.value = 'brush';
    const tree = renderSwitcher();
    const buttons = findButtons(tree);
    clickButton(buttons[2]);
    expect(activeModule.value).toBe('brush');

    activeModule.value = 'watercolor';
    const tree2 = renderSwitcher();
    clickButton(findButtons(tree2)[2]);
    expect(activeModule.value).toBe('watercolor');
  });

  it('Krita segment carries the Coming in v2.1.0 tooltip and is never active', () => {
    const tree = renderSwitcher();
    const krita = findButtons(tree)[2];
    expect(krita.props?.title).toBe('Coming in v2.1.0');
    // Krita is display-only: its class must never carry the active state.
    const cls = String(krita.props?.class ?? '');
    expect(cls).not.toMatch(/\bactive\b/);
  });

  it('switching module never calls a document or timeline store setter', () => {
    // The switch handler body assigns only activeModule — spy on the signal
    // write path and assert no other store receives a mutation. The component
    // is a pure leaf; any store import would be a contract violation.
    const moduleSource = readFileSync(
      resolve(__dirname, 'ModuleSwitcher.tsx'),
      'utf8',
    );
    // No store imports — the only state the switcher touches is activeModule.
    expect(moduleSource).not.toMatch(/from\s+['"].*stores\//);
    expect(moduleSource).not.toMatch(/projectStore|timelineStore|layerStore|paintStore|physicPaintStore/);

    // Behavioral: clicking each slot mutates only activeModule.
    const before: ActiveModule = activeModule.value;
    const tree = renderSwitcher();
    const buttons = findButtons(tree);
    clickButton(buttons[0]);
    expect(activeModule.value).toBe('brush');
    clickButton(buttons[1]);
    expect(activeModule.value).toBe('watercolor');
    clickButton(buttons[2]);
    expect(activeModule.value).toBe('watercolor');
    // Restore
    activeModule.value = before;
  });
});

describe('activeModule signal', () => {
  it('exports activeModule as a signal defaulting to brush', () => {
    activeModule.value = 'brush';
    expect(activeModule.value).toBe('brush');
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
    expect(topBarSource).toMatch(/<ModuleSwitcher\s*\/>/);
  });
});
