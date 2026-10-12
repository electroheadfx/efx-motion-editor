import {describe, it, expect, beforeEach} from 'vitest';
import {timelineStore} from './timelineStore';
import {sequenceStore} from './sequenceStore';
import {currentFrame} from './timelineFrameSignal';

/**
 * 53.1-04 (D-10 / Law 2): playhead clamp 0..N inclusive at the store boundary.
 * Tick N is a reachable end-of-sequence position; the preview END-STATE mapping
 * (playhead N renders N-1) lives at the preview render boundary and is
 * corroborated by the plan's grep leg — these cases pin the store clamp.
 *
 * N is driven through the real frameMap totalFrames computed by seeding a
 * content sequence key with a controlled holdFrames (no frameMap mock).
 */
function seedTimeline(holdFrames: number): {seqId: string; keyId: string} {
  const seq = sequenceStore.createSequence('T');
  sequenceStore.addKeySolid(seq.id, '#000000', holdFrames);
  const seeded = sequenceStore.sequences.value.find((s) => s.id === seq.id)!;
  return {seqId: seq.id, keyId: seeded.keyPhotos[0].id};
}

function setHoldFrames(seqId: string, keyId: string, holdFrames: number): void {
  sequenceStore.updateHoldFrames(seqId, keyId, holdFrames);
}

describe('timelineStore playhead clamp 0..N (D-10, Law 2)', () => {
  beforeEach(() => {
    sequenceStore.reset();
    timelineStore.reset();
  });

  it('seek(N) lands on N (end-of-sequence position is reachable)', () => {
    seedTimeline(5); // N = 5
    expect(timelineStore.totalFrames.value).toBe(5);
    timelineStore.seek(5);
    expect(currentFrame.value).toBe(5);
  });

  it('stepForward from N-1 lands on N and does not step past N', () => {
    seedTimeline(5); // N = 5
    timelineStore.seek(4);
    expect(currentFrame.value).toBe(4);
    timelineStore.stepForward();
    expect(currentFrame.value).toBe(5);
    timelineStore.stepForward();
    expect(currentFrame.value).toBe(5);
  });

  it('stepBackward from 0 stays on 0', () => {
    seedTimeline(5);
    timelineStore.seek(0);
    timelineStore.stepBackward();
    expect(currentFrame.value).toBe(0);
  });

  it('N shrinks below the current playhead clamps down to the new N', () => {
    const {seqId, keyId} = seedTimeline(5);
    timelineStore.seek(5);
    expect(currentFrame.value).toBe(5);
    setHoldFrames(seqId, keyId, 3); // N = 3 < playhead 5
    expect(timelineStore.totalFrames.value).toBe(3);
    expect(currentFrame.value).toBe(3);
  });

  it('N grows while the playhead sits on N leaves the playhead on its frame', () => {
    const {seqId, keyId} = seedTimeline(5);
    timelineStore.seek(5);
    expect(currentFrame.value).toBe(5);
    setHoldFrames(seqId, keyId, 10); // N grows; playhead 5 is still legal
    expect(timelineStore.totalFrames.value).toBe(10);
    expect(currentFrame.value).toBe(5);
  });

  it('empty timeline N=0 keeps the playhead on 0 (today\'s empty render)', () => {
    expect(timelineStore.totalFrames.value).toBe(0);
    timelineStore.seek(0);
    expect(currentFrame.value).toBe(0);
    timelineStore.seek(7);
    expect(currentFrame.value).toBe(0);
    timelineStore.stepForward();
    expect(currentFrame.value).toBe(0);
    timelineStore.stepBackward();
    expect(currentFrame.value).toBe(0);
  });
});
