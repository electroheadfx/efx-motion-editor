// ============================================================
//  physicsPaintRotoPlayScriptController.bake — 56-08 consume
//  branch pin.
//
//  AQUA-07 / D-21: aquarelle scripts bake through
//  createAquarelleBake in mode 'flush-survives-navigation', NOT
//  the abort-on-dispose path. Leaving the frame mid-cuisson
//  must not discard committed frames.
//
//  261027-klx: engine-1 is removed — this is the ONLY bake path, so
//  the suite also pins that no script reaches the retired renderer.
//
//  Family: physicsPaintRotoPlayScriptController.test.ts /
//  bakeHost.test.ts — normal vitest .test.ts, no new config.
// ============================================================

import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineAdapter, StudioStroke } from '@efxlab/efx-paint-host';
import type { AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import type {
  AquarelleBake,
  AquarelleBakeDiagnostics,
  AquarelleBakeFrame,
  AquarelleBakeOptions,
  AquarelleBakeResult,
} from '@efxlab/efx-watercolor/bake';
import type {
  PhysicPaintLaunchContext,
  PhysicPaintRotoAuthorityResult,
} from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import type {
  RotoGeneratedPhysicalPublication,
  RotoPlayScriptCommitResult,
  RotoPlayScriptControllerPorts,
} from './physicsPaintRotoPlayScriptController';
import { createRotoPlayScriptController } from './physicsPaintRotoPlayScriptController';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const rendered = vi.hoisted(() => vi.fn());
vi.mock('./physicsPaintRotoPlayScriptRenderer', () => ({
  renderRotoPlayScriptFrames: rendered,
  renderRotoRevealFrames: vi.fn(),
}));

function webpStub(label: string): Uint8Array {
  return testWebpBytes(label);
}

const physicalRecord = (keyId: string, appFrame: number) => ({
  keyId,
  appFrame,
  payload: { frameIndex: 0, appFrame, bytes: webpStub('e'), width: 10, height: 10 },
});

const authority = (overrides: Partial<PhysicPaintRotoAuthorityResult> = {}): PhysicPaintRotoAuthorityResult => ({
  operationId: 'authority',
  ok: true,
  projectContextId: 'context-1',
  layerId: 'layer-1',
  trackId: 'track-1',
  trackRevision: 'track-revision-1',
  documentRevision: 'document-revision-1',
  canonicalStart: 4,
  layerEndExclusive: 8,
  capacity: 4,
  physicalCapacity: 600,
  rotoRevision: 'revision-1',
  physicalRevision: 'revision-1',
  physicalRecords: [physicalRecord('key-1', 1)],
  interpolationEnabled: true,
  interpolationMode: 'duplicate',
  frames: [{ frameIndex: 0, appFrame: 1, bytes: webpStub('e'), width: 10, height: 10, source: 'real-key' }],
  interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
  ...overrides,
});

const baseScript = (x = 10): RotoPaintScript => ({
  provenance: { sessionId: 'session', layerId: 'layer-1', sourceFrame: 2 },
  sourceFrame: 2,
  sourceDisplayFrame: 2,
  sourceRevision: 1,
  brushes: [{
    primary: {
      tool: 'paint',
      points: [{ x, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }],
      color: '#123456',
      params: {
        size: 5, opacity: 80, pressure: 70, waterAmount: 20,
        dryAmount: 30, edgeDetail: 4, pickup: 2, eraseStrength: 10, antiAlias: 1,
      },
      timestamp: 1,
    },
    continuations: [],
  }],
});

interface FakeBakeHarness {
  bakeCalls: number;
  flushCalls: number;
  disposeCalls: number;
  beginFlushCalls: number;
  committed: AquarelleBakeFrame[];
  bakeEvents: unknown[];
  modeSeen: string[];
  inFlightDuringDispose: number;
  /** Set to control bake() settlement. */
  bakeGate: { promise: Promise<void>; resolve: () => void };
  framesToReturn: AquarelleBakeFrame[];
}

function makeFakeBake(committed: AquarelleBakeFrame[]): {
  bake: AquarelleBake;
  harness: FakeBakeHarness;
} {
  let resolveGate!: () => void;
  const gatePromise = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  const harness: FakeBakeHarness = {
    bakeCalls: 0,
    flushCalls: 0,
    disposeCalls: 0,
    beginFlushCalls: 0,
    committed,
    bakeEvents: [],
    modeSeen: [],
    inFlightDuringDispose: 0,
    bakeGate: { promise: gatePromise, resolve: resolveGate },
    framesToReturn: [],
  };
  let inFlight = 0;
  const bake: AquarelleBake = {
    async bake(events) {
      harness.bakeCalls += 1;
      harness.bakeEvents.push(...events);
      inFlight = events.length;
      await harness.bakeGate.promise;
      inFlight = 0;
      for (const frame of harness.framesToReturn) {
        committed.push(frame);
      }
      return { ok: true, frames: harness.framesToReturn } as AquarelleBakeResult;
    },
    async flush() {
      harness.flushCalls += 1;
      // D-21: flush settles in-flight turns (beginFlush + drain) — it does
      // NOT abort them. Resolve the gate so held produces can finish.
      harness.bakeGate.resolve();
      await harness.bakeGate.promise;
    },
    beginFlush() {
      harness.beginFlushCalls += 1;
      return () => undefined;
    },
    dispose() {
      harness.disposeCalls += 1;
      harness.inFlightDuringDispose = inFlight;
    },
    interrupt() {
      /* fake */
    },
    get inFlight() {
      return inFlight;
    },
  };
  return { bake, harness };
}

function makeAdapter(): EngineAdapter<AquarelleStrokePayload> {
  return {
    engineId: 'efx-watercolor',
    payloadCodec: {
      serialize: (s: unknown) => s as StudioStroke<AquarelleStrokePayload>,
      parse: (s: unknown) => s as StudioStroke<AquarelleStrokePayload>,
    },
    setInputLocked: () => undefined,
    setAnimationMode: () => undefined,
    getStrokes: () => [],
    renderPartialStrokes: () => undefined,
    renderAllStrokes: () => undefined,
    exportCompositeCanvas: () => document.createElement('canvas'),
    applyStroke: () => undefined,
    stepTick: () => undefined,
    captureFrame: () => document.createElement('canvas'),
    dispose: () => undefined,
  };
}

function harness(overrides: Partial<RotoPlayScriptControllerPorts> = {}) {
  const selection = { kind: 'real-key' as const, keyId: 'key-4', appFrame: 4 };
  const context: PhysicPaintLaunchContext = {
    operationId: 'launch',
    layerId: 'layer-1',
    startFrame: 4,
    width: 10,
    height: 10,
    project: { name: 'Project', saved: true, contextId: 'context-1' },
  };
  let snapshot: RotoPaintScript | null = baseScript(99);
  const library = {
    selectedId: signal<string | null>('script-1'),
    selected: signal<{ id: string } | null>({ id: 'script-1' }),
    busy: signal(false),
    loadSnapshot: vi.fn(async () => snapshot),
    saveActiveFrame: vi.fn(), activateAndLoad: vi.fn(), beginRename: vi.fn(),
    updateRenameDraft: vi.fn(), commitRename: vi.fn(), cancelRename: vi.fn(),
    requestDelete: vi.fn(), confirmDelete: vi.fn(), cancelDelete: vi.fn(),
    select: vi.fn(), updateProjectContext: vi.fn(), enterScripts: vi.fn(), refresh: vi.fn(),
    rows: signal([]),
  } as unknown as RotoPlayScriptControllerPorts['library'];
  const requestAuthority = vi.fn(async () => authority());
  const commit = vi.fn(async (publication: RotoGeneratedPhysicalPublication): Promise<RotoPlayScriptCommitResult> => ({
    ok: true,
    operationId: 'accepted-operation',
    acceptedRevision: 'revision-2',
    records: publication.records,
    interpolationMode: publication.interpolationMode,
    selectedKeyId: publication.selectedKeyId,
    selectedAppFrame: publication.selectedAppFrame,
    ...(publication.loopClips ? { loopClips: publication.loopClips } : {}),
  }));
  const ports: RotoPlayScriptControllerPorts = {
    library,
    getLaunchContext: () => context,
    getActiveTrackId: () => 'track-1',
    getSelection: () => selection,
    getMotion: () => ({ deformation: 0, position: 0 }),
    getBrushColor: () => '#103c65',
    getBackgroundMetadata: () => ({ background: 'canvas1' as const, grainStrength: 0.45 }),
    getOperationLocked: () => false,
    getSize: () => ({ width: 10, height: 10 }),
    requestAuthority,
    commit,
    stopPlayback: vi.fn(),
    log: vi.fn(),
    ...overrides,
  };
  const controller = createRotoPlayScriptController(ports);
  return { controller, library, requestAuthority, commit, setSnapshot: (next: RotoPaintScript | null) => { snapshot = next; } };
}

describe('aquarelle bake consume branch (56-08)', () => {
  beforeEach(() => {
    rendered.mockReset();
    rendered.mockImplementation(async ({ frameCount, canonicalStart, onProgress }: {
      frameCount: number; canonicalStart: number; onProgress?: (c: number, t: number) => void;
    }) => {
      const frames = Array.from({ length: frameCount }, (_, index) => ({
        frameIndex: 0,
        appFrame: canonicalStart + index,
        bytes: webpStub(String(index)),
        width: 10,
        height: 10,
      }));
      onProgress?.(frameCount, frameCount);
      return frames;
    });
  });

  it("engineId 'efx-watercolor' routes the bake through createAquarelleBake", async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [0, 1, 2].map((index) => ({
      eventIndex: index,
      strokeIndex: index,
      tick: 0,
      bytes: webpStub(String(index)),
      width: 10,
      height: 10,
    }));
    const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, _options?: AquarelleBakeOptions) => bake);
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '3';
    const confirmPromise = test.controller.confirm();
    // Let confirm reach the in-flight bake, then settle it.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fake.bakeGate.resolve();
    const ok = await confirmPromise;

    expect(createAquarelleBake).toHaveBeenCalledTimes(1);
    expect(createAquarelleAdapter).toHaveBeenCalled();
    expect(fake.bakeCalls).toBe(1);
    // Engine-1 renderer is NEVER invoked on the aquarelle branch.
    expect(rendered).not.toHaveBeenCalled();
    expect(ok).toBe(true);
    expect(test.commit).toHaveBeenCalled();
  });

  // 261022-ljt / LJT-01: the aquarelle bake already reports every committed
  // frame through AquarelleBakeOptions.onCommit — the controller must consume
  // that seam and drive the SAME progress/status signals engine-1 uses.
  it('aquarelle bake reports per-frame progress on the shared progress signal', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [0, 1, 2].map((index) => ({
      eventIndex: index,
      strokeIndex: index,
      tick: 0,
      bytes: webpStub(String(index)),
      width: 10,
      height: 10,
    }));
    let capturedOptions: AquarelleBakeOptions | undefined;
    const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, options?: AquarelleBakeOptions) => {
      capturedOptions = options;
      return bake;
    });
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '3';
    const confirmPromise = test.controller.confirm();
    // Let confirm reach the in-flight bake gate.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(capturedOptions?.onCommit).toBeTypeOf('function');
    capturedOptions!.onCommit!(fake.framesToReturn[0]!);
    capturedOptions!.onCommit!(fake.framesToReturn[1]!);
    // The gate is STILL unresolved — this is the mid-bake proof.
    expect(test.controller.progress.value).toEqual({ completed: 2, total: 3 });
    expect(test.controller.status.value).toBe('Rendering 2 / 3');

    capturedOptions!.onCommit!(fake.framesToReturn[2]!);
    expect(test.controller.progress.value).toEqual({ completed: 3, total: 3 });

    fake.bakeGate.resolve();
    const ok = await confirmPromise;

    expect(ok).toBe(true);
    expect(test.controller.progress.value).toEqual({ completed: 3, total: 3 });
  });

  it('a late aquarelle commit after cancel does not move progress', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [0, 1, 2].map((index) => ({
      eventIndex: index,
      strokeIndex: index,
      tick: 0,
      bytes: webpStub(String(index)),
      width: 10,
      height: 10,
    }));
    let capturedOptions: AquarelleBakeOptions | undefined;
    const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, options?: AquarelleBakeOptions) => {
      capturedOptions = options;
      return bake;
    });
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '3';
    const confirmPromise = test.controller.confirm();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    capturedOptions!.onCommit!(fake.framesToReturn[0]!);
    capturedOptions!.onCommit!(fake.framesToReturn[1]!);
    expect(test.controller.progress.value).toEqual({ completed: 2, total: 3 });

    test.controller.cancel();
    // The bake keeps committing after Cancel (flush-survives-navigation);
    // those commits must not reopen the dismissed dialog's progress.
    capturedOptions!.onCommit!(fake.framesToReturn[2]!);
    expect(test.controller.progress.value).toEqual({ completed: 2, total: 3 });

    fake.bakeGate.resolve();
    await confirmPromise;

    expect(test.controller.phase.value).toBe('cancelled');
  });

  it('a late aquarelle commit after dispose does not move progress', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [0, 1, 2].map((index) => ({
      eventIndex: index,
      strokeIndex: index,
      tick: 0,
      bytes: webpStub(String(index)),
      width: 10,
      height: 10,
    }));
    let capturedOptions: AquarelleBakeOptions | undefined;
    const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, options?: AquarelleBakeOptions) => {
      capturedOptions = options;
      return bake;
    });
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '3';
    const confirmPromise = test.controller.confirm();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    capturedOptions!.onCommit!(fake.framesToReturn[0]!);
    expect(test.controller.progress.value).toEqual({ completed: 1, total: 3 });

    test.controller.dispose();
    // Invoke the late commit BEFORE yielding to microtasks: the guard must be
    // synchronous, not dependent on the flush continuation.
    capturedOptions!.onCommit!(fake.framesToReturn[1]!);
    expect(test.controller.progress.value).toEqual({ completed: 1, total: 3 });

    await confirmPromise;

    expect(fake.flushCalls).toBeGreaterThan(0);
    expect(fake.disposeCalls).toBe(0);
  });

  it('committed frames clamp at the requested count', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [0, 1].map((index) => ({
      eventIndex: index,
      strokeIndex: index,
      tick: 0,
      bytes: webpStub(String(index)),
      width: 10,
      height: 10,
    }));
    let capturedOptions: AquarelleBakeOptions | undefined;
    const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, options?: AquarelleBakeOptions) => {
      capturedOptions = options;
      return bake;
    });
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '2';
    const confirmPromise = test.controller.confirm();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    for (let commit = 0; commit < 4; commit += 1) capturedOptions!.onCommit!(fake.framesToReturn[0]!);
    expect(test.controller.progress.value?.completed).toBe(2);
    expect(test.controller.progress.value?.total).toBe(2);

    fake.bakeGate.resolve();
    const ok = await confirmPromise;

    expect(ok).toBe(true);
  });

  // 261027-klx: the engine-1 fallback branch is gone, so a script WITHOUT an
  // engineId takes the SAME watercolor bake path — there is no remaining
  // renderRotoPlayScriptFrames route.
  it('a script with no engineId still bakes through createAquarelleBake — the engine-1 renderer is never called', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [0, 1, 2].map((index) => ({
      eventIndex: index,
      strokeIndex: index,
      tick: 0,
      bytes: webpStub(String(index)),
      width: 10,
      height: 10,
    }));
    const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, _options?: AquarelleBakeOptions) => bake);
    const createAquarelleAdapter = vi.fn(() => makeAdapter());
    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot(baseScript(99));

    await test.controller.openConfirmation();
    test.controller.countText.value = '3';
    const confirmPromise = test.controller.confirm();
    // Let confirm reach the in-flight bake, then settle it.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fake.bakeGate.resolve();
    const ok = await confirmPromise;

    expect(ok).toBe(true);
    expect(createAquarelleBake).toHaveBeenCalledTimes(1);
    expect(fake.bakeCalls).toBe(1);
    expect(rendered).not.toHaveBeenCalled();
    expect(test.commit).toHaveBeenCalled();
  });

  it('dispose() on an in-flight aquarelle bake neither discards committed frames nor throws', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    const kept: AquarelleBakeFrame = {
      eventIndex: 0,
      strokeIndex: 0,
      tick: 0,
      bytes: webpStub('k'),
      width: 10,
      height: 10,
    };
    fake.framesToReturn = [kept];
    const createAquarelleBake = vi.fn(() => bake);
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '1';
    const confirmPromise = test.controller.confirm();
    // Let confirm reach the in-flight bake.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(() => test.controller.dispose()).not.toThrow();
    // D-21 / AQUA-07: dispose settles the long cuisson via flush — it does
    // NOT abort-on-dispose and does NOT drop committed frames.
    expect(fake.flushCalls).toBeGreaterThan(0);
    expect(fake.disposeCalls).toBe(0);

    fake.bakeGate.resolve();
    await confirmPromise;

    expect(committed).toContain(kept);
    expect(fake.inFlightDuringDispose).toBeGreaterThanOrEqual(0);
  });

  // 261018-odm: the persisted aquarelleEvents timeline feeds bake.bake
  // exactly as recorded — no in-memory record-map dependency.
  it('a snapshot with aquarelleEvents feeds bake.bake that exact timeline (stroke + Dry) with an empty record map', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [{ eventIndex: 0, strokeIndex: 0, tick: 0, bytes: webpStub('p'), width: 10, height: 10 }];
    const createAquarelleBake = vi.fn(() => bake);
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const stroke = {
      pts: [{ x: 0.5, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0, tick: 0 }],
      ticks: 1,
      cuisson: 0,
      motion: null,
      brushId: 'wc/round-medium',
      toolOverrides: {},
      traceSeed: 1,
      recordedOrder: 10,
      playFrame: null,
      color: '#224466',
      engine: {
        tool: 'brush' as const,
        color: '#224466',
        params: { size: 12, water: 50, load: 50, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
        brushId: 'wc/round-medium',
        timestamp: 10,
      },
    };
    const dry = { kind: 'dry' as const, tick: 2, recordedOrder: 20 };
    const timeline = [stroke, dry];

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor', aquarelleEvents: timeline });

    await test.controller.openConfirmation();
    test.controller.countText.value = '1';
    const confirmPromise = test.controller.confirm();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fake.bakeGate.resolve();
    await confirmPromise;

    expect(fake.bakeCalls).toBe(1);
    expect(fake.bakeEvents).toHaveLength(2);
    expect(fake.bakeEvents[0]).toBe(stroke);
    expect(fake.bakeEvents[1]).toBe(dry);
  });

  it('a snapshot without aquarelleEvents still reaches bake.bake via the in-memory fallback', async () => {
    const committed: AquarelleBakeFrame[] = [];
    const { bake, harness: fake } = makeFakeBake(committed);
    fake.framesToReturn = [{ eventIndex: 0, strokeIndex: 0, tick: 0, bytes: webpStub('p'), width: 10, height: 10 }];
    const createAquarelleBake = vi.fn(() => bake);
    const createAquarelleAdapter = vi.fn(() => makeAdapter());

    const test = harness({ createAquarelleBake, createAquarelleAdapter });
    test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

    await test.controller.openConfirmation();
    test.controller.countText.value = '1';
    const confirmPromise = test.controller.confirm();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fake.bakeGate.resolve();
    await confirmPromise;

    expect(fake.bakeCalls).toBe(1);
    expect(fake.bakeEvents.length).toBeGreaterThan(0);
  });

  // 261030-v1t: the ON-only option pass-through and the cost evidence line.
  // OFF must stay byte-identical: one static wash, no option, no diagnostics.
  it('261030-v1t: forwards paintSeedVariation and logs the ON diagnostics line; OFF forwards neither', async () => {
    const diagnostics = (overrides: Partial<AquarelleBakeDiagnostics> = {}): AquarelleBakeDiagnostics => ({
      path: 'timed',
      timelineTicks: 0,
      simulatedTicks: 0,
      skippedGapTicks: 0,
      gapCount: 0,
      settleTicks: 0,
      bakeMs: 0,
      encodeMs: 0,
      paintSeedReplays: 0,
      ...overrides,
    });
    const run = async (variation: boolean) => {
      const committed: AquarelleBakeFrame[] = [];
      const { bake, harness: fake } = makeFakeBake(committed);
      fake.framesToReturn = [0, 1, 2].map((index) => ({
        eventIndex: index, strokeIndex: index, tick: 0, bytes: webpStub(String(index)), width: 10, height: 10,
      }));
      let capturedOptions: AquarelleBakeOptions | undefined;
      const createAquarelleBake = vi.fn((_adapter: EngineAdapter<AquarelleStrokePayload>, options?: AquarelleBakeOptions) => {
        capturedOptions = options;
        return bake;
      });
      const log = vi.fn();
      const test = harness({ createAquarelleBake, createAquarelleAdapter: vi.fn(() => makeAdapter()), log });
      test.setSnapshot({ ...baseScript(99), engineId: 'efx-watercolor' });

      await test.controller.openConfirmation();
      test.controller.mode.value = 'static';
      test.controller.countText.value = '3';
      if (variation) test.controller.setPaintSeedVariation(true);
      const confirmPromise = test.controller.confirm();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      fake.bakeGate.resolve();
      expect(await confirmPromise).toBe(true);
      return { options: capturedOptions!, log, test };
    };

    const on = await run(true);
    expect(on.options.frameCount).toBe(3);
    expect(on.options.paintSeedVariation).toBe('static');
    expect(on.options.onDiagnostics).toBeTypeOf('function');
    on.log.mockClear();
    on.options.onDiagnostics!(diagnostics({ bakeMs: 9.2, encodeMs: 1.8, simulatedTicks: 2028, paintSeedReplays: 3 }));
    expect(on.log).toHaveBeenCalledTimes(1);
    expect(on.log).toHaveBeenCalledWith('Paint seed variation · 3 replays · bake 9 ms · encode 2 ms · 2028 simulated ticks');

    const off = await run(false);
    expect(off.options.frameCount).toBe(1);
    expect('paintSeedVariation' in off.options).toBe(false);
    expect('onDiagnostics' in off.options).toBe(false);
    // OFF still logs the ordinary completion line — never the cost line.
    expect(off.log.mock.calls.some(([message]) => String(message).startsWith('Paint seed variation'))).toBe(false);
  });
});
