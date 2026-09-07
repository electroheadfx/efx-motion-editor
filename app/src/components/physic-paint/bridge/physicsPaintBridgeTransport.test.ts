import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { createPhysicPaintThumbnailNativeEncoder } from './physicsPaintBridgeTransport';
import {
  applyPhysicPaintImageLibraryRequest,
  createImageLibraryRequestLifecycle,
  PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT,
  PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT,
} from '../../../lib/physicPaintBridge';
import { isPhysicPaintImageLibraryResult } from '../../../types/physicPaint';
import type { MceImageRef } from '../../../types/project';

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
