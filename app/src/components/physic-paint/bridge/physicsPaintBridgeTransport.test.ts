import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
const emitTo = vi.hoisted(() => vi.fn(
  async (_target: string, _event: string, _payload: unknown): Promise<void> => undefined,
));
const performanceRecord = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ emitTo }));
vi.mock('../performance/physicsPaintPerformanceTrace', () => ({ recordPhysicsPaintPerformance: performanceRecord }));

import {
  PHYSIC_PAINT_SESSION_DOCUMENT_KEY,
  createPhysicPaintThumbnailNativeEncoder,
  markEfxPaintDocumentSyncFrameDelivered,
  readEfxPaintSessionDocumentCheckpoint,
  resetEfxPaintDocumentSyncTransferState,
  sendEfxPaintDocumentSync,
  writeEfxPaintSessionDocumentCheckpoint,
} from './physicsPaintBridgeTransport';
import {
  applyPhysicPaintImageImportRequest,
  applyPhysicPaintImageLibraryRequest,
  createImageLibraryRequestLifecycle,
  createPhysicPaintImageImportStatePorts,
  createPhysicPaintLaunchContext,
  installPhysicPaintEfxPaintDocumentListener,
  PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT,
  PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT,
  PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT,
  PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT,
  PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT,
} from '../../../lib/physicPaintBridge';
import { defaultTransform, type Layer } from '../../../types/layer';
import { sequenceStore } from '../../../stores/sequenceStore';
import {
  addBackgroundClip,
  addTrack,
  getDocument as getEfxPaintDocument,
  registerDocument as registerEfxPaintDocument,
  reset as resetEfxPaintStore,
  serializeRuntimeIntoDocument,
  setPhotoReferenceSource,
} from '../../../stores/efxPaintStore';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { isPhysicPaintImageImportRequest, isPhysicPaintImageImportResult, isPhysicPaintImageLibraryResult } from '../../../types/physicPaint';
import { imageStore, _setImageMarkDirtyCallback } from '../../../stores/imageStore';
import type { MceImageRef } from '../../../types/project';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../roto/physicsPaintRotoPhysicalModel';
import { buildFrameMediaRelativePath } from '../../../lib/efxPaintPackage';
import { bytesToBase64 } from '../../../lib/webpBytes';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const transport = readFileSync(fileURLToPath(new URL('./physicsPaintBridgeTransport.ts', import.meta.url)), 'utf8');

describe('generic Physics Paint child transport', () => {
  it('retains generic apply, authority, script, audio, frame-sync, and thumbnail senders only', () => {
    for (const retained of [
      'sendPhysicPaintApplyPayload',
      'sendPhysicPaintRotoAuthorityRequest',
      'sendPhysicPaintScriptLibraryRequest',
      'sendPhysicPaintAudioOwnership',
      'sendPhysicPaintFrameSyncMessage',
      'createPhysicPaintThumbnailNativeEncoder',
    ]) expect(transport).toContain(retained);

    for (const removed of [
      'sendPhysicPaintOpenLoopEdit',
      'sendPhysicPaintLoopOperationRequest',
      'sendPhysicPaintLoopOperationResult',
      'PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT',
    ]) expect(transport).not.toContain(removed);
  });
});

