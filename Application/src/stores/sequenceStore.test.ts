import {describe, it, expect, beforeEach} from 'vitest';
import {sequenceStore} from './sequenceStore';

// Use `as any` so TypeScript compiles even before Plan 01 adds the new methods.
// After Plan 01 extends the store, the `as any` can be removed.
const store = sequenceStore as any;

/** Helper: create a minimal content sequence and return its id */
function seedSequence(): string {
  const seq = sequenceStore.createSequence('Test');
  return seq.id;
}

describe('sequenceStore solid/transparent', () => {
  beforeEach(() => {
    sequenceStore.reset();
  });

  describe('addKeySolid (SOLID-01, D-04, D-06)', () => {
    it('adds a key solid with default black color to the sequence', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId);
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = seq.keyPhotos[seq.keyPhotos.length - 1];
      expect(kp.solidColor).toBe('#000000');
      expect(kp.imageId).toBe('');
      expect(kp.holdFrames).toBe(4);
      expect(kp.isTransparent).toBeUndefined();
    });

    it('adds a key solid with custom color', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#FF0000', 8);
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = seq.keyPhotos[seq.keyPhotos.length - 1];
      expect(kp.solidColor).toBe('#FF0000');
      expect(kp.holdFrames).toBe(8);
    });
  });

  describe('updateKeySolidColor (SOLID-04, D-14)', () => {
    it('changes the solidColor of an existing key solid', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#000000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      store.updateKeySolidColor(seqId, kpId, '#00FF00');
      const updated = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      expect(updated.keyPhotos.find((kp: any) => kp.id === kpId)!.solidColor).toBe('#00FF00');
    });
  });

  describe('toggleKeyEntryTransparent (SOLID-03, D-11, D-12)', () => {
    it('toggles a key solid to transparent mode', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#FF0000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      store.toggleKeyEntryTransparent(seqId, kpId);
      const toggled = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = toggled.keyPhotos.find((k: any) => k.id === kpId)!;
      expect(kp.isTransparent).toBe(true);
    });

    it('round-trips transparent back to solid, restoring the original solidColor', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#FF0000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      // Toggle to transparent
      store.toggleKeyEntryTransparent(seqId, kpId);
      // Toggle back to solid
      store.toggleKeyEntryTransparent(seqId, kpId);

      const restored = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = restored.keyPhotos.find((k: any) => k.id === kpId)!;
      expect(kp.isTransparent).toBeUndefined();
      expect(kp.solidColor).toBe('#FF0000');
    });

    it('defaults to #000000 when toggling from transparent to solid with no prior color', () => {
      const seqId = seedSequence();
      store.addKeySolid(seqId, '#000000');
      const seq = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kpId = seq.keyPhotos[seq.keyPhotos.length - 1].id;

      // Toggle to transparent then back
      store.toggleKeyEntryTransparent(seqId, kpId);
      store.toggleKeyEntryTransparent(seqId, kpId);

      const restored = sequenceStore.sequences.value.find(s => s.id === seqId)!;
      const kp = restored.keyPhotos.find((k: any) => k.id === kpId)!;
      expect(kp.solidColor).toBe('#000000');
    });
  });
});

describe('sequenceStore GL transitions (GLT-05)', () => {
  beforeEach(() => {
    sequenceStore.reset();
  });

  describe('setGlTransition', () => {
    it.todo('sets glTransition on the specified sequence');
    it.todo('clears crossDissolve when setting glTransition (D-02 mutual exclusion)');
    it.todo('marks project dirty');
    it.todo('pushes undo action');
  });

  describe('removeGlTransition', () => {
    it.todo('removes glTransition from the specified sequence');
    it.todo('marks project dirty');
    it.todo('pushes undo action');
  });

  describe('updateGlTransitionParams', () => {
    it.todo('updates shader params on existing glTransition');
    it.todo('no-ops if sequence has no glTransition');
  });

  describe('updateGlTransition', () => {
    it.todo('merges partial updates into existing glTransition');
    it.todo('can update duration and curve independently');
  });

  describe('addTransition mutual exclusion', () => {
    it.todo('clears glTransition when adding cross-dissolve (D-02)');
  });
});
