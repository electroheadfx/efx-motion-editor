// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {
  PHYSICS_PAINT_CONTEXT_COPY,
  PHYSICS_PAINT_SHORTCUT_GROUPS,
  PHYSICS_PAINT_SHORTCUT_TAB_LABELS,
  resolvePhysicsPaintShortcutsContext,
  resolvePhysicsPaintShortcutsInitialTab,
} from './physicsPaintShortcutsHelp';

function groupByTitle(title: string) {
  const group = PHYSICS_PAINT_SHORTCUT_GROUPS.find((candidate) => candidate.title === title);
  if (!group) throw new Error(`missing Studio shortcut group: ${title}`);
  return group;
}

describe('Studio context', () => {
  it('opens on Move/Edit while that surface is active', () => {
    expect(resolvePhysicsPaintShortcutsContext({moveEditMode: true})).toBe('move-edit');
  });

  it('falls back to the Sections index otherwise', () => {
    expect(resolvePhysicsPaintShortcutsContext({moveEditMode: false})).toBe('sections');
  });

  it('seeds the matching tab and keeps every result in range', () => {
    expect(resolvePhysicsPaintShortcutsInitialTab('move-edit')).toBe(
      PHYSICS_PAINT_SHORTCUT_TAB_LABELS.indexOf('Move/Edit'),
    );
    expect(resolvePhysicsPaintShortcutsInitialTab('sections')).toBe(0);
    for (const context of ['move-edit', 'sections'] as const) {
      const tab = resolvePhysicsPaintShortcutsInitialTab(context);
      expect(Number.isInteger(tab)).toBe(true);
      expect(tab).toBeGreaterThanOrEqual(0);
      expect(tab).toBeLessThan(PHYSICS_PAINT_SHORTCUT_TAB_LABELS.length);
    }
  });

  it('covers every context with a label and a detail line', () => {
    for (const context of ['move-edit', 'sections'] as const) {
      expect(PHYSICS_PAINT_CONTEXT_COPY[context].label.length).toBeGreaterThan(0);
      expect(PHYSICS_PAINT_CONTEXT_COPY[context].detail.length).toBeGreaterThan(0);
    }
  });
});

describe('Studio catalog shape', () => {
  it('starts the tab labels with Sections and follows catalog order', () => {
    expect(PHYSICS_PAINT_SHORTCUT_TAB_LABELS).toEqual([
      'Sections',
      'Playback',
      'Roto Keys',
      'Paint Tools',
      'Move/Edit',
      'Editing',
      'Canvas',
      'Help',
    ]);
  });

  it('has no empty group and no duplicate title', () => {
    expect(PHYSICS_PAINT_SHORTCUT_GROUPS.length).toBeGreaterThan(0);
    const titles = PHYSICS_PAINT_SHORTCUT_GROUPS.map((group) => group.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const group of PHYSICS_PAINT_SHORTCUT_GROUPS) {
      expect(group.entries.length).toBeGreaterThan(0);
    }
  });
});

describe('Studio catalog accuracy', () => {
  it('documents the tool letters the Studio dispatcher owns', () => {
    expect(groupByTitle('Paint Tools').entries.map((entry) => entry.keys)).toEqual([
      'B',
      'W',
      'E',
      'P',
      'V',
      'I',
      '⌥ + click',
      'X',
      'D',
      'F',
      'C',
    ]);
  });

  it('documents the Move/Edit surface keys and gestures', () => {
    const keys = groupByTitle('Move/Edit').entries.map((entry) => entry.keys);
    for (const expected of ['A', '⇧A', 'Tab', 'Delete / ⌫', 'Drag', 'Corner handles', 'Edge handles', 'Top handle']) {
      expect(keys).toContain(expected);
    }
  });

  it('documents roto key editing and onion controls', () => {
    const keys = groupByTitle('Roto Keys').entries.map((entry) => entry.keys);
    for (const expected of ['⌘/Ctrl+C', '⌘/Ctrl+X', '⌘/Ctrl+V', '⌘/Ctrl+A', 'Delete / ⌫', 'O', '[ ]']) {
      expect(keys).toContain(expected);
    }
  });

  it('documents the hidden-track and duplicate-track chords', () => {
    const keys = groupByTitle('Editing').entries.map((entry) => entry.keys);
    expect(keys).toContain('⇧⌘N');
    expect(keys).toContain('⇧⌘D');
  });

  it('documents both modal close keys in Help', () => {
    const keys = groupByTitle('Help').entries.map((entry) => entry.keys);
    expect(keys).toContain('?');
    expect(keys).toContain('Esc');
  });
});