describe('image-library bridge pair (49-04, Task 1)', () => {
  const sampleImages: MceImageRef[] = [
    { id: 'asset-1', original_filename: 'shot_1.png', relative_path: 'images/shot_1.png', thumbnail_relative_path: 'images/thumbs/shot_1.png', width: 100, height: 100, format: 'png' },
    { id: 'asset-2', original_filename: 'shot_2.png', relative_path: 'images/shot_2.png', thumbnail_relative_path: 'images/thumbs/shot_2.png', width: 200, height: 200, format: 'png' },
  ];

  it('ROUND-TRIP: a request with operationId X receives exactly the result for X carrying { images, projectDir } from the main-window imageStore state at request time', () => {
    const result = applyPhysicPaintImageLibraryRequest(
      { operationId: 'op-1' },
      { getImages: () => sampleImages, getProjectDir: () => '/project/dir' },
    );
    expect(result).toEqual({ operationId: 'op-1', ok: true, images: sampleImages, projectDir: '/project/dir' });
    // The result is the exact event payload the consumer correlates on.
    expect(result.operationId).toBe('op-1');
  });

  it('CORRELATION: a late result for a superseded operationId is dropped; two overlapping requests resolve independently', async () => {
    const sent: Array<{ operationId: string }> = [];
    const lifecycle = createImageLibraryRequestLifecycle({
      getBridgeMode: () => 'Tauri' as const,
      sendRequest: async (request) => { sent.push(request); },
    });
    const first = lifecycle.request();
    const second = lifecycle.request();
    expect(lifecycle.pendingCount()).toBe(2);
    // A late result for a superseded operationId is dropped — nothing settles.
    lifecycle.handleResult({ operationId: 'superseded', ok: true, images: [], projectDir: '/x' });
    expect(lifecycle.pendingCount()).toBe(2);
    // Two overlapping requests resolve independently, each to its own result.
    const firstOpId = sent[0].operationId;
    const secondOpId = sent[1].operationId;
    expect(firstOpId).not.toBe(secondOpId);
    lifecycle.handleResult({ operationId: firstOpId, ok: true, images: sampleImages, projectDir: '/first' });
    const firstResult = await first;
    expect(firstResult.projectDir).toBe('/first');
    expect(firstResult.images).toEqual(sampleImages);
    expect(lifecycle.pendingCount()).toBe(1);
    lifecycle.handleResult({ operationId: secondOpId, ok: true, images: [], projectDir: '/second' });
    const secondResult = await second;
    expect(secondResult.projectDir).toBe('/second');
    expect(lifecycle.pendingCount()).toBe(0);
    lifecycle.dispose();
  });

  it('VALIDATION: a malformed result payload is rejected at the bridge boundary without surfacing to consumers', () => {
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: [], projectDir: '/x' })).toBe(true);
    // Missing images array.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, projectDir: '/x' })).toBe(false);
    // Missing projectDir.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: [] })).toBe(false);
    // Empty projectDir.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: [], projectDir: '' })).toBe(false);
    // images not an array.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: 'nope', projectDir: '/x' })).toBe(false);
    // Malformed image member.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: [{ id: 'a' }], projectDir: '/x' })).toBe(false);
    // Unknown member.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: [], projectDir: '/x', extra: 1 })).toBe(false);
    // error not a string.
    expect(isPhysicPaintImageLibraryResult({ operationId: 'op-1', ok: true, images: [], projectDir: '/x', error: 42 })).toBe(false);
  });

  it('CAPABILITY DELTA: physics-paint.json parses and its permission set is exactly the prior set + dialog:allow-open (no fs:* permission)', () => {
    const capability = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../src-tauri/capabilities/physics-paint.json', import.meta.url)), 'utf8'));
    const prior = [
      'core:default',
      'core:window:default',
      'core:window:allow-close',
      'core:window:allow-destroy',
      'core:event:default',
      'store:default',
      'notification:allow-is-permission-granted',
      'notification:allow-request-permission',
      'notification:allow-notify',
    ];
    expect(capability.permissions).toEqual([...prior, 'dialog:allow-open']);
    expect(capability.permissions.some((permission: unknown) => typeof permission === 'string' && permission.startsWith('fs:'))).toBe(false);
  });

  it('exposes the image-library request/result event constants on the bridge', () => {
    expect(PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT).toBe('physic-paint:image-library-request');
    expect(PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT).toBe('physic-paint:image-library-result');
  });

  it('PROJECT-DIR FALLBACK: the production wiring resolves tempProjectDir when dirPath is null (49-04 UAT fix)', () => {
    // The main flow (ImportedView) uses `dirPath ?? tempProjectDir`; the bridge
    // must match so a temp-dir-opened project (dirPath null) does not report
    // "No project directory is open." and import does not silently no-op.
    const bridge = readFileSync(fileURLToPath(new URL('../../../lib/physicPaintBridge.ts', import.meta.url)), 'utf8');
    expect(bridge).toContain("import { tempProjectDir } from './projectDir';");
    expect(bridge).toContain("getImages: () => imageStore.toMceImages(projectStore.dirPath.value ?? tempProjectDir.value ?? '')");
    expect(bridge).toContain("getProjectDir: () => projectStore.dirPath.value ?? tempProjectDir.value ?? ''");
  });
});

/**
 * quick-260921-bjm: the picker's Import ran in the STUDIO webview, so it wrote
 * the CHILD realm's imageStore module instance — a different module instance
 * from the main webview's, the only one `projectStore.buildMceProject()` reads
 * for the manifest `images` array. The bytes landed on disk (verdict (a)
 * false), the library RECORD never left the child (verdict (b) true), and the
 * next launch asked for a library without it. This pair is the missing
 * child→main leg: the child names dialog-selected PATHS, the main realm
 * resolves its OWN destination and answers with the post-import library.
 */
