// @vitest-environment node
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {
  SHORTCUT_GROUPS,
  SHORTCUT_TAB_COUNT,
  SHORTCUT_TAB_LABELS,
  SHORTCUTS_CONTEXT_COPY,
  resolveShortcutsContext,
  resolveShortcutsInitialTab,
  resolveShortcutsTabNumber,
} from './shortcutsHelp';

// Pure pins for the context-aware Shortcuts overlay (D-01..D-04). The module is
// deliberately import-free, so this test can read its own source with node:fs
// and prove the purity contract. No DOM mount (releaseContract style).

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const HELP_SOURCE = readFileSync(join(MODULE_DIR, 'shortcutsHelp.ts'), 'utf8');

const CONTEXT_IDS = ['paint', 'timeline', 'canvas', 'sections'] as const;

function groupByTitle(title: string) {
  const group = SHORTCUT_GROUPS.find((g) => g.title === title);
  if (!group) throw new Error(`missing shortcut group: ${title}`);
  return group;
}

describe('resolveShortcutsContext', () => {
  it('prefers paint edit mode over every hover region', () => {
    expect(resolveShortcutsContext({paintMode: true, mouseRegion: 'timeline'})).toBe('paint');
    expect(resolveShortcutsContext({paintMode: true, mouseRegion: 'canvas'})).toBe('paint');
    expect(resolveShortcutsContext({paintMode: true, mouseRegion: 'other'})).toBe('paint');
  });

  it('falls through timeline then canvas then sections when paint mode is off', () => {
    expect(resolveShortcutsContext({paintMode: false, mouseRegion: 'timeline'})).toBe('timeline');
    expect(resolveShortcutsContext({paintMode: false, mouseRegion: 'canvas'})).toBe('canvas');
    expect(resolveShortcutsContext({paintMode: false, mouseRegion: 'other'})).toBe('sections');
  });
});

describe('resolveShortcutsInitialTab', () => {
  it('lands on the matching group tab and on the Sections index for sections', () => {
    expect(resolveShortcutsInitialTab('paint')).toBe(SHORTCUT_TAB_LABELS.indexOf('Paint Mode'));
    expect(resolveShortcutsInitialTab('timeline')).toBe(SHORTCUT_TAB_LABELS.indexOf('Timeline'));
    expect(resolveShortcutsInitialTab('canvas')).toBe(SHORTCUT_TAB_LABELS.indexOf('Canvas'));
    expect(resolveShortcutsInitialTab('sections')).toBe(0);
  });

  it('returns an integer tab inside the tab range for every context', () => {
    for (const context of CONTEXT_IDS) {
      const tab = resolveShortcutsInitialTab(context);
      expect(Number.isInteger(tab)).toBe(true);
      expect(tab).toBeGreaterThanOrEqual(0);
      expect(tab).toBeLessThan(SHORTCUT_TAB_COUNT);
    }
  });
});

describe('tab shape', () => {
  it('labels the Sections index first, then every group title in catalog order', () => {
    expect(SHORTCUT_TAB_LABELS).toEqual([
      'Sections',
      'Playback',
      'File',
      'Editing',
      'Navigation',
      'Canvas',
      'Timeline',
      'Blur',
      'Keyframes',
      'Paint Mode',
    ]);
    expect(SHORTCUT_TAB_COUNT).toBe(10);
    expect(SHORTCUT_TAB_COUNT).toBe(1 + SHORTCUT_GROUPS.length);
  });
});

describe('context copy', () => {
  it('labels and details all four contexts', () => {
    for (const id of CONTEXT_IDS) {
      expect(SHORTCUTS_CONTEXT_COPY[id].label.length).toBeGreaterThan(0);
      expect(SHORTCUTS_CONTEXT_COPY[id].detail.length).toBeGreaterThan(0);
    }
  });

  it('gives each surface its own label, distinct from the sections label', () => {
    const surfaceLabels = [
      SHORTCUTS_CONTEXT_COPY.paint.label,
      SHORTCUTS_CONTEXT_COPY.timeline.label,
      SHORTCUTS_CONTEXT_COPY.canvas.label,
    ];
    expect(new Set(surfaceLabels).size).toBe(3);
    expect(surfaceLabels).not.toContain(SHORTCUTS_CONTEXT_COPY.sections.label);
  });
});

describe('module purity', () => {
  it('contains no import statements (D-04)', () => {
    expect(HELP_SOURCE).not.toMatch(/^\s*import\b/m);
    expect(HELP_SOURCE).not.toMatch(/\bfrom\s+['"]/);
  });
});

describe('Paint Mode catalog accuracy', () => {
  it('documents exactly the real paint bindings, in order', () => {
    expect(groupByTitle('Paint Mode').entries.map((entry) => entry.keys)).toEqual([
      'P',
      'S',
      'F',
      'X',
      'Esc',
      '⌘/Ctrl+A',
      'Delete',
      'Click',
      '⌘/Ctrl+Click',
      'Drag',
      'Corner handle',
      'Rotate handle',
    ]);
    expect(groupByTitle('Paint Mode').entries.map((entry) => entry.description)).toEqual([
      'Toggle paint edit mode',
      'Select tool',
      'Toggle flat/FX preview',
      'Swap foreground / background',
      'Leave paint mode',
      'Select all strokes (select tool)',
      'Delete selected strokes',
      'Select stroke (select tool)',
      'Multi-select strokes',
      'Move selected strokes',
      'Resize selected strokes',
      'Rotate selected strokes',
    ]);
  });

  it('drops the unbound single-letter row and every sequence-overlay claim', () => {
    expect(groupByTitle('Paint Mode').entries.some((entry) => entry.keys === 'O')).toBe(false);
    expect(
      groupByTitle('Paint Mode').entries.some((entry) => /sequence overlay/i.test(entry.description)),
    ).toBe(false);
  });
});

describe('Timeline catalog accuracy', () => {
  it('names Alt+S for solo and nothing else', () => {
    expect(groupByTitle('Timeline').entries.find((entry) => /solo/i.test(entry.description))).toEqual({
      keys: 'Alt+S',
      description: 'Toggle solo mode (base content only)',
    });
  });

  it('does not claim a bare S solo binding', () => {
    expect(groupByTitle('Timeline').entries.some((entry) => entry.keys === 'S')).toBe(false);
  });

  it('states the device-specific plain scroll behaviour', () => {
    expect(groupByTitle('Timeline').entries.find((entry) => entry.keys === 'Scroll')?.description).toBe(
      'Natural two-axis scroll (trackpad); mouse wheel scrolls horizontally',
    );
  });
});

describe('Canvas catalog', () => {
  it('keeps the ten verified rows unchanged', () => {
    expect(groupByTitle('Canvas').entries.map((entry) => entry.keys)).toEqual([
      '= / +',
      '−',
      '⌘0',
      'F',
      '⌘Scroll',
      '←↑↓→',
      '⇧←↑↓→',
      '⇧⌘F',
      'Esc',
      '⌥Click',
    ]);
  });
});

describe('resolveShortcutsTabNumber', () => {
  it('maps 1 through the group count to their group tab', () => {
    expect(resolveShortcutsTabNumber(1)).toBe(1);
    expect(resolveShortcutsTabNumber(9)).toBe(9);
  });

  it('rejects out-of-range, fractional and NaN values', () => {
    expect(resolveShortcutsTabNumber(0)).toBeNull();
    expect(resolveShortcutsTabNumber(10)).toBeNull();
    expect(resolveShortcutsTabNumber(1.5)).toBeNull();
    expect(resolveShortcutsTabNumber(Number.NaN)).toBeNull();
  });
});
