import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

function moveGeneration(projectDir: string, stagingBasename: string): void {
  const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
  const canonicalRoot = `${projectDir}/cache/efx-paint`;
  for (const key of Array.from(files.keys())) {
    if (key === canonicalRoot || key.startsWith(`${canonicalRoot}/`)) files.delete(key);
  }
  for (const key of Array.from(dirs.keys())) {
    if (key === canonicalRoot || key.startsWith(`${canonicalRoot}/`)) dirs.delete(key);
  }
  for (const [key, value] of Array.from(files.entries())) {
    if (key.startsWith(`${stagingRoot}/`)) {
      files.delete(key);
      files.set(`${canonicalRoot}${key.slice(stagingRoot.length)}`, value);
    }
  }
  for (const key of Array.from(dirs.keys())) {
    if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) {
      dirs.delete(key);
      dirs.add(`${canonicalRoot}${key.slice(stagingRoot.length)}`);
    }
  }
}

vi.mock('../../../lib/ipc', () => ({
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
  remove: vi.fn(async (path: string) => {
    for (const key of Array.from(files.keys())) {
      if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs.keys())) {
      if (key === path || key.startsWith(`${path}/`)) dirs.delete(key);
    }
  }),
  readFile: vi.fn(async (path: string) => {
    const file = files.get(path);
    if (!file) throw new Error(`missing file: ${path}`);
    return file;
  }),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    files.set(path, contents);
  }),
}));

import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  encodePhysicPaintRotoPhysicalContent,
  isPhysicPaintRotoLoopClip,
  parsePhysicPaintRotoLoopClips,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalDocument,
} from './physicsPaintRotoPhysicalModel';
import { proposePhysicPaintRotoGroupFramePaint } from './physicsPaintRotoGroupLifecycle';
import { isPhysicPaintRotoPhysicalEditApplyPayload } from '../../../types/physicPaint';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  loadEfxPaintDocuments,
  saveEfxPaintDocumentsWithProjectWrite,
  type EfxPaintDocumentSaveInput,
} from '../../../lib/efxPaintPersistence';

/** Minimal valid PNG data URL (real signature bytes) for canonical payloads. */
const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

const realKey = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: { frameIndex: 0, appFrame, dataUrl: pngDataUrl(`payload-${keyId}`), width: 10, height: 10 },
});

/** Source cycle: five real keys at physical frames 0/3/6/9/12. */
const SOURCE_KEY_IDS = ['k1', 'k2', 'k3', 'k4', 'k5'];
const sourceRecords = () => [0, 3, 6, 9, 12].map((appFrame, index) => realKey(SOURCE_KEY_IDS[index], appFrame));

const baseLoop = () => ({
  loopId: 'loop-1',
  placementStart: 0,
  sourceKeyIds: [...SOURCE_KEY_IDS],
  repeat: 5 as number | 'infinity',
  mode: 'progressive' as const,
});

const GROUP_FIELD_PARTICIPATION = [
  { field: 'syncState', value: 'modified' },
  { field: 'provenanceState', value: 'detached' },
  { field: 'phaseOrigin', value: 3 },
  { field: 'originalEndExclusive', value: 30 },
  { field: 'visibleRanges', value: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }] },
  { field: 'frameOverrides', value: [{ appFrame: 7, keyId: 'override-7' }] },
] as const;

const GROUP_LIFECYCLE_FIELDS = GROUP_FIELD_PARTICIPATION.map(({ field }) => field);

const GROUP_RECORD_AUTHORITY_FIELDS = [
  'loopId',
  'placementStart',
  'sourceKeyIds',
  'repeat',
  'mode',
  'scriptId',
  'motion',
  'overrideColor',
  ...GROUP_LIFECYCLE_FIELDS,
] as const;

const FORBIDDEN_SECOND_AUTHORITY_FIELDS = [
  'deletedFrameMask',
  'deletedAppFrames',
  'fragmentIds',
  'fragments',
  'groupBreakKeyIds',
  'blankKeySentinel',
] as const;

type ProposedGroupRecord = ReturnType<typeof baseLoop> & {
  syncState: 'synchronized' | 'modified';
  provenanceState: 'attached' | 'detached';
  phaseOrigin: number;
  originalEndExclusive: number;
  visibleRanges: readonly { start: number; endExclusive: number }[];
  frameOverrides: readonly { appFrame: number; keyId: string }[];
};

const proposedGroup = (overrides: Partial<ProposedGroupRecord> = {}): ProposedGroupRecord => ({
  ...baseLoop(),
  syncState: 'synchronized',
  provenanceState: 'attached',
  phaseOrigin: 0,
  originalEndExclusive: 25,
  visibleRanges: [{ start: 0, endExclusive: 25 }],
  frameOverrides: [],
  ...overrides,
});

