/**
 * 52.2-09 Task 2 (D-06 Law-1, D-07): test fixture — a minimal 2-layer package
 * built on the REAL filesystem.
 *
 * Why real files: the phase's on-disk contract (zero raster payloads, no
 * machine-local path, changed-files-only writes, Law-1 asset identity) is a
 * claim about the ARTIFACTS a save emits, so it must be asserted against bytes
 * on disk, never against an in-memory fake that the test itself authored. The
 * fixture therefore owns two real temp dirs — the package folder and the
 * machine-local derived-frame cache root — and writes the `images/` assets the
 * Law-1 references name.
 *
 * What it builds:
 * - a package folder with the `images/` assets written, and a project
 *   passthrough whose `images` index carries one reference per asset (id +
 *   relative path, no payload field);
 * - two layer save inputs: a roto layer (two real keys in `realKeyRecords`, one
 *   GROUP OVERRIDE in `groupOverrideRecords`, a derived-frame cache reference,
 *   one Background loop clip and a non-null photo reference whose
 *   `sourceFrameRefs` name the image assets) and a plain layer with no roto
 *   content — two layers so the manifest index walk has to visit more than one
 *   sub-file;
 * - raster payloads large enough that a leak would trip the round-trip file's
 *   `[A-Za-z0-9+/]{512,}` scan: a 32-byte fixture byte string is only ~44
 *   base64 characters, so a scan over small payloads would pass vacuously.
 *
 * The fixture is deliberately mock-free: a test supplies the IPC/fs mocks and
 * calls `savePackage` itself, so the same fixture serves the save leg and the
 * reopen leg.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, FrameLoopClip, PhotoReferenceTrack } from '../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { buildMachineCacheRelativePath } from '../lib/efxPaintPackage';
import type { EfxPaintDocumentSaveInput } from '../lib/efxPaintPersistence';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import type { MceImageRef, MceProject } from '../types/project';
import { testWebpBytes } from './testWebpBytes';

/**
 * A leak-sized payload: 32 + 392 bytes → ~566 base64 characters, comfortably
 * over the 512-character run the round-trip scan refuses. Distinct per keyId so
 * every media file owns its own digest.
 */
function payloadBytes(keyId: string): Uint8Array {
  return testWebpBytes(`${keyId}:${'payload'.repeat(56)}`);
}

/** Every canonical file under `root`, as package-relative POSIX paths, sorted. */
export function listPackageFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        out.push(relative(root, full).split(sep).join('/'));
      }
    }
  };
  walk(root);
  return out.sort();
}

/** The bytes of one package-relative file, read from disk. */
export function readPackageFile(root: string, relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(join(root, relativePath)));
}

/** The parsed JSON of one package-relative file, read from disk. */
export function readPackageJson(root: string, relativePath: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(readPackageFile(root, relativePath))) as Record<string, unknown>;
}

export interface PackageFixture {
  readonly label: string;
  /** The package folder itself (`project.mce` lives directly here). */
  readonly root: string;
  /** The machine-local derived-frame cache root (out of the package, D-05). */
  readonly cacheRoot: string;
  readonly projectId: string;
  /** The main-editor passthrough the manifest carries, `images` index included. */
  readonly project: MceProject;
  readonly rotoLayerId: string;
  readonly plainLayerId: string;
  /** The roto layer's single track — the owner of the derived-frame reference. */
  readonly trackId: string;
  readonly realKeyIds: readonly string[];
  readonly groupOverrideKeyIds: readonly string[];
  /** The `images/` assets the Law-1 references name, in index order. */
  readonly imageAssets: readonly MceImageRef[];
  /** The machine-RELATIVE derived-frame reference the layer file persists. */
  readonly derivedFrameRef: string;
  /** The payload each keyId's media file must carry; a case may swap a value. */
  readonly mediaBytes: Map<string, Uint8Array>;
  /** The save input for both layers, rebuilt from the current payload map. */
  documents(): Map<string, EfxPaintDocumentSaveInput>;
  /** Every canonical file's bytes right now (byte equality, not a digest). */
  snapshot(): Map<string, Uint8Array>;
  cleanup(): void;
}

