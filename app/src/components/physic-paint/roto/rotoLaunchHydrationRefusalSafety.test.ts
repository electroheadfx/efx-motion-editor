/**
 * quick-260921-qls regression pin: the refusal probes must never be able to
 * abort launch hydration.
 *
 * The launch-door probe reads into the carried document, which crosses the
 * webview boundary and is not guaranteed to match its declared type. A carried
 * `rotoPhysical` that the strict parser rejects (the door's own refusal path)
 * can still be missing the collections the probe reads; when the probe threw
 * from that read, `hydrateRotoPhysicalLaunchContext` rejected instead of
 * returning the refusal, the caller's loud failure path never ran, and the
 * Studio came up empty — black canvas, engine never ready.
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
