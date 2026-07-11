import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { RotoSession, RotoSessionEffect } from '../roto/physicsPaintRotoSession';

export interface RotoKeyPersistencePort {
  syncKeyFrameLists: (cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  applyKeyFrames: (transaction: RotoKeyUtilityTransaction) => readonly PhysicPaintRotoCacheFrame[];
  persistKeyFrameTransaction: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
  saveFrameBeforeContinuation: (effect: Extract<RotoSessionEffect, { type: 'saveFrame' }>, session: RotoSession) => Promise<boolean>;
}

export interface RotoFrameDisplayPort {
  restoreFrame: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>) => void;
  clearCanvas: (frame: number) => void;
  openAfterSave: (frame: number) => Promise<void | boolean>;
  clearCachedReferenceFrame: (frame: number) => void;
}

export function createRotoKeyPersistencePort(): RotoKeyPersistencePort {
  return {
    syncKeyFrameLists: () => {},
    applyKeyFrames: () => [],
    persistKeyFrameTransaction: async () => {},
    saveFrameBeforeContinuation: async () => false,
  };
}

export function createRotoFrameDisplayPort(): RotoFrameDisplayPort {
  return {
    restoreFrame: () => {},
    clearCanvas: () => {},
    openAfterSave: async () => false,
    clearCachedReferenceFrame: () => {},
  };
}
