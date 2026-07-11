import { describe, expect, it } from 'vitest';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, type PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import {
  PHYSICS_PAINT_DEBUG_EXPORT_KIND,
  buildPhysicsPaintDebugManifest,
  buildPhysicsPaintStillExport,
  dataUrlToBlobPart,
  makePhysicsPaintFrameFilename,
} from './physicsPaintDevExport';

const pngDataUrl = (text: string) => `data:image/png;base64,${btoa(text)}`;

const makeFrame = (frameIndex: number, appFrame: number, overrides: Partial<PhysicPaintRenderedFrame> = {}): PhysicPaintRenderedFrame => ({
  frameIndex,
  appFrame,
  dataUrl: pngDataUrl(`frame-${frameIndex}`),
  width: 1000,
  height: 650,
  ...overrides,
});

describe('physicsPaintDevExport', () => {
  it('formats debug frame PNG filenames with stable zero padding', () => {
    expect(makePhysicsPaintFrameFilename(0)).toBe('frame-0000.png');
    expect(makePhysicsPaintFrameFilename(42)).toBe('frame-0042.png');
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
      { frameIndex: 0, appFrame: 12, file: 'frame-0000.png', width: 1000, height: 650 },
      { frameIndex: 1, appFrame: 13, file: 'frame-0001.png', width: 1000, height: 650 },
      { frameIndex: 2, appFrame: 14, file: 'frame-0002.png', width: 1000, height: 650 },
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
      frames: [makeFrame(0, 12, { dataUrl: 'data:image/jpeg;base64,aGVsbG8=' })],
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

  it('builds still PNG proof metadata from one rendered frame', () => {
    const still = buildPhysicsPaintStillExport(makeFrame(42, 99));

    expect(still).toEqual({
      kind: 'physics-paint-debug-export',
      file: 'frame-0042.png',
      frameIndex: 42,
      appFrame: 99,
      mimeType: 'image/png',
      width: 1000,
      height: 650,
      dataUrl: expect.stringContaining('data:image/png'),
    });
  });

  it('decodes PNG data URLs into blob parts for debug download plumbing', () => {
    const blobPart = dataUrlToBlobPart('data:image/png;base64,aGVsbG8=');

    expect(blobPart.mimeType).toBe('image/png');
    expect(new TextDecoder().decode(blobPart.bytes)).toBe('hello');
  });
});
