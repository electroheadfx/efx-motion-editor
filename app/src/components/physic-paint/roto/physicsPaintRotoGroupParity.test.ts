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
  for (const key of Array.from(dirs)) {
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
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoDeleteRails,
  proposePhysicPaintRotoGroupFramePaint,
  proposePhysicPaintRotoRegenerateGroup,
} from './physicsPaintRotoGroupLifecycle';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRotoPhysicalEditProposal,
} from './physicsPaintRotoPhysicalResolver';
import type { RailSetDeleteMember } from '../../../types/physicPaint';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  loadEfxPaintDocuments,
  saveEfxPaintDocumentsWithProjectWrite,
  type EfxPaintDocumentSaveInput,
} from '../../../lib/efxPaintPersistence';

const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

const realKey = (keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId,
  appFrame,
  payload: { frameIndex: 0, appFrame, dataUrl: pngDataUrl(`payload-${keyId}`), width: 10, height: 10 },
});

const MAIN_CYCLE = ['A', 'B', 'C'];
const SIBLING_CYCLE = ['D', 'E'];
const SIBLING_START = 30;

interface ParityCombo {
  readonly placementStart: number;
  readonly repeat: number;
}

const COMBOS: readonly ParityCombo[] = [
  { placementStart: 0, repeat: 1 },
  { placementStart: 0, repeat: 2 },
  { placementStart: 0, repeat: 3 },
  { placementStart: 10, repeat: 1 },
  { placementStart: 10, repeat: 2 },
  { placementStart: 10, repeat: 3 },
];

const comboExtent = (combo: ParityCombo) => ({
  start: combo.placementStart,
  endExclusive: combo.placementStart + MAIN_CYCLE.length * combo.repeat,
});

const lifecycleGroup = (
  loopId: string,
  placementStart: number,
  sourceKeyIds: readonly string[],
  repeat: number,
  scriptId: string,
): PhysicPaintRotoLoopClip => {
  const endExclusive = placementStart + sourceKeyIds.length * repeat;
  return {
    loopId,
    placementStart,
    sourceKeyIds: Object.freeze([...sourceKeyIds]),
    repeat,
    mode: 'progressive',
    scriptId,
    motion: Object.freeze({ deformation: 0, position: 0 }),
    overrideColor: null,
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: placementStart,
    originalEndExclusive: endExclusive,
    visibleRanges: Object.freeze([Object.freeze({ start: placementStart, endExclusive })]),
    frameOverrides: Object.freeze([]),
  };
};

function buildComboDocument(combo: ParityCombo) {
  const records = [
    ...MAIN_CYCLE.map((keyId, index) => realKey(keyId, combo.placementStart + index)),
    ...SIBLING_CYCLE.map((keyId, index) => realKey(keyId, SIBLING_START + index)),
  ];
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const loopClips = [
    lifecycleGroup('group-main', combo.placementStart, MAIN_CYCLE, combo.repeat, 'action-main'),
    lifecycleGroup('group-sibling', SIBLING_START, SIBLING_CYCLE, 1, 'action-sibling'),
  ];
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
    loopClips,
    incomingInterpolationBreakKeyIds: [],
  });
}

