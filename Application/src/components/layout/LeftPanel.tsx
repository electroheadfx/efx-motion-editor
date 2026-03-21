import { useRef, useEffect } from 'preact/hooks';
import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { uiStore } from '../../stores/uiStore';
import { CollapsibleSection } from '../sidebar/CollapsibleSection';
import { SidebarProperties } from '../sidebar/SidebarProperties';
import { SidebarFxProperties } from '../sidebar/SidebarFxProperties';
import { TransitionProperties } from '../sidebar/TransitionProperties';
import { AudioProperties } from '../sidebar/AudioProperties';
import { audioStore } from '../../stores/audioStore';
import { SequenceList } from '../sequence/SequenceList';
import { LayerList } from '../layer/LayerList';
import { AddLayerMenu } from '../layer/AddLayerMenu';
import { PanelResizer } from '../sidebar/PanelResizer';
import { SidebarScrollArea } from '../sidebar/SidebarScrollArea';
import { calcFlexResize } from '../../lib/panelResize';
import { setPanelFlex } from '../../lib/appConfig';
import { isFxLayer } from '../../types/layer';

/** Height of each PanelResizer (h-4 = 16px) */
const RESIZER_HEIGHT = 16;
/** Header height for CollapsibleSection (h-9 = 36px) */
const HEADER_HEIGHT = 36;
/** Minimum height for a panel = header only */
const MIN_PANEL_HEIGHT = `${HEADER_HEIGHT}px`;

