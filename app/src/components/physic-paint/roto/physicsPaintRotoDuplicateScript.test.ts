import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import type {
  AquarelleDryEvent,
  AquarellePayloadEvent,
  AquarelleStroke,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import {
  ROTO_DUPLICATE_SCRIPT_APPLY_FAILED,
  ROTO_DUPLICATE_SCRIPT_NAVIGATION_ABORTED,
  ROTO_DUPLICATE_SCRIPT_RECORD_FAILED,
  ROTO_DUPLICATE_SCRIPT_SUPERSEDED,
  ROTO_DUPLICATE_SCRIPT_TIMEOUT,
  aquarelleStrokeFromScriptEvent,
  copyAquarelleScriptToFrame,
  resolveRotoDuplicateScriptDecision,
  runRotoDuplicateWithScript,
  waitForRotoDuplicateSourceFrame,
  type RotoDuplicateScriptDestinationKind,
  type RotoDuplicateWithScriptPorts,
} from './physicsPaintRotoDuplicateScript';

function stroke(mutationId: number, x = 10): PaintStroke {
  return {
    mutationId,
    tool: 'paint',
    points: [{ x, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }],
    color: '#123456',
    params: { size: 12, opacity: 100, pressure: 100, waterAmount: 50, dryAmount: 50, edgeDetail: 50, pickup: 50, eraseStrength: 50, antiAlias: 1 },
    timestamp: mutationId,
  };
}

function brushScript(): RotoPaintScript {
  return {
    provenance: { sessionId: 'duplicate-cxc', layerId: 'layer-1', sourceFrame: 3 },
    sourceFrame: 3,
    sourceDisplayFrame: 3,
    sourceRevision: 0,
    brushes: [{ primary: stroke(1), continuations: [] }],
  };
}

/**
 * Quick 261023-cxc: only an EMPTY destination cell inside capacity may take the
 * script path. Everything else routes back to the 261023-bxm raster clone.
 */
describe('resolveRotoDuplicateScriptDecision', () => {
  const base = {
    source: { keyId: 'key-a', appFrame: 3 },
    expectedKeyId: 'key-a',
    expectedAppFrame: 3,
    destinationKind: 'empty' as RotoDuplicateScriptDestinationKind,
    capacity: 12,
    module: 'brush' as const,
    brushStrokeCount: 2,
    aquarelleStrokeEventCount: 0,
  };

  it('falls back source-changed when no source resolves', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, source: null })).toEqual({ kind: 'fallback', reason: 'source-changed' });
  });

  it('falls back source-changed when the key identity moved', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, source: { keyId: 'key-b', appFrame: 3 } })).toEqual({ kind: 'fallback', reason: 'source-changed' });
  });

  it('falls back source-changed when the playhead moved', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, source: { keyId: 'key-a', appFrame: 4 } })).toEqual({ kind: 'fallback', reason: 'source-changed' });
  });

  it('falls back destination-occupied for a real destination cell', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, destinationKind: 'real' })).toEqual({ kind: 'fallback', reason: 'destination-occupied' });
  });

  it('falls back destination-occupied for a generated destination cell', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, destinationKind: 'generated' })).toEqual({ kind: 'fallback', reason: 'destination-occupied' });
  });

  it('falls back destination-out-of-capacity when source+1 is past capacity', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, source: { keyId: 'key-a', appFrame: 11 }, expectedAppFrame: 11, capacity: 12 }))
      .toEqual({ kind: 'fallback', reason: 'destination-out-of-capacity' });
  });

  it('falls back destination-out-of-capacity when the destination resolves absent', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, destinationKind: 'out-of-capacity' }))
      .toEqual({ kind: 'fallback', reason: 'destination-out-of-capacity' });
  });

  it('falls back no-script for a brush key with no live strokes', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, brushStrokeCount: 0 })).toEqual({ kind: 'fallback', reason: 'no-script' });
  });

  it('decides a brush script for the next frame when the source holds strokes', () => {
    expect(resolveRotoDuplicateScriptDecision(base)).toEqual({ kind: 'script', destinationFrame: 4, module: 'brush' });
  });

  it('falls back no-script for a watercolor key with no stroke events', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, module: 'watercolor', brushStrokeCount: 0, aquarelleStrokeEventCount: 0 }))
      .toEqual({ kind: 'fallback', reason: 'no-script' });
  });

  it('decides a watercolor script for the next frame when the source frame records strokes', () => {
    expect(resolveRotoDuplicateScriptDecision({ ...base, module: 'watercolor', brushStrokeCount: 0, aquarelleStrokeEventCount: 2 }))
      .toEqual({ kind: 'script', destinationFrame: 4, module: 'watercolor' });
  });
});

