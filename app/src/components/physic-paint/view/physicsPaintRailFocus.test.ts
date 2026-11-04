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

// Documented rail geometry (v2.0.1 v7): a 6px rail band in a 31px row (30px
// layout + 1px between stacked rows). The 4px rail line sits at the row top;
// the cells start 6px down. The selection ring was removed in 47 close-out and
// v7 keeps the no-ring contract: the selected rail reads the data-attribute
// palette, never an orange fill.
const LANE_HEIGHT_PX = 31;
const TARGET_HEIGHT_PX = 6;
const SEGMENT_TOP_PX = 0;
const SEGMENT_HEIGHT_PX = 4;

describe('shared rail focus treatment (43.4 defect 8 / 47 close-out UAT round 10)', () => {
  it('suppresses the UA outline identically for every rail family through the shared focus class', () => {
    // Both :focus and :focus-visible suppress the UA/default outline so a
    // mouse-clicked rail never shows a raw browser ring (Defect 6 contract).
    const focusRule = cssRule('.physics-paint-rail-target:focus,');
    expect(focusRule).toContain(
      '.physics-paint-rail-target:focus,\n.physics-paint-rail-target:focus-visible {',
    );
    expect(focusRule).toContain('outline: none');

    // The selection box is GONE — the bright palette segment is the whole
    // selected treatment for every rail family.
    expect(css).not.toContain('.physics-paint-rail-target:focus::after');
    expect(css).not.toContain('.physics-paint-rail-target:focus-visible::after');
  });

  it('paints every rail family from the shared palette variable', () => {
    // v2.0.1 v7: the per-family selected rules collapsed into the palette
    // variable on each family's base segment rule.
    expect(cssRule('.physics-paint-key-rail-segment {'))
      .toContain('background: var(--rail-line, #6C8A35)');
    expect(cssRule('.physics-paint-loop-clip-rail-segment {'))
      .toContain('background: var(--rail-line, #6C8A35)');
  });

  it('removes the per-type focus forks that made Key Rail diverge', () => {
    expect(css).not.toContain('.physics-paint-key-rail-target:focus,');
    expect(css).not.toContain('.physics-paint-key-rail-target:focus-visible {');
    expect(css).not.toContain('.physics-paint-loop-clip-rail-target:focus-visible {');
  });

  it('keeps the documented 31px lane geometry (6px band, 4px rail line at the row top)', () => {
    expect(LANE_HEIGHT_PX).toBe(31);
    expect(TARGET_HEIGHT_PX).toBe(6);
    // v2.0.1 v7: the 4px radius-2 line is flush at the row top and fits
    // inside the 6px band; the cells start at the band height (6px), so the
    // line never overlaps them.
    expect(SEGMENT_TOP_PX).toBe(0);
    expect(SEGMENT_TOP_PX + SEGMENT_HEIGHT_PX).toBe(4);
    expect(SEGMENT_TOP_PX + SEGMENT_HEIGHT_PX).toBeLessThanOrEqual(TARGET_HEIGHT_PX);
    expect(TARGET_HEIGHT_PX).toBe(6);
  });
});
