import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

// Preact hook shims for the REAL useRotoPhysicalEditHistory hook driven by the
// materialization one-history-command cases below (same idiom as the 43-01
// loop-history spec).
vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import {
  createPhysicPaintRotoPasteKeyGroupIntent,
  createPhysicPaintRotoPasteKeyIntent,
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLinkedFrameDeleteGuard,
  resolvePhysicPaintRotoLoopFrame,
  resolvePhysicPaintRotoLoopMaterializationBase,
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRotoPhysicalEditIntent,
  type PhysicPaintRotoPhysicalEditResolution,
  type PhysicPaintRotoLoopResolutionContext,
} from './physicsPaintRotoPhysicalResolver';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditSnapshot,
} from './rotoCoordinatorPorts';
import { useRotoPhysicalEditHistory } from '../hooks/useRotoPhysicalEditHistory';
import { getPhysicsPaintRotoSourceCycleId } from './physicsPaintRotoSpacingSelection';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';

/**
 * Phase 43-05 RED spec — loop-aware operation guards (HOLD-05).
 *
 * Locks the fail-closed guard contract between linked Loop Clips and every
 * existing Roto operation, with the user-facing copy verbatim:
 * - D-07: source-cycle key deletion is rejected while any loop references the
 *   cycle; N counts every loop referencing the cycle.
 * - D-11: single-key drag (ripple) on a linked source key and Force Spacing
 *   over selections containing linked source keys are rejected; a linked
 *   cycle's internal spacing IS the loop rhythm.
 * - D-04 (placement/source correction): a rigid group drag of the WHOLE
 *   source cycle moves the keys; only a loop whose placementStart coincided
 *   with the cycle's pre-move first key frame (an original loop) follows —
 *   a duplicated loop keeps its own placementStart and keeps resolving the
 *   same source keys by id.
 * - D-13: Delete-key at a linked repetition frame is rejected verbatim; Clear
 *   materializes a local empty real key and the loop shortens; a materialized
 *   empty key deletes normally and the loop re-expands.
 * - D-12: painting/erasing at a linked frame materializes a local real key
 *   whose base is the loop-resolved source payload (reference identity — one
 *   source cache entry serves every occurrence, D-26).
 * - D-06/D-10: materialization is one history command — one Undo removes the
 *   key and the loop re-expands, one Redo restores the key and the shrink.
 * - D-09: copy/paste never carries loop identity — pasted source-cycle keys
 *   land as ordinary real keys unreferenced by any loop.
 */

const CAPACITY = PHYSIC_PAINT_MAX_APPLY_FRAMES;

const D07_TEXT = (count: number) =>
  `This key belongs to a source cycle used by ${count} linked loop(s). Unlink the loop(s) before deleting it.`;
const D11_TEXT = 'Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.';
const D13_TEXT = 'No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.';

const SOURCE_KEY_IDS = ['A', 'B', 'C', 'D', 'E'] as const;

function record(keyId: string, appFrame: number, label: string): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: `data:image/png;base64,${label}`,
      width: 2,
      height: 2,
    },
  };
}

/** Source-cycle keys A..E at frames 10..14 — the shared 5-frame cycle baseline. */
const SOURCE_RECORDS = () => [
  record('A', 10, 'AAAA'),
  record('B', 11, 'BBBB'),
  record('C', 12, 'CCCC'),
  record('D', 13, 'DDDD'),
  record('E', 14, 'EEEE'),
];
/** Ordinary real keys outside the cycle: G@30, H@40. */
const ORDINARY_RECORDS = () => [record('G', 30, 'GGGG'), record('H', 40, 'HHHH')];

function loop(
  placementStart: number,
  repeat: number | 'infinity',
  loopId = 'L1',
  sourceKeyIds: readonly string[] = SOURCE_KEY_IDS,
): PhysicPaintRotoLoopClip {
  return { loopId, placementStart, sourceKeyIds: [...sourceKeyIds], repeat, mode: 'static' };
}

function linkedSpacingScope(
  selectedSourceKeyIds: readonly string[],
  sourceKeyIds: readonly string[] = SOURCE_KEY_IDS,
) {
  return {
    sourceCycleId: getPhysicsPaintRotoSourceCycleId(sourceKeyIds),
    sourceKeyIds: [...sourceKeyIds],
    selectedSourceKeyIds: [...selectedSourceKeyIds],
  } as const;
}

