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
  GROUP_OWNED_KEY_DELETE_REJECTED_TEXT,
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
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

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
      bytes: testWebpBytes(label),
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
    parentEndExclusive: CAPACITY,
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
      parentEndExclusive: CAPACITY,
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
  // Phase 58 D-12 (Law A): exactly one referencing loop is an independent
  // cycle and may move alone; two or more keep Phase 43 D-11 and the rigid
  // whole-cycle group drag. The locked D-16 copy stays verbatim for >= 2.
  // CR-02: the accepted destination must also keep that single cycle's
  // sourceKeyIds positions strictly increasing — the derivation law.
  it('accepts a single-key move when exactly one loop references the key — Law A (D-12)', () => {
    const sourceLoop = loop(10, 5);
    const loopClips = [sourceLoop];
    const loopClipsBefore = loopClips.map((clip) => ({ ...clip }));
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 9 } },
      loopClips,
    }));
    expect(proposal.mapping.get('A')).toBe(9);
    // D-13: an accepted single-key move carries no loop follow — placementStart
    // stays put because buildMoveCandidate never emits nextLoopClips.
    expect(proposal.nextLoopClips).toBeNull();
    // CR-02: the FINAL source order (A9, B11, C12, D13, E14) still satisfies
    // the derivation's strict-increase law, so the single referencing clip
    // resolves instead of presenting as "Source missing".
    const movedRecords = SOURCE_RECORDS().map((entry) => ({
      ...entry,
      appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame,
      payload: { ...entry.payload, appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame },
    }));
    expect(derive(movedRecords, loopClips).ranges.find((entry) => entry.loopId === 'L1')?.unresolved).toBeNull();
    // Preservation pin: the caller's loop collection is never mutated.
    expect(loopClips).toHaveLength(1);
    expect(loopClips[0]).toBe(sourceLoop);
    expect(loopClips).toEqual(loopClipsBefore);
  });

  it('rejects a single-key move that would leave a non-canonical lifecycle band — ghost-source guard', () => {
    // A painted override makes the rail non-canonical, so G-04 does not retime
    // its band. Moving the last source key past the stored end would leave it
    // outside every visible fragment and the row would paint the real key as
    // an empty cell (the v7 ghost-key fix). Refuse instead of erasing it.
    const overriddenRail: PhysicPaintRotoLoopClip = {
      ...loop(10, 1, 'L-over'),
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 15,
      visibleRanges: [{ start: 10, endExclusive: 15 }],
      frameOverrides: [{ keyId: 'O1', appFrame: 12 }],
    };
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'E', target: { kind: 'physical-cell', appFrame: 20 } },
      loopClips: [overriddenRail],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });

  it('accepts the same outward move on a canonical lifecycle rail and retimes the band', () => {
    const canonicalRail: PhysicPaintRotoLoopClip = {
      ...loop(10, 1, 'L-canon'),
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 15,
      visibleRanges: [{ start: 10, endExclusive: 15 }],
      frameOverrides: [],
    };
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'E', target: { kind: 'physical-cell', appFrame: 20 } },
      loopClips: [canonicalRail],
    }));
    const retimed = proposal.nextLoopClips?.find((clip) => clip.loopId === 'L-canon');
    // Placement 10, cycle length 11 (E moved 14 -> 20), repeat 1.
    expect(retimed?.originalEndExclusive).toBe(21);
    expect(retimed?.visibleRanges).toEqual([{ start: 10, endExclusive: 21 }]);
  });

  it('rejects an unowned-key move whose ripple pushes another clip source out of a gapped band — CR-04', () => {
    const gappedRail: PhysicPaintRotoLoopClip = {
      loopId: 'L-gap',
      placementStart: 10,
      sourceKeyIds: ['S1', 'S2'],
      repeat: 1,
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 15,
      visibleRanges: [{ start: 10, endExclusive: 12 }, { start: 13, endExclusive: 15 }],
      frameOverrides: [],
    };
    const resolution = resolveEdit({
      records: [record('S1', 10, 'S1'), record('S2', 14, 'S2'), record('X', 16, 'X')],
      intent: { kind: 'move-key', movedKeyId: 'X', target: { kind: 'physical-cell', appFrame: 13 } },
      loopClips: [gappedRail],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });

  it('rejects an unowned-key cut that shifts a canonical cycle out of its band — CR-04', () => {
    const canonicalRail: PhysicPaintRotoLoopClip = {
      loopId: 'L-canon',
      placementStart: 10,
      sourceKeyIds: ['S1', 'S2'],
      repeat: 1,
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 15,
      visibleRanges: [{ start: 10, endExclusive: 15 }],
      frameOverrides: [],
    };
    const resolution = resolveEdit({
      records: [record('X', 8, 'X'), record('S1', 10, 'S1'), record('S2', 14, 'S2')],
      intent: { kind: 'move-key', movedKeyId: 'X', target: { kind: 'physical-cell', appFrame: 20 } },
      loopClips: [canonicalRail],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });

  it('rejects a single-key move that breaks the referencing cycle order — CR-02', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'C', target: { kind: 'physical-cell', appFrame: 22 } },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });

  it('accepts a one-element source cycle move — a single source key is vacuously ordered', () => {
    const loopClips = [loop(10, 5, 'L1', ['A'])];
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 9 } },
      loopClips,
    }));
    expect(proposal.mapping.get('A')).toBe(9);
    expect(proposal.nextLoopClips).toBeNull();
    const movedRecords = SOURCE_RECORDS().map((entry) => ({
      ...entry,
      appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame,
      payload: { ...entry.payload, appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame },
    }));
    expect(derive(movedRecords, loopClips).ranges.find((entry) => entry.loopId === 'L1')?.unresolved).toBeNull();
  });

  it('fails closed when the single referencing cycle names a source key absent from the mapping — CR-02', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 9 } },
      loopClips: [loop(10, 5, 'L1', ['A', 'B', 'C', 'D', 'Z'])],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });

  it('accepts a move on a key no loop references, even when another cycle is already unresolved', () => {
    const proposal = expectOk(resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key', movedKeyId: 'H', target: { kind: 'physical-cell', appFrame: 42 } },
      loopClips: [loop(10, 5, 'L1', ['A', 'B', 'C', 'D', 'Z'])],
    }));
    expect(proposal.mapping.get('H')).toBe(42);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('accepts a no-change drag in the dangling-source scenario — changed === false is exempt', () => {
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 10 } },
      loopClips: [loop(10, 5, 'L1', ['A', 'B', 'C', 'D', 'Z'])],
    }));
    expect(proposal.mapping.get('A')).toBe(10);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('rejects a single-key move when two loops reference the key with the locked copy', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'C', target: { kind: 'physical-cell', appFrame: 22 } },
      loopClips: [loop(10, 5, 'L1'), loop(100, 5, 'L2')],
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

  it('moves an ordinary key normally when no loops exist', () => {
    const proposal = expectOk(resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key', movedKeyId: 'G', target: { kind: 'physical-cell', appFrame: 32 } },
    }));
    expect(proposal.mapping.get('G')).toBe(32);
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

  it('retimes lifecycle extents for anchored and duplicated Groups sharing one ordered source cycle', () => {
    const records = [record('A', 10, 'A'), record('B', 11, 'B'), record('C', 12, 'C')];
    const shared = {
      sourceKeyIds: ['A', 'B', 'C'] as const,
      repeat: 3 as const,
      mode: 'progressive' as const,
      scriptId: 'action-shared',
      motion: { deformation: 4, position: 2 },
      overrideColor: '#123456',
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      frameOverrides: [] as const,
    };
    const original: PhysicPaintRotoLoopClip = {
      ...shared,
      loopId: 'original',
      placementStart: 10,
      phaseOrigin: 10,
      originalEndExclusive: 19,
      visibleRanges: [{ start: 10, endExclusive: 19 }],
    };
    const duplicate: PhysicPaintRotoLoopClip = {
      ...shared,
      loopId: 'duplicate',
      placementStart: 100,
      phaseOrigin: 100,
      originalEndExclusive: 109,
      visibleRanges: [{ start: 100, endExclusive: 109 }],
    };
    const proposal = expectOk(resolveEdit({
      records,
      loopClips: [original, duplicate],
      intent: {
        kind: 'force-spacing',
        emptyFrames: 3,
        selectedKeyId: null,
        scopeKeyIds: ['A', 'B', 'C'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['A', 'B', 'C'], ['A', 'B', 'C'])],
      },
    }));

    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 10, B: 14, C: 18 });
    expect(proposal.nextLoopClips).toEqual([
      {
        ...original,
        phaseOrigin: 10,
        originalEndExclusive: 37,
        visibleRanges: [{ start: 10, endExclusive: 37 }],
      },
      {
        ...duplicate,
        phaseOrigin: 100,
        originalEndExclusive: 127,
        visibleRanges: [{ start: 100, endExclusive: 127 }],
      },
    ]);
    expect(proposal.nextLoopClips?.map(({ loopId, placementStart, sourceKeyIds }) => ({
      loopId,
      placementStart,
      sourceKeyIds,
    }))).toEqual([
      { loopId: 'original', placementStart: 10, sourceKeyIds: ['A', 'B', 'C'] },
      { loopId: 'duplicate', placementStart: 100, sourceKeyIds: ['A', 'B', 'C'] },
    ]);
  });

  it('retimes an overridden non-canonical rail during authorized Force Spacing — D-14', () => {
    const overriddenRail: PhysicPaintRotoLoopClip = {
      loopId: 'L-over',
      placementStart: 1,
      sourceKeyIds: ['K1', 'K3', 'K5'],
      repeat: 1,
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 1, endExclusive: 6 }],
      frameOverrides: [{ keyId: 'O1', appFrame: 4 }],
    };
    const proposal = expectOk(resolveEdit({
      records: [record('K1', 1, 'K1'), record('K3', 3, 'K3'), record('K5', 5, 'K5')],
      intent: {
        kind: 'force-spacing',
        emptyFrames: 2,
        selectedKeyId: null,
        scopeKeyIds: ['K1', 'K3', 'K5'],
        linkedSourceSpacingScopes: [linkedSpacingScope(['K1', 'K3', 'K5'], ['K1', 'K3', 'K5'])],
      },
      loopClips: [overriddenRail],
    }));
    expect(Object.fromEntries(proposal.mapping)).toEqual({ K1: 1, K3: 4, K5: 7 });
    const retimed = proposal.nextLoopClips?.find((clip) => clip.loopId === 'L-over');
    expect(retimed).toMatchObject({
      placementStart: 1,
      phaseOrigin: 1,
      originalEndExclusive: 8,
      visibleRanges: [{ start: 1, endExclusive: 8 }],
      frameOverrides: [{ keyId: 'O1', appFrame: 4 }],
    });
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
      parentEndExclusive: CAPACITY,
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
// Phase 58 Law A no-leak pins — the guards D-12/D-14/D-15 did not touch.
// Delete-key, delete-key-group, and both Force Spacing rejections are pinned
// by the D-07/D-11 describes above; Insert and Duplicate Group-ownership are
// pinned by physicsPaintRotoPhysicalResolver.test.ts, which this plan's verify
// runs alongside this spec. The two Key Rail guards live here.
// ---------------------------------------------------------------------------

