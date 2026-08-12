import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

function moveGeneration(projectDir: string, stagingBasename: string): void {
  const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
  const canonicalRoot = `${projectDir}/cache/physic-paint`;
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
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoGroupFramePaint,
  proposePhysicPaintRotoRegenerateGroup,
} from './physicsPaintRotoGroupLifecycle';
import { derivePhysicPaintRotoLoopRanges } from './physicsPaintRotoPhysicalResolver';
import { loadPhysicPaintData, savePhysicPaintDataWithProjectWrite } from '../../../lib/physicPaintPersistence';
import type { RuntimePhysicPaintOutput } from '../../../types/project';

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
const PARENT_END_EXCLUSIVE = 40;

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
        parentEndExclusive: PARENT_END_EXCLUSIVE,
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
    const outputs: RuntimePhysicPaintOutput[] = [{
      layer_id: 'parity-layer',
      frames: [],
      roto_physical: document,
    }];

    const persisted = await savePhysicPaintDataWithProjectWrite('/project', outputs, async () => {});
    const hydrated = await loadPhysicPaintData('/project', persisted);

    expect(hydrated?.[0].roto_physical?.loopClips).toEqual(document.loopClips);
    expect(hydrated?.[0].roto_physical?.realKeyRecords.map((record) => record.keyId))
      .toEqual(document.realKeyRecords.map((record) => record.keyId));
  });
});
