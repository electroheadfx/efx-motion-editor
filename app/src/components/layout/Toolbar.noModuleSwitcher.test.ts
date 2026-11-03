// ============================================================
//  261102-iv5 — the main editor Toolbar carries NO module switcher.
//
//  The switcher was a Studio-scope idea that leaked into the editor top
//  bar; the product ships ONE Water color engine/module and Krita is
//  neither implemented nor planned. This source-scan pin (the
//  PhysicsPaintTopBar.test.ts idiom) fails if any of it returns:
//  - the shared ModuleSwitcher component or its tests come back,
//  - Toolbar.tsx imports/mounts it or names the retired engine label,
//  - the Studio stylesheet regains a .module-switcher rule.
// ============================================================

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

const toolbarPath = resolve(here, 'Toolbar.tsx');
const moduleSwitcherPath = resolve(here, '../shared/ModuleSwitcher.tsx');
const moduleSwitcherTestPath = resolve(here, '../shared/ModuleSwitcher.test.tsx');
const moduleSwitcherLauncherPath = resolve(here, '../shared/ModuleSwitcher.test.tsx.test.ts');
const stylesheetPath = resolve(here, '../physic-paint/physicsPaintStudio.css');

/** Strip block + line comments so negative scans never trip on docs. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('261102-iv5 editor Toolbar has no module switcher', () => {
  it('Toolbar.tsx imports and mounts no ModuleSwitcher', () => {
    const body = stripComments(readFileSync(toolbarPath, 'utf8'));
    expect(body, 'the ModuleSwitcher import/mount must leave the editor Toolbar').not.toContain('ModuleSwitcher');
    expect(body, 'no module-switcher class token in the editor Toolbar').not.toContain('module-switcher');
  });

  it('Toolbar.tsx carries no retired third-engine label', () => {
    const body = stripComments(readFileSync(toolbarPath, 'utf8'));
    expect(body, 'Krita is not an editor surface').not.toMatch(/\bKrita\b/);
  });

  it('the shared switcher component and both of its tests are gone', () => {
    expect(existsSync(moduleSwitcherPath), 'ModuleSwitcher.tsx must stay deleted').toBe(false);
    expect(existsSync(moduleSwitcherTestPath), 'ModuleSwitcher.test.tsx must stay deleted').toBe(false);
    expect(existsSync(moduleSwitcherLauncherPath), 'ModuleSwitcher.test.tsx.test.ts must stay deleted').toBe(false);
  });

  it('the Studio stylesheet drops .module-switcher but keeps the segmented family', () => {
    const styles = stripComments(readFileSync(stylesheetPath, 'utf8'));
    expect(styles, 'dead .module-switcher rules must leave the Studio stylesheet').not.toContain('.module-switcher');
    expect(styles, 'PaperPicker and friends still use the segmented row').toContain('.physics-paint-segmented-row');
    expect(styles, 'the shared button family survives').toContain('.physics-paint-segmented-button');
  });
});
