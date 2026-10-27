import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261027-klx: the PlayScript renderer is watercolor-only.
 *
 * The engine-1 `renderRotoPlayScriptFrames` surface (stroke schedules, static
 * vs progressive engine renders, color override, merge) is gone, so its tests
 * are gone with it. What must stay pinned:
 *   - the ONE dispatch: a recorded wash timeline bakes through the aquarelle
 *     reveal path, and a script without one is REFUSED (an old Brush envelope
 *     has nothing to bake);
 *   - the coverages the reveal semantics depend on (paper passthrough,
 *     transmittance→alpha, destination-in mask, per-output-frame pose).
 *
 * The runtime half of the dispatch (bake, mask, encode) lives in
 * physicsPaintRotoRevealBake.test.ts; this file keeps the source contract.
 */

const renderer = readFileSync(
  fileURLToPath(new URL('./physicsPaintRotoPlayScriptRenderer.ts', import.meta.url)),
  'utf8',
);

describe('renderRotoRevealFrames dispatch (watercolor-only, 261027-klx)', () => {
  it('dispatches the recorded wash timeline to the aquarelle reveal bake', () => {
    expect(renderer).toContain('const aquarelleEvents = input.script.aquarelleEvents;');
    expect(renderer).toContain('renderRotoRevealFramesAquarelle(input, aquarelleEvents)');
  });

  it('refuses a script with no recorded wash timeline instead of staging an empty reveal', () => {
    // The refusal is the surviving "old Brush script cannot be baked" law.
    expect(renderer).toContain('aquarelleEvents === undefined || aquarelleEvents.length === 0');
    expect(renderer).toContain("throw new Error('Reveal needs a Water color script — this script has no recorded wash timeline.');");
  });

  it('runs the wash through the SAME bake as Play/Apply (paper + growth)', () => {
    expect(renderer).toContain('createAquarelleBake(adapter, {');
    expect(renderer).toContain('...(paper ? { paper: { paperId: paper.paperId, grainStrength: paper.grainStrength, grainScale: paper.grainScale } } : {}),');
    expect(renderer).toContain('frameCount: isStatic ? 1 : input.frameCount');
  });

  it('masks with pigment alpha, never the opaque transmittance raster', () => {
    // MODE.transparent capture is opaque transmittance; the mask needs pigment
    // alpha (1 − min(r,g,b)), or the whole photo is revealed.
    expect(renderer).toContain('const converted = transmittanceToAlpha(washCanvas);');
    expect(renderer).toContain('compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom)');
    expect(renderer).toContain("context.globalCompositeOperation = 'destination-in';");
  });

  it('poses the flattened wash per OUTPUT frame instead of freezing motion per deposit', () => {
    // The cumulative sheet cannot re-warp deposits, so the bake stays unposed
    // and the coverage takes the frame's held pose — a single stroke must move.
    expect(renderer).not.toContain('motion: { ...input.motion, startFrame: input.canonicalStart }');
    expect(renderer).toContain('const posedCoverage = poseRevealCoverage(coverage, destination, input.motion);');
    expect(renderer).toContain('computeAquarelleSheetPose(coverage.width, coverage.height, destinationFrame, motion)');
    expect(renderer).toContain('drawAquarelleSheetPose(coverage, coverage.width, coverage.height, pose)');
  });

  it('keeps no engine-1 renderer surface', () => {
    // G1/G2 census surface: a leftover engine-1 export or import would be a
    // second paint path hidden behind dead code.
    expect(renderer).not.toContain('renderRotoPlayScriptFrames');
    expect(renderer).not.toContain('renderProgressiveAlphaFrame');
    // The merge module is named once in a comment (it is what the mask
    // REPLACED); what must be gone is the import and the call it supplied.
    expect(renderer).not.toContain("from './physicsPaintRotoAlphaMerge'");
    expect(renderer).not.toContain('mergeRotoAlphaCanvases(');
    expect(renderer).not.toContain('flattenScriptStrokes');
    // Composed from fragments: the Wave 6 census gates forbid the contiguous
    // retired specifier in app/src; the runtime scan term is unchanged.
    expect(renderer).not.toContain('@efxlab/' + 'efx-physic-' + 'paint');
    expect(renderer).not.toContain('RotoPlayScriptRenderInput');
    expect(renderer).not.toContain('overrideColor');
  });
});
