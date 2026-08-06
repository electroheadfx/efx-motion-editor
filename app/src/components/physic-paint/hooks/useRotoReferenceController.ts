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
  setPreviewBaseImageUrl: (dataUrl: string) => void;
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
  return source.renderedFrame.appFrame === source.appFrame
    && source.cacheRevision === `${source.contentRevision}:generated:${source.interpolationMode}:${source.leftKeyId}:${source.rightKeyId}:${source.appFrame}`
    && isRotoPngDataUrl(source.renderedFrame.dataUrl);
}

/** Exact physical-cell lookup. No generic frame or neighboring-key fallback. */
export function findCachedRotoDisplayFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoPhysicalLookupInput<Frame>): Frame | null {
  const source = input.getPhysicalRenderSource?.(appFrame) ?? null;
  if (!source) return null;
  // Phase 43 (D-28, audit finding 6): the loop placeholder is never reference
  // or display content — excluded explicitly, and a future render-source
  // variant is a compile-time error at this consumer (Pitfall 7 convention).
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
  if (!isCurrentGeneratedPngSource(source)) return null;
  if (source.kind === 'real' && input.dirtyFrames?.has(appFrame)) {
    const preview = input.previewFrames?.get(appFrame);
    if (preview?.appFrame === appFrame
      && preview.keyId === source.keyId
      && preview.contentRevision === source.contentRevision) return preview;
  }
  return projectPhysicalSource<Frame>(source);
}

export function findCachedRotoReferenceFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoPhysicalLookupInput<Frame>): Frame | null {
  return findCachedRotoDisplayFrame(appFrame, input);
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
}

export function createRotoReferenceLoader<Frame extends RotoReferenceFrame>(input: RotoReferenceLoaderInput<Frame>) {
  const load = (appFrame: number, engine: RotoReferenceEngine | null): boolean => {
    if (!engine || input.getWorkflowMode() !== 'roto') {
      input.setReferenceUrl(null);
      input.setRepaintBaseFrame(null);
      return false;
    }
    if (input.dirtyFrames.has(appFrame)) {
      input.setReferenceUrl(null);
      input.setRepaintBaseFrame((current) => current?.appFrame === appFrame ? current : null);
      return false;
    }
    const cachedFrame = input.getReferenceFrame(appFrame);
    input.setReferenceUrl(null);
    input.setRepaintBaseFrame(cachedFrame);
    engine.setBgMode(input.getSettingsBackground());
    engine.clear();
    if (cachedFrame?.dataUrl) {
      engine.setPreviewBaseImageUrl(cachedFrame.dataUrl);
      const wasDirty = input.dirtyFrames.delete(appFrame);
      const hadLiveOverlay = input.liveOverlayActionCounts.delete(appFrame);
      if (wasDirty || hadLiveOverlay) input.syncPending();
      input.setApplyMessage(`Cached physical base loaded for frame ${appFrame}. Add paint to update this key.`);
    } else {
      engine.clearPreviewBaseImage();
      engine.resetBackground();
    }
    return Boolean(cachedFrame);
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
  const loadCachedRotoReferenceFrame = useCallback((appFrame: number, engine: RotoReferenceEngine | null, refreshedFrame?: Frame | null) => {
    const currentInput = inputRef.current;
    if (refreshedFrame !== undefined) explicitRestorationRef.current = { appFrame, frame: refreshedFrame };
    else if (explicitRestorationRef.current?.appFrame !== appFrame) explicitRestorationRef.current = null;
    const explicitRestoration = explicitRestorationRef.current?.appFrame === appFrame ? explicitRestorationRef.current.frame : undefined;
    return createRotoReferenceLoader({
      getWorkflowMode: () => currentInput.workflowMode,
      getSettingsBackground: () => currentInput.settingsBackground,
      dirtyFrames: currentInput.getDirtyFrames(),
      liveOverlayActionCounts: currentInput.getLiveOverlayActionCounts(),
      getReferenceFrame: (frame) => frame === appFrame && explicitRestoration !== undefined ? explicitRestoration : findReferenceFrame(frame),
      setReferenceUrl: setCachedRotoReferenceUrl,
      setRepaintBaseFrame: setCachedRotoRepaintBaseFrame,
      syncPending: currentInput.syncPending,
      setApplyMessage: currentInput.setApplyMessage,
    }).load(appFrame, engine);
  }, [findReferenceFrame]);
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
    loadCachedRotoReferenceFrame,
  };
}
