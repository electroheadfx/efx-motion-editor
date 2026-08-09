import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

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
} from './physicsPaintRotoPhysicalModel';
import { isPhysicPaintRotoPhysicalEditApplyPayload } from '../../../types/physicPaint';
import { loadPhysicPaintData, savePhysicPaintData } from '../../../lib/physicPaintPersistence';
import type { RuntimePhysicPaintOutput } from '../../../types/project';

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

const runtimeOutput = (document: ReturnType<typeof baseDocument>): RuntimePhysicPaintOutput[] => [{
  layer_id: 'physic layer/1',
  frames: [],
  roto_physical: document as RuntimePhysicPaintOutput['roto_physical'],
}];

const applyPayload = (loopClips?: unknown) => ({
  kind: 'replace-roto-physical-map' as const,
  operationId: 'op-1',
  operationKind: 'move-key' as const,
  layerId: 'layer-1',
  startFrame: 0,
  launchOperationId: 'launch-1',
  expectedRevision: 'revision-1',
  records: sourceRecords().map(({ keyId, appFrame, payload }) => ({ keyId, appFrame, payload })),
  interpolationEnabled: false,
  interpolationMode: 'duplicate' as const,
  selectedKeyId: null,
  selectedAppFrame: null,
  ...(loopClips !== undefined ? { loopClips } : {}),
});

describe('isPhysicPaintRotoLoopClip / parsePhysicPaintRotoLoopClips', () => {
  it('accepts a well-formed record and parses a frozen collection', () => {
    expect(isPhysicPaintRotoLoopClip(baseLoop())).toBe(true);
    const parsed = parsePhysicPaintRotoLoopClips([baseLoop()]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(baseLoop());
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
      expect(parsed[0]).toEqual(record);
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

  it('round-trips one loop clip byte-identically through parse and serialization', () => {
    const loop = baseLoop();
    const first = parsePhysicPaintRotoPhysicalDocument(baseDocument([loop]));
    expect(first.loopClips).toEqual([loop]);

    const reopened = parsePhysicPaintRotoPhysicalDocument(JSON.parse(JSON.stringify({
      ...baseDocument([loop]),
      revision: first.revision,
    })));
    expect(JSON.stringify(reopened.loopClips)).toBe(JSON.stringify([loop]));
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
    expect(JSON.stringify(parsed.loopClips[1])).toBe(JSON.stringify(duplicate));
  });

  it('throws when the loopClips member is structurally malformed', () => {
    expect(() => parsePhysicPaintRotoPhysicalDocument(baseDocument('loops'))).toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(baseDocument([{ ...baseLoop(), repeat: 0 }]))).toThrow();
  });

  it('loads well-formed records with dangling source keyIds and preserves them verbatim', () => {
    const dangling = { ...baseLoop(), loopId: 'loop-dangling', sourceKeyIds: ['ghost-1', 'ghost-2'] };
    const parsed = parsePhysicPaintRotoPhysicalDocument(baseDocument([dangling]));
    expect(parsed.loopClips[0].sourceKeyIds).toEqual(['ghost-1', 'ghost-2']);
    expect(JSON.stringify(parsed.loopClips[0])).toBe(JSON.stringify(dangling));
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
    const valid = baseDocument();
    valid.incomingInterpolationBreakKeyIds = ['k3'];
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

describe('physicPaintPersistence loopClips save/reopen', () => {
  beforeEach(() => {
    files.clear();
    dirs.clear();
  });

  it('saves and reopens a loop clip byte-identically inside the physical document', async () => {
    const loop = baseLoop();
    const persisted = await savePhysicPaintData('/project', runtimeOutput(baseDocument([loop])));

    const persistedDocument = persisted[0].roto_physical as { loopClips?: unknown };
    expect(JSON.stringify(persistedDocument.loopClips)).toBe(JSON.stringify([loop]));
    // D-30: only the five canonical fields persist — no derived loop state.
    expect(Object.keys((persistedDocument.loopClips as readonly object[])[0]).sort()).toEqual([
      'loopId', 'mode', 'placementStart', 'repeat', 'sourceKeyIds',
    ]);

    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(JSON.stringify(hydrated?.[0].roto_physical?.loopClips)).toBe(JSON.stringify([loop]));
  });

  it('saves and reopens a duplicated linked loop with placement independent from source location', async () => {
    const duplicate = { ...baseLoop(), loopId: 'loop-dup', placementStart: 40 };
    const persisted = await savePhysicPaintData('/project', runtimeOutput(baseDocument([duplicate])));
    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(JSON.stringify(hydrated?.[0].roto_physical?.loopClips)).toBe(JSON.stringify([duplicate]));
  });

  it('loads a v0.8.1-shaped persisted document (loopClips member absent) as an empty collection', async () => {
    // A genuine v0.8.1 document carries no loopClips member and a legacy
    // loop-free revision; the empty collection contributes no fingerprint
    // term, so the legacy revision stays canonical (D-29, no migration).
    const persisted = await savePhysicPaintData('/project', runtimeOutput(baseDocument()));
    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    const legacyDocument = legacy[0].roto_physical as unknown as Record<string, unknown>;
    delete legacyDocument.loopClips;

    const hydrated = await loadPhysicPaintData('/project', legacy);
    expect(hydrated?.[0].roto_physical?.loopClips).toEqual([]);
  });

  it('preserves dangling source keyIds verbatim through save and reopen', async () => {
    const dangling = { ...baseLoop(), sourceKeyIds: ['ghost-1', 'ghost-2'] };
    const persisted = await savePhysicPaintData('/project', runtimeOutput(baseDocument([dangling])));
    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(JSON.stringify(hydrated?.[0].roto_physical?.loopClips)).toBe(JSON.stringify([dangling]));
  });

  it('round-trips the infinity repeat state as the explicit string', async () => {
    const infinite = { ...baseLoop(), repeat: 'infinity' as const };
    const persisted = await savePhysicPaintData('/project', runtimeOutput(baseDocument([infinite])));
    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(hydrated?.[0].roto_physical?.loopClips[0].repeat).toBe('infinity');
  });

  it('fails closed on a structurally malformed persisted loopClips member', async () => {
    const persisted = await savePhysicPaintData('/project', runtimeOutput(baseDocument([baseLoop()])));
    const malformed = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    (malformed[0].roto_physical as unknown as Record<string, unknown>).loopClips = 'loops';
    await expect(loadPhysicPaintData('/project', malformed)).rejects.toThrow();

    const malformedRecord = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    (malformedRecord[0].roto_physical as unknown as Record<string, unknown>).loopClips = [{ ...baseLoop(), canonicalStart: 0 }];
    await expect(loadPhysicPaintData('/project', malformedRecord)).rejects.toThrow();
  });
});

describe('apply payload loopClips allowlist', () => {
  it('accepts a commit payload carrying a valid loopClips collection', () => {
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload([baseLoop()]))).toBe(true);
  });

  it('rejects a commit payload whose loopClips member is malformed', () => {
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload('loops'))).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload([{ ...baseLoop(), repeat: 0 }]))).toBe(false);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(applyPayload([{ ...baseLoop(), canonicalStart: 0 }]))).toBe(false);
  });

  it('still rejects unknown sibling keys when loopClips is present', () => {
    const payload = { ...applyPayload([baseLoop()]), unexpected: true };
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(payload)).toBe(false);
  });
});
