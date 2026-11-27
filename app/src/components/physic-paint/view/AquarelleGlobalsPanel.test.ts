/**
 * 261017-wmw I-02 — AquarelleGlobalsPanel contract pins.
 *
 * Laws pinned here (one file per visual unit):
 *   Phase 64 (D-01/D-07): the medium dropdown is the FIRST child row and names
 *   the selected medium; quick 261124-iq9: two items render in the fixed order
 *   (Watercolor, Gouache) — the acrylic record is DISPLAYED as Gouache
 *   quick 261122-gys: a dropdown pick binds a preset of the picked group —
 *   the in-group tip is kept, else the family's last pick, else the group's
 *   first (acrylic falls back to Bristle Round)
 *   quick 261121-mtu: the panel renders the six context groups from the ONE
 *   pure selector (`aquarelleParamVisibility.ts`, spec §8), driven by the
 *   active TOOL plus the selected MEDIUM. Default context (Brush + Watercolor)
 *   is ten rows in the order Viscosity, Emboss, Pigment, Pickup, Water,
 *   Dry speed, Flow, Bleed, Edges, Grain — decision B hides Refill for
 *   watercolor and Feather is bristle-only, so the Edge group drops. The
 *   old flat playground order is SUPERSEDED by the group order. Post-UAT
 *   2026-11-22: `body` rides the bag and the Reset law but has NO row — the
 *   compositor's alpha is max(pigment-darkness, cover), so Body only reads on
 *   near-white pigments. `wetSeconds` is a medium-record value with NO row.
 *   no Size control (top-bar owns it, Q1a) and no Hand row
 *   quick 261122-gys (supersedes quick 261121-mtu): Reset restores the ACTIVE
 *   MEDIUM RECORD's eighteen keys including `wetSeconds`, through
 *   setAquarelleParam and in ONE selection batch, and never writes size or
 *   lift. The ×100 playground DEFAULT_PARAMS law and the acrylic refill-0
 *   special case are retired — the acrylic 0 lives in its record.
 *   no Brush response chrome in this panel (I-02 puts it in BrushResponsePanel)
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MEDIUM_ID, mediumById } from '@efxlab/efx-watercolor';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  AQUARELLE_GLOBAL_KEYS,
  DEFAULT_AQUARELLE_PARAMS,
  aquarelleActiveTool,
  aquarelleLastBrushFamilyTipId,
  aquarelleLastTipByGroup,
  aquarelleMediumMenuAnchor,
  aquarelleMediumMenuOpen,
  aquarelleParams,
  aquarelleSelectedMediumId,
  aquarelleSelectedTipId,
  applyAquarelleMedium,
  recordAquarelleStroke,
  selectAquarelleTip,
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

/** One-line order assertion: a raw toEqual on arrays dumps a multi-line diff
 *  into the TAP diagnostic and breaks the RED evidence parser. */
