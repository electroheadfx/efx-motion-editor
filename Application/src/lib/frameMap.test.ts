import {describe, it, expect, beforeEach} from 'vitest';
import {sequenceStore} from '../stores/sequenceStore';
import {frameMap} from './frameMap';
import type {Sequence} from '../types/sequence';

/** Build a test sequence with `as any` for solidColor/isTransparent fields
 *  that don't exist on KeyPhoto yet (Plan 01 will add them). */
function makeSequence(overrides: Partial<Sequence> & { keyPhotos: any[] }): Sequence {
  return {
    id: 'seq-1',
    name: 'Test',
    kind: 'content',
    fps: 24,
    width: 1920,
    height: 1080,
    layers: [],
    ...overrides,
  } as Sequence;
}

describe('frameMap solid/transparent entries', () => {
  beforeEach(() => {
    sequenceStore.reset();
  });

  it('produces FrameEntry with solidColor for key solid entries', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: '', holdFrames: 2, solidColor: '#FF0000'} as any,
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(2);
    expect((entries[0] as any).solidColor).toBe('#FF0000');
    expect(entries[0].imageId).toBe('');
    expect((entries[1] as any).solidColor).toBe('#FF0000');
  });

  it('produces FrameEntry with isTransparent for transparent entries', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: '', holdFrames: 1, solidColor: '#000000', isTransparent: true} as any,
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).isTransparent).toBe(true);
  });

  it('produces FrameEntry without solidColor for regular key photos', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: 'img-1', holdFrames: 1},
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).solidColor).toBeUndefined();
    expect((entries[0] as any).isTransparent).toBeUndefined();
    expect(entries[0].imageId).toBe('img-1');
  });

  it('interleaves solid and photo FrameEntry correctly', () => {
    sequenceStore.sequences.value = [makeSequence({
      keyPhotos: [
        {id: 'kp-1', imageId: 'img-1', holdFrames: 1},
        {id: 'kp-2', imageId: '', holdFrames: 2, solidColor: '#0000FF'} as any,
        {id: 'kp-3', imageId: 'img-2', holdFrames: 1},
      ],
    })];

    const entries = frameMap.value;
    expect(entries).toHaveLength(4);
    expect(entries[0].imageId).toBe('img-1');
    expect((entries[0] as any).solidColor).toBeUndefined();
    expect((entries[1] as any).solidColor).toBe('#0000FF');
    expect((entries[2] as any).solidColor).toBe('#0000FF');
    expect(entries[3].imageId).toBe('img-2');
    expect((entries[3] as any).solidColor).toBeUndefined();
  });
});
