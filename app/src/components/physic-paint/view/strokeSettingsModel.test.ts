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
  FRESH_STROKE_GEOMETRY_SESSION,
  STROKE_POSITION_RANGE,
  STROKE_ROTATION_RANGE,
  STROKE_SCALE_RANGE,
  WATERCOLOR_SETTINGS_FIELDS,
  buildAppearancePatch,
  buildColorPatch,
  geometryMoveDelta,
  geometryTransform,
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
  type SelectableScriptStroke,
} from './scriptStrokeEdition';
import type { ScriptStrokeTransform } from './scriptStrokeTransform';

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
  useCallback: <Fn,>(fn: Fn) => fn,
  // SidebarScrollArea (the app scrollbar) reads state during its render; the
  // harness only needs the initial values and a no-op setter.
  useState: <Value,>(initial: Value | (() => Value)) => [
    typeof initial === 'function' ? (initial as () => Value)() : initial,
    () => {},
  ] as const,
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

function selectableStroke(
  mutationId: number,
  bounds: { x: number; y: number; width: number; height: number },
): SelectableScriptStroke {
  return {
    mutationId,
    pointsPx: [],
    bounds,
    serial: mutationId,
    stackPosition: 1,
    stackTotal: 1,
    color: '#ff0000',
  };
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
    expect([size.min, size.max, size.step]).toEqual([1, 800, 1]);
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

  it('water color exposes size (1..800) plus the seven 0..100 canonical globals', () => {
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
    expect([size.min, size.max]).toEqual([1, 800]);
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
    expect(slider!.props.max).toBe(800);
    expect(slider!.props.allowOutOfRangeEntry).toBe(true);

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
    const { bundle, calls } = createBundle({
      listStrokes: () => [selectableStroke(7, { x: 0, y: 0, width: 100, height: 100 })],
    });
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    for (const field of BRUSH_SETTINGS_FIELDS) {
      if (field.kind !== 'numeric' || field.key === 'opacity') continue;
      const slider = findComponent(tree, (props) => props.ariaLabel === field.label);
      expect(slider, field.key).toBeDefined();
      expect(slider!.props.commitOnRelease).toBe(true);
      expect(slider!.props.min).toBe(field.min);
      expect(slider!.props.max).toBe(field.max);
      expect(slider!.props.step).toBe(field.step);
      expect(slider!.props.mixed).toBe(false);
      expect(findByTestId(tree, `stroke-settings-${field.key}`), field.key).toBeDefined();
    }

    // Opacity leads Geometry and stays OUT of the Paint list (one control).
    expect(findByTestId(tree, 'stroke-settings-geometry-opacity')).toBeDefined();
    expect(findByTestId(tree, 'stroke-settings-opacity')).toBeUndefined();

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
      listStrokes: () => [selectableStroke(7, { x: 0, y: 0, width: 100, height: 100 })],
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
      if (field.key === 'load') continue;
      const slider = findComponent(tree, (props) => props.ariaLabel === field.label);
      expect(slider, field.key).toBeDefined();
      expect(slider!.props.mixed).toBe(false);
      expect(slider!.props.value).toBe(field.key === 'size' ? 20 : 50);
    }

    // The canonical Pigment (`load`) is the Water color opacity, moved to the
    // top of Geometry under the user-facing "Opacity" label.
    const load = findComponent(tree, (props) => props.ariaLabel === 'Opacity')!;
    expect(findByTestId(tree, 'stroke-settings-geometry-opacity')).toBeDefined();
    expect(load.props.value).toBe(60);
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

  it('shows the selected strokes colour as a read-only thumb with a red Mixed badge', () => {
    const { bundle } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(
        id,
        { size: 12 },
        id === 7 ? '#ff0000' : '#00ff00',
      )),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);

    const thumb = findByTestId(tree, 'stroke-settings-color-thumb')!;
    expect(thumb).toBeDefined();
    expect((thumb.props.style as Record<string, unknown>).backgroundColor).toBe('#ff0000');
    const mixed = findByTestId(tree, 'stroke-settings-color-mixed')!;
    expect(mixed).toBeDefined();
    expect((mixed.props.style as Record<string, unknown>).color).toBe('#ef4444');
    expect(dialogSource).not.toContain("import { RightPanelColorTab }");
  });

  it('hides the Mixed badge when every selected stroke agrees', () => {
    const { bundle } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(id, { size: 12 }, '#ff0000')),
    });
    setScriptStrokeSelection([7, 9]);
    const tree = renderDialog(bundle);
    expect(findByTestId(tree, 'stroke-settings-color-thumb')).toBeDefined();
    expect(findByTestId(tree, 'stroke-settings-color-mixed')).toBeUndefined();
  });

  it('uses the Document sound header chrome and the app scrollbar', () => {
    expect(dialogSource).toContain('physics-paint-photo-reference-header');
    expect(dialogSource).toContain('physics-paint-photo-reference-close');
    expect(dialogSource).toContain('SlidersHorizontal');
    expect(dialogSource).toContain('SidebarScrollArea');
    expect(dialogSource).toContain('data-testid="stroke-settings-header"');
  });

  it('orders the sections Color - Geometry - Paint under ruled centered titles', () => {
    const color = dialogSource.indexOf('<RuleSectionHeader text="Color"');
    const geometry = dialogSource.indexOf('<RuleSectionHeader text="Geometry"');
    const paint = dialogSource.indexOf('<RuleSectionHeader text="Paint"');
    expect(color).toBeGreaterThan(-1);
    expect(geometry).toBeGreaterThan(color);
    expect(paint).toBeGreaterThan(geometry);
    expect(dialogSource).toContain("import { RuleSectionHeader } from '../../shared/RuleSectionHeader'");
    expect(dialogSource).toContain('padding: \'3px 0\'');
    expect(dialogSource).toContain('SECTION_HEADER_FIRST_STYLE');
    expect(dialogSource).toContain('paddingTop: 0');
  });

  it('gives the color block the full row and shows hex + rgb beneath it', () => {
    const { bundle } = createBundle({
      readAppearance: (ids) => ids.map((id) => appearance(id, { size: 12 }, '#a1b2c3')),
    });
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    const thumb = findByTestId(tree, 'stroke-settings-color-thumb')!;
    expect(thumb.props.style.backgroundColor).toBe('#a1b2c3');
    expect(thumb.props.style.width).toBe('100%');
    expect(findByTestId(tree, 'stroke-settings-color-hex')!.props.children).toBe('#A1B2C3');
    expect(findByTestId(tree, 'stroke-settings-color-rgb')!.props.children).toBe('rgb(161, 178, 195)');
  });

  it('offers a bottom resize grip for the sheet height', () => {
    const { bundle } = createBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);
    expect(findByTestId(tree, 'stroke-settings-resize')).toBeDefined();
    expect(dialogSource).toContain('resizeHeightRef');
    expect(dialogSource).toContain('cursor: \'ns-resize\'');
  });

  it('pins the UAT ranges: size 800, scale 500, position 2000', () => {
    expect(BRUSH_SETTINGS_FIELDS.find((field) => field.key === 'size')!.max).toBe(800);
    expect(WATERCOLOR_SETTINGS_FIELDS.find((field) => field.key === 'size')!.max).toBe(800);
    expect(STROKE_SCALE_RANGE.max).toBe(500);
    expect(STROKE_POSITION_RANGE).toEqual({ min: 0, max: 2000 });
    expect(dialogSource).toContain('max={STROKE_POSITION_RANGE.max}');
  });

  it('lets every dialog slider accept typed values beyond the track range', () => {
    const sliders = dialogSource.match(/<SliderStepper\b/g) ?? [];
    const freeEntry = dialogSource.match(/allowOutOfRangeEntry/g) ?? [];
    expect(sliders.length).toBeGreaterThan(0);
    expect(freeEntry).toHaveLength(sliders.length);
  });

  it('structural pins: no picker, no Studio writes, no useState', () => {
    expect(dialogSource).toContain('data-testid="stroke-settings-color"');
    expect(dialogSource).toContain('data-testid="stroke-settings-color-thumb"');
    expect(dialogSource).not.toContain('RightPanelColorTab');
    expect(dialogSource).not.toContain('useState');
    expect(dialogSource).not.toContain('physicsPaintStudio.css');
    expect(dialogSource).not.toContain('paintStore');
    expect(dialogSource).not.toContain('setScriptStrokeSelection');
    expect(dialogSource).not.toContain('ScriptStrokeEditionPort');
  });
});

