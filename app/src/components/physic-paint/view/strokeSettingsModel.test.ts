// ============================================================
//  quick 261024-p5q Task 1 — the Stroke Settings dialog model
//  and its component shell.
//
//  PURE MODEL: the per-engine field registry (locked sets, no
//  erase strength / Spread), mixed reads whose representative is
//  the FIRST-SELECTED stroke (ReadonlySet insertion order), the
//  patch builders (canonical units only), the open/dismissal
//  resolution law, and the view-supplied bundle contract.
//
//  COMPONENT: the dialog shell renders only through
//  resolveStrokeSettingsOpen, dismisses on Escape (unless a field
//  inside the dialog owns the key), keeps a dismissed selection
//  closed until the empty-to-non-empty edge, and commits its Size
//  row through the bundle. The harness mocks preact/hooks with a
//  cursor runtime and keeps the real @preact/signals core (the
//  PhotoReferenceDialog test pattern).
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { DEFAULT_CANONICAL_PARAMS } from '@efxlab/efx-watercolor';
import {
  BRUSH_SETTINGS_FIELDS,
  WATERCOLOR_SETTINGS_FIELDS,
  buildAppearancePatch,
  buildColorPatch,
  readColorField,
  readNumericField,
  resolveStrokeSettingsOpen,
  shouldMarkSawEmpty,
  strokeSettingsFields,
  type ScriptStrokeAppearance,
  type StrokeSettingsDialogBundle,
  type StrokeSettingsField,
} from './strokeSettingsModel';
import { PhysicsPaintStrokeSettingsDialog } from './PhysicsPaintStrokeSettingsDialog';
import {
  setScriptSelectMode,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';

const dialogSource = readFileSync(
  fileURLToPath(new URL('./PhysicsPaintStrokeSettingsDialog.tsx', import.meta.url)),
  'utf8',
);
const modelSource = readFileSync(
  fileURLToPath(new URL('./strokeSettingsModel.ts', import.meta.url)),
  'utf8',
);

// ── Component harness (ref-stable hooks, real signal core) ──────────

const hooks = vi.hoisted(() => ({
  refs: new Map<number, { current: unknown }>(),
  cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  reset() {
    this.refs = new Map();
    this.cursor = 0;
    this.effects = [];
  },
  beginRender() {
    this.cursor = 0;
    this.effects = [];
  },
}));

vi.mock('preact/hooks', () => ({
  useRef: <Value,>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useEffect: (effect: () => void | (() => void)) => {
    hooks.effects.push(effect);
  },
}));

vi.mock('@preact/signals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@preact/signals')>();
  return {
    ...actual,
    useSignal: <Value,>(value: Value) => actual.signal(value),
  };
});

const windowListeners: Array<(event: unknown) => void> = [];

beforeEach(() => {
  hooks.reset();
  windowListeners.length = 0;
  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (type === 'keydown') windowListeners.push(listener);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      if (type !== 'keydown') return;
      const index = windowListeners.indexOf(listener);
      if (index >= 0) windowListeners.splice(index, 1);
    },
  };
  setScriptSelectMode(false);
  setScriptStrokeSelection([]);
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

type AnyVNode = VNode<Record<string, any>>;

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  if (typeof vnode.type === 'function') {
    try {
      const rendered = (vnode.type as (props: Record<string, any>) => unknown)(vnode.props);
      return [vnode, ...childrenOf(rendered)];
    } catch {
      return [vnode];
    }
  }
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function findByTestId(tree: unknown, testId: string): AnyVNode | undefined {
  return childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return typeof vnode.type !== 'function' && vnode.props?.['data-testid'] === testId;
  }) as AnyVNode | undefined;
}

function findComponent(tree: unknown, predicate: (props: Record<string, any>) => boolean): AnyVNode | undefined {
  return childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return typeof vnode.type === 'function' && predicate(vnode.props ?? {});
  }) as AnyVNode | undefined;
}

function renderDialog(bundle: StrokeSettingsDialogBundle | null | undefined): unknown {
  hooks.beginRender();
  return PhysicsPaintStrokeSettingsDialog({ bundle });
}

