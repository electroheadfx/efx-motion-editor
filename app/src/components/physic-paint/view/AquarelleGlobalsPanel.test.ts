/**
 * 261017-wmw I-02 — AquarelleGlobalsPanel contract pins.
 *
 * Laws pinned here (one file per visual unit):
 *   Phase 64 (D-01/D-07): the medium dropdown is the FIRST child row and names
 *   the selected medium; five items render in the fixed D-18 order
 *   (Watercolor, Gouache, Chalk, Graphite, Acrylic)
 *   9 sliders in playground order Water, Pigment, Flow, Bleed, Edges, Grain,
 *   Dry speed, Viscosity, Emboss (keys stay
 *   water/load/flow/bleed/edge/granulation/dry/viscosity/emboss; 64-06 inserts
 *   Body between Viscosity and Emboss)
 *   no Size control (top-bar owns it, Q1a) and no Hand row
 *   Reset writes playground DEFAULT_PARAMS ×100 for every non-size row via
 *   setAquarelleParam and never writes size or lift (T-261017-WMW-01)
 *   no Brush response chrome in this panel (I-02 puts it in BrushResponsePanel)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MEDIUM_ID } from '@efxlab/efx-watercolor';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  DEFAULT_AQUARELLE_PARAMS,
  aquarelleMediumMenuAnchor,
  aquarelleMediumMenuOpen,
  aquarelleParams,
  aquarelleSelectedMediumId,
  recordAquarelleStroke,
  setAquarelleMediumMenuOpen,
  setAquarelleParam,
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
import { AquarelleGlobalsPanel } from './AquarelleGlobalsPanel';

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

function renderPanel(): TestVNode {
  return materialize(AquarelleGlobalsPanel()) as TestVNode;
}

function collectLabels(tree: TestVNode): string[] {
  const labels: string[] = [];
  for (const node of walk(tree)) {
    const label = node.props?.['label'];
    if (typeof label === 'string') labels.push(label);
    const aria = node.props?.['ariaLabel'] ?? node.props?.['aria-label'];
    if (typeof aria === 'string') labels.push(aria);
  }
  return labels;
}

/** First-seen label names in walk order (playground order pin). */
function collectOrderedLabels(tree: TestVNode): string[] {
  const seen = new Set<string>();
  for (const node of walk(tree)) {
    const label = node.props?.['label'] ?? node.props?.['ariaLabel'] ?? node.props?.['aria-label'];
    if (typeof label === 'string' && !seen.has(label)) seen.add(label);
  }
  return [...seen];
}

/** I-01/I-02 playground order (SettingsPanel SLIDERS minus Size and Hand),
 *  with Phase 64's Viscosity and Emboss appended (64-04). */
const GLOBAL_LABELS = [
  'Water',
  'Pigment',
  'Flow',
  'Bleed',
  'Edges',
  'Grain',
  'Dry speed',
  'Viscosity',
  'Emboss',
] as const;

/** D-18 display names in the fixed MEDIUM_IDS order. `pastel` displays
 *  "Chalk" deliberately — the id is not the label. */
const MEDIUM_NAMES = ['Watercolor', 'Gouache', 'Chalk', 'Graphite', 'Acrylic'] as const;

/** Playground DEFAULT_PARAMS ×100 for the 9 non-size rows. */
const RESET_EXPECTED = {
  water: 60,
  load: 50,
  flow: 45,
  bleed: 50,
  edge: 50,
  granulation: 45,
  dry: 40,
  viscosity: 0,
  emboss: 0,
} as const;

beforeEach(() => {
  aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
  aquarelleSelectedMediumId.value = DEFAULT_MEDIUM_ID;
  aquarelleMediumMenuOpen.value = false;
  aquarelleMediumMenuAnchor.value = null;
});

function findTestId(tree: TestVNode, testId: string): TestVNode | undefined {
  return [...walk(tree)].find((node) => node.props?.['data-testid'] === testId);
}

