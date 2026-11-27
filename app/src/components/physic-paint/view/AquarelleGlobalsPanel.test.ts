/**
 * 261017-wmw I-02 — AquarelleGlobalsPanel contract pins.
 *
 * Laws pinned here (one file per visual unit):
 *   Phase 64 (D-01/D-07): the Tool dropdown is the FIRST child row and names
 *   the ACTIVE TOOL; 2026-11-27 (artist's live ruling): it lists the five
 *   tools (Medium, Watercolor, Water, Pen, Eraser) with ONE label, replacing
 *   the old "Medium … Medium" medium row. Below it, the Brush response
 *   dropdown lists the presets the active paint tool exposes — and it is
 *   absent for Water / Pen / Eraser, which own no family
 *   quick 261122-gys: a paint-tool pick binds a preset of the tool's family —
 *   the in-group tip is kept, else the family's last pick, else the group's
 *   first (Medium falls back to Bristle Round)
 *   quick 261121-mtu: the panel renders the six context groups from the ONE
 *   pure selector (`aquarelleParamVisibility.ts`, spec §8), driven by the
 *   active TOOL plus the selected MEDIUM. Default context (Brush + Watercolor)
 *   is seven rows in the order Viscosity, Pigment, Water, Dry speed, Flow,
 *   Bleed, Edges — decision B hides Refill for watercolor, Pickup and
 *   Feather are bristle-only, and the Grain control is a fixed Paint-tab row.
 *   2026-11-27: Emboss is the Medium (acrylic) context's trailing Relief row —
 *   the watercolor context never renders it.
 *   The old flat playground order is SUPERSEDED by the group order. Post-UAT
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
  aquarelleParams,
  aquarelleResponseMenuAnchor,
  aquarelleResponseMenuOpen,
  aquarelleSelectedMediumId,
  aquarelleSelectedTipId,
  aquarelleToolMenuAnchor,
  aquarelleToolMenuOpen,
  applyAquarelleMedium,
  recordAquarelleStroke,
  selectAquarelleTip,
  setAquarelleParam,
  setAquarelleResponseMenuOpen,
  setAquarelleToolMenuOpen,
} from './aquarelleRecordState';
import { aquarelleHasWetPaint } from './aquarelleWetPaintGate';
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
// and Feather. 2026-11-27 (artist's live ruling): the Grain control is the
// fixed Paint-tab top row and Emboss is Medium-only, so the watercolor
// context renders seven group rows.
const GLOBAL_LABELS = [
  'Viscosity',
  'Pigment',
  'Water',
  'Dry speed',
  'Flow',
  'Bleed',
  'Edges',
] as const;

/** Display names in the fixed MEDIUM_IDS order (quick 261124-iq9: the acrylic
 *  record is displayed as "Gouache"; the old gouache/pastel/graphite media are
 *  retired). */
/** 2026-11-27: the Tool dropdown's five names, row order (AquarelleToolRow). */
const TOOL_NAMES = ['Medium', 'Watercolor', 'Water', 'Pen', 'Eraser'] as const;
const TOOL_IDS = ['brush', 'watercolor', 'water', 'pen', 'lift'] as const;
/** The Medium tool's family, in shipped table order. */
const MEDIUM_RESPONSE_NAMES = ['Gouache Round', 'Pen 1B'] as const;

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
  // Spec 11 re-index (2026-11-27k): Reset restores the pair from the record
  // (20 / 50 is the shipped base look).
  featherNoise: 20,
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
  // 2026-11-27 (artist's live ruling): the Medium record defaults Emboss to 0.
  emboss: 0,
  feather: 85,
  pickup: 100,
  refill: 0,
  wetSeconds: 12,
  edgeFade: 0,
  edgeFalloff: 50,
  featherNoise: 20,
  featherFalloff: 50,
} as const;

beforeEach(() => {
  aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
  aquarelleSelectedMediumId.value = DEFAULT_MEDIUM_ID;
  // quick 261121-mtu: the panel's rows are (tool, medium)-driven; the default
  // context these suites describe is the Brush tool.
  aquarelleActiveTool.value = 'brush';
  aquarelleHasWetPaint.value = true;
  aquarelleToolMenuOpen.value = false;
  aquarelleToolMenuAnchor.value = null;
  aquarelleResponseMenuOpen.value = false;
  aquarelleResponseMenuAnchor.value = null;
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

  it('renders the Tool and Brush response rows, with no Tip multiplier chrome', () => {
    const tree = renderPanel();
    const text = textContent(tree);
    // 2026-11-27: the panel now owns the response picker; the retired
    // BrushResponsePanel instruction never comes back.
    expect(text, 'the response row renders').toContain('Brush response');
    expect(text).not.toContain('Select a brush to edit response');
    const labels = collectLabels(tree);
    expect(labels.some((l) => l === 'Tip'), 'Tip multiplier leaked in').toBe(false);
  });
});

