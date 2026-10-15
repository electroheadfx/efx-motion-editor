/**
 * 56-07 Task 1 — AquarelleParamsPanel contract pins (AQUA-04, D-04/05/06/08).
 *
 * Laws pinned here:
 *   D-05   no local size/scale control — the shared Size slider owns it
 *   D-04   globals first, then a collapsible "Brush response" (collapsed default)
 *   D-06   SliderStepper family only
 *   D-08   8 ×multipliers, band 0.5–2.0, default 1.0, effective = global × multiplier
 *   AQUA-04 labels exactly: Water, Load, Flow, Bleed, Dry rate, Edge, Granulation
 *   Record-path commit: a recorded stroke carries the live param bag in
 *   AquarelleStrokePayload.params and the selected multipliers in toolOverrides.
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as panelSplitShell.test.tsx / PaperPicker.test.tsx).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_AQUARELLE_PARAMS,
  MULTIPLIER_DEFAULT,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  buildAquarelleStrokePayload,
  effectiveMultiplierValue,
  aquarelleSelectedTipId,
  setAquarelleParam,
  setAquarelleMultiplier,
  selectAquarelleTip,
  snapshotAquarelleRecord,
} from './aquarelleRecordState';
import { AquarelleParamsPanel } from './AquarelleParamsPanel';

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
  return materialize(AquarelleParamsPanel()) as TestVNode;
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

const GLOBAL_LABELS = ['Water', 'Load', 'Flow', 'Bleed', 'Dry rate', 'Edge', 'Granulation'] as const;

describe('AquarelleParamsPanel globals (AQUA-04 / D-05 / D-06)', () => {
  it('renders the 7 named global slider labels', () => {
    const tree = renderPanel();
    const labels = collectLabels(tree);
    for (const name of GLOBAL_LABELS) {
      expect(labels.some((l) => l === name), `missing global label ${name}`).toBe(true);
    }
  });

  it('never renders a local size/scale control (shared Size slider owns it)', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    const labels = collectLabels(tree);
    expect(labels.some((l) => /^size$/i.test(l)), 'found a Size label').toBe(false);
    expect(labels.some((l) => /^scale$/i.test(l)), 'found a Scale label').toBe(false);
    expect(/\bsize\b/i.test(text), 'found size text in panel').toBe(false);
  });

  it('uses exact labels Water, Load, Flow, Bleed, Dry rate, Edge, Granulation', () => {
    const tree = renderPanel();
    const labels = collectLabels(tree);
    for (const name of GLOBAL_LABELS) {
      expect(labels.filter((l) => l === name).length, `label ${name}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('AquarelleParamsPanel Brush response (D-04 / D-08)', () => {
  it('renders the Brush response collapsible header, collapsed by default', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    expect(text).toContain('Brush response');
    // Collapsed by default → no multiplier rows in the tree yet.
    const labels = collectLabels(tree);
    expect(labels.some((l) => l === 'Tip'), 'Tip multiplier visible while collapsed').toBe(false);
  });

  it('shows Select a brush to edit response when no brush is selected', () => {
    aquarelleSelectedTipId.value = null;
    const tree = renderPanel();
    expect(textContent(tree)).toContain('Select a brush to edit response');
  });

  it('multiplier band is 0.5–2.0 with default 1.0', () => {
    expect(MULTIPLIER_MIN).toBe(0.5);
    expect(MULTIPLIER_MAX).toBe(2.0);
    expect(MULTIPLIER_DEFAULT).toBe(1.0);
  });

  it('effective-value readout computes global × multiplier', () => {
    expect(effectiveMultiplierValue(24, 1.5)).toBe(36);
    expect(effectiveMultiplierValue(50, 0.5)).toBe(25);
    expect(effectiveMultiplierValue(12, 2.0)).toBe(24);
  });
});

describe('AquarelleParamsPanel record-path commit (AQUA-04 / R1.7)', () => {
  it('a recorded stroke carries the live param bag in params and multipliers in toolOverrides', () => {
    // Reset live bag to known values.
    for (const [key, value] of Object.entries(DEFAULT_AQUARELLE_PARAMS)) {
      setAquarelleParam(key as keyof typeof DEFAULT_AQUARELLE_PARAMS, value);
    }
    // Select the tip first (loads its multipliers), then edit response.
    selectAquarelleTip('wc/round-medium');
    setAquarelleParam('water', 70);
    setAquarelleParam('bleed', 30);
    setAquarelleMultiplier('tip', 1.5);
    setAquarelleMultiplier('grain', 0.8);

    const payload = buildAquarelleStrokePayload();

    expect(payload.params['water']).toBe(70);
    expect(payload.params['bleed']).toBe(30);
    expect(payload.params['size']).toBe(DEFAULT_AQUARELLE_PARAMS.size);
    expect(payload.toolOverrides?.tip).toBe(1.5);
    expect(payload.toolOverrides?.grain).toBe(0.8);
    expect(payload.brushId).toBe('wc/round-medium');
  });

  it('snapshot reflects the live bag at record time (not a frozen copy)', () => {
    setAquarelleParam('edge', 80);
    const first = snapshotAquarelleRecord();
    expect(first.params['edge']).toBe(80);
    setAquarelleParam('edge', 20);
    const second = snapshotAquarelleRecord();
    expect(second.params['edge']).toBe(20);
  });
});
