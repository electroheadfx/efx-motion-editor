import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { RotoSessionEffect } from '../roto/physicsPaintRotoSession';

export interface RotoKeyPersistencePort {
  syncKeyFrameLists: (cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  applyKeyFrames: (transaction: RotoKeyUtilityTransaction) => readonly PhysicPaintRotoCacheFrame[];
  persistKeyFrameTransaction: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
}

export interface RotoFrameDisplayPort {
  restoreFrame: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, refreshedCacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  clearCanvas: (frame: number) => void;
  navigate: (frame: number) => Promise<void | boolean>;
  clearCachedReferenceFrame: (frame: number) => void;
}

export function createRotoKeyPersistencePort(): RotoKeyPersistencePort {
  return {
    syncKeyFrameLists: () => {},
    applyKeyFrames: () => [],
    persistKeyFrameTransaction: async () => {},
  };
}

export function createRotoFrameDisplayPort(): RotoFrameDisplayPort {
  return {
    restoreFrame: () => {},
    clearCanvas: () => {},
    navigate: async () => false,
    clearCachedReferenceFrame: () => {},
  };
}
