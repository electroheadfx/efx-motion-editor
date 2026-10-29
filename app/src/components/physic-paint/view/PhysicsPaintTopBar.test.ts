import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { signal } from '@preact/signals';
import { Eraser, Paintbrush } from 'lucide-preact';
import {
  LiftEditSwitch,
  PhysicsPaintTopBar,
  ScriptRecordingSwitch,
  TopBarBrushTrigger,
  type PhysicsPaintTopBarProps,
} from './PhysicsPaintTopBar';
import { activeModule } from '../../shared/activeModule';
import {
  aquarelleBrushMenuAnchor,
  aquarelleBrushMenuOpen,
  aquarelleBrushMenuTarget,
  aquarelleScriptRecordingEnabled,
  setAquarelleScriptRecordingEnabled,
  setAquarelleTool,
} from './aquarelleRecordState';
import {
  aquarelleSelectMode,
  aquarelleStrokeSettingsDismissed,
  aquarelleStrokeTypeFilter,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
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
    moveAvailable: signal(true),
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

  it('pins the tool cluster to the right edge at every width (261029-hy2)', () => {
    const styles = css();
    const base = styles.slice(0, styles.indexOf('@media'));
    const primary = getCssRuleBlock(base, '.physics-paint-topbar-primary {');
    expect(primary, 'no auto margin — the flex-end pin does the work').not.toContain('margin-left: auto');
    expect(primary).toContain('flex-wrap: nowrap');
    expect(primary, 'primary takes the remaining width and pins inside it').toContain('flex: 1 1 auto');
    expect(primary, 'primary pins its cluster to the right edge').toContain('justify-content: flex-end');
    expect(primary, 'the centered layout is retired').not.toContain('justify-content: center');
    expect(primary, 'primary is the optional-knob query container').toContain('container-type: inline-size');
    const left = getCssRuleBlock(base, '.physics-paint-topbar-left {');
    expect(left, 'left cluster keeps its content width').toContain('flex: 0 0 auto');
    expect(styles, 'the old balanced right spacer is gone').not.toContain('.physics-paint-topbar-right {');
  });

  it('hides the last optional watercolor knobs via container queries (I-11 follow-up)', () => {
    const styles = css();
    expect(styles, 'Grain hides first at wide viewports').toContain('@container (max-width: 739px)');
    expect(styles, 'Edges hides last').toContain('@container (max-width: 589px)');
    expect(styles, 'narrow-viewport thresholds follow the 115px control width').toContain(
      '@container (max-width: 606px)',
    );
    // Pigment is the primary control in Water color, never an optional knob.
    expect(styles).not.toContain('.physics-paint-topbar-optional-pigment');
    expect(styles).toContain('.physics-paint-topbar-optional-grain');
    expect(styles).toContain('.physics-paint-topbar-optional-edges');
    // The hide rules must out-rank .physics-paint-topbar-control's display:flex
    // (the equal-specificity bug that kept every knob visible).
    const controlAt = styles.indexOf('.physics-paint-topbar-control {');
    const hideAt = styles.indexOf('.physics-paint-topbar-primary .physics-paint-topbar-optional-grain');
    expect(controlAt, 'control display rule must exist').toBeGreaterThan(-1);
    expect(hideAt, 'hide rule must exist').toBeGreaterThan(-1);
    expect(hideAt, 'hide rule must follow the control display rule').toBeGreaterThan(controlAt);
  });

  it('hides Water at the deepest threshold, inside the existing media blocks (261029-hy2 CR-02)', () => {
    const styles = css();
    const wideStart = styles.indexOf('@media (min-width: 1181px) {\n  @container (max-width: 739px)');
    const narrowStart = styles.indexOf('@media (max-width: 1180px) {\n  @container (max-width: 606px)');
    const chainEnd = styles.indexOf('.physics-paint-segmented-row {');
    expect(wideStart, 'the wide hide-chain block exists').toBeGreaterThan(-1);
    expect(narrowStart, 'the narrow hide-chain block exists').toBeGreaterThan(wideStart);
    expect(chainEnd, 'the hide chain is followed by the next base rule').toBeGreaterThan(narrowStart);
    const wide = styles.slice(wideStart, narrowStart);
    const narrow = styles.slice(narrowStart, chainEnd);
    // 3 visible controls = 3 × 140 + 2 × 10 = 440 / 3 × 115 + 2 × 8 = 361.
    expect(wide).toContain('@container (max-width: 439px)');
    expect(narrow).toContain('@container (max-width: 360px)');
    const waterSelector = '.physics-paint-topbar-primary .physics-paint-topbar-optional-water';
    expect(wide, 'the Water tier lives in the wide block').toContain(waterSelector);
    expect(narrow, 'the Water tier lives in the narrow block').toContain(waterSelector);
    // No new base @media above the first one: the tier follows the Edges tier.
    expect(wide.indexOf(waterSelector)).toBeGreaterThan(wide.indexOf('@container (max-width: 589px)'));
    expect(narrow.indexOf(waterSelector)).toBeGreaterThan(narrow.indexOf('@container (max-width: 483px)'));
    // Out-ranks .physics-paint-topbar-control's display:flex (source order).
    const controlAt = styles.indexOf('.physics-paint-topbar-control {');
    expect(styles.indexOf(waterSelector)).toBeGreaterThan(controlAt);
  });

  it('folds the Eraser cluster instead of clipping it at narrow widths (261029-hy2 CR-02)', () => {
    const styles = css();
    const responsiveStart = styles.indexOf('@media (max-width: 1180px) {\n  .physics-paint-studio {');
    const responsiveEnd = styles.indexOf('@media (max-width: 860px) {');
    expect(responsiveStart, 'the responsive block exists').toBeGreaterThan(-1);
    expect(responsiveEnd).toBeGreaterThan(responsiveStart);
    const responsive = styles.slice(responsiveStart, responsiveEnd);
    expect(responsive).toContain('.physics-paint-topbar-lift {');
    expect(responsive).toContain('flex-wrap: wrap');
    const strengthAt = responsive.indexOf('.physics-paint-topbar-lift-strength {');
    expect(strengthAt, 'the strength minimum shrinks below 1180').toBeGreaterThan(-1);
    const strength = responsive.slice(strengthAt, responsive.indexOf('}', strengthAt) + 1);
    expect(strength).toContain('min-width: 140px');
    expect(strength).toContain('gap: 4px');
    // Wide seats keep the roomier 180px minimum.
    const base = styles.slice(0, styles.indexOf('@media'));
    const baseStrengthAt = base.indexOf('.physics-paint-topbar-lift-strength {');
    expect(baseStrengthAt).toBeGreaterThan(-1);
    expect(base.slice(baseStrengthAt, base.indexOf('}', baseStrengthAt) + 1)).toContain('min-width: 180px');
  });
});

