import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicPaintProperties.tsx'), 'utf8');

describe('PhysicPaintProperties source contract', () => {
  it('renders Roto-only standalone actions and no obsolete Play launch path', () => {
    expect(source).toContain('Open Roto paint at the current editor frame.');
    expect(source).toContain('Delete the Roto paint frame at the current editor frame.');
    expect(source).not.toContain('Open Play paint');
    expect(source).not.toContain('activePlayRange');
  });

  it('passes current frame and project canvas size to the Roto bridge', () => {
    const handler = source.slice(source.indexOf('const handleOpenCanvas'), source.indexOf('const deleteCurrentRotoFrame'));
    expect(handler).toContain('const currentFrame = timelineStore.currentFrame.value');
    expect(handler).toContain('frame: currentFrame');
    expect(handler).toContain('width: projectStore.width.value');
    expect(handler).toContain('height: projectStore.height.value');
    expect(handler).not.toContain('requestedWorkflowMode');
  });

  it('uses Roto-only opening and success status copy', () => {
    expect(source).toContain("setStatusMessage('Opening Roto paint...')");
    expect(source).toContain('Opened Roto paint at frame ${result.data.startFrame}.');
    expect(source).not.toContain('Opening Play paint');
  });

  it('keeps invalid context copy and readable button labels', () => {
    expect(source).toContain('Select a physics paint layer and frame first.');
    expect(source).toContain('disabled:opacity-50 disabled:cursor-not-allowed');
    expect(source).toContain("{opening ? 'Opening Roto paint...' : 'Roto paint'}");
  });
});