function classifyProposedGroupFixture(record: ProposedGroupRecord): 'accepted' | 'malformed' {
  const ranges = record.visibleRanges;
  if (!Number.isSafeInteger(record.phaseOrigin)
    || !Number.isSafeInteger(record.originalEndExclusive)
    || record.originalEndExclusive <= record.phaseOrigin
    || ranges.length === 0) return 'malformed';

  let previousEnd = -1;
  for (const range of ranges) {
    if (!Number.isSafeInteger(range.start)
      || !Number.isSafeInteger(range.endExclusive)
      || range.start < record.phaseOrigin
      || range.endExclusive > record.originalEndExclusive
      || range.endExclusive <= range.start
      || range.start <= previousEnd) return 'malformed';
    previousEnd = range.endExclusive;
  }

  const overrideFrames = new Set<number>();
  const overrideKeyIds = new Set<string>();
  for (const override of record.frameOverrides) {
    if (!Number.isSafeInteger(override.appFrame)
      || override.appFrame < record.phaseOrigin
      || override.appFrame >= record.originalEndExclusive
      || override.keyId.length === 0
      || !ranges.some((range) => override.appFrame >= range.start && override.appFrame < range.endExclusive)
      || overrideFrames.has(override.appFrame)
      || overrideKeyIds.has(override.keyId)) return 'malformed';
    overrideFrames.add(override.appFrame);
    overrideKeyIds.add(override.keyId);
  }

  return 'accepted';
}

const baseDocument = (loopClips?: unknown) => {
  const realKeyRecords = sourceRecords();
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  // The canonical fingerprint covers loopClips (Q1). Malformed fixtures get a
  // placeholder revision: the document parser rejects the malformed member
  // before the revision check runs.
  const revision = (() => {
    try {
      return buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, Array.isArray(loopClips) ? loopClips : []);
    } catch {
      return 'invalid-fixture-revision';
    }
  })();
  return {
    capacity: 600,
    realKeyRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision,
    incomingInterpolationBreakKeyIds: [],
    ...(loopClips !== undefined ? { loopClips } : {}),
  };
};

const runtimeOutput = (document: ReturnType<typeof baseDocument>): Map<string, EfxPaintDocumentSaveInput> => {
  const efxDocument = createEfxPaintDocument('physic layer/1');
  const track = efxDocument.tracks[0];
  return new Map([['physic layer/1', {
    document: {
      ...efxDocument,
      tracks: [{ ...track, rotoPhysical: parsePhysicPaintRotoPhysicalDocument(document) }],
    },
    frames: new Map(),
  }]]);
};

const applyPayload = (loopClips?: unknown) => ({
  kind: 'replace-roto-physical-map' as const,
  trackId: 'track-1',
  operationId: 'op-1',
  operationKind: 'move-key' as const,
  leaseToken: {
    projectContextId: 'project-1',
    layerId: 'layer-1',
    generation: 1,
    owner: 'exclusive' as const,
  },
  intent: {
    kind: 'move-key' as const,
    movedKeyId: 'A',
    target: { kind: 'physical-cell' as const, appFrame: 0 },
  },
  layerId: 'layer-1',
  startFrame: 0,
  launchOperationId: 'launch-1',
  projectContextId: 'project-1',
  expectedRevision: 'revision-1',
  records: sourceRecords().map(({ keyId, appFrame, payload }) => ({ keyId, appFrame, payload })),
  interpolationEnabled: false,
  interpolationMode: 'duplicate' as const,
  selectedKeyId: null,
  selectedAppFrame: null,
  cursorAppFrame: 0,
  ...(loopClips !== undefined ? { loopClips } : {}),
});

