/**
 * 56-07 / 261017-wmw I-01 — AquarelleParamsPanel contract pins (AQUA-04, D-04/05/06).
 *
 * Laws pinned here:
 *   D-05   no local size/scale control — the shared Size slider owns it
 *   I-01   playground labels and order: Water, Pigment, Flow, Bleed, Edges,
 *          Grain, Dry speed (keys stay water/load/flow/bleed/edge/granulation/dry)
 *   I-01   Reset restores playground DEFAULT_PARAMS ×100 for the 7 non-size
 *          globals via setAquarelleParam and never writes size (top-bar owns it)
 *   I-01   the Brush response block is NOT in this panel (I-02 owns that move)
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
  aquarelleParams,
  aquarelleSelectedTipId,
  buildAquarelleStrokePayload,
  selectAquarelleTip,
  setAquarelleParam,
  setAquarelleMultiplier,
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

/**
 * Slider labels in walk order (playground order pin). SliderStepper is a
 * function component, so after materialize the `label` prop is consumed —
 * the name survives on `label`/`ariaLabel` of the inner nodes. First-seen
 * order across the walk is the GLOBAL_ROWS render order.
 */
function collectOrderedLabels(tree: TestVNode): string[] {
  const seen = new Set<string>();
  for (const node of walk(tree)) {
    const label = node.props?.['label'] ?? node.props?.['ariaLabel'] ?? node.props?.['aria-label'];
    if (typeof label === 'string' && !seen.has(label)) seen.add(label);
  }
  return [...seen];
}

/** I-01 playground order (SettingsPanel SLIDERS minus Size and Hand). */
const GLOBAL_LABELS = [
  'Water',
  'Pigment',
  'Flow',
  'Bleed',
  'Edges',
  'Grain',
  'Dry speed',
] as const;

/** Playground DEFAULT_PARAMS ×100 for the 7 non-size keys. */
const RESET_EXPECTED = {
  water: 60,
  load: 50,
  flow: 45,
  bleed: 50,
  edge: 50,
  granulation: 45,
  dry: 40,
} as const;

describe('AquarelleParamsPanel globals (AQUA-04 / D-05 / D-06 / I-01)', () => {
  it('renders the 7 named global slider labels', () => {
    const tree = renderPanel();
    const labels = collectLabels(tree);
    for (const name of GLOBAL_LABELS) {
      expect(labels.some((l) => l === name), `missing global label ${name}`).toBe(true);
    }
  });

  it('renders the 7 globals in playground order Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed', () => {
    const tree = renderPanel();
    const ordered = collectOrderedLabels(tree).filter((l) =>
      (GLOBAL_LABELS as readonly string[]).includes(l),
    );
    expect(ordered).toEqual([...GLOBAL_LABELS]);
  });

  it('never renders a local size/scale control (shared Size slider owns it)', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    const labels = collectLabels(tree);
    expect(labels.some((l) => /^size$/i.test(l)), 'found a Size label').toBe(false);
    expect(labels.some((l) => /^scale$/i.test(l)), 'found a Scale label').toBe(false);
    expect(/\bsize\b/i.test(text), 'found size text in panel').toBe(false);
  });

  it('renamed rows keep their param keys load/edge/granulation/dry (label fix only)', () => {
    // The pin is behavioral: the live bag still responds on the old keys.
    setAquarelleParam('load', 33);
    expect(aquarelleParams.value.load).toBe(33);
    setAquarelleParam('edge', 44);
    expect(aquarelleParams.value.edge).toBe(44);
    setAquarelleParam('granulation', 55);
    expect(aquarelleParams.value.granulation).toBe(55);
    setAquarelleParam('dry', 66);
    expect(aquarelleParams.value.dry).toBe(66);
    // Restore non-defaults so later cases start from a known bag if they share state.
  });
});

describe('AquarelleParamsPanel Reset (I-01 / T-261017-WMW-01)', () => {
  it('renders a Reset control after the sliders', () => {
    const tree = renderPanel();
    const buttons = [...walk(tree)].filter((n) => n.type === 'button');
    const reset = buttons.find((b) => b.props?.['data-testid'] === 'aquarelle-params-reset');
    expect(reset, 'Reset control must render').toBeTruthy();
    expect(textContent(reset).trim()).toBe('Reset');
  });

  it('Reset restores playground defaults for the 7 non-size globals and never writes size', () => {
    // Non-default bag, including size — Reset must leave size alone (Q1a).
    setAquarelleParam('size', 77);
    setAquarelleParam('water', 1);
    setAquarelleParam('load', 2);
    setAquarelleParam('flow', 3);
    setAquarelleParam('bleed', 4);
    setAquarelleParam('edge', 5);
    setAquarelleParam('granulation', 6);
    setAquarelleParam('dry', 7);

    const tree = renderPanel();
    const reset = [...walk(tree)].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render').toBeTruthy();
    const onClick = (reset!.props as { onClick?: () => void }).onClick;
    expect(typeof onClick, 'Reset must be clickable').toBe('function');
    onClick!();

    const params = aquarelleParams.value;
    expect(params.water, 'water resets to 60').toBe(RESET_EXPECTED.water);
    expect(params.load, 'load resets to 50').toBe(RESET_EXPECTED.load);
    expect(params.flow, 'flow resets to 45').toBe(RESET_EXPECTED.flow);
    expect(params.bleed, 'bleed resets to 50').toBe(RESET_EXPECTED.bleed);
    expect(params.edge, 'edge resets to 50').toBe(RESET_EXPECTED.edge);
    expect(params.granulation, 'granulation resets to 45').toBe(RESET_EXPECTED.granulation);
    expect(params.dry, 'dry resets to 40').toBe(RESET_EXPECTED.dry);
    // T-261017-WMW-01: Reset must never write size (top-bar Brush size owns it).
    expect(params.size, 'size is untouched by Reset').toBe(77);
  });
});

describe('AquarelleParamsPanel has no Brush response block (I-01 / I-02)', () => {
  it('does not render the Brush response collapsible or placeholder', () => {
    aquarelleSelectedTipId.value = null;
    const tree = renderPanel();
    const text = textContent(tree);
    expect(text, 'Brush response header must leave this panel').not.toContain('Brush response');
    expect(text, 'response placeholder must leave this panel').not.toContain(
      'Select a brush to edit response',
    );
    const labels = collectLabels(tree);
    expect(labels.some((l) => l === 'Tip'), 'Tip multiplier must leave this panel').toBe(false);
    expect(labels.some((l) => l === 'Wet round'), 'Wet round multiplier must leave this panel').toBe(false);
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
