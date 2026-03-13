export interface Point {
  x: number;
  y: number;
}

/**
 * Convert mouse clientX/clientY to project-resolution coordinates.
 *
 * Inverts the CSS transform chain applied to the canvas wrapper div:
 *   CSS: transform: scale(zoom) translate(panX, panY)
 *   transformOrigin: center center
 *
 * The wrapper div is centered in its container and sized to projectWidth x projectHeight.
 * The CSS applies scale first (around center), then translate (in scaled space).
 *
 * Inversion steps:
 * 1. Client -> container-center-relative (subtract container center point)
 * 2. Undo CSS scale: divide by zoom
 * 3. Undo CSS translate: subtract panX, panY
 * 4. Convert from center-relative to top-left-origin project coordinates
 */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number,
  projectWidth: number,
  projectHeight: number,
): Point {
  // 1. Client -> container center-relative
  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  const relX = clientX - containerCenterX;
  const relY = clientY - containerCenterY;

  // 2. Undo CSS scale: divide by zoom
  // 3. Undo CSS translate: subtract pan
  const canvasX = relX / zoom - panX;
  const canvasY = relY / zoom - panY;

  // 4. Canvas-relative (center-origin) -> project-resolution (top-left origin)
  const projX = canvasX + projectWidth / 2;
  const projY = canvasY + projectHeight / 2;

  return {x: projX, y: projY};
}

/**
 * Convert project-resolution coordinates to client coordinates.
 * Used for positioning HTML overlay handles in screen space.
 * Inverse of clientToCanvas.
 */
export function canvasToClient(
  projX: number,
  projY: number,
  containerRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number,
  projectWidth: number,
  projectHeight: number,
): Point {
  // Inverse of clientToCanvas steps, in reverse order:
  // 4. Project (top-left origin) -> center-relative
  const canvasX = projX - projectWidth / 2;
  const canvasY = projY - projectHeight / 2;

  // 3+2. Apply CSS translate then scale
  const relX = (canvasX + panX) * zoom;
  const relY = (canvasY + panY) * zoom;

  // 1. Container center-relative -> client
  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;

  return {
    x: containerCenterX + relX,
    y: containerCenterY + relY,
  };
}

/**
 * Convert a distance in screen pixels to project-resolution pixels.
 * Used for drag deltas (move, scale calculations).
 */
export function screenToProjectDistance(
  screenDist: number,
  zoom: number,
): number {
  return screenDist / zoom;
}
