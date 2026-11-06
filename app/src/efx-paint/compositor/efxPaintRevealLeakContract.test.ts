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

// 59-13: the canvas gizmo. Its third target is a distinct sink (the rail-motion
// collection), so it must never acquire a display-transform or reference token.
const transformHandles = readFileSync(
  fileURLToPath(new URL('../../components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx', import.meta.url)),
  'utf8',
);
const railMotionCommands = readFileSync(
  fileURLToPath(new URL('../../components/physic-paint/roto/railMotionCommands.ts', import.meta.url)),
  'utf8',
);

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
    // `renderRotoRevealFrames`/`compositeRevealMask`/`loadRevealWebpImage`,
    // committing via `commitRevealBake` and the `createRevealRail`/
    // `replayRevealRail`/`deleteRevealRail`/`resizeRevealRail` mutations
    // (railKind 'reveal'). None of that bake path may leak a token into any
    // raster surface — the bake writes ordinary track keys, never a raster
    // surface reference read.
    const revealBakeTokens = [
      'renderRotoRevealFrames',
      'compositeRevealMask',
      'loadRevealWebpImage',
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

  it('59-13 keeps the rail-motion gizmo tokens out of the four raster surfaces', () => {
    // The new target writes the rail-motion collection through
    // `writeMotionTransformAtCursor` -> `replaceRotoPhysicalRailMotions`
    // (59-07). Neither the command layer nor the motion sink is a raster
    // surface: the compositor consumes railMotions through the store's
    // transform resolver, never by importing the command or the overlay.
    const railMotionTokens = [
      'writeMotionTransformAtCursor',
      'getRotoPhysicalRailMotions',
      'replaceRotoPhysicalRailMotions',
      'railMotionTransformHandles',
      'resolveMotionGizmoAvailability',
    ];
    for (const token of railMotionTokens) {
      expect(rasterSurface).not.toContain(token);
    }
  });

  it('59-13 keeps each handles target on its own write endpoint', () => {
    // Legacy targets: exactly one display-transform write endpoint each — the
    // rail-motion target is additive and does not widen them.
    const backgroundWrites = transformHandles.match(/setBackgroundTransform\(layerId/g) ?? [];
    const referenceWrites = transformHandles.match(/setPhotoReferenceTransform\(layerId/g) ?? [];
    expect(backgroundWrites).toHaveLength(1);
    expect(referenceWrites).toHaveLength(1);
    expect(transformHandles).toContain("'rail-motion'");
    // The rail-motion sink is the motion collection, and the command layer
    // never imports either display-transform setter.
    expect(railMotionCommands).not.toContain('setPhotoReferenceTransform');
    expect(railMotionCommands).not.toContain('setBackgroundTransform');
    expect(railMotionCommands).not.toContain('PhysicsPaintReferenceTransformHandles');
  });
});
