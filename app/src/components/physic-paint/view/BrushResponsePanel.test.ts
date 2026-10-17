/**
 * 261017-wmw I-02 — BrushResponsePanel contract pins.
 *
 * Laws pinned here (one file per visual unit):
 *   the "Brush response" collapsible lives here (not in the globals panel)
 *   placeholder "Select a brush to edit response" when no tip is selected
 *   toggle reveals the 8 MULTIPLIER_FIELDS rows when a tip is selected
 *   multiplier band stays 0.5–2.0, default 1.0
 *   effective-value readout = global × multiplier (D-08 formula unchanged)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  MULTIPLIER_DEFAULT,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  aquarelleSelectedTipId,
  effectiveMultiplierValue,
  selectAquarelleTip,
  setAquarelleMultiplier,
  aquarelleToolOverrides,
} from './aquarelleRecordState';
import { BrushResponsePanel } from './BrushResponsePanel';

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

function renderPanel(): TestVNode {
  return materialize(BrushResponsePanel()) as TestVNode;
}

function collectLabels(tree: TestVNode): string[] {
  const labels: string[] = [];
  for (const node of walk(tree)) {
    const label = node.props?.['label'];
    if (typeof label === 'string') labels.push(label);
    const aria = node.props?.['ariaLabel'] ?? node.props?.['aria-label'];
    if (typeof aria === 'string') labels.push(aria);
  }
  return labels;
}

function findButtonByTestId(tree: TestVNode, testId: string): TestVNode | undefined {
  return [...walk(tree)].find(
    (n) => n.type === 'button' && n.props?.['data-testid'] === testId,
  );
}

const MULTIPLIER_LABELS = [
  'Tip',
  'Aspect',
  'Rotation',
  'SizeCurve',
  'Scatter',
  'Capacity',
  'Grain',
  'Wet round',
] as const;

describe('BrushResponsePanel placeholder and toggle (I-02)', () => {
  it('shows the Select-a-brush placeholder when no tip is selected', () => {
    aquarelleSelectedTipId.value = null;
    const tree = renderPanel();
    expect(textContent(tree)).toContain('Select a brush to edit response');
  });

  it('renders the Brush response collapsible header, collapsed by default', () => {
    aquarelleSelectedTipId.value = null;
    const tree = renderPanel();
    const text = textContent(tree);
    expect(text).toContain('Brush response');
    const toggle = findButtonByTestId(tree, 'brush-response-toggle');
    expect(toggle, 'response toggle must render').toBeTruthy();
    // Collapsed by default → no multiplier rows in the tree yet.
    const labels = collectLabels(tree);
    expect(labels.some((l) => l === 'Tip'), 'Tip multiplier visible while collapsed').toBe(false);
  });

  it('toggle reveals the 8 multiplier rows when a tip is selected', () => {
    selectAquarelleTip('wc/round-medium');
    let tree = renderPanel();
    const toggle = findButtonByTestId(tree, 'brush-response-toggle');
    expect(toggle, 'response toggle must render').toBeTruthy();
    // Open the block (local brushResponseOpen signal).
    const onClick = (toggle!.props as { onClick?: () => void }).onClick;
    onClick!();
    tree = renderPanel();

    const labels = collectLabels(tree);
    for (const name of MULTIPLIER_LABELS) {
      expect(labels.some((l) => l === name), `missing multiplier label ${name}`).toBe(true);
    }
    // Effective readout is present for each multiplier field.
    const testIds = [...walk(tree)].map((n) => n.props?.['data-testid']);
    for (const field of ['tip', 'aspect', 'rotation', 'sizeCurve', 'scatter', 'capacity', 'grain', 'wetRound']) {
      expect(testIds, `missing effective readout for ${field}`).toContain(`effective-${field}`);
    }
  });
});

describe('BrushResponsePanel multiplier band and effective readout (D-08)', () => {
  it('multiplier band is 0.5–2.0 with default 1.0', () => {
    expect(MULTIPLIER_MIN).toBe(0.5);
    expect(MULTIPLIER_MAX).toBe(2.0);
    expect(MULTIPLIER_DEFAULT).toBe(1.0);
  });

  it('setAquarelleMultiplier clamps into the band', () => {
    selectAquarelleTip('wc/round-medium');
    setAquarelleMultiplier('tip', 9);
    expect(aquarelleToolOverrides.value.tip).toBe(MULTIPLIER_MAX);
    setAquarelleMultiplier('tip', 0);
    expect(aquarelleToolOverrides.value.tip).toBe(MULTIPLIER_MIN);
    setAquarelleMultiplier('tip', 1.2);
    expect(aquarelleToolOverrides.value.tip).toBe(1.2);
  });

  it('effective-value readout computes global × multiplier', () => {
    expect(effectiveMultiplierValue(24, 1.5)).toBe(36);
    expect(effectiveMultiplierValue(50, 0.5)).toBe(25);
    expect(effectiveMultiplierValue(12, 2.0)).toBe(24);
  });
});
