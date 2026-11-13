import type {ShortcutGroup} from '../../overlay/shortcutsHelp';

/**
 * The Physic Paint Studio's shortcut catalog, consumed by the same shared
 * ShortcutsModal the editor uses. Every row here is a binding that exists in
 * physicsPaintStudioKeyboard.ts or in the canvas viewport; keep it that way.
 */
export const PHYSICS_PAINT_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Playback',
    entries: [
      {keys: '␣ Space', description: 'Play / pause preview'},
      {keys: '← →', description: 'Step frame'},
      {keys: '⇧← ⇧→', description: 'Jump to previous / next saved frame'},
      {keys: 'G', description: 'Refresh the current frame'},
      {keys: '⇧␣ + drag', description: 'Pan the canvas'},
    ],
  },
  {
    title: 'Roto Keys',
    entries: [
      {keys: '← →', description: 'Select previous / next real key (when a key is selected)'},
      {keys: '⌘/Ctrl+C', description: 'Copy the selected key'},
      {keys: '⌘/Ctrl+X', description: 'Cut the selected key'},
      {keys: '⌘/Ctrl+V', description: 'Paste at the current frame'},
      {keys: '⌘/Ctrl+A', description: 'Select all keys (workflow strip focused)'},
      {keys: 'Delete / ⌫', description: 'Delete the selected real key'},
      {keys: 'O', description: 'Toggle onion skin'},
      {keys: '[ ]', description: 'Decrease / increase onion count'},
    ],
  },
  {
    title: 'Paint Tools',
    entries: [
      {keys: 'B', description: 'Brush'},
      {keys: 'W', description: 'Water (needs standing water)'},
      {keys: 'E', description: 'Eraser'},
      {keys: 'P', description: 'Pen'},
      {keys: 'V', description: 'Vector pen'},
      {keys: 'I', description: 'Color picker'},
      {keys: '⌥ + click', description: 'Pick a color temporarily'},
      {keys: 'X', description: 'Swap foreground / background'},
      {keys: 'D', description: 'Reset foreground / background'},
      {keys: 'F', description: 'Flash-dry the sheet'},
      {keys: 'C', description: 'Clear the current frame'},
    ],
  },
  {
    title: 'Move/Edit',
    entries: [
      {keys: 'A', description: 'Toggle Move/Edit (Select)'},
      {keys: '⇧A', description: 'Select / deselect all strokes'},
      {keys: 'Tab', description: 'Cycle stroke filter (Paint → Eraser → All)'},
      {keys: 'Delete / ⌫', description: 'Delete the selected stroke'},
      {keys: 'Drag', description: 'Move the selected stroke'},
      {keys: 'Corner handles', description: 'Scale the selection'},
      {keys: 'Edge handles', description: 'Resize width or height'},
      {keys: 'Top handle', description: 'Rotate the selection'},
    ],
  },
  {
    title: 'Editing',
    entries: [
      {keys: '⌘/Ctrl+Z', description: 'Undo'},
      {keys: '⇧⌘Z / Ctrl+Y', description: 'Redo'},
      {keys: '⇧⌘N', description: 'Add paint track'},
      {keys: '⇧⌘D', description: 'Duplicate active track'},
      {keys: '⇧R', description: "Re-run the current frame's script"},
    ],
  },
  {
    title: 'Canvas',
    entries: [
      {keys: '⌘/Ctrl+Scroll', description: 'Zoom at cursor'},
      {keys: 'Scroll', description: 'Pan while the sheet overflows'},
      {keys: 'Middle-drag', description: 'Pan the canvas'},
      {keys: 'Hand pill (hold)', description: 'Pan the canvas'},
      {keys: '⇧␣ + drag', description: 'Pan the canvas'},
    ],
  },
  {
    title: 'Help',
    entries: [
      {keys: '?', description: 'Toggle this help'},
      {keys: 'Esc', description: 'Dismiss popover / disarm tool / clear selection'},
    ],
  },
];

/** Tab labels: index 0 = Sections, indices 1-N = the group titles in catalog order */
export const PHYSICS_PAINT_SHORTCUT_TAB_LABELS: string[] = [
  'Sections',
  ...PHYSICS_PAINT_SHORTCUT_GROUPS.map((group) => group.title),
];

/** Which Studio surface the modal was opened from. */
export type PhysicsPaintShortcutsContextId = 'move-edit' | 'sections';

export interface PhysicsPaintShortcutsContextInput {
  moveEditMode: boolean;
}

/** D-01 precedence mirrored from the editor: the active editing surface wins. */
export function resolvePhysicsPaintShortcutsContext(
  input: PhysicsPaintShortcutsContextInput,
): PhysicsPaintShortcutsContextId {
  return input.moveEditMode ? 'move-edit' : 'sections';
}

/** Group title each detected context points at (null = the Sections index). */
export const PHYSICS_PAINT_CONTEXT_GROUP_TITLE: Record<PhysicsPaintShortcutsContextId, string | null> = {
  'move-edit': 'Move/Edit',
  sections: null,
};

/** The tab a context opens on: its group's tab, or the Sections index. */
export function resolvePhysicsPaintShortcutsInitialTab(context: PhysicsPaintShortcutsContextId): number {
  const title = PHYSICS_PAINT_CONTEXT_GROUP_TITLE[context];
  if (title === null) return 0;
  const index = PHYSICS_PAINT_SHORTCUT_TAB_LABELS.indexOf(title);
  return index > 0 ? index : 0;
}

/** Always-visible detected-context line: "Detected: <label> — <detail>". */
export const PHYSICS_PAINT_CONTEXT_COPY: Record<
  PhysicsPaintShortcutsContextId,
  {label: string; detail: string}
> = {
  'move-edit': {label: 'Move/Edit', detail: 'shortcuts for selecting and editing strokes'},
  sections: {label: 'All shortcuts', detail: 'press A for Move/Edit tips, or browse every Studio group'},
};
