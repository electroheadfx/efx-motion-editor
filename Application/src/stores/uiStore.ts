import {signal} from '@preact/signals';
import type {PanelId} from '../types/ui';

const selectedSequenceId = signal<string | null>(null);
const selectedLayerId = signal<string | null>(null);
const selectedPanel = signal<PanelId | null>(null);
const sidebarWidth = signal(240);
const propertiesPanelWidth = signal(280);

export const uiStore = {
  selectedSequenceId,
  selectedLayerId,
  selectedPanel,
  sidebarWidth,
  propertiesPanelWidth,

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
  reset() {
    selectedSequenceId.value = null;
    selectedLayerId.value = null;
    selectedPanel.value = null;
    sidebarWidth.value = 240;
    propertiesPanelWidth.value = 280;
  },
};
