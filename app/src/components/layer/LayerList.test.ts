import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'LayerList.tsx'), 'utf8');

describe('LayerList source contract (261008-ful)', () => {
  it('binds double-click on the row div to the launch handler alongside the existing gestures', () => {
    expect(source).toContain('onClick={handleSelect}');
    expect(source).toContain('onDblClick={handleRowDoubleClick}');
    expect(source).toContain("handle: '.layer-drag-handle'");
    expect(source).not.toContain('fxRenameEdit');
  });

  it('gates the Studio launch on physic-paint type, source, and frame guards through the ONE shared path', () => {
    const start = source.indexOf('const handleRowDoubleClick');
    expect(start).toBeGreaterThan(-1);
    const handler = source.slice(start, source.indexOf('return (', start));
    expect(handler).toContain("layer.type !== 'physic-paint'");
    expect(handler).toContain("layer.source.type !== 'physic-paint'");
    expect(handler).toContain('Number.isInteger(frame)');
    expect(handler).toContain('stopPropagation');
    expect(handler).toContain('openPhysicPaintForLayer(layer)');
    // Region-scoped single-path pin: this handler never reaches the raw
    // bridge — payload assembly lives only in openPhysicPaintForLayer.
    expect(handler).not.toContain('openPhysicPaintCanvas(');
  });
});
