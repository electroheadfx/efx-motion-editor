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

function getGuardedToolbarBlock(code: string, ariaLabel: string): string {
  const labelIndex = code.indexOf(`aria-label="${ariaLabel}"`);
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

function getScriptsToolbarBlock(code: string): string {
  const toolbarStart = code.indexOf('physics-paint-scripts-toolbar');
  const toolbarEnd = code.indexOf('physics-paint-scripts-list', toolbarStart);
  return code.slice(toolbarStart, toolbarEnd === -1 ? code.length : toolbarEnd);
}

describe('Physics Paint SCRIPTS panel contract', () => {
  it('keeps the lower Scripts/Onion/Motion tab group, adds the tool pane\'s Paint/Track option tabs (47 UAT), and exposes scans on Scripts entry', () => {
    for (const tab of ['Actions', 'Onion', 'Motion']) expect(rightPanel).toMatch(new RegExp(`>\\s*${tab}\\s*<`));
    // 36.15-12, UAT Gap H-1/H-2: the Brush color single-tab header strip is
    // removed — that section renders its content directly. 47 UAT: the tool
    // pane gained its own two-tab group ('Paint option' / 'Track option'),
    // so the lower group keeps its three tabs and the LOG tab stays gone.
    expect(rightPanel).not.toMatch(/>\s*Brush color\s*</);
    expect(rightPanel).not.toMatch(/>\s*Tool\s*</);
    // 49-06 (UAT round 2): the tool pane's Paint/Track tabs plus the
    // conditional Background option tab (shown only while a Bg clip is
    // selected) — 6 role=tab buttons in the source.
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(6);
    expect(rightPanel.match(/role="tablist"/g)).toHaveLength(2);
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
    const labels = ['Save Action', 'Load + Apply to Frame', 'Delete Action', 'Refresh Actions'];
    for (const label of labels) expect(panel).toContain(`label="${label}"`);
    expect(panel.indexOf('label="Save Action"')).toBeLessThan(panel.indexOf('label="Load + Apply to Frame"'));
    expect(panel).toContain('if (selectedLoopClip)');
    expect(panel).toContain('aria-label={`Selected Rail — ${selectedLoopClip.displayName}`}');
    expect(panel).toContain('<dt>Source Action</dt>');
    expect(panel).toContain('<dt>Rail Type</dt>');
    expect(panel.indexOf('label="Load + Apply to Frame"')).toBeLessThan(panel.indexOf('label="Create Rail…"'));
    expect(panel.indexOf('label="Create Rail…"')).toBeLessThan(panel.indexOf('label="Delete Action"'));
    expect(panel.indexOf('label="Delete Action"')).toBeLessThan(panel.indexOf('label="Refresh Actions"'));
    expect(panel).toContain('aria-label={`Edit Rail — ${selectedLoopClip.displayName}`}');
    expect(panel).toContain('label="Create Rail…"');
    expect(panel).not.toContain('label="Rename Script"');
    expect(panel).toContain('aria-label={props.label}');
    expect(panel).toContain('PhysicsPaintStyledTooltip visible={tooltip.visible}');
    expect(controller).toContain("saveDisabledReason: !projectSaved.value ? 'Save the project first.'");
    expect(panel).toContain('availability.saveDisabledReason');
    expect(panel).toContain("playScript.disabledReason.value ?? 'Create a Motion or Static Rail from the selected Action'");
    expect(panel).not.toContain('Import Script');
    expect(panel).toContain('aria-label="Project Actions"');
    expect(panel).toContain('aria-label="Saved Roto Actions"');
    expect(panel).toContain('No project Actions yet.');
    expect(panel).toContain('Save the current real Roto frame as an Action to create a Rail.');
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
    expect(panel).toContain('deleteButtonRef.current?.focus()');
    expect(panel).not.toContain('aria-live="polite"');
  });

  it('locks deterministic compact CSS without claiming pixel layout proof', () => {
    expect(css).toMatch(/\.physics-paint-options-tabs[\s\S]*?white-space:\s*nowrap/);
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*auto\)/);
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
    expect(css).toMatch(/@media[\s\S]*?max-width:\s*860px[\s\S]*?grid-template-columns:\s*1fr/);
  });
});

