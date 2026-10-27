// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mountPath = fileURLToPath(new URL('./PhysicsPaintCanvasMount.tsx', import.meta.url));
const wrapperPath = fileURLToPath(new URL('./MemoizedPhysicsPaintCanvasMount.ts', import.meta.url));
const studioPath = fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('../view/PhysicsPaintStudioView.tsx', import.meta.url));
const mount = readFileSync(mountPath, 'utf8');
const wrapper = existsSync(wrapperPath) ? readFileSync(wrapperPath, 'utf8') : '';
const studio = readFileSync(studioPath, 'utf8');
const view = readFileSync(viewPath, 'utf8');

function resolveBlock(source: string, declaration: string, nextDeclaration: string): string {
  const start = source.indexOf(declaration);
  const end = source.indexOf(nextDeclaration, start);
  expect(start, declaration).toBeGreaterThanOrEqual(0);
  expect(end, nextDeclaration).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('PhysicsPaintCanvasMount persistent boundary contract', () => {
  it('keeps the plain mount directly available behind a dedicated compat memo wrapper', () => {
    expect(mount).toContain('export function PhysicsPaintCanvasMount(');
    expect(mount).not.toContain("from 'preact/compat'");
    expect(wrapper).toContain("import { memo } from 'preact/compat';");
    expect(wrapper).toContain("import { PhysicsPaintCanvasMount } from './PhysicsPaintCanvasMount';");
    // 52.2-12: the memo target is the counted boundary (render-churn
    // inventory, D-18) which delegates through createElement so the mount's
    // hooks bind to the mount instance, not the wrapper's.
    expect(wrapper).toContain('export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMountRenderCounted);');
  });

  it('memoizes CanvasStack without passing a fresh children vnode across its boundary', () => {
    expect(view).toContain("import { memo } from 'preact/compat';");
    expect(view).toContain("import { MemoizedPhysicsPaintCanvasMount } from '../engine/MemoizedPhysicsPaintCanvasMount';");
    expect(view).toContain('function PhysicsPaintCanvasStackImpl(');
    expect(view).toContain('const MemoizedPhysicsPaintCanvasStack = memo(PhysicsPaintCanvasStackImpl);');
    const propsStart = view.indexOf('interface PhysicsPaintCanvasStackViewProps');
    const propsEnd = view.indexOf('/**', propsStart);
    const propsBlock = view.slice(propsStart, propsEnd);
    expect(propsBlock).not.toContain('children:');
    expect(propsBlock).toContain('canvasKey: string;');
    expect(propsBlock).toContain('mount: ComponentProps<typeof PhysicsPaintCanvasMount>;');
    const stackStart = view.indexOf('function PhysicsPaintCanvasStackImpl(');
    const stackEnd = view.indexOf('const MemoizedPhysicsPaintCanvasStack', stackStart);
    const stackBlock = view.slice(stackStart, stackEnd);
    expect(stackBlock).toContain('<MemoizedPhysicsPaintCanvasMount');
    expect(stackBlock).toContain('aquarelleCachedBaseUrl={props.cachedRotoPlaybackActive ? null : props.cachedRotoReferenceUrl ?? null}');
    expect(view).toContain('<MemoizedPhysicsPaintCanvasStack {...canvas} />');
  });

  it('anchors the canvas bounds to the mount shell, not the removed engine-1 surface', () => {
    // 261027-klx UAT regression: probing `.paint-canvas > canvas` returned an
    // empty NodeList after the engine-1 surface was removed, so canvasBounds
    // stayed null and the fond layer, the program monitor and every
    // bounds-anchored overlay never rendered (the black Studio canvas). The
    // mount shell IS the canvas region and always exists.
    const stackStart = view.indexOf('function PhysicsPaintCanvasStackImpl(');
    const stackEnd = view.indexOf('const MemoizedPhysicsPaintCanvasStack', stackStart);
    const stackBlock = view.slice(stackStart, stackEnd);
    expect(stackBlock).toContain("stack.querySelector<HTMLElement>('.demo-canvas-shell')");
    expect(stackBlock).not.toContain("'.paint-canvas");
  });

  it('renders only the watercolor surfaces — engine-1 is gone', () => {
    // 261027-klx: `@efxlab/efx-watercolor` is the only paint engine. The mount
    // renders the live aquarelle sheet over its cached base and nothing else;
    // the Efx child, the Brush script overlay and the hard-coded engine-1 paper
    // URLs (which fed the deleted package) must never come back. Comments are
    // stripped for the negative scan so the removal note above cannot trip it.
    const mountCode = mount.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(mountCode).toContain('<AquarelleCanvasLayer');
    expect(mountCode).toContain('<AquarelleCachedBaseLayer');
    expect(mountCode).not.toContain('EfxPaintCanvas');
    // Composed from fragments on purpose: the Wave 6 census gates (G2/G5) forbid
    // the contiguous retired tokens in app/src; the runtime scan terms are
    // unchanged, so a re-introduced import or overlay still trips the guard.
    expect(mountCode).not.toContain('efx-physic-' + 'paint');
    expect(mountCode).not.toContain('Brush' + 'Script' + 'Overlay');
    expect(mountCode).not.toContain('paper_1.jpg');
    expect(mountCode).not.toContain('paper_2.jpg');
    expect(mountCode).not.toContain('paper_3.jpg');
  });

  it('keeps mount identity structural and excludes frame-navigation values', () => {
    const mountBlock = resolveBlock(
      studio,
      'const canvasMount = canvasMountPropsMemo.resolve(',
      'const canvasStack = canvasStackPropsMemo.resolve(',
    );
    const deps = mountBlock.slice(0, mountBlock.indexOf('], () =>'));
    for (const dependency of [
      'canvasWidth',
      'canvasHeight',
      'paperTextureScale',
      'setCanvasMounted',
      'handleAquarelleEnginePortReady',
    ]) expect(deps).toContain(dependency);
    for (const engineOneDependency of [
      'handleCanvasEngineReady',
      'handleCanvasCompletedMutation',
      'handleNativePenInputReady',
      'recordEnginePerformance',
      'rotoScript.prepareEngineDisposal',
      'getStrokeMetadata',
    ]) expect(deps).not.toContain(engineOneDependency);
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(deps).not.toContain(invalidator);
  });

  it('keeps CanvasStack identity semantic and passes the program monitor its real inputs', () => {
    const stackBlock = resolveBlock(
      studio,
      'const canvasStack = canvasStackPropsMemo.resolve(',
      'const viewModel = usePhysicsPaintStudioViewModel',
    );
    const deps = stackBlock.slice(0, stackBlock.indexOf('], () =>'));
    for (const dependency of [
      'cachedRotoReferenceUrl',
      'rotoCachedPlayback.playbackTick',
      'rotoCachedPlayback.isActive',
      'cachedRotoPlaybackComposition',
      'rotoInputDisabled',
      'rotoInputDisabledMessage',
      'beginRotoFrameEdit',
      'onionOverlay',
      'canvasKey',
      'canvasMount',
      // 48-05 (D-05): the program monitor config's real inputs — the stack
      // re-resolves on navigation / playback / document changes so the leaf
      // draws the current composite, while the watercolor stack stays memoized
      // behind the stable canvasMount identity + canvasKey.
      'launchContext?.layerId',
      'currentFrame',
      'isPlaying',
      'efxPaintVersion.value',
      'canvasWidth',
      'canvasHeight',
    ]) expect(deps).toContain(dependency);
    for (const invalidator of ['startFrame', 'rotoNavigationGeneration']) expect(deps).not.toContain(invalidator);
  });

  it('updates parent callback refs during render and forwards to the latest callback', () => {
    for (const callback of [
      'onCanvasMounted',
      'onAquarelleStrokeEnd',
      'onAquarelleStrokeSettled',
      'onAquarelleCaptureFrame',
      'onAquarelleFlushCaptureReady',
      'onAquarelleSnapshotReady',
      'onAquarelleSheetSessionEnd',
      'onAquarelleResetSheetReady',
      'onAquarelleDeleteStrokes',
      'onAquarelleMoveStrokes',
      'onAquarelleTransformStrokes',
      'onEnginePortReady',
    ]) {
      expect(mount).toContain(`const ${callback}Ref = useRef(props.${callback});`);
      expect(mount).toContain(`${callback}Ref.current = props.${callback};`);
    }
    // Wave 3 D8: the ONE narrow engine port is forwarded from the layer.
    expect(mount).toContain('onEnginePortReady={(port) => onEnginePortReadyRef.current?.(port)}');
  });

  it('carries the active track opacity/blend to the engine shell as CSS group opacity + mix-blend (48-06 N2/N3)', () => {
    // The active track is EXCLUDED from the program monitor's composite (D-05),
    // so its D-01 display properties would never reach the Studio surface
    // without this seam: the engine shell wears them as CSS group opacity +
    // mix-blend-mode over the monitor beneath.
    expect(mount).toContain('trackOpacity?: number;');
    expect(mount).toContain('trackBlendMode?: BlendMode');
    expect(mount).toContain("add: 'plus-lighter',");
    expect(mount).toContain('mixBlendMode: TRACK_BLEND_TO_CSS_MIX[trackBlendMode]');
    // The tint group must stay above the z-0 monitor while non-default (a new
    // stacking context would otherwise paint in tree order, beneath it).
    expect(mount).toContain("position: 'relative',");
    const mountBlock = resolveBlock(
      studio,
      'const canvasMount = canvasMountPropsMemo.resolve(',
      'const canvasStack = canvasStackPropsMemo.resolve(',
    );
    expect(mountBlock).toContain('trackOpacity: mountActiveTrack?.opacity ?? 1,');
    expect(mountBlock).toContain("trackBlendMode: mountActiveTrack?.blendMode ?? 'normal',");
    // The memo re-resolves on document display-property mutations
    // (setTrackOpacity/setTrackBlend bump the efxPaintVersion clock).
    const deps = mountBlock.slice(0, mountBlock.indexOf('], () =>'));
    expect(deps).toContain('efxPaintVersion.value');
    // The standalone white .paint-canvas background must not join the blend
    // group — the Studio shell keeps it transparent (the monitor owns the
    // visible background).
    const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
    expect(css).toContain('.demo-canvas-shell .paint-canvas {\n  background-color: transparent;');
  });

  it('hides the engine surface when the active track is hidden so the monitor owns the composite (48-06 UAT-B)', () => {
    // UAT-B: hiding Track 1 while it was the active track blanked the WHOLE
    // canvas even though Paint 1 stayed visible — the live surface can still
    // carry the hidden track's paint and occludes the program monitor beneath.
    // The stack mirrors the cached-roto-playback treatment: the watercolor
    // surfaces step aside until the track is visible again. Hiding a NON-active
    // track never arms the flag.
    const stackBlock = resolveBlock(
      studio,
      'const canvasStack = canvasStackPropsMemo.resolve(',
      'const viewModel = usePhysicsPaintStudioViewModel',
    );
    expect(stackBlock).toContain('!resolvePhysicPaintTrackVisibility(programMonitorLayerId, programMonitorActiveTrackId)');
    expect(stackBlock).toContain('engineSurfaceHidden,');
    expect(view).toContain("props.engineSurfaceHidden ? ' active-track-hidden' : ''");
    const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
    expect(css).toContain('.physics-paint-canvas-stack.active-track-hidden .physics-paint-tracks-group > .demo-canvas-shell .aquarelle-live-canvas,\n.physics-paint-canvas-stack.active-track-hidden .physics-paint-tracks-group > .demo-canvas-shell .aquarelle-cached-base {\n  visibility: hidden;');
  });

  it('isolates the tracks group from a dedicated fond layer so the active-track blend never meets the paper (48-06 UAT-C)', () => {
    // The montage: a fond layer (paper) beneath an ISOLATED tracks group that
    // holds the engine shell (active track, CSS blend) and the program monitor
    // (fond-less composite). isolation: isolate confines the shell's
    // mix-blend-mode to the monitor — the paper is outside the group's stacking
    // context, so the active track's blend never meets it.
    const fondIndex = view.indexOf('<div class="physics-paint-fond-layer"');
    const groupIndex = view.indexOf('physics-paint-tracks-group');
    const mountIndex = view.indexOf('<MemoizedPhysicsPaintCanvasMount');
    const monitorIndex = view.indexOf('<div class="physics-paint-program-monitor"');
    expect(fondIndex).toBeGreaterThanOrEqual(0);
    expect(groupIndex).toBeGreaterThan(fondIndex);
    expect(mountIndex).toBeGreaterThan(groupIndex);
    expect(monitorIndex).toBeGreaterThan(mountIndex);
    // The fond layer draws the paper through the playback-background subscriber.
    expect(view).toContain('<PhysicsPaintRotoPlaybackBackground');
    expect(view).toContain('background={props.fondBackground}');
    // 49-03 (D-11): the Studio derives the fond from the DOCUMENT FALLBACK via
    // the store's resolved fond instruction (the same authority the flattened
    // path uses — the per-track roto background metadata walk is gone) and
    // threads it through the canvasStack memo.
    expect(studio).toContain('physicPaintStore.getDocumentFondInstruction(programMonitorLayerId)');
    expect(studio).not.toContain('physicPaintStore.getRotoBackgroundMetadata(programMonitorLayerId, track.id)');
    expect(studio).toContain('fondBackground,');
    // The CSS: the group is an isolated stacking context; the fond layer sits
    // beneath it (z-index 0, pointer-events none).
    const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
    expect(css).toContain('.physics-paint-tracks-group {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  isolation: isolate;');
    expect(css).toContain('.physics-paint-fond-layer {\n  position: absolute;\n  z-index: 0;\n  pointer-events: none;\n  overflow: hidden;');
  });

  it('keeps dimension observer and keyed lifecycle ownership unchanged', () => {
    expect(mount).toContain('}, [props.height, props.width]);');
    expect(view).toContain('<MemoizedPhysicsPaintCanvasMount');
    expect(view).toContain('aquarelleCachedBaseUrl={props.cachedRotoPlaybackActive ? null : props.cachedRotoReferenceUrl ?? null}');
    for (const counter of [
      'render.canvasMount',
      'render.efxChildRequest',
      'observer.canvasMount.resize.install',
      'observer.canvasMount.resize.cleanup',
    ]) expect(mount.split(`recordPhysicsPaintPerformanceCounter('${counter}')`).length - 1).toBe(1);
    // The engine-1 lifecycle counters rode the deleted Efx child.
    expect(mount).not.toContain('lifecycle.canvasMount.engineReady');
    expect(mount).not.toContain('lifecycle.canvasMount.beforeDestroy');
  });

  it('applies the paper pass once to the whole tracks group', () => {
    const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
    // Product law 2026-10-26 (opaque sheets): the tracks group is the single
    // paper pass — monitor composite + the aquarelle sheet stack are flattened
    // together, exactly once. The old aquarelle carve-outs (per-layer multiply,
    // isolation lift) are gone.
    const groupRule = css.slice(css.indexOf('.physics-paint-tracks-group {'));
    expect(groupRule.slice(0, groupRule.indexOf('}'))).toContain('mix-blend-mode: multiply');
    // Inside that pass the monitor must not multiply a second time.
    const monitorRule = css.slice(css.indexOf('\n.physics-paint-program-monitor {'));
    expect(monitorRule.slice(0, monitorRule.indexOf('}'))).toContain('mix-blend-mode: normal');
    // No module-specific guard: one law for every track sheet.
    expect(css).not.toContain('.physics-paint-tracks-group:not(.aquarelle-compositing)');
    expect(css).not.toContain('.physics-paint-tracks-group.aquarelle-compositing,');
    // 261027-klx: the engine-1 brush cursor ring canvas is gone — Water color
    // owns its DOM ring on the sheet itself.
    expect(view).not.toContain('physics-paint-brush-cursor-overlay');
  });
});
