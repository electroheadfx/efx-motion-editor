import { describe, expect, it } from 'vitest';
import type { PhysicPaintApplyResult } from '../../../types/physicPaint';
import {
  createPendingPhysicPaintApply,
  transitionRotoApplyResult,
  transitionRotoApplyTimeout,
  type RotoApplyLifecycleSnapshot,
} from './rotoApplyTransactions';

const snapshot = (patch: Partial<RotoApplyLifecycleSnapshot> = {}): RotoApplyLifecycleSnapshot => ({
  activeOperationId: 'op-1',
  pendingApply: { operationId: 'op-1', kind: 'replace-roto-key-frames', startFrame: 4 },
  ...patch,
});

const result = (patch: Partial<PhysicPaintApplyResult> = {}): PhysicPaintApplyResult => ({
  operationId: 'op-1',
  kind: 'replace-roto-key-frames',
  layerId: 'layer-1',
  startFrame: 4,
  appliedFrameCount: 1,
  ok: true,
  ...patch,
});

describe('rotoApplyTransactions', () => {
  it('constructs the minimal apply-result matching contract from a payload', () => {
    expect(createPendingPhysicPaintApply({
      operationId: 'op-2',
      kind: 'replace-roto-key-frames',
      layerId: 'layer-1',
      startFrame: 8,
      frames: [],
    })).toEqual({ operationId: 'op-2', kind: 'replace-roto-key-frames', startFrame: 8 });
  });

  it('ignores stale results and rejects matching operations with a mismatched kind or frame', () => {
    expect(transitionRotoApplyResult(snapshot(), result({ operationId: 'stale' }))).toEqual({ type: 'ignore' });
    expect(transitionRotoApplyResult(snapshot(), result({ startFrame: 5 }))).toEqual({
      type: 'mismatch',
      message: 'Ignored mismatched physics paint apply result. Try the action again.',
    });
  });

  it('accepts matching results without save-on-leave continuation state', () => {
    expect(transitionRotoApplyResult(snapshot(), result())).toEqual({
      type: 'accepted',
      ok: true,
      message: null,
      detail: result(),
    });
    expect(transitionRotoApplyResult(snapshot(), result({ ok: false, error: 'disk full' }))).toEqual({
      type: 'accepted',
      ok: false,
      message: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.',
      detail: result({ ok: false, error: 'disk full' }),
    });
  });

  it('ignores stale timeouts and reports only the generic apply failure', () => {
    expect(transitionRotoApplyTimeout(snapshot(), 'stale')).toBeNull();
    expect(transitionRotoApplyTimeout(snapshot(), 'op-1')).toEqual({
      message: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.',
    });
  });
});
