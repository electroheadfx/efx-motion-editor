/** Shortcut entry: key symbol(s) and description */
export interface ShortcutEntry {
  keys: string;
  description: string;
}

export interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [];

/** Total number of tabs: Sections index (0) + group tabs */
export const SHORTCUT_TAB_LABELS: string[] = ['Sections'];

export const SHORTCUT_TAB_COUNT = 1;

export type ShortcutsContextId = 'paint' | 'timeline' | 'canvas' | 'sections';

export interface ShortcutsContextInput {
  paintMode: boolean;
  mouseRegion: 'canvas' | 'timeline' | 'other';
}

export function resolveShortcutsContext(_input: ShortcutsContextInput): ShortcutsContextId {
  return 'sections';
}

export const SHORTCUTS_CONTEXT_GROUP_TITLE: Record<ShortcutsContextId, string | null> = {
  paint: null,
  timeline: null,
  canvas: null,
  sections: null,
};

export function resolveShortcutsInitialTab(_context: ShortcutsContextId): number {
  return 0;
}

export const SHORTCUTS_CONTEXT_COPY: Record<ShortcutsContextId, {label: string; detail: string}> = {
  paint: {label: '', detail: ''},
  timeline: {label: '', detail: ''},
  canvas: {label: '', detail: ''},
  sections: {label: '', detail: ''},
};
