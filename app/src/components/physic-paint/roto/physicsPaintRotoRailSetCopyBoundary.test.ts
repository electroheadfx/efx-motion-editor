import { describe, expect, it } from 'vitest';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import {
  buildRotoRailSetCopyPayload,
  proposeRails,
} from './physicsPaintRotoRailSetCopy';

const INTERPOLATION: PhysicPaintRotoInterpolationState = { enabled: false, mode: 'duplicate' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function recordKey(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, dataUrl: PNG, width: 100, height: 80 },
  }) as PhysicPaintRotoRealKeyRecord;
}

function buildDocument(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  breaks: readonly string[] = [],
  capacity = 100,
): PhysicPaintRotoPhysicalDocument {
  return parsePhysicPaintRotoPhysicalDocument({
    capacity,
    realKeyRecords: records,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], breaks),
    loopClips: [],
    incomingInterpolationBreakKeyIds: breaks,
  });
}

describe('REPRO rail-boundary rule', () => {
  it('first pasted rail adjacent to non-set content on its left owns an incoming break', () => {
    // Build the payload from a SOURCE where the set's first rail is the FIRST
    // rail (no source break): [k10@10,k12@12] and [k16@16,k18@18] (break on k16).
    const source = buildDocument(
      [recordKey('k10', 10), recordKey('k12', 12), recordKey('k16', 16), recordKey('k18', 18)],
      ['k16'],
    );
    const built = buildRotoRailSetCopyPayload({
      document: source,
      members: [
        { kind: 'key-rail', firstKeyId: 'k10' },
        { kind: 'key-rail', firstKeyId: 'k16' },
      ],
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);

    // Paste into a DESTINATION with existing rail [k0@0, k2@2], at cursor 3.
    // Fresh A lands 3/5 (adjacent to k2@2), fresh B lands 9/11.
    const destination = buildDocument([recordKey('k0', 0), recordKey('k2', 2)]);
    const pasted = proposeRails({ document: destination, payload: built.payload, placementMode: 'paste', destinationAppFrame: 3 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Paste must resolve: ${pasted.reason}`);

    const freshByFrame = new Map(pasted.proposal.realKeyRecords.map((r) => [r.appFrame, r.keyId]));
    const freshAFirst = freshByFrame.get(3) as string;
    const freshBFirst = freshByFrame.get(9) as string;

    // Rail-boundary rule: fresh A first key (at 3) is adjacent to k2@2 (non-set) -> must own a break.
    expect(pasted.proposal.incomingInterpolationBreakKeyIds).toContain(freshAFirst);
    // Internal gap preserved: fresh B first key keeps its relocated source break.
    expect(pasted.proposal.incomingInterpolationBreakKeyIds).toContain(freshBFirst);

    // Segment projection: existing [0,2], fresh A [3,5], fresh B [9,11] = THREE rails.
    const segments = deriveKeyRailSegments({
      orderedRealKeys: pasted.proposal.realKeyRecords,
      incomingInterpolationBreakKeyIds: new Set(pasted.proposal.incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds: new Set(),
    });
    const allRailFrames = segments.map((segment) => [segment.firstKeyFrame, segment.lastKeyFrame]);
    expect(allRailFrames).toEqual([[0, 2], [3, 5], [9, 11]]);
  });

  it('first pasted rail adjacent to the ORIGINAL set (source keys) still owns a break', () => {
    // Source AND destination are the same document: [k10@10,k12@12] and
    // [k16@16,k18@18] with break on k16. Copy the set, paste at cursor 13
    // (immediately after the original set's k12@12).
    const source = buildDocument(
      [recordKey('k10', 10), recordKey('k12', 12), recordKey('k16', 16), recordKey('k18', 18)],
      ['k16'],
    );
    const built = buildRotoRailSetCopyPayload({
      document: source,
      members: [
        { kind: 'key-rail', firstKeyId: 'k10' },
        { kind: 'key-rail', firstKeyId: 'k16' },
      ],
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);

    // Paste at cursor 13: fresh A lands 13/15 (adjacent to original k12@12),
    // fresh B lands 19/21.
    const pasted = proposeRails({ document: source, payload: built.payload, placementMode: 'paste', destinationAppFrame: 13 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Paste must resolve: ${pasted.reason}`);

    const freshByFrame = new Map(pasted.proposal.realKeyRecords.map((r) => [r.appFrame, r.keyId]));
    const freshAFirst = freshByFrame.get(13) as string;

    // The copy must NOT silently merge into the original set: fresh A first key
    // (at 13) owns a break even though its left neighbor k12@12 is a source key.
    expect(pasted.proposal.incomingInterpolationBreakKeyIds).toContain(freshAFirst);

    const segments = deriveKeyRailSegments({
      orderedRealKeys: pasted.proposal.realKeyRecords,
      incomingInterpolationBreakKeyIds: new Set(pasted.proposal.incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds: new Set(),
    });
    const allRailFrames = segments.map((segment) => [segment.firstKeyFrame, segment.lastKeyFrame]);
    // Original [10,12] + [16,18] preserved, pasted [13,15] + [19,21] separate
    // = FOUR rails. The copy never merges into the original set.
    expect(allRailFrames).toEqual([[10, 12], [13, 15], [16, 18], [19, 21]]);
  });
});
