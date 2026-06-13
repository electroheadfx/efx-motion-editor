import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url));
const stylePath = fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');
const styles = () => readFileSync(stylePath, 'utf8');

describe('PhysicsPaintStudio onion preview contract', () => {
  it('captures transparent stroke previews instead of full paper composite snapshots', () => {
    const text = source();

    expect(text).toContain('function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement');
    expect(text).toContain("engine.setBgMode('transparent')");
    expect(text).toContain('return engine.exportCompositeCanvas()');
    expect(text).toContain('engine.load(state)');
    expect(text).toContain('function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number): RenderedFramePayload');
    expect(text).toContain('return buildRotoFrameFromCanvas(engine.exportCompositeCanvas(), appFrame)');
    expect(text).toContain('function buildRotoOnionPreviewFrame(engine: EfxPaintEngine, appFrame: number): RenderedFramePayload');
    expect(text).toContain('return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame)');
  });

  it('clips the onion overlay to measured canvas bounds, not the full canvas stack', () => {
    const text = source();

    expect(text).toContain('function PhysicsPaintCanvasStack');
    expect(text).toContain('const canvasRect = canvas.getBoundingClientRect()');
    expect(text).toContain('left: canvasRect.left - stackRect.left');
    expect(text).toContain('width: canvasRect.width');
    expect(text).toContain('class="physics-paint-onion-overlay canvas-region"');
    expect(text).toContain('style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}');
    expect(text).not.toContain('<div class="physics-paint-onion-overlay canvas-region" aria-hidden="true">');
  });

  it('keeps transparent onion strokes visible over paper instead of screening them out', () => {
    const css = styles();

    expect(css).toContain('mix-blend-mode: multiply');
    expect(css).not.toContain('mix-blend-mode: screen');
  });

  it('sends paper composite frames to EFX Motion while caching transparent onion previews', () => {
    const text = source();
    const saveRotoBlock = text.slice(text.indexOf('const saveRotoFrame = useCallback'), text.indexOf('const savePlay = useCallback'));

    expect(saveRotoBlock).toContain('const renderedFrame = buildRotoOutputFrame(engine, currentFrame)');
    expect(saveRotoBlock).toContain('rotoPreviewFramesRef.current.set(currentFrame, buildRotoOnionPreviewFrame(engine, currentFrame))');
    expect(saveRotoBlock).toContain('renderedFrame,');
  });

  it('applies onion previous/next toggles and opacity to the canvas overlay', () => {
    const text = source();

    expect(text).toContain('opacity: 60');
    expect(text).toContain('const onionOpacity = clampOnionOpacity(onion.opacity) / 100');
    expect(text).toContain("frame.direction === 'previous' && onion.previous");
    expect(text).toContain("frame.direction === 'next' && onion.next");
    expect(text).toContain('Math.max(0.08, onionOpacity - frame.distance * 0.08)');
  });
});

describe('PhysicsPaintStudio Play relaunch hydration contract', () => {
  it('initializes workflow mode and Play range from launch context metadata instead of hardcoded Roto defaults', () => {
    const text = source();

    expect(text).toContain("context?.workflowMode === 'play' || context?.editableSource === 'play'");
    expect(text).toContain('useState<PhysicsPaintWorkflowMode>(() => getLaunchWorkflowMode(launchContext))');
    expect(text).toContain('launchContext?.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES');
    expect(text).toContain('const currentFrame = launchContext?.startFrame ?? 0');
    expect(text).not.toContain("useState<PhysicsPaintWorkflowMode>('roto')");
    expect(text).not.toContain('useState(4)');
  });

  it('fetches the stored Tauri launch context after mount so editable Play state is not lost on reopen', () => {
    const text = source();

    expect(text).toContain("coreApi.invoke('get_physics_paint_launch_context')");
    expect(text).toContain('isPhysicPaintLaunchContext(storedContext)');
    expect(text).toContain('applyLaunchContext(storedContext, setLaunchContext, setFramesToApply, setWorkflowMode)');
    expect(text).toContain('applyLaunchContext(event.payload, setLaunchContext, setFramesToApply, setWorkflowMode)');
  });

  it('accepts saved Play source metadata through the parsed launch context path', () => {
    const text = source();

    expect(text).toContain('workflowMode: workflowMode === \'play\' ? \'play\' : \'roto\'');
    expect(text).toContain('playStartFrame: Number.isInteger(playStartFrame) && playStartFrame >= 0 ? playStartFrame : undefined');
    expect(text).toContain('playFrameCount: Number.isInteger(playFrameCount) && playFrameCount > 0 ? playFrameCount : undefined');
    expect(text).toContain('editableSource: editableSource === \'play\' ? \'play\' : editableSource === \'roto\' ? \'roto\' : undefined');
    expect(text).toContain('const parsed = JSON.parse(encodedContext)');
    expect(text).not.toContain('JSON.parse(decodeURIComponent(encodedContext))');
  });

  it('keeps Play frame conversion availability separate from cleared onion preview state', () => {
    const text = source();

    expect(text).toContain('const [playFramesVersion, setPlayFramesVersion] = useState(0)');
    expect(text).toContain('latestPlayFramesRef.current = frames');
    expect(text).toContain('setLatestPlayFrames([])');
    expect(text).toContain('setPlayFramesVersion((version) => version + 1)');
    expect(text).toContain('new Set(latestPlayFramesRef.current.map((frame) => frame.appFrame))');
    expect(text).toContain('playFramesVersion');
  });
});
