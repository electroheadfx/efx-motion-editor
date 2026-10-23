// ============================================================
//  studioScriptSnapshotController.test.ts — RED-first suite for
//  the never-rejecting snapshot save/restore seam
//  (quick 261023-l35).
//
//  The controller owns the bound key, the dirty baseline and the
//  failure policy; the aquarelle store is the real module store so
//  "never mutates on a refused read" is asserted against it.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AquarelleDryEvent,
  AquarellePayloadEvent,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import type { BrushOpts, PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import {
  getRecordedAquarellePayloadTimeline,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from '../view/aquarelleRecordState';
import {
  getBrushScriptFrameEntries,
  resetBrushScriptStore,
  restoreBrushScriptFrames,
} from '../view/brushScriptRecordState';
import {
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotBrushFrame,
  type StudioScriptSnapshotIdentity,
} from '../performance/studioScriptSnapshotCodec';
import {
  createStudioScriptSnapshotController,
  type StudioScriptSnapshotControllerDeps,
  type StudioScriptSnapshotOperationResult,
  type StudioScriptSnapshotReadPayload,
  type StudioScriptSnapshotWritePayload,
} from './studioScriptSnapshotController';

const IDENTITY: StudioScriptSnapshotIdentity = {
  projectId: 'project-1',
  layerId: 'layer-1',
  trackId: 'track-1',
};

function fixturePoint(index: number): StudioPoint {
  return { x: 0.1 + index * 0.1, y: 0.2 + index * 0.1, p: 0.5, tx: 0, ty: 0, tw: 0, tick: index };
}

function fixtureStroke(playFrame: number, mutationId: number): StudioStroke<AquarelleStrokePayload> {
  return {
    pts: [fixturePoint(0), fixturePoint(1)],
    ticks: 1,
    cuisson: 2,
    motion: null,
    brushId: 'round',
    toolOverrides: {},
    traceSeed: 7,
    recordedOrder: 1,
    playFrame,
    color: '#000000',
    engine: {
      tool: 'brush',
      color: '#000000',
      params: { size: 10 },
      brushId: 'round',
      mutationId,
      diffusionFrames: 2,
      timestamp: 1,
      playFrame,
    },
  };
}

function fixtureDry(): AquarelleDryEvent {
  return { kind: 'dry', tick: 4, recordedOrder: 2 };
}

function fixtureEvents(): AquarellePayloadEvent[] {
  return [fixtureStroke(7, 101), fixtureStroke(9, 102), fixtureDry()];
}

const BRUSH_PARAMS: BrushOpts = {
  size: 8,
  opacity: 80,
  pressure: 100,
  waterAmount: 30,
  dryAmount: 20,
  edgeDetail: 50,
  pickup: 10,
  eraseStrength: 0,
  antiAlias: 2,
};

function brushPoint(x: number, y: number): PenPoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 };
}

function brushStrokeFixture(mutationId: number): PaintStroke {
  return {
    tool: 'paint',
    points: [brushPoint(120.5, 240.25), brushPoint(130.75, 250.125)],
    color: '#123456',
    params: { ...BRUSH_PARAMS },
    timestamp: mutationId,
    mutationId,
  };
}

function brushFrameFixture(frame: number, mutationId: number): StudioScriptSnapshotBrushFrame {
  return {
    frame,
    complete: true,
    paintSettings: null,
    groups: [{ primary: brushStrokeFixture(mutationId), continuations: [] }],
  };
}

function encodedFixture(
  brushFrames: readonly StudioScriptSnapshotBrushFrame[] = [],
): Uint8Array {
  return encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: fixtureEvents(),
    brushFrames,
  });
}

interface Harness {
  controller: ReturnType<typeof createStudioScriptSnapshotController>;
  report: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  setSignature: (value: string) => void;
  setAuthority: (value: string | null) => void;
}

