import {describe, it, expect} from 'vitest';
import {findPrevSequenceStart, findNextSequenceStart} from './sequenceNav';
import type {TrackLayout} from '../types/timeline';

const twoSequences = [
  {sequenceId: 'a', sequenceName: 'A', startFrame: 0, endFrame: 10, keyPhotoRanges: []},
  {sequenceId: 'b', sequenceName: 'B', startFrame: 10, endFrame: 20, keyPhotoRanges: []},
] as TrackLayout[];

const threeSequences = [
  {sequenceId: 'a', sequenceName: 'A', startFrame: 0, endFrame: 10, keyPhotoRanges: []},
  {sequenceId: 'b', sequenceName: 'B', startFrame: 10, endFrame: 20, keyPhotoRanges: []},
  {sequenceId: 'c', sequenceName: 'C', startFrame: 20, endFrame: 30, keyPhotoRanges: []},
] as TrackLayout[];

const singleSequence = [
  {sequenceId: 'a', sequenceName: 'A', startFrame: 0, endFrame: 10, keyPhotoRanges: []},
] as TrackLayout[];

describe('findPrevSequenceStart', () => {
  it('returns start of current sequence when playhead is mid-sequence', () => {
    expect(findPrevSequenceStart(twoSequences, 15)).toBe(10);
  });

  it('returns start of previous sequence when playhead is at boundary', () => {
    expect(findPrevSequenceStart(twoSequences, 10)).toBe(0);
  });

  it('returns null when already at or before first sequence', () => {
    expect(findPrevSequenceStart(singleSequence, 0)).toBeNull();
  });

  it('returns null for empty layouts', () => {
    expect(findPrevSequenceStart([], 5)).toBeNull();
  });
});

describe('findNextSequenceStart', () => {
  it('returns start of next sequence when playhead is mid-sequence', () => {
    expect(findNextSequenceStart(twoSequences, 5)).toBe(10);
  });

  it('returns null when no sequence starts after currentFrame (at last boundary)', () => {
    expect(findNextSequenceStart(twoSequences, 10)).toBeNull();
  });

  it('returns start of next sequence from second of three sequences', () => {
    expect(findNextSequenceStart(threeSequences, 10)).toBe(20);
  });

  it('returns null for empty layouts', () => {
    expect(findNextSequenceStart([], 5)).toBeNull();
  });
});
