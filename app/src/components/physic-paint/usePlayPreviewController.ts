import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { AnimationPlayer, type AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { clampPhysicPaintFrameCount } from '../../types/physicPaint';

type PreviewEngine = EfxPaintEngine & { resetBackground: () => void };
type PlayState = ReturnType<EfxPaintEngine['save']>;

export function usePlayPreviewController<TFrame extends PhysicPaintRenderedFrame>(input: {
  engine: EfxPaintEngine | null;
  previewFps: number;
  wiggle: AnimationWiggleConfig;
  getCachedFrames: (frameCount: number) => TFrame[] | null;
  capturePendingFrameEdits: () => void;
  annotateState: (state: PlayState) => PlayState;
  setCachedPreviewUrl: (url: string | null) => void;
  setApplyMessage: (message: string | null) => void;
  stopRotoPlayback: () => void;
  setIsPlaying: (value: boolean) => void;
  setAnimFrame: (value: number) => void;
  setAnimTotal: (value: number) => void;
}) {
  const playerRef = useRef<AnimationPlayer | null>(null);
  const cachedTimerRef = useRef<number | null>(null);

  const clearCachedTimer = useCallback(() => {
    if (cachedTimerRef.current) window.clearInterval(cachedTimerRef.current);
    cachedTimerRef.current = null;
  }, []);

  const stopPlayOnly = useCallback(() => {
    clearCachedTimer();
    playerRef.current?.stop();
    input.setIsPlaying(false);
  }, [clearCachedTimer]);

  const stop = useCallback(() => {
    input.stopRotoPlayback();
    stopPlayOnly();
  }, [input.stopRotoPlayback, stopPlayOnly]);

  useEffect(() => {
    if (!input.engine) return;
    playerRef.current = new AnimationPlayer(input.engine);
    return () => {
      clearCachedTimer();
      playerRef.current?.stop();
      playerRef.current = null;
    };
  }, [clearCachedTimer, input.engine]);

  const preview = useCallback((frameCount: number) => {
    if (!playerRef.current || !input.engine) return;
    const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
    const cachedFrames = input.getCachedFrames(safeFrameCount);
    if (cachedFrames) {
      clearCachedTimer();
      let frameIndex = 0;
      input.setIsPlaying(true);
      input.setAnimTotal(safeFrameCount);
      input.setApplyMessage(`Previewing cached ${safeFrameCount} frames at ${input.previewFps} fps.`);
      const showNextCachedFrame = () => {
        const cachedFrame = cachedFrames[frameIndex];
        input.setAnimFrame(frameIndex);
        input.setCachedPreviewUrl(cachedFrame.dataUrl);
        frameIndex += 1;
        if (frameIndex >= cachedFrames.length) {
          clearCachedTimer();
          input.setIsPlaying(false);
        }
      };
      showNextCachedFrame();
      if (cachedFrames.length > 1) cachedTimerRef.current = window.setInterval(showNextCachedFrame, 1000 / input.previewFps);
      return;
    }

    clearCachedTimer();
    input.setIsPlaying(true);
    input.setAnimTotal(safeFrameCount);
    input.setAnimFrame(0);
    input.setApplyMessage(`Previewing ${safeFrameCount} frames at ${input.previewFps} fps.`);
    input.capturePendingFrameEdits();
    const previewState = input.annotateState(input.engine.save());
    (input.engine as PreviewEngine).resetBackground();
    input.engine.load(previewState);
    playerRef.current.play({
      frameCount: safeFrameCount,
      fps: input.previewFps,
      wiggle: input.wiggle,
      onFrame: (frameIndex) => input.setAnimFrame(frameIndex),
      onComplete: () => input.setIsPlaying(false),
    });
  }, [clearCachedTimer, input]);

  const renderFrames = useCallback((options: {
    frameCount: number;
    startFrame: number;
  }): Promise<TFrame[]> => {
    const player = playerRef.current;
    if (!player) return Promise.reject(new Error('Animation player is not ready'));
    input.setIsPlaying(true);
    input.setAnimTotal(options.frameCount);
    input.setAnimFrame(0);
    return new Promise<TFrame[]>((resolve, reject) => {
      const captured: TFrame[] = [];
      const timeout = window.setTimeout(() => reject(new Error('Timed out while generating physics paint frames')), Math.max(15000, options.frameCount * 1000));
      player.play({
        frameCount: options.frameCount,
        fps: input.previewFps,
        wiggle: input.wiggle,
        onFrame: (frameIndex: number, canvas: HTMLCanvasElement) => {
          input.setAnimFrame(frameIndex);
          captured.push({
            frameIndex,
            appFrame: options.startFrame + frameIndex,
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          } as TFrame);
        },
        onComplete: () => {
          window.clearTimeout(timeout);
          input.setIsPlaying(false);
          resolve(captured);
        },
      });
    });
  }, [input.previewFps, input.wiggle]);

  return { preview, stop, stopPlayOnly, renderFrames };
}
