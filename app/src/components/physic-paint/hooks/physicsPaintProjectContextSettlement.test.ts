import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintProjectContext } from '../../../types/physicPaint';
import { createPhysicsPaintProjectContextSettlement } from './physicsPaintProjectContextSettlement';

/**
 * quick-260922-jss: the Scripts-panel layer list only ever arrives on the
 * project-context payload, and that payload races the asynchronous launch
 * settle. The two arrival orders must produce the same result; these legs pin
 * both of them at the controller seam (the ports are the only surface the
 * controller sees, so no DOM, Tauri transport or second realm is involved).
 */

function project(label: string): PhysicPaintProjectContext {
  return {
    name: `Project ${label}`,
    saved: true,
    contextId: `context-${label}`,
    layers: [{ id: 'layer-1', name: 'Ink' }, { id: 'layer-2', name: 'Hair' }],
    scriptScope: 'script-scope',
  };
}

function launchContext(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return {
    operationId: 'operation-1',
    layerId: 'layer-1',
    startFrame: 4,
    layerName: 'Ink',
    width: 1600,
    height: 900,
    fps: 24,
    rotoPlayback: { loop: false, fps: 24 },
    audioPreview: { revision: 3, fps: 24, tracks: [] },
    document: { parentLayerId: 'layer-1' } as unknown as PhysicPaintLaunchContext['document'],
    ...overrides,
  };
}

function harness(current: PhysicPaintLaunchContext | null) {
  const applyContext = vi.fn();
  const settlement = createPhysicsPaintProjectContextSettlement({
    peekLaunchContext: () => current,
    applyContext,
  });
  return { settlement, applyContext, peek: () => current, publish: (context: PhysicPaintLaunchContext | null) => { current = context; } };
}

describe('Physics Paint project-context settlement (quick-260922-jss)', () => {
  it('leg (i): a payload accepted before the launch context settles rides that settle', () => {
    const test = harness(null);
    const arriving = project('arriving');
    const carried = launchContext({ project: project('carried') });

    test.settlement.accept(arriving);
    // Nothing to apply to yet — but the response must not be discarded.
    expect(test.applyContext).not.toHaveBeenCalled();

    const settled = test.settlement.settle(carried);

    expect(settled.project, 'the arriving project-context payload must be delivered by the settle').toBe(arriving);
    expect(settled.project?.layers).toEqual([{ id: 'layer-1', name: 'Ink' }, { id: 'layer-2', name: 'Hair' }]);
  });

  it('leg (ii): a payload accepted after the settle is applied at once and leaves no stash behind', () => {
    const existing = launchContext({ operationId: 'operation-existing' });
    const test = harness(existing);
    const arriving = project('late');

    test.settlement.accept(arriving);

    expect(test.applyContext).toHaveBeenCalledTimes(1);
    const applied = test.applyContext.mock.calls[0][0] as PhysicPaintLaunchContext;
    expect(applied.project).toBe(arriving);
    expect(applied.operationId).toBe('operation-existing');
    expect(applied.document).toBe(existing.document);
    expect(applied.audioPreview).toBe(existing.audioPreview);

    const other = launchContext({ operationId: 'operation-other', project: project('other') });
    expect(test.settlement.settle(other)).toBe(other);
  });

  it('leg (iii): with nothing stashed, settle passes the context through by reference', () => {
    const test = harness(null);
    const context = launchContext();

    expect(test.settlement.settle(context)).toBe(context);
    expect(test.applyContext).not.toHaveBeenCalled();
  });

  it('leg (iv): the payload is delivered exactly once', () => {
    const test = harness(null);
    const arriving = project('once');
    const first = launchContext({ operationId: 'operation-first' });
    const second = launchContext({ operationId: 'operation-second' });

    test.settlement.accept(arriving);

    const settledFirst = test.settlement.settle(first);
    expect(settledFirst.project, 'the first settle must carry the accepted payload').toBe(arriving);

    expect(test.settlement.settle(second)).toBe(second);
  });

  it('leg (v): the settle moves .project only and never mutates its input', () => {
    const test = harness(null);
    const arriving = project('only-project');
    const previousProject = project('previous');
    const input = launchContext({ project: previousProject });

    test.settlement.accept(arriving);
    const settled = test.settlement.settle(input);

    expect(settled.document).toBe(input.document);
    expect(settled.audioPreview).toBe(input.audioPreview);
    expect(settled.rotoPlayback).toBe(input.rotoPlayback);
    expect(settled.operationId).toBe(input.operationId);
    expect(settled.layerId).toBe(input.layerId);
    expect(settled.startFrame).toBe(input.startFrame);
    expect(settled.layerName).toBe(input.layerName);
    expect(settled.width).toBe(input.width);
    expect(settled.height).toBe(input.height);
    expect(settled.fps).toBe(input.fps);
    // The launch context handed to the settle is a read-only input.
    expect(input.project).toBe(previousProject);
  });

  it('leg (vi): the newest accepted payload wins', () => {
    const test = harness(null);
    const first = project('first');
    const second = project('second');
    const context = launchContext();

    test.settlement.accept(first);
    test.settlement.accept(second);

    expect(test.settlement.settle(context).project, 'the freshest payload must be the one delivered').toBe(second);
  });
});
