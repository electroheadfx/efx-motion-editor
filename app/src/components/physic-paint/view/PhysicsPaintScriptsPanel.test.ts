import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const panel = readFileSync(fileURLToPath(new URL('./PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const playScriptDialog = readFileSync(fileURLToPath(new URL('./PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');
const studioView = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const rightPanel = readFileSync(fileURLToPath(new URL('./PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
const controller = readFileSync(fileURLToPath(new URL('../roto/physicsPaintRotoScriptLibrary.ts', import.meta.url)), 'utf8');
const studio = readFileSync(fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const strip = readFileSync(fileURLToPath(new URL('./PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');

function getDiscardBlock(code: string): string {
  const labelIndex = code.indexOf('aria-label="Discard Script"');
  if (labelIndex === -1) return '';
  const start = code.lastIndexOf('<span', labelIndex);
  const tooltipClose = code.indexOf('</PhysicsPaintStyledTooltip>', labelIndex);
  const end = tooltipClose === -1
    ? code.indexOf('</button>', labelIndex) + '</button>'.length
    : tooltipClose + '</PhysicsPaintStyledTooltip>'.length;
  return code.slice(start, end);
}

function getScriptsPanelPropsInterface(code: string): string {
  return code.slice(code.indexOf('export interface PhysicsPaintScriptsPanelProps'), code.indexOf('export function PhysicsPaintScriptsPanel'));
}

describe('Physics Paint SCRIPTS panel contract', () => {
  it('keeps approved mixed-case tab groups and explicitly scans on Scripts entry', () => {
    for (const tab of ['Brush color', 'Tool', 'Onion', 'Motion', 'Scripts']) expect(rightPanel).toMatch(new RegExp(`>\\s*${tab}\\s*<`));
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(6);
    expect(rightPanel).toContain("setOptionsTab('scripts'); void scripts.library.enterScripts()");
    expect(rightPanel).toContain("optionsTab === 'scripts'");
  });

  it('exposes six ordered accessible Lucide controls and exact disabled reasons', () => {
    const labels = ['Save Script', 'Load and Apply Script', 'Play Script', 'Rename Script', 'Delete Script', 'Refresh Scripts'];
    let cursor = -1;
    for (const label of labels) { const next = panel.indexOf(`label="${label}"`); expect(next).toBeGreaterThan(cursor); cursor = next; }
    expect(panel).toContain('aria-label={props.label}');
    expect(panel).toContain('title={props.title}');
    expect(controller).toContain("saveDisabledReason: !projectSaved.value ? 'Save the project first.'");
    expect(panel).toContain('availability.saveDisabledReason');
    expect(panel).toContain("playScript.disabledReason.value ?? 'Generate progressive real Roto keys'");
    expect(panel).not.toContain('Import Script');
  });

  it('provides an accessible Play Script dialog distinct from cached Roto playback', () => {
    expect(studioView).toContain('<PhysicsPaintPlayScriptDialog {...playScriptDialog} />');
    expect(playScriptDialog).toContain('role="dialog"');
    expect(playScriptDialog).toContain('aria-modal="true"');
    expect(playScriptDialog).toContain('aria-labelledby="physics-play-script-title"');
    expect(playScriptDialog).toContain('Max {playScript.capacity.value}');
    expect(playScriptDialog).toContain('Enter a positive integer or Max.');
    expect(playScriptDialog).toContain("if (event.key === 'Escape')");
    expect(playScriptDialog).toContain("if (event.key === 'Enter' && !playScript.validationError.value");
    expect(playScriptDialog).toContain("event.key !== 'Tab'");
    expect(playScriptDialog).toContain('inputRef.current?.focus()');
    expect(playScriptDialog).toContain('returnFocusRef.current?.focus()');
    expect(panel).not.toContain('toggleRotoPlayback');
  });

  it('provides load-only focusable rows, inline rename isolation, and focus-contained deletion', () => {
    expect(panel).toContain('role="listbox"');
    expect(panel).toContain('role="option"');
    expect(panel).toContain('tabIndex={0}');
    expect(panel).toContain('aria-selected={library.selectedId.value === row.id}');
    expect(panel).toContain('onClick={() => onActivateRow(row.id)}');
    expect(panel).toContain("event.key !== 'Enter' && event.key !== ' '");
    expect(panel).toContain('event.preventDefault()');
    expect(panel).toContain('onActivateRow(row.id)');
    expect(panel).toContain('onClick={stopRowPointerActivation}');
    expect(panel).toContain('event.stopPropagation()');
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
    expect(css).toMatch(/\.physics-paint-scripts-list[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/);
    expect(css).toMatch(/\.physics-paint-script-thumbnail[\s\S]*?(?:width|height):\s*48px/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/@media[\s\S]*?max-width:\s*860px[\s\S]*?grid-template-columns:\s*1fr/);
  });
});

describe('Physics Paint Scripts panel Discard Script contract (36.15-07)', () => {
  it('renders a guarded Discard Script clipboard-x control without native disabled or title', () => {
    expect(panel).toContain('ClipboardX');
    expect(panel).toContain('aria-label="Discard Script"');
    const block = getDiscardBlock(panel);
    expect(block).toContain('aria-disabled');
    expect(block.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(block).not.toContain('title=');
  });

  it('wires the styled tooltip two-part grammar and guards activation before the handler', () => {
    const block = getDiscardBlock(panel);
    expect(block).toContain('Discard Script — unavailable: ${discardScriptDisabledReason}');
    expect(block).toContain('discardScriptDisabledReason}');
    expect(block).toContain('aria-describedby');
    expect(block).toContain('PhysicsPaintStyledTooltip');
    const guardIndex = block.indexOf('if (!canDiscardScript) return;');
    const handlerIndex = block.indexOf('onDiscardScript()');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(handlerIndex).toBeGreaterThan(guardIndex);
    expect(block).toContain("(event.key === 'Enter' || event.key === ' ') && !canDiscardScript");
  });

  it('declares rotoScript and onDiscardScript props and renders Discard inside the toolbar', () => {
    const propsInterface = getScriptsPanelPropsInterface(panel);
    expect(propsInterface).toContain('rotoScript: RotoScriptClipboardController');
    expect(propsInterface).toContain('onDiscardScript: () => void');
    const toolbarStart = panel.indexOf('physics-paint-scripts-toolbar');
    const toolbarEnd = panel.indexOf('physics-paint-scripts-list', toolbarStart);
    const toolbar = panel.slice(toolbarStart, toolbarEnd);
    expect(toolbar).toContain('aria-label="Discard Script"');
    expect(toolbar.indexOf('aria-label="Discard Script"')).toBeGreaterThan(toolbar.indexOf('label="Refresh Scripts"'));
  });

  it('removes onDiscardRotoScript from the strip and Studio workflow props while scripts props invoke discardScript', () => {
    expect(strip).not.toContain('onDiscardRotoScript');
    expect(studio).not.toContain('onDiscardRotoScript');
    expect(studio).toContain('onDiscardScript: () => { rotoScript.discardScript(); setLastError(null); }');
  });
});