function resolveEdit(input: {
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly intent: PhysicPaintRotoPhysicalEditIntent;
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
}): PhysicPaintRotoPhysicalEditResolution {
  return resolvePhysicPaintRotoPhysicalEdit({
    identities: input.records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records: input.records,
    intent: input.intent,
    ...(input.loopClips !== undefined ? { loopClips: input.loopClips } : {}),
    capacity: CAPACITY,
    interpolationEnabled: false,
  });
}

function derive(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
): PhysicPaintRotoLoopResolutionContext {
  return derivePhysicPaintRotoLoopRanges({
    identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    loopClips,
    parentEndExclusive: CAPACITY,
    capacity: CAPACITY,
    interpolationEnabled: false,
  });
}

function effectiveEndOf(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
  loopId: string,
): number {
  const range = derive(records, loopClips).ranges.find((entry) => entry.loopId === loopId);
  if (!range) throw new Error(`Loop "${loopId}" missing from derivation.`);
  return range.effectiveEnd;
}

function expectFailure(
  resolution: PhysicPaintRotoPhysicalEditResolution,
  code: string,
  operationKind: string,
  text: string,
): void {
  expect(resolution.ok).toBe(false);
  if (resolution.ok) throw new Error('Expected a rejected resolution.');
  expect(resolution.failure.code).toBe(code);
  expect(resolution.failure.operationKind).toBe(operationKind);
  expect(resolution.failure.text).toBe(text);
}

function expectOk(resolution: PhysicPaintRotoPhysicalEditResolution) {
  if (!resolution.ok) throw new Error(`Expected an accepted resolution, got ${resolution.failure.code}: ${resolution.failure.text}`);
  expect(resolution.ok).toBe(true);
  return resolution.proposal;
}

// ---------------------------------------------------------------------------
// D-07 — source-cycle key deletion is rejected while any loop references it.
// ---------------------------------------------------------------------------

describe('D-07 source-key deletion guard', () => {
  it('rejects delete-key on a source-cycle key with the locked copy, N = 1', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'delete-key', selectedKeyId: 'B' },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-delete-rejected', 'delete-key', D07_TEXT(1));
  });

  it('counts every loop referencing the cycle (original + duplicated share the source)', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'delete-key', selectedKeyId: 'A' },
      loopClips: [loop(10, 5, 'L1'), loop(50, 2, 'L2')],
    });
    expectFailure(resolution, 'loop-source-key-delete-rejected', 'delete-key', D07_TEXT(2));
  });

  it('rejects delete-key-group when any member is a linked source key', () => {
    const resolution = resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'delete-key-group', keyIds: ['G', 'C'] },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-delete-rejected', 'delete-key-group', D07_TEXT(1));
  });

  it('deletes ordinary keys normally and carries no loop update; the derived range re-expands', () => {
    const records = [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()];
    const loopClips = [loop(10, 5)];
    // G@30 is a non-owned real key inside the requested range: the loop is
    // already shortened to 30 before the delete (D-06 emergent boundary).
    expect(effectiveEndOf(records, loopClips, 'L1')).toBe(30);

    const proposal = expectOk(resolveEdit({
      records,
      intent: { kind: 'delete-key-group', keyIds: ['G', 'H'] },
      loopClips,
    }));
    expect(proposal.nextLoopClips).toBeNull();

    const survivors = records.filter((entry) => entry.keyId !== 'G' && entry.keyId !== 'H');
    // The loop RECORD is unchanged; removing the blocker re-expands the
    // derived effective range automatically (D-08 re-expansion).
    expect(effectiveEndOf(survivors, loopClips, 'L1')).toBe(35);
  });

  it('deletes a materialized empty key normally, re-expanding the loop (D-13)', () => {
    const records = [...SOURCE_RECORDS(), record('K', 20, 'RU1QVFk=')];
    const loopClips = [loop(10, 5)];
    expect(effectiveEndOf(records, loopClips, 'L1')).toBe(20);

    const proposal = expectOk(resolveEdit({
      records,
      intent: { kind: 'delete-key', selectedKeyId: 'K' },
      loopClips,
    }));
    expect(proposal.removedKeyIds).toEqual(['K']);

    const survivors = records.filter((entry) => entry.keyId !== 'K');
    expect(effectiveEndOf(survivors, loopClips, 'L1')).toBe(35);
    expect(resolvePhysicPaintRotoLoopFrame(derive(survivors, loopClips), 20).kind).toBe('linked');
  });

  it('keeps pre-43 behavior when the loopClips input is absent (delete of any key resolves)', () => {
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'delete-key', selectedKeyId: 'B' },
    }));
    expect(proposal.removedKeyIds).toEqual(['B']);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('fails closed on a malformed loopClips input', () => {
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: SOURCE_RECORDS().map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      intent: { kind: 'delete-key', selectedKeyId: 'B' },
      loopClips: [{ loopId: 'L1' }] as never,
      capacity: CAPACITY,
      interpolationEnabled: false,
    });
    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Expected a rejected resolution.');
    expect(resolution.failure.code).toBe('malformed-loop-clips');
  });
});

