import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)),
  'utf8',
);

function cssRule(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf('}', start);
  return css.slice(start, end === -1 ? css.length : end + 1);
}

// Documented rail geometry (43.4-06 plan: zero geometry changes; Defect 8
// visual contract: the ring hugs the rail band).
// 47 close-out UAT round 2: the ring is a square-cornered #4D677E rectangle
// around the 12px band only — no bottom extension (the frames have no
// rounding and the near-white full-row ring was too loud).
const LANE_HEIGHT_PX = 30;
const TARGET_HEIGHT_PX = 12;
const CELL_HEIGHT_PX = 22;
const RING_OFFSET_PX = 2;

describe('shared rail focus ring (43.4 defect 8)', () => {
  it('draws ONE identical ring for every rail family through the shared focus class', () => {
    // Both :focus and :focus-visible suppress the UA/default outline so a
    // mouse-clicked rail never shows a raw browser ring (Defect 6 contract).
    const focusRule = cssRule('.physics-paint-rail-target:focus,');
    expect(focusRule).toContain(
      '.physics-paint-rail-target:focus,\n.physics-paint-rail-target:focus-visible {',
    );
    expect(focusRule).toContain('outline: none');

    // The ring itself is a ::after of the focused target: 2px #F2F5F7 at the
    // Motion/Static token, extending below the 8px target by one full cell
    // row so the rectangle encloses band + cells instead of only the band.
    const ringRule = cssRule('.physics-paint-rail-target:focus::after,');
    expect(ringRule).toContain('.physics-paint-rail-target:focus-visible::after {');
    expect(ringRule).toContain('border: 2px solid #f1f1f1');
    expect(ringRule).toContain('top: -2px');
    expect(ringRule).toContain('left: -2px');
    expect(ringRule).toContain('right: -2px');
    expect(ringRule).toContain('bottom: -20px');
    expect(ringRule).toContain('border-radius: 0');
    expect(ringRule).toContain('pointer-events: none');
  });

  it('removes the per-type focus forks that made Key Rail diverge', () => {
    expect(css).not.toContain('.physics-paint-key-rail-target:focus,');
    expect(css).not.toContain('.physics-paint-key-rail-target:focus-visible {');
    expect(css).not.toContain('.physics-paint-loop-clip-rail-target:focus-visible {');
  });

  it('full-row ring wraps the 12px band + cells with a 2px overhang and never clips', () => {
    // Ring box from the shared ::after declarations (top: -2px, bottom: -20px
    // below the 12px target): spans -2..32 relative to the band top — the
    // compact 30px row (band + cells) with a 2px breathing overhang on each
    // side. The bottom offset is 20px (not the pre-47 24px) because the band
    // grew 8px -> 12px.
    const ringTop = -RING_OFFSET_PX;
    const ringBottom = TARGET_HEIGHT_PX + (LANE_HEIGHT_PX - TARGET_HEIGHT_PX) + RING_OFFSET_PX;
    expect(ringTop).toBe(-2);
    expect(ringBottom).toBe(32);

    // The full-height cells fit inside the 30px row (12px band above them).
    expect(CELL_HEIGHT_PX).toBeLessThan(LANE_HEIGHT_PX);

    // Full-row extent: the ring overhangs the 30px row by 2px above and below.
    expect(ringTop + RING_OFFSET_PX).toBe(0);
    expect(ringBottom - RING_OFFSET_PX).toBe(LANE_HEIGHT_PX);

    // No overflow clipping: the active lane is the rows-region's FIRST row, so
    // the +2px bottom overhang lands on the next row below — never clipped.
    expect(ringBottom).toBeGreaterThan(LANE_HEIGHT_PX);
  });
});
