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

  it('Brush smoothing sits at the top of the Brush-mode Paint tab (261018-f15)', () => {
    const tree = materialize(BrushModuleSection(brushModuleProps())) as TestVNode;
    const text = textContent(tree);
    const smoothingAt = text.indexOf('Brush smoothing');
    const shapeAt = text.indexOf('Shape detail');
    expect(smoothingAt, 'Brush smoothing label must render').toBeGreaterThan(-1);
    expect(shapeAt, 'Shape detail label must render').toBeGreaterThan(-1);
    expect(smoothingAt, 'smoothing precedes Shape detail').toBeLessThan(shapeAt);
  });

  it('Brush branch has no retired mode-selector control (261018-cy1)', () => {
    const source = readFileSync(
      resolve(__dirname, 'BrushModuleSection.tsx'),
      'utf8',
    );
    // Source-scan discipline: the retired control is gone from the Paint tool
    // tab (the top-bar ModuleSwitcher stays). Negative scan strips comments.
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body).not.toMatch(/PaintModeSelector/);
    const tree = materialize(BrushModuleSection(brushModuleProps())) as TestVNode;
    const labels = [...walk(tree)].map((n) => textContent(n)).join(' ');
    expect(labels).not.toContain('PaintModeSelector');
  });

  it('empty watercolor shell renders without crashing', () => {
    expect(() => materialize(WatercolorModuleSection())).not.toThrow();
    const tree = materialize(WatercolorModuleSection()) as TestVNode;
    const text = textContent(tree);
    // 261018-f15: the parent section title is gone — the tab already names the
    // surface. Negative scan strips comments (source-scan discipline).
    expect(text).not.toContain('Water color');
  });

  it('watercolor shell has no parent section title (261018-f15)', () => {
    const tree = materialize(WatercolorModuleSection()) as TestVNode;
    const text = textContent(tree);
    expect(text).not.toContain('Water color');
    const source = readFileSync(resolve(__dirname, 'WatercolorModuleSection.tsx'), 'utf8');
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body, 'no SectionLabel mount in the watercolor module section').not.toMatch(/<SectionLabel\b/);
    expect(body, 'no Water color string left in the module section').not.toContain('Water color');
  });

  it('watercolor shell is settings only: no tool row, no Dry button (261017-w4x I-06)', () => {
    // Q4: the Paint tab shows settings only — label + params. BrushesDocker
    // left with 261017-wmw I-01 (picker lives in the Brush tab). Tool row and
    // Dry live in the left vertical rail. Note: "Dry speed" is a param slider
    // inside the params panel and stays — pins target the Dry control
    // (data-testid / emit helper / tool-row mount), not the substring.
    const tree = materialize(WatercolorModuleSection()) as TestVNode;
    const buttons = [...walk(tree)].filter((n) => n.type === 'button');
    expect(
      buttons.some((b) => b.props?.['data-testid'] === 'aquarelle-dry'),
      'no Dry control in the module section',
    ).toBe(false);
    expect(
      buttons.some((b) => textContent(b).trim() === 'Dry'),
      'no Dry action button in the module section',
    ).toBe(false);
    const source = readFileSync(resolve(__dirname, 'WatercolorModuleSection.tsx'), 'utf8');
    // Negative scans strip comments so docs naming the rail seam never trip.
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body, 'tool-row mount must leave').not.toMatch(/<AquarelleToolRow\b/);
    expect(body, 'Dry emit helper must leave').not.toContain('emitAquarelleDry');
    expect(body, 'record clock must leave with the Dry button').not.toContain('aquarelleRecordClock');
    // Globals panel remains; the parent section title left with 261018-f15.
    // Picker and response live in the Brush tab.
    expect(source, 'section mounts AquarelleGlobalsPanel (I-02)').toMatch(/<AquarelleGlobalsPanel\b/);
    expect(source, 'old wrapper must be gone (I-02)').not.toMatch(/<AquarelleParamsPanel\b/);
    expect(source, 'picker leaves the Paint-tab section (I-01)').not.toMatch(/<BrushesDocker\b/);
    expect(source, 'response block leaves the Paint-tab section (I-02)').not.toMatch(
      /<BrushResponsePanel\b/,
    );
  });
});

describe('panel split shell — right-panel chrome (261018-f15)', () => {
  it('right panel starts 10px from its top edge; sides stay 10px', () => {
    const css = readFileSync(
      resolve(__dirname, '../physicsPaintStudio.css'),
      'utf8',
    );
    const start = css.indexOf('.physics-paint-right-panel {');
    expect(start, 'right-panel rule must exist').toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toMatch(/padding:\s*10px 10px/);
  });
});