/**
 * The bounded destination wait: ready at the target, ready on arrival,
 * superseded on any third frame, timeout at the bound. Never an ad-hoc sleep.
 */
describe('waitForRotoDuplicateSourceFrame', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves ready immediately when the signal already reports the target', async () => {
    const source = signal({ appFrame: 4 });
    await expect(waitForRotoDuplicateSourceFrame(source, { originFrame: 3, targetFrame: 4, timeoutMs: 50 })).resolves.toBe('ready');
  });

  it('resolves ready when the signal later reaches the target', async () => {
    const source = signal({ appFrame: 3 });
    const waiting = waitForRotoDuplicateSourceFrame(source, { originFrame: 3, targetFrame: 4, timeoutMs: 50 });
    source.value = { appFrame: 4 };
    await expect(waiting).resolves.toBe('ready');
  });

  it('resolves superseded when the signal reports a third frame', async () => {
    const source = signal({ appFrame: 3 });
    const waiting = waitForRotoDuplicateSourceFrame(source, { originFrame: 3, targetFrame: 4, timeoutMs: 50 });
    source.value = { appFrame: 9 };
    await expect(waiting).resolves.toBe('superseded');
  });

  it('resolves superseded immediately when the signal starts on a third frame', async () => {
    const source = signal({ appFrame: 9 });
    await expect(waitForRotoDuplicateSourceFrame(source, { originFrame: 3, targetFrame: 4, timeoutMs: 50 })).resolves.toBe('superseded');
  });

  it('resolves timeout when neither frame arrives inside the bound', async () => {
    vi.useFakeTimers();
    const source = signal({ appFrame: 3 });
    const waiting = waitForRotoDuplicateSourceFrame(source, { originFrame: 3, targetFrame: 4, timeoutMs: 2000 });
    await vi.advanceTimersByTimeAsync(1999);
    await vi.advanceTimersByTimeAsync(1);
    await expect(waiting).resolves.toBe('timeout');
  });

  it('stops observing after a timeout — a later frame cannot resolve twice', async () => {
    vi.useFakeTimers();
    const source = signal({ appFrame: 3 });
    const waiting = waitForRotoDuplicateSourceFrame(source, { originFrame: 3, targetFrame: 4, timeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(10);
    await expect(waiting).resolves.toBe('timeout');
    expect(() => { source.value = { appFrame: 4 }; }).not.toThrow();
  });
});

interface OrchestratorHarness {
  ports: RotoDuplicateWithScriptPorts;
  calls: string[];
  setSource: (next: { keyId: string; appFrame: number } | null) => void;
}

function orchestratorHarness(overrides: Partial<RotoDuplicateWithScriptPorts> = {}): OrchestratorHarness {
  const calls: string[] = [];
  let source: { keyId: string; appFrame: number } | null = { keyId: 'key-a', appFrame: 3 };
  const ports: RotoDuplicateWithScriptPorts = {
    getSource: vi.fn(() => source),
    getDestination: vi.fn(() => 'empty' as RotoDuplicateScriptDestinationKind),
    getCapacity: vi.fn(() => 12),
    getModule: vi.fn(() => 'brush' as const),
    getBrushStrokeCount: vi.fn(() => 2),
    getAquarelleStrokeEventCount: vi.fn(() => 0),
    captureBrushScript: vi.fn(() => { calls.push('capture'); return brushScript(); }),
    getAquarelleEvents: vi.fn(() => { calls.push('capture'); return []; }),
    navigateTo: vi.fn(async (frame: number) => {
      calls.push('navigate');
      source = { keyId: 'key-destination', appFrame: frame };
      return true;
    }),
    waitForSourceFrame: vi.fn(async () => { calls.push('wait'); return 'ready' as const; }),
    applyBrushScript: vi.fn(async () => { calls.push('apply'); return true; }),
    applyAquarelleEvents: vi.fn(async () => { calls.push('apply-events'); return true; }),
    recordAquarelleScriptCopy: vi.fn(async () => { calls.push('record'); return true; }),
    ...overrides,
  };
  return { ports, calls, setSource: (next) => { source = next; } };
}