describe('Phase 58 Law A no-leak guards', () => {
  it('keeps the delete-key-rail source-cycle guard with its locked copy', () => {
    const resolution = resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'delete-key-rail', keyIds: ['G', 'C'] },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-delete-rejected', 'delete-key-rail', D07_TEXT(1));
  });

  it('keeps the move-key-rail Group-ownership guard', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-rail', memberKeyIds: ['C'], destinationFirstKeyAppFrame: 22 },
      loopClips: [loop(10, 5)],
    });
    expectFailure(
      resolution,
      'malformed-target',
      'move-key-rail',
      'Key Rail move requires ordinary real-key members outside Group ownership.',
    );
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

  // CR-03: a partial-cycle group move stays legal only when the FINAL mapping
  // keeps every touched clip's sourceKeyIds strictly increasing. Cells 8/9 put
  // A,B before C@12 — the same partial-move intent, but now resolvable.
  it('an order-preserving partial-cycle group move stays accepted and the loop still resolves', () => {
    const loopClips = [loop(10, 5, 'L1')];
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 8 } },
      loopClips,
    }));
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 8, B: 9, C: 12, D: 13, E: 14 });
    expect(proposal.nextLoopClips).toBeNull();
    const movedRecords = SOURCE_RECORDS().map((entry) => ({
      ...entry,
      appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame,
      payload: { ...entry.payload, appFrame: proposal.mapping.get(entry.keyId) ?? entry.appFrame },
    }));
    expect(derive(movedRecords, loopClips).ranges.find((entry) => entry.loopId === 'L1')?.unresolved).toBeNull();
  });

  it('rejects a partial-cycle group move that breaks the referencing cycle order — CR-03', () => {
    const sourceLoop = loop(10, 5, 'L1');
    const loopClips = [sourceLoop];
    const loopClipsBefore = loopClips.map((clip) => ({ ...clip }));
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: GROUP_TARGET },
      loopClips,
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key-group', D11_TEXT);
    // Preservation pin: rejection never mutates the caller's loop collection.
    expect(loopClips).toHaveLength(1);
    expect(loopClips[0]).toBe(sourceLoop);
    expect(loopClips).toEqual(loopClipsBefore);
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

  it('accepts a one-element source cycle — a single source key is vacuously ordered', () => {
    const proposal = expectOk(resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 8 } },
      loopClips: [loop(10, 5, 'L1', ['A'])],
    }));
    expect(proposal.mapping.get('A')).toBe(8);
    expect(proposal.mapping.get('B')).toBe(9);
  });

  it('accepts a move on keys no clip references, even beside a dangling clip — CR-03', () => {
    const proposal = expectOk(resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key-group', movedKeyIds: ['G', 'H'], grabbedKeyId: 'G', target: { kind: 'physical-cell', appFrame: 32 } },
      loopClips: [loop(10, 5, 'L1'), loop(100, 2, 'L2', ['A', 'B', 'C', 'D', 'Z'])],
    }));
    expect(proposal.mapping.get('G')).toBe(32);
    expect(proposal.mapping.get('H')).toBe(42);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('fails closed when the move touches a dangling clip — CR-03', () => {
    const resolution = resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 8 } },
      loopClips: [loop(10, 5, 'L1'), loop(100, 2, 'L2', ['A', 'B', 'C', 'D', 'Z'])],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key-group', D11_TEXT);
  });

  it('accepts a no-change partial drag in the dangling scenario — changed === false is exempt', () => {
    const proposal = expectOk(resolveEdit({
      records: [...SOURCE_RECORDS(), ...ORDINARY_RECORDS()],
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: { kind: 'physical-cell', appFrame: 10 } },
      loopClips: [loop(10, 5, 'L1'), loop(100, 2, 'L2', ['A', 'B', 'C', 'D', 'Z'])],
    }));
    expect(proposal.mapping.get('A')).toBe(10);
    expect(proposal.mapping.get('B')).toBe(11);
    expect(proposal.nextLoopClips).toBeNull();
  });

  it('rejects the whole move when one touched clip stays ordered and another breaks — CR-03', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key-group', movedKeyIds: ['A', 'B'], grabbedKeyId: 'A', target: GROUP_TARGET },
      loopClips: [loop(10, 5, 'L1', ['A', 'B']), loop(100, 2, 'L2', ['A', 'C', 'D'])],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key-group', D11_TEXT);
  });

  it('a whole-cycle group drag retimes a canonical lifecycle band with its sources — CR-04', () => {
    const canonicalRail: PhysicPaintRotoLoopClip = {
      loopId: 'L-canon',
      placementStart: 1,
      sourceKeyIds: ['K1', 'K3', 'K5'],
      repeat: 1,
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 1, endExclusive: 6 }],
      frameOverrides: [],
    };
    const proposal = expectOk(resolveEdit({
      records: [record('K1', 1, 'K1'), record('K3', 3, 'K3'), record('K5', 5, 'K5')],
      intent: {
        kind: 'move-key-group',
        movedKeyIds: ['K1', 'K3', 'K5'],
        grabbedKeyId: 'K1',
        target: { kind: 'physical-cell', appFrame: 3 },
      },
      loopClips: [canonicalRail],
    }));
    expect(Object.fromEntries(proposal.mapping)).toEqual({ K1: 3, K3: 5, K5: 7 });
    const retimed = proposal.nextLoopClips?.find((clip) => clip.loopId === 'L-canon');
    expect(retimed).toMatchObject({
      placementStart: 3,
      phaseOrigin: 3,
      originalEndExclusive: 8,
      visibleRanges: [{ start: 3, endExclusive: 8 }],
    });
  });

  it('rejects a whole-cycle group drag that would leave a non-canonical band — CR-04', () => {
    const overriddenRail: PhysicPaintRotoLoopClip = {
      loopId: 'L-over',
      placementStart: 1,
      sourceKeyIds: ['K1', 'K3', 'K5'],
      repeat: 1,
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 1,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 1, endExclusive: 6 }],
      frameOverrides: [{ keyId: 'O1', appFrame: 4 }],
    };
    const resolution = resolveEdit({
      records: [record('K1', 1, 'K1'), record('K3', 3, 'K3'), record('K5', 5, 'K5')],
      intent: {
        kind: 'move-key-group',
        movedKeyIds: ['K1', 'K3', 'K5'],
        grabbedKeyId: 'K1',
        target: { kind: 'physical-cell', appFrame: 3 },
      },
      loopClips: [overriddenRail],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key-group', D11_TEXT);
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
      bytes: testWebpBytes('RU1QVFk='),
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
      bytes: testWebpBytes('Q0NDQ1BMVVNTVFJPS0U='),
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
    expect(materialized?.payload.bytes).toEqual(testWebpBytes('Q0NDQ1BMVVNTVFJPS0U='));
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
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    loopClips,
    incomingInterpolationBreakKeyIds: [],
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
    identity: {
      trackId: 'track-a',
      launchOperationId: 'launch-1',
      layerId: 'layer-1',
      projectContextId: 'project-1',
      capacity: CAPACITY,
    },
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
      raiseCapacity: () => {},
      getLoopClips: () => current.loopClips,
      getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
      replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true as const }),
      replaceRecords: () => ({ ok: true as const }),
      replaceLoopClips: () => ({ ok: true as const }),
    },
    getLiveSourceSnapshot: () => current,
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

