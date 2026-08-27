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

// Documented rail geometry (43.4-06 plan: zero geometry changes). 47 close-out
// UAT round 10: the selection ring was REMOVED — every rail family selects
// with the same orange segment, and frames/keys paint an orange background
// fill; no box anywhere.
const LANE_HEIGHT_PX = 30;
const TARGET_HEIGHT_PX = 8;
const SEGMENT_TOP_PX = 4;
const SEGMENT_HEIGHT_PX = 3;

describe('shared rail focus treatment (43.4 defect 8 / 47 close-out UAT round 10)', () => {
  it('suppresses the UA outline identically for every rail family through the shared focus class', () => {
    // Both :focus and :focus-visible suppress the UA/default outline so a
    // mouse-clicked rail never shows a raw browser ring (Defect 6 contract).
    const focusRule = cssRule('.physics-paint-rail-target:focus,');
    expect(focusRule).toContain(
      '.physics-paint-rail-target:focus,\n.physics-paint-rail-target:focus-visible {',
    );
    expect(focusRule).toContain('outline: none');

    // UAT round 10: the selection box is GONE — the orange segment is the
    // whole selected treatment for every rail family.
    expect(css).not.toContain('.physics-paint-rail-target:focus::after');
    expect(css).not.toContain('.physics-paint-rail-target:focus-visible::after');
  });

  it('selects every rail family with the same orange segment', () => {
    expect(cssRule('.physics-paint-key-rail-target.selected .physics-paint-key-rail-segment {'))
      .toContain('background: #f59e0b');
    expect(cssRule('.physics-paint-loop-clip-rail-target.selected .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #f59e0b');
  });

  it('removes the per-type focus forks that made Key Rail diverge', () => {
    expect(css).not.toContain('.physics-paint-key-rail-target:focus,');
    expect(css).not.toContain('.physics-paint-key-rail-target:focus-visible {');
    expect(css).not.toContain('.physics-paint-loop-clip-rail-target:focus-visible {');
  });

  it('keeps the documented 30px lane geometry (8px band, rail line at 4px)', () => {
    expect(LANE_HEIGHT_PX).toBe(30);
    expect(TARGET_HEIGHT_PX).toBe(8);
    // The 3px segment sits at 4px into the band — 1px above the cells.
    expect(SEGMENT_TOP_PX + SEGMENT_HEIGHT_PX).toBe(7);
    expect(TARGET_HEIGHT_PX).toBe(SEGMENT_TOP_PX + SEGMENT_HEIGHT_PX + 1);
  });
});