describe('isPhysicPaintRotoLoopClip / parsePhysicPaintRotoLoopClips', () => {
  it('accepts a well-formed record and parses a frozen collection', () => {
    expect(isPhysicPaintRotoLoopClip(baseLoop())).toBe(true);
    const parsed = parsePhysicPaintRotoLoopClips([baseLoop()]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(proposedGroup());
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed[0])).toBe(true);
    expect(Object.isFrozen(parsed[0].sourceKeyIds)).toBe(true);
  });

  it('throws on non-array input', () => {
    expect(() => parsePhysicPaintRotoLoopClips('loops')).toThrow();
    expect(() => parsePhysicPaintRotoLoopClips({ loopId: 'loop-1' })).toThrow();
    expect(() => parsePhysicPaintRotoLoopClips(null)).toThrow();
  });

  it.each(['loopId', 'placementStart', 'sourceKeyIds', 'repeat', 'mode'])('throws when %s is missing', (key) => {
    const record: Record<string, unknown> = { ...baseLoop() };
    delete record[key];
    expect(isPhysicPaintRotoLoopClip(record)).toBe(false);
    expect(() => parsePhysicPaintRotoLoopClips([record])).toThrow();
  });

  it.each([
    ['canonicalStart', 0],
    ['effectiveDuration', 25],
    ['requestedDuration', 25],
    ['resolvedFrames', [0, 1]],
    ['nextBoundary', 25],
  ])('throws on unknown or derived key %s (fail-closed, no compatibility alias, no derived state)', (key, value) => {
    const record = { ...baseLoop(), [key]: value };
    expect(isPhysicPaintRotoLoopClip(record)).toBe(false);
    expect(() => parsePhysicPaintRotoLoopClips([record])).toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, '5', 'forever', null, true])('throws on invalid repeat %j', (repeat) => {
    const record = { ...baseLoop(), repeat };
    expect(isPhysicPaintRotoLoopClip(record)).toBe(false);
    expect(() => parsePhysicPaintRotoLoopClips([record])).toThrow();
  });

  it('accepts the explicit infinity repeat state', () => {
    const record = { ...baseLoop(), repeat: 'infinity' as const };
    expect(isPhysicPaintRotoLoopClip(record)).toBe(true);
    const parsed = parsePhysicPaintRotoLoopClips([record]);
    expect(parsed[0].repeat).toBe('infinity');
  });

  it('throws on empty sourceKeyIds and on malformed source keyIds', () => {
    expect(() => parsePhysicPaintRotoLoopClips([{ ...baseLoop(), sourceKeyIds: [] }])).toThrow();
    expect(() => parsePhysicPaintRotoLoopClips([{ ...baseLoop(), sourceKeyIds: [''] }])).toThrow();
    expect(() => parsePhysicPaintRotoLoopClips([{ ...baseLoop(), sourceKeyIds: [1] }])).toThrow();
  });

  it('throws on negative or non-integer placementStart', () => {
    expect(() => parsePhysicPaintRotoLoopClips([{ ...baseLoop(), placementStart: -1 }])).toThrow();
    expect(() => parsePhysicPaintRotoLoopClips([{ ...baseLoop(), placementStart: 1.5 }])).toThrow();
  });

  it('throws on an unknown mode', () => {
    expect(() => parsePhysicPaintRotoLoopClips([{ ...baseLoop(), mode: 'ping-pong' }])).toThrow();
  });

  it('throws on duplicate loopId', () => {
    expect(() => parsePhysicPaintRotoLoopClips([baseLoop(), baseLoop()])).toThrow();
  });

  // 43-06: optional source-cycle provenance (scriptId + Motion + resolved
  // override color) — required by the S3 source-edit prefill and the S4
  // Link/Create matching (D-02/D-05; D-29 "provenance required by the
  // approved UI"). All-or-nothing: any provenance key requires all three.
  describe('source-cycle provenance (43-06)', () => {
    const provenance = { scriptId: 'script-1', motion: { deformation: 5, position: 10 }, overrideColor: '#a1b2c3' };

    it('accepts and round-trips a record carrying full provenance, frozen', () => {
      const record = { ...baseLoop(), ...provenance };
      expect(isPhysicPaintRotoLoopClip(record)).toBe(true);
      const parsed = parsePhysicPaintRotoLoopClips([record]);
      expect(parsed[0]).toEqual({ ...proposedGroup(), ...provenance });
      expect(Object.isFrozen(parsed[0].motion)).toBe(true);
    });

    it('accepts an explicit null overrideColor (Original-colors provenance)', () => {
      const record = { ...baseLoop(), ...provenance, overrideColor: null };
      expect(isPhysicPaintRotoLoopClip(record)).toBe(true);
      expect(parsePhysicPaintRotoLoopClips([record])[0].overrideColor).toBeNull();
    });

    it.each(['scriptId', 'motion', 'overrideColor'])('rejects partial provenance missing %s (all-or-nothing)', (key) => {
      const record: Record<string, unknown> = { ...baseLoop(), ...provenance };
      delete record[key];
      expect(isPhysicPaintRotoLoopClip(record)).toBe(false);
      expect(() => parsePhysicPaintRotoLoopClips([record])).toThrow();
    });

    it('rejects malformed provenance members', () => {
      expect(isPhysicPaintRotoLoopClip({ ...baseLoop(), ...provenance, scriptId: '' })).toBe(false);
      expect(isPhysicPaintRotoLoopClip({ ...baseLoop(), ...provenance, motion: { deformation: 5 } })).toBe(false);
      expect(isPhysicPaintRotoLoopClip({ ...baseLoop(), ...provenance, motion: { deformation: 5, position: 10, extra: 1 } })).toBe(false);
      expect(isPhysicPaintRotoLoopClip({ ...baseLoop(), ...provenance, overrideColor: 'red' })).toBe(false);
      expect(isPhysicPaintRotoLoopClip({ ...baseLoop(), ...provenance, overrideColor: '#abc' })).toBe(false);
    });

    it('provenance joins the canonical revision fingerprint', () => {
      const records = sourceRecords();
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      const without = buildPhysicPaintRotoPhysicalRevision(records, interpolation, [baseLoop()]);
      const withProvenance = buildPhysicPaintRotoPhysicalRevision(records, interpolation, [{ ...baseLoop(), ...provenance }]);
      const otherColor = buildPhysicPaintRotoPhysicalRevision(records, interpolation, [{ ...baseLoop(), ...provenance, overrideColor: '#ffffff' }]);
      expect(withProvenance).not.toBe(without);
      expect(otherColor).not.toBe(withProvenance);
    });

    it('persists provenance byte-identically through save and reopen', async () => {
      const document = baseDocument([{ ...baseLoop(), ...provenance }]);
      const parsed = parsePhysicPaintRotoPhysicalDocument(document);
      expect(parsed.loopClips[0]).toMatchObject(provenance);
    });
  });

  describe('Phase 43.2 Group lifecycle and source-phase Paint tracer', () => {
    const lifecycleFixtures = [
      { name: 'synchronized Group', record: proposedGroup() },
      { name: 'modified Group', record: proposedGroup({ syncState: 'modified' }) },
      { name: 'detached Group', record: proposedGroup({ provenanceState: 'detached' }) },
      {
        name: 'same-identity Group with multiple visible ranges',
        record: proposedGroup({
          syncState: 'modified',
          visibleRanges: [
            { start: 0, endExclusive: 7 },
            { start: 8, endExclusive: 25 },
          ],
        }),
      },
    ] as const;

    it.each(lifecycleFixtures)('accepts and deeply freezes $name', ({ record }) => {
      expect(classifyProposedGroupFixture(record)).toBe('accepted');
      expect(isPhysicPaintRotoLoopClip(record)).toBe(true);
      const [parsed] = parsePhysicPaintRotoLoopClips([record]);
      expect(parsed).toEqual(record);
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(Object.isFrozen(parsed.sourceKeyIds)).toBe(true);
      expect(Object.isFrozen(parsed.visibleRanges)).toBe(true);
      expect(Object.isFrozen(parsed.visibleRanges?.[0])).toBe(true);
      expect(Object.isFrozen(parsed.frameOverrides)).toBe(true);
      expect(Object.isFrozen(parsed.frameOverrides?.[0])).toBe(true);
    });

    it('hydrates absent additive lifecycle fields to one synchronized attached contiguous Group', () => {
      const legacyRecord = baseLoop();
      expect(isPhysicPaintRotoLoopClip(legacyRecord)).toBe(true);
      expect(parsePhysicPaintRotoLoopClips([legacyRecord])).toEqual([proposedGroup()]);
      for (const field of GROUP_LIFECYCLE_FIELDS) expect(field in legacyRecord).toBe(false);
    });

    it.each(GROUP_FIELD_PARTICIPATION)('rejects a partial lifecycle carrying only $field', ({ field, value }) => {
      const candidate = { ...baseLoop(), [field]: value };
      expect(isPhysicPaintRotoLoopClip(candidate)).toBe(false);
      expect(() => parsePhysicPaintRotoLoopClips([candidate])).toThrow();
    });

    it.each([
      {
        name: 'overlapping ranges',
        record: proposedGroup({ visibleRanges: [{ start: 0, endExclusive: 8 }, { start: 7, endExclusive: 25 }] }),
      },
      {
        name: 'adjacent unnormalized ranges',
        record: proposedGroup({ visibleRanges: [{ start: 0, endExclusive: 7 }, { start: 7, endExclusive: 25 }] }),
      },
      {
        name: 'out-of-order ranges',
        record: proposedGroup({ visibleRanges: [{ start: 8, endExclusive: 25 }, { start: 0, endExclusive: 7 }] }),
      },
      {
        name: 'range outside the original extent',
        record: proposedGroup({ visibleRanges: [{ start: 0, endExclusive: 26 }] }),
      },
      {
        name: 'duplicate override frame',
        record: proposedGroup({ frameOverrides: [{ appFrame: 7, keyId: 'override-7' }, { appFrame: 7, keyId: 'override-8' }] }),
      },
      {
        name: 'duplicate override key identity',
        record: proposedGroup({ frameOverrides: [{ appFrame: 7, keyId: 'override-7' }, { appFrame: 8, keyId: 'override-7' }] }),
      },
      {
        name: 'override outside every visible range',
        record: proposedGroup({
          visibleRanges: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }],
          frameOverrides: [{ appFrame: 7, keyId: 'override-7' }],
        }),
      },
    ])('rejects malformed $name', ({ record }) => {
      expect(classifyProposedGroupFixture(record)).toBe('malformed');
      expect(isPhysicPaintRotoLoopClip(record)).toBe(false);
      expect(() => parsePhysicPaintRotoLoopClips([record])).toThrow();
    });

    it('creates one frozen source-phase override while preserving every unaffected byte', () => {
      const group = proposedGroup({
        visibleRanges: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }],
      });
      const otherGroup = proposedGroup({ loopId: 'loop-2', placementStart: 30, phaseOrigin: 30, originalEndExclusive: 55, visibleRanges: [{ start: 30, endExclusive: 55 }] });
      const document = parsePhysicPaintRotoPhysicalDocument(baseDocument([group, otherGroup]));
      const beforeSourceBytes = document.realKeyRecords.map((record) => record.payload.dataUrl);
      const beforeOtherGroup = JSON.stringify(document.loopClips[1]);

      const result = proposePhysicPaintRotoGroupFramePaint({
        document,
        groupId: 'loop-1',
        appFrame: 7,
        overrideKeyId: 'override-7',
        renderedPayload: { frameIndex: 0, appFrame: 7, dataUrl: pngDataUrl('painted-7'), width: 10, height: 10 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.proposal.loopClips[0]).toMatchObject({
        loopId: 'loop-1',
        syncState: 'modified',
        visibleRanges: [{ start: 0, endExclusive: 25 }],
        frameOverrides: [{ appFrame: 7, keyId: 'override-7' }],
      });
      expect(result.proposal.realKeyRecords
        .filter((record) => SOURCE_KEY_IDS.includes(record.keyId))
        .map((record) => record.payload.dataUrl)).toEqual(beforeSourceBytes);
      expect(JSON.stringify(result.proposal.loopClips[1])).toBe(beforeOtherGroup);
      expect(result.impact).toEqual({
        kind: 'paint-group-frame',
        groupId: 'loop-1',
        appFrame: 7,
        phaseAppFrame: 7,
        affectedAppFrames: [7, 20],
        overrideKeyId: 'override-7',
        createdOverride: true,
        filledDeletedOccurrence: true,
        previousRevision: document.revision,
        nextRevision: result.proposal.revision,
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.proposal)).toBe(true);
      expect(Object.isFrozen(result.impact)).toBe(true);
    });

    it('paints an original source-frame occurrence through a separate override record without moving or mutating the source cycle', () => {
      const group = proposedGroup();
      const sharedGroup = proposedGroup({
        loopId: 'loop-shared',
        placementStart: 30,
        phaseOrigin: 30,
        originalEndExclusive: 55,
        visibleRanges: [{ start: 30, endExclusive: 55 }],
      });
      const document = parsePhysicPaintRotoPhysicalDocument(baseDocument([group, sharedGroup]));
      const beforeRecords = document.realKeyRecords;

      const result = proposePhysicPaintRotoGroupFramePaint({
        document,
        groupId: 'loop-1',
        appFrame: 0,
        overrideKeyId: 'override-0',
        renderedPayload: { frameIndex: 0, appFrame: 0, dataUrl: pngDataUrl('painted-0'), width: 10, height: 10 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.proposal.realKeyRecords).toEqual(beforeRecords);
      expect((result.proposal as PhysicPaintRotoPhysicalDocument & {
        readonly groupOverrideRecords: readonly ReturnType<typeof realKey>[];
      }).groupOverrideRecords).toEqual([{
        kind: 'real-key',
        keyId: 'override-0',
        appFrame: 0,
        payload: { frameIndex: 0, appFrame: 0, dataUrl: pngDataUrl('painted-0'), width: 10, height: 10 },
      }]);
      expect(result.proposal.loopClips[0].frameOverrides).toEqual([{ appFrame: 0, keyId: 'override-0' }]);
      expect(result.proposal.loopClips[1]).toEqual(document.loopClips[1]);
    });

    it('rejects duplicate IDs, ambiguous sharing, unresolved precedence, and cleanup mismatch before acceptance', () => {
      const base = proposedGroup();
      const validDocument = parsePhysicPaintRotoPhysicalDocument(baseDocument([base]));
      const operation = {
        document: validDocument,
        groupId: 'loop-1',
        appFrame: 4,
        overrideKeyId: 'override-4',
        renderedPayload: { frameIndex: 0, appFrame: 4, dataUrl: pngDataUrl('painted-4'), width: 10, height: 10 },
      } as const;

      expect(proposePhysicPaintRotoGroupFramePaint({ ...operation, overrideKeyId: 'k1' })).toMatchObject({ ok: false, reason: 'duplicate-override-key-id' });
      expect(proposePhysicPaintRotoGroupFramePaint({ ...operation, unresolvedPrecedence: true })).toMatchObject({ ok: false, reason: 'unresolved-precedence' });
      expect(proposePhysicPaintRotoGroupFramePaint({ ...operation, claimedCleanupKeyIds: ['k1'] })).toMatchObject({ ok: false, reason: 'cleanup-reference-mismatch' });

      const ambiguous = baseDocument([
        base,
        proposedGroup({ loopId: 'loop-2', sourceKeyIds: ['k2', 'k1', 'k3', 'k4', 'k5'], placementStart: 30, phaseOrigin: 30, originalEndExclusive: 55, visibleRanges: [{ start: 30, endExclusive: 55 }] }),
      ]);
      expect(() => parsePhysicPaintRotoPhysicalDocument(ambiguous)).toThrow('ambiguous source sharing');
    });

    it('enumerates one Group record authority with visible-range gaps and no hidden deletion or fragment field', () => {
      const fragmented = lifecycleFixtures[3].record;
      expect(Object.keys(fragmented).sort()).toEqual([...GROUP_RECORD_AUTHORITY_FIELDS]
        .filter((field) => field in fragmented)
        .sort());
      for (const forbidden of FORBIDDEN_SECOND_AUTHORITY_FIELDS) expect(forbidden in fragmented).toBe(false);
      expect('incomingInterpolationBreakKeyIds' in fragmented).toBe(false);
    });
  });
});

