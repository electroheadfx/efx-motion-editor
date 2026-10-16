// ============================================================
//  aquarelleLayerContract — the live aquarelle surface is a
//  transparent, coordinate-aligned, correctly-stacked pigment
//  layer (56-12). Never an opaque island.
//
//  1. TRANSPARENT  — compositor display mode, never the vendor's
//     own paper/desk composite (v1.0 compositor law).
//  2. ALIGNED      — exact-fit view (no fit margin), so pointer
//     UV is the plain rect fraction like engine-1.
//  3. STACKED      — above the program-monitor cache (z 0),
//     below the onion/overlay family (z 5).
//  4. CACHE        — the snapshot is resolved BEFORE engine.clear().
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layer = readFileSync(resolve(__dirname, './AquarelleCanvasLayer.tsx'), 'utf8');
const engine = readFileSync(
  resolve(__dirname, '../../../../../packages/efx-watercolor/src/playground/Engine.ts'),
  'utf8',
);
const shaders = readFileSync(
  resolve(__dirname, '../../../../../packages/efx-watercolor/src/playground/shaders.ts'),
  'utf8',
);
const css = readFileSync(resolve(__dirname, '../physicsPaintStudio.css'), 'utf8');
const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');

describe('aquarelle layer is a compositor pigment layer (56-12)', () => {
  it('TRANSPARENT: display composites pigment on transparent, never the vendor paper', () => {
    expect(layer).toContain('engine.setCompositorLayer(true)');
    expect(engine).toContain('this.compositorLayer ? MODE.transparent : MODE.screen');
    // WebGL canvas must keep alpha, or transparent output is composited opaque.
    expect(engine).toContain('alpha: true');
    // Outside the sheet is empty in compositor mode — never the desk colour.
    expect(shaders).toContain('o = uMode == 2 ? vec4(0.0)');
  });

  it('ALIGNED: exact-fit view — pointer UV is the plain rect fraction, no fit margin', () => {
    expect(engine).toContain('this.fitPadding = on ? 0 : FIT_PADDING');
    expect(engine).toContain('const pad = 2 * this.fitPadding * this.dpr');
    // The live surface maps through the engine's getBoundingClientRect + dpr + view.
    expect(engine).toContain('private toUv(');
    expect(engine).toContain('this.canvas.getBoundingClientRect()');
  });

  it('STACKED: above the cached composite, below the overlay family', () => {
    expect(css).toContain('.demo-canvas-shell .aquarelle-live-canvas');
    const rule = css.slice(css.indexOf('.demo-canvas-shell .aquarelle-live-canvas'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('z-index: 4');
    // Program monitor (the cache) stays at 0 — aquarelle paints over it.
    // Anchor on the bare rule so the aquarelle-compositing override is skipped.
    const monitor = css.slice(css.indexOf('\n.physics-paint-program-monitor {'));
    expect(monitor.slice(0, monitor.indexOf('}'))).toContain('z-index: 0');
  });

  it('CACHE: the sheet is read before engine.clear() wipes it', () => {
    // Resolved eagerly in the Studio handler — a deferred factory would read
    // the cleared sheet and commit empty (the navigation cache-loss bug).
    expect(studio).toContain('const liveAlphaCanvas = snapshot()');
    expect(layer.indexOf('onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot)'))
      .toBeLessThan(layer.indexOf('engine.clear()'));
  });

  it('CACHE: the settled (dry) look is captured, never the wet stroke-end', () => {
    expect(engine).toContain('get isAwake(): boolean');
    expect(layer).toContain('const awake = engine.isAwake');
    expect(layer).toContain('if (wasAwake && !awake && engine.hasPaint)');
  });

  it('CACHE: a blank sheet never overwrites existing cache', () => {
    expect(engine).toContain('get hasPaint(): boolean');
    expect(layer).toContain('engine.hasPaint');
    // After a frame-change clear the new frame starts clean.
    expect(layer).toContain('wasAwake = false');
  });

  it('no double composite: the live aquarelle layer replaces the active track in the monitor', () => {
    expect(studio).toContain("activeModule.value === 'watercolor'\n          || engineSurfaceHidden");
  });

  it('F1/F2: transmittance encoding — opaque multiply-ready, no alpha to misread', () => {
    expect(shaders).toContain('o = vec4(t, 1.0)');
    expect(engine).toContain('premultipliedAlpha: true');
  });

  it('F2a: aquarelle multiplies over the fond (paper-agnostic transmittance seam)', () => {
    expect(css).toContain('mix-blend-mode: multiply');
    // Isolation would trap the multiply on transparent black — it lifts.
    expect(css).toContain('.physics-paint-tracks-group.aquarelle-compositing');
    expect(layer).toContain('engine.setCompositorLayer(true)');
  });

  it('F3: Studio paper drives the engine deposit grain (R2.3)', () => {
    expect(layer).toContain('engine.setPaper(');
    expect(layer).toContain('paperPresetForStudioId');
    expect(studio).toContain('getAquarellePaperId');
  });

  it('CURSOR: brush-size preview ring — HTML pointer hidden, ring follows aquarelleParams.size', () => {
    // The HTML pointer is replaced by the dual-ring cursor (UI checklist row 1).
    expect(css).toContain('cursor: none');
    expect(layer).toContain('AquarelleBrushCursor');
    expect(layer).toContain('aquarelleParams.value.size');
    // Dual-ring family: dark under-stroke + white over-stroke.
    expect(layer).toContain('stroke="#111111"');
    expect(layer).toContain('stroke="#ffffff"');
  });
});