describe('AquarelleGlobalsPanel sliders (I-02)', () => {
  it('renders the 9 named global slider labels in playground order', () => {
    const tree = renderPanel();
    const ordered = collectOrderedLabels(tree).filter((l) =>
      (GLOBAL_LABELS as readonly string[]).includes(l),
    );
    expect(ordered).toEqual([...GLOBAL_LABELS]);
    const labels = collectLabels(tree);
    for (const name of GLOBAL_LABELS) {
      expect(labels.some((l) => l === name), `missing global label ${name}`).toBe(true);
    }
  });

  it('never renders a local size/scale control or a Hand row', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    const labels = collectLabels(tree);
    expect(labels.some((l) => /^size$/i.test(l)), 'found a Size label').toBe(false);
    expect(labels.some((l) => /^scale$/i.test(l)), 'found a Scale label').toBe(false);
    expect(labels.some((l) => /^hand$/i.test(l)), 'found a Hand label').toBe(false);
    expect(/\bsize\b/i.test(text), 'found size text in panel').toBe(false);
  });

  it('renders nothing but the 9 sliders + Reset (no response chrome)', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    expect(text).not.toContain('Brush response');
    expect(text).not.toContain('Select a brush to edit response');
    const labels = collectLabels(tree);
    expect(labels.some((l) => l === 'Tip'), 'Tip multiplier leaked in').toBe(false);
  });
});

describe('AquarelleGlobalsPanel Reset (I-02 / T-261017-WMW-01)', () => {
  it('renders a Reset control after the sliders', () => {
    const tree = renderPanel();
    const buttons = [...walk(tree)].filter((n) => n.type === 'button');
    const reset = buttons.find((b) => b.props?.['data-testid'] === 'aquarelle-params-reset');
    expect(reset, 'Reset control must render').toBeTruthy();
    expect(textContent(reset).trim()).toBe('Reset');
  });

  it('Reset writes the ×100 playground defaults through setAquarelleParam and never writes size or lift', () => {
    setAquarelleParam('size', 77);
    setAquarelleParam('water', 1);
    setAquarelleParam('load', 2);
    setAquarelleParam('flow', 3);
    setAquarelleParam('bleed', 4);
    setAquarelleParam('edge', 5);
    setAquarelleParam('granulation', 6);
    setAquarelleParam('dry', 7);
    setAquarelleParam('viscosity', 55);
    setAquarelleParam('emboss', 55);
    setAquarelleParam('lift', 33);

    const tree = renderPanel();
    const reset = [...walk(tree)].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render').toBeTruthy();
    const onClick = (reset!.props as { onClick?: () => void }).onClick;
    expect(typeof onClick, 'Reset must be clickable').toBe('function');
    onClick!();

    const params = aquarelleParams.value;
    expect(params.water, 'water → 60').toBe(RESET_EXPECTED.water);
    expect(params.load, 'load → 50').toBe(RESET_EXPECTED.load);
    expect(params.flow, 'flow → 45').toBe(RESET_EXPECTED.flow);
    expect(params.bleed, 'bleed → 50').toBe(RESET_EXPECTED.bleed);
    expect(params.edge, 'edge → 50').toBe(RESET_EXPECTED.edge);
    expect(params.granulation, 'granulation → 45').toBe(RESET_EXPECTED.granulation);
    expect(params.dry, 'dry → 40').toBe(RESET_EXPECTED.dry);
    expect(params.viscosity, 'viscosity → 0').toBe(RESET_EXPECTED.viscosity);
    expect(params.emboss, 'emboss → 0').toBe(RESET_EXPECTED.emboss);
    // T-261017-WMW-01: Reset must never write size (top-bar Brush size owns it)
    // and never touches the eraser strength.
    expect(params.size, 'size is untouched by Reset').toBe(77);
    expect(params.lift, 'lift is untouched by Reset').toBe(33);
  });
});

