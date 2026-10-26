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
const mount = readFileSync(resolve(__dirname, './PhysicsPaintCanvasMount.tsx'), 'utf8');
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

  it('CACHE: aquarelle capture OVERPAINTS the cached paint (opaque-sheet law)', () => {
    // Product law 2026-10-26: a Paint track is one OPAQUE sheet. Watercolor
    // painted over a cached paint on the SAME track overpaints it — it never
    // glazes/multiplies with it. The session base is still pinned (the capture
    // must know what it replaces), but the merge is source-over: the live
    // transmittance sheet covers the cache exactly as the editor's active-track
    // overlay replaces the store raster.
    expect(studio).not.toContain('cachedBase: null');
    expect(studio).toContain('aquarelleMergeBaseRef');
    expect(studio).toContain("mergeBlend: 'source-over'");
    expect(studio).not.toContain("mergeBlend: 'multiply'");
    // Same seam engine-1 uses — no second cache system.
    expect(studio).toContain('captureLivePixels');
  });

  it('NAV FLUSH: navigation forces an aquarelle frame-leave capture BEFORE flushing live pixels', () => {
    // The aquarelle rAF poll queues its frame-leave capture AFTER
    // scheduleRotoStartFramePropagation, which is AFTER navigateToSyncedPhysicalFrame
    // has already drained flushLivePixels. Without a forced pre-flush capture the
    // late capture sits in CAPTURE_PRODUCE_QUIET_MS (6s) and the return-to-key
    // display reads the pre-capture cache — the intermittent empty-frame-on-return.
    // The layer must expose a synchronous flush-capture registration …
    expect(layer).toContain('onFlushCaptureReady');
    expect(layer).toContain('flushCapture');
    // … and the Studio navigation must invoke it before flushLivePixels.
    const navBody = studio.slice(studio.indexOf('const navigateToSyncedPhysicalFrame'));
    const preCaptureIdx = navBody.indexOf('aquarelleFlushCapture');
    const flushIdx = navBody.indexOf('flushLivePixels(currentFrame)');
    expect(preCaptureIdx).toBeGreaterThan(-1);
    expect(flushIdx).toBeGreaterThan(-1);
    expect(preCaptureIdx).toBeLessThan(flushIdx);
    // The seam unregisters on unmount: the save/close flush must never call a
    // closure holding a destroyed engine.
    expect(layer).toContain('onFlushCaptureReadyRef.current?.(null)');
  });

  it('SAVE: the live sheet snapshot is registered after engine setup and unregistered on cleanup', () => {
    // 261026-nvq: the Save Script thumbnail must read the SAME composited sheet
    // the cache capture resolves — not a second readback. The seam registers
    // the existing `snapshot` closure through the mount lifecycle and clears it
    // before engine.destroy() so a stale closure can never be invoked.
    expect(layer).toContain('onSnapshotReady');
    expect(layer).toContain('onSnapshotReadyRef.current?.(snapshot)');
    expect(layer).toContain('onSnapshotReadyRef.current?.(null)');
    // Registration must land AFTER the engine is configured (compositor layer,
    // live config, paper) — a pre-configuration snapshot would export the wrong
    // mode.
    expect(layer.indexOf('engine.setCompositorLayer(true)'))
      .toBeLessThan(layer.indexOf('onSnapshotReadyRef.current?.(snapshot)'));
    // The unregister rides the same cleanup as the flush-capture seam.
    expect(layer.indexOf('onSnapshotReadyRef.current?.(null)'))
      .toBeLessThan(layer.indexOf('engine.destroy()'));
    // The mount forwards the seam through a ref like every other aquarelle
    // callback — no effect, no state, no memo.
    expect(mount).toContain('onAquarelleSnapshotReady');
  });

  it('no double composite: the live aquarelle layer replaces the active track in the monitor', () => {
    expect(studio).toContain("activeModule.value === 'watercolor'\n          || engineSurfaceHidden");
  });

  it('F1/F2: transmittance encoding — opaque multiply-ready, no alpha to misread', () => {
    expect(shaders).toContain('o = vec4(t, 1.0)');
    expect(engine).toContain('premultipliedAlpha: true');
  });

  it('F2a (OPAQUE SHEETS): the tracks group is the ONE paper multiply in every module', () => {
    // Product law 2026-10-26: each Paint track is its own sheet over the
    // document paper. Tracks composite source-over among THEMSELVES, then the
    // flattened stack multiplies ONCE over the fond. The old per-layer multiply
    // (live canvas + cached base + monitor) glazed the tracks beneath instead
    // of masking them — the Studio/editor divergence.
    const groupRule = css.slice(css.indexOf('.physics-paint-tracks-group {'));
    expect(groupRule.slice(0, groupRule.indexOf('}'))).toContain('mix-blend-mode: multiply');
    // No per-layer aquarelle multiply: the sheet is opaque, so source-over is
    // what masks the tracks below (and overpaints a same-track cache).
    const liveRule = css.slice(css.indexOf('.demo-canvas-shell .aquarelle-live-canvas'));
    expect(liveRule.slice(0, liveRule.indexOf('}'))).not.toContain('mix-blend-mode');
    const cachedRule = css.slice(css.indexOf('.demo-canvas-shell .aquarelle-cached-base'));
    expect(cachedRule.slice(0, cachedRule.indexOf('}'))).not.toContain('mix-blend-mode');
    // The monitor is plain content inside the group — it must not multiply on
    // its own or the watercolor above would glaze the lower tracks twice.
    const monitorRule = css.slice(css.indexOf('\n.physics-paint-program-monitor {'));
    expect(monitorRule.slice(0, monitorRule.indexOf('}'))).toContain('mix-blend-mode: normal');
    // The isolation lift existed only to let the per-layer multiply reach the
    // fond; with one group multiply it is dead code.
    expect(css).not.toContain('.physics-paint-tracks-group.aquarelle-compositing');
    expect(css).not.toContain(':has(.aquarelle-live-canvas)');
    expect(layer).toContain('engine.setCompositorLayer(true)');
  });

  it('EMPTY SHEET: the opaque live sheet never washes out the cache it sits over', () => {
    // MODE.transparent is OPAQUE white where no pigment. Under the opaque-sheet
    // law (source-over, not multiply) a blank live sheet would cover the cached
    // base and read as bare paper. It must render transparent until the engine
    // holds paint — opacity (not visibility) so the canvas keeps the pointer.
    expect(layer).toContain('aquarelleLivePaint');
    expect(layer).toMatch(/opacity: aquarelleLivePaint\.value \? 1 : 0/);
    expect(layer).toContain('engine.hasPaint');
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