describe('image-import bridge pair (quick-260921-bjm)', () => {
  const PROJECT_DIR = '/projects/import-demo';
  const dialogPaths = ['/Users/someone/Pictures/shot_1.png', '/Users/someone/Pictures/shot_2.png'];
  const importedImage = {
    id: 'asset-imported',
    original_path: 'shot_1.png',
    project_path: `${PROJECT_DIR}/images/shot_1_ab12cd34.png`,
    thumbnail_path: `${PROJECT_DIR}/images/.thumbs/shot_1_ab12cd34.png`,
    width: 640,
    height: 480,
    format: 'png',
  };
  const importedRef = {
    id: 'asset-imported',
    original_filename: 'shot_1.png',
    relative_path: 'images/shot_1_ab12cd34.png',
    thumbnail_relative_path: 'images/.thumbs/shot_1_ab12cd34.png',
    width: 640,
    height: 480,
    format: 'png',
  };

  // The hoisted `invoke` spy is shared across the whole file and the later
  // thumbnail describe asserts its TOTAL call count — clear the history the
  // REOPEN SEAM leg (and any failed early exit) leaves behind.
  afterEach(() => { invoke.mockClear(); });

  it('REQUEST GUARD: the payload names operationId + paths only — a destination directory, an unbounded entry, or an empty list is rejected (T-260921-bjm-01/03)', () => {
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: ['/tmp/a.png'] })).toBe(true);
    // A payload naming a destination directory is rejected at the boundary:
    // the main realm resolves its own dir, the child never chooses it.
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: ['/tmp/a.png'], projectDir: '/tmp/project' })).toBe(false);
    // paths not an array / empty array / non-string entry / empty entry.
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: 'nope' })).toBe(false);
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: [] })).toBe(false);
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: [42] })).toBe(false);
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: [''] })).toBe(false);
    // Over-long path and over-long path list are both bounded out.
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: [`/tmp/a.png${'x'.repeat(5000)}`] })).toBe(false);
    expect(isPhysicPaintImageImportRequest({ operationId: 'op-1', paths: Array.from({ length: 65 }, (_, index) => `/tmp/${index}.png`) })).toBe(false);
    // operationId absent / empty / over-long.
    expect(isPhysicPaintImageImportRequest({ paths: ['/tmp/a.png'] })).toBe(false);
    expect(isPhysicPaintImageImportRequest({ operationId: '', paths: ['/tmp/a.png'] })).toBe(false);
    expect(isPhysicPaintImageImportRequest({ operationId: 'x'.repeat(500), paths: ['/tmp/a.png'] })).toBe(false);
    // The result side is validated on correlation (T-260921-bjm-02).
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: true, images: [importedRef], errors: [] })).toBe(true);
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: false, images: [], errors: [], error: 'Image import failed' })).toBe(true);
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: true, images: 'nope', errors: [] })).toBe(false);
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: true, images: [], errors: [42] })).toBe(false);
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: true, images: [{ id: 'a' }], errors: [] })).toBe(false);
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: true, images: [], errors: [], extra: 1 })).toBe(false);
    expect(isPhysicPaintImageImportResult({ operationId: 'op-1', ok: true, images: [], errors: [], error: 42 })).toBe(false);
  });

  it('HANDLER: a valid request imports the dialog paths once, into the MAIN realm\'s own resolved directory, and answers with the post-import library snapshot', async () => {
    const attempts: Array<{ paths: readonly string[]; projectDir: string }> = [];
    const state = {
      getImages: () => [importedRef],
      getProjectDir: () => PROJECT_DIR,
      importImages: async (paths: readonly string[], projectDir: string) => {
        attempts.push({ paths, projectDir });
        return [] as readonly string[];
      },
    };
    const result = await applyPhysicPaintImageImportRequest({ operationId: 'op-import-1', paths: dialogPaths }, state);

    // Exactly one attempt, handed the dialog paths verbatim and the MAIN
    // realm's own directory — never a directory taken from the payload.
    expect(attempts).toHaveLength(1);
    expect(attempts[0].paths).toEqual(dialogPaths);
    expect(attempts[0].projectDir).toBe(PROJECT_DIR);
    expect(result).toEqual({ operationId: 'op-import-1', ok: true, images: [importedRef], errors: [] });
    expect(result.operationId).toBe('op-import-1');
  });

  it('PER-FILE ERRORS: a partially failed import still lands ok:true with the ready-to-ship error strings', async () => {
    const state = {
      getImages: () => [importedRef],
      getProjectDir: () => PROJECT_DIR,
      importImages: async () => ['/Users/someone/Pictures/shot_2.png: Failed to copy image: denied'] as readonly string[],
    };
    const result = await applyPhysicPaintImageImportRequest({ operationId: 'op-import-2', paths: dialogPaths }, state);

    expect(result.ok).toBe(true);
    expect(result.images).toEqual([importedRef]);
    expect(result.errors).toEqual(['/Users/someone/Pictures/shot_2.png: Failed to copy image: denied']);
    expect(result.error).toBeUndefined();
  });

  it('TERMINAL: an empty project directory, an unperformable import, and a thrown import are ok:false with zero mutation and no silent no-op', async () => {
    const unusedImport = vi.fn(async () => [] as readonly string[]);
    const noDir = await applyPhysicPaintImageImportRequest(
      { operationId: 'op-3', paths: dialogPaths },
      { getImages: () => [importedRef], getProjectDir: () => '', importImages: unusedImport },
    );
    // The child pre-flight copy, preserved end to end.
    expect(noDir).toEqual({ operationId: 'op-3', ok: false, images: [], errors: [], error: 'No project directory is open.' });
    expect(unusedImport).not.toHaveBeenCalled();

    const nullImport = await applyPhysicPaintImageImportRequest(
      { operationId: 'op-4', paths: dialogPaths },
      { getImages: () => [importedRef], getProjectDir: () => PROJECT_DIR, importImages: async () => null },
    );
    expect(nullImport).toEqual({ operationId: 'op-4', ok: false, images: [], errors: [], error: 'Image import failed' });

    const thrown = await applyPhysicPaintImageImportRequest(
      { operationId: 'op-5', paths: dialogPaths },
      { getImages: () => [importedRef], getProjectDir: () => PROJECT_DIR, importImages: async () => { throw new Error('ipc exploded'); } },
    );
    expect(thrown.ok).toBe(false);
    expect(thrown.images).toEqual([]);
    expect(thrown.error).toBe('Image import failed: Error: ipc exploded');
  });

  it('MALFORMED REQUEST: a bad payload is terminal with ZERO import attempts', async () => {
    const attempts = vi.fn(async () => [] as readonly string[]);
    for (const payload of [
      { operationId: 'op-6', paths: dialogPaths, projectDir: PROJECT_DIR },
      { operationId: 'op-6', paths: [] },
      { paths: dialogPaths },
      'nope',
      null,
    ]) {
      const result = await applyPhysicPaintImageImportRequest(payload, {
        getImages: () => [importedRef],
        getProjectDir: () => PROJECT_DIR,
        importImages: attempts,
      });
      expect(result.ok).toBe(false);
      expect(result.images).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.error).toBe('Invalid image import request');
    }
    expect(attempts).not.toHaveBeenCalled();
  });

  it('exposes the image-import request/result event constants on the bridge', () => {
    expect(PHYSIC_PAINT_IMAGE_IMPORT_REQUEST_EVENT).toBe('physic-paint:image-import-request');
    expect(PHYSIC_PAINT_IMAGE_IMPORT_RESULT_EVENT).toBe('physic-paint:image-import-result');
  });

  it('REOPEN SEAM: a picker import reaches the REAL main-realm imageStore, the library read contains the ref with project-relative paths, and the manifest mark-dirty trigger fires', async () => {
    imageStore.reset();
    let markDirtyCalls = 0;
    _setImageMarkDirtyCallback(() => { markDirtyCalls += 1; });
    invoke.mockResolvedValueOnce({ imported: [importedImage], errors: [] });

    // Production ports (the main realm's own binding, including its import
    // adapter) with the test's explicit project directory.
    const state = {
      ...createPhysicPaintImageImportStatePorts(),
      getImages: () => imageStore.toMceImages(PROJECT_DIR),
      getProjectDir: () => PROJECT_DIR,
    };
    const result = await applyPhysicPaintImageImportRequest({ operationId: 'op-seam', paths: dialogPaths }, state);

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('import_images', { paths: dialogPaths, projectDir: PROJECT_DIR });
    // autoSave subscribes to imageStore.images in the MAIN realm only — this is
    // the trigger the manifest write hangs off.
    expect(markDirtyCalls).toBe(1);
    // "close Studio → reopen → gallery present": the next library request (and
    // projectStore.buildMceProject) reads the SAME realm this imported into.
    const reopened = applyPhysicPaintImageLibraryRequest({ operationId: 'op-lib' }, { getImages: state.getImages, getProjectDir: state.getProjectDir });
    expect(reopened.ok).toBe(true);
    expect(reopened.images).toEqual([importedRef]);

    // A failed import leaves the library byte-identical — never a silent no-op
    // dressed as a success.
    invoke.mockRejectedValueOnce(new Error('disk full'));
    const failed = await applyPhysicPaintImageImportRequest({ operationId: 'op-seam-2', paths: dialogPaths }, state);
    expect(failed.ok).toBe(false);
    expect(failed.images).toEqual([]);
    expect(failed.error).toBe('Image import failed');
    expect(markDirtyCalls).toBe(1);
    expect(imageStore.toMceImages(PROJECT_DIR)).toEqual([importedRef]);
    imageStore.reset();
    _setImageMarkDirtyCallback(() => {});
  });
});

