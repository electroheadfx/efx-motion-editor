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
    expect(wrapper).toContain('export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMount);');
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
    expect(stackBlock).toContain('<MemoizedPhysicsPaintCanvasMount key={props.canvasKey} {...props.mount} />');
    expect(view).toContain('<MemoizedPhysicsPaintCanvasStack {...canvas} />');
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
      'handleCanvasEngineReady',
      'handleCanvasCompletedMutation',
      'setCanvasMounted',
      'handleNativePenInputReady',
      'recordEnginePerformance',
      'rotoScript.prepareEngineDisposal',
      'getStrokeMetadata',
    ]) expect(deps).toContain(dependency);
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(deps).not.toContain(invalidator);
  });

  it('keeps CanvasStack identity semantic and excludes frame-navigation values', () => {
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
    ]) expect(deps).toContain(dependency);
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(deps).not.toContain(invalidator);
  });
});
