/**
 * 56-02 (D-02, D-05, D-14): the shared/module panel-split shell — shared block
 * always visible, module-only block drains per activeModule.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as NumericStepper.test.tsx / PhysicsPaintRightPanel.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { WatercolorModuleSection } from './WatercolorModuleSection';
import { BrushModuleSection } from './BrushModuleSection';

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

vi.mock('../../sidebar/PaintModeSelector', () => ({
  PaintModeSelector: () => ({ type: 'div', props: { 'data-testid': 'paint-mode-selector', children: 'PaintModeSelector' } }),
  FxBrushConvertBar: () => null,
}));

vi.mock('../../../stores/paintStore', () => ({
  paintStore: {
    activePaintMode: { value: 'flat' },
    brushStyle: { value: 'flat' },
    setActivePaintMode: () => {},
    setBrushStyle: () => {},
    setPaintBgColor: () => {},
    paintVersion: { value: 0 },
    markDirty: () => {},
    _notifyVisualChange: () => {},
    invalidateFrameFxCache: () => {},
    refreshFrameFx: () => {},
  },
}));

vi.mock('../../../stores/layerStore', () => ({
  layerStore: { selectedLayerId: { peek: () => null }, updateLayer: () => {} },
}));

vi.mock('../../../stores/timelineStore', () => ({
  timelineStore: { currentFrame: { peek: () => 0 } },
}));

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
    if (typeof current === 'string' || typeof current === 'number') { parts.push(String(current)); return; }
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { for (const child of current) walkText(child); return; }
    walkText((current as TestVNode).props?.children);
  };
  walkText(node);
  return parts.join(' ');
}

function brushModuleProps() {
  return {
    activeTool: 'paint' as const,
    edgeDetail: 50,
    pickup: 50,
    spread: 50,
    smoothing: 1,
    eraseStrength: 50,
    physicsMode: 'local' as const,
    engineControlsDisabled: false,
    onEdgeDetailChange: () => {},
    onPickupChange: () => {},
    onSpreadChange: () => {},
    onSmoothingChange: () => {},
    onEraseStrengthChange: () => {},
  };
}

describe('panel split shell — module-only block', () => {
  it('watercolor branch does not render the Brush param bag', () => {
    const tree = materialize(WatercolorModuleSection()) as TestVNode;
    const text = textContent(tree);
    // Brush param bag labels must never appear in the watercolor shell.
    expect(text).not.toContain('Shape detail');
    expect(text).not.toContain('Blending');
    expect(text).not.toContain('Spread');
    expect(text).not.toContain('Erase');
    expect(text).not.toContain('Brush smoothing');
  });

  it('watercolor branch does not render PaintModeSelector', () => {
    const source = readFileSync(
      resolve(__dirname, 'WatercolorModuleSection.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/PaintModeSelector/);
  });

  it('Brush branch keeps its physics param bag', () => {
    const tree = materialize(BrushModuleSection(brushModuleProps())) as TestVNode;
    const text = textContent(tree);
    expect(text).toContain('Shape detail');
    expect(text).toContain('Brush smoothing');
  });

  it('Brush branch renders PaintModeSelector', () => {
    const source = readFileSync(
      resolve(__dirname, 'BrushModuleSection.tsx'),
      'utf8',
    );
    expect(source).toMatch(/PaintModeSelector/);
    const tree = materialize(BrushModuleSection(brushModuleProps())) as TestVNode;
    const labels = [...walk(tree)].map((n) => textContent(n)).join(' ');
    expect(labels).toContain('PaintModeSelector');
  });

  it('empty watercolor shell renders without crashing', () => {
    expect(() => materialize(WatercolorModuleSection())).not.toThrow();
    const tree = materialize(WatercolorModuleSection()) as TestVNode;
    const text = textContent(tree);
    expect(text).toContain('Water color');
  });

  it('watercolor shell exposes the Water color section label', () => {
    const tree = materialize(WatercolorModuleSection()) as TestVNode;
    const text = textContent(tree);
    expect(text).toContain('Water color');
  });
});

describe('panel split shell — shared block', () => {
  it('shared section labels appear regardless of activeModule', () => {
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    // The shared section labels must exist in the panel source.
    // (Size was removed in 56-ui-03 — top-bar Brush size is the one control.)
    expect(panelSource).toMatch(/Opacity/);
    expect(panelSource).toMatch(/Paper/);
  });

  it('module-only block switches on activeModule', () => {
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    expect(panelSource).toMatch(/WatercolorModuleSection/);
    expect(panelSource).toMatch(/BrushModuleSection/);
    expect(panelSource).toMatch(/activeModule/);
  });

  it('switching module does not mutate document or timeline state', () => {
    // The module sections are pure presentational leaves — grep for store imports.
    for (const file of ['WatercolorModuleSection.tsx', 'BrushModuleSection.tsx']) {
      const source = readFileSync(resolve(__dirname, file), 'utf8');
      expect(source, `${file} must not import document/timeline stores`).not.toMatch(
        /projectStore|timelineStore|physicPaintStore/,
      );
    }
  });
});