const RUN_INPUT = { sourceKeyId: 'key-a', sourceAppFrame: 3 };

describe('runRotoDuplicateWithScript', () => {
  it('captures, navigates, waits, then applies the brush script exactly once', async () => {
    const harness = orchestratorHarness();
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'handled' });
    expect(harness.calls).toEqual(['capture', 'navigate', 'wait', 'apply']);
    expect(harness.ports.applyBrushScript).toHaveBeenCalledTimes(1);
    expect(harness.ports.applyBrushScript).toHaveBeenCalledWith(brushScript());
    expect(harness.ports.navigateTo).toHaveBeenCalledWith(4);
    expect(harness.ports.waitForSourceFrame).toHaveBeenCalledWith(4);
    expect(harness.ports.applyAquarelleEvents).not.toHaveBeenCalled();
    expect(harness.ports.recordAquarelleScriptCopy).not.toHaveBeenCalled();
  });

  it('falls back without capturing or navigating when the destination is occupied', async () => {
    const harness = orchestratorHarness({ getDestination: () => 'real' });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'fallback', reason: 'destination-occupied' });
    expect(harness.ports.captureBrushScript).not.toHaveBeenCalled();
    expect(harness.ports.navigateTo).not.toHaveBeenCalled();
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('falls back without navigating when the brush capture is empty', async () => {
    const harness = orchestratorHarness({ captureBrushScript: () => null });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'fallback', reason: 'capture-failed' });
    expect(harness.ports.navigateTo).not.toHaveBeenCalled();
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('falls back when navigation fails and the source never moved', async () => {
    const harness = orchestratorHarness({ navigateTo: async () => false });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'fallback', reason: 'navigation-failed' });
    expect(harness.ports.waitForSourceFrame).not.toHaveBeenCalled();
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('aborts with the navigation message when navigation fails after the source moved', async () => {
    const harness = orchestratorHarness({
      navigateTo: async () => {
        harness.setSource({ keyId: 'key-elsewhere', appFrame: 8 });
        return false;
      },
    });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_NAVIGATION_ABORTED });
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('aborts without applying when the destination wait is superseded', async () => {
    const harness = orchestratorHarness({ waitForSourceFrame: async () => 'superseded' });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_SUPERSEDED });
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('aborts without applying when the destination wait times out', async () => {
    const harness = orchestratorHarness({ waitForSourceFrame: async () => 'timeout' });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_TIMEOUT });
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('aborts with the apply message when the brush apply fails', async () => {
    const harness = orchestratorHarness({ applyBrushScript: async () => false });
    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_APPLY_FAILED });
  });

  it('rejects to the caller when a port throws', async () => {
    const harness = orchestratorHarness({
      navigateTo: async () => { throw new Error('bridge offline'); },
    });
    await expect(runRotoDuplicateWithScript(RUN_INPUT, harness.ports)).rejects.toThrow('bridge offline');
  });
});

// Quick 261023-cxc Task 2: the watercolor branch. A recorded script event is
// projected back onto the engine-2 runtime stroke shape, then copied onto the
// destination frame with fresh mutation ids. Dry events are timeline markers,
// never paint — they stay in the apply list but are skipped by the copy.
function aquarelleToolOverrides(): {
  tip: number;
  aspect: number;
  rotation: number;
  sizeCurve: number;
  scatter: number;
  capacity: number;
  grain: number;
  wetRound: number;
} {
  return { tip: 1.1, aspect: 1, rotation: 0, sizeCurve: 1, scatter: 0.9, capacity: 1, grain: 1, wetRound: 1 };
}

