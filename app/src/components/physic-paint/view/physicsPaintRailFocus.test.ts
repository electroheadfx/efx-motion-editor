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
const SEGMENT_TOP_PX = 4;
const SEGMENT_HEIGHT_PX = 3;

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
    expect(ringRule).toContain('border: 1px solid #cccccc');
    expect(ringRule).toContain('top: 4px');
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

  it('ring starts on the rail line and wraps down past the cells without clipping', () => {
    // Ring box from the shared ::after declarations (top: 4px — exactly on the
    // rail line, the segment's own top — and bottom: -20px below the 12px
    // target): spans 4..32 relative to the band top. The top edge never
    // overlaps the track above (UAT round 5); the bottom keeps the 2px
    // overhang past the 30px lane. The bottom offset is 20px (not the pre-47
    // 24px) because the band grew 8px -> 12px.
    const ringTop = SEGMENT_TOP_PX;
    const ringBottom = TARGET_HEIGHT_PX + (LANE_HEIGHT_PX - TARGET_HEIGHT_PX) + RING_OFFSET_PX;
    expect(ringTop).toBe(4);
    expect(ringBottom).toBe(32);

    // The rail line (3px segment) sits inside the ring's top edge; the
    // full-height cells fit inside the 30px row below the band.
    expect(ringTop).toBeLessThan(ringTop + SEGMENT_HEIGHT_PX);
    expect(CELL_HEIGHT_PX).toBeLessThan(LANE_HEIGHT_PX);

    // Full-row extent: the ring overhangs the 30px row by 2px below only.
    expect(ringBottom - RING_OFFSET_PX).toBe(LANE_HEIGHT_PX);

    // No overflow clipping: the active lane is the rows-region's FIRST row, so
    // the +2px bottom overhang lands on the next row below — never clipped.
    expect(ringBottom).toBeGreaterThan(LANE_HEIGHT_PX);
  });
});
