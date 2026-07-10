import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../types/physicPaint';

export function normalizeCachedRotoRealKeySourceFrame(frame: PhysicPaintRotoCacheFrame): PhysicPaintRotoCacheFrame {
  const sourceFrame = frame.sourceFrame ?? frame.appFrame;
  return { ...frame, appFrame: sourceFrame, source: 'real-key', sourceFrame, displayFrame: sourceFrame };
}

export function upsertCachedRotoCacheFrame(
  frames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  renderedFrame: PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame'>>,
  backgroundOnly: boolean,
  onionFrame?: Pick<PhysicPaintRenderedFrame, 'dataUrl'> | null,
): PhysicPaintRotoCacheFrame[] {
  const sourceFrame = renderedFrame.sourceFrame ?? renderedFrame.appFrame;
  const displayFrame = renderedFrame.displayFrame ?? renderedFrame.appFrame;
  const cachedFrame: PhysicPaintRotoCacheFrame = {
    ...renderedFrame,
    appFrame: displayFrame,
    source: 'real-key',
    sourceFrame,
    displayFrame,
    ...(backgroundOnly ? { backgroundOnly: true } : {}),
    ...(onionFrame?.dataUrl ? { onionDataUrl: onionFrame.dataUrl } : {}),
  };
  return [
    ...(frames ?? []).filter((frame) => (frame.sourceFrame ?? frame.appFrame) !== sourceFrame),
    cachedFrame,
  ].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex);
}

export function removeCachedRotoCacheFrame(
  frames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  appFrame: number,
): PhysicPaintRotoCacheFrame[] {
  return (frames ?? []).filter((frame) => frame.appFrame !== appFrame);
}

export interface RotoInterpolationCacheRefresh {
  frames: PhysicPaintRotoCacheFrame[];
  realDisplayFrames: number[];
  confirmedRealKeys: Array<[number, PhysicPaintRotoCacheFrame]>;
}

export function refreshRotoInterpolationCache(
  launchFrames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  storeFrames: readonly PhysicPaintRotoCacheFrame[],
  enabled: boolean,
): RotoInterpolationCacheRefresh {
  const fallbackRealKeys = mergeRotoCacheFramesPreservingLaunchRealKeys(launchFrames, storeFrames)
    .filter((frame) => frame.source === 'real-key')
    .map(normalizeCachedRotoRealKeySourceFrame);
  const frames = storeFrames.length > 0
    ? storeFrames.filter((frame) => enabled || frame.source === 'real-key').map((frame) => ({ ...frame }))
    : fallbackRealKeys;
  const realKeys = frames.filter((frame) => frame.source === 'real-key');
  return {
    frames,
    realDisplayFrames: realKeys.map((frame) => frame.displayFrame ?? frame.appFrame).sort((a, b) => a - b),
    confirmedRealKeys: realKeys.map((frame) => [
      frame.sourceFrame ?? frame.appFrame,
      normalizeCachedRotoRealKeySourceFrame(frame),
    ]),
  };
}

export function mergeRotoCacheFramesPreservingLaunchRealKeys(
  launchFrames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  storeFrames: readonly PhysicPaintRotoCacheFrame[],
): PhysicPaintRotoCacheFrame[] {
  const merged = new Map<number, PhysicPaintRotoCacheFrame>();
  const storeRealKeySources = new Set(storeFrames
    .filter((frame) => frame.source === 'real-key')
    .map((frame) => frame.sourceFrame ?? frame.appFrame));
  for (const frame of launchFrames ?? []) {
    if (frame.source !== 'real-key') continue;
    const sourceFrame = frame.sourceFrame ?? frame.appFrame;
    if (!storeRealKeySources.has(sourceFrame)) merged.set(sourceFrame, normalizeCachedRotoRealKeySourceFrame(frame));
  }
  for (const frame of storeFrames) {
    if (frame.source === 'real-key') merged.set(frame.sourceFrame ?? frame.appFrame, normalizeCachedRotoRealKeySourceFrame(frame));
    else merged.set(frame.appFrame, { ...frame });
  }
  return Array.from(merged.values()).sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex);
}
