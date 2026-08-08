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
  it('keeps the lower Scripts/Onion/Motion tab group with no Brush color / Tool tab chrome and explicitly scans on Scripts entry', () => {
    for (const tab of ['Scripts', 'Onion', 'Motion']) expect(rightPanel).toMatch(new RegExp(`>\\s*${tab}\\s*<`));
    // 36.15-12, UAT Gap H-1/H-2: the Brush color and Tool single-tab header
    // strips are removed — those sections render their content directly. Only
    // the lower group keeps tabs; the LOG tab stays gone.
    expect(rightPanel).not.toMatch(/>\s*Brush color\s*</);
    expect(rightPanel).not.toMatch(/>\s*Tool\s*</);
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(3);
    expect(rightPanel.match(/role="tablist"/g)).toHaveLength(1);
    expect(rightPanel).toContain("setOptionsTab('scripts'); void scripts.library.enterScripts()");
    expect(rightPanel).toContain("optionsTab === 'scripts'");
  });

  it('renders Scripts as the FIRST tab of its group and the default-open tab (36.15-11, UAT Gap G-4)', () => {
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
    const labels = ['Save Script', 'Load and Apply Script', 'Delete Script', 'Refresh Scripts'];
    for (const label of labels) expect(panel).toContain(`label="${label}"`);
    expect(panel.indexOf('label="Save Script"')).toBeLessThan(panel.indexOf('label="Load and Apply Script"'));
    expect(panel).toContain('if (selectedLoopClip)');
    expect(panel.indexOf('label="Load and Apply Script"')).toBeLessThan(panel.indexOf('label="Play Script"'));
    expect(panel.indexOf('label="Play Script"')).toBeLessThan(panel.indexOf('label="Delete Script"'));
    expect(panel.indexOf('label="Delete Script"')).toBeLessThan(panel.indexOf('label="Refresh Scripts"'));
    expect(panel).toContain('aria-label={`Edit Loop Clip — ${selectedLoopClip.displayName}`}');
    expect(panel).toContain('label="Play Script"');
    expect(panel).not.toContain('label="Rename Script"');
    expect(panel).toContain('aria-label={props.label}');
    expect(panel).toContain('title={props.title}');
    expect(controller).toContain("saveDisabledReason: !projectSaved.value ? 'Save the project first.'");
    expect(panel).toContain('availability.saveDisabledReason');
    expect(panel).toContain("playScript.disabledReason.value ?? 'Generate real Roto keys (progressive or static/hold)'");
    expect(panel).not.toContain('Import Script');
  });

  it('provides an accessible Play Script dialog distinct from cached Roto playback', () => {
    expect(studioView).toContain('<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />');
    expect(playScriptDialog).toContain('role="dialog"');
    expect(playScriptDialog).not.toContain('aria-modal="true"');
    expect(playScriptDialog).toContain('aria-labelledby="physics-play-script-title"');
    expect(playScriptDialog).toContain('Max {playScript.capacity.value}');
    expect(playScriptDialog).toContain('Enter a positive integer or Max.');
    expect(playScriptDialog).toContain("if (event.key === 'Escape')");
    expect(playScriptDialog).toContain("if (event.key === 'Enter' && !playScript.validationError.value");
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
    expect(panel).not.toContain('aria-live="polite"');
  });

  it('locks deterministic compact CSS without claiming pixel layout proof', () => {
    expect(css).toMatch(/\.physics-paint-options-tabs[\s\S]*?white-space:\s*nowrap/);
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*auto\)/);
    expect(css).toMatch(/\.physics-paint-scripts-panel[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/\.physics-paint-scripts-list[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/);
    expect(css).toMatch(/\.physics-paint-script-thumbnail[\s\S]*?(?:width|height):\s*48px/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/@media[\s\S]*?max-width:\s*860px[\s\S]*?grid-template-columns:\s*1fr/);
  });
});