function runDialogEffect(): void {
  const effect = hooks.effects[0];
  expect(effect, 'the dialog registers its Escape effect').toBeDefined();
  effect!();
}

function dispatchEscape(target: unknown): { prevented: boolean; stopped: boolean } {
  let prevented = false;
  let stopped = false;
  const event = {
    key: 'Escape',
    target,
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  };
  for (const listener of [...windowListeners]) listener(event);
  return { prevented, stopped };
}

// ── Model fixtures ──────────────────────────────────────────────────

function appearance(
  mutationId: number,
  params: Record<string, number>,
  color: string | null = '#103c65',
): ScriptStrokeAppearance {
  return { mutationId, params, color };
}

function fieldOf(
  fields: readonly StrokeSettingsField[],
  key: string,
): StrokeSettingsField {
  const field = fields.find((candidate) => candidate.key === key);
  expect(field, `missing field ${key}`).toBeDefined();
  return field!;
}

function createBundle(overrides: Partial<StrokeSettingsDialogBundle> = {}) {
  const calls: Array<{ ids: number[]; patch: Record<string, unknown> }> = [];
  const bundle: StrokeSettingsDialogBundle = {
    module: 'brush',
    brushMoveActive: true,
    playFrame: 3,
    canvasSize: { width: 200, height: 120 },
    listStrokes: () => [],
    readAppearance: (ids) => ids.map((id) => appearance(id, {
      size: 12,
      opacity: 100,
      edgeDetail: 50,
      pickup: 0,
      antiAlias: 0,
    })),
    applyAppearance: (ids, patch) => {
      calls.push({ ids: [...ids], patch: patch as Record<string, unknown> });
      return true;
    },
    moveStrokes: () => true,
    transformStrokes: () => true,
    ...overrides,
  };
  return { bundle, calls };
}

// ── Pure model ─────────────────────────────────────────────────────

describe('261024-p5q field registry: the locked per-engine sets', () => {
  it('brush exposes size / opacity / shape detail / blending / smoothing only', () => {
    expect(BRUSH_SETTINGS_FIELDS.map((field) => field.key)).toEqual([
      'size',
      'opacity',
      'edgeDetail',
      'pickup',
      'smoothing',
    ]);
    const size = fieldOf(BRUSH_SETTINGS_FIELDS, 'size');
    expect([size.min, size.max, size.step]).toEqual([1, 80, 1]);
    const opacity = fieldOf(BRUSH_SETTINGS_FIELDS, 'opacity');
    expect([opacity.min, opacity.max, opacity.step]).toEqual([10, 100, 1]);
    const detail = fieldOf(BRUSH_SETTINGS_FIELDS, 'edgeDetail');
    expect([detail.min, detail.max]).toEqual([0, 100]);
    const blending = fieldOf(BRUSH_SETTINGS_FIELDS, 'pickup');
    expect([blending.min, blending.max]).toEqual([0, 100]);

    const smoothing = fieldOf(BRUSH_SETTINGS_FIELDS, 'smoothing');
    expect(smoothing.kind).toBe('segmented');
    expect(smoothing.paramKey).toBe('antiAlias');
    expect(smoothing.options?.map((option) => [option.label, option.value])).toEqual([
      ['Off', 0],
      ['Soft', 1],
      ['Med', 2],
      ['High', 3],
    ]);
  });

  it('water color exposes size (1..80) plus the seven 0..100 canonical globals', () => {
    expect(WATERCOLOR_SETTINGS_FIELDS.map((field) => field.key)).toEqual([
      'size',
      'load',
      'water',
      'flow',
      'bleed',
      'edge',
      'granulation',
      'dry',
    ]);
    const size = fieldOf(WATERCOLOR_SETTINGS_FIELDS, 'size');
    expect([size.min, size.max]).toEqual([1, 80]);
    for (const field of WATERCOLOR_SETTINGS_FIELDS) {
      if (field.key === 'size') continue;
      expect([field.key, field.min, field.max]).toEqual([field.key, 0, 100]);
    }
  });

  it('erase strength and Spread are absent from both registries', () => {
    for (const fields of [BRUSH_SETTINGS_FIELDS, WATERCOLOR_SETTINGS_FIELDS]) {
      for (const field of fields) {
        expect(['eraseStrength', 'erase', 'spread', 'Spread']).not.toContain(field.key);
        expect(['eraseStrength', 'erase', 'spread', 'Spread']).not.toContain(field.paramKey);
      }
    }
    expect(strokeSettingsFields('brush')).toBe(BRUSH_SETTINGS_FIELDS);
    expect(strokeSettingsFields('watercolor')).toBe(WATERCOLOR_SETTINGS_FIELDS);
  });
});

