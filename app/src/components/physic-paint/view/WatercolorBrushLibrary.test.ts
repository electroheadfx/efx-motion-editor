/**
 * 261017-xa0 I-03 — Brush tab is the shipped playground brushes.
 *
 * Laws pinned here:
 *   three sections in catalog order: Presets, Texture (built-ins), Custom
 *   one card per catalog entry, 2-column grids inside each section
 *   each card = 150x44 stroke thumb canvas + mixed-case name + tooltip
 *   testids: root watercolor-brush-library, cards watercolor-brush-card-${id},
 *            sections watercolor-brush-section-${presets|texture|custom}
 *   no category filter / search field / wc/ size-variant rows
 *   card pick -> selectAquarelleTip(tipId) -> selection + Brush tool
 *   stroke painter runs at most once per tip id (cache hit on remount)
 *   a mask-backed tip paints through buildBrushForStroke + its mask (63-06)
 *   never canvas.toDataURL / toBlob (52.1 D-19)
 *   blitStrokeThumb matches the visible bitmap to the DPR-scaled cache (261029-uoz)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRUSH_PRESETS,
  BUILTIN_TIPS,
  buildBrush,
} from '@efxlab/efx-watercolor';
import {
  IMPORT_TIP_FAILURE_COPY,
  NEUTRAL_TOOL_OVERRIDES,
  resolveMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor/brushes';
import {
  addCustomBrushTip,
  customBrushTips,
  replaceCustomBrushTips,
  replaceUnavailableTipIds,
  unavailableTipCount,
} from '../../../stores/aquarelleBrushCatalog';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleActiveTool,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  recordAquarelleStroke,
  selectAquarelleTip,
  setAquarelleTool,
} from './aquarelleRecordState';
import {
  aquarelleSelectMode,
  setAquarelleSelectMode,
  setAquarelleSelectionEditPort,
} from './aquarelleStrokeSelection';
import {
  clearScriptStrokeSelection,
  scriptSelectedStrokeIds,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';
import type { ScriptStrokeAppearancePatch } from './strokeSettingsModel';
import {
  STROKE_THUMB_HEIGHT,
  STROKE_THUMB_WIDTH,
  blitStrokeThumb,
  clearStrokeThumbCache,
  getStrokeThumb,
  strokeThumbPainter,
} from './watercolorStrokeThumb';
import {
  WatercolorBrushLibrary,
  WatercolorBrushThumb,
  watercolorBrushImportFailure,
  watercolorBrushImporting,
} from './WatercolorBrushLibrary';

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

function renderLibrary(): TestVNode {
  return materialize(WatercolorBrushLibrary()) as TestVNode;
}

/** CSS stylesheet holding the watercolor brush-card classes (261018-l05). */
function readStudioCss(): string {
  return readFileSync(resolve(__dirname, '..', 'physicsPaintStudio.css'), 'utf8');
}

/**
 * Extract one rule body (from `{` to matching `}`) for a selector substring.
 * Region-scoped so whole-file negative greps cannot hit unrelated rules in the
 * 7k+ line stylesheet (261018-l05).
 */
