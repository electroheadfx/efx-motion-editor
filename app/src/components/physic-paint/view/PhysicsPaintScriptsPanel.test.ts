import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const panel = readFileSync(fileURLToPath(new URL('./PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const rightPanel = readFileSync(fileURLToPath(new URL('./PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
const controller = readFileSync(fileURLToPath(new URL('../roto/physicsPaintRotoScriptLibrary.ts', import.meta.url)), 'utf8');

describe('Physics Paint SCRIPTS panel contract', () => {
  it('keeps four semantic tabs and explicitly scans on SCRIPTS entry', () => {
    for (const tab of ['TOOL', 'ONION', 'MOTION', 'SCRIPTS']) expect(rightPanel).toMatch(new RegExp(`>\\s*${tab}\\s*<`));
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(6);
    expect(rightPanel).toContain("setOptionsTab('scripts'); void scripts.library.enterScripts()");
    expect(rightPanel).toContain("optionsTab === 'scripts'");
  });

  it('exposes six ordered accessible Lucide controls and exact disabled reasons', () => {
    const labels = ['Save Script', 'Load Script', 'Rename Script', 'Delete Script', 'Refresh Scripts', 'Import Script'];
    let cursor = -1;
    for (const label of labels) { const next = panel.indexOf(`label="${label}"`); expect(next).toBeGreaterThan(cursor); cursor = next; }
    expect(panel).toContain('aria-label={props.label}');
    expect(panel).toContain('title={props.title}');
    expect(controller).toContain("saveDisabledReason: !projectSaved.value ? 'Save the project first.'");
    expect(panel).toContain('availability.saveDisabledReason');
    expect(panel).toContain('Import from another project — coming later');
    expect(panel).toContain('onClick={() => {}}');
  });

  it('provides listbox rows, keyboard selection, inline rename, and focus-contained deletion', () => {
    expect(panel).toContain('role="listbox"');
    expect(panel).toContain('role="option"');
    expect(panel).toContain('aria-selected={library.selectedId.value === row.id}');
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Delete', 'Escape']) expect(panel).toContain(`event.key === '${key}'`);
    expect(panel).toContain("event.key !== 'Tab'");
    expect(panel).toContain('library.commitRename()');
    expect(panel).toContain('library.cancelRename()');
    expect(panel).toContain('Delete “{confirmation.name}”?');
    expect(panel).toContain('document.activeElement === first');
    expect(panel).toContain('deleteButtonRef.current?.focus()');
    expect(panel).toContain('aria-live="polite"');
  });

  it('locks deterministic compact CSS without claiming pixel layout proof', () => {
    expect(css).toMatch(/\.physics-paint-options-tabs[\s\S]*?white-space:\s*nowrap/);
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.physics-paint-scripts-panel[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/\.physics-paint-scripts-list[\s\S]*?overflow-y:\s*auto[\s\S]*?overflow-x:\s*hidden/);
    expect(css).toMatch(/\.physics-paint-script-thumbnail[\s\S]*?(?:width|height):\s*48px/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/@media[\s\S]*?max-width:\s*860px[\s\S]*?grid-template-columns:\s*1fr/);
  });
});
