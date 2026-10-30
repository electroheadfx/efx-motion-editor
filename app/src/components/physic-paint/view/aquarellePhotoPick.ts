// ============================================================
//  261030-cnq UAT round 3 — the color picker's photo law.
//
//  A photo layer (the Photo Reference overlay, then the Background
//  clip) is sampled from its SOURCE IMAGE, never from the composited
//  canvas: the picked color is the photo's own full-strength pixel at
//  the pointer, independent of the overlay opacity and of any paint
//  under or over it. Compositing the photo at its display alpha is
//  what made the pick return "transparency mixed with paint".
//
//  The placement math mirrors the two draw paths exactly:
//    - reference ghost  → PhysicsPaintReferenceGhost.drawReferenceGhost
//    - background clip  → efxPaintCompositor's content draw
//  Both work in the same normalized canvas space the picker samples in
//  (u/v over the sheet), so no working-size/zoom term is needed.
// ============================================================

import { computeEfxPaintBackgroundBaseDrawSize } from '../../../efx-paint/compositor/efxPaintCompositor';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { getDocument } from '../../../stores/efxPaintStore';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { rgbaToHex } from './aquarelleColorPicker';

/** One photo's draw placement in normalized sheet space. */
export interface PhotoPickPlacement {
  readonly imageWidth: number;
  readonly imageHeight: number;
  /** Draw-rect center in u/v (0..1) — already includes the transform offset. */
  readonly centerU: number;
  readonly centerV: number;
  /** Draw-rect extents in u/v. */
  readonly widthU: number;
  readonly heightV: number;
  readonly rotationDeg: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

function finite(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Inverse-map one normalized point through the photo's placement. Returns the
 * image pixel it lands on, or null when the point is outside the photo.
 * Canvas composition order is translate(center) → rotate → scale, so the
 * inverse is un-translate → rotate(-θ) → divide by scale.
 */
export function photoPixelAt(
  placement: PhotoPickPlacement,
  u: number,
  v: number,
): { x: number; y: number } | null {
  const { imageWidth, imageHeight, widthU, heightV, scaleX, scaleY } = placement;
  if (!(imageWidth > 0) || !(imageHeight > 0) || !(widthU > 0) || !(heightV > 0)) return null;
  if (!finite(scaleX) || !finite(scaleY) || scaleX === 0 || scaleY === 0) return null;
  const dx = u - placement.centerU;
  const dy = v - placement.centerV;
  const theta = ((-placement.rotationDeg * Math.PI) / 180) as number;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const lx = (dx * cos - dy * sin) / scaleX;
  const ly = (dx * sin + dy * cos) / scaleY;
  if (Math.abs(lx) > widthU / 2 || Math.abs(ly) > heightV / 2) return null;
  // Nearest pixel (round, not floor): a float wobble at an exact rect boundary
  // must not shift the sample one pixel off the intended one.
  const x = Math.min(imageWidth - 1, Math.max(0, Math.round((lx / widthU + 0.5) * imageWidth)));
  const y = Math.min(imageHeight - 1, Math.max(0, Math.round((ly / heightV + 0.5) * imageHeight)));
  return { x, y };
}

let scratchCanvas: HTMLCanvasElement | null = null;

/**
 * Read one opaque pixel from a decoded photo. Alpha is forced to 1: the pick
 * is the photo's full color, never its display opacity. Any unreadable source
 * yields null (fail closed, never logged).
 */
export function readImagePixelHex(
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
): string | null {
  try {
    if (scratchCanvas === null) {
      scratchCanvas = document.createElement('canvas');
      scratchCanvas.width = 1;
      scratchCanvas.height = 1;
    }
    const context = scratchCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.clearRect(0, 0, 1, 1);
    context.drawImage(image, x, y, 1, 1, 0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return rgbaToHex({ r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: 1 });
  } catch {
    return null;
  }
}

function referencePlacement(
  imageWidth: number,
  imageHeight: number,
  document: EfxPaintDocument,
  projectWidth: number,
  projectHeight: number,
): PhotoPickPlacement {
  const transform = document.photoReference?.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
  return {
    imageWidth,
    imageHeight,
    centerU: 0.5 + transform.x / projectWidth,
    centerV: 0.5 + transform.y / projectHeight,
    widthU: imageWidth / projectWidth,
    heightV: imageHeight / projectHeight,
    rotationDeg: transform.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
  };
}

function backgroundPlacement(
  imageWidth: number,
  imageHeight: number,
  document: EfxPaintDocument,
  clipScale: { readonly x: number; readonly y: number },
  projectWidth: number,
  projectHeight: number,
): PhotoPickPlacement {
  const base = computeEfxPaintBackgroundBaseDrawSize(
    imageWidth,
    imageHeight,
    { width: projectWidth, height: projectHeight },
    clipScale,
  );
  const transform = document.background.transform;
  return {
    imageWidth,
    imageHeight,
    centerU: 0.5 + transform.x / projectWidth,
    centerV: 0.5 + transform.y / projectHeight,
    widthU: base.width / projectWidth,
    heightV: base.height / projectHeight,
    rotationDeg: transform.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
  };
}

/**
 * Build the pick's photo sampler for one frame, or null when no photo layer
 * is visible. Order is the visible stacking order: the Photo Reference overlay
 * sits ABOVE the composite, the Background clip underneath it — either one
 * wins over the paint.
 */
export function createPhotoPickSampler(
  layerId: string,
  frame: number,
  projectWidth: number,
  projectHeight: number,
): ((u: number, v: number) => string | null) | null {
  const document = getDocument(layerId);
  if (!document) return null;
  if (!(projectWidth > 0) || !(projectHeight > 0)) return null;
  const referenceVisible = document.photoReference !== null && document.photoReference.visibleInStudio;
  const backgroundVisible = document.background.visible === true;
  if (!referenceVisible && !backgroundVisible) return null;
  return (u: number, v: number): string | null => {
    if (referenceVisible) {
      const verdict = physicPaintStore.getReferenceSourceFrameVerdict(layerId, frame);
      const image = verdict ? physicPaintStore.getDecodedImage(verdict.bytes) : null;
      if (image) {
        const pixel = photoPixelAt(referencePlacement(image.width, image.height, document, projectWidth, projectHeight), u, v);
        if (pixel) {
          const hex = readImagePixelHex(image, pixel.x, pixel.y);
          if (hex !== null) return hex;
        }
      }
    }
    if (backgroundVisible) {
      const source = physicPaintStore.getBackgroundSourceAt(layerId, frame);
      const image = source ? physicPaintStore.getDecodedImage(source.bytes) : null;
      if (source && image) {
        const pixel = photoPixelAt(
          backgroundPlacement(image.width, image.height, document, source.scale, projectWidth, projectHeight),
          u,
          v,
        );
        if (pixel) {
          const hex = readImagePixelHex(image, pixel.x, pixel.y);
          if (hex !== null) return hex;
        }
      }
    }
    return null;
  };
}
