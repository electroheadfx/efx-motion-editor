/**
 * Captures the current preview canvas frame for use as FX Image shader input
 * in the shader browser. Called before switching to shader-browser mode.
 */

let _capturedCanvas: HTMLCanvasElement | null = null;

/** Capture the current preview canvas content to an offscreen canvas */
export function capturePreviewCanvas(): void {
  const canvas = document.querySelector('[data-canvas-area] canvas') as HTMLCanvasElement | null;
  if (!canvas || canvas.width === 0 || canvas.height === 0) return;

  if (!_capturedCanvas) {
    _capturedCanvas = document.createElement('canvas');
  }
  _capturedCanvas.width = canvas.width;
  _capturedCanvas.height = canvas.height;
  const ctx = _capturedCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, 0, 0);
  }
}

/** Get the previously captured canvas (or null if none) */
export function getCapturedCanvas(): HTMLCanvasElement | null {
  return _capturedCanvas;
}
