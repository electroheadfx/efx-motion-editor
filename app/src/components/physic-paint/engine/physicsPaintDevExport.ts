import {
  clampPhysicPaintFrameCount,
  isPhysicPaintRenderedFrame,
  type PhysicPaintRenderedFrame,
} from '../../../types/physicPaint';

export const PHYSICS_PAINT_DEBUG_EXPORT_KIND = 'physics-paint-debug-export';
export const PHYSICS_PAINT_DEBUG_MANIFEST_FILENAME = 'manifest.json';

export interface PhysicsPaintDebugManifestFrame {
  frameIndex: number;
  appFrame: number;
  file: string;
  width?: number;
  height?: number;
}

export interface PhysicsPaintDebugManifest {
  kind: typeof PHYSICS_PAINT_DEBUG_EXPORT_KIND;
  file: typeof PHYSICS_PAINT_DEBUG_MANIFEST_FILENAME;
  layerId: string;
  operationId: string;
  startFrame: number;
  frameCount: number;
  fps: number;
  generatedAt: string;
  canvas: {
    width?: number;
    height?: number;
  };
  frames: PhysicsPaintDebugManifestFrame[];
}

export interface PhysicsPaintStillExport {
  kind: typeof PHYSICS_PAINT_DEBUG_EXPORT_KIND;
  file: string;
  frameIndex: number;
  appFrame: number;
  mimeType: 'image/png';
  width?: number;
  height?: number;
  dataUrl: string;
}

interface BuildPhysicsPaintDebugManifestArgs {
  layerId: string;
  operationId: string;
  startFrame: number;
  frameCount: number;
  frames: PhysicPaintRenderedFrame[];
  fps: number;
  generatedAt?: string;
}

export function makePhysicsPaintFrameFilename(frameIndex: number): string {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    throw new Error('Physics paint debug export frameIndex must be a non-negative integer');
  }
  return `frame-${String(frameIndex).padStart(4, '0')}.png`;
}

export function buildPhysicsPaintDebugManifest(args: BuildPhysicsPaintDebugManifestArgs): PhysicsPaintDebugManifest {
  validateManifestArgs(args);

  const [firstFrame] = args.frames;
  const generatedAt = args.generatedAt ?? new Date().toISOString();

  return {
    kind: PHYSICS_PAINT_DEBUG_EXPORT_KIND,
    file: PHYSICS_PAINT_DEBUG_MANIFEST_FILENAME,
    layerId: args.layerId,
    operationId: args.operationId,
    startFrame: args.startFrame,
    frameCount: args.frameCount,
    fps: args.fps,
    generatedAt,
    canvas: {
      width: firstFrame.width,
      height: firstFrame.height,
    },
    frames: args.frames.map((frame) => ({
      frameIndex: frame.frameIndex,
      appFrame: frame.appFrame,
      file: makePhysicsPaintFrameFilename(frame.frameIndex),
      width: frame.width,
      height: frame.height,
    })),
  };
}

export function buildPhysicsPaintStillExport(frame: PhysicPaintRenderedFrame): PhysicsPaintStillExport {
  if (!isPhysicPaintRenderedFrame(frame)) {
    throw new Error('Physics paint still debug export requires a valid PNG rendered frame');
  }

  return {
    kind: PHYSICS_PAINT_DEBUG_EXPORT_KIND,
    file: makePhysicsPaintFrameFilename(frame.frameIndex),
    frameIndex: frame.frameIndex,
    appFrame: frame.appFrame,
    mimeType: 'image/png',
    width: frame.width,
    height: frame.height,
    dataUrl: frame.dataUrl,
  };
}

export function dataUrlToBlobPart(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,(.*)$/u.exec(dataUrl);
  if (!match) {
    throw new Error('Physics paint debug export requires a base64 data URL');
  }

  const [, mimeType, encoded] = match;
  if (mimeType !== 'image/png') {
    throw new Error('Physics paint debug export only supports image/png data URLs');
  }

  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { mimeType, bytes };
}

function validateManifestArgs(args: BuildPhysicsPaintDebugManifestArgs): void {
  if (!isNonEmptyString(args.layerId)) {
    throw new Error('Physics paint debug export requires a layerId');
  }
  if (!isNonEmptyString(args.operationId)) {
    throw new Error('Physics paint debug export requires an operationId');
  }
  if (!Number.isInteger(args.startFrame) || args.startFrame < 0) {
    throw new Error('Physics paint debug export startFrame must be a non-negative integer');
  }
  if (!Number.isInteger(args.frameCount) || args.frameCount < 1 || clampPhysicPaintFrameCount(args.frameCount) !== args.frameCount) {
    throw new Error('Physics paint debug export frameCount must stay within physics paint frame limits');
  }
  if (!Array.isArray(args.frames) || args.frames.length === 0) {
    throw new Error('Physics paint debug export requires at least one captured PNG frame');
  }
  if (args.frames.length !== args.frameCount) {
    throw new Error('Physics paint debug export frameCount mismatch with captured frames');
  }
  if (typeof args.fps !== 'number' || !Number.isFinite(args.fps) || args.fps <= 0) {
    throw new Error('Physics paint debug export fps must be a positive number');
  }

  args.frames.forEach((frame, index) => {
    if (!isPhysicPaintRenderedFrame(frame, args.startFrame + index, index)) {
      throw new Error('Physics paint debug export frames must be sequential PNG rendered frames');
    }
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
