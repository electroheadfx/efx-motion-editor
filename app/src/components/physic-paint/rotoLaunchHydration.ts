import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../types/physicPaint';
import { mergeRotoCacheFramesPreservingLaunchRealKeys, normalizeCachedRotoRealKeySourceFrame } from './roto/rotoCacheTransactions';

export interface RotoLaunchHydrationStore {
  getRealRotoKeyFrames(layerId: string): number[];
  upsertRealRotoKeyFrame(layerId: string, frame: number, renderedFrame: PhysicPaintRenderedFrame, backgroundOnly?: boolean): void;
  setRotoInterpolationSettings(layerId: string, settings: Partial<PhysicPaintRotoInterpolationSettings>): void;
  getRotoInterpolationSettings(layerId: string): PhysicPaintRotoInterpolationSettings;
  getRotoCacheFrames(layerId: string): PhysicPaintRotoCacheFrame[];
}

export function seedRotoLaunchRealKeys(
  context: PhysicPaintLaunchContext,
  store: RotoLaunchHydrationStore,
): void {
  const existingSources = new Set(store.getRealRotoKeyFrames(context.layerId));
  for (const frame of context.cachedRotoFrames ?? []) {
    if (frame.source !== 'real-key') continue;
    const sourceFrame = frame.sourceFrame ?? frame.appFrame;
    if (existingSources.has(sourceFrame)) continue;
    store.upsertRealRotoKeyFrame(context.layerId, sourceFrame, frame, frame.backgroundOnly === true);
    existingSources.add(sourceFrame);
  }
}

export function hydrateRotoLaunchContext(
  context: PhysicPaintLaunchContext,
  store: RotoLaunchHydrationStore,
): PhysicPaintLaunchContext {
  if (!context.rotoInterpolationSettings) return context;
  seedRotoLaunchRealKeys(context, store);
  store.setRotoInterpolationSettings(context.layerId, context.rotoInterpolationSettings);
  const settings = store.getRotoInterpolationSettings(context.layerId);
  const storeFrames = store.getRotoCacheFrames(context.layerId);
  const fallbackFrames = mergeRotoCacheFramesPreservingLaunchRealKeys(context.cachedRotoFrames, storeFrames);
  const cachedRotoFrames = settings.enabled && storeFrames.length > 0
    ? storeFrames
    : fallbackFrames.filter((frame) => frame.source === 'real-key').map(normalizeCachedRotoRealKeySourceFrame);
  return { ...context, cachedRotoFrames, rotoInterpolationSettings: settings };
}
