import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';

/** Type-only legacy declarations retained until approval-gated regression cleanup. */
export declare function normalizeCachedRotoRealKeySourceFrame(frame: PhysicPaintRotoCacheFrame): PhysicPaintRotoCacheFrame;
export declare function upsertCachedRotoCacheFrame(
  frames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  renderedFrame: PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame'>>,
  backgroundOnly: boolean,
  onionFrame?: Pick<PhysicPaintRenderedFrame, 'dataUrl'> | null,
): PhysicPaintRotoCacheFrame[];
export declare function removeCachedRotoCacheFrame(
  frames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  appFrame: number,
): PhysicPaintRotoCacheFrame[];
export interface RotoInterpolationCacheRefresh {
  frames: PhysicPaintRotoCacheFrame[];
  realDisplayFrames: number[];
  confirmedRealKeys: Array<[number, PhysicPaintRotoCacheFrame]>;
}
export declare function refreshRotoInterpolationCache(
  launchFrames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  storeFrames: readonly PhysicPaintRotoCacheFrame[],
  enabled: boolean,
): RotoInterpolationCacheRefresh;
export declare function mergeRotoCacheFramesPreservingLaunchRealKeys(
  launchFrames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  storeFrames: readonly PhysicPaintRotoCacheFrame[],
): PhysicPaintRotoCacheFrame[];
