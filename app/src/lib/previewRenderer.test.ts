import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('PreviewRenderer missing Roto frame source contract', () => {
  it('owns the shared missing-frame resolver and background draw path', () => {
    const source = readSource('src/lib/previewRenderer.ts');

    expect(source).toContain("import {drawMissingRotoBackground, resolveMissingRotoFrameDraw} from './rotoFrameDraw'");
    expect(source).toContain('resolveMissingRotoFrameDrawForLayer(layer, paintLookupFrame)');
    expect(source).toContain('drawMissingRotoBackground(ctx, missingDraw, logicalW, logicalH)');
  });

  it('checks cached real frames before resolving missing transparent or background-only frames', () => {
    const source = readSource('src/lib/previewRenderer.ts');
    const branchStart = source.lastIndexOf("layer.type === 'physic-paint'");
    const physicPaintBranch = source.slice(branchStart, source.indexOf("} else if (layer.type === 'paint')", branchStart));

    expect(physicPaintBranch).toContain('getPhysicPaintFrameForLayer(paintLayerId, paintLookupFrame)');
    expect(physicPaintBranch.indexOf('getPhysicPaintFrameForLayer(paintLayerId, paintLookupFrame)')).toBeLessThan(
      physicPaintBranch.indexOf('resolveMissingRotoFrameDrawForLayer(layer, paintLookupFrame)'),
    );
    expect(physicPaintBranch).toContain("if (missingDraw.kind === 'background-only')");
    expect(physicPaintBranch).not.toContain('setFrame(');
    expect(physicPaintBranch).not.toContain('upsertRealRotoKeyFrame(');
    expect(physicPaintBranch).not.toContain('replaceGeneratedRotoCache(');
  });
});
