/**
 * Phase 59 plan 14 — REL-02 at the PACKAGE level (MOTN-12): a motion-bearing
 * document survives save → reopen with its `railMotions` collection intact and
 * its canonical revision unchanged.
 *
 * 59-03 pinned the store-level round trip (serialize → parse → register →
 * hydrate → serialize). That proof starts AFTER the package writer and ends
 * BEFORE it: `projectLayerDocument` rebuilds every physical document at the
 * write boundary and RECOMPUTES its canonical revision, so a writer that drops
 * `railMotions` from that recompute would emit a sub-file the read-back parser
 * refuses — with the store-level pin still green because it never enters the
 * package layer. This file is the package proof.
 *
 * The three rail identities are the plan's: a Loop Clip rail (`rail-loop`), a
 * bare Key Rail with a minted id and no loop clip (`rail-bare-key`), and a
 * Reveal rail (`rail-reveal`, a loop clip carrying `railKind: 'reveal'`).
 *
 * Nothing is mocked above the IPC seam: `savePackage`, `loadEfxPaintPackage`,
 * the document parser and the canonical revision builder are the real ones.
 */

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoRailMotionRecord } from '../components/physic-paint/roto/railMotionModel';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { createPackageFixture, readPackageJson } from '../testUtils/packageFixture';
import type { PackageFixture } from '../testUtils/packageFixture';
import { buildFrameMediaRelativePath, buildLayerFileRelativePath } from './efxPaintPackage';
import { EFX_PAINT_PACKAGE_MANIFEST_FILE, loadEfxPaintPackage, savePackage } from './efxPaintPersistence';

const ipcProjectSave = vi.hoisted(() => vi.fn());
const ipcEfxPaintWriteFrameMedia = vi.hoisted(() => vi.fn());
const ipcEfxPaintReadFrameMedia = vi.hoisted(() => vi.fn());
const ipcEfxPaintWritePackageLayerFile = vi.hoisted(() => vi.fn());
const ipcEfxPaintReadPackageLayerFile = vi.hoisted(() => vi.fn());
const discardEfxPaintPackageStaging = vi.hoisted(() => vi.fn());
const preparePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const stagePhysicPaintCacheFrame = vi.hoisted(() => vi.fn());
const discardPhysicPaintCacheStaging = vi.hoisted(() => vi.fn());
const removePhysicPaintCacheEntry = vi.hoisted(() => vi.fn());
const bindEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const settleEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const hardlinkPhysicPaintCacheFrames = vi.hoisted(() => vi.fn());
const fsWriteFile = vi.hoisted(() => vi.fn());

vi.mock('./ipc', () => ({
  projectSave: ipcProjectSave,
  ipcEfxPaintWriteFrameMedia,
  ipcEfxPaintReadFrameMedia,
  ipcEfxPaintWritePackageLayerFile,
  ipcEfxPaintReadPackageLayerFile,
  discardEfxPaintPackageStaging,
  preparePhysicPaintCacheGeneration,
  stagePhysicPaintCacheFrame,
  discardPhysicPaintCacheStaging,
  removePhysicPaintCacheEntry,
  bindEfxPaintPackageTransaction,
  publishEfxPaintPackageTransaction,
  settleEfxPaintPackageTransaction,
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
  hardlinkPhysicPaintCacheFrames,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (path: string) => existsSync(path),
  mkdir: async (path: string) => {
    mkdirSync(path, { recursive: true });
  },
  remove: async (path: string) => {
    rmSync(path, { recursive: true, force: true });
  },
  readFile: async (path: string) => new Uint8Array(readFileSync(path)),
  writeFile: fsWriteFile,
}));

interface ActiveTransaction {
  readonly packageRoot: string;
  readonly stagingBasename: string;
  readonly paths: readonly string[];
}

const activeTransactions = new Map<string, ActiveTransaction>();