function cssRuleBody(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  expect(idx, `css rule ${selector} must exist`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  expect(open, `css rule ${selector} must have a body`).toBeGreaterThanOrEqual(0);
  expect(close, `css rule ${selector} must close`).toBeGreaterThan(open);
  return css.slice(open, close + 1);
}

function cardNodes(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((n) => {
    const testId = n.props?.['data-testid'];
    return typeof testId === 'string' && testId.startsWith('watercolor-brush-card-');
  });
}

function libraryRoot(tree: TestVNode): TestVNode | undefined {
  return [...walk(tree)].find((n) => n.props?.['data-testid'] === 'watercolor-brush-library');
}

const PRESET_IDS = BRUSH_PRESETS.map((p) => p.id);
const BUILTIN_IDS = BUILTIN_TIPS.map((t) => t.id);

/** One project import fixture: a custom-category, neutral-multiplier tip. */
const CUSTOM_TIP: AquarelleTip = {
  id: 'wc/custom-63-06-fixture',
  category: 'custom',
  name: 'Imported wash',
  ...NEUTRAL_TOOL_OVERRIDES,
};

function cardIdOf(node: TestVNode): string {
  return String(node.props?.['data-testid']).replace('watercolor-brush-card-', '');
}

function cardNodesOf(node: TestVNode): TestVNode[] {
  return [...walk(node)].filter((n) => {
    const testId = n.props?.['data-testid'];
    return typeof testId === 'string' && testId.startsWith('watercolor-brush-card-');
  });
}

function sectionNodes(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((n) => {
    const testId = n.props?.['data-testid'];
    return typeof testId === 'string' && testId.startsWith('watercolor-brush-section-');
  });
}

/** Minimal canvas stub so getStrokeThumb can paint under node (no DOM env). */
function makeStubCanvas(): Record<string, unknown> {
  return {
    width: 0,
    height: 0,
    dataset: {} as Record<string, string>,
    clientWidth: 0,
    clientHeight: 0,
    getContext: () => ({
      setTransform() {},
      clearRect() {},
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData() {},
      drawImage() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      // 61-07: the crisp-sweep thumb paints a path stroke instead of dabs.
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      globalAlpha: 1,
    }),
    toDataURL: () => 'data:,',
  };
}

interface RecordingCanvas {
  width: number;
  height: number;
  dataset: Record<string, string>;
  clientWidth: number;
  clientHeight: number;
  ops: { clearRect: unknown[][]; drawImage: unknown[][] };
  getContext: () => Record<string, unknown>;
}

/**
 * Recording canvas for the blit pin (261029-uoz). Unlike makeStubCanvas this
 * one exposes every clear/draw call, and getContext always returns the SAME
 * recorder so the cache painter and the blit share one observable context.
 */
function makeRecordingCanvas(width = 0, height = 0): RecordingCanvas {
  const clearRect: unknown[][] = [];
  const drawImage: unknown[][] = [];
  const recorder: Record<string, unknown> = {
    setTransform() {},
    clearRect(...args: unknown[]) {
      clearRect.push([...args]);
    },
    drawImage(...args: unknown[]) {
      drawImage.push([...args]);
    },
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    // 61-07: the crisp-sweep thumb paints a path stroke instead of dabs.
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    globalAlpha: 1,
  };
  return {
    width,
    height,
    dataset: {} as Record<string, string>,
    clientWidth: 0,
    clientHeight: 0,
    ops: { clearRect, drawImage },
    getContext: () => recorder,
  };
}

/**
 * Run `run` with a fake `window.devicePixelRatio`, restoring the previous
 * state even on throw. try/finally (not a suite-wide beforeEach) keeps the
 * fake window invisible to every other case and file.
 */
function withStubbedWindow<T>(dpr: number, run: () => T): T {
  const scope = globalThis as unknown as Record<string, unknown>;
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const previous = scope['window'];
  scope['window'] = { devicePixelRatio: dpr };
  try {
    return run();
  } finally {
    if (hadWindow) {
      scope['window'] = previous;
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

let originalDocument: typeof globalThis.document;
let createdCanvases: Array<Record<string, unknown>>;
let toDataUrlCalls: string[];

function resetSelection(): void {
  aquarelleSelectedTipId.value = null;
  aquarelleActiveTool.value = 'brush';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  // The catalog belongs to the open project: every case starts with none.
  replaceCustomBrushTips([]);
  replaceUnavailableTipIds([]);
  watercolorBrushImporting.value = false;
  watercolorBrushImportFailure.value = false;
  clearStrokeThumbCache();
  createdCanvases = [];
  toDataUrlCalls = [];
  Object.assign(globalThis, {
    document: {
      createElement: () => {
        const canvas = makeStubCanvas();
        canvas['toDataURL'] = () => {
          toDataUrlCalls.push('toDataURL');
          return 'data:,';
        };
        canvas['toBlob'] = () => {
          toDataUrlCalls.push('toBlob');
        };
        createdCanvases.push(canvas);
        return canvas;
      },
    },
  });
}

describe('WatercolorBrushLibrary brush-card grid (I-03, 261027-gh9)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
  });

  it('renders one card per catalog entry: presets first, then the built-ins', () => {
    const tree = renderLibrary();
    const cards = cardNodes(tree);
    const expectedIds = [...PRESET_IDS, ...BUILTIN_IDS];
    expect(cards.length).toBe(expectedIds.length);
    expect(cards.map(cardIdOf)).toEqual(expectedIds);
  });

  it('sections the grid: Presets, then Texture (the three built-ins), then Custom', () => {
    addCustomBrushTip(CUSTOM_TIP);
    try {
      const tree = renderLibrary();
      expect(sectionNodes(tree).map((n) => n.props?.['data-testid'])).toEqual([
        'watercolor-brush-section-presets',
        'watercolor-brush-section-texture',
        'watercolor-brush-section-custom',
      ]);
      const [presets, texture, custom] = sectionNodes(tree);
      expect(cardNodesOf(presets!).map(cardIdOf), 'presets section ids').toEqual(PRESET_IDS);
      expect(cardNodesOf(texture!).map(cardIdOf), 'texture section = built-ins').toEqual(
        BUILTIN_IDS,
      );
      expect(cardNodesOf(custom!).map(cardIdOf), 'custom section ids').toEqual([CUSTOM_TIP.id]);
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('skips the Custom section when the project has no imports', () => {
    const tree = renderLibrary();
    expect(sectionNodes(tree).map((n) => n.props?.['data-testid'])).toEqual([
      'watercolor-brush-section-presets',
      'watercolor-brush-section-texture',
    ]);
  });

  it('exposes the library root testid on a 2-column grid', () => {
    const tree = renderLibrary();
    const root = libraryRoot(tree);
    expect(root, 'library root must render').toBeTruthy();
    const style = root!.props?.['style'] as Record<string, unknown> | undefined;
    const columns = style?.['gridTemplateColumns'];
    expect(String(columns), 'root must be a 2-column grid').toMatch(/1fr\s+1fr|repeat\(\s*2\s*,/);
  });

  it('each card is a compact oracle cell: name + 150x44 thumb + title tooltip, no description', () => {
    const tree = renderLibrary();
    for (const preset of BRUSH_PRESETS) {
      const card = cardNodes(tree).find(
        (c) => c.props?.['data-testid'] === `watercolor-brush-card-${preset.id}`,
      );
      expect(card, `card ${preset.id} must render`).toBeTruthy();
      const text = textContent(card);
      expect(text, `card ${preset.id} name`).toContain(preset.name);
      // Hint is a title tooltip only — never a description paragraph.
      expect(card!.props?.['title'], `card ${preset.id} title tooltip`).toBe(preset.hint);
      expect(text, `card ${preset.id} has no hint paragraph`).not.toContain(preset.hint);
      const canvases = [...walk(card)].filter((n) => n.type === 'canvas');
      expect(canvases.length, `card ${preset.id} thumb canvas`).toBe(1);
      const canvas = canvases[0]!;
      expect(canvas.props?.['width'], `card ${preset.id} thumb width`).toBe(STROKE_THUMB_WIDTH);
      expect(canvas.props?.['height'], `card ${preset.id} thumb height`).toBe(STROKE_THUMB_HEIGHT);
    }
  });

  it('thumbs paint the oracle French Ultramarine on a white canvas', () => {
    const source = readFileSync(resolve(__dirname, 'watercolorStrokeThumb.ts'), 'utf8');
    expect(source, 'thumb hex is the oracle previewHex').toContain("STROKE_THUMB_HEX = '#2338a8'");
    // 261018-l05: style source-greps ride the stylesheet (not the TSX inline objects).
    const css = readStudioCss();
    const thumbRule = cssRuleBody(css, '.watercolor-brush-thumb');
    expect(thumbRule, 'card canvas background is white').toContain('background: #fff');
    const nameRule = cssRuleBody(css, '.watercolor-brush-name');
    expect(nameRule, 'name reads mixed case (261029)').not.toContain('text-transform: uppercase');
  });

  it('every card border is #777777; the selected card is orange (261027-gh9f)', () => {
    // Region-scoped to the card rules — the stylesheet is 7k+ lines and a
    // whole-file negative grep would hit unrelated border/white values.
    const css = readStudioCss();
    const cardRule = cssRuleBody(css, '.watercolor-brush-card {');
    const selectedRule = cssRuleBody(css, '.watercolor-brush-card[data-selected="true"]');
    expect(cardRule, '#777777 border on every card').toContain('1px solid #777777');
    expect(cardRule, 'dark sidebar border is gone').not.toContain('var(--sidebar-border');
    expect(cardRule, 'no #2a3340 fallback').not.toContain('#2a3340');
    // No white / near-white border state (thumb canvas may stay #fff).
    expect(cardRule, 'no white border value').not.toMatch(/border:[^;]*#fff/i);
    // 261027-gh9f: the old faint blue tint was too easy to miss — the
    // selected card now carries an orange background and border.
    expect(selectedRule, 'selected background is orange').toMatch(/background:\s*rgba\(240,\s*138,\s*36/);
    expect(selectedRule, 'selected border is orange').toContain('border-color: #f08a24');
  });

  it('has no category filter and no search field', () => {
    // 63-06 D-01: the import affordance is now a contract of this surface
    // (it is the ONLY new control); the filter and the search field stay out,
    // and the size-variant rows stay out too.
    const tree = renderLibrary();
    const selects = [...walk(tree)].filter((n) => n.type === 'select');
    expect(selects.length, 'no category filter').toBe(0);
    const searchInputs = [...walk(tree)].filter(
      (n) => n.type === 'input' && n.props?.['type'] === 'search',
    );
    expect(searchInputs.length, 'no search field').toBe(0);
    expect(textContent(tree), 'no wc/ size-variant names').not.toMatch(/wc\//);
    const source = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8');
    expect(source, 'no search input in source').not.toMatch(/type="search"|type='search'|brushes-search/);
    expect(source, 'no category filter in source').not.toMatch(/category-filter|CATEGORY_FILTER/);
  });

  it('picking a card selects the preset and forces the Brush tool', () => {
    for (const id of ['round', 'flat', 'detail'] as const) {
      resetSelection();
      setAquarelleTool('water');
      const tree = renderLibrary();
      const card = cardNodes(tree).find(
        (c) => c.props?.['data-testid'] === `watercolor-brush-card-${id}`,
      );
      expect(card, `card ${id} must render`).toBeTruthy();
      const onClick = (card!.props as { onClick?: () => void }).onClick;
      expect(onClick, `card ${id} must be clickable`).toBeTruthy();
      onClick!();
      expect(aquarelleSelectedTipId.value, `pick ${id}`).toBe(id);
      expect(aquarelleActiveTool.value, `pick ${id} forces brush`).toBe('brush');
    }
  });

  it('leaves Edit select mode on every brush pick (WR-03)', () => {
    for (const id of ['round', 'hake'] as const) {
      resetSelection();
      setAquarelleSelectMode(true, 'lift');
      expect(aquarelleSelectMode.value, 'Edit armed before the pick').toBe(true);
      try {
        const tree = renderLibrary();
        const card = cardNodes(tree).find(
          (c) => c.props?.['data-testid'] === `watercolor-brush-card-${id}`,
        );
        expect(card, `card ${id} must render`).toBeTruthy();
        (card!.props as { onClick?: () => void }).onClick!();
        // A pick must never strand select mode: the Edit switch unmounts with
        // the Eraser cluster, so nothing visible could disarm it afterwards.
        expect(aquarelleSelectMode.value, `pick ${id} leaves Edit mode`).toBe(false);
        expect(aquarelleActiveTool.value, `pick ${id} forces brush`).toBe('brush');
      } finally {
        setAquarelleSelectMode(false);
      }
    }
  });

  it('marks the selected card from aquarelleSelectedTipId', () => {
    selectAquarelleTip('flat');
    const tree = renderLibrary();
    const selected = cardNodes(tree).filter((c) => {
      const flag = c.props?.['data-selected'] ?? c.props?.['aria-pressed'] ?? c.props?.['aria-selected'];
      return flag === true || flag === 'true';
    });
    expect(selected.length, 'exactly one selected card').toBe(1);
    expect(selected[0]!.props?.['data-testid']).toBe('watercolor-brush-card-flat');
  });

  it('picking a Texture card selects that catalog tip', () => {
    resetSelection();
    const tree = renderLibrary();
    const card = cardNodes(tree).find(
      (c) => c.props?.['data-testid'] === 'watercolor-brush-card-wc/builtin-chalk',
    );
    expect(card, 'built-in card renders').toBeTruthy();
    (card!.props as { onClick?: () => void }).onClick!();

    expect(aquarelleSelectedTipId.value, 'built-in tip selected').toBe('wc/builtin-chalk');
    expect(aquarelleActiveTool.value, 'pick forces brush').toBe('brush');
  });

  it('picking a Custom card selects that tip and loads its multipliers', () => {
    addCustomBrushTip({ ...CUSTOM_TIP, aspect: 1.5 });
    try {
      const tree = renderLibrary();
      const card = cardNodes(tree).find(
        (c) => c.props?.['data-testid'] === `watercolor-brush-card-${CUSTOM_TIP.id}`,
      );
      expect(card, 'custom card renders').toBeTruthy();
      (card!.props as { onClick?: () => void }).onClick!();

      expect(aquarelleSelectedTipId.value, 'custom tip selected').toBe(CUSTOM_TIP.id);
      expect(aquarelleToolOverrides.value.aspect, 'custom multipliers loaded').toBe(1.5);
    } finally {
      replaceCustomBrushTips([]);
    }
  });
});

describe('WatercolorBrushLibrary stroke-thumb cache (52.1 D-19)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
  });

  it('paints each preset thumb at most once across two mounts', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      renderLibrary();
      renderLibrary();
      expect(paintSpy.mock.calls.length, 'one paint per catalog id across two mounts').toBe(
        BRUSH_PRESETS.length + BUILTIN_TIPS.length,
      );
      expect(toDataUrlCalls, 'never toDataURL / toBlob').toEqual([]);
    } finally {
      paintSpy.mockRestore();
    }
  });

  it('paints a built-in texture thumb from its registered mask, not a preset', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      clearStrokeThumbCache();
      getStrokeThumb('wc/builtin-chalk');

      expect(paintSpy.mock.calls.length, 'one paint for the built-in').toBe(1);
      // D-05 / D-21: the preview is the SAME brush the engine stamps —
      // buildBrushForStroke binding its registered mask, not a preset.
      const brush = paintSpy.mock.calls[0]![1] as ReturnType<typeof buildBrush>;
      expect(brush.id, 'built through buildBrushForStroke').toBe('wc/builtin-chalk');
      expect(brush.tipData, 'painted with the registered mask').toBe(
        resolveMask('wc/builtin-chalk'),
      );
      // A distinct cache entry per tip id: never another tip's thumbnail.
      expect(getStrokeThumb('wc/builtin-chalk')).not.toBe(getStrokeThumb('round'));
    } finally {
      paintSpy.mockRestore();
    }
  });

  it('resolves the new chalk catalog id to one painted thumb', () => {
    // 261027-gh9: the thumb path must know every catalog id — the new preset
    // included — or the card would throw on its first paint.
    const first = getStrokeThumb('chalk');
    expect(first, 'chalk thumb canvas').toBeTruthy();
    const second = getStrokeThumb('chalk');
    expect(second, 'chalk cache hit returns the same canvas').toBe(first);
  });

  it('repeated getStrokeThumb calls return the same cached canvas (no repaint)', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      const first = getStrokeThumb('round');
      const second = getStrokeThumb('round');
      expect(second, 'cache hit returns the same canvas').toBe(first);
      expect(paintSpy.mock.calls.length, 'painter ran once for round').toBe(1);
      // The brush passed to the painter is the vendor Brush for the preset.
      const brush = paintSpy.mock.calls[0]![1] as ReturnType<typeof buildBrush>;
      const expected = buildBrush(BRUSH_PRESETS.find((p) => p.id === 'round')!);
      expect(brush.tipSize).toBe(expected.tipSize);
      expect(brush.spacing).toBe(expected.spacing);
    } finally {
      paintSpy.mockRestore();
    }
  });
});

