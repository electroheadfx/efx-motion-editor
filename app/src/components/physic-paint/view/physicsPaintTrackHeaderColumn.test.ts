/**
 * 47-02 Task 1: pinned header column component behavior tests (TML-01/02/03/07,
 * D-02/D-04/D-06/D-07/D-08).
 *
 * The header column is hook-free (presentational — the strip owns rename/tools
 * state and flows it down), so the tests invoke it as a plain function and walk
 * the returned vnode tree, expanding the hook-free `PhysicsPaintTrackRowHeader`
 * vnodes the same way the strip viewport test does. The solo-arm reflection
 * reads the real `physicsPaintSoloArm` module-level signal.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ComponentChildren } from 'preact';
import type { BackgroundTrack, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { PhysicsPaintTrackColumnStrip, PhysicsPaintTrackRowHeader } from './PhysicsPaintTrackRow';
import { disarmSolo, toggleSolo } from './physicsPaintSoloArm';
import { physicsPaintTrackHeaderColumn } from './physicsPaintTrackHeaderColumn';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: ComponentChildren };
  ref?: unknown;
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

function hasClass(vnode: TestVNode, className: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(className);
}

/** The column renders rows via the hook-free `PhysicsPaintTrackRowHeader`
 *  component and the top strip via `PhysicsPaintTrackColumnStrip`; expand
 *  those vnodes by calling the component function directly. */
function expandComponent(vnode: TestVNode): TestVNode {
  if (vnode.type === PhysicsPaintTrackRowHeader || vnode.type === PhysicsPaintTrackColumnStrip) {
    return (vnode.type as (props: TestVNode['props']) => TestVNode)(vnode.props);
  }
  return vnode;
}

/** A minimal DOM event stub for the component's stopPropagation-preventDefault handlers. */
function clickEvent(): { stopPropagation: ReturnType<typeof vi.fn> } {
  return { stopPropagation: vi.fn() };
}

/** The expanded header cells in DOM order (Paint rows then the fixed Bg row). */
function headerCells(root: unknown): TestVNode[] {
  return findAll(root, (vnode) => vnode.type === PhysicsPaintTrackRowHeader)
    .map(expandComponent)
    .filter((vnode) => typeof vnode.props['data-track-id'] === 'string');
}

function headerCell(root: unknown, trackId: string): TestVNode {
  const found = findAll(root, (vnode) => vnode.type === PhysicsPaintTrackRowHeader)
    .map(expandComponent)
    .filter((vnode) => vnode.props['data-track-id'] === trackId);
  expect(found).toHaveLength(1);
  return found[0];
}

interface ColumnFixture {
  tracks: readonly InternalPaintTrack[];
  activeTrackId: string;
  background: BackgroundTrack;
  trackA: InternalPaintTrack;
  trackB: InternalPaintTrack;
}

function makeTwoTrackFixture(): ColumnFixture {
  const document = createEfxPaintDocument('header-column-layer');
  const trackA = document.tracks[0];
  const trackB: InternalPaintTrack = { ...trackA, id: 'track-b', name: 'Paint 2', order: 1 };
  return {
    tracks: [trackA, trackB],
    activeTrackId: trackA.id,
    background: document.background,
    trackA,
    trackB,
  };
}

interface ColumnRenderOptions {
  readonly tracks: readonly InternalPaintTrack[];
  readonly activeTrackId: string;
  readonly background: BackgroundTrack | null;
  readonly onSelectTrack?: (trackId: string) => void;
  readonly onToggleVisible?: (trackId: string) => void;
  readonly onToggleSolo?: (trackId: string) => void;
  readonly onAddTrack?: () => void;
  readonly onDuplicateTrack?: (trackId: string) => void;
  readonly onRequestDeleteTrack?: (trackId: string) => void;
  readonly toolsOpenTrackId?: string | null;
  readonly onToggleTools?: (trackId: string) => void;
}

