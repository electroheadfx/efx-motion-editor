import { describe, expect, it } from 'vitest';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import {
  ROTO_SCRIPT_EXTENSION,
  ROTO_SCRIPT_KIND,
  createPersistedRotoScript,
  isPersistedRotoScriptV1,
  managedRotoScriptFilename,
  persistedRotoScriptToRuntime,
  rotoScriptLibraryRow,
} from './physicsPaintRotoScriptSchema';

const id = '123e4567-e89b-42d3-a456-426614174000';
const webp = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=';

function stroke(overrides: Partial<PaintStroke> = {}): PaintStroke {
  return {
    mutationId: 9, tool: 'paint', points: [{ x: 1, y: 2, p: 0.5, tx: 3, ty: 4, tw: 5, spd: 6 }], color: '#123456',
    params: { size: 12, opacity: 90, pressure: 80, waterAmount: 70, dryAmount: 60, edgeDetail: 50, pickup: 40, eraseStrength: 30, antiAlias: 2 },
    timestamp: 123, hasPenInput: true, playFrame: 7, physicsMode: 'local', ...overrides,
  };
}

function document() {
  return createPersistedRotoScript({
    id, name: 'Preset', createdAt: '2026-07-16T12:00:00.000Z', updatedAt: '2026-07-16T12:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 12, width: 1920, height: 1080, background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.6 } },
    thumbnail: { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: webp },
    brushes: [{ primary: stroke(), continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 4 })] }],
  });
}

describe('durable Roto script schema', () => {
  it('serializes exact autonomous kind/version/filename and complete ordered deterministic brush data', () => {
    const value = document();
    expect(value.kind).toBe(ROTO_SCRIPT_KIND);
    expect(value.schemaVersion).toBe(1);
    expect(managedRotoScriptFilename(id)).toBe(`${id}${ROTO_SCRIPT_EXTENSION}`);
    expect(value.brushes[0].primary).toMatchObject({ tool: 'paint', hasPenInput: true, playFrame: 7, physicsMode: 'local', timestamp: 123 });
    expect(value.brushes[0].primary.points[0]).toEqual({ x: 1, y: 2, p: 0.5, tx: 3, ty: 4, tw: 5, spd: 6 });
    expect(value.brushes[0].continuations[0]).toMatchObject({ points: [], diffusionFrames: 4 });
    expect(value.brushes[0].primary).not.toHaveProperty('mutationId');
    expect(value.source).toMatchObject({ projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 12 });
  });

  it('creates fresh runtime and row objects without aliasing persisted input', () => {
    const value = document();
    const runtime = persistedRotoScriptToRuntime(value);
    const row = rotoScriptLibraryRow(value, 'revision');
    expect(runtime.brushes[0].primary).not.toBe(value.brushes[0].primary);
    expect(runtime.brushes[0].primary.points[0]).not.toBe(value.brushes[0].primary.points[0]);
    expect(row.source).not.toBe(value.source);
    expect(row.thumbnail).not.toBe(value.thumbnail);
  });

  it('accepts safe unknown optional v1 fields and rejects malformed versions, dates, ids, fields and WebP metadata', () => {
    const value = document() as any;
    value.futureOptional = { safe: true };
    expect(isPersistedRotoScriptV1(value)).toBe(true);
    for (const mutate of [
      (copy: any) => { copy.schemaVersion = 2; },
      (copy: any) => { copy.id = '../escape'; },
      (copy: any) => { copy.updatedAt = '2026-07-15T00:00:00Z'; },
      (copy: any) => { copy.brushes[0].primary.timestamp = Number.MAX_SAFE_INTEGER + 1; },
      (copy: any) => { copy.brushes[0].primary.points[0].p = 2; },
      (copy: any) => { copy.brushes[0].continuations[0].points = [{}]; },
      (copy: any) => { copy.thumbnail.width = 2; },
      (copy: any) => { copy.thumbnail.dataUrl = 'data:image/png;base64,AAAA'; },
    ]) {
      const copy = structuredClone(value); mutate(copy); expect(isPersistedRotoScriptV1(copy)).toBe(false);
    }
  });
});
