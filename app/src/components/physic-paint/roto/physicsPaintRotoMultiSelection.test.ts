import { describe, expect, it } from 'vitest';
import type { RotoKeySelectionState } from './physicsPaintRotoMultiSelection';
import {
  collapseRotoKeySelection,
  extendRotoKeySelectionRange,
  resolvePostAcceptanceRotoSelection,
  selectAllRotoKeyIds,
  toggleRotoKeySelection,
} from './physicsPaintRotoMultiSelection';

/**
 * Post-UAT regression anchors (37-06, D-18) for the Phase 37 selection
 * reducers (D-01, D-02, D-05, D-17). Probe-assumption semantics encode the
 * UAT-approved rulings recorded in 37-05-SUMMARY.md: Q1 CONFIRMED (toggling
 * out the current key transfers current to the next selected key in frame
 * order, fallback previous; removal no-ops when it would empty the set) and
 * Q2 CONFIRMED (shift-click makes the clicked key the current editing key).
 * Baseline ordered identities [A, B, C, D] with current key B.
 */

const ORDERED = ['A', 'B', 'C', 'D'] as const;

function selection(selectedKeyIds: readonly string[], anchorKeyId: string | null): RotoKeySelectionState {
  return { selectedKeyIds: [...selectedKeyIds], anchorKeyId };
}

describe('selectAllRotoKeyIds (D-03/D-05)', () => {
  it('returns every keyId in the given order with the current key as anchor', () => {
    expect(selectAllRotoKeyIds(ORDERED, 'B')).toEqual({
      selectedKeyIds: ['A', 'B', 'C', 'D'],
      anchorKeyId: 'B',
    });
  });

  it('returns an empty selection for empty input and never fabricates an identity', () => {
    expect(selectAllRotoKeyIds([], 'B')).toEqual({ selectedKeyIds: [], anchorKeyId: null });
  });
});

describe('toggleRotoKeySelection (D-01/D-02, Q1 approved)', () => {
  it('adds an absent keyId in identity order without duplicates and makes it the anchor', () => {
    const result = toggleRotoKeySelection(selection(['B'], 'B'), ORDERED, 'C', 'B');
    expect(result.state).toEqual({ selectedKeyIds: ['B', 'C'], anchorKeyId: 'C' });
    expect(result.currentKeyId).toBe('B');
  });

  it('removes a present non-current keyId and falls the anchor back to the current key', () => {
    const result = toggleRotoKeySelection(selection(['B', 'C'], 'C'), ORDERED, 'C', 'B');
    expect(result.state).toEqual({ selectedKeyIds: ['B'], anchorKeyId: 'B' });
    expect(result.currentKeyId).toBe('B');
  });

  it('never empties the set: removing the sole selected key no-ops (D-02)', () => {
    const before = selection(['B'], 'B');
    const result = toggleRotoKeySelection(before, ORDERED, 'B', 'B');
    expect(result.state).toBe(before);
    expect(result.currentKeyId).toBe('B');
  });

  it('Q1: removing the current key transfers current to the next selected key in identity order', () => {
    const result = toggleRotoKeySelection(selection(['A', 'B', 'C'], 'B'), ORDERED, 'B', 'B');
    expect(result.state).toEqual({ selectedKeyIds: ['A', 'C'], anchorKeyId: 'C' });
    expect(result.currentKeyId).toBe('C');
  });

  it('Q1: removing the current key falls back to the previous selected key when none follow', () => {
    const result = toggleRotoKeySelection(selection(['B', 'C'], 'C'), ORDERED, 'C', 'C');
    expect(result.state).toEqual({ selectedKeyIds: ['B'], anchorKeyId: 'B' });
    expect(result.currentKeyId).toBe('B');
  });

  it('rejects an unknown keyId fail-closed with state unchanged', () => {
    const before = selection(['B', 'C'], 'C');
    const result = toggleRotoKeySelection(before, ORDERED, 'Z', 'B');
    expect(result.state).toBe(before);
    expect(result.currentKeyId).toBe('B');
  });
});