function installMocks(): void {
  activeTransactions.clear();

  ipcProjectSave.mockImplementation(async (project: unknown, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, new TextEncoder().encode(JSON.stringify(project)));
    return { ok: true, data: null };
  });

  ipcEfxPaintWriteFrameMedia.mockImplementation(
    async (packageDir: string, layerId: string, keyId: string, bytes: Uint8Array, stagingBasename?: string) => {
      const relativePath = buildFrameMediaRelativePath(layerId, keyId);
      const root = stagingBasename === undefined ? packageDir : join(packageDir, stagingBasename);
      const target = join(root, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      return {
        ok: true,
        data: {
          relativePath,
          digest: createHash('sha256').update(bytes).digest('hex'),
          byteLength: bytes.length,
        },
      };
    },
  );

  ipcEfxPaintWritePackageLayerFile.mockImplementation(
    async (packageDir: string, stagingBasename: string, layerFile: string, contents: string) => {
      const target = join(packageDir, stagingBasename, layerFile);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, new TextEncoder().encode(contents));
      return { ok: true, data: null };
    },
  );

  ipcEfxPaintReadPackageLayerFile.mockImplementation(async (packageDir: string, layerFile: string) => {
    const target = join(packageDir, layerFile);
    if (!existsSync(target)) return { ok: false, error: { kind: 'missing' } };
    return { ok: true, data: readFileSync(target, 'utf8') };
  });

  ipcEfxPaintReadFrameMedia.mockImplementation(async (packageDir: string, relativePath: string) => {
    const target = join(packageDir, relativePath);
    if (!existsSync(target)) return { ok: false, error: { kind: 'missing' } };
    const bytes = new Uint8Array(readFileSync(target));
    return { ok: true, data: { bytes, digest: createHash('sha256').update(bytes).digest('hex') } };
  });

  discardEfxPaintPackageStaging.mockImplementation(async (packageDir: string, stagingBasename: string) => {
    rmSync(join(packageDir, stagingBasename), { recursive: true, force: true });
    return { ok: true, data: null };
  });

  preparePhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    mkdirSync(join(cacheRoot, stagingBasename), { recursive: true });
    return { ok: true, data: { accepted: true } };
  });
  stagePhysicPaintCacheFrame.mockImplementation(
    async (cacheRoot: string, stagingBasename: string, relativePath: string, bytes: Uint8Array) => {
      const target = join(cacheRoot, stagingBasename, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      return { ok: true, data: { accepted: true } };
    },
  );
  discardPhysicPaintCacheStaging.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    rmSync(join(cacheRoot, stagingBasename), { recursive: true, force: true });
    return { ok: true, data: null };
  });
  removePhysicPaintCacheEntry.mockImplementation(async (cacheRoot: string, relative: string) => {
    rmSync(join(cacheRoot, relative), { recursive: true, force: true });
    return { ok: true, data: null };
  });

  bindEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, stagingBasename: string, paths: string[]) => {
      const transactionId = crypto.randomUUID();
      activeTransactions.set(transactionId, { packageRoot, stagingBasename, paths });
      return {
        ok: true,
        data: {
          transactionId,
          aggregateDigest: createHash('sha256').update(paths.join(' ')).digest('hex'),
          entries: [],
        },
      };
    },
  );
  publishEfxPaintPackageTransaction.mockImplementation(async (packageRoot: string, transactionId: string) => {
    const transaction = activeTransactions.get(transactionId);
    if (!transaction) return { ok: false, error: 'inactive transaction' };
    const stagedRoot = join(transaction.packageRoot, transaction.stagingBasename);
    let published = 0;
    for (const relativePath of transaction.paths) {
      const staged = join(stagedRoot, relativePath);
      if (!existsSync(staged)) continue;
      const target = join(packageRoot, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(staged, target);
      published += 1;
    }
    return { ok: true, data: { transactionId, published } };
  });
  settleEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, transactionId: string) => {
      const transaction = activeTransactions.get(transactionId);
      if (!transaction) return { ok: false, error: 'inactive transaction' };
      rmSync(join(packageRoot, transaction.stagingBasename), { recursive: true, force: true });
      activeTransactions.delete(transactionId);
      return { ok: true, data: { cleanupDeferred: false } };
    },
  );

  publishPhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    const transactionId = crypto.randomUUID();
    const canonicalRoot = join(cacheRoot, 'efx-paint');
    const replacedExisting = existsSync(canonicalRoot);
    rmSync(canonicalRoot, { recursive: true, force: true });
    cpSync(join(cacheRoot, stagingBasename), canonicalRoot, { recursive: true });
    return { ok: true, data: { accepted: true, transactionId, replacedExisting } };
  });
  settlePhysicPaintCacheGeneration.mockImplementation(async () => {
    return { ok: true, data: { accepted: true, cleanupStatus: 'complete' } };
  });
  hardlinkPhysicPaintCacheFrames.mockImplementation(async () => {
    return { ok: true, data: { accepted: true, missing: [] } };
  });
}

