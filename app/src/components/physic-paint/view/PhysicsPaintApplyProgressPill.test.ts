import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 52.1 quick B — background Script Apply surface contract.
 *
 * Two UAT defects, two guards:
 * 1. The canvas kept painting strokes mid-run: the suppression gate only held
 *    the DISPLAY composite while the drain force-dries every stroke into the
 *    DRY canvas (zIndex 2, browser-composited). The engine must stamp a freeze
 *    cover (preview base + dry) into the display canvas (zIndex 3) on suppress.
 * 2. The progress pill never appeared: it rendered INSIDE the workflow strip,
 *    whose overflow-y:hidden clips anything past its top edge. The pill must
 *    live in the canvas region (position:relative, no clip — the canvas-toast
 *    pattern) and keep its own applyProgress subscription.
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
    // The cover is what hides the drain's dry-canvas writes — it must stamp on
    // the suppress branch, before the early return.
    const coverIndex = block.indexOf('drawImage(this.dualCanvas.dryCanvas');
    const returnIndex = block.indexOf('return', coverIndex);
    expect(coverIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(coverIndex);
  });

  it('keeps the release path: one requestRender, no cover work', () => {
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

  it('gates on background mode and owns its applyProgress subscription', () => {
    const pill = getPillComponentBlock(studioViewSource());
    expect(pill).toContain("rotoScript?.applyProgress.value ?? null");
    expect(pill).toContain("applyProgress?.mode !== 'background'");
    expect(pill).toContain('role="progressbar"');
  });

  it('anchors to the canvas region bottom edge, not outside a clipping parent', () => {
    const rule = getApplyProgressRule(cssSource());
    expect(rule).toContain('bottom: 8px');
    expect(rule).not.toContain('calc(100%');
  });
});
