import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { PhysicsPaintTopBar, grainScaleStep, type PhysicsPaintTopBarProps } from './PhysicsPaintTopBar';
import { makeInitialPhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import { NumericStepper } from '../../shared/NumericStepper';
import { GRAIN_SCALE_MAX, GRAIN_SCALE_MIN } from '../../../efx-paint/document/efxPaintDocument';

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');

const studioPath = resolve(dirname(fileURLToPath(import.meta.url)), '../PhysicsPaintStudio.tsx');
const studioSource = () => readFileSync(studioPath, 'utf8');
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

type AnyVNode = VNode<Record<string, any>>;

function baseTopBarProps(): PhysicsPaintTopBarProps {
  return {
    brushSize: 11,
    opacity: 100,
    background: 'canvas1',
    paperGrain: 'canvas1',
    grainStrength: 0.45,
    grainScale: 1,
    ready: true,
    onBrushSizeChange: vi.fn(),
    onOpacityChange: vi.fn(),
    onBackgroundChange: vi.fn(),
    onPaperGrainChange: vi.fn(),
    onGrainStrengthChange: vi.fn(),
    onGrainScaleChange: vi.fn(),
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
  // components (NumericStepper) must not be expanded — they need hook state.
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function findByAria(tree: AnyVNode, label: string): AnyVNode {
  const match = childrenOf(tree).find((node) => (node as AnyVNode).props?.['aria-label'] === label) as AnyVNode | undefined;
  expect(match, `Missing element with aria-label ${label}`).toBeDefined();
  return match!;
}

function buttonsInGroup(tree: AnyVNode, groupLabel: string): AnyVNode[] {
  return childrenOf(findByAria(tree, groupLabel)).filter(
    (node) => (node as AnyVNode).type === 'button',
  ) as AnyVNode[];
}

describe('PhysicsPaintTopBar small-width responsiveness (36.15-06 fix)', () => {
  it('lets the studio top row grow beyond 58px so wrapped controls are never crushed', () => {
    // 47-01 UAT round 3: row 3 is `auto` — the workflow strip sets its own
    // dynamic height (default = exactly enough for all tracks + Bg, capped at
    // 270px; the top-edge drag handle resizes it). The canvas row absorbs the
    // difference.
    expect(getCssRuleBlock(css(), '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) auto');
  });

  it('reserves no fixed minimum side-column width in the topbar grid at any width', () => {
    const styles = css();
    expect(getCssRuleBlock(styles, '.physics-paint-topbar {')).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)');
    expect(styles).not.toContain('minmax(170px, 1fr)');
    expect(styles).not.toContain('minmax(120px, 1fr)');
  });

  it('wraps the primary control cluster at the base level instead of only inside a breakpoint', () => {
    const styles = css();
    const base = styles.slice(0, styles.indexOf('@media'));
    expect(getCssRuleBlock(base, '.physics-paint-topbar-primary {')).toContain('flex-wrap: wrap');
  });
});

// 260923-bcm UAT follow-up: Grain scale is a value stepper (− value +), not
// preset buttons. The step rule is the contract: 0.5 strictly inside ]0.5, 2.0[,
// 0.1 at/below 0.5 and at/above 2.0 — default 1.0 + → 1.5; 1.5 − − → 0.5;
// 0.5 − → 0.4; 1.5 + → 2.0, 2.0 + → 2.1. Values live in the shared
// [GRAIN_SCALE_MIN, GRAIN_SCALE_MAX] acceptance and route to onGrainScaleChange.
describe('260923-bcm Grain scale value stepper (Tools surface)', () => {
  it('renders a NumericStepper bound to grainScale with the shared bounds and live change handler', () => {
    const props = baseTopBarProps();
    const tree = renderTopBar(props);
    const stepper = childrenOf(tree).find((node) => (node as AnyVNode).type === NumericStepper) as AnyVNode | undefined;
    expect(stepper, 'Grain scale must render the shared NumericStepper').toBeDefined();
    expect(stepper!.props.value).toBe(1);
    expect(stepper!.props.step).toBe(0.5);
    expect(stepper!.props.min).toBe(GRAIN_SCALE_MIN);
    expect(stepper!.props.max).toBe(GRAIN_SCALE_MAX);
    expect(stepper!.props.ariaLabel).toBe('Grain scale');
    expect(stepper!.props.resolveStep).toBe(grainScaleStep);
    expect(stepper!.props.onChange).toBe(props.onGrainScaleChange);
    // Beside the existing Grain strength / paper grain controls on the same Tools surface.
    expect(findByAria(tree, 'Grain strength')).toBeDefined();
    expect(findByAria(tree, 'Paper grain')).toBeDefined();
    // No preset button row remains for Grain scale.
    expect(() => findByAria(tree, 'Grain scale')).toThrow();
  });

  it('step rule walks the user click sequences: 1.0 + → 1.5 → 2.0 → 2.1 and 1.5 − − → 0.5 − → 0.4', () => {
    let up = 1;
    up += grainScaleStep(up);
    expect(up).toBe(1.5);
    up += grainScaleStep(up);
    expect(up).toBe(2);
    up += grainScaleStep(up);
    expect(up).toBe(2.1);

    let down = 1.5;
    down -= grainScaleStep(down);
    expect(down).toBe(1);
    down -= grainScaleStep(down);
    expect(down).toBe(0.5);
    down -= grainScaleStep(down);
    expect(down).toBeCloseTo(0.4, 10);

    // Boundaries: interior keeps 0.5, the edges drop to 0.1.
    expect(grainScaleStep(0.6)).toBe(0.5);
    expect(grainScaleStep(0.5)).toBe(0.1);
    expect(grainScaleStep(0.4)).toBe(0.1);
    expect(grainScaleStep(1.9)).toBe(0.5);
    expect(grainScaleStep(2)).toBe(0.1);
    expect(grainScaleStep(9)).toBe(0.1);
  });

  it('grain strength / paper grain buttons still route to their own handlers', () => {
    const props = baseTopBarProps();
    const tree = renderTopBar(props);
    const strength = buttonsInGroup(tree, 'Grain strength');
    expect(strength.length).toBeGreaterThan(0);
    strength[0].props.onClick();
    expect(props.onGrainStrengthChange).toHaveBeenCalled();
    expect(props.onPaperGrainChange).not.toHaveBeenCalled();
    expect(props.onGrainScaleChange).not.toHaveBeenCalled();
  });

  it('a non-default grainScale prop feeds the stepper value', () => {
    const props = { ...baseTopBarProps(), grainScale: 0.4 };
    const tree = renderTopBar(props);
    const stepper = childrenOf(tree).find((node) => (node as AnyVNode).type === NumericStepper) as AnyVNode | undefined;
    expect(stepper!.props.value).toBe(0.4);
    expect(stepper!.props.step).toBe(0.1);
  });
});

// 260923-bcm Task 3 (RED): one synchronous action writes settings + track
// mirror + document fallback, never the engine visible background, and every
// fond-input dep list names settings.grainScale / props.background.grainScale.
describe('260923-bcm Studio live wiring source pins', () => {
  it('handleGrainScaleChange writes settings, mirror, and fallback without an engine call', () => {
    const studio = studioSource();
    const start = studio.indexOf('const handleGrainScaleChange');
    expect(start, 'handleGrainScaleChange must exist in PhysicsPaintStudio').toBeGreaterThan(-1);
    const body = studio.slice(start, studio.indexOf('\n  const ', start + 1) > -1 ? studio.indexOf('\n  const ', start + 1) : start + 800);
    expect(body).toContain('setGrainScale');
    expect(body).toContain('setRotoBackgroundMetadata');
    expect(body).toContain('setBackgroundFallback');
    expect(body).toContain('backgroundModeToFallback');
    expect(body).not.toContain('setVisibleBackground');
    expect(body).not.toContain('setBgMode');
  });

  it('setGrainScale is updateSetting only with no engine visible-background call', () => {
    const actions = engineActionsSource();
    const start = actions.indexOf('const setGrainScale');
    expect(start, 'setGrainScale must exist in usePhysicsPaintEngineActions').toBeGreaterThan(-1);
    const body = actions.slice(start, actions.indexOf('\n  const ', start + 1));
    expect(body).toContain("updateSetting('grainScale'");
    expect(body).not.toContain('setVisibleBackground');
    expect(body).not.toContain('setBgMode');
    expect(body).not.toContain('setPaperGrain');
    expect(actions).toContain('setGrainScale');
  });

  it('settings.grainScale appears in the TopBar memo, playback composition, and canvasStack deps', () => {
    const studio = studioSource();

    const topBarResolve = studio.slice(studio.indexOf('const topBar = topBarPropsMemo.resolve'));
    const topBarDeps = topBarResolve.slice(0, topBarResolve.indexOf('], () =>'));
    expect(topBarDeps).toContain('settings.grainScale');
    expect(topBarResolve.slice(0, topBarResolve.indexOf('});'))).toContain('grainScale: settings.grainScale');
    expect(topBarResolve.slice(0, topBarResolve.indexOf('});'))).toContain('onGrainScaleChange: handleGrainScaleChange');

    const composition = studio.slice(studio.indexOf('const cachedRotoPlaybackComposition'));
    const compositionDeps = composition.slice(0, composition.indexOf(']);'));
    expect(compositionDeps).toContain('settings.grainScale');

    const canvasStack = studio.slice(studio.indexOf('const canvasStack = canvasStackPropsMemo.resolve'));
    const canvasStackDeps = canvasStack.slice(0, canvasStack.indexOf('], () =>'));
    expect(canvasStackDeps).toContain('settings.grainScale');
    expect(canvasStackDeps).toContain('physicPaintVersion.value');
  });

  it('StudioView PlaybackBackground effect deps include props.background.grainScale', () => {
    const view = studioViewSource();
    const effect = view.slice(view.indexOf('function PhysicsPaintRotoPlaybackBackground'));
    const deps = effect.slice(effect.indexOf('}, ['), effect.indexOf(']);') + 1);
    expect(deps).toContain('props.background.grainScale');
    expect(deps).toContain('props.background.grainStrength');
  });

  it('engine actions destructure and export setGrainScale for the TopBar', () => {
    const studio = studioSource();
    const destructure = studio.slice(studio.indexOf('const {\n    selectTool,'), studio.indexOf('} = usePhysicsPaintEngineActions'));
    expect(destructure).toContain('setGrainScale');
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
