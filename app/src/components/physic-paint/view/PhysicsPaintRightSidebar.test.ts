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
  it('binds the palette opacity to the Water color Pigment and keeps no Opacity-labelled slider', () => {
    // 261027-klx: the Brush-only Opacity row left with engine-1 and the module
    // switch. The palette commits the aquarelle `load` global as its opacity;
    // an Opacity-labelled slider bound to `load` is the confusion this pins
    // out (Pigment stays a named globals row).
    expect(rightPanel).not.toContain('activeModule');
    expect(rightPanel).not.toContain('label="Opacity"');
    expect(rightPanel).toContain('opacity={aquarelleParams.value.load}');
    const globals = readFileSync(
      fileURLToPath(new URL('./AquarelleGlobalsPanel.tsx', import.meta.url)),
      'utf8',
    );
    expect(globals).toContain("{ key: 'load', label: 'Pigment' }");
  });

  it('renders the top pane with the fixed Color/Settings/Paper/Memory tabs and the Tool pane behind Paint/Track/Audio tabs, keeping the lower Scripts/Onion/Motion tab group', () => {
    // 261018-cy1 + I-11 / D: the retired top-pane Actions entry is gone.
    // 261027-gh9g: the Brush tab is retired from the right sidebar (top-bar
    // picker + floating modal). 261027-klx: engine-1 removal leaves Water color
    // as the only module, so the tab list is FIXED — no mode-derived subset.
    expect(rightPanel).toContain('aria-label="Top pane panels"');
    expect(rightPanel).toContain('physics-paint-tab-top-');
    // quick-261023-ors: the Memory tab joins the union as the LAST entry.
    expect(rightPanel).toContain("'color' | 'settings' | 'paper' | 'memory'");
    expect(rightPanel).not.toContain("'color' | 'actions' | 'brush' | 'paper'");
    expect(rightPanel).not.toContain("'color', 'paper', 'memory'");

    // The tool pane's own tablist: Paint FIRST and default-open, Track second,
    // Audio third (261008-ryq — the clip list moved into this tab), and the
    // conditional Background option tab last (49-06 UAT round 2 — shown only
    // while a Bg clip is selected, never replacing Track).
    const toolTabStart = rightPanel.indexOf('aria-label="Physics Paint tool option panels"');
    const toolTabs = rightPanel.slice(toolTabStart, rightPanel.indexOf('</div>', toolTabStart));
    expectInOrder(toolTabs, ['Paint', 'Track', 'Audio', 'Background option']);
    // 49-06 (UAT round 2): the tab is a Studio-owned signal — the panel reads
    // it (the 38-11 signal-bypasses-memo pattern) so a Paint track selection
    // returns to Track option and a Bg rail selection opens Background option.
    expect(rightPanel).toContain("toolTabSignal?.value ?? 'paint'");

    const lowerStart = rightPanel.indexOf('aria-label="Physics Paint option panels"');
    const lowerEnd = rightPanel.indexOf('</div>', lowerStart);
    const lower = rightPanel.slice(lowerStart, lowerEnd);
    // Scripts is FIRST in its group and default-open (36.15-11, UAT Gap G-4).
    expectInOrder(lower, ['Scripts', 'Onion', 'Motion']);
    expect(lower).not.toContain('Track');

    // The LOG tab is gone (36.15-11, UAT Gap G-6).
    expect(rightPanel).not.toContain('physics-paint-tab-log');
    expect(rightPanel).not.toMatch(/>\s*LOG\s*</);

    // Two tablists remain: the tool pane's tabs (Paint/Track/Audio + the
    // conditional Background option) + the lower group's three.
    expect(rightPanel.match(/role="tablist"/g)).toHaveLength(3);
    // The top-pane tabs render from ONE literal inside the mode-derived map, so
    // the Memory tab (quick-261023-ors) adds a rendered button but no source
    // occurrence: 8 stays the literal count (top-map 1 + tool 3 + conditional
    // Background 1 + lower 3).
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(8);
    // 261027-klx: with Water color the only module, the retired Brush-mode
    // subset ('color', 'paper') does not exist; ONE fixed list remains.
    expect(rightPanel).not.toContain("'color', 'paper', 'memory'");
    expect(rightPanel).toContain("'color', 'settings', 'paper', 'memory'");

    for (const label of ['Scripts', 'Onion', 'Motion']) {
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

  it('keeps the chrome-less brush color section top padding at the UAT 10px', () => {
    // 36.15-13 UAT Gap I-3 set padding-top: 0. 261018-ias AREA 2 item 12
    // overrides it to 10px (UAT list) — the shared tab-panel's 20px top is
    // still trimmed for this section.
    expect(rightPanel).toContain('class="physics-paint-options-tab-panel physics-paint-single-tab-panel"');
    const panel = rule('.physics-paint-single-tab-panel');
    expect(panel).toMatch(/padding-top:\s*10px/);
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

  it('locks the approved eight-column three-row palette and the selected-swatch accent outline', () => {
    expect(rule('.physics-paint-swatch-grid')).toMatch(/grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    expect(rule('.physics-paint-swatch-grid')).toMatch(/grid-auto-rows:\s*32px/);
    expect(rule('.physics-paint-swatch-grid')).toMatch(/gap:\s*7px/);
    expect(rule('.physics-paint-swatch-grid')).toMatch(/min-height:\s*110px/);
    expect(rule('.physics-paint-swatch-cell')).toMatch(/height:\s*32px/);
    // 261025-co0: the per-swatch removal control and its CSS rules are gone.
    expect(css).not.toContain('.physics-paint-swatch-remove');
    expect(rule('.physics-paint-swatch[aria-pressed="true"]')).toMatch(/outline:\s*2px solid var\(--color-accent, #2d5be3\)/);
    expect(rule('.physics-paint-swatch[aria-pressed="true"]')).toMatch(/outline-offset:\s*1px/);
  });

  it('places a Lucide-grip 32px grab handle between each section pair with keyboard and pointer resize clamped to 15% minimum sections', () => {
    // 36.15-12, UAT Gap H-3/H-4 + 36.15-13, UAT Gap I-2: two grab handles
    // reuse the existing GripHorizontal resize band look and pointer behavior
    // — one between the brush color and tool sections, one between the tool
    // and scripts sections; Gap I-2 sets the fixed handle band to the user's
    // 32px spec.
    // 261025-co0: the per-swatch X is gone — swatches toggle selection and the
    // grid owns palette Delete/Backspace; the panel keeps GripHorizontal for
    // the two resizer handles.
    expect(rightPanel).toContain("import { GripHorizontal } from 'lucide-preact'");
    const colorTab = readFileSync(fileURLToPath(new URL('./RightPanelColorTab.tsx', import.meta.url)), 'utf8');
    expect(colorTab).toContain('const [selectedSwatch, setSelectedSwatch] = useState<string | null>(null)');
    expect(colorTab).toContain('aria-pressed={selectedSwatch === swatch}');
    expect(colorTab).toContain('tabIndex={-1}');
    expect(colorTab).toContain('onKeyDown={handleSwatchGridKeyDown}');
    expect(colorTab).not.toContain("from 'lucide-preact'");
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
    // 261022-o2a: ONE row of four actions — Delete moved into the row
    // confirmation surface, so it is no longer a toolbar token.
    expectInOrder(scriptsPanel, ['label="Save Script"', 'label="Load + Apply to Frame"', 'label="Create Rail…"', 'label="Refresh Scripts"']);
    expect(scriptsPanel).toContain('if (selectedLoopClip)');
    expect(scriptsPanel).toContain('<Paintbrush size={16} />');
    expect(scriptsPanel).toContain('<Play size={16} />');
    expect(scriptsPanel).toContain('label={`Edit Rail — ${selectedLoopClip.displayName}`}');
    expect(scriptsPanel).toContain("label=\"Create Rail…\" title={`Create Rail… — ${actionMutationDisabledReason ?? (playScript.disabledReason.value ?? 'Create a Motion or Static Rail from the selected Script')}`}");
    expect(scriptsPanel).toMatch(/label="Create Rail…"[^>]*onClick=/);
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
    expect(scriptsPanel).toContain("? 'Select a project Script first.'");
    expect(scriptsPanel).toContain('rotoScript.availability.value.replacementApplyDisabledReason');
    expect(studio).not.toContain('const scriptLoadAndApplyDisabledReason =');
  });

  it('keeps desktop, narrow, and stacked layouts horizontally bounded', () => {
    expect(rule('.physics-paint-right-panel')).toMatch(/overflow:\s*hidden/);
    expect(rule('.physics-paint-options-tabs')).toMatch(/min-width:\s*0[\s\S]*overflow:\s*hidden/);
    expect(rule('.physics-paint-options-tab')).toMatch(/min-width:\s*0[\s\S]*white-space:\s*nowrap/);
    // 261022-o2a: the toolbar is ONE row of four actions (Save / Apply /
    // Create Rail / Refresh); Delete and Copy moved out.
    expect(rule('.physics-paint-scripts-toolbar')).toMatch(/grid-template-columns:\s*repeat\(4,\s*auto\)[\s\S]*min-width:\s*0/);
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
