import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { drawProjectPaperRaster } from './projectPaperRaster';

interface Pixel { r: number; g: number; b: number; a: number }

const WHITE: Pixel = { r: 255, g: 255, b: 255, a: 255 };
const TEXTURE: Pixel[] = [
  { r: 40, g: 50, b: 60, a: 255 },
  { r: 220, g: 210, b: 190, a: 255 },
];
const PAINT: Pixel = { r: 210, g: 40, b: 20, a: 128 };

function over(base: Pixel, source: Pixel, opacity = 1): Pixel {
  const alpha = (source.a / 255) * opacity;
  return {
    r: Math.round(source.r * alpha + base.r * (1 - alpha)),
    g: Math.round(source.g * alpha + base.g * (1 - alpha)),
    b: Math.round(source.b * alpha + base.b * (1 - alpha)),
    a: 255,
  };
}

function renderPaper(textureOpacity: number, width = 6, height = 3): Pixel[] {
  return Array.from({ length: width * height }, (_, index) => over(WHITE, TEXTURE[index % TEXTURE.length], textureOpacity));
}

function addRegisteredPaint(pixels: Pixel[], width: number): Pixel[] {
  const result = pixels.map((pixel) => ({ ...pixel }));
  const paintIndex = width + 3;
  result[paintIndex] = over(result[paintIndex], PAINT);
  return result;
}

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('authoritative project paper raster parity', () => {
  it('renders Physics playback from the same cached project-paper implementation as PreviewRenderer', () => {
    const preview = source('src/lib/previewRenderer.ts');
    const playback = source('src/components/physic-paint/view/PhysicsPaintStudioView.tsx');
    const css = source('src/components/physic-paint/physicsPaintStudio.css');

    expect(preview).toContain("from './projectPaperRaster'");
    expect(playback).toContain("from '../../../lib/projectPaperRaster'");
    expect(playback).not.toContain('drawMissingRotoBackground');
    expect(playback).not.toContain('paper.src = `/img/paper_');
    expect(css).not.toContain("background-image: url('/img/paper_1.jpg')");

    const width = 6;
    const editorPaper = renderPaper(0.18, width);
    const recorded: Array<{ alpha: number; kind: 'fill' | 'pattern' }> = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'multiply',
      fillStyle: '#000',
      save() {},
      restore() {},
      fillRect(this: { globalAlpha: number; fillStyle: string }) { recorded.push({ alpha: this.globalAlpha, kind: String(this.fillStyle).startsWith('pattern') ? 'pattern' : 'fill' }); },
      createPattern() { return 'pattern:fixture'; },
      drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    drawProjectPaperRaster(context, { width: 2, height: 1 } as CanvasImageSource, width, 3);
    const sharedPhysicsPaper = renderPaper(recorded.find((entry) => entry.kind === 'pattern')?.alpha ?? 0, width);
    const editorComposite = addRegisteredPaint(editorPaper, width);
    const sharedPhysicsComposite = addRegisteredPaint(sharedPhysicsPaper, width);

    expect({ width, height: 3 }).toEqual({ width: 6, height: 3 });
    expect(recorded).toEqual([{ alpha: 1, kind: 'fill' }, { alpha: 0.18, kind: 'pattern' }]);
    expect(sharedPhysicsPaper[0]).toEqual(editorPaper[0]);
    expect(sharedPhysicsPaper[1]).toEqual(editorPaper[1]);
    expect(sharedPhysicsPaper[2]).toEqual(editorPaper[2]);
    expect(sharedPhysicsComposite[width + 3]).toEqual(editorComposite[width + 3]);
  });
});
