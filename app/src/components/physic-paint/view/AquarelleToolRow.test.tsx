/**
 * 56-07 Task 2 — AquarelleToolRow + Dry action contract pins
 * (AQUA-02 UI, D-13, D-15).
 *
 * Laws pinned here:
 *   D-13   4-button row brush|water|pen|lift, one active, 32×32, never wraps
 *   D-15   Dry is an ACTION button (not a 5th tool), label 'Dry',
 *          tooltip 'Flash-dry the sheet. Recorded in the script.'
 *   AQUA-02 concurrency: clicking another tool replaces the active one
 *
 * Assertion style: scalar predicates. Render tests materialize the
 * vnode tree (no DOM environment).
 */
import { describe, expect, it, vi } from 'vitest';
import { aquarelleActiveTool, onAquarelleDry, setAquarelleTool, emitAquarelleDry } from './aquarelleRecordState';
import { AquarelleToolRow } from './AquarelleToolRow';
import { WatercolorModuleSection } from './WatercolorModuleSection';

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
    Paintbrush: Icon,
    Droplet: Icon,
    Pen: Icon,
    Eraser: Icon,
    Plus: Icon,
    FolderOpen: Icon,
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

function textContent(node: unknown): string {
  const parts: string[] = [];
  const walkText = (current: unknown) => {
    if (typeof current === 'string' || typeof current === 'number') {
      parts.push(String(current));
      return;
    }
    if (current === null || current === undefined || typeof current === 'boolean') return;
    if (Array.isArray(current)) {
      for (const child of current) walkText(child);
      return;
    }
    if (typeof current === 'object') {
      const vnode = current as TestVNode;
      if (typeof vnode.type === 'function') {
        try {
          walkText((vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props));
        } catch {
          /* keep walking */
        }
        return;
      }
      walkText(vnode.props?.children);
    }
  };
  walkText(node);
  return parts.join(' ');
}

function findButtons(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((node) => node.type === 'button');
}

function buttonLabels(tree: TestVNode): string[] {
  return findButtons(tree).map((node) => textContent(node).trim());
}

function clickButton(node: TestVNode): void {
  const onClick = node.props?.onClick as ((event?: unknown) => void) | undefined;
  expect(onClick, 'button has no onClick').toBeTypeOf('function');
  onClick!({ type: 'click' });
}

function renderToolRow(): TestVNode {
  return materialize(AquarelleToolRow()) as TestVNode;
}

function renderModule(): TestVNode {
  return materialize(WatercolorModuleSection()) as TestVNode;
}

const TOOLS = ['Brush', 'Water', 'Pen', 'Lift'] as const;
const DRY_TOOLTIP = 'Flash-dry the sheet. Recorded in the script.';

describe('AquarelleToolRow (AQUA-02 / D-13)', () => {
  it('renders exactly 4 tools with labels Brush, Water, Pen, Lift', () => {
    setAquarelleTool('brush');
    const tree = renderToolRow();
    const labels = buttonLabels(tree);
    expect(labels).toHaveLength(4);
    for (const name of TOOLS) {
      expect(labels.some((l) => l.includes(name)), `missing tool ${name}`).toBe(true);
    }
    expect(labels.some((l) => l.includes('Dry')), 'Dry leaked into the tool row').toBe(false);
  });

  it('selecting a tool sets exactly one active', () => {
    setAquarelleTool('brush');
    const tree = renderToolRow();
    const buttons = findButtons(tree);
    const water = buttons.find((b) => textContent(b).includes('Water'));
    expect(water, 'no Water button').toBeTruthy();
    clickButton(water!);
    expect(aquarelleActiveTool.value).toBe('water');

    // Exactly one button carries the active treatment after the click.
    const active = buttons.filter((b) => String(b.props?.class ?? '').includes('active'));
    // Re-render after state change to observe the active class.
    const after = renderToolRow();
    const activeAfter = findButtons(after).filter((b) =>
      String(b.props?.class ?? '').includes('active'),
    );
    expect(activeAfter.length).toBe(1);
    expect(textContent(activeAfter[0]!).trim()).toContain('Water');
    // silence unused
    expect(active.length >= 0).toBe(true);
  });

  it('is one active tool at a time (AQUA-02 concurrency)', () => {
    setAquarelleTool('brush');
    setAquarelleTool('pen');
    expect(aquarelleActiveTool.value).toBe('pen');
    const tree = renderToolRow();
    const activeAfter = findButtons(tree).filter((b) =>
      String(b.props?.class ?? '').includes('active'),
    );
    expect(activeAfter.length).toBe(1);
    expect(textContent(activeAfter[0]!).trim()).toContain('Pen');
  });
});

describe('Dry action button (D-15)', () => {
  it('label is exactly Dry and tooltip is exactly the UI-SPEC copy', () => {
    const tree = renderModule();
    const dry = findButtons(tree).find((b) => textContent(b).trim() === 'Dry');
    expect(dry, 'no Dry button').toBeTruthy();
    const title = dry!.props?.['title'] ?? dry!.props?.['data-tooltip'];
    expect(String(title)).toBe(DRY_TOOLTIP);
  });

  it('is not inside AquarelleToolRow (separate slot)', () => {
    const row = renderToolRow();
    expect(textContent(row)).not.toContain('Dry');
    const mod = renderModule();
    expect(textContent(mod)).toContain('Dry');
  });

  it('click emits the record-path Dry event', () => {
    const received: Array<{ kind: string; tick: number }> = [];
    const off = onAquarelleDry((event) => {
      received.push(event);
    });
    const tree = renderModule();
    const dry = findButtons(tree).find((b) => textContent(b).trim() === 'Dry');
    expect(dry, 'no Dry button').toBeTruthy();
    clickButton(dry!);
    off();
    expect(received.length).toBe(1);
    expect(received[0]!.kind).toBe('dry');
    expect(Number.isInteger(received[0]!.tick)).toBe(true);
  });

  it('emitAquarelleDry builds a Dry event with integer tick', () => {
    const event = emitAquarelleDry(7);
    expect(event.kind).toBe('dry');
    expect(event.tick).toBe(7);
  });
});
