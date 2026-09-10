import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 52.1 quick B — background Script Apply surface contract.
 *
 * Three UAT defects, three guards:
 * 1. The canvas kept painting strokes mid-run: the suppression gate only held
 *    the DISPLAY composite while the drain force-dries every stroke into the
 *    DRY canvas (browser-composited). Stamping a freeze cover (preview base +
 *    dry) into the display canvas was NOT enough — the stamp keeps alpha, so
 *    unpainted regions stayed transparent and the live dry writes showed
 *    through (background ran "like a live render"). The engine must ALSO hide
 *    the dry canvas from the browser compositor while suppressed.
 * 2. The progress pill never appeared: it rendered INSIDE the workflow strip,
 *    whose overflow-y:hidden clips anything past its top edge. The pill must
 *    live in the canvas region (position:relative, no clip — the canvas-toast
 *    pattern) and keep its own applyProgress subscription.
 * 3. The pill must render in BOTH modes — live apply pairs progressive paint
 *    with the same progress (user-requested).
 */

const here = dirname(fileURLToPath(import.meta.url));
const studioViewSource = () => readFileSync(resolve(here, 'PhysicsPaintStudioView.tsx'), 'utf8');
const stripSource = () => readFileSync(resolve(here, 'PhysicsPaintWorkflowStrip.tsx'), 'utf8');
const cssSource = () => readFileSync(resolve(here, '../physicsPaintStudio.css'), 'utf8');
const engineSource = () => readFileSync(resolve(here, '../../../../../packages/efx-physic-paint/src/engine/EfxPaintEngine.ts'), 'utf8');

function getCanvasRegionBlock(code: string): string {
  const start = code.indexOf('physics-paint-canvas-region');
  const end = code.indexOf('</section>', start);
  return code.slice(start, end);
}

function getPillComponentBlock(code: string): string {
  const start = code.indexOf('function PhysicsPaintApplyProgressPill');
  return code.slice(start);
}

function getSuppressionMethodBlock(code: string): string {
  const start = code.indexOf('setDisplayCompositeSuppressed(suppressed: boolean): void {');
  const end = code.indexOf('renderPartialStrokes', start);
  return code.slice(start, end);
}

function getApplyProgressRule(css: string): string {
  const start = css.indexOf('.physics-paint-apply-progress {');
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('background apply freeze cover (engine)', () => {
  it('stamps the visible stack (preview base + dry) into the display canvas on suppress', () => {
    const block = getSuppressionMethodBlock(engineSource());
    expect(block).toContain('displayCtx.clearRect(0, 0, this.width, this.height)');
    expect(block).toContain('displayCtx.drawImage(this.dualCanvas.previewBaseCanvas, 0, 0)');
    expect(block).toContain('displayCtx.drawImage(this.dualCanvas.dryCanvas, 0, 0)');
    // The cover is what carries pre-existing paint while the dry canvas is
    // hidden — it must stamp on the suppress branch, before the early return.
    const coverIndex = block.indexOf('drawImage(this.dualCanvas.dryCanvas');
    const returnIndex = block.indexOf('return', coverIndex);
    expect(coverIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(coverIndex);
  });

  it('hides the dry canvas from the browser compositor while suppressed', () => {
    const block = getSuppressionMethodBlock(engineSource());
    // The cover stamp preserves alpha — transparent wherever the pre-apply
    // frame is unpainted — so live dry writes would show through. The freeze
    // only holds if the dry canvas leaves the compositor entirely
    // (visibility, not display: the relative-positioned dry canvas owns the
    // stack's layout box).
    expect(block).toContain("this.dualCanvas.dryCanvas.style.visibility = 'hidden'");
    expect(block).toContain("this.dualCanvas.dryCanvas.style.visibility = ''");
    const hideIndex = block.indexOf("style.visibility = 'hidden'");
    const returnIndex = block.indexOf('return', block.indexOf('drawImage(this.dualCanvas.dryCanvas'));
    expect(hideIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(hideIndex);
  });

  it('keeps the release path: restore the dry canvas, one requestRender', () => {
    const block = getSuppressionMethodBlock(engineSource());
    expect(block).toContain('this.requestRender()');
  });
});

describe('apply progress pill placement', () => {
  it('renders inside the canvas region (the non-clipping surface)', () => {
    const region = getCanvasRegionBlock(studioViewSource());
    expect(region).toContain('<PhysicsPaintApplyProgressPill rotoScript={workflow.rotoScript} />');
  });

  it('no longer renders inside the overflow-clipped workflow strip', () => {
    expect(stripSource()).not.toContain('physics-paint-apply-progress');
    expect(stripSource()).not.toContain('scriptApplyProgress');
  });

  it('renders for any active apply and owns its applyProgress subscription', () => {
    const pill = getPillComponentBlock(studioViewSource());
    expect(pill).toContain("rotoScript?.applyProgress.value ?? null");
    expect(pill).toContain('if (!applyProgress) return null');
    expect(pill).not.toContain("mode !== 'background'");
    expect(pill).toContain('role="progressbar"');
  });

  it('anchors to the canvas region bottom edge, not outside a clipping parent', () => {
    const rule = getApplyProgressRule(cssSource());
    expect(rule).toContain('bottom: 8px');
    expect(rule).not.toContain('calc(100%');
  });
});
