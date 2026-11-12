import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261112-i6d — the path-edit re-bake veil.
 *
 * A path edit replays the WHOLE script, so the engine locks its input for the
 * duration. That lock is real and was invisible: the canvas simply stopped
 * answering, and a second Alt+click / Corner press was refused silently. The
 * veil states the wait.
 *
 * The contract this pins:
 * 1. It renders inside the canvas region, above the canvas stack and the apply
 *    pill but BELOW the floating sheets, so the control the user just pressed
 *    stays readable.
 * 2. It BLOCKS (no `pointer-events: none`) — the state it explains is a lock.
 * 3. It is delayed and held: a fast bake must not flash, a slow one must not
 *    strobe on exit.
 * 4. Its signal is opened by the re-bake's OWN latch, never around the call, so
 *    a refused (already in flight) rebake opens nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const studioViewSource = () => readFileSync(resolve(here, 'PhysicsPaintStudioView.tsx'), 'utf8');
const studioSource = () => readFileSync(resolve(here, '../PhysicsPaintStudio.tsx'), 'utf8');
const cssSource = () => readFileSync(resolve(here, '../physicsPaintStudio.css'), 'utf8');

function regionOf(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

function getCanvasRegionBlock(code: string): string {
  const start = code.indexOf('physics-paint-canvas-region');
  const end = code.indexOf('</section>', start);
  return code.slice(start, end);
}

function getVeilComponentBlock(code: string): string {
  const start = code.indexOf('function PathEditRebakeVeil');
  return code.slice(start);
}

describe('261112-i6d path-edit re-bake veil', () => {
  it('renders inside the canvas region, after the apply pill', () => {
    const region = getCanvasRegionBlock(studioViewSource());
    const pillAt = region.indexOf('<PhysicsPaintApplyProgressPill');
    const veilAt = region.indexOf('<PathEditRebakeVeil />');
    expect(pillAt).toBeGreaterThan(-1);
    expect(veilAt).toBeGreaterThan(pillAt);
  });

  it('is driven by the path-edit signal and refuses to mount before it is shown', () => {
    const veil = getVeilComponentBlock(studioViewSource());
    expect(veil).toContain('const active = pathEditRebakeActive.value;');
    // A component-local signal: the animation never re-renders the Studio.
    expect(veil).toContain('useRef(signal(false)).current');
    expect(veil).toContain('if (!shown.value) return null;');
  });

  it('delays the appearance and holds it for a minimum', () => {
    const source = studioViewSource();
    expect(source).toContain('const PATH_EDIT_VEIL_DELAY_MS = 150;');
    expect(source).toContain('const PATH_EDIT_VEIL_MIN_MS = 350;');
    const veil = getVeilComponentBlock(source);
    const delayAt = veil.indexOf('PATH_EDIT_VEIL_DELAY_MS');
    const minAt = veil.indexOf('PATH_EDIT_VEIL_MIN_MS');
    expect(delayAt).toBeGreaterThan(-1);
    expect(minAt).toBeGreaterThan(-1);
    // Remaining time is floored at 0 so a slow bake never schedules a negative
    // delay, and every timer is cleared.
    expect(veil).toContain('Math.max(');
    expect(veil).toContain('window.clearTimeout(timer)');
  });

  it('announces itself once, politely, and never as an error', () => {
    const veil = getVeilComponentBlock(studioViewSource());
    expect(veil).toContain('role="status"');
    expect(veil).toContain('aria-live="polite"');
    expect(veil).toContain('aria-busy="true"');
    expect(veil).not.toContain('role="alert"');
    expect(veil).toContain('Rendering…');
  });

  it('blocks the canvas and sits above the pill but below the floating sheets', () => {
    const css = cssSource();
    const rule = regionOf(css, '.physics-paint-rebake-veil {', '}');
    expect(rule).toContain('position: absolute');
    expect(rule).toContain('inset: 0');
    expect(rule).toContain('z-index: 65');
    // The pill is 60 and the floating sheets are 70+; the veil must sit between.
    expect(rule).not.toContain('pointer-events: none');
    expect(regionOf(css, '.physics-paint-apply-progress {', '}')).toContain('z-index: 60');
  });

  it('opens and closes on the re-bake latch, never around the call', () => {
    const commit = regionOf(
      studioSource(),
      'const commitAquarelleVectorPathEdit = useCallback(',
      'const handleAquarelleVectorPathEdit = useCallback(',
    );
    const begin = regionOf(commit, 'beginInFlight: () => {', '},');
    const end = regionOf(commit, 'endInFlight: () => {', '},');
    expect(begin).toContain('vectorPathSession.setPathEditRebakeActive(true);');
    expect(end).toContain('vectorPathSession.setPathEditRebakeActive(false);');
    // Both ride the latch callbacks: a refused rebake runs neither.
    const beginAt = commit.indexOf('beginInFlight: () => {');
    const rebakeAt = commit.indexOf('runAquarelleScriptRebake({');
    expect(rebakeAt).toBeGreaterThan(-1);
    expect(beginAt).toBeGreaterThan(rebakeAt);
    // Exactly one open and one close in the whole commit.
    expect(commit.split('setPathEditRebakeActive(true)').length - 1).toBe(1);
    expect(commit.split('setPathEditRebakeActive(false)').length - 1).toBe(1);
  });

  it('keeps the shared script-edit latch free of the veil (Script applies have their own pill)', () => {
    const source = studioSource();
    const otherRebakes = source.split('setAquarelleScriptEditInFlight(true)').length - 1;
    expect(otherRebakes).toBeGreaterThan(1);
    // The veil call lives only in the path-edit commit.
    expect(source.split('setPathEditRebakeActive(').length - 1).toBe(2);
  });
});
