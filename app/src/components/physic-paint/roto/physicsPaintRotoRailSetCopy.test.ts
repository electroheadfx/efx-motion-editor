import { describe, expect, it } from 'vitest';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { getPhysicsPaintRotoSourceCycleId } from './physicsPaintRotoSpacingSelection';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import {
  buildRotoRailSetCopyPayload,
  buildRotoRailSetOperationResult,
  proposeRails,
  type RotoRailSetCopyPayload,
} from './physicsPaintRotoRailSetCopy';

const INTERPOLATION: PhysicPaintRotoInterpolationState = { enabled: false, mode: 'duplicate' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const CHANGED_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function recordKey(keyId: string, appFrame: number, dataUrl = PNG): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, dataUrl, width: 100, height: 80 },
  }) as PhysicPaintRotoRealKeyRecord;
}

function buildDocument(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[] = [],
  breaks: readonly string[] = [],
  capacity = 100,
  cursorAppFrame = 4,
): PhysicPaintRotoPhysicalDocument {
  return parsePhysicPaintRotoPhysicalDocument({
    capacity,
    realKeyRecords: records,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips, breaks),
    loopClips,
    incomingInterpolationBreakKeyIds: breaks,
  });
}

function keyRailPayload(records: readonly PhysicPaintRotoRealKeyRecord[]): RotoRailSetCopyPayload {
  const built = buildRotoRailSetCopyPayload({
    document: buildDocument(records, [], ['k6']),
    members: [
      { kind: 'key-rail', firstKeyId: 'k0' },
      { kind: 'key-rail', firstKeyId: 'k6' },
    ],
  });
  if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
  return built.payload;
}

/** RED 1 fixture: rail A k0/k2, rail B k6/k8, break on k6 (internal gap frames 3-5). */
function twoKeyRailDocument(): PhysicPaintRotoPhysicalDocument {
  return buildDocument(
    [recordKey('k0', 0), recordKey('k2', 2), recordKey('k6', 6), recordKey('k8', 8)],
    [],
    ['k6'],
  );
}

describe('physicsPaintRotoRailSetCopy — operation-result capsule copy (UAT-3)', () => {
  it('builds the persisted operation-result line from member intervals', () => {
    expect(buildRotoRailSetOperationResult('Pasted', [
      { kind: 'key-rail', firstFrame: 10, effectiveEndExclusive: 14 },
      { kind: 'key-rail', firstFrame: 16, effectiveEndExclusive: 20 },
    ])).toBe('Pasted 2 Rails — frames 10–19.');
    expect(buildRotoRailSetOperationResult('Duplicated', [
      { kind: 'loop', firstFrame: 6, effectiveEndExclusive: 12 },
    ])).toBe('Duplicated 1 Rail — frames 6–11.');
    // Out-of-order members are sorted into canonical first-frame order.
    expect(buildRotoRailSetOperationResult('Deleted', [
      { kind: 'key-rail', firstFrame: 20, effectiveEndExclusive: 24 },
      { kind: 'key-rail', firstFrame: 2, effectiveEndExclusive: 6 },
    ])).toBe('Deleted 2 Rails — frames 2–23.');
    expect(buildRotoRailSetOperationResult('Copied', [])).toBeNull();
  });
});