function harness(
  overrides: Partial<Pick<StudioScriptSnapshotControllerDeps, 'getLiveFrames' | 'getContentSignature' | 'getBrushFrames' | 'getAuthority'>> = {},
): Harness {
  let signature = 'sig-0';
  let authority: string | null = null;
  const report = vi.fn();
  const write = vi.fn(
    async (
      _identity: StudioScriptSnapshotIdentity,
      bytes: Uint8Array,
      _authority: string | null,
    ): Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotWritePayload>> => ({
      ok: true,
      data: { byteLength: bytes.byteLength, digest: 'digest' },
    }),
  );
  const read = vi.fn(
    async (
      _identity: StudioScriptSnapshotIdentity,
      _authority: string | null,
    ): Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>> => ({
      ok: false,
      error: { kind: 'missing' },
    }),
  );
  const controller = createStudioScriptSnapshotController({
    getIdentity: () => IDENTITY,
    getWatercolorEvents: () => getRecordedAquarellePayloadTimeline(),
    getBrushFrames: overrides.getBrushFrames ?? (() => []),
    getContentSignature: overrides.getContentSignature ?? (() => signature),
    getLiveFrames: overrides.getLiveFrames ?? (() => new Set([7, 9])),
    getAuthority: overrides.getAuthority ?? (() => authority),
    report,
    write,
    read,
  });
  return {
    controller,
    report,
    write,
    read,
    setSignature: (value: string) => {
      signature = value;
    },
    setAuthority: (value: string | null) => {
      authority = value;
    },
  };
}

beforeEach(() => {
  resetAquarelleRecordState();
  resetBrushScriptStore();
});

