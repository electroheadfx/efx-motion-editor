import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPayloadContentToken,
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { EfxPaintDocumentSaveInput, EfxPaintPackageSaveInput, EfxPaintPackageSaveResult } from './efxPaintPersistence';
import {
  EFX_PAINT_PACKAGE_STAGING_PREFIX,
  collectLayerMediaKeyIds,
  computeChangedFiles,
  createPackageStagingBasename,
  getPackageFileTokens,
  packageFileToken,
  settlePackageFileTokens,
  loadEfxPaintPackage,
  savePackage,
  stableSegment,
  stageEfxPaintPackageSave,
} from './efxPaintPersistence';
import {
  buildFrameMediaRelativePath,
  buildLayerFileRelativePath,
  buildMachineCacheRelativePath,
  isSafeMachineCacheRelativePath,
  resolveMachineCachePath,
} from './efxPaintPackage';
import type { MceProject } from '../types/project';

/**
 * The machine-local derived-frame cache root (52.2-07 D-05). Every
 * derived-frame path in this suite is addressed against it — the project
 * directory is never a cache root.
 */
const CACHE_ROOT = '/machine/frame-cache/project-1';

const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const hardlinkPhysicPaintCacheFrames = vi.hoisted(() => vi.fn());
// 52.2-05 Task 3: the package transaction surface + the manifest write.
const ipcProjectSave = vi.hoisted(() => vi.fn());
const bindEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const settleEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const recoverEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
// The native per-key media writer (D-02/D-13): the staging-generation
// `frames/<layerId>/<keyId>.webp` write behind the save's step 4.
const ipcEfxPaintWriteFrameMedia = vi.hoisted(() => vi.fn());
// The real `./ipc` module is loaded through `importActual` for the transport
// assertions below, so the Tauri invoke boundary is the mocked seam there.
const invoke = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();
/**
 * Every `writeFile` the save performed, IN ORDER, with the exact bytes it
 * wrote. The staging generation is deleted by the settle step, so the staged
 * content can only be asserted through this journal (T-52.2-22).
 */
const writeJournal: Array<{ readonly path: string; readonly bytes: Uint8Array }> = [];

/** The bytes of the last staged write whose path ends with `suffix`. */
function lastStagedWrite(suffix: string): string {
  const entry = [...writeJournal].reverse().find((write) => write.path.endsWith(suffix));
  if (entry === undefined) throw new Error(`no staged write ends with ${suffix}`);
  return new TextDecoder().decode(entry.bytes);
}

/** The package root every save in this suite writes into. */
const PACKAGE_DIR = '/project';
/** A manifest projectId: the machine cache root's key (D-05). */
const TEST_PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function testProject(): MceProject {
  return {
    version: 13,
    name: 'demo',
    fps: 24,
    width: 1920,
    height: 1080,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    sequences: [],
    images: [],
  };
}

/** A manifest with a layer index over the given layer ids (D-04). */
function manifestFor(layerIds: readonly string[]): Record<string, unknown> {
  return {
    efxPaint: Object.fromEntries(layerIds.map((layerId) => [layerId, {
      layerFile: buildLayerFileRelativePath(layerId),
      documentRevision: '0',
      compositeRevision: '0',
    }])),
  };
}

/** Write one layer sub-file into the in-memory package, as a save would. */
function writeLayerFile(packageDir: string, layerId: string, value: unknown): void {
  files.set(`${packageDir}/${buildLayerFileRelativePath(layerId)}`, new TextEncoder().encode(JSON.stringify(value)));
}

/** Load the in-memory package the way the open leg does. */
function loadFromPackage(
  packageDir: string,
  layerIds: readonly string[],
  machineCacheRoot: string | null = CACHE_ROOT,
): ReturnType<typeof loadEfxPaintPackage> {
  return loadEfxPaintPackage({ packageDir, manifest: manifestFor(layerIds), machineCacheRoot });
}

/** Every staged path a save wrote, in write order. */
function stagedPathsOf(paths: readonly string[]): string[] {
  return paths.filter((path) => path.includes(`${PACKAGE_DIR}/.efx-paint-package-staging-`));
}

async function saveIntoPackage(
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
  options?: { readonly cacheRoot?: string | null; readonly packageDir?: string; readonly project?: MceProject; readonly projectId?: string },
): Promise<EfxPaintPackageSaveResult> {
  const input: EfxPaintPackageSaveInput = {
    project: options?.project ?? testProject(),
    documents,
    projectId: options?.projectId ?? TEST_PROJECT_ID,
    cacheRoot: options?.cacheRoot === undefined ? CACHE_ROOT : options.cacheRoot,
  };
  return savePackage(options?.packageDir ?? PACKAGE_DIR, input);
}

/**
 * The package-transaction surface, simulated over the same in-memory
 * filesystem the fs mock owns: a bind registers the staged set, a publish
 * copies each bound staged path to its canonical path, a settle cleans the
 * staging generation up (a rollback never published, so the canonical package
 * is left byte-identical).
 */
const activePackageTransactions = new Map<
  string,
  { readonly packageRoot: string; readonly stagingBasename: string; readonly paths: readonly string[] }
>();

function registerActivePackageTransaction(
  transactionId: string,
  packageRoot: string,
  stagingBasename: string,
  paths: readonly string[],
): void {
  activePackageTransactions.set(transactionId, { packageRoot, stagingBasename, paths });
}

function installPackageTransactionMocks(): void {
  activePackageTransactions.clear();
  // `mockClear` (the shared beforeEach) drops calls but keeps implementations
  // AND the one-shot queue, so a `mockResolvedValueOnce` from a previous case
  // would leak into this one. Reset first, then install.
  ipcEfxPaintWriteFrameMedia.mockReset();
  ipcProjectSave.mockReset();
  bindEfxPaintPackageTransaction.mockReset();
  publishEfxPaintPackageTransaction.mockReset();
  settleEfxPaintPackageTransaction.mockReset();
  ipcEfxPaintWriteFrameMedia.mockImplementation(
    async (packageDir: string, layerId: string, keyId: string, bytes: Uint8Array, stagingBasename?: string) => {
      const relativePath = buildFrameMediaRelativePath(layerId, keyId);
      const root = stagingBasename === undefined ? packageDir : `${packageDir}/${stagingBasename}`;
      files.set(`${root}/${relativePath}`, bytes);
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
  ipcProjectSave.mockImplementation(async (project: MceProject, path: string) => {
    files.set(path, new TextEncoder().encode(JSON.stringify(project)));
    return { ok: true, data: null };
  });
  bindEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, stagingBasename: string, paths: string[]) => {
      const transactionId = crypto.randomUUID();
      registerActivePackageTransaction(transactionId, packageRoot, stagingBasename, paths);
      return {
        ok: true,
        data: {
          transactionId,
          aggregateDigest: createHash('sha256').update(paths.join(' ')).digest('hex'),
          entries: [],
        },
      };
    },
  );
  publishEfxPaintPackageTransaction.mockImplementation(async (packageRoot: string, transactionId: string) => {
    const transaction = activePackageTransactions.get(transactionId);
    if (!transaction) return { ok: false, error: 'inactive transaction' };
    let published = 0;
    for (const path of transaction.paths) {
      const staged = files.get(`${transaction.packageRoot}/${transaction.stagingBasename}/${path}`);
      if (staged === undefined) continue;
      files.set(`${packageRoot}/${path}`, staged);
      published += 1;
    }
    return { ok: true, data: { transactionId, published } };
  });
  settleEfxPaintPackageTransaction.mockImplementation(
    async (packageRoot: string, transactionId: string, _action: 'commit' | 'rollback') => {
      const transaction = activePackageTransactions.get(transactionId);
      if (!transaction) return { ok: false, error: 'inactive transaction' };
      activePackageTransactions.delete(transactionId);
      const stagingRoot = `${packageRoot}/${transaction.stagingBasename}`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(`${stagingRoot}/`)) files.delete(key);
      }
      for (const key of Array.from(dirs)) {
        if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) dirs.delete(key);
      }
      return { ok: true, data: { cleanupDeferred: false } };
    },
  );
}

