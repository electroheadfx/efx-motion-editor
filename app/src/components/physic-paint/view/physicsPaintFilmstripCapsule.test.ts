import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ComponentChildren } from 'preact';
import type { PhysicsPaintLoopClipPresentation } from './physicsPaintLoopClipPresentation';
import {
  FILMSTRIP_CELL_EXPAND_THRESHOLD_PX,
  PhysicsPaintFilmstripCapsule,
} from './physicsPaintFilmstripCapsule';

const physicsPaintStudioCss = readFileSync(
  fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)),
  'utf8',
);

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: ComponentChildren };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
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

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(name);
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return childrenOf(node as TestVNode).map(textOf).join('');
}

function cssRule(selector: string): string {
  const start = physicsPaintStudioCss.indexOf(selector);
  expect(start, `CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = physicsPaintStudioCss.indexOf('}', start);
  return physicsPaintStudioCss.slice(start, end === -1 ? physicsPaintStudioCss.length : end + 1);
}

function presentation(overrides: Partial<PhysicsPaintLoopClipPresentation> = {}): PhysicsPaintLoopClipPresentation {
  return {
    loopId: 'internal-loop-id',
    displayName: 'Walk Cycle Rail',
    sourceLabel: 'Walk Cycle',
    placementLabel: 'F12',
    cycleLabel: 'Cycle 4f × 3 = 12f',
    effectiveLabel: 'Effective 12f',
    shortened: false,
    partialCycle: false,
    shortenedLabel: null,
    repeatInstanceCount: 3,
    interruptionTooltipLine: null,
    mode: 'progressive',
    modeLabel: 'Motion',
    groupTypeLabel: 'Motion Rail',
    lifecycle: 'synchronized',
    statusLabel: 'Synchronized with Action.',
    synchronizationDot: 'synchronized',
    regenerateDisabledReason: 'Already synchronized with Action.',
    fragmentLabel: null,
    linkedDescription: null,
    tooltipLines: [
      'Walk Cycle Rail',
      'Type: Motion',
      'Cycle 4f × 3 = 12f',
      'Effective 12f',
      'Status: Synchronized with Action.',
    ],
    accessibleName: 'Walk Cycle Rail. Motion Rail. Cycle 4f × 3 = 12f. Effective 12 frames. Synchronized with Action.',
    ...overrides,
  };
}

function render(overrides: {
  presentation?: PhysicsPaintLoopClipPresentation;
  repeat?: number | 'infinity';
  sourceOffsets?: readonly number[];
  sourceFrameCount?: number;
  cycleLength?: number;
  cellWidth?: number;
} = {}) {
  const props = {
    presentation: overrides.presentation ?? presentation(),
    geometry: { left: 0, width: 216 },
    repeat: overrides.repeat ?? 3,
    sourceOffsets: overrides.sourceOffsets ?? [0, 1, 2, 3, 4],
    sourceFrameCount: overrides.sourceFrameCount ?? 5,
    cycleLength: overrides.cycleLength ?? 5,
    cellWidth: overrides.cellWidth ?? 18,
  };
  return { props, tree: PhysicsPaintFilmstripCapsule(props) };
}

describe('physics paint filmstrip capsule (TML-06)', () => {
  it('renders one source-cycle cell per source frame at the capsule head, each carrying the source-frame index', () => {
    const { tree } = render({ sourceOffsets: [0, 1, 2, 3, 4], sourceFrameCount: 5 });

    const cells = findAll(tree, (node) => hasClass(node, 'physics-paint-capsule-source-cell'));
    expect(cells).toHaveLength(5);
    expect(cells.map((cell) => textOf(cell))).toEqual(['0', '1', '2', '3', '4']);
  });

  it('derives the ×N/×∞ badge from the requested cycleLabel, never from the effective duration', () => {
    const finite = render({ presentation: presentation({ cycleLabel: 'Cycle 4f × 3 = 12f' }), repeat: 3 });
    const finiteBadge = findOne(finite.tree, (node) => hasClass(node, 'physics-paint-capsule-badge'));
    expect(textOf(finiteBadge)).toContain('Cycle 4f × 3 = 12f');
    expect(textOf(finiteBadge)).toContain('×3');
    expect(textOf(finiteBadge)).not.toContain('Effective');

    const infinite = render({
      presentation: presentation({ cycleLabel: 'Cycle 4f × ∞' }),
      repeat: 'infinity',
    });
    const infiniteBadge = findOne(infinite.tree, (node) => hasClass(node, 'physics-paint-capsule-badge'));
    expect(textOf(infiniteBadge)).toContain('Cycle 4f × ∞');
    expect(textOf(infiniteBadge)).toContain('×∞');
  });

  it('renders the diagonal cut across the repetition band only when the cycle is partial', () => {
    const partial = render({ presentation: presentation({ partialCycle: true }) });
    const partialBand = findOne(partial.tree, (node) => hasClass(node, 'physics-paint-capsule-repeat-band'));
    expect(hasClass(partialBand, 'partial-cut')).toBe(true);

    const whole = render({ presentation: presentation({ partialCycle: false }) });
    const wholeBand = findOne(whole.tree, (node) => hasClass(node, 'physics-paint-capsule-repeat-band'));
    expect(hasClass(wholeBand, 'partial-cut')).toBe(false);
  });

  it('switches the repetition band between the compact hatched form and expanded linked cells at the cell-width threshold', () => {
    const compact = render({ cellWidth: FILMSTRIP_CELL_EXPAND_THRESHOLD_PX - 4 });
    const compactBand = findOne(compact.tree, (node) => hasClass(node, 'physics-paint-capsule-repeat-band'));
    expect(hasClass(compactBand, 'compact')).toBe(true);
    expect(findAll(compact.tree, (node) => hasClass(node, 'physics-paint-capsule-repeat-cell'))).toHaveLength(0);

    const expanded = render({ cellWidth: FILMSTRIP_CELL_EXPAND_THRESHOLD_PX + 4 });
    const expandedBand = findOne(expanded.tree, (node) => hasClass(node, 'physics-paint-capsule-repeat-band'));
    expect(hasClass(expandedBand, 'compact')).toBe(false);
    const cells = findAll(expanded.tree, (node) => hasClass(node, 'physics-paint-capsule-repeat-cell'));
    expect(cells).toHaveLength(15); // repeatInstanceCount 3 × sourceOffsets 5
    expect(cells.map((cell) => textOf(cell))).toEqual([
      '0', '1', '2', '3', '4',
      '0', '1', '2', '3', '4',
      '0', '1', '2', '3', '4',
    ]);
  });

  it('renders the distinct shortened visual and label while keeping the requested badge (D-12)', () => {
    const { tree } = render({
      presentation: presentation({ shortened: true, shortenedLabel: 'Loop shortened by next clip' }),
    });

    const capsule = findOne(tree, (node) => hasClass(node, 'physics-paint-filmstrip-capsule'));
    expect(hasClass(capsule, 'shortened')).toBe(true);
    expect(textOf(capsule)).toContain('Loop shortened by next clip');
    expect(textOf(capsule)).toContain('Cycle 4f × 3 = 12f');
  });
});
