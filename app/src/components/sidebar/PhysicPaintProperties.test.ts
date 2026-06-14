import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicPaintProperties.tsx'), 'utf8');

describe('PhysicPaintProperties source contract', () => {
  it('renders contextual Roto/Play actions instead of showing every action at once', () => {
    expect(source).toContain('activePlayRange ? (');
    expect(source).toContain(') : hasCurrentRotoFrame ? (');
    expect(source).toContain('Open Play paint for the active script range.');
    expect(source).toContain('Delete the active Play paint script range.');
    expect(source).toContain('Open Roto paint at the current editor frame.');
    expect(source).toContain('Delete the Roto paint frame at the current editor frame.');
    expect(source).not.toContain(['[open fx paint', 'canvas]'].join(' '));
  });

  it('passes the current editor frame and requested workflow mode to the bridge for each button', () => {
    const openHandlerSource = source.slice(source.indexOf('const handleOpenCanvas'), source.indexOf('};\n\n  return ('));

    expect(openHandlerSource).toContain('const currentFrame = timelineStore.currentFrame.value');
    expect(openHandlerSource).toContain("requestedWorkflowMode: mode");
    expect(openHandlerSource).toContain('frame: currentFrame');
    expect(source).toContain("handleOpenCanvas('roto')");
    expect(source).toContain("handleOpenCanvas('play')");
    const bridgeRequestSource = openHandlerSource.slice(openHandlerSource.indexOf('openPhysicPaintCanvas({'), openHandlerSource.indexOf('});', openHandlerSource.indexOf('openPhysicPaintCanvas({')));
    expect(bridgeRequestSource).not.toContain('playStartFrame');
    expect(bridgeRequestSource).not.toContain('layer.startFrame');
  });

  it('uses the UI-SPEC opening and success status copy', () => {
    expect(source).toContain("Opening Roto paint...");
    expect(source).toContain("Opening Play paint...");
    expect(source).toContain('Opened Roto paint at frame ${result.data.startFrame}.');
    expect(source).toContain('Opened Play paint range ${startFrame}–${endFrame} at preview frame ${previewFrame}.');
  });

  it('keeps invalid context copy and readable contextual button labels', () => {
    expect(source).toContain('Select a physics paint layer and frame first.');
    expect(source).toContain('disabled:opacity-50 disabled:cursor-not-allowed');
    expect(source).toContain("{openingMode === 'roto' ? 'Opening Roto paint...' : 'Roto paint'}");
    expect(source).toContain("{openingMode === 'play' ? 'Opening Play paint...' : 'Play paint'}");
    const standaloneCanvasSource = source.slice(source.indexOf('<SectionLabel text=\"Standalone Canvas\" />'));
    expect(standaloneCanvasSource).not.toContain('Roto paint is disabled while the current frame is inside a Play paint range.');
    expect(standaloneCanvasSource).not.toContain('Current frame is inside a Play paint range.');
  });
});