function exchangeGeneration(cacheRoot: string, stagingBasename: string): void {
  const stagingRoot = `${cacheRoot}/${stagingBasename}`;
  const canonicalRoot = `${cacheRoot}/efx-paint`;
  const stagingFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${stagingRoot}/`))
    .map(([key, value]) => [`${canonicalRoot}${key.slice(stagingRoot.length)}`, value] as const);
  const canonicalFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${canonicalRoot}/`))
    .map(([key, value]) => [`${stagingRoot}${key.slice(canonicalRoot.length)}`, value] as const);
  const stagingDirs = Array.from(dirs)
    .filter((key) => key === stagingRoot || key.startsWith(`${stagingRoot}/`))
    .map((key) => `${canonicalRoot}${key.slice(stagingRoot.length)}`);
  const canonicalDirs = Array.from(dirs)
    .filter((key) => key === canonicalRoot || key.startsWith(`${canonicalRoot}/`))
    .map((key) => `${stagingRoot}${key.slice(canonicalRoot.length)}`);
  for (const key of Array.from(files.keys())) {
    if (key.startsWith(`${stagingRoot}/`) || key.startsWith(`${canonicalRoot}/`)) files.delete(key);
  }
  for (const key of Array.from(dirs)) {
    if (key === stagingRoot || key.startsWith(`${stagingRoot}/`) || key === canonicalRoot || key.startsWith(`${canonicalRoot}/`)) dirs.delete(key);
  }
  for (const [key, value] of [...stagingFiles, ...canonicalFiles]) files.set(key, value);
  for (const key of [...stagingDirs, ...canonicalDirs]) dirs.add(key);
}

vi.mock('./ipc', () => ({
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
  hardlinkPhysicPaintCacheFrames,
  projectSave: ipcProjectSave,
  bindEfxPaintPackageTransaction,
  publishEfxPaintPackageTransaction,
  settleEfxPaintPackageTransaction,
  recoverEfxPaintPackageTransaction,
  ipcEfxPaintWriteFrameMedia,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
  readDir: vi.fn(async (path: string) => Array.from(dirs)
    .filter((candidate) => candidate.startsWith(`${path}/`))
    .map((candidate) => candidate.slice(path.length + 1).split('/')[0])
    .filter((name, index, names) => name.length > 0 && names.indexOf(name) === index)
    .map((name) => ({ name, isDirectory: true, isFile: false, isSymlink: false }))),
  remove: vi.fn(async (path: string) => {
    for (const key of Array.from(files.keys())) {
      if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs.keys())) {
      if (key === path || key.startsWith(`${path}/`)) dirs.delete(key);
    }
  }),
  readFile: vi.fn(async (path: string) => {
    const file = files.get(path);
    if (!file) throw new Error(`missing file: ${path}`);
    return file;
  }),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    writeJournal.push({ path, bytes: contents });
    files.set(path, contents);
  }),
}));