// ============================================================
//  261024-p5q Task 3 — the geometry session law. Every control
//  applies the delta from ITS last applied value, a refused
//  commit never advances the baseline, and the session is keyed
//  by the selection Set (membership change re-baselines).
// ============================================================

describe('261024-p5q geometry session and deltas', () => {
  const center = { x: 100, y: 50 };

  it('starts every control at its identity value', () => {
    expect(FRESH_STROKE_GEOMETRY_SESSION).toEqual({
      uniformPct: 100,
      scaleXPct: 100,
      scaleYPct: 100,
      rotationDeg: 0,
    });
    expect([STROKE_SCALE_RANGE.min, STROKE_SCALE_RANGE.max]).toEqual([10, 500]);
    expect(STROKE_POSITION_RANGE).toEqual({ min: 0, max: 2000 });
    expect([STROKE_ROTATION_RANGE.min, STROKE_ROTATION_RANGE.max]).toEqual([-360, 360]);
  });

  it('compounds uniform scale per commit about the selection centre', () => {
    const first = geometryTransform(
      'uniform',
      120,
      FRESH_STROKE_GEOMETRY_SESSION,
      center,
    )!;
    expect(first.transform).toEqual({
      kind: 'scale',
      centerX: 100,
      centerY: 50,
      anchorX: 100,
      anchorY: 50,
      angleRad: 0,
      scaleX: 1.2,
      scaleY: 1.2,
    });
    expect(first.nextSession).toEqual({
      uniformPct: 120,
      scaleXPct: 120,
      scaleYPct: 120,
      rotationDeg: 0,
    });

    const second = geometryTransform('uniform', 90, first.nextSession, center)!;
    expect(second.transform.scaleX).toBeCloseTo(0.75);
    expect(second.transform.scaleY).toBeCloseTo(0.75);
    expect(second.nextSession).toEqual({
      uniformPct: 90,
      scaleXPct: 90,
      scaleYPct: 90,
      rotationDeg: 0,
    });
  });

  it('updates one scale axis without touching the other', () => {
    const x = geometryTransform(
      'scaleX',
      150,
      FRESH_STROKE_GEOMETRY_SESSION,
      center,
    )!;
    expect(x.transform.scaleX).toBe(1.5);
    expect(x.transform.scaleY).toBe(1);
    expect(x.nextSession).toEqual({
      uniformPct: 100,
      scaleXPct: 150,
      scaleYPct: 100,
      rotationDeg: 0,
    });

    const y = geometryTransform('scaleY', 50, x.nextSession, center)!;
    expect(y.transform.scaleX).toBe(1);
    expect(y.transform.scaleY).toBe(0.5);
    expect(y.nextSession).toEqual({
      uniformPct: 100,
      scaleXPct: 150,
      scaleYPct: 50,
      rotationDeg: 0,
    });
  });

  it('applies the rotation delta about the centre', () => {
    const first = geometryTransform(
      'rotation',
      30,
      FRESH_STROKE_GEOMETRY_SESSION,
      center,
    )!;
    expect(first.transform.kind).toBe('rotate');
    expect(first.transform.centerX).toBe(100);
    expect(first.transform.centerY).toBe(50);
    expect(first.transform.angleRad).toBeCloseTo(Math.PI / 6);
    expect([first.transform.scaleX, first.transform.scaleY]).toEqual([1, 1]);

    const second = geometryTransform('rotation', 10, first.nextSession, center)!;
    expect(second.transform.angleRad).toBeCloseTo((-20 * Math.PI) / 180);
    expect(second.nextSession.rotationDeg).toBe(10);
  });

  it('accepts typed values beyond the track ranges and refuses same-value or non-finite input', () => {
    const beyond = geometryTransform(
      'uniform',
      5000,
      FRESH_STROKE_GEOMETRY_SESSION,
      center,
    )!;
    expect(beyond.nextSession.uniformPct).toBe(5000);
    expect(beyond.transform.scaleX).toBe(50);

    const rotation = geometryTransform(
      'rotation',
      400,
      FRESH_STROKE_GEOMETRY_SESSION,
      center,
    )!;
    expect(rotation.nextSession.rotationDeg).toBe(400);

    expect(geometryTransform('uniform', 100, FRESH_STROKE_GEOMETRY_SESSION, center)).toBeNull();
    expect(geometryTransform('rotation', 0, FRESH_STROKE_GEOMETRY_SESSION, center)).toBeNull();
    expect(
      geometryTransform('uniform', Number.NaN, FRESH_STROKE_GEOMETRY_SESSION, center),
    ).toBeNull();
    expect(
      geometryTransform('rotation', Number.POSITIVE_INFINITY, FRESH_STROKE_GEOMETRY_SESSION, center),
    ).toBeNull();
  });

  it('rounds typed X/Y targets to integer pixel deltas and refuses sub-pixel moves', () => {
    expect(geometryMoveDelta({ x: 130, y: 45 }, { x: 100, y: 50 })).toEqual({
      dxPx: 30,
      dyPx: -5,
    });
    expect(geometryMoveDelta({ x: 100.4, y: 49.6 }, { x: 100, y: 50 })).toBeNull();
    expect(geometryMoveDelta({ x: Number.NaN, y: 50 }, { x: 100, y: 50 })).toBeNull();
  });
});

