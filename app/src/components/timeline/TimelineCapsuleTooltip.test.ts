import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TimelineLoopCapsule} from '../../types/timeline';
import type {LoopCapsuleHit, TimelineLoopCapsuleTooltipRequest} from './TimelineInteraction';
import {
  buildTimelineCapsuleTooltipModel,
  computeTimelineCapsuleTooltipPosition,
  createTimelineCapsuleTooltipOps,
  runTimelineCapsuleTooltipAction,
  TimelineCapsuleTooltipVisibility,
  TIMELINE_CAPSULE_TOOLTIP_DELAY_MS,
  TIMELINE_CAPSULE_TOOLTIP_VIEWPORT_MARGIN,
} from './TimelineCapsuleTooltip';

const capsule = (overrides: Partial<TimelineLoopCapsule> = {}): TimelineLoopCapsule => ({
  loopId: 'loop-7', placementStart: 10, cycleLength: 5, repeat: 5,
  requestedEnd: 35, effectiveEnd: 32, truncated: true, partialCycle: true,
  boundaryKind: 'real-key', boundaryFrame: 32, mode: 'progressive', unresolved: null,
  firstCycleCells: [0, 1, 2, 3, 4].map((index) => ({
    sourceKeyId: `key-${index + 1}`,
    sourceAppFrame: 20 + index,
    dataUrl: null,
    realKeyBacked: false,
  })),
  ...overrides,
});

const request = (hit: LoopCapsuleHit, overrides: Partial<TimelineLoopCapsuleTooltipRequest> = {}): TimelineLoopCapsuleTooltipRequest => ({
  capsule: capsule(), hit, clientX: 200, clientY: 100, pinned: true, layerId: 'paint-1', sequenceStartFrame: 50, ...overrides,
});

describe('Timeline capsule tooltip locked copy', () => {
  it('renders the exact occurrence form and source-edit action', () => {
    const model = buildTimelineCapsuleTooltipModel(request({region: 'occurrence', loopId: 'loop-7', repeatInstance: 3, sourceIndex: 1}));
    expect(model.lines).toEqual(['Repeat 3 · Source frame 2 of 5']);
    expect(model.actions).toContain('Edit source frame');
  });

  it('renders truncated and zero-effective copy exactly', () => {
    const truncated = buildTimelineCapsuleTooltipModel(request({region: 'truncation', loopId: 'loop-7'}));
    expect(truncated.lines).toEqual([
      'Cycle 5f × 5 = 25f',
      'Requested 25f',
      'Effective 22f',
      'Loop shortened by next clip (partial cycle)',
      'Progressive',
    ]);
    const zero = capsule({effectiveEnd: 10, boundaryFrame: 10});
    expect(buildTimelineCapsuleTooltipModel(request({region: 'anchor', loopId: 'loop-7'}, {capsule: zero})).lines).toEqual([
      'Cycle 5f × 5 = 25f · Effective 0f — fully shortened by the next clip',
    ]);
  });

  it('lists unresolved references one per line with the locked remedy and recovery actions', () => {
    const unresolved = capsule({unresolved: {missingSourceKeyIds: ['missing-A', 'missing-B']}});
    const model = buildTimelineCapsuleTooltipModel(request({region: 'outline', loopId: 'loop-7'}, {capsule: unresolved}));
    expect(model.lines).toEqual([
      'Missing source reference: missing-A',
      'Missing source reference: missing-B',
      'Repair, relink, unlink, or delete the loop.',
    ]);
    expect(model.actions).toEqual(['Repair loop…', 'Relink loop…', 'Unlink loop', 'Delete loop']);
  });

  it('surfaces a disabled or stale guard reason as plain text', () => {
    const model = buildTimelineCapsuleTooltipModel(request({region: 'outline', loopId: 'loop-7'}), 'Source cycle is stale.');
    expect(model.lines[model.lines.length - 1]).toBe('Source cycle is stale.');
  });
});