describe('261024-p5q field reads: absolute, mixed, first-selected representative', () => {
  it('returns the absolute value when every selected stroke agrees', () => {
    const size = fieldOf(BRUSH_SETTINGS_FIELDS, 'size');
    const rows = [appearance(7, { size: 40 }), appearance(9, { size: 40 })];
    expect(readNumericField(rows, [7, 9], size)).toEqual({ value: 40, mixed: false });
  });

  it('returns mixed with the FIRST-SELECTED value when the selection differs', () => {
    const size = fieldOf(BRUSH_SETTINGS_FIELDS, 'size');
    // Registry order (9, 7, 11) differs from selection order (7, 9, 11).
    const rows = [
      appearance(9, { size: 20 }),
      appearance(7, { size: 40 }),
      appearance(11, { size: 40 }),
    ];
    expect(readNumericField(rows, [7, 9, 11], size)).toEqual({ value: 40, mixed: true });
  });

  it('falls back to the field default for a missing or non-finite key', () => {
    const load = fieldOf(WATERCOLOR_SETTINGS_FIELDS, 'load');
    const rows = [appearance(7, {}), appearance(9, { load: Number.NaN })];
    expect(readNumericField(rows, [7, 9], load)).toEqual({
      value: DEFAULT_CANONICAL_PARAMS.load,
      mixed: false,
    });

    const size = fieldOf(BRUSH_SETTINGS_FIELDS, 'size');
    const brushRows = [appearance(7, {}), appearance(9, { size: 20 })];
    // Brush has no canonical fallback bag — the field minimum is the guard.
    expect(readNumericField(brushRows, [7, 9], size)).toEqual({ value: 1, mixed: true });
  });

  it('reads the representative colour from the first-selected id and flags any difference', () => {
    const rows = [
      appearance(9, { size: 12 }, '#000000'),
      appearance(7, { size: 12 }, '#ff0000'),
      appearance(11, { size: 12 }, '#00ff00'),
    ];
    expect(readColorField(rows, [7, 9, 11])).toEqual({ color: '#ff0000', mixed: true });
    expect(readColorField(rows.slice(0, 1), [9])).toEqual({ color: '#000000', mixed: false });
  });

  it('maps a null colour to the overlay neutral and still reports mixed repeats', () => {
    const rows = [
      appearance(7, { size: 12 }, null),
      appearance(9, { size: 12 }, '#103c65'),
    ];
    expect(readColorField(rows, [7, 9])).toEqual({ color: '#111827', mixed: true });

    // A later stroke carrying the representative colour does not cancel mixed.
    const repeats = [
      appearance(7, { size: 12 }, '#ff0000'),
      appearance(9, { size: 12 }, '#00ff00'),
      appearance(11, { size: 12 }, '#ff0000'),
    ];
    expect(readColorField(repeats, [7, 9, 11])).toEqual({ color: '#ff0000', mixed: true });
  });
});

describe('261024-p5q patch builders: canonical units only', () => {
  it('builds brush and watercolor params patches', () => {
    expect(buildAppearancePatch('brush', 'size', 42)).toEqual({ params: { size: 42 } });
    expect(buildAppearancePatch('watercolor', 'load', 70)).toEqual({ params: { load: 70 } });
    // Water color canonical units never convert to the engine 0..1 band.
    expect(buildAppearancePatch('watercolor', 'size', 24)).toEqual({ params: { size: 24 } });
  });

  it('maps the smoothing segment to antiAlias 0..3', () => {
    expect(buildAppearancePatch('brush', 'smoothing', 2)).toEqual({ params: { antiAlias: 2 } });
  });

  it('builds a colour-only patch', () => {
    expect(buildColorPatch('#abcdef')).toEqual({ color: '#abcdef' });
  });
});