describe('261024-p5q dialog geometry', () => {
  const strokes = [
    // Only stroke 7 is selected in most cells: its centre is (100, 50).
    selectableStroke(7, { x: 80, y: 40, width: 40, height: 20 }),
    selectableStroke(9, { x: 0, y: 0, width: 10, height: 10 }),
  ];

  function geometryBundle(overrides: Partial<StrokeSettingsDialogBundle> = {}) {
    const transformCalls: Array<{ ids: number[]; transform: ScriptStrokeTransform }> = [];
    const moveCalls: Array<{ ids: number[]; dx: number; dy: number }> = [];
    const created = createBundle({
      canvasSize: { width: 400, height: 300 },
      listStrokes: () => strokes,
      moveStrokes: (ids, dxPx, dyPx) => {
        moveCalls.push({ ids: [...ids], dx: dxPx, dy: dyPx });
        return true;
      },
      transformStrokes: (ids, transform) => {
        transformCalls.push({ ids: [...ids], transform });
        return true;
      },
      ...overrides,
    });
    return { ...created, transformCalls, moveCalls };
  }

  function geometryRow(tree: unknown, label: string) {
    const row = findComponent(tree, (props) => props.ariaLabel === label);
    expect(row, label).toBeDefined();
    return row!;
  }

  it('renders X / Y / scale / rotation as release-commit free-entry rows', () => {
    const { bundle } = geometryBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    for (const label of ['X', 'Y', 'Scale', 'Scale X', 'Scale Y', 'Rotation']) {
      const row = geometryRow(tree, label);
      expect(row.props.commitOnRelease, label).toBe(true);
      expect(row.props.freeEntry, label).toBe(true);
    }

    // The live selection centre, filtered to the selected ids only.
    expect(geometryRow(tree, 'X').props.value).toBe(100);
    expect(geometryRow(tree, 'Y').props.value).toBe(50);
    expect(geometryRow(tree, 'Scale').props.value).toBe(100);
    expect(geometryRow(tree, 'Scale X').props.value).toBe(100);
    expect(geometryRow(tree, 'Scale Y').props.value).toBe(100);
    expect(geometryRow(tree, 'Rotation').props.value).toBe(0);
    expect(findByTestId(tree, 'stroke-settings-geometry')).toBeDefined();
  });

  it('awaits each transform and advances the session only on a true result', async () => {
    const { bundle, transformCalls } = geometryBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    (geometryRow(tree, 'Scale').props.onChange as (value: number) => void)(120);
    expect(transformCalls).toHaveLength(1);
    expect(transformCalls[0]!.ids).toEqual([7]);
    expect(transformCalls[0]!.transform.scaleX).toBeCloseTo(1.2);
    // The display only moves after the awaited result.
    expect(geometryRow(renderDialog(bundle), 'Scale').props.value).toBe(100);
    await Promise.resolve();
    expect(geometryRow(renderDialog(bundle), 'Scale').props.value).toBe(120);

    (geometryRow(renderDialog(bundle), 'Scale').props.onChange as (value: number) => void)(90);
    expect(transformCalls[1]!.transform.scaleX).toBeCloseTo(0.75);
    await Promise.resolve();
    const compounded = renderDialog(bundle);
    expect(geometryRow(compounded, 'Scale').props.value).toBe(90);
    expect(geometryRow(compounded, 'Scale X').props.value).toBe(90);
    expect(geometryRow(compounded, 'Scale Y').props.value).toBe(90);
  });

  it('keeps the previous session value when the commit is refused', async () => {
    const { bundle } = geometryBundle({ transformStrokes: () => Promise.resolve(false) });
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);
    (geometryRow(tree, 'Scale').props.onChange as (value: number) => void)(120);
    await Promise.resolve();
    await Promise.resolve();
    expect(geometryRow(renderDialog(bundle), 'Scale').props.value).toBe(100);
  });

  it('re-baselines scale and rotation on a selection membership change', async () => {
    const { bundle } = geometryBundle();
    setScriptStrokeSelection([7]);
    (geometryRow(renderDialog(bundle), 'Scale').props.onChange as (value: number) => void)(120);
    await Promise.resolve();
    (geometryRow(renderDialog(bundle), 'Rotation').props.onChange as (value: number) => void)(30);
    await Promise.resolve();

    const committed = renderDialog(bundle);
    expect(geometryRow(committed, 'Scale').props.value).toBe(120);
    expect(geometryRow(committed, 'Rotation').props.value).toBe(30);

    setScriptStrokeSelection([7, 9]);
    const rebased = renderDialog(bundle);
    expect(geometryRow(rebased, 'Scale').props.value).toBe(100);
    expect(geometryRow(rebased, 'Scale X').props.value).toBe(100);
    expect(geometryRow(rebased, 'Scale Y').props.value).toBe(100);
    expect(geometryRow(rebased, 'Rotation').props.value).toBe(0);
  });

  it('moves by the typed absolute X/Y delta and ignores a no-op target', () => {
    const { bundle, moveCalls } = geometryBundle();
    setScriptStrokeSelection([7]);
    const tree = renderDialog(bundle);

    (geometryRow(tree, 'X').props.onChange as (value: number) => void)(130);
    expect(moveCalls).toEqual([{ ids: [7], dx: 30, dy: 0 }]);

    (geometryRow(renderDialog(bundle), 'Y').props.onChange as (value: number) => void)(50);
    expect(moveCalls).toHaveLength(1);
  });

  it('structural pins: selection-box centre source, no persistent transform record', () => {
    expect(dialogSource).toContain('scriptStrokeSelectionBox');
    expect(dialogSource).toContain('bundle.listStrokes');
    expect(dialogSource).toContain('data-testid="stroke-settings-geometry"');
    expect(dialogSource).not.toContain('localStorage');
    expect(dialogSource).not.toContain('transformRecord');
    expect(modelSource).toContain('geometryTransform');
    expect(modelSource).toContain('geometryMoveDelta');
  });
});