describe('Physics Paint Scripts panel Clear Script Buffer contract (36.15-07, renamed 36.15-08 Gap C)', () => {
  it('renders a guarded Clear Script Buffer clipboard-x control without native disabled or title', () => {
    expect(panel).toContain('ClipboardX');
    expect(panel).toContain('aria-label="Clear Script Buffer"');
    expect(panel).not.toContain('Discard Script');
    const block = getGuardedToolbarBlock(panel, 'Clear Script Buffer');
    expect(block).toContain('aria-disabled');
    expect(block.replace(/aria-disabled/g, '')).not.toContain('disabled=');
    expect(block).not.toContain('title=');
  });

  it('uses the user wording clear script from buffer with de-prefixed tooltip grammar and guards activation before the handler', () => {
    const block = getGuardedToolbarBlock(panel, 'Clear Script Buffer');
    expect(block).toContain('Clear script from buffer');
    expect(block).toContain('unavailable: ${clearScriptBufferDisabledReason}');
    expect(block).not.toContain(' — unavailable: ');
    expect(block).toContain('aria-describedby');
    expect(block).toContain('PhysicsPaintStyledTooltip');
    const guardIndex = block.indexOf('if (!canClearScriptBuffer) return;');
    const handlerIndex = block.indexOf('onDiscardScript()');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(handlerIndex).toBeGreaterThan(guardIndex);
    expect(block).toContain("(event.key === 'Enter' || event.key === ' ') && !canClearScriptBuffer");
  });

  it('declares rotoScript and onDiscardScript props and renders Clear Script Buffer inside the toolbar', () => {
    const propsInterface = getScriptsPanelPropsInterface(panel);
    expect(propsInterface).toContain('rotoScript: RotoScriptClipboardController');
    expect(propsInterface).toContain('onDiscardScript: () => void');
    const toolbar = getScriptsToolbarBlock(panel);
    expect(toolbar).toContain('aria-label="Clear Script Buffer"');
    expect(toolbar.indexOf('aria-label="Clear Script Buffer"')).toBeGreaterThan(toolbar.indexOf('label="Refresh Scripts"'));
  });

  it('removes onDiscardRotoScript from the strip and Studio workflow props while scripts props invoke discardScript', () => {
    expect(strip).not.toContain('onDiscardRotoScript');
    expect(studio).not.toContain('onDiscardRotoScript');
    expect(studio).toContain('onDiscardScript: () => { rotoScript.discardScript(); setLastError(null); }');
  });
});

