/**
 * 261017-xa0 I-03 — Brush tab; quick-261115-oh9 splits the two axes.
 *
 * Laws pinned here:
 *   TWO response sections over BRUSH_PRESETS in the fixed order Watercolor,
 *   Gouache (64-11 MED-27; quick 261124-iq9 retires Chalk/Graphite and
 *   displays the acrylic group as Gouache) — a response card is
 *   never a texture and never a project import
 *   a texture row (watercolor-texture-strip) above the grid: Default first,
 *   then the machine library's rows in catalog order (no compile-time
 *   built-ins — quick 261116-inu)
 *   chips render the engine's real grayscale mask (watercolorMaskChip)
 *   every response card = 150x44 stroke thumb canvas + mixed-case name + tooltip
 *   testids: root watercolor-brush-library, cards watercolor-brush-card-${id},
 *            sections watercolor-brush-section-${group} (two medium ids),
 *            texture row watercolor-texture-strip,
 *            chips watercolor-texture-chip-${textureId ?? 'default'}
 *   no category filter / search field / wc/ size-variant rows
 *   response card pick -> selectAquarelleTip(tipId) -> selection + Brush tool
 *   texture chip pick -> setAquarelleSelectedTextureId ONLY (never a response)
 *   an import selects the new texture on arrival
 *   stroke painter runs at most once per response id (cache hit on remount)
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
  TIP_MASK_BYTES,
  brushSections,
  buildBrush,
} from '@efxlab/efx-watercolor';
import {
  IMPORT_TIP_FAILURE_COPY,
  NEUTRAL_TOOL_OVERRIDES,
  registerMask,
  resetMaskRegistry,
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
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  recordAquarelleStroke,
  selectAquarelleTip,
  setAquarelleSelectedTextureId,
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
import { clearMaskChipCache } from './watercolorMaskChip';
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

/**
 * The import pipeline is mocked so the ARRIVAL law is observable without a
 * real image decode (the real sniff/decode law is pinned in the package's
 * importTip.test.ts). Every case resets it in resetSelection().
 */
const importTipMock = vi.hoisted(() => vi.fn());
vi.mock('@efxlab/efx-watercolor/brushes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@efxlab/efx-watercolor/brushes')>();
  return { ...actual, importTip: importTipMock };
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

/** Table order regrouped by the section helper — the visual card order. */
const GROUPED_IDS = brushSections(BRUSH_PRESETS).flatMap((section) =>
  section.presets.map((preset) => preset.id),
);

/** A library mask fixture: exactly TIP_MASK_BYTES, so registerMask accepts it. */
function libraryMask(value: number): Uint8Array {
  return new Uint8Array(TIP_MASK_BYTES).fill(value);
}

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

function sectionNodes(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((n) => {
    const testId = n.props?.['data-testid'];
    return typeof testId === 'string' && testId.startsWith('watercolor-brush-section-');
  });
}

function textureChipNodes(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((n) => {
    const testId = n.props?.['data-testid'];
    return typeof testId === 'string' && testId.startsWith('watercolor-texture-chip-');
  });
}

/** 'default' for the null chip, else the texture id. */
function chipTextureIdOf(node: TestVNode): string {
  return String(node.props?.['data-testid']).replace('watercolor-texture-chip-', '');
}

function chipOf(tree: TestVNode, textureId: string | null): TestVNode | undefined {
  return textureChipNodes(tree).find(
    (chip) => chipTextureIdOf(chip) === (textureId ?? 'default'),
  );
}