describe('261024-p5q open resolution and the dismissal edge', () => {
  const base = {
    surfaceActive: true,
    selectionSize: 1,
    dismissed: false,
    sawEmptySinceDismiss: false,
  };

  it('opens only for an active surface with a non-empty, non-dismissed selection', () => {
    expect(resolveStrokeSettingsOpen(base)).toBe(true);
    expect(resolveStrokeSettingsOpen({ ...base, surfaceActive: false })).toBe(false);
    expect(resolveStrokeSettingsOpen({ ...base, selectionSize: 0 })).toBe(false);
    expect(resolveStrokeSettingsOpen({ ...base, dismissed: true })).toBe(false);
  });

  it('reopens a dismissed dialog only after the selection emptied while active', () => {
    expect(resolveStrokeSettingsOpen({
      ...base,
      dismissed: true,
      sawEmptySinceDismiss: true,
    })).toBe(true);
    // A non-empty -> non-empty change with no observed empty edge stays closed.
    expect(resolveStrokeSettingsOpen({
      ...base,
      selectionSize: 2,
      dismissed: true,
      sawEmptySinceDismiss: false,
    })).toBe(false);
    // An inactive surface never opens, even after the edge.
    expect(resolveStrokeSettingsOpen({
      ...base,
      surfaceActive: false,
      dismissed: true,
      sawEmptySinceDismiss: true,
    })).toBe(false);
  });

  it('marks saw-empty only while dismissed, active and empty', () => {
    expect(shouldMarkSawEmpty({ dismissed: true, surfaceActive: true, selectionSize: 0 })).toBe(true);
    expect(shouldMarkSawEmpty({ dismissed: false, surfaceActive: true, selectionSize: 0 })).toBe(false);
    expect(shouldMarkSawEmpty({ dismissed: true, surfaceActive: false, selectionSize: 0 })).toBe(false);
    expect(shouldMarkSawEmpty({ dismissed: true, surfaceActive: true, selectionSize: 1 })).toBe(false);
  });

  it('the bundle contract carries appearance and geometry members as boolean | Promise<boolean>', () => {
    expect(modelSource).toMatch(/applyAppearance\([^)]*\):\s*boolean \| Promise<boolean>/);
    expect(modelSource).toMatch(/moveStrokes\([^)]*\):\s*boolean \| Promise<boolean>/);
    expect(modelSource).toMatch(/transformStrokes\([^)]*\):\s*boolean \| Promise<boolean>/);
  });
});

// ── Dialog component ───────────────────────────────────────────────

