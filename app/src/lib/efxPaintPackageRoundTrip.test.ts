import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EFX_PAINT_PACKAGE_MANIFEST_FILE, EFX_PAINT_PACKAGE_STAGING_PREFIX, loadEfxPaintPackage, savePackage } from './efxPaintPersistence';
import { resolveFrameMediaBitmap } from './efxPaintMediaRead';
import type { FrameMediaDecode, FrameMediaLru } from './efxPaintMediaRead';
import { buildFrameMediaRelativePath, buildLayerFileRelativePath, resolveMachineCachePath } from './efxPaintPackage';
import { createPackageFixture, listPackageFiles, readPackageFile, readPackageJson } from '../testUtils/packageFixture';
import type { PackageFixture } from '../testUtils/packageFixture';
import { testWebpBytes } from '../testUtils/testWebpBytes';

/**
 * 52.2-09 Task 2 (D-05, D-06, D-07, D-14): the phase's ON-DISK round-trip
 * contract. This is the only leg that can reopen what the save funnel wrote, so
 * every write-side promise plan 07 could only inspect in memory is asserted
 * here against real bytes on a real filesystem: zero raster payloads (both roto
 * collections), no machine-local path, changed-files-only writes, machine-
 * relative cache references, refusal byte-equality, a group-override media
 * round trip, and D-06 Law-1 asset identity for loop clips and photo
 * references.
 *
 * The fs boundary is REAL: the package folder and the machine cache root are
 * `mkdtemp` directories owned by the fixture, so a scan over "every emitted
 * file" is a scan over files, never over a test-authored fake.
 */
const ipcProjectSave = vi.hoisted(() => vi.fn());
const ipcEfxPaintWriteFrameMedia = vi.hoisted(() => vi.fn());
const ipcEfxPaintReadFrameMedia = vi.hoisted(() => vi.fn());
const bindEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const settleEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const hardlinkPhysicPaintCacheFrames = vi.hoisted(() => vi.fn());
const fsReadFile = vi.hoisted(() => vi.fn());
const fsWriteFile = vi.hoisted(() => vi.fn());

vi.mock('./ipc', () => ({
  projectSave: ipcProjectSave,
  ipcEfxPaintWriteFrameMedia,
  ipcEfxPaintReadFrameMedia,
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
  readFile: fsReadFile,
  writeFile: fsWriteFile,
}));

/** One bound package transaction: its staged set plus the canonical bytes at bind time. */
interface ActivePackageTransaction {
  readonly packageRoot: string;
  readonly stagingBasename: string;
  readonly paths: readonly string[];
  readonly canonicalSnapshot: Map<string, Uint8Array>;
}

const activePackageTransactions = new Map<string, ActivePackageTransaction>();
const activeCacheGenerations = new Map<string, string>();
/** A test lever: copy this many staged files to canonical, then refuse the publish. */
let publishFailureAfterCopies: number | null = null;

const fixtures: PackageFixture[] = [];

/** A fixture that is cleaned up when the file finishes. */
function useFixture(label: string): PackageFixture {
  const fixture = createPackageFixture(label);
  fixtures.push(fixture);
  return fixture;
}

/** Every canonical file under `root` — the staging generations are excluded. */
function canonicalFilesOf(root: string): Map<string, Uint8Array> {
  const snapshot = new Map<string, Uint8Array>();
  for (const relativePath of listPackageFiles(root)) {
    if (relativePath.startsWith(EFX_PAINT_PACKAGE_STAGING_PREFIX)) continue;
    if (relativePath.startsWith('.efx-paint-staging-')) continue;
    snapshot.set(relativePath, readPackageFile(root, relativePath));
  }
  return snapshot;
}

