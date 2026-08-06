import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoPhysicalRenderSource,
} from '../roto/physicsPaintRotoPhysicalModel';
import { rejectRotoLoopPlaceholderSource } from './useRotoFramePersistenceCoordinator';

// Phase 43 Plan 09 Task 3: the frame persistence/cache coordinator explicitly
// rejects the 'loop-placeholder' render-source variant — no durable-cache
// write, no persisted metadata, no cache ownership for that frame (D-28,
// audit finding 6). The never-fallback arm keeps a future render-source
// variant a compile-time error at this consumer (Pitfall 7 convention).

const coordinatorSource = readFileSync(
  fileURLToPath(new URL('./useRotoFramePersistenceCoordinator.ts', import.meta.url)),
  'utf8',
);

const realSource: PhysicPaintRotoPhysicalRenderSource = {
  kind: 'real',
  layerId: 'layer-1',
  appFrame: 4,
  keyId: 'key-4',
  contentRevision: 'rev-1',
  cacheRevision: 'rev-1:real:key-4',
  renderedFrame: { frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,cmVhbA==' },
};

const generatedSource: PhysicPaintRotoPhysicalRenderSource = {
  kind: 'generated',
  layerId: 'layer-1',
  appFrame: 5,
  leftKeyId: 'key-4',
  rightKeyId: 'key-9',
  interpolationMode: 'duplicate',
  contentRevision: 'rev-1',
  cacheRevision: 'rev-1:generated:duplicate:key-4:key-9:5',
  renderedFrame: { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,Z2VuZXJhdGVk' },
};

const placeholderSource: PhysicPaintRotoPhysicalRenderSource = {
  kind: 'loop-placeholder',
  layerId: 'layer-1',
  appFrame: 6,
  loopId: 'loop-1',
  placementStart: 2,
  sourceKeyIds: ['key-4', 'missing-1'],
  missingSourceKeyIds: ['missing-1'],
};

describe('Roto frame persistence coordinator loop-placeholder rejection (D-28, audit finding 6)', () => {
  it('rejects the placeholder variant from the cache pathway — zero durable-cache writes are possible for that frame', () => {
    expect(rejectRotoLoopPlaceholderSource(placeholderSource)).toBeNull();
    expect(rejectRotoLoopPlaceholderSource(null)).toBeNull();
  });

  it('passes real and generated render sources through by reference', () => {
    expect(rejectRotoLoopPlaceholderSource(realSource)).toBe(realSource);
    expect(rejectRotoLoopPlaceholderSource(generatedSource)).toBe(generatedSource);
  });

  it('never-fallback: a future unknown render-source variant is a hard error, never silent content', () => {
    const forged = { kind: 'future-variant', layerId: 'layer-1', appFrame: 7 } as unknown as PhysicPaintRotoPhysicalRenderSource;
    expect(() => rejectRotoLoopPlaceholderSource(forged)).toThrow(/Unhandled Roto physical render-source kind/);
  });

  it('routes the reference/cache lookup through the explicit rejection arm', () => {
    expect(coordinatorSource).toContain('rejectRotoLoopPlaceholderSource(');
    expect(coordinatorSource).toContain("case 'loop-placeholder':");
  });
});
