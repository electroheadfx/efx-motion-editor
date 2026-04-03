// ============================================================
//  Color Conversion Utilities
//  Extracted from efx-paint-physic-v3.html lines 458-480
//  All functions preserve the exact v3 algorithms
// ============================================================

/**
 * Parse hex color string to RGB tuple.
 * From v3.html hexRgb(h) — line 458
 */
export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Convert RGB values to hex string.
 * From v3.html rgbHex(r,g,b) — line 459
 */
export function rgbHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => v < 0 ? 0 : v > 255 ? 255 : v
  return '#' + (
    (1 << 24) +
    (clamp(Math.round(r)) << 16) +
    (clamp(Math.round(g)) << 8) +
    clamp(Math.round(b))
  ).toString(16).slice(1)
}

/**
 * Convert RGB (0-255) to HSL (h: 0-360, s: 0-1, l: 0-1).
 * From v3.html rgb2hsl(r,g,b) — line 464
 */
export function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  let h = 0
  let s = 0
  const l = (mx + mn) / 2

  if (d > 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (mx === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return [h * 360, s, l]
}

/**
 * Convert HSL (h: 0-360, s: 0-1, l: 0-1) to RGB (0-255).
 * From v3.html hsl2rgb(h,s,l) — line 465
 */
export function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0

  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

/**
 * Map RGB hue angle to RYB hue angle.
 * Uses piecewise linear mapping table.
 * From v3.html rgb2ryb(h) — line 466
 */
export function rgb2ryb(hue: number): number {
  hue = ((hue % 360) + 360) % 360
  const m: [number, number][] = [
    [0, 0], [60, 120], [120, 180], [180, 210],
    [240, 240], [300, 300], [360, 360],
  ]
  for (let i = 0; i < m.length - 1; i++) {
    if (hue <= m[i + 1][0]) {
      const t = (hue - m[i][0]) / (m[i + 1][0] - m[i][0])
      return m[i][1] + (m[i + 1][1] - m[i][1]) * t
    }
  }
  return hue
}

/**
 * Map RYB hue angle back to RGB hue angle.
 * Inverse of rgb2ryb mapping.
 * From v3.html ryb2rgb(h) — line 467
 */
export function ryb2rgb(hue: number): number {
  hue = ((hue % 360) + 360) % 360
  const m: [number, number][] = [
    [0, 0], [120, 60], [180, 120], [210, 180],
    [240, 240], [300, 300], [360, 360],
  ]
  for (let i = 0; i < m.length - 1; i++) {
    if (hue <= m[i + 1][0]) {
      const t = (hue - m[i][0]) / (m[i + 1][0] - m[i][0])
      return m[i][1] + (m[i + 1][1] - m[i][1]) * t
    }
  }
  return hue
}

/**
 * Subtractive color mixing via RYB hue space.
 * Pipeline: RGB -> HSL -> RYB hue -> mix -> RGB hue -> HSL -> RGB
 * Includes darkening factor for paint-like behavior.
 * From v3.html mixSubtractive(c1, c2, ratio) — lines 468-480
 */
export function mixSubtractive(
  c1: [number, number, number],
  c2: [number, number, number],
  ratio: number,
): [number, number, number] {
  const [h1, s1, l1] = rgb2hsl(c1[0], c1[1], c1[2])
  const [h2, s2, l2] = rgb2hsl(c2[0], c2[1], c2[2])
  // Darkening scales with color difference: same colors → no darkening
  let hueDiff = Math.abs(h1 - h2)
  if (hueDiff > 180) hueDiff = 360 - hueDiff
  const colorDist = hueDiff / 180  // 0 = same hue, 1 = opposite
  const darkF = 1 - 0.15 * Math.sin(ratio * Math.PI) * colorDist

  // Both achromatic — simple linear blend
  if (s1 < 0.05 && s2 < 0.05) {
    return c1.map((v, i) => Math.round(v + (c2[i] - v) * ratio)) as [number, number, number]
  }

  // One achromatic — use the chromatic hue
  if (s1 < 0.05) {
    return hsl2rgb(h2, s1 + (s2 - s1) * ratio, (l1 + (l2 - l1) * ratio) * darkF)
  }
  if (s2 < 0.05) {
    return hsl2rgb(h1, s1 + (s2 - s1) * ratio, (l1 + (l2 - l1) * ratio) * darkF)
  }

  // Both chromatic — mix in RYB hue space
  const r1 = rgb2ryb(h1)
  const r2 = rgb2ryb(h2)
  let dh = r2 - r1
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360

  return hsl2rgb(
    ryb2rgb((r1 + dh * ratio + 360) % 360),
    (s1 + (s2 - s1) * ratio) * (1 - 0.12 * Math.sin(ratio * Math.PI)),
    (l1 + (l2 - l1) * ratio) * darkF,
  )
}
