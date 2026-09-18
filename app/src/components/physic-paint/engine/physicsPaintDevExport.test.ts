import { describe, expect, it } from 'vitest';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, type PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import {
  PHYSICS_PAINT_DEBUG_EXPORT_KIND,
  buildPhysicsPaintDebugManifest,
  buildPhysicsPaintStillExport,
  dataUrlToBlobPart,
  makePhysicsPaintFrameFilename,
} from './physicsPaintDevExport';

const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c]);

const makeFrame = (frameIndex: number, appFrame: number, overrides: Partial<PhysicPaintRenderedFrame> = {}): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  bytes: webpBytes,
  width: 1000,
  height: 650,
  ...overrides,
});

describe('physicsPaintDevExport', () => {
  it('formats debug frame WebP filenames with stable zero padding', () => {
    expect(makePhysicsPaintFrameFilename(0)).toBe('frame-0000.webp');
    expect(makePhysicsPaintFrameFilename(42)).toBe('frame-0042.webp');
  });

  it('builds manifest.json metadata for live captured PNG frames', () => {
    const manifest = buildPhysicsPaintDebugManifest({
      layerId: 'phys-layer-1',
      operationId: 'op-1',
      startFrame: 12,
      frameCount: 3,
      frames: [makeFrame(0, 12), makeFrame(1, 13), makeFrame(2, 14)],
      fps: 24,
      generatedAt: '2026-06-12T12:00:00.000Z',
    });

    expect(PHYSICS_PAINT_DEBUG_EXPORT_KIND).toBe('physics-paint-debug-export');
    expect(manifest).toMatchObject({
      kind: 'physics-paint-debug-export',
      file: 'manifest.json',
      layerId: 'phys-layer-1',
      operationId: 'op-1',
      startFrame: 12,
      frameCount: 3,
      fps: 24,
      canvas: { width: 1000, height: 650 },
      generatedAt: '2026-06-12T12:00:00.000Z',
    });
    expect(manifest.frames).toEqual([
      { frameIndex: 0, appFrame: 12, file: 'frame-0000.webp', width: 1000, height: 650 },
      { frameIndex: 1, appFrame: 13, file: 'frame-0001.webp', width: 1000, height: 650 },
      { frameIndex: 2, appFrame: 14, file: 'frame-0002.webp', width: 1000, height: 650 },
    ]);
  });

  it('rejects invalid manifest inputs instead of producing unbounded or non-PNG dev artifacts', () => {
    expect(() => buildPhysicsPaintDebugManifest({
      layerId: 'phys-layer-1',
      operationId: 'op-1',
      startFrame: 12,
      frameCount: 0,
      frames: [],
      fps: 24,
    })).toThrow(/frameCount/i);

    expect(() => buildPhysicsPaintDebugManifest({
      layerId: 'phys-layer-1',
      operationId: 'op-1',
      startFrame: 12,
      frameCount: 2,
      frames: [makeFrame(0, 12)],
      fps: 24,
    })).toThrow(/mismatch/i);

    expect(() => buildPhysicsPaintDebugManifest({
      layerId: 'phys-layer-1',
      operationId: 'op-1',
      startFrame: 12,
      frameCount: 1,
      frames: [makeFrame(0, 12, { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) })],
      fps: 24,
    })).toThrow(/PNG/i);

    expect(() => buildPhysicsPaintDebugManifest({
      layerId: 'phys-layer-1',
      operationId: 'op-1',
      startFrame: 12,
      frameCount: PHYSIC_PAINT_MAX_APPLY_FRAMES + 1,
      frames: [makeFrame(0, 12)],
      fps: 24,
    })).toThrow(/frameCount/i);
  });

  it('builds still WebP proof metadata from one rendered frame', () => {
    const still = buildPhysicsPaintStillExport(makeFrame(42, 99));

    expect(still).toEqual({
      kind: 'physics-paint-debug-export',
      file: 'frame-0042.webp',
      frameIndex: 42,
      appFrame: 99,
      mimeType: 'image/webp',
      width: 1000,
      height: 650,
      bytes: webpBytes,
    });
  });

  it('decodes PNG data URLs into blob parts for debug download plumbing', () => {
    const blobPart = dataUrlToBlobPart('data:image/png;base64,aGVsbG8=');

    expect(blobPart.mimeType).toBe('image/png');
    expect(new TextDecoder().decode(blobPart.bytes)).toBe('hello');
  });
});