describe('parsePhysicPaintRotoPhysicalDocument loopClips member', () => {
  it('loads a v0.8.1-shaped document (no loopClips member) as an empty collection with no migration and no error', () => {
    const document = parsePhysicPaintRotoPhysicalDocument(baseDocument());
    expect(document.loopClips).toEqual([]);
    // The empty collection contributes no fingerprint term, so a legacy
    // loop-free revision remains canonical after the Phase 43 upgrade.
    expect(encodePhysicPaintRotoPhysicalContent(document.realKeyRecords, document.interpolation, [])).not.toContain('loops:');
    expect(encodePhysicPaintRotoPhysicalContent(document.realKeyRecords, document.interpolation, [baseLoop()])).toContain('loops:');
  });

  it('hydrates one legacy loop clip to the same complete canonical Group on reopen', () => {
    const loop = baseLoop();
    const canonical = proposedGroup();
    const first = parsePhysicPaintRotoPhysicalDocument(baseDocument([loop]));
    expect(first.loopClips).toEqual([canonical]);

    const reopened = parsePhysicPaintRotoPhysicalDocument(JSON.parse(JSON.stringify({
      ...baseDocument([loop]),
      revision: first.revision,
    })));
    expect(JSON.stringify(reopened.loopClips)).toBe(JSON.stringify([canonical]));
  });

  it('round-trips a duplicated linked loop whose placement is independent from its source location', () => {
    // Duplicated loop: placementStart 40 is a chosen destination frame; the
    // shared source keys stay at physical frames 0/3/6/9/12. Placement and
    // source location are independent persisted identities.
    const duplicate = { ...baseLoop(), loopId: 'loop-dup', placementStart: 40 };
    const parsed = parsePhysicPaintRotoPhysicalDocument(baseDocument([baseLoop(), duplicate]));
    expect(parsed.loopClips).toHaveLength(2);
    expect(parsed.loopClips[1].placementStart).toBe(40);
    expect(parsed.loopClips[1].sourceKeyIds).toEqual(SOURCE_KEY_IDS);
    expect(parsed.loopClips[1]).toEqual(proposedGroup({
      loopId: 'loop-dup',
      placementStart: 40,
      phaseOrigin: 40,
      originalEndExclusive: 65,
      visibleRanges: [{ start: 40, endExclusive: 65 }],
    }));
  });

  it('throws when the loopClips member is structurally malformed', () => {
    expect(() => parsePhysicPaintRotoPhysicalDocument(baseDocument('loops'))).toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(baseDocument([{ ...baseLoop(), repeat: 0 }]))).toThrow();
  });

  it('loads well-formed records with dangling source keyIds and preserves them verbatim', () => {
    const dangling = { ...baseLoop(), loopId: 'loop-dangling', sourceKeyIds: ['ghost-1', 'ghost-2'] };
    const parsed = parsePhysicPaintRotoPhysicalDocument(baseDocument([dangling]));
    expect(parsed.loopClips[0].sourceKeyIds).toEqual(['ghost-1', 'ghost-2']);
    expect(parsed.loopClips[0]).toEqual({
      ...dangling,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 10,
      visibleRanges: [{ start: 0, endExclusive: 10 }],
      frameOverrides: [],
    });
  });

  it('persists the infinity repeat state as the explicit string, never as a number', () => {
    const infinite = { ...baseLoop(), repeat: 'infinity' as const };
    const parsed = parsePhysicPaintRotoPhysicalDocument(baseDocument([infinite]));
    expect(parsed.loopClips[0].repeat).toBe('infinity');
    expect(JSON.stringify(parsed.loopClips[0])).toContain('"infinity"');
  });
});