// ---------------------------------------------------------------------------
// D-11 — linked source keys move only as a rigid group.
// ---------------------------------------------------------------------------

describe('D-11 rigid linked-key guard', () => {
  it('rejects a single-key move on a linked source key with the locked copy', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'C', target: { kind: 'physical-cell', appFrame: 22 } },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });

  it('moves an ordinary key normally while loops exist', () => {
    const proposal = expectOk(resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key', movedKeyId: 'H', target: { kind: 'physical-cell', appFrame: 42 } },
      loopClips: [loop(10, 5)],
    }));
    expect(proposal.mapping.get('H')).toBe(42);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('rejects full-timeline Force Spacing when any linked source key exists', () => {
    const resolution = resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null, scopeKeyIds: null },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'force-spacing', D11_TEXT);
  });

  it('rejects scoped Force Spacing whose selection contains a linked source key', () => {
    const resolution = resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null, scopeKeyIds: ['G', 'C'] },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'force-spacing', D11_TEXT);
  });

  it('allows scoped Force Spacing over ordinary keys only — the loop rhythm is untouched', () => {
    const records = [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()];
    const loopClips = [loop(10, 5)];
    const proposal = expectOk(resolveEdit({
      records,
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null, scopeKeyIds: ['G', 'H'] },
      loopClips,
    }));
    expect(proposal.mapping.get('G')).toBe(30); // anchor holds
    expect(proposal.mapping.get('H')).toBe(32); // 30 + 1 * (1 + 1)
    expect(proposal.nextLoopClips).toBeNull();
    // Source keys never moved; the derived range is identical.
    expect(effectiveEndOf(records, loopClips, 'L1')).toBe(30);
  });

  it('accepts an authorized partial source-cycle selection and keeps every shared Loop Clip record unchanged', () => {
    const records = [record('A', 10, 'A'), record('B', 12, 'B'), record('C', 15, 'C'), record('D', 20, 'D'), record('E', 24, 'E')];
    const loopClips = [loop(10, 3, 'L1'), loop(100, 2, 'L2')];
    const proposal = expectOk(resolveEdit({
      records,
      loopClips,
      intent: {
        kind: 'force-spacing',
        emptyFrames: 5,
        selectedKeyId: null,
        scopeKeyIds: ['B', 'D'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['B', 'D'])],
      },
    }));

    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 10, B: 12, C: 15, D: 18, E: 22 });
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('accepts the full authorized source cycle and derives the new rhythm without placement or repeat changes', () => {
    const loopClips = [loop(10, 3, 'L1'), loop(100, 2, 'L2')];
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      loopClips,
      intent: {
        kind: 'force-spacing',
        emptyFrames: 2,
        selectedKeyId: null,
        scopeKeyIds: [...SOURCE_KEY_IDS],
        linkedSourceSpacingScopes: [linkedSpacingScope(SOURCE_KEY_IDS)],
      },
    }));

    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 10, B: 13, C: 16, D: 19, E: 22 });
    expect(proposal.nextLoopClips).toBeNull();
    expect(loopClips).toEqual([loop(10, 3, 'L1'), loop(100, 2, 'L2')]);
  });

  it('expands an earlier Progressive capsule and ripples a downstream Static/Hold capsule with its placement', () => {
    const records = [
      record('A', 0, 'A'),
      record('B', 1, 'B'),
      record('C', 2, 'C'),
      record('X', 6, 'X'),
      record('Y', 7, 'Y'),
      record('Q', 20, 'Q'),
    ];
    const progressive: PhysicPaintRotoLoopClip = {
      loopId: 'progressive-a',
      placementStart: 0,
      sourceKeyIds: ['A', 'B', 'C'],
      repeat: 2,
      mode: 'progressive',
      scriptId: 'script-a',
      motion: { deformation: 4, position: 3 },
      overrideColor: '#123456',
    };
    const hold: PhysicPaintRotoLoopClip = {
      loopId: 'hold-b',
      placementStart: 6,
      sourceKeyIds: ['X', 'Y'],
      repeat: 4,
      mode: 'static',
      scriptId: 'script-b',
      motion: { deformation: 0, position: 2 },
      overrideColor: '#abcdef',
    };
    const loopClips = [progressive, hold];
    const intent: PhysicPaintRotoPhysicalEditIntent = {
      kind: 'force-spacing',
      emptyFrames: 2,
      selectedKeyId: null,
      scopeKeyIds: ['A', 'B', 'C'],
      linkedSourceSpacingScopes: [linkedSpacingScope(['A', 'B', 'C'], ['A', 'B', 'C'])],
    };
    const proposal = expectOk(resolveEdit({ records, loopClips, intent }));

    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 0, B: 3, C: 6, X: 10, Y: 11, Q: 24 });
    expect(proposal.generatedCells).toEqual([]);
    expect(proposal.nextLoopClips).toEqual([
      progressive,
      { ...hold, placementStart: 10 },
    ]);
    expect(proposal.nextRecords).toBeNull();

    const interpolated = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      loopClips,
      capacity: CAPACITY,
      interpolationEnabled: true,
    });
    expect(interpolated.ok).toBe(true);
    if (!interpolated.ok) throw new Error('Expected interpolated spacing to resolve.');
    expect(interpolated.proposal.generatedCells.map((cell) => cell.appFrame)).toContain(1);
    expect(interpolated.proposal.nextRecords).toBeNull();
  });

  it.each([
    ['one selected source position', ['B'], linkedSpacingScope(['B'])],
    ['duplicate selected source positions', ['B', 'B'], linkedSpacingScope(['B', 'B'])],
    ['stale selected source position', ['B', 'STALE'], linkedSpacingScope(['B', 'STALE'])],
  ])('rejects authorized spacing with %s', (_label, scopeKeyIds, provenance) => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      loopClips: [loop(10, 5)],
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null, scopeKeyIds, linkedSourceSpacingScopes: [provenance] },
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.failure.code).toBe('invalid-linked-source-spacing-scope');
  });

  it('rejects forged cycle provenance and a scopeKeyIds mismatch', () => {
    const forged = resolveEdit({
      records: SOURCE_RECORDS(),
      loopClips: [loop(10, 5)],
      intent: {
        kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null, scopeKeyIds: ['B', 'C'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['B', 'C'], ['A', 'B', 'C', 'E', 'D'])],
      },
    });
    const mismatched = resolveEdit({
      records: SOURCE_RECORDS(),
      loopClips: [loop(10, 5)],
      intent: {
        kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null, scopeKeyIds: ['B', 'C'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['B', 'D'])],
      },
    });

    for (const resolution of [forged, mismatched]) {
      expect(resolution.ok).toBe(false);
      if (!resolution.ok) expect(resolution.failure.code).toBe('invalid-linked-source-spacing-scope');
    }
  });

  it('rejects selected keys crossing an unselected interior source position before finalization', () => {
    const records = [record('A', 10, 'A'), record('B', 12, 'B'), record('C', 15, 'C'), record('D', 20, 'D'), record('E', 24, 'E')];
    const resolution = resolveEdit({
      records,
      loopClips: [loop(10, 3)],
      intent: {
        kind: 'force-spacing', emptyFrames: 0, selectedKeyId: null, scopeKeyIds: ['B', 'D'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['B', 'D'])],
      },
    });

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.failure.code).toBe('linked-source-spacing-order-rejected');
  });

  it('rejects an authorized destination collision atomically', () => {
    const records = [record('A', 10, 'A'), record('B', 12, 'B'), record('C', 15, 'C'), record('D', 20, 'D'), record('E', 24, 'E')];
    const resolution = resolveEdit({
      records,
      loopClips: [loop(10, 3)],
      intent: {
        kind: 'force-spacing', emptyFrames: 2, selectedKeyId: null, scopeKeyIds: ['B', 'D'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['B', 'D'])],
      },
    });

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.failure.code).toBe('duplicate-destination-frame');
  });

  it('rejects an authorized over-capacity full-cycle request atomically', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      loopClips: [loop(10, 3)],
      intent: {
        kind: 'force-spacing', emptyFrames: 200, selectedKeyId: null, scopeKeyIds: [...SOURCE_KEY_IDS],
        linkedSourceSpacingScopes: [linkedSpacingScope(SOURCE_KEY_IDS)],
      },
    });

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.failure.code).toBe('over-capacity');
  });
});