describe('Physics Paint Scripts panel Copy/Apply Script toolbar contract (36.15-08, UAT Gap C)', () => {
  it('renders guarded Copy Script and Apply Script controls before Clear Script Buffer without native disabled or title', () => {
    expect(panel).toContain('Clipboard,');
    expect(panel).toContain('ClipboardPen');
    const toolbar = getScriptsToolbarBlock(panel);
    const refreshIndex = toolbar.indexOf('label="Refresh Scripts"');
    const copyIndex = toolbar.indexOf('aria-label="Copy Script"');
    const applyIndex = toolbar.indexOf('aria-label="Apply Script"');
    const clearIndex = toolbar.indexOf('aria-label="Clear Script Buffer"');
    for (const index of [refreshIndex, copyIndex, applyIndex, clearIndex]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(copyIndex).toBeGreaterThan(refreshIndex);
    expect(applyIndex).toBeGreaterThan(copyIndex);
    expect(clearIndex).toBeGreaterThan(applyIndex);
    for (const label of ['Copy Script', 'Apply Script']) {
      const block = getGuardedToolbarBlock(panel, label);
      expect(block).toContain('aria-disabled');
      expect(block).toContain('aria-describedby');
      expect(block.replace(/aria-disabled/g, '')).not.toContain('disabled=');
      expect(block).not.toContain('title=');
      expect(block).toContain('PhysicsPaintStyledTooltip');
    }
  });

  it('reads availability from the rotoScript controller ports and guards activation before the handlers', () => {
    expect(panel).toContain('rotoScript.availability.value.canCopy');
    expect(panel).toContain('rotoScript.availability.value.canApply');
    expect(panel).toContain('copyDisabledReason');
    expect(panel).toContain('applyDisabledReason');
    const copyBlock = getGuardedToolbarBlock(panel, 'Copy Script');
    const applyBlock = getGuardedToolbarBlock(panel, 'Apply Script');
    const copyGuard = copyBlock.indexOf('if (!canCopyRotoScript) return;');
    expect(copyGuard).toBeGreaterThanOrEqual(0);
    expect(copyBlock.indexOf('onCopyScript()')).toBeGreaterThan(copyGuard);
    expect(copyBlock).toContain("(event.key === 'Enter' || event.key === ' ') && !canCopyRotoScript");
    const applyGuard = applyBlock.indexOf('if (!canApplyRotoScript) return;');
    expect(applyGuard).toBeGreaterThanOrEqual(0);
    expect(applyBlock.indexOf('onApplyScript()')).toBeGreaterThan(applyGuard);
    expect(applyBlock).toContain("(event.key === 'Enter' || event.key === ' ') && !canApplyRotoScript");
    // De-prefixed tooltip grammar (Gap D): description or 'unavailable: {reason}'.
    expect(copyBlock).toContain('unavailable: ${copyRotoScriptDisabledReason}');
    expect(applyBlock).toContain('unavailable: ${applyRotoScriptDisabledReason}');
    expect(copyBlock).not.toContain(' — unavailable: ');
    expect(applyBlock).not.toContain(' — unavailable: ');
  });

  it('declares onCopyScript/onApplyScript props, wires them in Studio scripts props, and removes the strip script actions', () => {
    const propsInterface = getScriptsPanelPropsInterface(panel);
    expect(propsInterface).toContain('onCopyScript: () => void');
    expect(propsInterface).toContain('onApplyScript: () => void');
    expect(studio).toContain('onCopyScript: () => { void rotoScript.copyScript()');
    expect(studio).toContain('onApplyScript: () => { void rotoScript.applyScript()');
    expect(studio).not.toContain('onCopyRotoScript');
    expect(studio).not.toContain('onApplyRotoScript');
    expect(strip).not.toContain('onCopyRotoScript');
    expect(strip).not.toContain('onApplyRotoScript');
    expect(strip).not.toContain('aria-label="Copy Script"');
    expect(strip).not.toContain('aria-label="Apply Script"');
  });

  it('lays the nine toolbar icons out as a proper second row styled like the first (no orphan icon)', () => {
    const toolbar = getScriptsToolbarBlock(panel);
    const guardedCount = (toolbar.match(/physics-paint-roto-key-icon-action/g) ?? []).length;
    // Three guarded clipboard actions (Copy, Apply, Clear) form the second row.
    expect(guardedCount).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/\.physics-paint-scripts-toolbar[\s\S]*?grid-template-columns:\s*repeat\(6,\s*auto\)/);
    expect(css).toContain('.physics-paint-scripts-toolbar .physics-paint-roto-key-icon-action');
  });
});

