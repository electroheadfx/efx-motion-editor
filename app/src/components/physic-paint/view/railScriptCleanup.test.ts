// ============================================================
//  railScriptCleanup.test.ts — quick-261026-odd one-time migration.
//
//  The carried-document rail span is the pure half; the Studio owns
//  the store purges and the snapshot controller owns the durable
//  marker.
// ============================================================

import { describe, expect, it } from 'vitest';
import { resolveCarriedRailFrames } from './railScriptCleanup';

function documentWith(
  trackId: string,
  physical: {
    capacity: number;
    loopClips: readonly {
      placementStart: number;
      sourceKeyIds: readonly string[];
      repeat: number | 'infinity';
    }[];
  } | null,
): unknown {
  return {
    tracks: [{ id: trackId, rotoPhysical: physical }],
  };
}

describe('resolveCarriedRailFrames', () => {
  it('covers a finite clip span, start inclusive and end exclusive', () => {
    const frames = resolveCarriedRailFrames(
      documentWith('track-1', {
        capacity: 100,
        loopClips: [{ placementStart: 4, sourceKeyIds: ['a', 'b', 'c'], repeat: 2 }],
      }),
      'track-1',
    );
    expect(frames).toEqual(new Set([4, 5, 6, 7, 8, 9]));
  });

  it('clamps an infinity clip to the document capacity', () => {
    const frames = resolveCarriedRailFrames(
      documentWith('track-1', {
        capacity: 10,
        loopClips: [{ placementStart: 8, sourceKeyIds: ['a'], repeat: 'infinity' }],
      }),
      'track-1',
    );
    expect(frames).toEqual(new Set([8, 9]));
  });

  it('clamps a clip that overruns capacity', () => {
    const frames = resolveCarriedRailFrames(
      documentWith('track-1', {
        capacity: 7,
        loopClips: [{ placementStart: 5, sourceKeyIds: ['a', 'b'], repeat: 5 }],
      }),
      'track-1',
    );
    expect(frames).toEqual(new Set([5, 6]));
  });

  it('returns an empty set when the physical state exists but has no rails', () => {
    const frames = resolveCarriedRailFrames(
      documentWith('track-1', { capacity: 20, loopClips: [] }),
      'track-1',
    );
    expect(frames).toEqual(new Set());
  });

  it('returns null when the physical state is unknown (never mark clean)', () => {
    expect(resolveCarriedRailFrames(documentWith('track-1', null), 'track-1')).toBeNull();
    expect(resolveCarriedRailFrames(documentWith('other', { capacity: 1, loopClips: [] }), 'track-1')).toBeNull();
    expect(resolveCarriedRailFrames(null, 'track-1')).toBeNull();
    expect(resolveCarriedRailFrames(undefined, 'track-1')).toBeNull();
    expect(resolveCarriedRailFrames({ tracks: 'nope' }, 'track-1')).toBeNull();
  });
});