function maskCanvasOf(chip: TestVNode): TestVNode | undefined {
  return [...walk(chip)].find((n) => n.type === 'canvas');
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
  aquarelleSelectedTextureId.value = null;
  // quick 261121-mtu (rev 2): the grid now filters to the active tool's brush
  // FAMILY (Brush = non-watercolor, Watercolor = watercolor only). This suite
  // pins the two-section grid itself, so it runs under a UTILITY tool, which
  // exposes the whole table; the paint-family filter has its own block below
  // and its pure law in brushToolFamily.test.ts.
  aquarelleActiveTool.value = 'water';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  // quick 261116-inu: the catalog is the machine library; every case starts
  // with none, and there are no compile-time masks to restore.
  replaceCustomBrushTips([]);
  replaceUnavailableTipIds([]);
  resetMaskRegistry();
  watercolorBrushImporting.value = false;
  watercolorBrushImportFailure.value = false;
  importTipMock.mockReset();
  clearStrokeThumbCache();
  clearMaskChipCache();
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

  it('renders the two grouped sections over BRUSH_PRESETS — no texture or custom card', () => {
    addCustomBrushTip(CUSTOM_TIP);
    try {
      const tree = renderLibrary();
      expect(sectionNodes(tree).map((n) => n.props?.['data-testid'])).toEqual([
        'watercolor-brush-section-watercolor',
        'watercolor-brush-section-acrylic',
      ]);
      expect(cardNodes(tree).map(cardIdOf), 'one response card per preset, grouped').toEqual(
        GROUPED_IDS,
      );
      expect(cardNodes(tree).length, 'every preset still renders once').toBe(PRESET_IDS.length);
      const testIds = [...walk(tree)].map((n) => n.props?.['data-testid']);
      const textureCards = testIds.filter(
        (id): id is string => typeof id === 'string' && id.startsWith('watercolor-brush-card-wc/'),
      );
      expect(textureCards, 'a texture is never a response card').toEqual([]);
      expect(testIds, 'a project import is never a response card').not.toContain(
        `watercolor-brush-card-${CUSTOM_TIP.id}`,
      );
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('names the two sections with the D-18 short names', () => {
    const titles = sectionNodes(renderLibrary()).map((section) =>
      textContent(childrenOf(section)[0]),
    );
    expect(titles).toEqual(['Watercolor', 'Medium']);
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

  it('picking a card selects the preset and forces the tool of the card\'s brush family', () => {
    // quick 261121-mtu: the blanket `brush` flip is gone. A watercolor-group
    // card selects the Watercolor tool; a non-watercolor card still selects
    // Brush (pinned below with the acrylic preset).
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
      expect(aquarelleActiveTool.value, `pick ${id} selects the watercolor family`).toBe('watercolor');
    }

    // The non-watercolor control: an acrylic card still lands on Brush.
    resetSelection();
    setAquarelleTool('water');
    const acrylicTree = renderLibrary();
    const acrylicCard = cardNodes(acrylicTree).find(
      (c) => c.props?.['data-testid'] === 'watercolor-brush-card-bristle-round',
    );
    expect(acrylicCard, 'the acrylic card must render').toBeTruthy();
    (acrylicCard!.props as { onClick?: () => void }).onClick!();
    expect(aquarelleSelectedTipId.value).toBe('bristle-round');
    expect(aquarelleActiveTool.value, 'an acrylic pick selects the Brush tool').toBe('brush');
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
        // quick 261121-mtu: round and hake are watercolor-group cards, so the
        // pick selects the Watercolor tool (family law, not a blanket brush).
        expect(aquarelleActiveTool.value, `pick ${id} selects the watercolor family`).toBe('watercolor');
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

});

// quick-261115-oh9: the texture axis has its own row — Default first, then
// the machine library's rows (quick 261116-inu: imports are the only source).
// A chip is a texture pick only: it never selects a response, never writes
// the multiplier bag.
describe('WatercolorBrushLibrary texture strip (quick-261115-oh9)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
    replaceCustomBrushTips([]);
    replaceUnavailableTipIds([]);
  });

  it('renders the row below the grid: Default, then library rows', () => {
    addCustomBrushTip(CUSTOM_TIP);
    try {
      const tree = renderLibrary();
      const nodes = [...walk(tree)];
      const stripIndex = nodes.findIndex(
        (n) => n.props?.['data-testid'] === 'watercolor-texture-strip',
      );
      const lastSectionIndex = nodes.reduce(
        (last, node, index) =>
          String(node.props?.['data-testid'] ?? '').startsWith('watercolor-brush-section-')
            ? index
            : last,
        -1,
      );
      expect(stripIndex, 'texture row renders').toBeGreaterThanOrEqual(0);
      // 2026-11-27 (artist's live ruling): the Tips brush section closes the
      // library, so the texture row sits BELOW the response sections.
      expect(stripIndex, 'texture row sits below the grid').toBeGreaterThan(lastSectionIndex);
      const stripChips = textureChipNodes(tree);
      // quick 261116-inu: no compile-time built-ins — Default, then the rows.
      expect(stripChips[0]!.props?.['data-testid']).toBe('watercolor-texture-chip-default');
      expect(stripChips.map(chipTextureIdOf)).toEqual(['default', CUSTOM_TIP.id]);
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('a texture chip writes ONLY aquarelleSelectedTextureId', () => {
    selectAquarelleTip('flat');
    aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 1.4 };
    addCustomBrushTip(CUSTOM_TIP);
    try {
      const chip = chipOf(renderLibrary(), CUSTOM_TIP.id);
      expect(chip, 'library texture chip renders').toBeTruthy();
      (chip!.props as { onClick?: () => void }).onClick!();

      expect(aquarelleSelectedTextureId.value, 'texture selected').toBe(CUSTOM_TIP.id);
      expect(aquarelleSelectedTipId.value, 'the response is untouched').toBe('flat');
      expect(aquarelleToolOverrides.value.aspect, 'the multipliers are untouched').toBe(1.4);
      const source = readFileSync(resolve(__dirname, 'WatercolorTextureStrip.tsx'), 'utf8');
      expect(source, 'a texture chip never selects a response').not.toMatch(/selectAquarelleTip/);
    } finally {
      aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
      replaceCustomBrushTips([]);
    }
  });

  it('marks the Default chip when the texture signal is null; every chip carries data-selected', () => {
    const chips = textureChipNodes(renderLibrary());
    expect(chips.length, 'Default alone when the library is empty').toBe(1);
    expect(chips[0]!.props?.['data-testid']).toBe('watercolor-texture-chip-default');
    for (const chip of chips) {
      const expected = chipTextureIdOf(chip) === 'default' ? 'true' : 'false';
      expect(chip.props?.['data-selected'], `${chipTextureIdOf(chip)} selected`).toBe(expected);
      expect(chip.props?.['aria-pressed'], `${chipTextureIdOf(chip)} pressed`).toBe(
        expected === 'true',
      );
    }

    addCustomBrushTip(CUSTOM_TIP);
    expect(registerMask(CUSTOM_TIP.id, libraryMask(17)), 'fixture mask accepted').toBe(true);
    try {
      setAquarelleSelectedTextureId(CUSTOM_TIP.id);
      const selected = textureChipNodes(renderLibrary()).filter(
        (chip) => chip.props?.['data-selected'] === 'true',
      );
      expect(selected.map(chipTextureIdOf), 'exactly the picked texture').toEqual([
        CUSTOM_TIP.id,
      ]);
    } finally {
      replaceCustomBrushTips([]);
    }
  });

  it('every chip renders one real mask canvas through an inline blit ref', () => {
    const tree = renderLibrary();
    for (const chip of textureChipNodes(tree)) {
      const canvas = maskCanvasOf(chip);
      expect(canvas, `${chipTextureIdOf(chip)} mask canvas`).toBeTruthy();
      expect(canvas!.props?.['class']).toBe('watercolor-texture-chip-canvas');
      const ref = (canvas as unknown as { ref?: unknown }).ref;
      expect(typeof ref, `${chipTextureIdOf(chip)} inline ref blits`).toBe('function');
    }
  });

  it('the Default chip tracks the selected response', () => {
    /** Blit the first chip onto a recorder and return the chip canvas drawn. */
    const defaultChipSource = (responseId: string): unknown => {
      selectAquarelleTip(responseId);
      const canvasVNode = maskCanvasOf(textureChipNodes(renderLibrary())[0]!);
      const ref = (canvasVNode as unknown as { ref?: (el: unknown) => void }).ref!;
      const target = makeRecordingCanvas(44, 44);
      ref(target);
      expect(target.ops.drawImage.length, `one blit for ${responseId}`).toBe(1);
      return target.ops.drawImage[0]![0];
    };
    const bristle = defaultChipSource('bristle-round');
    const flat = defaultChipSource('flat');
    // The cache key carries the response id — a response change repaints the
    // Default chip instead of serving the previous response's tip.
    expect(bristle).not.toBe(flat);
  });

  it('styles the texture row, the 44px chip canvas, the accent and the greyed state', () => {
    const css = readStudioCss();
    // Region-scoped: the stylesheet is 7k+ lines.
    expect(
      cssRuleBody(css, '.watercolor-texture-strip {'),
      'row spans both grid columns',
    ).toContain('grid-column: 1 / -1');
    // Anchored at a line start: the menu popover adds a compound
    // `.physics-paint-brush-menu-textures .watercolor-texture-chip-canvas`
    // rule (34px) earlier in the stylesheet, which a bare substring would hit.
    expect(
      cssRuleBody(css, '\n.watercolor-texture-chip-canvas'),
      'chip canvas is 44px square',
    ).toContain('44px');
    expect(
      cssRuleBody(css, '.watercolor-texture-chip[data-selected="true"]'),
      'selected chip uses the card accent',
    ).toContain('border-color: #f08a24');
    const unavailableRule = cssRuleBody(css, '.watercolor-texture-chip[data-unavailable="true"]');
    expect(unavailableRule, 'greyed opacity').toContain('opacity: 0.45');
    expect(unavailableRule, 'not-allowed cursor').toContain('not-allowed');
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

  it('paints each response thumb at most once across two mounts', () => {
    const paintSpy = vi
      .spyOn(strokeThumbPainter, 'drawStroke')
      .mockImplementation(() => {});

    try {
      renderLibrary();
      renderLibrary();
      expect(paintSpy.mock.calls.length, 'one paint per response id across two mounts').toBe(
        BRUSH_PRESETS.length,
      );
      expect(toDataUrlCalls, 'never toDataURL / toBlob').toEqual([]);
    } finally {
      paintSpy.mockRestore();
    }
  });

  it('resolves the acrylic catalog id to one painted thumb', () => {
    // 261027-gh9: the thumb path must know every catalog id — the bristle
    // response included — or the card would throw on its first paint.
    const first = getStrokeThumb('bristle-round');
    expect(first, 'bristle-round thumb canvas').toBeTruthy();
    const second = getStrokeThumb('bristle-round');
    expect(second, 'bristle-round cache hit returns the same canvas').toBe(first);
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

  it('renders one import toolbar row in the Tips brush section below the grid', () => {
    const tree = renderLibrary();
    const nodes = [...walk(tree)];
    const rowIndex = nodes.findIndex(
      (n) => n.props?.['data-testid'] === 'watercolor-brush-import-row',
    );
    const tipsIndex = nodes.findIndex(
      (n) => n.props?.['data-testid'] === 'watercolor-tips-section',
    );
    const lastSectionIndex = nodes.reduce(
      (last, node, index) =>
        String(node.props?.['data-testid'] ?? '').startsWith('watercolor-brush-section-')
          ? index
          : last,
      -1,
    );
    expect(rowIndex, 'import row renders').toBeGreaterThanOrEqual(0);
    // 2026-11-27 (artist's live ruling): the Tips brush section CLOSES the
    // library — the responses lead, the textures follow.
    expect(tipsIndex, 'the Tips brush section renders').toBeGreaterThan(lastSectionIndex);
    expect(rowIndex, 'import row sits below the response grid').toBeGreaterThan(lastSectionIndex);
    expect(rowIndex, 'import row lives inside the Tips brush section').toBeGreaterThan(tipsIndex);
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

  function pickFile(event: unknown): Promise<void> {
    const input = fileInputOf(renderLibrary())!;
    const onChange = input.props?.['onChange'] as (event: unknown) => Promise<void>;
    expect(typeof onChange, 'file input handles a pick').toBe('function');
    return onChange(event);
  }

  function pickedFile(name = 'tip.png'): unknown {
    return {
      currentTarget: {
        files: [{ name, size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }],
        value: '',
      },
    };
  }

  it('a refused import leaves the catalog and the selection unchanged', async () => {
    // quick 261116-inu: a library row is the only kind of texture that exists.
    setAquarelleSelectedTextureId(CUSTOM_TIP.id);
    // The refusal copy and the unchanged state are this surface's law; the
    // real sniff/decode law lives in the package's importTip.test.ts.
    importTipMock.mockResolvedValue({ ok: false, reason: 'not-an-image' });
    await pickFile(pickedFile('not-an-image.png'));
    expect(watercolorBrushImportFailure.value, 'failure state set').toBe(true);
    expect(customBrushTips.value.length, 'catalog unchanged').toBe(0);
    expect(aquarelleSelectedTextureId.value, 'failed import leaves selection untouched').toBe(
      CUSTOM_TIP.id,
    );
    expect(textContent(renderLibrary()), 'named refusal copy').toContain(IMPORT_TIP_FAILURE_COPY);
  });

  it('a successful import selects the new texture on arrival', async () => {
    const arrivalTip: AquarelleTip = {
      id: 'wc/custom-arrival-fixture',
      category: 'custom',
      name: 'Arrival wash',
      ...NEUTRAL_TOOL_OVERRIDES,
    };
    importTipMock.mockResolvedValue({ ok: true, tip: arrivalTip });
    await pickFile(pickedFile('arrival.png'));
    expect(aquarelleSelectedTextureId.value, 'the arrival is the selection').toBe(arrivalTip.id);
    expect(watercolorBrushImportFailure.value, 'no failure copy').toBe(false);
    // The main-realm catalog push lists the row; this component never appends.
    expect(customBrushTips.value.length, 'no local catalog mutation').toBe(0);
  });

  it('greys each unavailable texture and renders NO aggregate warning line', () => {
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
      // The store still tracks the set — the chips are the only surface for it.
      expect(unavailableTipCount.value, 'the unavailable state still exists').toBe(3);
      const warnings = [...walk(tree)].filter(
        (n) => n.props?.['data-testid'] === 'watercolor-brush-unavailable-warning',
      );
      expect(warnings.length, '261116-inu: no standing warning line').toBe(0);
      const greyed = textureChipNodes(tree).filter(
        (chip) => chip.props?.['data-unavailable'] === 'true',
      );
      expect(greyed.length, 'one greyed texture chip per unavailable tip').toBe(3);
      for (const chip of greyed) {
        expect(chip.props?.['disabled'], 'greyed chip is unselectable').toBe(true);
      }
      // A response is never a project asset: no response card carries the
      // unavailable attribute at all.
      for (const card of cardNodes(tree)) {
        expect('data-unavailable' in (card.props ?? {}), 'response card is never greyed').toBe(
          false,
        );
      }
    } finally {
      replaceCustomBrushTips([]);
      replaceUnavailableTipIds([]);
    }
  });

  it('an unavailable texture cannot become the selected texture', () => {
    addCustomBrushTip({ ...CUSTOM_TIP, id: 'wc/custom-63-06-greyed' });
    replaceUnavailableTipIds(['wc/custom-63-06-greyed']);
    try {
      aquarelleSelectedTextureId.value = null;
      const chip = chipOf(renderLibrary(), 'wc/custom-63-06-greyed');
      expect(chip, 'greyed chip renders').toBeTruthy();
      (chip!.props as { onClick?: () => void }).onClick!();
      expect(aquarelleSelectedTextureId.value, 'the greyed texture is never selected').toBeNull();
    } finally {
      replaceCustomBrushTips([]);
      replaceUnavailableTipIds([]);
    }
  });

  it('describes the delivered surface in the module header', () => {
    const source = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8');
    expect(source, 'header names the two axes').toMatch(/two axes/i);
    expect(source, 'header names the texture row').toMatch(/texture row/i);
    expect(source, 'header names the shared strip').toMatch(/watercolorTextureStrip/i);
    expect(source, 'header states the import selects on arrival').toMatch(/selects on arrival/i);
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

// quick 261121-mtu (rev 2) — the artist's requirement: the response list is
// FILTERED by the active tool's brush family, not one flat catalog under
// every tool. Brush = every non-watercolor group; Watercolor = its own group;
// the utility tools expose the whole table (a pick there is a family pick).
describe('brush family filter per tool (quick 261121-mtu rev 2)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
  });

  function sectionIds(tree: TestVNode): Array<string | undefined> {
    return sectionNodes(tree).map(
      (node) => node.props?.['data-testid'] as string | undefined,
    );
  }

  function cardIds(tree: TestVNode): string[] {
    return cardNodes(tree)
      .map((node) => node.props?.['data-testid'])
      .filter((id): id is string => typeof id === 'string');
  }

  it('Watercolor renders the watercolor section alone', () => {
    aquarelleActiveTool.value = 'watercolor';
    const tree = renderLibrary();
    expect(sectionIds(tree)).toEqual(['watercolor-brush-section-watercolor']);
    expect(cardIds(tree)).toContain('watercolor-brush-card-round');
    expect(cardIds(tree)).not.toContain('watercolor-brush-card-bristle-round');
    expect(cardIds(tree), 'eleven watercolor cards').toHaveLength(11);
  });

  it('Brush renders the acrylic (Gouache) section and no watercolor card', () => {
    aquarelleActiveTool.value = 'brush';
    const tree = renderLibrary();
    expect(sectionIds(tree)).toEqual([
      'watercolor-brush-section-acrylic',
    ]);
    expect(cardIds(tree)).toContain('watercolor-brush-card-bristle-round');
    expect(cardIds(tree)).not.toContain('watercolor-brush-card-round');
    expect(cardIds(tree)).not.toContain('watercolor-brush-card-hake');
  });

  it('the utility tools keep every group reachable', () => {
    for (const tool of ['water', 'pen', 'lift'] as const) {
      aquarelleActiveTool.value = tool;
      const tree = renderLibrary();
      expect(sectionIds(tree), tool).toHaveLength(2);
      expect(cardIds(tree), tool).toContain('watercolor-brush-card-round');
      expect(cardIds(tree), tool).toContain('watercolor-brush-card-bristle-round');
    }
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
