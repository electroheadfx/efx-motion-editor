import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { getContainedCanvasDisplaySize } from './physicsPaintCanvasSizing';

const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas';

export type NativePenInputHandler = (input: { pressure: number; tiltX?: number; tiltY?: number }) => void;

export function PhysicsPaintCanvasMount(props: { width: number; height: number; paperTextureScale: number; onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void; onNativePenInputReady: (handler: NativePenInputHandler) => void; getStrokeMetadata?: () => { playFrame?: number } | null | undefined }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const region = shell?.parentElement;
    const updateDisplaySize = () => {
      if (!region) return;
      const rect = region.getBoundingClientRect();
      setDisplaySize(getContainedCanvasDisplaySize(rect.width, rect.height, props.width, props.height));
    };
    updateDisplaySize();
    const resizeObserver = region ? new ResizeObserver(updateDisplaySize) : null;
    if (region) resizeObserver?.observe(region);
    const frame = window.requestAnimationFrame(() => {
      const mounted = Boolean(shellRef.current?.querySelector('canvas'));
      props.onCanvasMounted(mounted);
      if (!mounted) setMountError(CANVAS_MOUNT_ERROR);
      updateDisplaySize();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [props.height, props.width]);

  const shellStyle = {
    aspectRatio: `${props.width} / ${props.height}`,
    '--physics-paint-paper-texture-scale': props.paperTextureScale,
    ...(displaySize ? { width: `${displaySize.width}px`, height: `${displaySize.height}px` } : {}),
  } as JSX.CSSProperties;

  return (
    <div class="demo-canvas-shell" ref={shellRef} style={shellStyle}>
      <EfxPaintCanvas
        width={props.width}
        height={props.height}
        papers={[
          { name: 'canvas1', url: '/img/paper_1.jpg' },
          { name: 'canvas2', url: '/img/paper_2.jpg' },
          { name: 'canvas3', url: '/img/paper_3.jpg' },
        ]}
        defaultPaper="canvas1"
        paperTextureScale={props.paperTextureScale}
        class="paint-canvas"
        onNativePenInputReady={props.onNativePenInputReady}
        getStrokeMetadata={props.getStrokeMetadata}
        onEngineReady={(engine) => {
          engine.setTool('paint');
          setMountError(null);
          props.onCanvasMounted(true);
          props.onEngineReady(engine);
        }}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  );
}
