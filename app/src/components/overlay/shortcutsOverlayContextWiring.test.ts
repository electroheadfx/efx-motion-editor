// @vitest-environment node
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

// Source pins for the context-aware Shortcuts overlay wiring (D-01..D-04).
// The overlay must read each store signal exactly once per open with .peek(),
// seed its tab from the pure resolver, route number keys through the catalog
// length, and keep the Shift+? binding as the only opener. Source scan only —
// no DOM mount (releaseContract style).

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(MODULE_DIR, '..', '..');

const OVERLAY_SOURCE = readFileSync(join(MODULE_DIR, 'ShortcutsOverlay.tsx'), 'utf8');
const HELP_SOURCE = readFileSync(join(MODULE_DIR, 'shortcutsHelp.ts'), 'utf8');
const SHORTCUTS_SOURCE = readFileSync(join(SRC_DIR, 'lib', 'shortcuts.ts'), 'utf8');

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('catalog wiring', () => {
  it('imports the catalog and context law from the pure module', () => {
    expect(OVERLAY_SOURCE).toContain("from './shortcutsHelp'");
    for (const name of [
      'SHORTCUT_GROUPS',
      'SHORTCUT_TAB_LABELS',
      'SHORTCUT_TAB_COUNT',
      'SHORTCUTS_CONTEXT_COPY',
      'resolveShortcutsContext',
      'resolveShortcutsInitialTab',
    ]) {
      expect(OVERLAY_SOURCE).toContain(name);
    }
  });

  it('declares no local catalog, entry type or tab constants', () => {
    expect(OVERLAY_SOURCE).not.toContain('ShortcutGroup[]');
    expect(OVERLAY_SOURCE).not.toContain('ShortcutEntry');
    expect(OVERLAY_SOURCE).not.toMatch(/const\s+SHORTCUT_GROUPS\b/);
    expect(OVERLAY_SOURCE).not.toMatch(/const\s+TAB_LABELS\b/);
    expect(OVERLAY_SOURCE).not.toMatch(/const\s+TAB_COUNT\b/);
  });
});

describe('context seeding', () => {
  it('reads each store signal exactly once with .peek() at mount', () => {
    expect(countOf(OVERLAY_SOURCE, 'paintStore.paintMode.peek()')).toBe(1);
    expect(countOf(OVERLAY_SOURCE, 'uiStore.mouseRegion.peek()')).toBe(1);
  });

  it('resolves the context once and seeds the active tab from it', () => {
    expect(countOf(OVERLAY_SOURCE, 'resolveShortcutsContext(')).toBe(1);
    expect(countOf(OVERLAY_SOURCE, 'resolveShortcutsInitialTab(context)')).toBe(1);
  });

  it('renders the always-visible detected-context label', () => {
    expect(OVERLAY_SOURCE).toContain('Detected:');
    expect(OVERLAY_SOURCE).toContain('SHORTCUTS_CONTEXT_COPY');
    expect(OVERLAY_SOURCE).toContain('.label');
    expect(OVERLAY_SOURCE).toContain('.detail');
  });
});

describe('number-key routing', () => {
  it('routes every number key through resolveShortcutsTabNumber exactly once', () => {
    expect(countOf(OVERLAY_SOURCE, 'resolveShortcutsTabNumber(')).toBe(1);
  });

  it('carries no hardcoded group-count upper bound in the number-key branch', () => {
    expect(OVERLAY_SOURCE).not.toMatch(/num\s*[<>]=?\s*\d/);
    expect(OVERLAY_SOURCE).not.toMatch(/num\s*!==\s*\d+/);
  });
});

describe('single-source catalog', () => {
  it('keeps the Paint Mode group title in the help module only', () => {
    expect(countOf(HELP_SOURCE, "title: 'Paint Mode'")).toBe(1);
    expect(OVERLAY_SOURCE).not.toContain("title: 'Paint Mode'");
  });
});

describe('opening binding', () => {
  it('keeps Shift+? as the only overlay opener', () => {
    expect(countOf(SHORTCUTS_SOURCE, "'Shift+?'")).toBe(1);
    expect(countOf(SHORTCUTS_SOURCE, 'uiStore.toggleShortcutsOverlay()')).toBe(1);
  });
});
