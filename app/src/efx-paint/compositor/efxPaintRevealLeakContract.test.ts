/**
 * Reveal leak contract (RVL-05, D-15 bake-time guarantee).
 *
 * The bake-time guarantee: photo reference pixels reach flattened output ONLY
 * through keys written by the Reveal bake. The four raster surfaces — the
 * compositor, the flattened cache, the preview renderer, and the export
 * renderer — are the only places flattened output is produced, so they must
 * contain NO reference-input token and NO reveal-bake token.
 *
 * This is a token allow-list (grep-based) scan over the source of the four
 * surfaces, mirroring the Phase 50 D-06 contract (PhysicsPaintStudio.test.ts)
 * and extended to the new reveal bake path: the bake reads the reference via
 * `_resolveReferenceSourceImage` + `renderRotoRevealFrames`, and none of that
 * reference read may leak a token into any raster surface.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The four raster surfaces — the only places flattened output is produced.
const compositor = readFileSync(fileURLToPath(new URL('./efxPaintCompositor.ts', import.meta.url)), 'utf8');
const flattenedCache = readFileSync(fileURLToPath(new URL('./efxPaintCompositeCache.ts', import.meta.url)), 'utf8');
const previewRenderer = readFileSync(fileURLToPath(new URL('../../lib/previewRenderer.ts', import.meta.url)), 'utf8');
const exportRenderer = readFileSync(fileURLToPath(new URL('../../lib/exportRenderer.ts', import.meta.url)), 'utf8');

const rasterSurface = [compositor, flattenedCache, previewRenderer, exportRenderer].join('\n');

describe('Reveal leak contract (RVL-05, D-15 bake-time guarantee)', () => {
  it('keeps the Phase 50 reference-input tokens out of the four raster surfaces', () => {
    // The D-06 exclusion is structural: the compositor, flattened cache,
    // preview renderer, and export renderer receive NO reference-input
    // threading, so the reference never reaches flattened output in any mode.
    const referenceTokens = [
      'photoReference',
      'drawReferenceGhost',
      'getReferenceSourceFrameVerdict',
      'registerReferenceSourceImage',
      'setPhotoReferenceSource',
      'setPhotoReferenceVisible',
      'setPhotoReferenceOpacity',
      'setPhotoReferenceTransform',
      'setPhotoReferenceTransformLocked',
      'PhysicsPaintReferenceGhostLayer',
      'PhysicsPaintReferenceTransformHandles',
      'PhysicsPaintPhotoReferenceSection',
      'getReferenceBounds',
    ];
    for (const token of referenceTokens) {
      expect(rasterSurface).not.toContain(token);
    }
  });

  it('keeps the reveal bake path tokens out of the four raster surfaces', () => {
    // The reveal bake reads the reference via `_resolveReferenceSourceImage`
    // (frame-aligned, null-on-missing fail-closed) and renders it through
    // `renderRotoRevealFrames`/`compositeRevealMask`/`loadRevealReferenceImage`,
    // committing via `commitRevealBake` and the `createRevealRail`/
    // `replayRevealRail`/`deleteRevealRail`/`resizeRevealRail` mutations
    // (railKind 'reveal'). None of that bake path may leak a token into any
    // raster surface — the bake writes ordinary track keys, never a raster
    // surface reference read.
    const revealBakeTokens = [
      'renderRotoRevealFrames',
      'compositeRevealMask',
      'loadRevealReferenceImage',
      'commitRevealBake',
      '_resolveReferenceSourceImage',
      'createRevealRail',
      'replayRevealRail',
      'deleteRevealRail',
      'resizeRevealRail',
      'railKind',
    ];
    for (const token of revealBakeTokens) {
      expect(rasterSurface).not.toContain(token);
    }
  });
});
