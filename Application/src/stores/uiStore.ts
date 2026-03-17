import {signal} from '@preact/signals';
import type {PanelId} from '../types/ui';

export type EditorMode = 'editor' | 'imported' | 'settings';

const selectedSequenceId = signal<string | null>(null);
const selectedLayerId = signal<string | null>(null);
const selectedPanel = signal<PanelId | null>(null);
const sidebarWidth = signal(317);
const propertiesPanelWidth = signal(280);
const shortcutsOverlayOpen = signal(false);
const showNewProjectDialog = signal(false);
const editorMode = signal<EditorMode>('editor');
const sidebarCollapsed = signal(false);
const sequencesSectionCollapsed = signal(false);
const layersSectionCollapsed = signal(false);
const sequencesPanelHeight = signal(200);
const layersPanelHeight = signal(200);

export const uiStore = {
  selectedSequenceId,
  selectedLayerId,
  selectedPanel,
  sidebarWidth,
  propertiesPanelWidth,
  shortcutsOverlayOpen,
  showNewProjectDialog,
  editorMode,
  sidebarCollapsed,
  sequencesSectionCollapsed,
  layersSectionCollapsed,
  sequencesPanelHeight,
  layersPanelHeight,

  selectSequence(id: string | null) {
    selectedSequenceId.value = id;
  },
  selectLayer(id: string | null) {
    selectedLayerId.value = id;
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
  toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  },
  setSequencesPanelHeight(h: number) {
    sequencesPanelHeight.value = h;
  },
  setLayersPanelHeight(h: number) {
    layersPanelHeight.value = h;
  },
  async initSidebarLayout() {
    const { getSidebarWidth, getPanelHeights } = await import('../lib/appConfig');
    const w = await getSidebarWidth();
    sidebarWidth.value = w;
    const [seqH, layH] = await getPanelHeights();
    sequencesPanelHeight.value = seqH;
    layersPanelHeight.value = layH;
  },

  reset() {
    selectedSequenceId.value = null;
    selectedLayerId.value = null;
    selectedPanel.value = null;
    sidebarWidth.value = 317;
    propertiesPanelWidth.value = 280;
    sequencesPanelHeight.value = 200;
    layersPanelHeight.value = 200;
    shortcutsOverlayOpen.value = false;
    showNewProjectDialog.value = false;
    editorMode.value = 'editor';
    sidebarCollapsed.value = false;
    sequencesSectionCollapsed.value = false;
    layersSectionCollapsed.value = false;
  },
};