// ---------------------------------------------------------------------------
// Phase 58 G-01 — a finite lifecycle extent follows the surviving source cycle.
// The stored `originalEndExclusive` is a snapshot: a delete that removes keys
// outside the source cycle must not let the derivation keep claiming (and
// rendering) the removed frames.
// ---------------------------------------------------------------------------

const EXTENT_RECORDS = () => [
  record('A', 10, 'AAAA'),
  record('B', 11, 'BBBB'),
  record('C', 12, 'CCCC'),
];

/** Source A@10 B@11 C@12, repeat 2 => surviving extent 16; stored end 20. */
function staleExtentLoop(options: {
  repeat?: number | 'infinity';
  storedEndExclusive?: number;
  visibleRanges?: readonly { start: number; endExclusive: number }[];
} = {}): PhysicPaintRotoLoopClip {
  const storedEndExclusive = options.storedEndExclusive ?? 20;
  return {
    loopId: 'L-extent',
    placementStart: 10,
    sourceKeyIds: ['A', 'B', 'C'],
    repeat: options.repeat ?? 2,
    mode: 'progressive',
    scriptId: 'action-extent',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'modified',
    provenanceState: 'attached',
    phaseOrigin: 10,
    originalEndExclusive: storedEndExclusive,
    visibleRanges: options.visibleRanges ?? [{ start: 10, endExclusive: storedEndExclusive }],
    frameOverrides: [],
  };
}

