import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import {
  ROTO_DUPLICATE_SCRIPT_APPLY_FAILED,
  ROTO_DUPLICATE_SCRIPT_NAVIGATION_ABORTED,
  ROTO_DUPLICATE_SCRIPT_SUPERSEDED,
  ROTO_DUPLICATE_SCRIPT_TIMEOUT,
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