describe('Timeline capsule tooltip visibility discipline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delays hover by 1000ms, cancels on leave, and shows keyboard focus immediately', () => {
    const changes: boolean[] = [];
    const visibility = new TimelineCapsuleTooltipVisibility((visible) => changes.push(visible));
    visibility.hover();
    vi.advanceTimersByTime(TIMELINE_CAPSULE_TOOLTIP_DELAY_MS - 1);
    expect(changes).toEqual([]);
    visibility.leave();
    vi.advanceTimersByTime(1);
    expect(changes[changes.length - 1]).toBe(false);
    visibility.focus();
    expect(changes[changes.length - 1]).toBe(true);
    visibility.escape();
    expect(changes[changes.length - 1]).toBe(false);
  });

  it('clamps one host inside the viewport with the locked 8px margin', () => {
    expect(TIMELINE_CAPSULE_TOOLTIP_VIEWPORT_MARGIN).toBe(8);
    expect(computeTimelineCapsuleTooltipPosition({x: 2, y: 2}, {width: 300, height: 120}, {width: 320, height: 160})).toEqual({left: 8, top: 8});
  });
});

describe('Timeline capsule tooltip action dispatch', () => {
  it('wires source seek, duplicate, unlink/delete, repair, and relink to controller-shaped operations', async () => {
    const ops = {
      editSourceFrame: vi.fn(async () => ({ok: true, reason: null})),
      duplicateLinkedLoop: vi.fn(async () => ({ok: true, reason: null})),
      unlinkLoop: vi.fn(async () => ({ok: true, reason: null})),
      repairLoop: vi.fn(async () => ({ok: true, reason: null})),
      relinkLoop: vi.fn(async () => ({ok: true, reason: null})),
      promptDestinationStart: vi.fn(() => 40),
      promptRelinkKeyIds: vi.fn(() => ['key-1', 'key-2']),
    };
    const occurrence = request({region: 'occurrence', loopId: 'loop-7', repeatInstance: 3, sourceIndex: 1});
    await runTimelineCapsuleTooltipAction('Edit source frame', occurrence, ops);
    await runTimelineCapsuleTooltipAction('Duplicate linked loop', occurrence, ops);
    await runTimelineCapsuleTooltipAction('Unlink loop', occurrence, ops);
    await runTimelineCapsuleTooltipAction('Delete loop', occurrence, ops);
    await runTimelineCapsuleTooltipAction('Repair loop…', occurrence, ops);
    await runTimelineCapsuleTooltipAction('Relink loop…', occurrence, ops);
    expect(ops.editSourceFrame).toHaveBeenCalledWith('loop-7', 21);
    expect(ops.duplicateLinkedLoop).toHaveBeenCalledWith('loop-7', 40);
    expect(ops.unlinkLoop).toHaveBeenCalledTimes(2);
    expect(ops.repairLoop).toHaveBeenCalledWith('loop-7');
    expect(ops.relinkLoop).toHaveBeenCalledWith('loop-7', ['key-1', 'key-2']);
  });

  it('returns guard rejection reasons without mutating the request', async () => {
    const original = request({region: 'outline', loopId: 'loop-7'});
    const result = await runTimelineCapsuleTooltipAction('Repair loop…', original, {
      editSourceFrame: vi.fn(), duplicateLinkedLoop: vi.fn(), unlinkLoop: vi.fn(),
      repairLoop: vi.fn(async () => ({ok: false, reason: 'Missing source keys remain unresolved.'})),
      relinkLoop: vi.fn(), promptDestinationStart: vi.fn(), promptRelinkKeyIds: vi.fn(),
    });
    expect(result).toEqual({ok: false, reason: 'Missing source keys remain unresolved.'});
    expect(original.capsule.unresolved).toBe(null);
  });

  it('routes default pinned mutations through the correlated Studio bridge instead of the parent store', async () => {
    const bridgeRequest = vi.fn(async () => ({ok: true, reason: null}));
    const ops = createTimelineCapsuleTooltipOps(
      request({region: 'outline', loopId: 'loop-7'}),
      bridgeRequest,
      {
        promptDestinationStart: () => 40,
        promptRelinkKeyIds: () => ['key-1', 'key-2'],
      },
    );

    await ops.duplicateLinkedLoop('loop-7', 40);
    await ops.unlinkLoop('loop-7');
    await ops.repairLoop('loop-7');
    await ops.relinkLoop('loop-7', ['key-1', 'key-2']);

    expect(bridgeRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({kind: 'duplicate-linked-loop', loopId: 'loop-7', destinationStart: 40}));
    expect(bridgeRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({kind: 'unlink-loop', loopId: 'loop-7'}));
    expect(bridgeRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({kind: 'repair-loop', loopId: 'loop-7'}));
    expect(bridgeRequest).toHaveBeenNthCalledWith(4, expect.objectContaining({kind: 'relink-loop', loopId: 'loop-7', sourceKeyIds: ['key-1', 'key-2']}));
  });
});
