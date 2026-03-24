import { useRef, useEffect } from 'preact/hooks';
import { ArrowLeft } from 'lucide-preact';
import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { uiStore } from '../../stores/uiStore';
import { imageStore } from '../../stores/imageStore';
import { CollapsibleSection } from '../sidebar/CollapsibleSection';
import { SidebarProperties } from '../sidebar/SidebarProperties';
import { SidebarFxProperties } from '../sidebar/SidebarFxProperties';
import { TransitionProperties } from '../sidebar/TransitionProperties';
import { AudioProperties } from '../sidebar/AudioProperties';
import { PaintProperties } from '../sidebar/PaintProperties';
import { audioStore } from '../../stores/audioStore';
import { SequenceList } from '../sequence/SequenceList';
import { LayerList } from '../layer/LayerList';
import { AddLayerMenu } from '../layer/AddLayerMenu';
import { PanelResizer } from '../sidebar/PanelResizer';
import { SidebarScrollArea } from '../sidebar/SidebarScrollArea';
import { calcFlexResize2 } from '../../lib/panelResize';
import { setPanelFlex } from '../../lib/appConfig';
import { assetUrl } from '../../lib/ipc';
import { isFxLayer } from '../../types/layer';
import { isKeySolid, isKeyTransparent } from '../../types/sequence';

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

  // Adaptive layer view state
  const layerViewSeqId = uiStore.layerViewSequenceId.value;
  const layerViewSeq = layerViewSeqId
    ? sequenceStore.sequences.value.find(s => s.id === layerViewSeqId) ?? null
    : null;

  // Track container height for px-to-flex conversion
  const containerRef = useRef<HTMLDivElement>(null);
  const containerHeight = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Available height = container height minus one resizer
        containerHeight.current = entry.contentRect.height - RESIZER_HEIGHT;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSeqPropResize = (deltaY: number) => {
    const result = calcFlexResize2({
      seqFlex: uiStore.seqPanelFlex.peek(),
      propFlex: uiStore.propPanelFlex.peek(),
      totalPixelHeight: containerHeight.current,
    }, deltaY);
    uiStore.setSeqPanelFlex(result.seqFlex);
    uiStore.setPropPanelFlex(result.propFlex);
    uiStore.sequencesSectionCollapsed.value = result.seqFlex === 0;
    uiStore.propertiesSectionCollapsed.value = result.propFlex === 0;
  };

  const persistFlex = () => {
    setPanelFlex(
      uiStore.seqPanelFlex.peek(),
      uiStore.propPanelFlex.peek(),
    );
  };

  const seqFlex = uiStore.seqPanelFlex.value;
  const propFlex = uiStore.propPanelFlex.value;

  const handleSeqCollapse = (collapsed: boolean) => {
    if (collapsed) {
      uiStore.collapsePanel('seq');
    } else {
      uiStore.expandPanel('seq');
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

  // Compute thumbnail for compact sequence info row in layer view
  let layerViewThumbStyle: Record<string, string> = {};
  if (layerViewSeq) {
    const firstKp = layerViewSeq.keyPhotos[0];
    if (firstKp && isKeySolid(firstKp)) {
      layerViewThumbStyle = { backgroundColor: firstKp.solidColor! };
    } else if (firstKp && isKeyTransparent(firstKp)) {
      layerViewThumbStyle = {
        backgroundColor: '#B0B0B0',
        backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
      };
    } else if (firstKp && firstKp.imageId) {
      const img = imageStore.getById(firstKp.imageId);
      if (img) {
        layerViewThumbStyle = {
          backgroundColor: 'var(--sidebar-input-bg)',
          backgroundImage: `url(${assetUrl(img.thumbnail_path)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      } else {
        layerViewThumbStyle = { backgroundColor: 'var(--sidebar-input-bg)' };
      }
    } else {
      layerViewThumbStyle = { backgroundColor: 'var(--sidebar-input-bg)' };
    }
  }

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
      {/* SEQUENCES/LAYERS adaptive panel */}
      <div
        class="flex flex-col overflow-hidden"
        style={{
          flex: `${seqFlex} 0 0px`,
          minHeight: MIN_PANEL_HEIGHT,
          backgroundColor: 'var(--sidebar-panel-bg)',
          borderRadius: 8,
        }}
      >
        {layerViewSeq ? (
          <>
            {/* Layer view header */}
            <div class="flex items-center justify-between h-9 px-3 shrink-0">
              <div
                class="flex items-center gap-1.5 cursor-pointer"
                onClick={() => uiStore.closeLayerView()}
              >
                <ArrowLeft size={14} style={{ color: 'var(--sidebar-text-secondary)' }} />
                <span style="font-size: 11px; font-weight: 600; letter-spacing: 2px; color: var(--sidebar-text-secondary)">
                  {layerViewSeq.name.toUpperCase()}
                </span>
              </div>
              <div onClick={(e: MouseEvent) => e.stopPropagation()}>
                <AddLayerMenu />
              </div>
            </div>

            {/* Compact sequence info row */}
            <div
              class="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ borderBottom: '1px solid var(--sidebar-border-unselected)' }}
            >
              <div
                class="shrink-0 rounded overflow-hidden"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  ...layerViewThumbStyle,
                }}
              />
              <div class="flex flex-col gap-0 flex-1 min-w-0">
                <span
                  class="truncate"
                  style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sidebar-text-primary)' }}
                >
                  {layerViewSeq.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--sidebar-text-secondary)' }}>
                  {layerViewSeq.keyPhotos.length} keys
                </span>
              </div>
            </div>

            {/* Layer list */}
            <SidebarScrollArea>
              <LayerList />
            </SidebarScrollArea>
          </>
        ) : (
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
        )}
      </div>

      <PanelResizer onResize={handleSeqPropResize} onResizeEnd={persistFlex} />

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
          {!transitionSel && !selectedAudioTrack && selectedLayer && !isFx && selectedLayer.type === 'paint' && (
            <SidebarScrollArea>
              <PaintProperties layer={selectedLayer} />
            </SidebarScrollArea>
          )}
          {!transitionSel && !selectedAudioTrack && selectedLayer && !isFx && selectedLayer.type !== 'paint' && (
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