export function LeftPanel() {
  const sequences = sequenceStore.sequences.value;

  // Find selected layer across all sequences (FX layers live in FX sequences, content-overlay in their own)
  const selectedId = layerStore.selectedLayerId.value;
  let selectedLayer = null;
  let fxSequenceId: string | null = null;
  let isContentOverlay = false;
  if (selectedId) {
    for (const seq of sequenceStore.sequences.value) {
      const found = seq.layers.find((l) => l.id === selectedId);
      if (found) {
        selectedLayer = found;
        if (seq.kind === 'fx') fxSequenceId = seq.id;
        if (seq.kind === 'content-overlay') isContentOverlay = true;
        break;
      }
    }
  }

  const isFx = selectedLayer && isFxLayer(selectedLayer);

  // Audio track selection state
  const selectedAudioTrackId = audioStore.selectedTrackId.value;
  const selectedAudioTrack = selectedAudioTrackId
    ? audioStore.tracks.value.find(t => t.id === selectedAudioTrackId) ?? null
    : null;

  // Transition selection state
  const transitionSel = uiStore.selectedTransition.value;

  // Fallback: when no layer selected, show active content sequence's base layer
  const activeSeqId = sequenceStore.activeSequenceId.value;
  const activeSeq = activeSeqId ? sequences.find(s => s.id === activeSeqId) : null;
  const fallbackLayer = (!selectedLayer && !transitionSel && activeSeq?.kind === 'content')
    ? activeSeq.layers.find(l => l.isBase) ?? null
    : null;

  // Track container height for px-to-flex conversion
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
    const result = calcFlexResize(
      {
        seqFlex: uiStore.seqPanelFlex.peek(),
        layFlex: uiStore.layPanelFlex.peek(),
        propFlex: uiStore.propPanelFlex.peek(),
        totalPixelHeight: containerHeight.current,
      },
      deltaY,
      'seq-lay',
    );
    uiStore.setSeqPanelFlex(result.seqFlex);
    uiStore.setLayPanelFlex(result.layFlex);
    uiStore.setPropPanelFlex(result.propFlex);
    // Sync collapsed state from flex values
    uiStore.sequencesSectionCollapsed.value = result.seqFlex === 0;
    uiStore.layersSectionCollapsed.value = result.layFlex === 0;
  };

  const handleLayPropResize = (deltaY: number) => {
    const result = calcFlexResize(
      {
        seqFlex: uiStore.seqPanelFlex.peek(),
        layFlex: uiStore.layPanelFlex.peek(),
        propFlex: uiStore.propPanelFlex.peek(),
        totalPixelHeight: containerHeight.current,
      },
      deltaY,
      'lay-prop',
    );
    uiStore.setSeqPanelFlex(result.seqFlex);
    uiStore.setLayPanelFlex(result.layFlex);
    uiStore.setPropPanelFlex(result.propFlex);
    // Sync collapsed state from flex values
    uiStore.layersSectionCollapsed.value = result.layFlex === 0;
    uiStore.propertiesSectionCollapsed.value = result.propFlex === 0;
  };

  const persistFlex = () => {
    setPanelFlex(
      uiStore.seqPanelFlex.peek(),
      uiStore.layPanelFlex.peek(),
      uiStore.propPanelFlex.peek(),
    );
  };

  const seqFlex = uiStore.seqPanelFlex.value;
  const layFlex = uiStore.layPanelFlex.value;
  const propFlex = uiStore.propPanelFlex.value;

  const handleSeqCollapse = (collapsed: boolean) => {
    if (collapsed) {
      uiStore.collapsePanel('seq');
    } else {
      uiStore.expandPanel('seq');
    }
    persistFlex();
  };

  const handleLayCollapse = (collapsed: boolean) => {
    if (collapsed) {
      uiStore.collapsePanel('lay');
    } else {
      uiStore.expandPanel('lay');
    }
    persistFlex();
  };

  const handlePropCollapse = (collapsed: boolean) => {
    if (collapsed) {
      uiStore.collapsePanel('prop');
    } else {
      uiStore.expandPanel('prop');
    }
    persistFlex();
  };

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
        class="flex flex-col overflow-hidden"
        style={{
          flex: `${seqFlex} 0 0px`,
          minHeight: MIN_PANEL_HEIGHT,
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        <CollapsibleSection
          title="SEQUENCES"
          collapsed={uiStore.sequencesSectionCollapsed}
          onCollapse={handleSeqCollapse}
          headerActions={
            <button
              class="flex items-center rounded transition-colors hover:brightness-110"
              style={{ gap: '4px', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--sidebar-input-bg)' }}
              onClick={() => {
                const seq = sequenceStore.createSequence(`Sequence ${sequences.length + 1}`);
                uiStore.selectSequence(seq.id);
                sequenceStore.setActive(seq.id);
                uiStore.setPendingNewSequenceId(seq.id);
                uiStore.setEditorMode('imported');
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sidebar-text-button)' }}>+</span>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--sidebar-text-button)' }}>Add</span>
            </button>
          }
        >
          <SidebarScrollArea>
            <SequenceList />
          </SidebarScrollArea>
        </CollapsibleSection>
      </div>

      <PanelResizer onResize={handleSeqLayResize} onResizeEnd={persistFlex} />

      {/* LAYERS panel */}
      <div
        class="flex flex-col overflow-hidden"
        style={{
          flex: `${layFlex} 0 0px`,
          minHeight: MIN_PANEL_HEIGHT,
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        <CollapsibleSection
          title="LAYERS"
          collapsed={uiStore.layersSectionCollapsed}
          onCollapse={handleLayCollapse}
          headerActions={<AddLayerMenu />}
        >
          <SidebarScrollArea>
            <LayerList />
          </SidebarScrollArea>
        </CollapsibleSection>
      </div>

      <PanelResizer onResize={handleLayPropResize} onResizeEnd={persistFlex} />

      {/* PROPERTIES panel */}
      <div
        class="flex flex-col overflow-hidden"
        style={{
          flex: `${propFlex} 0 0px`,
          minHeight: MIN_PANEL_HEIGHT,
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        <CollapsibleSection
          title="PROPERTIES"
          collapsed={uiStore.propertiesSectionCollapsed}
          onCollapse={handlePropCollapse}
        >
          {transitionSel && (
            <SidebarScrollArea>
              <TransitionProperties selection={transitionSel} />
            </SidebarScrollArea>
          )}
          {!transitionSel && selectedAudioTrack && (
            <SidebarScrollArea>
              <AudioProperties track={selectedAudioTrack} />
            </SidebarScrollArea>
          )}
          {!transitionSel && !selectedAudioTrack && selectedLayer && isFx && (
            <SidebarScrollArea>
              <SidebarFxProperties layer={selectedLayer} fxSequenceId={fxSequenceId} />
            </SidebarScrollArea>
          )}
          {!transitionSel && !selectedAudioTrack && selectedLayer && !isFx && (
            <SidebarScrollArea>
              <SidebarProperties layer={selectedLayer} isContentOverlay={isContentOverlay} />
            </SidebarScrollArea>
          )}
          {!transitionSel && !selectedAudioTrack && !selectedLayer && fallbackLayer && (
            <SidebarScrollArea>
              <SidebarProperties layer={fallbackLayer} isContentOverlay={false} />
            </SidebarScrollArea>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