function aquarelleEvent(
  recordedOrder: number,
  overrides: { playFrame?: number; cuisson?: number; engineDiffusionFrames?: number } = {},
): StudioStroke<AquarelleStrokePayload> {
  const playFrame = overrides.playFrame ?? 3;
  return {
    pts: [
      { x: 0.1, y: 0.2, p: 0.3, tx: 0.4, ty: 0.5, tw: 0.6, tick: 0 },
      { x: 0.2, y: 0.3, p: 0.4, tx: 0.5, ty: 0.6, tw: 0.7, tick: 1 },
    ],
    ticks: 1,
    cuisson: overrides.cuisson ?? 0,
    motion: null,
    brushId: 'tip-round',
    toolOverrides: aquarelleToolOverrides(),
    traceSeed: 4242,
    recordedOrder,
    playFrame,
    color: '#abcdef',
    engine: {
      tool: 'brush',
      color: '#abcdef',
      params: { size: 30, load: 70, water: 40, dry: 20, edge: 60 },
      brushId: 'tip-round',
      toolOverrides: aquarelleToolOverrides(),
      mutationId: recordedOrder,
      diffusionFrames: overrides.engineDiffusionFrames ?? overrides.cuisson ?? 0,
      timestamp: recordedOrder,
      playFrame,
    },
  };
}

function dryEvent(recordedOrder: number): AquarelleDryEvent {
  return { kind: 'dry', tick: 5, recordedOrder };
}

describe('aquarelleStrokeFromScriptEvent', () => {
  it('projects the engine payload and raw points onto the destination frame', () => {
    const projected = aquarelleStrokeFromScriptEvent(aquarelleEvent(41), 9);

    expect(projected).toEqual({
      tool: 'brush',
      color: '#abcdef',
      params: { size: 30, load: 70, water: 40, dry: 20, edge: 60 },
      brushId: 'tip-round',
      points: [
        { x: 0.1, y: 0.2, p: 0.3, tx: 0.4, ty: 0.5, tw: 0.6 },
        { x: 0.2, y: 0.3, p: 0.4, tx: 0.5, ty: 0.6, tw: 0.7 },
      ],
      toolOverrides: aquarelleToolOverrides(),
      diffusionFrames: 0,
      timestamp: 41,
      playFrame: 9,
    });
    expect(projected.points.some((point) => 'tick' in point)).toBe(false);
  });

  it('never carries the source mutation id', () => {
    const projected = aquarelleStrokeFromScriptEvent(aquarelleEvent(41), 9);
    expect('mutationId' in projected).toBe(false);
  });

  it('takes diffusionFrames from the positive cuisson', () => {
    const projected = aquarelleStrokeFromScriptEvent(
      aquarelleEvent(42, { cuisson: 12, engineDiffusionFrames: 7 }),
      9,
    );
    expect(projected.diffusionFrames).toBe(12);
  });
});