// 63-06 D-01 / D-19: the import row, the greyed unavailable cards and
// the ONE aggregate warning line. The import affordance is the only new
// control; the category filter and the search field stay absent (the
// sibling negative test above pins that half).
describe('WatercolorBrushLibrary import row and unavailable tips (63-06)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
    replaceCustomBrushTips([]);
    replaceUnavailableTipIds([]);
    watercolorBrushImporting.value = false;
    watercolorBrushImportFailure.value = false;
  });

  function fileInputOf(tree: TestVNode): TestVNode | undefined {
    return [...walk(tree)].find(
      (n) => n.type === 'input' && n.props?.['type'] === 'file',
    );
  }

  it('renders one import toolbar row above the grid with a hidden PNG/JPEG input', () => {
    const tree = renderLibrary();
    const nodes = [...walk(tree)];
    const rowIndex = nodes.findIndex(
      (n) => n.props?.['data-testid'] === 'watercolor-brush-import-row',
    );
    const presetsIndex = nodes.findIndex(
      (n) => n.props?.['data-testid'] === 'watercolor-brush-section-presets',
    );
    expect(rowIndex, 'import row renders').toBeGreaterThanOrEqual(0);
    expect(rowIndex, 'import row sits above the grid').toBeLessThan(presetsIndex);
    const fileInputs = nodes.filter(
      (n) => n.type === 'input' && n.props?.['type'] === 'file',
    );
    expect(fileInputs.length, 'exactly one file input').toBe(1);
    expect(fileInputs[0]!.props?.['accept'], 'PNG + JPEG only').toBe('image/png,image/jpeg');
    expect(fileInputs[0]!.props?.['style'], 'input stays hidden').toMatchObject({
      display: 'none',
    });
    const importButtons = nodes.filter(
      (n) => n.props?.['data-testid'] === 'watercolor-brush-import',
    );
    expect(importButtons.length, 'one import button').toBe(1);
    expect(importButtons[0]!.type, 'button element').toBe('button');
  });

  it('disables the import button while an import is in flight', () => {
    watercolorBrushImporting.value = true;
    try {
      const button = [...walk(renderLibrary())].find(
        (n) => n.props?.['data-testid'] === 'watercolor-brush-import',
      );
      expect(button!.props?.['disabled'], 'busy control is disabled').toBe(true);
    } finally {
      watercolorBrushImporting.value = false;
    }
    const idle = [...walk(renderLibrary())].find(
      (n) => n.props?.['data-testid'] === 'watercolor-brush-import',
    );
    expect(idle!.props?.['disabled'], 'idle control is enabled').toBe(false);
  });

  it('a refused import leaves the catalog unchanged and shows the existing copy', async () => {
    const input = fileInputOf(renderLibrary())!;
    const onChange = input.props?.['onChange'] as (event: unknown) => Promise<void>;
    expect(typeof onChange, 'file input handles a pick').toBe('function');
    // Foreign bytes stop at the magic sniff — no catalog row is created and
    // the named refusal copy is the only visible change.
    await onChange({
      currentTarget: {
        files: [
          {
            name: 'not-an-image.png',
            size: 3,
            arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          },
        ],
        value: '',
      },
    });
    expect(watercolorBrushImportFailure.value, 'failure state set').toBe(true);
    expect(customBrushTips.value.length, 'catalog unchanged').toBe(0);
    expect(textContent(renderLibrary()), 'named refusal copy').toContain(IMPORT_TIP_FAILURE_COPY);
  });

  it('greys each unavailable tip and renders exactly ONE aggregate warning line', () => {
    const tips: AquarelleTip[] = ['a', 'b', 'c'].map((suffix) => ({
      id: `wc/custom-63-06-unavailable-${suffix}`,
      category: 'custom' as const,
      name: `Unavailable ${suffix}`,
      ...NEUTRAL_TOOL_OVERRIDES,
    }));
    for (const tip of tips) addCustomBrushTip(tip);
    replaceUnavailableTipIds(tips.map((tip) => tip.id));
    try {
      const tree = renderLibrary();
      // One warning STATE (the store signal) …
      expect(unavailableTipCount.value, 'one aggregate state').toBe(3);
      // … and one rendered LINE, not one per tip.
      const warnings = [...walk(tree)].filter(
        (n) => n.props?.['data-testid'] === 'watercolor-brush-unavailable-warning',
      );
      expect(warnings.length, 'exactly one aggregate line').toBe(1);
      expect(textContent(warnings[0])).toContain('3 brush tips unavailable in this project');
      const greyed = cardNodes(tree).filter(
        (card) => card.props?.['data-unavailable'] === 'true',
      );
      expect(greyed.length, 'one greyed card per unavailable tip').toBe(3);
      for (const card of greyed) {
        expect(card.props?.['disabled'], 'greyed card is unselectable').toBe(true);
      }
    } finally {
      replaceCustomBrushTips([]);
      replaceUnavailableTipIds([]);
    }
  });

  it('an unavailable card cannot become the active tip', () => {
    addCustomBrushTip({ ...CUSTOM_TIP, id: 'wc/custom-63-06-greyed' });
    replaceUnavailableTipIds(['wc/custom-63-06-greyed']);
    try {
      aquarelleSelectedTipId.value = null;
      const tree = renderLibrary();
      const card = cardNodes(tree).find(
        (c) => c.props?.['data-testid'] === 'watercolor-brush-card-wc/custom-63-06-greyed',
      );
      expect(card, 'greyed card renders').toBeTruthy();
      (card!.props as { onClick?: () => void }).onClick!();
      expect(aquarelleSelectedTipId.value, 'the greyed tip is never selected').toBeNull();
    } finally {
      replaceCustomBrushTips([]);
      replaceUnavailableTipIds([]);
    }
  });

  it('describes the delivered surface in the module header', () => {
    const source = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8');
    expect(source, 'header names the three sections').toMatch(/three sections/i);
    expect(source, 'header names the one import row').toMatch(/import toolbar row/i);
    expect(source, 'the stale no-import claim is gone').not.toMatch(/no import affordance/i);
    expect(source, 'no filter / search claim kept').toMatch(/no category filter, no search field/i);
  });
});

