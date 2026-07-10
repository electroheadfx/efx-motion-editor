import { describe, expect, it } from 'vitest';
import type { PhysicPaintApplyResult } from '../../types/physicPaint';
import type { AcceptedRotoApplyResult } from './rotoApplyResultTransactions';
import { completeRotoApplyResult, isRotoApplyResult } from './rotoApplyResultTransactions';

const result = (patch: Partial<PhysicPaintApplyResult> = {}): PhysicPaintApplyResult => ({
  operationId: 'op-1',
  kind: 'apply-canvas',
  layerId: 'layer-1',
  startFrame: 4,
  appliedFrameCount: 1,
  ok: true,
  ...patch,
});

const accepted = (patch: Partial<AcceptedRotoApplyResult> = {}): AcceptedRotoApplyResult => ({
  type: 'accepted',
  ok: true,
  shouldCloseAfterSave: false,
  saveOnLeaveSourceFrame: 4,
  message: null,
  detail: result(),
  ...patch,
});

describe('rotoApplyResultTransactions', () => {
  it('owns only Roto result kinds and leaves Play-specific results in Studio', () => {
    expect(isRotoApplyResult(result({ kind: 'apply-canvas' }))).toBe(true);
    expect(isRotoApplyResult(result({ kind: 'delete-roto-frame' }))).toBe(true);
    expect(isRotoApplyResult(result({ kind: 'replace-roto-key-frames' }))).toBe(true);
    expect(isRotoApplyResult(result({ kind: 'update-roto-interpolation-settings' }))).toBe(true);
    expect(isRotoApplyResult(result({ kind: 'apply-play-canvas' }))).toBe(false);
    expect(isRotoApplyResult(result({ kind: 'update-play-render-options' }))).toBe(false);
  });

  it('preserves save-on-leave failure copy, diagnostics, retry frame, and close continuation', () => {
    expect(completeRotoApplyResult(accepted({
      ok: false,
      shouldCloseAfterSave: true,
      message: 'Could not save frame 4. Stay on this frame and try navigating again to retry.',
      detail: result({ ok: false, error: 'disk full' }),
    }), null)).toEqual({
      type: 'failure',
      frame: 4,
      message: 'Could not save frame 4. Stay on this frame and try navigating again to retry.',
      diagnosticMessage: 'Could not save frame 4. Stay on this frame and try navigating again to retry. disk full',
      shouldCloseAfterSave: true,
    });
  });

  it('completes apply-canvas and delete results through the same frame-save transaction', () => {
    expect(completeRotoApplyResult(accepted(), null)).toEqual({ type: 'save-frame', frame: 4, shouldCloseAfterSave: false });
    expect(completeRotoApplyResult(accepted({ detail: result({ kind: 'delete-roto-frame', startFrame: 7 }) }), null)).toEqual({
      type: 'save-frame',
      frame: 7,
      shouldCloseAfterSave: false,
    });
  });

  it('preserves key-action and interpolation-setting success messages', () => {
    expect(completeRotoApplyResult(accepted({ detail: result({ kind: 'replace-roto-key-frames' }) }), 'Deleted Roto key 4.')).toEqual({
      type: 'replace-key-frames',
      message: 'Deleted Roto key 4.',
    });
    expect(completeRotoApplyResult(accepted({ detail: result({ kind: 'replace-roto-key-frames' }) }), null)).toEqual({
      type: 'replace-key-frames',
      message: 'Saved Roto key changes.',
    });
    expect(completeRotoApplyResult(accepted({ detail: result({ kind: 'update-roto-interpolation-settings' }) }), null)).toEqual({
      type: 'update-interpolation-settings',
    });
  });

  it('returns null for Play-specific accepted results', () => {
    expect(completeRotoApplyResult(accepted({ detail: result({ kind: 'apply-play-canvas' }) }), null)).toBeNull();
  });
});