describe('parsePhysicPaintRotoPhysicalDocument incoming interpolation breaks', () => {
  it('hydrates absent ownership to the shared frozen empty collection', () => {
    const persisted = baseDocument();
    delete (persisted as Partial<typeof persisted>).incomingInterpolationBreakKeyIds;

    const parsed = parsePhysicPaintRotoPhysicalDocument(persisted);

    expect(parsed.incomingInterpolationBreakKeyIds).toEqual([]);
    expect(Object.isFrozen(parsed.incomingInterpolationBreakKeyIds)).toBe(true);
  });

  it('round-trips valid ownership and rejects malformed duplicate or orphan owners', () => {
    const valid = {
      ...baseDocument(),
      incomingInterpolationBreakKeyIds: ['k3'],
    };
    valid.revision = buildPhysicPaintRotoPhysicalRevision(
      valid.realKeyRecords,
      valid.interpolation,
      valid.loopClips ?? [],
      valid.incomingInterpolationBreakKeyIds,
    );
    const parsed = parsePhysicPaintRotoPhysicalDocument(JSON.parse(JSON.stringify(valid)));
    expect(JSON.stringify(parsed.incomingInterpolationBreakKeyIds)).toBe(JSON.stringify(['k3']));
    expect(Object.isFrozen(parsed.incomingInterpolationBreakKeyIds)).toBe(true);

    for (const incomingInterpolationBreakKeyIds of ['k3', ['k3', 'k3'], ['missing-key']]) {
      const malformed = { ...baseDocument(), incomingInterpolationBreakKeyIds };
      expect(() => parsePhysicPaintRotoPhysicalDocument(malformed)).toThrow();
    }
  });

  it('keeps empty revisions byte-stable while non-empty ownership changes revision and project equality', () => {
    const empty = baseDocument();
    const owned = { ...baseDocument(), incomingInterpolationBreakKeyIds: ['k3'] };
    owned.revision = buildPhysicPaintRotoPhysicalRevision(
      owned.realKeyRecords,
      owned.interpolation,
      owned.loopClips ?? [],
      owned.incomingInterpolationBreakKeyIds,
    );

    expect(empty.revision).toBe(buildPhysicPaintRotoPhysicalRevision(empty.realKeyRecords, empty.interpolation, []));
    expect(owned.revision).not.toBe(empty.revision);
    expect(buildPhysicPaintRotoProjectEquality(owned)).not.toBe(buildPhysicPaintRotoProjectEquality(empty));
  });
});

