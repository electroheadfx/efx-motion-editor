import {signal} from '@preact/signals';
import type {PanelId} from '../types/ui';

export type EditorMode = 'editor' | 'imported' | 'settings' | 'export' | 'shader-browser';

export type AddLayerIntent =
  | null
  | {
      type: 'static-image' | 'image-sequence' | 'video' | 'audio';
      target?: 'content-overlay' | 'audio-track';
      changeSourceFor?: { layerId: string; sequenceId: string };
      targetSequenceId?: string;  // When set, create new sequence aligned with isolated sequence
      isolatedInFrame?: number;   // Start frame of isolated sequence (from trackLayouts)
      isolatedOutFrame?: number;  // End frame of isolated sequence (from trackLayouts)
    };

export type TransitionSelection = {
  sequenceId: string;
  type: 'fade-in' | 'fade-out' | 'cross-dissolve' | 'gl-transition';
} | null;

const selectedSequenceId = signal<string | null>(null);
const selectedLayerId = signal<string | null>(null);
const selectedTransition = signal<TransitionSelection>(null);
const selectedPanel = signal<PanelId | null>(null);
const sidebarWidth = signal(317);
const propertiesPanelWidth = signal(280);
const shortcutsOverlayOpen = signal(false);
const showNewProjectDialog = signal(false);
const editorMode = signal<EditorMode>('editor');
const sidebarCollapsed = signal(false);
const pendingNewSequenceId = signal<string | null>(null);
const addLayerIntent = signal<AddLayerIntent>(null);
const shaderBrowserInitialTab = signal<string | null>(null);
const sequencesSectionCollapsed = signal(false);
const propertiesSectionCollapsed = signal(false);

// Adaptive view: which sequence's layer view is open (null = show sequence list)
const layerViewSequenceId = signal<string | null>(null);

// Tracks which UI region the mouse cursor is hovering over (for context-dependent shortcuts)
const mouseRegion = signal<'canvas' | 'timeline' | 'other'>('other');

// Flex-grow values for the two sidebar panels (default 1 each)
const seqPanelFlex = signal(1);
const propPanelFlex = signal(1);

// Pre-collapse flex storage (used to restore flex when expanding)
const _preCollapseSeqFlex = signal(1);
const _preCollapsePropFlex = signal(1);

// Legacy signals kept for backward compat (not actively used by new layout)
const sequencesPanelHeight = signal(200);
const layersPanelHeight = signal(200);

export const uiStore = {
  selectedSequenceId,
  selectedLayerId,
  selectedTransition,
  selectedPanel,
  sidebarWidth,
  propertiesPanelWidth,
  shortcutsOverlayOpen,
  showNewProjectDialog,
  editorMode,
  sidebarCollapsed,
  pendingNewSequenceId,
  addLayerIntent,
  shaderBrowserInitialTab,
  sequencesSectionCollapsed,
  propertiesSectionCollapsed,
  layerViewSequenceId,
  sequencesPanelHeight,
  layersPanelHeight,
  seqPanelFlex,
  propPanelFlex,
  mouseRegion,

  selectSequence(id: string | null) {
    selectedSequenceId.value = id;
  },
  selectLayer(id: string | null) {
    selectedLayerId.value = id;
    if (id) {
      selectedTransition.value = null;  // mutual exclusion
    }
  },
  selectTransition(sel: TransitionSelection) {
    selectedTransition.value = sel;
    if (sel) {
      selectedLayerId.value = null;  // mutual exclusion per D-10 / UI-SPEC State Contract
    }
  },
  selectPanel(id: PanelId | null) {
    selectedPanel.value = id;
  },
  setSidebarWidth(w: number) {
    sidebarWidth.value = w;
  },
  setPropertiesPanelWidth(w: number) {
    propertiesPanelWidth.value = w;
  },

  toggleShortcutsOverlay() {
    shortcutsOverlayOpen.value = !shortcutsOverlayOpen.value;
  },
  closeShortcutsOverlay() {
    shortcutsOverlayOpen.value = false;
  },

  setEditorMode(mode: EditorMode) {
    editorMode.value = mode;
  },
  setPendingNewSequenceId(id: string | null) {
    pendingNewSequenceId.value = id;
  },
  setAddLayerIntent(intent: AddLayerIntent) {
    addLayerIntent.value = intent;
  },
  toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  },
  setMouseRegion(region: 'canvas' | 'timeline' | 'other') {
    mouseRegion.value = region;
  },

  // Adaptive layer view
  openLayerView(sequenceId: string) {
    layerViewSequenceId.value = sequenceId;
  },
  closeLayerView() {
    layerViewSequenceId.value = null;
  },

  // Legacy setters (kept for backward compat)
  setSequencesPanelHeight(h: number) {
    sequencesPanelHeight.value = h;
  },
  setLayersPanelHeight(h: number) {
    layersPanelHeight.value = h;
  },

  // Flex setters
  setSeqPanelFlex(v: number) {
    seqPanelFlex.value = v;
  },
  setPropPanelFlex(v: number) {
    propPanelFlex.value = v;
  },

  /**
   * Collapse a panel: store its current flex, set flex to 0, mark section collapsed.
   */
  collapsePanel(panel: 'seq' | 'prop') {
    if (panel === 'seq') {
      _preCollapseSeqFlex.value = seqPanelFlex.value || 1;
      seqPanelFlex.value = 0;
      sequencesSectionCollapsed.value = true;
    } else {
      _preCollapsePropFlex.value = propPanelFlex.value || 1;
      propPanelFlex.value = 0;
      propertiesSectionCollapsed.value = true;
    }
  },

  /**
   * Expand a panel: restore its pre-collapse flex, mark section expanded.
   */
  expandPanel(panel: 'seq' | 'prop') {
    if (panel === 'seq') {
      seqPanelFlex.value = _preCollapseSeqFlex.value || 1;
      sequencesSectionCollapsed.value = false;
    } else {
      propPanelFlex.value = _preCollapsePropFlex.value || 1;
      propertiesSectionCollapsed.value = false;
    }
  },

  async initSidebarLayout() {
    const { getSidebarWidth, getPanelFlex } = await import('../lib/appConfig');
    const w = await getSidebarWidth();
    sidebarWidth.value = w;
    const [sf, pf] = await getPanelFlex();
    seqPanelFlex.value = sf;
    propPanelFlex.value = pf;
    sequencesSectionCollapsed.value = sf === 0;
    propertiesSectionCollapsed.value = pf === 0;
  },

  reset() {
    selectedSequenceId.value = null;
    selectedLayerId.value = null;
    selectedTransition.value = null;
    selectedPanel.value = null;
    sidebarWidth.value = 317;
    propertiesPanelWidth.value = 280;
    sequencesPanelHeight.value = 200;
    layersPanelHeight.value = 200;
    seqPanelFlex.value = 1;
    propPanelFlex.value = 1;
    _preCollapseSeqFlex.value = 1;
    _preCollapsePropFlex.value = 1;
    shortcutsOverlayOpen.value = false;
    showNewProjectDialog.value = false;
    editorMode.value = 'editor';
    pendingNewSequenceId.value = null;
    addLayerIntent.value = null;
    sidebarCollapsed.value = false;
    sequencesSectionCollapsed.value = false;
    propertiesSectionCollapsed.value = false;
    mouseRegion.value = 'other';
    layerViewSequenceId.value = null;
  },
};