// ---------------------------------------------------------------------------
// D-04 — rigid group drag of the whole source cycle (placement/source correction).
// ---------------------------------------------------------------------------

describe('D-04 rigid group drag of the whole source cycle', () => {
  const GROUP_TARGET = { kind: 'physical-cell', appFrame: 20 } as const;

  it('moves the whole cycle rigidly and updates only the original loop placementStart', () => {
    const loopClips = [loop(10, 5, 'L1'), loop(50, 2, 'L2')];
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: [...SOURCE_KEY_IDS], grabbedKeyId: 'A', target: GROUP_TARGET },
      loopClips,
    }));
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 20, B: 21, C: 22, D: 23, E: 24 });

    // The original loop (placementStart 10 == the cycle's pre-move first key
    // frame) follows the drag; the duplicated loop keeps its own placement.
    const nextLoopClips = proposal.nextLoopClips;
    expect(nextLoopClips).not.toBeNull();
    const followed = nextLoopClips?.find((entry) => entry.loopId === 'L1');
    const untracked = nextLoopClips?.find((entry) => entry.loopId === 'L2');
    expect(followed).toMatchObject({ loopId: 'L1', placementStart: 20, repeat: 5, mode: 'static' });
    expect(followed?.sourceKeyIds).toEqual([...SOURCE_KEY_IDS]);
    expect(untracked).toMatchObject({ loopId: 'L2', placementStart: 50, repeat: 2 });
    expect(untracked?.sourceKeyIds).toEqual([...SOURCE_KEY_IDS]);
  });

  it('the moved original loop keeps resolving the same source keys by id at its new placement', () => {
    const loopClips = [loop(10, 5, 'L1'), loop(50, 2, 'L2')];
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: [...SOURCE_KEY_IDS], grabbedKeyId: 'A', target: GROUP_TARGET },
      loopClips,
    }));
    const movedRecords = SOURCE_RECORDS().map((entry) => ({
      ...entry,
      appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame,
      payload: { ...entry.payload, appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame },
    }));
    const context = derive(movedRecords, proposal.nextLoopClips ?? loopClips);

    const original = context.ranges.find((entry) => entry.loopId === 'L1');
    expect(original).toMatchObject({ placementStart: 20, effectiveEnd: 45, truncated: false });
    expect(resolvePhysicPaintRotoLoopFrame(context, 20)).toMatchObject({ kind: 'real', keyId: 'A' });
    expect(resolvePhysicPaintRotoLoopFrame(context, 25)).toMatchObject({ kind: 'linked', loopId: 'L1', sourceKeyId: 'A', repeatInstance: 1 });

    const duplicated = context.ranges.find((entry) => entry.loopId === 'L2');
    expect(duplicated).toMatchObject({ placementStart: 50, effectiveEnd: 60 });
    expect(resolvePhysicPaintRotoLoopFrame(context, 52)).toMatchObject({ kind: 'linked', loopId: 'L2', sourceKeyId: 'C', repeatInstance: 0 });
  });

  it('a partial-cycle group move leaves every placementStart unchanged (loops resolve by id)', () => {
    const loopClips = [loop(10, 5, 'L1')];
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: GROUP_TARGET },
      loopClips,
    }));
    expect(proposal.mapping.get('A')).toBe(20);
    expect(proposal.mapping.get('B')).toBe(21);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('a group move that excludes source keys carries no loop update', () => {
    const loopClips = [loop(10, 5, 'L1')];
    const proposal = expectOk(resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key-group', movedKeyIds: ['G', 'H'], grabbedKeyId: 'G', target: { kind: 'physical-cell', appFrame: 32 } },
      loopClips,
    }));
    expect(proposal.mapping.get('G')).toBe(32);
    expect(proposal.mapping.get('H')).toBe(42);
    expect(proposal.nextLoopClips).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D-13 — Delete-key at a linked repetition frame is rejected verbatim.
