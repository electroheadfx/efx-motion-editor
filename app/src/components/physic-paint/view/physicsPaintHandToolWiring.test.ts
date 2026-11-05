// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261105-cgl Task 3: read-only wiring pins for the Hand host tool.
 *
 * The hand is display-only pan through the EXISTING zoom-store pan path: the
 * rail button is gated by canvas overflow, the viewport consumes the primary
 * button ONLY while the hand is armed AND the sheet overflows, and the release
 * disarms back to the untouched previous tool. No keyboard binding is added.
 */

const rail = readFileSync(fileURLToPath(new URL('./PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const viewport = readFileSync(fileURLToPath(new URL('./PhysicsPaintCanvasZoomViewport.tsx', import.meta.url)), 'utf8');
const keyboard = readFileSync(fileURLToPath(new URL('./physicsPaintStudioKeyboard.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('}', start);
  expect(end, `${selector} rule end`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Hand rail button (261105-cgl)', () => {
  it('renders one Hand host-tool button beside Select, greyed without canvas overflow', () => {
    expect(rail).toContain("import { Droplet, Eraser, Hand, Paintbrush, Pen, Pipette, RefreshCcwDot, Wind } from 'lucide-preact';");
    expect(rail).toContain('data-testid="aquarelle-hand-toggle"');
    expect(rail).toContain('aria-label="Hand"');
    expect(rail).toContain('disabled={disabled || !physicsPaintCanvasZoom.hasOverflow.value}');
    expect(rail).toContain('physicsPaintCanvasZoom.hasOverflow.peek()');
    expect(rail).toContain('toggleHandTool()');
    expect(rail).toContain('<Hand size={18} />');
    // The hand is a HOST tool — it never joins the paint-tool union.
    expect(rail).not.toContain("id: 'hand'");
    // The paint-tool row renders deselected while the hand is armed.
    expect(rail).toContain('!selectActive && !pickerActive && !handArmed && active === id');
  });

  it('sits immediately after Select and before Dry', () => {
    const selectIndex = rail.indexOf('data-testid="aquarelle-select-toggle"');
    const handIndex = rail.indexOf('data-testid="aquarelle-hand-toggle"');
    const dryIndex = rail.indexOf('data-testid="aquarelle-dry"');
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    expect(handIndex).toBeGreaterThan(selectIndex);
    expect(dryIndex).toBeGreaterThan(handIndex);
  });
});

describe('Hand viewport routing (261105-cgl)', () => {
  it('consumes the primary button in the capture phase only while armed AND overflowing', () => {
    const downStart = viewport.indexOf('const onPointerDown = (event: PointerEvent) => {');
    const handStart = viewport.indexOf('if (event.button === 0 && isHandToolArmedPeek())', downStart);
    const handBlockEnd = viewport.indexOf("if (event.button !== 1) return;", handStart);
    expect(handStart).toBeGreaterThan(downStart);
    const handBlock = viewport.slice(handStart, handBlockEnd);
    // No overflow: disarm and return WITHOUT preventDefault/stopPropagation, so
    // painting can never be blocked (T-261105-CGL-02).
    expect(handBlock).toContain('if (!physicsPaintCanvasZoom.hasOverflow.peek()) {');
    expect(handBlock).toContain('disarmHandTool();');
    expect(handBlock).toContain('return;');
    const denialBlock = handBlock.slice(
      handBlock.indexOf('if (!physicsPaintCanvasZoom.hasOverflow.peek()) {'),
      handBlock.indexOf('disarmHandTool();'),
    );
    expect(denialBlock).not.toContain('preventDefault');
    expect(denialBlock).not.toContain('stopPropagation');
    // The armed branch shares the one drag record with the middle-button pan.
    expect(handBlock).toContain("source: 'hand'");
    expect(handBlock).toContain('viewport.setPointerCapture(event.pointerId)');
    expect(handBlock).toContain("viewport.style.cursor = 'grabbing'");
  });

  it('releases the pointer and disarms the hand on the hand release only', () => {
    const endStart = viewport.indexOf('const endDrag = (event: PointerEvent) => {');
    const endBlock = viewport.slice(endStart, viewport.indexOf('const onAuxClick', endStart));
    expect(endStart).toBeGreaterThanOrEqual(0);
    expect(endBlock).toContain("const wasHand = drag.source === 'hand';");
    expect(endBlock).toContain('if (wasHand) {');
    expect(endBlock).toContain('disarmHandTool();');
    // Middle-drag releases share the same path with no disarm write.
    expect(endBlock).toContain('viewport.releasePointerCapture(pointerId);');
    expect(endBlock).toContain("viewport.style.cursor = '';");
  });

  it('toggles the armed cursor class and self-heals when overflow disappears', () => {
    expect(viewport).toContain("viewport.classList.toggle('physics-paint-canvas-hand-armed', armed)");
    expect(viewport).toContain('if (armed && !physicsPaintCanvasZoom.hasOverflow.value) disarmHandTool();');
    expect(viewport).toContain('disposeHandArmed();');
    expect(viewport).toContain('disarmHandTool();');
    const rule = ruleBody(css, '.physics-paint-canvas-zoom-viewport.physics-paint-canvas-hand-armed');
    expect(rule).toContain('cursor: grab');
    expect(css).toContain('.physics-paint-canvas-zoom-viewport.physics-paint-canvas-hand-armed *');
  });

  it('adds no keyboard hand/pan binding', () => {
    expect(keyboard).not.toContain('toggleHandTool');
    expect(keyboard).not.toContain('physicsPaintHandTool');
    expect(keyboard).not.toContain('disarmHandTool');
    expect(keyboard).not.toMatch(/key === 'h'/);
  });
});
