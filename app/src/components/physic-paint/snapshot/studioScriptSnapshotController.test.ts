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
  AquarelleStroke,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import { isAquarelleDryEvent } from '@efxlab/efx-watercolor/payload';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  getAquarelleStrokeKeyAnchors,
  getRecordedAquarellePayloadTimeline,
  purgeAquarelleFrameScript,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from '../view/aquarelleRecordState';
import {
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotIdentity,
} from '../performance/studioScriptSnapshotCodec';
import {
  STUDIO_SCRIPT_SNAPSHOT_RETIRED_FORMAT_MESSAGE,
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

function encodedFixture(): Uint8Array {
  return encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: fixtureEvents(),
  });
}

/**
 * A hand-assembled retired container (261027-klx). The v5 decoder rejects on
 * the version word alone, so a 9-byte header is a complete probe.
 */
function retiredContainer(version: number): Uint8Array {
  const bytes = new Uint8Array(9);
  const magic = 'SNP1';
  for (let index = 0; index < magic.length; index += 1) bytes[index] = magic.charCodeAt(index);
  const view = new DataView(bytes.buffer);
  view.setUint16(4, version, true); // container version
  view.setUint16(6, 0, true); // flags
  bytes[8] = 0; // rail-cleanup marker
  return bytes;
}

interface Harness {
  controller: ReturnType<typeof createStudioScriptSnapshotController>;
  report: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  setSignature: (value: string) => void;
  setAuthority: (value: string | null) => void;
  /** The launch-scoped durable-base map the Studio owns. */
  durableBaseMap: Map<string, Uint8Array | null>;
  seedDurableBases: ReturnType<typeof vi.fn>;
}

function harness(
  overrides: Partial<Pick<
    StudioScriptSnapshotControllerDeps,
    | 'getLiveFrames'
    | 'getContentSignature'
    | 'getAuthority'
    | 'getLiveKeyIds'
    | 'getForeignKeyIds'
    | 'getWatercolorKeyAnchors'
    | 'getDurableBases'
    | 'seedDurableBases'
  >> = {},
): Harness {
  let signature = 'sig-0';
  let authority: string | null = null;
  const report = vi.fn();
  // The Studio's seed port: a session-pinned base always wins; a restored base
  // fills only a missing key. `has` keeps a known-empty null distinct.
  const durableBaseMap = new Map<string, Uint8Array | null>();
  const seedDurableBases = vi.fn((bases: ReadonlyMap<string, Uint8Array | null>) => {
    for (const [keyId, bytes] of bases) {
      if (durableBaseMap.has(keyId)) continue;
      durableBaseMap.set(keyId, bytes === null ? null : new Uint8Array(bytes));
    }
  });
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
  const remove = vi.fn(
    async (
      _identity: StudioScriptSnapshotIdentity,
      _authority: string | null,
      _scope: 'cache' | 'both',
    ): Promise<StudioScriptSnapshotOperationResult<{ cacheRemoved: boolean; packageRemoved: boolean }>> => ({
      ok: true,
      data: { cacheRemoved: true, packageRemoved: false },
    }),
  );
  const controller = createStudioScriptSnapshotController({
    getIdentity: () => IDENTITY,
    getWatercolorEvents: () => getRecordedAquarellePayloadTimeline(),
    getContentSignature: overrides.getContentSignature ?? (() => signature),
    getLiveFrames: overrides.getLiveFrames ?? (() => new Set([7, 9])),
    getLiveKeyIds: overrides.getLiveKeyIds ?? (() => null),
    getForeignKeyIds: overrides.getForeignKeyIds ?? (() => null),
    getWatercolorKeyAnchors:
      overrides.getWatercolorKeyAnchors ?? (() => getAquarelleStrokeKeyAnchors()),
    getDurableBases: overrides.getDurableBases ?? (() => durableBaseMap),
    seedDurableBases: overrides.seedDurableBases ?? seedDurableBases,
    getAuthority: overrides.getAuthority ?? (() => authority),
    report,
    write,
    read,
    remove,
  });
  return {
    controller,
    report,
    write,
    read,
    remove,
    durableBaseMap,
    seedDurableBases,
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

  it('dropRetainedForFrames removes only the purged frames from the saved union', async () => {
    const bytes = encodedFixture();
    const { controller, read, write, setSignature } = harness({
      getLiveFrames: () => new Set([3, 7, 9]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    // The rail cleanup purges the session stores AND the retained union for
    // the rail frames; every other retained entry (frame 9, Dry) survives.
    purgeAquarelleFrameScript(7);
    controller.dropRetainedForFrames(new Set([7]));
    setSignature('sig-1');
    await controller.saveNow();

    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(written, IDENTITY);
    const strokeFrames = decoded.watercolorEvents
      .filter((event) => !isAquarelleDryEvent(event))
      .map((event) => (event as StudioStroke<AquarelleStrokePayload>).playFrame);
    expect(strokeFrames).toEqual([9]);
    expect(decoded.watercolorEvents.some((event) => isAquarelleDryEvent(event))).toBe(true);
  });

  it('restores the durable rail-cleanup marker from the file', async () => {
    const bytes = encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: fixtureEvents(),
      railCleanupDone: true,
    });
    const { controller, read } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();
    expect(controller.isRailCleanupDone()).toBe(true);
  });

  it('writes the rail-cleanup marker once marked', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    await controller.restore();
    expect(controller.isRailCleanupDone()).toBe(false);
    restoreAquarelleRecordTimeline(fixtureEvents());
    setSignature('sig-marker');
    controller.markRailCleanupDone();
    await controller.saveNow();
    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    expect(decodeStudioScriptSnapshot(written, IDENTITY).railCleanupDone).toBe(true);
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
    const { controller, write, report, setSignature } = harness();
    write.mockResolvedValue({ ok: false, error: { kind: 'io' } });
    controller.bind(IDENTITY);
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
    setSignature('sig-1');
    await expect(controller.saveNow()).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0])).toContain('could not be saved');
    expect(String(report.mock.calls[0]?.[0])).toContain('Painting is unaffected');
  });

  it('never rejects when the write throws', async () => {
    const { controller, write, setSignature } = harness();
    write.mockRejectedValue(new Error('disk gone'));
    controller.bind(IDENTITY);
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
    setSignature('sig-1');
    await expect(controller.saveNow()).resolves.toBeUndefined();
  });

  it('saves the bound key and clears the dirty flag', async () => {
    const { controller, write, setSignature } = harness({ getLiveFrames: () => new Set([7]) });
    controller.bind(IDENTITY);
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
    setSignature('sig-1');
    expect(controller.isDirty()).toBe(true);

    await controller.saveNow();
    expect(write).toHaveBeenCalledTimes(1);
    const [identity, bytes] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    expect(identity).toEqual(IDENTITY);
    const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
    // studio-snapshot-empty-save: no save-time prune — the frame-9 stroke
    // survives even though frame 9 is not a live key.
    expect(decoded.watercolorEvents).toHaveLength(3);
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

});