// 261027-gh9g: the module switcher is gone from the Studio top bar. The
// enlarged brush trigger (thumb + name) seats in the LEFT cluster after the
// Engine ready status pill and opens the brush dropdown.
describe('261027-gh9g top bar brush trigger + centered sliders', () => {
  it('renders the active brush trigger with the preset id in the left slot', () => {
    const tree = renderTopBar(baseTopBarProps());
    const nodes = childrenOf(tree);
    const left = nodes.find((n) => (n as AnyVNode).props?.['class'] === 'physics-paint-topbar-left') as AnyVNode | undefined;
    const primary = nodes.find((n) => (n as AnyVNode).props?.['class'] === 'physics-paint-topbar-primary') as AnyVNode | undefined;
    expect(left, 'left slot must render').toBeDefined();
    expect(primary, 'primary cluster must render').toBeDefined();

    const leftDesc = childrenOf(left);
    const primaryDesc = childrenOf(primary);
    const trigger = leftDesc.find(
      (n) => typeof (n as AnyVNode).props?.onToggle === 'function',
    ) as AnyVNode | undefined;
    const isStatusPill = (n: unknown) => String((n as AnyVNode).props?.['class'] ?? '').includes('physics-paint-status-pill');

    expect(trigger, 'brush trigger seats in the left slot').toBeTruthy();
    // 261028-k03c D1: FILBERT is the new-Brush default (was the 261027-gh9f
    // dry CHALK stick).
    expect(trigger!.props?.presetId).toBe('filbert');
    expect(primaryDesc.some((n) => typeof (n as AnyVNode).props?.onToggle === 'function'), 'primary holds sliders only').toBe(false);
    expect(leftDesc.some(isStatusPill), 'status pill stays in the left slot').toBe(true);

    const pillIdx = leftDesc.findIndex(isStatusPill);
    const triggerIdx = leftDesc.findIndex((n) => typeof (n as AnyVNode).props?.onToggle === 'function');
    expect(pillIdx, 'status pill renders ahead of the trigger').toBeGreaterThan(-1);
    expect(triggerIdx, 'brush trigger follows the status pill').toBeGreaterThan(pillIdx);
  });

  it('the trigger opens the dropdown with its own viewport anchor', () => {
    const tree = renderTopBar(baseTopBarProps());
    const trigger = [...childrenOf(tree)].find(
      (n) => typeof (n as AnyVNode).props?.onToggle === 'function',
    ) as AnyVNode;
    const onToggle = trigger.props.onToggle as (event: unknown) => void;
    onToggle({
      currentTarget: { getBoundingClientRect: () => ({ left: 24, bottom: 58 }) },
    });
    try {
      expect(aquarelleBrushMenuOpen.value).toBe(true);
      expect(aquarelleBrushMenuAnchor.value).toEqual({ left: 24, top: 64 });
    } finally {
      aquarelleBrushMenuOpen.value = false;
      aquarelleBrushMenuAnchor.value = null;
    }
  });

  it('source has no module switcher and seats the trigger in the left slot', () => {
    const body = stripComments(topBarSource());
    expect(body).toContain('onBrushSizeChange');
    expect(body).toContain('onOpacityChange');
    expect(body).toContain('setAquarelleParam');
    expect(body, 'the module switcher left the Studio top bar').not.toContain('ModuleSwitcher');
    const leftStart = body.indexOf('class="physics-paint-topbar-left"');
    const primaryStart = body.indexOf('class="physics-paint-topbar-primary"');
    const triggerAt = body.indexOf('<TopBarBrushTrigger');
    expect(leftStart).toBeGreaterThan(-1);
    expect(primaryStart).toBeGreaterThan(leftStart);
    expect(triggerAt, 'brush trigger follows the left-slot opening tag').toBeGreaterThan(leftStart);
    expect(triggerAt, 'brush trigger precedes the primary cluster').toBeLessThan(primaryStart);
    const statusAt = body.indexOf('physics-paint-topbar-status', leftStart);
    expect(statusAt, 'status pill precedes the trigger in the left slot').toBeGreaterThan(leftStart);
    expect(triggerAt, 'brush trigger follows the status pill').toBeGreaterThan(statusAt);
  });

  it('keeps the seating CSS contract: 15px separator, larger thumb, one scrolling row', () => {
    const styles = css();
    const trigger = getCssRuleBlock(styles, '.physics-paint-brush-trigger {');
    expect(trigger, '15px separator faces the status pill').toContain('margin-left: 15px');
    expect(trigger).toContain('height: 38px');
    const thumb = getCssRuleBlock(styles, '.physics-paint-brush-trigger-thumb {');
    expect(thumb, 'the brush thumb is larger than the old switcher').toContain('width: 96px');
    expect(thumb).toContain('height: 28px');
    const left = getCssRuleBlock(styles, '.physics-paint-topbar-left {');
    expect(left, 'left cluster does not stack a second gap').toContain('gap: 0');
    const bar = getCssRuleBlock(styles, '.physics-paint-topbar {');
    expect(bar, 'tight widths scroll one row rather than overlap').toContain('overflow-x: auto');
  });
});