describe('physicsPaintRotoRailSetCopy — set copy payload builder (quick 260820-bjw)', () => {
  it('RED 1: builds a frozen payload with relative entries and first-key break flags', () => {
    const payload = keyRailPayload(twoKeyRailDocument().realKeyRecords);
    expect(payload.anchorAppFrame).toBe(0);
    expect(payload.members).toHaveLength(2);
    const railA = payload.members[0];
    const railB = payload.members[1];
    expect(railA).toMatchObject({ kind: 'key-rail', firstKeyId: 'k0', firstKeyOwnsIncomingBreak: false });
    expect(railB).toMatchObject({ kind: 'key-rail', firstKeyId: 'k6', firstKeyOwnsIncomingBreak: true });
    if (railA.kind !== 'key-rail' || railB.kind !== 'key-rail') throw new Error('Fixture members are key rails');
    expect(railA.entries.map((entry) => entry.sourceAppFrame)).toEqual([0, 2]);
    expect(railA.entries.map((entry) => entry.sourceKeyId)).toEqual(['k0', 'k2']);
    expect(railB.entries.map((entry) => entry.sourceAppFrame)).toEqual([6, 8]);
    expect(railB.entries.map((entry) => entry.sourceKeyId)).toEqual(['k6', 'k8']);
    expect(railB.entries.map((entry) => entry.payload.dataUrl)).toEqual([PNG, PNG]);
  });

  it('RED 2: builds a Motion Rail payload from loop placement facts', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'g1',
      placementStart: 0,
      sourceKeyIds: ['k0'],
      repeat: 3,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [],
    };
    const document = buildDocument([recordKey('k0', 0)], [clip]);
    const built = buildRotoRailSetCopyPayload({ document, members: [{ kind: 'loop', loopId: 'g1' }] });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Loop payload must build');
    expect(built.payload.anchorAppFrame).toBe(0);
    expect(built.payload.members[0]).toMatchObject({ kind: 'loop', loopId: 'g1', placementStart: 0 });
  });
});

