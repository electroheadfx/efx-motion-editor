import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoPhysicalEditIntent,
  PhysicPaintRotoPhysicalEditResolution,
} from './physicsPaintRotoPhysicalResolver';
import { resolvePhysicPaintRotoPhysicalEdit } from './physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoKeyIdentity } from './physicsPaintRotoPhysicalModel';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';

/**
 * Group-operation regression anchors. Group Drag uses the current rigid
 * physical-translation contract; group Delete and Force Spacing retain their
 * approved Phase 37 mappings over the shared A@1, B@3, C@5, D@10 baseline.
 */

function buildBaselineIdentities(): PhysicPaintRotoKeyIdentity[] {
  return [
    { keyId: 'A', appFrame: 1 },
    { keyId: 'B', appFrame: 3 },
    { keyId: 'C', appFrame: 5 },
    { keyId: 'D', appFrame: 10 },
  ];
}

function resolveIdentities(
  identities: readonly PhysicPaintRotoKeyIdentity[],
  intent: PhysicPaintRotoPhysicalEditIntent,
  capacity = PHYSIC_PAINT_MAX_APPLY_FRAMES,
): PhysicPaintRotoPhysicalEditResolution {
  return resolvePhysicPaintRotoPhysicalEdit({
    identities,
    intent,
    capacity,
    interpolationEnabled: false,
  });
}

function resolveBaseline(intent: PhysicPaintRotoPhysicalEditIntent): PhysicPaintRotoPhysicalEditResolution {
  return resolveIdentities(buildBaselineIdentities(), intent);
}

describe('resolvePhysicPaintRotoPhysicalEdit — rigid move-key-group', () => {
  it('translates A@0 and B@1 to A@5 and B@6 without moving D@7', () => {
    const resolution = resolveIdentities([
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 1 },
      { keyId: 'D', appFrame: 7 },
    ], {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 6 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Rigid group translation must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 5, B: 6, D: 7 });
    expect(resolution.proposal.changes).toEqual([
      { keyId: 'A', beforeAppFrame: 0, afterAppFrame: 5, role: 'moved' },
      { keyId: 'B', beforeAppFrame: 1, afterAppFrame: 6, role: 'moved' },
    ]);
    expect(resolution.proposal.selectedKeyId).toBe('B');
    expect(resolution.proposal.selectedAppFrame).toBe(6);
  });

  it('keeps unselected keys fixed for a whole-cell drop', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 7 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Whole-cell group translation must resolve ok');
    const { proposal } = resolution;
    expect(Object.fromEntries(proposal.mapping)).toEqual({ A: 1, B: 7, C: 9, D: 10 });
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

  it('maps before-caret and after-caret to the adjacent physical frame without rippling the target key', () => {
    const before = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'before-key', targetKeyId: 'D' },
    });
    expect(before.ok).toBe(true);
    if (!before.ok) throw new Error('Before-caret group translation must resolve ok');
    expect(Object.fromEntries(before.proposal.mapping)).toEqual({ A: 1, B: 9, C: 11, D: 10 });
    expect(before.proposal.drag).toMatchObject({
      targetKind: 'before-key',
      targetKeyId: 'D',
      resolvedInsertionAppFrame: 9,
    });

    const after = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'B',
      target: { kind: 'after-key', targetKeyId: 'D' },
    });
    expect(after.ok).toBe(true);
    if (!after.ok) throw new Error('After-caret group translation must resolve ok');
    expect(Object.fromEntries(after.proposal.mapping)).toEqual({ A: 1, B: 11, C: 13, D: 10 });
    expect(after.proposal.drag).toMatchObject({
      targetKind: 'after-key',
      targetKeyId: 'D',
      resolvedInsertionAppFrame: 11,
    });
  });

  it('rejects whole-cell and caret translations that collide with an unselected key', () => {
    const identities = [
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 1 },
      { keyId: 'D', appFrame: 7 },
    ];
    const targets = [
      { grabbedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 7 } as const },
      { grabbedKeyId: 'A', target: { kind: 'before-key', targetKeyId: 'D' } as const },
      { grabbedKeyId: 'B', target: { kind: 'after-key', targetKeyId: 'D' } as const },
    ];

    for (const { grabbedKeyId, target } of targets) {
      const resolution = resolveIdentities(identities, {
        kind: 'move-key-group',
        movedKeyIds: ['A', 'B'],
        grabbedKeyId,
        target,
      });
      expect(resolution.ok).toBe(false);
      if (resolution.ok) throw new Error('Colliding rigid translation must reject');
      expect(resolution.failure.code).toBe('duplicate-destination-frame');
      expect(resolution.failure.conflictingAppFrames).toEqual([7]);
    }
  });

  it('rejects forward overflow and reverse underflow atomically', () => {
    const identities = [
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 2 },
      { keyId: 'D', appFrame: 7 },
    ];
    const overflow = resolveIdentities(identities, {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 9 },
    }, 10);
    expect(overflow.ok).toBe(false);
    if (overflow.ok) throw new Error('Forward overflow must reject');
    expect(overflow.failure.code).toBe('over-capacity');

    const underflow = resolveIdentities(identities, {
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 0 },
    }, 10);
    expect(underflow.ok).toBe(false);
    if (underflow.ok) throw new Error('Reverse underflow must reject');
    expect(underflow.failure.code).toBe('over-capacity');
  });

  it('supports reverse movement while preserving the selected offset', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['B', 'C'],
      grabbedKeyId: 'C',
      target: { kind: 'physical-cell', appFrame: 2 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Reverse rigid translation must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 1, B: 0, C: 2, D: 10 });
    expect(resolution.proposal.selectedKeyId).toBe('C');
    expect(resolution.proposal.selectedAppFrame).toBe(2);
  });

  it('preserves offsets for a non-contiguous selection and leaves intervening keys fixed', () => {
    const resolution = resolveBaseline({
      kind: 'move-key-group',
      movedKeyIds: ['A', 'C'],
      grabbedKeyId: 'C',
      target: { kind: 'physical-cell', appFrame: 8 },
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Non-contiguous rigid translation must resolve ok');
    expect(Object.fromEntries(resolution.proposal.mapping)).toEqual({ A: 4, B: 3, C: 8, D: 10 });
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