/** Restore the canonical tree to a bind-time snapshot (the transaction's rollback). */
function restoreCanonical(packageRoot: string, snapshot: Map<string, Uint8Array>): void {
  for (const relativePath of listPackageFiles(packageRoot)) {
    if (relativePath.startsWith(EFX_PAINT_PACKAGE_STAGING_PREFIX)) continue;
    if (!snapshot.has(relativePath)) rmSync(join(packageRoot, relativePath), { force: true });
  }
  for (const [relativePath, bytes] of snapshot) {
    const full = join(packageRoot, relativePath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  }
}

function installMocks(): void {
  activePackageTransactions.clear();
  activeCacheGenerations.clear();
  publishFailureAfterCopies = null;

  // The fs boundary is REAL (the file's own doc comment): `readFile`/`writeFile`
  // go to the temp dirs the fixture owns, so "every emitted file" means files.
  fsReadFile.mockImplementation(async (path: string) => new Uint8Array(readFileSync(path)));
  fsWriteFile.mockImplementation(async (path: string, bytes: Uint8Array) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
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

  ipcProjectSave.mockImplementation(async (project: unknown, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, new TextEncoder().encode(JSON.stringify(project)));
    return { ok: true, data: null };
  });

  // The native read leg (D-13): bytes plus the SHA-256 of the bytes it read,
  // with the `missing` taxonomy member the slate path keys on.
  ipcEfxPaintReadFrameMedia.mockImplementation(async (packageDir: string, relativePath: string) => {
    const target = join(packageDir, relativePath);
    if (!existsSync(target)) return { ok: false, error: { kind: 'missing' } };
    const bytes = new Uint8Array(readFileSync(target));
    return { ok: true, data: { bytes, digest: createHash('sha256').update(bytes).digest('hex') } };
  });

  bindEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, stagingBasename: string, paths: string[]) => {
      const transactionId = crypto.randomUUID();
      activePackageTransactions.set(transactionId, {
        packageRoot,
        stagingBasename,
        paths,
        canonicalSnapshot: canonicalFilesOf(packageRoot),
      });
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
    const transaction = activePackageTransactions.get(transactionId);
    if (!transaction) return { ok: false, error: 'inactive transaction' };
    const stagedRoot = join(transaction.packageRoot, transaction.stagingBasename);
    const limit = publishFailureAfterCopies ?? transaction.paths.length;
    let published = 0;
    for (const relativePath of transaction.paths.slice(0, limit)) {
      const staged = join(stagedRoot, relativePath);
      if (!existsSync(staged)) continue;
      const target = join(packageRoot, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(staged, target);
      published += 1;
    }
    if (publishFailureAfterCopies !== null) return { ok: false, error: 'publish refused by test' };
    return { ok: true, data: { transactionId, published } };
  });

  settleEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, transactionId: string, action: 'commit' | 'rollback') => {
      const transaction = activePackageTransactions.get(transactionId);
      if (!transaction) return { ok: false, error: 'inactive transaction' };
      if (action === 'rollback') restoreCanonical(packageRoot, transaction.canonicalSnapshot);
      rmSync(join(packageRoot, transaction.stagingBasename), { recursive: true, force: true });
      activePackageTransactions.delete(transactionId);
      return { ok: true, data: { cleanupDeferred: false } };
    },
  );

  publishPhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
    const transactionId = crypto.randomUUID();
    const canonicalRoot = join(cacheRoot, 'efx-paint');
    const replacedExisting = existsSync(canonicalRoot);
    rmSync(canonicalRoot, { recursive: true, force: true });
    cpSync(join(cacheRoot, stagingBasename), canonicalRoot, { recursive: true });
    activeCacheGenerations.set(transactionId, stagingBasename);
    return { ok: true, data: { accepted: true, transactionId, replacedExisting } };
  });

  settlePhysicPaintCacheGeneration.mockImplementation(
    async (cacheRoot: string, transactionId: string, _action: 'commit' | 'rollback') => {
      const stagingBasename = activeCacheGenerations.get(transactionId);
      if (stagingBasename === undefined) return { ok: false, error: 'inactive transaction' };
      rmSync(join(cacheRoot, stagingBasename), { recursive: true, force: true });
      activeCacheGenerations.delete(transactionId);
      return { ok: true, data: { accepted: true, cleanupStatus: 'complete' } };
    },
  );

  hardlinkPhysicPaintCacheFrames.mockImplementation(
    async (cacheRoot: string, stagingBasename: string, relativePaths: string[]) => {
      const missing: string[] = [];
      for (const relativePath of relativePaths) {
        const source = join(cacheRoot, 'efx-paint', relativePath);
        if (!existsSync(source)) {
          missing.push(relativePath);
          continue;
        }
        const target = join(cacheRoot, stagingBasename, relativePath);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(source));
      }
      return { ok: true, data: { accepted: true, missing } };
    },
  );
}