describe('261024-p5q dialog shell', () => {
  it('renders its card only through resolveStrokeSettingsOpen', () => {
    const { bundle } = createBundle();
    setScriptStrokeSelection([7]);

    const tree = renderDialog(bundle);
    expect(findByTestId(tree, 'stroke-settings-dialog')).toBeDefined();

    // Empty selection closes it.
    setScriptStrokeSelection([]);
    expect(renderDialog(bundle)).toBeNull();

    // An inactive edition surface (Brush Move off) never opens it.
    setScriptStrokeSelection([7]);
    expect(renderDialog({ ...bundle, brushMoveActive: false })).toBeNull();

    // Water color reads the shared select mode as its surface gate.
    const watercolor = { ...bundle, module: 'watercolor' as const, brushMoveActive: false };
    expect(renderDialog(watercolor)).toBeNull();
    setScriptSelectMode(true);
    expect(findByTestId(renderDialog(watercolor), 'stroke-settings-dialog')).toBeDefined();
  });

  it('Escape outside the dialog hides it; an editable field inside owns its own Escape', () => {
    const { bundle } = createBundle();
    setScriptStrokeSelection([7]);
    renderDialog(bundle);
    runDialogEffect();

    // A focused value/hex field INSIDE the dialog passes the key through.
    const dialogNode = { closest: () => null };
    const editableInside = {
      closest: (selector: string) => (
        selector === '[data-testid="stroke-settings-dialog"]' ? dialogNode : null
      ),
    };
    const insideTarget = {
      closest: (selector: string) => (
        selector === 'input, textarea, [contenteditable="true"]' ? editableInside : null
      ),
    };
    expect(dispatchEscape(insideTarget)).toEqual({ prevented: false, stopped: false });
    expect(findByTestId(renderDialog(bundle), 'stroke-settings-dialog')).toBeDefined();

    // An outside target dismisses with preventDefault + stopPropagation.
    expect(dispatchEscape({ closest: () => null })).toEqual({ prevented: true, stopped: true });
    expect(renderDialog(bundle)).toBeNull();
  });

  it('a dismissed non-empty selection stays hidden; empty-then-reselect reopens it', () => {
    const { bundle } = createBundle();
    setScriptStrokeSelection([7]);
    renderDialog(bundle);
    runDialogEffect();
    dispatchEscape({ closest: () => null });
    expect(renderDialog(bundle)).toBeNull();

    // Non-empty -> non-empty never reopens.
    setScriptStrokeSelection([9]);
    expect(renderDialog(bundle)).toBeNull();

    // The empty edge is observed while the surface is active...
    setScriptStrokeSelection([]);
    expect(renderDialog(bundle)).toBeNull();
    // ...so the next non-empty selection reopens.
    setScriptStrokeSelection([11]);
    expect(findByTestId(renderDialog(bundle), 'stroke-settings-dialog')).toBeDefined();
  });

  it('the close button writes the same dismissal boolean', () => {
    const { bundle } = createBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);
    const close = findByTestId(tree, 'stroke-settings-close');
    expect(close).toBeDefined();
    (close!.props.onClick as () => void)();
    expect(renderDialog(bundle)).toBeNull();
  });

  it('header drag writes the offset signal keyed by the selection Set instance', () => {
    const { bundle } = createBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);
    const header = findByTestId(tree, 'stroke-settings-header');
    expect(header).toBeDefined();
    const preventDefault = vi.fn();
    (header!.props.onPointerDown as (event: unknown) => void)({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault,
      currentTarget: { setPointerCapture: () => {} },
    });
    (header!.props.onPointerMove as (event: unknown) => void)({ clientX: 130, clientY: 120 });
    expect(preventDefault).toHaveBeenCalledTimes(1);

    const moved = findByTestId(renderDialog(bundle), 'stroke-settings-dialog');
    expect((moved!.props.style as Record<string, unknown>).transform).toBe('translate(30px, 20px)');

    // A new selection Set re-baselines the offset.
    setScriptStrokeSelection([9]);
    const reset = findByTestId(renderDialog(bundle), 'stroke-settings-dialog');
    expect((reset!.props.style as Record<string, unknown>).transform).toBe('translate(0px, 0px)');
  });

  it('the Size row is a release-commit SliderStepper that commits one bundle patch for the whole selection', () => {
    const { bundle, calls } = createBundle();
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);

    const slider = findComponent(tree, (props) => props.ariaLabel === 'Size');
    expect(slider).toBeDefined();
    expect(slider!.props.commitOnRelease).toBe(true);
    expect(slider!.props.value).toBe(12);
    expect(slider!.props.min).toBe(1);
    expect(slider!.props.max).toBe(80);

    (slider!.props.onChange as (value: number) => void)(42);
    expect(calls).toEqual([{ ids: [7, 9], patch: { params: { size: 42 } } }]);
  });

  it('structural pins: test ids, signal reads, no useState, no color tab yet', () => {
    expect(dialogSource).toContain('data-testid="stroke-settings-dialog"');
    expect(dialogSource).toContain('data-testid="stroke-settings-header"');
    expect(dialogSource).toContain('data-testid="stroke-settings-close"');
    expect(dialogSource).toContain('stroke-settings-${field.key}');
    expect(dialogSource).toContain('scriptSelectedStrokeIds.value');
    expect(dialogSource).not.toContain('useState');
  });
});

// ============================================================
//  261024-p5q Task 2 — the full Paint field set, mixed chrome and
//  the shared color control. The picker is imported UNMODIFIED:
//  live changes feed a dialog draft only, and one boundary handler
//  writes every selected stroke exactly once.
// ============================================================

