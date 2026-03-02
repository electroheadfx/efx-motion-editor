import {useEffect} from 'preact/hooks';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';

// Seed mock data for visual verification (removed in Phase 3 when real data flows)
function useSeedMockData() {
  useEffect(() => {
    if (sequenceStore.sequences.value.length === 0) {
      sequenceStore.add({
        id: 'seq-1',
        name: 'Sequence 01',
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: Array(8)
          .fill(null)
          .map((_, i) => ({id: `kp-${i}`, imagePath: '', holdFrames: 4})),
      });
      sequenceStore.add({
        id: 'seq-2',
        name: 'Sequence 02',
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: Array(5)
          .fill(null)
          .map((_, i) => ({id: `kp-2-${i}`, imagePath: '', holdFrames: 5})),
      });
      sequenceStore.add({
        id: 'seq-3',
        name: 'Sequence 03',
        fps: 24,
        width: 1920,
        height: 1080,
        keyPhotos: Array(12)
          .fill(null)
          .map((_, i) => ({id: `kp-3-${i}`, imagePath: '', holdFrames: 4})),
      });
      uiStore.selectSequence('seq-1');
    }
    if (layerStore.layers.value.length === 0) {
      layerStore.add({
        id: 'layer-fx1',
        name: 'Light Leaks',
        type: 'video',
        visible: true,
        opacity: 0.8,
        blendMode: 'screen',
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          cropTop: 0,
          cropRight: 0,
          cropBottom: 0,
          cropLeft: 0,
        },
      });
      layerStore.add({
        id: 'layer-fx2',
        name: 'Film Grain',
        type: 'video',
        visible: true,
        opacity: 1,
        blendMode: 'overlay',
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          cropTop: 0,
          cropRight: 0,
          cropBottom: 0,
          cropLeft: 0,
        },
      });
      layerStore.add({
        id: 'layer-base',
        name: 'Base Layer (Photos)',
        type: 'image-sequence',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          cropTop: 0,
          cropRight: 0,
          cropBottom: 0,
          cropLeft: 0,
        },
      });
    }
  }, []);
}

export function LeftPanel() {
  useSeedMockData();

  const sequences = sequenceStore.sequences.value;
  const activeId = uiStore.selectedSequenceId.value;
  const allLayers = layerStore.layers.value;

  return (
    <div class="flex flex-col w-[268px] h-full bg-[var(--color-bg-card-alt)] shrink-0">
      {/* Sequences Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[#111111]">
        <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
          SEQUENCES
        </span>
        <button class="rounded px-2 py-1 bg-[var(--color-bg-settings)]">
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            + Add
          </span>
        </button>
      </div>
      {/* Sequence List */}
      <div class="flex flex-col gap-px flex-1 min-h-0 overflow-y-auto">
        {sequences.map((seq) => {
          const isActive = seq.id === activeId;
          const keyCount = seq.keyPhotos.length;
          const duration = (
            (keyCount * (seq.keyPhotos[0]?.holdFrames ?? 4)) /
            seq.fps
          ).toFixed(1);
          return (
            <div
              key={seq.id}
              class={`flex items-center gap-2 h-10 w-full px-3 cursor-pointer ${isActive ? 'bg-[#2D5BE320]' : 'bg-transparent hover:bg-[#ffffff08]'}`}
              onClick={() => uiStore.selectSequence(seq.id)}
            >
              {isActive && (
                <div class="w-[3px] h-6 rounded-sm bg-[var(--color-accent)]" />
              )}
              <div
                class={`w-7 h-5 rounded-[3px] ${isActive ? 'bg-[#3D3D3D]' : 'bg-[#2A2A2A]'}`}
              />
              <div class="flex flex-col gap-0.5">
                <span
                  class={`text-xs ${isActive ? 'font-medium text-[#E0E0E0]' : 'text-[var(--color-text-secondary)]'}`}
                >
                  {seq.name}
                </span>
                <span
                  class={`text-[10px] ${isActive ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-dim)]'}`}
                >
                  {keyCount} keys &middot; {duration}s
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Panel Divider */}
      <div class="w-full h-px bg-[#2A2A2A]" />
      {/* Layers Header */}
      <div class="flex items-center justify-between h-9 px-3 bg-[#111111]">
        <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
          LAYERS
        </span>
        <button class="rounded px-2 py-1 bg-[var(--color-bg-settings)]">
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            + Add FX
          </span>
        </button>
      </div>
      {/* Layers List */}
      <div class="flex flex-col gap-0.5 p-2">
        {allLayers.map((layer) => {
          const isBase = layer.blendMode === 'normal';
          const thumbColor =
            layer.blendMode === 'screen'
              ? '#5B3A8F'
              : layer.blendMode === 'overlay'
                ? '#3A5F3A'
                : '#2E4A8F';
          return (
            <div
              key={layer.id}
              class={`flex items-center gap-2 rounded-md px-2.5 h-11 cursor-pointer ${isBase ? 'bg-[#1E1E1E]' : 'bg-[#252525]'}`}
              onClick={() => uiStore.selectLayer(layer.id)}
            >
              <div
                class="w-3.5 h-3.5 rounded-full shrink-0"
                style={{
                  backgroundColor: layer.visible ? '#555555' : '#333333',
                }}
              />
              <div
                class="w-8 h-6 rounded-[3px] shrink-0"
                style={{backgroundColor: thumbColor}}
              />
              <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                <span
                  class={`text-[11px] truncate ${isBase ? 'text-[#E0E0E0] font-medium' : 'text-[#AAAAAA]'}`}
                >
                  {layer.name}
                </span>
                <span class="text-[9px] text-[var(--color-text-dim)] truncate">
                  {layer.type === 'video'
                    ? 'FX Video'
                    : layer.type === 'image-sequence'
                      ? 'Keyframes'
                      : 'Static'}{' '}
                  &middot;{' '}
                  {layer.blendMode.charAt(0).toUpperCase() +
                    layer.blendMode.slice(1)}
                </span>
              </div>
              <div class="w-1.5 h-5 rounded-sm bg-[#333333] shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