// Phase 64 (D-01/D-03/D-07) — the medium dropdown leads the Paint tab.
describe('Phase 64 medium dropdown', () => {
  it('leads the panel with the dropdown row and names the selected medium', () => {
    const tree = renderPanel();
    const root = findTestId(tree, 'aquarelle-globals-panel');
    expect(root, 'panel root must render').toBeTruthy();
    const firstChild = childrenOf(root!)[0] as TestVNode | undefined;
    expect(firstChild?.props?.['data-testid'], 'the medium row is first').toBe(
      'aquarelle-medium-row',
    );
    const trigger = findTestId(tree, 'aquarelle-medium-trigger');
    expect(trigger, 'the trigger must render').toBeTruthy();
    const text = textContent(trigger);
    expect(text, 'the row names the control').toContain('Medium');
    expect(text, 'the row names the selected medium').toContain('Watercolor');
  });

  it('renders nine slider rows below the dropdown, Emboss last', () => {
    const tree = renderPanel();
    const sliders = [...walk(tree)].filter(
      (node) => node.props?.['data-testid'] === 'slider-stepper',
    );
    expect(sliders, 'nine slider rows at this wave').toHaveLength(GLOBAL_LABELS.length);
    const ordered = collectOrderedLabels(tree).filter((label) =>
      (GLOBAL_LABELS as readonly string[]).includes(label),
    );
    expect(ordered).toEqual([...GLOBAL_LABELS]);
    expect(ordered[ordered.length - 1]).toBe('Emboss');
  });

  it('renders no menu until the popover state opens', () => {
    expect(findTestId(renderPanel(), 'aquarelle-medium-menu')).toBeUndefined();
  });

  it('lists the five D-18 names in the fixed order and marks the selection', () => {
    setAquarelleMediumMenuOpen(true, { left: 20, top: 200 });
    const tree = renderPanel();
    const menu = findTestId(tree, 'aquarelle-medium-menu');
    expect(menu, 'an open popover must render').toBeTruthy();
    expect(menu!.props?.['role']).toBe('menu');
    expect(menu!.props?.['aria-label']).toBe('Medium');
    const items = [...walk(menu!)].filter((node) => {
      const id = node.props?.['data-testid'];
      return typeof id === 'string' && id.startsWith('aquarelle-medium-item-');
    });
    expect(items, 'one item per medium').toHaveLength(5);
    expect(items.map((item) => textContent(item).trim())).toEqual([...MEDIUM_NAMES]);
    expect(items[0]!.props?.['aria-checked'], 'Watercolor is selected').toBe(true);
    expect(items[1]!.props?.['aria-checked'], 'Gouache is not').toBe(false);
    const active = items.filter((item) => String(item.props?.['class'] ?? '').includes('active'));
    expect(active, 'exactly one active row').toHaveLength(1);
  });

  it('opens from the trigger with the row anchor and closes on a second press', () => {
    const trigger = findTestId(renderPanel(), 'aquarelle-medium-trigger');
    expect(trigger, 'the trigger must render').toBeTruthy();
    (trigger!.props?.['onClick'] as (event: unknown) => void)({
      currentTarget: { getBoundingClientRect: () => ({ left: 24, bottom: 96 }) },
    });
    expect(aquarelleMediumMenuOpen.value).toBe(true);
    expect(aquarelleMediumMenuAnchor.value).toEqual({ left: 24, top: 102 });
    const reopened = findTestId(renderPanel(), 'aquarelle-medium-trigger');
    (reopened!.props?.['onClick'] as (event?: unknown) => void)();
    expect(aquarelleMediumMenuOpen.value).toBe(false);
  });

  it('applies the picked record in one bag write and closes the menu', () => {
    setAquarelleMediumMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-medium-item-acrylic');
    expect(item, 'the acrylic item must render').toBeTruthy();
    let writes = 0;
    const stop = aquarelleParams.subscribe(() => {
      writes += 1;
    });
    writes = 0;
    (item!.props?.['onClick'] as () => void)();
    stop();
    expect(writes, 'one spread assignment, not a per-key cascade').toBe(1);
    expect(aquarelleParams.value.water, 'acrylic water').toBe(8);
    expect(aquarelleParams.value.body, 'acrylic body').toBe(90);
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleMediumMenuOpen.value).toBe(false);
  });

  it('re-picking the selected medium restores a drifted neutral record', () => {
    setAquarelleParam('water', 91);
    setAquarelleMediumMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-medium-item-watercolor');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleParams.value.water, 'the neutral record land back').toBe(50);
    expect(aquarelleParams.value.load).toBe(50);
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('draws no edited marker after a manual global tweak', () => {
    setAquarelleParam('water', 91);
    expect(/\bedited\b/i.test(textContent(renderPanel())), 'no edited marker').toBe(false);
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('source pins: captured close listeners, Escape, signals only', () => {
    const body = stripComments(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'AquarelleGlobalsPanel.tsx'), 'utf8'),
    );
    expect(body).toContain("window.addEventListener('pointerdown', onPointerDown, true);");
    expect(body).toContain("window.addEventListener('keydown', onKeyDown, true);");
    expect(body).toContain("window.removeEventListener('pointerdown', onPointerDown, true);");
    expect(body).toContain("window.removeEventListener('keydown', onKeyDown, true);");
    expect(body).toContain("event.key !== 'Escape'");
    expect(body).toContain('event.preventDefault();');
    expect(body).toContain('event.stopPropagation();');
    expect(body).toContain('}, [menuOpen]);');
    expect(body, 'signals only — never useState').not.toContain('useState');
    expect(body).toContain('data-aquarelle-medium-trigger');
    expect(body).toContain('applyAquarelleMedium(medium.id);');
    expect(body.split('MEDIUMS.map(').length - 1, 'one item list').toBe(1);
    expect(body).toContain('role="menuitemradio"');
    expect(body).toContain('aria-checked={active}');
    expect(body).toContain('data-testid="aquarelle-medium-menu"');
  });
});

// 261018-gqo move 2: vertical breathing room — the shared option-group gap
// stacks the rows, and RuleSectionHeader carries the section margin.
describe('261018-gqo spacing rhythm', () => {
  it('globals panel rides the shared option-group row gap', () => {
    const tree = renderPanel() as TestVNode;
    const root = [...walk(tree)].find((n) => n.props?.['data-testid'] === 'aquarelle-globals-panel');
    expect(root, 'panel root must render').toBeTruthy();
    expect(String(root!.props?.['class'] ?? ''), 'option-group class owns the row gap').toBe(
      'physics-paint-option-group',
    );
  });

  it('CSS gives rule headers margin and module sections the UAT 15px row gap', () => {
    // 261018-gqo locked 10px; 261018-ias AREA 2 item 4 overrides to 15px.
    const styles = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'),
      'utf8',
    );
    expect(styles).toContain('.rule-section-header {');
    expect(styles).toMatch(/\.rule-section-header\s*\{[^}]*margin:\s*12px 0 8px/);
    expect(styles).toMatch(/\.physics-paint-module-section\s*\{[^}]*gap:\s*15px/);
  });
});