describe('panel split shell — shared block', () => {
  it('paint-tab branch hosts the size/opacity pair above the module switch (261018-f15)', () => {
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    // 261017-w4x I-05 (Q3) kept the shared wrapper gone; 261018-f15 C2 puts a
    // Brush size + Opacity write-through pair at the TOP of the paint tab.
    // The I-05 shared-block wrapper class stays retired.
    const paintTabStart = panelSource.indexOf("effectiveToolTab === 'paint'");
    expect(paintTabStart, 'paint-tab branch must exist').toBeGreaterThan(-1);
    const paintTabEnd = panelSource.indexOf("effectiveToolTab === 'background'", paintTabStart);
    expect(paintTabEnd, 'paint-tab branch must end at the background arm').toBeGreaterThan(paintTabStart);
    const paintTab = panelSource.slice(paintTabStart, paintTabEnd);
    expect(paintTab.indexOf('shared-opacity'), 'paint-tab must not host shared-opacity').toBe(-1);
    expect(paintTab.indexOf('physics-paint-shared-block'), 'shared wrapper must leave').toBe(-1);
    expect(paintTab.indexOf('<SectionLabel text="Opacity"'), 'Opacity option-group must leave').toBe(-1);
    // The size/opacity pair sits ABOVE the module switch.
    const pairAt = paintTab.indexOf('paint-tab-size-opacity');
    const moduleAt = paintTab.indexOf('WatercolorModuleSection');
    expect(pairAt, 'size/opacity pair must mount').toBeGreaterThan(-1);
    expect(moduleAt, 'module switch must remain').toBeGreaterThan(-1);
    expect(pairAt, 'pair precedes the module switch').toBeLessThan(moduleAt);
    expect(paintTab.indexOf('BrushModuleSection'), 'brush module must remain').toBeGreaterThan(-1);
    // The pair writes through the top-bar handlers (no second setter).
    expect(paintTab).toContain('onBrushSizeChange');
    expect(paintTab).toContain('onOpacityChange');
    // Opacity text remains for the Track tab and onion controls (I-10 homes).
    const trackTabSource = readFileSync(resolve(__dirname, 'RightPanelTrackTab.tsx'), 'utf8');
    const onionTabSource = readFileSync(resolve(__dirname, 'RightPanelOnionMotionTabs.tsx'), 'utf8');
    expect(trackTabSource, 'track opacity id lives in RightPanelTrackTab').toMatch(/physics-track-opacity/);
    expect(onionTabSource, 'onion opacity id lives in RightPanelOnionTab').toMatch(/physics-onion-opacity/);
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

describe('panel split shell — Brush-tab watercolor arm', () => {
  it('mounts BrushResponsePanel before WatercolorBrushLibrary (261018-f15)', () => {
    // 261018-0ox I-10: the Brush-tab body lives in RightPanelBrushTab.
    // 261018-f15: Brush response moves ABOVE the brush cards.
    const brushTabSource = readFileSync(
      resolve(__dirname, 'RightPanelBrushTab.tsx'),
      'utf8',
    );
    const libraryAt = brushTabSource.indexOf('<WatercolorBrushLibrary');
    const responseAt = brushTabSource.indexOf('<BrushResponsePanel');
    expect(libraryAt, 'brush tab mounts WatercolorBrushLibrary').toBeGreaterThan(-1);
    expect(responseAt, 'brush tab mounts BrushResponsePanel').toBeGreaterThan(-1);
    expect(responseAt, 'response comes first').toBeLessThan(libraryAt);
    expect(brushTabSource, 'old tip-catalog picker is not mounted').not.toMatch(/<BrushesDocker\b/);
    // The component file stays on disk (I-01 home; not deleted by I-10).
    expect(() => readFileSync(resolve(__dirname, 'BrushesDocker.tsx'), 'utf8')).not.toThrow();
    // The panel mounts the adopted tab component in the Brush branch.
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    const brushTabStart = panelSource.indexOf("topPaneTab === 'brush'");
    expect(brushTabStart, 'brush-tab branch must exist').toBeGreaterThan(-1);
    const brushTabEnd = panelSource.indexOf("topPaneTab === 'paper'", brushTabStart);
    expect(brushTabEnd, 'brush-tab branch must end at the paper arm').toBeGreaterThan(brushTabStart);
    const brushTab = panelSource.slice(brushTabStart, brushTabEnd);
    expect(brushTab, 'panel mounts RightPanelBrushTab once in the brush branch').toMatch(/<RightPanelBrushTab\b/);
  });
});
