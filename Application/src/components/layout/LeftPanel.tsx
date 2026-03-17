import { useRef, useEffect } from 'preact/hooks';
import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { uiStore } from '../../stores/uiStore';
import { CollapsibleSection } from '../sidebar/CollapsibleSection';
import { SidebarProperties } from '../sidebar/SidebarProperties';
import { SidebarFxProperties } from '../sidebar/SidebarFxProperties';
import { SequenceList } from '../sequence/SequenceList';
import { LayerList } from '../layer/LayerList';
import { AddLayerMenu } from '../layer/AddLayerMenu';
import { PanelResizer } from '../sidebar/PanelResizer';
import { calcResize } from '../../lib/panelResize';
import { setPanelHeights } from '../../lib/appConfig';
import { isFxLayer } from '../../types/layer';

/** Height of each PanelResizer (h-4 = 16px) */
const RESIZER_HEIGHT = 16;

export function LeftPanel() {
  const sequences = sequenceStore.sequences.value;

  // Find selected layer across all sequences (FX layers live in FX sequences)
  const selectedId = layerStore.selectedLayerId.value;
  let selectedLayer = null;
  let fxSequenceId: string | null = null;
  if (selectedId) {
    for (const seq of sequenceStore.sequences.value) {
      const found = seq.layers.find((l) => l.id === selectedId);
      if (found) {
        selectedLayer = found;
        if (seq.kind === 'fx') fxSequenceId = seq.id;
        break;
      }
    }
  }

  const isFx = selectedLayer && isFxLayer(selectedLayer);

  // Track container height for resize calculations
  const containerRef = useRef<HTMLDivElement>(null);
  const containerHeight = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Available height = container height minus two resizers
        containerHeight.current = entry.contentRect.height - RESIZER_HEIGHT * 2;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSeqLayResize = (deltaY: number) => {
    const result = calcResize(
      {
        seqHeight: uiStore.sequencesPanelHeight.peek(),
        layHeight: uiStore.layersPanelHeight.peek(),
        totalAvailable: containerHeight.current,
      },
      deltaY,
      'seq-lay',
    );
    uiStore.setSequencesPanelHeight(result.seqHeight);
    uiStore.setLayersPanelHeight(result.layHeight);
  };

  const handleLayPropResize = (deltaY: number) => {
    const result = calcResize(
      {
        seqHeight: uiStore.sequencesPanelHeight.peek(),
        layHeight: uiStore.layersPanelHeight.peek(),
        totalAvailable: containerHeight.current,
      },
      deltaY,
      'lay-prop',
    );
    uiStore.setLayersPanelHeight(result.layHeight);
  };

  const persistHeights = () => {
    setPanelHeights(uiStore.sequencesPanelHeight.peek(), uiStore.layersPanelHeight.peek());
  };

  const seqH = uiStore.sequencesPanelHeight.value;
  const layH = uiStore.layersPanelHeight.value;

  return (
    <div
      ref={containerRef}
      class="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: '100%',
        backgroundColor: 'var(--sidebar-bg)',
        padding: '8px 16px 8px 12px',
      }}
    >
      {/* SEQUENCES panel */}
      <div
        class="shrink-0 overflow-hidden"
        style={{
          height: seqH > 0 ? `${seqH}px` : '0px',
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        {seqH > 0 && (
          <>
            <CollapsibleSection
              title="SEQUENCES"
              collapsed={uiStore.sequencesSectionCollapsed}
              headerActions={
                <button
                  class="rounded px-2 py-1 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] transition-colors"
                  onClick={() => sequenceStore.createSequence(`Sequence ${sequences.length + 1}`)}
                >
                  <span class="text-[10px] text-[var(--color-text-secondary)]">+ Add</span>
                </button>
              }
            >
              <div class="sidebar-scroll overflow-y-auto" style={{ maxHeight: `${seqH - 36}px` }}>
                <SequenceList />
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>

      <PanelResizer onResize={handleSeqLayResize} onResizeEnd={persistHeights} />

      {/* LAYERS panel */}
      <div
        class="shrink-0 overflow-hidden"
        style={{
          height: layH > 0 ? `${layH}px` : '0px',
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        {layH > 0 && (
          <>
            {isFx ? (
              <>
                <div
                  class="flex items-center h-9 px-3"
                  style={{ color: 'var(--sidebar-text-secondary)' }}
                >
                  <span style="font-size: 11px; font-weight: 600; letter-spacing: 2px">
                    FX: {selectedLayer!.name}
                  </span>
                </div>
                <div class="sidebar-scroll overflow-y-auto" style={{ maxHeight: `${layH - 36}px` }}>
                  <SidebarFxProperties layer={selectedLayer!} fxSequenceId={fxSequenceId} />
                </div>
              </>
            ) : (
              <CollapsibleSection
                title="LAYERS"
                collapsed={uiStore.layersSectionCollapsed}
                headerActions={<AddLayerMenu />}
              >
                <div class="sidebar-scroll overflow-y-auto" style={{ maxHeight: `${layH - 36}px` }}>
                  <LayerList />
                </div>
              </CollapsibleSection>
            )}
          </>
        )}
      </div>

      <PanelResizer onResize={handleLayPropResize} onResizeEnd={persistHeights} />

      {/* PROPERTIES panel (flex-1, takes remaining space) */}
      <div
        class="flex-1 min-h-0 overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        {selectedLayer && !isFx && (
          <>
            <div
              class="flex items-center h-9 px-3 shrink-0"
              style={{ color: 'var(--sidebar-text-secondary)' }}
            >
              <span style="font-size: 11px; font-weight: 600; letter-spacing: 2px">PROPERTIES</span>
            </div>
            <div class="sidebar-scroll overflow-y-auto flex-1 min-h-0">
              <SidebarProperties layer={selectedLayer} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