describe('studioScriptSnapshotController', () => {
  it('treats a missing snapshot as a silent no-op', async () => {
    const { controller, report, read } = harness();
    controller.bind(IDENTITY);
    const result = await controller.restore();
    expect(read).toHaveBeenCalledWith(IDENTITY, null);
    expect(result).toEqual({ status: 'empty', maxRestoredMutationId: 0 });
    expect(report).not.toHaveBeenCalled();
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(0);
  });

  it('restores the pruned timeline and reports the highest mutation id', async () => {
    const bytes = encodedFixture();
    const { controller, read, report } = harness({ getLiveFrames: () => new Set([7]) });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    const result = await controller.restore();
    // Frame 9 is pruned, so only the frame-7 stroke's id is restored.
    expect(result).toEqual({ status: 'restored', maxRestoredMutationId: 101 });
    const timeline = getRecordedAquarellePayloadTimeline();
    // Frame 9 is not a live real key: its stroke is pruned; Dry survives.
    expect(timeline).toHaveLength(2);
    const stroke = timeline[0] as StudioStroke<AquarelleStrokePayload>;
    expect(stroke.playFrame).toBe(7);
    expect((timeline[1] as AquarelleDryEvent).kind).toBe('dry');
    expect(report).not.toHaveBeenCalled();
  });

  it('does not prune when the live-frame set is unknown', async () => {
    const bytes = encodedFixture();
    const { controller, read } = harness({ getLiveFrames: () => null });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(3);
  });

  it('reports a corrupt snapshot ONCE and never mutates the store', async () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 201)]);
    const before = [...getRecordedAquarellePayloadTimeline()];
    const { controller, read, report } = harness();
    read.mockResolvedValue({
      ok: true,
      data: { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), digest: 'd', byteLength: 9 },
    });
    controller.bind(IDENTITY);

    expect(await controller.restore()).toEqual({ status: 'refused', maxRestoredMutationId: 0 });
    expect(await controller.restore()).toEqual({ status: 'refused', maxRestoredMutationId: 0 });
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0])).toContain('could not be restored');
    expect(String(report.mock.calls[0]?.[0])).toContain('pixels are unchanged');
    expect(getRecordedAquarellePayloadTimeline()).toEqual(before);
  });

  it('never rejects when the write fails, and reports the failure', async () => {
    const { controller, write, report } = harness();
    write.mockResolvedValue({ ok: false, error: { kind: 'io' } });
    controller.bind(IDENTITY);
    await expect(controller.saveNow()).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0])).toContain('could not be saved');
    expect(String(report.mock.calls[0]?.[0])).toContain('Painting is unaffected');
  });

  it('never rejects when the write throws', async () => {
    const { controller, write } = harness();
    write.mockRejectedValue(new Error('disk gone'));
    controller.bind(IDENTITY);
    await expect(controller.saveNow()).resolves.toBeUndefined();
  });

  it('saves the pruned bound key and clears the dirty flag', async () => {
    restoreAquarelleRecordTimeline(fixtureEvents());
    const { controller, write, setSignature } = harness({ getLiveFrames: () => new Set([7]) });
    controller.bind(IDENTITY);
    setSignature('sig-1');
    expect(controller.isDirty()).toBe(true);

    await controller.saveNow();
    expect(write).toHaveBeenCalledTimes(1);
    const [identity, bytes] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    expect(identity).toEqual(IDENTITY);
    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(2);
    expect(controller.isDirty()).toBe(false);

    // A later mutation marks it dirty again.
    setSignature('sig-2');
    expect(controller.isDirty()).toBe(true);
  });

  it('saveNow is a no-op without a bound identity', async () => {
    const { controller, write, report } = harness();
    await expect(controller.saveNow()).resolves.toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(controller.isDirty()).toBe(false);
  });

  it('restores brush frames pruned to the live real-key frames', async () => {
    const bytes = encodedFixture([brushFrameFixture(7, 201), brushFrameFixture(9, 202)]);
    const { controller, read } = harness({ getLiveFrames: () => new Set([7]) });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    expect(await controller.restore()).toEqual({ status: 'restored', maxRestoredMutationId: 101 });
    // Frame 9 is not a live real key: its brush ledger is pruned.
    expect(getBrushScriptFrameEntries().map((entry) => entry.frame)).toEqual([7]);
    expect(getBrushScriptFrameEntries()[0]?.complete).toBe(true);
  });

  it('saves the pruned brush ledger and never a stale frame', async () => {
    restoreBrushScriptFrames([brushFrameFixture(7, 201), brushFrameFixture(9, 202)]);
    const { controller, write } = harness({
      getLiveFrames: () => new Set([7]),
      getBrushFrames: () => getBrushScriptFrameEntries(),
    });
    controller.bind(IDENTITY);

    await controller.saveNow();
    const [, bytes] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
    expect(decoded.brushFrames.map((entry) => entry.frame)).toEqual([7]);
    expect(decoded.brushFrames[0]?.groups[0]?.primary.points[0]?.x).toBe(120.5);
  });

  it('does not prune brush frames when the live-frame set is unknown', async () => {
    const bytes = encodedFixture([brushFrameFixture(7, 201), brushFrameFixture(9, 202)]);
    const { controller, read } = harness({ getLiveFrames: () => null });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();
    expect(getBrushScriptFrameEntries().map((entry) => entry.frame)).toEqual([7, 9]);
  });
});

