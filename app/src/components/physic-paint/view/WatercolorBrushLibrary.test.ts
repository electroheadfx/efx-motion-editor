/**
 * 261017-xa0 I-03 — Brush tab is the 14 playground brushes.
 *
 * Laws pinned here:
 *   14 cards, one per BRUSH_PRESETS entry, in catalog order, 2-column grid
 *   each card = 150x44 stroke thumb canvas + uppercase name + title tooltip
 *   testids: root watercolor-brush-library, cards watercolor-brush-card-${id}
 *   no category filter / search / import affordance / wc/ size-variant rows
 *   card pick -> selectAquarelleTip(presetId) -> selection + Brush tool
 *   stroke painter runs at most once per preset id (cache hit on remount)
 *   never canvas.toDataURL / toBlob (52.1 D-19)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRUSH_PRESETS, buildBrush } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleActiveTool,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  selectAquarelleTip,
  setAquarelleTool,
} from './aquarelleRecordState';
import {
  STROKE_THUMB_HEIGHT,
  STROKE_THUMB_WIDTH,
  clearStrokeThumbCache,
  getStrokeThumb,
  strokeThumbPainter,
} from './watercolorStrokeThumb';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';

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
      globalAlpha: 1,
    }),
    toDataURL: () => 'data:,',
  };
}

let originalDocument: typeof globalThis.document;
let createdCanvases: Array<Record<string, unknown>>;
let toDataUrlCalls: string[];

function resetSelection(): void {
  aquarelleSelectedTipId.value = null;
  aquarelleActiveTool.value = 'brush';
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
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

describe('WatercolorBrushLibrary 14-card grid (I-03)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    resetSelection();
  });

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument });
  });

  it('renders exactly 14 cards in BRUSH_PRESETS catalog order', () => {
    const tree = renderLibrary();
    const cards = cardNodes(tree);
    expect(cards.length).toBe(14);
    const walkedIds = cards.map((c) => String(c.props?.['data-testid']).replace('watercolor-brush-card-', ''));
    expect(walkedIds).toEqual(PRESET_IDS);
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
    const librarySource = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8');
    expect(librarySource, 'card canvas background is white').toContain("background: '#fff'");
    expect(librarySource, 'name is uppercase like the oracle label').toContain("textTransform: 'uppercase'");
  });

  it('has no category filter, search field, or import affordance', () => {
    const tree = renderLibrary();
    const inputs = [...walk(tree)].filter((n) => n.type === 'input');
    expect(inputs.length, 'no input elements').toBe(0);
    const buttons = [...walk(tree)].map((n) => textContent(n).trim());
    expect(buttons.some((t) => /import/i.test(t)), 'no import affordance').toBe(false);
    expect(buttons.some((t) => /^texture$/i.test(t)), 'no texture category row').toBe(false);
    expect(textContent(tree), 'no wc/ size-variant names').not.toMatch(/wc\//);
    const source = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8');
    expect(source, 'no search input in source').not.toMatch(/type="search"|type='search'|brushes-search/);
    expect(source, 'no file input in source').not.toMatch(/type="file"|type='file'/);
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
      expect(paintSpy.mock.calls.length, 'one paint per preset id across two mounts').toBe(14);
      expect(toDataUrlCalls, 'never toDataURL / toBlob').toEqual([]);
    } finally {
      paintSpy.mockRestore();
    }
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