// ---------------------------------------------------------------- fixture ----

const INTERPOLATION = Object.freeze({ enabled: false, mode: 'duplicate' as const });

const keyRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: {
    frameIndex: appFrame,
    appFrame,
    bytes: testWebpBytes(`${keyId}:${'payload'.repeat(56)}`),
    width: 10,
    height: 10,
  },
});

const RECORDS = [keyRecord('key-1', 0), keyRecord('key-2', 4)];

/** A playscript (Standard) rail and a Reveal rail; the bare Key Rail has none. */
const LOOP_CLIPS = [
  {
    loopId: 'rail-loop',
    placementStart: 0,
    sourceKeyIds: ['key-1', 'key-2'],
    repeat: 2,
    mode: 'progressive' as const,
    syncState: 'synchronized' as const,
    provenanceState: 'attached' as const,
    phaseOrigin: 0,
    originalEndExclusive: 2,
    visibleRanges: [{ start: 0, endExclusive: 2 }],
    frameOverrides: [],
  },
  {
    loopId: 'rail-reveal',
    placementStart: 6,
    sourceKeyIds: ['key-1', 'key-2'],
    repeat: 1,
    mode: 'progressive' as const,
    railKind: 'reveal' as const,
    syncState: 'synchronized' as const,
    provenanceState: 'attached' as const,
    phaseOrigin: 6,
    originalEndExclusive: 8,
    visibleRanges: [{ start: 6, endExclusive: 8 }],
    frameOverrides: [],
  },
];

/**
 * Three rail identities in the encoder's canonical order (railId ascending,
 * channels in the fixed model order), every channel id exercised: grouped
 * Position with a seeded wiggle, Scale, Rotation beyond 360 (MOTN-09) and
 * Opacity. Canonical order is deliberate: the reopen leg returns the parsed
 * (sorted) collection, so a scrambled fixture would compare order, not data.
 */
