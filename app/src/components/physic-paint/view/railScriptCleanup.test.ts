// ============================================================
//  railScriptCleanup.test.ts — quick-261026-odd one-time migration.
//
//  The carried-document rail span and the once-per-track marker are
//  pure; the Studio owns the store purges.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import {
  markRailScriptCleanupDone,
  railCleanupStorageAvailable,
  railScriptCleanupDone,
  resolveCarriedRailFrames,
  type RailCleanupIdentity,
} from './railScriptCleanup';

const IDENTITY: RailCleanupIdentity = {
  projectId: 'project-1',
  layerId: 'layer-1',
  trackId: 'track-1',
};

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

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

describe('railScriptCleanupDone / markRailScriptCleanupDone', () => {
  it('runs once per project/layer/track', () => {
    const storage = memoryStorage();
    expect(railScriptCleanupDone(IDENTITY, storage)).toBe(false);
    markRailScriptCleanupDone(IDENTITY, storage);
    expect(railScriptCleanupDone(IDENTITY, storage)).toBe(true);
    // A different track keeps its own marker.
    expect(railScriptCleanupDone({ ...IDENTITY, trackId: 'track-2' }, storage)).toBe(false);
  });

  it('treats missing or unreadable storage as done', () => {
    expect(railScriptCleanupDone(IDENTITY, null)).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: vi.fn(),
    };
    expect(railScriptCleanupDone(IDENTITY, throwing)).toBe(true);
    expect(() => markRailScriptCleanupDone(IDENTITY, throwing)).not.toThrow();
  });

  it('probes storage availability without writing', () => {
    expect(railCleanupStorageAvailable(memoryStorage())).toBe(true);
    expect(railCleanupStorageAvailable(null)).toBe(false);
    expect(railCleanupStorageAvailable({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: vi.fn(),
    })).toBe(false);
  });
});
