// ============================================================
//  watercolorStrokeThumb — the playground stroke painter, ported
//  from the read-only oracle
//  (SPECS/v1.1.0-water-color/watercolor-playground/src/ui/preview.ts).
//
//  261017-xa0 I-03: Brush-tab card thumbs are painted strokes,
//  not icons or solid swatches. Paint once per preset id into an
//  HTMLCanvasElement, cache it, and blit (drawImage) onto the
//  visible card canvas. Never toDataURL / toBlob (52.1 D-19).
//
//  `strokeThumbPainter` is the spyable seam: getStrokeThumb paints
//  through it so a pin can assert one invocation per preset id.
// ============================================================

import {
  BRUSH_PRESETS,
  buildBrush,
  hexToRgb,
  type Brush,
} from '@efxlab/efx-watercolor';

/** Card thumb box (oracle BrushLibrary contract). */
export const STROKE_THUMB_WIDTH = 150;
export const STROKE_THUMB_HEIGHT = 44;

/**
 * One shared representative pigment for every thumb — the oracle default
 * previewHex (PALETTE[5] French Ultramarine, a blue/violet wash).
 */
export const STROKE_THUMB_HEX = '#2338a8';

const DEGREES = Math.PI / 180;

const tipCache = new Map<string, HTMLCanvasElement>();
const thumbCache = new Map<string, HTMLCanvasElement>();

/** The tip as a tinted RGBA image (alpha = tip value). */
export function tipImage(b: Brush, hex: string): HTMLCanvasElement {
  const key = `${b.id}|${hex}`;
  let c = tipCache.get(key);
  if (c) return c;
  const n = b.tipSize;
  c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const [r, g, bl] = hexToRgb(hex).map((v) => Math.round(v * 255));
  for (let i = 0; i < n * n; i++) {
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = bl;
    img.data[i * 4 + 3] = b.tipData[i];
  }
  ctx.putImageData(img, 0, 0);
  tipCache.set(key, c);
  return c;
}

function prepare(canvas: HTMLCanvasElement) {
  const dpr = Math.min(
    (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1,
    2,
  );
  // logical size: the CSS box when laid out, else the markup's size
  // (hidden panels have no layout).
  if (!canvas.dataset.w) {
    canvas.dataset.w = String(canvas.clientWidth || canvas.width);
    canvas.dataset.h = String(canvas.clientHeight || canvas.height);
  }
  const w = Number(canvas.dataset.w);
  const h = Number(canvas.dataset.h);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/** A short pressure-shaped stroke painted with the brush's dab rules. */
export function drawStroke(canvas: HTMLCanvasElement, b: Brush, hex: string): void {
  const { ctx, w, h } = prepare(canvas);
  const img = tipImage(b, hex);
  // scale so the biggest brushes fit and the smallest stay visible
  const R = Math.min(h * 0.42, Math.max(3.5, 15 * Math.sqrt(b.size[1] / 0.05)));
  const norm = Math.min(Math.max(Math.sqrt(0.5 / b.tipMean), 0.7), 2.2);
  const alpha = Math.min(
    0.85,
    Math.max(
      0.05,
      0.42 * Math.min(b.spacing, 1) * Math.sqrt(b.aspect) * norm * b.load,
    ),
  );
  const x0 = 10;
  const x1 = w - 10;
  const ym = h / 2;
  const point = (t: number) => ({
    x: x0 + (x1 - x0) * t,
    y: ym + Math.sin(t * Math.PI * 2) * h * 0.14,
  });
  let seed = 17;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const spacing = Math.max(1, R * b.spacing * Math.sqrt(b.aspect));
  const length = (x1 - x0) * 1.08;
  const fixedAngle = b.angle * DEGREES;
  ctx.globalAlpha = alpha;
  for (let d = 0; d <= length; d += spacing) {
    const t = d / length;
    const p = point(t);
    const q = point(Math.min(1, t + 0.01));
    const pr = Math.min(1, Math.max(0.2, Math.sin(t * Math.PI) * 1.15));
    const r = R * (0.25 + 0.75 * Math.pow(pr, b.pressureSize));
    const dir = Math.atan2(-(q.y - p.y), q.x - p.x);
    for (let i = 0; i < b.dabs; i++) {
      let angle =
        b.rotation === 'random'
          ? rnd() * Math.PI * 2
          : b.rotation === 'follow'
            ? dir + b.angle * DEGREES
            : fixedAngle;
      angle += (rnd() - 0.5) * 2 * b.angleJitter * DEGREES;
      let x = p.x;
      let y = p.y;
      let rr = r;
      if (b.scatter) {
        const a = rnd() * Math.PI * 2;
        const m = Math.sqrt(rnd()) * b.scatter * r;
        x += Math.cos(a) * m;
        y += Math.sin(a) * m;
      }
      if (b.sizeJitter) rr *= Math.max(0.15, 1 + (rnd() * 2 - 1) * b.sizeJitter);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-angle);
      ctx.drawImage(img, -rr, -rr * b.aspect, rr * 2, rr * 2 * b.aspect);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Spyable paint seam. getStrokeThumb paints through this object so a
 * pin can count painter invocations without patching the module.
 */
export const strokeThumbPainter = {
  drawStroke(canvas: HTMLCanvasElement, brush: Brush, hex: string): void {
    drawStroke(canvas, brush, hex);
  },
};

/**
 * Paint-once thumb cache, keyed by preset id. The first call paints
 * the stroke; later calls return the same HTMLCanvasElement (never
 * repaint, never serialize).
 */
export function getStrokeThumb(presetId: string): HTMLCanvasElement {
  const cached = thumbCache.get(presetId);
  if (cached) return cached;
  const preset = BRUSH_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`watercolorStrokeThumb: unknown preset id ${presetId}`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = STROKE_THUMB_WIDTH;
  canvas.height = STROKE_THUMB_HEIGHT;
  strokeThumbPainter.drawStroke(canvas, buildBrush(preset), STROKE_THUMB_HEX);
  thumbCache.set(presetId, canvas);
  return canvas;
}

/**
 * Blit a cached thumb onto a visible card canvas.
 *
 * The cache is DPR-scaled by `prepare()` — 300x88 at dpr 2, 150x44 at dpr 1.
 * A 1:1 copy into a smaller bitmap keeps only the top-left quarter
 * (261029-uoz): every surface showed a white box with a faint smear at the
 * bottom edge on Retina. Matching the visible bitmap to the cache before the
 * copy restores the whole stroke; each caller's CSS class pins the display
 * box and the aspect ratio is unchanged, so the extra bitmap resolution is
 * Retina crispness, not layout.
 */
export function blitStrokeThumb(
  target: HTMLCanvasElement,
  presetId: string,
): void {
  const thumb = getStrokeThumb(presetId);
  const ctx = target.getContext('2d');
  if (!ctx) return;
  // Resizing a canvas resets its context state but keeps the context valid,
  // so sizing after getContext is safe — and the `!==` guard means a re-blit
  // of an already-matched canvas never resets it.
  if (target.width !== thumb.width) target.width = thumb.width;
  if (target.height !== thumb.height) target.height = thumb.height;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(thumb, 0, 0);
}

/** Test seam: drop every cached thumb (paints again on next get). */
export function clearStrokeThumbCache(): void {
  thumbCache.clear();
}
