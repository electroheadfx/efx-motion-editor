import type { PhysicPaintApplyResult } from '../../../types/physicPaint';
import type { RotoApplyResultTransition } from '../roto/rotoApplyTransactions';

export type AcceptedRotoApplyResult = Extract<RotoApplyResultTransition, { type: 'accepted' }>;

export interface RotoApplyFailureCompletion {
  type: 'failure';
  frame: number | null;
  message: string;
  diagnosticMessage: string;
  shouldCloseAfterSave: boolean;
}

export type RotoApplySuccessCompletion =
  | { type: 'replace-key-frames'; message: string }
  | { type: 'update-interpolation-settings' }
  | {
    type: 'save-frame';
    frame: number;
    shouldCloseAfterSave: boolean;
  };

export type RotoApplyResultCompletion = RotoApplyFailureCompletion | RotoApplySuccessCompletion | null;

const ROTO_RESULT_KINDS = new Set<PhysicPaintApplyResult['kind']>([
  'apply-canvas',
  'delete-roto-frame',
  'replace-roto-key-frames',
  'update-roto-interpolation-settings',
]);

export function isRotoApplyResult(detail: PhysicPaintApplyResult): boolean {
  return ROTO_RESULT_KINDS.has(detail.kind);
}

export function completeRotoApplyResult(
  transition: AcceptedRotoApplyResult,
  pendingKeyActionMessage: string | null,
): RotoApplyResultCompletion {
  if (!isRotoApplyResult(transition.detail)) return null;
  if (!transition.ok) {
    const message = transition.message ?? 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
    const diagnostic = transition.detail.error;
    return {
      type: 'failure',
      frame: transition.saveOnLeaveSourceFrame,
      message,
      diagnosticMessage: diagnostic ? `${message} ${diagnostic}` : message,
      shouldCloseAfterSave: transition.shouldCloseAfterSave,
    };
  }
  if (transition.detail.kind === 'replace-roto-key-frames') {
    return { type: 'replace-key-frames', message: pendingKeyActionMessage ?? 'Saved Roto key changes.' };
  }
  if (transition.detail.kind === 'update-roto-interpolation-settings') {
    return { type: 'update-interpolation-settings' };
  }
  return {
    type: 'save-frame',
    frame: transition.detail.startFrame,
    shouldCloseAfterSave: transition.shouldCloseAfterSave,
  };
}
