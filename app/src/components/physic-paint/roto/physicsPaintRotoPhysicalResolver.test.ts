import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditResolution,
} from './physicsPaintRotoPhysicalResolver';
import { resolvePhysicPaintRotoPhysicalEdit } from './physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoKeyIdentity } from './physicsPaintRotoPhysicalModel';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';

/**
 * Post-UAT regression anchors (37-06, D-18) for the Phase 37 group intents and
 * locked mappings GD-1..GD-3 / GDel-1/GDel-2 / GFS-1..GFS-3 over the shared
 * baseline A@1, B@3, C@5, D@10. Approved natively in 37-05 (final ruling:
 * "approved — s2-s10 pass; q1-q4 confirmed"). Single-key coverage is owned by
 * the separate authorized 36.14 follow-up and stays out of scope here.
 */

function buildBaselineIdentities(): PhysicPaintRotoKeyIdentity[] {
  return [
    { keyId: 'A', appFrame: 1 },
    { keyId: 'B', appFrame: 3 },
    { keyId: 'C', appFrame: 5 },
    { keyId: 'D', appFrame: 10 },
  ];
}

function resolveBaseline(intent: PhysicPaintRotoPhysicalEditIntent): PhysicPaintRotoPhysicalEditResolution {
  return resolvePhysicPaintRotoPhysicalEdit({
    identities: buildBaselineIdentities(),
    intent,
    capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES,
    interpolationEnabled: false,
  });
}

describe('resolvePhysicPaintRotoPhysicalEdit — move-key-group (GD-1..GD-3, D-06..D-09)', () => {
  it('GD-1: accepts an empty whole-cell drop, closing source gaps and rippling unselected keys left', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GD-1 must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 7, C: 9, D: 8 });
    expect(proposal.selectedKeyId).toBe('B');
    expect(proposal.selectedAppFrame).toBe(7);
    expect(proposal.drag).toEqual({
      targetKind: 'physical-cell',
      targetKeyId: null,
      resolvedInsertionAppFrame: 7,
      movedKeyId: 'B',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
    });
    expect(proposal.status.operationKind).toBe('move-key-group');
    expect(proposal.status.text).toBe('Keys moved');
  });

  it('GD-2: rejects atomically when a selected destination collides after source closure', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 6 },
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('GD-2 must reject');
    expect(resolution.failure.code).toBe('duplicate-destination-frame');
    expect(resolution.failure.operationKind).toBe('move-key-group');
    // C lands on frame 8, occupied by the rippled unselected key D after closure.
    expect(resolution.failure.conflictingAppFrames).toEqual([8]);
  });

  it('GD-3: accepts an occupied before-caret, keeping source gaps open and rippling only at the destination boundary', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'before-key', targetKeyId: 'D' },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GD-3 must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 10, C: 12, D: 11 });
    expect(proposal.selectedKeyId).toBe('B');
    expect(proposal.selectedAppFrame).toBe(10);
    expect(proposal.drag).toEqual({
      targetKind: 'before-key',
      targetKeyId: 'D',
      resolvedInsertionAppFrame: 10,
      movedKeyId: 'B',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
    });
    expect(proposal.status.operationKind).toBe('move-key-group');
    expect(proposal.status.text).toBe('Keys moved');
  });

  it('fails closed on unknown, duplicate, or non-member intent identities with no proposal', () => {
    const unknownMember = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'Z'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });
    expect(unknownMember.ok).toBe(false);
    if (unknownMember.ok) throw new Error('unknown member must reject');
    expect(unknownMember.failure.code).toBe('unknown-operation-identity');

    const duplicateMember = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });
    expect(duplicateMember.ok).toBe(false);
    if (duplicateMember.ok) throw new Error('duplicate member must reject');
    expect(duplicateMember.failure.code).toBe('duplicate-id');

    const grabbedOutsideSet = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 7 },
    });
    expect(grabbedOutsideSet.ok).toBe(false);
    if (grabbedOutsideSet.ok) throw new Error('grabbed key outside the moved set must reject');
    expect(grabbedOutsideSet.failure.code).toBe('malformed-identity');
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — delete-key-group (GDel-1/GDel-2, D-13..D-15)', () => {
  it('GDel-1: removes the group atomically, ripples survivors left, and selects the D-14 survivor', () => {
    const resolution = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['B', 'C'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GDel-1 must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, D: 8 });
    expect(proposal.selectedKeyId).toBe('D');
    expect(proposal.selectedAppFrame).toBe(8);
    expect(proposal.removedKeyId).toBeNull();
    expect(proposal.removedKeyIds).toEqual(['B', 'C']);
    expect(proposal.status.operationKind).toBe('delete-key-group');
    expect(proposal.status.text).toBe('Keys deleted');
  });

  it('GDel-2: delete-to-empty resolves an empty mapping with null selection (D-15)', () => {
    const resolution = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['A', 'B', 'C', 'D'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GDel-2 must resolve ok');
    const { proposal } = resolution;
    expect(proposal.mapping.size).toBe(0);
    expect(proposal.orderedKeyIds).toEqual([]);
    expect(proposal.selectedKeyId).toBeNull();
    expect(proposal.selectedAppFrame).toBeNull();
    expect(proposal.removedKeyIds).toEqual(['A', 'B', 'C', 'D']);
    expect(proposal.status.operationKind).toBe('delete-key-group');
    expect(proposal.status.text).toBe('Keys deleted');
  });

  it('fails closed on absent or duplicate members with no proposal (idempotency)', () => {
    const unknownMember = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['B', 'Z'],
    });
    expect(unknownMember.ok).toBe(false);
    if (unknownMember.ok) throw new Error('unknown member must reject');
    expect(unknownMember.failure.code).toBe('unknown-operation-identity');

    const duplicateMember = resolveBaseline({
      kind: 'delete-key-group',
      keyIds: ['B', 'B'],
    });
    expect(duplicateMember.ok).toBe(false);
    if (duplicateMember.ok) throw new Error('duplicate member must reject');
    expect(duplicateMember.failure.code).toBe('duplicate-id');
  });
});

