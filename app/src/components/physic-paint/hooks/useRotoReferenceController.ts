import { useCallback, useRef, useState } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';

export type RotoReferenceFrame = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'source' | 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;

export interface RotoReferenceEngine {
  setBgMode: (mode: BgMode) => void;
  clear: () => void;
  setPreviewBaseImageUrl: (dataUrl: string) => void;
  clearPreviewBaseImage: () => void;
  resetBackground: () => void;
}

interface RotoDisplayLookupInput<Frame extends RotoReferenceFrame> {
  cachedRotoFrames?: readonly Frame[];
  previewFrames: ReadonlyMap<number, Frame>;
  confirmedFrames: ReadonlyMap<number, Frame>;
  getRotoFrame: (appFrame: number) => Frame | null;
}

interface RotoReferenceLookupInput<Frame extends RotoReferenceFrame> extends RotoDisplayLookupInput<Frame> {
  getFrame: (appFrame: number) => Frame | null;
}

export function findCachedRotoDisplayFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoDisplayLookupInput<Frame>): Frame | null {
  const generatedFrame = input.cachedRotoFrames?.find((frame) => frame.appFrame === appFrame && frame.source === 'generated-interpolation');
  if (generatedFrame) return generatedFrame;
  const previewFrame = input.previewFrames.get(appFrame);
  if (previewFrame) return previewFrame;
  const launchOrStoreRealFrame = input.cachedRotoFrames?.find((frame) => frame.appFrame === appFrame && frame.source === 'real-key')
    ?? input.getRotoFrame(appFrame);
  if (launchOrStoreRealFrame) return launchOrStoreRealFrame;
  for (const confirmedFrame of input.confirmedFrames.values()) {
    if ((confirmedFrame.displayFrame ?? confirmedFrame.appFrame) === appFrame) return confirmedFrame;
  }
  return null;
}

export function findCachedRotoReferenceFrame<Frame extends RotoReferenceFrame>(appFrame: number, input: RotoReferenceLookupInput<Frame>): Frame | null {
  return findCachedRotoDisplayFrame(appFrame, input) ?? input.getFrame(appFrame);
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
      input.setApplyMessage(`Cached key base loaded — visible and non-editable. Add paint to update frame ${appFrame}.`);
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
  getCachedRotoFrames: () => readonly Frame[] | undefined;
  previewFrames: ReadonlyMap<number, Frame>;
  confirmedFrames: ReadonlyMap<number, Frame>;
  dirtyFrames: Set<number>;
  liveOverlayActionCounts: Map<number, number>;
  getRotoFrame: (appFrame: number) => Frame | null;
  getFrame: (appFrame: number) => Frame | null;
  syncPending: () => void;
  setApplyMessage: (message: string) => void;
}

export function useRotoReferenceController<Frame extends RotoReferenceFrame>(input: UseRotoReferenceControllerInput<Frame>) {
  const [cachedRotoReferenceUrl, setCachedRotoReferenceUrl] = useState<string | null>(null);
  const [cachedRotoRepaintBaseFrame, setCachedRotoRepaintBaseFrame] = useState<Frame | null>(null);
  const inputRef = useRef(input);
  const explicitRestorationRef = useRef<{ appFrame: number; frame: Frame | null } | null>(null);
  inputRef.current = input;
  const getDisplayLookup = () => ({
    ...inputRef.current,
    cachedRotoFrames: inputRef.current.getCachedRotoFrames(),
  });
  const findDisplayFrame = useCallback((appFrame: number) => findCachedRotoDisplayFrame(appFrame, getDisplayLookup()), []);
  const findReferenceFrame = useCallback((appFrame: number) => findCachedRotoReferenceFrame(appFrame, getDisplayLookup()), []);
  const loadCachedRotoReferenceFrame = useCallback((appFrame: number, engine: RotoReferenceEngine | null, refreshedFrame?: Frame | null) => {
    const currentInput = inputRef.current;
    if (refreshedFrame !== undefined) explicitRestorationRef.current = { appFrame, frame: refreshedFrame };
    else if (explicitRestorationRef.current?.appFrame !== appFrame) explicitRestorationRef.current = null;
    const explicitRestoration = explicitRestorationRef.current?.appFrame === appFrame ? explicitRestorationRef.current.frame : undefined;
    return createRotoReferenceLoader({
      getWorkflowMode: () => currentInput.workflowMode,
      getSettingsBackground: () => currentInput.settingsBackground,
      dirtyFrames: currentInput.dirtyFrames,
      liveOverlayActionCounts: currentInput.liveOverlayActionCounts,
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
