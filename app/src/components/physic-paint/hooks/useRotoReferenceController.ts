import { useCallback, useRef, useState } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { PhysicPaintRotoPhysicalRenderableSource, PhysicPaintRotoPhysicalRenderSource } from '../roto/physicsPaintRotoPhysicalModel';
import { isRotoPngDataUrl } from '../roto/rotoCanvasFrames';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';

export type RotoReferenceFrame = PhysicPaintRenderedFrame & {
  readonly keyId?: string;
  readonly contentRevision?: string;
  readonly cacheRevision?: string;
};

export interface RotoReferenceEngine {
  setBgMode: (mode: BgMode) => void;
  clear: () => void;
  setPreviewBaseImageUrl: (dataUrl: string, generation?: number) => void;
  clearPreviewBaseImage: () => void;
  resetBackground: () => void;
}

interface RotoPhysicalLookupInput<Frame extends RotoReferenceFrame> {
  getPhysicalRenderSource?: (appFrame: number) => PhysicPaintRotoPhysicalRenderSource | null;
  previewFrames?: ReadonlyMap<number, Frame>;
  dirtyFrames?: ReadonlySet<number>;
  /** Type-only legacy regression inputs; production lookup ignores them. */
  cachedRotoFrames?: readonly Frame[];
  confirmedFrames?: ReadonlyMap<number, Frame>;
  getRotoFrame?: (appFrame: number) => Frame | null;
  getFrame?: (appFrame: number) => Frame | null;
}

function projectPhysicalSource<Frame extends RotoReferenceFrame>(source: PhysicPaintRotoPhysicalRenderableSource): Frame {
  return {
    ...source.renderedFrame,
    appFrame: source.appFrame,
    ...(source.kind === 'real' ? { keyId: source.keyId } : {}),
    contentRevision: source.contentRevision,
    cacheRevision: source.cacheRevision,
  } as Frame;
}

function isCurrentGeneratedPngSource(source: PhysicPaintRotoPhysicalRenderableSource): boolean {
  if (source.kind !== 'generated') return true;
  const hasSourceCycleId = typeof source.sourceCycleId === 'string';
  const hasCycleOffset = source.cycleOffset !== undefined;
  if (hasSourceCycleId !== hasCycleOffset) return false;
  const expectedCacheRevision = hasSourceCycleId
    ? source.sourceCycleId.length > 0
      && Number.isInteger(source.cycleOffset)
      && source.cycleOffset! >= 0
      ? `${source.contentRevision}:linked-generated:${source.interpolationMode}:${source.sourceCycleId}:${source.leftKeyId}:${source.rightKeyId}:${source.cycleOffset}`
      : null
    : `${source.contentRevision}:generated:${source.interpolationMode}:${source.leftKeyId}:${source.rightKeyId}:${source.appFrame}`;
  return expectedCacheRevision !== null
    && source.renderedFrame.appFrame === source.appFrame
    && source.cacheRevision === expectedCacheRevision
    && isRotoPngDataUrl(source.renderedFrame.dataUrl);
}

function findAcceptedRotoPhysicalFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoPhysicalLookupInput<Frame>): Frame | null {
  const source = input.getPhysicalRenderSource?.(appFrame) ?? null;
  if (!source) return null;
  switch (source.kind) {
    case 'loop-placeholder':
      return null;
    case 'real':
    case 'generated':
      break;
    default: {
      const exhaustive: never = source;
      throw new Error(`Unhandled Roto physical render-source kind: ${JSON.stringify(exhaustive)}`);
    }
  }
  return isCurrentGeneratedPngSource(source) ? projectPhysicalSource<Frame>(source) : null;
}

/** Exact physical-cell lookup. No generic frame or neighboring-key fallback. */
export function findCachedRotoDisplayFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoPhysicalLookupInput<Frame>): Frame | null {
  const accepted = findAcceptedRotoPhysicalFrame(appFrame, input);
  if (!accepted) return null;
  if (accepted.keyId !== undefined && input.dirtyFrames?.has(appFrame)) {
    const preview = input.previewFrames?.get(appFrame);
    if (preview?.appFrame === appFrame
      && preview.keyId === accepted.keyId
      && preview.contentRevision === accepted.contentRevision) return preview;
  }
  return accepted;
}

export function findCachedRotoReferenceFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoPhysicalLookupInput<Frame>): Frame | null {
  return findCachedRotoDisplayFrame(appFrame, input);
}

export function findAcceptedRotoReferenceFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoPhysicalLookupInput<Frame>): Frame | null {
  return findAcceptedRotoPhysicalFrame(appFrame, input);
}

export interface RotoReferenceLoaderInput<Frame extends RotoReferenceFrame> {
  getWorkflowMode: () => PhysicsPaintWorkflowMode;
  getSettingsBackground: () => BgMode;
  dirtyFrames: Set<number>;
  liveOverlayActionCounts: Map<number, number>;
  getReferenceFrame: (appFrame: number) => Frame | null;
  setReferenceUrl: (value: string | null) => void;
  setRepaintBaseFrame: (value: Frame | null | ((current: Frame | null) => Frame | null)) => void;
  syncPending: () => void;
  setApplyMessage: (message: string) => void;
  replaceDirtyFrame?: boolean;
  /** regression-refresh-multi-paint: monotonic generation token carried by the
   * preview-base paint — the engine's apply seam uses it to no-op stale writes. */
  generation?: number;
  /** Overrides the dataUrl painted by this load. Used by the completion guard's
   * repair so it re-applies ONLY the intended (newest) image — never whatever
   * the frame lookup happens to resolve to at repair time. */
  explicitDataUrl?: string | null;
}