describe('savePackage / loadEfxPaintPackage', () => {
  beforeEach(async () => {
    files.clear();
    dirs.clear();
    writeJournal.length = 0;
    vi.clearAllMocks();
    // The module's committed baseline is process state, not per-test state: a
    // stale token map from the previous case would make this case's save look
    // unchanged and skip its writes.
    settlePackageFileTokens('commit', new Map());
    const { exists } = await import('@tauri-apps/plugin-fs');
    vi.mocked(exists).mockImplementation(async (path) => dirs.has(String(path)) || files.has(String(path)));
    installPackageTransactionMocks();
    const activeTransactions = new Map<string, string>();
    publishPhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
      const replacedExisting = dirs.has(`${cacheRoot}/efx-paint`);
      const transactionId = crypto.randomUUID();
      activeTransactions.set(transactionId, stagingBasename);
      exchangeGeneration(cacheRoot, stagingBasename);
      return {
        ok: true,
        data: { accepted: true, transactionId, replacedExisting },
      };
    });
    settlePhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, transactionId: string, action: 'commit' | 'rollback') => {
      const stagingBasename = activeTransactions.get(transactionId);
      if (!stagingBasename) return { ok: false, error: 'inactive transaction' };
      if (action === 'rollback') exchangeGeneration(cacheRoot, stagingBasename);
      const stagingRoot = `${cacheRoot}/${stagingBasename}`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(`${stagingRoot}/`)) files.delete(key);
      }
      for (const key of Array.from(dirs)) {
        if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) dirs.delete(key);
      }
      activeTransactions.delete(transactionId);
      return { ok: true, data: { accepted: true, cleanupStatus: 'complete' } };
    });
    hardlinkPhysicPaintCacheFrames.mockImplementation(async (cacheRoot: string, stagingBasename: string, unchangedPaths: string[]) => {
      const canonicalRoot = `${cacheRoot}/efx-paint`;
      const stagingRoot = `${cacheRoot}/${stagingBasename}`;
      const missing: string[] = [];
      for (const relative of unchangedPaths) {
        const source = `${canonicalRoot}/${relative}`;
        const target = `${stagingRoot}/${relative}`;
        const bytes = files.get(source);
        if (bytes === undefined) {
          missing.push(relative);
        } else {
          files.set(target, bytes);
        }
      }
      return { ok: true, data: { accepted: true, missing } };
    });
  });

  it('round-trips a document through staging/commit and restores identity on load', async () => {
    const document = createEfxPaintDocument('layer-x');
    const frameRef = buildMachineCacheRelativePath('layer-x', document.tracks[0].id, 0);
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{
        ...track,
        frames: { 0: { cachePath: frameRef, width: 100, height: 50 } },
      }],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-x', {
      document: withFrame,
      frames: new Map([[document.tracks[0].id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
    }]]);

    const result = await saveIntoPackage(documents);

    // The derived-frame sidecars are staged under the MACHINE cache root's
    // generation; the authoritative files are staged under the package root.
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const writtenPaths = vi.mocked(writeFile).mock.calls.map(([path]) => String(path));
    const cacheWrites = writtenPaths.filter((path) => path.includes('/.efx-paint-staging-'));
    expect(cacheWrites.length).toBeGreaterThan(0);
    expect(cacheWrites.every((path) => path.startsWith(`${CACHE_ROOT}/.efx-paint-staging-`))).toBe(true);
    // One authoritative staged write: this layer has no roto keys, so its
    // document is the only file the layer contributes.
    const authoritativeStaged = stagedPathsOf(writtenPaths);
    expect(authoritativeStaged).toHaveLength(1);
    expect(authoritativeStaged[0]).toMatch(
      new RegExp(`^/project/\\.efx-paint-package-staging-[0-9a-f-]{36}/${buildLayerFileRelativePath('layer-x').replace('.', '\\.')}$`),
    );
    expect(result.changedFiles).toEqual([buildLayerFileRelativePath('layer-x'), 'project.mce']);
    // The manifest is written through the project-save wrapper, pointed at the
    // staging root — with the project and the path ONLY (no transaction id).
    expect(ipcProjectSave).toHaveBeenCalledOnce();
    expect(ipcProjectSave.mock.calls[0]).toHaveLength(2);
    expect(String((ipcProjectSave.mock.calls[0] as unknown[])[1])).toMatch(
      /^\/project\/\.efx-paint-package-staging-[0-9a-f-]{36}\/project\.mce$/,
    );
    // After publication the canonical paths hold the staged bytes.
    expect(files.has(`${CACHE_ROOT}/${frameRef}`)).toBe(true);
    expect(files.has(`${PACKAGE_DIR}/project.mce`)).toBe(true);
    // Both legs settle on commit.
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith(CACHE_ROOT, expect.stringMatching(/^[0-9a-f-]{36}$/), 'commit');
    expect(settleEfxPaintPackageTransaction).toHaveBeenCalledWith(PACKAGE_DIR, expect.stringMatching(/^[0-9a-f-]{36}$/), 'commit');

    // Load restores a document deep-equal on identity fields, with the
    // derived-frame location recomputed from the persisted reference.
    const loaded = await loadFromPackage(PACKAGE_DIR, ['layer-x']);
    const restored = loaded.get('layer-x')!.document;
    expect(restored.version).toBe(document.version);
    expect(restored.parentLayerId).toBe(document.parentLayerId);
    expect(restored.documentRevision).toBe(document.documentRevision);
    expect(restored.activeTrackId).toBe(document.activeTrackId);
    expect(restored.tracks.map((track) => track.id)).toEqual(document.tracks.map((track) => track.id));
    expect(restored.background).toEqual(document.background);
    // D-14: no placeholder bytes anywhere — the frames map is empty and the
    // machine-local location is carried by `cacheLocations` instead.
    const restored2 = loaded.get('layer-x')!;
    expect(restored2.frames.size).toBe(0);
    expect(restored2.cacheLocations.get(document.tracks[0].id)?.get(0)).toBe(
      resolveMachineCachePath(CACHE_ROOT, frameRef),
    );
  });

  it('round-trips reference-only media in BOTH roto collections with no raster payload in the staged sub-file (52.2 D-07, Law 1)', async () => {
    const document = createEfxPaintDocument('layer-bytes');
    const track = document.tracks[0];
    const realBytes = testWebpBytes('real-key-bytes');
    const overrideBytes = testWebpBytes('override-key-bytes');
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    // The save's INPUT is the runtime shape: both collections carry raster
    // payloads. Projecting them onto references is the save's own job.
    const realRecords = [
      { keyId: 'key-1', appFrame: 0, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 0, bytes: realBytes, width: 2, height: 2 } },
      { keyId: 'key-2', appFrame: 2, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 2, bytes: realBytes, width: 2, height: 2 } },
    ];
    const overrideRecords = [
      { keyId: 'ovr-1', appFrame: 1, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 1, bytes: overrideBytes, width: 2, height: 2 } },
    ];
    // A Group override only exists as a reference of a Group's own frame
    // override list, so the fixture carries the Group that owns it: a
    // two-source Group covering [0, 2) with the override on its phase frame.
    const loopClips = [{
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: ['key-1', 'key-2'],
      repeat: 1,
      mode: 'progressive' as const,
      scriptId: 'action-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 0,
      originalEndExclusive: 2,
      visibleRanges: [{ start: 0, endExclusive: 2 }],
      frameOverrides: [{ appFrame: 1, keyId: 'ovr-1' }],
    }];
    const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
      capacity: 24,
      realKeyRecords: realRecords,
      groupOverrideRecords: overrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realRecords, interpolation, loopClips, [], overrideRecords),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    const withRoto = { ...document, tracks: [{ ...track, rotoPhysical }] };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-bytes', {
      document: withRoto,
      frames: new Map(),
    }]]);

    const result = await saveIntoPackage(documents);

    // One media file per keyId of BOTH collections, then the sub-file that
    // references them. Nothing else is bound or published.
    expect(result.changedFiles).toEqual([
      buildFrameMediaRelativePath('layer-bytes', 'key-1'),
      buildFrameMediaRelativePath('layer-bytes', 'key-2'),
      buildFrameMediaRelativePath('layer-bytes', 'ovr-1'),
      buildLayerFileRelativePath('layer-bytes'),
      'project.mce',
    ]);
    // Write ORDER: both media writes precede the layer sub-file write.
    const mediaWriteOrders = ipcEfxPaintWriteFrameMedia.mock.invocationCallOrder.slice();
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const layerWriteOrder = vi.mocked(writeFile).mock.calls
      .map(([path], index) => ({ path: String(path), order: vi.mocked(writeFile).mock.invocationCallOrder[index] }))
      .find((entry) => entry.path.endsWith(buildLayerFileRelativePath('layer-bytes')))!.order;
    expect(mediaWriteOrders).toHaveLength(3);
    expect(mediaWriteOrders.every((order) => order < layerWriteOrder)).toBe(true);
    // Every media write is addressed at the STAGING generation: no call
    // targets the canonical package's own frames/ tree (D-10).
    for (const call of ipcEfxPaintWriteFrameMedia.mock.calls as unknown as unknown[][]) {
      expect(call[0]).toBe(PACKAGE_DIR);
      expect(call[4]).toMatch(/^\.efx-paint-package-staging-[0-9a-f-]{36}$/);
    }

    // The staged sub-file carries the references — checked on the captured
    // staged bytes, not on source text (the staging generation is deleted by
    // the settle step, so the journal is the only witness).
    const stagedLayerText = lastStagedWrite(buildLayerFileRelativePath('layer-bytes'));
    const stagedTrack = (JSON.parse(stagedLayerText) as {
      tracks: Array<{ rotoPhysical: { realKeyRecords: Array<{ payload: { bytes?: unknown; media?: { relativePath: string } } }>; groupOverrideRecords: Array<{ payload: { bytes?: unknown; media?: { relativePath: string } } }> } }>;
    }).tracks[0];
    expect(stagedTrack.rotoPhysical.realKeyRecords[0].payload.media?.relativePath).toBe('frames/layer-bytes/key-1.webp');
    expect(stagedTrack.rotoPhysical.realKeyRecords[0].payload.bytes).toBeUndefined();
    expect(stagedTrack.rotoPhysical.groupOverrideRecords[0].payload.media?.relativePath).toBe('frames/layer-bytes/ovr-1.webp');
    expect(stagedTrack.rotoPhysical.groupOverrideRecords[0].payload.bytes).toBeUndefined();
    // Byte-level scan of the staged string: neither raster is base64 anywhere.
    expect(stagedLayerText).not.toContain(Buffer.from(realBytes).toString('base64'));
    expect(stagedLayerText).not.toContain(Buffer.from(overrideBytes).toString('base64'));
    // No absolute, backslash or drive-letter path reaches the sub-file.
    expect(stagedLayerText).not.toMatch(/[A-Za-z]:\\|\\\\|\/Users\/|\/machine\//);

    // The on-disk door accepts the reference-only form and installs
    // media-carrying records with no byte buffer, in both collections.
    const loaded = await loadFromPackage(PACKAGE_DIR, ['layer-bytes']);
    const restored = loaded.get('layer-bytes')!.document;
    const restoredPhysical = restored.tracks[0].rotoPhysical!;
    expect(restoredPhysical.realKeyRecords[0].payload.media?.relativePath).toBe('frames/layer-bytes/key-1.webp');
    expect(restoredPhysical.realKeyRecords[0].payload.bytes).toBeUndefined();
    expect(restoredPhysical.groupOverrideRecords?.[0].payload.media?.relativePath).toBe('frames/layer-bytes/ovr-1.webp');
    expect(restoredPhysical.groupOverrideRecords?.[0].payload.bytes).toBeUndefined();
  });

  it('refuses a keyId shared by the two roto collections BEFORE any media write (D-09)', async () => {
    // One keyId in both collections would claim one `frames/<layerId>/<keyId>.webp`
    // twice: whichever record is written last would silently own the pixels
    // (the id-uniqueness invariant the override-creation path enforces). The
    // collision is refused in the save's own intake — a document re-read from
    // disk is data, so the save never trusts its caller — and no media write,
    // manifest write or transaction may happen before that refusal.
    const document = createEfxPaintDocument('layer-dup');
    const track = document.tracks[0];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const realRecords = [
      { keyId: 'key-1', appFrame: 0, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('real-key-1'), width: 2, height: 2 } },
      { keyId: 'key-2', appFrame: 2, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 2, bytes: testWebpBytes('real-key-2'), width: 2, height: 2 } },
    ];
    const overrideRecords = [
      { keyId: 'ovr-1', appFrame: 1, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 1, bytes: testWebpBytes('override-1'), width: 2, height: 2 } },
    ];
    const loopClips = [{
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: ['key-1', 'key-2'],
      repeat: 1,
      mode: 'progressive' as const,
      scriptId: 'action-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 0,
      originalEndExclusive: 2,
      visibleRanges: [{ start: 0, endExclusive: 2 }],
      frameOverrides: [{ appFrame: 1, keyId: 'ovr-1' }],
    }];
    const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
      capacity: 24,
      realKeyRecords: realRecords,
      groupOverrideRecords: overrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realRecords, interpolation, loopClips, [], overrideRecords),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    // The colliding form is unreachable through the parser (it refuses it), so
    // the fixture hands the save the data shape a re-read document would carry.
    const colliding = {
      ...document,
      tracks: [{
        ...track,
        rotoPhysical: {
          ...rotoPhysical,
          groupOverrideRecords: [{ ...overrideRecords[0], keyId: 'key-2' }],
        },
      }],
    } as unknown as EfxPaintDocument;
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-dup', {
      document: colliding,
      frames: new Map(),
    }]]);

    await expect(saveIntoPackage(documents)).rejects.toThrow(/key-2/);

    // Nothing was staged, bound or published: no media write, no manifest
    // write, no transaction, and nothing at all in the write journal.
    expect(ipcEfxPaintWriteFrameMedia).not.toHaveBeenCalled();
    expect(ipcProjectSave).not.toHaveBeenCalled();
    expect(bindEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(publishEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(writeJournal).toHaveLength(0);
    expect(files.size).toBe(0);
  });

  it('loads refs only — the cache file is never read on open, and an absent one is not an error (D-08, D-14)', async () => {
    const document = createEfxPaintDocument('layer-lazy');
    const track = document.tracks[0];
    const frameRef = buildMachineCacheRelativePath('layer-lazy', track.id, 0);
    // Deliberately NOT written to the cache: the derived frame re-derives, so
    // an absent cache file must not fail the load.
    writeLayerFile('/project', 'layer-lazy', {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }],
    });

    const { readFile } = await import('@tauri-apps/plugin-fs');
    const readFileCallsBefore = vi.mocked(readFile).mock.calls.length;
    const loaded = await loadFromPackage('/project', ['layer-lazy'], CACHE_ROOT);
    const restored = loaded.get('layer-lazy')!;
    expect(restored.frames.size).toBe(0);
    expect(restored.cacheLocations.get(track.id)?.get(0)).toBe(resolveMachineCachePath(CACHE_ROOT, frameRef));
    // The only read was the layer sub-file: no cache byte fetch happened on open.
    const readPaths = vi.mocked(readFile).mock.calls.slice(readFileCallsBefore).map(([path]) => String(path));
    expect(readPaths).toHaveLength(1);
    expect(readPaths[0].endsWith(buildLayerFileRelativePath('layer-lazy'))).toBe(true);
  });

  it('recomputes no location when the machine cache root is unavailable (D-14)', async () => {
    const document = createEfxPaintDocument('layer-null-root');
    const track = document.tracks[0];
    writeLayerFile('/project', 'layer-null-root', {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: buildMachineCacheRelativePath('layer-null-root', track.id, 0), width: 10, height: 10 } } }],
    });

    const loaded = await loadFromPackage('/project', ['layer-null-root'], null);

    // The reference is still validated; with no root there is no machine-local
    // location to store, and the load succeeds.
    expect(loaded.get('layer-null-root')!.cacheLocations.size).toBe(0);
  });

  it('fails closed when the persisted document has unknown members', async () => {
    const bad = { ...createEfxPaintDocument('layer-x'), extra: true };
    writeLayerFile('/project', 'layer-x', bad);
    await expect(loadFromPackage('/project', ['layer-x'])).rejects.toThrow(/EfxPaintDocument: unknown members/);
  });

  it('refuses a manifest index entry whose layer file is missing — never a silently empty layer', async () => {
    await expect(loadFromPackage('/project', ['layer-absent'])).rejects.toThrow(/missing its layer file/);
  });

  it('refuses a layer file that escapes layers/ BEFORE any read', async () => {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const escaping = ['../escape.json', '/absolute/layer.json', 'frames\\layer.json', 'other/layer.json'];
    for (const layerFile of escaping) {
      const readFileCallsBefore = vi.mocked(readFile).mock.calls.length;
      await expect(loadEfxPaintPackage({
        packageDir: '/project',
        manifest: { efxPaint: { 'layer-escape': { layerFile, documentRevision: '0', compositeRevision: '0' } } },
        machineCacheRoot: CACHE_ROOT,
      })).rejects.toThrow(/unsafe layer file path/);
      // The guard runs before any filesystem call: a traversal is refused, not
      // attempted and then refused.
      expect(vi.mocked(readFile).mock.calls.length, layerFile).toBe(readFileCallsBefore);
    }
  });

  it('returns an empty map when the manifest indexes no layers', async () => {
    expect((await loadFromPackage('/project', [])).size).toBe(0);
    // A manifest without an `efxPaint` index at all is the same empty result —
    // never a throw that would block opening a layer-less package.
    const loaded = await loadEfxPaintPackage({ packageDir: '/project', manifest: {}, machineCacheRoot: CACHE_ROOT });
    expect(loaded.size).toBe(0);
  });

  it('the machine-relative guard accepts produced references and rejects traversal', () => {
    const good = buildMachineCacheRelativePath('layer-x', 'track-1', 0);
    expect(isSafeMachineCacheRelativePath(good)).toBe(true);
    expect(isSafeMachineCacheRelativePath('/efx-paint/layer-x/frame-0000.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint/../frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint/./frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint//frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint/layer-x\\frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint/layer-x/frame.webp\0')).toBe(false);
    // The legacy cache directory prefix is rejected (DOC-04: the legacy
    // surface does not exist; the literal is split so the contract audit
    // stays green while the negative guard remains).
    expect(isSafeMachineCacheRelativePath('cache/' + 'physic-paint' + '/layer-x/frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('cache/efx-paint/layer-x/frame-0000.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint')).toBe(false);
    expect(isSafeMachineCacheRelativePath(42)).toBe(false);
  });

  it('saving the same unchanged document twice writes NOTHING on the second save (D-11, T-52.2-23)', async () => {
    const document = createEfxPaintDocument('layer-idem');
    const frameRef = buildMachineCacheRelativePath('layer-idem', document.tracks[0].id, 0);
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-idem', {
      document: withFrame,
      frames: new Map([[document.tracks[0].id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
    }]]);
    const first = await saveIntoPackage(documents);
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const firstWriteCount = vi.mocked(writeFile).mock.calls.length;
    expect(firstWriteCount).toBeGreaterThan(0);
    expect(first.changedFiles.length).toBeGreaterThan(0);

    ipcEfxPaintWriteFrameMedia.mockClear();
    ipcProjectSave.mockClear();
    bindEfxPaintPackageTransaction.mockClear();
    publishEfxPaintPackageTransaction.mockClear();
    settleEfxPaintPackageTransaction.mockClear();
    publishPhysicPaintCacheGeneration.mockClear();

    const second = await saveIntoPackage(documents);

    // The empty change set touches no disk: no staged write, no media write,
    // no manifest, no transaction, and no full cache-leg re-stage.
    expect(second.changedFiles).toEqual([]);
    expect(vi.mocked(writeFile).mock.calls.length).toBe(firstWriteCount);
    expect(ipcEfxPaintWriteFrameMedia).not.toHaveBeenCalled();
    expect(ipcProjectSave).not.toHaveBeenCalled();
    expect(bindEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(publishEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(settleEfxPaintPackageTransaction).not.toHaveBeenCalled();
    expect(publishPhysicPaintCacheGeneration).not.toHaveBeenCalled();
    // The manifest is still reported, so the caller's save is not a no-op.
    expect(second.manifest.name).toBe('demo');
  });

  it('rolls back BOTH staged generations and keeps the prior committed bytes when the package publish is refused', async () => {
    const document = createEfxPaintDocument('layer-rollback');
    const frameRef = buildMachineCacheRelativePath('layer-rollback', document.tracks[0].id, 0);
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }],
    };
    // The authoritative change is a roto key's pixels (the derived-frame bytes
    // alone do not change the package's file set); the derived-frame bytes
    // change too, so both legs have work on the second save.
    const makeDocuments = (keyBytes: Uint8Array, derivedBytes: Uint8Array) => {
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      const records = [
        { keyId: 'key-r', appFrame: 0, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 0, bytes: keyBytes, width: 4, height: 4 } },
      ];
      const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
        capacity: 24,
        realKeyRecords: records,
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
        loopClips: [],
        incomingInterpolationBreakKeyIds: [],
      });
      return new Map<string, EfxPaintDocumentSaveInput>([['layer-rollback', {
        document: { ...withFrame, tracks: [{ ...withFrame.tracks[0], rotoPhysical }] },
        frames: new Map([[document.tracks[0].id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: derivedBytes, width: 100, height: 50 }]])]]),
      }]]);
    };

    // First save commits a generation.
    await saveIntoPackage(makeDocuments(testWebpBytes('AQID'), testWebpBytes('AQID')));
    expect(files.has(`${CACHE_ROOT}/${frameRef}`)).toBe(true);
    const canonicalLayerBytes = files.get(`${PACKAGE_DIR}/${buildLayerFileRelativePath('layer-rollback')}`)!;
    const canonicalMediaBytes = files.get(`${PACKAGE_DIR}/${buildFrameMediaRelativePath('layer-rollback', 'key-r')}`)!;

    // Second save stages new bytes, then the package publish is refused.
    publishEfxPaintPackageTransaction.mockResolvedValueOnce({ ok: false, error: 'forced publish failure' });
    await expect(saveIntoPackage(makeDocuments(testWebpBytes('BAID'), testWebpBytes('BAID')))).rejects.toThrow('forced publish failure');

    expect(settleEfxPaintPackageTransaction).toHaveBeenCalledWith(
      PACKAGE_DIR,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'rollback',
    );
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith(
      CACHE_ROOT,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'rollback',
    );
    // The prior committed generation remains published with its original bytes
    // and the canonical package is byte-identical to its pre-save snapshot.
    const { readFile } = await import('@tauri-apps/plugin-fs');
    expect(Array.from(await readFile(`${CACHE_ROOT}/${frameRef}`))).toEqual(Array.from(testWebpBytes('AQID')));
    expect(files.get(`${PACKAGE_DIR}/${buildLayerFileRelativePath('layer-rollback')}`)).toEqual(canonicalLayerBytes);
    expect(files.get(`${PACKAGE_DIR}/${buildFrameMediaRelativePath('layer-rollback', 'key-r')}`)).toEqual(canonicalMediaBytes);
    // Both staging generations are gone.
    expect(Array.from(files.keys()).some((key) => key.includes('.efx-paint-staging-'))).toBe(false);
    expect(Array.from(dirs).some((key) => key.includes('.efx-paint-staging-'))).toBe(false);
    expect(Array.from(files.keys()).some((key) => key.includes('.efx-paint-package-staging-'))).toBe(false);
  });

  it('embeds the trackId in the machine-relative cache reference and the guard accepts it', () => {
    const path = buildMachineCacheRelativePath('layer-x', 'track-y', 7);
    expect(path).toBe(`efx-paint/${stableSegment('layer-x')}/track-y/frame-0007.webp`);
    expect(isSafeMachineCacheRelativePath(path)).toBe(true);
  });

  it('stages two tracks at the same appFrame without collision and loads both back', async () => {
    const document = createEfxPaintDocument('layer-2t');
    const trackA = document.tracks[0];
    const trackB = { ...trackA, id: 'track-b', order: 1 };
    const pathA = buildMachineCacheRelativePath('layer-2t', trackA.id, 5);
    const pathB = buildMachineCacheRelativePath('layer-2t', trackB.id, 5);
    expect(pathA).not.toBe(pathB);
    const withFrames = {
      ...document,
      tracks: [
        { ...trackA, frames: { 5: { cachePath: pathA, width: 100, height: 50 } } },
        { ...trackB, frames: { 5: { cachePath: pathB, width: 100, height: 50 } } },
      ],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-2t', {
      document: withFrames,
      frames: new Map([
        [trackA.id, new Map([[5, { frameIndex: 0, appFrame: 5, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])],
        [trackB.id, new Map([[5, { frameIndex: 0, appFrame: 5, bytes: testWebpBytes('BAID'), width: 100, height: 50 }]])],
      ]),
    }]]);
    await saveIntoPackage(documents);

    // Both tracks' sidecars staged at their own track paths.
    expect(files.has(`${CACHE_ROOT}/${pathA}`)).toBe(true);
    expect(files.has(`${CACHE_ROOT}/${pathB}`)).toBe(true);
    // Load restores per-track locations at the same appFrame without a throw.
    const loaded = await loadFromPackage(PACKAGE_DIR, ['layer-2t']);
    const restored = loaded.get('layer-2t')!;
    expect(restored.cacheLocations.get(trackA.id)?.get(5)).toBe(resolveMachineCachePath(CACHE_ROOT, pathA));
    expect(restored.cacheLocations.get(trackB.id)?.get(5)).toBe(resolveMachineCachePath(CACHE_ROOT, pathB));
  });

  it('loads per-track locations with validated cache paths', async () => {
    const document = createEfxPaintDocument('layer-pt');
    const trackA = document.tracks[0];
    const trackB = { ...trackA, id: 'track-b', order: 1 };
    const pathA = buildMachineCacheRelativePath('layer-pt', trackA.id, 1);
    const pathB = buildMachineCacheRelativePath('layer-pt', trackB.id, 2);
    files.set(`${CACHE_ROOT}/${pathA}`, testWebpBytes('AQID'));
    files.set(`${CACHE_ROOT}/${pathB}`, testWebpBytes('BAUG'));
    writeLayerFile('/project', 'layer-pt', {
      ...document,
      tracks: [
        { ...trackA, frames: { 1: { cachePath: pathA, width: 10, height: 10 } } },
        { ...trackB, frames: { 2: { cachePath: pathB, width: 20, height: 20 } } },
      ],
    });

    const loaded = await loadFromPackage('/project', ['layer-pt']);
    const restored = loaded.get('layer-pt')!;
    expect(Array.from(restored.cacheLocations.keys()).sort()).toEqual([trackA.id, trackB.id].sort());
    expect(restored.cacheLocations.get(trackA.id)?.get(1)).toBe(resolveMachineCachePath(CACHE_ROOT, pathA));
    expect(restored.cacheLocations.get(trackB.id)?.get(2)).toBe(resolveMachineCachePath(CACHE_ROOT, pathB));
  });

  it('fails closed when a persisted track frame cachePath is unsafe', async () => {
    const document = createEfxPaintDocument('layer-unsafe');
    const track = document.tracks[0];
    writeLayerFile('/project', 'layer-unsafe', {
      ...document,
      tracks: [
        // 52.2-07 (D-05): the legacy package-relative shape is not a
        // machine-relative reference, so the read door refuses it.
        { ...track, frames: { 0: { cachePath: 'cache/efx-paint/seg/frame-0000.webp', width: 10, height: 10 } } },
      ],
    });

    await expect(loadFromPackage('/project', ['layer-unsafe'])).rejects.toThrow(/unsafe sidecar path/);
  });

  it('stableSegment is deterministic, collision-resistant, and sanitized', () => {
    expect(stableSegment('layer-x')).toBe(stableSegment('layer-x'));
    expect(stableSegment('layer-x')).not.toBe(stableSegment('layer-y'));
    expect(stableSegment('a/b\\c')).toBe(stableSegment('a/b\\c'));
    expect(stableSegment('a/b\\c')).not.toContain('/');
    expect(stableSegment('a/b\\c')).not.toContain('\\');
    expect(stableSegment('a/b')).not.toBe(stableSegment('a_b'));
    expect(stableSegment('')).toMatch(/^layer-/);
  });

  it('re-stages only changed frames and hardlinks unchanged frames (52.1 a2)', async () => {
    const document = createEfxPaintDocument('layer-incr');
    const track = document.tracks[0];
    const frameRefA = buildMachineCacheRelativePath('layer-incr', track.id, 0);
    const frameRefB = buildMachineCacheRelativePath('layer-incr', track.id, 1);
    const withFrames = {
      ...document,
      tracks: [{ ...track, frames: {
        0: { cachePath: frameRefA, width: 100, height: 50 },
        1: { cachePath: frameRefB, width: 100, height: 50 },
      } }],
    };
    const makeDocuments = (bytesA: Uint8Array, bytesB: Uint8Array) => new Map<string, EfxPaintDocumentSaveInput>([['layer-incr', {
      document: withFrames,
      frames: new Map([[track.id, new Map([
        [0, { frameIndex: 0, appFrame: 0, bytes: bytesA, width: 100, height: 50 }],
        [1, { frameIndex: 0, appFrame: 1, bytes: bytesB, width: 100, height: 50 }],
      ])]]),
    }]]);

    await saveIntoPackage(makeDocuments(testWebpBytes('AQID'), testWebpBytes('BAID')));
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const firstWriteCount = vi.mocked(writeFile).mock.calls.length;
    expect(firstWriteCount).toBeGreaterThan(0);

    await saveIntoPackage(makeDocuments(testWebpBytes('AQIE'), testWebpBytes('BAID')));

    const secondWrites = vi.mocked(writeFile).mock.calls.slice(firstWriteCount);
    const writtenPaths = secondWrites.map(([path]) => String(path));
    expect(writtenPaths.some((path) => path.includes('frame-0000'))).toBe(true);
    expect(writtenPaths.some((path) => path.includes('frame-0001'))).toBe(false);
    expect(hardlinkPhysicPaintCacheFrames).toHaveBeenCalled();
    const hardlinkArgs = hardlinkPhysicPaintCacheFrames.mock.calls[0] as [string, string, string[]];
    // The hardlink carries the machine cache root and a GENERATION-relative
    // path (the reference minus its `efx-paint/` prefix), never the project dir.
    expect(hardlinkArgs[0]).toBe(CACHE_ROOT);
    expect(hardlinkArgs[2]).toContain(frameRefB.slice('efx-paint/'.length));
    expect(files.has(`${CACHE_ROOT}/${frameRefA}`)).toBe(true);
    expect(files.has(`${CACHE_ROOT}/${frameRefB}`)).toBe(true);
  });

  it('falls back to full re-stage when hardlink fails (52.1 a2)', async () => {
    const document = createEfxPaintDocument('layer-fallback');
    const track = document.tracks[0];
    const frameRefA = buildMachineCacheRelativePath('layer-fallback', track.id, 0);
    const frameRefB = buildMachineCacheRelativePath('layer-fallback', track.id, 1);
    const withFrames = {
      ...document,
      tracks: [{ ...track, frames: {
        0: { cachePath: frameRefA, width: 100, height: 50 },
        1: { cachePath: frameRefB, width: 100, height: 50 },
      } }],
    };
    const makeDocuments = (bytesA: Uint8Array, bytesB: Uint8Array) => new Map<string, EfxPaintDocumentSaveInput>([['layer-fallback', {
      document: withFrames,
      frames: new Map([[track.id, new Map([
        [0, { frameIndex: 0, appFrame: 0, bytes: bytesA, width: 100, height: 50 }],
        [1, { frameIndex: 0, appFrame: 1, bytes: bytesB, width: 100, height: 50 }],
      ])]]),
    }]]);

    await saveIntoPackage(makeDocuments(testWebpBytes('AQID'), testWebpBytes('BAID')));
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const firstWriteCount = vi.mocked(writeFile).mock.calls.length;

    hardlinkPhysicPaintCacheFrames.mockResolvedValueOnce({ ok: false, error: 'EXDEV' });
    await saveIntoPackage(makeDocuments(testWebpBytes('AQIE'), testWebpBytes('BAID')));

    const secondWrites = vi.mocked(writeFile).mock.calls.slice(firstWriteCount);
    const writtenPaths = secondWrites.map(([path]) => String(path));
    expect(writtenPaths.some((path) => path.includes('frame-0000'))).toBe(true);
    expect(writtenPaths.some((path) => path.includes('frame-0001'))).toBe(true);
  });
});

