/**
 * 261017-wmw I-02 — AquarelleGlobalsPanel contract pins.
 *
 * Laws pinned here (one file per visual unit):
 *   7 sliders in playground order Water, Pigment, Flow, Bleed, Edges, Grain,
 *   Dry speed (keys stay water/load/flow/bleed/edge/granulation/dry)
 *   no Size control (top-bar owns it, Q1a) and no Hand row
 *   Reset writes playground DEFAULT_PARAMS ×100 for the 7 non-size keys via
 *   setAquarelleParam and never writes size (T-261017-WMW-01)
 *   no Brush response chrome in this panel (I-02 puts it in BrushResponsePanel)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aquarelleParams,
  setAquarelleParam,
} from './aquarelleRecordState';
import { AquarelleGlobalsPanel } from './AquarelleGlobalsPanel';

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
  return materialize(AquarelleGlobalsPanel()) as TestVNode;
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

/** First-seen label names in walk order (playground order pin). */
function collectOrderedLabels(tree: TestVNode): string[] {
  const seen = new Set<string>();
  for (const node of walk(tree)) {
    const label = node.props?.['label'] ?? node.props?.['ariaLabel'] ?? node.props?.['aria-label'];
    if (typeof label === 'string' && !seen.has(label)) seen.add(label);
  }
  return [...seen];
}

/** I-01/I-02 playground order (SettingsPanel SLIDERS minus Size and Hand). */
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

describe('AquarelleGlobalsPanel sliders (I-02)', () => {
  it('renders the 7 named global slider labels in playground order', () => {
    const tree = renderPanel();
    const ordered = collectOrderedLabels(tree).filter((l) =>
      (GLOBAL_LABELS as readonly string[]).includes(l),
    );
    expect(ordered).toEqual([...GLOBAL_LABELS]);
    const labels = collectLabels(tree);
    for (const name of GLOBAL_LABELS) {
      expect(labels.some((l) => l === name), `missing global label ${name}`).toBe(true);
    }
  });

  it('never renders a local size/scale control or a Hand row', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    const labels = collectLabels(tree);
    expect(labels.some((l) => /^size$/i.test(l)), 'found a Size label').toBe(false);
    expect(labels.some((l) => /^scale$/i.test(l)), 'found a Scale label').toBe(false);
    expect(labels.some((l) => /^hand$/i.test(l)), 'found a Hand label').toBe(false);
    expect(/\bsize\b/i.test(text), 'found size text in panel').toBe(false);
  });

  it('renders nothing but the 7 sliders + Reset (no response chrome)', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    expect(text).not.toContain('Brush response');
    expect(text).not.toContain('Select a brush to edit response');
    const labels = collectLabels(tree);
    expect(labels.some((l) => l === 'Tip'), 'Tip multiplier leaked in').toBe(false);
  });
});

describe('AquarelleGlobalsPanel Reset (I-02 / T-261017-WMW-01)', () => {
  it('renders a Reset control after the sliders', () => {
    const tree = renderPanel();
    const buttons = [...walk(tree)].filter((n) => n.type === 'button');
    const reset = buttons.find((b) => b.props?.['data-testid'] === 'aquarelle-params-reset');
    expect(reset, 'Reset control must render').toBeTruthy();
    expect(textContent(reset).trim()).toBe('Reset');
  });

  it('Reset writes the ×100 playground defaults through setAquarelleParam and never writes size', () => {
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
    expect(params.water, 'water → 60').toBe(RESET_EXPECTED.water);
    expect(params.load, 'load → 50').toBe(RESET_EXPECTED.load);
    expect(params.flow, 'flow → 45').toBe(RESET_EXPECTED.flow);
    expect(params.bleed, 'bleed → 50').toBe(RESET_EXPECTED.bleed);
    expect(params.edge, 'edge → 50').toBe(RESET_EXPECTED.edge);
    expect(params.granulation, 'granulation → 45').toBe(RESET_EXPECTED.granulation);
    expect(params.dry, 'dry → 40').toBe(RESET_EXPECTED.dry);
    // T-261017-WMW-01: Reset must never write size (top-bar Brush size owns it).
    expect(params.size, 'size is untouched by Reset').toBe(77);
  });
});

// 261018-gqo move 2: vertical breathing room — the shared option-group gap
// stacks the seven rows, and RuleSectionHeader carries the section margin.
describe('261018-gqo spacing rhythm', () => {
  it('globals panel rides the shared option-group row gap', () => {
    const tree = renderPanel() as TestVNode;
    const root = [...walk(tree)].find((n) => n.props?.['data-testid'] === 'aquarelle-globals-panel');
    expect(root, 'panel root must render').toBeTruthy();
    expect(String(root!.props?.['class'] ?? ''), 'option-group class owns the row gap').toBe(
      'physics-paint-option-group',
    );
  });

  it('CSS gives rule headers margin and module sections a 10px row gap', () => {
    const styles = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'),
      'utf8',
    );
    expect(styles).toContain('.rule-section-header {');
    expect(styles).toMatch(/\.rule-section-header\s*\{[^}]*margin:\s*12px 0 8px/);
    expect(styles).toMatch(/\.physics-paint-module-section\s*\{[^}]*gap:\s*10px/);
  });
});