// ------------------------------------------------------------
//  quick-261023-o3n — the live package authority.
//  The controller reads the authority at PREPARE/RESTORE time
//  (never at bind), so a save-as rebind while the Studio is open
//  retargets the next save/restore; an already-prepared payload
//  keeps the authority it was prepared with.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — live package authority', () => {
  it('reads the authority at restore time and follows a change after bind', async () => {
    const { controller, read, setAuthority } = harness();
    controller.bind(IDENTITY);

    setAuthority('authority-a');
    await controller.restore();
    expect(read).toHaveBeenLastCalledWith(IDENTITY, 'authority-a');

    // A save-as republish rewrites the live authority: the NEXT restore
    // follows it. The bind did not freeze the value.
    setAuthority('authority-b');
    await controller.restore();
    expect(read).toHaveBeenLastCalledWith(IDENTITY, 'authority-b');
  });

  it('passes null through on both legs for an unsaved project', async () => {
    const { controller, read, write, setSignature } = harness();
    controller.bind(IDENTITY);

    await controller.restore();
    expect(read).toHaveBeenLastCalledWith(IDENTITY, null);

    // A mutation after the seed restore makes the save worth attempting.
    setSignature('sig-1');
    await controller.saveNow();
    expect(write).toHaveBeenCalledTimes(1);
    // Null takes the Rust cache leg; it is never coerced into a path or token.
    expect(write.mock.calls[0]?.[2]).toBeNull();
  });

  it('captures the authority at prepare time and never retargets a prepared payload', async () => {
    const { controller, write, setSignature, setAuthority } = harness();
    setSignature('sig-1');
    controller.bind(IDENTITY);
    setAuthority('authority-at-prepare');

    const pending = controller.saveNow();
    // The payload is already prepared: changing the authority now cannot
    // retroactively move the queued write to the new package.
    setAuthority('authority-after-prepare');
    await pending;

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[2]).toBe('authority-at-prepare');
  });
});

