/** Shortcut entry: key symbol(s) and description */
export interface ShortcutEntry {
  keys: string;
  description: string;
}

export interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Playback',
    entries: [
      {keys: '\u2423 Space', description: 'Play / Pause'},
      {keys: '\u2190 \u2192', description: 'Step frame'},
      {keys: 'J', description: 'Set reverse / increase speed'},
      {keys: 'K', description: 'Reset speed to 1x forward'},
      {keys: 'L', description: 'Set forward / increase speed'},
      {keys: '\u21E7\u2423', description: 'Full-speed playback (no UI feedback)'},
    ],
  },
  {
    title: 'File',
    entries: [
      {keys: '\u2318S', description: 'Save project'},
      {keys: '\u2318N', description: 'New project'},
      {keys: '\u2318O', description: 'Open project'},
    ],
  },
  {
    title: 'Editing',
    entries: [
      {keys: '\u2318Z', description: 'Undo'},
      {keys: '\u21E7\u2318Z', description: 'Redo'},
      {keys: '\u232B', description: 'Delete selected'},
    ],
  },
  {
    title: 'Navigation',
    entries: [
      {keys: 'Home / \u21E7\u2318\u2190', description: 'Go to start of timeline'},
      {keys: 'End / \u21E7\u2318\u2192', description: 'Go to end of timeline'},
      {keys: 'PgUp / \u2318\u2190 / \u2191', description: 'Jump to previous sequence'},
      {keys: 'PgDn / \u2318\u2192 / \u2193', description: 'Jump to next sequence'},
      {keys: '\u21E7\u2318T', description: 'Cycle theme'},
      {keys: '?', description: 'Toggle this help'},
    ],
  },
  {
    title: 'Canvas',
    entries: [
      {keys: '= / +', description: 'Zoom in (when mouse over canvas)'},
      {keys: '\u2212', description: 'Zoom out (when mouse over canvas)'},
      {keys: '\u23180', description: 'Fit to window'},
      {keys: 'F', description: 'Toggle fit lock'},
      {keys: '\u2318Scroll', description: 'Zoom at cursor'},
      {keys: '\u2190\u2191\u2193\u2192', description: 'Nudge layer 1px'},
      {keys: '\u21E7\u2190\u2191\u2193\u2192', description: 'Nudge layer 10px'},
      {keys: '\u21E7\u2318F', description: 'Toggle fullscreen canvas'},
      {keys: 'Esc', description: 'Deselect layer'},
      {keys: '\u2325Click', description: 'Cycle overlapping layers'},
    ],
  },
  {
    title: 'Timeline',
    entries: [
      {keys: '= / +', description: 'Zoom in (when mouse over timeline)'},
      {keys: '\u2212', description: 'Zoom out (when mouse over timeline)'},
      {keys: '\u2303Scroll', description: 'Zoom at cursor'},
      {keys: '\u2318Scroll', description: 'Vertical scroll'},
      {keys: 'Scroll', description: 'Natural scroll (trackpad)'},
      {keys: '\u21E7Scroll', description: 'Vertical scroll'},
      {keys: 'S', description: 'Toggle solo mode (base content only)'},
    ],
  },
  {
    title: 'Blur',
    entries: [
      { keys: '\u21E7B', description: 'Toggle bypass all blur' },
    ],
  },
  {
    title: 'Keyframes',
    entries: [
      { keys: 'I', description: 'Add keyframe at current frame' },
    ],
  },
  {
    title: 'Paint Mode',
    entries: [
      { keys: 'P', description: 'Toggle paint edit mode' },
      { keys: 'F', description: 'Toggle flat/FX preview' },
      { keys: 'O', description: 'Toggle sequence overlay' },
      { keys: '\u2318/Ctrl+A', description: 'Select all strokes' },
      { keys: 'Delete', description: 'Delete selected strokes' },
      { keys: 'Click', description: 'Select stroke (select tool)' },
      { keys: '\u2318/Ctrl+Click', description: 'Multi-select strokes' },
      { keys: 'Drag', description: 'Move selected strokes' },
      { keys: 'Corner handle', description: 'Resize selected strokes' },
      { keys: 'Rotate handle', description: 'Rotate selected strokes' },
    ],
  },
];

/** Tab labels: index 0 = Sections, indices 1-N = the group titles in catalog order */
export const SHORTCUT_TAB_LABELS: string[] = ['Sections', ...SHORTCUT_GROUPS.map((g) => g.title)];

/** Total number of tabs: Sections index (0) + group tabs */
export const SHORTCUT_TAB_COUNT = 1 + SHORTCUT_GROUPS.length;

/** Which surface the overlay was opened from (D-01). */
export type ShortcutsContextId = 'paint' | 'timeline' | 'canvas' | 'sections';

/** The two store signals the context is resolved from, read once at mount. */
export interface ShortcutsContextInput {
  paintMode: boolean;
  mouseRegion: 'canvas' | 'timeline' | 'other';
}

/** D-01 precedence: paint edit mode > timeline hover > canvas hover > Sections. */
export function resolveShortcutsContext(input: ShortcutsContextInput): ShortcutsContextId {
  if (input.paintMode) return 'paint';
  if (input.mouseRegion === 'timeline') return 'timeline';
  if (input.mouseRegion === 'canvas') return 'canvas';
  return 'sections';
}

/** Group title each detected context points at (null = the Sections index). */
export const SHORTCUTS_CONTEXT_GROUP_TITLE: Record<ShortcutsContextId, string | null> = {
  paint: 'Paint Mode',
  timeline: 'Timeline',
  canvas: 'Canvas',
  sections: null,
};

/** The tab a context opens on: its group's tab, or the Sections index. */
export function resolveShortcutsInitialTab(context: ShortcutsContextId): number {
  const title = SHORTCUTS_CONTEXT_GROUP_TITLE[context];
  if (title === null) return 0;
  const index = SHORTCUT_TAB_LABELS.indexOf(title);
  return index > 0 ? index : 0;
}

/** Always-visible detected-context line: "Detected: <label> — <detail>". */
export const SHORTCUTS_CONTEXT_COPY: Record<ShortcutsContextId, {label: string; detail: string}> = {
  paint: {label: 'Paint Mode', detail: 'shortcuts for editing strokes'},
  timeline: {label: 'Timeline', detail: 'shortcuts for this timeline surface'},
  canvas: {label: 'Canvas', detail: 'shortcuts for the canvas'},
  sections: {label: 'All shortcuts', detail: 'hover the canvas or the timeline for surface help'},
};
