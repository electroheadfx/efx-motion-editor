/**
 * Shared pure internal composition pipeline (Phase 48-01 Task 1).
 *
 * CMP-01: ONE shared path resolves all participating Paint tracks plus the
 * fixed Background track into one flattened raster per frame — consumed later
 * by Studio preview, main preview, and export (Pitfall 8 closed by
 * construction). This module is deliberately free of Preact imports, DOM
 * construction, and store access: all canvas/raster/blend work arrives through
 * injected ports (the `efxPaintDocument.ts:1-9` purity contract).
 *
 * Composition order (spec-locked, SPECS/milestone-v1.0.0-plan.md §Phase 4):
 *  1. document fallback — solid fill, or transparency (cleared canvas);
 *  2. Background contribution via `resolveBackgroundFrame` (gap = fallback);
 *  3. the Background contribution composites beneath all Paint tracks;
 *  4-8. each participating Paint track (hide/solo truth table, D-04) resolves
 *     content via `resolveTrackContent`; opacity is applied BEFORE blend mode
 *     (D-01, After Effects convention) as save → globalAlpha = opacity →
 *     globalCompositeOperation = mapped blend → drawImage → restore; a missing
 *     source contributes transparent pixels AND a report entry (D-09, CMP-05);
 *  9. one flattened raster + missing-source report.
 *
 * The flattened raster carries STRAIGHT (unmultiplied) alpha at the boundary
 * to the main editor (D-02): each track's alpha is preserved as-is and the
 * main editor's compositor performs the alpha math — no manual alpha-channel
 * math happens here. The parent layer's opacity/blend/transform are NEVER read
 * or applied by this module (CMP-03, Pitfall 6).
 */

import type { BlendMode, EfxPaintDocument } from '../document/efxPaintDocument';
import { backgroundParticipates, participatingPaintTracks } from './efxPaintHideSolo';

/** Per-track content resolution surfaced by the injected port (D-10 seam). */
export type EfxPaintTrackContentResolution =
  | { readonly kind: 'content'; readonly raster: CanvasImageSource }
  | { readonly kind: 'missing'; readonly missingRefs: readonly string[] };

/** Background contribution resolved by the injected port (D-03 seam). */
export type EfxPaintBackgroundResolution =
  | { readonly kind: 'content'; readonly raster: CanvasImageSource }
  | { readonly kind: 'gap' }
  | { readonly kind: 'missing'; readonly missingRefs: readonly string[] };

/** Canvas handle produced by the injected canvas factory. */
export interface EfxPaintCanvasHandle {
  readonly canvas: CanvasImageSource;
  readonly ctx: CanvasRenderingContext2D;
}

/**
 * Injected ports keep the pure module free of Preact/DOM/store imports.
 * The store side (48-03) implements `resolveTrackContent` with the D-10
 * precedence (real key > generated interpolation > Hold Loop Clip > cached
 * frame) and maps the 'loop-placeholder'/null render-source kinds to
 * `{ kind: 'missing', ... }` (D-09), and `compositeOp` with the exported
 * `blendModeToCompositeOp` mapping — never duplicated in this module.
 */
export interface EfxPaintCompositorPorts {
  createCanvas(width: number, height: number): EfxPaintCanvasHandle;
  resolveTrackContent(trackId: string, frame: number): EfxPaintTrackContentResolution;
  resolveBackgroundFrame(frame: number): EfxPaintBackgroundResolution;
  compositeOp(blendMode: BlendMode): GlobalCompositeOperation;
}

/** One missing-source report entry (CMP-05, D-09). */
export interface EfxPaintMissingSourceEntry {
  readonly trackId: string;
  readonly frame: number;
  readonly missingRefs: readonly string[];
}

/**
 * The flattened composite result. `raster` carries STRAIGHT (unmultiplied)
 * alpha at the main-editor boundary (D-02); `missing` lists every source that
 * could not be resolved (transparent pixels were composited for it, D-09);
 * `participates` records which tracks/background were considered.
 */
export interface EfxPaintCompositeResult {
  readonly raster: CanvasImageSource;
  readonly missing: readonly EfxPaintMissingSourceEntry[];
  readonly participates: {
    readonly trackIds: readonly string[];
    readonly background: boolean;
  };
}

/** Flattened raster dimensions — the parent project canvas (Open Question 1). */
export interface EfxPaintCompositeSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Compose one application frame into one flattened straight-alpha raster
 * (spec steps 1-9 for the Paint half). `size` is the parent project canvas
 * dimensions — the same source `renderFrame` uses (previewRenderer.ts).
 */
export function compositeFrame(
  document: EfxPaintDocument,
  frame: number,
  size: EfxPaintCompositeSize,
  ports: EfxPaintCompositorPorts,
): EfxPaintCompositeResult {
  const handle = ports.createCanvas(size.width, size.height);
  const ctx = handle.ctx;
  const missing: EfxPaintMissingSourceEntry[] = [];

  // 1. Document fallback: a solid fill covers the whole canvas; transparency
  // is the cleared canvas. (Solid needs no clear — fillRect covers it all.)
  if (document.background.fallback.mode === 'solid') {
    ctx.fillStyle = document.background.fallback.color;
    ctx.fillRect(0, 0, size.width, size.height);
  } else {
    ctx.clearRect(0, 0, size.width, size.height);
  }

  // 2-3. Background contribution beneath all Paint tracks. Governed only by
  // `background.visible` (D-04); a 'gap' reveals the already-painted fallback.
  const backgroundActive = backgroundParticipates(document);
  if (backgroundActive) {
    const backgroundResolution = ports.resolveBackgroundFrame(frame);
    if (backgroundResolution.kind === 'content') {
      ctx.save();
      ctx.drawImage(backgroundResolution.raster, 0, 0);
      ctx.restore();
    } else if (backgroundResolution.kind === 'missing') {
      missing.push({
        trackId: document.background.id,
        frame,
        missingRefs: backgroundResolution.missingRefs,
      });
    }
  }

  // 4-8. Participating Paint tracks in stable bottom-to-top order. Opacity is
  // applied BEFORE blend mode (D-01, After Effects convention); the draw state
  // is save/restore-wrapped per track.
  const participating = participatingPaintTracks(document);
  for (const track of participating) {
    const resolution = ports.resolveTrackContent(track.id, frame);
    if (resolution.kind === 'missing') {
      // D-09: transparent pixels + a report entry — never a placeholder fill.
      missing.push({ trackId: track.id, frame, missingRefs: resolution.missingRefs });
      continue;
    }
    ctx.save();
    ctx.globalAlpha = track.opacity;
    ctx.globalCompositeOperation = ports.compositeOp(track.blendMode);
    ctx.drawImage(resolution.raster, 0, 0);
    ctx.restore();
  }

  // 9. Flattened raster + report. All output is deep-frozen.
  return Object.freeze({
    raster: handle.canvas,
    missing: Object.freeze(missing),
    participates: Object.freeze({
      trackIds: Object.freeze(participating.map((track) => track.id)),
      background: backgroundActive,
    }),
  });
}
