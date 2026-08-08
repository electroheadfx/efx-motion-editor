import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  rotoPhysicalRevision,
  physicPaintVersion,
  _setPhysicPaintMarkDirtyCallback,
  registerRotoAlphaCanvasFrame,
} from './physicPaintStore';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from './layerStore';
import { projectStore } from './projectStore';
import { applyPhysicPaintPayload, openPhysicPaintCanvas } from '../lib/physicPaintBridge';

// Phase 43 Plan 03: store-level linked Loop Clip resolution. The canonical
// getRotoPhysicalRenderSource seam resolves linked repetition frames to the
// SOURCE key's rendered payload under a source-scoped cache revision (D-26,
// D-27 — one source cache entry serves every occurrence), surfaces the typed
// 'linked-unresolved' per-frame result as the 'loop-placeholder' render-source
// variant instead of blanking (audit finding 3, D-28 — 43-09), makes the
// end-frame read loop-aware from the interval derivation only (Pitfall 3),
// and exposes the unresolved-loop query the export preflight consumes (D-28).
// Node env, vitest run only; no jsdom, no config changes.

const LAYER = 'layer-roto-loop-clips';
const CAPACITY = 30;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`loop-store:${appFrame}:${tag}`)}`,
    width: 4,
    height: 4,
  };
}

function record(keyId: string, appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

function loopClip(
  loopId: string,
  placementStart: number,
  sourceKeyIds: readonly string[],
  repeat: number | 'infinity',
): PhysicPaintRotoLoopClip {
  return { loopId, placementStart, sourceKeyIds, repeat, mode: 'progressive' };
}

/** The five consecutive source-cycle keys A..E at frames 0..4. */
function cycleRecords(): PhysicPaintRotoRealKeyRecord[] {
  return [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 4)];
}

function installRecords(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  capacity = CAPACITY,
  interpolation: { readonly enabled: boolean; readonly mode: 'duplicate' | 'blend' } = INTERPOLATION,
): void {
  const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, records, interpolation, capacity);
  if (!result.ok) throw new Error(result.error);
}

function installLoops(loops: readonly PhysicPaintRotoLoopClip[]): void {
  const result = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, loops);
  if (!result.ok) throw new Error(result.error);
}

/** Narrowed 'real' render-source read — throws on null or any other kind. */
function expectRealSource(layerId: string, appFrame: number) {
  const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, appFrame);
  if (!source || source.kind !== 'real') {
    throw new Error(`Expected a real render source at frame ${appFrame}, got ${source?.kind ?? 'null'}.`);
  }
  return source;
}

describe('linked-loop render-source branch (D-26/D-27)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('resolves 25 timeline frames from a 5-frame cycle repeated 5 times with exactly 5 source-scoped cache identities', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 5)]);
    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER);
    expect(revision).toBeTruthy();

    const keyIds = ['A', 'B', 'C', 'D', 'E'];
    const identities = new Set<string>();
    for (let frame = 0; frame < 25; frame += 1) {
      const source = expectRealSource(LAYER, frame);
      const expectedKeyId = keyIds[frame % 5];
      expect(source.keyId, `frame ${frame} resolves to source key ${expectedKeyId}`).toBe(expectedKeyId);
      expect(source.appFrame).toBe(frame);
      expect(source.cacheRevision).toBe(`${revision}:real:${expectedKeyId}`);
      identities.add(source.cacheRevision);
    }
    expect(identities.size, 'one source cache entry serves every occurrence (D-26/D-32)').toBe(5);

    // Reference identity with the stored source record payload (HOLD-04 pattern
    // extended to linked occurrences) — no per-occurrence copy or raster.
    expect(expectRealSource(LAYER, 7).renderedFrame).toBe(physicPaintStore.getRotoRealKeyRecord(LAYER, 'C')?.payload);
    // Frames beyond the effective range stay empty.
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 25)).toBeNull();
  });

  it('one source-key paint edit invalidates the single source cache entry so every occurrence reflects it', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 5)]);
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER)!;
    const occurrences = [3, 8, 13, 18, 23]; // all resolve to source key D
    for (const frame of occurrences) {
      expect(expectRealSource(LAYER, frame).cacheRevision).toBe(`${revisionBefore}:real:D`);
    }

    const update = physicPaintStore.updateRotoPhysicalRealKeyPayload(LAYER, 'D', revisionBefore, payload(3, 'repainted'));
    expect(update.ok).toBe(true);
    if (update.ok) expect(update.changed).toBe(true);

    const revisionAfter = physicPaintStore.getRotoPhysicalContentRevision(LAYER)!;
    expect(revisionAfter).not.toBe(revisionBefore);
    for (const frame of occurrences) {
      const source = expectRealSource(LAYER, frame);
      expect(source.cacheRevision, `occurrence ${frame} invalidated by the single source edit`).toBe(`${revisionAfter}:real:D`);
      expect(source.renderedFrame.dataUrl).toBe(payload(3, 'repainted').dataUrl);
    }
  });

  it('a duplicated loop placed away from its source keys resolves through the shared source identity with zero added cache weight', () => {
    installRecords(cycleRecords());
    installLoops([
      loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 1),
      loopClip('loop-2', 15, ['A', 'B', 'C', 'D', 'E'], 1),
    ]);
    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER)!;

    const identities = new Set<string>();
    for (let frame = 0; frame < 5; frame += 1) identities.add(expectRealSource(LAYER, frame).cacheRevision);
    for (let frame = 15; frame < 20; frame += 1) {
      const source = expectRealSource(LAYER, frame);
      expect(source.keyId).toBe(['A', 'B', 'C', 'D', 'E'][frame - 15]);
      expect(source.cacheRevision).toBe(`${revision}:real:${['A', 'B', 'C', 'D', 'E'][frame - 15]}`);
      identities.add(source.cacheRevision);
    }
    expect(identities.size, 'duplicate occurrences share the source cache entries').toBe(5);
    // The gap between the two placements is empty.
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 10)).toBeNull();
  });

  it('renders spaced linked interiors with duplicate/blend semantics and one cycle-local cache identity across repeats and shared loops', () => {
    const spaced = [record('A', 0), record('B', 3), record('C', 6)];
    installRecords(spaced, CAPACITY, { enabled: true, mode: 'duplicate' });
    installLoops([
      loopClip('loop-1', 10, ['A', 'B', 'C'], 2),
      loopClip('loop-2', 24, ['A', 'B', 'C'], 1),
    ]);

    const duplicateSources = [11, 18, 25].map((frame) => physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame));
    for (const source of duplicateSources) {
      expect(source).toMatchObject({
        kind: 'generated',
        leftKeyId: 'A',
        rightKeyId: 'B',
        interpolationMode: 'duplicate',
      });
      if (!source || source.kind !== 'generated') throw new Error('Expected linked generated duplicate source.');
      expect(source.renderedFrame.dataUrl).toBe(spaced[0].payload.dataUrl);
    }
    expect(new Set(duplicateSources.map((source) => source && 'cacheRevision' in source ? source.cacheRevision : null)).size).toBe(1);
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 12)).toMatchObject({ kind: 'generated', appFrame: 12 });
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 17)).toMatchObject({ kind: 'real', keyId: 'A', appFrame: 17 });

    const originalDocument = globalThis.document;
    const outputCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ globalAlpha: 1, clearRect: vi.fn(), drawImage: vi.fn() }),
      toDataURL: () => 'data:image/png;base64,linked-loop-blend',
    } as unknown as HTMLCanvasElement;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: () => outputCanvas },
    });
    registerRotoAlphaCanvasFrame(spaced[0].payload.dataUrl, { width: 4, height: 4 } as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(spaced[1].payload.dataUrl, { width: 4, height: 4 } as HTMLCanvasElement);
    try {
      installRecords(spaced, CAPACITY, { enabled: true, mode: 'blend' });
      installLoops([loopClip('loop-blend', 10, ['A', 'B', 'C'], 2)]);
      const blend = physicPaintStore.getRotoPhysicalRenderSource(LAYER, 12);
      expect(blend).toMatchObject({
        kind: 'generated',
        appFrame: 12,
        leftKeyId: 'A',
        rightKeyId: 'B',
        interpolationMode: 'blend',
        renderedFrame: { dataUrl: 'data:image/png;base64,linked-loop-blend' },
      });
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('returns null for spaced linked gaps when interpolation is disabled', () => {
    installRecords([record('A', 0), record('B', 3), record('C', 6)]);
    installLoops([loopClip('loop-gap', 10, ['A', 'B', 'C'], 2)]);

    expect(expectRealSource(LAYER, 10).keyId).toBe('A');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 11)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 12)).toBeNull();
    expect(expectRealSource(LAYER, 13).keyId).toBe('B');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 18)).toBeNull();
  });

  it('keeps projection real/generated authority inside keyed spans while loops resolve empty frames', () => {
    const result = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      [record('A', 0), record('B', 4)],
      { enabled: true, mode: 'duplicate' },
      CAPACITY,
    );
    if (!result.ok) throw new Error(result.error);
    installLoops([loopClip('loop-1', 10, ['A', 'B'], 1)]);

    for (const frame of [1, 2, 3]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame);
      if (!source || source.kind !== 'generated') {
        throw new Error(`Expected a generated render source at frame ${frame}, got ${source?.kind ?? 'null'}.`);
      }
    }
    expect(expectRealSource(LAYER, 10).keyId).toBe('A');
    for (const frame of [11, 12, 13]) {
      expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame)).toMatchObject({ kind: 'generated', appFrame: frame });
    }
    expect(expectRealSource(LAYER, 14).keyId).toBe('B');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 15)).toBeNull();
  });
});

describe('typed linked-unresolved surfacing as the loop-placeholder variant (audit finding 3, D-31, D-28)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('maps the typed linked-unresolved query result to the loop-placeholder variant with the full contract payload and never blanks unrelated frames', () => {
    // C at frame 10 is the loop's non-owned D-24 boundary; the loop's own
    // range is [0, 6) and every non-real frame inside it is linked-unresolved.
    installRecords([record('A', 0), record('C', 10)]);
    installLoops([loopClip('loop-x', 0, ['A', 'missing-1'], 3)]);

    for (const frame of [1, 2, 3, 4, 5]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, frame);
      if (!source || source.kind !== 'loop-placeholder') {
        throw new Error(`Expected the loop-placeholder variant at frame ${frame}, got ${source?.kind ?? 'null'}.`);
      }
      // The full 43-02 typed contract payload: sufficient for the capsule
      // error state, destination placeholder, missing-source tooltip, export
      // preflight, and repair/relink actions.
      expect(source.layerId).toBe(LAYER);
      expect(source.appFrame).toBe(frame);
      expect(source.loopId).toBe('loop-x');
      expect(source.placementStart).toBe(0);
      expect(source.sourceKeyIds).toEqual(['A', 'missing-1']);
      expect(source.missingSourceKeyIds).toEqual(['missing-1']);
    }

    // Unrelated frames resolve normally: the owned real key at 0 and the
    // boundary key at 10; frames outside every range stay empty (null).
    expect(expectRealSource(LAYER, 0).keyId).toBe('A');
    expect(expectRealSource(LAYER, 10).keyId).toBe('C');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 6)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 12)).toBeNull();
  });
});

describe('loop-aware end frame (Pitfall 3, D-25/Q4)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('returns null with no loops and no keys, and for absent layers (existing behavior preserved)', () => {
    expect(physicPaintStore.getRotoPhysicalEndFrame('absent-layer')).toBeNull();
    installRecords([]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBeNull();
  });

  it('returns last real key + 1 when no loops exist (existing behavior preserved)', () => {
    installRecords([record('A', 0), record('B', 9)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(10);
  });

  it('an infinity loop extends the end to its capacity-bounded effective end, not last real key + 1', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 'infinity')]);
    // Effective end: min(parent end, capacity). The store's parent-end bound is
    // the physical capacity, so the infinity loop ends exactly at capacity.
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(CAPACITY);
  });

  it('a finite loop repeated past the last real key extends the end to the loop effective end', () => {
    installRecords(cycleRecords());
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 3)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(15);
  });

  it('the last real key wins when it extends past every loop effective end', () => {
    installRecords([...cycleRecords(), record('F', 20)]);
    installLoops([loopClip('loop-1', 0, ['A', 'B', 'C', 'D', 'E'], 2)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(21);
  });

  it('an unresolved loop still occupies its effective range on the timeline', () => {
    installRecords([]);
    installLoops([loopClip('loop-1', 3, ['missing-1'], 2)]);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER)).toBe(5);
  });
});

describe('unresolved-loop query (D-28 wiring)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  function installMixedLoops(): void {
    // B sits at frame 10 so it never truncates loop-1 (a non-owned real key at
    // or after the placement start is a D-24 boundary); loop-2 owns A and B.
    installRecords([record('A', 0), record('B', 10)]);
    installLoops([
      loopClip('loop-1', 0, ['A', 'missing-1'], 2), // unresolved, effective [0, 4)
      loopClip('loop-2', 10, ['A', 'B'], 2), // resolved, effective [10, 14)
    ]);
  }

  it('returns each unresolvable loop intersecting the window with placement and missing source key ids', () => {
    installMixedLoops();
    const unresolved = physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 0, 30);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toEqual({
      loopId: 'loop-1',
      placementStart: 0,
      effectiveEnd: 4,
      missingSourceKeyIds: ['missing-1'],
    });
  });

  it('uses half-open intersection against the effective range', () => {
    installMixedLoops();
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 2, 3)).toHaveLength(1);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 0, 4)).toHaveLength(1);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 4, 10)).toHaveLength(0);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 4, 5)).toHaveLength(0);
  });

  it('is empty when every loop resolves over the window', () => {
    installMixedLoops();
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 10, 14)).toEqual([]);
  });

  it('fails closed to an empty result for absent layers and invalid windows', () => {
    installMixedLoops();
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops('absent-layer', 0, 30)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 5, 5)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 6, 2)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, -1, 5)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalUnresolvedLoops(LAYER, 0, Number.NaN)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 2: the replace-roto-physical-map bridge acceptance applies records and
// loopClips in ONE store transition under the loopClips-aware revision
// authority (D-06/D-10), and history replays restore both in each direction.
// These specs drive the REAL bridge entry point (applyPhysicPaintPayload)
// against the REAL store, launching through the browser-fallback seam to
// register the launch operation exactly like a child window session.
// ---------------------------------------------------------------------------

const BRIDGE_LAYER = 'layer-bridge-loop-clips';
const originalWindow = globalThis.window;

function bridgeLayer(): Layer {
  return {
    id: BRIDGE_LAYER,
    name: 'Physics Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: BRIDGE_LAYER },
  };
}

function seedBridgeDocument(loops: readonly PhysicPaintRotoLoopClip[] = []): void {
  const records = cycleRecords();
  const result = physicPaintStore.replaceRotoPhysicalDocument(BRIDGE_LAYER, {
    capacity: 600,
    realKeyRecords: records,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loops),
    loopClips: loops,
  });
  if (!result.ok) throw new Error(result.error);
}

async function launchBridge(): Promise<string> {
  const opened = await openPhysicPaintCanvas({ layer: bridgeLayer(), frame: 0 });
  if (!opened.ok) throw new Error(opened.error);
  return opened.data.operationId;
}

function bridgePayload(launchOperationId: string, overrides: Record<string, unknown> = {}) {
  return {
    kind: 'replace-roto-physical-map' as const,
    operationId: `op-${crypto.randomUUID()}`,
    operationKind: 'move-key' as const,
    layerId: BRIDGE_LAYER,
    startFrame: 0,
    launchOperationId,
    expectedRevision: physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!,
    records: physicPaintStore.getRotoRealKeyRecords(BRIDGE_LAYER).map(({ keyId, appFrame, payload: recordPayload }) => ({
      keyId,
      appFrame,
      payload: recordPayload,
    })),
    interpolationEnabled: false,
    interpolationMode: 'duplicate' as const,
    selectedKeyId: null,
    selectedAppFrame: null,
    ...overrides,
  };
}

function bridgeRecordEntries(records: readonly PhysicPaintRotoRealKeyRecord[]) {
  return records.map(({ keyId, appFrame, payload: recordPayload }) => ({ keyId, appFrame, payload: recordPayload }));
}

describe('replace-roto-physical-map loopClips acceptance (D-06/D-10)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    vi.spyOn(layerStore.layers, 'peek').mockReturnValue([bridgeLayer()]);
    vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(() => ({ focus: vi.fn() })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('applies records + loopClips in one state transition under the loopClips-aware revision', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const loop = loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 3);
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;
    const physicalRevisionBefore = rotoPhysicalRevision.value;
    const visualVersionBefore = physicPaintVersion.value;

    const result = applyPhysicPaintPayload(bridgePayload(launchOperationId, { loopClips: [loop] }));

    expect(result).toMatchObject({ ok: true, kind: 'replace-roto-physical-map' });
    // One atomic transition: exactly one physical revision bump and one visual
    // notification — the store never observed records without loops or loops
    // without records.
    expect(rotoPhysicalRevision.value).toBe(physicalRevisionBefore + 1);
    expect(physicPaintVersion.value).toBe(visualVersionBefore + 1);
    expect(physicPaintStore.getRotoPhysicalLoopClips(BRIDGE_LAYER)).toEqual([loop]);
    expect(physicPaintStore.getRotoRealKeyRecords(BRIDGE_LAYER).map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const revisionAfter = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;
    expect(revisionAfter).not.toBe(revisionBefore);
    expect(revisionAfter).toBe(buildPhysicPaintRotoPhysicalRevision(cycleRecords(), INTERPOLATION, [loop]));
    expect('acceptedRevision' in result ? result.acceptedRevision : null).toBe(revisionAfter);
  });

  it('rejects a payload whose expectedRevision went stale through a loop-only change', async () => {
    seedBridgeDocument([loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 3)]);
    const launchOperationId = await launchBridge();
    const staleRevision = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;

    // A loop-only change lands through the store mutation seam: the canonical
    // revision moves even though no record changed (43-01 fingerprint).
    const loopOnly = physicPaintStore.replaceRotoPhysicalLoopClips(BRIDGE_LAYER, [loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 5)]);
    expect(loopOnly.ok).toBe(true);
    const currentRevision = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;
    expect(currentRevision).not.toBe(staleRevision);

    const result = applyPhysicPaintPayload(bridgePayload(launchOperationId, {
      expectedRevision: staleRevision,
      loopClips: [loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 9)],
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('stale');
    // Rejection mutates nothing: the loop-only state is byte-preserved.
    expect(physicPaintStore.getRotoPhysicalLoopClips(BRIDGE_LAYER)).toEqual([loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 5)]);
    expect(physicPaintStore.getRotoRealKeyRecords(BRIDGE_LAYER).map((entry) => entry.appFrame)).toEqual([0, 1, 2, 3, 4]);
    expect(physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)).toBe(currentRevision);
  });

  it('undo and redo replays each restore records and loopClips together in one transition', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const loop = loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 3);
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;

    // Original command: moves key E 4 -> 5 AND installs the loop — one
    // history-bearing commit carrying both sides of the state.
    const afterRecords = [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 5)];
    const command = bridgePayload(launchOperationId, {
      records: bridgeRecordEntries(afterRecords),
      loopClips: [loop],
    });
    const accepted = applyPhysicPaintPayload(command);
    expect(accepted.ok).toBe(true);
    const afterRevision = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;
    expect(afterRevision).not.toBe(beforeRevision);

    // Undo replay: restores the pre-command records AND the empty loop
    // collection in one acceptance.
    const undo = applyPhysicPaintPayload(bridgePayload(launchOperationId, {
      operationKind: 'undo',
      records: bridgeRecordEntries(cycleRecords()),
      loopClips: [],
      historyProvenance: {
        historyCommandId: command.operationId,
        historyDirection: 'undo',
        sourceRevision: afterRevision,
        targetRevision: beforeRevision,
      },
    }));
    expect(undo.ok).toBe(true);
    expect(physicPaintStore.getRotoRealKeyRecords(BRIDGE_LAYER).map((entry) => [entry.keyId, entry.appFrame]))
      .toEqual([['A', 0], ['B', 1], ['C', 2], ['D', 3], ['E', 4]]);
    expect(physicPaintStore.getRotoPhysicalLoopClips(BRIDGE_LAYER)).toEqual([]);
    expect(physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)).toBe(beforeRevision);

    // Redo replay: re-applies the moved key AND the loop in one acceptance.
    const redo = applyPhysicPaintPayload(bridgePayload(launchOperationId, {
      operationKind: 'redo',
      records: bridgeRecordEntries(afterRecords),
      loopClips: [loop],
      historyProvenance: {
        historyCommandId: command.operationId,
        historyDirection: 'redo',
        sourceRevision: beforeRevision,
        targetRevision: afterRevision,
      },
    }));
    expect(redo.ok).toBe(true);
    expect(physicPaintStore.getRotoRealKeyRecords(BRIDGE_LAYER).map((entry) => [entry.keyId, entry.appFrame]))
      .toEqual([['A', 0], ['B', 1], ['C', 2], ['D', 3], ['E', 5]]);
    expect(physicPaintStore.getRotoPhysicalLoopClips(BRIDGE_LAYER)).toEqual([loop]);
    expect(physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)).toBe(afterRevision);
  });

  it('rejects a replay whose staged state does not match the provenance target revision', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const loop = loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 3);
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;

    const command = bridgePayload(launchOperationId, { loopClips: [loop] });
    expect(applyPhysicPaintPayload(command).ok).toBe(true);
    const afterRevision = physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)!;

    // The staged undo state keeps a loop the target revision does not cover:
    // the staged/target mismatch must reject before any mutation.
    const forged = applyPhysicPaintPayload(bridgePayload(launchOperationId, {
      operationKind: 'undo',
      loopClips: [loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 7)],
      historyProvenance: {
        historyCommandId: command.operationId,
        historyDirection: 'undo',
        sourceRevision: afterRevision,
        targetRevision: beforeRevision,
      },
    }));
    expect(forged.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalLoopClips(BRIDGE_LAYER)).toEqual([loop]);
    expect(physicPaintStore.getRotoPhysicalContentRevision(BRIDGE_LAYER)).toBe(afterRevision);
  });

  it('a commit without the loopClips member preserves the current collection', async () => {
    const loop = loopClip('loop-1', 10, ['A', 'B', 'C', 'D', 'E'], 3);
    seedBridgeDocument([loop]);
    const launchOperationId = await launchBridge();

    const moved = [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 6)];
    const result = applyPhysicPaintPayload(bridgePayload(launchOperationId, {
      records: bridgeRecordEntries(moved),
    }));

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoRealKeyRecords(BRIDGE_LAYER).find((entry) => entry.keyId === 'E')?.appFrame).toBe(6);
    expect(physicPaintStore.getRotoPhysicalLoopClips(BRIDGE_LAYER)).toEqual([loop]);
  });
});