// ------------------------------------------------------------
//  261027-klx — the SNAP v5 clean break.
//
//  Container versions 1-4 carried (or implied) an engine-1 brush
//  body. They are RETIRED: the codec raises `snap-v4-retired`,
//  the controller shows ONE pinned notice per binding and seeds
//  nothing.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — SNAP v5 clean break (261027-klx)', () => {
  it('refuses every retired container version with the pinned notice', async () => {
    for (const version of [1, 2, 3, 4] as const) {
      const bytes = retiredContainer(version);
      const { controller, read, report } = harness();
      read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
      controller.bind(IDENTITY);

      expect(await controller.restore(), `version ${version}`).toEqual({
        status: 'refused',
        maxRestoredMutationId: 0,
      });
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0]?.[0]).toBe(STUDIO_SCRIPT_SNAPSHOT_RETIRED_FORMAT_MESSAGE);
    }
  });

  it('pins the exact clean-break wording and never shows the generic message', async () => {
    const bytes = retiredContainer(4);
    const { controller, read, report } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    expect(report.mock.calls[0]?.[0]).toBe(
      'Studio script snapshot could not be restored — it was written by an earlier Studio format that predates Water color only. The frame pixels are unchanged.',
    );
    expect(String(report.mock.calls[0]?.[0])).not.toContain('could not be restored (corrupt:version)');
    expect(String(report.mock.calls[0]?.[0])).not.toContain('snap-v4-retired');
  });

  it('reports exactly once per binding and re-arms on a new bind', async () => {
    const bytes = retiredContainer(4);
    const { controller, read, report } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    await controller.restore();
    await controller.restore();
    expect(report).toHaveBeenCalledTimes(1);

    // A track switch is a NEW binding: the notice is allowed again.
    controller.bind({ ...IDENTITY, trackId: 'track-2' });
    await controller.restore();
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[1]?.[0]).toBe(STUDIO_SCRIPT_SNAPSHOT_RETIRED_FORMAT_MESSAGE);
  });

  it('seeds nothing from a retired container — no rows, no anchors, no bases', async () => {
    restoreAquarelleRecordTimeline([fixtureStroke(7, 201)]);
    const before = [...getRecordedAquarellePayloadTimeline()];
    const bytes = retiredContainer(4);
    const { controller, read, seedDurableBases, report } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    expect(await controller.restore()).toEqual({ status: 'refused', maxRestoredMutationId: 0 });
    // The store was never touched: the pre-existing timeline is intact.
    expect(getRecordedAquarellePayloadTimeline()).toEqual(before);
    expect(getAquarelleStrokeKeyAnchors().size).toBe(0);
    expect(seedDurableBases).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('keeps the generic message for a genuinely unknown container version', async () => {
    const bytes = retiredContainer(6);
    const { controller, read, report } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    await controller.restore();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]?.[0]).toContain('could not be restored (corrupt:version)');
    expect(report.mock.calls[0]?.[0]).not.toBe(STUDIO_SCRIPT_SNAPSHOT_RETIRED_FORMAT_MESSAGE);
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
    restoreAquarelleRecordTimeline(fixtureEvents());
    setSignature('sig-1');
    await controller.saveNow();
    expect(write).toHaveBeenCalledTimes(1);
    // Null takes the Rust cache leg; it is never coerced into a path or token.
    expect(write.mock.calls[0]?.[2]).toBeNull();
  });

  it('captures the authority at prepare time and never retargets a prepared payload', async () => {
    const { controller, write, setSignature, setAuthority } = harness();
    controller.bind(IDENTITY);
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
    setSignature('sig-1');
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
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
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
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
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
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
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
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
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
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
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
    await controller.restore();
    restoreAquarelleRecordTimeline(fixtureEvents());
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
//  studio-snapshot-empty-save — RED-first regression suite.
//
//  A rebind (active-track switch after a rail/key deletion) resets the
//  module stores, binds the incoming key and starts its restore
//  WITHOUT awaiting it. A save prepared inside that window encoded an
//  EMPTY payload under the incoming identity and overwrote the
//  surviving rail's good snapshot (16,512 B -> 162 B). Two laws:
//    1. No save may be prepared until the CURRENT binding generation's
//       restore has settled (both restore-in-flight and refused reads).
//    2. A routine save never writes an empty payload; only an explicit
//       purge may (persistAfterPurge).
//  And pruning is non-destructive at save time: deleted-key entries
//  stay in the authoritative snapshot. The session is pruned at
//  restore, so the deleted key's script cannot reappear.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — empty-save guard (studio-snapshot-empty-save)', () => {
  it('never prepares a save while the bound key’s restore is in flight', async () => {
    const { controller, read, write, setSignature } = harness();
    const bytes = encodedFixture();
    let releaseRead!: (value: StudioScriptSnapshotOperationResult<StudioScriptSnapshotReadPayload>) => void;
    read.mockImplementationOnce(
      () => new Promise((resolve) => {
        releaseRead = resolve;
      }),
    );

    controller.bind(IDENTITY);
    const restorePromise = controller.restore();
    // The track switch already reset the module store: the incoming key's
    // content has not been seeded yet. This is the exact empty window.
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(0);

    await controller.saveNow();
    await controller.flushNow();
    // The rebuilt snapshot must never be written from an empty store.
    expect(write).not.toHaveBeenCalled();

    releaseRead({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    await restorePromise;

    // After settlement, a real mutation writes the RESTORED payload — not
    // an empty container. (liveFrames defaults to {7, 9}, so nothing prunes.)
    setSignature('sig-after-restore');
    await controller.saveNow();
    expect(write).toHaveBeenCalledTimes(1);
    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(written, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(3);
  });

  it('never writes an empty payload over a refused snapshot', async () => {
    const { controller, read, write, report, setSignature } = harness();
    read.mockResolvedValue({ ok: false, error: { kind: 'refused' } });

    controller.bind(IDENTITY);
    expect(await controller.restore()).toEqual({ status: 'refused', maxRestoredMutationId: 0 });
    // A refused read leaves the file contents UNKNOWN: an empty store says
    // nothing about what is on disk, so the dirty save must be withheld.
    setSignature('sig-dirty-empty');
    await controller.saveNow();
    expect(write).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0])).toContain('could not be restored');
  });

  it('never writes an empty payload after a missing snapshot', async () => {
    const { controller, write, setSignature } = harness();
    controller.bind(IDENTITY);
    expect(await controller.restore()).toEqual({ status: 'empty', maxRestoredMutationId: 0 });

    setSignature('sig-dirty-empty');
    await controller.saveNow();
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps deleted-key entries in the snapshot (no save-time prune)', async () => {
    const bytes = encodedFixture();
    let liveFrames: ReadonlySet<number> = new Set([7, 9]);
    const { controller, read, write, setSignature } = harness({
      getLiveFrames: () => liveFrames,
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();
    // Both frames are live at restore: the session holds both strokes.
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(3);

    // The key at frame 9 is deleted: it is no longer a live real key. The
    // save must NOT drop its script from the authoritative snapshot.
    liveFrames = new Set([7]);
    setSignature('sig-after-key-delete');
    await controller.saveNow();

    expect(write).toHaveBeenCalledTimes(1);
    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(written, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(3);
  });

  it('does not drop restore-pruned entries from the authoritative snapshot', async () => {
    const bytes = encodedFixture();
    const { controller, read, write, setSignature } = harness({
      // The key at frame 9 was deleted before this Studio session.
      getLiveFrames: () => new Set([7]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();
    // Pruned from the SESSION: the deleted key's script cannot reappear.
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(2);

    // A later mutation saves the session plus the file's pruned-out entries.
    setSignature('sig-after-restore');
    await controller.saveNow();
    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(written, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(3);
  });

  it('lets an explicit purge replace the snapshot with the purged session', async () => {
    const bytes = encodedFixture();
    const { controller, read, write, setSignature } = harness({
      getLiveFrames: () => new Set([7, 9]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    // Memory-tab purge: the removed entries must NOT come back.
    expect(purgeAquarelleFrameScript(9)).toBe(1);
    setSignature('sig-after-purge');
    await controller.persistAfterPurge();

    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(written, IDENTITY);
    expect(decoded.watercolorEvents).toHaveLength(2);
  });
});

// ------------------------------------------------------------
//  quick-261023-ors Task 2 — the purge's persistence cleanup.
//  Order law: rewrite the authoritative leg FIRST, then (only when
//  the rewrite left the store clean and an authority is bound)
//  delete the stale app-cache fallback. A failed rewrite must never
//  delete the fallback; a rebind abandons the cleanup.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — persistAfterPurge', () => {
  it('is a no-op without a bound identity', async () => {
    const { controller, write, remove, report } = harness();
    await expect(controller.persistAfterPurge()).resolves.toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('rewrites the authoritative leg, then deletes the cache leg when bound', async () => {
    const { controller, write, remove, report, setAuthority, setSignature } = harness();
    setAuthority('vault-token');
    controller.bind(IDENTITY);
    await controller.restore();
    // The purge removed entries; the store signature moved.
    setSignature('sig-purge');

    await controller.persistAfterPurge();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0]).toEqual(IDENTITY);
    expect(write.mock.calls[0]![2]).toBe('vault-token');
    // The cache deletion follows the successful rewrite and names the key.
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(IDENTITY, 'vault-token', 'cache');
    expect(report).not.toHaveBeenCalled();
    expect(controller.isDirty()).toBe(false);
  });

  it('never deletes the cache leg without an authority (the cache IS the authority)', async () => {
    const { controller, write, remove, report, setAuthority, setSignature } = harness();
    setAuthority(null);
    controller.bind(IDENTITY);
    await controller.restore();
    setSignature('sig-purge');

    await controller.persistAfterPurge();

    expect(write).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('keeps the fallback when the rewrite failed (still dirty)', async () => {
    const { controller, write, remove, report, setAuthority, setSignature } = harness();
    setAuthority('vault-token');
    write.mockResolvedValue({ ok: false, error: { kind: 'io' } });
    controller.bind(IDENTITY);
    await controller.restore();
    setSignature('sig-purge');

    await expect(controller.persistAfterPurge()).resolves.toBeUndefined();

    expect(controller.isDirty()).toBe(true);
    expect(remove).not.toHaveBeenCalled();
    // The save failure itself reports once; the purge does not add a second.
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('reports a failed cache delete ONCE and never rejects', async () => {
    const { controller, remove, report, setAuthority, setSignature } = harness();
    setAuthority('vault-token');
    remove.mockResolvedValue({ ok: false, error: { kind: 'refused' } });
    controller.bind(IDENTITY);
    await controller.restore();
    setSignature('sig-purge');

    await expect(controller.persistAfterPurge()).resolves.toBeUndefined();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]![0]).toContain('could not be cleaned after the purge');
    expect(report.mock.calls[0]![0]).toContain('refused');
  });

  it('absorbs a rejecting cache delete as an io failure report', async () => {
    const { controller, remove, report, setAuthority, setSignature } = harness();
    setAuthority('vault-token');
    remove.mockRejectedValue(new Error('boom'));
    controller.bind(IDENTITY);
    await controller.restore();
    setSignature('sig-purge');

    await expect(controller.persistAfterPurge()).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]![0]).toContain('io');
  });

  it('abandons the cleanup when the key is rebound before the rewrite completes', async () => {
    const { controller, remove, report, setAuthority, setSignature } = harness();
    setAuthority('vault-token');
    controller.bind(IDENTITY);
    await controller.restore();
    setSignature('sig-purge');
    const pending = controller.persistAfterPurge();
    // A track switch lands while the purge's flush is still awaiting the queue.
    controller.bind({ ...IDENTITY, trackId: 'track-2' });
    await pending;
    expect(remove).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------
//  261027 UAT round 2 — "six phantom guides after one new stroke".
//
//  The user deleted every key, created a new key and painted ONE
//  watercolor stroke. Six guides appeared because AQTL events carry
//  no key identity: the restore seeded the deleted key's five
//  retained strokes into the new key at the same frame number.
//
//  LAW: every watercolor seed is scoped to the owning KEY
//  (file anchor === live key at the event's playFrame). An
//  unanchored (pre-v3) event can never seed a live key, and a
//  known-empty live key map seeds nothing at all.
// ------------------------------------------------------------

function recordableAquarelleStroke(
  mutationId: number,
  playFrame: number,
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#000000',
    params: { size: 10 },
    brushId: 'round',
    points: [{ x: 0.1, y: 0.2, p: 0.5, tx: 0, ty: 0, tw: 0 }],
    mutationId,
    timestamp: 1,
    playFrame,
  };
}

function anchoredFixture(
  events: readonly AquarellePayloadEvent[],
  watercolorKeyAnchors: readonly { mutationId: number; keyId: string }[],
): Uint8Array {
  return encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: events,
    watercolorKeyAnchors,
  });
}

function durableSnapshotFixture(
  bases: readonly { keyId: string; bytes: Uint8Array | null }[],
  events: readonly AquarellePayloadEvent[] = fixtureEvents(),
  anchors: readonly { mutationId: number; keyId: string }[] = [],
): Uint8Array {
  return encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: events,
    watercolorKeyAnchors: anchors,
    durableBases: bases,
  });
}

function writtenSnapshot(write: ReturnType<typeof vi.fn>, callIndex = 0) {
  const [, bytes] = write.mock.calls[callIndex] as [StudioScriptSnapshotIdentity, Uint8Array];
  return decodeStudioScriptSnapshot(bytes, IDENTITY);
}

function seededStrokeIds(): number[] {
  return getRecordedAquarellePayloadTimeline()
    .filter((event) => !isAquarelleDryEvent(event))
    .map((event) => (event as StudioStroke<AquarelleStrokePayload>).engine.mutationId!)
    .filter((mutationId) => mutationId !== undefined);
}

describe('studioScriptSnapshotController — watercolor key anchors (261027 UAT round 2)', () => {
  it('seeds only the stroke anchored to the live key at its frame', async () => {
    // The exact UAT shape: five strokes from the deleted key and one new
    // stroke, all on playFrame 0. Only the new-key stroke may seed.
    const deleted = [917, 920, 921, 922, 923];
    const events: AquarellePayloadEvent[] = [
      ...deleted.map((mutationId) => fixtureStroke(0, mutationId)),
      fixtureStroke(0, 1259),
      fixtureDry(),
    ];
    const anchors = [
      ...deleted.map((mutationId) => ({ mutationId, keyId: 'deleted-key' })),
      { mutationId: 1259, keyId: 'new-key' },
    ];
    const bytes = anchoredFixture(events, anchors);
    const { controller, read } = harness({
      getLiveFrames: () => new Set([0]),
      getLiveKeyIds: () => new Map([[0, 'new-key']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    const result = await controller.restore();
    expect(result).toEqual({ status: 'restored', maxRestoredMutationId: 1259 });
    expect(seededStrokeIds()).toEqual([1259]);
    expect(getRecordedAquarellePayloadTimeline().some(isAquarelleDryEvent)).toBe(true);
    expect(getAquarelleStrokeKeyAnchors().get(1259)).toBe('new-key');
    expect(getAquarelleStrokeKeyAnchors().has(917)).toBe(false);
  });

  it('never seeds an unanchored stroke into a live key', async () => {
    // A legal v5 file whose anchor section is empty: identity is unprovable.
    const bytes = encodeStudioScriptSnapshot({ ...IDENTITY, watercolorEvents: fixtureEvents() });
    const { controller, read } = harness({
      getLiveFrames: () => new Set([7, 9]),
      getLiveKeyIds: () => new Map([[7, 'key-7'], [9, 'key-9']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    await controller.restore();
    // Identity is unprovable for the file's strokes; only the Dry sheet
    // action (no frame anchor) is safe to seed.
    expect(seededStrokeIds()).toEqual([]);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
    expect(getAquarelleStrokeKeyAnchors().size).toBe(0);
  });

  it('seeds nothing when every key was deleted (known-empty live key map)', async () => {
    const bytes = anchoredFixture(
      [fixtureStroke(0, 917)],
      [{ mutationId: 917, keyId: 'deleted-key' }],
    );
    const { controller, read } = harness({
      getLiveFrames: () => new Set(),
      getLiveKeyIds: () => new Map(),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    await controller.restore();
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(0);
    expect(getAquarelleStrokeKeyAnchors().size).toBe(0);
  });

  it('saves the seeded anchor and the anchor of a newly recorded stroke', async () => {
    const bytes = anchoredFixture(
      [fixtureStroke(0, 301)],
      [{ mutationId: 301, keyId: 'live-key' }],
    );
    const { controller, read, write, setSignature } = harness({
      getLiveFrames: () => new Set([0]),
      getLiveKeyIds: () => new Map([[0, 'live-key']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();
    expect(seededStrokeIds()).toEqual([301]);

    recordAquarelleStroke(302, recordableAquarelleStroke(302, 0), 'live-key');
    setSignature('sig-anchors');
    await controller.saveNow();

    const [, written] = write.mock.calls[0] as [StudioScriptSnapshotIdentity, Uint8Array];
    const decoded = decodeStudioScriptSnapshot(written, IDENTITY);
    expect(decoded.watercolorKeyAnchors).toEqual([
      { mutationId: 301, keyId: 'live-key' },
      { mutationId: 302, keyId: 'live-key' },
    ]);
  });

  // 261027 UAT round 7 (on-disk evidence: 83 strokes saved, only 2 anchored):
  // a stroke painted on a frame BEFORE its key existed had no anchor and was
  // dropped by every restore. The save now binds it to the live key at its
  // frame — and only when that frame HAS a live key (deleted-key safety).
  it('backfills an unanchored session stroke from the live key at its frame on save', async () => {
    const { controller, write, setSignature } = harness({
      getLiveFrames: () => new Set([0]),
      getLiveKeyIds: () => new Map([[0, 'live-key']]),
    });
    controller.bind(IDENTITY);
    await controller.restore();

    recordAquarelleStroke(501, recordableAquarelleStroke(501, 0));
    setSignature('sig-backfill');
    await controller.saveNow();

    expect(writtenSnapshot(write).watercolorKeyAnchors).toEqual([
      { mutationId: 501, keyId: 'live-key' },
    ]);
  });

  it('never backfills an unanchored stroke on a frame without a live key', async () => {
    const { controller, write, setSignature } = harness({
      getLiveFrames: () => new Set([0]),
      getLiveKeyIds: () => new Map(),
    });
    controller.bind(IDENTITY);
    await controller.restore();

    recordAquarelleStroke(502, recordableAquarelleStroke(502, 0));
    setSignature('sig-no-key');
    await controller.saveNow();

    expect(writtenSnapshot(write).watercolorKeyAnchors).toEqual([]);
  });
});

// ------------------------------------------------------------
//  261027 UAT round 4 — durable-base persistence.
//
//  "Move after reopen" failed because the launch-scoped
//  durable-base map was never persisted: a reopened scripted key
//  stayed UNKNOWN and the publish failed closed. The base is a
//  KEY property, so it rides the track snapshot and is seeded
//  back on restore. Absent stays fail-closed; a rastered key's
//  stale base is dropped; another track's bases never leak in.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — durable bases (261027 UAT round 4)', () => {
  const BASE_BYTES = Uint8Array.of(9, 8, 7, 6);

  it('seeds every restored durable base into the launch map', async () => {
    const bytes = durableSnapshotFixture([
      { keyId: 'key-a', bytes: BASE_BYTES },
      { keyId: 'key-b', bytes: null },
    ]);
    const { controller, read, seedDurableBases, durableBaseMap } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    await controller.restore();

    expect(seedDurableBases).toHaveBeenCalledTimes(1);
    const seeded = seedDurableBases.mock.calls[0]![0] as ReadonlyMap<string, Uint8Array | null>;
    expect([...seeded.keys()].sort()).toEqual(['key-a', 'key-b']);
    expect(seeded.get('key-a')).toEqual(BASE_BYTES);
    expect(seeded.get('key-b')).toBeNull();
    expect(durableBaseMap.get('key-a')).toEqual(BASE_BYTES);
    expect(durableBaseMap.has('key-b')).toBe(true);
  });

  it('writes the restored base together with a newly pinned base', async () => {
    const bytes = durableSnapshotFixture([{ keyId: 'key-a', bytes: BASE_BYTES }]);
    const { controller, read, write, durableBaseMap, setSignature } = harness({
      getLiveKeyIds: () => new Map([[0, 'key-b']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    durableBaseMap.set('key-b', Uint8Array.of(4, 3, 2, 1));
    setSignature('sig-durable');
    await controller.saveNow();

    expect(writtenSnapshot(write).durableBases).toEqual([
      { keyId: 'key-a', bytes: BASE_BYTES },
      { keyId: 'key-b', bytes: Uint8Array.of(4, 3, 2, 1) },
    ]);
  });

  it('lets the session base win over the retained base for the same key', async () => {
    const bytes = durableSnapshotFixture([{ keyId: 'key-a', bytes: BASE_BYTES }]);
    const { controller, read, write, durableBaseMap, setSignature } = harness({
      getLiveKeyIds: () => new Map([[0, 'key-a']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    durableBaseMap.set('key-a', Uint8Array.of(1, 1));
    setSignature('sig-session');
    await controller.saveNow();

    expect(writtenSnapshot(write).durableBases).toEqual([
      { keyId: 'key-a', bytes: Uint8Array.of(1, 1) },
    ]);
  });

  it('drops a retained base for a live key the session no longer holds (raster clear)', async () => {
    const bytes = durableSnapshotFixture([{ keyId: 'key-a', bytes: BASE_BYTES }]);
    const { controller, read, write, durableBaseMap, setSignature } = harness({
      getLiveKeyIds: () => new Map([[0, 'key-a']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    // The raster action replaces the key's content, so its pinned pre-script
    // base is stale and must not resurrect the old multiply on reopen.
    durableBaseMap.delete('key-a');
    setSignature('sig-raster');
    await controller.saveNow();

    expect(writtenSnapshot(write).durableBases).toEqual([]);
  });

  it('keeps a deleted key’s durable base in the file for undo', async () => {
    const bytes = durableSnapshotFixture([{ keyId: 'deleted-key', bytes: BASE_BYTES }]);
    const { controller, read, write, durableBaseMap, setSignature } = harness({
      getLiveKeyIds: () => new Map([[0, 'live-key']]),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    // The key is no longer live and the session map no longer holds it: the
    // retained file content survives for a later undo / restore.
    durableBaseMap.delete('deleted-key');
    setSignature('sig-undo');
    await controller.saveNow();

    expect(writtenSnapshot(write).durableBases).toEqual([
      { keyId: 'deleted-key', bytes: BASE_BYTES },
    ]);
  });

  it('never writes another track’s session base (and a base-only save is allowed)', async () => {
    const { controller, write, durableBaseMap, setSignature } = harness({
      getLiveKeyIds: () => new Map([[0, 'live-key']]),
    });
    controller.bind(IDENTITY);
    await controller.restore(); // missing snapshot: no retained content

    durableBaseMap.set('live-key', Uint8Array.of(1, 2));
    durableBaseMap.set('other-track-key', Uint8Array.of(3, 4));
    setSignature('sig-scope');
    await controller.saveNow();

    // The session is otherwise empty; the durable base alone must pass the
    // empty-save guard, and only the bound track's key may be written.
    expect(write).toHaveBeenCalledTimes(1);
    expect(writtenSnapshot(write).durableBases).toEqual([
      { keyId: 'live-key', bytes: Uint8Array.of(1, 2) },
    ]);
  });

  it('seeds no durable bases from a container without a durable-base section', async () => {
    // A legal v5 container with an empty durable-base section.
    const bytes = encodeStudioScriptSnapshot({ ...IDENTITY, watercolorEvents: fixtureEvents() });
    const { controller, read, seedDurableBases } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.length } });
    controller.bind(IDENTITY);

    await controller.restore();

    expect(seedDurableBases).toHaveBeenCalledTimes(1);
    const seeded = seedDurableBases.mock.calls[0]![0] as ReadonlyMap<string, Uint8Array | null>;
    expect(seeded.size).toBe(0);
  });

  it('never seeds durable bases from a corrupt snapshot', async () => {
    const bytes = durableSnapshotFixture([{ keyId: 'key-a', bytes: BASE_BYTES }]);
    bytes[0] = 0; // break the SNP1 magic
    const { controller, read, seedDurableBases, report } = harness();
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);

    await controller.restore();

    expect(seedDurableBases).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------
//  261027 UAT round 8 — a track's file only holds its own track.
//
//  On-disk evidence from the user's project: track A's snapshot
//  held seven strokes anchored to track B's live key (the two
//  sessions desynced during a switch). Restoring either track
//  then dropped or blended the other's script. A stroke owned by
//  another track's LIVE key is never written to this file.
// ------------------------------------------------------------

describe('studioScriptSnapshotController — foreign-track isolation (261027 UAT round 8)', () => {
  it('never writes a session stroke anchored to another track’s live key', async () => {
    const { controller, write, setSignature } = harness({
      getLiveFrames: () => new Set([0]),
      getLiveKeyIds: () => new Map([[0, 'own-key']]),
      getForeignKeyIds: () => new Set(['foreign-key']),
    });
    controller.bind(IDENTITY);
    await controller.restore(); // missing file: empty baseline

    recordAquarelleStroke(601, recordableAquarelleStroke(601, 0), 'own-key');
    recordAquarelleStroke(602, recordableAquarelleStroke(602, 0), 'foreign-key');
    setSignature('sig-foreign-session');
    await controller.saveNow();

    const decoded = writtenSnapshot(write);
    expect(decoded.watercolorEvents).toHaveLength(1);
    expect(decoded.watercolorKeyAnchors).toEqual([{ mutationId: 601, keyId: 'own-key' }]);
  });

  it('cleans foreign rows already in the file on the next save, while keeping deleted-key rows for undo', async () => {
    const bytes = anchoredFixture(
      [fixtureStroke(0, 611), fixtureStroke(0, 612), fixtureStroke(0, 613)],
      [
        { mutationId: 611, keyId: 'own-key' },
        { mutationId: 612, keyId: 'foreign-key' },
        { mutationId: 613, keyId: 'deleted-key' },
      ],
    );
    const { controller, read, write, setSignature } = harness({
      getLiveFrames: () => new Set([0]),
      getLiveKeyIds: () => new Map([[0, 'own-key']]),
      getForeignKeyIds: () => new Set(['foreign-key']),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    recordAquarelleStroke(614, recordableAquarelleStroke(614, 0), 'own-key');
    setSignature('sig-foreign-retained');
    await controller.saveNow();

    const decoded = writtenSnapshot(write);
    expect(decoded.watercolorEvents).toHaveLength(3);
    expect(decoded.watercolorKeyAnchors).toEqual([
      { mutationId: 611, keyId: 'own-key' },
      { mutationId: 613, keyId: 'deleted-key' },
      { mutationId: 614, keyId: 'own-key' },
    ]);
  });

  it('drops a retained durable base owned by another track’s live key', async () => {
    const bytes = durableSnapshotFixture([
      { keyId: 'foreign-key', bytes: null },
      { keyId: 'deleted-key', bytes: null },
    ]);
    const { controller, read, write, setSignature } = harness({
      getLiveKeyIds: () => new Map([[0, 'own-key']]),
      getForeignKeyIds: () => new Set(['foreign-key']),
    });
    read.mockResolvedValue({ ok: true, data: { bytes, digest: 'd', byteLength: bytes.byteLength } });
    controller.bind(IDENTITY);
    await controller.restore();

    recordAquarelleStroke(701, recordableAquarelleStroke(701, 0), 'own-key');
    setSignature('sig-foreign-base');
    await controller.saveNow();

    expect(writtenSnapshot(write).durableBases).toEqual([
      { keyId: 'deleted-key', bytes: null },
    ]);
  });
});