export function createRotoReferenceLoader<Frame extends RotoReferenceFrame>(input: RotoReferenceLoaderInput<Frame>) {
  const load = (appFrame: number, engine: RotoReferenceEngine | null): boolean => {
    if (!engine || input.getWorkflowMode() !== 'roto') {
      input.setReferenceUrl(null);
      input.setRepaintBaseFrame(null);
      return false;
    }
    if (input.dirtyFrames.has(appFrame) && !input.replaceDirtyFrame) {
      input.setReferenceUrl(null);
      input.setRepaintBaseFrame((current) => current?.appFrame === appFrame ? current : null);
      return false;
    }
    const cachedFrame = input.getReferenceFrame(appFrame);
    input.setReferenceUrl(null);
    input.setRepaintBaseFrame(cachedFrame);
    engine.setBgMode(input.getSettingsBackground());
    engine.clear();
    const paintDataUrl = input.explicitDataUrl ?? cachedFrame?.dataUrl ?? null;
    if (paintDataUrl) {
      engine.setPreviewBaseImageUrl(paintDataUrl, input.generation);
      const wasDirty = input.dirtyFrames.delete(appFrame);
      const hadLiveOverlay = input.liveOverlayActionCounts.delete(appFrame);
      if (wasDirty || hadLiveOverlay) input.syncPending();
      input.setApplyMessage(`Cached physical base loaded for frame ${appFrame}. Add paint to update this key.`);
    } else {
      engine.clearPreviewBaseImage();
      engine.resetBackground();
    }
    return Boolean(cachedFrame || paintDataUrl);
  };

  return { load };
}

export interface UseRotoReferenceControllerInput<Frame extends RotoReferenceFrame> {
  workflowMode: PhysicsPaintWorkflowMode;
  settingsBackground: BgMode;
  getPhysicalRenderSource: (appFrame: number) => PhysicPaintRotoPhysicalRenderSource | null;
  getPreviewFrames: () => ReadonlyMap<number, Frame>;
  getDirtyFrames: () => Set<number>;
  getLiveOverlayActionCounts: () => Map<number, number>;
  syncPending: () => void;
  setApplyMessage: (message: string) => void;
}

export function useRotoReferenceController<Frame extends RotoReferenceFrame>(input: UseRotoReferenceControllerInput<Frame>) {
  const [cachedRotoReferenceUrl, setCachedRotoReferenceUrl] = useState<string | null>(null);
  const [cachedRotoRepaintBaseFrame, setCachedRotoRepaintBaseFrame] = useState<Frame | null>(null);
  const inputRef = useRef(input);
  const explicitRestorationRef = useRef<{ appFrame: number; frame: Frame | null } | null>(null);
  inputRef.current = input;
  const getLookup = () => ({
    getPhysicalRenderSource: inputRef.current.getPhysicalRenderSource,
    previewFrames: inputRef.current.getPreviewFrames(),
    dirtyFrames: inputRef.current.getDirtyFrames(),
  });
  const findDisplayFrame = useCallback((appFrame: number) => findCachedRotoDisplayFrame(appFrame, getLookup()), []);
  const findReferenceFrame = useCallback((appFrame: number) => findCachedRotoReferenceFrame(appFrame, getLookup()), []);
  const findAcceptedReferenceFrame = useCallback((appFrame: number) => findAcceptedRotoReferenceFrame(appFrame, getLookup()), []);
  const loadCachedRotoReferenceFrame = useCallback((appFrame: number, engine: RotoReferenceEngine | null, refreshedFrame?: Frame | null, replaceDirtyFrame = false, generation?: number, explicitDataUrl?: string | null) => {
    const currentInput = inputRef.current;
    if (refreshedFrame !== undefined) explicitRestorationRef.current = { appFrame, frame: refreshedFrame };
    else if (explicitRestorationRef.current?.appFrame !== appFrame) explicitRestorationRef.current = null;
    const explicitRestoration = explicitRestorationRef.current?.appFrame === appFrame ? explicitRestorationRef.current.frame : undefined;
    return createRotoReferenceLoader({
      getWorkflowMode: () => currentInput.workflowMode,
      getSettingsBackground: () => currentInput.settingsBackground,
      dirtyFrames: currentInput.getDirtyFrames(),
      liveOverlayActionCounts: currentInput.getLiveOverlayActionCounts(),
      getReferenceFrame: (frame) => frame === appFrame && explicitRestoration !== undefined
        ? explicitRestoration
        : replaceDirtyFrame
          ? findAcceptedReferenceFrame(frame)
          : findReferenceFrame(frame),
      setReferenceUrl: setCachedRotoReferenceUrl,
      setRepaintBaseFrame: setCachedRotoRepaintBaseFrame,
      syncPending: currentInput.syncPending,
      setApplyMessage: currentInput.setApplyMessage,
      replaceDirtyFrame,
      generation,
      explicitDataUrl,
    }).load(appFrame, engine);
  }, [findAcceptedReferenceFrame, findReferenceFrame]);
  const clearCachedRotoReferenceUrl = useCallback(() => setCachedRotoReferenceUrl(null), []);
  const resetCachedRotoReference = useCallback(() => {
    setCachedRotoReferenceUrl(null);
    setCachedRotoRepaintBaseFrame(null);
  }, []);

  return {
    cachedRotoReferenceUrl,
    cachedRotoRepaintBaseFrame,
    setCachedRotoReferenceUrl,
    setCachedRotoRepaintBaseFrame,
    clearCachedRotoReferenceUrl,
    resetCachedRotoReference,
    findCachedRotoDisplayFrame: findDisplayFrame,
    findCachedRotoReferenceFrame: findReferenceFrame,
    findAcceptedRotoReferenceFrame: findAcceptedReferenceFrame,
    loadCachedRotoReferenceFrame,
  };
}