describe('Physics Paint Scripts panel second-row label contract (36.15-09, UAT Gap E-1)', () => {
  it('renders a short visible label after each guarded second-row icon like the bottom action row', () => {
    const labeledActions: ReadonlyArray<{ action: string; icon: string; label: string }> = [
      { action: 'Copy Script', icon: '<Clipboard size={16}', label: 'Copy' },
      { action: 'Apply Script', icon: '<ClipboardPen size={16}', label: 'Apply' },
      { action: 'Clear Script Buffer', icon: '<ClipboardX size={16}', label: 'Clear' },
    ];
    for (const { action, icon, label } of labeledActions) {
      const block = getGuardedToolbarBlock(panel, action);
      expect(block).not.toBe('');
      const iconIndex = block.indexOf(icon);
      expect(iconIndex).toBeGreaterThanOrEqual(0);
      const labelIndex = block.indexOf(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
      expect(labelIndex).toBeGreaterThan(iconIndex);
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

describe('Physics Paint Scripts panel Gap F second-row contract (36.15-10, UAT Gap F-1)', () => {
  it('renders the second-row labels lowercase by opting the script icon buttons out of the global uppercase button rule', () => {
    // The global `button { text-transform: uppercase }` rule rendered the
    // Copy / Apply / Clear labels as CAPS; the script icon buttons opt out.
    // Anchored at a line start so compound selectors (e.g. the toolbar
    // width rule) do not match first.
    const ruleStart = css.indexOf('\n.physics-paint-script-icon-button {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toContain('text-transform: none');
    // Source labels stay lowercase single words.
    for (const label of ['Copy', 'Apply', 'Clear']) {
      expect(panel).toContain(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
    }
  });

  it('keeps the second-row icons at the first-row size by preventing flex shrink in the grid cells', () => {
    // Both rows use size={16} Lucide icons; the labeled second-row buttons
    // overflow their narrow grid cells, so the icon shrank below 16px
    // ("ridiculous small"). flex: 0 0 auto keeps the icon at full size.
    const ruleStart = css.indexOf('.physics-paint-scripts-toolbar .physics-paint-script-icon-button svg {');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const ruleEnd = css.indexOf('}', ruleStart);
    const rule = css.slice(ruleStart, ruleEnd === -1 ? css.length : ruleEnd + 1);
    expect(rule).toMatch(/flex:\s*0\s+0\s+auto|flex-shrink:\s*0/);
    const toolbar = getScriptsToolbarBlock(panel);
    for (const icon of ['<Clipboard size={16}', '<ClipboardPen size={16}', '<ClipboardX size={16}']) {
      expect(toolbar).toContain(icon);
    }
    // First-row icons stay size={16} too — true size parity.
    for (const icon of ['<Save size={16}', '<Paintbrush size={16}', '<Play size={16}']) {
      expect(toolbar).toContain(icon);
    }
  });
});

describe('Physics Paint Scripts panel Gap G toolbar contract (36.15-11, UAT Gap G-1/G-5)', () => {
  it('sizes the toolbar cells to content so the Copy / Apply / Clear labels render in full (no truncation)', () => {
    // Content-sized columns replace the fixed-fraction cells that ellipsized
    // the second-row labels down to 'C…' / 'A…' / 'Cl…' (UAT Gap G-1).
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
    // Source labels stay the full short words.
    for (const label of ['Copy', 'Apply', 'Clear']) {
      expect(panel).toContain(`<span class="physics-paint-roto-key-icon-label">${label}</span>`);
    }
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

function createFakeLibrary(): RotoScriptLibraryController {
  return {
    rows: sig([]),
    availability: sig({ saveDisabledReason: null, canSave: true, canRename: true, canDelete: true }),
    selected: sig(null),
    busy: sig(false),
    rename: sig(null),
    deleteConfirmation: sig(null),
    selectedId: sig(null),
    status: sig(null),
    skippedInvalidCount: sig(0),
    beginRename: vi.fn(),
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(async () => {}),
    updateRenameDraft: vi.fn(),
    commitRename: vi.fn(async () => {}),
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

function renderPanel(playScript: RotoPlayScriptController): TestVNode {
  hooks.cursor = 0;
  hooks.idCursor = 0;
  return PhysicsPaintScriptsPanel({
    library: createFakeLibrary(),
    playScript,
    rotoScript: createFakeRotoScript(),
    playButtonRef: { current: null },
    onOpenLoopEdit: async () => undefined,
    onCloseLoopClip: () => {},
    onSave: () => {},
    onActivateRow: () => {},
    onLoadAndApply: () => {},
    onDiscardScript: () => {},
    onCopyScript: () => {},
    onApplyScript: () => {},
    onRefresh: () => {},
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

beforeEach(() => {
  hooks.reset();
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
    const toolbarIndex = topLevel.findIndex((vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'));
    const listIndex = topLevel.findIndex((vnode) => hasClass(vnode, 'physics-paint-scripts-list'));
    expect(toolbarIndex).toBeGreaterThanOrEqual(0);
    expect(listIndex).toBe(toolbarIndex + 1);
  });

  it('keeps the Play Script tooltip fallback covering both modes', () => {
    const tree = renderPanel(createFakePlayScript());
    const playButton = findOne(tree, (vnode) => vnode.props?.label === 'Play Script');
    expect(playButton.props.title).toBe('Play Script — Generate real Roto keys (progressive or static/hold)');
    expect(String(playButton.props.title)).not.toContain('Generate progressive real Roto keys');
  });
});
