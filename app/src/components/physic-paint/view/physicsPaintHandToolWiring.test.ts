// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261105-cgl: read-only wiring pins for the Hand host tool.
 *
 * UAT correction: the Hand is MOMENTARY. Pressing the rail button captures the
 * pointer and pans for as long as the press lasts; releasing disarms back to
 * the untouched previous tool. Nothing is latched, so the canvas must never
 * consume a primary-button press and no keyboard binding exists.
 */

const rail = readFileSync(fileURLToPath(new URL('./PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const viewport = readFileSync(fileURLToPath(new URL('./PhysicsPaintCanvasZoomViewport.tsx', import.meta.url)), 'utf8');
const keyboard = readFileSync(fileURLToPath(new URL('./physicsPaintStudioKeyboard.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');

describe('Hand rail button (261105-cgl)', () => {
  it('renders one Hand host-tool button beside Select, grayed without canvas overflow', () => {
    expect(rail).toContain("import { Droplet, Eraser, Hand, Paintbrush, Pen, Pipette, RefreshCcwDot, Wind } from 'lucide-preact';");
    expect(rail).toContain('data-testid="aquarelle-hand-toggle"');
    expect(rail).toContain('aria-label="Hand"');
    expect(rail).toContain('disabled={disabled || !physicsPaintCanvasZoom.hasOverflow.value}');
    expect(rail).toContain('<Hand size={18} />');
    // The hand is a HOST tool — it never joins the paint-tool union.
    expect(rail).not.toContain("id: 'hand'");
    // The paint-tool row renders deselected while the hand press is live.
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

  it('pans only while the button is held and disarms on release', () => {
    const beginStart = rail.indexOf('const beginHandSession = (event: PointerEvent) => {');
    const beginEnd = rail.indexOf('const undoItem', beginStart);
    expect(beginStart).toBeGreaterThanOrEqual(0);
    const beginBlock = rail.slice(beginStart, beginEnd);
    // Primary button, overflow gate, and nothing latched.
    expect(beginBlock).toContain('if (event.button !== 0 || disabled) return;');
    expect(beginBlock).toContain('if (!physicsPaintCanvasZoom.hasOverflow.peek()) return;');
    expect(beginBlock).toContain('setHandToolArmed(true);');
    expect(beginBlock).toContain('target.setPointerCapture(pointerId);');
    expect(beginBlock).toContain("target.addEventListener('pointermove', session.onMove, { passive: false });");
    expect(beginBlock).toContain("target.addEventListener('pointerup', session.onEnd);");
    expect(beginBlock).toContain("target.addEventListener('pointercancel', session.onEnd);");
    // The pan is the SAME zoom-store path as middle-drag.
    expect(beginBlock).toContain('physicsPaintCanvasZoom.setPan(');
    // The rail button is the entry point — no click-to-arm toggle survives.
    expect(rail).toContain('onPointerDown={beginHandSession}');
    expect(rail).not.toContain('toggleHandTool');
    const endStart = rail.indexOf('const endHandSession = (pointerId?: number) => {');
    const endBlock = rail.slice(endStart, rail.indexOf('// A Studio window closing', endStart));
    expect(endStart).toBeGreaterThanOrEqual(0);
    expect(endBlock).toContain('disarmHandTool();');
    expect(endBlock).toContain('releasePointerCapture(session.pointerId)');
  });
});

describe('Hand viewport routing (261105-cgl)', () => {
  it('leaves the primary button entirely to the paint stack', () => {
    expect(viewport).not.toContain('isHandToolArmedPeek');
    expect(viewport).not.toContain('isHandToolArmed');
    expect(viewport).not.toContain("source: 'hand'");
    expect(viewport).not.toContain('physics-paint-canvas-hand-armed');
    // Middle-drag is untouched.
    expect(viewport).toContain('if (event.button !== 1) return;');
    expect(viewport).toContain('viewport.setPointerCapture(event.pointerId)');
  });

  it('drops the retired armed-cursor CSS', () => {
    expect(css).not.toContain('physics-paint-canvas-hand-armed');
  });

  it('adds no keyboard hand/pan binding', () => {
    expect(keyboard).not.toContain('toggleHandTool');
    expect(keyboard).not.toContain('physicsPaintHandTool');
    expect(keyboard).not.toContain('disarmHandTool');
    expect(keyboard).not.toMatch(/key === 'h'/);
  });
});
