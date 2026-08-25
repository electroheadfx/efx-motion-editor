import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');

function getCssRuleBlock(styles: string, selector: string): string {
  const start = styles.indexOf(selector);
  if (start === -1) return '';
  const end = styles.indexOf('}', start);
  return end === -1 ? '' : styles.slice(start, end + 1);
}

describe('PhysicsPaintTopBar small-width responsiveness (36.15-06 fix)', () => {
  it('lets the studio top row grow beyond 58px so wrapped controls are never crushed', () => {
    // 47-01 UAT round 3: row 3 is `auto` — the workflow strip sets its own
    // dynamic height (default = exactly enough for all tracks + Bg, capped at
    // 270px; the top-edge drag handle resizes it). The canvas row absorbs the
    // difference.
    expect(getCssRuleBlock(css(), '.physics-paint-studio {')).toContain('grid-template-rows: minmax(58px, auto) minmax(0, 1fr) auto');
  });

  it('reserves no fixed minimum side-column width in the topbar grid at any width', () => {
    const styles = css();
    expect(getCssRuleBlock(styles, '.physics-paint-topbar {')).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)');
    expect(styles).not.toContain('minmax(170px, 1fr)');
    expect(styles).not.toContain('minmax(120px, 1fr)');
  });

  it('wraps the primary control cluster at the base level instead of only inside a breakpoint', () => {
    const styles = css();
    const base = styles.slice(0, styles.indexOf('@media'));
    expect(getCssRuleBlock(base, '.physics-paint-topbar-primary {')).toContain('flex-wrap: wrap');
  });
});
