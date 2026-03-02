export type PanelId = 'timeline' | 'layers' | 'properties' | 'preview' | 'toolbar' | 'sequences';

export interface UiState {
  selectedSequenceId: string | null;
  selectedLayerId: string | null;
  selectedPanel: PanelId | null;
  sidebarWidth: number;
  propertiesPanelWidth: number;
}
