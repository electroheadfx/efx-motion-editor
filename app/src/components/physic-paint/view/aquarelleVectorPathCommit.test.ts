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

  // 261112-i6d: the host is yielded ONE turn after the latch opens and before
  // any work. A re-bake only yields between FED strokes (and not at all for a
  // single-stroke script), so without this turn a blocker bound to the latch
  // could never paint — the canvas just went dead and jumped to the result.
  it('hands the host one turn between the latch and the work', async () => {
    const { sequence, mocks } = makeSequence();
    const pending = runAquarelleScriptRebake(sequence);

    // The latch is synchronous; the work is NOT — it waits for the host turn.
    expect(mocks.beginInFlight).toHaveBeenCalledTimes(1);
    expect(mocks.resetSheet).not.toHaveBeenCalled();
    expect(mocks.applyTimeline).not.toHaveBeenCalled();

    await expect(pending).resolves.toBe(true);
    expect(mocks.resetSheet).toHaveBeenCalledTimes(1);
    expect(mocks.applyTimeline).toHaveBeenCalledTimes(1);
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

// 62-04 (D-13): cancellation is a THIRD, mutually exclusive terminal. A
// cancelled apply publishes nothing — no reset, no apply once the predicate is
// true before the work, no success and no failure — and it still releases the
// latch it took. `yieldForPaint` hands the host real turns on both sides of the
// sequence, so a predicate flipped while the apply is pending is observed at
// the commit turn and the cancellation wins.
describe('62-04 the rebake sequence third terminal — a cancelled apply publishes nothing', () => {
  type CancellableSequence = AquarelleScriptRebakeSequence & {
    readonly isCancelled?: () => boolean;
    readonly onCancelled?: () => void;
  };

  function makeSequence(
    isCancelled: () => boolean,
    overrides: Partial<CancellableSequence> = {},
  ): {
    readonly sequence: CancellableSequence;
    readonly calls: string[];
    readonly gate: { value: boolean };
    readonly mocks: {
      beginInFlight: ReturnType<typeof vi.fn>;
      endInFlight: ReturnType<typeof vi.fn>;
      resetSheet: ReturnType<typeof vi.fn>;
      applyTimeline: ReturnType<typeof vi.fn>;
      onSuccess: ReturnType<typeof vi.fn>;
      onFailure: ReturnType<typeof vi.fn>;
      onCancelled: ReturnType<typeof vi.fn>;
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
    const onCancelled = vi.fn(() => {
      calls.push('cancelled');
    });
    const beginInFlight = vi.fn(() => {
      gate.value = true;
      calls.push('begin');
    });
    const endInFlight = vi.fn(() => {
      gate.value = false;
      calls.push('end');
    });
    const sequence: CancellableSequence = {
      isInFlight: () => gate.value,
      beginInFlight,
      endInFlight,
      resetSheet,
      applyTimeline,
      onSuccess,
      onFailure,
      isCancelled,
      onCancelled,
      ...overrides,
    };
    return {
      sequence,
      calls,
      gate,
      mocks: { beginInFlight, endInFlight, resetSheet, applyTimeline, onSuccess, onFailure, onCancelled },
    };
  }

  it('publishes only the cancellation terminal when cancelled before the work starts', async () => {
    const { sequence, calls, gate, mocks } = makeSequence(() => true);

    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);

    // The cancelled run touches neither the sheet nor the apply.
    expect(mocks.resetSheet).not.toHaveBeenCalled();
    expect(mocks.applyTimeline).not.toHaveBeenCalled();
    // Exactly one terminal, and it is the cancellation.
    expect(mocks.onCancelled).toHaveBeenCalledTimes(1);
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.onFailure).not.toHaveBeenCalled();
    // The latch is released before the terminal runs.
    expect(gate.value).toBe(false);
    expect(calls.indexOf('end')).toBeGreaterThan(-1);
    expect(calls.indexOf('cancelled')).toBeGreaterThan(calls.indexOf('end'));
  });

  it('takes the cancellation terminal when the predicate flips while the apply is pending', async () => {
    let cancelled = false;
    const { sequence, mocks } = makeSequence(() => cancelled);
    mocks.applyTimeline.mockImplementation(async () => {
      // The undo lands mid-bake: the apply itself resolves true.
      cancelled = true;
      return true;
    });

    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);

    expect(mocks.resetSheet).toHaveBeenCalledTimes(1);
    expect(mocks.applyTimeline).toHaveBeenCalledTimes(1);
    expect(mocks.onCancelled).toHaveBeenCalledTimes(1);
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.onFailure).not.toHaveBeenCalled();
  });

  it('takes the cancellation terminal, never the failure terminal, when a cancelled apply rejects', async () => {
    let cancelled = false;
    const { sequence, mocks } = makeSequence(() => cancelled);
    mocks.applyTimeline.mockImplementation(async () => {
      cancelled = true;
      throw new Error('engine refused');
    });

    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);

    expect(mocks.onCancelled).toHaveBeenCalledTimes(1);
    expect(mocks.onFailure).not.toHaveBeenCalled();
    expect(mocks.onSuccess).not.toHaveBeenCalled();
  });

  it('keeps the shipped success/failure terminals byte-identical without a cancellation', async () => {
    const success = makeSequence(() => false);
    await expect(runAquarelleScriptRebake(success.sequence)).resolves.toBe(true);
    expect(success.mocks.onSuccess).toHaveBeenCalledTimes(1);
    expect(success.mocks.onFailure).not.toHaveBeenCalled();
    expect(success.mocks.onCancelled).not.toHaveBeenCalled();

    const failure = makeSequence(() => false);
    failure.mocks.applyTimeline.mockImplementation(async () => false);
    await expect(runAquarelleScriptRebake(failure.sequence)).resolves.toBe(false);
    expect(failure.mocks.onFailure).toHaveBeenCalledTimes(1);
    expect(failure.mocks.onSuccess).not.toHaveBeenCalled();
    expect(failure.mocks.onCancelled).not.toHaveBeenCalled();

    const rejected = makeSequence(() => false);
    rejected.mocks.applyTimeline.mockImplementation(async () => {
      throw new Error('engine refused');
    });
    await expect(runAquarelleScriptRebake(rejected.sequence)).resolves.toBe(false);
    expect(rejected.mocks.onFailure).toHaveBeenCalledTimes(1);
    expect(rejected.mocks.onCancelled).not.toHaveBeenCalled();

    // No predicate at all: the shipped object shape is untouched.
    const plain = makeSequence(() => false);
    const withoutPredicate: AquarelleScriptRebakeSequence = {
      isInFlight: plain.sequence.isInFlight,
      beginInFlight: plain.sequence.beginInFlight,
      endInFlight: plain.sequence.endInFlight,
      resetSheet: plain.sequence.resetSheet,
      applyTimeline: plain.sequence.applyTimeline,
      onSuccess: plain.sequence.onSuccess,
      onFailure: plain.sequence.onFailure,
    };
    await expect(runAquarelleScriptRebake(withoutPredicate)).resolves.toBe(true);
    expect(plain.mocks.onSuccess).toHaveBeenCalledTimes(1);
    expect(plain.mocks.onFailure).not.toHaveBeenCalled();
  });

  it('releases the in-flight latch before the cancellation terminal and still fails closed when already in flight', async () => {
    const { sequence, calls, gate, mocks } = makeSequence(() => true);
    await expect(runAquarelleScriptRebake(sequence)).resolves.toBe(false);
    expect(calls.indexOf('end')).toBeGreaterThan(-1);
    expect(calls.indexOf('cancelled')).toBeGreaterThan(calls.indexOf('end'));
    expect(gate.value).toBe(false);
    expect(mocks.endInFlight).toHaveBeenCalledTimes(1);

    // An already-in-flight call is still a refusal with NO terminal of any kind.
    const busy = makeSequence(() => true);
    busy.gate.value = true;
    await expect(runAquarelleScriptRebake(busy.sequence)).resolves.toBe(false);
    expect(busy.mocks.beginInFlight).not.toHaveBeenCalled();
    expect(busy.mocks.endInFlight).not.toHaveBeenCalled();
    expect(busy.mocks.resetSheet).not.toHaveBeenCalled();
    expect(busy.mocks.applyTimeline).not.toHaveBeenCalled();
    expect(busy.mocks.onSuccess).not.toHaveBeenCalled();
    expect(busy.mocks.onFailure).not.toHaveBeenCalled();
    expect(busy.mocks.onCancelled).not.toHaveBeenCalled();
  });
});