describe('Physics Paint Scripts panel Clear Action Buffer relocation contract (260905-dso)', () => {
  it('removes the Clear Action Buffer control from the panel toolbar', () => {
    expect(panel).not.toContain('ClipboardX');
    expect(panel).not.toContain('aria-label="Clear Action Buffer"');
    expect(panel).not.toContain('Clear Action from buffer');
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

describe('Physics Paint Scripts panel Copy toolbar contract (36.15-08, UAT Gap C; 260905-dso Copy-only)', () => {
  it('renders the guarded Copy Action control without native disabled or title', () => {
    expect(panel).toContain('Clipboard,');
    expect(panel).not.toContain('ClipboardPen');
    expect(panel).not.toContain('ClipboardX');
    const toolbar = getScriptsToolbarBlock(panel);
    const refreshIndex = toolbar.indexOf('label="Refresh Actions"');
    const copyIndex = toolbar.indexOf('aria-label="Copy Action"');
    expect(refreshIndex).toBeGreaterThanOrEqual(0);
    expect(copyIndex).toBeGreaterThan(refreshIndex);
    const block = getGuardedToolbarBlock(panel, 'Copy Action');
    expect(block).toContain('aria-disabled');
    expect(block).toContain('aria-describedby');
    expect(block.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(block).not.toContain('title=');
    expect(block).toContain('PhysicsPaintStyledTooltip');
  });

  it('reads availability from the rotoScript controller ports and guards activation before the handler', () => {
    expect(panel).toContain('rotoScript.availability.value.canCopy');
    expect(panel).toContain('copyDisabledReason');
    const copyBlock = getGuardedToolbarBlock(panel, 'Copy Action');
    const copyGuard = copyBlock.indexOf('if (!canCopyRotoScript) return;');
    expect(copyGuard).toBeGreaterThanOrEqual(0);
    expect(copyBlock.indexOf('onCopyScript()')).toBeGreaterThan(copyGuard);
    expect(copyBlock).toContain("(event.key === 'Enter' || event.key === ' ') && !canCopyRotoScript");
    // De-prefixed tooltip grammar (Gap D): description or 'unavailable: {reason}'.
    expect(copyBlock).toContain('unavailable: ${copyRotoScriptDisabledReason}');
    expect(copyBlock).not.toContain(' — unavailable: ');
  });

  it('declares only onCopyScript on the panel and wires the relocated Apply/Clear handlers to the workflow memo', () => {
    const propsInterface = getScriptsPanelPropsInterface(panel);
    expect(propsInterface).toContain('onCopyScript: () => void');
    expect(propsInterface).not.toContain('onApplyScript');
    expect(propsInterface).not.toContain('onDiscardScript');
    expect(studio).toContain('onCopyScript: () => { void rotoScript.copyScript()');
    expect(studio).toContain('const handleApplyScript = useCallback(() => {');
    expect(studio).toContain('const handleDiscardScript = useCallback(() => {');
    expect(studio).toContain('onApplyScript: handleApplyScript,');
    expect(studio).toContain('onDiscardScript: handleDiscardScript,');
    expect(studio).not.toContain('onCopyRotoScript');
    expect(studio).not.toContain('onApplyRotoScript');
    expect(strip).not.toContain('onCopyRotoScript');
    expect(strip).not.toContain('onApplyRotoScript');
    expect(strip).not.toContain('aria-label="Copy Action"');
    expect(strip).toContain('aria-label="Apply Action to Frame"');
    expect(strip).toContain('aria-label="Clear Action Buffer"');
  });

  it('lays the toolbar icons out as a proper second row styled like the first (no orphan icon)', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    const guardedCount = (toolbar.match(/physics-paint-roto-key-icon-action/g) ?? []).length;
    // One guarded clipboard action (Copy) forms the second row; the first-row
    // buttons get the same guarded idiom via the shared IconButton helper
    // (260905-dso).
    expect(guardedCount).toBe(1);
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*auto\)/);
    expect(css).toContain('.physics-paint-scripts-toolbar .physics-paint-roto-key-icon-action');
  });

  it('greys out the guarded toolbar buttons when unavailable (aria-disabled visual)', () => {
    const ruleStart = css.indexOf('.physics-paint-script-icon-button[aria-disabled="true"]');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toContain('background: #2a3036');
    expect(rule).toContain('color: #7d8791');
    expect(rule).toContain('cursor: default');
  });
});

describe('Physics Paint Scripts panel second-row label contract (36.15-09, UAT Gap E-1; 260905-dso Copy-only)', () => {
  it('renders a short visible label after the guarded second-row icon like the bottom action row', () => {
    const block = getGuardedToolbarBlock(panel, 'Copy Action');
    expect(block).not.toBe('');
    const iconIndex = block.indexOf('<Clipboard size={16}');
    expect(iconIndex).toBeGreaterThanOrEqual(0);
    const labelIndex = block.indexOf('<span class="physics-paint-roto-key-icon-label">Copy</span>');
    expect(labelIndex).toBeGreaterThan(iconIndex);
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

describe('Physics Paint Scripts panel Gap F second-row contract (36.15-10, UAT Gap F-1; 260905-dso Copy-only)', () => {
  it('renders the second-row label lowercase by opting the script icon buttons out of the global uppercase button rule', () => {
    // The global `button { text-transform: uppercase }` rule rendered the
    // Copy label as CAPS; the script icon buttons opt out.
    // Anchored at a line start so compound selectors (e.g. the toolbar
    // width rule) do not match first.
    const ruleStart = css.indexOf('\n.physics-paint-script-icon-button {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toContain('text-transform: none');
    // Source label stays a lowercase single word.
    expect(panel).toContain('<span class="physics-paint-roto-key-icon-label">Copy</span>');
    expect(panel).not.toContain('<span class="physics-paint-roto-key-icon-label">Apply</span>');
    expect(panel).not.toContain('<span class="physics-paint-roto-key-icon-label">Clear</span>');
  });

  it('keeps the second-row icons at the first-row size by preventing flex shrink in the grid cells', () => {
    // Both rows use size={16} Lucide icons; the labeled second-row button
    // overflows its narrow grid cell, so the icon shrank below 16px
    // ("ridiculous small"). flex: 0 0 auto keeps the icon at full size.
    const ruleStart = css.indexOf('.physics-paint-scripts-toolbar .physics-paint-script-icon-button svg {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toMatch(/flex:\s*0\s+0\s+auto|flex-shrink:\s*0/);
    const toolbar = getScriptsToolbarBlock(panel);
    expect(toolbar).toContain('<Clipboard size={16}');
    expect(toolbar).not.toContain('<ClipboardPen size={16}');
    expect(toolbar).not.toContain('<ClipboardX size={16}');
    // First-row icons stay size={16} too — true size parity.
    for (const icon of ['<Save size={16}', '<Paintbrush size={16}', '<Play size={16}']) {
      expect(toolbar).toContain(icon);
    }
  });
});

describe('Physics Paint Scripts panel Gap G toolbar contract (36.15-11, UAT Gap G-1/G-5; 260905-dso Copy-only)', () => {
  it('sizes the toolbar cells to content so the Copy label renders in full (no truncation)', () => {
    // Content-sized columns replace the fixed-fraction cells that ellipsized
    // the second-row labels down to 'C…' (UAT Gap G-1).
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*auto\)/);
    expect(css).not.toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    // The second-row label rule keeps the full short label visible.
    const labelRuleStart = css.indexOf('.physics-paint-scripts-toolbar .physics-paint-script-icon-button .physics-paint-roto-key-icon-label {');
    expect(labelRuleStart).toBeGreaterThanOrEqual(0);
    const labelRuleEnd = css.indexOf('}', labelRuleStart);
    const labelRule = css.slice(labelRuleStart, labelRuleEnd === -1 ? css.length : labelRuleEnd + 1);
    expect(labelRule).toContain('white-space: nowrap');
    expect(labelRule).not.toContain('text-overflow: ellipsis');
    expect(labelRule).not.toContain('overflow: hidden');
    // Buttons no longer stretch to fill fixed-fraction cells.
    expect(css).not.toContain('.physics-paint-script-icon-button { width: 100% }');
    // Source label stays the full short word.
    expect(panel).toContain('<span class="physics-paint-roto-key-icon-label">Copy</span>');
    expect(panel).not.toContain('<span class="physics-paint-roto-key-icon-label">Apply</span>');
    expect(panel).not.toContain('<span class="physics-paint-roto-key-icon-label">Clear</span>');
  });

  it('separates the two toolbar icon rows with a visible row gap (UAT Gap G-5)', () => {
    const ruleStart = css.indexOf('.physics-paint-scripts-toolbar {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toMatch(/row-gap:\s*([4-9]|\d{2,})px/);
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
}

function createFakeLibrary(seed: FakeLibrarySeed = {}): RotoScriptLibraryController {
  const rows = seed.rows ?? [];
  const selectedId = seed.selectedId ?? null;
  return {
    rows: sig(rows),
    availability: sig({ saveDisabledReason: null, canSave: true, canRename: true, canDelete: true }),
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
    onCopyScript: () => {},
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
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Paint', sourceFrame: 0, displayFrame: 1, width: 1000, height: 650, background: { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 } },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 },
    brushCount: 2,
    integrity: '0'.repeat(64),
  };

  it('keeps unreferenced deletion compact with exact Action copy', () => {
    const library = createFakeLibrary({ deleteConfirmation: { ...actionRow, referenceImpact: null } });
    const tree = renderPanel(createFakePlayScript(), library);
    const copy = textOf(tree);

    expect(copy).toContain('Delete “Walk Cycle”?');
    expect(copy).toContain('This removes the project Action file and cannot be undone.');
    expect(buttonWithText(tree, 'Cancel')).toBeTruthy();
    expect(buttonWithText(tree, 'Delete Action')).toBeTruthy();
    expect(copy).not.toContain('Keep Rails');
    expect(copy).not.toContain('Delete Action and Rails');
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

    expect(copy).toContain('This Action is referenced by 2 Rails across 3 visible ranges.');
    expect(copy.indexOf('F4–F11')).toBeLessThan(copy.indexOf('F20–F23'));
    expect(copy).toContain('F4–F7, F10–F11');
    expect(copy).toContain('2 ranges');
    expect(copy).toContain('Recommended. Delete the Action but keep every Rail, fragment, key, timing value, cache, and rendered result. Rails become detached and timeline space stays occupied.');
    expect(copy).toContain('Delete the Action and all 2 referencing Rails, including uniquely owned source, cache, and Rail-gap data. Their occupied timeline ranges are freed.');
    expect(findAll(tree, (vnode) => vnode.type === 'button' && ['Keep Rails', 'Delete Action and Rails', 'Cancel'].includes(String(vnode.props['aria-label']))).map((vnode) => vnode.props['aria-label'])).toEqual([
      'Keep Rails',
      'Delete Action and Rails',
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
    const cascade = findOne(tree, (vnode) => vnode.props['aria-label'] === 'Delete Action and Rails');

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
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Paint', sourceFrame: 0, displayFrame: 1, width: 1000, height: 650, background: { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 } },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 }, brushCount: 2, integrity: '0'.repeat(64),
  };
  const referenceImpact = {
    physicalRevision: 'physical-revision-1', groupCount: 1, visibleRangeCount: 1,
    affectedGroups: [{ groupId: 'group-a', name: 'Walk Cycle Group', placementStart: 2, endExclusive: 8, visibleRanges: [{ start: 2, endExclusive: 8 }] }],
  };

  it.each([
    ['preparing', 'Finish the current Action operation.'],
    ['committed', 'Finish the current Action operation.'],
    ['recovery-required', 'Recover the pending Action change before starting another operation.'],
  ] as const)('retains accepted rows and one dialog while %s disables the complete mutation surface', (transactionPhase, disabledReason) => {
    const library = createFakeLibrary({
      rows: [actionRow], selectedId: actionRow.id, deleteConfirmation: { ...actionRow, referenceImpact },
      busy: transactionPhase !== 'recovery-required', transactionPhase, recoveryReady: transactionPhase !== 'recovery-required',
      actionMutationDisabledReason: disabledReason,
    });
    const tree = renderPanel(createFakePlayScript(), library);

    expect(findAll(tree, (vnode) => vnode.props.role === 'option')).toHaveLength(1);
    expect(findAll(tree, (vnode) => vnode.props.role === 'dialog')).toHaveLength(1);
    for (const label of ['Save Action', 'Load + Apply to Frame', 'Create Rail…', 'Delete Action', 'Refresh Actions']) {
      expect(findOne(tree, (vnode) => vnode.props.label === label).props.disabled).toBe(true);
    }
    for (const label of ['Copy Action', 'Keep Rails', 'Delete Action and Rails']) {
      expect(findOne(tree, (vnode) => vnode.props['aria-label'] === label).props['aria-disabled']).toBe('true');
    }
  });

  it('shows only controller-mapped recovery or stale copy and never raw diagnostics', () => {
    const mapped = 'Action or Rail references changed. Nothing changed. Review the affected Rails and try again.';
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
    sourceLabel: 'Walk Action',
    placementLabel: 'F12–F19',
    cycleLabel: 'Cycle 4f × 2 = 8f',
    effectiveLabel: '8 frames',
    mode: 'progressive',
    modeLabel: 'Motion',
    groupTypeLabel: 'Motion Group',
    lifecycle: 'synchronized',
    statusLabel: 'Synchronized with Action.',
    synchronizationDot: 'synchronized',
    regenerateDisabledReason: 'Already synchronized with Action.',
    fragmentLabel: null,
    linkedDescription: null,
    tooltipLines: [],
    accessibleName: 'Walk Group. Motion Group. Synchronized with Action.',
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

  it('shows non-wrapping Previous and Next controls disabled at their ends', () => {
    const onNext = vi.fn();
    const tree = renderPanel(createFakePlayScript(), createFakeLibrary(), {
      selectedLoopClip: selectedGroup,
      linkedGroupNavigation: { currentIndex: 0, total: 3, onPrevious: vi.fn(), onNext, onGoToGroup: vi.fn() },
    });
    expect(textOf(tree)).toContain('Linked Rails — 1 of 3');
    const previous = findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Previous');
    const next = findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Next');
    expect(previous.props.disabled).toBe(true);
    expect(next.props.disabled).toBe(false);
    (next.props.onClick as () => void)();
    expect(onNext).toHaveBeenCalledTimes(1);
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
    expect(playButton.props.title).toBe('Create Rail… — Create a Motion or Static Rail from the selected Action');
    expect(String(playButton.props.title)).not.toContain('Progressive');
  });
});