describe('blitStrokeThumb is DPR-aware (261029-uoz)', () => {
  let savedDocument: typeof globalThis.document;
  let windowWasPresent = false;
  let savedWindow: unknown;

  beforeEach(() => {
    savedDocument = globalThis.document;
    windowWasPresent = Object.prototype.hasOwnProperty.call(globalThis, 'window');
    savedWindow = (globalThis as unknown as Record<string, unknown>)['window'];
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: savedDocument });
    const scope = globalThis as unknown as Record<string, unknown>;
    if (windowWasPresent) {
      scope['window'] = savedWindow;
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
    clearStrokeThumbCache();
  });

  it('at dpr 2 the blit copies the whole cached bitmap', () => {
    withStubbedWindow(2, () => {
      clearStrokeThumbCache();
      // The contract that caused the bug: prepare() scales the cache bitmap.
      const thumb = getStrokeThumb('round');
      expect(thumb.width, 'dpr-2 cache is 2x wide').toBe(STROKE_THUMB_WIDTH * 2);
      expect(thumb.height, 'dpr-2 cache is 2x tall').toBe(STROKE_THUMB_HEIGHT * 2);

      const target = makeRecordingCanvas(STROKE_THUMB_WIDTH, STROKE_THUMB_HEIGHT);
      blitStrokeThumb(target as unknown as HTMLCanvasElement, 'round');

      expect(target.width, 'visible bitmap matches the cache width').toBe(thumb.width);
      expect(target.height, 'visible bitmap matches the cache height').toBe(thumb.height);
      expect(target.ops.drawImage.length, 'exactly one draw').toBe(1);
      const draw = target.ops.drawImage[0]!;
      expect(draw.length, '1:1 draw keeps three arguments').toBe(3);
      expect(draw[0], 'draws the cached canvas').toBe(thumb);
      expect(draw[1], 'x origin').toBe(0);
      expect(draw[2], 'y origin').toBe(0);
      expect(target.ops.clearRect.length, 'exactly one clear').toBe(1);
      const clear = target.ops.clearRect[0]!;
      expect(clear[2], 'clear covers the resized width').toBe(thumb.width);
      expect(clear[3], 'clear covers the resized height').toBe(thumb.height);
    });
  });

  it('at dpr 1 (no window) the blit is unchanged', () => {
    clearStrokeThumbCache();
    expect(typeof globalThis.window, 'node test env has no window').toBe('undefined');
    const thumb = getStrokeThumb('round');
    expect(thumb.width, 'dpr-1 cache is the logical width').toBe(STROKE_THUMB_WIDTH);
    expect(thumb.height, 'dpr-1 cache is the logical height').toBe(STROKE_THUMB_HEIGHT);

    const target = makeRecordingCanvas(STROKE_THUMB_WIDTH, STROKE_THUMB_HEIGHT);
    blitStrokeThumb(target as unknown as HTMLCanvasElement, 'round');

    expect(target.width, 'no resize at dpr 1').toBe(STROKE_THUMB_WIDTH);
    expect(target.height, 'no resize at dpr 1').toBe(STROKE_THUMB_HEIGHT);
    expect(target.ops.drawImage.length, 'exactly one draw').toBe(1);
    const draw = target.ops.drawImage[0]!;
    expect(draw.length, '1:1 draw keeps three arguments').toBe(3);
    expect(draw[0], 'draws the cached canvas').toBe(thumb);
    expect(draw[1], 'x origin').toBe(0);
    expect(draw[2], 'y origin').toBe(0);
  });

  it('the component ref path lands the full bitmap', () => {
    withStubbedWindow(2, () => {
      clearStrokeThumbCache();
      const vnode = WatercolorBrushThumb({
        presetId: 'round',
        class: 'watercolor-brush-thumb',
      });
      const canvas = materialize(vnode) as TestVNode;
      expect(canvas.type, 'component renders a canvas').toBe('canvas');
      // Preact extracts `ref` from props onto the vnode itself (createElement /
      // jsx-runtime normalize it), so the callback lives at vnode.ref.
      const ref = (canvas as unknown as { ref?: unknown }).ref;
      expect(typeof ref, 'canvas exposes a ref callback').toBe('function');

      const target = makeRecordingCanvas(STROKE_THUMB_WIDTH, STROKE_THUMB_HEIGHT);
      (ref as (el: unknown) => void)(target);

      const thumb = getStrokeThumb('round');
      expect(thumb.width, 'cache is 300 wide at dpr 2').toBe(STROKE_THUMB_WIDTH * 2);
      expect(thumb.height, 'cache is 88 tall at dpr 2').toBe(STROKE_THUMB_HEIGHT * 2);
      expect(target.width, 'visible bitmap equals the cache width').toBe(thumb.width);
      expect(target.height, 'visible bitmap equals the cache height').toBe(thumb.height);
      expect(target.ops.drawImage.length, 'component blits once per mount').toBe(1);
    });
  });
});

