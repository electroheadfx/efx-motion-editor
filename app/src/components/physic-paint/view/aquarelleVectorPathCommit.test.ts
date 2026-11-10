// ============================================================
//  61-15 — the vector commit bake seam (G-1/G-2).
//
//  THREE CONTRACTS, all leaf-level so they unit-test without mounting
//  the Studio:
//    1. VECTOR-NESS: a non-empty anchor list is the ONE signal, and a
//       Script-Off draw is refused with fixed copy (never interpolated).
//    2. ROUTE: Draft/wireframe defers the engine re-render exactly as a
//       stroke Move does; otherwise the live sheet is re-baked.
//    3. SEQUENCE: ONE in-flight latch, reset, apply, then exactly one
//       terminal callback — and a rejected apply is a failure result,
//       never a thrown rejection.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import type { AquarelleAnchor } from '@efxlab/efx-watercolor/payload';
import {
  VECTOR_PATH_SCRIPT_OFF_MESSAGE,
  isVectorAquarelleStroke,
  resolveVectorCommitRoute,
  runAquarelleScriptRebake,
  type AquarelleScriptRebakeSequence,
} from './aquarelleVectorPathCommit';

function anchor(x: number): AquarelleAnchor {
  return { x, y: 0.5, kind: 'auto' };
}

describe('61-15 the vector commit route', () => {
  it('treats only a non-empty anchor list as a vector stroke, and ships fixed Script-Off copy', () => {
    expect(isVectorAquarelleStroke({})).toBe(false);
    expect(isVectorAquarelleStroke({ anchors: [] })).toBe(false);
    expect(isVectorAquarelleStroke({ anchors: [anchor(0.2)] })).toBe(true);
    // Fixed copy: no interpolation, no template literal.
    expect(VECTOR_PATH_SCRIPT_OFF_MESSAGE).toBe(
      'Vector path rejected — Script is off, so the path would not be recorded. Turn Script on and draw it again.',
    );
    expect(VECTOR_PATH_SCRIPT_OFF_MESSAGE).not.toContain('${');
  });

  it('rebakes only when neither the Draft nor the wireframe latch is on', () => {
    expect(resolveVectorCommitRoute({ draft: false, wireframe: false })).toBe('rebake');
    expect(resolveVectorCommitRoute({ draft: true, wireframe: false })).toBe('defer-pixels');
    expect(resolveVectorCommitRoute({ draft: false, wireframe: true })).toBe('defer-pixels');
    expect(resolveVectorCommitRoute({ draft: true, wireframe: true })).toBe('defer-pixels');
  });
});

describe('61-15 runAquarelleScriptRebake', () => {
  function makeSequence(overrides: Partial<AquarelleScriptRebakeSequence> = {}): {
    readonly sequence: AquarelleScriptRebakeSequence;
    readonly calls: string[];
    readonly gate: { value: boolean };
    readonly mocks: {
      beginInFlight: ReturnType<typeof vi.fn>;
      endInFlight: ReturnType<typeof vi.fn>;
      resetSheet: ReturnType<typeof vi.fn>;
      applyTimeline: ReturnType<typeof vi.fn>;
      onSuccess: ReturnType<typeof vi.fn>;
      onFailure: ReturnType<typeof vi.fn>;
    };
  } {
    const calls: string[] = [];
    const gate = { value: false };
    const resetSheet = vi.fn(() => {
      calls.push('reset');
    });
    const applyTimeline = vi.fn(async () => {
      calls.push('apply');
      return true;
    });
    const onSuccess = vi.fn(() => {
      calls.push('success');
    });
    const onFailure = vi.fn(() => {
      calls.push('failure');
    });
    const beginInFlight = vi.fn(() => {
      gate.value = true;
    });
    const endInFlight = vi.fn(() => {
      gate.value = false;
    });
    const sequence: AquarelleScriptRebakeSequence = {
      isInFlight: () => gate.value,
      beginInFlight,
      endInFlight,
      resetSheet,
      applyTimeline,
      onSuccess,
      onFailure,
      ...overrides,
    };
    return { sequence, calls, gate, mocks: { beginInFlight, endInFlight, resetSheet, applyTimeline, onSuccess, onFailure } };
  }

  it('resets, applies, then succeeds once — holding the gate for the whole apply', async () => {
    const { sequence, calls, gate, mocks } = makeSequence();
    let gateDuringApply: boolean | null = null;
    mocks.applyTimeline.mockImplementation(async () => {
      gateDuringApply = gate.value;
      calls.push('apply');
      return true;
    });
    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(true);
    expect(calls).toEqual(['reset', 'apply', 'success']);
    expect(gateDuringApply).toBe(true);
    expect(gate.value).toBe(false);
    expect(mocks.beginInFlight).toHaveBeenCalledTimes(1);
    expect(mocks.endInFlight).toHaveBeenCalledTimes(1);
    expect(mocks.resetSheet).toHaveBeenCalledTimes(1);
    expect(mocks.applyTimeline).toHaveBeenCalledTimes(1);
    expect(mocks.onSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.onFailure).not.toHaveBeenCalled();
  });

  it('reports exactly one failure and never a success when the apply resolves false', async () => {
    const { sequence, calls, gate, mocks } = makeSequence();
    mocks.applyTimeline.mockImplementation(async () => {
      calls.push('apply');
      return false;
    });
    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);
    expect(calls).toEqual(['reset', 'apply', 'failure']);
    expect(mocks.onFailure).toHaveBeenCalledTimes(1);
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(gate.value).toBe(false);
  });

  it('converts a rejected apply into one failure result and clears the gate', async () => {
    const { sequence, gate, mocks } = makeSequence();
    mocks.applyTimeline.mockImplementation(async () => {
      throw new Error('engine refused');
    });
    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);
    expect(mocks.onFailure).toHaveBeenCalledTimes(1);
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(gate.value).toBe(false);
  });

  it('calls nothing at all while a rebake is already in flight', async () => {
    const { sequence, gate, mocks } = makeSequence();
    gate.value = true;
    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);
    expect(mocks.beginInFlight).not.toHaveBeenCalled();
    expect(mocks.endInFlight).not.toHaveBeenCalled();
    expect(mocks.resetSheet).not.toHaveBeenCalled();
    expect(mocks.applyTimeline).not.toHaveBeenCalled();
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.onFailure).not.toHaveBeenCalled();
  });
});