describe('extendRotoKeySelectionRange (D-01, Q2 approved)', () => {
  it('selects the contiguous anchor-to-target run inclusive and makes the target current (Q2)', () => {
    const result = extendRotoKeySelectionRange(selection(['B'], 'B'), ORDERED, 'D');
    expect(result.state).toEqual({ selectedKeyIds: ['B', 'C', 'D'], anchorKeyId: 'B' });
    expect(result.currentKeyId).toBe('D');
  });

  it('keeps the anchor unchanged across repeated extensions', () => {
    const result = extendRotoKeySelectionRange(selection(['B', 'C', 'D'], 'B'), ORDERED, 'A');
    expect(result.state).toEqual({ selectedKeyIds: ['A', 'B'], anchorKeyId: 'B' });
    expect(result.currentKeyId).toBe('A');
  });

  it('rejects an unknown target fail-closed with state unchanged and no current change', () => {
    const before = selection(['B'], 'B');
    const result = extendRotoKeySelectionRange(before, ORDERED, 'Z');
    expect(result.state).toBe(before);
    expect(result.currentKeyId).toBeNull();
  });

  it('rejects a null anchor fail-closed with state unchanged and no current change', () => {
    const before = selection([], null);
    const result = extendRotoKeySelectionRange(before, ORDERED, 'C');
    expect(result.state).toBe(before);
    expect(result.currentKeyId).toBeNull();
  });
});

describe('collapseRotoKeySelection (D-02)', () => {
  it('returns exactly the current key with itself as anchor', () => {
    expect(collapseRotoKeySelection('B')).toEqual({ selectedKeyIds: ['B'], anchorKeyId: 'B' });
  });

  it('returns the empty state for a null current', () => {
    expect(collapseRotoKeySelection(null)).toEqual({ selectedKeyIds: [], anchorKeyId: null });
  });
});

describe('resolvePostAcceptanceRotoSelection (D-17)', () => {
  const state = selection(['B', 'C'], 'B');

  it("keeps the moved set after 'move-key-group' and moves the anchor to the accepted grabbed key", () => {
    expect(resolvePostAcceptanceRotoSelection({
      operationKind: 'move-key-group',
      acceptedSelectedKeyId: 'C',
      state,
      currentKeyId: 'B',
    })).toEqual({ selectedKeyIds: ['B', 'C'], anchorKeyId: 'C' });
  });

  it("keeps the set unchanged after 'force-spacing' (keyIds survive retiming)", () => {
    expect(resolvePostAcceptanceRotoSelection({
      operationKind: 'force-spacing',
      acceptedSelectedKeyId: 'B',
      state,
      currentKeyId: 'B',
    })).toEqual({ selectedKeyIds: ['B', 'C'], anchorKeyId: 'B' });
  });

  it("collapses to the accepted survivor after 'delete-key-group' (D-14)", () => {
    expect(resolvePostAcceptanceRotoSelection({
      operationKind: 'delete-key-group',
      acceptedSelectedKeyId: 'D',
      state,
      currentKeyId: 'B',
    })).toEqual({ selectedKeyIds: ['D'], anchorKeyId: 'D' });
  });

  it('collapses to the accepted selectedKeyId for every other operation kind', () => {
    expect(resolvePostAcceptanceRotoSelection({
      operationKind: 'move-key',
      acceptedSelectedKeyId: 'B',
      state,
      currentKeyId: 'B',
    })).toEqual({ selectedKeyIds: ['B'], anchorKeyId: 'B' });
    expect(resolvePostAcceptanceRotoSelection({
      operationKind: 'paste-key',
      acceptedSelectedKeyId: 'A',
      state,
      currentKeyId: 'B',
    })).toEqual({ selectedKeyIds: ['A'], anchorKeyId: 'A' });
  });
});
