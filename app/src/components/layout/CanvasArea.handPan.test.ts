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
    expect(area).toContain("import {Plus, Minus, Maximize, Maximize2, Minimize2, Paintbrush, Hand} from 'lucide-preact';");
    expect(area).toContain('onPointerDown={beginHandSession}');
    expect(area).toContain('title="Hand \\u2014 press and hold, then move to pan; releasing stops"');
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

  it('adds the 1:1 control to the same row', () => {
    expect(area).toContain('onClick={() => canvasStore.setSmoothZoom(1)}');
    expect(area).toContain('title="Actual size \\u2014 one project pixel per screen pixel"');
    expect(area).toContain('1:1');
  });
});