describe('thumbnail native encoder raw-bytes transport (52.1 Save Action regression)', () => {
  it('sends the rgba as the raw invoke body with dimensions in headers, and normalizes the number-array response', async () => {
    invoke.mockResolvedValueOnce([82, 73, 70, 70, 87, 69, 66, 80]);
    const rgba = new Uint8Array(2 * 2 * 4).fill(7);

    const result = await createPhysicPaintThumbnailNativeEncoder().encodeWebp({ width: 2, height: 2, quality: 0.8, rgba });

    expect(invoke).toHaveBeenCalledTimes(1);
    const [command, body, options] = invoke.mock.calls[0];
    expect(command).toBe('script_library_encode_thumbnail_webp');
    // The raw Uint8Array IS the invoke body. Crossing the event bridge (or a
    // JSON arg) index-objects the bytes and orphans the request — the silent
    // Save Action stall this regression came from.
    expect(body).toBe(rgba);
    expect(options.headers).toMatchObject({ width: '2', height: '2', quality: '0.8' });
    expect(options.headers.operationid).toMatch(/^physics-paint-thumbnail-/);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.mimeType).toBe('image/webp');
    // macOS serializes a raw response as a JSON number array — normalize.
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.bytes)).toEqual([82, 73, 70, 70, 87, 69, 66, 80]);
  });

  it('propagates a Rust encode failure as a rejection so the save failure is loud (no silent stall)', async () => {
    invoke.mockRejectedValueOnce(new Error('Thumbnail RGBA length does not match dimensions'));

    await expect(
      createPhysicPaintThumbnailNativeEncoder().encodeWebp({ width: 2, height: 2, quality: 0.8, rgba: new Uint8Array(16) }),
    ).rejects.toThrow('Thumbnail RGBA length does not match dimensions');
  });

  it('keeps the retired event relay out of the transport', () => {
    // The tree-wide scan lives in efxPaintCleanBreakContract.test.ts (D-19);
    // this pins the transport file itself.
    expect(transport).not.toContain('PHYSIC_PAINT_THUMBNAIL_ENCODE');
    expect(transport).not.toContain("emitTo('main', PHYSIC_PAINT_THUMBNAIL");
  });
});

