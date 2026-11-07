// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261105-cgl / 261107-sg3: read-only wiring pins for the Hand host tool.
 *
 * UAT correction (261107-sg3): the Hand is a ONE-DRAG-PER-CLICK canvas tool
 * living in the floating canvas zoom pill. A fresh Studio open starts
 * disarmed; one click on the pill icon arms a single pan gesture, a
 * primary-button drag anywhere on the canvas pans through the zoom store (the
 * same path middle-drag uses), and releasing that drag also disarms so the
 * next canvas drag paints again. A second click before dragging cancels.
 * Nothing couples it to the paint tool, Select, the picker or motion mode, and
 * no keyboard binding exists.
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
    // The Hand lives in the floating zoom pill; the rail keeps its
    // paint tools and host tools only.
    expect(rail).toContain(
      "import { Droplet, Eraser, Paintbrush, Pen, Pipette, RefreshCcwDot, Scan, Wind } from 'lucide-preact';",
    );
    expect(rail).toContain("import { memo } from 'preact/compat';");
    // Only the hand session used hooks — both imports leave with it.
    expect(rail).not.toContain("from 'preact/hooks'");
  });

  it('retires the momentary hold-to-pan session machinery', () => {
    expect(rail).not.toContain('HandPanSession');
    expect(rail).not.toContain('beginHandSession');
    expect(rail).not.toContain('endHandSession');
    expect(rail).not.toContain('handSessionRef');
    expect(rail).not.toContain('handArmed');
    expect(rail).not.toContain('handAvailable');
    expect(rail).not.toContain('setPointerCapture');
  });

  it('keeps the rail exclusivity law minus the Hand', () => {
    expect(rail).toContain(
      'const isActive = !selectActive && !pickerActive && !motionBoundaryActive && active === id;',
    );
    // Everything else in the rail still renders.
    for (const testId of [
      'aquarelle-picker-toggle',
      'aquarelle-select-toggle',
      'aquarelle-motion-boundary-toggle',
      'aquarelle-dry',
      'aquarelle-rebake-script',
    ]) {
      expect(rail).toContain(`data-testid="${testId}"`);
    }
    expect(rail).toContain('{WATERCOLOR_RAIL_TOOLS.map(({ id, label, shortcut, Icon }) => {');
  });
});