function expectGlobalOrder(order: readonly string[]): void {
  expect(order.join('|'), 'the global labels in playground order').toBe(
    GLOBAL_LABELS.join('|'),
  );
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

/** quick 261121-mtu: the DEFAULT context (Brush tool + Watercolor medium)
 *  row order, from Matrix 2 / spec §8 — the old flat playground order is
 *  superseded by the group order. Decision B hides Refill for watercolor and
 *  Feather is bristle-only (so the Edge group drops entirely here).
 *  Post-UAT 2026-11-22: Body has NO row (kept in the bag and the Reset law). */
// Default context = Brush + Watercolor. rev 3: Pickup is the bristle
// carrier/gather smear only, so the fluid context hides it alongside Refill
// and Feather — nine rows.
// 2026-11-23: Emboss is gated off (hidden in every context until a new
// display renderer replaces the first-order heightmap shade), so the default
// context renders eight rows, not nine.
const GLOBAL_LABELS = [
  'Viscosity',
  'Pigment',
  'Water',
  'Dry speed',
  'Flow',
  'Bleed',
  'Edges',
  'Grain',
] as const;

/** Display names in the fixed MEDIUM_IDS order (quick 261124-iq9: the acrylic
 *  record is displayed as "Gouache"; the old gouache/pastel/graphite media are
 *  retired). */
const MEDIUM_NAMES = ['Watercolor', 'Gouache'] as const;

/** quick 261122-gys — Reset restores the ACTIVE MEDIUM RECORD (supersedes
 *  quick 261121-mtu's ×100 playground DEFAULT_PARAMS). This literal is the
 *  Watercolor record in the `mediums.ts` RECORD KEY ORDER: the batch is
 *  compared via JSON.stringify, which is order-sensitive. */
const RESET_EXPECTED = {
  water: 50,
  load: 50,
  flow: 50,
  bleed: 50,
  dry: 50,
  edge: 50,
  granulation: 50,
  viscosity: 0,
  // Post-UAT 2026-11-22: hidden row, still restored by Reset.
  body: 0,
  emboss: 0,
  feather: 0,
  // 261119-pod (D-A): the record opens Pickup at 100.
  pickup: 100,
  // Decision B hides the Refill row for watercolor, but the key still
  // resets — 60 comes from the Watercolor record itself.
  refill: 60,
  // quick 261122-gys: no row, but part of the record — Reset restores it.
  wetSeconds: 7,
  // Spec 10: the stroke layer's pair; Reset restores both from the record.
  edgeFade: 0,
  edgeFalloff: 50,
  // Spec 11: the brush-relative grain pair; Reset restores both from the
  // record (0 / 50 is the shipped neutral pair).
  featherNoise: 0,
  featherFalloff: 50,
} as const;

/** The Acrylic record, same key order — quick 261122-gys: Reset in the
 *  acrylic context restores it whole; Refill 0 comes from the record, with
 *  no acrylic special case in the Reset path. */
const ACRYLIC_RESET_EXPECTED = {
  water: 26,
  load: 100,
  flow: 60,
  bleed: 22,
  dry: 70,
  edge: 65,
  granulation: 25,
  viscosity: 90,
  body: 100,
  emboss: 3,
  feather: 85,
  pickup: 100,
  refill: 0,
  wetSeconds: 12,
  edgeFade: 0,
  edgeFalloff: 50,
  featherNoise: 0,
  featherFalloff: 50,
} as const;

beforeEach(() => {
  aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
  aquarelleSelectedMediumId.value = DEFAULT_MEDIUM_ID;
  // quick 261121-mtu: the panel's rows are (tool, medium)-driven; the default
  // context these suites describe is the Brush tool.
  aquarelleActiveTool.value = 'brush';
  aquarelleMediumMenuOpen.value = false;
  aquarelleMediumMenuAnchor.value = null;
  // quick 261122-gys: the dropdown binds a preset of the picked group, so the
  // tip and its session memory are part of this suite's fixture.
  aquarelleSelectedTipId.value = null;
  aquarelleLastTipByGroup.value = {};
  aquarelleLastBrushFamilyTipId.value = 'bristle-round';
});

function findTestId(tree: TestVNode, testId: string): TestVNode | undefined {
  return [...walk(tree)].find((node) => node.props?.['data-testid'] === testId);
}

describe('AquarelleGlobalsPanel sliders (I-02)', () => {
  it('renders the ten default-context global slider labels in group order', () => {
    const tree = renderPanel();
    const ordered = collectOrderedLabels(tree).filter((l) =>
      (GLOBAL_LABELS as readonly string[]).includes(l),
    );
    expectGlobalOrder(ordered);
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

  it('renders nothing but the 13 sliders + Reset (no response chrome)', () => {
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

  it('Reset restores the active medium record through setAquarelleParam and never writes size or lift', () => {
    setAquarelleParam('size', 77);
    setAquarelleParam('water', 1);
    setAquarelleParam('load', 2);
    setAquarelleParam('flow', 3);
    setAquarelleParam('bleed', 4);
    setAquarelleParam('edge', 5);
    setAquarelleParam('granulation', 6);
    setAquarelleParam('dry', 7);
    setAquarelleParam('viscosity', 55);
    setAquarelleParam('body', 55);
    setAquarelleParam('feather', 55);
    setAquarelleParam('pickup', 55);
    setAquarelleParam('refill', 55);
    setAquarelleParam('emboss', 55);
    setAquarelleParam('wetSeconds', 21);
    setAquarelleParam('edgeFade', 55);
    setAquarelleParam('edgeFalloff', 5);
    setAquarelleParam('featherNoise', 55);
    setAquarelleParam('featherFalloff', 5);
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
    expect(params.water, 'water → the watercolor record').toBe(RESET_EXPECTED.water);
    expect(params.load, 'load → the record').toBe(RESET_EXPECTED.load);
    expect(params.flow, 'flow → the record').toBe(RESET_EXPECTED.flow);
    expect(params.bleed, 'bleed → the record').toBe(RESET_EXPECTED.bleed);
    expect(params.edge, 'edge → the record').toBe(RESET_EXPECTED.edge);
    expect(params.granulation, 'granulation → the record').toBe(RESET_EXPECTED.granulation);
    expect(params.dry, 'dry → the record').toBe(RESET_EXPECTED.dry);
    expect(params.viscosity, 'viscosity → the record').toBe(RESET_EXPECTED.viscosity);
    expect(params.body, 'body → the record (hidden row)').toBe(RESET_EXPECTED.body);
    expect(params.feather, 'feather → the record').toBe(RESET_EXPECTED.feather);
    expect(params.pickup, 'pickup → the record').toBe(RESET_EXPECTED.pickup);
    // quick 261122-gys: the Refill ROW is hidden for watercolor, but the key
    // resets with the record — hidden is exposure, never storage.
    expect(params.refill, 'refill → 60 (the record, hidden row)').toBe(RESET_EXPECTED.refill);
    expect(params.emboss, 'emboss → the record').toBe(RESET_EXPECTED.emboss);
    // T-261017-WMW-01: Reset must never write size (top-bar Brush size owns it)
    // and never touches the eraser strength. quick 261122-gys: `wetSeconds`
    // has no row but IS part of the record — Reset restores it (7 here; the
    // retired ×100 law would have corrupted it to 2100).
    expect(params.size, 'size is untouched by Reset').toBe(77);
    expect(params.lift, 'lift is untouched by Reset').toBe(33);
    expect(params.wetSeconds, 'wetSeconds → the record value').toBe(RESET_EXPECTED.wetSeconds);
    expect(params.edgeFade, 'edgeFade → the record').toBe(RESET_EXPECTED.edgeFade);
    expect(params.edgeFalloff, 'edgeFalloff → the record').toBe(RESET_EXPECTED.edgeFalloff);
    expect(params.featherNoise, 'featherNoise → the record').toBe(RESET_EXPECTED.featherNoise);
    expect(params.featherFalloff, 'featherFalloff → the record').toBe(
      RESET_EXPECTED.featherFalloff,
    );
  });

  // 261119-pod (D-A): Pickup opens at 100 and Reset restores it. quick
  // 261122-gys: Reset is RECORD-driven — the Watercolor record states pickup
  // 100, the canonical value the reference declares (§6).
  it('opens Pickup at 100 and resets it to 100 (D-A)', () => {
    expect(DEFAULT_AQUARELLE_PARAMS.pickup).toBe(100);
    setAquarelleParam('pickup', 55);
    const tree = renderPanel();
    const reset = [...walk(tree)].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render').toBeTruthy();
    const onClick = (reset!.props as { onClick?: () => void }).onClick;
    expect(typeof onClick, 'Reset must be clickable').toBe('function');
    onClick!();
    expect(aquarelleParams.value.pickup, 'pickup → 100').toBe(100);
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

  it('renders the nine default-context rows below the dropdown in Matrix 2 order', () => {
    const tree = renderPanel();
    const sliders = [...walk(tree)].filter(
      (node) => node.props?.['data-testid'] === 'slider-stepper',
    );
    expect(sliders, 'eight row sliders for Brush + Watercolor').toHaveLength(GLOBAL_LABELS.length);
    expect(GLOBAL_LABELS).toHaveLength(8);
    const ordered = collectOrderedLabels(tree).filter((label) =>
      (GLOBAL_LABELS as readonly string[]).includes(label),
    );
    expectGlobalOrder(ordered);
    expect(ordered).toHaveLength(8);
    // quick 261121-mtu: decision B hides Refill for watercolor, rev 3 hides
    // Pickup (bristle-program-only), and Feather is bristle-only. None of the
    // three may appear in the default context.
    expect(ordered).not.toContain('Refill');
    expect(ordered).not.toContain('Pickup');
    expect(ordered).not.toContain('Feather');
    const index = (label: string) => ordered.indexOf(label);
    expect(index('Viscosity'), 'Viscosity leads the Medium group').toBe(0);
    // 2026-11-23: Emboss is gated off and does not render. The row keeps its
    // place in the table, so un-gating restores the downstream positions.
    expect(index('Emboss'), 'the gated Emboss row does not render').toBe(-1);
    expect(index('Pigment'), 'Pigment opens Paint & reservoir').toBe(1);
    expect(index('Water'), 'Water opens Drying').toBe(2);
    expect(index('Dry speed'), 'Dry speed follows Water').toBe(3);
    expect(index('Flow'), 'Flow opens Watercolor only').toBe(4);
    expect(index('Grain'), 'Grain closes the list').toBe(7);
  });

  it('renders the non-empty group headings in the fixed order', () => {
    const tree = renderPanel();
    const groups = [...walk(tree)].filter((node) => {
      const id = node.props?.['data-testid'];
      return typeof id === 'string' && id.startsWith('aquarelle-param-group-');
    });
    // Default context (Brush + Watercolor): the Edge group is EMPTY (Feather
    // is bristle-only, so the heading drops) and the Eraser group never
    // renders outside the Eraser.
    expect(groups.map((group) => group.props?.['data-testid']).join('|')).toBe(
      'aquarelle-param-group-medium|aquarelle-param-group-paint|aquarelle-param-group-drying|aquarelle-param-group-watercolor',
    );
    const headings = ['Medium', 'Paint & reservoir', 'Drying', 'Watercolor only'];
    const texts = groups.map((group) => textContent(group));
    for (let i = 0; i < headings.length; i += 1) {
      expect(texts[i]!.startsWith(headings[i]!), `heading ${headings[i]}`).toBe(true);
    }
  });

  it('renders no Body row: the key stays in the bag, the panel drops the row', () => {
    const tree = renderPanel();
    const labels = collectLabels(tree);
    expect(labels.some((label) => label === 'Body'), 'found a Body row').toBe(false);
    // The recorded key itself is untouched — the medium records and replay
    // still carry it.
    expect(AQUARELLE_GLOBAL_KEYS).toContain('body');
  });

  it('never renders a wetSeconds row: it is seconds, not a 0..100 global', () => {
    const tree = renderPanel();
    const labels = collectLabels(tree);
    expect(labels.some((label) => /wet/i.test(label)), 'found a wet row').toBe(false);
    const sliders = [...walk(tree)].filter(
      (node) => node.props?.['data-testid'] === 'slider-stepper',
    );
    const sliderLabels = sliders.map((node) => node.props?.['label']);
    expect(sliderLabels).not.toContain('wetSeconds');
    expect(sliderLabels).not.toContain('Wet seconds');
    expect(sliderLabels).not.toContain('Wet Seconds');
    // 2026-11-23: eight rows in the default context (Emboss gated), not twelve.
    expect(sliderLabels).toHaveLength(8);
  });

  it('moves the canonical viscosity key through the one seam on change and release', () => {
    // The RAW vnode tree keeps GlobalSlider's own props (materialize invokes
    // the function component), so the row's onChange/onCommit are reachable.
    const row = [...walk(AquarelleGlobalsPanel())].find(
      (node) => node.props?.['label'] === 'Viscosity' && typeof node.props?.['onChange'] === 'function',
    );
    expect(row, 'the Viscosity row must render').toBeTruthy();
    (row!.props['onChange'] as (value: number) => void)(42);
    expect(aquarelleParams.value.viscosity, 'Viscosity writes the canonical key').toBe(42);
    expect(typeof row!.props['onCommit'], 'the release path is wired like every row').toBe(
      'function',
    );
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
    expect(items, 'one item per medium').toHaveLength(2);
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
    // quick 261124-tje: the record is one spread assignment, the Gouache
    // brush bag (the dropdown lands bristle-round) a second.
    expect(writes, 'the record then the brush bag, two spread assignments').toBe(2);
    // D-25 retuned the acrylic record: water 26 (was 8 before the retune).
    expect(aquarelleParams.value.water, 'acrylic water').toBe(26);
    expect(aquarelleParams.value.body, 'acrylic body').toBe(100);
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

  // quick 261122-gys — the dropdown binds a preset of the picked group, so
  // the label, the panel rows and the brush can never disagree.
  // quick 261124-iq9: the Gouache medium is the acrylic record; its group has
  // exactly one member, so an acrylic pick always lands on bristle-round.
  it('a dropdown pick of Gouache selects Bristle Round and the acrylic record', () => {
    selectAquarelleTip('round');
    applyAquarelleMedium('watercolor');
    setAquarelleMediumMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-medium-item-acrylic');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleSelectedTipId.value, 'the acrylic landing brush').toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleParams.value.body).toBe(100);
    // quick 261124-tje: the Gouache bag lands LAST — feather 100 (not the
    // record's 85) and dry 0 (not the record's 70), size 40 px.
    expect(aquarelleParams.value.feather).toBe(100);
    expect(aquarelleParams.value.dry).toBe(0);
    expect(aquarelleParams.value.viscosity).toBe(90);
    expect(aquarelleParams.value.water).toBe(26);
    expect(aquarelleParams.value.wetSeconds).toBe(12);
  });

  it('a dropdown pick of Watercolor keeps an in-group tip (detail)', () => {
    selectAquarelleTip('detail');
    aquarelleSelectedMediumId.value = 'acrylic';
    setAquarelleMediumMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-medium-item-watercolor');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleSelectedTipId.value, 'the in-group tip is kept').toBe('detail');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('a first-ever dropdown pick of Watercolor lands on Round', () => {
    setAquarelleMediumMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-medium-item-watercolor');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleSelectedTipId.value, 'the watercolor family default').toBe('round');
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
    // quick 261122-gys: the dropdown binds a preset of the picked group AND
    // applies the record through the ONE store handler.
    expect(body).toContain('pickAquarelleMedium(medium.id);');
    expect(body, 'the panel never calls the record applier itself').not.toContain(
      'applyAquarelleMedium(',
    );
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
// Reset sends ONE batch after its live writes. quick 261122-gys: the batch is
// the active medium record's eighteen keys (wetSeconds, Spec 10's edge pair
// and Spec 11's grain pair included). Id band 10721+.
describe('quick 261111-ucf globals release commits + Reset batch', () => {
  afterEach(() => {
    setAquarelleSelectionEditPort(null);
    setAquarelleSelectMode(false);
    clearScriptStrokeSelection();
  });

  it('Reset commits ONE eighteen-key params patch after the eighteen live writes', () => {
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
    expect(calls[0]!.ids.join(','), 'the selected ids').toBe('10721');
    // One-line JSON comparison: a raw object toEqual dumps a multi-line diff
    // into the TAP diagnostic and breaks the RED evidence parser.
    expect(
      JSON.stringify(calls[0]!.patch),
      'the batch is the full eighteen-key record patch',
    ).toBe(JSON.stringify({ params: RESET_EXPECTED }));
    expect(Object.keys(calls[0]!.patch.params ?? {}), 'size is never committed').not.toContain('size');
    // quick 261121-mtu: Lift has a row (Eraser context) but Reset never
    // writes it — the eraser strength is not a global default.
    expect(Object.keys(calls[0]!.patch.params ?? {}), 'lift is never committed').not.toContain('lift');
  });

  it('Reset in the acrylic context restores the whole acrylic record (Refill 0 from the record)', () => {
    recordAquarelleStroke(10722, stroke10721([point10721(0.4, 0.4)]));
    const calls: Array<{ ids: readonly number[]; patch: ScriptStrokeAppearancePatch }> = [];
    setAquarelleSelectionEditPort({
      applyAppearance: (ids, patch) => {
        calls.push({ ids, patch });
        return Promise.resolve(true);
      },
    });
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10722]);
    applyAquarelleMedium('acrylic');
    setAquarelleParam('refill', 55);

    const tree = renderPanel();
    const reset = [...walk(tree)].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render').toBeTruthy();
    (reset!.props as { onClick?: () => void }).onClick!();

    // quick 261122-gys: supersedes quick 261121-mtu's acrylic refill special
    // case — the active record IS the acrylic record, Refill 0 included.
    expect(aquarelleParams.value.refill, 'live bag refill → the record').toBe(
      ACRYLIC_RESET_EXPECTED.refill,
    );
    expect(calls, 'one batch').toHaveLength(1);
    expect(
      JSON.stringify(calls[0]!.patch),
      'the batch carries the whole acrylic record',
    ).toBe(JSON.stringify({ params: ACRYLIC_RESET_EXPECTED }));
    // The five values the artist named in the report, stated literally.
    expect(aquarelleParams.value.body, 'body').toBe(100);
    expect(aquarelleParams.value.feather, 'feather').toBe(85);
    expect(aquarelleParams.value.viscosity, 'viscosity').toBe(90);
    expect(aquarelleParams.value.water, 'water').toBe(26);
    expect(aquarelleParams.value.wetSeconds, 'wetSeconds').toBe(12);
  });

  it("Reset under every medium restores that medium record's own Refill (active-record law)", () => {
    // quick 261124-iq9: exactly two records now — the old gouache/pastel/
    // graphite media are retired. Watercolor states Refill 60; the acrylic
    // (displayed Gouache) record states 0.
    for (const medium of ['watercolor', 'acrylic'] as const) {
      applyAquarelleMedium(medium);
      setAquarelleParam('refill', 55);
      const tree = renderPanel();
      const reset = [...walk(tree)].find(
        (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
      );
      expect(reset, `Reset control must render (${medium})`).toBeTruthy();
      (reset!.props as { onClick?: () => void }).onClick!();
      // quick 261122-gys: Reset spreads the ACTIVE medium record.
      expect(aquarelleParams.value.refill, `${medium} restores its record's refill`).toBe(
        mediumById(medium)!.params.refill,
      );
    }
    expect(mediumById('watercolor')!.params.refill, 'watercolor states 60').toBe(60);
    expect(mediumById('acrylic')!.params.refill, 'Gouache states 0').toBe(0);
  });

  // The artist's UAT row (quick 261122-gys): wetSeconds is restored from the
  // active record in both contexts — 7 (watercolor) / 12 (acrylic). The
  // retired ×100 DEFAULT_PARAMS law never touched it.
  it('Reset restores wetSeconds from the active record in both contexts', () => {
    setAquarelleParam('wetSeconds', 21);
    let reset = [...walk(renderPanel())].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render').toBeTruthy();
    (reset!.props as { onClick?: () => void }).onClick!();
    expect(aquarelleParams.value.wetSeconds, 'watercolor wetSeconds').toBe(
      RESET_EXPECTED.wetSeconds,
    );
    expect(aquarelleParams.value.wetSeconds, 'the watercolor record states 7').toBe(7);

    applyAquarelleMedium('acrylic');
    setAquarelleParam('wetSeconds', 21);
    reset = [...walk(renderPanel())].find(
      (n) => n.type === 'button' && n.props?.['data-testid'] === 'aquarelle-params-reset',
    );
    expect(reset, 'Reset control must render (acrylic)').toBeTruthy();
    (reset!.props as { onClick?: () => void }).onClick!();
    expect(aquarelleParams.value.wetSeconds, 'acrylic wetSeconds').toBe(
      ACRYLIC_RESET_EXPECTED.wetSeconds,
    );
    expect(aquarelleParams.value.wetSeconds, 'the acrylic record states 12').toBe(12);
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

// Quick 261123-hr5 (signed Emboss): negative emboss smooths a dry impasto and
// keeps the paint, so the row is -15..15 on the track, the typed-entry commit
// clamp and the readout, while every other global row keeps the 0..100 band.
// PARKED 2026-11-23: the Emboss row is hidden in every context while the
// display emboss is gated (see RELIEF_BUMP), so it does not render and these
// UI-level pins cannot run. The -15..15 band itself is still pinned on the ROW
// DATA in aquarelleParamVisibility.test.ts. Un-skip with the row.
describe.skip('quick 261123-hr5 signed emboss row band', () => {
  function sliderProps(label: string): { value: number; min: number; max: number } {
    const row = [...walk(AquarelleGlobalsPanel())].find(
      (node) => node.props?.['label'] === label && typeof node.props?.['onChange'] === 'function',
    );
    expect(row, `the ${label} row must render`).toBeTruthy();
    const group = (row!.type as (props: Record<string, unknown>) => unknown)(
      row!.props,
    ) as TestVNode;
    const slider = childrenOf(group)[0] as TestVNode;
    return slider.props as { value: number; min: number; max: number };
  }

  it('pins min -15 and max 15 on the Emboss row (both drag and typed commits)', () => {
    setAquarelleParam('emboss', -7);
    const props = sliderProps('Emboss');
    expect(props.min, 'the signed row floor').toBe(-15);
    expect(props.max, 'the row ceiling is 15').toBe(15);
    expect(props.value, 'an in-band negative value passes through').toBe(-7);
  });

  it('reads a legacy value outside the band as the nearest cap', () => {
    setAquarelleParam('emboss', 40);
    expect(sliderProps('Emboss').value, 'an out-of-band value reads as the ceiling').toBe(15);
    setAquarelleParam('emboss', -40);
    expect(sliderProps('Emboss').value, 'a negative out-of-band value reads as the floor').toBe(-15);
  });

  it('leaves every other global row on the 0..100 band', () => {
    const viscosity = sliderProps('Viscosity');
    expect(viscosity.min).toBe(0);
    expect(viscosity.max).toBe(100);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function point10721(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

// quick 261121-mtu (rev 2) — the panel FILTERS on the tool/medium context.
// These assert the RENDERED rows per context (the pure law has its own suite
// in aquarelleParamVisibility.test.ts); the artist's report was that both
// Watercolor and Acrylic still showed the whole parameter list.
describe('tool x medium context rows (quick 261121-mtu)', () => {
  function renderedSliders(): string[] {
    // The stepper's +/- buttons carry "Decrease X" / "Increase X" aria
    // labels; only the row labels themselves are under test here.
    return collectOrderedLabels(renderPanel()).filter(
      (label) => !/^(Decrease|Increase) /.test(label),
    );
  }

  it('Gouache (the acrylic record) shows its bristle rows only', () => {
    applyAquarelleMedium('acrylic');
    const labels = renderedSliders();
    // Spec 10: the two edge knobs join the bristle context, after Feather.
    expect(labels).toEqual([
      'Pigment',
      'Pickup',
      'Dry speed',
      'Feather',
      'Edge transparency',
      'Edge falloff',
    ]);
    // quick 261124-iq9: Viscosity and Water are hidden for the Gouache paint
    // context; Refill and every fluid-only row stay off the bristle path too.
    for (const absent of ['Viscosity', 'Refill', 'Water', 'Flow', 'Bleed', 'Edges', 'Grain']) {
      expect(labels.includes(absent), `${absent} is absent for Gouache`).toBe(false);
    }
  });

  it('Watercolor shows its eight rows with no Refill, Pickup or Feather', () => {
    applyAquarelleMedium('watercolor');
    const labels = renderedSliders();
    expect(labels).toEqual([
      'Viscosity',
      'Pigment',
      'Water',
      'Dry speed',
      'Flow',
      'Bleed',
      'Edges',
      'Grain',
    ]);
    expect(labels.includes('Refill'), 'Refill is absent for watercolor').toBe(false);
    // rev 3: Pickup is the bristle carrier+gather smear only — dead on the
    // fluid path, same evidence class as Refill.
    expect(labels.includes('Pickup'), 'Pickup is absent for watercolor').toBe(false);
    expect(labels.includes('Feather'), 'Feather is absent for watercolor').toBe(false);
  });

  it('the Eraser shows the Lift row alone and the Water tool its fluid set', () => {
    aquarelleActiveTool.value = 'lift';
    expect(renderedSliders()).toEqual(['Lift']);
    aquarelleActiveTool.value = 'water';
    expect(renderedSliders()).toEqual([
      'Viscosity',
      'Dry speed',
      'Flow',
      'Bleed',
      'Edges',
      'Grain',
    ]);
  });

  it('renders one group heading per non-empty group', () => {
    const tree = renderPanel();
    const headings = [...walk(tree)]
      .map((node) => node.props?.['data-testid'])
      .filter((id): id is string => typeof id === 'string' && id.startsWith('aquarelle-param-group-'));
    expect(headings).toEqual([
      'aquarelle-param-group-medium',
      'aquarelle-param-group-paint',
      'aquarelle-param-group-drying',
      'aquarelle-param-group-watercolor',
    ]);
  });
});

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
