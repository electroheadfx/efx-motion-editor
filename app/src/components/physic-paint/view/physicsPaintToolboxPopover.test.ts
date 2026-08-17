import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computeToolboxPopoverPlacement,
  shouldDismissToolboxPopover,
  type ToolboxPopoverDismissSurface,
} from './PhysicsPaintWorkflowStrip';

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');

describe('shouldDismissToolboxPopover (43.5-02 smoke fix 1 — BLOCKER)', () => {
  const surfaceContaining = (token: unknown): ToolboxPopoverDismissSurface => ({
    contains: (target) => target === token,
  });

  it('never dismisses when the pointerdown target is inside the portaled panel', () => {
    const toggle = {};
    const panel = surfaceContaining(toggle);
    expect(shouldDismissToolboxPopover(toggle as EventTarget, [panel])).toBe(false);
  });

  it('never dismisses when the target is inside the anchor button wrapper', () => {
    const button = {};
    const anchor = surfaceContaining(button);
    expect(shouldDismissToolboxPopover(button as EventTarget, [anchor])).toBe(false);
  });

  it('never dismisses when the target is inside any surface portaled from the popover', () => {
    const listboxOption = {};
    const panel = surfaceContaining(null);
    const portaledSurface = surfaceContaining(listboxOption);
    expect(
      shouldDismissToolboxPopover(listboxOption as EventTarget, [panel, portaledSurface]),
    ).toBe(false);
  });

  it('never dismisses on a detached target outside the document (native select popup artifact)', () => {
    const panel = surfaceContaining(null);
    const detached = {};
    expect(shouldDismissToolboxPopover(detached as EventTarget, [panel], () => true)).toBe(false);
  });

  it('dismisses when the target is outside every toolbox surface', () => {
    const outside = {};
    const panel = surfaceContaining(null);
    expect(shouldDismissToolboxPopover(outside as EventTarget, [panel], () => false)).toBe(true);
  });

  it('dismisses on a null target (cannot prove containment)', () => {
    expect(shouldDismissToolboxPopover(null, [])).toBe(true);
  });
});

describe('computeToolboxPopoverPlacement (43.5-02 smoke fix 2)', () => {
  const rect = (left: number, top: number, right: number, bottom: number) =>
    ({ left, top, right, bottom }) as DOMRect;
  const panel = { width: 240, height: 120 };

  it('right-aligns the popover right edge to the button right edge, extending left over the strip', () => {
    const anchor = rect(820, 640, 870, 668);
    const strip = rect(0, 479, 1180, 640);
    const placement = computeToolboxPopoverPlacement({ anchorRect: anchor, stripRect: strip, panelSize: panel });
    expect(placement.left).toBe(870 - panel.width);
    expect(placement.left + panel.width).toBe(870);
  });

  it('clamps the left edge 8px inside the strip so it never crosses the strip left bound', () => {
    const anchor = rect(20, 640, 70, 668);
    const strip = rect(0, 479, 1180, 640);
    const placement = computeToolboxPopoverPlacement({ anchorRect: anchor, stripRect: strip, panelSize: panel });
    expect(placement.left).toBe(8);
  });

  it('clamps the right edge inside the strip so it never covers the sidebar/rails lane', () => {
    const anchor = rect(1140, 640, 1172, 668);
    const strip = rect(0, 479, 1180, 640);
    const placement = computeToolboxPopoverPlacement({ anchorRect: anchor, stripRect: strip, panelSize: panel });
    expect(placement.left + panel.width).toBeLessThanOrEqual(strip.right - 8);
  });

  it('places the bottom edge exactly 4px above the strip top', () => {
    const anchor = rect(820, 640, 870, 668);
    const strip = rect(0, 479, 1180, 640);
    const placement = computeToolboxPopoverPlacement({ anchorRect: anchor, stripRect: strip, panelSize: panel });
    expect(placement.top).toBe(479 - 4 - panel.height);
    expect(placement.top + panel.height).toBe(479 - 4);
  });
});

describe('toolbox popover liquid-glass surface contract (43.5-02 smoke fix 3)', () => {
  it('uses the app liquid-glass language instead of the flat dark card', () => {
    const styles = css();
    const start = styles.indexOf('.physics-paint-toolbox-popover {');
    const panelBlock = styles.slice(start, styles.indexOf('.physics-paint-toolbox-popover::before', start));
    expect(panelBlock).not.toBe('');
    // Translucent dark background — never the flat #20262D card.
    expect(panelBlock).toMatch(/background:\s*rgba\(/);
    expect(panelBlock).not.toContain('background: #20262d');
    // 1px subtle light border, soft shadow, rounded corners.
    expect(panelBlock).toMatch(/border:\s*1px solid rgba\(/);
    expect(panelBlock).toContain('border-radius: 12px');
    expect(panelBlock).toContain('box-shadow:');
    // The backdrop blur + saturate live on a ::before glass layer so the panel
    // itself stays transform/filter/contain-free (the relocated interpolation
    // tooltip is position:fixed and must keep the viewport as its containing
    // block — a filter on the panel would break its placement).
    const glass = styles.slice(styles.indexOf('.physics-paint-toolbox-popover::before'));
    expect(glass).toMatch(/-webkit-backdrop-filter: blur\(/);
    expect(glass).toMatch(/backdrop-filter: blur\(/);
    expect(glass).toContain('saturate(');
    expect(panelBlock).not.toContain('backdrop-filter');
    expect(panelBlock).not.toMatch(/filter:\s/);
  });
});