describe('Group parity matrix (placementStart × Repeat)', () => {
  describe.each(COMBOS)('placementStart $placementStart · Repeat $repeat', (combo) => {
    const extent = comboExtent(combo);
    const repeatedPhaseTarget = extent.start + MAIN_CYCLE.length + 1;
    const paintTarget = combo.repeat > 1 ? repeatedPhaseTarget : extent.start + 1;
    const expectedAffectedPhases = Array.from({ length: combo.repeat }, (_, index) => extent.start + 1 + index * MAIN_CYCLE.length);

    it('derives one extent spanning every repeat from the phase origin', () => {
      const document = buildComboDocument(combo);
      const context = derivePhysicPaintRotoLoopRanges({
        identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        loopClips: document.loopClips,
        capacity: 600,
        interpolationEnabled: false,
      });
      const mainRange = context.ranges.find((range) => range.loopId === 'group-main');
      expect(mainRange).toMatchObject({
        placementStart: extent.start,
        phaseOrigin: extent.start,
        cycleLength: MAIN_CYCLE.length,
        repeat: combo.repeat,
        requestedEnd: extent.endExclusive,
        effectiveEnd: extent.endExclusive,
        truncated: false,
        unresolved: null,
      });
    });

    it('paints one phase across every repeat and leaves the sibling Group and Action untouched', () => {
      const document = buildComboDocument(combo);
      const siblingBefore = JSON.stringify(document.loopClips[1]);
      const sourceBytesBefore = document.realKeyRecords.map((record) => record.payload.dataUrl);

      const result = proposePhysicPaintRotoGroupFramePaint({
        document,
        groupId: 'group-main',
        appFrame: paintTarget,
        overrideKeyId: 'override-main',
        renderedPayload: { frameIndex: 0, appFrame: paintTarget, dataUrl: pngDataUrl('painted'), width: 10, height: 10 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.impact).toMatchObject({
        kind: 'paint-group-frame',
        appFrame: paintTarget,
        affectedAppFrames: expectedAffectedPhases,
        overrideKeyId: 'override-main',
      });
      expect(result.proposal.loopClips[0]).toMatchObject({
        syncState: 'modified',
        frameOverrides: [{ appFrame: extent.start + 1, keyId: 'override-main' }],
      });
      expect(result.proposal.realKeyRecords.map((record) => record.payload.dataUrl)).toEqual(sourceBytesBefore);
      expect(JSON.stringify(result.proposal.loopClips[1])).toBe(siblingBefore);
    });

    it('deletes one phase across every repeat, marks matching cells as gray gaps, and rejects a repeat delete without mutation', () => {
      const document = buildComboDocument(combo);
      const siblingBefore = JSON.stringify(document.loopClips[1]);

      const result = proposePhysicPaintRotoDeleteGroupFrame({
        document,
        groupId: 'group-main',
        appFrame: paintTarget,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.impact.affectedAppFrames).toEqual(expectedAffectedPhases);
      expect(result.proposal.loopClips[0].syncState).toBe('modified');
      expect(result.proposal.loopClips[0].visibleRanges).toHaveLength(combo.repeat + 1);
      expect(JSON.stringify(result.proposal.loopClips[1])).toBe(siblingBefore);

      for (const gapFrame of expectedAffectedPhases) {
        expect(classifyPhysicPaintRotoGroupFrameTarget({
          document: result.proposal,
          appFrame: gapFrame,
        }).kind).toBe('group-gap');
      }

      const proposalBefore = JSON.stringify(result.proposal);
      const rejected = proposePhysicPaintRotoDeleteGroupFrame({
        document: result.proposal,
        groupId: 'group-main',
        appFrame: paintTarget,
      });
      expect(rejected).toMatchObject({ ok: false, reason: 'frame-not-visible' });
      expect(JSON.stringify(result.proposal)).toBe(proposalBefore);
    });

    it('regenerates back to one synchronized contiguous range and clears local overrides', () => {
      const document = buildComboDocument(combo);
      const painted = proposePhysicPaintRotoGroupFramePaint({
        document,
        groupId: 'group-main',
        appFrame: paintTarget,
        overrideKeyId: 'override-main',
        renderedPayload: { frameIndex: 0, appFrame: paintTarget, dataUrl: pngDataUrl('painted'), width: 10, height: 10 },
      });
      expect(painted.ok).toBe(true);
      if (!painted.ok) return;

      const regenerated = proposePhysicPaintRotoRegenerateGroup({
        document: painted.proposal,
        groupId: 'group-main',
        expectedActionRevision: 'action-revision-1',
        currentActionRevision: 'action-revision-1',
      });

      expect(regenerated.ok).toBe(true);
      if (!regenerated.ok) return;
      expect(regenerated.proposal.loopClips[0]).toMatchObject({
        syncState: 'synchronized',
        provenanceState: 'attached',
        visibleRanges: [{ start: extent.start, endExclusive: extent.endExclusive }],
        frameOverrides: [],
      });
      expect(regenerated.impact.cleanupKeyIds).toContain('override-main');
    });

    it('deletes the whole Group while preserving the sibling Group and its Action', () => {
      const document = buildComboDocument(combo);
      const siblingBefore = JSON.stringify(document.loopClips[1]);

      const result = proposePhysicPaintRotoDeleteGroup({
        document,
        groupId: 'group-main',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.proposal.loopClips).toHaveLength(1);
      expect(JSON.stringify(result.proposal.loopClips[0])).toBe(siblingBefore);
      expect(result.impact.cleanupKeyIds).toEqual(MAIN_CYCLE);
      expect(result.proposal.realKeyRecords.map((record) => record.keyId)).toEqual([...SIBLING_CYCLE]);
    });

    it('preserves the document byte-identically across lifecycle rejections', () => {
      const document = buildComboDocument(combo);
      const before = JSON.stringify(document);

      expect(proposePhysicPaintRotoGroupFramePaint({
        document,
        groupId: 'group-main',
        appFrame: paintTarget,
        overrideKeyId: MAIN_CYCLE[0],
        renderedPayload: { frameIndex: 0, appFrame: paintTarget, dataUrl: pngDataUrl('painted'), width: 10, height: 10 },
      })).toMatchObject({ ok: false, reason: 'duplicate-override-key-id' });
      expect(proposePhysicPaintRotoDeleteGroupFrame({
        document,
        groupId: 'group-main',
        appFrame: extent.endExclusive,
      })).toMatchObject({ ok: false, reason: 'frame-outside-group-extent' });
      expect(proposePhysicPaintRotoRegenerateGroup({
        document,
        groupId: 'group-main',
        expectedActionRevision: 'action-revision-1',
        currentActionRevision: 'action-revision-2',
      })).toMatchObject({ ok: false, reason: 'action-revision-mismatch' });
      expect(proposePhysicPaintRotoDeleteGroup({
        document,
        groupId: 'group-missing',
      })).toMatchObject({ ok: false, reason: 'group-not-found' });

      expect(JSON.stringify(document)).toBe(before);
    });
  });
});

describe('Group parity persistence matrix', () => {
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

  it.each([
    { placementStart: 0, repeat: 1 },
    { placementStart: 10, repeat: 3 },
  ])('round-trips placementStart $placementStart · Repeat $repeat byte-identically', async (combo) => {
    const document = buildComboDocument(combo);
    const efxDocument = createEfxPaintDocument('parity-layer');
    const track = efxDocument.tracks[0];
    const withRoto = {
      ...efxDocument,
      tracks: [{ ...track, rotoPhysical: document }],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['parity-layer', {
      document: withRoto,
      frames: new Map(),
    }]]);

    const persisted = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, async () => {});
    const hydrated = await loadEfxPaintDocuments('/project', persisted);
    const restored = hydrated.get('parity-layer')?.document.tracks[0].rotoPhysical;

    expect(restored?.loopClips).toEqual(document.loopClips);
    expect(restored?.realKeyRecords.map((record) => record.keyId))
      .toEqual(document.realKeyRecords.map((record) => record.keyId));
  });
});

describe('proposePhysicPaintRotoDeleteRails', () => {
  const buildDeleteRailsDocument = (
    selection: { readonly selectedKeyId: string | null; readonly cursorAppFrame: number } = { selectedKeyId: null, cursorAppFrame: 0 },
  ): PhysicPaintRotoPhysicalDocument => {
    const records = [
      realKey('A', 0), realKey('B', 1), realKey('C', 2),
      realKey('D', 10), realKey('E', 11),
      realKey('F', 20), realKey('G', 21),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [
      lifecycleGroup('group-main', 0, ['A', 'B', 'C'], 1, 'action-main'),
      { ...lifecycleGroup('group-sibling', 10, ['D', 'E'], 1, 'action-sibling'), mode: 'static' as const },
    ];
    return parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: selection.selectedKeyId,
      cursorAppFrame: selection.cursorAppFrame,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['F']),
      loopClips,
      incomingInterpolationBreakKeyIds: ['F'],
    });
  };

  const documentFromResolverProposal = (
    base: PhysicPaintRotoPhysicalDocument,
    proposal: PhysicPaintRotoPhysicalEditProposal,
  ): PhysicPaintRotoPhysicalDocument => {
    const realKeyRecords = base.realKeyRecords
      .filter((record) => proposal.mapping.has(record.keyId))
      .map((record) => ({ ...record, appFrame: proposal.mapping.get(record.keyId)! }));
    const loopClips = proposal.nextLoopClips ?? base.loopClips;
    const incomingInterpolationBreakKeyIds = proposal.nextIncomingInterpolationBreakKeyIds ?? base.incomingInterpolationBreakKeyIds;
    const selectedKeyId = proposal.selectedKeyId;
    const selectedRecord = selectedKeyId === null
      ? null
      : realKeyRecords.find((record) => record.keyId === selectedKeyId);
    return parsePhysicPaintRotoPhysicalDocument({
      ...base,
      realKeyRecords,
      loopClips,
      incomingInterpolationBreakKeyIds,
      selectedKeyId,
      cursorAppFrame: selectedRecord ? selectedRecord.appFrame : base.cursorAppFrame,
      revision: buildPhysicPaintRotoPhysicalRevision(
        realKeyRecords,
        base.interpolation,
        loopClips,
        incomingInterpolationBreakKeyIds,
        base.groupOverrideRecords ?? [],
      ),
    });
  };

  const resolveSequentialKeyRailDelete = (
    document: PhysicPaintRotoPhysicalDocument,
    keyIds: readonly string[],
  ): PhysicPaintRotoPhysicalDocument => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      intent: { kind: 'delete-key-rail', keyIds },
      parentEndExclusive: document.capacity,
      capacity: document.capacity,
      interpolationEnabled: document.interpolation.enabled,
      incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
      loopClips: document.loopClips,
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Sequential Key Rail delete must resolve');
    return documentFromResolverProposal(document, resolution.proposal);
  };

  it('composes Key Rail + Motion + Static deletion into one atomic proposal in deterministic order', () => {
    const document = buildDeleteRailsDocument();
    const result = proposePhysicPaintRotoDeleteRails({
      document,
      members: [
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
        { kind: 'loop', loopId: 'group-sibling' },
        { kind: 'loop', loopId: 'group-main' },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.realKeyRecords).toHaveLength(0);
    expect(result.proposal.loopClips).toHaveLength(0);
    expect(result.proposal.incomingInterpolationBreakKeyIds).toEqual([]);
    expect(result.proposal.selectedKeyId).toBeNull();
    expect(result.proposal.cursorAppFrame).toBe(0);
    expect(result.impact).toMatchObject({
      kind: 'delete-rails',
      cleanupKeyIds: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      previousRevision: document.revision,
    });
    expect(result.impact.members).toEqual([
      { kind: 'loop', loopId: 'group-main' },
      { kind: 'loop', loopId: 'group-sibling' },
      { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
    ]);
    expect(result.impact.nextRevision).toBe(result.proposal.revision);
  });

  it('parity: a Key Rail-only set equals the sequential resolver delete-key-rail authority', () => {
    const document = buildDeleteRailsDocument();
    const composed = proposePhysicPaintRotoDeleteRails({
      document,
      members: [{ kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] }],
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;

    const sequential = resolveSequentialKeyRailDelete(document, ['F', 'G']);
    expect(sequential.realKeyRecords.map((record) => record.keyId))
      .toEqual(composed.proposal.realKeyRecords.map((record) => record.keyId));
    expect(JSON.stringify(sequential.loopClips)).toBe(JSON.stringify(composed.proposal.loopClips));
    expect(sequential.incomingInterpolationBreakKeyIds).toEqual(composed.proposal.incomingInterpolationBreakKeyIds);
    expect(sequential.selectedKeyId).toBe(composed.proposal.selectedKeyId);
    expect(sequential.revision).toBe(composed.proposal.revision);
  });

  it('parity: a Groups-only set equals sequential delete-group composition', () => {
    const document = buildDeleteRailsDocument();
    const composed = proposePhysicPaintRotoDeleteRails({
      document,
      members: [
        { kind: 'loop', loopId: 'group-sibling' },
        { kind: 'loop', loopId: 'group-main' },
      ],
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;

    const first = proposePhysicPaintRotoDeleteGroup({ document, groupId: 'group-main' });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Sequential delete-group must resolve');
    const second = proposePhysicPaintRotoDeleteGroup({ document: first.proposal, groupId: 'group-sibling' });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Sequential delete-group must resolve');

    expect(JSON.stringify(second.proposal)).toBe(JSON.stringify(composed.proposal));
    expect(composed.impact.cleanupKeyIds).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(composed.impact.members).toEqual([
      { kind: 'loop', loopId: 'group-main' },
      { kind: 'loop', loopId: 'group-sibling' },
    ]);
  });

  it('parity: a mixed set with a shared-source survivor keeps the survivor source keys', () => {
    const records = [
      realKey('A', 0), realKey('B', 1), realKey('C', 2),
      realKey('D', 10), realKey('E', 11),
      realKey('F', 20), realKey('G', 21),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [
      lifecycleGroup('group-main', 0, ['A', 'B', 'C'], 1, 'action-main'),
      lifecycleGroup('group-sibling', 10, ['A', 'B', 'C'], 1, 'action-sibling'),
    ];
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['F']),
      loopClips,
      incomingInterpolationBreakKeyIds: ['F'],
    });

    const composed = proposePhysicPaintRotoDeleteRails({
      document,
      members: [
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
        { kind: 'loop', loopId: 'group-main' },
      ],
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    expect(composed.proposal.realKeyRecords.map((record) => record.keyId)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(composed.proposal.loopClips.map((clip) => clip.loopId)).toEqual(['group-sibling']);
    expect(composed.impact.cleanupKeyIds).toEqual(['F', 'G']);

    const first = proposePhysicPaintRotoDeleteGroup({ document, groupId: 'group-main' });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Sequential delete-group must resolve');
    const sequential = resolveSequentialKeyRailDelete(first.proposal, ['F', 'G']);
    expect(JSON.stringify(sequential)).toBe(JSON.stringify(composed.proposal));
  });

  it('normalizes the complete break collection: removed owners drop, survivors keep, successor added, no dangling references', () => {
    const records = [
      realKey('A', 1), realKey('B', 4), realKey('C', 6),
      realKey('X', 8),
      realKey('D', 10), realKey('E', 14),
      realKey('F', 20), realKey('G', 21),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [lifecycleGroup('group-x', 8, ['X'], 1, 'action-x')];
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['B', 'E', 'F']),
      loopClips,
      incomingInterpolationBreakKeyIds: ['B', 'E', 'F'],
    });

    const result = proposePhysicPaintRotoDeleteRails({
      document,
      members: [
        { kind: 'key-rail', firstKeyId: 'B', keyIds: ['B', 'C'] },
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.incomingInterpolationBreakKeyIds).toEqual(['D', 'E']);
    expect(result.proposal.realKeyRecords.map((record) => record.keyId)).toEqual(['A', 'X', 'D', 'E']);
    expect(result.proposal.loopClips.map((clip) => clip.loopId)).toEqual(['group-x']);
    expect(result.proposal.selectedKeyId).toBe('E');
    expect(result.impact.cleanupKeyIds).toEqual(['B', 'C', 'F', 'G']);
    for (const keyId of result.proposal.incomingInterpolationBreakKeyIds) {
      expect(result.proposal.realKeyRecords.some((record) => record.keyId === keyId)).toBe(true);
    }
  });

  it('rejects the whole proposal fail-closed on any stale, unknown, duplicate, or malformed member', () => {
    const document = buildDeleteRailsDocument();
    const before = JSON.stringify(document);
    const cases: { readonly members: readonly RailSetDeleteMember[]; readonly reason: string }[] = [
      { members: [], reason: 'empty-member-set' },
      { members: [{ kind: 'loop', loopId: 'group-missing' }], reason: 'unknown-member' },
      { members: [{ kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'missing'] }], reason: 'unknown-member' },
      { members: [{ kind: 'key-rail', firstKeyId: 'F', keyIds: ['F'] }], reason: 'stale-member' },
      { members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C'] }], reason: 'stale-member' },
      {
        members: [
          { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
          { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
        ],
        reason: 'duplicate-member',
      },
      { members: [{ kind: 'key-rail', firstKeyId: 'F', keyIds: [] }], reason: 'malformed-member' },
      { members: [{ kind: 'loop', loopId: '' }], reason: 'malformed-member' },
    ];
    for (const testCase of cases) {
      const result = proposePhysicPaintRotoDeleteRails({ document, members: testCase.members });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toBe(testCase.reason);
      expect('proposal' in result).toBe(false);
    }
    expect(JSON.stringify(document)).toBe(before);
  });

  it('keeps the selection and cursor valid after a mixed delete', () => {
    const selected = buildDeleteRailsDocument({ selectedKeyId: 'E', cursorAppFrame: 11 });
    const result = proposePhysicPaintRotoDeleteRails({
      document: selected,
      members: [
        { kind: 'loop', loopId: 'group-main' },
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.selectedKeyId).toBe('E');
    expect(result.proposal.cursorAppFrame).toBe(11);

    const cleaned = buildDeleteRailsDocument({ selectedKeyId: 'A', cursorAppFrame: 0 });
    const cleanedResult = proposePhysicPaintRotoDeleteRails({
      document: cleaned,
      members: [
        { kind: 'loop', loopId: 'group-main' },
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
      ],
    });
    expect(cleanedResult.ok).toBe(true);
    if (!cleanedResult.ok) return;
    expect(cleanedResult.proposal.selectedKeyId).toBe('E');
    expect(cleanedResult.proposal.cursorAppFrame).toBe(11);
  });
});
