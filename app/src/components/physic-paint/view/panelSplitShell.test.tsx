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

  it('Brush module section is gone with engine 1 (261027-klx)', () => {
    expect(() => readFileSync(resolve(__dirname, 'BrushModuleSection.tsx'), 'utf8')).toThrow();
    const panelSource = readFileSync(resolve(__dirname, 'PhysicsPaintRightPanel.tsx'), 'utf8');
    expect(panelSource).not.toMatch(/BrushModuleSection/);
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
    // Picker lives in the Brush tab; response lives in the Brush/Settings
    // tabs (I-11, restored as a second view by 261028-k03c D2).
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

  it('Settings tab gets a 10px top inset (I-11 follow-up)', () => {
    const css = readFileSync(
      resolve(__dirname, '../physicsPaintStudio.css'),
      'utf8',
    );
    const start = css.indexOf('.physics-paint-options-tab-panel-settings {');
    expect(start, 'settings panel rule must exist').toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain('padding-top: 10px');
  });
});

describe('panel split shell — shared block', () => {
  it('paint-tab branch hosts the size pair above the module switch (261018-f15)', () => {
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    // 261017-w4x I-05 (Q3) kept the shared wrapper gone; 261018-f15 C2 puts a
    // Brush size write-through control at the TOP of the paint tab.
    // The I-05 shared-block wrapper class stays retired.
    const paintTabStart = panelSource.indexOf("effectiveToolTab === 'paint'");
    expect(paintTabStart, 'paint-tab branch must exist').toBeGreaterThan(-1);
    const paintTabEnd = panelSource.indexOf("effectiveToolTab === 'background'", paintTabStart);
    expect(paintTabEnd, 'paint-tab branch must end at the background arm').toBeGreaterThan(paintTabStart);
    const paintTab = panelSource.slice(paintTabStart, paintTabEnd);
    expect(paintTab.indexOf('shared-opacity'), 'paint-tab must not host shared-opacity').toBe(-1);
    expect(paintTab.indexOf('physics-paint-shared-block'), 'shared wrapper must leave').toBe(-1);
    expect(paintTab.indexOf('<SectionLabel text="Opacity"'), 'Opacity option-group must leave').toBe(-1);
    // The size pair sits ABOVE the module switch.
    const pairAt = paintTab.indexOf('paint-tab-size-opacity');
    const moduleAt = paintTab.indexOf('WatercolorModuleSection');
    expect(pairAt, 'size/opacity pair must mount').toBeGreaterThan(-1);
    expect(moduleAt, 'module switch must remain').toBeGreaterThan(-1);
    expect(pairAt, 'pair precedes the module switch').toBeLessThan(moduleAt);
    // The pair writes through the top-bar handler (no second setter). Water
    // color has no global opacity control — its Pigment (`load`) lives on the
    // top bar and in the module globals, so the Brush opacity seam left with
    // engine 1 (261027-klx).
    expect(paintTab).toContain('onBrushSizeChange');
    expect(paintTab).toContain('aquarelleParams.value.size');
    expect(paintTab).not.toContain('onOpacityChange');
    // Opacity text remains for the Track tab and onion controls (I-10 homes).
    const trackTabSource = readFileSync(resolve(__dirname, 'RightPanelTrackTab.tsx'), 'utf8');
    const onionTabSource = readFileSync(resolve(__dirname, 'RightPanelOnionMotionTabs.tsx'), 'utf8');
    expect(trackTabSource, 'track opacity id lives in RightPanelTrackTab').toMatch(/physics-track-opacity/);
    expect(onionTabSource, 'onion opacity id lives in RightPanelOnionTab').toMatch(/physics-onion-opacity/);
    // 261018-ias AREA 2: Onion frames + Onion Value share ONE 2-column row.
    expect(onionTabSource, 'one onion value row, not two stacked').toMatch(
      /physics-paint-onion-value-row/,
    );
    expect(onionTabSource, 'two cells inside the shared row').toMatch(
      /physics-paint-onion-value-cell[\s\S]*physics-onion-count[\s\S]*physics-paint-onion-value-cell[\s\S]*physics-onion-opacity/,
    );
    const onionRowMatches = onionTabSource.match(/physics-paint-onion-value-row/g) ?? [];
    expect(onionRowMatches.length, 'exactly one onion-value-row container').toBe(1);
  });

  it('module-only block is the watercolor section only (261027-klx)', () => {
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    expect(panelSource).toMatch(/WatercolorModuleSection/);
    expect(panelSource).not.toMatch(/BrushModuleSection/);
    // 261027-klx: one module — the panel no longer branches on the signal.
    expect(panelSource).not.toMatch(/activeModule/);
  });

  it('the module section does not mutate document or timeline state', () => {
    // The module section is a pure presentational leaf — grep for store imports.
    const source = readFileSync(resolve(__dirname, 'WatercolorModuleSection.tsx'), 'utf8');
    expect(source, 'WatercolorModuleSection.tsx must not import document/timeline stores').not.toMatch(
      /projectStore|timelineStore|physicPaintStore/,
    );
  });
});

