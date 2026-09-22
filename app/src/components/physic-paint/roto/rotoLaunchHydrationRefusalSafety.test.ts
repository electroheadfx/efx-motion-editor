/**
 * The launch door's refusal contract: a refused launch RESOLVES the refusal,
 * never rejects.
 *
 * The carried document crosses the webview boundary and is not guaranteed to
 * match its declared type — a `rotoPhysical` the strict parser refuses can be
 * missing every collection. Anything that throws on that arm (a read into the
 * malformed payload) rejects the hydration instead: the caller's loud failure
 * path never runs and the Studio comes up empty, black canvas, engine never
 * ready. The refusal is data, so it is returned.
 */
import { describe, expect, it } from 'vitest';
import {
  hydrateRotoPhysicalLaunchContext,
  prepareRotoPhysicalLaunch,
  type RotoPhysicalLaunchHydrationStore,
} from './rotoLaunchHydration';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';

/** A carried physical payload the strict parser refuses, missing every collection. */
function malformedRefusingContext(): PhysicPaintLaunchContext {
  return {
    operationId: 'op-pin',
    layerId: 'layer-pin',
    startFrame: 0,
    document: {
      activeTrackId: 'track-pin',
      tracks: [{ id: 'track-pin', rotoPhysical: { capacity: 600 } }],
    },
  } as unknown as PhysicPaintLaunchContext;
}

function unreachableStore(): RotoPhysicalLaunchHydrationStore {
  return {
    replaceRotoPhysicalDocument: () => ({ ok: false, error: 'store must not be reached on a refused door' }),
  } as unknown as RotoPhysicalLaunchHydrationStore;
}

describe('quick-260921-qls launch refusal safety', () => {
  it('the door refuses the malformed carried payload', () => {
    expect(prepareRotoPhysicalLaunch(malformedRefusingContext()).ok).toBe(false);
  });

  it('a refused launch still RESOLVES the refusal instead of rejecting', async () => {
    const result = await hydrateRotoPhysicalLaunchContext(malformedRefusingContext(), unreachableStore());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.error).toBe('string');
  });
});