describe('resolvePhysicPaintRotoPhysicalEdit — scoped force-spacing (GFS-1..GFS-3, D-10..D-12)', () => {
  it('GFS-1: anchors the earliest selected key at its current frame and leaves unselected keys untouched', () => {
    const resolution = resolveBaseline({
      kind: 'force-spacing',
      emptyFrames: 2,
      selectedKeyId: 'B',
      scopeKeyIds: ['B', 'C'],
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('GFS-1 must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 3, C: 6, D: 10 });
    expect(proposal.selectedKeyId).toBe('B');
    expect(proposal.selectedAppFrame).toBe(3);
    expect(proposal.status.operationKind).toBe('force-spacing');
  });

  it('GFS-2: rejects atomically at the unselected hard wall (D-11)', () => {
    const resolution = resolveBaseline({
      kind: 'force-spacing',
      emptyFrames: 6,
      selectedKeyId: 'B',
      scopeKeyIds: ['B', 'C'],
    });

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('GFS-2 must reject');
    expect(resolution.failure.code).toBe('duplicate-destination-frame');
    expect(resolution.failure.operationKind).toBe('force-spacing');
    expect(resolution.failure.conflictingAppFrames).toEqual([10]);
  });

  it('GFS-3: null and undefined scope resolve exactly like the full-timeline 36.14 path', () => {
    for (const scopeKeyIds of [null, undefined] as const) {
      const resolution = resolveBaseline({
        kind: 'force-spacing',
        emptyFrames: 2,
        selectedKeyId: null,
        scopeKeyIds,
      });

      expect(resolution.ok).toBe(true);
      if (!resolution.ok) throw new Error('GFS-3 must resolve ok');
      const { proposal } = resolution;
      expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 4, C: 7, D: 10 });
      expect(proposal.status.operationKind).toBe('force-spacing');
    }
  });

  it('rejects negative and fractional emptyFrames with no proposal in both scopes', () => {
    for (const emptyFrames of [-1, 1.5]) {
      for (const scopeKeyIds of [null, ['B', 'C']] as const) {
        const resolution = resolveBaseline({
          kind: 'force-spacing',
          emptyFrames,
          selectedKeyId: scopeKeyIds === null ? null : 'B',
          scopeKeyIds,
        });

        expect(resolution.ok).toBe(false);
        if (resolution.ok) throw new Error('invalid emptyFrames must reject');
        expect(resolution.failure.code).toBe('invalid-spacing');
      }
    }
  });
});
