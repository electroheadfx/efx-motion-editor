/**
 * 56-05 Task 3 — PaperPicker contract pins (D-09..D-12 / PAPER-01 / PAPER-04).
 *
 * Laws pinned here:
 *   D-09   thumbnail grid popover in the shared panel (13 cells)
 *   D-11   cells show the raw tile (height-map lit relief / jpg), no engine
 *   D-12   one library grouped Procedural / Real headers
 *   UI-SPEC 3 columns, 64×64 cells, accent on the active cell only
 *   261017-vcn Q6 grain pair at the TOP, Transparent/White next, grid last
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as panelSplitShell.test.tsx / NumericStepper.test.tsx).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PaperPicker, grainScaleStep } from './PaperPicker';
import type { StudioBackgroundMode } from '../engine/physicsPaintStudioSettings';
import { commitStepperInput, parseStepperInput } from '../../shared/NumericStepper';
import { SliderStepper } from '../../shared/SliderStepper';
import { GRAIN_SCALE_MAX, GRAIN_SCALE_MIN } from '../../../efx-paint/document/efxPaintDocument';

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

function pickerProps() {
  return {
    paperId: 'paper/cold-press',
    background: 'paper/cold-press' as StudioBackgroundMode,
    grainStrength: 0.65,
    grainScale: 1,
    onPaperIdChange: () => {},
    onBackgroundChange: () => {},
    onGrainStrengthChange: () => {},
    onGrainScaleChange: () => {},
  };
}

function renderPicker() {
  return materialize(PaperPicker(pickerProps()));
}

function findAll(root: unknown, predicate: (node: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

describe('PaperPicker (D-09..D-12)', () => {
  it('renders the paper grid always visible (UI checklist row 10 — no popover)', () => {
    const root = renderPicker();
    const grid = findAll(root, (node) => node.props?.['data-paper-picker-popover'] !== undefined);
    expect(grid.length).toBe(1);
    // No trigger button — the grid is always on screen.
    const trigger = findAll(root, (node) => node.props?.['data-paper-picker-trigger'] !== undefined);
    expect(trigger.length).toBe(0);
  });

  it('renders group headers Procedural and Real (D-12)', () => {
    // The popover is open-state; open the signal by re-rendering after a click
    // is not available in the materializer, so assert the header constants
    // from the module source AND the closed-tree structure (headers mount
    // with the popover).
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source.includes('Procedural')).toBe(true);
    expect(source.includes('Real')).toBe(true);
    expect(source.includes('data-paper-group-header')).toBe(true);
  });

  it('Real papers come before Procedural (261018-cy1)', () => {
    const root = PaperPicker(pickerProps()) as TestVNode;
    const nodes = [...walk(root)];
    const realHeader = nodes.findIndex((node) => node.props?.['data-paper-group-header'] === 'real');
    const proceduralHeader = nodes.findIndex((node) => node.props?.['data-paper-group-header'] === 'procedural');
    expect(realHeader, 'Real header must render').toBeGreaterThan(-1);
    expect(proceduralHeader, 'Procedural header must render').toBeGreaterThan(-1);
    expect(realHeader, 'Real group precedes Procedural').toBeLessThan(proceduralHeader);
  });

  it('paper grid sits flat in the tab body (no card chrome)', () => {
    const root = PaperPicker(pickerProps()) as TestVNode;
    const grid = findAll(root, (node) => node.props?.['data-paper-picker-popover'] !== undefined)[0];
    expect(grid, 'grid grouping hook must render').toBeDefined();
    const style = (grid!.props?.['style'] ?? {}) as Record<string, unknown>;
    expect(String(style['background'] ?? ''), 'transparent background').toBe('transparent');
    expect(String(style['border'] ?? ''), 'no border').toBe('none');
    expect(Number(style['borderRadius'] ?? 0), 'no radius').toBe(0);
    expect(Number(style['padding'] ?? 0), 'no padding').toBe(0);
  });

  it('library-backed cell count is 13 (10 procedural + 3 real)', () => {
    // The grid is populated from PAPER_LIBRARY — pin the source wiring so the
    // picker can never ship a second, hand-kept list (D-12 one library).
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source.includes('PAPER_LIBRARY')).toBe(true);
    expect(source.includes("entry.group === 'procedural'")).toBe(true);
    expect(source.includes("entry.group === 'real'")).toBe(true);
  });

  it('active cell class uses the reserved accent; unselected cells never do', () => {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source.includes("props.active ? '2px solid var(--color-accent)'")).toBe(true);
    // Unselected border is the subtle border token, never accent.
    expect(source.includes("'1px solid var(--color-border-subtle)'")).toBe(true);
  });

  it('Paper-tab order is grain → Transparent/White → grid; the D-10 bottom pair is gone', () => {
    // 261017-vcn Q6: grain widgets move to the TOP of the Paper tab (names
    // stay Grain strength + Grain scale), Transparent + White sit between the
    // grain controls and the paper grid, and the former bottom pair leaves so
    // one grain control pair survives. Anchor on the structural section
    // markers in the host-only tree (SliderStepper stays an opaque function
    // component).
    const root = PaperPicker(pickerProps()) as TestVNode;
    const nodes = [...walk(root)];
    const grainSection = nodes.findIndex((node) => node.props?.['data-paper-picker-grain'] !== undefined);
    const armsSection = nodes.findIndex((node) => node.props?.['data-paper-picker-backgrounds'] !== undefined);
    const gridSection = nodes.findIndex((node) => node.props?.['data-paper-picker-popover'] !== undefined);
    expect(grainSection).toBeGreaterThan(-1);
    expect(armsSection).toBeGreaterThan(-1);
    expect(gridSection).toBeGreaterThan(-1);
    expect(grainSection).toBeLessThan(armsSection);
    expect(armsSection).toBeLessThan(gridSection);
    // Names stay Grain strength + Grain scale (Q6); arms are Transparent/White.
    const joined = nodes
      .flatMap((node) => [node.props?.['aria-label'], node.props?.['title'], node.props?.['label']])
      .filter((value): value is string => typeof value === 'string')
      .join(' | ');
    expect(joined.indexOf('Grain strength')).toBeGreaterThan(-1);
    expect(joined.indexOf('Grain scale')).toBeGreaterThan(-1);
    expect(joined.indexOf('Transparent')).toBeGreaterThan(-1);
    expect(joined.indexOf('White')).toBeGreaterThan(-1);
    // The D-10 bottom Strength/Scale pair is gone.
    const sliders = findAll(root, (node) => node.props?.['data-paper-picker-sliders'] !== undefined);
    expect(sliders.length).toBe(0);
    // Grid constants stay locked (UI-SPEC).
    expect(findAll(root, (node) => node.props?.['data-paper-picker-popover'] !== undefined).length).toBe(1);
  });

  it('grain strength segments and grain scale stepper route to their own handlers', () => {
    const onGrainStrengthChange = vi.fn();
    const onGrainScaleChange = vi.fn();
    // Host-only walk (TopBar idiom): PaperPicker is invoked by hand; nested
    // function components (SliderStepper) must not be expanded — they need
    // hook state. Keep the SliderStepper vnode so its props stay readable.
    const root = PaperPicker({
      ...pickerProps(),
      onGrainStrengthChange,
      onGrainScaleChange,
    }) as TestVNode;
    const strengthGroup = findAll(root, (node) => node.props?.['aria-label'] === 'Grain strength')[0];
    expect(strengthGroup).toBeDefined();
    const strengthButtons = findAll(strengthGroup, (node) => node.type === 'button');
    expect(strengthButtons.length).toBe(4); // None / Soft / Med / Hard
    (strengthButtons[0].props as { onClick: () => void }).onClick();
    expect(onGrainStrengthChange).toHaveBeenCalledTimes(1);
    expect(onGrainStrengthChange).toHaveBeenCalledWith(0);
    expect(onGrainScaleChange).not.toHaveBeenCalled();

    const stepper = findAll(root, (node) => node.type === SliderStepper)[0] as TestVNode | undefined;
    expect(stepper, 'Grain scale must render the shared SliderStepper').toBeDefined();
    expect((stepper!.props as { value: number }).value).toBe(1);
    expect((stepper!.props as { step: number }).step).toBe(0.5);
    expect((stepper!.props as { min: number }).min).toBe(GRAIN_SCALE_MIN);
    expect((stepper!.props as { max: number }).max).toBe(GRAIN_SCALE_MAX);
    expect((stepper!.props as { resolveStep: unknown }).resolveStep).toBe(grainScaleStep);
    expect((stepper!.props as { freeEntry: boolean }).freeEntry).toBe(true);
    (stepper!.props as { onChange: (v: number) => void }).onChange(1.5);
    expect(onGrainScaleChange).toHaveBeenCalledWith(1.5);
  });

  it('grainStrength 0.35 marks Soft active; non-finite resolves to Soft (261018-cy1)', () => {
    const softRoot = PaperPicker({ ...pickerProps(), grainStrength: 0.35 }) as TestVNode;
    const softGroup = findAll(softRoot, (node) => node.props?.['aria-label'] === 'Grain strength')[0];
    const softButtons = findAll(softGroup, (node) => node.type === 'button');
    const activeLabels = softButtons
      .filter((b) => String(b.props?.['class'] ?? '').includes('active'))
      .map((b) => String((b.props as { children?: unknown }).children ?? '').trim());
    expect(activeLabels, 'exactly one active grain chip').toEqual(['Soft']);

    const missingRoot = PaperPicker({
      ...pickerProps(),
      grainStrength: Number.NaN,
    }) as TestVNode;
    const missingGroup = findAll(missingRoot, (node) => node.props?.['aria-label'] === 'Grain strength')[0];
    const missingButtons = findAll(missingGroup, (node) => node.type === 'button');
    const missingActive = missingButtons
      .filter((b) => String(b.props?.['class'] ?? '').includes('active'))
      .map((b) => String((b.props as { children?: unknown }).children ?? '').trim());
    expect(missingActive, 'non-finite strength resolves to Soft').toEqual(['Soft']);
  });

  it('Transparent and White swatches call onBackgroundChange; paper cells keep the paper-id path', () => {
    const onBackgroundChange = vi.fn();
    const onPaperIdChange = vi.fn();
    const root = materialize(PaperPicker({
      ...pickerProps(),
      onBackgroundChange,
      onPaperIdChange,
    }));
    const arms = findAll(root, (node) => {
      const label = node.props?.['aria-label'];
      return label === 'Transparent' || label === 'White';
    });
    expect(arms.length).toBe(2);
    for (const arm of arms) {
      (arm.props as { onClick: () => void }).onClick();
    }
    expect(onBackgroundChange).toHaveBeenCalledTimes(2);
    expect(onBackgroundChange).toHaveBeenNthCalledWith(1, 'transparent');
    expect(onBackgroundChange).toHaveBeenNthCalledWith(2, 'white');
    expect(onPaperIdChange).not.toHaveBeenCalled();

    // A paper cell keeps the paper-id path (paths stay separate).
    const cell = findAll(root, (node) => node.props?.['data-paper-id'] !== undefined)[0];
    expect(cell).toBeDefined();
    (cell!.props as { onClick: () => void }).onClick();
    expect(onPaperIdChange).toHaveBeenCalledTimes(1);
    expect(onPaperIdChange).toHaveBeenCalledWith(cell!.props['data-paper-id']);
    expect(onBackgroundChange).toHaveBeenCalledTimes(2); // unchanged
  });

  it('thumbs ride the engine paper host only — no fluid simulation, no WatercolorEngine construction', () => {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    // 261017-nnu: the sheet comes from the vendored engine via the thin host.
    expect(source).toContain("from '../../../lib/enginePaperSheet'");
    expect(source).toContain('getEnginePaperSheet(');
    // Strip comments before the negative scan.
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // No fluid / deposit simulation, no direct engine construction, no paperPass.
    expect(/\bdeposit\b/i.test(body)).toBe(false);
    expect(/\bfluid\b/i.test(body)).toBe(false);
    expect(body.includes('WatercolorEngine')).toBe(false);
    expect(body.includes('paperPass')).toBe(false);
    expect(body.includes('applyPaperPass')).toBe(false);
  });

  it('cells show raw tiles only — procedural relief and real jpg, no paperPass', () => {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source.includes('data-paper-tile="procedural"')).toBe(true);
    expect(source.includes('data-paper-tile="real"')).toBe(true);
    // Strip comments (the header names paperPass by design) before the scan.
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body.includes('paperPass')).toBe(false);
    expect(body.includes('applyPaperPass')).toBe(false);
  });

  it('uses the 64×64 cell and 8px gap constants (UI-SPEC)', () => {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source.includes('const CELL_SIZE = 64')).toBe(true);
    expect(source.includes('const GRID_GAP = 8')).toBe(true);
    expect(source.includes('gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`')).toBe(true);
  });
});

// 260923-bcm UAT follow-up + 261017-vcn Q6: Grain scale is a value stepper
// (− value +), not preset buttons. The step rule is the contract: 0.5 strictly
// inside ]0.5, 2.0[, 0.1 at/below 0.5 and at/above 2.0 — default 1.0 + → 1.5;
// 1.5 − − → 0.5; 0.5 − → 0.4; 1.5 + → 2.0, 2.0 + → 2.1. Values live in the
// shared [GRAIN_SCALE_MIN, GRAIN_SCALE_MAX] acceptance and route to
// onGrainScaleChange. The widgets live at the TOP of the Paper tab (Q6).
describe('260923-bcm Grain scale value stepper (Paper tab surface)', () => {
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

  it('a non-default grainScale prop feeds the stepper value', () => {
    const root = PaperPicker({ ...pickerProps(), grainScale: 0.4 }) as TestVNode;
    const stepper = findAll(root, (node) => node.type === SliderStepper)[0] as TestVNode | undefined;
    expect(stepper).toBeDefined();
    expect((stepper!.props as { value: number }).value).toBe(0.4);
    expect((stepper!.props as { step: number }).step).toBe(0.1);
  });

  // UAT follow-up 2: free typed numbers + the European decimal comma.
  it('accepts a free typed number: 1.3 stays 1.3 instead of snapping to the 0.5 band', () => {
    const grain = { step: 0.5, resolveStep: grainScaleStep, freeEntry: true, min: GRAIN_SCALE_MIN, max: GRAIN_SCALE_MAX } as const;
    expect(commitStepperInput('1.3', grain)).toBe(1.3);
    expect(commitStepperInput('0.75', grain)).toBe(0.75);
    // The snap path is still what non-free fields get.
    expect(commitStepperInput('1.3', { step: 0.5, resolveStep: grainScaleStep, min: GRAIN_SCALE_MIN, max: GRAIN_SCALE_MAX })).toBe(1.5);
  });

  it('accepts the European decimal comma: "2,2" commits 2.2', () => {
    expect(parseStepperInput('2,2')).toBe(2.2);
    expect(parseStepperInput('0,5')).toBe(0.5);
    expect(parseStepperInput('2.2')).toBe(2.2);
    expect(commitStepperInput('2,2', { step: 0.1, freeEntry: true, min: GRAIN_SCALE_MIN, max: GRAIN_SCALE_MAX })).toBe(2.2);
    expect(Number.isNaN(parseStepperInput('abc'))).toBe(true);
    expect(commitStepperInput('abc', { step: 0.1, freeEntry: true, min: GRAIN_SCALE_MIN, max: GRAIN_SCALE_MAX })).toBeNull();
  });

  it('free entries still clamp to the shared grain scale bounds', () => {
    const grain = { step: 0.1, freeEntry: true, min: GRAIN_SCALE_MIN, max: GRAIN_SCALE_MAX } as const;
    expect(commitStepperInput('0', grain)).toBe(GRAIN_SCALE_MIN);
    expect(commitStepperInput('99', grain)).toBe(GRAIN_SCALE_MAX);
  });
});