// ---------------------------------------------------------------------------

describe('D-13 linked-frame delete guard', () => {
  it('returns the verbatim rejection at a linked repetition frame', () => {
    const context = derive(SOURCE_RECORDS(), [loop(10, 5)]);
    expect(resolvePhysicPaintRotoLoopFrame(context, 20).kind).toBe('linked');
    const failure = resolvePhysicPaintRotoLinkedFrameDeleteGuard(context, 20);
    expect(failure).not.toBeNull();
    expect(failure).toMatchObject({
      code: 'linked-frame-delete-rejected',
      operationKind: 'delete-key',
    });
    expect(failure?.text).toBe(D13_TEXT);
  });

  it('returns the same rejection at a linked-unresolved frame — it never unlinks and never touches source keys', () => {
    // One dangling reference ('MISSING') extends the cycle to 6 frames; every
    // present source key stays owned, so the unresolved range spans frame 20.
    const context = derive(SOURCE_RECORDS(), [loop(10, 5, 'L3', ['A', 'B', 'C', 'D', 'E', 'MISSING'])]);
    expect(resolvePhysicPaintRotoLoopFrame(context, 20).kind).toBe('linked-unresolved');
    const failure = resolvePhysicPaintRotoLinkedFrameDeleteGuard(context, 20);
    expect(failure).toMatchObject({ code: 'linked-frame-delete-rejected', operationKind: 'delete-key' });
    expect(failure?.text).toBe(D13_TEXT);
  });

  it('returns null at real and empty frames — ordinary delete proceeds there', () => {
    const context = derive(SOURCE_RECORDS(), [loop(10, 5)]);
    expect(resolvePhysicPaintRotoLinkedFrameDeleteGuard(context, 10)).toBeNull(); // real source key
    expect(resolvePhysicPaintRotoLinkedFrameDeleteGuard(context, 70)).toBeNull(); // empty frame
  });
});