describe('261024-p5q dialog fields and shared color', () => {
  it('renders every brush Paint field as a release-commit SliderStepper', () => {
    const { bundle, calls } = createBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    for (const field of BRUSH_SETTINGS_FIELDS) {
      if (field.kind !== 'numeric') continue;
      const slider = findComponent(tree, (props) => props.ariaLabel === field.label);
      expect(slider, field.key).toBeDefined();
      expect(slider!.props.commitOnRelease).toBe(true);
      expect(slider!.props.min).toBe(field.min);
      expect(slider!.props.max).toBe(field.max);
      expect(slider!.props.step).toBe(field.step);
      expect(slider!.props.mixed).toBe(false);
      expect(findByTestId(tree, `stroke-settings-${field.key}`), field.key).toBeDefined();
    }

    // An untouched row never writes; one row's onChange writes only that key.
    expect(calls).toEqual([]);
    const opacity = findComponent(tree, (props) => props.ariaLabel === 'Opacity')!;
    (opacity.props.onChange as (value: number) => void)(55);
    expect(calls).toEqual([{ ids: [7], patch: { params: { opacity: 55 } } }]);
  });

  it('renders the full water color field set in canonical units', () => {
    const { bundle, calls } = createBundle({
      module: 'watercolor',
      brushMoveActive: false,
      readAppearance: (ids) => ids.map((id) => appearance(id, {
        size: 20,
        load: 60,
        water: 50,
        flow: 50,
        bleed: 50,
        edge: 50,
        granulation: 50,
        dry: 50,
      })),
    });
    setScriptSelectMode(true);
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    for (const field of WATERCOLOR_SETTINGS_FIELDS) {
      const slider = findComponent(tree, (props) => props.ariaLabel === field.label);
      expect(slider, field.key).toBeDefined();
      expect(slider!.props.mixed).toBe(false);
      expect(slider!.props.value).toBe(
        field.key === 'size' ? 20 : field.key === 'load' ? 60 : 50,
      );
    }

    const load = findComponent(tree, (props) => props.ariaLabel === 'Pigment')!;
    (load.props.onChange as (value: number) => void)(70);
    expect(calls).toEqual([{ ids: [7], patch: { params: { load: 70 } } }]);
  });

  it('shows Mixed on differing numeric rows and on the smoothing group', () => {
    const { bundle, calls } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(id, {
        size: id === 7 ? 40 : 20,
        opacity: 100,
        edgeDetail: 50,
        pickup: 0,
        antiAlias: id === 7 ? 0 : 2,
      }, id === 7 ? '#ff0000' : '#00ff00')),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);

    const size = findComponent(tree, (props) => props.ariaLabel === 'Size')!;
    expect(size.props.mixed).toBe(true);
    // The representative is the FIRST-SELECTED stroke, not registry order.
    expect(size.props.value).toBe(40);

    expect(findByTestId(tree, 'stroke-settings-smoothing-mixed')).toBeDefined();
    expect(
      findByTestId(tree, 'stroke-settings-smoothing-option-1')!.props['aria-pressed'],
    ).toBe(false);
    (findByTestId(tree, 'stroke-settings-smoothing-option-3')!.props.onClick as () => void)();
    expect(calls).toEqual([{ ids: [7, 9], patch: { params: { antiAlias: 3 } } }]);
  });

  it('marks the agreed smoothing segment active and hides the Mixed caption', () => {
    const { bundle } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(id, {
        size: 12,
        opacity: 100,
        edgeDetail: 50,
        pickup: 0,
        antiAlias: 2,
      })),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);
    expect(findByTestId(tree, 'stroke-settings-smoothing-mixed')).toBeUndefined();
    expect(
      findByTestId(tree, 'stroke-settings-smoothing-option-2')!.props['aria-pressed'],
    ).toBe(true);
  });

  it('wraps the shared color tab with the first-selected colour and a Mixed badge', () => {
    const { bundle } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(
        id,
        { size: 12 },
        id === 7 ? '#ff0000' : '#00ff00',
      )),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);

    const colorTab = findComponent(
      tree,
      (props) => typeof props.onColorChange === 'function' && props.opacity === 100,
    );
    expect(colorTab, 'RightPanelColorTab').toBeDefined();
    expect(colorTab!.props.color).toBe('#ff0000');
    expect(findByTestId(tree, 'stroke-settings-color-mixed')).toBeDefined();
  });

  it('live colour changes feed the draft only; one boundary writes once', () => {
    const { bundle, calls } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(
        id,
        { size: 12 },
        id === 7 ? '#ff0000' : '#00ff00',
      )),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);
    const colorTab = findComponent(
      tree,
      (props) => typeof props.onColorChange === 'function' && props.opacity === 100,
    )!;

    (colorTab.props.onColorChange as (color: string, opacity: number) => void)('#00ff00', 100);
    expect(calls).toEqual([]); // the live change never writes strokes

    const withDraft = renderDialog(bundle);
    const draftTab = findComponent(
      withDraft,
      (props) => typeof props.onColorChange === 'function' && props.opacity === 100,
    )!;
    expect(draftTab.props.color).toBe('#00ff00');

    const section = findByTestId(withDraft, 'stroke-settings-color')!;
    (section.props.onPointerUp as () => void)();
    expect(calls).toEqual([{ ids: [7, 9], patch: { color: '#00ff00' } }]);

    // Repeated boundaries in the same gesture stay idempotent.
    (section.props.onPointerUp as () => void)();
    (section.props.onClick as () => void)();
    expect(calls).toEqual([{ ids: [7, 9], patch: { color: '#00ff00' } }]);
  });

  it('a mixed hydrated colour always writes on the first commit, even unchanged', () => {
    const { bundle, calls } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(
        id,
        { size: 12 },
        id === 7 ? '#ff0000' : '#00ff00',
      )),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);
    const section = findByTestId(tree, 'stroke-settings-color')!;
    (section.props.onPointerUp as () => void)();
    expect(calls).toEqual([{ ids: [7, 9], patch: { color: '#ff0000' } }]);
  });

  it('the dedupe baseline resets on every selection change', () => {
    const { bundle, calls } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(id, { size: 12 }, '#ff0000')),
    });
    setScriptStrokeSelection([7]);
    const first = findByTestId(renderDialog(bundle), 'stroke-settings-color')!;
    (first.props.onPointerUp as () => void)();
    expect(calls).toHaveLength(1);

    // Same colour, same ids: idempotent.
    const again = findByTestId(renderDialog(bundle), 'stroke-settings-color')!;
    (again.props.onPointerUp as () => void)();
    expect(calls).toHaveLength(1);

    // A new selection Set is a new baseline — the first commit writes again.
    setScriptStrokeSelection([7, 9]);
    const nextSelection = findByTestId(renderDialog(bundle), 'stroke-settings-color')!;
    (nextSelection.props.onPointerUp as () => void)();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ ids: [7, 9], patch: { color: '#ff0000' } });
  });

  it('the blur boundary commits the draft after the hex field handler ran', async () => {
    const { bundle, calls } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(id, { size: 12 }, '#ff0000')),
    });
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);
    const colorTab = findComponent(
      tree,
      (props) => typeof props.onColorChange === 'function' && props.opacity === 100,
    )!;
    (colorTab.props.onColorChange as (color: string, opacity: number) => void)('#00ff00', 100);

    const section = findByTestId(renderDialog(bundle), 'stroke-settings-color')!;
    (section.props.onBlurCapture as () => void)();
    // The capture phase runs BEFORE the hex field's own onBlur, so the commit
    // is deferred one microtask — no write from the stale draft.
    expect(calls).toEqual([]);
    await Promise.resolve();
    expect(calls).toEqual([{ ids: [7], patch: { color: '#00ff00' } }]);
  });

  it('structural pins: shared picker import only, no Studio writes, no useState', () => {
    expect(dialogSource).toContain("import { RightPanelColorTab } from './RightPanelColorTab'");
    expect(dialogSource).toContain('data-testid="stroke-settings-color"');
    expect(dialogSource).not.toContain('useState');
    expect(dialogSource).not.toContain('physicsPaintStudio.css');
    expect(dialogSource).not.toContain('paintStore');
    expect(dialogSource).not.toContain('setScriptStrokeSelection');
    expect(dialogSource).not.toContain('ScriptStrokeEditionPort');
  });
});