async function saveFixture(fixture: PackageFixture) {
  return savePackage(fixture.root, {
    project: fixture.project,
    documents: fixture.documents(),
    projectId: fixture.projectId,
    cacheRoot: fixture.cacheRoot,
  });
}

/** Reopen the fixture's package the way the open leg does: manifest, then loader. */
async function reopen(fixture: PackageFixture, machineCacheRoot: string | null = fixture.cacheRoot) {
  const manifest = readPackageJson(fixture.root, EFX_PAINT_PACKAGE_MANIFEST_FILE);
  return loadEfxPaintPackage({ packageDir: fixture.root, manifest, machineCacheRoot });
}

/** A structurally-complete `ImageBitmap` stand-in (width/height + close). */
function makeFakeBitmap(width = 8, height = 6): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

function makeFakeLru(): FrameMediaLru {
  const entries = new Map<string, ImageBitmap>();
  return {
    get: (key) => entries.get(key),
    put: (key, bitmap) => {
      entries.set(key, bitmap);
    },
  };
}

function makeFakeDecode(): FrameMediaDecode {
  return async () => makeFakeBitmap();
}

/** The persisted media reference of one keyId, read from the layer sub-file on disk. */
function persistedMediaRef(fixture: PackageFixture, layerId: string, keyId: string) {
  const layer = readPackageJson(fixture.root, buildLayerFileRelativePath(layerId));
  const tracks = layer.tracks as Array<{
    rotoPhysical?: {
      realKeyRecords: Array<{ keyId: string; payload: { bytes?: unknown; media?: { relativePath: string; digest: string } } }>;
      groupOverrideRecords?: Array<{ keyId: string; payload: { bytes?: unknown; media?: { relativePath: string; digest: string } } }>;
    };
  }>;
  const physical = tracks[0].rotoPhysical as NonNullable<typeof tracks[0]['rotoPhysical']>;
  const record = [...physical.realKeyRecords, ...(physical.groupOverrideRecords ?? [])].find(
    (candidate) => candidate.keyId === keyId,
  );
  if (!record?.payload.media) throw new Error(`no persisted media reference for ${keyId}`);
  return record.payload.media;
}

beforeEach(() => {
  vi.clearAllMocks();
  installMocks();
});

afterAll(() => {
  for (const fixture of fixtures) fixture.cleanup();
});

