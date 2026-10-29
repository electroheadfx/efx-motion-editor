// ============================================================
//  physicsPaintRotoPlayScriptApplyBake — 261029-bks diagnostics
//  threading through the ONE Apply/Lift bake helper.
//
//  The fluid bake itself is mocked (the package suite owns its law).
//  These rows pin what the APP owes the render-split capture:
//    - `onDiagnostics` is forwarded into the bake options and reaches
//      the caller exactly once, merged with a finite adapterCreateMs;
//    - the emission lives in the helper's finally, so a failed bake
//      still reports;
//    - the callback runs AFTER `bake.dispose()` and `adapter.dispose()`;
//    - `applyAquarelleEventsToKey` passes it through and still
//      publishes the last baked frame;
//    - a throwing consumer never fails the helper (T-bks-02).
//
//  Family: physicsPaintRotoRevealBake.test.ts — normal vitest
//  .test.ts, no new config.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface BakeDiagnosticsRecord {
  path: 'timed' | 'fallback' | 'legacy';
  timelineTicks: number;
  simulatedTicks: number;
  skippedGapTicks: number;
  gapCount: number;
  settleTicks: number;
  bakeMs: number;
  encodeMs: number;
}

interface ApplyDiagnosticsRecord extends BakeDiagnosticsRecord {
  adapterCreateMs: number;
}

const harness = vi.hoisted(() => ({
  /** Ordered lifecycle log: `bake.dispose` / `adapter.dispose` / `diagnostics`. */
  log: [] as string[],
  adapterOptions: [] as Array<Record<string, unknown>>,
  bakeOptions: [] as Array<Record<string, unknown>>,
  nextDiagnostics: null as Record<string, unknown> | null,
  bakeResult: null as unknown,
  disposed: { bake: 0, adapter: 0 },
}));

vi.mock('@efxlab/efx-watercolor', () => ({
  createAquarelleEngineAdapter: (options: Record<string, unknown>) => {
    harness.adapterOptions.push(options);
    return {
      dispose: () => {
        harness.disposed.adapter += 1;
        harness.log.push('adapter.dispose');
      },
    };
  },
}));

vi.mock('@efxlab/efx-watercolor/bake', () => ({
  createAquarelleBake: (_adapter: unknown, options: Record<string, unknown>) => {
    harness.bakeOptions.push(options);
    return {
      bake: async () => {
        const consumer = options.onDiagnostics as ((record: unknown) => void) | undefined;
        if (harness.nextDiagnostics) consumer?.(harness.nextDiagnostics);
        return harness.bakeResult;
      },
      flush: async () => {},
      beginFlush: () => () => {},
      dispose: () => {
        harness.disposed.bake += 1;
        harness.log.push('bake.dispose');
      },
      interrupt: () => {},
      inFlight: 0,
    };
  },
}));

vi.mock('../engine/AquarelleCanvasLayer', () => ({
  paperPresetForStudioId: () => undefined,
}));

vi.mock('../../../lib/webpFrameCodec', () => ({
  encodeWebpFrame: vi.fn(async () => new Uint8Array([1])),
}));

import { applyAquarelleEventsToKey, bakeAquarelleEventsToFrame } from './physicsPaintRotoPlayScriptController';

const paper = { paperId: 'paper-x', grainStrength: 0.4, grainScale: 1 };
const size = { width: 8, height: 8 };

const bakedFrames = (bytes: readonly number[]) => ({
  ok: true as const,
  frames: [{ eventIndex: 0, strokeIndex: 0, tick: 0, bytes: new Uint8Array(bytes), width: 8, height: 8 }],
});

const timedDiagnostics: BakeDiagnosticsRecord = {
  path: 'timed',
  timelineTicks: 424,
  simulatedTicks: 78,
  skippedGapTicks: 335,
  gapCount: 2,
  settleTicks: 72,
  bakeMs: 12,
  encodeMs: 3,
};

beforeEach(() => {
  harness.log.length = 0;
  harness.adapterOptions.length = 0;
  harness.bakeOptions.length = 0;
  harness.nextDiagnostics = null;
  harness.bakeResult = bakedFrames([9]);
  harness.disposed.bake = 0;
  harness.disposed.adapter = 0;
});

describe('261029-bks bakeAquarelleEventsToFrame diagnostics', () => {
  it('forwards onDiagnostics into the bake options and emits once with a finite adapterCreateMs', async () => {
    harness.nextDiagnostics = { ...timedDiagnostics };
    const seen: ApplyDiagnosticsRecord[] = [];

    const baked = await bakeAquarelleEventsToFrame({
      events: [],
      size,
      paper,
      onDiagnostics: (record) => seen.push(record),
    });

    expect(baked).not.toBeNull();
    expect(typeof harness.bakeOptions[0]!.onDiagnostics).toBe('function');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject(timedDiagnostics);
    expect(Number.isFinite(seen[0]!.adapterCreateMs)).toBe(true);
    expect(seen[0]!.adapterCreateMs).toBeGreaterThanOrEqual(0);
  });

  it('still reports adapterCreateMs when the bake fails (the emission lives in the finally)', async () => {
    harness.bakeResult = { ok: false, reason: 'failed' };
    const seen: ApplyDiagnosticsRecord[] = [];

    const baked = await bakeAquarelleEventsToFrame({
      events: [],
      size,
      paper,
      onDiagnostics: (record) => seen.push(record),
    });

    expect(baked).toBeNull();
    expect(seen).toHaveLength(1);
    // No bake record was emitted — the honest zeroed fallback, never null.
    expect(seen[0]!.path).toBe('timed');
    expect(seen[0]!.timelineTicks).toBe(0);
    expect(Number.isFinite(seen[0]!.adapterCreateMs)).toBe(true);
  });

  it('disposes bake then adapter BEFORE invoking the diagnostics callback', async () => {
    harness.nextDiagnostics = { ...timedDiagnostics };

    await bakeAquarelleEventsToFrame({
      events: [],
      size,
      paper,
      onDiagnostics: () => harness.log.push('diagnostics'),
    });

    expect(harness.log).toEqual(['bake.dispose', 'adapter.dispose', 'diagnostics']);
  });

  it('a throwing onDiagnostics consumer never fails the helper', async () => {
    harness.nextDiagnostics = { ...timedDiagnostics };

    const baked = await bakeAquarelleEventsToFrame({
      events: [],
      size,
      paper,
      onDiagnostics: () => {
        throw new Error('consumer exploded');
      },
    });

    expect(baked).not.toBeNull();
    expect(Array.from(baked!.bytes)).toEqual([9]);
  });
});

describe('261029-bks applyAquarelleEventsToKey diagnostics pass-through', () => {
  it('forwards onDiagnostics to the helper and still publishes the last baked frame', async () => {
    harness.nextDiagnostics = { ...timedDiagnostics };
    const seen: ApplyDiagnosticsRecord[] = [];
    const published: Array<{ keyId: string; appFrame: number; bytes: Uint8Array; width: number; height: number }> = [];
    const publish = vi.fn(async (frame: { keyId: string; appFrame: number; bytes: Uint8Array; width: number; height: number }) => {
      published.push(frame);
      return true;
    });

    const ok = await applyAquarelleEventsToKey({
      events: [],
      target: { keyId: 'key-7', appFrame: 12 },
      size,
      paper,
      onDiagnostics: (record) => seen.push(record),
      publish,
    });

    expect(ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(Number.isFinite(seen[0]!.adapterCreateMs)).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ keyId: 'key-7', appFrame: 12, width: 8, height: 8 });
    expect(Array.from(published[0]!.bytes)).toEqual([9]);
  });
});