/**
 * 52.2-10 (D-12): the Studio→main sync carries layer documents as references +
 * metadata; raster bytes ride a digest-keyed channel and only for a digest the
 * companion window is not known to hold. The reference IS the package reference
 * a save would write, so the two windows speak the same identity as the file.
 */
describe('52.2-10 reference sync with a digest-keyed byte channel (D-12)', () => {
  const LAYER = 'layer-52-10';

  interface SyncKey {
    readonly keyId: string;
    readonly appFrame: number;
    readonly bytes: Uint8Array;
  }

  const syncDocument = (keys: readonly SyncKey[]): EfxPaintDocument => {
    const base = createEfxPaintDocument(LAYER);
    const track = base.tracks[0];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const realKeyRecords = keys.map((key) => ({
      kind: 'real-key' as const,
      keyId: key.keyId,
      appFrame: key.appFrame,
      payload: { frameIndex: 0, appFrame: key.appFrame, bytes: key.bytes, width: 8, height: 6 },
    }));
    const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
      capacity: 4096,
      realKeyRecords,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], [], []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    return { ...base, tracks: [{ ...track, rotoPhysical }] };
  };

  interface EmittedSync {
    readonly document: EfxPaintDocument;
    readonly changedBytes?: Record<string, string>;
  }

  const emittedSync = (index: number): EmittedSync => emitTo.mock.calls[index][2] as EmittedSync;
  const lastSync = (): EmittedSync => emittedSync(emitTo.mock.calls.length - 1);
  const emittedRecords = (payload: EmittedSync) => payload.document.tracks[0].rotoPhysical?.realKeyRecords ?? [];

  const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  beforeEach(() => {
    emitTo.mockClear();
    performanceRecord.mockClear();
    resetEfxPaintDocumentSyncTransferState();
  });

  it('emits a reference-shaped record whose digest is the SHA-256 the package will persist', async () => {
    const bytes = testWebpBytes('steady-state');
    await sendEfxPaintDocumentSync(syncDocument([{ keyId: 'key-1', appFrame: 0, bytes }]), 'Tauri');

    const payload = lastSync();
    const record = emittedRecords(payload)[0];
    const media = record.payload.media;
    expect(record.payload.bytes).toBeUndefined();
    expect(media?.relativePath).toBe(buildFrameMediaRelativePath(LAYER, 'key-1'));
    expect(media?.digest).toBe(await sha256Hex(bytes));
    expect(media?.width).toBe(8);
    expect(media?.height).toBe(6);
    // The changed frame still crosses: a references-only bridge with no byte
    // channel would silently drop this paint.
    expect(payload.changedBytes).toEqual({ [media?.digest as string]: bytesToBase64(bytes) });
  });

  it('ships one byte-map entry for three keys whose content is identical', async () => {
    const shared = testWebpBytes('shared-content');
    await sendEfxPaintDocumentSync(syncDocument([
      { keyId: 'key-a', appFrame: 0, bytes: shared },
      { keyId: 'key-b', appFrame: 1, bytes: shared.slice() },
      { keyId: 'key-c', appFrame: 2, bytes: testWebpBytes('shared-content') },
    ]), 'Tauri');

    const payload = lastSync();
    const digests = emittedRecords(payload).map((record) => record.payload.media?.digest);
    expect(new Set(digests).size).toBe(1);
    expect(Object.keys(payload.changedBytes ?? {})).toHaveLength(1);
  });

  it('a repeated sync with no content change transfers no bytes at all and emits the identical reference document', async () => {
    // A frame whose base64 form is comfortably longer than the 256-character
    // ceiling, so the scan below cannot pass vacuously on a tiny fixture.
    const document = syncDocument([{ keyId: 'key-1', appFrame: 0, bytes: testWebpBytes('R'.repeat(512)) }]);
    await sendEfxPaintDocumentSync(document, 'Tauri');
    await sendEfxPaintDocumentSync(document, 'Tauri');

    const first = emittedSync(0);
    const second = emittedSync(1);
    expect(second.changedBytes).toBeUndefined();
    expect(JSON.stringify(second.document)).toBe(JSON.stringify(first.document));
    // Nothing raster-sized survives in the steady-state payload (D-12).
    const strings = JSON.stringify(second).match(/"[^"]*"/g) ?? [];
    expect(strings.every((value) => value.length <= 256)).toBe(true);
  });

  it('re-ships exactly the digest whose content changed', async () => {
    await sendEfxPaintDocumentSync(syncDocument([
      { keyId: 'key-a', appFrame: 0, bytes: testWebpBytes('untouched') },
      { keyId: 'key-b', appFrame: 1, bytes: testWebpBytes('before-edit') },
    ]), 'Tauri');
    const edited = testWebpBytes('after-edit');
    await sendEfxPaintDocumentSync(syncDocument([
      { keyId: 'key-a', appFrame: 0, bytes: testWebpBytes('untouched') },
      { keyId: 'key-b', appFrame: 1, bytes: edited },
    ]), 'Tauri');

    const payload = lastSync();
    expect(Object.keys(payload.changedBytes ?? {})).toEqual([await sha256Hex(edited)]);
    expect(emittedRecords(payload).map((record) => record.payload.media?.digest)).toEqual([
      await sha256Hex(testWebpBytes('untouched')),
      await sha256Hex(edited),
    ]);
  });

  it('withholds bytes for a digest the caller reports the receiver already holds', async () => {
    const bytes = testWebpBytes('known');
    const document = syncDocument([{ keyId: 'key-1', appFrame: 0, bytes }]);

    // Control: the same document without the option ships its bytes.
    await sendEfxPaintDocumentSync(document, 'Tauri');
    const payload = lastSync();
    const digest = emittedRecords(payload)[0].payload.media?.digest as string;
    expect(payload.changedBytes).toEqual({ [digest]: bytesToBase64(bytes) });

    resetEfxPaintDocumentSyncTransferState();
    await sendEfxPaintDocumentSync(document, 'Tauri', undefined, { knownDigests: [digest] });

    expect(lastSync().changedBytes).toBeUndefined();
  });

  it('bounds a very large unchanged document to a reference-sized payload', async () => {
    const keys = Array.from({ length: 192 }, (_, index) => ({
      keyId: `key-large-${index}`,
      appFrame: index,
      bytes: testWebpBytes(`${'L'.repeat(4096)}:${index}`),
    }));
    const document = syncDocument(keys);
    await sendEfxPaintDocumentSync(document, 'Tauri');
    await sendEfxPaintDocumentSync(document, 'Tauri');

    const cold = JSON.stringify(emittedSync(0)).length;
    const warmed = JSON.stringify(emittedSync(1)).length;
    // The former shape base64'd every payload on every sync; the reference
    // payload is bounded by the metadata, not the pixels (assert a ceiling).
    expect(cold).toBeGreaterThan(512 * 1024);
    expect(warmed).toBeLessThan(64 * 1024);
  });

  it('marks a frame delivered through the apply channel so the next sync withholds its bytes', async () => {
    const bytes = testWebpBytes('delivered-through-apply');
    const document = syncDocument([{ keyId: 'key-1', appFrame: 0, bytes }]);

    // The coordinator delivered this raster through the per-key apply channel;
    // the sender's claim about the receiver's frame store must now be truthful
    // for the digest channel (D-12 steady state, T-52.2-35 retry law).
    await markEfxPaintDocumentSyncFrameDelivered(LAYER, document.tracks[0].id, 'key-1', bytes);
    await sendEfxPaintDocumentSync(document, 'Tauri');

    expect(lastSync().changedBytes).toBeUndefined();
  });

  it('keeps the bridge telemetry stages on every sync', async () => {
    const document = syncDocument([{ keyId: 'key-1', appFrame: 0, bytes: testWebpBytes('telemetry') }]);
    await sendEfxPaintDocumentSync(document, 'Tauri');
    await sendEfxPaintDocumentSync(document, 'Tauri');

    const stages = performanceRecord.mock.calls.map((call) => (call[0] as { stage: string }).stage);
    expect(stages.filter((stage) => stage === 'bridge.docSyncEncode')).toHaveLength(2);
    expect(stages.filter((stage) => stage === 'bridge.docSyncEmit')).toHaveLength(2);
  });
});