// 261029-hy2: ONE tool pill for Brush and Eraser, and the settings cluster
// renders only for tools that own settings.
describe('261029-hy2 tool pill + settings-cluster gating', () => {
  function findPill(tree: AnyVNode): AnyVNode | undefined {
    return (childrenOf(tree) as AnyVNode[]).find((node) => node.type === TopBarBrushTrigger);
  }

  it('renders the tool icon, name and aria-label for both tools', () => {
    const brush = TopBarBrushTrigger({
      tool: 'brush',
      presetId: 'filbert',
      open: false,
      onToggle: () => {},
    }) as AnyVNode;
    expect(brush.type).toBe('button');
    const brushNodes = childrenOf(brush) as AnyVNode[];
    const brushIcon = brushNodes.find((node) => node.props?.class === 'physics-paint-brush-trigger-icon');
    expect(brushIcon, 'the brush pill leads with the Paintbrush icon').toBeDefined();
    expect(brushIcon!.type).toBe(Paintbrush);
    expect(brushIcon!.props?.size).toBe(15);
    expect(brushIcon!.props?.['aria-hidden']).toBe('true');
    const brushName = brushNodes.find((node) => node.props?.class === 'physics-paint-brush-trigger-name');
    expect(brushName?.props?.children).toBe('Filbert');
    expect(brush.props?.title).toBe('Choose a brush');
    expect(brush.props?.['aria-label']).toBe('Brush — Filbert');

    const lift = TopBarBrushTrigger({
      tool: 'lift',
      presetId: 'round',
      open: false,
      onToggle: () => {},
    }) as AnyVNode;
    const liftNodes = childrenOf(lift) as AnyVNode[];
    const liftIcon = liftNodes.find((node) => node.props?.class === 'physics-paint-brush-trigger-icon');
    expect(liftIcon, 'the eraser pill leads with the Eraser icon').toBeDefined();
    expect(liftIcon!.type).toBe(Eraser);
    const liftName = liftNodes.find((node) => node.props?.class === 'physics-paint-brush-trigger-name');
    expect(liftName?.props?.children).toBe('Round');
    expect(lift.props?.title).toBe('Choose an eraser shape');
    expect(lift.props?.['aria-label']).toBe('Eraser — Round');

    // Null tip: the lift name falls back to Filbert (the effective eraser
    // shape), the brush name keeps its generic fallback.
    const nullLift = TopBarBrushTrigger({
      tool: 'lift',
      presetId: null,
      open: false,
      onToggle: () => {},
    }) as AnyVNode;
    const nullLiftName = (childrenOf(nullLift) as AnyVNode[]).find(
      (node) => node.props?.class === 'physics-paint-brush-trigger-name',
    );
    expect(nullLiftName?.props?.children).toBe('Filbert');
    expect(nullLift.props?.['aria-label']).toBe('Choose an eraser shape');
    const nullBrush = TopBarBrushTrigger({
      tool: 'brush',
      presetId: null,
      open: false,
      onToggle: () => {},
    }) as AnyVNode;
    const nullBrushName = (childrenOf(nullBrush) as AnyVNode[]).find(
      (node) => node.props?.class === 'physics-paint-brush-trigger-name',
    );
    expect(nullBrushName?.props?.children).toBe('Brushes');
    expect(nullBrush.props?.['aria-label']).toBe('Choose a brush');
  });

  it('the eraser pill carries the shape testid and the shared trigger attribute', () => {
    const lift = TopBarBrushTrigger({
      tool: 'lift',
      presetId: 'filbert',
      open: false,
      onToggle: () => {},
      testId: 'physics-lift-shape',
    }) as AnyVNode;
    expect(lift.props?.['data-testid']).toBe('physics-lift-shape');
    expect(lift.props?.['data-watercolor-brush-trigger']).toBe(true);
    expect(lift.props?.['aria-haspopup']).toBe('menu');
    expect(lift.props?.['aria-expanded']).toBe(false);
  });

  it('both pills honor the bar disabled prop', () => {
    for (const tool of ['brush', 'lift'] as const) {
      const disabledPill = TopBarBrushTrigger({
        tool,
        presetId: 'filbert',
        open: false,
        onToggle: () => {},
        disabled: true,
      }) as AnyVNode;
      expect(disabledPill.props?.disabled, `${tool} pill follows disabled`).toBe(true);
      const enabledPill = TopBarBrushTrigger({
        tool,
        presetId: 'filbert',
        open: false,
        onToggle: () => {},
      }) as AnyVNode;
      expect(enabledPill.props?.disabled, `${tool} pill is enabled by default`).toBeFalsy();
    }
    // Both top-bar mounts thread the bar's disabled prop into the pill.
    const body = stripComments(topBarSource());
    const mounts = body.match(/<TopBarBrushTrigger[\s\S]*?\/>/g) ?? [];
    expect(mounts.length, 'one pill per tool branch').toBe(2);
    for (const mount of mounts) expect(mount).toContain('disabled={disabled}');
  });

  it('renders the brush pill but no settings cluster for Water and Pen', () => {
    for (const tool of ['water', 'pen'] as const) {
      setAquarelleTool(tool);
      try {
        const tree = renderTopBar(baseTopBarProps());
        const nodes = childrenOf(tree) as AnyVNode[];
        expect(
          nodes.some((node) => node.props?.class === 'physics-paint-topbar-primary'),
          `${tool} removes the whole settings cluster from the DOM`,
        ).toBe(false);
        const pill = findPill(tree);
        expect(pill, `${tool} keeps the brush pill`).toBeDefined();
        expect(pill!.props?.tool).toBe('brush');
        expect(pill!.props?.presetId).toBe('filbert');
      } finally {
        setAquarelleTool('brush');
      }
    }
  });

  it('the pill opens its own dropdown with the tool target and the viewport anchor', () => {
    setAquarelleTool('brush');
    aquarelleBrushMenuOpen.value = false;
    try {
      const brushPill = findPill(renderTopBar(baseTopBarProps()));
      expect(brushPill!.props?.tool).toBe('brush');
      (brushPill!.props?.onToggle as (event: unknown) => void)({
        currentTarget: { getBoundingClientRect: () => ({ left: 24, bottom: 58 }) },
      });
      expect(aquarelleBrushMenuOpen.value).toBe(true);
      expect(aquarelleBrushMenuAnchor.value).toEqual({ left: 24, top: 64 });
      expect(aquarelleBrushMenuTarget.value).toBe('brush');
    } finally {
      aquarelleBrushMenuOpen.value = false;
      aquarelleBrushMenuAnchor.value = null;
      aquarelleBrushMenuTarget.value = 'brush';
    }

    setAquarelleTool('lift');
    try {
      const liftPill = findPill(renderTopBar(baseTopBarProps()));
      expect(liftPill!.props?.tool).toBe('lift');
      (liftPill!.props?.onToggle as (event: unknown) => void)({
        currentTarget: { getBoundingClientRect: () => ({ left: 24, bottom: 58 }) },
      });
      expect(aquarelleBrushMenuOpen.value).toBe(true);
      expect(aquarelleBrushMenuTarget.value).toBe('lift');
    } finally {
      aquarelleBrushMenuOpen.value = false;
      aquarelleBrushMenuAnchor.value = null;
      aquarelleBrushMenuTarget.value = 'brush';
      setAquarelleTool('brush');
    }
  });

  it('replaces the native shape picker with the eraser pill (261029-hy2)', () => {
    setAquarelleTool('lift');
    try {
      const pill = findPill(renderTopBar(baseTopBarProps()));
      expect(pill, 'the Eraser tool seats the shared pill in the left slot').toBeDefined();
      expect(pill!.props?.tool).toBe('lift');
      expect(pill!.props?.presetId).toBe('filbert');
      expect(pill!.props?.testId).toBe('physics-lift-shape');
      // The retired picker is gone from disk and from the top bar, while its
      // testid, the Eraser cluster and the lift tip read survive.
      const body = stripComments(topBarSource());
      expect(body).toContain('physics-lift-shape');
      expect(body).toContain('physics-paint-topbar-lift');
      expect(body).toContain('aquarelleLiftTipId');
      expect(body).not.toContain('<LiftShapePicker');
      expect(body).not.toContain("from './LiftShapePicker'");
      expect(body).toContain("const liftTipId = aquarelleLiftTipId.value ?? 'filbert';");
    } finally {
      setAquarelleTool('brush');
    }
  });
});

