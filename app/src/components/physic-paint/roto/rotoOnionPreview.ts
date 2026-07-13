import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { clampOnionCount, clampOnionOpacity, type PhysicsPaintOnionState } from '../view/physicsPaintWorkflowPresentation';
import type { PhysicsPaintWorkflowOnionPreviewFrame } from '../view/PhysicsPaintWorkflowStrip';

export type RotoOnionFrame = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl' | 'source'>>;

const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const;

export function getRotoOnionAnchorDisplayFrame(frame: Pick<RotoOnionFrame, 'appFrame' | 'displayFrame'>): number {
  return frame.displayFrame ?? frame.appFrame;
}

export function getOnionFrameOpacity(distance: number, opacity = 100): number {
  const depthOpacity = ONION_DEPTH_OPACITY[Math.max(0, Math.min(ONION_DEPTH_OPACITY.length - 1, distance - 1))];
  return depthOpacity * (clampOnionOpacity(opacity) / 100);
}

export function projectRotoOnionPreviewFrames(input: {
  currentFrame: number;
  currentFrameOwnerSourceFrame?: number | null;
  isPlaying: boolean;
  onion: PhysicsPaintOnionState;
  launchFrames?: readonly RotoOnionFrame[];
  storeFrames?: readonly RotoOnionFrame[];
  previewFrames?: ReadonlyMap<number, RotoOnionFrame>;
  dirtyFrames?: ReadonlySet<number>;
}): PhysicsPaintWorkflowOnionPreviewFrame[] {
  if (input.isPlaying) return [];
  const count = clampOnionCount(input.onion.count);
  const candidates = new Map<number, RotoOnionFrame & { onionKind?: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }>();
  const realDisplayBySource = new Map<number, number>();
  const projectCandidate = (frame: RotoOnionFrame, anchorFrame: number) => typeof frame.onionDataUrl === 'string'
    ? { ...frame, appFrame: anchorFrame, source: 'real-key' as const, dataUrl: frame.onionDataUrl, onionKind: 'stroke-preview' as const }
    : { ...frame, appFrame: anchorFrame, source: 'real-key' as const, onionKind: frame.source === 'real-key' ? 'cached-composite' as const : 'stroke-preview' as const };
  const addRealCandidate = (frame: RotoOnionFrame) => {
    if (frame.source && frame.source !== 'real-key') return;
    if (frame.backgroundOnly) return;
    const anchorFrame = getRotoOnionAnchorDisplayFrame(frame);
    candidates.set(anchorFrame, projectCandidate(frame, anchorFrame));
    if (frame.source === 'real-key' && typeof frame.sourceFrame === 'number') {
      realDisplayBySource.set(frame.sourceFrame, anchorFrame);
    }
  };
  for (const frame of input.launchFrames ?? []) addRealCandidate(frame);
  for (const frame of input.storeFrames ?? []) addRealCandidate(frame);
  for (const [frameNumber, frame] of input.previewFrames ?? []) {
    if (frame.source && frame.source !== 'real-key') continue;
    if (frame.backgroundOnly) continue;
    const anchorFrame = typeof frame.displayFrame === 'number'
      ? frame.displayFrame
      : realDisplayBySource.get(frame.sourceFrame ?? frameNumber) ?? frame.appFrame;
    if (!candidates.has(anchorFrame)) continue;
    if (input.dirtyFrames?.has(frameNumber)) {
      candidates.set(anchorFrame, projectCandidate(frame, anchorFrame));
    }
  }
  const project = (frame: RotoOnionFrame & { onionKind?: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }, direction: 'previous' | 'next', distance: number): PhysicsPaintWorkflowOnionPreviewFrame => ({
    frame: frame.appFrame,
    dataUrl: frame.dataUrl,
    direction,
    distance,
    source: 'roto',
    kind: frame.onionKind,
  });
  const ownerDisplayFrame = input.currentFrameOwnerSourceFrame === undefined || input.currentFrameOwnerSourceFrame === null
    ? null
    : realDisplayBySource.get(input.currentFrameOwnerSourceFrame) ?? null;
  const traversalFrame = ownerDisplayFrame ?? input.currentFrame;
  const previous = [...candidates.values()].filter((frame) => frame.appFrame < traversalFrame).sort((a, b) => b.appFrame - a.appFrame).slice(0, count).map((frame, index) => project(frame, 'previous', index + 1));
  const next = [...candidates.values()].filter((frame) => frame.appFrame > traversalFrame).sort((a, b) => a.appFrame - b.appFrame).slice(0, count).map((frame, index) => project(frame, 'next', index + 1));
  return [...previous, ...next]
    .filter((frame) => (frame.direction === 'previous' && input.onion.previous) || (frame.direction === 'next' && input.onion.next))
    .sort((a, b) => b.distance - a.distance);
}
