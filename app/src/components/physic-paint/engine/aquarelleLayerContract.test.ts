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
    // 2026-10-26 round 2: the live surface is PIGMENT alpha, not the opaque
    // transmittance export (that mode stays for capture/storage).
    expect(engine).toContain('this.compositorLayer ? MODE.pigment : MODE.screen');
    // WebGL canvas must keep alpha, or transparent output is composited opaque.
    expect(engine).toContain('alpha: true');
    // Outside the sheet is empty in every compositor mode — never the desk colour.
    expect(shaders).toContain('o = (uMode == 2 || uMode == 4) ? vec4(0.0)');
  });

  it('LIVE ALPHA: the compositor display emits premultiplied pigment alpha', () => {
    // alpha = 1 − min(r,g,b), colour = (t − min)/alpha, written PREMULTIPLIED
    // (F1 contract: the WebGL context is premultipliedAlpha). Light washes
    // stay translucent; dense pigment masks — the user-reported lost
    // semi-transparency.
    expect(engine).toContain('pigment: 4');
    expect(shaders).toContain('float mn = min(min(t.r, t.g), t.b)');
    expect(shaders).toContain('float alpha = 1.0 - mn');
    expect(shaders).toContain('o = vec4(pigment * alpha, alpha)');
  });

  it('CACHED BASE: the committed sheet converts to pigment alpha at DISPLAY only', () => {
    // Storage keeps the opaque transmittance bytes (option B); the cached-base
    // element renders the same pigment law as the live surface.
    expect(mount).toContain('AquarelleCachedBaseLayer');
    const cachedBase = readFileSync(resolve(__dirname, './AquarelleCachedBaseLayer.tsx'), 'utf8');
    expect(cachedBase).toContain('transmittanceSourceToPigmentAlpha');
    expect(cachedBase).toContain('aquarelle-cached-base');
    // The storage seam stays the raw opaque export.
    expect(engine).toContain("exportCanvas(background: ExportBackground = 'transparent'");
  });

  it('ALIGNED: exact-fit view — pointer UV is the plain rect fraction, no fit margin', () => {
    expect(engine).toContain('this.fitPadding = on ? 0 : FIT_PADDING');
    expect(engine).toContain('const pad = 2 * this.fitPadding * this.dpr');
    // The live surface maps through the engine's getBoundingClientRect + dpr + view.
    expect(engine).toContain('private toUv(');
    expect(engine).toContain('this.canvas.getBoundingClientRect()');
  });

  it('REFIT: a live rect or DPR change re-fits the captured pointer geometry', () => {
    // 261027 UAT round 4 (Bug 3): `fitCanvas` captures dpr + canvasSize + view
    // at construction and `toUv` maps the LIVE rect through those captured
    // values. A CSS box change (Studio window/panel resize) or a DPR change
    // (window moved across displays) with no canvas remount left the mapping
    // stale — paint landed ~200 px away from the pen until Studio reopened.
    // The layer must observe both drifts and call the engine's public resize().
    expect(layer).toContain('new ResizeObserver(');
    expect(layer).toContain('resizeObserver.observe(canvas)');
    expect(layer).toContain('engine.resize()');
    expect(layer).toContain('window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)');
    expect(layer).toContain('resizeObserver.disconnect()');
    // resize() must route through fitCanvas, which re-captures ALL THREE
    // mapped inputs from the live canvas before updateView derives the view.
    const resizeBody = engine.slice(engine.indexOf('resize() {'), engine.indexOf('destroy() {'));
    expect(resizeBody).toContain('this.fitCanvas()');
    const fitCanvasBody = engine.slice(
      engine.indexOf('private fitCanvas() {'),
      engine.indexOf('/** The zoom that shows the whole sheet'),
    );
    expect(fitCanvasBody).toContain('window.devicePixelRatio');
    expect(fitCanvasBody).toContain('this.canvas.getBoundingClientRect()');
    expect(fitCanvasBody).toContain('this.updateView()');
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
    expect(layer.indexOf('onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot, captureTrackId)'))
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

  it('CACHE: aquarelle capture composes cached base + live sheet under the pigment law', () => {
    // 2026-10-26 round 2: a Paint track is one PIGMENT sheet. The live
    // transmittance sheet converts to straight-alpha pigment and composites
    // over the cached base (white paper base beneath), so the stored sheet is
    // t' = a*C + (1-a)*t_base — the later one-fond multiply reconstructs the
    // editor's live result exactly. Neither opaque source-over (covers the
    // base wholesale) nor multiply (glazes it) is the law.
    // 261028-k03: exactly ONE `cachedBase: null` site is allowed — the Lift
    // erase seam, where the base pixels travel in `baseCanvas` (the punched
    // D^K composite) instead of the cached bytes. Every other capture keeps
    // the pinned base, so the law above still holds for the ordinary path.
    const nullBaseSites = studio.match(/cachedBase: null/g) ?? [];
    expect(nullBaseSites).toHaveLength(1);
    const eraseCapture = studio.slice(studio.indexOf('cachedBase: null'));
    expect(eraseCapture).toContain('baseCanvas: punched.canvas');
    expect(studio).toContain('aquarelleMergeBaseRef');
    expect(studio).toContain("mergeBlend: 'pigment-alpha'");
    expect(studio).not.toContain("mergeBlend: 'source-over'");
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

  it('TRACK SWITCH: the outgoing sheet captures against the OUTGOING track, never the incoming one', () => {
    // 261027 UAT round 6: painting on track 2 then selecting track 1 overwrote
    // track 1's key with track 2's cache. The switch effect flushes the
    // outgoing sheet AFTER setActiveTrackId moved the document, and the
    // capture chain resolved its target from the LIVE active track — so the
    // outgoing sheet committed onto the incoming key. The flush now carries
    // the outgoing track id end-to-end, and the merge-base pin is per
    // (track, frame): two tracks share frame numbers.
    expect(layer).toContain('onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot, captureTrackId)');
    const studioSwitch = studio.slice(
      studio.indexOf('if (sessionNeedsCommit) {'),
      studio.indexOf('void studioScriptSnapshot.saveNow();'),
    );
    expect(studioSwitch).toContain('const outgoingTrackId = sessionTrackId ?? lastEditStateTrackIdRef.current');
    expect(studioSwitch).toContain('aquarelleFlushCaptureRef.current?.(outgoingTrackId ?? undefined)');
    // 261027 UAT round 10: the outgoing sheet was captured but the aquarelle
    // engine was never cleared on a track switch, so the incoming track's
    // strokes painted on top of the outgoing track's settled sheet (the
    // "under track blends with the foreground colour" report) and the mixed
    // sheet was captured into the incoming key. The switch commit must end
    // the sheet session AFTER the (eager) flush capture and BEFORE the save.
    const flushIdx = studioSwitch.indexOf('aquarelleFlushCaptureRef.current?.(outgoingTrackId ?? undefined)');
    const resetIdx = studioSwitch.indexOf('aquarelleResetSheetRef.current?.()');
    expect(resetIdx).toBeGreaterThan(flushIdx);
    // The saveNow call closes the sliced block, so compare its position in the
    // full source (searched from the same switch commit).
    const switchStart = studio.indexOf('if (sessionNeedsCommit) {');
    const saveIdx = studio.indexOf('void studioScriptSnapshot.saveNow();', switchStart);
    const resetInSwitch = studio.indexOf('aquarelleResetSheetRef.current?.()', switchStart);
    expect(saveIdx).toBeGreaterThan(-1);
    expect(resetInSwitch).toBeLessThan(saveIdx);
    // 261027 UAT round 8: the default capture target is the SESSION track (the
    // sheet the snapshot came from). The live document id can diverge from the
    // session, and that divergence cross-wrote the two tracks on disk.
    expect(studio).toContain('explicitTrackId ?? sessionTrackId ?? documentTrackId');
    expect(studio).toContain('trackId: targetTrackId');
    expect(studio).toContain('aquarelleMergeBaseRef.current?.trackId !== targetTrackId');
    const coordinator = readFileSync(
      resolve(__dirname, '../hooks/useRotoFramePersistenceCoordinator.ts'),
      'utf8',
    );
    expect(coordinator).toContain('capture.trackId');
    // The commit re-resolves the track too — a live lookup either refused the
    // outgoing commit (revision mismatch) or landed on the incoming key.
    expect(coordinator).toContain('expectedTrackId');
    expect(coordinator).toContain('const ownsLiveBuffers = trackId === inputRef.current.getActiveTrackId(layerId)');
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
    // 261027 (studio-strokes-lost-redraw RC-A): Water color at rest no longer
    // excludes the active track from ONE z-0 monitor (the aquarelle DOM stack
    // is layered above every monitor). The composite is split around the
    // active track's DOM seat instead: the main monitor draws the 'below'
    // slice (tracks beneath + Background) and a second monitor draws the
    // 'above' slice over the live stack. The active track appears in NEITHER
    // slice, so it is still never double-composited.
    expect(studio).toContain("const useWatercolorSlices = activeModule.value === 'watercolor'");
    expect(studio).toContain("slice: useWatercolorSlices ? ('below' as const) : null");
    // The store's hide filter already drops a hidden active track, so the
    // monitor never needs to exclude it: the DOM seat is handled by the slices.
    expect(studio).toContain('excludeActive: false,');
    expect(studio).toContain("slice: 'above' as const");
    // The above-monitor sits over the live sheet (z4) INSIDE the tracks group.
    const aboveRule = css.slice(css.indexOf('.physics-paint-program-monitor.physics-paint-program-monitor-above'));
    expect(aboveRule.slice(0, aboveRule.indexOf('}'))).toContain('z-index: 5');
    const liveRule = css.slice(css.indexOf('.demo-canvas-shell .aquarelle-live-canvas'));
    expect(liveRule.slice(0, liveRule.indexOf('}'))).toContain('z-index: 4');
  });

  it('F1/F2: STORAGE keeps the opaque transmittance encoding (option B)', () => {
    // Capture/export still writes vec4(t, 1.0): the stored sheet stays opaque
    // and old projects/thumbnails/pose margins keep working. Display converts
    // to pigment alpha; storage never changes format.
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
    // 261027 UAT round 9: the STRENGTH is the other half of the law. The bake
    // applies it; the live sheet did not, so a Move/Apply re-bake ran on a
    // different tooth and lost most of the wash density the artist saw.
    expect(layer).toContain('getPaperGrainStrength');
    expect(layer).toContain('engine.paperTexture = nextStrength');
    expect(mount).toContain('getAquarellePaperGrainStrength');
    expect(studio).toContain('getAquarellePaperGrainStrength');
  });

  it('CURSOR: the ring IS the engine footprint — same radius, aspect and angle', () => {
    // The HTML pointer is replaced by the dual-ring cursor (UI checklist row 1).
    expect(css).toContain('cursor: none');
    expect(layer).toContain('AquarelleBrushCursor');
    // 261028-k03c D6: no longer a size-slider circle — the ring asks the shared
    // footprint law for the exact radius/aspect/angle the engine will paint,
    // tip selection and per-tool overrides included, tilt azimuth live.
    expect(layer).toContain('const footprint = aquarelleFootprintFor({');
    expect(layer).toContain('size: params.size,');
    expect(layer).toContain('tipId: aquarelleActiveTipId(),');
    expect(layer).toContain('toolOverrides: selection.toolOverrides,');
    expect(layer).toContain(
      'pressure: cursorPreviewPressure(lastPointerType, lastPointerButtons, lastPointerPressure),',
    );
    expect(layer).toContain('tiltX: lastPointerTiltX,');
    expect(layer).toContain('tiltY: lastPointerTiltY,');
    expect(layer).toContain('const { width, height } = footprintCssSize(footprint, cursorLayerHeight);');
    // Shape branch mirrors Engine.updateCursor: rounded rect under 0.6 aspect,
    // ellipse above, crosshair below 8 px; the rotation is document-space
    // angle, screen-mirrored (y down).
    expect(layer).toContain('if (!(longAxis >= 8)) {');
    expect(layer).toContain('<rect ');
    expect(layer).toContain('rx={height * 0.4}');
    expect(layer).toContain('<ellipse ');
    expect(layer).toContain('transform: `rotate(${-footprint.angle}rad)`');
    // Dual-ring family: dark under-stroke + white over-stroke.
    expect(layer).toContain('stroke="#111111"');
    expect(layer).toContain('stroke="#ffffff"');
  });

  it('WR-01: re-renders on a stationary tilt/pressure change', () => {
    // The footprint inputs are module variables; only a compare-then-write
    // version signal can notify the cursor when x/y did not move.
    expect(layer).toContain('const cursorStateVersion = signal(0);');
    expect(layer).toContain('void cursorStateVersion.value;');
    expect(layer).toContain('if (footprintInputsChanged) cursorStateVersion.value += 1;');
    expect(layer).toContain('footprintInputsChanged = true;');
  });
});
