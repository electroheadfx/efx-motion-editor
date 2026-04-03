/**
 * Iterative stack-based flood fill on ImageData.
 * Operates in-place on the provided ImageData.
 */
export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number = 10,
): void {
  const {data, width, height} = imageData;

  // Clamp start coordinates
  const sx = Math.round(Math.max(0, Math.min(startX, width - 1)));
  const sy = Math.round(Math.max(0, Math.min(startY, height - 1)));

  const startIdx = (sy * width + sx) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  // Don't fill if target matches fill color
  if (
    Math.abs(fillColor[0] - targetR) <= tolerance &&
    Math.abs(fillColor[1] - targetG) <= tolerance &&
    Math.abs(fillColor[2] - targetB) <= tolerance &&
    Math.abs(fillColor[3] - targetA) <= tolerance
  ) {
    return;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const pos = y * width + x;
    if (visited[pos]) continue;

    const i = pos * 4;
    if (
      Math.abs(data[i] - targetR) > tolerance ||
      Math.abs(data[i + 1] - targetG) > tolerance ||
      Math.abs(data[i + 2] - targetB) > tolerance ||
      Math.abs(data[i + 3] - targetA) > tolerance
    ) {
      continue;
    }

    visited[pos] = 1;
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = fillColor[3];

    stack.push(x + 1, y);
    stack.push(x - 1, y);
    stack.push(x, y + 1);
    stack.push(x, y - 1);
  }
}

/**
 * Parse hex color string to RGBA array.
 */
export function hexToRgba(hex: string, opacity: number): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = Math.round(opacity * 255);
  return [r, g, b, a];
}
