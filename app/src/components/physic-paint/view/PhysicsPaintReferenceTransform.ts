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
 * `hitTestHandles`, `getRotationZone`, and `pointInPolygon` are reused
 * verbatim.
 *
 * 260922-rd4: the rotation/offset math lives in ONE core shared by
 * {@link getReferenceBounds} (photo base = natural source size) and
 * {@link getBackgroundBounds} (background base = contain-fit × clip scale) —
 * shared math, only the base rect differs (reuse, not a fork).
 */

/**
 * The shared rotation/offset bounds core (260922-rd4 STEP A). `baseWidth` /
 * `baseHeight` are PROJECT-space dimensions of the untransformed draw rect
 * (photo: natural source size; background: contain-fit × clip scale); the
 * result is the WORKING-space box after zoom, center offset, scale, and
 * rotation-degrees — one convention with `getReferenceBounds`/`applyRotation`.
 */
function transformBoundsCore(
  transform: PhotoReferenceTransform,
  baseWidth: number,
  baseHeight: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): LayerBounds {
  const w = baseWidth * zoom;
  const h = baseHeight * zoom;
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

/**
 * Photo-reference bounds — thin wrapper over the shared core with base =
 * (imageWidth, imageHeight). Signature and output stay byte-identical to the
 * pre-260922-rd4 implementation (photo regression guardrail).
 */
export function getReferenceBounds(
  transform: PhotoReferenceTransform,
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): LayerBounds {
  return transformBoundsCore(transform, imageWidth, imageHeight, zoom, canvasWidth, canvasHeight);
}

/**
 * Background bounds (260922-rd4) — the same core with base =
 * (baseDrawW, baseDrawH): the compositor's contain-fit × clip-scale draw rect
 * in PROJECT pixels (see `computeEfxPaintBackgroundBaseDrawSize`), so the
 * handles overlay the transformed background exactly.
 */
export function getBackgroundBounds(
  transform: PhotoReferenceTransform,
  baseDrawW: number,
  baseDrawH: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): LayerBounds {
  return transformBoundsCore(transform, baseDrawW, baseDrawH, zoom, canvasWidth, canvasHeight);
}

/**
 * 261107-tfp: the rail-motion boundary-box geometry. It mirrors the
 * compositor's op order exactly — `translate(pivot + offset)`, `rotate`,
 * `scale`, `translate(-pivot)` — the same chain
 * {@link buildRailMotionEditCss} expresses and `applyEfxPaintTrackMotion`
 * applies, so the box tracks the composited paint under Position/Scale/Rotation.
 *
 * `baseRect` is the DISPLAYED drawing key's ink box NORMALIZED to the project
 * raster (0..1), and `pivotX`/`pivotY` are the rail's normalized pivot. The
 * working-space result is project→working scaled by `zoom`, like every other
 * bounds helper here. `center` is the TRANSFORMED PIVOT — deliberately not the
 * box centroid — so the scale/rotation gestures reference the exact anchor the
 * compositor uses. `drawW`/`drawH` are the unscaled base draw size (the same
 * convention `transformBoundsCore` documents).
 */
export function getRailMotionBounds(
  transform: PhotoReferenceTransform,
  baseRect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  pivotX: number,
  pivotY: number,
  projectWidth: number,
  projectHeight: number,
  zoom: number,
): LayerBounds {
  const pivotPxX = pivotX * projectWidth;
  const pivotPxY = pivotY * projectHeight;
  const left = baseRect.x * projectWidth;
  const top = baseRect.y * projectHeight;
  const right = (baseRect.x + baseRect.width) * projectWidth;
  const bottom = (baseRect.y + baseRect.height) * projectHeight;

  const rad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    { x: left, y: top }, // TL
    { x: right, y: top }, // TR
    { x: right, y: bottom }, // BR
    { x: left, y: bottom }, // BL
  ].map((corner) => {
    const dx = (corner.x - pivotPxX) * transform.scaleX;
    const dy = (corner.y - pivotPxY) * transform.scaleY;
    return {
      x: zoom * (pivotPxX + transform.x + dx * cos - dy * sin),
      y: zoom * (pivotPxY + transform.y + dx * sin + dy * cos),
    };
  });

  return {
    corners,
    center: {
      x: zoom * (pivotPxX + transform.x),
      y: zoom * (pivotPxY + transform.y),
    },
    drawW: baseRect.width * projectWidth * zoom,
    drawH: baseRect.height * projectHeight * zoom,
  };
}

/**
 * 59-12 UAT fix: the CSS mirror of the compositor's rail transform, applied to
 * the ACTIVE track's live engine shell (which bypasses the compositor). The
 * op order is the compositor's, byte for byte: translate(pivot + offset),
 * rotate, scale, translate(-pivot). Positions are PROJECT pixels; `zoom` is
 * the project→working ratio the shell's CSS space already uses, so offsets are
 * multiplied by it while the normalized pivot is multiplied by the working
 * canvas size.
 */
export function buildRailMotionEditCss(
  transform: {
    readonly translateX: number;
    readonly translateY: number;
    readonly scale: number;
    readonly rotationRadians: number;
    readonly pivotX: number;
    readonly pivotY: number;
  },
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
): string {
  const pivotX = transform.pivotX * canvasWidth;
  const pivotY = transform.pivotY * canvasHeight;
  const x = pivotX + transform.translateX * zoom;
  const y = pivotY + transform.translateY * zoom;
  return `translate(${x}px, ${y}px) rotate(${transform.rotationRadians}rad) scale(${transform.scale}) translate(${-pivotX}px, ${-pivotY}px)`;
}

/**
 * studio-paint-motion-offset: the seat style for the two cursor overlays that
 * read CONTENT coordinates (the brush ring and the picker visor). Their seats
 * share the shell's LAYOUT box, so under the rail-edit mirror they must carry
 * the SAME chain as the shell with the layout-box origin. Without it the
 * overlays render untransformed while the sheet is CSS-translated — the
 * visible paint cursor lags the correctly-placed stroke by the rail delta.
 *
 * Identity (`railEditCss === null`) returns null so the spread contributes no
 * properties and the seat style object stays byte-identical to the pre-59-12
 * markup.
 */
export function buildRailMotionEditSeatStyle(
  railEditCss: string | null,
): { transform: string; transformOrigin: string } | null {
  return railEditCss === null ? null : { transform: railEditCss, transformOrigin: '0 0' };
}
