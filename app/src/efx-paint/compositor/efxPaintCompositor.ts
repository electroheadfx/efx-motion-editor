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
 *  2. Background contribution via `resolveBackgroundFrame`, consuming the
 *     48-02 resolution union (D-03) — content names a source ref the decode
 *     port resolves to a raster (gap = fallback; a null decode contributes
 *     transparent pixels this tick);
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
 *
 * The pass is memoized per frame when the caller wires the flattened memo +
 * key terms through the ports (D-08/CMP-04): an identical second call returns
 * the frozen cached result with zero content queries and zero draw ops, and a
 * per-track raster memo (D-07) keeps an unchanged track's resolved raster
 * alive when only a sibling track changed.
 */

import type { EfxPaintBackgroundFrameResolution } from './efxPaintBackgroundResolution';
import type { BlendMode, EfxPaintDocument } from '../document/efxPaintDocument';
import {
  deriveEfxPaintFlattenedCacheKey,
  deriveEfxPaintTrackContentKey,
} from './efxPaintCompositeCache';
import type { EfxPaintKeyedMemo } from './efxPaintCompositeCache';
import { backgroundParticipates, participatingPaintTracks } from './efxPaintHideSolo';

/**
 * Map the main-editor BlendMode enum to Canvas 2D globalCompositeOperation
 * values (48-03 relocation: this single source of truth moved here from
 * previewRenderer.ts:76-91 so the pure compositor layer owns the mapping and
 * the store's compositeOp port imports it — the switch is NEVER duplicated,
 * Pitfall 8, grep "case 'multiply'" finds exactly one mapping).
 */
export function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'normal':
      return 'source-over';
    case 'screen':
      return 'screen';
    case 'multiply':
      return 'multiply';
    case 'overlay':
      return 'overlay';
    case 'add':
      return 'lighter';
    default:
      return 'source-over';
  }
}

/** Per-track content resolution surfaced by the injected port (D-10 seam). */
export type EfxPaintTrackContentResolution =
  | { readonly kind: 'content'; readonly raster: CanvasImageSource }
  | { readonly kind: 'missing'; readonly missingRefs: readonly string[] };

/**
 * The Background contribution resolved by the injected port (D-03 seam).
 * This is the 48-02 union ({@link EfxPaintBackgroundFrameResolution}): content
 * names the owning clip's source ref — the compositor NEVER maps FrameLoopClip
 * records itself (Pitfall P-48-2); the raster arrives through the separate
 * `resolveBackgroundSourceImage` decode port.
 */

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
  /**
   * The per-frame Background contribution (D-03): consumes the 48-02 resolution
   * union — `content` names the owning clip's source ref (decoded via
   * {@link resolveBackgroundSourceImage}), `gap` reveals the fallback, `missing`
   * renders transparent + a report entry (D-09). The production wiring is the
   * 48-02 adapter through the 48-03 store port.
   */
  resolveBackgroundFrame(frame: number): EfxPaintBackgroundFrameResolution;
  /**
   * Decode one Background source ref to a raster (48-03 owns the production
   * implementation). Returns null while the decode is pending — this tick the
   * compositor contributes transparent pixels for that frame.
   */
  resolveBackgroundSourceImage(sourceRef: string): CanvasImageSource | null;
  compositeOp(blendMode: BlendMode): GlobalCompositeOperation;
  /**
   * Optional per-frame flattened memo wiring (D-08/CMP-04). The store side
   * (48-03) owns the concrete memo lifetimes per layerId and supplies the
   * key terms; supply `memo`, `trackRasterMemo`, `trackContentRevisions`, and
   * `backgroundClipRevisions` TOGETHER. When `memo` is absent the pipeline
   * runs uncached (Task 1 behavior).
   */
  memo?: EfxPaintKeyedMemo<string, EfxPaintCompositeResult>;
  /** Per-track raster memo keyed by {@link deriveEfxPaintTrackContentKey} (D-07). */
  trackRasterMemo?: EfxPaintKeyedMemo<string, EfxPaintTrackContentResolution>;
  /** trackId → content revision string, the per-track key term (48-03). */
  trackContentRevisions?: ReadonlyMap<string, string>;
  /** Per-clip `${clip.id}:${clip.revision}` terms, the flattened-key term. */
  backgroundClipRevisions?: readonly string[];
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
  // D-08/CMP-04: when the caller wires the flattened memo, consult it FIRST
  // by the derived key (config + per-track content + background + clips +
  // frame). A hit returns the frozen cached result — zero content queries,
  // zero draw ops (Pitfall P-48-6). The key terms come from the caller; the
  // unwired compositeRevision counter is never read (Task 2 gate).
  const flattenedKey =
    ports.memo !== undefined
      ? deriveEfxPaintFlattenedCacheKey({
          document,
          trackContentRevisions: ports.trackContentRevisions ?? EMPTY_TRACK_CONTENT_REVISIONS,
          backgroundClipRevisions: ports.backgroundClipRevisions ?? EMPTY_BACKGROUND_CLIP_REVISIONS,
          frame,
        })
      : null;
  if (flattenedKey !== null) {
    const cached = ports.memo!.get(flattenedKey);
    if (cached) return cached;
  }

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
  // The union comes from the 48-02 adapter (D-03) — content names the clip's
  // source ref, decoded through the port (a null decode this tick contributes
  // transparent pixels, the 48-03 pending-decode semantics); 'missing'
  // contributes transparent pixels AND a report entry keyed by the background
  // track id (D-09).
  const backgroundActive = backgroundParticipates(document);
  if (backgroundActive) {
    const backgroundResolution = ports.resolveBackgroundFrame(frame);
    if (backgroundResolution.kind === 'content') {
      const raster = ports.resolveBackgroundSourceImage(backgroundResolution.sourceRef);
      if (raster !== null) {
        // D-04: the Background has no opacity/blend — its draw is a plain
        // source-over at globalAlpha 1, never re-scaled by track opacity.
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(raster, 0, 0);
        ctx.restore();
      }
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
    // D-07: per-track raster memo — a track's resolved raster survives when
    // only a SIBLING track changed. The per-track key is derived from the
    // caller-supplied content revision; the actual dataUrl→image decode lives
    // store-side (48-03) — this pure side caches whatever resolution object
    // the port produced.
    const trackRevision = ports.trackContentRevisions?.get(track.id);
    const trackKey =
      trackRevision !== undefined && ports.trackRasterMemo !== undefined
        ? deriveEfxPaintTrackContentKey(track.id, trackRevision, frame)
        : null;
    let resolution = trackKey !== null ? ports.trackRasterMemo!.get(trackKey) : undefined;
    if (resolution === undefined) {
      resolution = ports.resolveTrackContent(track.id, frame);
      if (trackKey !== null) ports.trackRasterMemo!.set(trackKey, resolution);
    }
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

  // 9. Flattened raster + report. All output is deep-frozen; the caller's
  // memo stores the frozen result for the derived flattened key.
  const result = Object.freeze({
    raster: handle.canvas,
    missing: Object.freeze(missing),
    participates: Object.freeze({
      trackIds: Object.freeze(participating.map((track) => track.id)),
      background: backgroundActive,
    }),
  });
  if (flattenedKey !== null) ports.memo!.set(flattenedKey, result);
  return result;
}

const EMPTY_TRACK_CONTENT_REVISIONS: ReadonlyMap<string, string> = new Map();
const EMPTY_BACKGROUND_CLIP_REVISIONS: readonly string[] = Object.freeze([]);
