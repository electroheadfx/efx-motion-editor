import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'PhysicPaintProperties.tsx'), 'utf8');
const bridgeSource = readFileSync(resolve(here, '../../lib/physicPaintBridge.ts'), 'utf8');

describe('PhysicPaintProperties source contract', () => {
  it('renders Roto-only standalone actions and no obsolete Play launch path', () => {
    expect(source).toContain('Open Roto paint at the current editor frame.');
    expect(source).toContain('Delete the Roto paint frame at the current editor frame.');
    expect(source).not.toContain('Open Play paint');
    expect(source).not.toContain('activePlayRange');
  });

  it('passes the current frame, project canvas size, and derived workflow label to the Roto bridge', () => {
    // 261008-ful: the payload is assembled in exactly ONE place — the shared
    // bridge helper. This pin reads the bridge source so the sidebar and the
    // timeline FX-rail launcher stay welded to a single payload contract.
    const helper = bridgeSource.slice(
      bridgeSource.indexOf('export async function openPhysicPaintForLayer'),
      bridgeSource.indexOf('export async function openPhysicPaintCanvas'),
    );
    expect(helper).toContain('timelineStore.currentFrame.peek()');
    expect(helper).toContain('width: projectStore.width.peek()');
    expect(helper).toContain('height: projectStore.height.peek()');
    expect(helper).toContain('fps: projectStore.fps.peek()');
    expect(helper).toContain('workflowLabel: fxLayout?.headerLabel');
    expect(helper).toContain('openPhysicPaintCanvas(');
    expect(helper).not.toContain('requestedWorkflowMode');

    // Single-path pin: the sidebar routes through the helper and never
    // assembles/directly calls the raw bridge itself.
    expect(source).toContain('openPhysicPaintForLayer(layer)');
    expect(source).not.toContain('openPhysicPaintCanvas(');
  });

  it('keeps Roto-only button copy and no success status log', () => {
    expect(source).toContain("{opening ? 'Opening Roto paint...' : 'Roto paint'}");
    expect(source).not.toContain('Opened Roto paint');
    expect(source).not.toContain('setStatusMessage');
    expect(source).not.toContain('Opening Play paint');
  });

  it('reports apply failures through the error line only', () => {
    const handler = source.slice(source.indexOf('const handleApplyResult'), source.indexOf('window.addEventListener'));
    expect(handler).toContain('setErrorMessage(result.error');
  });

  it('renders opacity with the shared SliderStepper and drops the standalone label', () => {
    expect(source).toContain('<SliderStepper');
    expect(source).toContain('ariaLabel="Opacity"');
    expect(source).not.toContain('type="range"');
    expect(source).not.toContain('Standalone Canvas');
  });

  it('keeps invalid context copy and readable button labels', () => {
    expect(source).toContain('Select a physics paint layer and frame first.');
    expect(source).toContain('disabled:opacity-50 disabled:cursor-not-allowed');
    expect(source).toContain("{opening ? 'Opening Roto paint...' : 'Roto paint'}");
  });
});

describe('Physics paint layer row surface (261006-dfy)', () => {
  it('renders a display name with fallback, never the raw layer id', () => {
    expect(source).not.toContain('Layer ID');
    expect(source).not.toContain('title={layer.id}');
    expect(source).toContain('layer.name.trim()');
    expect(source).toContain('Physics paint ${');
  });

  it('removes the output-status block', () => {
    expect(source).not.toContain('Rendered Output');
  });

  it('splits double-click: body opens the Studio, name label never does', () => {
    expect(source).toContain('onDblClick={handleRowBodyDoubleClick}');
    expect(source).toContain('onDblClick={handleNameLabelDoubleClick}');
    // 261008-ful UAT: the double-clickable body advertises the pointer cursor.
    expect(source).toContain('rounded px-2 py-2 space-y-1 cursor-pointer');

    const bodyHandler = source.slice(
      source.indexOf('const handleRowBodyDoubleClick'),
      source.indexOf('const handleNameLabelDoubleClick'),
    );
    expect(bodyHandler).toContain('handleOpenCanvas()');

    const nameHandler = source.slice(
      source.indexOf('const handleNameLabelDoubleClick'),
      source.indexOf('const deleteCurrentRotoFrame'),
    );
    expect(nameHandler).toContain('stopPropagation');
    expect(nameHandler).not.toContain('handleOpenCanvas');
  });

  it('accents the row with the existing token, no literal hex', () => {
    expect(source).toContain("borderLeft: '2px solid var(--color-accent)'");
    expect(source).not.toContain('#2D5BE3');
  });
});
