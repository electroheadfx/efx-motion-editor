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
 * 3. It IS the latch: visible exactly while `pathEditRebakeActive` is true. No
 *    local timer and no effect gate, because the bake blocks the main thread and
 *    a timer cannot run inside it — that is what left the wheel frozen and the
 *    veil on screen until the next pointer move.
 * 4. The commit paints both boundaries: one host frame after the latch opens
 *    (before the replay) and one after it closes (so the removal reaches the
 *    screen before the caller's tail).
 * 5. A path edit has ONE indicator: the veil carries the counter the apply pill
 *    would show, and the pill stands down while it is up.
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

function getPillComponentBlock(code: string): string {
  return regionOf(code, 'function PhysicsPaintApplyProgressPill', 'function PathEditRebakeVeil');
}

describe('261112-i6d path-edit re-bake veil', () => {
  it('renders inside the canvas region, after the apply pill, with the counter source', () => {
    const region = getCanvasRegionBlock(studioViewSource());
    const pillAt = region.indexOf('<PhysicsPaintApplyProgressPill');
    const veilAt = region.indexOf('<PathEditRebakeVeil');
    expect(pillAt).toBeGreaterThan(-1);
    expect(veilAt).toBeGreaterThan(pillAt);
    expect(region).toContain('<PathEditRebakeVeil rotoScript={workflow.rotoScript} />');
  });

  it('is the latch itself — no local timer, no effect gate', () => {
    const veil = getVeilComponentBlock(studioViewSource());
    expect(veil).toContain('if (!pathEditRebakeActive.value) return null;');
    // A blocked webview cannot run a timer, so the veil must not own one: both
    // of its edges belong to the commit's latch.
    expect(veil).not.toContain('useEffect(');
    expect(veil).not.toContain('useRef(');
    expect(veil).not.toContain('setTimeout');
    expect(veil).not.toContain('PATH_EDIT_VEIL_');
    // The stroke counter is the pill's own signal, never a second feed.
    expect(veil).toContain('const progress = rotoScript?.applyProgress.value ?? null;');
  });

  it('stands the apply pill down while the veil is up — one indicator per path edit', () => {
    const pill = getPillComponentBlock(studioViewSource());
    expect(pill).toContain('const rebaking = pathEditRebakeActive.value;');
    expect(pill).toContain('if (!applyProgress || rebaking) return null;');
    // The pill still owns its own applyProgress subscription for Script applies.
    expect(pill).toContain('const applyProgress = rotoScript?.applyProgress.value ?? null;');
  });

  it('paints one host frame on BOTH sides of the latch', () => {
    const seam = readFileSync(
      resolve(here, 'aquarelleVectorPathCommit.ts'),
      'utf8',
    );
    const rebake = regionOf(seam, 'export async function runAquarelleScriptRebake', '\n}');
    const entryAt = rebake.indexOf('await yieldForPaint();');
    const exitAt = rebake.indexOf('await yieldForPaint();', entryAt + 1);
    const resetAt = rebake.indexOf('sequence.resetSheet();');
    const endAt = rebake.indexOf('sequence.endInFlight();');
    const successAt = rebake.indexOf('sequence.onSuccess?.();');
    expect(entryAt).toBeGreaterThan(-1);
    // Entry: the veil must be on screen before the replay blocks.
    expect(entryAt).toBeLessThan(resetAt);
    // Exit: the removal must get frames before the caller's tail runs.
    expect(exitAt).toBeGreaterThan(endAt);
    expect(exitAt).toBeLessThan(successAt);
    expect(rebake.split('await yieldForPaint();').length - 1).toBe(2);
    // One host turn flushes the signal write into the DOM, then a bounded
    // two-frame wait lets that frame paint.
    expect(seam).toContain('new MessageChannel()');
    expect(seam).toContain('requestAnimationFrame(() => requestAnimationFrame(finish))');
    // BOUNDED: a hidden window (where rAF never fires) costs a timer, not a hang.
    expect(seam).toContain('const PAINT_YIELD_TIMEOUT_MS = 64;');
    expect(seam).toContain('setTimeout(finish, PAINT_YIELD_TIMEOUT_MS)');
  });

  it('announces itself once, politely, and never as an error', () => {
    const veil = getVeilComponentBlock(studioViewSource());
    expect(veil).toContain('role="status"');
    expect(veil).toContain('aria-live="polite"');
    expect(veil).toContain('aria-busy="true"');
    expect(veil).not.toContain('role="alert"');
    expect(veil).toContain('Rendering…');
    // The per-stroke counter updates every fed stroke — visual only, never a
    // live-region announcement per stroke.
    expect(veil).toContain('class="physics-paint-rebake-count" aria-hidden="true"');
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
    // The bake blocks the main thread — the wheel only keeps turning if its
    // layer is promoted before the animation starts.
    expect(regionOf(css, '.physics-paint-rebake-spinner {', '}')).toContain('will-change: transform');
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

  it('publishes no second copy of the wait in the workflow strip', () => {
    // 261112-i6d: the veil is the one story. A strip line saying the same
    // thing reads as a second, unrelated operation.
    const source = studioSource();
    expect(source).not.toContain('VECTOR_PATH_REBUILDING_MESSAGE');
    // The busy status stays: it is the gate every key action reads.
    const commit = regionOf(
      source,
      'const commitAquarelleVectorPathEdit = useCallback(',
      'const handleAquarelleVectorPathEdit = useCallback(',
    );
    expect(commit).toContain("setApplyStatus('applying');");
    const success = regionOf(commit, 'onSuccess: () => {', 'onFailure: () => {');
    expect(success).toContain("setApplyStatus('idle');");
  });

  it('keeps the shared script-edit latch free of the veil (Script applies have their own pill)', () => {
    const source = studioSource();
    const otherRebakes = source.split('setAquarelleScriptEditInFlight(true)').length - 1;
    expect(otherRebakes).toBeGreaterThan(1);
    // The veil call lives only in the path-edit commit.
    expect(source.split('setPathEditRebakeActive(').length - 1).toBe(2);
  });
});
