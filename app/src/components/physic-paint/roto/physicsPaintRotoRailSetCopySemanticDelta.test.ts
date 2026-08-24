import { describe, expect, it } from 'vitest';
import { buildPhysicPaintRotoPhysicalRevision, parsePhysicPaintRotoPhysicalDocument, type PhysicPaintRotoLoopClip, type PhysicPaintRotoPhysicalDocument, type PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';
import { buildRotoRailSetCopyPayload, proposeRails } from './physicsPaintRotoRailSetCopy';
import { isPhysicPaintRotoPhysicalEditSemanticDelta } from '../../../types/physicPaint';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function record(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({ kind: 'real-key', keyId, appFrame, payload: { frameIndex: 0, appFrame, dataUrl: PNG, width: 100, height: 80 } }) as PhysicPaintRotoRealKeyRecord;
}

function realDocument(): PhysicPaintRotoPhysicalDocument {
  const records = [
    record('038b50af-fc29-41d0-a3d9-cfc92f8f4813', 6),
    record('fd0e8766-1435-42c5-9134-07097353d6d7', 10),
    record('195d2dfc-f25b-49b1-9d83-61141a5fb1d5', 14),
    record('8df5ef21-d33b-4f38-9428-935794da69f5', 51),
    record('0b51ea34-c06a-4a74-8c22-a5bbad68b6c3', 55),
    record('e16533e3-37aa-4fda-a53d-f887f5647935', 59),
  ];
  const clip: PhysicPaintRotoLoopClip = {
    loopId: '5fac5efb-0726-4621-a42e-9497c2766ddc',
    placementStart: 6,
    sourceKeyIds: ['038b50af-fc29-41d0-a3d9-cfc92f8f4813', 'fd0e8766-1435-42c5-9134-07097353d6d7', '195d2dfc-f25b-49b1-9d83-61141a5fb1d5'],
    repeat: 2,
    mode: 'progressive',
    scriptId: '9fadaf63-7a81-4532-bb51-f7472821cb4a',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 6,
    originalEndExclusive: 24,
    visibleRanges: [{ start: 6, endExclusive: 24 }],
    frameOverrides: [],
  };
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: 100,
    realKeyRecords: records,
    interpolation: { enabled: true, mode: 'duplicate' },
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: '8df5ef21-d33b-4f38-9428-935794da69f5',
    cursorAppFrame: 51,
    revision: buildPhysicPaintRotoPhysicalRevision(records, { enabled: true, mode: 'duplicate' }, [clip], ['8df5ef21-d33b-4f38-9428-935794da69f5']),
    loopClips: [clip],
    incomingInterpolationBreakKeyIds: ['8df5ef21-d33b-4f38-9428-935794da69f5'],
  });
}

describe('46 UAT bad-semanticDelta regression (real document)', () => {
  it('paste impact with a finite loop member (effectiveEndExclusive) passes the semantic-delta validator', () => {
    const doc = realDocument();
    const built = buildRotoRailSetCopyPayload({ document: doc, members: [{ kind: 'loop', loopId: '5fac5efb-0726-4621-a42e-9497c2766ddc' }] });
    if (!built.ok) throw new Error('copy failed');
    const pasted = proposeRails({ document: doc, payload: built.payload, placementMode: 'paste', destinationAppFrame: 30 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`paste failed: ${pasted.reason}`);
    expect(isPhysicPaintRotoPhysicalEditSemanticDelta(pasted.impact)).toBe(true);
  });

  it('paste impact with an infinity loop member (effectiveEndExclusive + frozen repeat) passes the semantic-delta validator', () => {
    const records = [record('k0', 0), record('k5', 5), record('k24', 24)];
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'inf',
      placementStart: 0,
      sourceKeyIds: ['k0', 'k5'],
      repeat: 'infinity',
      mode: 'progressive',
    };
    const doc = parsePhysicPaintRotoPhysicalDocument({
      capacity: 100,
      realKeyRecords: records,
      interpolation: { enabled: true, mode: 'duplicate' },
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, { enabled: true, mode: 'duplicate' }, [clip], []),
      loopClips: [clip],
      incomingInterpolationBreakKeyIds: [],
    });
    const built = buildRotoRailSetCopyPayload({ document: doc, members: [{ kind: 'loop', loopId: 'inf' }] });
    if (!built.ok) throw new Error('copy failed');
    const member = built.payload.members[0];
    if (member.kind !== 'loop') throw new Error('expected loop member');
    expect(member.repeat).toBe(4); // frozen finite repeat present
    const pasted = proposeRails({ document: doc, payload: built.payload, placementMode: 'paste', destinationAppFrame: 40 });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`paste failed: ${pasted.reason}`);
    expect(isPhysicPaintRotoPhysicalEditSemanticDelta(pasted.impact)).toBe(true);
  });
});
