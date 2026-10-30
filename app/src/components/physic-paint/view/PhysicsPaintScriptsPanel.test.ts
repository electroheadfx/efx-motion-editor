import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Node-environment component harness: preact/hooks is mocked with a cursor-based runtime
// so the panel function can be invoked directly and its vnode tree inspected. No DOM is involved.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  refs: new Map<number, { current: unknown }>(),
  cursor: 0,
  idCursor: 0,
  reset() {
    this.values = [];
    this.refs = new Map();
    this.cursor = 0;
    this.idCursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useRef: <Value>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useEffect: () => {},
  useLayoutEffect: () => {},
  useId: () => `mock-id-${hooks.idCursor++}`,
  useState: <Value>(initial: Value | (() => Value)) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? (initial as () => Value)() : initial;
    return [hooks.values[index] as Value, (next: Value | ((current: Value) => Value)) => {
      hooks.values[index] = typeof next === 'function'
        ? (next as (current: Value) => Value)(hooks.values[index] as Value)
        : next;
    }] as const;
  },
}));

import { PhysicsPaintScriptsPanel } from './PhysicsPaintScriptsPanel';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';

const panel = readFileSync(fileURLToPath(new URL('./PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const playScriptDialog = readFileSync(fileURLToPath(new URL('./PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');
const studioView = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const rightPanel = readFileSync(fileURLToPath(new URL('./PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
const controller = readFileSync(fileURLToPath(new URL('../roto/physicsPaintRotoScriptLibrary.ts', import.meta.url)), 'utf8');
const studio = readFileSync(fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const strip = readFileSync(fileURLToPath(new URL('./PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');

function getScriptsToolbarBlock(code: string): string {
  const toolbarStart = code.indexOf('physics-paint-scripts-toolbar');
  const toolbarEnd = code.indexOf('physics-paint-scripts-list', toolbarStart);
  return code.slice(toolbarStart, toolbarEnd === -1 ? code.length : toolbarEnd);
}

function getIconButtonBlock(code: string, label: string): string {
  const labelIndex = code.indexOf(`label="${label}"`);
  if (labelIndex === -1) return '';
  const start = code.lastIndexOf('<IconButton', labelIndex);
  if (start === -1) return '';
  const end = code.indexOf('</IconButton>', labelIndex) + '</IconButton>'.length;
  return code.slice(start, end);
}

function getIconButtonHelperBlock(code: string): string {
  const start = code.indexOf('function IconButton(');
  if (start === -1) return '';
  const end = code.indexOf('function formatFrameRange', start);
  return code.slice(start, end === -1 ? code.length : end);
}

function expectInOrder(source: string, tokens: readonly string[]) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    expect(next, `Expected ${token} after source offset ${cursor}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe('Physics Paint SCRIPTS panel contract', () => {
  it('keeps the lower Scripts/Onion/Motion tab group, adds the tool pane\'s Paint/Track/Audio tabs (47 UAT), and exposes scans on Scripts entry', () => {
    for (const tab of ['Scripts', 'Onion', 'Motion']) expect(rightPanel).toMatch(new RegExp(`>\\s*${tab}\\s*<`));
    // 36.15-12, UAT Gap H-1/H-2: the Brush color single-tab header strip is
    // removed — that section renders its content directly. 47 UAT: the tool
    // pane gained its own tab group ('Paint' / 'Track'; 261008-ryq adds
    // 'Audio'), so the lower group keeps its three tabs and LOG stays gone.
    expect(rightPanel).not.toMatch(/>\s*Brush color\s*</);
    expect(rightPanel).not.toMatch(/>\s*Tool\s*</);
    // 49-06 (UAT round 2) + 261008-ryq: the tool pane's Paint/Track/Audio tabs
    // plus the conditional Background option tab (shown only while a Bg clip
    // is selected) — 7 role=tab buttons in the source.
    // Source scan: 1 (top-pane map) + 4 (tool pane) + 3 (lower pane) = 8.
    // The top-pane map renders 4 tabs at runtime from one source line.
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(8);
    expect(rightPanel.match(/role="tablist"/g)).toHaveLength(3);
    expect(rightPanel).toContain("setOptionsTab('scripts'); void scripts.library.enterScripts()");
    expect(rightPanel).toContain("optionsTab === 'scripts'");
  });

  it('renders Actions as the FIRST tab of its group while preserving the default-open scripts state key', () => {
    const scriptsIndex = rightPanel.indexOf('physics-paint-tab-scripts');
    const onionIndex = rightPanel.indexOf('physics-paint-tab-onion');
    const motionIndex = rightPanel.indexOf('physics-paint-tab-motion');
    expect(scriptsIndex).toBeGreaterThanOrEqual(0);
    expect(onionIndex).toBeGreaterThan(scriptsIndex);
    expect(motionIndex).toBeGreaterThan(onionIndex);
    expect(rightPanel).toMatch(/useState<[^>]*'scripts'[^>]*>\('scripts'\)/);
  });

  it('removes the LOG tab and the Save state / Load state buttons (36.15-11, UAT Gap G-6)', () => {
    expect(rightPanel).not.toContain('physics-paint-tab-log');
    expect(rightPanel).not.toContain('physics-paint-log-messages');
    expect(rightPanel).not.toContain("primaryTab === 'log'");
    expect(rightPanel).not.toContain('Save state');
    expect(rightPanel).not.toContain('Load state');
    expect(rightPanel).not.toContain('getPhysicsPaintSessionControlState');
  });

  it('keeps ordered accessible controls while swapping Play to contextual Loop Edit', () => {
    // 261022-o2a: four labeled actions — Delete and Copy left the toolbar.
    const labels = ['Save Script', 'Load + Apply to Frame', 'Create Rail…', 'Refresh Scripts'];
    for (const label of labels) expect(panel).toContain(`label="${label}"`);
    expect(panel.indexOf('label="Save Script"')).toBeLessThan(panel.indexOf('label="Load + Apply to Frame"'));
    expect(panel).toContain('if (selectedLoopClip)');
    expect(panel).toContain('aria-label={`Selected Rail — ${selectedLoopClip.displayName}`}');
    expect(panel).toContain('<dt>Source Script</dt>');
    expect(panel).toContain('<dt>Rail Type</dt>');
    expect(panel.indexOf('label="Load + Apply to Frame"')).toBeLessThan(panel.indexOf('label="Create Rail…"'));
    expect(panel.indexOf('label="Create Rail…"')).toBeLessThan(panel.indexOf('label="Refresh Scripts"'));
    expect(panel).not.toContain('label="Delete Script"');
    expect(panel).not.toContain('aria-label="Copy Script"');
    expect(panel).toContain('label={`Edit Rail — ${selectedLoopClip.displayName}`}');
    expect(panel).toContain('label="Create Rail…"');
    expect(panel).not.toContain('label="Rename Script"');
    expect(panel).toContain('aria-label={props.label}');
    expect(panel).toContain('PhysicsPaintStyledTooltip visible={tooltip.visible}');
    expect(controller).toContain("saveDisabledReason: !projectSaved.value ? 'Save the project first.'");
    expect(panel).toContain('availability.saveDisabledReason');
    expect(panel).toContain("playScript.disabledReason.value ?? 'Create a Motion or Static Rail from the selected Script'");
    expect(panel).not.toContain('Import Script');
    expect(panel).toContain('aria-label="Project Scripts"');
    expect(panel).toContain('aria-label="Saved Roto Scripts"');
    expect(panel).toContain('No project Scripts yet.');
    expect(panel).toContain('Save the current real Roto frame as a Script to create a Rail.');
  });

  it('provides an accessible Create Rail… dialog distinct from cached Roto playback', () => {
    expect(studioView).toContain('<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />');
    expect(playScriptDialog).toContain('role="dialog"');
    expect(playScriptDialog).not.toContain('aria-modal="true"');
    expect(playScriptDialog).toContain('aria-labelledby="physics-play-script-title"');
    expect(playScriptDialog).toContain('Max {playScript.capacity.value}');
    expect(playScriptDialog).toContain('id="physics-play-script-max"');
    expect(playScriptDialog).toContain('Enter a positive integer.');
    expect(playScriptDialog).toContain("if (event.key === 'Escape')");
    expect(playScriptDialog).toContain("if (!regenerateImpact && event.key === 'Enter' && !playScript.canCancel.value)");
    expect(playScriptDialog).not.toContain("event.key !== 'Tab'");
    expect(playScriptDialog).toContain('inputRef.current?.focus()');
    expect(playScriptDialog).toContain('returnFocusRef.current?.focus()');
    expect(panel).not.toContain('toggleRotoPlayback');
  });

  it('provides load-only focusable rows, inline rename isolation, and focus-contained deletion', () => {
    expect(panel).toContain('role="listbox"');
    expect(panel).toContain('role="option"');
    expect(panel).toContain('tabIndex={0}');
    expect(panel).toContain('aria-selected={library.selectedId.value === row.id}');
    expect(panel).toContain('if (confirmationBusy) return;');
    expect(panel).toContain('onActivateRow(row.id);');
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
    // 261022-o2a: the confirmation returns focus to the row trash that opened
    // it, then falls back to the nearest surviving row / toolbar control.
    expect(panel).toContain('deleteTriggerId.current = id');
    expect(panel).toContain('[data-script-delete]');
    expect(panel).toContain('const triggerId = deleteTriggerId.current;');
    expect(panel).not.toContain('deleteButtonRef');
    expect(panel).not.toContain('aria-live="polite"');
  });

  it('locks deterministic compact CSS without claiming pixel layout proof', () => {
    expect(css).toMatch(/\.physics-paint-options-tabs[\s\S]*?white-space:\s*nowrap/);
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(4,\s*auto\)/);
    expect(css).toMatch(/\.physics-paint-scripts-panel[\s\S]*?min-width:\s*0/);
    // 260905-epb: the list no longer owns vertical scrolling — it fills its own
    // SidebarScrollArea (min-height: 100%, padding-right: 6px) and keeps only
    // overflow-x: hidden; the new scroll-area rule pins width: 100%.
    const listRuleStart = css.indexOf('.physics-paint-scripts-list {');
    expect(listRuleStart).toBeGreaterThanOrEqual(0);
    const listRuleEnd = css.indexOf('}', listRuleStart);
    const listRule = css.slice(listRuleStart, listRuleEnd === -1 ? css.length : listRuleEnd + 1);
    expect(listRule).toMatch(/overflow-x:\s*hidden/);
    expect(listRule).toMatch(/min-height:\s*100%/);
    expect(listRule).toMatch(/padding-right:\s*6px/);
    expect(listRule).not.toMatch(/overflow-y:\s*auto/);
    const scrollAreaRuleStart = css.indexOf('.physics-paint-scripts-list-scroll-area {');
    expect(scrollAreaRuleStart).toBeGreaterThanOrEqual(0);
    const scrollAreaRuleEnd = css.indexOf('}', scrollAreaRuleStart);
    const scrollAreaRule = css.slice(scrollAreaRuleStart, scrollAreaRuleEnd === -1 ? css.length : scrollAreaRuleEnd + 1);
    expect(scrollAreaRule).toMatch(/width:\s*100%/);
    expect(css).toMatch(/\.physics-paint-script-thumbnail[\s\S]*?(?:width|height):\s*48px/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    // The 860px breakpoint exists (topbar scroll fallback — 56-ui-04).
    expect(css).toMatch(/@media[\s\S]*?max-width:\s*860px/);
  });
});

describe('Physics Paint Scripts panel Clear Script Buffer relocation contract (260905-dso)', () => {
  it('removes the Clear Script Buffer control from the panel toolbar', () => {
    expect(panel).not.toContain('ClipboardX');
    expect(panel).not.toContain('aria-label="Clear Script Buffer"');
    expect(panel).not.toContain('Clear Script from buffer');
    expect(panel).not.toContain('onDiscardScript');
  });

  it('moves the discard handler to the Studio as a stable useCallback wired into the workflow memo', () => {
    expect(studio).not.toContain('onDiscardScript: () => { rotoScript.discardScript(); setLastError(null); }');
    expect(studio).toContain('const handleDiscardScript = useCallback(() => {');
    expect(studio).toContain('rotoScript.discardScript();');
    expect(studio).toContain('setLastError(null);');
    expect(studio).toContain('onDiscardScript: handleDiscardScript,');
  });
});

describe('Physics Paint Scripts panel per-row trash contract (261022-o2a)', () => {
  const trashRow = {
    id: 'action-1',
    name: 'Walk Cycle',
    revision: 'revision-1',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Paint', sourceFrame: 0, displayFrame: 1, width: 1000, height: 650, background: { background: 'transparent', grainStrength: 0 } },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 },
    brushCount: 2,
    integrity: '0'.repeat(64),
  };

  it('removes the Delete Script and Copy Script toolbar controls while keeping Copy reachable in the Tools popover', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    expect(toolbar).not.toContain('label="Delete Script"');
    expect(toolbar).not.toContain('aria-label="Copy Script"');
    expect(panel).not.toContain('<Clipboard');
    expect(panel).not.toContain('ClipboardPen');
    expect(panel).not.toContain('ClipboardX');
    expect(panel).not.toContain('deleteButtonRef');
    // Copy survives as a Living Script action in the Tools popover.
    expect(strip).toContain('aria-label="Copy Script"');
    expect(strip).toContain('aria-label="Apply Script to Frame"');
    expect(strip).toContain('aria-label="Clear Script Buffer"');
  });

  it('renders one labelled trash per row, gated only by the mutation lock and not by availability.canDelete', () => {
    const library = createFakeLibrary({
      rows: [trashRow, { ...trashRow, id: 'action-2', name: 'Run' }],
      // A row trash works on an UNSELECTED row, so availability.canDelete
      // (which requires an existing selection) must not disable it.
      canDelete: false,
    });
    const tree = renderPanel(createFakePlayScript(), library);
    const trash = findAll(tree, (vnode) => vnode.props?.['data-script-delete'] !== undefined);
    expect(trash).toHaveLength(2);
    expect(trash.map((vnode) => vnode.props['aria-label'])).toEqual(['Delete Walk Cycle', 'Delete Run']);
    for (const button of trash) {
      expect(button.type).toBe('button');
      expect(button.props.class).toBe('physics-paint-script-row-delete');
      expect(button.props.disabled).toBe(false);
    }

    const busyLibrary = createFakeLibrary({
      rows: [trashRow],
      actionMutationDisabledReason: 'Finish the current Script operation.',
    });
    const busyTree = renderPanel(createFakePlayScript(), busyLibrary);
    const busyTrash = findOne(busyTree, (vnode) => vnode.props?.['data-script-delete'] !== undefined);
    expect(busyTrash.props.disabled).toBe(true);
    expect(String(busyTrash.props.title)).toContain('Finish the current Script operation.');
  });

  it('selects the row then requests the shared confirmation — never a direct delete', () => {
    const library = createFakeLibrary({ rows: [trashRow] });
    const tree = renderPanel(createFakePlayScript(), library);
    const trash = findOne(tree, (vnode) => vnode.props?.['data-script-delete'] !== undefined);

    const stopPropagation = vi.fn();
    (trash.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(library.select).toHaveBeenCalledWith('action-1');
    expect(library.requestDelete).toHaveBeenCalledTimes(1);
    const selectCall = (library.select as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    const requestCall = (library.requestDelete as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    expect(selectCall).toBeLessThan(requestCall);
    expect(library.confirmDelete).not.toHaveBeenCalled();

    // Keydown stops the row's own activation and owns the press.
    const keydownStop = vi.fn();
    const preventDefault = vi.fn();
    (trash.props.onKeyDown as (event: { key: string; stopPropagation: () => void; preventDefault: () => void }) => void)({ key: 'Enter', stopPropagation: keydownStop, preventDefault });
    expect(keydownStop).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(library.select).toHaveBeenCalledTimes(2);
    expect(library.requestDelete).toHaveBeenCalledTimes(2);

    // The row helper carries no confirm/remove path of its own.
    const helperStart = panel.indexOf('const requestRowDelete = (id: string) => {');
    const helperEnd = panel.indexOf('};', helperStart);
    const helper = panel.slice(helperStart, helperEnd);
    expect(helper).toContain('if (confirmationBusy) return;');
    expect(helper).toContain('deleteTriggerId.current = id;');
    expect(helper).toContain('library.select(id);');
    expect(helper).toContain('library.requestDelete();');
    expect(helper).not.toContain('confirmDelete');
    expect(panel).toContain('data-script-delete');
    expect(panel).toContain('disabled={actionMutationDisabledReason !== null}');
    // The trash button itself must not read availability.canDelete; the
    // comment above it may explain why, so scope the assertion to the element.
    const deleteStart = panel.lastIndexOf('<button', panel.indexOf('data-script-delete'));
    const deleteEnd = panel.indexOf('</button>', deleteStart);
    const deleteBlock = panel.slice(deleteStart, deleteEnd);
    expect(deleteBlock).not.toContain('availability.canDelete');
    expect(panel).not.toContain('onCopyScript');
  });

  it('lays the four toolbar buttons out on one row and keeps the guarded disable visual', () => {
    // Scope to the toolbar div only — the Linked Rails nav section (with its
    // own guarded Edit Rail wrapper) sits between the toolbar and the list.
    const toolbarStart = panel.indexOf('physics-paint-scripts-toolbar');
    const toolbarDivEnd = panel.indexOf('</div>', toolbarStart);
    const toolbar = panel.slice(toolbarStart, toolbarDivEnd);
    expect(toolbar).not.toContain('physics-paint-roto-key-icon-action');
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(4,\s*auto\)/);
    expect(css).toContain('.physics-paint-scripts-toolbar .physics-paint-roto-key-icon-action');
    const ruleStart = css.indexOf('.physics-paint-script-icon-button[aria-disabled="true"]');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toContain('background: #2a3036');
    expect(rule).toContain('color: #7d8791');
    expect(rule).toContain('cursor: default');
  });

  it('pins the three-column row grid and the hover/focus-within trash reveal', () => {
    const rowStart = css.indexOf('.physics-paint-script-row {');
    expect(rowStart).toBeGreaterThanOrEqual(0);
    const rowEnd = css.indexOf('}', rowStart);
    const row = css.slice(rowStart, rowEnd === -1 ? css.length : rowEnd + 1);
    // 261022-o2a: thumbnail | copy | per-row trash.
    expect(row).toMatch(/grid-template-columns:\s*48px\s+minmax\(0,\s*1fr\)\s+auto/);

    const deleteStart = css.indexOf('.physics-paint-script-row-delete {');
    expect(deleteStart).toBeGreaterThanOrEqual(0);
    const deleteEnd = css.indexOf('}', deleteStart);
    const deleteRule = css.slice(deleteStart, deleteEnd === -1 ? css.length : deleteEnd + 1);
    expect(deleteRule).toMatch(/width:\s*22px/);
    expect(deleteRule).toMatch(/height:\s*22px/);
    expect(deleteRule).toMatch(/opacity:\s*0(?:\.0)?;/);
    expect(deleteRule).toMatch(/pointer-events:\s*none/);
    // The trash must stay focusable so :focus-within can reveal it after a
    // delete round-trip — never display: none.
    expect(deleteRule).not.toContain('display: none');

    for (const selector of [
      '.physics-paint-script-row:hover .physics-paint-script-row-delete,',
      '.physics-paint-script-row:focus-within .physics-paint-script-row-delete {',
    ]) {
      const revealStart = css.indexOf(selector);
      expect(revealStart, selector).toBeGreaterThanOrEqual(0);
      const revealEnd = css.indexOf('}', revealStart);
      const reveal = css.slice(revealStart, revealEnd === -1 ? css.length : revealEnd + 1);
      expect(reveal).toMatch(/opacity:\s*1/);
      expect(reveal).toMatch(/pointer-events:\s*auto/);
    }

    const focusStart = css.indexOf('.physics-paint-script-row-delete:focus-visible {');
    expect(focusStart).toBeGreaterThanOrEqual(0);
    const focusEnd = css.indexOf('}', focusStart);
    const focusRule = css.slice(focusStart, focusEnd === -1 ? css.length : focusEnd + 1);
    expect(focusRule).toContain('outline');
    expect(focusRule).toMatch(/opacity:\s*1/);
    expect(focusRule).toMatch(/pointer-events:\s*auto/);

    const disabledStart = css.indexOf('.physics-paint-script-row-delete:disabled,');
    expect(disabledStart).toBeGreaterThanOrEqual(0);
    const disabledEnd = css.indexOf('}', disabledStart);
    const disabledRule = css.slice(disabledStart, disabledEnd === -1 ? css.length : disabledEnd + 1);
    expect(disabledRule).toContain('cursor: default');
    expect(disabledRule).toMatch(/opacity:\s*0?\.5/);
  });
});

describe('Physics Paint Scripts panel label contract (36.15-09, UAT Gap E-1; 261022-o2a toolbar)', () => {
  it('labels only Apply and Create Rail; Save and Refresh stay icon-only', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    const expectations = [
      ['Load + Apply to Frame', '<Paintbrush size={16}', 'Apply'],
      ['Create Rail…', '<Play size={16}', 'Create Rail'],
    ] as const;
    for (const [label, icon, visible] of expectations) {
      const block = getIconButtonBlock(toolbar, label);
      expect(block, `IconButton block for ${label}`).not.toBe('');
      const iconIndex = block.indexOf(icon);
      expect(iconIndex, `${label} icon`).toBeGreaterThanOrEqual(0);
      const labelIndex = block.indexOf(`<span class="physics-paint-roto-key-icon-label">${visible}</span>`);
      expect(labelIndex, `${label} visible label`).toBeGreaterThan(iconIndex);
    }
    for (const iconOnly of ['Save Script', 'Refresh Scripts']) {
      expect(getIconButtonBlock(toolbar, iconOnly)).not.toContain('physics-paint-roto-key-icon-label');
    }
  });

  it('lays the labeled toolbar buttons out with an icon-label gap and side padding', () => {
    const ruleStart = css.indexOf('.physics-paint-scripts-toolbar .physics-paint-script-icon-button {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toMatch(/gap:\s*[1-9]\d*px/);
    expect(rule).toMatch(/padding:\s*0\s+[1-9]\d*px/);
  });
});

describe('Physics Paint Scripts panel Gap F toolbar label contract (36.15-10, UAT Gap F-1; 261022-o2a four-label toolbar)', () => {
  it('renders the toolbar labels lowercase by opting the script icon buttons out of the global uppercase button rule', () => {
    // The global `button { text-transform: uppercase }` rule rendered the
    // labels as CAPS; the script icon buttons opt out.
    // Anchored at a line start so compound selectors (e.g. the toolbar
    // width rule) do not match first.
    const ruleStart = css.indexOf('\n.physics-paint-script-icon-button {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toContain('text-transform: none');
    // 261022-o2a UAT: two labels; Save and Refresh are icon-only.
    const toolbar = getScriptsToolbarBlock(panel);
    for (const visible of ['Apply', 'Create Rail']) {
      expect(toolbar).toContain(`<span class="physics-paint-roto-key-icon-label">${visible}</span>`);
    }
    for (const gone of ['Save', 'Load + Apply', 'Refresh', 'Copy']) {
      expect(toolbar).not.toContain(`<span class="physics-paint-roto-key-icon-label">${gone}</span>`);
    }
  });

  it('keeps every toolbar icon at size 16 by preventing flex shrink in the grid cells', () => {
    // The labeled toolbar buttons overflow their cells, so an icon shrank below
    // 16px ("ridiculous small"). flex: 0 0 auto keeps the icon at full size.
    const ruleStart = css.indexOf('.physics-paint-scripts-toolbar .physics-paint-script-icon-button svg {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toMatch(/flex:\s*0\s+0\s+auto|flex-shrink:\s*0/);
    const toolbar = getScriptsToolbarBlock(panel);
    for (const icon of ['<Save size={16}', '<Paintbrush size={16}', '<Play size={16}', '<RefreshCw size={16}']) {
      expect(toolbar).toContain(icon);
    }
    expect(toolbar).not.toContain('<Clipboard size={16}');
    expect(toolbar).not.toContain('<Trash2 size={16}');
  });
});

describe('Physics Paint Scripts panel Gap G toolbar contract (36.15-11, UAT Gap G-1/G-5; 261022-o2a four-label toolbar)', () => {
  it('sizes the toolbar cells to content so every label renders in full (no truncation)', () => {
    // Content-sized columns replace the fixed-fraction cells that ellipsized
    // the second-row labels down to 'C…' (UAT Gap G-1). 261022-o2a shrinks the
    // grid to the four surviving actions.
    const toolbarRuleStart = css.indexOf('.physics-paint-scripts-toolbar {');
    expect(toolbarRuleStart).toBeGreaterThanOrEqual(0);
    const toolbarRuleEnd = css.indexOf('}', toolbarRuleStart);
    const toolbarRule = css.slice(toolbarRuleStart, toolbarRuleEnd === -1 ? css.length : toolbarRuleEnd + 1);
    expect(toolbarRule).toContain('grid-template-columns: repeat(4, auto)');
    expect(toolbarRule).not.toContain('minmax(');
    // The label rule keeps every full short label visible.
    const labelRuleStart = css.indexOf('.physics-paint-scripts-toolbar .physics-paint-script-icon-button .physics-paint-roto-key-icon-label {');
    expect(labelRuleStart).toBeGreaterThanOrEqual(0);
    const labelRuleEnd = css.indexOf('}', labelRuleStart);
    const labelRule = css.slice(labelRuleStart, labelRuleEnd === -1 ? css.length : labelRuleEnd + 1);
    expect(labelRule).toContain('white-space: nowrap');
    expect(labelRule).not.toContain('text-overflow: ellipsis');
    expect(labelRule).not.toContain('overflow: hidden');
    // Buttons no longer stretch to fill fixed-fraction cells.
    expect(css).not.toContain('.physics-paint-script-icon-button { width: 100% }');
    const toolbar = getScriptsToolbarBlock(panel);
    for (const visible of ['Apply', 'Create Rail']) {
      expect(toolbar).toContain(`<span class="physics-paint-roto-key-icon-label">${visible}</span>`);
    }
    for (const gone of ['Save', 'Load + Apply', 'Refresh', 'Copy']) {
      expect(toolbar).not.toContain(`<span class="physics-paint-roto-key-icon-label">${gone}</span>`);
    }
  });

  it('keeps the toolbar on one row with the row gap serving as breathing room (UAT Gap G-5)', () => {
    const ruleStart = css.indexOf('.physics-paint-scripts-toolbar {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toMatch(/grid-template-columns:\s*repeat\(4,\s*auto\)/);
    expect(rule).toMatch(/row-gap:\s*([4-9]|\d{2,})px/);
  });
});

describe('Physics Paint Scripts panel guarded toolbar contract (260905-f3v)', () => {
  // 261022-o2a: Delete left the toolbar for a per-row trash; Copy moved to the
  // Tools Living Script row. Four guarded actions remain.
  const toolbarButtonLabels = ['Save Script', 'Load + Apply to Frame', 'Create Rail…', 'Refresh Scripts'];

  it('routes every toolbar button through the guarded IconButton idiom with no native title', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    for (const label of toolbarButtonLabels) {
      const block = getIconButtonBlock(toolbar, label);
      expect(block, `IconButton block for ${label}`).not.toBe('');
      expect(block).toContain('disabledReason=');
    }
    // The shared helper renders the guarded button element: aria-disabled,
    // aria-describedby when a reason is present, the styled tooltip, and NO
    // native title attribute on the button element.
    const helper = getIconButtonHelperBlock(panel);
    expect(helper).toContain('aria-disabled={isDisabled ? \'true\' : undefined}');
    expect(helper).toContain('aria-describedby={isDisabled && reason ? props.descriptionId : undefined}');
    expect(helper).toContain('PhysicsPaintStyledTooltip');
    const buttonStart = helper.indexOf('<button');
    expect(buttonStart).toBeGreaterThanOrEqual(0);
    const buttonEnd = helper.indexOf('</button>', buttonStart) + '</button>'.length;
    const buttonElement = helper.slice(buttonStart, buttonEnd);
    expect(buttonElement).not.toContain('title=');
  });

  it('uses the de-prefixed tooltip grammar and restores focus to the row trash that opened the confirmation', () => {
    const helper = getIconButtonHelperBlock(panel);
    expect(helper).toContain('unavailable: ${reason}');
    expect(helper).not.toContain(' — unavailable: ');
    // 261022-o2a: the toolbar Delete button ref is gone; the trigger id is
    // recorded per row and resolved back to that row's trash with CSS.escape.
    expect(panel).not.toContain('deleteButtonRef');
    expect(panel).toContain('deleteTriggerId.current = id');
    expect(panel).toContain('`[data-action-id="${CSS.escape(triggerId)}"] [data-script-delete]`');
    // Fallback when the trigger row is gone: nearest surviving row, else the
    // first enabled toolbar control.
    expect(panel).toContain('rows.some((row) => row.id === triggerId)');
    expect(panel).toContain("[data-action-id]");
    expect(panel).toContain('physics-paint-scripts-toolbar');
  });

  it('keeps the four toolbar labels ordered with neither Delete nor Copy present', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    let cursor = -1;
    for (const label of toolbarButtonLabels) {
      const next = toolbar.indexOf(`label="${label}"`, cursor + 1);
      expect(next, `Expected ${label} after offset ${cursor}`).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(toolbar).not.toContain('label="Delete Script"');
    expect(toolbar).not.toContain('aria-label="Copy Script"');
  });

  it('wires descriptionId on every toolbar IconButton so sr-only disabled reasons are announced (260905-hfd)', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    for (const label of toolbarButtonLabels) {
      const block = getIconButtonBlock(toolbar, label);
      expect(block, `IconButton block for ${label}`).not.toBe('');
      expect(block).toContain('descriptionId=');
    }
  });
});

// ---------------------------------------------------------------------------
// 42-04 component harness: fake controllers exposing plain { value } cells in
// place of signals (the panel only ever reads .value); re-renders are manual.
// ---------------------------------------------------------------------------

interface TestVNode {
  type: unknown;
  props: Record<string, unknown>;
}

function sig<Value>(value: Value): { value: Value } {
  return { value };
}

interface FakeLibrarySeed {
  rows?: readonly Record<string, unknown>[];
  selectedId?: string | null;
  deleteConfirmation?: Record<string, unknown> | null;
  busy?: boolean;
  transactionPhase?: 'idle' | 'preparing' | 'committed' | 'recovery-required';
  recoveryReady?: boolean;
  status?: string | null;
  deleteError?: string | null;
  actionMutationDisabledReason?: string | null;
  // 261022-o2a: the per-row trash must ignore this (it gates selected-row ops),
  // so the tests need a way to seed it false deliberately.
  canDelete?: boolean;
  // quick-260922-al1: the scope state the panel now reads.
  scriptScope?: string;
  scriptLayers?: readonly { id: string; name: string }[];
}

function createFakeLibrary(seed: FakeLibrarySeed = {}): RotoScriptLibraryController {
  const rows = seed.rows ?? [];
  const selectedId = seed.selectedId ?? null;
  return {
    rows: sig(rows),
    scriptScope: sig(seed.scriptScope ?? 'all'),
    scriptLayers: sig(seed.scriptLayers ?? []),
    setScriptScope: vi.fn(),
    availability: sig({ saveDisabledReason: null, canSave: true, canRename: true, canDelete: seed.canDelete ?? true }),
    selected: sig(rows.find((row) => row.id === selectedId) ?? null),
    busy: sig(seed.busy ?? false),
    rename: sig(null),
    deleteConfirmation: sig(seed.deleteConfirmation ?? null),
    referencedDeleteImpact: sig(null),
    transactionPhase: sig(seed.transactionPhase ?? 'idle'),
    recoveryReady: sig(seed.recoveryReady ?? true),
    deleteError: sig(seed.deleteError ?? null),
    actionMutationDisabledReason: sig(seed.actionMutationDisabledReason ?? null),
    selectedId: sig(selectedId),
    status: sig(seed.status ?? null),
    skippedInvalidCount: sig(0),
    select: vi.fn(),
    beginRename: vi.fn(),
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(async () => true),
    updateRenameDraft: vi.fn(),
    commitRename: vi.fn(async () => true),
    cancelRename: vi.fn(),
  } as unknown as RotoScriptLibraryController;
}

function createFakeRotoScript(): RotoScriptClipboardController {
  return {
    availability: sig({
      replacementApplyDisabledReason: null,
      canCopy: true,
      canApply: true,
      canDiscard: true,
      copyDisabledReason: null,
      applyDisabledReason: null,
      discardDisabledReason: null,
    }),
  } as unknown as RotoScriptClipboardController;
}

interface FakePlayScriptSeed {
  disabledReason?: string | null;
}

function createFakePlayScript(seed: FakePlayScriptSeed = {}) {
  return {
    disabledReason: sig(seed.disabledReason ?? null),
    openConfirmation: vi.fn(async () => {}),
  } as unknown as RotoPlayScriptController;
}

function renderPanel(
  playScript: RotoPlayScriptController,
  library: RotoScriptLibraryController = createFakeLibrary(),
  overrides: Record<string, unknown> = {},
): TestVNode {
  hooks.cursor = 0;
  hooks.idCursor = 0;
  return PhysicsPaintScriptsPanel({
    library,
    playScript,
    rotoScript: createFakeRotoScript(),
    playButtonRef: { current: null },
    onOpenLoopEdit: async () => undefined,
    onCloseLoopClip: () => {},
    onSave: () => {},
    onActivateRow: () => {},
    onLoadAndApply: () => {},
    onRefresh: () => {},
    ...overrides,
  }) as unknown as TestVNode;
}

function childrenOf(vnode: TestVNode): unknown[] {
  const children = vnode.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function* walk(node: unknown): Generator<TestVNode> {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (typeof node !== 'object') return;
  const vnode = node as TestVNode;
  yield vnode;
  for (const child of childrenOf(vnode)) yield* walk(child);
}

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props?.class ?? '').split(/\s+/).includes(name);
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node !== 'object') return '';
  return textOf((node as TestVNode).props?.children);
}

function buttonWithText(root: unknown, label: string): TestVNode {
  return findOne(root, (vnode) => vnode.type === 'button' && textOf(vnode) === label);
}

beforeEach(() => {
  hooks.reset();
});

describe('Physics Paint Actions deletion disclosure contract (43.2-13)', () => {
  const actionRow = {
    id: 'action-1',
    name: 'Walk Cycle',
    revision: 'revision-1',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Paint', sourceFrame: 0, displayFrame: 1, width: 1000, height: 650, background: { background: 'transparent', grainStrength: 0 } },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 },
    brushCount: 2,
    integrity: '0'.repeat(64),
  };

  it('keeps unreferenced deletion compact with exact Action copy', () => {
    const library = createFakeLibrary({ deleteConfirmation: { ...actionRow, referenceImpact: null } });
    const tree = renderPanel(createFakePlayScript(), library);
    const copy = textOf(tree);

    expect(copy).toContain('Delete “Walk Cycle”?');
    expect(copy).toContain('This removes the project Script file and cannot be undone.');
    expect(buttonWithText(tree, 'Cancel')).toBeTruthy();
    expect(buttonWithText(tree, 'Delete Script')).toBeTruthy();
    expect(copy).not.toContain('Keep Rails');
    expect(copy).not.toContain('Delete Script and Rails');
  });

  it('discloses exact one/many reference counts, visible ranges, ordered Rails, and consequences', () => {
    const library = createFakeLibrary({
      deleteConfirmation: {
        ...actionRow,
        referenceImpact: {
          groupCount: 2,
          visibleRangeCount: 3,
          affectedGroups: [
            { groupId: 'group-a', name: 'Walk Cycle Group', placementStart: 4, endExclusive: 12, visibleRanges: [{ start: 4, endExclusive: 8 }, { start: 10, endExclusive: 12 }] },
            { groupId: 'group-b', name: 'Walk Cycle Group', placementStart: 20, endExclusive: 24, visibleRanges: [{ start: 20, endExclusive: 24 }] },
          ],
        },
      },
    });
    const tree = renderPanel(createFakePlayScript(), library);
    const copy = textOf(tree);

    expect(copy).toContain('This Script is referenced by 2 Rails across 3 visible ranges.');
    expect(copy.indexOf('F4–F11')).toBeLessThan(copy.indexOf('F20–F23'));
    expect(copy).toContain('F4–F7, F10–F11');
    expect(copy).toContain('2 ranges');
    expect(copy).toContain('Recommended. Delete the Script but keep every Rail, fragment, key, timing value, cache, and rendered result. Rails become detached and timeline space stays occupied.');
    expect(copy).toContain('Delete the Script and all 2 referencing Rails, including uniquely owned source, cache, and Rail-gap data. Their occupied timeline ranges are freed.');
    expect(findAll(tree, (vnode) => vnode.type === 'button' && ['Keep Rails', 'Delete Script and Rails', 'Cancel'].includes(String(vnode.props['aria-label']))).map((vnode) => vnode.props['aria-label'])).toEqual([
      'Keep Rails',
      'Delete Script and Rails',
      'Cancel',
    ]);
  });

  it('routes only closed controller choices and keeps long content in the approved scrollable family', async () => {
    const library = createFakeLibrary({
      deleteConfirmation: {
        ...actionRow,
        name: 'An exceptionally long Action name that must remain fully readable in the confirmation',
        referenceImpact: {
          groupCount: 1,
          visibleRangeCount: 1,
          affectedGroups: [{ groupId: 'group-a', name: 'An exceptionally long Action name that must remain fully readable in the confirmation Group', placementStart: 2, endExclusive: 30, visibleRanges: [{ start: 2, endExclusive: 30 }] }],
        },
      },
    });
    const tree = renderPanel(createFakePlayScript(), library);
    const keep = findOne(tree, (vnode) => vnode.props['aria-label'] === 'Keep Rails');
    const cascade = findOne(tree, (vnode) => vnode.props['aria-label'] === 'Delete Script and Rails');

    await (keep.props.onClick as () => Promise<void>)();
    await (cascade.props.onClick as () => Promise<void>)();
    expect(library.confirmDelete).toHaveBeenNthCalledWith(1, 'keep-groups');
    expect(library.confirmDelete).toHaveBeenNthCalledWith(2, 'delete-action-and-groups');
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-action-delete-groups'))).toHaveLength(1);
    expect(css).toMatch(/\.physics-paint-script-confirmation[\s\S]*?max-height:\s*calc\(100% - 52px\)[\s\S]*?overflow(?:-y)?:\s*auto/);
    expect(css).toMatch(/\.physics-paint-action-delete-choice[\s\S]*?white-space:\s*normal/);
  });
});

describe('Physics Paint Actions deletion lifecycle contract (43.2-13)', () => {
  const actionRow = {
    id: 'action-1', name: 'Walk Cycle', revision: 'revision-1', createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Paint', sourceFrame: 0, displayFrame: 1, width: 1000, height: 650, background: { background: 'transparent', grainStrength: 0 } },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 }, brushCount: 2, integrity: '0'.repeat(64),
  };
  const referenceImpact = {
    physicalRevision: 'physical-revision-1', groupCount: 1, visibleRangeCount: 1,
    affectedGroups: [{ groupId: 'group-a', name: 'Walk Cycle Group', placementStart: 2, endExclusive: 8, visibleRanges: [{ start: 2, endExclusive: 8 }] }],
  };

  it.each([
    ['preparing', 'Finish the current Script operation.'],
    ['committed', 'Finish the current Script operation.'],
    ['recovery-required', 'Recover the pending Script change before starting another operation.'],
  ] as const)('retains accepted rows and one dialog while %s disables the complete mutation surface', (transactionPhase, disabledReason) => {
    const library = createFakeLibrary({
      rows: [actionRow], selectedId: actionRow.id, deleteConfirmation: { ...actionRow, referenceImpact },
      busy: transactionPhase !== 'recovery-required', transactionPhase, recoveryReady: transactionPhase !== 'recovery-required',
      actionMutationDisabledReason: disabledReason,
    });
    const tree = renderPanel(createFakePlayScript(), library);

    expect(findAll(tree, (vnode) => vnode.props.role === 'option')).toHaveLength(1);
    expect(findAll(tree, (vnode) => vnode.props.role === 'dialog')).toHaveLength(1);
    for (const label of ['Save Script', 'Load + Apply to Frame', 'Create Rail…', 'Refresh Scripts']) {
      expect(findOne(tree, (vnode) => vnode.props.label === label).props.disabled).toBe(true);
    }
    for (const label of ['Keep Rails', 'Delete Script and Rails']) {
      expect(findOne(tree, (vnode) => vnode.props['aria-label'] === label).props['aria-disabled']).toBe('true');
    }
    // 261022-o2a: the per-row trash is part of the mutation surface too.
    expect(findOne(tree, (vnode) => vnode.props?.['data-script-delete'] !== undefined).props.disabled).toBe(true);
  });

  it('shows only controller-mapped recovery or stale copy and never raw diagnostics', () => {
    const mapped = 'Script or Rail references changed. Nothing changed. Review the affected Rails and try again.';
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary({
      rows: [actionRow], selectedId: actionRow.id, deleteConfirmation: { ...actionRow, referenceImpact },
      deleteError: mapped,
      status: 'token=123e4567 path=/Users/private/cache revision=secret-diagnostic',
    }));
    const copy = textOf(tree);

    expect(copy).toContain(mapped);
    expect(copy).not.toContain('123e4567');
    expect(copy).not.toContain('/Users/private/cache');
    expect(findAll(tree, (vnode) => vnode.props.role === 'alert')).toHaveLength(1);
  });

  it('keeps Escape cancellation and focus containment idle-only while restoring surviving or nearest Action focus', () => {
    expect(panel).toContain('requestAnimationFrame');
    expect(panel).toContain('cancelAnimationFrame');
    expect(panel).toContain('data-action-id={row.id}');
    expect(panel).toContain('[data-action-id]');
    expect(panel).toContain('physics-paint-scripts-toolbar');
    expect(panel).toContain('if (confirmationBusy) return;');
    expect(panel).toContain('previousConfirmation.current = confirmation');
    expect(panel).not.toContain('deleteButtonRef.current?.focus();\n    previousConfirmation.current = Boolean(confirmation)');
  });
});

describe('Physics Paint Actions inspector linked Group navigation (43.2-15)', () => {
  const selectedGroup = {
    loopId: 'group-b',
    displayName: 'Walk Group',
    sourceLabel: 'Walk Script',
    placementLabel: 'F12–F19',
    cycleLabel: 'Cycle 4f × 2 = 8f',
    effectiveLabel: '8 frames',
    mode: 'progressive',
    modeLabel: 'Motion',
    groupTypeLabel: 'Motion Group',
    lifecycle: 'synchronized',
    statusLabel: 'Synchronized with Script.',
    synchronizationDot: 'synchronized',
    regenerateDisabledReason: 'Already synchronized with Script.',
    fragmentLabel: null,
    linkedDescription: null,
    tooltipLines: [],
    accessibleName: 'Walk Group. Motion Group. Synchronized with Script.',
  } as const;

  it('hides linked navigation when the selected Action has no linked Rails', () => {
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      selectedLoopClip: selectedGroup,
      linkedGroupNavigation: null,
    });
    expect(textOf(tree)).not.toContain('Linked Rails');
    expect(findAll(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Go to Rail')).toHaveLength(0);
  });

  it('shows one current link with a single Go to Rail action', () => {
    const onGoToGroup = vi.fn();
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      selectedLoopClip: selectedGroup,
      linkedGroupNavigation: { currentIndex: 0, total: 1, onPrevious: vi.fn(), onNext: vi.fn(), onGoToGroup },
    });
    expect(textOf(tree)).toContain('Linked Rails — 1 of 1');
    const go = findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Go to Rail');
    (go.props.onClick as () => void)();
    expect(onGoToGroup).toHaveBeenCalledTimes(1);
    expect(findAll(tree, (vnode) => textOf(vnode) === 'Previous' || textOf(vnode) === 'Next')).toHaveLength(0);
  });

  it('shows non-wrapping Previous and Next controls guarded at their ends', () => {
    const onNext = vi.fn();
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      selectedLoopClip: selectedGroup,
      linkedGroupNavigation: { currentIndex: 0, total: 3, onPrevious: vi.fn(), onNext, onGoToGroup: vi.fn() },
    });
    expect(textOf(tree)).toContain('Linked Rails — 1 of 3');
    // The nav buttons route through the guarded IconButton helper (a function
    // component the harness does not expand), so the vnode exposes the guarded
    // `disabled` prop; the source-code assertions above verify the rendered
    // button uses aria-disabled instead of native disabled.
    const previous = findOne(tree, (vnode) => vnode.props?.label === 'Previous Rail');
    const next = findOne(tree, (vnode) => vnode.props?.label === 'Next Rail');
    expect(previous.props.disabled).toBe(true);
    expect(next.props.disabled).toBe(false);
    (next.props.onClick as () => void)();
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('uses guarded IconButton Previous/Next with Chevron icons and boundary reasons in both renderings', () => {
    const inspectorStart = panel.indexOf('physics-paint-loop-clip-panel');
    expect(inspectorStart).toBeGreaterThanOrEqual(0);
    const inspectorEnd = panel.indexOf('aria-label="Project Scripts"');
    const inspector = panel.slice(inspectorStart, inspectorEnd);
    const list = panel.slice(inspectorEnd);
    for (const section of [inspector, list]) {
      expect(section).toContain('<IconButton label="Previous Rail"');
      expect(section).toContain('<IconButton label="Next Rail"');
      expect(section).toContain('ChevronLeft size={16}');
      expect(section).toContain('ChevronRight size={16}');
    }
    expect(panel).toContain("disabledReason={linkedGroupNavigation.currentIndex === 0 ? 'Already on the first linked Rail' : undefined}");
    expect(panel).toContain("disabledReason={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1 ? 'Already on the last linked Rail' : undefined}");
    // No native disabled= on the nav buttons — they route through IconButton,
    // whose rendered button element uses aria-disabled instead.
    const helper = getIconButtonHelperBlock(panel);
    const buttonStart = helper.indexOf('<button');
    expect(buttonStart).toBeGreaterThanOrEqual(0);
    const buttonEnd = helper.indexOf('</button>', buttonStart) + '</button>'.length;
    const buttonElement = helper.slice(buttonStart, buttonEnd);
    expect(buttonElement.replace(/aria-disabled/g, '')).not.toContain('disabled=');
  });

  it('no longer derives cursorOnCurrentLinkedRail or wires onEditCurrent through the Studio memo (260905-hfd)', () => {
    expect(studio).not.toContain('cursorOnCurrentLinkedRail');
    expect(studio).not.toContain('handleEditCurrentLinkedGroup');
    expect(studio).not.toContain('cursorOnCurrentRail');
    expect(studio).not.toContain('onEditCurrent');
  });

  it('renders only Edit Rail and Close in the inspector top row when linked navigation is null', () => {
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      selectedLoopClip: selectedGroup,
      linkedGroupNavigation: null,
    });
    expect(findOne(tree, (vnode) => vnode.props?.label === `Edit Rail — ${selectedGroup.displayName}`)).toBeTruthy();
    expect(findOne(tree, (vnode) => vnode.props?.label === `Close Rail inspector — ${selectedGroup.displayName}`)).toBeTruthy();
    expect(findAll(tree, (vnode) => vnode.props?.label === 'Previous Rail')).toHaveLength(0);
    expect(findAll(tree, (vnode) => vnode.props?.label === 'Next Rail')).toHaveLength(0);
  });
});

// 261030-ig0 (D-02/D-03): the selected-rail inspector's per-key entry point. The
// Edit Keys control renders ONLY for an opted-in rail with a wired handler
// (never a dead control), and the compact key list is derived from the inspected
// rail on every render — a selection change never shows a stale key set.
describe('Physics Paint Scripts panel per-key script editing affordance (261030-ig0)', () => {
  const selectedRail = {
    loopId: 'rail-a',
    displayName: 'Walk Rail',
    sourceLabel: 'Walk Script',
    placementLabel: 'F10',
    cycleLabel: 'Cycle 3f × 1 = 3f',
    effectiveLabel: '3 frames',
    mode: 'progressive',
    modeLabel: 'Motion',
    groupTypeLabel: 'Motion Rail',
    lifecycle: 'synchronized',
    statusLabel: 'Synchronized with Script.',
    synchronizationDot: 'synchronized',
    regenerateDisabledReason: 'Already synchronized with Script.',
    fragmentLabel: null,
    linkedDescription: null,
    tooltipLines: [],
    accessibleName: 'Walk Rail. Motion Rail. Synchronized with Script.',
    keyScriptEdits: true,
    sourceKeyCount: 3,
    editedKeySlots: [1] as readonly number[],
  };

  it('renders no Edit Keys control for a rail that never opted in', () => {
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      selectedLoopClip: { ...selectedRail, keyScriptEdits: false },
      onOpenRailKeyEdit: vi.fn(async () => undefined),
    });
    expect(findAll(tree, (vnode) => vnode.props?.label === 'Edit Keys — Walk Rail')).toHaveLength(0);
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-key-edit-list'))).toHaveLength(0);
  });

  it('renders no Edit Keys control without the handler — never a dead control', () => {
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), { selectedLoopClip: selectedRail });
    expect(findAll(tree, (vnode) => vnode.props?.label === 'Edit Keys — Walk Rail')).toHaveLength(0);
  });

  it('opens one row per source key, marks the edited slots, and routes each row to the key-edit handler', () => {
    const onOpenRailKeyEdit = vi.fn(async () => undefined);
    const props = { selectedLoopClip: selectedRail, onOpenRailKeyEdit };
    const closed = renderPanel(createFakePlayScript(), createFakeLibrary(), props);
    expect(findAll(closed, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-key-edit-list'))).toHaveLength(0);

    const control = findOne(closed, (vnode) => vnode.props?.label === 'Edit Keys — Walk Rail');
    (control.props.onClick as () => void)();

    const opened = renderPanel(createFakePlayScript(), createFakeLibrary(), props);
    expect(findAll(opened, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-key-edit-list'))).toHaveLength(1);
    expect(textOf(opened)).toContain('Keys — 3');
    const rows = findAll(opened, (vnode) => vnode.type === 'button' && hasClass(vnode, 'physics-paint-loop-clip-key-edit-button'));
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => textOf(row))).toEqual(['Key 1', 'Key 2Edited', 'Key 3']);
    (rows[1]!.props.onClick as () => void)();
    expect(onOpenRailKeyEdit).toHaveBeenCalledWith('rail-a', 1);
  });

  it('derives the open list from the inspected rail every render — no stale key set', () => {
    const props = { selectedLoopClip: selectedRail, onOpenRailKeyEdit: vi.fn(async () => undefined) };
    const closed = renderPanel(createFakePlayScript(), createFakeLibrary(), props);
    (findOne(closed, (vnode) => vnode.props?.label === 'Edit Keys — Walk Rail').props.onClick as () => void)();

    const nextRail = {
      ...selectedRail,
      loopId: 'rail-b',
      displayName: 'Turn Rail',
      sourceKeyCount: 2,
      editedKeySlots: [] as readonly number[],
    };
    const opened = renderPanel(createFakePlayScript(), createFakeLibrary(), { ...props, selectedLoopClip: nextRail });
    expect(textOf(opened)).toContain('Keys — 2');
    const rows = findAll(opened, (vnode) => vnode.type === 'button' && hasClass(vnode, 'physics-paint-loop-clip-key-edit-button'));
    expect(rows.map((row) => textOf(row))).toEqual(['Key 1', 'Key 2']);
  });

  it('pins the source wiring and the key-list styling tokens', () => {
    expect(panel).toContain('onOpenRailKeyEdit(selectedLoopClip.loopId, slot)');
    expect(panel).toContain('KeyRound size={16}');
    expect(panel).toContain('selectedLoopClip.keyScriptEdits && onOpenRailKeyEdit');
    // A signal in a ref (CLAUDE.md: no useState; useSignal would add a hook the
    // manual-hook harness cannot stub).
    expect(panel).toContain('useRef(signal(false))');
    expect(css).toContain('.physics-paint-loop-clip-key-edit-list');
    expect(css).toContain('.physics-paint-loop-clip-key-edit-edited');
  });
});

describe('Physics Paint Scripts panel compact sidebar contract', () => {
  it('keeps generated settings and operation status out of the script library surface', () => {
    const tree = renderPanel(createFakePlayScript());
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-scripts-summary'))).toHaveLength(0);
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-scripts-status'))).toHaveLength(0);
    expect(panel).not.toContain('playScript.appliedSummary');
    expect(panel).not.toContain('playScript.status.value');
    expect(css).not.toContain('.physics-paint-scripts-summary');
    expect(css).not.toContain('.physics-paint-scripts-status');

    const topLevel = childrenOf(tree).filter(
      (child): child is TestVNode => typeof child === 'object' && child !== null && !Array.isArray(child),
    );
    // 260905-epb: the toolbar stays pinned as the first direct child; the list
    // now lives inside its own SidebarScrollArea, which is the next direct child.
    const toolbarIndex = topLevel.findIndex((vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'));
    const scrollAreaIndex = topLevel.findIndex((vnode) => hasClass(vnode, 'physics-paint-scripts-list-scroll-area'));
    expect(toolbarIndex).toBeGreaterThanOrEqual(0);
    expect(scrollAreaIndex).toBe(toolbarIndex + 1);
  });

  it('keeps the Create Rail… tooltip fallback covering both modes', () => {
    const tree = renderPanel(createFakePlayScript());
    const playButton = findOne(tree, (vnode) => vnode.props?.label === 'Create Rail…');
    expect(playButton.props.title).toBe('Create Rail… — Create a Motion or Static Rail from the selected Script');
    expect(String(playButton.props.title)).not.toContain('Progressive');
  });
});

describe('PhysicsPaintScriptsPanel scroll hierarchy (260905-epb)', () => {
  it('keeps the toolbar and the scope/pager meta row pinned above the scripts list scroll area in the normal view', () => {
    const normalViewStart = panel.indexOf('aria-label="Project Scripts"');
    expect(normalViewStart).toBeGreaterThanOrEqual(0);
    const normalView = panel.slice(normalViewStart);
    const scrollAreaOpen = normalView.indexOf('<SidebarScrollArea class="physics-paint-scripts-list-scroll-area"');
    expect(scrollAreaOpen).toBeGreaterThanOrEqual(0);
    expectInOrder(normalView.slice(0, scrollAreaOpen), ['physics-paint-scripts-toolbar', 'physics-paint-scripts-meta-row']);
  });

  it('wraps only the scripts list in the scroll area and keeps the confirmation dialog outside it', () => {
    const normalViewStart = panel.indexOf('aria-label="Project Scripts"');
    expect(normalViewStart).toBeGreaterThanOrEqual(0);
    const normalView = panel.slice(normalViewStart);
    const scrollAreaOpen = normalView.indexOf('<SidebarScrollArea class="physics-paint-scripts-list-scroll-area"');
    expect(scrollAreaOpen).toBeGreaterThanOrEqual(0);
    const scrollAreaClose = normalView.indexOf('</SidebarScrollArea>', scrollAreaOpen);
    expect(scrollAreaClose).toBeGreaterThan(scrollAreaOpen);
    const inside = normalView.slice(scrollAreaOpen, scrollAreaClose);
    expect(inside).toContain('physics-paint-scripts-list');
    const after = normalView.slice(scrollAreaClose);
    expect(after).toContain('physics-paint-script-confirmation');
  });

  it('wraps the inspector view content in a scroll area', () => {
    const inspectorStart = panel.indexOf('physics-paint-loop-clip-panel');
    expect(inspectorStart).toBeGreaterThanOrEqual(0);
    const inspectorEnd = panel.indexOf('aria-label="Project Scripts"');
    expect(inspectorEnd).toBeGreaterThan(inspectorStart);
    const inspector = panel.slice(inspectorStart, inspectorEnd);
    const scrollAreaOpen = inspector.indexOf('<SidebarScrollArea class="physics-paint-scripts-list-scroll-area"');
    expect(scrollAreaOpen).toBeGreaterThanOrEqual(0);
    const scrollAreaClose = inspector.indexOf('</SidebarScrollArea>', scrollAreaOpen);
    expect(scrollAreaClose).toBeGreaterThan(scrollAreaOpen);
    const inside = inspector.slice(scrollAreaOpen, scrollAreaClose);
    expect(inside).toContain('physics-paint-loop-clip-inspector');
    expect(inside).toContain('physics-paint-loop-clip-linked-navigation');
    expect(inside).not.toContain('physics-paint-loop-clip-inspector-actions');
    // 260905-hfd: the top action row is pinned chrome — it sits BEFORE the
    // SidebarScrollArea open tag, outside the scroll area.
    const topRowStart = inspector.indexOf('physics-paint-loop-clip-inspector-top-actions');
    expect(topRowStart).toBeGreaterThanOrEqual(0);
    expect(topRowStart).toBeLessThan(scrollAreaOpen);
  });

  it('compacts the list-view Linked Rails nav into the scope meta row as a pager (260922-jss)', () => {
    const listStart = panel.indexOf('aria-label="Project Scripts"');
    expect(listStart).toBeGreaterThanOrEqual(0);
    const list = panel.slice(listStart);
    const navStart = list.indexOf('physics-paint-scripts-meta-row');
    expect(navStart).toBeGreaterThanOrEqual(0);
    const navEnd = list.indexOf('physics-paint-scripts-list', navStart);
    const nav = list.slice(navStart, navEnd === -1 ? list.length : navEnd);
    // 260922-jss: one row carries the scope filter AND the pager. The old
    // "Linked Rails — n of N" line and the total === 1 / total > 1 markup split
    // are gone — one shape serves every total, the arrows disabling at the ends.
    expect(nav).toContain('physics-paint-scripts-scope');
    expect(nav).toContain('physics-paint-scripts-pager');
    expect(nav).toContain('{linkedGroupNavigation.currentIndex + 1}/{linkedGroupNavigation.total}');
    expect(nav).not.toContain('Linked Rails —');
    expect(nav.match(/<IconButton label="Previous Rail"/g)).toHaveLength(1);
    expect(nav.match(/<IconButton label="Next Rail"/g)).toHaveLength(1);
    expect(nav).not.toContain('physics-paint-roto-key-icon-label');
    expect(nav).not.toContain('Edit Rail');
    expect(nav).not.toContain('physics-paint-loop-clip-inspector-actions');
    // The go action dropped from the 30px inspector scale to the 24px pager
    // scale and reads "Go"; its accessible name stays descriptive because the
    // visible word no longer says where it goes.
    expect(nav).toContain('class="physics-paint-scripts-pager-go"');
    expect(nav).toContain('aria-label="Go to the linked Rail" onClick={linkedGroupNavigation.onGoToGroup}>Go</button>');
    // The inspector keeps its own 30px "Go to Rail" action for total === 1 —
    // asserted on the inspector slice, because the previous whole-file form of
    // this pin was silently matching the LIST view's single-line button (the
    // inspector's is multi-line) and would have gone on passing after the list
    // action was replaced by the pager.
    const inspectorStart = panel.indexOf('physics-paint-loop-clip-panel');
    const inspectorEnd = panel.indexOf('aria-label="Project Scripts"');
    expect(inspectorStart).toBeGreaterThanOrEqual(0);
    expect(inspectorEnd).toBeGreaterThan(inspectorStart);
    const inspector = panel.slice(inspectorStart, inspectorEnd);
    expect(inspector).toContain('physics-paint-loop-clip-inspector-action');
    expect(inspector).toContain('onClick={linkedGroupNavigation.onGoToGroup}');
    expect(inspector).toContain('Go to Rail');
  });

  it('serves every Rail total with one pager shape and routes the Go action (260922-jss)', () => {
    const onGoToGroup = vi.fn();
    // No selectedLoopClip, so the inspector's early `return` does not fire and
    // this tree IS the list view. The two renderings are mutually exclusive,
    // which is why the same exactly-one-match predicate the inspector legs use
    // holds here as well. No scriptLayers either, so the scope half is absent
    // and this also pins that the pager survives without the select beside it.
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      linkedGroupNavigation: { currentIndex: 0, total: 1, onPrevious: vi.fn(), onNext: vi.fn(), onGoToGroup },
    });
    expect(textOf(tree)).toContain('1/1');
    expect(textOf(tree)).not.toContain('Linked Rails');
    // 1/1 is the case the old markup special-cased; the pager just disables both
    // arrows instead, so the row never changes shape.
    expect(findOne(tree, (vnode) => vnode.props?.label === 'Previous Rail').props.disabled).toBe(true);
    expect(findOne(tree, (vnode) => vnode.props?.label === 'Next Rail').props.disabled).toBe(true);
    const go = findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Go');
    (go.props.onClick as () => void)();
    expect(onGoToGroup).toHaveBeenCalledTimes(1);
  });

  it('renders a single 4-button top action row above the inspector scroll area (260905-hfd)', () => {
    const inspectorStart = panel.indexOf('physics-paint-loop-clip-panel');
    expect(inspectorStart).toBeGreaterThanOrEqual(0);
    const inspectorEnd = panel.indexOf('aria-label="Project Scripts"');
    expect(inspectorEnd).toBeGreaterThan(inspectorStart);
    const inspector = panel.slice(inspectorStart, inspectorEnd);
    const topRowStart = inspector.indexOf('physics-paint-loop-clip-inspector-top-actions');
    expect(topRowStart).toBeGreaterThanOrEqual(0);
    const scrollAreaOpen = inspector.indexOf('<SidebarScrollArea class="physics-paint-scripts-list-scroll-area"');
    expect(scrollAreaOpen).toBeGreaterThan(topRowStart);
    const topRow = inspector.slice(topRowStart, scrollAreaOpen);
    expectInOrder(topRow, [
      'label={`Edit Rail — ${selectedLoopClip.displayName}`}',
      'label="Previous Rail"',
      'label="Next Rail"',
      'label={`Close Rail inspector — ${selectedLoopClip.displayName}`}',
    ]);
    expect(topRow).toContain('linkedGroupNavigation && linkedGroupNavigation.total > 1');
    expect(topRow).toContain('descriptionId={previousRailReasonId}');
    expect(topRow).toContain('descriptionId={nextRailReasonId}');
    // 260905-hfd (UAT): Edit/Previous/Next keep visible labels; Close stays icon-only.
    expect(topRow).toContain('<span class="physics-paint-roto-key-icon-label">Edit Rail</span>');
    expect(topRow).toContain('<span class="physics-paint-roto-key-icon-label">Previous Rail</span>');
    expect(topRow).toContain('<span class="physics-paint-roto-key-icon-label">Next Rail</span>');
    expect(topRow).toContain('className="physics-paint-loop-clip-nav-compact-button primary labeled"');
    expect(topRow).toContain('className="physics-paint-loop-clip-nav-compact-button labeled"');
    expect(topRow).not.toContain('Close Rail inspector — ${selectedLoopClip.displayName}"><X size={16} aria-hidden="true" /><span');
    // The old bottom actions row and the nav buttons container are gone.
    expect(inspector).not.toContain('physics-paint-loop-clip-inspector-actions');
    expect(inspector).not.toContain('<span>Edit Rail</span>');
    expect(inspector).not.toContain('<span>Close</span>');
    // The labeled modifier lets the top-row buttons grow to fit text while the
    // list-view chevrons and Close stay 24px icon-only.
    const labeledStart = css.indexOf('.physics-paint-loop-clip-nav-compact-button.labeled {');
    expect(labeledStart).toBeGreaterThanOrEqual(0);
    const labeledEnd = css.indexOf('}', labeledStart);
    const labeledRule = css.slice(labeledStart, labeledEnd === -1 ? css.length : labeledEnd + 1);
    expect(labeledRule).toContain('width: auto');
    expect(labeledRule).toContain('padding: 0 8px');
    expect(labeledRule).toContain('gap: 4px');
  });
});

describe('Physics Paint Scripts panel readable rows contract (260905-f3v)', () => {
  it('renders script rows readable by default with a distinct selected state', () => {
    const rowRuleStart = css.indexOf('.physics-paint-script-row {');
    expect(rowRuleStart).toBeGreaterThanOrEqual(0);
    const rowRuleEnd = css.indexOf('}', rowRuleStart);
    const rowRule = css.slice(rowRuleStart, rowRuleEnd === -1 ? css.length : rowRuleEnd + 1);
    expect(rowRule).toContain('background: transparent');
    expect(rowRule).not.toContain('#3b3d3f');
    expect(rowRule).toContain('color: #eef1f4');

    const subRuleStart = css.indexOf('.physics-paint-script-provenance, .physics-paint-script-count, .physics-paint-scripts-empty');
    expect(subRuleStart).toBeGreaterThanOrEqual(0);
    const subRuleEnd = css.indexOf('}', subRuleStart);
    const subRule = css.slice(subRuleStart, subRuleEnd === -1 ? css.length : subRuleEnd + 1);
    expect(subRule).toContain('color: #eef1f4');

    const selectedRuleStart = css.indexOf('.physics-paint-script-row.selected {');
    expect(selectedRuleStart).toBeGreaterThanOrEqual(0);
    const selectedRuleEnd = css.indexOf('}', selectedRuleStart);
    const selectedRule = css.slice(selectedRuleStart, selectedRuleEnd === -1 ? css.length : selectedRuleEnd + 1);
    expect(selectedRule).toContain('border-color: #7e9cff');

    expect(css).toContain('.physics-paint-script-row:hover');
    expect(css).toContain('.physics-paint-script-row:focus-visible');
  });

  it('neutralizes the disabled script-title grey-out with a scoped override (260905-hfd)', () => {
    const overrideStart = css.indexOf('.physics-paint-script-name:disabled {');
    expect(overrideStart).toBeGreaterThanOrEqual(0);
    const overrideEnd = css.indexOf('}', overrideStart);
    const override = css.slice(overrideStart, overrideEnd === -1 ? css.length : overrideEnd + 1);
    expect(override).toContain('color: inherit');
    expect(override).toContain('opacity: 1');
    expect(override).toContain('background: transparent');
    expect(override).toContain('cursor: default');

    // The global button:disabled rule must be untouched so the override is provably scoped.
    const globalStart = css.indexOf('button:disabled,');
    expect(globalStart).toBeGreaterThanOrEqual(0);
    const globalEnd = css.indexOf('}', globalStart);
    const globalRule = css.slice(globalStart, globalEnd === -1 ? css.length : globalEnd + 1);
    expect(globalRule).toContain('opacity: 0.5');
    expect(globalRule).toContain('color: #6b7280');
  });
});

/**
 * quick-260922-al1: the layer-scope selector. It narrows ONLY the rendered
 * list — selection, the clipboard and the apply destination are all outside its
 * reach — and it lives in its own full-width row so the toolbar's 6-column icon
 * grid is untouched (pinned above).
 */
describe('Physics Paint Actions layer scope (quick-260922-al1)', () => {
  const scopeRow = (id: string, layerId: string, layerName: string) => ({
    id,
    name: `Action ${id}`,
    revision: `revision-${id}`,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    source: { projectName: 'Project', layerId, layerName, sourceFrame: 0, displayFrame: 1, width: 1000, height: 650, background: { background: 'transparent', grainStrength: 0 } },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 },
    brushCount: 2,
    integrity: '0'.repeat(64),
  });
  const LAYERS = [{ id: 'layer-1', name: 'Character' }, { id: 'layer-2', name: 'Hair' }];

  const scopeSelect = (tree: TestVNode) => findOne(tree, (vnode) => vnode.type === 'select');

  it('renders a native labelled select between the toolbar and the list, with All plus one entry per owning layer', () => {
    const library = createFakeLibrary({ rows: [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair')], scriptLayers: LAYERS });
    const tree = renderPanel(createFakePlayScript(), library);

    const select = scopeSelect(tree);
    expect(String(select.props['aria-label'] ?? select.props.id)).toBeTruthy();
    const options = findAll(select, (vnode) => vnode.type === 'option').map((option) => [option.props.value, textOf(option)]);
    expect(options).toEqual([['all', 'All'], ['layer-1', 'Character'], ['layer-2', 'Hair']]);
    expect(textOf(tree)).toContain('Scope');
    // Shares the meta row with the pager, outside the toolbar's icon grid.
    expect(hasClass(findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-scripts-scope')), 'physics-paint-scripts-scope')).toBe(true);
    expect(hasClass(findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-scripts-meta-row')), 'physics-paint-scripts-meta-row')).toBe(true);
  });

  it('renders no selector when no layer owns an Action (a one-option select would be dead UI)', () => {
    const library = createFakeLibrary({ rows: [scopeRow('a', 'layer-1', 'Ink')], scriptLayers: [] });
    const tree = renderPanel(createFakePlayScript(), library);
    expect(findAll(tree, (vnode) => vnode.type === 'select')).toHaveLength(0);
  });

  it('changing it calls ONLY library.setScriptScope(value) — no select, no refresh', () => {
    const library = createFakeLibrary({ rows: [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair')], scriptLayers: LAYERS });
    const tree = renderPanel(createFakePlayScript(), library);

    (scopeSelect(tree).props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: 'layer-2' } });

    expect(library.setScriptScope).toHaveBeenCalledTimes(1);
    expect(library.setScriptScope).toHaveBeenCalledWith('layer-2');
    expect(library.select).not.toHaveBeenCalled();
    expect(library.beginRename).not.toHaveBeenCalled();
    expect(library.requestDelete).not.toHaveBeenCalled();
  });

  it('renders the FILTERED projection while selection state is read from the unfiltered rows', () => {
    const library = createFakeLibrary({
      rows: [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair')],
      scriptLayers: LAYERS,
      scriptScope: 'layer-2',
      selectedId: 'a',
    });
    const tree = renderPanel(createFakePlayScript(), library);

    const rendered = findAll(tree, (vnode) => vnode.props?.['data-action-id'] !== undefined).map((vnode) => vnode.props['data-action-id']);
    expect(rendered).toEqual(['b']);
    // The hidden, still-selected row keeps its selection in the controller: the
    // filter is presentation-only, so nothing here may clear it.
    expect(library.selectedId.value).toBe('a');
    expect(findAll(tree, (vnode) => vnode.props?.['aria-selected'] === true)).toHaveLength(0);
  });

  it('renders the LIVE layer name in provenance, and marks an orphan unavailable', () => {
    const library = createFakeLibrary({
      rows: [scopeRow('a', 'layer-1', 'Ink'), scopeRow('ghost', 'layer-gone', 'Ghost')],
      scriptLayers: LAYERS,
    });
    const tree = renderPanel(createFakePlayScript(), library);
    const copy = textOf(tree);

    // The renamed live layer wins over the snapshotted name.
    expect(copy).toContain('Project · Character · F1');
    expect(copy).not.toContain('Project · Ink · F1');
    // The orphan keeps its snapshotted name and says so.
    expect(copy).toContain('Project · Ghost · F1');
    expect(copy).toContain('unavailable');
    expect(hasClass(findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-script-provenance-unavailable')), 'physics-paint-script-provenance-unavailable')).toBe(true);
  });

  it('keeps the two empty states distinct, and the scope-aware one offers the way back to All', () => {
    const empty = renderPanel(createFakePlayScript(), createFakeLibrary({ rows: [], scriptLayers: LAYERS }));
    expect(textOf(empty)).toContain('No project Scripts yet.');
    expect(findAll(empty, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Show all Scripts')).toHaveLength(0);

    const scoped = renderPanel(createFakePlayScript(), createFakeLibrary({ rows: [], scriptLayers: LAYERS, scriptScope: 'layer-1' }));
    expect(textOf(scoped)).toContain('No project Scripts yet.');
    expect(findAll(scoped, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Show all Scripts')).toHaveLength(0);
  });

  it('falls back to All when the scope names no renderable entry (code review WR-02)', () => {
    // The scoped layer owns the ONLY row, then that row is deleted: the entry
    // vanishes while the store still holds its id. The control must read All —
    // not a blank selectedIndex -1 — and the list must agree with it.
    const library = createFakeLibrary({ rows: [scopeRow('a', 'layer-1', 'Ink')], scriptLayers: LAYERS, scriptScope: 'layer-2' });
    const tree = renderPanel(createFakePlayScript(), library);

    expect(scopeSelect(tree).props.value).toBe('all');
    expect(findAll(tree, (vnode) => vnode.props?.['data-action-id'] !== undefined).map((vnode) => vnode.props['data-action-id'])).toEqual(['a']);
    // Falling back is presentation-only: the store keeps the artist's choice and
    // nothing writes it back from render.
    expect(library.setScriptScope).not.toHaveBeenCalled();
    expect(library.scriptScope.value).toBe('layer-2');
  });

  it('pins the scope row and marker CSS without disturbing the toolbar grid', () => {
    expect(css).toMatch(/\.physics-paint-scripts-scope[\s\S]*?display:\s*flex/);
    expect(css).toContain('.physics-paint-script-provenance-unavailable');
    expect(css).toContain('.physics-paint-scripts-empty-action');
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(4,\s*auto\)/);
  });
});
