import type { PhotoReferenceTransform } from '../../../efx-paint/document/efxPaintDocument';
import type { LayerBounds } from '../../canvas/transformHandles';

/**
 * 50-05 (Task 2, S4): the reference display-transform bounding box geometry.
 *
 * The reference ghost (Plan 50-04) draws the resolved source image at its
 * NATURAL project resolution, scaled by `zoom` (the project→working scale,
 * `paperTextureScale`) to the working canvas, centered at
 * `(canvasWidth/2 + x*zoom, canvasHeight/2 + y*zoom)`, then rotated by
 * `rotation` and scaled by `scaleX`/`scaleY` (D-13). This function computes the
 * SAME bounding box in WORKING space so the transform handles overlay the
 * ghost exactly — no aspect-fit, no crop (the reference is drawn at natural
 * size, unlike a content layer).
 *
 * The returned `LayerBounds` (corners + center) is the same shape the main
 * editor's `transformHandles` helpers consume, so `getHandlePositions`,
 * `hitTestHandles`, `getRotationZone`, and `pointInPolygon` are reused verbatim.
 */
export function getReferenceBounds(
  transform: PhotoReferenceTransform,
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): LayerBounds {
  const w = imageWidth * zoom;
  const h = imageHeight * zoom;
  const cx = canvasWidth / 2 + transform.x * zoom;
  const cy = canvasHeight / 2 + transform.y * zoom;
  const hw = (w / 2) * transform.scaleX;
  const hh = (h / 2) * transform.scaleY;

  const localCorners = [
    { x: -hw, y: -hh }, // TL
    { x: hw, y: -hh }, // TR
    { x: hw, y: hh }, // BR
    { x: -hw, y: hh }, // BL
  ];

  const rad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = localCorners.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  return { corners, center: { x: cx, y: cy }, drawW: w, drawH: h };
}