describe('physicsPaintRotoRailSetCopy — proposeRails paste (quick 260820-bjw)', () => {
  it('RED 1: pastes two Key Rails at the cursor preserving relative offsets and the internal gap', () => {
    const document = twoKeyRailDocument();
    const payload = keyRailPayload(document.realKeyRecords);
    const pasted = proposeRails({ document, payload, placementMode: 'paste', destinationAppFrame: 10 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Paste must resolve: ${pasted.reason}`);
    const sourceIds = new Set(['k0', 'k2', 'k6', 'k8']);
    const fresh = pasted.proposal.realKeyRecords.filter((record) => !sourceIds.has(record.keyId));
    // Fresh identities are never reused source keyIds.
    expect(fresh).toHaveLength(4);
    expect(fresh.every((record) => !sourceIds.has(record.keyId))).toBe(true);
    const freshFrames = fresh.map((record) => record.appFrame).sort((a, b) => a - b);
    // A lands 10/12, B lands 16/18 — relative offset preserved; frames 13-15 stay empty.
    expect(freshFrames).toEqual([10, 12, 16, 18]);
    const freshByFrame = new Map(fresh.map((record) => [record.appFrame, record.keyId]));
    const freshAFirst = freshByFrame.get(10) as string;
    const freshBFirst = freshByFrame.get(16) as string;
    // The relocated source-owned break lands on the fresh B first key; the
    // rail-boundary rule also gives the fresh A first key a break (any existing
    // content lies to its left), so the pasted set never merges into the source
    // run — a pasted set never silently merges into a neighbor's segment.
    expect(pasted.proposal.incomingInterpolationBreakKeyIds).toContain(freshBFirst);
    expect(pasted.proposal.incomingInterpolationBreakKeyIds).toContain(freshAFirst);
    // The original set's break on k6 is preserved, so the source [0,2] and [6,8]
    // stay separate; the pasted set [10,12] and [16,18] are separate too.
    const segments = deriveKeyRailSegments({
      orderedRealKeys: pasted.proposal.realKeyRecords,
      incomingInterpolationBreakKeyIds: new Set(pasted.proposal.incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds: new Set(),
    });
    const allRailFrames = segments.map((segment) => [segment.firstKeyFrame, segment.lastKeyFrame]);
    expect(allRailFrames).toEqual([[0, 2], [6, 8], [10, 12], [16, 18]]);
    // Impact: ordered pasted identities, first pasted rail first.
    expect(pasted.impact.kind).toBe('paste');
    expect(pasted.impact.identities.map((identity) => identity.kind)).toEqual(['key-rail', 'key-rail']);
    expect(pasted.impact.identities[0].id).toBe(freshAFirst);
    expect(pasted.impact.identities[1].id).toBe(freshBFirst);
  });

  it('RED 2: pasting a Motion Rail duplicates the shared-source placement with relocated phase fields', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'g1',
      placementStart: 0,
      sourceKeyIds: ['k0'],
      repeat: 3,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [],
    };
    const document = buildDocument([recordKey('k0', 0)], [clip]);
    const built = buildRotoRailSetCopyPayload({ document, members: [{ kind: 'loop', loopId: 'g1' }] });
    if (!built.ok) throw new Error('Loop payload must resolve');
    const pasted = proposeRails({ document, payload: built.payload, placementMode: 'paste', destinationAppFrame: 8 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Loop paste must resolve: ${pasted.reason}`);
    const newClips = pasted.proposal.loopClips.filter((candidate) => candidate.loopId !== 'g1');
    expect(newClips).toHaveLength(1);
    const duplicated = newClips[0];
    expect(duplicated.loopId).not.toBe('g1');
    expect(duplicated.placementStart).toBe(8);
    expect(duplicated.sourceKeyIds).toEqual(['k0']);
    expect(duplicated.mode).toBe('progressive');
    expect(duplicated.repeat).toBe(3);
    expect(duplicated.phaseOrigin).toBe(8);
    expect(duplicated.originalEndExclusive).toBe(14);
    expect(duplicated.visibleRanges).toEqual([{ start: 8, endExclusive: 14 }]);
    // Shared source cycle: identical sourceCycleId; fresh placement identity.
    expect(getPhysicsPaintRotoSourceCycleId(duplicated.sourceKeyIds))
      .toBe(getPhysicsPaintRotoSourceCycleId(['k0']));
    // The original group record is unchanged.
    expect(pasted.proposal.loopClips.find((candidate) => candidate.loopId === 'g1')).toEqual(clip);
    expect(pasted.proposal.realKeyRecords).toEqual(document.realKeyRecords);
    expect(pasted.impact.identities).toHaveLength(1);
    expect(pasted.impact.identities[0]).toMatchObject({ kind: 'loop', id: duplicated.loopId, firstFrame: 8 });
  });

  it('RED 2b: paste uses the frozen payload bytes even if the source record changes after copy', () => {
    const document = buildDocument([recordKey('k0', 0)], [], []);
    const built = buildRotoRailSetCopyPayload({ document, members: [{ kind: 'key-rail', firstKeyId: 'k0' }] });
    if (!built.ok) throw new Error('Payload must resolve');
    // The source key's paint changes after the copy moment — the frozen payload wins.
    const changedDocument = buildDocument([recordKey('k0', 0, CHANGED_PNG)], [], []);
    const pasted = proposeRails({ document: changedDocument, payload: built.payload, placementMode: 'paste', destinationAppFrame: 8 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Paste must resolve: ${pasted.reason}`);
    const fresh = pasted.proposal.realKeyRecords.find((record) => record.keyId !== 'k0');
    expect(fresh?.payload.dataUrl).toBe(PNG);
    expect(fresh?.payload.dataUrl).not.toBe(CHANGED_PNG);
  });

  it('RED 3: a partially occupied destination rejects the WHOLE paste with zero mutation', () => {
    const blocker = recordKey('blocker', 10);
    const records = [recordKey('k0', 0), recordKey('k2', 2), recordKey('k6', 6), recordKey('k8', 8), blocker];
    const document = buildDocument(records, [], ['k6']);
    const payload = keyRailPayload(document.realKeyRecords);
    const pasted = proposeRails({ document, payload, placementMode: 'paste', destinationAppFrame: 10 });
    expect(pasted.ok).toBe(false);
    if (pasted.ok) throw new Error('Occupied paste must reject');
    expect(pasted.reason).toBe('duplicate-destination-frame');
    expect(pasted.conflictingAppFrames).toContain(10);
    // Zero mutation: no proposal, document byte-identical.
    expect((pasted as Readonly<{ proposal?: unknown }>).proposal).toBeUndefined();
    expect(document.realKeyRecords).toEqual(records);
    expect(document.loopClips).toEqual([]);
    expect(document.incomingInterpolationBreakKeyIds).toEqual(['k6']);
  });

  it('RED 3b: destinations beyond capacity reject through the not-enough-room family', () => {
    const document = buildDocument(
      [recordKey('k0', 0), recordKey('k2', 2), recordKey('k6', 6), recordKey('k8', 8)],
      [],
      ['k6'],
      12,
    );
    const payload = keyRailPayload(document.realKeyRecords);
    const pasted = proposeRails({ document, payload, placementMode: 'paste', destinationAppFrame: 10 });
    expect(pasted.ok).toBe(false);
    if (pasted.ok) throw new Error('Out-of-range paste must reject');
    expect(pasted.reason).toBe('out-of-range-frame');
  });
});

describe('physicsPaintRotoRailSetCopy — proposeRails duplicate (quick 260820-bjw)', () => {
  it('RED 4: duplicate places the set immediately after the last rail end', () => {
    const document = twoKeyRailDocument();
    const payload = keyRailPayload(document.realKeyRecords);
    const duplicated = proposeRails({ document, payload, placementMode: 'duplicate' });
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) throw new Error(`Duplicate must resolve: ${duplicated.reason}`);
    const sourceIds = new Set(['k0', 'k2', 'k6', 'k8']);
    const freshFrames = duplicated.proposal.realKeyRecords
      .filter((record) => !sourceIds.has(record.keyId))
      .map((record) => record.appFrame)
      .sort((a, b) => a - b);
    // Last rail end is 9 → first fitting anchor is 10 → A 10/12, B 16/18.
    expect(freshFrames).toEqual([10, 12, 16, 18]);
    expect(duplicated.impact.identities.map((identity) => identity.firstFrame)).toEqual([10, 16]);
  });

  it('RED 4b: duplicate scans forward past occupied frames to the first fitting anchor', () => {
    const records = [
      recordKey('k0', 0), recordKey('k2', 2), recordKey('k6', 6), recordKey('k8', 8),
      recordKey('blocker', 10),
    ];
    // The blocker owns its own break so it is a genuine separate rail (the
    // canonical segmenter merges across empty frames — a breakless key at 10
    // would join rail B). The copy then excludes it and the duplicate must
    // scan past its occupied frame.
    const document = buildDocument(records, [], ['k6', 'blocker']);
    const built = buildRotoRailSetCopyPayload({
      document,
      members: [
        { kind: 'key-rail', firstKeyId: 'k0' },
        { kind: 'key-rail', firstKeyId: 'k6' },
      ],
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
    const duplicate = proposeRails({ document, payload: built.payload, placementMode: 'duplicate' });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) throw new Error(`Duplicate must scan forward: ${duplicate.reason}`);
    const sourceIds = new Set(['k0', 'k2', 'k6', 'k8', 'blocker']);
    const freshFrames = duplicate.proposal.realKeyRecords
      .filter((record) => !sourceIds.has(record.keyId))
      .map((record) => record.appFrame)
      .sort((a, b) => a - b);
    // Frame 10 occupied → scan to anchor 11 → A 11/13, B 17/19.
    expect(freshFrames).toEqual([11, 13, 17, 19]);
  });
});

describe('physicsPaintRotoRailSetCopy — 46-03 track-scoped copy payload + cross-track re-pointing (D-06)', () => {
  it('payload builder records the source track identity when the copy supplies one', () => {
    const document = twoKeyRailDocument();
    const built = buildRotoRailSetCopyPayload({
      document,
      members: [{ kind: 'key-rail', firstKeyId: 'k0' }],
      trackId: 'track-a',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
    expect(built.payload.sourceTrackId).toBe('track-a');
    // Legacy payloads (no track context) keep the empty source identity so
    // pre-46-03 callers never trigger cross-track re-pointing.
    const legacy = buildRotoRailSetCopyPayload({
      document,
      members: [{ kind: 'key-rail', firstKeyId: 'k0' }],
    });
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) throw new Error(`Payload must build: ${legacy.reason}`);
    expect(legacy.payload.sourceTrackId).toBe('');
  });

  it('cross-track paste re-points a Hold Loop Clip source onto the destination track\'s copied frames (D-06: fresh loopId, never a foreign key id)', () => {
    const sourceDocument = buildDocument(
      [recordKey('k0', 0)],
      [{ loopId: 'hold1', placementStart: 0, sourceKeyIds: ['k0'], repeat: 1, mode: 'static' }],
    );
    const built = buildRotoRailSetCopyPayload({
      document: sourceDocument,
      members: [
        { kind: 'key-rail', firstKeyId: 'k0' },
        { kind: 'loop', loopId: 'hold1' },
      ],
      trackId: 'track-a',
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
    const targetDocument = buildDocument([recordKey('kb0', 0)], []);
    const pasted = proposeRails({
      document: targetDocument,
      payload: built.payload,
      placementMode: 'paste',
      destinationAppFrame: 10,
      targetTrackId: 'track-b',
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Cross-track paste must resolve: ${pasted.reason}`);
    const freshKeyId = pasted.proposal.realKeyRecords.find((record) => record.appFrame === 10)?.keyId;
    expect(freshKeyId).toBeDefined();
    expect(freshKeyId).not.toBe('k0');
    const newClips = pasted.proposal.loopClips.filter((clip) => clip.loopId !== 'hold1');
    expect(newClips).toHaveLength(1);
    expect(newClips[0].loopId).not.toBe('hold1');
    // The reference points at the destination track's copied frame — never back into the source.
    expect(newClips[0].sourceKeyIds).toEqual([freshKeyId]);
    expect(newClips[0].sourceKeyIds).not.toContain('k0');
    // The source document is untouched by the proposal.
    expect(sourceDocument.loopClips[0].sourceKeyIds).toEqual(['k0']);
  });

  it('rejects a cross-track paste whose Hold source frames are NOT part of the pasted set (ok:false, zero mutation)', () => {
    // The loop references k9, which is not among the pasted key rails — the
    // paste must fail closed rather than produce a dangling/foreign reference.
    const sourceDocument = buildDocument(
      [recordKey('k0', 0)],
      [{ loopId: 'hold1', placementStart: 0, sourceKeyIds: ['k9'], repeat: 1, mode: 'static' }],
    );
    const built = buildRotoRailSetCopyPayload({
      document: sourceDocument,
      members: [
        { kind: 'key-rail', firstKeyId: 'k0' },
        { kind: 'loop', loopId: 'hold1' },
      ],
      trackId: 'track-a',
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
    const targetDocument = buildDocument([recordKey('kb0', 0)], []);
    const pasted = proposeRails({
      document: targetDocument,
      payload: built.payload,
      placementMode: 'paste',
      destinationAppFrame: 10,
      targetTrackId: 'track-b',
    });
    expect(pasted.ok).toBe(false);
    if (pasted.ok) throw new Error('Un-re-pointable paste must reject');
    expect(pasted.reason).toBe('loop-source-outside-pasted-set');
    // Zero mutation: no proposal, target byte-identical.
    expect((pasted as Readonly<{ proposal?: unknown }>).proposal).toBeUndefined();
    expect(targetDocument.realKeyRecords).toEqual([recordKey('kb0', 0)]);
    expect(targetDocument.loopClips).toEqual([]);
  });

  it('same-track paste keeps the loop source references verbatim (shared-source placement, D-07)', () => {
    const document = buildDocument(
      [recordKey('k0', 0)],
      [{ loopId: 'hold1', placementStart: 0, sourceKeyIds: ['k0'], repeat: 1, mode: 'static' }],
    );
    const built = buildRotoRailSetCopyPayload({
      document,
      members: [
        { kind: 'key-rail', firstKeyId: 'k0' },
        { kind: 'loop', loopId: 'hold1' },
      ],
      trackId: 'track-a',
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
    const pasted = proposeRails({
      document,
      payload: built.payload,
      placementMode: 'paste',
      destinationAppFrame: 10,
      targetTrackId: 'track-a',
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Same-track paste must resolve: ${pasted.reason}`);
    const newClips = pasted.proposal.loopClips.filter((clip) => clip.loopId !== 'hold1');
    expect(newClips).toHaveLength(1);
    expect(newClips[0].loopId).not.toBe('hold1');
    expect(newClips[0].sourceKeyIds).toEqual(['k0']);
  });
});
