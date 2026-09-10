import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 52.1 — Script Apply progress pill surface contract.
 *
 * Two UAT defects, two guards:
 * 1. The progress pill never appeared: it rendered INSIDE the workflow strip,
 *    whose overflow-y:hidden clips anything past its top edge. The pill must
 *    live in the canvas region (position:relative, no clip — the canvas-toast
 *    pattern) and keep its own applyProgress subscription.
 * 2. The pill must render for ANY active apply (user-requested: live apply
 *    pairs progressive paint with the same progress) — no mode gate.
 */

const here = dirname(fileURLToPath(import.meta.url));
const studioViewSource = () => readFileSync(resolve(here, 'PhysicsPaintStudioView.tsx'), 'utf8');
const stripSource = () => readFileSync(resolve(here, 'PhysicsPaintWorkflowStrip.tsx'), 'utf8');
const cssSource = () => readFileSync(resolve(here, '../physicsPaintStudio.css'), 'utf8');

function getCanvasRegionBlock(code: string): string {
  const start = code.indexOf('physics-paint-canvas-region');
  const end = code.indexOf('</section>', start);
  return code.slice(start, end);
}

function getPillComponentBlock(code: string): string {
  const start = code.indexOf('function PhysicsPaintApplyProgressPill');
  return code.slice(start);
}

function getApplyProgressRule(css: string): string {
  const start = css.indexOf('.physics-paint-apply-progress {');
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

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
    expect(pill).toContain('role="progressbar"');
  });

  it('anchors to the canvas region bottom edge, not outside a clipping parent', () => {
    const rule = getApplyProgressRule(cssSource());
    expect(rule).toContain('bottom: 8px');
    expect(rule).not.toContain('calc(100%');
  });
});
