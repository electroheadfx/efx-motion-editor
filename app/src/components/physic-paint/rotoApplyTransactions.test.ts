import { describe, expect, it } from 'vitest';
import type { PhysicPaintApplyResult } from '../../types/physicPaint';
import {
  createPendingPhysicPaintApply,
  getRotoSaveFailureMessage,
  transitionRotoApplyResult,
  transitionRotoApplyTimeout,
  type RotoApplyLifecycleSnapshot,
} from './rotoApplyTransactions';

const snapshot = (patch: Partial<RotoApplyLifecycleSnapshot> = {}): RotoApplyLifecycleSnapshot => ({
  activeOperationId: 'op-1',
  pendingApply: { operationId: 'op-1', kind: 'apply-canvas', startFrame: 4 },
  saveOnLeaveSourceFrame: 4,
  closeAfterApplyOperationId: null,
  closeAfterRotoSaveRequested: false,
  ...patch,
});

const result = (patch: Partial<PhysicPaintApplyResult> = {}): PhysicPaintApplyResult => ({
  operationId: 'op-1',
  kind: 'apply-canvas',
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
      kind: 'delete-roto-frame',
      layerId: 'layer-1',
      startFrame: 8,
      sourceFrame: 3,
    })).toEqual({ operationId: 'op-2', kind: 'delete-roto-frame', startFrame: 8 });
  });

  it('ignores stale operation results without changing lifecycle ownership', () => {
    expect(transitionRotoApplyResult(snapshot(), result({ operationId: 'stale' }))).toEqual({ type: 'ignore' });
  });

  it('rejects matching operations with a mismatched kind or frame', () => {
    expect(transitionRotoApplyResult(snapshot(), result({ startFrame: 5 }))).toEqual({
      type: 'mismatch',
      message: 'Ignored mismatched physics paint apply result. Try saving again.',
    });
  });

  it('accepts a matching successful Roto apply and preserves close continuation', () => {
    expect(transitionRotoApplyResult(snapshot({ closeAfterRotoSaveRequested: true }), result())).toEqual({
      type: 'accepted',
      ok: true,
      shouldCloseAfterSave: true,
      saveOnLeaveSourceFrame: 4,
      message: null,
      detail: result(),
    });
  });

  it('derives save-on-leave retry copy for failed results', () => {
    expect(transitionRotoApplyResult(snapshot(), result({ ok: false, error: 'disk full' }))).toEqual({
      type: 'accepted',
      ok: false,
      shouldCloseAfterSave: false,
      saveOnLeaveSourceFrame: 4,
      message: 'Could not save frame 4. Stay on this frame and try navigating again to retry.',
      detail: result({ ok: false, error: 'disk full' }),
    });
    expect(getRotoSaveFailureMessage(null)).toBe('Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.');
  });

  it('ignores stale timeouts and derives close-save timeout recovery', () => {
    expect(transitionRotoApplyTimeout(snapshot(), 'stale')).toBeNull();
    expect(transitionRotoApplyTimeout(snapshot({ closeAfterApplyOperationId: 'op-1' }), 'op-1')).toEqual({
      message: 'Could not save frame 4. Stay on this frame and try navigating again to retry.',
      saveOnLeaveSourceFrame: 4,
      closeFailed: true,
      closeMessage: 'Could not save before closing. The main editor did not return an apply result.',
    });
  });
});
