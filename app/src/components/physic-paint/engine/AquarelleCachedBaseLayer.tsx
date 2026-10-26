import { useEffect, useRef } from 'preact/hooks';
import { transmittanceSourceToPigmentAlpha } from '../../../lib/rasterAlpha';

/**
 * 2026-10-26 (round 2, option B): the committed aquarelle sheet, rendered as a
 * REAL pigment layer.
 *
 * Storage keeps the opaque MODE.transparent transmittance (white = no pigment;
 * the format never changes, old projects render, thumbnails/pose margins keep
 * their multiply law). At display time the sheet must join the layer stack with
 * straight-alpha pigment (alpha = 1 − min(r,g,b)) — otherwise its opaque border
 * hard-masks the paint beneath and the wash reads fully opaque, exactly the
 * semi-transparency the user lost.
 *
 * One decode + one conversion per URL (never a per-frame hot path; the cached
 * base is hidden during cached-roto playback). A sheet that is not a stored
 * transmittance raster (engine-1 real alpha) is drawn untouched.
 */
export function AquarelleCachedBaseLayer(props: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    // Reset the backing store so a failed decode never leaves the previous
    // frame's paint on screen.
    canvas.width = 0;
    canvas.height = 0;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return;
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
      if (!scratchContext) return;
      scratchContext.drawImage(image, 0, 0);
      const pigment = transmittanceSourceToPigmentAlpha(scratch);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(pigment ?? image, 0, 0, width, height);
    };
    image.src = props.url;
    return () => {
      cancelled = true;
    };
  }, [props.url]);

  return <canvas ref={canvasRef} class="aquarelle-cached-base" aria-hidden="true" />;
}
