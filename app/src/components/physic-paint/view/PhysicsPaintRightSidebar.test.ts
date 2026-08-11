import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rightPanel = readFileSync(fileURLToPath(new URL('./PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const scriptsPanel = readFileSync(fileURLToPath(new URL('./PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const studio = readFileSync(fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');
const capability = readFileSync(fileURLToPath(new URL('../../../../src-tauri/capabilities/physics-paint.json', import.meta.url)), 'utf8');
const scrollArea = readFileSync(fileURLToPath(new URL('../../sidebar/SidebarScrollArea.tsx', import.meta.url)), 'utf8');
const leftPanel = readFileSync(fileURLToPath(new URL('../../layout/LeftPanel.tsx', import.meta.url)), 'utf8');

function expectInOrder(source: string, tokens: readonly string[]) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    expect(next, `Expected ${token} after source offset ${cursor}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  expect(match, `Missing CSS rule ${selector}`).not.toBeNull();
  return match![1];
}

describe('native-approved Physics Paint right sidebar', () => {
  it('renders the Brush color and Tool sections with no tab chrome and keeps the lower Actions/Onion/Motion tab group', () => {
    // Chrome-less sections (36.15-12, UAT Gap H-1/H-2): the single-tab header
    // strips from 36.15-11 are gone — each section starts directly with its
    // content. Only the lower [Actions, Onion, Motion] group keeps tabs.
    expect(rightPanel).not.toContain('aria-label="Brush color panel"');
    expect(rightPanel).not.toContain('aria-label="Tool panel"');
    expect(rightPanel).not.toContain('physics-paint-tab-brush');
    expect(rightPanel).not.toContain('physics-paint-tab-tool');
    expect(rightPanel).not.toContain('physics-paint-single-tab"');
    expect(rightPanel).not.toMatch(/>\s*Brush color\s*</);
    expect(rightPanel).not.toMatch(/>\s*Tool\s*</);

    const lowerStart = rightPanel.indexOf('aria-label="Physics Paint option panels"');
    const lowerEnd = rightPanel.indexOf('</div>', lowerStart);
    const lower = rightPanel.slice(lowerStart, lowerEnd);
    // Actions is FIRST in its group and default-open (36.15-11, UAT Gap G-4).
    expectInOrder(lower, ['Actions', 'Onion', 'Motion']);
    expect(lower).not.toContain('Tool');

    // The LOG tab is gone (36.15-11, UAT Gap G-6).
    expect(rightPanel).not.toContain('physics-paint-tab-log');
    expect(rightPanel).not.toMatch(/>\s*LOG\s*</);

    // Exactly one tablist with three tabs remains (the lower group).
    expect(rightPanel.match(/role="tablist"/g)).toHaveLength(1);
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(3);

    for (const label of ['Actions', 'Onion', 'Motion']) {
      expect(rightPanel).toMatch(new RegExp(`>\\s*${label}\\s*<`));
      expect(rightPanel).not.toMatch(new RegExp(`>\\s*${label.toUpperCase()}\\s*<`));
    }
    expect(rule('.physics-paint-options-tab')).toMatch(/text-transform:\s*none/);
  });

  it('owns three independently scrollable sections with 361.25:213:272 default shares of the content height', () => {
    // 36.15 Gap J: user trim of the Gap I-2 spec — color 425×0.85=361.25,
    // tool 213 unchanged, scripts/onion/motion 340×0.8=272 — as RATIOS of the
    // content height (sidebar height minus the two fixed 32px grab handles).
    expect(rightPanel).toContain('const DEFAULT_SHARE_SUM = 361.25 + 213 + 272');
    expect(rightPanel).toContain('const DEFAULT_BRUSH_SPLIT = (361.25 / DEFAULT_SHARE_SUM) * 100');
    expect(rightPanel).toContain('const DEFAULT_TOOL_SPLIT = (213 / DEFAULT_SHARE_SUM) * 100');
    expect(rightPanel).toContain('const [brushSplit, setBrushSplit] = useState(DEFAULT_BRUSH_SPLIT)');
    expect(rightPanel).toContain('const [toolSplit, setToolSplit] = useState(DEFAULT_TOOL_SPLIT)');
    expect(rightPanel).toContain('gridTemplateRows: `minmax(0, ${brushSplit}fr) 32px minmax(0, ${toolSplit}fr) 32px minmax(0, ${100 - brushSplit - toolSplit}fr)`');
    expect(rightPanel.match(/class="physics-paint-right-pane /g)).toHaveLength(3);
    expect(rightPanel.match(/<SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>/g)).toHaveLength(3);
    const pane = rule('.physics-paint-right-pane');
    expect(pane).toMatch(/min-height:\s*0/);
    expect(pane).toMatch(/overflow:\s*hidden/);
    expect(rule('.physics-paint-right-pane-layout')).toMatch(/overflow:\s*hidden/);
    expect(rule('.physics-paint-right-pane-content')).toMatch(/padding-right:\s*6px/);
  });

  it('removes the dead space at the top of the chrome-less brush color section', () => {
    // 36.15-13, UAT Gap I-3: the shared tab-panel's 20px top padding was
    // designed for the retired tab strip; the chrome-less color section now
    // starts directly with the color picker via a padding-top: 0 override.
    expect(rightPanel).toContain('class="physics-paint-options-tab-panel physics-paint-single-tab-panel"');
    const panel = rule('.physics-paint-single-tab-panel');
    expect(panel).toMatch(/padding-top:\s*0/);
    // The override must follow the shared tab-panel rule so it wins at equal
    // specificity.
    expect(css.indexOf('.physics-paint-single-tab-panel {')).toBeGreaterThan(css.indexOf('.physics-paint-options-tab-panel {'));
  });

  it('scopes interactive custom scrollbars to Physics Paint panes and preserves default consumers', () => {
    expect(scrollArea).toContain('interactive = false');
    expect(scrollArea).toContain("pointerEvents: interactive ? 'auto' : 'none'");
    expect(scrollArea).toContain('onPointerDown={interactive ? (event) => scrollToTrackPosition(event.clientY) : undefined}');
    expect(rightPanel.match(/<SidebarScrollArea[^>]*interactive>/g)).toHaveLength(3);
    expect(leftPanel).toContain('<SidebarScrollArea>');
    expect(leftPanel).not.toMatch(/<SidebarScrollArea[^>]*interactive/);
  });

  it('grants the standalone Physics Paint window access to the shared preference store', () => {
    const parsed = JSON.parse(capability) as { windows: string[]; permissions: string[] };
    expect(parsed.windows).toContain('efx-physic-paint');
    expect(parsed.permissions).toContain('store:default');
  });

  it('locks the approved eight-column three-row palette and outside top-left removal offset', () => {
    expect(rule('.physics-paint-swatch-grid')).toMatch(/grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    expect(rule('.physics-paint-swatch-grid')).toMatch(/grid-auto-rows:\s*32px/);
    expect(rule('.physics-paint-swatch-grid')).toMatch(/gap:\s*7px/);
    expect(rule('.physics-paint-swatch-grid')).toMatch(/min-height:\s*110px/);
    expect(rule('.physics-paint-swatch-cell')).toMatch(/height:\s*32px/);
    expect(rule('.physics-paint-swatch-remove')).toMatch(/top:\s*-5px/);
    expect(rule('.physics-paint-swatch-remove')).toMatch(/left:\s*-5px/);
  });

  it('places a Lucide-grip 32px grab handle between each section pair with keyboard and pointer resize clamped to 15% minimum sections', () => {
    // 36.15-12, UAT Gap H-3/H-4 + 36.15-13, UAT Gap I-2: two grab handles
    // reuse the existing GripHorizontal resize band look and pointer behavior
    // — one between the brush color and tool sections, one between the tool
    // and scripts sections; Gap I-2 sets the fixed handle band to the user's
    // 32px spec.
    expect(rightPanel).toContain("import { GripHorizontal, X } from 'lucide-preact'");
    expect(rightPanel.match(/class="physics-paint-right-pane-resizer"/g)).toHaveLength(2);
    expect(rightPanel.match(/role="separator"/g)).toHaveLength(2);
    expect(rightPanel).toContain('aria-label="Resize brush color and tool sections"');
    expect(rightPanel).toContain('aria-label="Resize tool and scripts sections"');
    expect(rightPanel.match(/aria-orientation="horizontal"/g)).toHaveLength(2);
    expect(rightPanel.match(/aria-valuemin=\{15\}/g)).toHaveLength(2);
    expect(rightPanel.match(/<GripHorizontal aria-hidden="true" size=\{18\} strokeWidth=\{1\.8\} \/>/g)).toHaveLength(2);
    expect(rightPanel.match(/onPointerDown=\{\(event\) => startPaneResize\(event as unknown as PointerEvent, '(brush|tool)'\)\}/g)).toHaveLength(2);
    expect(rightPanel.match(/event\.key !== 'ArrowUp' && event\.key !== 'ArrowDown'/g)).toHaveLength(2);
    expect(rightPanel.match(/event\.key === 'ArrowDown' \? 5 : -5/g)).toHaveLength(2);
    const resizeBand = rule('.physics-paint-right-pane-resizer');
    expect(resizeBand).toMatch(/min-height:\s*32px/);
    expect(resizeBand).toMatch(/cursor:\s*row-resize/);
    expect(resizeBand).toMatch(/touch-action:\s*none/);
  });

  it('keeps full-row load-only activation and contextual Actions behavior', () => {
    expectInOrder(scriptsPanel, ['label="Save Action"', 'label="Load + Apply to Frame"', 'label="Create Group…"', 'label="Delete Action"', 'label="Refresh Actions"']);
    expect(scriptsPanel).toContain('if (selectedLoopClip)');
    expect(scriptsPanel).toContain('<Paintbrush size={16} />');
    expect(scriptsPanel).toContain('<Play size={16} />');
    expect(scriptsPanel).toContain('aria-label={`Edit Group — ${selectedLoopClip.displayName}`}');
    expect(scriptsPanel).toContain("label=\"Create Group…\" title={`Create Group… — ${actionMutationDisabledReason ?? (playScript.disabledReason.value ?? 'Create a Motion or Static Group from the selected Action')}`}");
    expect(scriptsPanel).toMatch(/label="Create Group…"[^>]*onClick=/);
    expect(scriptsPanel).not.toContain('label="Rename Action"');
    expect(scriptsPanel).toContain('role="option"');
    expect(scriptsPanel).toContain('tabIndex={0}');
    expect(scriptsPanel).toContain("aria-disabled={confirmationBusy ? 'true' : undefined}");
    expect(scriptsPanel).toContain('onClick={() => {\n              if (confirmationBusy) return;\n              onActivateRow(row.id);');
    expect(scriptsPanel).toContain("event.key !== 'Enter' && event.key !== ' '");
    expect(scriptsPanel).toContain('event.preventDefault()');
    expect(scriptsPanel).toContain('if (confirmationBusy) return;\n              onActivateRow(row.id);');
    expect(scriptsPanel).toContain('onClick={stopRowPointerActivation}');
    expect(scriptsPanel).toContain('event.stopPropagation()');
  });

  it('keeps approved durable-load destination guards in the narrow Actions subscriber', () => {
    expect(scriptsPanel).toContain('const actionMutationDisabledReason = library.actionMutationDisabledReason.value;');
    expect(scriptsPanel).toContain('const loadAndApplyDisabledReason = actionMutationDisabledReason');
    expect(scriptsPanel).toContain("? 'Select a project Action first.'");
    expect(scriptsPanel).toContain('rotoScript.availability.value.replacementApplyDisabledReason');
    expect(studio).not.toContain('const scriptLoadAndApplyDisabledReason =');
  });

  it('keeps desktop, narrow, and stacked layouts horizontally bounded', () => {
    expect(rule('.physics-paint-right-panel')).toMatch(/overflow:\s*hidden/);
    expect(rule('.physics-paint-options-tabs')).toMatch(/min-width:\s*0[\s\S]*overflow:\s*hidden/);
    expect(rule('.physics-paint-options-tab')).toMatch(/min-width:\s*0[\s\S]*white-space:\s*nowrap/);
    expect(rule('.physics-paint-scripts-toolbar')).toMatch(/grid-template-columns:\s*repeat\(6,\s*auto\)[\s\S]*min-width:\s*0/);
    expect(rule('.physics-paint-scripts-list')).toMatch(/min-width:\s*0[\s\S]*overflow-x:\s*hidden/);

    const narrow = css.slice(css.indexOf('@media (max-width: 1180px)'), css.indexOf('@media (max-width: 860px)'));
    expect(narrow).toContain('grid-template-columns: 48px minmax(0, 1fr) 286px');
    expect(narrow).toMatch(/\.physics-paint-options-tab\s*\{[\s\S]*padding-inline:\s*4px[\s\S]*font-size:\s*11px/);

    const mobile = css.slice(css.indexOf('@media (max-width: 860px)'));
    // D-18 fixed layout contract (36.15-06): the 860px query no longer reflows
    // the studio grid, re-places panels, or overrides right-panel/strip
    // heights; the strip scrolls horizontally below the minimum host width.
    expect(mobile).not.toContain('.physics-paint-studio');
    expect(mobile).not.toContain('.physics-paint-right-panel');
    expect(mobile).not.toContain('.physics-paint-workflow-strip');
    expect(mobile).not.toContain('260px');
  });
});