describe('Hand canvas tool in the zoom pill (261107-sg3)', () => {
  it('renders one Hand toggle before Fit, bound to the armed signal', () => {
    expect(zoomBar).toContain("import { Hand, Minus, Plus } from 'lucide-preact';");
    expect(zoomBar).toContain("import { isHandToolArmed, toggleHandTool } from './physicsPaintHandTool';");
    expect(zoomBar).toContain('const handArmed = isHandToolArmed();');
    // Exactly one control, seated immediately before Fit so the numeric zoom
    // controls stay grouped.
    expect(zoomBar.split('data-testid="aquarelle-hand-toggle"').length - 1).toBe(1);
    const toggleIndex = zoomBar.indexOf('data-testid="aquarelle-hand-toggle"');
    const fitIndex = zoomBar.indexOf('onClick={() => physicsPaintCanvasZoom.fitToWindow()}');
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(fitIndex).toBeGreaterThan(toggleIndex);
    // aria-pressed mirrors the armed signal; one click arms, a second cancels.
    const buttonStart = zoomBar.lastIndexOf('<button', toggleIndex);
    const buttonEnd = zoomBar.indexOf('</button>', toggleIndex);
    expect(buttonStart).toBeGreaterThanOrEqual(0);
    expect(buttonEnd).toBeGreaterThan(toggleIndex);
    const button = zoomBar.slice(buttonStart, buttonEnd);
    expect(button).toContain('aria-label="Hand"');
    expect(button).toContain('aria-pressed={handArmed}');
    expect(button).toContain('onClick={() => toggleHandTool()}');
    expect(button).toContain('<Hand size={14} aria-hidden="true" />');
    // D-03: never disabled — at Fit the pan simply clamps to zero.
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
    // The Hand icon is the ONLY arm/disarm entry point (D-02).
    expect(zoomBar).not.toContain('setHandToolArmed');
    expect(zoomBar).not.toContain('disarmHandTool');
  });

  it('pans on a primary drag only while armed, through the middle-drag path', () => {
    expect(viewport).toMatch(/import \{ disarmHandTool,[^}]*isHandToolArmedPeek[^}]*\} from '\.\/physicsPaintHandTool';/);
    expect(viewport).toContain('const handPan = event.button === 0 && isHandToolArmedPeek();');
    expect(viewport).toContain('if (event.button !== 1 && !handPan) return;');
    // D-03: the hand route proceeds at Fit — setPan clamps the pan to zero.
    expect(viewport).toContain('if (!handPan && !physicsPaintCanvasZoom.hasOverflow.peek()) return;');
    expect(viewport).toContain('hand: handPan,');
    // The pan is the SAME zoom-store path as middle-drag.
    expect(viewport).toContain('physicsPaintCanvasZoom.setPan(');
    expect(viewport).toContain('viewport.setPointerCapture(event.pointerId)');
  });

  it('disarms when a hand pan drag is released — one drag per click', () => {
    const finishStart = viewport.indexOf('const finishDrag = (pointerId: number) => {');
    expect(finishStart).toBeGreaterThanOrEqual(0);
    const finishEnd = viewport.indexOf('const endDrag', finishStart);
    expect(finishEnd).toBeGreaterThan(finishStart);
    const finishBlock = viewport.slice(finishStart, finishEnd);
    // The drag remembers it was a hand pan BEFORE the drag state is cleared.
    expect(finishBlock).toContain('const wasHand = drag.hand;');
    expect(finishBlock.indexOf('drag = null;')).toBeGreaterThan(finishBlock.indexOf('const wasHand = drag.hand;'));
    // Releasing a hand drag leaves the mode; a middle drag never does.
    expect(finishBlock).toContain('if (wasHand) disarmHandTool();');
    // Middle-drag release is untouched by the one-shot law.
    expect(finishBlock).not.toMatch(/if \(!wasHand\)\s*disarmHandTool/);
  });

  it('keeps middle-button routing, the capture-phase listener and the mount reset', () => {
    expect(viewport).toContain('if (event.button !== 1 && !handPan) return;');
    expect(viewport).toContain("viewport.addEventListener('pointerdown', onPointerDown, true);");
    expect(viewport).toContain('disarmHandTool();');
    expect(viewport).not.toContain("source: 'hand'");
    expect(viewport).not.toContain('physics-paint-canvas-hand-armed');
  });

  it('holds the grab/grabbing cursor law and ends a live hand drag on disarm', () => {
    // A middle-drag release while the Hand is armed restores grab; the hand
    // drag release and any disarm clear the cursor.
    expect(viewport).toContain("viewport.style.cursor = isHandToolArmedPeek() ? 'grab' : '';");
    // ONE narrow signals effect inside the existing mount effect.
    const effectStart = viewport.indexOf('const disposeHandMode = effect(() => {');
    expect(effectStart).toBeGreaterThanOrEqual(0);
    const effectEnd = viewport.indexOf('});', effectStart);
    const effectBlock = viewport.slice(effectStart, effectEnd);
    expect(effectBlock).toContain('const armed = isHandToolArmed();');
    // A disarm is a hard exit: finish the live hand drag (release capture).
    expect(effectBlock).toContain('if (!armed && drag !== null) finishDrag(drag.pointerId);');
    expect(effectBlock).toContain("viewport.style.cursor = armed ? 'grab' : '';");
    // DOM-style write only — never a signal write (no loop, no re-render).
    expect(effectBlock).not.toContain('.value =');
    expect(effectBlock).not.toContain('.value=');
    // The subscription is disposed in the mount cleanup.
    const cleanupBlock = viewport.slice(viewport.indexOf('return () => {'));
    expect(cleanupBlock).toContain('disposeHandMode();');
  });

  it('keeps the unchanged hand store API and describes the one-drag canvas tool', () => {
    for (const exported of [
      'export function isHandToolArmed(): boolean {',
      'export function isHandToolArmedPeek(): boolean {',
      'export function setHandToolArmed(next: boolean): boolean {',
      'export function toggleHandTool(): boolean {',
      'export function disarmHandTool(): boolean {',
    ]) {
      expect(handStore).toContain(exported);
    }
    // The literal phrase stays (pinned by physicsPaintHandTool.test.ts); the
    // contract now describes a one-drag-per-click canvas tool.
    expect(handStore).toContain('HOST tool');
    expect(handStore).toContain('ONE-DRAG-PER-CLICK canvas tool');
    expect(handStore).toContain('floating canvas zoom pill');
    expect(handStore).not.toContain('MOMENTARY');
  });

  it('drops the retired armed-cursor CSS', () => {
    expect(css).not.toContain('physics-paint-canvas-hand-armed');
    // The Hand rides the pill's existing aria-pressed styling.
    expect(css).toContain('.physics-paint-canvas-zoom-button[aria-pressed="true"],');
  });

  it('adds no keyboard hand/pan binding', () => {
    expect(keyboard).not.toContain('toggleHandTool');
    expect(keyboard).not.toContain('physicsPaintHandTool');
    expect(keyboard).not.toContain('disarmHandTool');
    expect(keyboard).not.toMatch(/key === 'h'/);
  });
});
