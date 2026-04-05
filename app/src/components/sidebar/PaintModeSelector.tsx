import {useState} from 'preact/hooks';
import {paintStore} from '../../stores/paintStore';
import type {PaintMode, BrushStyle, PaintStroke} from '../../types/paint';

interface PaintModeSelectorProps {
  layerId: string;
  frame: number;
}

const MODE_LABELS: Record<PaintMode, string> = {
  'flat': 'Paint',
  'fx-paint': 'FX Paint',
  'physic-paint': 'Physical',
};

const FX_STYLES: BrushStyle[] = ['watercolor', 'ink', 'charcoal', 'pencil', 'marker'];

export function PaintModeSelector({layerId, frame}: PaintModeSelectorProps) {
  const activeMode = paintStore.activePaintMode.value;
  const [showConvertDialog, setShowConvertDialog] = useState<{
    from: PaintMode;
    to: PaintMode;
  } | null>(null);
  const [selectedFxStyle, setSelectedFxStyle] = useState<BrushStyle>('watercolor');

  function handleModeSwitch(newMode: PaintMode) {
    if (newMode === activeMode) return;
    if (newMode === 'physic-paint') return; // grayed out placeholder

    const frameMode = paintStore.getFrameMode(layerId, frame);

    // D-28: Empty frame -- switch immediately
    if (frameMode === null) {
      paintStore.setActivePaintMode(newMode);
      return;
    }

    // D-26/D-27: Frame has strokes -- show conversion dialog
    if (frameMode !== newMode) {
      setShowConvertDialog({from: frameMode, to: newMode});
    } else {
      // Frame already in target mode, just switch
      paintStore.setActivePaintMode(newMode);
    }
  }

  function convertFrame(targetFrame: number, from: PaintMode, to: PaintMode) {
    const pf = paintStore.getFrame(layerId, targetFrame);
    if (!pf) return;

    for (const el of pf.elements) {
      if ('tool' in el && (el.tool === 'brush' || el.tool === 'eraser')) {
        const stroke = el as PaintStroke;
        if (to === 'fx-paint') {
          // Flat to FX
          stroke.brushStyle = selectedFxStyle;
          stroke.mode = 'fx-paint';
          stroke.fxState = 'flat';
        } else if (to === 'flat') {
          // FX to flat
          stroke.brushStyle = 'flat';
          stroke.mode = 'flat';
          stroke.fxState = undefined;
          stroke.brushParams = undefined;
        }
      }
    }

    paintStore._notifyVisualChange(layerId, targetFrame);
    paintStore.invalidateFrameFxCache(layerId, targetFrame);
    paintStore.refreshFrameFx(layerId, targetFrame);
  }

  function handleConvert(allFrames: boolean) {
    if (!showConvertDialog) return;
    const {from, to} = showConvertDialog;

    if (allFrames) {
      const frameNumbers = paintStore.getLayerFrameNumbers(layerId);
      for (const fn of frameNumbers) {
        convertFrame(fn, from, to);
      }
    } else {
      convertFrame(frame, from, to);
    }

    paintStore.setActivePaintMode(to);
    setShowConvertDialog(null);
  }

  const modes: PaintMode[] = ['flat', 'fx-paint', 'physic-paint'];

  return (
    <div class="flex flex-col gap-2">
      {/* Mode toggle buttons */}
      <div class="flex gap-1">
        {modes.map((mode) => {
          const isActive = mode === activeMode;
          const isDisabled = mode === 'physic-paint';
          return (
            <button
              key={mode}
              class={`flex-1 text-[10px] py-1.5 px-1 rounded cursor-pointer transition-colors ${
                isActive ? 'paint-style-btn-active' : 'paint-action-btn'
              }`}
              style={isDisabled ? {
                opacity: 0.4,
                cursor: 'not-allowed',
                pointerEvents: 'auto',
              } : undefined}
              onClick={() => handleModeSwitch(mode)}
              title={isDisabled ? 'Physical paint (coming soon)' : `Switch to ${MODE_LABELS[mode]} mode`}
            >
              {MODE_LABELS[mode]}
            </button>
          );
        })}
      </div>

      {/* Conversion dialog */}
      {showConvertDialog && (
        <div
          class="rounded p-3 text-[11px] space-y-2"
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            border: '1px solid var(--color-accent)',
          }}
        >
          {showConvertDialog.to === 'fx-paint' ? (
            <>
              <div style={{color: 'var(--sidebar-text-primary)'}}>
                Choose FX style to convert strokes:
              </div>
              <div class="flex flex-wrap gap-1">
                {FX_STYLES.map((style) => (
                  <button
                    key={style}
                    class={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      selectedFxStyle === style ? 'paint-style-btn-active' : 'paint-action-btn'
                    }`}
                    onClick={() => setSelectedFxStyle(style)}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{color: 'var(--sidebar-text-primary)'}}>
              Convert all strokes to flat?
            </div>
          )}

          <div class="flex gap-2">
            <button
              class="paint-action-btn flex-1 text-[10px] py-1 rounded cursor-pointer transition-colors"
              onClick={() => handleConvert(false)}
            >
              Current Frame
            </button>
            <button
              class="paint-action-btn flex-1 text-[10px] py-1 rounded cursor-pointer transition-colors"
              onClick={() => handleConvert(true)}
            >
              All Frames
            </button>
            <button
              class="paint-action-btn text-[10px] py-1 px-2 rounded cursor-pointer transition-colors"
              onClick={() => setShowConvertDialog(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
