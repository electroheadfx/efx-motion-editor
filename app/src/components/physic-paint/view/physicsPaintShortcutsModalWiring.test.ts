// @vitest-environment node
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

// The Studio must use the SAME modal shell as the editor — never its old
// flow-layout aside. Source pins only; the rendering itself is exercised by
// the shared ShortcutsModal.

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const VIEW_SOURCE = readFileSync(join(MODULE_DIR, 'PhysicsPaintStudioView.tsx'), 'utf8');
const WRAPPER_SOURCE = readFileSync(join(MODULE_DIR, 'PhysicsPaintShortcutsModal.tsx'), 'utf8');
const STUDIO_SOURCE = readFileSync(
  join(resolve(MODULE_DIR, '..'), 'PhysicsPaintStudio.tsx'),
  'utf8',
);
const STUDIO_CSS = readFileSync(
  join(resolve(MODULE_DIR, '..'), 'physicsPaintStudio.css'),
  'utf8',
);

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('Studio modal mount', () => {
  it('renders the shared modal instead of the old aside', () => {
    expect(VIEW_SOURCE).toContain('<PhysicsPaintShortcutsModal');
    expect(VIEW_SOURCE).not.toContain('physics-paint-shortcuts-help');
    expect(STUDIO_CSS).not.toContain('.physics-paint-shortcuts-help');
  });

  it('gives the modal one close path from the Studio shell', () => {
    expect(STUDIO_SOURCE).toContain('onCloseShortcuts: () => setShortcutsVisible(false)');
    expect(VIEW_SOURCE).toContain('onClose={onCloseShortcuts}');
  });
});

describe('Studio modal wrapper', () => {
  it("uses the editor's shared modal component", () => {
    expect(WRAPPER_SOURCE).toContain("from '../../overlay/ShortcutsModal'");
    expect(WRAPPER_SOURCE).toContain('<ShortcutsModal');
  });

  it('detects Move/Edit once per open', () => {
    expect(countOf(WRAPPER_SOURCE, 'aquarelleSelectMode.peek()')).toBe(1);
    expect(countOf(WRAPPER_SOURCE, 'resolvePhysicsPaintShortcutsContext(')).toBe(1);
    expect(countOf(WRAPPER_SOURCE, 'resolvePhysicsPaintShortcutsInitialTab(context)')).toBe(1);
  });

  it('renders the always-visible detected-context line', () => {
    expect(WRAPPER_SOURCE).toContain('Detected:');
    expect(WRAPPER_SOURCE).toContain('PHYSICS_PAINT_CONTEXT_COPY');
    expect(WRAPPER_SOURCE).toContain('.label');
    expect(WRAPPER_SOURCE).toContain('.detail');
  });
});