export function createPackageFixture(label: string): PackageFixture {
  const root = mkdtempSync(join(tmpdir(), `efx-pkg-${label}-`));
  const cacheRoot = mkdtempSync(join(tmpdir(), `efx-pkg-cache-${label}-`));
  const cleanup = (): void => {
    rmSync(root, { recursive: true, force: true });
    rmSync(cacheRoot, { recursive: true, force: true });
  };

  const rotoLayerId = `layer-${label}-roto`;
  const plainLayerId = `layer-${label}-plain`;
  const projectId = crypto.randomUUID();

  // --- The `images/` assets (D-06 Law-1): real files, referenced by id ------
  const imageAssets: MceImageRef[] = ['asset-a', 'asset-b', 'asset-c'].map((name, index) => ({
    id: `${label}-${name}`,
    original_filename: `${name}.webp`,
    relative_path: `images/${label}-${name}.webp`,
    thumbnail_relative_path: `images/.thumbs/${label}-${name}.webp`,
    width: 640,
    height: 480,
    format: 'webp',
  }));
  mkdirSync(join(root, 'images'), { recursive: true });
  for (const asset of imageAssets) {
    writeFileSync(join(root, asset.relative_path), testWebpBytes(`${asset.id}-bytes`));
  }

  const project: MceProject = {
    version: 16,
    name: `pkg-fixture-${label}`,
    fps: 24,
    width: 1920,
    height: 1080,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    sequences: [],
    images: imageAssets.map((asset) => ({ ...asset })),
  };

  // --- The roto layer: both collections, a loop clip, a photo reference -----
  const realKeyIds = [`${label}-key-1`, `${label}-key-2`];
  const groupOverrideKeyIds = [`${label}-ovr-1`];
  const mediaBytes = new Map<string, Uint8Array>();
  for (const keyId of [...realKeyIds, ...groupOverrideKeyIds]) {
    mediaBytes.set(keyId, payloadBytes(keyId));
  }

  const base = createEfxPaintDocument(rotoLayerId);
  const baseTrack = base.tracks[0];
  const trackId = baseTrack.id;
  const derivedFrameRef = buildMachineCacheRelativePath(rotoLayerId, trackId, 0);
  const derivedFrameBytes = testWebpBytes(`${label}-derived`);

  const payloadFor = (keyId: string, appFrame: number) => ({
    frameIndex: 0,
    appFrame,
    bytes: mediaBytes.get(keyId) as Uint8Array,
    width: 8,
    height: 6,
  });
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const rotoLoopClips = [{
    loopId: `${label}-group-1`,
    placementStart: 0,
    sourceKeyIds: [...realKeyIds],
    repeat: 1,
    mode: 'progressive' as const,
    scriptId: `${label}-action-1`,
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'synchronized' as const,
    provenanceState: 'attached' as const,
    phaseOrigin: 0,
    originalEndExclusive: 2,
    visibleRanges: [{ start: 0, endExclusive: 2 }],
    frameOverrides: [{ appFrame: 1, keyId: groupOverrideKeyIds[0] }],
  }];
  const rotoPhysicalFor = () => {
    const realRecords = [
      { keyId: realKeyIds[0], appFrame: 0, kind: 'real-key' as const, payload: payloadFor(realKeyIds[0], 0) },
      { keyId: realKeyIds[1], appFrame: 2, kind: 'real-key' as const, payload: payloadFor(realKeyIds[1], 2) },
    ];
    const overrideRecords = [
      { keyId: groupOverrideKeyIds[0], appFrame: 1, kind: 'real-key' as const, payload: payloadFor(groupOverrideKeyIds[0], 1) },
    ];
    return parsePhysicPaintRotoPhysicalDocument({
      capacity: 24,
      realKeyRecords: realRecords,
      groupOverrideRecords: overrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realRecords, interpolation, rotoLoopClips, [], overrideRecords),
      loopClips: rotoLoopClips,
      incomingInterpolationBreakKeyIds: [],
    });
  };

  // D-06 Law-1: the loop clip's and the photo reference's `sourceFrameRefs` are
  // ORDERS, not sets — overlapping ids in different positions prove the arrays
  // survive element-for-element rather than as a membership check.
  const backgroundClip: FrameLoopClip = {
    id: `${label}-background-clip-1`,
    startFrame: 0,
    sourceFrameRefs: [imageAssets[0].id, imageAssets[1].id],
    repeat: { mode: 'infinite' as const },
    sourceKind: 'imported-background' as const,
    revision: 0,
    scale: { x: 100, y: 100 },
  };
  const photoReference: PhotoReferenceTrack = {
    id: `${label}-photo-reference`,
    sourceFrameRefs: [imageAssets[1].id, imageAssets[2].id, imageAssets[0].id],
    revision: 0,
    visibleInStudio: true,
    opacity: 0.75,
    transform: { x: 0.1, y: -0.2, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: false,
  };

  // Rebuilt per `documents()` call so a case that swaps a value in `mediaBytes`
  // (the changed-files case) has the new bytes reach the save input — records
  // built once would pin the payloads captured at fixture-construction time.
  const rotoDocumentFor = (): EfxPaintDocument => ({
    ...base,
    tracks: [
      {
        ...baseTrack,
        frames: { 0: { cachePath: derivedFrameRef, width: 64, height: 48 } },
        rotoPhysical: rotoPhysicalFor(),
      },
    ],
    background: { ...base.background, clips: [backgroundClip] },
    photoReference,
  });
  const rotoFrames = new Map<string, ReadonlyMap<number, PhysicPaintRenderedFrame>>([
    [trackId, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: derivedFrameBytes, width: 64, height: 48 }]])],
  ]);

  const plainDocument = createEfxPaintDocument(plainLayerId);

  const documents = (): Map<string, EfxPaintDocumentSaveInput> => new Map<string, EfxPaintDocumentSaveInput>([
    [rotoLayerId, { document: rotoDocumentFor(), frames: rotoFrames }],
    [plainLayerId, { document: plainDocument, frames: new Map() }],
  ]);

  const snapshot = (): Map<string, Uint8Array> => {
    const files = new Map<string, Uint8Array>();
    for (const relativePath of listPackageFiles(root)) {
      files.set(relativePath, readPackageFile(root, relativePath));
    }
    return files;
  };

  return {
    label,
    root,
    cacheRoot,
    projectId,
    project,
    rotoLayerId,
    plainLayerId,
    trackId,
    realKeyIds,
    groupOverrideKeyIds,
    imageAssets,
    derivedFrameRef,
    mediaBytes,
    documents,
    snapshot,
    cleanup,
  };
}