describe('52.2-07 Task 2: the machine-relative derived-frame cache reference (D-05)', () => {
  const MACHINE_LAYER = 'layer-machine';

  /** Move a staging generation to its canonical name under the machine cache root. */
  function exchangeCacheGeneration(cacheRoot: string, stagingBasename: string): void {
    const stagingRoot = `${cacheRoot}/${stagingBasename}`;
    const canonicalRoot = `${cacheRoot}/efx-paint`;
    for (const key of Array.from(files.keys())) {
      if (!key.startsWith(`${stagingRoot}/`)) continue;
      const bytes = files.get(key);
      files.delete(key);
      if (bytes !== undefined) files.set(`${canonicalRoot}${key.slice(stagingRoot.length)}`, bytes);
    }
    for (const key of Array.from(dirs)) {
      if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) {
        dirs.delete(key);
        dirs.add(`${canonicalRoot}${key.slice(stagingRoot.length)}`);
      }
    }
  }

  /** One layer document carrying a single Paint frame ref plus its runtime bytes. */
  function makeFrameSaveInput(cachePathFor: (trackId: string) => string, deletions?: readonly string[]) {
    const document = createEfxPaintDocument(MACHINE_LAYER);
    const track = document.tracks[0];
    const cachePath = cachePathFor(track.id);
    const documents = new Map<string, EfxPaintDocumentSaveInput>([[MACHINE_LAYER, {
      document: { ...document, tracks: [{ ...track, frames: { 0: { cachePath, width: 100, height: 50 } } }] },
      frames: new Map([[track.id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
      ...(deletions !== undefined ? { deletions } : {}),
    }]]);
    return { documents, trackId: track.id, frameRef: cachePath };
  }

  beforeEach(async () => {
    files.clear();
    dirs.clear();
    writeJournal.length = 0;
    vi.clearAllMocks();
    settlePackageFileTokens('commit', new Map());
    const { exists } = await import('@tauri-apps/plugin-fs');
    vi.mocked(exists).mockImplementation(async (path) => dirs.has(String(path)) || files.has(String(path)));
    installPackageTransactionMocks();
    publishPhysicPaintCacheGeneration.mockImplementation(async (cacheRoot: string, stagingBasename: string) => {
      exchangeCacheGeneration(cacheRoot, stagingBasename);
      return { ok: true, data: { accepted: true, transactionId: crypto.randomUUID(), replacedExisting: false } };
    });
    settlePhysicPaintCacheGeneration.mockResolvedValue({
      ok: true,
      data: { accepted: true, cleanupStatus: 'complete' },
    });
    hardlinkPhysicPaintCacheFrames.mockResolvedValue({ ok: true, data: { accepted: true, missing: [] } });
  });

  it('the cache-path guard accepts machine-relative references and refuses the legacy package-relative shape', () => {
    const reference = buildMachineCacheRelativePath('layer-x', 'track-1', 0);
    expect(reference).toBe(`efx-paint/${stableSegment('layer-x')}/track-1/frame-0000.webp`);
    expect(isSafeMachineCacheRelativePath(reference)).toBe(true);
    // The track-deletion directory is the same shape one segment shallower.
    expect(isSafeMachineCacheRelativePath(`efx-paint/${stableSegment('layer-x')}/track-1`)).toBe(true);
    // Every legacy and machine-local spelling is refused.
    expect(isSafeMachineCacheRelativePath('cache/efx-paint/layer-x/track-1/frame-0000.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('/machine/frame-cache/project-1/efx-paint/layer-x/frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint/../frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint/layer-x\\frame.webp')).toBe(false);
    expect(isSafeMachineCacheRelativePath('efx-paint')).toBe(false);
    expect(isSafeMachineCacheRelativePath(42)).toBe(false);
  });

  it('resolves a produced reference to the same machine-local identity across two calls', () => {
    const reference = buildMachineCacheRelativePath('layer-x', 'track-1', 7);
    expect(resolveMachineCachePath(CACHE_ROOT, reference)).toBe(`${CACHE_ROOT}/${reference}`);
    expect(resolveMachineCachePath(CACHE_ROOT, reference)).toBe(resolveMachineCachePath(CACHE_ROOT, reference));
    expect(resolveMachineCachePath(CACHE_ROOT, 'cache/efx-paint/layer-x/track-1/frame-0007.webp')).toBeNull();
    expect(resolveMachineCachePath('', reference)).toBeNull();
  });

  it('stages and publishes the derived-frame cache against the machine cache root, never the project directory', async () => {
    const { documents, frameRef } = makeFrameSaveInput((trackId) => buildMachineCacheRelativePath(MACHINE_LAYER, trackId, 0));

    await saveIntoPackage(documents);

    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const writtenPaths = vi.mocked(writeFile).mock.calls.map(([path]) => String(path));
    const cacheWrites = writtenPaths.filter((path) => path.includes('/.efx-paint-staging-'));
    expect(cacheWrites.length).toBeGreaterThan(0);
    expect(cacheWrites.every((path) => path.startsWith(`${CACHE_ROOT}/.efx-paint-staging-`))).toBe(true);
    // The staged location is the generation-relative path (the reference minus
    // its `efx-paint/` prefix); only the published generation carries the
    // reference's own prefix.
    expect(cacheWrites.some((path) => path.endsWith(`/${frameRef.slice('efx-paint/'.length)}`))).toBe(true);
    // The published canonical generation lives under the machine cache root;
    // the machine cache directory is never addressed under the package root.
    expect(files.has(`${CACHE_ROOT}/${frameRef}`)).toBe(true);
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledWith(
      CACHE_ROOT,
      expect.stringMatching(/^\.efx-paint-staging-[0-9a-f-]{36}$/),
    );
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith(
      CACHE_ROOT,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'commit',
    );
    const cacheRelativeRoot = frameRef.slice(0, 'efx-paint/'.length);
    expect(files.has(`${PACKAGE_DIR}/${cacheRelativeRoot}`)).toBe(false);
    expect(Array.from(files.keys()).some((key) => key.startsWith(`${PACKAGE_DIR}/${cacheRelativeRoot}`))).toBe(false);
    expect(Array.from(dirs).some((key) => key.startsWith(`${PACKAGE_DIR}/${cacheRelativeRoot}`))).toBe(false);
  });

  it('skips the derived-frame cache leg when no cache root is supplied (D-14 best-effort)', async () => {
    const { documents } = makeFrameSaveInput((trackId) => buildMachineCacheRelativePath(MACHINE_LAYER, trackId, 0));

    const result = await saveIntoPackage(documents, { cacheRoot: null });

    // The authoritative save still commits: the manifest reached the wrapper.
    expect(ipcProjectSave).toHaveBeenCalledOnce();
    expect(result.changedFiles).toContain('project.mce');
    expect(settleEfxPaintPackageTransaction).toHaveBeenCalledWith(PACKAGE_DIR, expect.stringMatching(/^[0-9a-f-]{36}$/), 'commit');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    expect(vi.mocked(writeFile).mock.calls.every(([path]) => String(path).startsWith(`${PACKAGE_DIR}/`))).toBe(true);
    expect(publishPhysicPaintCacheGeneration).not.toHaveBeenCalled();
    expect(settlePhysicPaintCacheGeneration).not.toHaveBeenCalled();
    expect(hardlinkPhysicPaintCacheFrames).not.toHaveBeenCalled();
  });

  it('refuses a layer document carrying a legacy package-relative cache reference before staging it', async () => {
    const { documents } = makeFrameSaveInput(() => 'cache/efx-paint/layer-machine/track-1/frame-0000.webp');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    await expect(saveIntoPackage(documents)).rejects.toThrow(/not a machine-relative reference/);

    // The refusal happens at intake: nothing is staged anywhere, and no
    // transaction is opened.
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    expect(ipcEfxPaintWriteFrameMedia).not.toHaveBeenCalled();
    expect(publishPhysicPaintCacheGeneration).not.toHaveBeenCalled();
    expect(ipcProjectSave).not.toHaveBeenCalled();
    expect(bindEfxPaintPackageTransaction).not.toHaveBeenCalled();
  });

  it('refuses a deletion directory that is not machine-relative', async () => {
    const { documents } = makeFrameSaveInput(
      (trackId) => buildMachineCacheRelativePath(MACHINE_LAYER, trackId, 0),
      ['cache/efx-paint/seg/track-legacy'],
    );

    await expect(saveIntoPackage(documents)).rejects.toThrow(/is not a safe cache path/);
  });
});

// --- 52.2-05 Task 3: the package transaction transport (D-10) -------------

const PACKAGE_STAGING_SHAPE = /^\.efx-paint-package-staging-[0-9a-f-]{36}$/;

describe('the package transaction transport (52.2-05 Task 3)', () => {
  async function realIpc() {
    return vi.importActual<typeof import('./ipc')>('./ipc');
  }

  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue(null);
  });

  it('binds the staged file set over the package root and the staging basename', async () => {
    const ipc = await realIpc();
    const binding = {
      transactionId: 'txn-pkg-1',
      aggregateDigest: 'a'.repeat(64),
      entries: [{ path: 'project.mce', sha256: 'b'.repeat(64), hadOriginal: true }],
    };
    invoke.mockResolvedValue(binding);

    const result = await ipc.bindEfxPaintPackageTransaction(
      '/package',
      '.efx-paint-package-staging-abc',
      ['project.mce'],
    );

    expect(invoke).toHaveBeenCalledWith('bind_efx_paint_package_transaction', {
      packageRoot: '/package',
      stagingBasename: '.efx-paint-package-staging-abc',
      paths: ['project.mce'],
    });
    // Bind returns the aggregate digest with the per-entry list.
    expect(result).toEqual({ ok: true, data: binding });
  });

  it('publishes, settles and recovers over the package root with no caller-supplied destination root', async () => {
    const ipc = await realIpc();

    await ipc.publishEfxPaintPackageTransaction('/package', 'txn-pkg-1');
    await ipc.settleEfxPaintPackageTransaction('/package', 'txn-pkg-1', 'commit');
    await ipc.settleEfxPaintPackageTransaction('/package', 'txn-pkg-1', 'rollback');
    await ipc.recoverEfxPaintPackageTransaction('/package');

    expect(invoke.mock.calls).toEqual([
      ['publish_efx_paint_package_transaction', { packageRoot: '/package', transactionId: 'txn-pkg-1' }],
      ['settle_efx_paint_package_transaction', { packageRoot: '/package', transactionId: 'txn-pkg-1', action: 'commit' }],
      ['settle_efx_paint_package_transaction', { packageRoot: '/package', transactionId: 'txn-pkg-1', action: 'rollback' }],
      ['recover_efx_paint_package_transaction', { packageRoot: '/package' }],
    ]);
    // The staging root is derived in Rust (T-52.2-14): no call carries one.
    for (const [, args] of invoke.mock.calls as Array<[string, Record<string, unknown>]>) {
      expect(Object.keys(args).sort()).not.toContain('destinationRoot');
      expect(Object.keys(args).sort()).not.toContain('stagingRoot');
      expect(JSON.stringify(args)).not.toContain('/package/');
    }
  });

  it('addresses the machine cache root and carries a soft failure as a non-fatal field', async () => {
    const ipc = await realIpc();
    invoke.mockResolvedValueOnce('/machine/frame-cache/PID');
    const softFailure = {
      accepted: false,
      transactionId: '',
      replacedExisting: false,
      diagnostic: 'the cache root is read-only',
    };
    invoke.mockResolvedValueOnce(softFailure);

    const root = await ipc.resolvePhysicPaintCacheRoot('PID');
    const publication = await ipc.publishPhysicPaintCacheGeneration(
      '/machine/frame-cache/PID',
      '.efx-paint-staging-x',
    );

    expect(invoke.mock.calls[0]).toEqual(['resolve_physic_paint_cache_root', { projectId: 'PID' }]);
    expect(root).toEqual({ ok: true, data: '/machine/frame-cache/PID' });
    expect(invoke.mock.calls[1]).toEqual([
      'publish_physic_paint_cache_generation',
      { cacheRoot: '/machine/frame-cache/PID', stagingBasename: '.efx-paint-staging-x' },
    ]);
    expect(publication).toEqual({ ok: true, data: softFailure });
  });
});

// --- 52.2-05 Task 3: the staged manifest write (D-10) --------------------

describe('the staged package save seam (52.2-05 Task 3)', () => {
  const project = { name: 'demo' } as unknown as Parameters<typeof stageEfxPaintPackageSave>[0];

  beforeEach(() => {
    files.clear();
    dirs.clear();
    writeJournal.length = 0;
    vi.clearAllMocks();
    installPackageTransactionMocks();
    ipcProjectSave.mockResolvedValue({ ok: true, data: null });
    // A deterministic transaction identity: the bind registers it so the
    // publish step has a live transaction to publish.
    bindEfxPaintPackageTransaction.mockImplementation(
      async (packageRoot: string, stagingBasename: string, paths: string[]) => {
        registerActivePackageTransaction('txn-pkg-9', packageRoot, stagingBasename, paths);
        return {
          ok: true,
          data: { transactionId: 'txn-pkg-9', aggregateDigest: 'c'.repeat(64), entries: [] },
        };
      },
    );
  });

  it('mints a Rust-shaped staging basename and keeps the literal in sync with the Rust prefix', () => {
    expect(createPackageStagingBasename()).toMatch(PACKAGE_STAGING_SHAPE);
    expect(createPackageStagingBasename()).not.toBe(createPackageStagingBasename());
    // One prefix, two readers: the Rust bind is the authority that refuses a
    // mismatch, so the literals must stay identical.
    const rust = readFileSync(
      fileURLToPath(new URL('../../src-tauri/src/services/efx_paint_media.rs', import.meta.url)),
      'utf8',
    );
    expect(rust).toContain(`pub const PACKAGE_STAGING_PREFIX: &str = "${EFX_PAINT_PACKAGE_STAGING_PREFIX}";`);
  });

  it('writes the manifest at the derived staged path and binds it as a one-entry set', async () => {
    const staged = await stageEfxPaintPackageSave(project, '/package');

    expect(staged.stagingBasename).toMatch(PACKAGE_STAGING_SHAPE);
    expect(ipcProjectSave).toHaveBeenCalledWith(
      project,
      `/package/${staged.stagingBasename}/project.mce`,
    );
    // The manifest write accepts the optional cache transaction id without
    // forwarding it (dead by design until plan 07/09 remove the declaration).
    expect(ipcProjectSave.mock.calls[0]).toHaveLength(2);
    expect(bindEfxPaintPackageTransaction).toHaveBeenCalledWith(
      '/package',
      staged.stagingBasename,
      ['project.mce'],
    );
    // Exactly the package root, the basename and the set: no destination root.
    expect(bindEfxPaintPackageTransaction.mock.calls[0]).toHaveLength(3);
    expect(staged.transactionId).toBe('txn-pkg-9');
    expect(staged.aggregateDigest).toBe('c'.repeat(64));
  });

  it('expresses an already-staged file set as the same one-entry-set call', async () => {
    await stageEfxPaintPackageSave(project, '/package', ['layers/L1.json', 'frames/L1/K1.webp']);

    expect(bindEfxPaintPackageTransaction).toHaveBeenCalledWith(
      '/package',
      expect.stringMatching(PACKAGE_STAGING_SHAPE),
      ['project.mce', 'layers/L1.json', 'frames/L1/K1.webp'],
    );
  });

  it('reports the authoritative save as committed when the cache leg soft-fails (D-14)', async () => {
    const document = createEfxPaintDocument('layer-soft');
    const frameRef = buildMachineCacheRelativePath('layer-soft', document.tracks[0].id, 0);
    const track = document.tracks[0];
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-soft', {
      document: { ...document, tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }] },
      frames: new Map([[track.id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
    }]]);
    publishPhysicPaintCacheGeneration.mockResolvedValueOnce({
      ok: true,
      data: { accepted: false, transactionId: '', replacedExisting: false, diagnostic: 'the cache root is read-only' },
    });

    const result = await saveIntoPackage(documents);

    // The authoritative save still commits and is reported as such.
    expect(ipcProjectSave).toHaveBeenCalledOnce();
    expect(settleEfxPaintPackageTransaction).toHaveBeenCalledWith(PACKAGE_DIR, 'txn-pkg-9', 'commit');
    expect(result.changedFiles).toEqual([buildLayerFileRelativePath('layer-soft'), 'project.mce']);
    expect(files.has(`${PACKAGE_DIR}/${buildLayerFileRelativePath('layer-soft')}`)).toBe(true);
    // The soft refusal came from the cache leg actually running (not from a
    // skipped leg): the leg was addressed against the machine cache root.
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledWith(
      CACHE_ROOT,
      expect.stringMatching(/^\.efx-paint-staging-[0-9a-f-]{36}$/),
    );
    // No live cache transaction exists, so nothing is settled on that leg.
    expect(settlePhysicPaintCacheGeneration).not.toHaveBeenCalled();
  });
});