function renderColumn(options: ColumnRenderOptions): TestVNode {
  return physicsPaintTrackHeaderColumn({
    tracks: options.tracks,
    activeTrackId: options.activeTrackId,
    background: options.background,
    onSelectTrack: options.onSelectTrack ?? vi.fn(),
    onToggleVisible: options.onToggleVisible ?? vi.fn(),
    onToggleSolo: options.onToggleSolo ?? vi.fn(),
    onAddTrack: options.onAddTrack ?? vi.fn(),
    onDuplicateTrack: options.onDuplicateTrack ?? vi.fn(),
    onRequestDeleteTrack: options.onRequestDeleteTrack ?? vi.fn(),
    toolsOpenTrackId: options.toolsOpenTrackId ?? null,
    onToggleTools: options.onToggleTools ?? vi.fn(),
  });
}

function renderFixture(fixture: ColumnFixture, overrides: Partial<ColumnRenderOptions> = {}): TestVNode {
  return renderColumn({ ...fixture, ...overrides });
}

describe('physicsPaintTrackHeaderColumn (47-02 Task 1)', () => {
  it('renders every Paint track as a row plus exactly one locked Bg row at the bottom (TML-01/07)', () => {
    const fixture = makeTwoTrackFixture();
    const root = renderFixture(fixture);
    const cells = headerCells(root);
    // 2 Paint rows + exactly 1 Bg row, in document order, Bg always last.
    expect(cells).toHaveLength(3);
    expect(cells.map((cell) => cell.props['data-track-id'])).toEqual([
      fixture.trackA.id,
      fixture.trackB.id,
      fixture.background.id,
    ]);
    // Every row carries its name as the label cell text.
    for (const cell of cells) {
      const label = findOne(cell, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
      const text = String(label.props.children);
      if (cell.props['data-track-id'] === fixture.trackA.id) expect(text).toBe('Track 1');
      if (cell.props['data-track-id'] === fixture.trackB.id) expect(text).toBe('Paint 2');
      if (cell.props['data-track-id'] === fixture.background.id) expect(text).toBe('Bg');
    }
  });

  it('marks the active track row with the accent class and moves it when activeTrackId switches (TML-03)', () => {
    const fixture = makeTwoTrackFixture();
    const rootA = renderFixture(fixture, { activeTrackId: fixture.trackA.id });
    expect(hasClass(headerCell(rootA, fixture.trackA.id), 'physics-paint-track-row-header-active')).toBe(true);
    expect(hasClass(headerCell(rootA, fixture.trackB.id), 'physics-paint-track-row-header-active')).toBe(false);

    const rootB = renderFixture(fixture, { activeTrackId: fixture.trackB.id });
    expect(hasClass(headerCell(rootB, fixture.trackA.id), 'physics-paint-track-row-header-active')).toBe(false);
    expect(hasClass(headerCell(rootB, fixture.trackB.id), 'physics-paint-track-row-header-active')).toBe(true);
  });

  it('routes hide and solo toggles to onToggleVisible/onToggleSolo and reflects the solo arm state (TML-04 surface)', () => {
    const fixture = makeTwoTrackFixture();
    const onToggleVisible = vi.fn();
    const onToggleSolo = vi.fn();
    const root = renderFixture(fixture, { onToggleVisible, onToggleSolo });
    const headerA = headerCell(root, fixture.trackA.id);

    // The hide (eye) toggle lives in the row's tools group.
    const eye = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Hide Track 1');
    (eye.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleVisible).toHaveBeenCalledWith(fixture.trackA.id);

    // The solo (S) toggle.
    const solo = findOne(headerA, (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'));
    expect(hasClass(solo, 'physics-paint-track-row-solo-armed')).toBe(false);
    (solo.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleSolo).toHaveBeenCalledWith(fixture.trackA.id);

    // The armed state reflects the module-level solo arm (D-20).
    expect(toggleSolo()).toBe(true);
    try {
      const armedRoot = renderFixture(fixture);
      const armedSolo = findOne(headerCell(armedRoot, fixture.trackA.id), (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'));
      expect(hasClass(armedSolo, 'physics-paint-track-row-solo-armed')).toBe(true);
      expect(String(armedSolo.props['aria-pressed'])).toBe('true');
    } finally {
      disarmSolo();
    }
    const disarmedRoot = renderFixture(fixture);
    const disarmedSolo = findOne(headerCell(disarmedRoot, fixture.trackA.id), (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'));
    expect(hasClass(disarmedSolo, 'physics-paint-track-row-solo-armed')).toBe(false);
    expect(String(disarmedSolo.props['aria-pressed'])).toBe('false');
  });

  it('truncates a long name with an ellipsis class and keeps the full name in the title tooltip (D-02)', () => {
    const fixture = makeTwoTrackFixture();
    const longName = 'A very long Paint track name that cannot fit in a 140px column at all';
    const tracks: readonly InternalPaintTrack[] = [
      { ...fixture.trackA, id: 'track-long', name: longName },
    ];
    const root = renderFixture(fixture, { tracks });
    const header = headerCell(root, 'track-long');
    const label = findOne(header, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
    expect(hasClass(label, 'physics-paint-track-row-label-ellipsis')).toBe(true);
    expect(String(label.props.title)).toBe(longName);
  });

  it('renders the Bg row locked and muted with no hover/duplicate/delete actions (D-06)', () => {
    const fixture = makeTwoTrackFixture();
    const root = renderFixture(fixture);
    const bg = headerCell(root, fixture.background.id);
    expect(hasClass(bg, 'physics-paint-track-row-header-background')).toBe(true);
    // Lock indicator present.
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-lock'))).toHaveLength(1);
    // No hover capability: not a role=button, no click, no tools group, no
    // more-button, no reorder grab.
    expect(bg.props.role).toBeUndefined();
    expect(bg.props.onClick).toBeUndefined();
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools'))).toHaveLength(0);
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools-toggle'))).toHaveLength(0);
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-grip'))).toHaveLength(0);
  });

  it('adds a track from the column + button and exposes duplicate/delete actions per Paint row (D-07)', () => {
    const fixture = makeTwoTrackFixture();
    const onAddTrack = vi.fn();
    const onDuplicateTrack = vi.fn();
    const onRequestDeleteTrack = vi.fn();
    const onToggleTools = vi.fn();

    // The '+' add button lives in the column strip and routes through onAddTrack.
    const root = renderFixture(fixture, { onAddTrack });
    const strip = findOne(root, (vnode) => vnode.type === PhysicsPaintTrackColumnStrip);
    const addButton = findOne(expandComponent(strip), (vnode) => vnode.props['aria-label'] === 'Add track');
    (addButton.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onAddTrack).toHaveBeenCalledTimes(1);

    // The tools panel opens only from the more-button (47-01 UAT round 6) and
    // exposes the duplicate + delete actions for that row.
    const rootClosed = renderFixture(fixture, { onToggleTools });
    const more = findOne(headerCell(rootClosed, fixture.trackA.id), (vnode) => hasClass(vnode, 'physics-paint-track-row-tools-toggle'));
    (more.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleTools).toHaveBeenCalledWith(fixture.trackA.id);

    const rootOpen = renderFixture(fixture, {
      toolsOpenTrackId: fixture.trackA.id,
      onDuplicateTrack,
      onRequestDeleteTrack,
    });
    const headerA = headerCell(rootOpen, fixture.trackA.id);
    const duplicate = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Duplicate Track 1');
    (duplicate.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onDuplicateTrack).toHaveBeenCalledWith(fixture.trackA.id);
    const trash = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Delete Track 1');
    // Two Paint rows exist, so the row is deletable — no disabled guard.
    expect(trash.props['aria-disabled']).toBeUndefined();
    (trash.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onRequestDeleteTrack).toHaveBeenCalledWith(fixture.trackA.id);
  });
});