function saveDocuments(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
) {
  return saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, async () => {});
}

describe('v1.0 document persistence loopClips save/reopen', () => {
  beforeEach(() => {
    files.clear();
    dirs.clear();
    publishPhysicPaintCacheGeneration.mockReset();
    publishPhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, stagingBasename: string) => {
      moveGeneration(projectDir, stagingBasename);
      return {
        ok: true,
        data: { accepted: true, transactionId: crypto.randomUUID(), replacedExisting: false },
      };
    });
    settlePhysicPaintCacheGeneration.mockResolvedValue({
      ok: true,
      data: { accepted: true, cleanupStatus: 'complete' },
    });
  });

  it('saves and reopens a lifecycle-complete Group byte-identically inside the physical document', async () => {
    const loop = baseLoop();
    const canonical = proposedGroup();
    const persisted = await saveDocuments('/project', runtimeOutput(baseDocument([loop])));

    const persistedDocument = (persisted['physic layer/1'] as { tracks: Array<{ rotoPhysical: { loopClips?: unknown } }> }).tracks[0].rotoPhysical;
    expect(persistedDocument.loopClips).toEqual([canonical]);
    // D-30: canonical Group authority persists without any derived loop state.
    expect(Object.keys((persistedDocument.loopClips as readonly object[])[0]).sort()).toEqual([
      'frameOverrides', 'loopId', 'mode', 'originalEndExclusive', 'phaseOrigin',
      'placementStart', 'provenanceState', 'repeat', 'sourceKeyIds', 'syncState', 'visibleRanges',
    ]);

    const hydrated = await loadEfxPaintDocuments('/project', persisted);
    expect(hydrated.get('physic layer/1')?.document.tracks[0].rotoPhysical?.loopClips).toEqual([canonical]);
  });

  it('saves and reopens a duplicated linked loop with placement independent from source location', async () => {
    const duplicate = { ...baseLoop(), loopId: 'loop-dup', placementStart: 40 };
    const persisted = await saveDocuments('/project', runtimeOutput(baseDocument([duplicate])));
    const hydrated = await loadEfxPaintDocuments('/project', persisted);
    expect(hydrated.get('physic layer/1')?.document.tracks[0].rotoPhysical?.loopClips).toEqual([proposedGroup({
      loopId: 'loop-dup',
      placementStart: 40,
      phaseOrigin: 40,
      originalEndExclusive: 65,
      visibleRanges: [{ start: 40, endExclusive: 65 }],
    })]);
  });

  it('loads a v0.8.1-shaped persisted document (loopClips member absent) as an empty collection', async () => {
    // A genuine v0.8.1 document carries no loopClips member and a legacy
    // loop-free revision; the empty collection contributes no fingerprint
    // term, so the legacy revision stays canonical (D-29, no migration).
    const persisted = await saveDocuments('/project', runtimeOutput(baseDocument()));
    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    const legacyDocument = (legacy['physic layer/1'] as { tracks: Array<{ rotoPhysical: Record<string, unknown> }> }).tracks[0].rotoPhysical;
    delete legacyDocument.loopClips;

    const hydrated = await loadEfxPaintDocuments('/project', legacy);
    expect(hydrated.get('physic layer/1')?.document.tracks[0].rotoPhysical?.loopClips).toEqual([]);
  });

  it('preserves dangling source keyIds verbatim through save and reopen', async () => {
    const dangling = { ...baseLoop(), sourceKeyIds: ['ghost-1', 'ghost-2'] };
    const persisted = await saveDocuments('/project', runtimeOutput(baseDocument([dangling])));
    const hydrated = await loadEfxPaintDocuments('/project', persisted);
    expect(hydrated.get('physic layer/1')?.document.tracks[0].rotoPhysical?.loopClips).toEqual([{
      ...dangling,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 10,
      visibleRanges: [{ start: 0, endExclusive: 10 }],
      frameOverrides: [],
    }]);
  });

  it('round-trips the infinity repeat state as the explicit string', async () => {
    const infinite = { ...baseLoop(), repeat: 'infinity' as const };
    const persisted = await saveDocuments('/project', runtimeOutput(baseDocument([infinite])));
    const hydrated = await loadEfxPaintDocuments('/project', persisted);
    expect(hydrated.get('physic layer/1')?.document.tracks[0].rotoPhysical?.loopClips[0].repeat).toBe('infinity');
  });

  it('fails closed on a structurally malformed persisted loopClips member', async () => {
    const persisted = await saveDocuments('/project', runtimeOutput(baseDocument([baseLoop()])));
    const malformed = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    (malformed['physic layer/1'] as { tracks: Array<{ rotoPhysical: Record<string, unknown> }> }).tracks[0].rotoPhysical.loopClips = 'loops';
    await expect(loadEfxPaintDocuments('/project', malformed)).rejects.toThrow();

    const malformedRecord = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    (malformedRecord['physic layer/1'] as { tracks: Array<{ rotoPhysical: Record<string, unknown> }> }).tracks[0].rotoPhysical.loopClips = [{ ...baseLoop(), canonicalStart: 0 }];
    await expect(loadEfxPaintDocuments('/project', malformedRecord)).rejects.toThrow();
  });
});

describe('apply payload loopClips allowlist', () => {
  it('accepts a commit payload carrying a valid loopClips collection', () => {
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload([proposedGroup()]))).toBe(true);
  });

  it('rejects a commit payload whose loopClips member is malformed', () => {
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload('loops'))).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload([{ ...baseLoop(), repeat: 0 }]))).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload([{ ...baseLoop(), canonicalStart: 0 }]))).toBe(false);
  });

  it('still rejects unknown sibling keys when loopClips is present', () => {
    const payload = { ...applyPayload([proposedGroup()]), unexpected: true };
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(false);
  });
});