// quick 261111-ucf — each global row commits at its release boundary and
// Reset sends ONE nine-key batch after its nine live writes. Id band
// 10721+.
describe('quick 261111-ucf globals release commits + Reset batch', () => {
  afterEach(() => {
    setAquarelleSelectionEditPort(null);
    setAquarelleSelectMode(false);
    clearScriptStrokeSelection();
  });

  it('Reset commits ONE nine-key params patch after the nine live writes', () => {
    recordAquarelleStroke(10721, stroke10721([point10721(0.5, 0.5)]));
    const calls: Array<{ ids: readonly number[]; patch: ScriptStrokeAppearancePatch }> = [];
    const promise = Promise.resolve(true);
    setAquarelleSelectionEditPort({
      applyAppearance: (ids, patch) => {
        calls.push({ ids, patch });
        return promise;
      },
    });
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10721]);

    const tree = renderPanel();
    const reset = [...walk(tree)].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render').toBeTruthy();
    (reset!.props as { onClick?: () => void }).onClick!();

    expect(calls, 'the batch is ONE call').toHaveLength(1);
    expect(calls[0]!.ids).toEqual([10721]);
    expect(calls[0]!.patch).toEqual({ params: RESET_EXPECTED });
    expect(Object.keys(calls[0]!.patch.params ?? {}), 'size is never committed').not.toContain('size');
  });

  it('source pins: the GlobalSlider passthrough and the ONE Reset batch', () => {
    const body = stripComments(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'AquarelleGlobalsPanel.tsx'), 'utf8'),
    );
    expect(body.split('onCommit={props.onCommit}').length - 1, 'one GlobalSlider passthrough').toBe(1);
    expect(
      body.split('commitAquarelleSelectionParam(key, value)').length - 1,
      'one per-row release commit',
    ).toBe(1);
    expect(
      body.split('commitAquarelleSelectionParams(next)').length - 1,
      'one Reset batch',
    ).toBe(1);
    const imports = body.match(/from '\.\/aquarellePaintControls'/g) ?? [];
    expect(imports, 'one paint-controls import').toHaveLength(1);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function point10721(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke10721(points: readonly AquarellePoint[]): AquarelleStroke {
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