// quick 261111-ucf — a library card is a pick surface. An ARMED
// selection survives the pick (the pick is about to edit it);
// an unarmed Edit mode still disarms exactly as the WR-03 test
// above pins. Id band 10651+.
describe('quick 261111-ucf library card picks edit the armed selection', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
    setAquarelleSelectionEditPort(null);
    setAquarelleSelectMode(false);
    clearScriptStrokeSelection();
  });

  it('keeps Select mode and the selection, then commits the picked id + live bag', () => {
    recordAquarelleStroke(10651, stroke10651([point10651(0.2, 0.5)]));
    const calls: Array<{ ids: readonly number[]; patch: ScriptStrokeAppearancePatch }> = [];
    const promise = Promise.resolve(true);
    setAquarelleSelectionEditPort({
      applyAppearance: (ids, patch) => {
        calls.push({ ids, patch });
        return promise;
      },
    });
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10651]);

    const tree = renderLibrary();
    const card = cardNodes(tree).find(
      (c) => c.props?.['data-testid'] === 'watercolor-brush-card-round',
    );
    expect(card, 'round card must render').toBeTruthy();
    (card!.props as { onClick?: () => void }).onClick!();

    expect(aquarelleSelectMode.value, 'armed selection survives the pick').toBe(true);
    expect([...scriptSelectedStrokeIds.peek()], 'selection survives the pick').toEqual([10651]);
    expect(aquarelleSelectedTipId.value, 'the live tip changed').toBe('round');
    expect(calls, 'exactly one port call').toHaveLength(1);
    expect(calls[0]!.ids).toEqual([10651]);
    expect(calls[0]!.patch.brushId).toBe('round');
    expect(calls[0]!.patch.toolOverrides).toEqual(aquarelleToolOverrides.peek());
  });
});

function point10651(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke10651(points: readonly AquarellePoint[]): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points,
    timestamp: 0,
    playFrame: 801,
  };
}
