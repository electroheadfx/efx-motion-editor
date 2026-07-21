import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { PhysicPaintRotoPhysicalRenderSource, PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';
import { clampOnionCount, clampOnionOpacity, type PhysicsPaintOnionState } from '../view/physicsPaintWorkflowPresentation';
import type { PhysicsPaintWorkflowOnionPreviewFrame } from '../view/PhysicsPaintWorkflowStrip';

export type RotoOnionFrame = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl' | 'source'>> & {
  readonly keyId?: string;
  readonly contentRevision?: string;
  readonly cacheRevision?: string;
};

interface RotoPhysicalOnionInput {
  currentFrame: number;
  isPlaying: boolean;
  onion: PhysicsPaintOnionState;
  realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  getRenderSource: (appFrame: number) => PhysicPaintRotoPhysicalRenderSource | null;
  previewFrames?: ReadonlyMap<number, RotoOnionFrame>;
  dirtyFrames?: ReadonlySet<number>;
}

/** Type-compatible input retained only while approval-gated regression sources remain TypeScript inputs. */
interface RotoLegacyOnionInput {
  currentFrame: number;
  currentFrameOwnerSourceFrame?: number | null;
  isPlaying: boolean;
  onion: PhysicsPaintOnionState;
  launchFrames?: readonly RotoOnionFrame[];
  storeFrames?: readonly RotoOnionFrame[];
  previewFrames?: ReadonlyMap<number, RotoOnionFrame>;
  dirtyFrames?: ReadonlySet<number>;
}

const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const;

/** @deprecated Production traversal uses direct physical appFrame and stable key identity. */
export function getRotoOnionAnchorDisplayFrame(frame: Pick<RotoOnionFrame, 'appFrame' | 'displayFrame'>): number {
  return frame.displayFrame ?? frame.appFrame;
}

export function getOnionFrameOpacity(distance: number, opacity = 100): number {
  const depthOpacity = ONION_DEPTH_OPACITY[Math.max(0, Math.min(ONION_DEPTH_OPACITY.length - 1, distance - 1))];
  return depthOpacity * (clampOnionOpacity(opacity) / 100);
}

function projectLegacyRotoOnionPreviewFrames(input: RotoLegacyOnionInput): PhysicsPaintWorkflowOnionPreviewFrame[] {
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
    if (frame.source === 'real-key' && typeof frame.sourceFrame === 'number') realDisplayBySource.set(frame.sourceFrame, anchorFrame);
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
    if (input.dirtyFrames?.has(frameNumber)) candidates.set(anchorFrame, projectCandidate(frame, anchorFrame));
  }
  const traversalFrame = input.currentFrameOwnerSourceFrame === undefined || input.currentFrameOwnerSourceFrame === null
    ? input.currentFrame
    : realDisplayBySource.get(input.currentFrameOwnerSourceFrame) ?? input.currentFrame;
  return projectOnionCandidates([...candidates.values()].map((frame) => ({ ...frame, onionKind: frame.onionKind ?? 'cached-composite' })), traversalFrame, input.onion, count);
}

function projectOnionCandidates(
  candidates: Array<RotoOnionFrame & { onionKind: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }>,
  currentFrame: number,
  onion: PhysicsPaintOnionState,
  count: number,
): PhysicsPaintWorkflowOnionPreviewFrame[] {
  const project = (frame: RotoOnionFrame & { onionKind: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }, direction: 'previous' | 'next', distance: number): PhysicsPaintWorkflowOnionPreviewFrame => ({
    frame: frame.appFrame,
    dataUrl: frame.dataUrl,
    direction,
    distance,
    source: 'roto',
    kind: frame.onionKind,
  });
  const previous = candidates.filter((frame) => frame.appFrame < currentFrame).sort((a, b) => b.appFrame - a.appFrame).slice(0, count).map((frame, index) => project(frame, 'previous', index + 1));
  const next = candidates.filter((frame) => frame.appFrame > currentFrame).sort((a, b) => a.appFrame - b.appFrame).slice(0, count).map((frame, index) => project(frame, 'next', index + 1));
  return [...previous, ...next]
    .filter((frame) => (frame.direction === 'previous' && onion.previous) || (frame.direction === 'next' && onion.next))
    .sort((a, b) => b.distance - a.distance);
}

export function projectRotoOnionPreviewFrames(input: RotoPhysicalOnionInput | RotoLegacyOnionInput): PhysicsPaintWorkflowOnionPreviewFrame[] {
  if (!('realKeyRecords' in input) || !('getRenderSource' in input)) return projectLegacyRotoOnionPreviewFrames(input);
  if (input.isPlaying) return [];
  const count = clampOnionCount(input.onion.count);
  const candidates: Array<RotoOnionFrame & { onionKind: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }> = [];

  for (const record of [...input.realKeyRecords].sort((a, b) => a.appFrame - b.appFrame)) {
    const source = input.getRenderSource(record.appFrame);
    if (!source || source.kind !== 'real' || source.keyId !== record.keyId || source.appFrame !== record.appFrame) continue;
    const preview = input.dirtyFrames?.has(record.appFrame) ? input.previewFrames?.get(record.appFrame) : null;
    const exactPreview = preview?.appFrame === record.appFrame
      && preview.keyId === record.keyId
      && preview.contentRevision === source.contentRevision
      ? preview
      : null;
    const frame = exactPreview ?? {
      ...source.renderedFrame,
      appFrame: record.appFrame,
      keyId: record.keyId,
      contentRevision: source.contentRevision,
      cacheRevision: source.cacheRevision,
    };
    if (frame.backgroundOnly) continue;
    candidates.push({
      ...frame,
      dataUrl: frame.onionDataUrl ?? frame.dataUrl,
      onionKind: exactPreview || frame.onionDataUrl ? 'stroke-preview' : 'cached-composite',
    });
  }

  return projectOnionCandidates(candidates, input.currentFrame, input.onion, count);
}
