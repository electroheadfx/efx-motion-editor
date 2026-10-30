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
    expect(renderer).toContain('compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom, colorizeMix)');
    expect(renderer).toContain("context.globalCompositeOperation = 'destination-in';");
  });

  it('261029-vbp: tints a scratch copy and transfers it with source-atop BEFORE the destination-in mask', () => {
    // The tint must never land on the output directly: outside the placed photo
    // a 'color' draw deposits alpha, and the final mask would square it instead
    // of leaving 0. The scratch + 'source-atop' transfer is alpha-preserving.
    expect(renderer).toContain('const colorizeMix = resolveRevealColorizeMix(input);');
    expect(renderer).toContain("context.globalCompositeOperation = 'color';");
    expect(renderer).toContain("context.globalCompositeOperation = 'source-atop';");
    expect(renderer).toContain('colorizeMix / 100');
    // The mask remains the LAST op at full alpha — the transfer can never
    // grow the reveal silhouette.
    const transferAt = renderer.indexOf("context.globalCompositeOperation = 'source-atop';");
    const maskAt = renderer.lastIndexOf("context.globalCompositeOperation = 'destination-in';");
    expect(transferAt).toBeGreaterThan(-1);
    expect(maskAt).toBeGreaterThan(transferAt);
    expect(renderer).toContain('const tint = buildRevealTint(referenceImage, coverageAlpha, size, transform, zoom, colorizeMix);');
    expect(renderer).not.toContain('overrideColor');
  });

  it('poses the flattened wash per OUTPUT frame instead of freezing motion per deposit', () => {
    // The cumulative sheet cannot re-warp deposits, so the bake stays unposed
    // and the coverage takes the frame's held pose — a single stroke must move.
    expect(renderer).not.toContain('motion: { ...input.motion, startFrame: input.canonicalStart }');
    // 261030-ey9: the off path still calls poseRevealCoverage for every frame.
    expect(renderer).toContain('poseRevealCoverage(coverage, destination, input.motion)');
    expect(renderer).toContain('computeAquarelleSheetPose(coverage.width, coverage.height, destinationFrame, motion)');
    expect(renderer).toContain('drawAquarelleSheetPose(coverage, coverage.width, coverage.height, pose)');
  });

  it('261030-ey9: the Photo wiggle poses the finished composite ONCE, gated on the flag', () => {
    // Two mutually exclusive branches: OFF poses the coverage, ON masks the raw
    // coverage and poses the finished composite — never both in one frame.
    expect(renderer).toContain('const posedCoverage = input.photoWiggle === true');
    expect(renderer).toContain('function poseRevealedResult(');
    expect(renderer).toContain('poseRevealedResult(masked, destination, input.motion, input.reference.transform, input.reference.zoom)');
    // The pivot is the placed photo's own centre (the drawPlacedReference
    // centre), never the canvas centre.
    expect(renderer).toContain('masked.width / 2 + transform.x * zoom');
    expect(renderer).toContain('masked.height / 2 + transform.y * zoom');
    // All-zero motion returns the composite unchanged — no identity pose.
    expect(renderer).toContain('if (!pose) return masked;');
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