const RAIL_MOTIONS: readonly PhysicPaintRotoRailMotionRecord[] = [
  {
    railId: 'rail-bare-key',
    anchorKeyId: 'key-2',
    channels: [
      {
        id: 'position-x',
        wiggle: 0,
        wiggleGlobal: true,
        keys: [
          { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
          // 261108-d5o: a raw linear ramp in the frozen package fixture.
          { frame: 2, value: 40, easing: 'linear', wiggle: 1.5 },
        ],
      },
      {
        id: 'position-y',
        wiggle: 0,
        wiggleGlobal: true,
        keys: [
          { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
          { frame: 2, value: -20, easing: 'ease', wiggle: 1.5 },
        ],
      },
      {
        id: 'rotation',
        wiggle: 0,
        wiggleGlobal: true,
        keys: [
          { frame: 0, value: 0, easing: 'hold', wiggle: 0 },
          // 261108-d5o: the new default token must survive the package leg too.
          { frame: 2, value: 720, easing: 'stop-motion', wiggle: 0 },
        ],
      },
    ],
  },
  {
    railId: 'rail-loop',
    anchorKeyId: 'key-1',
    channels: [
      {
        id: 'scale',
        wiggle: 0,
        wiggleGlobal: true,
        keys: [
          { frame: 0, value: 1, easing: 'ease', wiggle: 0 },
          { frame: 4, value: 2, easing: 'ease', wiggle: 0 },
        ],
      },
    ],
  },
  {
    railId: 'rail-reveal',
    anchorKeyId: 'key-1',
    channels: [
      {
        id: 'opacity',
        wiggle: 0,
        wiggleGlobal: true,
        keys: [
          { frame: 0, value: 1, easing: 'hold', wiggle: 0 },
          { frame: 3, value: 0, easing: 'ease', wiggle: 0 },
        ],
      },
    ],
  },
];

const fixtures: PackageFixture[] = [];

function motionFixture(label: string): PackageFixture {
  const fixture = createPackageFixture(label);
  fixtures.push(fixture);
  return fixture;
}

/** The save input for one layer, built through the real parser. */
function motionDocuments(
  fixture: PackageFixture,
  railMotions: readonly PhysicPaintRotoRailMotionRecord[] = RAIL_MOTIONS,
) {
  const base = createEfxPaintDocument(fixture.rotoLayerId);
  const track = base.tracks[0];
  const revision = buildPhysicPaintRotoPhysicalRevision(
    RECORDS,
    INTERPOLATION,
    LOOP_CLIPS,
    [],
    [],
    railMotions,
  );
  const physical = parsePhysicPaintRotoPhysicalDocument({
    capacity: 32,
    realKeyRecords: RECORDS,
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision,
    loopClips: LOOP_CLIPS,
    railMotions,
    incomingInterpolationBreakKeyIds: [],
  });
  const document = {
    ...base,
    tracks: [{ ...track, frames: {}, rotoPhysical: physical }],
  };
  return new Map([[fixture.rotoLayerId, { document, frames: new Map() }]]);
}

beforeEach(() => {
  vi.clearAllMocks();
  installMocks();
});

afterAll(() => {
  for (const fixture of fixtures) fixture.cleanup();
});

async function save(
  fixture: PackageFixture,
  railMotions: readonly PhysicPaintRotoRailMotionRecord[] = RAIL_MOTIONS,
) {
  return savePackage(fixture.root, {
    project: fixture.project,
    documents: motionDocuments(fixture, railMotions),
    projectId: fixture.projectId,
    cacheRoot: fixture.cacheRoot,
  });
}

async function reopen(fixture: PackageFixture) {
  const manifest = readPackageJson(fixture.root, EFX_PAINT_PACKAGE_MANIFEST_FILE);
  return loadEfxPaintPackage({ packageDir: fixture.root, manifest, machineCacheRoot: fixture.cacheRoot });
}

describe('REL-02: rail motion survives the package save → reopen boundary (59-14)', () => {
  it('reopens with the collection deep-equal and the canonical revision identical', async () => {
    const fixture = motionFixture('rail-motion-roundtrip');

    // Vacuity guard: an empty fixture must never be able to pass this proof.
    expect(RAIL_MOTIONS.length).toBe(3);
    expect(RAIL_MOTIONS.reduce((count, record) => count + record.channels.length, 0)).toBe(5);

    await save(fixture);

    // The layer sub-file on disk carries the collection in its canonical
    // (railId-sorted, channel-ordered) projection...
    const persisted = readPackageJson(fixture.root, buildLayerFileRelativePath(fixture.rotoLayerId));
    const persistedTracks = persisted.tracks as Array<{ rotoPhysical: Record<string, unknown> }>;
    const persistedPhysical = persistedTracks[0].rotoPhysical;
    expect(persistedPhysical.railMotions).toHaveLength(3);
    expect(typeof persistedPhysical.revision).toBe('string');

    // ...and the real load leg rebuilds it through the fail-closed parser.
    const loaded = await reopen(fixture);
    const reopened = loaded.get(fixture.rotoLayerId);
    expect(reopened).toBeDefined();
    const reopenedPhysical = reopened!.document.tracks[0].rotoPhysical!;

    expect(reopenedPhysical.railMotions).toEqual(RAIL_MOTIONS);
    // The reopened revision is the persisted string, character for character:
    // the read-back leg recomputed it and the parser accepted it. The Rust
    // guard path recomputes this same canonical source and `cargo test
    // services::script_library` proves it accepts the motion-bearing shape
    // (59-04) — a TS-side mock of the bridge would prove nothing.
    expect(reopenedPhysical.revision).toBe(persistedPhysical.revision);
  });

  it('puts the motion collection inside the persisted canonical revision', async () => {
    // Same document, same records, same loop clips — the ONLY difference is
    // the rail-motion collection. Two different persisted revisions mean the
    // collection is a canonical term and not presentation state (REL-02/REL-03).
    const withMotion = motionFixture('rail-motion-revision-with');
    await save(withMotion);
    const withMotionRevision = (
      readPackageJson(withMotion.root, buildLayerFileRelativePath(withMotion.rotoLayerId))
        .tracks as Array<{ rotoPhysical: { revision: string } }>
    )[0].rotoPhysical.revision;

    const withoutMotion = motionFixture('rail-motion-revision-without');
    await save(withoutMotion, []);
    const withoutMotionRevision = (
      readPackageJson(withoutMotion.root, buildLayerFileRelativePath(withoutMotion.rotoLayerId))
        .tracks as Array<{ rotoPhysical: { revision: string } }>
    )[0].rotoPhysical.revision;

    expect(withMotionRevision).not.toBe(withoutMotionRevision);
  });

  it('re-writes the reopened document to the same persisted physical bytes', async () => {
    const source = motionFixture('rail-motion-roundtrip-resave-src');
    await save(source);
    const firstPhysical = readPackageJson(
      source.root,
      buildLayerFileRelativePath(source.rotoLayerId),
    ).tracks as Array<{ rotoPhysical: unknown }>;

    const loaded = await reopen(source);
    const reopened = loaded.get(source.rotoLayerId)!;

    // Save the REOPENED document (not the original fixture input) into a fresh
    // package root — a different root starts from an empty change baseline, so
    // the writer really re-projects the sub-file instead of deduping.
    const target = motionFixture('rail-motion-roundtrip-resave-dst');
    const rewrite = await savePackage(target.root, {
      project: target.project,
      documents: new Map([[source.rotoLayerId, { document: reopened.document, frames: new Map() }]]),
      projectId: target.projectId,
      cacheRoot: target.cacheRoot,
    });
    expect(rewrite.changedFiles.length).toBeGreaterThan(0);

    const secondPhysical = readPackageJson(
      target.root,
      buildLayerFileRelativePath(source.rotoLayerId),
    ).tracks as Array<{ rotoPhysical: unknown }>;

    // The persisted physical member is the writer's own canonical projection on
    // both legs: element order, channel order and the recomputed revision match.
    expect(JSON.stringify(secondPhysical[0].rotoPhysical)).toBe(
      JSON.stringify(firstPhysical[0].rotoPhysical),
    );
  });

  it('still writes the per-key media files the records reference', async () => {
    const fixture = motionFixture('rail-motion-roundtrip-media');
    await save(fixture);
    for (const keyId of ['key-1', 'key-2']) {
      expect(existsSync(join(fixture.root, buildFrameMediaRelativePath(fixture.rotoLayerId, keyId)))).toBe(true);
    }
  });

  it('fails closed on a tampered revision rather than re-deriving it', async () => {
    const fixture = motionFixture('rail-motion-roundtrip-tampered');
    const documents = motionDocuments(fixture);
    const entry = documents.get(fixture.rotoLayerId)!;
    const physical = entry.document.tracks[0].rotoPhysical!;
    const tampered = {
      ...entry.document,
      tracks: [
        {
          ...entry.document.tracks[0],
          rotoPhysical: { ...physical, revision: 'physical-1-deadbeef' },
        },
      ],
    };
    await expect(
      savePackage(fixture.root, {
        project: fixture.project,
        documents: new Map([[fixture.rotoLayerId, { document: tampered, frames: new Map() }]]),
        projectId: fixture.projectId,
        cacheRoot: fixture.cacheRoot,
      }),
    ).rejects.toThrow(/canonical revision mismatch/i);
  });
});
