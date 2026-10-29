/**
 * 56-07 Task 2 — AquarelleToolRow + Dry action contract pins
 * (AQUA-02 UI, D-13, D-15).
 *
 * Laws pinned here:
 *   D-13   4-button row brush|water|pen|lift, one active, 32×32, never wraps
 *   D-15   Dry is an ACTION button (not a 5th tool), label 'Dry',
 *          tooltip 'Flash-dry the sheet (F). Recorded in the script.'
 *   AQUA-02 concurrency: clicking another tool replaces the active one
 *
 * Assertion style: scalar predicates. Render tests materialize the
 * vnode tree (no DOM environment).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aquarelleActiveTool, onAquarelleDry, setAquarelleTool, emitAquarelleDry, aquarelleRecordClock } from './aquarelleRecordState';
import { setAquarelleSelectMode } from './aquarelleStrokeSelection';
import { clearAquarelleWetPaint, setAquarelleHasWetPaint } from './aquarelleWetPaintGate';
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

const TOOLS = ['Brush', 'Water', 'Pen', 'Eraser'] as const;
const DRY_TOOLTIP = 'Flash-dry the sheet (F). Recorded in the script.';

describe('AquarelleToolRow (AQUA-02 / D-13)', () => {
  it('renders exactly 4 tools with labels Brush, Water, Pen, Eraser', () => {
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
    // 261029-lel: the Water entry is gated on live standing water — open the
    // gate for this case, which is about selection, not about the gate.
    setAquarelleHasWetPaint(true);
    try {
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
    } finally {
      setAquarelleTool('brush');
      setAquarelleHasWetPaint(false);
    }
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

  it('deselects the paint tool while select mode is on (261022-pim)', () => {
    setAquarelleTool('brush');
    setAquarelleSelectMode(true);
    try {
      const selectedTree = renderToolRow();
      const activeInSelect = findButtons(selectedTree).filter((b) =>
        String(b.props?.class ?? '').includes('active'),
      );
      // Select/Move owns the active state — no paint tool is highlighted.
      expect(activeInSelect).toHaveLength(0);
    } finally {
      setAquarelleSelectMode(false);
    }
    const paintTree = renderToolRow();
    const activeInPaint = findButtons(paintTree).filter((b) =>
      String(b.props?.class ?? '').includes('active'),
    );
    expect(activeInPaint).toHaveLength(1);
    expect(textContent(activeInPaint[0]!).trim()).toContain('Brush');
  });
});

describe('Water gate (261029-lel)', () => {
  const toolButton = (tree: TestVNode, id: string) =>
    findButtons(tree).find((b) => b.props?.['data-testid'] === `aquarelle-tool-${id}`);

  afterEach(() => {
    clearAquarelleWetPaint();
    setAquarelleTool('brush');
  });

  it('greys Water and refuses its click while the sheet is dry', () => {
    clearAquarelleWetPaint();
    setAquarelleTool('brush');
    const tree = renderToolRow();
    const water = toolButton(tree, 'water');
    expect(water, 'no Water button').toBeTruthy();
    expect(water!.props.disabled).toBe(true);
    expect(water!.props.title).toBe('Water (W) — needs standing water');

    clickButton(water!);
    expect(aquarelleActiveTool.value).toBe('brush');

    // Brush / Pen / Eraser never read the gate.
    for (const id of ['brush', 'pen', 'lift']) {
      expect(toolButton(tree, id)!.props.disabled, `${id} must stay ungated`).toBeFalsy();
    }
  });

  it('enables Water and lets the click select it while the sheet is wet', () => {
    setAquarelleHasWetPaint(true);
    setAquarelleTool('brush');
    const tree = renderToolRow();
    const water = toolButton(tree, 'water')!;
    expect(water.props.disabled).toBeFalsy();
    // The gate-closed tooltip is absent on a wet sheet.
    expect(water.props.title).toBe('Water (W)');

    clickButton(water);
    expect(aquarelleActiveTool.value).toBe('water');
  });
});

describe('Dry action button (D-15)', () => {
  // 261017-w4x I-06 (Q4): Dry lives ONLY in the left vertical tool rail
  // (WatercolorRail in PhysicsPaintToolRail.tsx). The module section no longer
  // mounts a Dry control — pins source-scan the rail, which is byte-untouched.
  it('rail Dry carries the UI-SPEC tooltip and the aquarelle-dry testid', () => {
    const railSource = readFileSync(resolve(__dirname, 'PhysicsPaintToolRail.tsx'), 'utf8');
    expect(railSource.indexOf('data-testid="aquarelle-dry"'), 'rail must host the Dry entry point').toBeGreaterThan(-1);
    expect(railSource.indexOf(`title="${DRY_TOOLTIP}"`), 'rail Dry keeps the UI-SPEC copy').toBeGreaterThan(-1);
  });

  it('is not inside AquarelleToolRow nor the module section (rail-only slot)', () => {
    const row = renderToolRow();
    expect(textContent(row)).not.toContain('Dry');
    const mod = renderModule();
    // Note: "Dry speed" is a param slider inside AquarelleGlobalsPanel and stays —
    // pins target the Dry control (testid / button label), not the substring.
    expect(
      findButtons(mod).some((b) => b.props?.['data-testid'] === 'aquarelle-dry'),
      'module must not host the Dry control',
    ).toBe(false);
    expect(
      findButtons(mod).some((b) => textContent(b).trim() === 'Dry'),
      'module must not host a Dry action button',
    ).toBe(false);
    const railSource = readFileSync(resolve(__dirname, 'PhysicsPaintToolRail.tsx'), 'utf8');
    expect(railSource.indexOf('data-testid="aquarelle-dry"'), 'rail keeps the Dry control').toBeGreaterThan(-1);
  });

  it('rail click path emits the record-path Dry event', () => {
    const railSource = readFileSync(resolve(__dirname, 'PhysicsPaintToolRail.tsx'), 'utf8');
    expect(railSource.indexOf('emitAquarelleDry(aquarelleRecordClock())'), 'rail must fire the record-clock Dry').toBeGreaterThan(-1);
    // The module section must not be a second Dry emitter (comment-stripped so
    // docs naming the rail seam never trip the negative scan).
    const moduleSource = readFileSync(resolve(__dirname, 'WatercolorModuleSection.tsx'), 'utf8');
    const moduleBody = moduleSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(moduleBody.indexOf('emitAquarelleDry'), 'module section must not emit Dry').toBe(-1);
    // Pure emit path stays recorded (D-15 seam).
    const received: Array<{ kind: string; tick: number }> = [];
    const off = onAquarelleDry((event) => {
      received.push(event);
    });
    const event = emitAquarelleDry(aquarelleRecordClock());
    off();
    expect(received.length).toBe(1);
    expect(received[0]!.kind).toBe('dry');
    expect(event.kind).toBe('dry');
    expect(Number.isInteger(event.tick)).toBe(true);
  });

  it('emitAquarelleDry builds a Dry event with integer tick', () => {
    const event = emitAquarelleDry(7);
    expect(event.kind).toBe('dry');
    expect(event.tick).toBe(7);
  });
});
