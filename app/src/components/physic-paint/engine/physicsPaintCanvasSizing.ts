import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';

export const DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH = 1000;
export const DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT = 650;
export const PHYSICS_PAINT_WORKING_LONG_EDGE = 1000;

export type SerializedPhysicsPaintProject = ReturnType<EfxPaintEngine['save']>;

export function resizePhysicsPaintState(state: SerializedPhysicsPaintProject, width: number, height: number): SerializedPhysicsPaintProject {
  if (state.width === width && state.height === height) return state;
  const scaleX = width / state.width;
  const scaleY = height / state.height;
  return {
    ...state,
    width,
    height,
    strokes: state.strokes.map((stroke) => ({
      ...stroke,
      pts: stroke.pts.map((point) => [
        Math.round(point[0] * scaleX * 100) / 100,
        Math.round(point[1] * scaleY * 100) / 100,
        point[2],
        point[3],
        point[4],
        point[5],
        point[6],
      ]),
    })),
  };
}

export function getPhysicsPaintWorkingSize(projectWidth: number, projectHeight: number): { width: number; height: number } {
  if (projectWidth <= 0 || projectHeight <= 0) return { width: DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, height: DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT };
  const scale = Math.min(1, PHYSICS_PAINT_WORKING_LONG_EDGE / Math.max(projectWidth, projectHeight));
  return {
    width: Math.max(1, Math.round(projectWidth * scale)),
    height: Math.max(1, Math.round(projectHeight * scale)),
  };
}

export function getContainedCanvasDisplaySize(containerWidth: number, containerHeight: number, canvasWidth: number, canvasHeight: number): { width: number; height: number } | null {
  if (containerWidth <= 0 || containerHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) return null;
  const canvasRatio = canvasWidth / canvasHeight;
  const containerRatio = containerWidth / containerHeight;
  if (containerRatio > canvasRatio) return { width: containerHeight * canvasRatio, height: containerHeight };
  return { width: containerWidth, height: containerWidth / canvasRatio };
}
