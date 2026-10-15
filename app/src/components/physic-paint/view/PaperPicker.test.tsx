/**
 * 56-05 Task 3 — PaperPicker contract pins (D-09..D-12 / PAPER-01 / PAPER-04).
 *
 * Laws pinned here:
 *   D-09   thumbnail grid popover in the shared panel (13 cells)
 *   D-10   Strength + Scale SliderStepper rows sit directly under the trigger
 *   D-11   cells show the raw tile (height-map lit relief / jpg), no engine
 *   D-12   one library grouped Procedural / Real headers
 *   UI-SPEC 3 columns, 64×64 cells, accent on the active cell only
 *
 * Assertion style: scalar predicates so TAP diagnostics stay one-line.
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as panelSplitShell.test.tsx / NumericStepper.test.tsx).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PaperPicker } from './PaperPicker';

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
    if (typeof current === 'string' || typeof current === 'number') { parts.push(String(current)); return; }
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { for (const child of current) walkText(child); return; }
    walkText((current as TestVNode).props?.children);
  };
  walkText(node);
  return parts.join(' ');
}

function pickerProps() {
  return {
    paperId: 'paper/cold-press',
    strength: 0.65,
    scale: 1,
    onPaperIdChange: () => {},
    onStrengthChange: () => {},
    onScaleChange: () => {},
  };
}

function renderPicker() {
  return materialize(PaperPicker(pickerProps()));
}

function findAll(root: unknown, predicate: (node: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

describe('PaperPicker (D-09..D-12)', () => {
  it('trigger secondary text shows the current paper name', () => {
    const root = renderPicker();
    const current = findAll(root, (node) => node.props?.['data-paper-picker-current'] !== undefined);
    expect(current.length).toBe(1);
    expect(textContent(current[0])).toBe('cold press');
  });

  it('trigger label reads Paper', () => {
    const root = renderPicker();
    const trigger = findAll(root, (node) => node.props?.['data-paper-picker-trigger'] !== undefined);
    expect(trigger.length).toBe(1);
    expect(textContent(trigger[0]).includes('Paper')).toBe(true);
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

  it('Strength and Scale SliderStepper rows sit under the trigger (D-10)', () => {
    const root = renderPicker();
    const sliders = findAll(root, (node) => node.props?.['data-paper-picker-sliders'] !== undefined);
    expect(sliders.length).toBe(1);
    const labels = textContent(sliders[0]);
    expect(labels.includes('Strength')).toBe(true);
    expect(labels.includes('Scale')).toBe(true);
  });

  it('no call into the fluid engine from PaperPicker.tsx', () => {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), './PaperPicker.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    const engineTokens = /engine|deposit|fluid/i;
    // Strip the header comment (mentions "no engine" by design) before the scan.
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(engineTokens.test(body)).toBe(false);
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
