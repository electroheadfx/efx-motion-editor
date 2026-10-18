import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { PhysicsPaintTopBar, type PhysicsPaintTopBarProps } from './PhysicsPaintTopBar';
import { ModuleSwitcher } from '../../shared/ModuleSwitcher';
import { makeInitialPhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');

const studioPath = resolve(dirname(fileURLToPath(import.meta.url)), '../PhysicsPaintStudio.tsx');
const studioSource = () => readFileSync(studioPath, 'utf8');
const topBarPath = resolve(dirname(fileURLToPath(import.meta.url)), './PhysicsPaintTopBar.tsx');
const topBarSource = () => readFileSync(topBarPath, 'utf8');
const studioViewPath = resolve(dirname(fileURLToPath(import.meta.url)), './PhysicsPaintStudioView.tsx');
const studioViewSource = () => readFileSync(studioViewPath, 'utf8');
const engineActionsPath = resolve(dirname(fileURLToPath(import.meta.url)), '../engine/usePhysicsPaintEngineActions.ts');
const engineActionsSource = () => readFileSync(engineActionsPath, 'utf8');

function getCssRuleBlock(styles: string, selector: string): string {
  const start = styles.indexOf(selector);
  if (start === -1) return '';
  const end = styles.indexOf('}', start);
  return end === -1 ? '' : styles.slice(start, end + 1);
}

/** Strip block + line comments so negative scans never trip on docs. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

type AnyVNode = VNode<Record<string, any>>;

function baseTopBarProps(): PhysicsPaintTopBarProps {
  return {
    brushSize: 11,
    opacity: 100,
    ready: true,
    onBrushSizeChange: vi.fn(),
    onOpacityChange: vi.fn(),
  };
}

function renderTopBar(props: PhysicsPaintTopBarProps): AnyVNode {
  return PhysicsPaintTopBar(props) as AnyVNode;
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  // Host-only walk: TopBar itself is invoked by hand; nested function
  // components (SliderStepper) must not be expanded — they need hook state.
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function findByAria(tree: AnyVNode, label: string): AnyVNode {
  const match = childrenOf(tree).find((node) => (node as AnyVNode).props?.['aria-label'] === label) as AnyVNode | undefined;
  expect(match, `Missing element with aria-label ${label}`).toBeDefined();
  return match!;
}

describe('PhysicsPaintTopBar small-width responsiveness (36.15-06 fix)', () => {
  it('lets the studio top row grow beyond 58px so wrapped controls are never crushed', () => {
    // 47-01 UAT round 3: row 3 is `auto` — the workflow strip sets its own
    // dynamic height (default = exactly enough for all tracks + Bg, capped at
    // 270px; the top-edge drag handle resizes it). The canvas row absorbs the
    // difference.
    expect(getCssRuleBlock(css(), '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) auto');
  });

  it('keeps the topbar as one non-wrapping row — centered tools, no grid columns', () => {
    const styles = css();
    const bar = getCssRuleBlock(styles, '.physics-paint-topbar {');
    expect(bar).toContain('display: flex');
    expect(bar).toContain('flex-wrap: nowrap');
    expect(bar).not.toContain('grid-template-columns');
    expect(styles).not.toContain('minmax(170px, 1fr)');
    expect(styles).not.toContain('minmax(120px, 1fr)');
  });

  it('centers the tool cluster with balanced flex sides (261018-cy1)', () => {
    const styles = css();
    const base = styles.slice(0, styles.indexOf('@media'));
    const primary = getCssRuleBlock(base, '.physics-paint-topbar-primary {');
    expect(primary, 'no auto margin — the cluster is not pushed right').not.toContain('margin-left: auto');
    expect(primary).toContain('flex-wrap: nowrap');
    expect(primary, 'primary is a fixed auto-width center cluster').toContain('flex: 0 0 auto');
    const left = getCssRuleBlock(base, '.physics-paint-topbar-left {');
    expect(left, 'left side shares flex').toContain('flex: 1 1 0');
    const right = getCssRuleBlock(base, '.physics-paint-topbar-right {');
    expect(right, 'right spacer shares flex').toContain('flex: 1 1 0');
  });
});

// 261018-k1o: ModuleSwitcher seats in the top bar LEFT cluster after the
// Engine ready status pill; primary holds the sliders only; right is unchanged.
describe('261018-k1o top bar left ModuleSwitcher + centered sliders', () => {
  it('ModuleSwitcher seats in the left slot after the status pill; primary holds sliders only', () => {
    const tree = renderTopBar(baseTopBarProps());
    const nodes = childrenOf(tree);
    const left = nodes.find((n) => (n as AnyVNode).props?.['class'] === 'physics-paint-topbar-left') as AnyVNode | undefined;
    const primary = nodes.find((n) => (n as AnyVNode).props?.['class'] === 'physics-paint-topbar-primary') as AnyVNode | undefined;
    expect(left, 'left slot must render').toBeDefined();
    expect(primary, 'primary cluster must render').toBeDefined();

    const leftDesc = childrenOf(left);
    const primaryDesc = childrenOf(primary);
    const isSwitcher = (n: unknown) => (n as AnyVNode).type === ModuleSwitcher;
    const isStatusPill = (n: unknown) => String((n as AnyVNode).props?.['class'] ?? '').includes('physics-paint-status-pill');

    expect(leftDesc.some(isSwitcher), 'ModuleSwitcher seats in the left slot').toBe(true);
    expect(primaryDesc.some(isSwitcher), 'primary cluster holds sliders only').toBe(false);
    expect(leftDesc.some(isStatusPill), 'status pill stays in the left slot').toBe(true);
    expect(primaryDesc.some(isStatusPill), 'primary cluster holds sliders only').toBe(false);

    const pillIdx = leftDesc.findIndex(isStatusPill);
    const switcherIdx = leftDesc.findIndex(isSwitcher);
    expect(pillIdx, 'status pill renders ahead of the switcher').toBeGreaterThan(-1);
    expect(switcherIdx, 'ModuleSwitcher follows the status pill').toBeGreaterThan(pillIdx);
  });

  it('source keeps the write-through pair and seats the switcher in the left slot', () => {
    const body = stripComments(topBarSource());
    expect(body).toContain('onBrushSizeChange');
    expect(body).toContain('onOpacityChange');
    expect(body).toContain('setAquarelleParam');
    const leftStart = body.indexOf('class="physics-paint-topbar-left"');
    const primaryStart = body.indexOf('class="physics-paint-topbar-primary"');
    const switcherAt = body.indexOf('<ModuleSwitcher');
    expect(leftStart).toBeGreaterThan(-1);
    expect(primaryStart).toBeGreaterThan(leftStart);
    expect(switcherAt, 'ModuleSwitcher follows the left-slot opening tag').toBeGreaterThan(leftStart);
    expect(switcherAt, 'ModuleSwitcher precedes the primary cluster').toBeLessThan(primaryStart);
    const statusAt = body.indexOf('physics-paint-topbar-status', leftStart);
    expect(statusAt, 'status pill precedes the switcher in the left slot').toBeGreaterThan(leftStart);
    expect(switcherAt, 'ModuleSwitcher follows the status pill').toBeGreaterThan(statusAt);
  });

  it('keeps the seating CSS contract: 15px pill gap, shrinkable switcher, one scrolling row', () => {
    const styles = css();
    const switcher = getCssRuleBlock(styles, '.module-switcher {');
    expect(switcher, '15px separator faces the status pill').toContain('margin-left: 15px');
    expect(switcher).not.toContain('margin-right: 15px');
    expect(switcher, 'switcher compresses before colliding with primary').toContain('flex-shrink: 1');
    const left = getCssRuleBlock(styles, '.physics-paint-topbar-left {');
    expect(left, 'left cluster does not stack a second gap').toContain('gap: 0');
    const bar = getCssRuleBlock(styles, '.physics-paint-topbar {');
    expect(bar, 'tight widths scroll one row rather than overlap').toContain('overflow-x: auto');
  });
});

// 261017-vcn Q6: the grain widgets left the top bar for the Paper tab. The
// top bar keeps Brush size + Opacity only among the former top-bar controls.
describe('261017-vcn top bar slim (I-04 remainder)', () => {
  it('renders Brush size + Opacity and no Background / Grain rows', () => {
    const props = baseTopBarProps();
    const tree = renderTopBar(props);
    // Host-only walk: TopBarSlider wraps SliderStepper and must not be
    // expanded (hook state). The wrapper carries the label prop.
    const controls = childrenOf(tree).filter(
      (node) => typeof (node as AnyVNode).props?.label === 'string',
    ) as AnyVNode[];
    const labels = controls.map((s) => s.props.label);
    expect(labels).toContain('Brush size');
    expect(labels).toContain('Opacity');
    expect(labels).not.toContain('Grain scale');
    // The retired rows leave the render tree.
    expect(() => findByAria(tree, 'Grain strength')).toThrow();
    expect(() => findByAria(tree, 'Background')).toThrow();
  });
});

// 261018-f15 C1: Water / Edges / Grain ride the watercolor branch after
// Opacity and write setAquarelleParam('water' | 'edge' | 'granulation').
describe('261018-f15 watercolor top-bar aquarelle globals', () => {
  it('watercolor branch shows Water / Edges / Grain after Opacity', async () => {
    vi.resetModules();
    vi.doMock('../../shared/activeModule', () => ({
      activeModule: { value: 'watercolor' },
    }));
    vi.doMock('./aquarelleRecordState', () => ({
      aquarelleParams: { value: { size: 22, load: 80, water: 40, edge: 60, granulation: 35 } },
      setAquarelleParam: vi.fn(),
    }));
    try {
      const { PhysicsPaintTopBar: WatercolorTopBar } = await import('./PhysicsPaintTopBar');
      const tree = WatercolorTopBar(baseTopBarProps()) as AnyVNode;
      const controls = childrenOf(tree).filter(
        (node) => typeof (node as AnyVNode).props?.label === 'string',
      ) as AnyVNode[];
      const labels = controls.map((s) => s.props.label);
      expect(labels).toEqual(['Brush size', 'Opacity', 'Water', 'Edges', 'Grain']);
    } finally {
      vi.doUnmock('../../shared/activeModule');
      vi.doUnmock('./aquarelleRecordState');
      vi.resetModules();
    }
  });

  it('brush-mode branch shows Brush size + Opacity only (no aquarelle knobs)', async () => {
    vi.resetModules();
    vi.doMock('../../shared/activeModule', () => ({
      activeModule: { value: 'brush' },
    }));
    vi.doMock('./aquarelleRecordState', () => ({
      aquarelleParams: { value: { size: 22, load: 80, water: 40, edge: 60, granulation: 35 } },
      setAquarelleParam: vi.fn(),
    }));
    try {
      const { PhysicsPaintTopBar: BrushTopBar } = await import('./PhysicsPaintTopBar');
      const tree = BrushTopBar(baseTopBarProps()) as AnyVNode;
      const controls = childrenOf(tree).filter(
        (node) => typeof (node as AnyVNode).props?.label === 'string',
      ) as AnyVNode[];
      const labels = controls.map((s) => s.props.label);
      expect(labels).toEqual(['Brush size', 'Opacity']);
    } finally {
      vi.doUnmock('../../shared/activeModule');
      vi.doUnmock('./aquarelleRecordState');
      vi.resetModules();
    }
  });

  it('Water / Edges / Grain route to setAquarelleParam (source pin)', () => {
    const body = stripComments(topBarSource());
    expect(body).toContain('setAquarelleParam');
    expect(body).toContain("setAquarelleParam('water'");
    expect(body).toContain("setAquarelleParam('edge'");
    expect(body).toContain("setAquarelleParam('granulation'");
    // Mode gate: the three knobs mount only behind the watercolor read.
    expect(body).toContain("activeModule.value === 'watercolor'");
  });
});

// 260923-bcm Task 3 (RED): one synchronous action writes settings + track
// mirror + document fallback, never the engine visible background, and every
// fond-input dep list names settings.grainScale / props.background.grainScale.
// 261017-vcn I-04 remainder: the surviving grain pair also writes the
// paper-display record (setPaper*) so the paper-display record and the
// document fallback / track metadata stay in sync in the same turn.
describe('260923-bcm Studio live wiring source pins', () => {
  it('handleGrainScaleChange writes settings, paper-display, mirror, and fallback without an engine call', () => {
    const studio = studioSource();
    const start = studio.indexOf('const handleGrainScaleChange');
    expect(start, 'handleGrainScaleChange must exist in PhysicsPaintStudio').toBeGreaterThan(-1);
    const body = studio.slice(start, studio.indexOf('\n  const ', start + 1) > -1 ? studio.indexOf('\n  const ', start + 1) : start + 800);
    expect(body.indexOf('setGrainScale'), 'must write the settings mirror').toBeGreaterThan(-1);
    expect(body.indexOf('setPaperScale'), 'must write the paper-display record').toBeGreaterThan(-1);
    expect(body.indexOf('setRotoBackgroundMetadata'), 'must write track metadata').toBeGreaterThan(-1);
    expect(body.indexOf('setBackgroundFallback'), 'must write the document fallback').toBeGreaterThan(-1);
    expect(body.indexOf('backgroundModeToFallback'), 'must map the mode to a fallback').toBeGreaterThan(-1);
    expect(body.indexOf('setVisibleBackground'), 'no engine visible-background call').toBe(-1);
    expect(body.indexOf('setBgMode'), 'no engine bg-mode call').toBe(-1);
  });

  it('handleGrainStrengthChange writes settings, paper-display, mirror, and fallback without an engine call', () => {
    const studio = studioSource();
    const start = studio.indexOf('const handleGrainStrengthChange');
    expect(start, 'handleGrainStrengthChange must exist in PhysicsPaintStudio').toBeGreaterThan(-1);
    const body = studio.slice(start, studio.indexOf('\n  const ', start + 1) > -1 ? studio.indexOf('\n  const ', start + 1) : start + 800);
    expect(body.indexOf('setGrainStrength'), 'must write the settings mirror').toBeGreaterThan(-1);
    expect(body.indexOf('setPaperStrength'), 'must write the paper-display record').toBeGreaterThan(-1);
    expect(body.indexOf('setRotoBackgroundMetadata'), 'must write track metadata').toBeGreaterThan(-1);
    expect(body.indexOf('setBackgroundFallback'), 'must write the document fallback').toBeGreaterThan(-1);
    expect(body.indexOf('backgroundModeToFallback'), 'must map the mode to a fallback').toBeGreaterThan(-1);
    expect(body.indexOf('setVisibleBackground'), 'no engine visible-background call').toBe(-1);
    expect(body.indexOf('setBgMode'), 'no engine bg-mode call').toBe(-1);
  });

  it('setGrainScale is updateSetting only with no engine visible-background call', () => {
    const actions = engineActionsSource();
    const start = actions.indexOf('const setGrainScale');
    expect(start, 'setGrainScale must exist in usePhysicsPaintEngineActions').toBeGreaterThan(-1);
    const body = actions.slice(start, actions.indexOf('\n  const ', start + 1));
    // studio-reopen-paper-washout: paper-display settings ride the engine-free
    // updatePaperDisplaySetting helper (the grain scale must survive an engine
    // that is not ready yet). The no-engine-call half of the contract is below.
    expect(body.includes("updatePaperDisplaySetting('grainScale'") || body.includes("updateSetting('grainScale'")).toBe(true);
    expect(body).not.toContain('setVisibleBackground');
    expect(body).not.toContain('setBgMode');
    expect(body).not.toContain('setPaperGrain');
    expect(actions).toContain('setGrainScale');
  });

  it('settings.grainScale rides the rightPanel memo (grain left the TopBar), playback composition, and canvasStack deps', () => {
    const studio = studioSource();

    // 261017-vcn: the grain pair left the top bar — its memo no longer names
    // grainScale. The dep belongs on the rightPanel memo now. Scalar predicates
    // keep TAP diagnostics one-line.
    const topBarResolve = studio.slice(studio.indexOf('const topBar = topBarPropsMemo.resolve'));
    const topBarDeps = topBarResolve.slice(0, topBarResolve.indexOf('], () =>'));
    expect(topBarDeps.indexOf('settings.grainScale'), 'topBar deps must drop grainScale').toBe(-1);
    expect(topBarDeps.indexOf('settings.grainStrength'), 'topBar deps must drop grainStrength').toBe(-1);
    expect(topBarDeps.indexOf('settings.background'), 'topBar deps must drop background').toBe(-1);
    const topBarBody = topBarResolve.slice(0, topBarResolve.indexOf('});'));
    expect(topBarBody.indexOf('grainScale: settings.grainScale'), 'topBar body must drop grainScale').toBe(-1);
    expect(topBarBody.indexOf('onGrainScaleChange:'), 'topBar body must drop onGrainScaleChange').toBe(-1);

    const rightPanelResolve = studio.slice(studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve'));
    const rightPanelDeps = rightPanelResolve.slice(0, rightPanelResolve.indexOf('], () =>'));
    expect(rightPanelDeps.indexOf('settings.grainScale'), 'rightPanel deps must name grainScale').toBeGreaterThan(-1);
    expect(rightPanelDeps.indexOf('settings.grainStrength'), 'rightPanel deps must name grainStrength').toBeGreaterThan(-1);
    expect(rightPanelDeps.indexOf('handleGrainStrengthChange'), 'rightPanel deps must name strength handler').toBeGreaterThan(-1);
    expect(rightPanelDeps.indexOf('handleGrainScaleChange'), 'rightPanel deps must name scale handler').toBeGreaterThan(-1);
    const rightPanelBody = rightPanelResolve.slice(0, rightPanelResolve.indexOf('onColorChange'));
    expect(rightPanelBody.indexOf('grainScale: settings.grainScale'), 'rightPanel body must pass grainScale').toBeGreaterThan(-1);
    expect(rightPanelBody.indexOf('onGrainScaleChange: handleGrainScaleChange'), 'rightPanel body must pass scale handler').toBeGreaterThan(-1);
    expect(rightPanelBody.indexOf('onGrainStrengthChange: handleGrainStrengthChange'), 'rightPanel body must pass strength handler').toBeGreaterThan(-1);

    const composition = studio.slice(studio.indexOf('const cachedRotoPlaybackComposition'));
    const compositionDeps = composition.slice(0, composition.indexOf(']);'));
    expect(compositionDeps.indexOf('settings.grainScale'), 'playback composition must name grainScale').toBeGreaterThan(-1);

    const canvasStack = studio.slice(studio.indexOf('const canvasStack = canvasStackPropsMemo.resolve'));
    const canvasStackDeps = canvasStack.slice(0, canvasStack.indexOf('], () =>'));
    expect(canvasStackDeps.indexOf('settings.grainScale'), 'canvasStack deps must name grainScale').toBeGreaterThan(-1);
    expect(canvasStackDeps.indexOf('physicPaintVersion.value'), 'canvasStack deps must name physicPaintVersion').toBeGreaterThan(-1);
  });

  it('StudioView PlaybackBackground effect deps include props.background.grainScale', () => {
    const view = studioViewSource();
    const effect = view.slice(view.indexOf('function PhysicsPaintRotoPlaybackBackground'));
    const deps = effect.slice(effect.indexOf('}, ['), effect.indexOf(']);') + 1);
    expect(deps).toContain('props.background.grainScale');
    expect(deps).toContain('props.background.grainStrength');
  });

  it('engine actions destructure and export setGrainScale for the grain handlers', () => {
    const studio = studioSource();
    const destructure = studio.slice(studio.indexOf('const {\n    selectTool,'), studio.indexOf('} = usePhysicsPaintEngineActions'));
    expect(destructure).toContain('setGrainScale');
    expect(destructure).toContain('setGrainStrength');
  });
});

// Hydration round trip (Task 1 spine + Task 3 control default) — the settings
// suite owns the full fallback restore; this pins the shared default here so a
// TopBar default drift is caught with the control.
describe('260923-bcm grain scale hydration defaults', () => {
  it('makeInitial settings default grainScale to 1', () => {
    expect(makeInitialPhysicsPaintStudioSettings().grainScale).toBe(1);
  });
});