describe('AquarelleGlobalsPanel Reset (I-02 / T-261017-WMW-01)', () => {
  it('renders a Reset control first, above the Tool dropdown', () => {
    const tree = renderPanel();
    const buttons = [...walk(tree)].filter((n) => n.type === 'button');
    const reset = buttons.find((b) => b.props?.['data-testid'] === 'aquarelle-params-reset');
    expect(reset, 'Reset control must render').toBeTruthy();
    expect(textContent(reset).trim()).toBe('Reset');
    expect(
      textContent(tree).indexOf('Reset'),
      'Reset leads the tab content',
    ).toBeLessThan(textContent(tree).indexOf('Viscosity'));
    expect(
      textContent(tree).indexOf('Reset'),
      'Reset precedes the dropdown',
    ).toBeLessThan(textContent(tree).indexOf('Medium'));
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
describe('Phase 64 tool + response dropdowns', () => {
  it('leads the panel with Reset, then the Tool row, then the Brush response row', () => {
    const tree = renderPanel();
    const root = findTestId(tree, 'aquarelle-globals-panel');
    expect(root, 'panel root must render').toBeTruthy();
    // 2026-11-27 (artist's live ruling): Reset opens the tab; the Tool row
    // follows it, and the Brush response row sits under the Tool row.
    const children = childrenOf(root!) as TestVNode[];
    expect(children[0]?.props?.['data-testid'], 'Reset is first').toBe(
      'aquarelle-params-reset',
    );
    expect(children[1]?.props?.['data-testid'], 'the Tool row follows').toBe(
      'aquarelle-tool-row',
    );
    const trigger = findTestId(tree, 'aquarelle-tool-trigger');
    expect(trigger, 'the trigger must render').toBeTruthy();
    const text = textContent(trigger);
    expect(text, 'the row names the control').toContain('Tool');
    expect(text, 'the row names the active tool').toContain('Medium');
    // The old "Medium … Medium" duplicate is retired: the value appears once.
    expect((text.match(/Medium/g) ?? []), 'no duplicated value label').toHaveLength(1);
    const responseTrigger = findTestId(tree, 'aquarelle-response-trigger');
    expect(responseTrigger, 'the response row must render').toBeTruthy();
    expect(textContent(responseTrigger), 'the response row names the brush').toContain(
      'Gouache Round',
    );
    const renderedRows = children.filter(
      (child): child is TestVNode => typeof child === 'object' && child !== null,
    );
    const responseRowIndex = renderedRows.findIndex(
      (child) => child.props?.['data-testid'] === 'aquarelle-response-row',
    );
    expect(responseRowIndex, 'the response row sits right under the Tool row').toBe(2);
  });

  it('renders the seven default-context rows below the dropdown in Matrix 2 order', () => {
    const tree = renderPanel();
    const sliders = [...walk(tree)].filter(
      (node) => node.props?.['data-testid'] === 'slider-stepper',
    );
    // Seven context rows + the tab's fixed Grain row.
    expect(sliders, 'the seven group rows plus Grain').toHaveLength(GLOBAL_LABELS.length + 1);
    expect(GLOBAL_LABELS).toHaveLength(7);
    const ordered = collectOrderedLabels(tree).filter((label) =>
      (GLOBAL_LABELS as readonly string[]).includes(label),
    );
    expectGlobalOrder(ordered);
    expect(ordered).toHaveLength(7);
    // quick 261121-mtu: decision B hides Refill for watercolor, rev 3 hides
    // Pickup (bristle-program-only), and Feather is bristle-only. None of the
    // three may appear in the default context.
    expect(ordered).not.toContain('Refill');
    expect(ordered).not.toContain('Pickup');
    expect(ordered).not.toContain('Feather');
    const index = (label: string) => ordered.indexOf(label);
    expect(index('Viscosity'), 'Viscosity leads the Medium group').toBe(0);
    expect(index('Pigment'), 'Pigment opens Paint & reservoir').toBe(1);
    expect(index('Water'), 'Water opens Drying').toBe(2);
    expect(index('Dry speed'), 'Dry speed follows Water').toBe(3);
    expect(index('Flow'), 'Flow opens Watercolor only').toBe(4);
    expect(ordered).not.toContain('Emboss');
  });

  it('renders the non-empty group headings in the fixed order', () => {
    const tree = renderPanel();
    const groups = [...walk(tree)].filter((node) => {
      const id = node.props?.['data-testid'];
      return typeof id === 'string' && id.startsWith('aquarelle-param-group-');
    });
    // Default context (Brush + Watercolor): the Noise group is EMPTY (Feather
    // and the noise pair are bristle-only, so the heading drops) and the
    // Eraser group never renders outside the Eraser.
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
    // 2026-11-27: seven group rows + the fixed Grain row in the default context.
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

  // 2026-11-27 (artist's live ruling): the slider is OPACITY — 100 = opaque,
  // the default — while the canonical `edgeFade` key keeps the shipped
  // TRANSPARENCY semantics (0 = opaque), so existing strokes and their replay
  // are untouched. The row inverts for display and maps back on change.
  it('renders the Opacity row inverted and stores transparency on change', () => {
    applyAquarelleMedium('acrylic');
    // The raw tree keeps GlobalSlider's props (the stored value and the row's
    // own callbacks); invoking the component yields the SliderStepper vnode
    // with the DISPLAYED value and the inverted callbacks.
    const slider = (): TestVNode => {
      const row = [...walk(AquarelleGlobalsPanel())].find(
        (node) =>
          node.props?.['label'] === 'Opacity' && typeof node.props?.['onChange'] === 'function',
      );
      expect(row, 'the Opacity row must render').toBeTruthy();
      const group = (row!.type as (props: Record<string, unknown>) => unknown)(
        row!.props,
      ) as TestVNode;
      return childrenOf(group)[0] as TestVNode;
    };
    expect(aquarelleParams.value.edgeFade, 'the record default is transparency 0').toBe(0);
    expect(slider().props['value'], 'the default displays as opacity 100').toBe(100);
    (slider().props['onChange'] as (value: number) => void)(25);
    expect(aquarelleParams.value.edgeFade, 'opacity 25 stores transparency 75').toBe(75);
    expect(slider().props['value'], 'the slider now reads opacity 25').toBe(25);
    // The release path rides the same toStored wrapper (it commits the
    // selection, not the param store, so its effect is observed elsewhere).
    expect(typeof slider().props['onCommit'], 'the inverted release path is wired').toBe(
      'function',
    );
  });

  it('renders no menu until the popover state opens', () => {
    const tree = renderPanel();
    expect(findTestId(tree, 'aquarelle-tool-menu')).toBeUndefined();
    expect(findTestId(tree, 'aquarelle-response-menu')).toBeUndefined();
  });

  it('lists the five tools in row order and marks the active one', () => {
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const tree = renderPanel();
    const menu = findTestId(tree, 'aquarelle-tool-menu');
    expect(menu, 'an open popover must render').toBeTruthy();
    expect(menu!.props?.['role']).toBe('menu');
    expect(menu!.props?.['aria-label']).toBe('Tool');
    const items = [...walk(menu!)].filter((node) => {
      const id = node.props?.['data-testid'];
      return typeof id === 'string' && id.startsWith('aquarelle-tool-item-');
    });
    expect(items, 'one item per tool').toHaveLength(TOOL_NAMES.length);
    expect(items.map((item) => textContent(item).trim())).toEqual([...TOOL_NAMES]);
    expect(
      items.map((item) =>
        String(item.props?.['data-testid']).replace('aquarelle-tool-item-', ''),
      ),
      'the ids follow the row order',
    ).toEqual([...TOOL_IDS]);
    expect(items.map((item) => item.props?.['aria-checked'])).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    const active = items.filter((item) => String(item.props?.['class'] ?? '').includes('active'));
    expect(active, 'exactly one active row').toHaveLength(1);
  });

  it('opens from the trigger with the row anchor and closes on a second press', () => {
    const trigger = findTestId(renderPanel(), 'aquarelle-tool-trigger');
    expect(trigger, 'the trigger must render').toBeTruthy();
    (trigger!.props?.['onClick'] as (event: unknown) => void)({
      currentTarget: { getBoundingClientRect: () => ({ left: 24, bottom: 96 }) },
    });
    expect(aquarelleToolMenuOpen.value).toBe(true);
    expect(aquarelleToolMenuAnchor.value).toEqual({ left: 24, top: 102 });
    const reopened = findTestId(renderPanel(), 'aquarelle-tool-trigger');
    (reopened!.props?.['onClick'] as (event?: unknown) => void)();
    expect(aquarelleToolMenuOpen.value).toBe(false);
  });

  it('picking Medium applies the acrylic record and closes the menu', () => {
    aquarelleActiveTool.value = 'watercolor';
    aquarelleSelectedMediumId.value = 'watercolor';
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-tool-item-brush');
    expect(item, 'the Medium item must render').toBeTruthy();
    (item!.props?.['onClick'] as () => void)();
    // D-25 retuned the acrylic record: water 26 (was 8 before the retune).
    expect(aquarelleParams.value.water, 'acrylic water').toBe(26);
    expect(aquarelleParams.value.body, 'acrylic body').toBe(100);
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleToolMenuOpen.value).toBe(false);
  });

  it('re-picking the active Medium tool restores a drifted record', () => {
    // The seam writes nothing here (same tool, same group, agreeing label);
    // the restore is the pick law quick 261122-gys still guarantees.
    aquarelleSelectedMediumId.value = 'acrylic';
    aquarelleSelectedTipId.value = 'bristle-round';
    setAquarelleParam('water', 91);
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-tool-item-brush');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleParams.value.water, 'the acrylic record lands back').toBe(26);
    expect(aquarelleParams.value.load).toBe(100);
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
  });

  // quick 261122-gys — a paint-tool pick binds a preset of the tool's family,
  // so the label, the panel rows and the brush can never disagree.
  it('a pick of Medium selects Gouache Round and the acrylic record', () => {
    aquarelleActiveTool.value = 'watercolor';
    aquarelleSelectedMediumId.value = 'watercolor';
    selectAquarelleTip('round');
    applyAquarelleMedium('watercolor');
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-tool-item-brush');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleSelectedTipId.value, 'the Medium landing brush').toBe('bristle-round');
    expect(aquarelleSelectedMediumId.value).toBe('acrylic');
    expect(aquarelleParams.value.body).toBe(100);
    // quick 261124-tje: the Medium bag lands LAST — feather 100 (not the
    // record's 85) and dry 0 (not the record's 70), size 40 px.
    expect(aquarelleParams.value.feather).toBe(100);
    expect(aquarelleParams.value.dry).toBe(0);
    expect(aquarelleParams.value.viscosity).toBe(90);
    expect(aquarelleParams.value.water).toBe(26);
    expect(aquarelleParams.value.wetSeconds).toBe(12);
  });

  it('a pick of Watercolor keeps an in-group tip (detail)', () => {
    selectAquarelleTip('detail');
    aquarelleSelectedMediumId.value = 'acrylic';
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-tool-item-watercolor');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleSelectedTipId.value, 'the in-group tip is kept').toBe('detail');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('a first-ever pick of Watercolor lands on Round', () => {
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-tool-item-watercolor');
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleSelectedTipId.value, 'the watercolor family default').toBe('round');
    expect(aquarelleSelectedMediumId.value).toBe('watercolor');
  });

  it('greys the Water item while the sheet is dry and refuses the pick', () => {
    aquarelleHasWetPaint.value = false;
    setAquarelleToolMenuOpen(true, { left: 20, top: 200 });
    const item = findTestId(renderPanel(), 'aquarelle-tool-item-water');
    expect(item, 'the Water item must render').toBeTruthy();
    expect(item!.props?.['disabled'], 'Water is gated on standing water').toBe(true);
    (item!.props?.['onClick'] as () => void)();
    expect(aquarelleActiveTool.value, 'the dry-sheet pick is refused').toBe('brush');
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
    expect(body).toContain('}, [toolMenuOpen, responseMenuOpen]);');
    expect(body, 'signals only — never useState').not.toContain('useState');
    expect(body).toContain('data-aquarelle-popover-trigger');
    // quick 261122-gys stays true through the re-pick branch: the panel binds
    // a preset of the tool's family through the ONE store handler, and never
    // calls the record applier itself.
    expect(body).toContain('pickAquarelleMedium(brushGroupsForTool(id)[0]!);');
    expect(body, 'the panel never calls the record applier itself').not.toContain(
      'applyAquarelleMedium(',
    );
    expect(body.split('AQUARELLE_TOOL_ORDER.map(').length - 1, 'one tool item list').toBe(1);
    expect(body.split('toolResponses.map(').length - 1, 'one response item list').toBe(1);
    expect(body).toContain('role="menuitemradio"');
    expect(body).toContain('aria-checked={active}');
    expect(body).toContain('data-testid="aquarelle-tool-menu"');
    expect(body).toContain('data-testid="aquarelle-response-menu"');
  });
});

describe('Brush response dropdown (2026-11-27)', () => {
  it('lists the Medium family in table order and marks the shown response', () => {
    setAquarelleResponseMenuOpen(true, { left: 20, top: 240 });
    const tree = renderPanel();
    const menu = findTestId(tree, 'aquarelle-response-menu');
    expect(menu, 'an open response popover must render').toBeTruthy();
    expect(menu!.props?.['role']).toBe('menu');
    expect(menu!.props?.['aria-label']).toBe('Brush response');
    const items = [...walk(menu!)].filter((node) => {
      const id = node.props?.['data-testid'];
      return typeof id === 'string' && id.startsWith('aquarelle-response-item-');
    });
    expect(items, 'one item per Medium response').toHaveLength(MEDIUM_RESPONSE_NAMES.length);
    expect(items.map((item) => textContent(item).trim())).toEqual([...MEDIUM_RESPONSE_NAMES]);
    // No tip picked yet: the label and the checked item agree on the family's
    // first response (the same landing the engine would use).
    expect(items.map((item) => item.props?.['aria-checked'])).toEqual([true, false]);
    expect(textContent(findTestId(tree, 'aquarelle-response-trigger'))).toContain(
      MEDIUM_RESPONSE_NAMES[0],
    );
  });

  it('picking a response selects that brush and closes the menu', async () => {
    setAquarelleResponseMenuOpen(true, { left: 20, top: 240 });
    const item = findTestId(renderPanel(), 'aquarelle-response-item-pen');
    expect(item, 'the Pen 1B item must render').toBeTruthy();
    (item!.props?.['onClick'] as () => void)();
    await Promise.resolve();
    expect(aquarelleSelectedTipId.value, 'the picked response').toBe('pen');
    expect(aquarelleActiveTool.value, 'a Medium response keeps the Medium tool').toBe('brush');
    expect(aquarelleResponseMenuOpen.value).toBe(false);
  });

  it('shows the watercolor family alone on the Watercolor tool', () => {
    aquarelleActiveTool.value = 'watercolor';
    selectAquarelleTip('round');
    setAquarelleResponseMenuOpen(true, { left: 20, top: 240 });
    const menu = findTestId(renderPanel(), 'aquarelle-response-menu');
    const ids = [...walk(menu!)]
      .map((node) => node.props?.['data-testid'])
      .filter((id): id is string => typeof id === 'string' && id.startsWith('aquarelle-response-item-'))
      .map((id) => id.replace('aquarelle-response-item-', ''));
    expect(ids, 'no Medium response under Watercolor').not.toContain('bristle-round');
    expect(ids, 'the selected watercolor response is listed').toContain('round');
  });

  it('renders no response row for Water, Pen or Eraser', () => {
    for (const tool of ['water', 'pen', 'lift'] as const) {
      aquarelleActiveTool.value = tool;
      const tree = renderPanel();
      expect(findTestId(tree, 'aquarelle-response-row'), `${tool} owns no family`).toBeUndefined();
      expect(findTestId(tree, 'aquarelle-response-trigger'), `${tool} hides the trigger`).toBeUndefined();
    }
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
    expect(
      body.split('onCommit={(value) => props.onCommit?.(toStored(value))}').length - 1,
      'one GlobalSlider passthrough (2026-11-27: the Opacity row maps through toStored)',
    ).toBe(1);
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

// 2026-11-27 (artist's live ruling): Emboss is the Medium (acrylic) context's
// 0..5 low-value test band, rendered on the track, the typed-entry commit
// clamp and the readout, while every other global row keeps the 0..100 band.
describe('261127 emboss 0..5 test band', () => {
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

  it('pins min 0 and max 5 on the Emboss row (both drag and typed commits)', () => {
    applyAquarelleMedium('acrylic');
    setAquarelleParam('emboss', 3);
    const props = sliderProps('Emboss');
    expect(props.min, 'the test-row floor').toBe(0);
    expect(props.max, 'the row ceiling is 5').toBe(5);
    expect(props.value, 'an in-band value passes through').toBe(3);
  });

  it('reads a value outside the band as the nearest cap', () => {
    applyAquarelleMedium('acrylic');
    setAquarelleParam('emboss', 40);
    expect(sliderProps('Emboss').value, 'an out-of-band value reads as the ceiling').toBe(5);
    setAquarelleParam('emboss', -40);
    expect(sliderProps('Emboss').value, 'a negative value reads as the floor').toBe(0);
  });

  it('leaves every other global row on the 0..100 band', () => {
    applyAquarelleMedium('acrylic');
    const opacity = sliderProps('Opacity');
    expect(opacity.min).toBe(0);
    expect(opacity.max).toBe(100);
  });

  it('never renders the Emboss row in the watercolor context', () => {
    applyAquarelleMedium('watercolor');
    const labels = [...walk(AquarelleGlobalsPanel())]
      .map((node) => node.props?.['label'])
      .filter((label) => typeof label === 'string');
    expect(labels).not.toContain('Emboss');
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

  it('Medium (the acrylic record) shows its bristle rows only', () => {
    applyAquarelleMedium('acrylic');
    const labels = renderedSliders();
    // 2026-11-27 (artist's live ruling): the lateral Edge transparency fade is
    // retired — ONE Opacity row (the `edgeFade` key, rendered inverted: 100 =
    // opaque) sits in Paint & reservoir under Pickup, and the Edge falloff row
    // is gone. Noise keeps the break-up pair (Spec 11); the legacy Feather
    // amplitude row is hidden in every context. Emboss closes the tab in its
    // own trailing Relief section.
    expect(labels).toEqual([
      'Grain',
      'Pigment',
      'Pickup',
      'Opacity',
      'Dry speed',
      'Feather noise',
      'Feather falloff',
      'Emboss',
    ]);
    // quick 261124-iq9: Viscosity and Water are hidden for the Gouache paint
    // context; Refill and every fluid-only row stay off the bristle path too.
    // quick 261127-jox: the exact 'Feather' label must not render; 2026-11-27
    // retires both former Edge rows.
    for (const absent of [
      'Viscosity',
      'Refill',
      'Water',
      'Flow',
      'Bleed',
      'Edges',
      'Feather',
      'Edge transparency',
      'Edge falloff',
      'Transparency',
    ]) {
      expect(labels.includes(absent), `${absent} is absent for Gouache`).toBe(false);
    }
  });

  // 2026-11-27: the Medium panel renders its knobs as FOUR labelled sections
  // — Paint & reservoir (now carrying the global Transparency), Drying, Noise
  // and the trailing Relief (Emboss) — in the fixed group order (the
  // exact-list assertion also forbids any extra group heading). The Medium
  // group is empty (Viscosity is hidden there) so its heading drops.
  it('renders the Medium headings as paint, drying, noise, relief', () => {
    applyAquarelleMedium('acrylic');
    const tree = renderPanel();
    const groups = [...walk(tree)].filter((node) => {
      const id = node.props?.['data-testid'];
      return typeof id === 'string' && id.startsWith('aquarelle-param-group-');
    });
    expect(groups.map((group) => group.props?.['data-testid']).join('|')).toBe(
      'aquarelle-param-group-paint|aquarelle-param-group-drying|aquarelle-param-group-noise|aquarelle-param-group-relief',
    );
    const headings = ['Paint & reservoir', 'Drying', 'Noise', 'Relief'];
    const texts = groups.map((group) => textContent(group));
    for (let i = 0; i < headings.length; i += 1) {
      expect(texts[i]!.startsWith(headings[i]!), `heading ${headings[i]}`).toBe(true);
    }
  });

  it('Watercolor shows its seven rows with no Refill, Pickup or Feather', () => {
    applyAquarelleMedium('watercolor');
    const labels = renderedSliders();
    expect(labels).toEqual([
      'Grain',
      'Viscosity',
      'Pigment',
      'Water',
      'Dry speed',
      'Flow',
      'Bleed',
      'Edges',
    ]);
    expect(labels.includes('Refill'), 'Refill is absent for watercolor').toBe(false);
    // rev 3: Pickup is the bristle carrier+gather smear only — dead on the
    // fluid path, same evidence class as Refill.
    expect(labels.includes('Pickup'), 'Pickup is absent for watercolor').toBe(false);
    expect(labels.includes('Feather'), 'Feather is absent for watercolor').toBe(false);
  });

  it('the Eraser shows the Lift row alone and the Water tool its fluid set', () => {
    aquarelleActiveTool.value = 'lift';
    expect(renderedSliders()).toEqual(['Grain', 'Lift']);
    aquarelleActiveTool.value = 'water';
    expect(renderedSliders()).toEqual([
      'Grain',
      'Viscosity',
      'Dry speed',
      'Flow',
      'Bleed',
      'Edges',
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