describe('panel split shell — Brush-tab watercolor arm', () => {
  it('Brush tab is the catalog + response multipliers again; Settings keeps its copy (D2)', () => {
    // 261018-0ox I-10: the Brush-tab body lives in RightPanelBrushTab.
    // I-11 / D moved the response block to Settings; 261027-gh9g retired the
    // whole mount. 261028-k03c D2 restores the tab as a SECOND VIEW OVER THE
    // SAME STATE: catalog + response multipliers + Lift section here, while
    // Settings keeps its own BrushResponsePanel unchanged (two views, one
    // state — no duplicated signals).
    const brushTabSource = readFileSync(
      resolve(__dirname, 'RightPanelBrushTab.tsx'),
      'utf8',
    );
    expect(brushTabSource, 'brush tab mounts WatercolorBrushLibrary').toMatch(
      /<WatercolorBrushLibrary\b/,
    );
    expect(brushTabSource, 'response multipliers are back in the Brush tab').toMatch(
      /<BrushResponsePanel\b/,
    );
    expect(brushTabSource, 'old tip-catalog picker is not mounted').not.toMatch(/<BrushesDocker\b/);
    // The Lift section shares the top bar's picker and strength seam.
    expect(brushTabSource, 'Lift section mounts the shared shape picker').toMatch(
      /<LiftShapePicker testId="right-panel-lift-shape" \/>/,
    );
    expect(brushTabSource, 'Lift strength writes the shared param bag').toContain(
      "setAquarelleParam('lift'",
    );
    // The component file stays on disk (I-01 home; not deleted by I-10).
    expect(() => readFileSync(resolve(__dirname, 'BrushesDocker.tsx'), 'utf8')).not.toThrow();

    const settingsTabSource = readFileSync(
      resolve(__dirname, 'RightPanelSettingsTab.tsx'),
      'utf8',
    );
    expect(settingsTabSource, 'Settings tab mounts BrushResponsePanel').toMatch(
      /<BrushResponsePanel\b/,
    );

    // 261028-k03c D2: the panel mounts the Brush tab again (top pane order
    // brush → settings → paper; Memory stays last).
    const panelSource = readFileSync(
      resolve(__dirname, 'PhysicsPaintRightPanel.tsx'),
      'utf8',
    );
    expect(panelSource, 'Brush tab is mounted again').toMatch(/<RightPanelBrushTab\b/);
    // 261027-klx: the top pane is fixed — Water color is the only module, so
    // the settings arm no longer carries a mode gate.
    const settingsTabStart = panelSource.indexOf("effectiveTopPaneTab === 'settings'");
    expect(settingsTabStart, 'settings-tab branch must exist').toBeGreaterThan(-1);
    const paperTabStart = panelSource.indexOf(
      "effectiveTopPaneTab === 'paper'",
      settingsTabStart,
    );
    expect(paperTabStart, 'paper-tab branch must follow settings').toBeGreaterThan(
      settingsTabStart,
    );
    const settingsBranch = panelSource.slice(settingsTabStart, paperTabStart);
    expect(
      settingsBranch,
      'panel mounts RightPanelSettingsTab in the settings branch',
    ).toMatch(/<RightPanelSettingsTab\b/);
    expect(
      settingsBranch,
      'settings branch carries the padded panel class',
    ).toContain('physics-paint-options-tab-panel-settings');
  });
});