// ------------------------------------------------------------
//  quick-261023-l35 Task 3 — save discipline.
//  One 800 ms timer, at most one in-flight write, at most one
//  queued follow-up; a failed write never re-arms itself.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — save discipline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces two revision bumps inside the window into ONE write', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();
    setSignature('sig-2');
    controller.markDirty();

    await vi.advanceTimersByTimeAsync(799);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    // The single write carried the LATEST content, not the first bump.
    expect(controller.isDirty()).toBe(false);
    controller.dispose();
  });

  it('arms exactly one timer when markDirty is called twice', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();
    controller.markDirty();
    await vi.advanceTimersByTimeAsync(800);
    expect(write).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('allows ONE queued follow-up for a bump during an in-flight write', async () => {
    const { controller, write, setSignature } = harness();
    let releaseFirstWrite!: () => void;
    write.mockImplementationOnce(
      () => new Promise((resolve) => {
        releaseFirstWrite = () => resolve({ ok: true, data: { byteLength: 1, digest: 'd' } });
      }),
    );
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();
    await vi.advanceTimersByTimeAsync(800);
    expect(write).toHaveBeenCalledTimes(1);

    // Two bumps while the first write is still in flight.
    setSignature('sig-2');
    controller.markDirty();
    setSignature('sig-3');
    controller.markDirty();

    releaseFirstWrite();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(write).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it('stops after a failed write instead of re-arming itself', async () => {
    const { controller, write, report, setSignature } = harness();
    write.mockResolvedValue({ ok: false, error: { kind: 'io' } });
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();

    await vi.advanceTimersByTimeAsync(800);
    expect(write).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(write).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('does not re-report a save failure after a successful retry', async () => {
    const { controller, write, report, setSignature } = harness();
    write.mockResolvedValueOnce({ ok: false, error: { kind: 'io' } });
    controller.bind(IDENTITY);
    setSignature('sig-1');
    await controller.saveNow();
    expect(report).toHaveBeenCalledTimes(1);
    expect(controller.isDirty()).toBe(true);

    await controller.saveNow();
    expect(write).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledTimes(1);
    expect(controller.isDirty()).toBe(false);
  });

  it('clears the timer on dispose and on reset — no later write occurs', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();
    controller.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(write).not.toHaveBeenCalled();

    controller.markDirty();
    controller.reset();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(write).not.toHaveBeenCalled();
  });

  it('bind clears a pending debounce from the outgoing key', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();
    controller.bind({ ...IDENTITY, trackId: 'track-2' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(write).not.toHaveBeenCalled();
  });

  it('flushNow clears the timer and writes once', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    setSignature('sig-1');
    controller.markDirty();
    await controller.flushNow();
    expect(write).toHaveBeenCalledTimes(1);
    expect(controller.isDirty()).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('discards an older in-flight restore when a newer key is bound', async () => {
    const { controller, read } = harness();
    const bytes = encodedFixture();
    let releaseFirstRead!: (value: StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>) => void;
    read.mockImplementationOnce(
      () => new Promise((resolve) => {
        releaseFirstRead = resolve;
      }),
    );
    controller.bind(IDENTITY);
    const firstRestore = controller.restore();
    // A rapid second switch: the first decode must not seed the store.
    controller.bind({ ...IDENTITY, trackId: 'track-2' });
    releaseFirstRead({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    await expect(firstRestore).resolves.toEqual({ status: 'empty', maxRestoredMutationId: 0 });
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(0);

    // The second key restores its OWN snapshot (the container carries its key).
    const secondIdentity: StudioScriptSnapshotIdentity = { ...IDENTITY, trackId: 'track-2' };
    const secondBytes = encodeStudioScriptSnapshot({
      ...secondIdentity,
      watercolorEvents: fixtureEvents(),
    });
    read.mockResolvedValue({
      ok: true,
      data: { bytes: secondBytes, digest: 'd', byteLength: secondBytes.byteLength },
    });
    await expect(controller.restore()).resolves.toEqual({
      status: 'restored',
      maxRestoredMutationId: 102,
    });
  });
});

// ------------------------------------------------------------
//  quick-261023-l35 Task 3 — the measurement record.
//  FIXTURE-DERIVED: this environment cannot run the app, so a live
//  heavy-project measurement is not possible; this fixture mirrors
//  the g4p measured shape (40 primaries x 180 points + one
//  diffusion continuation each, three frames). The literal below is
//  the contract — a format change must fail this test loudly.
// ------------------------------------------------------------

const HEAVY_PRIMARY_POINT_COUNT = 180;
const HEAVY_GROUPS_PER_FRAME = 40;
const HEAVY_FRAME_COUNT = 3;
/** bytes — SNAP v1 container with three heavy brush frames, empty AQTL. */
const HEAVY_SNAPSHOT_BYTE_LENGTH = 631_790;

function heavyPoint(index: number): PenPoint {
  return {
    x: 800 + index * 0.5,
    y: 400 + index * 0.25,
    p: 0.5,
    tx: 0.125,
    ty: -0.375,
    tw: 0.0625,
    spd: 0.25,
  };
}

function heavyPrimary(frame: number, mutationId: number): PaintStroke {
  return {
    tool: 'paint',
    points: Array.from({ length: HEAVY_PRIMARY_POINT_COUNT }, (_, index) => heavyPoint(index)),
    color: '#123456',
    params: { ...BRUSH_PARAMS },
    timestamp: mutationId,
    mutationId,
    playFrame: frame,
  };
}

function heavyContinuation(frame: number, mutationId: number): PaintStroke {
  return {
    tool: 'paint',
    points: [],
    color: '#123456',
    params: { ...BRUSH_PARAMS },
    timestamp: mutationId,
    mutationId,
    diffusionFrames: 2,
    playFrame: frame,
  };
}

function heavyBrushFrame(frame: number): StudioScriptSnapshotBrushFrame {
  return {
    frame,
    complete: true,
    paintSettings: null,
    groups: Array.from({ length: HEAVY_GROUPS_PER_FRAME }, (_, index) => ({
      primary: heavyPrimary(frame, 1000 + index),
      continuations: [heavyContinuation(frame, 5000 + index)],
    })),
  };
}

describe('studioScriptSnapshotController — heavy fixture measurement', () => {
  it('encodes the heavy three-frame fixture to the recorded byte length', () => {
    const bytes = encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: [],
      brushFrames: Array.from({ length: HEAVY_FRAME_COUNT }, (_, index) =>
        heavyBrushFrame(100 + index),
      ),
    });
    expect(bytes.byteLength).toBe(HEAVY_SNAPSHOT_BYTE_LENGTH);
    // The whole container decodes back, so the measurement is of a legal file.
    expect(decodeStudioScriptSnapshot(bytes, IDENTITY).brushFrames).toHaveLength(HEAVY_FRAME_COUNT);
  });
});
