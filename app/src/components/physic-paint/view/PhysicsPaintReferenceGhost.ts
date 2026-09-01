import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { physicPaintStore, type ReferenceSourceFrameVerdict } from '../../../stores/physicPaintStore';

/**
 * 50-04 (S3): the reference ghost draw decision. A pure function — no signal
 * reads, no signal writes, no side effects. It answers "should the reference
 * ghost draw for this document at this frame, and with which resolved source
 * frame?".
 *
 * The decision is fail-closed (D-04) and frame-aligned (D-15):
 *   - a null photo/reference track draws nothing (no track, no ghost);
 *   - a hidden overlay (visibleInStudio false, D-11) draws nothing;
 *   - playback (isPlaying, D-14) draws nothing — the ghost is an editing aid,
 *     never a playback/export surface;
 *   - a missing resolved source frame draws nothing (D-04) — never a
 *     placeholder fill, never silent transparency;
 *   - otherwise it draws with the frame-aligned clamped verdict from
 *     `getReferenceSourceFrameVerdict` (frame N → source frame N, clamped at
 *     the sequence end).
 */
export interface ReferenceGhostDrawDecision {
  readonly draw: boolean;
  readonly verdict: ReferenceSourceFrameVerdict | null;
}

export function shouldDrawReferenceGhost(
  document: EfxPaintDocument,
  frame: number,
  isPlaying: boolean,
): ReferenceGhostDrawDecision {
  const track = document.photoReference;
  if (track === null) return { draw: false, verdict: null };
  if (!track.visibleInStudio) return { draw: false, verdict: null };
  if (isPlaying) return { draw: false, verdict: null };
  const verdict = physicPaintStore.getReferenceSourceFrameVerdict(document.parentLayerId, frame);
  if (verdict === null) return { draw: false, verdict: null };
  return { draw: true, verdict };
}

/**
 * 50-04 (S3): draw the reference ghost into a monitor-paint canvas context.
 * Monitor paint only — this function never touches the compositor, the
 * flattened raster, the main preview, or the export path (D-06 HARD LOCK).
 *
 * When the decision says draw, the resolved source image is drawn as a
 * semi-transparent ghost at `track.opacity` (default 0.5), transformed by
 * `track.transform` (position/scale/rotation — D-13), with no tint, no
 * blend-mode change, and no outline (UI-SPEC Color contract). The image is
 * centered on the canvas and scaled by `zoom` (the project→working scale), so
 * the default transform (x:0, y:0, scaleX:1, scaleY:1, rotation:0) draws the
 * reference centered and unscaled.
 *
 * The draw is async (the image decodes via `new Image()`); a pending decode
 * draws nothing this tick and the caller re-invokes on the next version-clock
 * bump. The `save`/`restore` pair confines the opacity and transform to this
 * draw so the caller's context state is untouched.
 */
export function drawReferenceGhost(
  ctx: CanvasRenderingContext2D,
  document: EfxPaintDocument,
  frame: number,
  zoom: number,
  isPlaying: boolean,
): void {
  const decision = shouldDrawReferenceGhost(document, frame, isPlaying);
  if (!decision.draw || decision.verdict === null) return;
  const track = document.photoReference;
  if (track === null) return;
  const image = new Image();
  image.onload = () => {
    const canvas = ctx.canvas;
    const w = image.width * zoom;
    const h = image.height * zoom;
    ctx.save();
    ctx.globalAlpha = track.opacity;
    ctx.translate(
      canvas.width / 2 + track.transform.x * zoom,
      canvas.height / 2 + track.transform.y * zoom,
    );
    ctx.rotate(track.transform.rotation * Math.PI / 180);
    ctx.scale(track.transform.scaleX, track.transform.scaleY);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  };
  image.src = decision.verdict.dataUrl;
}