// 261017-vcn Q6: the grain widgets left the top bar for the Paper tab. The
// top bar keeps Brush size + Pigment only among the former top-bar controls.
describe('261017-vcn top bar slim (I-04 remainder)', () => {
  it('renders Brush size + Pigment and no Background / Grain rows', () => {
    // 261027-klx: Water color is the only module — the bar has one branch.
    const props = baseTopBarProps();
    const tree = renderTopBar(props);
    // Host-only walk: TopBarSlider wraps SliderStepper and must not be
    // expanded (hook state). The wrapper carries the label prop.
    const controls = childrenOf(tree).filter(
      (node) => typeof (node as AnyVNode).props?.label === 'string',
    ) as AnyVNode[];
    const labels = controls.map((s) => s.props.label);
    expect(labels).toContain('Brush size');
    expect(labels).toContain('Pigment');
    expect(labels).not.toContain('Opacity');
    expect(labels).not.toContain('Grain scale');
    // The retired rows leave the render tree.
    expect(() => findByAria(tree, 'Grain strength')).toThrow();
    expect(() => findByAria(tree, 'Background')).toThrow();
  });
});

// 261018-f15 C1: Water / Edges / Grain ride the watercolor branch after the
// primary control and write setAquarelleParam('water' | 'edge' | 'granulation').
// The primary control is Pigment (`load`) in Water color — never Opacity.
describe('261018-f15 watercolor top-bar aquarelle globals', () => {
  it('watercolor branch shows the primary Pigment control, then Water / Edges / Grain', async () => {
    vi.resetModules();
    vi.doMock('../../shared/activeModule', () => ({
      activeModule: { value: 'watercolor' },
      WATERCOLOR_ONLY: true,
      setActiveModule: () => {},
    }));
    vi.doMock('./aquarelleRecordState', () => ({
      aquarelleParams: { value: { size: 22, load: 80, water: 40, edge: 60, granulation: 35, lift: 22 } },
      aquarelleActiveTool: { value: 'brush' },
      aquarelleSelectedTipId: { value: 'chalk' },
      // 261029-hy2: the bar reads the lift tip unconditionally now (the pill's
      // preset for the Eraser tool), exactly like aquarelleSelectedTipId.
      aquarelleLiftTipId: { value: null },
      aquarelleBrushMenuOpen: { value: false },
      aquarelleScriptRecordingEnabled: { value: true, peek: () => true },
      setAquarelleBrushMenuOpen: vi.fn(),
      setAquarelleLiftTipId: vi.fn(),
      setAquarelleParam: vi.fn(),
      setAquarelleScriptRecordingEnabled: vi.fn(),
    }));
    try {
      const { PhysicsPaintTopBar: WatercolorTopBar } = await import('./PhysicsPaintTopBar');
      const tree = WatercolorTopBar(baseTopBarProps()) as AnyVNode;
      const controls = childrenOf(tree).filter(
        (node) => typeof (node as AnyVNode).props?.label === 'string',
      ) as AnyVNode[];
      const labels = controls.map((s) => s.props.label);
      expect(labels).toEqual(['Brush size', 'Pigment', 'Water', 'Edges', 'Grain']);
    } finally {
      vi.doUnmock('../../shared/activeModule');
      vi.doUnmock('./aquarelleRecordState');
      vi.resetModules();
    }
  });

  it('Water / Edges / Grain route to setAquarelleParam; Pigment is the primary control (source pin)', () => {
    const body = stripComments(topBarSource());
    expect(body).toContain('setAquarelleParam');
    expect(body).toContain("setAquarelleParam('water'");
    expect(body).toContain("setAquarelleParam('edge'");
    expect(body).toContain("setAquarelleParam('granulation'");
    // Pigment (`load`) rides the primary slot through the Studio router — it
    // is not a second optional knob and never wears the Opacity label.
    expect(body).not.toContain('physics-paint-topbar-optional-pigment');
    expect(body).toContain('label="Pigment"');
    // 261027-klx: one module — no branch gate and no Opacity label left.
    expect(body).not.toContain('isWatercolor');
    expect(body).not.toContain("'Opacity'");
    // Optional knobs carry the query-hidden classes.
    expect(body).toContain('physics-paint-topbar-optional-grain');
    expect(body).toContain('physics-paint-topbar-optional-edges');
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
    // 261027-klx: the engine-actions surface collapsed to paper display only —
    // the destructure is the three paper/grain setters, no tool funnel.
    const destructureStart = studio.indexOf('const { setBackground, setGrainStrength, setGrainScale } = usePhysicsPaintEngineActions({');
    expect(destructureStart, 'paper-display destructure must exist').toBeGreaterThan(-1);
    const destructure = studio.slice(destructureStart, studio.indexOf('} = usePhysicsPaintEngineActions'));
    expect(destructure).toContain('setGrainScale');
    expect(destructure).toContain('setGrainStrength');
    expect(studio).not.toContain('selectTool: selectToolEngine');
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

// 261027-k6j — the session "Script" switch: a native role="switch" pill that
// seats immediately after the brush trigger and gates stroke recording only.
describe('261027-k6j Script switch', () => {
  function renderSwitch() {
    return ScriptRecordingSwitch() as AnyVNode;
  }

  it('seats right after the brush trigger in the left cluster', () => {
    const previousModule = activeModule.value;
    activeModule.value = 'watercolor';
    try {
      const tree = renderTopBar(baseTopBarProps());
      const left = childrenOf(tree).find(
        (n) => (n as AnyVNode).props?.['class'] === 'physics-paint-topbar-left',
      ) as AnyVNode | undefined;
      expect(left, 'left slot must render').toBeDefined();
      const leftDesc = childrenOf(left!);
      const triggerIdx = leftDesc.findIndex(
        (n) => typeof (n as AnyVNode).props?.onToggle === 'function',
      );
      const switchIdx = leftDesc.findIndex((n) => (n as AnyVNode).type === ScriptRecordingSwitch);
      expect(triggerIdx, 'brush trigger seats in the left slot').toBeGreaterThan(-1);
      expect(switchIdx, 'Script switch seats in the left slot').toBeGreaterThan(-1);
      expect(switchIdx, 'the switch follows the brush trigger').toBeGreaterThan(triggerIdx);
    } finally {
      activeModule.value = previousModule;
    }
  });

  it('renders a keyboard-operable role="switch" mirrored to the session signal', () => {
    const previous = aquarelleScriptRecordingEnabled.value;
    setAquarelleScriptRecordingEnabled(true);
    try {
      const tree = renderSwitch();
      expect(tree.type).toBe('button');
      expect(tree.props?.type).toBe('button');
      expect(tree.props?.role).toBe('switch');
      expect(tree.props?.['aria-checked']).toBe('true');
      expect(String(tree.props?.class)).toContain('is-on');
      // No aria-label: the visible text is the accessible name.
      expect(tree.props?.['aria-label']).toBeUndefined();
      const label = childrenOf(tree).find(
        (n) => (n as AnyVNode).props?.class === 'physics-paint-script-switch-label',
      ) as AnyVNode | undefined;
      expect(label?.props?.children).toBe('Script');

      setAquarelleScriptRecordingEnabled(false);
      const offTree = renderSwitch();
      expect(offTree.props?.['aria-checked']).toBe('false');
      expect(String(offTree.props?.class)).not.toContain('is-on');

      // Clicking flips through the setter, reading the signal at click time.
      (offTree.props?.onClick as () => void)();
      expect(aquarelleScriptRecordingEnabled.value).toBe(true);
    } finally {
      setAquarelleScriptRecordingEnabled(previous);
    }
  });

  it('source pins the switch contract and never uses useState', () => {
    const body = stripComments(topBarSource());
    expect(body).toContain('role="switch"');
    expect(body).toContain('aria-checked');
    expect(body).toContain('setAquarelleScriptRecordingEnabled');
    expect(body).not.toContain('useState');
  });

  it('pins the reference track/knob/label CSS contract', () => {
    const styles = css();
    const track = getCssRuleBlock(styles, '.physics-paint-script-switch-track {');
    expect(track).toContain('width: 40px');
    expect(track).toContain('height: 22px');
    expect(track).toContain('border-radius: 999px');
    expect(track).toContain('background: #5a5d61');
    const onTrack = getCssRuleBlock(styles, '.physics-paint-script-switch.is-on .physics-paint-script-switch-track {');
    expect(onTrack).toContain('#2f9fe0');
    const knob = getCssRuleBlock(styles, '.physics-paint-script-switch-knob {');
    expect(knob).toContain('width: 16px');
    const onKnob = getCssRuleBlock(styles, '.physics-paint-script-switch.is-on .physics-paint-script-switch-knob {');
    expect(onKnob).toContain('translateX(18px)');
    const label = getCssRuleBlock(styles, '.physics-paint-script-switch-label {');
    expect(label).toContain('font-size: 12px');
  });
});


describe('261028-k03b / 261029-eur Eraser tool controls', () => {
  it('swaps the brush cluster for Eraser strength + the Edit switch', () => {
    setAquarelleTool('lift');
    try {
      const tree = renderTopBar(baseTopBarProps());
      const nodes = childrenOf(tree) as AnyVNode[];
      const strength = nodes.find((node) => node.props?.['data-testid'] === 'physics-lift-strength');
      const editSwitch = nodes.find((node) => node.type === LiftEditSwitch);
      expect(strength).toBeDefined();
      expect(editSwitch, 'the Edit switch seats inside the Eraser cluster').toBeDefined();
      // The retired one-shot selection button is gone.
      expect(nodes.some((node) => node.props?.['data-testid'] === 'physics-lift-select')).toBe(false);
      // The brush knobs do not describe an eraser stroke.
      expect(nodes.some((node) => node.props?.label === 'Brush size')).toBe(false);
      expect(nodes.some((node) => node.props?.label === 'Pigment')).toBe(false);
    } finally {
      setAquarelleTool('brush');
    }
  });

  it('renders the Edit switch as a role="switch" driving the real setter', () => {
    setAquarelleSelectMode(false);
    // IN-04: arm the dismissal flag first, so the off -> on assertion below
    // exercises the real reset path instead of passing trivially.
    aquarelleStrokeSettingsDismissed.value = true;
    try {
      const moveAvailable = signal(true);
      const offTree = LiftEditSwitch({ moveAvailable }) as AnyVNode;
      expect(offTree.type).toBe('button');
      expect(offTree.props?.type).toBe('button');
      expect(offTree.props?.role).toBe('switch');
      expect(offTree.props?.['aria-checked']).toBe('false');
      expect(offTree.props?.['data-testid']).toBe('physics-lift-edit');
      expect(String(offTree.props?.class)).not.toContain('is-on');
      expect(offTree.props?.disabled).toBe(false);
      const label = childrenOf(offTree).find(
        (node) => (node as AnyVNode).props?.class === 'physics-paint-script-switch-label',
      ) as AnyVNode | undefined;
      expect(label?.props?.children).toBe('Edit');

      // Off -> on: one call sets select mode AND the lift filter, and clears
      // an explicit close left over from an earlier session (the choke point
      // is the flag's only reset site).
      (offTree.props?.onClick as () => void)();
      expect(aquarelleSelectMode.value).toBe(true);
      expect(aquarelleStrokeTypeFilter.value).toBe('lift');
      expect(aquarelleStrokeSettingsDismissed.value, 'off -> on re-arms the dialog').toBe(false);

      const onTree = LiftEditSwitch({ moveAvailable }) as AnyVNode;
      expect(onTree.props?.['aria-checked']).toBe('true');
      expect(String(onTree.props?.class)).toContain('is-on');

      // On -> off: select mode leaves and the filter resets to the plain-entry
      // default (Paint) through the setter.
      (onTree.props?.onClick as () => void)();
      expect(aquarelleSelectMode.value).toBe(false);
      expect(aquarelleStrokeTypeFilter.value).toBe('paint');
      // Leaving select mode never re-arms the flag — only the dialog's close
      // handler writes it (an event), so it stays cleared here.
      expect(aquarelleStrokeSettingsDismissed.value).toBe(false);
    } finally {
      aquarelleStrokeSettingsDismissed.value = false;
      setAquarelleSelectMode(false);
    }
  });

  it('disables the Edit switch when the frame has nothing to select', () => {
    expect((LiftEditSwitch({ moveAvailable: signal(false) }) as AnyVNode).props?.disabled).toBe(true);
    expect((LiftEditSwitch({ moveAvailable: signal(true) }) as AnyVNode).props?.disabled).toBe(false);
    expect(
      (LiftEditSwitch({ disabled: true, moveAvailable: signal(true) }) as AnyVNode).props?.disabled,
    ).toBe(true);
  });

  it('pins the eraser icon, strength bounds and the Edit wiring in source', () => {
    const body = stripComments(topBarSource());
    expect(body).toContain('<Eraser size={15}');
    expect(body).toContain('label="Eraser strength"');
    expect(body).toContain('ariaLabel="Eraser strength"');
    expect(body).toContain("setAquarelleParam('lift'");
    expect(body).toContain('min={5}');
    expect(body).toContain('max={90}');
    expect(body).toContain('data-testid="physics-lift-edit"');
    expect(body).toContain("setAquarelleSelectMode(!active, 'lift')");
    // The one-shot Select button and its prop left the file.
    expect(body).not.toContain('onSelectLiftStrokes');
    expect(body).not.toContain('physics-lift-select');
    expect(body).not.toContain('Select lifts');
    expect(body).not.toContain('Lift strength');
    // The switch leaf reads the shared signals — never the Studio body.
    expect(body).toContain('aquarelleSelectMode.value');
    expect(body).toContain('aquarelleStrokeTypeFilter.value');
    expect(body).not.toContain('useState');
    // The Layout B control never stacks the icon above the slider.
    const styles = css();
    const row = getCssRuleBlock(styles, '.physics-paint-topbar-lift-strength {');
    expect(row).toContain('flex-direction: row');
  });

  it('pins the switch :disabled arm and drops the retired Select rule', () => {
    const styles = css();
    const disabled = getCssRuleBlock(styles, '.physics-paint-script-switch:disabled {');
    expect(disabled).toContain('opacity: 0.45');
    expect(disabled).toContain('cursor: not-allowed');
    expect(styles).not.toContain('.physics-paint-topbar-lift-select');
  });

  it('seats the eraser pill in the left slot, before the strength row', () => {
    setAquarelleTool('lift');
    try {
      const tree = renderTopBar(baseTopBarProps());
      const nodes = childrenOf(tree) as AnyVNode[];
      const pill = nodes.find((node) => node.type === TopBarBrushTrigger);
      expect(pill, 'the Eraser tool seats the shared pill in the left slot').toBeDefined();
      expect(pill!.props?.tool).toBe('lift');
      expect(pill!.props?.testId).toBe('physics-lift-shape');
      expect(pill!.props?.disabled, 'the pill follows the disabled prop').toBe(false);
      // The shape pill sits in the left slot, before the strength row.
      const body = stripComments(topBarSource());
      const pillAt = body.indexOf('<TopBarBrushTrigger');
      const strengthAt = body.indexOf('data-testid="physics-lift-strength"');
      expect(pillAt, 'eraser pill mount exists').toBeGreaterThan(-1);
      expect(strengthAt, 'strength row exists').toBeGreaterThan(pillAt);
    } finally {
      setAquarelleTool('brush');
    }
  });
});
