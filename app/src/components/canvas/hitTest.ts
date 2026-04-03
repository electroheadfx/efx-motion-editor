import type {Layer} from '../../types/layer';
import type {Point} from './coordinateMapper';
import {getLayerBounds, pointInPolygon} from './transformHandles';
import {isFxLayer} from '../../types/layer';

/**
 * Test layers from top to bottom (reverse array order since layers[0] is bottom).
 * Skips non-visible layers and FX layers (only content layers are selectable on canvas).
 *
 * For each content layer:
 *   1. Get source dimensions via callback (the overlay provides this from the renderer's image cache)
 *   2. Compute bounds via getLayerBounds
 *   3. Test if point is inside the rotated bounding box via pointInPolygon
 *   4. Return the first (topmost) layer ID that passes
 *   5. If no layer hit, return null
 *
 * Uses bounding-box-only hit testing (no pixel sampling).
 */
export function hitTestLayers(
  point: Point,
  layers: Layer[],
  canvasW: number,
  canvasH: number,
  getSourceDimensions: (layer: Layer) => {w: number; h: number} | null,
): string | null {
  // Iterate from top (end of array) to bottom (start of array)
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];

    // Skip invisible and FX layers
    if (!layer.visible) continue;
    if (isFxLayer(layer)) continue;

    // Get source dimensions from the renderer's cache
    const dims = getSourceDimensions(layer);
    if (!dims || dims.w <= 0 || dims.h <= 0) continue;

    // Compute bounding box
    const bounds = getLayerBounds(layer, dims.w, dims.h, canvasW, canvasH);

    // Test if point is inside the rotated bounding box
    if (pointInPolygon(point, bounds.corners)) {
      return layer.id;
    }
  }

  return null;
}

/**
 * For Alt+click cycling: returns the next layer under the point below
 * the currently selected one. If currentSelectedId is null or not under
 * the point, returns topmost. Wraps around to top when reaching bottom.
 */
export function hitTestLayersCycle(
  point: Point,
  layers: Layer[],
  canvasW: number,
  canvasH: number,
  getSourceDimensions: (layer: Layer) => {w: number; h: number} | null,
  currentSelectedId: string | null,
): string | null {
  // Collect all hittable layers under the point, from top to bottom
  const hitLayers: string[] = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    if (isFxLayer(layer)) continue;

    const dims = getSourceDimensions(layer);
    if (!dims || dims.w <= 0 || dims.h <= 0) continue;

    const bounds = getLayerBounds(layer, dims.w, dims.h, canvasW, canvasH);
    if (pointInPolygon(point, bounds.corners)) {
      hitLayers.push(layer.id);
    }
  }

  if (hitLayers.length === 0) return null;

  // If no current selection or current selection not in hit list, return topmost
  if (!currentSelectedId) return hitLayers[0];

  const currentIndex = hitLayers.indexOf(currentSelectedId);
  if (currentIndex === -1) return hitLayers[0];

  // Cycle to next layer below, wrapping around
  const nextIndex = (currentIndex + 1) % hitLayers.length;
  return hitLayers[nextIndex];
}
