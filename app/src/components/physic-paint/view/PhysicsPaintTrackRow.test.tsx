/**
 * 47 close-out cross-track UAT fixes:
 * - Always-on rail lines: every non-active Paint row renders its own Key Rail
 *   segments as read-only bars (the rail line no longer waits for the track to
 *   be selected / the rich-lane swap).
 * - Ghost-key fix: the row subscribes to ITS OWN track revision signal
 *   (getTrackRotorRevision) — a store bump to the track re-renders the row with
 *   fresh store reads, so a cross-track move's removal half updates the source
 *   row immediately instead of waiting for the Studio's 150ms chrome throttle.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern as
 * PhysicsPaintKeyRail.test.tsx); the subscription and CSS contracts are
 * source/CSS reads like the strip's contract tests.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { PhysicsPaintTrackRow } from './PhysicsPaintTrackRow';
import {
  _setPhysicPaintMarkDirtyCallback,
  physicPaintStore,
} from '../../../stores/physicPaintStore';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';

const LAYER = 'layer-track-row-uat';
const TRACK = 'track-row-uat-a';
const CAPACITY = 24;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

const makeFrame = (appFrame: number, tag: string) => ({
  frameIndex: 0,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 4,
  height: 4,
});

const makePayload = (appFrame: number, tag: string): PhysicPaintRotoRealKeyPayload => ({
  frameIndex: 0,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 4,
  height: 4,
});

const makeRecord = (keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId,
  appFrame,
  payload: makePayload(appFrame, tag),
});

function seedTrack(trackId: string, records: readonly PhysicPaintRotoRealKeyRecord[]): void {
  const seeded = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, CAPACITY);
  if (!seeded.ok) throw new Error(`Seed failed for ${trackId}: ${seeded.error}`);
  for (const record of records) {
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, trackId, record.appFrame, makeFrame(record.appFrame, `frame-${record.keyId}`));
  }
}

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
  if (typeof vnode.type === 'function') return materialize(vnode.type(vnode.props));
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

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(name);
}

const rowSourcePath = fileURLToPath(new URL('./PhysicsPaintTrackRow.tsx', import.meta.url));
const rowSource = () => readFileSync(rowSourcePath, 'utf8');
const cssPath = fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url));
const css = () => readFileSync(cssPath, 'utf8');

function cssRule(selector: string): string {
  const source = css();
  const start = source.indexOf(selector);
  expect(start, `CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('}', start);
  return source.slice(start, end === -1 ? source.length : end + 1);
}

const FRAME_CELLS = Array.from({ length: CAPACITY }, (_, frame) => frame);

function render(overrides: Partial<Parameters<typeof PhysicsPaintTrackRow>[0]> = {}) {
  return materialize(PhysicsPaintTrackRow({
    trackId: TRACK,
    layerId: LAYER,
    frameCells: FRAME_CELLS,
    ...overrides,
  }));
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
});

describe('PhysicsPaintTrackRow — 47 close-out cross-track UAT', () => {
  it('subscribes to ITS OWN track revision signal (the ghost-key fix seam)', () => {
    // The narrow per-track subscription is what makes the source row refresh
    // immediately after a cross-track move's removal half — without it the row
    // only re-renders when the Studio's 150ms throttled chrome re-renders.
    const body = rowSource();
    expect(body).toMatch(/getTrackRotorRevision\(layerId,\s*trackId\)\.value/);
  });

  it('renders always-on read-only rail lines from THIS track records', () => {
    seedTrack(TRACK, [
      makeRecord('k0', 2, 'a@2'),
      makeRecord('k1', 5, 'a@5'),
    ]);
    const tree = render();
    const lines = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail-line'));
    expect(lines).toHaveLength(1);
    // Segment spans frames 2..5 inclusive → left 2×18, width 4×18.
    expect(lines[0].props.style).toMatchObject({ left: '36px', width: '72px' });
  });

  it('re-renders fresh store state per render: removing the moved rail drops the line and empties the cells', () => {
    seedTrack(TRACK, [
      makeRecord('k0', 2, 'a@2'),
      makeRecord('k1', 5, 'a@5'),
    ]);
    expect(findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-track-row-rail-line'))).toHaveLength(1);

    // The cross-track move's removal half: records replaced without the moved
    // keys, runtime bytes removed — then the row re-renders (its revision
    // signal bumped) and must show the post-move state, never ghosts.
    const removed = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [], INTERPOLATION, CAPACITY);
    if (!removed.ok) throw new Error(`removal must resolve: ${removed.error}`);
    physicPaintStore.removeRealRotoKeyFrame(LAYER, TRACK, 2);
    physicPaintStore.removeRealRotoKeyFrame(LAYER, TRACK, 5);

    const tree = render();
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail-line'))).toHaveLength(0);
    const cachedCells = findAll(tree, (vnode) => hasClass(vnode, 'roto-fill-cached'));
    expect(cachedCells).toHaveLength(0);
  });

  it('renders motion and static Loop Clip rail lines with the family colors (UAT round 3)', () => {
    physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [
      makeRecord('k0', 0, 'a@0'),
      makeRecord('k1', 2, 'a@2'),
    ], INTERPOLATION, CAPACITY);
    const motion = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-motion',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 3,
      mode: 'progressive',
    }]);
    if (!motion.ok) throw new Error(`motion loop seed failed: ${motion.error}`);
    const motionLine = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-track-row-loop-line'));
    expect(motionLine).toHaveLength(1);
    expect(String(motionLine[0].props.class)).not.toContain('physics-paint-track-row-loop-line-static');
    expect(cssRule('.physics-paint-track-row-loop-line {')).toContain('background: #8b5cf6');

    const staticClip = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-static',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 1,
      mode: 'static',
    }]);
    if (!staticClip.ok) throw new Error(`static loop seed failed: ${staticClip.error}`);
    const staticLine = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-track-row-loop-line'));
    expect(staticLine).toHaveLength(1);
    expect(String(staticLine[0].props.class)).toContain('physics-paint-track-row-loop-line-static');
    expect(cssRule('.physics-paint-track-row-loop-line.physics-paint-track-row-loop-line-static {')).toContain('background: #06b6d4');
  });

  it('keeps the rail line non-interactive and the background row line-free', () => {
    expect(cssRule('.physics-paint-track-row-rail-line {')).toContain('pointer-events: none');
    expect(cssRule('.physics-paint-track-row-rail-line {')).toContain('height: 3px');
    expect(cssRule('.physics-paint-track-row-rail-line {')).toContain('background: #8a939c');

    physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [makeRecord('k0', 2, 'a@2')], INTERPOLATION, CAPACITY);
    const backgroundTree = render({ trackId: 'bg-row', kind: 'background' });
    expect(findAll(backgroundTree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail-line'))).toHaveLength(0);
  });
});