describe('copyAquarelleScriptToFrame', () => {
  it('skips Dry, allocates once per stroke in recording order, and records fresh ids', () => {
    const events = [aquarelleEvent(1), dryEvent(2), aquarelleEvent(3)];
    const allocationOrder: number[] = [];
    const recorded: Array<{ id: number; stroke: AquarelleStroke }> = [];
    let nextId = 100;

    const count = copyAquarelleScriptToFrame({
      events,
      destinationFrame: 9,
      allocateMutationId: (stroke) => {
        allocationOrder.push(stroke.timestamp);
        nextId += 1;
        return nextId;
      },
      record: (id, stroke) => {
        recorded.push({ id, stroke });
      },
    });

    expect(count).toBe(2);
    expect(allocationOrder).toEqual([1, 3]);
    expect(recorded.map((entry) => entry.id)).toEqual([101, 102]);
    expect(recorded.map((entry) => entry.stroke.mutationId)).toEqual([101, 102]);
    expect(recorded.map((entry) => entry.stroke.playFrame)).toEqual([9, 9]);
    expect(recorded.map((entry) => entry.stroke.timestamp)).toEqual([1, 3]);
  });

  it('leaves the source events untouched and in order', () => {
    const first = aquarelleEvent(1);
    const dry = dryEvent(2);
    const second = aquarelleEvent(3);
    const events = [first, dry, second];
    const before = events.map((event) => JSON.stringify(event));

    const count = copyAquarelleScriptToFrame({
      events,
      destinationFrame: 9,
      allocateMutationId: () => 500,
      record: () => undefined,
    });

    expect(count).toBe(2);
    expect(events[0]).toBe(first);
    expect(events[1]).toBe(dry);
    expect(events[2]).toBe(second);
    expect(events.map((event) => JSON.stringify(event))).toEqual(before);
    expect(first.playFrame).toBe(3);
    expect(first.engine.mutationId).toBe(1);
  });

  it('returns zero without allocating or recording when only Dry events exist', () => {
    const allocateMutationId = vi.fn(() => 1);
    const record = vi.fn();

    const count = copyAquarelleScriptToFrame({
      events: [dryEvent(1)],
      destinationFrame: 9,
      allocateMutationId,
      record,
    });

    expect(count).toBe(0);
    expect(allocateMutationId).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('runRotoDuplicateWithScript watercolor', () => {
  it('applies the whole timeline once, then records the copy on the destination frame', async () => {
    const events = [aquarelleEvent(1), dryEvent(2), aquarelleEvent(3)];
    const order: string[] = [];
    const received: Array<readonly AquarellePayloadEvent[]> = [];
    const harness = orchestratorHarness({
      getModule: () => 'watercolor' as const,
      getAquarelleStrokeEventCount: () => 2,
      getAquarelleEvents: vi.fn(() => { order.push('capture'); return events; }),
      navigateTo: vi.fn(async (frame: number) => { order.push(`navigate:${frame}`); return true; }),
      waitForSourceFrame: vi.fn(async (frame: number) => { order.push(`wait:${frame}`); return 'ready' as const; }),
      applyAquarelleEvents: vi.fn(async (receivedEvents: readonly AquarellePayloadEvent[]) => {
        order.push('apply-events');
        received.push(receivedEvents);
        return true;
      }),
      recordAquarelleScriptCopy: vi.fn(async (sourceFrame: number, destinationFrame: number) => {
        order.push(`record:${sourceFrame}->${destinationFrame}`);
        return true;
      }),
    });

    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'handled' });
    expect(order).toEqual(['capture', 'navigate:4', 'wait:4', 'apply-events', 'record:3->4']);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(events);
    expect(harness.ports.captureBrushScript).not.toHaveBeenCalled();
    expect(harness.ports.applyBrushScript).not.toHaveBeenCalled();
  });

  it('aborts without recording when the apply fails', async () => {
    const harness = orchestratorHarness({
      getModule: () => 'watercolor' as const,
      getAquarelleStrokeEventCount: () => 1,
      getAquarelleEvents: vi.fn(() => [aquarelleEvent(1)]),
      applyAquarelleEvents: vi.fn(async () => false),
    });

    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_APPLY_FAILED });
    expect(harness.ports.recordAquarelleScriptCopy).not.toHaveBeenCalled();
  });

  it('aborts with the record message when the copy fails after a successful apply', async () => {
    const harness = orchestratorHarness({
      getModule: () => 'watercolor' as const,
      getAquarelleStrokeEventCount: () => 1,
      getAquarelleEvents: vi.fn(() => [aquarelleEvent(1)]),
      applyAquarelleEvents: vi.fn(async () => true),
      recordAquarelleScriptCopy: vi.fn(async () => false),
    });

    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_RECORD_FAILED });
    expect(harness.ports.recordAquarelleScriptCopy).toHaveBeenCalledTimes(1);
    expect(harness.ports.recordAquarelleScriptCopy).toHaveBeenCalledWith(3, 4);
  });

  it('falls back no-script on a frame with only Dry events', async () => {
    const harness = orchestratorHarness({
      getModule: () => 'watercolor' as const,
      getAquarelleStrokeEventCount: () => 0,
      getAquarelleEvents: vi.fn(() => [dryEvent(1)]),
    });

    const outcome = await runRotoDuplicateWithScript(RUN_INPUT, harness.ports);

    expect(outcome).toEqual({ outcome: 'fallback', reason: 'no-script' });
    expect(harness.ports.navigateTo).not.toHaveBeenCalled();
    expect(harness.ports.applyAquarelleEvents).not.toHaveBeenCalled();
    expect(harness.ports.recordAquarelleScriptCopy).not.toHaveBeenCalled();
  });
});