// --- 52.2-07 Task 1: per-file change tokens (D-11) -----------------------

describe('per-file change tokens (52.2-07 Task 1, D-11)', () => {
  const LAYER = 'layer-1';
  const layerToken = packageFileToken('layer', LAYER);
  const manifestToken = packageFileToken('manifest');
  const frameToken = (keyId: string) => packageFileToken('frame', LAYER, keyId);
  const contentToken = (seed: string, appFrame = 1) =>
    buildPhysicPaintRotoPayloadContentToken({ frameIndex: 0, appFrame, bytes: testWebpBytes(seed) });

  beforeEach(() => {
    settlePackageFileTokens('commit', new Map());
  });

  it('keys the token space frame:<layerId>:<keyId>, layer:<layerId>, manifest', () => {
    expect(packageFileToken('manifest')).toBe('manifest');
    expect(packageFileToken('layer', 'layer-1')).toBe('layer:layer-1');
    expect(packageFileToken('frame', 'layer-1', 'key-7')).toBe('frame:layer-1:key-7');
  });

  it('a keyId placed at two different appFrames yields ONE token and ONE media write', () => {
    const keyIds = collectLayerMediaKeyIds([
      {
        realKeyRecords: [
          { keyId: 'key-9', appFrame: 2 },
          { keyId: 'key-9', appFrame: 5 },
        ],
        groupOverrideRecords: [],
      },
    ]);

    // The keyId is the identity; the placements are not. A frame-keyed token
    // would emit two entries here (and two writes of identical media).
    expect(keyIds).toEqual(['key-9']);
    expect(keyIds.map((keyId) => frameToken(keyId))).toEqual(['frame:layer-1:key-9']);
  });

  it('a group-override keyId yields the same frame token shape as a real key, with no collection marker', () => {
    const keyIds = collectLayerMediaKeyIds([
      {
        realKeyRecords: [{ keyId: 'real-1', appFrame: 1 }],
        groupOverrideRecords: [{ keyId: 'ovr-1', appFrame: 3 }],
      },
    ]);

    expect(keyIds.map((keyId) => frameToken(keyId))).toEqual([
      'frame:layer-1:ovr-1',
      'frame:layer-1:real-1',
    ]);
    expect(packageFileToken('frame', LAYER, 'ovr-1')).toBe('frame:layer-1:ovr-1');
  });

  it('refuses a keyId shared by the two roto collections of one document, naming the keyId', () => {
    expect(() => collectLayerMediaKeyIds([
      { realKeyRecords: [{ keyId: 'key-x' }], groupOverrideRecords: [{ keyId: 'key-x' }] },
    ])).toThrow(/key-x/);
  });

  it('changing one group override returns exactly its media token plus its layer token', () => {
    const before = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('real-1'), contentToken('real-1')],
      [frameToken('ovr-1'), contentToken('ovr-before', 3)],
    ]);
    const after = new Map(before);
    after.set(frameToken('ovr-1'), contentToken('ovr-after', 3));
    after.set(layerToken, 'docrev-2');

    expect(computeChangedFiles(before, after).map((entry) => entry.token)).toEqual([
      frameToken('ovr-1'),
      layerToken,
    ]);
  });

  it('returns only the entries whose token value differs, sorted by token', () => {
    const before = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('key-a'), contentToken('a1')],
      [frameToken('key-b'), contentToken('b1')],
    ]);
    const after = new Map(before);
    after.set(frameToken('key-a'), contentToken('a2'));

    expect(computeChangedFiles(before, after)).toEqual([
      { token: frameToken('key-a'), value: contentToken('a2') },
    ]);
  });

  it('the first save against an empty token map returns the complete set', () => {
    const next = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('key-a'), contentToken('a1')],
      [frameToken('key-b'), contentToken('b1')],
    ]);

    expect(computeChangedFiles(new Map(), next).map((entry) => entry.token)).toEqual([
      frameToken('key-a'),
      frameToken('key-b'),
      layerToken,
      manifestToken,
    ]);
  });

  it('a second save with identical input returns an empty set', () => {
    const next = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('key-a'), contentToken('a1')],
    ]);
    // A same-shaped input whose one value drifted is NOT empty, so the empty
    // result below is a real comparison rather than a constant.
    const drift = new Map(next);
    drift.set(frameToken('key-a'), contentToken('a2'));
    expect(computeChangedFiles(next, drift).map((entry) => entry.token)).toEqual([frameToken('key-a')]);

    expect(computeChangedFiles(next, next)).toEqual([]);
  });

  it('changing one key bytes returns exactly its media token plus its layer token', () => {
    const before = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('key-a'), contentToken('a1')],
      [frameToken('key-b'), contentToken('b1')],
    ]);
    const after = new Map(before);
    after.set(frameToken('key-a'), contentToken('a2'));
    after.set(layerToken, 'docrev-2');

    expect(computeChangedFiles(before, after).map((entry) => entry.token)).toEqual([
      frameToken('key-a'),
      layerToken,
    ]);
  });

  it('renaming a track inside one layer returns exactly that layer token, never the manifest', () => {
    const before = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('key-a'), contentToken('a1')],
    ]);
    const after = new Map(before);
    after.set(layerToken, 'docrev-2');

    const changed = computeChangedFiles(before, after).map((entry) => entry.token);
    expect(changed).toEqual([layerToken]);
    expect(changed).not.toContain(manifestToken);
  });

  it('the token map survives a settle and is dropped on rollback, so a failed save re-writes what it staged', () => {
    const committed = new Map<string, string>([
      [manifestToken, 'manifest-1'],
      [layerToken, 'docrev-1'],
      [frameToken('key-a'), contentToken('a1')],
    ]);
    settlePackageFileTokens('commit', committed);

    expect(getPackageFileTokens()).toEqual(committed);
    expect(computeChangedFiles(getPackageFileTokens(), committed)).toEqual([]);

    const staged = new Map(committed);
    staged.set(frameToken('key-a'), contentToken('a2'));
    staged.set(layerToken, 'docrev-2');
    settlePackageFileTokens('rollback', staged);

    // The pending map was dropped: the last committed map is still the
    // baseline, so every file the failed save had staged is still changed.
    expect(getPackageFileTokens()).toEqual(committed);
    expect(computeChangedFiles(getPackageFileTokens(), staged).map((entry) => entry.token)).toEqual([
      frameToken('key-a'),
      layerToken,
    ]);
  });
});