describe('Phase 58 G-01 source-derived loop extent', () => {
  it('bounds a stale finite lifecycle clip to the surviving source extent and resolves removed frames empty', () => {
    const records = EXTENT_RECORDS();
    const loopClips = [staleExtentLoop()];
    const context = derive(records, loopClips);
    const range = context.ranges.find((entry) => entry.loopId === 'L-extent');
    if (!range) throw new Error('Expected the stale extent loop to derive.');

    // 10 + (12 - 10 + 1) * 2 = 16. The stored end 20 is stale.
    expect(range.effectiveEnd).toBe(16);
    expect(range.requestedEnd).toBe(20);
    expect(range.truncated).toBe(false);
    expect(range.unresolved).toBeNull();
    // Frames below the surviving extent still resolve as cycle content.
    expect(resolvePhysicPaintRotoLoopFrame(context, 15)).toMatchObject({
      kind: 'linked',
      loopId: 'L-extent',
      sourceKeyId: 'C',
    });
    // The half-open end and everything past it resolve empty.
    expect(resolvePhysicPaintRotoLoopFrame(context, 16)).toEqual({ kind: 'empty' });
    expect(resolvePhysicPaintRotoLoopFrame(context, 17)).toEqual({ kind: 'empty' });
  });

  it('keeps a dangling source key unresolved and a non-lifecycle finite clip at its stored behavior', () => {
    const dangling = derive(
      EXTENT_RECORDS().filter((entry) => entry.keyId !== 'C'),
      [staleExtentLoop()],
    ).ranges.find((entry) => entry.loopId === 'L-extent');
    if (!dangling) throw new Error('Expected the dangling loop to derive.');
    expect(dangling.unresolved).not.toBeNull();
    expect(dangling.unresolved?.missingSourceKeyIds).toEqual(['C']);
    expect(dangling.effectiveEnd).toBe(20);

    const lifecycleLess = derive(EXTENT_RECORDS(), [loop(10, 2, 'L-plain', ['A', 'B', 'C'])])
      .ranges.find((entry) => entry.loopId === 'L-plain');
    if (!lifecycleLess) throw new Error('Expected the lifecycle-less loop to derive.');
    // No lifecycle: the derivation keeps the placementStart + cycle * repeat
    // formula and never invents a stored end.
    expect(lifecycleLess.requestedEnd).toBe(16);
    expect(lifecycleLess.effectiveEnd).toBe(16);
  });

  it('leaves an Infinity lifecycle clip extending to capacity as today', () => {
    const range = derive(EXTENT_RECORDS(), [staleExtentLoop({ repeat: 'infinity' })])
      .ranges.find((entry) => entry.loopId === 'L-extent');
    if (!range) throw new Error('Expected the Infinity loop to derive.');
    expect(range.requestedEnd).toBe('infinity');
    expect(range.effectiveEnd).toBe(CAPACITY);
    expect(range.truncated).toBe(false);
  });

  it('leaves a reveal rail at its requested span — the WR-01 stretch law owns its extent', () => {
    // Source A@10 B@11 C@12 at repeat 1 derives 13; the reveal stretch to 15
    // must survive (the new frames stay empty by design, D-07).
    const revealClip: PhysicPaintRotoLoopClip = {
      ...staleExtentLoop({ repeat: 1, storedEndExclusive: 15 }),
      railKind: 'reveal',
    };
    const range = derive(EXTENT_RECORDS(), [revealClip])
      .ranges.find((entry) => entry.loopId === 'L-extent');
    if (!range) throw new Error('Expected the reveal loop to derive.');
    expect(range.requestedEnd).toBe(15);
    expect(range.effectiveEnd).toBe(15);
    expect(range.unresolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 58-09 (G-01) — a real key whose frame a lifecycle Group owns is deletable
// only through the Group frame, never as an ordinary key.
// ---------------------------------------------------------------------------

const GROUP_OWNED_KEY_TEXT = GROUP_OWNED_KEY_DELETE_REJECTED_TEXT;

/** Source S1@0 S2@1 S3@2, repeat 2 => the Group owns [0,6). */
function lifecycleGroupClip(): PhysicPaintRotoLoopClip {
  return {
    loopId: 'L-group',
    placementStart: 0,
    sourceKeyIds: ['S1', 'S2', 'S3'],
    repeat: 2,
    mode: 'static',
    syncState: 'modified',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 6,
    visibleRanges: [{ start: 0, endExclusive: 6 }],
    frameOverrides: [],
  };
}

/** X@5 is inside the Group extent; G@30/H@31 are ordinary. */
const GROUP_OWNED_RECORDS = () => [
  record('S1', 0, 'S1S1'),
  record('S2', 1, 'S2S2'),
  record('S3', 2, 'S3S3'),
  record('X', 5, 'XXXX'),
  record('G', 30, 'GGGG'),
  record('H', 31, 'HHHH'),
];

describe('Phase 58 G-01 Group-owned key delete refusal', () => {
  it('rejects delete-key on a real key whose frame a lifecycle Group owns', () => {
    const resolution = resolveEdit({
      records: GROUP_OWNED_RECORDS(),
      intent: { kind: 'delete-key', selectedKeyId: 'X' },
      loopClips: [lifecycleGroupClip()],
    });
    expectFailure(resolution, 'group-owned-key-delete-rejected', 'delete-key', GROUP_OWNED_KEY_TEXT);
  });

  it('rejects delete-key-group as a whole when any member frame is Group-owned', () => {
    const resolution = resolveEdit({
      records: GROUP_OWNED_RECORDS(),
      intent: { kind: 'delete-key-group', keyIds: ['G', 'X'] },
      loopClips: [lifecycleGroupClip()],
    });
    expectFailure(resolution, 'group-owned-key-delete-rejected', 'delete-key-group', GROUP_OWNED_KEY_TEXT);
  });

  it('rejects delete-key-rail when any member frame is Group-owned', () => {
    const resolution = resolveEdit({
      records: GROUP_OWNED_RECORDS(),
      intent: { kind: 'delete-key-rail', keyIds: ['X', 'G', 'H'] },
      loopClips: [lifecycleGroupClip()],
    });
    expectFailure(resolution, 'group-owned-key-delete-rejected', 'delete-key-rail', GROUP_OWNED_KEY_TEXT);
  });

  it('allows deleting a real key in a lifecycle gap — the Group does not render that frame', () => {
    const gapped: PhysicPaintRotoLoopClip = {
      ...lifecycleGroupClip(),
      visibleRanges: [{ start: 0, endExclusive: 3 }, { start: 5, endExclusive: 6 }],
    };
    const records = [
      record('S1', 0, 'S1S1'),
      record('S2', 1, 'S2S2'),
      record('S3', 2, 'S3S3'),
      record('Y', 4, 'YYYY'),
      record('Z', 5, 'ZZZZ'),
      record('G', 30, 'GGGG'),
      record('H', 31, 'HHHH'),
    ];
    // Frame 4 sits in the gap [3,5): no Group content renders there, so the
    // key is deletable (and the Group-frame proposer refuses that frame too).
    const gapDelete = expectOk(resolveEdit({
      records,
      intent: { kind: 'delete-key', selectedKeyId: 'Y' },
      loopClips: [gapped],
    }));
    expect(gapDelete.mapping.has('Y')).toBe(false);
    // Frame 5 is visible Group content: still refused with the locked copy.
    expectFailure(
      resolveEdit({
        records,
        intent: { kind: 'delete-key', selectedKeyId: 'Z' },
        loopClips: [gapped],
      }),
      'group-owned-key-delete-rejected',
      'delete-key',
      GROUP_OWNED_KEY_TEXT,
    );
  });

  it('keeps the D-07 source-key refusal ahead of the Group-owned refusal', () => {
    const resolution = resolveEdit({
      records: GROUP_OWNED_RECORDS(),
      intent: { kind: 'delete-key', selectedKeyId: 'S2' },
      loopClips: [lifecycleGroupClip()],
    });
    expectFailure(resolution, 'loop-source-key-delete-rejected', 'delete-key', D07_TEXT(1));
  });

  it('still deletes keys past the surviving extent and ordinary Groups and rails', () => {
    const pastTheExtent = expectOk(resolveEdit({
      records: GROUP_OWNED_RECORDS(),
      intent: { kind: 'delete-key', selectedKeyId: 'G' },
      loopClips: [lifecycleGroupClip()],
    }));
    expect(pastTheExtent.mapping.has('G')).toBe(false);

    const ordinaryGroup = expectOk(resolveEdit({
      records: GROUP_OWNED_RECORDS(),
      intent: { kind: 'delete-key-group', keyIds: ['G'] },
      loopClips: [lifecycleGroupClip()],
    }));
    expect(ordinaryGroup.mapping.has('G')).toBe(false);

    const ordinaryRail = expectOk(resolveEdit({
      records: GROUP_OWNED_RECORDS().filter((entry) => entry.keyId !== 'X'),
      intent: { kind: 'delete-key-rail', keyIds: ['G', 'H'] },
      loopClips: [lifecycleGroupClip()],
    }));
    expect(ordinaryRail.mapping.has('G')).toBe(false);
    expect(ordinaryRail.mapping.has('H')).toBe(false);
  });
});