// ---------------------------------------------------------------------------
// D-12/D-13 — Clear/paint materialization at a linked frame.
// ---------------------------------------------------------------------------

describe('D-12/D-13 materialize local key at a linked frame', () => {
  it('exposes the loop-resolved source payload as the materialization base by reference (D-26)', () => {
    const records = SOURCE_RECORDS();
    const context = derive(records, [loop(10, 5)]);
    // Frame 22 resolves to source index (22 - 10) % 5 = 2 → C.
    const base = resolvePhysicPaintRotoLoopMaterializationBase(context, records, 22);
    expect(base).not.toBeNull();
    expect(base).toMatchObject({ loopId: 'L1', sourceKeyId: 'C' });
    const source = records.find((entry) => entry.keyId === 'C');
    expect(base?.payload).toBe(source?.payload); // reference identity — no per-occurrence copy
  });

  it('never fabricates a base at real, empty, or linked-unresolved frames', () => {
    const records = SOURCE_RECORDS();
    const context = derive(records, [loop(10, 5)]);
    expect(resolvePhysicPaintRotoLoopMaterializationBase(context, records, 10)).toBeNull(); // real
    expect(resolvePhysicPaintRotoLoopMaterializationBase(context, records, 70)).toBeNull(); // empty

    const unresolved = derive(records, [loop(10, 5, 'L3', ['A', 'B', 'C', 'D', 'E', 'MISSING'])]);
    expect(resolvePhysicPaintRotoLoopMaterializationBase(unresolved, records, 20)).toBeNull();
  });

  it('Clear materializes a local empty real key; the frame resolves real and the loop shortens (D-13)', () => {
    const records = SOURCE_RECORDS();
    const loopClips = [loop(10, 5)];
    expect(resolvePhysicPaintRotoLoopFrame(derive(records, loopClips), 20).kind).toBe('linked');

    const emptyPayload: PhysicPaintRotoRealKeyPayload = {
      frameIndex: 0,
      appFrame: 20,
      dataUrl: 'data:image/png;base64,RU1QVFk=',
      width: 2,
      height: 2,
    };
    const proposal = expectOk(resolveEdit({
      records,
      intent: createPhysicPaintRotoPasteKeyIntent(20, emptyPayload, null),
      loopClips,
    }));
    // Canvas and playhead stay at the current frame (D-12).
    expect(proposal.selectedAppFrame).toBe(20);

    const afterRecords = proposal.nextRecords ?? [];
    expect(afterRecords.some((entry) => entry.appFrame === 20)).toBe(true);
    const context = derive(afterRecords, loopClips);
    expect(resolvePhysicPaintRotoLoopFrame(context, 20).kind).toBe('real');
    const range = context.ranges.find((entry) => entry.loopId === 'L1');
    expect(range).toMatchObject({ effectiveEnd: 20, truncated: true, boundary: { kind: 'real-key', frame: 20 } });
  });

  it('paint materialization carries the loop-resolved base plus the new stroke as one local real key (D-12)', () => {
    const records = SOURCE_RECORDS();
    const loopClips = [loop(10, 5)];
    const context = derive(records, loopClips);
    const base = resolvePhysicPaintRotoLoopMaterializationBase(context, records, 22);
    expect(base).not.toBeNull();

    // The materialized payload is the loop-resolved base retargeted to the
    // current frame plus the new stroke (a new raster over the same base).
    const paintedPayload: PhysicPaintRotoRealKeyPayload = {
      frameIndex: base?.payload.frameIndex ?? 0,
      appFrame: 22,
      dataUrl: 'data:image/png;base64,Q0NDQ1BMVVNTVFJPS0U=',
      width: base?.payload.width,
      height: base?.payload.height,
    };
    const proposal = expectOk(resolveEdit({
      records,
      intent: createPhysicPaintRotoPasteKeyIntent(22, paintedPayload, null),
      loopClips,
    }));
    expect(proposal.selectedAppFrame).toBe(22);

    const afterRecords = proposal.nextRecords ?? [];
    const materialized = afterRecords.find((entry) => entry.appFrame === 22);
    expect(materialized?.payload.dataUrl).toBe('data:image/png;base64,Q0NDQ1BMVVNTVFJPS0U=');
    const after = derive(afterRecords, loopClips);
    expect(resolvePhysicPaintRotoLoopFrame(after, 22).kind).toBe('real');
    expect(after.ranges.find((entry) => entry.loopId === 'L1')?.effectiveEnd).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// D-09 — copy/paste never carries loop identity.
// ---------------------------------------------------------------------------

describe('D-09 paste never carries loop identity', () => {
  it('paste-key-group of copied source-cycle keys lands as ordinary real keys unreferenced by any loop', () => {
    const records = SOURCE_RECORDS();
    const loopClips = [loop(10, 5)];
    const entries = [records[0], records[2]].map((entry) => ({
      payload: entry.payload,
      sourceAppFrame: entry.appFrame,
      sourceKeyId: entry.keyId,
    }));
    const proposal = expectOk(resolveEdit({
      records,
      intent: createPhysicPaintRotoPasteKeyGroupIntent(60, entries),
      loopClips,
    }));
    expect(proposal.nextLoopClips).toBeNull();

    const afterRecords = proposal.nextRecords ?? [];
    const pasted = afterRecords.filter((entry) => entry.appFrame === 60 || entry.appFrame === 62);
    expect(pasted).toHaveLength(2);
    for (const entry of pasted) {
      expect(SOURCE_KEY_IDS).not.toContain(entry.keyId); // fresh identities
      expect(loopClips[0].sourceKeyIds).not.toContain(entry.keyId); // no loop reference
    }
    // The loop is byte-unchanged and the pasted frames resolve as ordinary real keys.
    expect(loopClips[0].sourceKeyIds).toEqual([...SOURCE_KEY_IDS]);
    const context = derive(afterRecords, loopClips);
    expect(resolvePhysicPaintRotoLoopFrame(context, 60)).toMatchObject({ kind: 'real', keyId: pasted[0].keyId });
    expect(effectiveEndOf(afterRecords, loopClips, 'L1')).toBe(35);

    // A pasted key deletes normally — it is not a guarded source key.
    const deleteResolution = resolveEdit({
      records: afterRecords,
      intent: { kind: 'delete-key', selectedKeyId: pasted[0].keyId },
      loopClips,
    });
    expect(deleteResolution.ok).toBe(true);
  });

  it('paste-key of a copied source key creates an ordinary unreferenced real key', () => {
    const records = SOURCE_RECORDS();
    const loopClips = [loop(10, 5)];
    const proposal = expectOk(resolveEdit({
      records,
      intent: createPhysicPaintRotoPasteKeyIntent(65, records[1].payload, null),
      loopClips,
    }));
    expect(proposal.nextLoopClips).toBeNull();
    const pasted = (proposal.nextRecords ?? []).find((entry) => entry.appFrame === 65);
    expect(pasted).toBeDefined();
    expect(loopClips[0].sourceKeyIds).not.toContain(pasted?.keyId);
    expect(loopClips[0].sourceKeyIds).toEqual([...SOURCE_KEY_IDS]);
  });
});

// ---------------------------------------------------------------------------
// D-06/D-10 — materialization is ONE history command: Undo re-expands, Redo
// re-applies the derived shrink. Proven through the REAL history hook (same
// composition idiom as the 43-01 loop-history spec).
// ---------------------------------------------------------------------------

const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

function snapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
  selectedKeyId: string | null = null,
  selectedAppFrame: number | null = null,
): RotoPhysicalEditSnapshot<null> {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips);
  return {
    launchOperationId: 'launch-1',
    layerId: 'layer-1',
    projectContextId: 'project-1',
    records,
    interpolation: INTERPOLATION,
    loopClips,
    capacity: CAPACITY,
    expectedRevision: revision,
    stagedRevision: revision,
    selectedKeyId,
    selectedAppFrame,
    currentAppFrame: selectedAppFrame ?? 0,
    dirtyFrames: new Set(),
    editableFrames: records.map((entry) => entry.appFrame),
    liveOverlayActionCounts: new Map(),
    frameStates: new Map(),
    previewFrames: new Map(),
    capturedFrames: new Map(),
    confirmedFrames: new Map(),
    cachedReference: { url: null, cachedRepaintBase: null },
    engineState: null,
  };
}

function historyHarness(initial: RotoPhysicalEditSnapshot<null>) {
  const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
  const pendingOperationId = signal<string | null>(null);
  const availability = signal({ undo: 0, redo: 0 });
  let current = initial;
  let replayNumber = 0;

  const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
    const target = input.replayTargetSnapshot;
    if (!target || !input.historyProvenance) return false;
    const source = current;
    current = target;
    replayNumber += 1;
    acceptedOutput.value = {
      before: source,
      after: target,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(target.records, target.interpolation, target.loopClips),
      operationId: `replay-${replayNumber}`,
      operationKind: input.operationKind,
      historyProvenance: input.historyProvenance,
    };
    return true;
  });

  const history = useRotoPhysicalEditHistory({
    identity: { launchOperationId: 'launch-1', layerId: 'layer-1' },
    availability,
    coordinator: {
      executePhysicalEdit: executePhysicalEdit as never,
      pendingOperationId,
      acceptedOutput,
    },
    recordsPort: {
      getRecords: () => current.records,
      getInterpolation: () => current.interpolation,
      getCapacity: () => current.capacity,
      getLoopClips: () => current.loopClips,
      replaceRecords: () => ({ ok: true as const }),
      replaceLoopClips: () => ({ ok: true as const }),
    },
    undoPaint: () => false,
    redoPaint: () => false,
  });

  const accept = (
    before: RotoPhysicalEditSnapshot<null>,
    after: RotoPhysicalEditSnapshot<null>,
    operationId: string,
    operationKind: RotoPhysicalEditAcceptedOutput<null>['operationKind'],
  ) => {
    current = after;
    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(after.records, after.interpolation, after.loopClips),
      operationId,
      operationKind,
      historyProvenance: null,
    };
  };

  return { history, availability, executePhysicalEdit, accept, getCurrent: () => current };
}

