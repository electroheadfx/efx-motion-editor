/**
 * 56-07 Task 3 — BrushesDocker contract pins (AQUA-03 UI, D-07).
 *
 * Laws pinned here:
 *   D-07   vertical category-grouped list with counts, toolbar, filter,
 *          search, footer (not a popover, not a horizontal strip)
 *   UI-SPEC empty search copy, import-failure inline line, missing-id row
 *   AQUA-03 partial: missing brush id renders a placeholder row
 *
 * Assertion style: scalar predicates. Render tests materialize the
 * vnode tree (no DOM environment).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  BrushesDocker,
  setBrushesDockerSearch,
  setBrushesDockerCategory,
  setBrushesDockerImportFailure,
  resetBrushesDockerUi,
} from './BrushesDocker';
import {
  selectAquarelleTip,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  recordAquarelleStroke,
} from './aquarelleRecordState';
import {
  setAquarelleSelectMode,
  setAquarelleSelectionEditPort,
} from './aquarelleStrokeSelection';
import {
  clearScriptStrokeSelection,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';
import type { ScriptStrokeAppearancePatch } from './strokeSettingsModel';

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

vi.mock('lucide-preact', () => {
  const Icon = (props: Record<string, unknown>) => ({
    type: 'span',
    props: { 'data-icon': true, ...props },
  });
  return {
    Plus: Icon,
    FolderOpen: Icon,
    Star: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    Search: Icon,
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

function renderDocker(props?: Record<string, unknown>): TestVNode {
  return materialize(BrushesDocker(props ?? {})) as TestVNode;
}

function tooltipOf(tree: TestVNode, title: string): boolean {
  for (const node of walk(tree)) {
    const t = node.props?.['title'] ?? node.props?.['data-tooltip'];
    if (String(t) === title) return true;
  }
  return false;
}

beforeEach(() => {
  resetBrushesDockerUi();
  aquarelleSelectedTipId.value = null;
});

describe('BrushesDocker categories (D-07)', () => {
  it('renders category groups with "{Category} — {n}" headers', () => {
    const tree = renderDocker();
    const text = textContent(tree);
    // The 14-tip pack ships 4 round / 3 flat / 4 texture / 3 experimental.
    expect(text).toContain('Round — 4');
    expect(text).toContain('Flat — 3');
    expect(text).toContain('Texture — 4');
    expect(text).toContain('Experimental — 3');
  });

  it('renders one row per tip with its name', () => {
    const tree = renderDocker();
    const text = textContent(tree);
    expect(text).toContain('Round small');
    expect(text).toContain('Flat wash');
    expect(text).toContain('Experimental bloom');
  });
});

describe('BrushesDocker search and filter (AQUA-03)', () => {
  it('empty search shows the UI-SPEC empty copy', () => {
    setBrushesDockerSearch('zzz-no-such-brush');
    const tree = renderDocker();
    const text = textContent(tree);
    expect(text).toContain('No brushes match');
    expect(text).toContain('Try another search term or choose All categories.');
  });

  it('category filter yields zero shows the same empty copy', () => {
    setBrushesDockerSearch('zzz-no-such-brush');
    setBrushesDockerCategory('custom');
    const tree = renderDocker();
    expect(textContent(tree)).toContain('No brushes match');
  });
});

describe('BrushesDocker import failure (UI-SPEC error row)', () => {
  it('shows the named inline line under the toolbar', () => {
    setBrushesDockerImportFailure(true);
    const tree = renderDocker();
    expect(textContent(tree)).toContain(
      'Import failed — this file is not a readable PNG or JPG. Nothing changed.',
    );
  });

  it('hides the line when there is no failure', () => {
    setBrushesDockerImportFailure(false);
    const tree = renderDocker();
    expect(textContent(tree)).not.toContain('Import failed');
  });
});

describe('BrushesDocker footer and toolbar (D-07)', () => {
  it('footer format is "{selectedBrushName} — {totalCount} brushes"', () => {
    selectAquarelleTip('wc/round-medium');
    const tree = renderDocker();
    expect(textContent(tree)).toContain('Round medium — 14 brushes');
  });

  it('toolbar Import tooltip is "Import brush tip (PNG/JPG)"', () => {
    const tree = renderDocker();
    expect(tooltipOf(tree, 'Import brush tip (PNG/JPG)')).toBe(true);
  });

  it('toolbar Add tooltip is "Add brush"', () => {
    const tree = renderDocker();
    expect(tooltipOf(tree, 'Add brush')).toBe(true);
  });

  it('search field placeholder is "Search brushes"', () => {
    const tree = renderDocker();
    let found = false;
    for (const node of walk(tree)) {
      if (node.props?.['placeholder'] === 'Search brushes') found = true;
    }
    expect(found).toBe(true);
  });
});

describe('BrushesDocker partial (AQUA-03)', () => {
  it('missing brush id renders "Missing brush — {id}"', () => {
    const tree = renderDocker({ missingTipIds: ['wc/gone-tip'] });
    expect(textContent(tree)).toContain('Missing brush — wc/gone-tip');
  });
});

// quick 261111-ucf — docker rows are pick surfaces: a row pick keeps
// the armed selection and commits the picked id + the post-pick bag
// through the paint-control seam. Id band 10661+.
describe('quick 261111-ucf docker row picks commit through the seam', () => {
  afterEach(() => {
    setAquarelleSelectionEditPort(null);
    setAquarelleSelectMode(false);
    clearScriptStrokeSelection();
  });

  it('a row pick keeps the armed selection and commits the picked id + live bag', () => {
    recordAquarelleStroke(10661, stroke10661([point10661(0.4, 0.5)]));
    const calls: Array<{ ids: readonly number[]; patch: ScriptStrokeAppearancePatch }> = [];
    const promise = Promise.resolve(true);
    setAquarelleSelectionEditPort({
      applyAppearance: (ids, patch) => {
        calls.push({ ids, patch });
        return promise;
      },
    });
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10661]);

    const tree = renderDocker();
    const row = [...walk(tree)].find(
      (n) => n.props?.['data-testid'] === 'brush-row-wc/round-medium',
    );
    expect(row, 'round-medium row must render').toBeTruthy();
    (row!.props as { onClick?: () => void }).onClick!();

    expect(aquarelleSelectedTipId.value, 'the live tip changed').toBe('wc/round-medium');
    expect(calls, 'exactly one port call').toHaveLength(1);
    expect(calls[0]!.patch.brushId).toBe('wc/round-medium');
    expect(calls[0]!.patch.toolOverrides).toEqual(aquarelleToolOverrides.peek());
  });

  it('source pin: the row and the import-success site are the two pick calls', () => {
    const source = stripComments(
      readFileSync(resolve(__dirname, 'BrushesDocker.tsx'), 'utf8'),
    );
    expect(source.split('pickAquarelleBrush(').length - 1, 'row + import success').toBe(2);
    const imports = source.match(/from '\.\/aquarellePaintControls'/g) ?? [];
    expect(imports, 'one paint-controls import').toHaveLength(1);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function point10661(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke10661(points: readonly AquarellePoint[]): AquarelleStroke {
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
