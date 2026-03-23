import {describe, it, expect} from 'vitest';
import {computeBeatMarkers, computeDownbeatFrames, snapToBeat, autoArrangeHoldFrames} from './beatMarkerEngine';

describe('computeBeatMarkers', () => {
  it('produces markers every 12 frames at 120 BPM / 24 fps', () => {
    // 60/120 = 0.5s per beat, 0.5 * 24 = 12 frames per beat
    const markers = computeBeatMarkers(120, 0, 24, 120);
    expect(markers).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108]);
  });

  it('returns empty array when bpm is 0', () => {
    const markers = computeBeatMarkers(0, 0, 24, 120);
    expect(markers).toEqual([]);
  });

  it('returns empty array when bpm is negative', () => {
    const markers = computeBeatMarkers(-10, 0, 24, 120);
    expect(markers).toEqual([]);
  });

  it('shifts markers by beatOffset', () => {
    const markers = computeBeatMarkers(120, 6, 24, 60);
    // Beat at frames: 6, 18, 30, 42, 54
    expect(markers).toEqual([6, 18, 30, 42, 54]);
  });

  it('skips negative offset frames (only >= 0 included)', () => {
    const markers = computeBeatMarkers(120, -6, 24, 60);
    // Would be: -6, 6, 18, 30, 42, 54 -- skip -6
    expect(markers).toEqual([6, 18, 30, 42, 54]);
  });

  it('produces correct markers at 90 BPM / 24 fps', () => {
    // 60/90 = 0.667s per beat, 0.667 * 24 = 16 frames per beat
    const markers = computeBeatMarkers(90, 0, 24, 80);
    expect(markers).toEqual([0, 16, 32, 48, 64]);
  });
});

describe('computeDownbeatFrames', () => {
  it('returns every 4th marker as downbeat by default', () => {
    const markers = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108];
    const downbeats = computeDownbeatFrames(markers);
    expect(downbeats).toEqual(new Set([0, 48, 96]));
  });

  it('returns every 3rd marker when beatsPerBar=3', () => {
    const markers = [0, 12, 24, 36, 48, 60, 72, 84, 96];
    const downbeats = computeDownbeatFrames(markers, 3);
    expect(downbeats).toEqual(new Set([0, 36, 72]));
  });

  it('returns empty set for empty markers', () => {
    const downbeats = computeDownbeatFrames([]);
    expect(downbeats.size).toBe(0);
  });
});

describe('snapToBeat', () => {
  const markers = [0, 12, 24, 36, 48];

  it('returns nearest marker when within threshold', () => {
    // Frame 10, closest is 12, distance = 2, threshold = 3 -> snap
    expect(snapToBeat(10, markers, 3)).toBe(12);
  });

  it('returns null when no marker within threshold', () => {
    // Frame 10, closest is 12, distance = 2, threshold = 1 -> no snap
    expect(snapToBeat(10, markers, 1)).toBe(null);
  });

  it('prefers exact match', () => {
    expect(snapToBeat(24, markers, 5)).toBe(24);
  });

  it('returns nearest when equidistant from two markers', () => {
    // Frame 6 is equidistant from 0 and 12
    const result = snapToBeat(6, markers, 6);
    expect(result === 0 || result === 12).toBe(true);
  });

  it('returns null for empty markers array', () => {
    expect(snapToBeat(10, [], 5)).toBe(null);
  });
});

describe('autoArrangeHoldFrames', () => {
  // 120 BPM at 24 fps = 12 frames per beat
  const markers = [0, 12, 24, 36, 48, 60];

  it('distributes 3 photos across 6 beats with every-beat strategy', () => {
    const holds = autoArrangeHoldFrames(3, markers, 'every-beat', 24, 120);
    expect(holds).toHaveLength(3);
    // 3 photos across 6 beats: 2 beats each = 24 frames each
    // Last photo holds through remaining
    expect(holds[0]).toBe(24);
    expect(holds[1]).toBe(24);
    expect(holds[2]).toBe(24);
  });

  it('gives each photo minimum 1-beat hold when more photos than beats', () => {
    const holds = autoArrangeHoldFrames(10, markers, 'every-beat', 24, 120);
    expect(holds).toHaveLength(10);
    // Each gets at least framesPerBeat (12)
    for (const h of holds) {
      expect(h).toBeGreaterThanOrEqual(12);
    }
  });

  it('uses stride 2 for every-2-beats strategy', () => {
    // 6 beats -> 3 target positions with stride 2
    const holds = autoArrangeHoldFrames(2, markers, 'every-2-beats', 24, 120);
    expect(holds).toHaveLength(2);
    // 2 photos across 3 target beats (every 2nd beat): first gets 1 stride (24 frames), second gets rest
    expect(holds[0]).toBe(24);
    expect(holds[1]).toBe(48);
  });

  it('uses stride 4 for every-bar strategy', () => {
    // 6 beats -> target positions at index 0 and 4 with stride 4
    const markers12 = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132];
    const holds = autoArrangeHoldFrames(2, markers12, 'every-bar', 24, 120);
    expect(holds).toHaveLength(2);
    // First photo: from marker[0] to marker[4] = 48 frames
    expect(holds[0]).toBe(48);
    // Second photo: holds through remaining = marker[8]-marker[4] + rest
    expect(holds[1]).toBeGreaterThan(0);
  });

  it('returns empty array when no beat markers', () => {
    const holds = autoArrangeHoldFrames(3, [], 'every-beat', 24, 120);
    expect(holds).toEqual([]);
  });
});
