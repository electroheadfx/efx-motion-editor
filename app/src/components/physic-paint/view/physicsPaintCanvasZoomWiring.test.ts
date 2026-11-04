// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261104-uyv: read-only wiring pins for the Studio canvas zoom surface.
 *
 * The zoom feature is display-only, so most of its contract IS structural:
 * one stack literal wrapped once, the pill gated by the picker step-aside,
 * the clip on the viewport (never on the canvas region), the mount contract
 * untouched, and no new keyboard binding anywhere.
 */

const view = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const viewport = readFileSync(fileURLToPath(new URL('./PhysicsPaintCanvasZoomViewport.tsx', import.meta.url)), 'utf8');
const mount = readFileSync(fileURLToPath(new URL('../engine/PhysicsPaintCanvasMount.tsx', import.meta.url)), 'utf8');
const keyboard = readFileSync(fileURLToPath(new URL('./physicsPaintStudioKeyboard.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('}', start);
  expect(end, `${selector} rule end`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Studio canvas zoom wiring (261104-uyv)', () => {
  it('wraps the single memoized stack in the zoom viewport, once', () => {
    const stackLiteral = '<MemoizedPhysicsPaintCanvasStack {...canvas} />';
    expect(view.split(stackLiteral).length - 1).toBe(1);
    const stackIndex = view.indexOf(stackLiteral);
    const openIndex = view.indexOf('<PhysicsPaintCanvasZoomViewport>');
    const closeIndex = view.indexOf('</PhysicsPaintCanvasZoomViewport>');
    expect(openIndex).toBeGreaterThanOrEqual(0);
    expect(stackIndex).toBeGreaterThan(openIndex);
    expect(closeIndex).toBeGreaterThan(stackIndex);
    expect(view).toContain("import { PhysicsPaintCanvasZoomViewport } from './PhysicsPaintCanvasZoomViewport';");
    // The picker overlays stay AFTER the wrapped stack (indexOf ordering pins).
    const backgroundPickerIndex = view.indexOf('{backgroundPicker?.open ? <BackgroundAssetPickerView');
    expect(backgroundPickerIndex).toBeGreaterThan(closeIndex);
  });

  it('seats the pill as a region sibling after the viewport and the apply pill, gated by pickerOpen', () => {
    expect(view).toContain("import { PhysicsPaintCanvasZoomBar } from './PhysicsPaintCanvasZoomBar';");
    const barLiteral = '{!pickerOpen ? <PhysicsPaintCanvasZoomBar /> : null}';
    expect(view.split(barLiteral).length - 1).toBe(1);
    const barIndex = view.indexOf(barLiteral);
    const viewportClose = view.indexOf('</PhysicsPaintCanvasZoomViewport>');
    const pillIndex = view.indexOf('<PhysicsPaintApplyProgressPill');
    expect(barIndex).toBeGreaterThan(viewportClose);
    expect(barIndex).toBeGreaterThan(pillIndex);
  });

  it('clips ONLY at the zoom viewport — the canvas region stays unclipped', () => {
    const viewportRule = ruleBody(css, '.physics-paint-canvas-zoom-viewport');
    expect(viewportRule).toContain('position: relative');
    expect(viewportRule).toContain('overflow: hidden');
    expect(viewportRule).toContain('width: 100%');
    expect(viewportRule).toContain('height: 100%');
    // The region owns the floating dialogs and the apply pill; clipping it
    // would swallow them (the 52.1 lesson).
    const regionRule = ruleBody(css, '.physics-paint-canvas-region');
    expect(regionRule).not.toContain('overflow');
    const panRule = ruleBody(css, '.physics-paint-canvas-zoom-pan');
    expect(panRule).toContain('position: absolute');
    expect(panRule).toContain('inset: 0');
    // The pill's seat and stacking: above the sheet, below the picker (20).
    const barRule = ruleBody(css, '.physics-paint-canvas-zoom-bar');
    expect(barRule).toContain('z-index: 10');
    expect(barRule).toContain('left: 16px');
    expect(barRule).toContain('bottom: 16px');
  });

  it('keeps the mount sizing seam and every pinned mount contract', () => {
    expect(mount).toContain('}, [props.height, props.width]);');
    for (const counter of [
      'render.canvasMount',
      'render.efxChildRequest',
      'observer.canvasMount.resize.install',
      'observer.canvasMount.resize.cleanup',
    ]) {
      expect(mount.split(`recordPhysicsPaintPerformanceCounter('${counter}')`).length - 1).toBe(1);
    }
    // The store is the ONE display-size authority now; the fit-only helper is
    // gone from the mount.
    expect(mount).toContain('physicsPaintCanvasZoom.setWorkSize(props.width, props.height);');
    expect(mount).toContain('physicsPaintCanvasZoom.setContainerSize(rect.width, rect.height);');
    expect(mount).not.toContain('getContainedCanvasDisplaySize(');
    // The zoomed shell neutralizes the CSS caps only while sized.
    expect(mount).toContain("maxWidth: 'none',");
    expect(mount).toContain("maxHeight: 'none',");
    expect(mount).toContain('const zoomSized =');
  });

  it('keeps the pan leaf narrow and the interactions coalesced', () => {
    expect(viewport).toContain('physicsPaintCanvasZoom.resetForStudioOpen();');
    expect(viewport).toContain("viewport.addEventListener('wheel', onWheel, { passive: false });");
    expect(viewport).toContain("viewport.addEventListener('gesturestart', onGestureStart, { passive: false });");
    expect(viewport).toContain("viewport.addEventListener('gesturechange', onGestureChange, { passive: false });");
    // Middle-button pan is consumed in the CAPTURE phase, before the stack's
    // picker/block gates and the engine.
    expect(viewport).toContain("viewport.addEventListener('pointerdown', onPointerDown, true);");
    expect(viewport).toContain('window.cancelAnimationFrame(rafId)');
    const panLeaf = viewport.slice(viewport.indexOf('export function PhysicsPaintCanvasZoomPanLayer'));
    expect(panLeaf).toContain('physicsPaintCanvasZoom.panX.value');
    expect(panLeaf).toContain('physicsPaintCanvasZoom.panY.value');
    expect(panLeaf).not.toContain('effectiveScale');
  });

  it('adds no keyboard zoom binding', () => {
    for (const keyArm of ["'='", "'-'", "'+'", 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']) {
      expect(keyboard).not.toContain(keyArm);
    }
    expect(keyboard.toLowerCase()).not.toContain('zoom');
  });
});
