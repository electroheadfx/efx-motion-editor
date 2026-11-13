// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261113-o26 follow-up: the main editor gains the Studio zoom pill's two
 * missing controls — the PRESS-AND-HOLD Hand and 1:1 — inside its existing
 * zoom row. The Hand follows the Studio's session law (capture the pointer on
 * the press, pan for as long as it lasts, release stops, nothing latches) and
 * converts the CSS-pixel delta back into pan units, which the editor's
 * `scale(z) translate(px, py)` transform expresses pre-scale.
 */

const area = readFileSync(fileURLToPath(new URL('./CanvasArea.tsx', import.meta.url)), 'utf8');

function slice(start: string, end: string): string {
  const from = area.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const to = area.indexOf(end, from);
  expect(to).toBeGreaterThan(from);
  return area.slice(from, to);
}

describe('CanvasArea — Hand pan button', () => {
  it('renders the Hand next to the zoom buttons', () => {
    expect(area).toContain("import {Plus, Minus, Maximize, Paintbrush, Hand} from 'lucide-preact';");
    expect(area).toContain('onPointerDown={beginHandSession}');
    expect(area).toContain('press and hold, then move to pan; releasing stops');
    expect(area).toContain('cursor-grab');
  });

  it('starts the pan on a primary press and captures the pointer', () => {
    const begin = slice('const beginHandSession = useCallback((event: PointerEvent) => {', '}, [endHandSession]);');
    expect(begin).toContain('if (event.button !== 0) return;');
    expect(begin).toContain('handSessionRef.current = session;');
    expect(begin).toContain('target.setPointerCapture(pointerId);');
    expect(begin).toContain("target.addEventListener('pointermove', session.onMove, { passive: false });");
    expect(begin).toContain("target.addEventListener('pointerup', session.onEnd);");
    expect(begin).toContain("target.addEventListener('pointercancel', session.onEnd);");
    expect(begin).toContain("target.addEventListener('lostpointercapture', session.onEnd);");
  });

  it('divides the pointer delta back into pre-scale pan units', () => {
    const begin = slice('const beginHandSession = useCallback((event: PointerEvent) => {', '}, [endHandSession]);');
    // The canvas transform is `scale(z) translate(px, py)`: one CSS pixel of
    // movement is 1/z pan units.
    expect(begin).toContain('const zoom = canvasStore.zoom.peek() || 1;');
    expect(begin).toContain('canvasStore.setPan(');
    expect(begin).toContain('session.startPanX + (moveEvent.clientX - session.startX) / zoom');
    expect(begin).toContain('session.startPanY + (moveEvent.clientY - session.startY) / zoom');
  });

  it('ends the pan on release, cancel or capture loss and never latches', () => {
    const end = slice('const endHandSession = useCallback((pointerId?: number) => {', '}, []);');
    expect(end).toContain('handSessionRef.current = null;');
    expect(end).toContain('session.target.removeEventListener');
    expect(end).toContain('releasePointerCapture(session.pointerId)');
    expect(end).toContain("session.target.style.cursor = '';");
    // An unmount mid-press cleans the session up.
    expect(area).toContain('useEffect(() => () => {');
    expect(area).toContain('if (session) endHandSession(session.pointerId);');
  });

  it('adds the 1:1 control to the same pill', () => {
    expect(area).toContain('onClick={() => canvasStore.setSmoothZoom(1)}');
    expect(area).toContain('one project pixel per screen pixel');
    expect(area).toContain('1:1');
  });
});

describe('CanvasArea — floating glass pill', () => {
  it('replaces the top controls bar with the floating pill', () => {
    // The old bar (a full-width flex row above the canvas) is gone.
    expect(area).not.toContain('flex items-center justify-center gap-3 w-full pt-4 pb-2 px-5 shrink-0');
    expect(area).toContain('<div class="canvas-zoom-pill" role="group" aria-label="Canvas controls">');
    // The canvas container is the pill's positioning context.
    expect(area).toContain(
      'class="relative flex items-center justify-center flex-1 min-h-0 p-4 pt-0 overflow-hidden"',
    );
  });

  it('carries the same control set as the Studio pill plus the editor extras', () => {
    const pill = slice('<div class="canvas-zoom-pill"', '<div class="absolute right-4 bottom-4 pointer-events-none">');
    for (const control of [
      'canvasStore.zoomOut()',
      'canvasStore.zoomPercent.value',
      'canvasStore.zoomIn()',
      'onPointerDown={beginHandSession}',
      'canvasStore.toggleFitLock()',
      'canvasStore.setSmoothZoom(1)',
      'canvasStore.isAtMinZoom.value',
      'canvasStore.isAtMaxZoom.value',
      'paintStore.togglePaintMode()',
      'enterFullscreen()',
    ]) {
      expect(pill).toContain(control);
    }
    // Divider between the paint toggle and the zoom cluster.
    expect(pill).toContain('canvas-zoom-pill-divider');
  });

  it('floats the full-speed badge instead of keeping a controls row alive', () => {
    // The badge lives at the canvas bottom-right so no bar is needed.
    expect(area).toContain('<div class="absolute right-4 bottom-4 pointer-events-none">\n            <FullSpeedBadge />');
  });
});
