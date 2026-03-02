export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}
