// @vitest-environment node
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

// Source pins for the context-aware Shortcuts overlay wiring (D-01..D-04).
// The overlay must read each store signal exactly once per open with .peek(),
// seed its tab from the pure resolver, and keep the Shift+? binding as the
// only opener; the shared modal owns the backdrop, the keyboard capture and
// the close paths both windows rely on. Source scan only — no DOM mount.

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(MODULE_DIR, '..', '..');

const OVERLAY_SOURCE = readFileSync(join(MODULE_DIR, 'ShortcutsOverlay.tsx'), 'utf8');
const MODAL_SOURCE = readFileSync(join(MODULE_DIR, 'ShortcutsModal.tsx'), 'utf8');
const MODAL_CSS = readFileSync(join(MODULE_DIR, 'shortcutsModal.css'), 'utf8');
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

describe('shared modal shell', () => {
  it('sits above every Studio overlay family', () => {
    expect(MODAL_SOURCE).toContain('z-[100]');
  });

  it('closes on an outside click and keeps panel clicks inside', () => {
    expect(MODAL_SOURCE).toContain('onClick={onClose}');
    expect(MODAL_SOURCE).toContain('onClick={(e) => e.stopPropagation()}');
  });

  it('is a modal dialog that owns keyboard input in the capture phase', () => {
    expect(MODAL_SOURCE).toContain('role="dialog"');
    expect(MODAL_SOURCE).toContain('aria-modal="true"');
    expect(MODAL_SOURCE).toContain("window.addEventListener('keydown', handleKeyDown, true)");
  });

  it('closes on Escape and on the ? toggle key', () => {
    expect(MODAL_SOURCE).toContain("e.key === 'Escape' || e.key === '?'");
  });

  it('formats every key badge with the shared formatter', () => {
    expect(MODAL_SOURCE).toContain('formatShortcutKeys(entry.keys)');
  });

  it('routes number keys through the catalog length, never a hardcoded bound', () => {
    expect(countOf(MODAL_SOURCE, 'resolveShortcutsTabNumber(')).toBe(1);
    expect(MODAL_SOURCE).toContain('resolveShortcutsTabNumber(num, groups.length)');
    expect(MODAL_SOURCE).not.toMatch(/num\s*[<>]=?\s*\d/);
  });
});

describe('shared modal styling isolation', () => {
  it('ships its own scoped stylesheet', () => {
    expect(MODAL_SOURCE).toContain("import './shortcutsModal.css'");
    expect(MODAL_SOURCE).toContain('shortcuts-modal__panel');
    expect(MODAL_SOURCE).toContain('shortcuts-modal__tab');
  });

  it('resets the Studio global button rule inside the modal', () => {
    expect(MODAL_CSS).toContain('.shortcuts-modal button {');
    for (const reset of [
      'background: transparent;',
      'border: 0;',
      'text-transform: none;',
      'letter-spacing: normal;',
    ]) {
      expect(MODAL_CSS).toContain(reset);
    }
  });

  it('wins the hover cascade against the Studio button:hover rule', () => {
    expect(MODAL_CSS).toContain('.shortcuts-modal button:hover:not(:disabled)');
    expect(MODAL_CSS).toContain(
      '.shortcuts-modal button.shortcuts-modal__tab--active:hover:not(:disabled)',
    );
  });
});

describe('single-source catalog', () => {
  it('keeps the Paint Mode group title in the help module only', () => {
    expect(countOf(HELP_SOURCE, "title: 'Paint Mode'")).toBe(1);
    expect(OVERLAY_SOURCE).not.toContain("title: 'Paint Mode'");
    expect(MODAL_SOURCE).not.toContain("title: 'Paint Mode'");
  });
});

describe('opening binding', () => {
  it('keeps Shift+? as the only overlay opener', () => {
    expect(countOf(SHORTCUTS_SOURCE, "'Shift+?'")).toBe(1);
    expect(countOf(SHORTCUTS_SOURCE, 'uiStore.toggleShortcutsOverlay()')).toBe(1);
  });
});