describe('efxPaintPackageRoundTrip: the on-disk package contract (52.2-09, D-05/D-06/D-07)', () => {
  it('reopens a saved package from its manifest index — both layers, references intact, no bytes', async () => {
    const fixture = useFixture('roundtrip');
    const result = await saveFixture(fixture);

    expect([...result.changedFiles].sort()).toEqual([
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.groupOverrideKeyIds[0]),
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.realKeyIds[0]),
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.realKeyIds[1]),
      buildLayerFileRelativePath(fixture.plainLayerId),
      buildLayerFileRelativePath(fixture.rotoLayerId),
      EFX_PAINT_PACKAGE_MANIFEST_FILE,
    ].sort());

    const loaded = await reopen(fixture);

    expect([...loaded.keys()].sort()).toEqual([fixture.plainLayerId, fixture.rotoLayerId].sort());
    const roto = loaded.get(fixture.rotoLayerId) as NonNullable<ReturnType<typeof loaded.get>>;
    expect(roto.document.parentLayerId).toBe(fixture.rotoLayerId);
    const physical = roto.document.tracks[0].rotoPhysical!;
    expect(physical.realKeyRecords.map((record) => record.keyId)).toEqual([...fixture.realKeyIds]);
    for (const record of physical.realKeyRecords) {
      expect(record.payload.media?.relativePath).toBe(
        buildFrameMediaRelativePath(fixture.rotoLayerId, record.keyId),
      );
      expect(record.payload.bytes).toBeUndefined();
    }
    expect(physical.groupOverrideRecords?.[0].payload.media?.relativePath).toBe(
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.groupOverrideKeyIds[0]),
    );
    expect(physical.groupOverrideRecords?.[0].payload.bytes).toBeUndefined();
    // D-14: the load installs no placeholder bytes anywhere — the frames map is
    // empty rather than a buffer claiming to be content.
    expect(roto.frames.size).toBe(0);
    expect((loaded.get(fixture.plainLayerId) as NonNullable<ReturnType<typeof loaded.get>>).frames.size).toBe(0);
  });

  it('recomputes the machine-local cache location and never reads the cache file (D-05, D-14)', async () => {
    const fixture = useFixture('cache-location');
    await saveFixture(fixture);
    // The derived-frame sidecar exists under the MACHINE root, out of the package.
    const cacheFile = join(fixture.cacheRoot, fixture.derivedFrameRef);
    expect(existsSync(cacheFile)).toBe(true);

    const loaded = await reopen(fixture);
    const roto = loaded.get(fixture.rotoLayerId) as NonNullable<ReturnType<typeof loaded.get>>;

    expect(roto.cacheLocations.get(fixture.trackId)?.get(0)).toBe(
      resolveMachineCachePath(fixture.cacheRoot, fixture.derivedFrameRef),
    );
    // The persisted reference is machine-RELATIVE (D-05): no machine-local path
    // is recorded in the package, and nothing on this path constructs one.
    const layerText = new TextDecoder().decode(readPackageFile(fixture.root, buildLayerFileRelativePath(fixture.rotoLayerId)));
    expect(layerText).not.toContain(fixture.cacheRoot);
    expect(layerText).not.toContain(fixture.root);
    // D-14: nothing reads a cache file. The only reads are layer sub-files.
    const readPaths = fsReadFile.mock.calls.map(([path]) => String(path));
    expect(readPaths.every((path) => path.endsWith('.json'))).toBe(true);
    expect(readPaths.some((path) => path.includes('/efx-paint/'))).toBe(false);
  });

  it('treats an absent cache file as a non-error — the derived frame re-derives (D-14)', async () => {
    const fixture = useFixture('cold-cache');
    await saveFixture(fixture);
    const emptyCacheRoot = `${fixture.cacheRoot}-cold`;
    mkdirSync(emptyCacheRoot, { recursive: true });

    const loaded = await reopen(fixture, emptyCacheRoot);
    const roto = loaded.get(fixture.rotoLayerId) as NonNullable<ReturnType<typeof loaded.get>>;

    // The location is still recomputed against the root the session resolved;
    // that the file is not there is not an error.
    expect(roto.cacheLocations.get(fixture.trackId)?.get(0)).toBe(
      resolveMachineCachePath(emptyCacheRoot, fixture.derivedFrameRef),
    );
    expect(existsSync(join(emptyCacheRoot, fixture.derivedFrameRef))).toBe(false);
    rmSync(emptyCacheRoot, { recursive: true, force: true });
  });

  it('emits no raster payload and no machine-local path — scanned file by file, record by record in BOTH collections', async () => {
    const fixture = useFixture('payload-scan');
    await saveFixture(fixture);

    const emitted = listPackageFiles(fixture.root);
    // At least the manifest, one layer sub-file and one media file.
    expect(emitted.length).toBeGreaterThanOrEqual(3);
    for (const relativePath of emitted) {
      const text = new TextDecoder().decode(readPackageFile(fixture.root, relativePath));
      // The leak shape a raster takes in JSON: a 512+ character base64 run.
      expect(text, relativePath).not.toMatch(/[A-Za-z0-9+/]{512,}={0,2}/);
      // No absolute, backslash or drive-letter path — and never this machine's
      // package or cache root.
      expect(text, relativePath).not.toContain(fixture.root);
      expect(text, relativePath).not.toContain(fixture.cacheRoot);
      expect(text, relativePath).not.toMatch(/[A-Za-z]:\\|\\\\/);
    }
    // The scan's positive control: the payload each key carries IS a 512+
    // character base64 run, so a leak would have tripped the scan above.
    for (const keyId of [...fixture.realKeyIds, ...fixture.groupOverrideKeyIds]) {
      const payload = Buffer.from(fixture.mediaBytes.get(keyId) as Uint8Array).toString('base64');
      expect(payload).toMatch(/^[A-Za-z0-9+/]{512,}={0,2}$/);
      expect(new TextDecoder().decode(readPackageFile(fixture.root, buildLayerFileRelativePath(fixture.rotoLayerId)))).not.toContain(payload);
    }

    // Per roto record across BOTH collections: a group override carrying a
    // payload fails the contract exactly as a real key would.
    const layer = readPackageJson(fixture.root, buildLayerFileRelativePath(fixture.rotoLayerId));
    const tracks = layer.tracks as Array<{
      rotoPhysical: {
        realKeyRecords: Array<{ keyId: string; payload: { bytes?: unknown; media?: { relativePath: string } } }>;
        groupOverrideRecords?: Array<{ keyId: string; payload: { bytes?: unknown; media?: { relativePath: string } } }>;
      };
    }>;
    const records = [...tracks[0].rotoPhysical.realKeyRecords, ...(tracks[0].rotoPhysical.groupOverrideRecords ?? [])];
    expect(records).toHaveLength(fixture.realKeyIds.length + fixture.groupOverrideKeyIds.length);
    for (const record of records) {
      expect(JSON.stringify(record), record.keyId).not.toMatch(/[A-Za-z0-9+/]{512,}={0,2}/);
      expect(record.payload.bytes).toBeUndefined();
      expect(record.payload.media?.relativePath).toBe(`frames/${fixture.rotoLayerId}/${record.keyId}.webp`);
    }

    // Every emitted layer sub-file's cachePath is the machine-relative shape.
    for (const layerId of [fixture.rotoLayerId, fixture.plainLayerId]) {
      const emittedLayer = readPackageJson(fixture.root, buildLayerFileRelativePath(layerId));
      for (const track of emittedLayer.tracks as Array<{ frames: Record<string, { cachePath: string }> }>) {
        for (const ref of Object.values(track.frames)) {
          expect(ref.cachePath).toMatch(/^efx-paint\//);
          expect(ref.cachePath.startsWith('/')).toBe(false);
        }
      }
    }
  });

  it('every persisted media reference resolves to a file that exists — BOTH collections', async () => {
    const fixture = useFixture('files-exist');
    await saveFixture(fixture);

    for (const keyId of [...fixture.realKeyIds, ...fixture.groupOverrideKeyIds]) {
      const reference = persistedMediaRef(fixture, fixture.rotoLayerId, keyId);
      expect(existsSync(join(fixture.root, reference.relativePath))).toBe(true);
      // The recorded digest is the digest of the bytes on disk.
      const bytes = new Uint8Array(readFileSync(join(fixture.root, reference.relativePath)));
      expect(reference.digest).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('writes nothing on an identical second save, and exactly one media file plus its layer sub-file when one key changes', async () => {
    const fixture = useFixture('changed-files');
    await saveFixture(fixture);
    const canonicalBefore = canonicalFilesOf(fixture.root);
    fsWriteFile.mockClear();

    const second = await saveFixture(fixture);

    // An EMPTY write list, not a reduced one (D-11): the change set is what is
    // written, and a no-op save touches no disk at all.
    expect(second.changedFiles).toEqual([]);
    expect(fsWriteFile).not.toHaveBeenCalled();
    expect(canonicalFilesOf(fixture.root)).toEqual(canonicalBefore);

    // Changing one key's bytes rewrites that media file and its sub-file, plus
    // the manifest — whose layer index carries the content-derived
    // `documentRevision` the new payload moves. Nothing else is touched: not
    // the other layer, not the untouched keys.
    const changedKeyId = fixture.realKeyIds[0];
    fixture.mediaBytes.set(changedKeyId, testWebpBytes('changed-key-bytes'));
    const third = await saveFixture(fixture);
    const changed = [...third.changedFiles].sort();

    expect(changed).toEqual([
      buildFrameMediaRelativePath(fixture.rotoLayerId, changedKeyId),
      buildLayerFileRelativePath(fixture.rotoLayerId),
      EFX_PAINT_PACKAGE_MANIFEST_FILE,
    ].sort());
    expect(changed).not.toContain(buildLayerFileRelativePath(fixture.plainLayerId));
    expect(changed).not.toContain(buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.realKeyIds[1]));
    expect(changed).not.toContain(buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.groupOverrideKeyIds[0]));
  });

  it('round-trips a GROUP OVERRIDE to a media reference and reopens it byte-free, like a real key', async () => {
    const fixture = useFixture('group-override');
    await saveFixture(fixture);
    const keyId = fixture.groupOverrideKeyIds[0];

    const loaded = await reopen(fixture);
    const roto = loaded.get(fixture.rotoLayerId) as NonNullable<ReturnType<typeof loaded.get>>;
    const record = roto.document.tracks[0].rotoPhysical?.groupOverrideRecords?.find(
      (candidate) => candidate.keyId === keyId,
    );

    expect(record).toBeDefined();
    expect(record?.payload.media?.relativePath).toBe(buildFrameMediaRelativePath(fixture.rotoLayerId, keyId));
    expect(record?.payload.bytes).toBeUndefined();
    expect(existsSync(join(fixture.root, buildFrameMediaRelativePath(fixture.rotoLayerId, keyId)))).toBe(true);
    // The identical resolution path serves it — no collection branch.
    const resolved = await resolveFrameMediaBitmap({
      packageDir: fixture.root,
      reference: record!.payload.media!,
      lru: makeFakeLru(),
      decode: makeFakeDecode(),
    });
    expect(resolved.kind).toBe('bitmap');
  });

  it('refuses a group override whose media no longer matches its recorded digest — and still serves the untouched real key', async () => {
    const fixture = useFixture('group-override-mismatch');
    await saveFixture(fixture);
    const overrideKeyId = fixture.groupOverrideKeyIds[0];
    const tamperedPath = join(fixture.root, buildFrameMediaRelativePath(fixture.rotoLayerId, overrideKeyId));
    writeFileSync(tamperedPath, testWebpBytes('substituted-pixels'));

    const loaded = await reopen(fixture);
    const roto = loaded.get(fixture.rotoLayerId) as NonNullable<ReturnType<typeof loaded.get>>;
    const overrideRecord = roto.document.tracks[0].rotoPhysical?.groupOverrideRecords?.[0];

    const refused = await resolveFrameMediaBitmap({
      packageDir: fixture.root,
      reference: overrideRecord!.payload.media!,
      lru: makeFakeLru(),
      decode: makeFakeDecode(),
    });
    expect(refused).toEqual({ kind: 'refused', reason: 'digest-mismatch' });

    // The refusal is digest-specific: the untouched real key still resolves.
    const realRecord = roto.document.tracks[0].rotoPhysical?.realKeyRecords[0];
    const served = await resolveFrameMediaBitmap({
      packageDir: fixture.root,
      reference: realRecord!.payload.media!,
      lru: makeFakeLru(),
      decode: makeFakeDecode(),
    });
    expect(served.kind).toBe('bitmap');
  });

  it('D-06 Law-1 identity: the loop clip and the photo reference keep their sourceFrameRefs element-for-element, and every id resolves in the images index', async () => {
    const fixture = useFixture('law-1');
    await saveFixture(fixture);
    const manifest = readPackageJson(fixture.root, EFX_PAINT_PACKAGE_MANIFEST_FILE);

    const loaded = await reopen(fixture);
    const document = (loaded.get(fixture.rotoLayerId) as NonNullable<ReturnType<typeof loaded.get>>).document;

    const clipRefs = document.background.clips[0]?.sourceFrameRefs;
    const photoRefs = document.photoReference?.sourceFrameRefs;
    expect(clipRefs).toEqual(fixture.project.images.slice(0, 2).map((asset) => asset.id));
    expect(photoRefs).toEqual([
      fixture.project.images[1].id,
      fixture.project.images[2].id,
      fixture.project.images[0].id,
    ]);
    // Identity, not membership: the shared id sits in a different position in
    // each array, so an order-destroying round trip fails here.
    expect(photoRefs?.[2]).toBe(clipRefs?.[0]);

    // Every id the two arrays name resolves through the manifest's `images`
    // index to a REFERENCE (id + relative path), never bytes.
    const referencedIds = [...new Set([...(clipRefs ?? []), ...(photoRefs ?? [])])];
    expect(referencedIds.length).toBe(3);
    const images = manifest.images as Array<Record<string, unknown>>;
    for (const id of referencedIds) {
      const entry = images.find((candidate) => candidate.id === id);
      expect(entry, id).toBeDefined();
      expect(entry?.relative_path).toBe(`images/${id}.webp`);
      expect(entry).not.toHaveProperty('bytes');
      for (const value of Object.values(entry as Record<string, unknown>)) {
        if (typeof value === 'string') expect(value).not.toMatch(/[A-Za-z0-9+/]{512,}={0,2}/);
      }
      expect(existsSync(join(fixture.root, String(entry?.relative_path)))).toBe(true);
    }
  });

  it('a refused publish leaves every canonical file byte-identical and removes the canonical file the refusal created', async () => {
    const fixture = useFixture('refusal');
    const before = fixture.snapshot();
    // Copy the first staged file to canonical, then refuse: the rollback must
    // put the package back exactly as it was — including removing the file that
    // did not exist before this save.
    publishFailureAfterCopies = 1;

    await expect(saveFixture(fixture)).rejects.toThrow(/publish refused by test/);

    const after = fixture.snapshot();
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [relativePath, bytes] of before) {
      expect(after.get(relativePath), relativePath).toEqual(bytes);
    }
    expect(after.has(EFX_PAINT_PACKAGE_MANIFEST_FILE)).toBe(false);
    expect(after.has(buildLayerFileRelativePath(fixture.rotoLayerId))).toBe(false);
    expect(after.has(buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.realKeyIds[0]))).toBe(false);
  });

  it('leaves no staging directory behind after a completed save', async () => {
    const fixture = useFixture('staging-clean');
    await saveFixture(fixture);

    expect(listPackageFiles(fixture.root).some((path) => path.startsWith(EFX_PAINT_PACKAGE_STAGING_PREFIX))).toBe(false);
    expect(listPackageFiles(fixture.cacheRoot).some((path) => path.startsWith('.efx-paint-staging-'))).toBe(false);
    // The published package is what the manifest indexes: both layers and all
    // three media files.
    expect(listPackageFiles(fixture.root)).toEqual(expect.arrayContaining([
      EFX_PAINT_PACKAGE_MANIFEST_FILE,
      buildLayerFileRelativePath(fixture.rotoLayerId),
      buildLayerFileRelativePath(fixture.plainLayerId),
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.realKeyIds[0]),
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.realKeyIds[1]),
      buildFrameMediaRelativePath(fixture.rotoLayerId, fixture.groupOverrideKeyIds[0]),
    ]));
  });
});