/**
 * quick-260913-52r (H): the crash-recovery checkpoint crosses the storage
 * boundary in the transport shape (bytes as base64 — a raw JSON.stringify turns
 * Uint8Array into an index object the launch validator refuses) and is BOUND to
 * the launch operationId that wrote it: only the same launch (a watchdog reload
 * of the same window) may consume it. A leftover checkpoint from an earlier
 * Studio session can never substitute a newer launch's carried document.
 */
describe('session document checkpoint is transport-shaped and launch-bound (quick-260913-52r H)', () => {
  const LAYER = 'layer-h-checkpoint';
  const stored = new Map<string, string>();

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
      removeItem: (key: string) => {
        stored.delete(key);
      },
      clear: () => {
        stored.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const checkpointDocument = (bytes: Uint8Array): EfxPaintDocument => {
    const base = createEfxPaintDocument(LAYER);
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const realKeyRecords = [{
      kind: 'real-key' as const,
      keyId: 'key-1',
      appFrame: 0,
      payload: { frameIndex: 0, appFrame: 0, bytes, width: 8, height: 6 },
    }];
    const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
      capacity: 4096,
      realKeyRecords,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], [], []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    return { ...base, tracks: [{ ...base.tracks[0], rotoPhysical }] };
  };

  type SerializedCheckpoint = {
    readonly operationId: string;
    readonly document: {
      readonly tracks: readonly {
        readonly rotoPhysical: {
          readonly realKeyRecords: readonly { readonly payload: { readonly bytes?: unknown } }[];
        } | null;
      }[];
    };
  };

  it('round-trips real bytes for the launch that wrote it, with base64 on the wire shape', () => {
    const bytes = testWebpBytes('checkpoint-roundtrip');
    writeEfxPaintSessionDocumentCheckpoint('op-1', checkpointDocument(bytes));

    const raw = stored.get(PHYSIC_PAINT_SESSION_DOCUMENT_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!) as SerializedCheckpoint;
    expect(parsed.operationId).toBe('op-1');
    // The storage-shape law: bytes crossed as a base64 string, never a JSON
    // index object (a raw JSON.stringify here deads the next Studio open).
    expect(typeof parsed.document.tracks[0]!.rotoPhysical!.realKeyRecords[0]!.payload.bytes).toBe('string');

    const restored = readEfxPaintSessionDocumentCheckpoint('op-1');
    expect(restored).not.toBeNull();
    const restoredBytes = restored!.tracks[0]!.rotoPhysical!.realKeyRecords[0]!.payload.bytes;
    expect(restoredBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(restoredBytes!)).toEqual(Array.from(bytes));
  });

  it('a checkpoint from an earlier launch is never substituted into a newer one', () => {
    writeEfxPaintSessionDocumentCheckpoint('op-1', checkpointDocument(testWebpBytes('old-launch')));
    expect(readEfxPaintSessionDocumentCheckpoint('op-2')).toBeNull();
  });

  it('a legacy raw-document checkpoint (pre-fix shape) is ignored, never migrated', () => {
    stored.set(PHYSIC_PAINT_SESSION_DOCUMENT_KEY, JSON.stringify(checkpointDocument(testWebpBytes('legacy'))));
    expect(readEfxPaintSessionDocumentCheckpoint('op-1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 260921-e21: the three Studio-origin document surfaces across the REAL pair.
//
// Diagnosis at base (probes recorded in 260921-e21-RED-EVIDENCE.json): this
// file's transport and the parent apply are GREEN for all three surfaces when
// they are driven directly, and so are the reopen carrier and the child
// hydration (probes B/C/D/D2). The link that can lose them is the child PUSH
// WIRING, pinned by contract in PhysicsPaintStudio.test.ts. This leg is the
// reopen contract the same document must keep whenever it IS pushed: a
// reference selection, a background keyframe placement and a (+) track reach
// the realm that owns the save path, through the pre-existing event pair and
// the pre-existing carrier — no second channel.
// ---------------------------------------------------------------------------
describe('Studio-origin document surfaces across the real pair (quick-260921-e21)', () => {
  const LAYER = 'layer-e21';
  type SyncHandler = (event: { detail?: unknown }) => void;
  const installed = new Map<string, SyncHandler>();

  const stubWindow = () => {
    installed.clear();
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: (name: string, fn: unknown) => { installed.set(name, fn as SyncHandler); },
        removeEventListener: (name: string) => { installed.delete(name); },
        location: { origin: 'http://localhost' },
      },
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    emitTo.mockClear();
    resetEfxPaintDocumentSyncTransferState();
    resetEfxPaintStore();
    physicPaintStore.reset();
    stubWindow();
    // The reopen carrier resolves the layer's parent timeline range from the
    // sequence store; the layer must belong to a live sequence or the carrier
    // refuses the launch.
    sequenceStore.sequences.value = [{
      id: 'e21-parent-sequence',
      kind: 'fx',
      name: 'e21 parent authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [physicLayer()],
      inFrame: 0,
      outFrame: 60,
    }];
  });

  afterEach(() => {
    sequenceStore.sequences.value = [];
    delete (globalThis as { window?: unknown }).window;
  });

  function physicLayer(): Layer {
    return {
      id: LAYER,
      name: 'Physic Paint',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'physic-paint', layerId: LAYER },
    };
  }

  const TRACK1 = 'e21-track-1';

  const baseDocument = (): EfxPaintDocument => {
    const base = createEfxPaintDocument(LAYER);
    return { ...base, activeTrackId: TRACK1, tracks: [{ ...base.tracks[0], id: TRACK1 }] };
  };

  it('carries the reference selection, the background keyframes and the (+) track into the reopen carrier', async () => {
    const base = baseDocument();
    registerEfxPaintDocument(base);
    const physical = parsePhysicPaintRotoPhysicalDocument({
      capacity: 4096,
      realKeyRecords: [{ kind: 'real-key', keyId: 'k1', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('k1'), width: 8, height: 6 } }],
      groupOverrideRecords: [],
      interpolation: { enabled: false, mode: 'duplicate' },
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(
        [{ kind: 'real-key', keyId: 'k1', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('k1'), width: 8, height: 6 } }],
        { enabled: false, mode: 'duplicate' }, [], [], [],
      ),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    registerEfxPaintDocument({ ...base, tracks: [{ ...base.tracks[0], rotoPhysical: physical }] });
    const parentBefore = getEfxPaintDocument(LAYER)!;

    // The three Studio-origin mutations, in the child realm.
    const refResult = setPhotoReferenceSource(LAYER, ['ref-photo-1']);
    const clipResult = addBackgroundClip(LAYER, { startFrame: 4, sourceFrameRefs: ['ref-bg-1'], repeat: { mode: 'finite', count: 1 } });
    const trackResult = addTrack(LAYER);
    expect(refResult.ok).toBe(true);
    expect(clipResult.ok).toBe(true);
    expect(trackResult.ok).toBe(true);
    const addedTrackId = trackResult.ok ? trackResult.trackId : '';

    const childDocument = serializeRuntimeIntoDocument(LAYER);
    await sendEfxPaintDocumentSync(childDocument, 'Tauri');
    expect(emitTo).toHaveBeenCalledTimes(1);
    const payload = emitTo.mock.calls[emitTo.mock.calls.length - 1][2] as { document: unknown };

    // Parent realm: the REAL receiver applies the pushed document.
    resetEfxPaintStore();
    physicPaintStore.reset();
    registerEfxPaintDocument(parentBefore);
    const unlisten = await installPhysicPaintEfxPaintDocumentListener();
    const handler = installed.get(PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT);
    expect(typeof handler).toBe('function');
    handler?.({ detail: payload });
    const applied = getEfxPaintDocument(LAYER)!;
    expect(applied.photoReference?.sourceFrameRefs).toEqual(['ref-photo-1']);
    expect(applied.background.clips.map((clip) => ({ startFrame: clip.startFrame, refs: clip.sourceFrameRefs })))
      .toEqual([{ startFrame: 4, refs: ['ref-bg-1'] }]);
    expect(applied.tracks.map((track) => track.id)).toContain(addedTrackId);
    unlisten();

    // The reopen half: the launch carrier a reopened Studio receives.
    const carrier = createPhysicPaintLaunchContext(physicLayer(), 0);
    expect(carrier.document.photoReference?.sourceFrameRefs).toEqual(['ref-photo-1']);
    expect(carrier.document.background.clips.map((clip) => ({ startFrame: clip.startFrame, refs: clip.sourceFrameRefs })))
      .toEqual([{ startFrame: 4, refs: ['ref-bg-1'] }]);
    expect(carrier.document.tracks.map((track) => track.id)).toContain(addedTrackId);
  });
});