describe('D-06/D-10 materialization one-history-command coherence', () => {
  it('Clear materialization: one Undo removes the key and re-expands the loop; one Redo restores key and shrink', async () => {
    const loopClips = [loop(10, 5)];
    const before = snapshot(SOURCE_RECORDS(), loopClips, 'C', 12);
    const after = snapshot([...SOURCE_RECORDS(), record('K', 20, 'RU1QVFk=')], loopClips, 'K', 20);
    const test = historyHarness(after);

    test.accept(before, after, 'clear-linked-1', 'paste-key');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
    // The accepted commit carries the derived shrink.
    expect(effectiveEndOf(test.getCurrent().records, test.getCurrent().loopClips, 'L1')).toBe(20);

    expect(await test.history.undo()).toBe(true);
    expect(test.getCurrent().records.map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E']);
    // The loop re-expands automatically — derived, never regenerated.
    expect(effectiveEndOf(test.getCurrent().records, test.getCurrent().loopClips, 'L1')).toBe(35);
    expect(resolvePhysicPaintRotoLoopFrame(derive(test.getCurrent().records, test.getCurrent().loopClips), 20).kind).toBe('linked');
    expect(test.availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await test.history.redo()).toBe(true);
    expect(test.getCurrent().records.map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E', 'K']);
    expect(effectiveEndOf(test.getCurrent().records, test.getCurrent().loopClips, 'L1')).toBe(20);
    expect(resolvePhysicPaintRotoLoopFrame(derive(test.getCurrent().records, test.getCurrent().loopClips), 20).kind).toBe('real');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });

  it('paint materialization: one Undo removes the key and re-expands the loop; one Redo restores key and shrink', async () => {
    const loopClips = [loop(10, 5)];
    const before = snapshot(SOURCE_RECORDS(), loopClips, 'C', 12);
    const after = snapshot([...SOURCE_RECORDS(), record('M', 22, 'TU0=')], loopClips, 'M', 22);
    const test = historyHarness(after);

    test.accept(before, after, 'paint-linked-1', 'paste-key');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
    expect(effectiveEndOf(test.getCurrent().records, test.getCurrent().loopClips, 'L1')).toBe(22);

    expect(await test.history.undo()).toBe(true);
    expect(test.getCurrent().records.map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(effectiveEndOf(test.getCurrent().records, test.getCurrent().loopClips, 'L1')).toBe(35);
    expect(resolvePhysicPaintRotoLoopFrame(derive(test.getCurrent().records, test.getCurrent().loopClips), 22)).toMatchObject({
      kind: 'linked',
      sourceKeyId: 'C',
    });
    expect(test.availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await test.history.redo()).toBe(true);
    expect(test.getCurrent().records.map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E', 'M']);
    expect(effectiveEndOf(test.getCurrent().records, test.getCurrent().loopClips, 'L1')).toBe(22);
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });
});
