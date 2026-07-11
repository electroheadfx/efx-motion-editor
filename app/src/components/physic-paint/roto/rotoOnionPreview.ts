import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { clampOnionCount, type PhysicsPaintOnionState } from '../physicsPaintWorkflowState';
import type { PhysicsPaintWorkflowOnionPreviewFrame } from '../PhysicsPaintWorkflowStrip';

export type RotoOnionFrame = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl' | 'source'>>;

const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const;

export function getRotoOnionAnchorDisplayFrame(frame: Pick<RotoOnionFrame, 'appFrame' | 'displayFrame'>): number {
  return frame.displayFrame ?? frame.appFrame;
}

export function getOnionFrameOpacity(distance: number): number {
  return ONION_DEPTH_OPACITY[Math.max(0, Math.min(ONION_DEPTH_OPACITY.length - 1, distance - 1))];
}

export function projectRotoOnionPreviewFrames(input: {
  currentFrame: number;
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
  const addCandidate = (frame: RotoOnionFrame) => {
    if (frame.source && frame.source !== 'real-key') return;
    if (frame.backgroundOnly) return;
    const anchorFrame = getRotoOnionAnchorDisplayFrame(frame);
    candidates.set(anchorFrame, typeof frame.onionDataUrl === 'string'
      ? { ...frame, appFrame: anchorFrame, source: 'real-key', dataUrl: frame.onionDataUrl, onionKind: 'stroke-preview' }
      : { ...frame, appFrame: anchorFrame, source: 'real-key', onionKind: frame.source === 'real-key' ? 'cached-composite' : 'stroke-preview' });
  };
  for (const frame of input.launchFrames ?? []) addCandidate(frame);
  for (const frame of input.storeFrames ?? []) addCandidate(frame);
  for (const [frameNumber, frame] of input.previewFrames ?? []) {
    if (input.dirtyFrames?.has(frameNumber) || !candidates.has(frameNumber)) addCandidate(frame);
  }
  const project = (frame: RotoOnionFrame & { onionKind?: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }, direction: 'previous' | 'next', distance: number): PhysicsPaintWorkflowOnionPreviewFrame => ({
    frame: frame.appFrame,
    dataUrl: frame.dataUrl,
    direction,
    distance,
    source: 'roto',
    kind: frame.onionKind,
  });
  const previous = [...candidates.values()].filter((frame) => frame.appFrame < input.currentFrame).sort((a, b) => b.appFrame - a.appFrame).slice(0, count).map((frame, index) => project(frame, 'previous', index + 1));
  const next = [...candidates.values()].filter((frame) => frame.appFrame > input.currentFrame).sort((a, b) => a.appFrame - b.appFrame).slice(0, count).map((frame, index) => project(frame, 'next', index + 1));
  return [...previous, ...next]
    .filter((frame) => (frame.direction === 'previous' && input.onion.previous) || (frame.direction === 'next' && input.onion.next))
    .sort((a, b) => b.distance - a.distance);
}
