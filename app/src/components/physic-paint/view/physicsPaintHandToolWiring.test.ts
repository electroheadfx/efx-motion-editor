// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261105-cgl / 261107-sg3: read-only wiring pins for the Hand host tool.
 *
 * UAT final (261107-sg3): the Hand is a PRESS-AND-HOLD canvas tool living in
 * the floating canvas zoom pill. Pressing the pill button captures the pointer
 * and arms pan mode; moving the pointer (mouse or pen) pans through the zoom
 * store (the same path middle-drag uses) for as long as the press lasts; the
 * release stops the pan and disarms. Nothing latches. The canvas keeps its
 * middle-drag route only, and nothing couples the Hand to the paint tool,
 * Select, the picker or motion mode.
 */

const rail = readFileSync(fileURLToPath(new URL('./PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const zoomBar = readFileSync(fileURLToPath(new URL('./PhysicsPaintCanvasZoomBar.tsx', import.meta.url)), 'utf8');
const viewport = readFileSync(fileURLToPath(new URL('./PhysicsPaintCanvasZoomViewport.tsx', import.meta.url)), 'utf8');
const keyboard = readFileSync(fileURLToPath(new URL('./physicsPaintStudioKeyboard.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
const handStore = readFileSync(fileURLToPath(new URL('./physicsPaintHandTool.ts', import.meta.url)), 'utf8');

describe('Hand removed from the Studio tool rail (261107-sg3)', () => {
  it('renders no Hand control and imports neither the hand store nor the zoom store', () => {
    expect(rail).not.toContain('aquarelle-hand-toggle');
    expect(rail).not.toContain('<Hand');
    expect(rail).not.toContain('physicsPaintHandTool');
    expect(rail).not.toContain('physicsPaintCanvasZoom');
    // The Hand lives in the floating zoom pill; the rail keeps its paint tools
    // and host tools only.
    expect(rail).toContain(
      // 61-08 (D-05): PenTool joins the icon set for the vector pen host tool;
      // 61-13 (D-16): VectorSquare joins it for the wireframe latch. Still no
      // Hand icon. quick-261112: Wind + RefreshCcwDot left with Dry/re-render.
      "import { Droplet, Eraser, Paintbrush, Pen, PenTool, Pipette, Scan, VectorSquare } from 'lucide-preact';",
    );
    expect(rail).toContain("import { memo } from 'preact/compat';");
    // Only the hand session used hooks — both imports leave with it.
    expect(rail).not.toContain("from 'preact/hooks'");
  });

  it('retires the momentary hold-to-pan session machinery from the rail', () => {
    expect(rail).not.toContain('HandPanSession');
    expect(rail).not.toContain('beginHandSession');
    expect(rail).not.toContain('endHandSession');
    expect(rail).not.toContain('handSessionRef');
    expect(rail).not.toContain('handArmed');
    expect(rail).not.toContain('handAvailable');
    expect(rail).not.toContain('setPointerCapture');
  });

  it('keeps the rail exclusivity law minus the Hand', () => {
    // 61-08 (D-05): the vector pen joins the one-active-surface law.
    // 61-13 (D-16): the wireframe latch joins it too.
    expect(rail).toContain('const isActive =');
    expect(rail).toContain(
      '!selectActive && !pickerActive && !motionBoundaryActive && !penActive && active === id && !wireframeActive;',
    );
    // Everything else in the rail still renders.
    for (const testId of [
      'aquarelle-picker-toggle',
      'aquarelle-select-toggle',
      'aquarelle-motion-boundary-toggle',
    ]) {
      expect(rail).toContain(`data-testid="${testId}"`);
    }
    expect(rail).toContain('{WATERCOLOR_RAIL_TOOLS.map(({ id, label, shortcut, Icon }) => {');
  });
});

describe('Hand press button in the zoom pill (261107-sg3)', () => {
  it('renders one press-and-hold Hand button before Fit, bound to the armed signal', () => {
    expect(zoomBar).toContain("import { Hand, Minus, Plus } from 'lucide-preact';");
    expect(zoomBar).toContain(
      "import { disarmHandTool, isHandToolArmed, setHandToolArmed } from './physicsPaintHandTool';",
    );
    expect(zoomBar).toContain('const handArmed = isHandToolArmed();');
    // Exactly one control, seated immediately before Fit so the numeric zoom
    // controls stay grouped.
    expect(zoomBar.split('data-testid="aquarelle-hand-toggle"').length - 1).toBe(1);
    const toggleIndex = zoomBar.indexOf('data-testid="aquarelle-hand-toggle"');
    const fitIndex = zoomBar.indexOf('onClick={() => physicsPaintCanvasZoom.fitToWindow()}');
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(fitIndex).toBeGreaterThan(toggleIndex);
    const buttonStart = zoomBar.lastIndexOf('<button', toggleIndex);
    const buttonEnd = zoomBar.indexOf('</button>', toggleIndex);
    expect(buttonStart).toBeGreaterThanOrEqual(0);
    expect(buttonEnd).toBeGreaterThan(toggleIndex);
    const button = zoomBar.slice(buttonStart, buttonEnd);
    expect(button).toContain('aria-label="Hand"');
    // aria-pressed mirrors the live press so the pill shows its active state.
    expect(button).toContain('aria-pressed={handArmed}');
    // A PRESS button: pointerdown starts the pan, there is no click toggle.
    expect(button).toContain('onPointerDown={beginHandSession}');
    expect(button).not.toContain('toggleHandTool');
    expect(button).toContain('<Hand size={14} aria-hidden="true" />');
    // D-03 / 261113-o26: never disabled — the pan is free at every zoom.
    expect(button).not.toContain('disabled');
  });

  it('is an internal canvas tool — the pill imports no paint, select, picker or motion state', () => {
    for (const moduleName of [
      'aquarelleRecordState',
      'aquarelleStrokeSelection',
      'aquarelleColorPicker',
      'railMotionEditingMode',
    ]) {
      expect(zoomBar).not.toContain(moduleName);
    }
    expect(zoomBar).not.toContain('aquarelleActiveTool');
    expect(zoomBar).not.toContain('setAquarelleSelectMode');
    expect(zoomBar).not.toContain('aquarellePickerLatched');
    // The Hand press is the ONLY arm/disarm entry point (D-02).
    expect(zoomBar).not.toContain('toggleHandTool');
  });

  it('pans for as long as the button is held and disarms on release', () => {
    const beginStart = zoomBar.indexOf('const beginHandSession = (event: PointerEvent) => {');
    expect(beginStart).toBeGreaterThanOrEqual(0);
    const beginEnd = zoomBar.indexOf('return (', beginStart);
    expect(beginEnd).toBeGreaterThan(beginStart);
    const beginBlock = zoomBar.slice(beginStart, beginEnd);
    // Primary press only; the pan follows the pointer via capture.
    expect(beginBlock).toContain('if (event.button !== 0) return;');
    expect(beginBlock).toContain('setHandToolArmed(true);');
    expect(beginBlock).toContain('target.setPointerCapture(pointerId);');
    expect(beginBlock).toContain("target.addEventListener('pointermove', session.onMove, { passive: false });");
    expect(beginBlock).toContain("target.addEventListener('pointerup', session.onEnd);");
    expect(beginBlock).toContain("target.addEventListener('pointercancel', session.onEnd);");
    // The pan is the SAME zoom-store path as middle-drag.
    expect(beginBlock).toContain('physicsPaintCanvasZoom.setPan(');
    // Never disabled at Fit: no overflow gate on the press.
    expect(beginBlock).not.toContain('hasOverflow');

    const endStart = zoomBar.indexOf('const endHandSession = (pointerId?: number) => {');
    expect(endStart).toBeGreaterThanOrEqual(0);
    const endEnd = zoomBar.indexOf('// A Studio window closing', endStart);
    expect(endEnd).toBeGreaterThan(endStart);
    const endBlock = zoomBar.slice(endStart, endEnd);
    expect(endBlock).toContain('disarmHandTool();');
    expect(endBlock).toContain('releasePointerCapture(session.pointerId)');
    // Releasing the press (or losing the pointer) ends the pan.
    expect(endBlock).toContain("session.target.removeEventListener('pointerup', session.onEnd);");
    // A Studio window closing mid-press never leaves the flag armed.
    expect(zoomBar).toContain('useEffect(() => () => {');
  });

  it('leaves the canvas pointer route to middle-drag only', () => {
    // The Hand no longer consumes primary presses on the canvas.
    expect(viewport).not.toContain('isHandToolArmedPeek');
    expect(viewport).not.toContain('isHandToolArmed');
    expect(viewport).not.toContain('handPan');
    expect(viewport).not.toContain('wasHand');
    expect(viewport).not.toContain("source: 'hand'");
    expect(viewport).not.toContain('physics-paint-canvas-hand-armed');
    expect(viewport).not.toContain('disposeHandMode');
    expect(viewport).not.toContain("from '@preact/signals'");
    // Middle-drag is untouched, including its capture-phase listener.
    expect(viewport).toContain('if (event.button !== 1) return;');
    expect(viewport).toContain('viewport.setPointerCapture(event.pointerId)');
    expect(viewport).toContain("viewport.addEventListener('pointerdown', onPointerDown, true);");
    // A fresh Studio open always starts disarmed.
    expect(viewport).toContain('disarmHandTool();');
  });

  it('keeps the unchanged hand store API and describes the momentary press', () => {
    for (const exported of [
      'export function isHandToolArmed(): boolean {',
      'export function isHandToolArmedPeek(): boolean {',
      'export function setHandToolArmed(next: boolean): boolean {',
      'export function disarmHandTool(): boolean {',
    ]) {
      expect(handStore).toContain(exported);
    }
    // No toggle concept survives — the button is pressed, not latched.
    expect(handStore).not.toContain('toggleHandTool');
    expect(handStore).toContain('HOST tool');
    expect(handStore).toContain('MOMENTARY press');
    expect(handStore).toContain('floating canvas zoom pill');
  });

  it('drops the retired armed-cursor CSS', () => {
    expect(css).not.toContain('physics-paint-canvas-hand-armed');
    // The press rides the pill's existing aria-pressed styling.
    expect(css).toContain('.physics-paint-canvas-zoom-button[aria-pressed="true"],');
  });

  it('adds no keyboard hand/pan binding', () => {
    expect(keyboard).not.toContain('setHandToolArmed');
    expect(keyboard).not.toContain('physicsPaintHandTool');
    expect(keyboard).not.toContain('disarmHandTool');
    expect(keyboard).not.toMatch(/key === 'h'/);
  });
});
