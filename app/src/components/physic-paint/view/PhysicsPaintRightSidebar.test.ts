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
  it('renders the Brush color and Tool sections with no tab chrome and keeps the lower Scripts/Onion/Motion tab group', () => {
    // Chrome-less sections (36.15-12, UAT Gap H-1/H-2): the single-tab header
    // strips from 36.15-11 are gone — each section starts directly with its
    // content. Only the lower [Scripts, Onion, Motion] group keeps tabs.
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
    // Scripts is FIRST in its group and default-open (36.15-11, UAT Gap G-4).
    expectInOrder(lower, ['Scripts', 'Onion', 'Motion']);
    expect(lower).not.toContain('Tool');

    // The LOG tab is gone (36.15-11, UAT Gap G-6).
    expect(rightPanel).not.toContain('physics-paint-tab-log');
    expect(rightPanel).not.toMatch(/>\s*LOG\s*</);

    // Exactly one tablist with three tabs remains (the lower group).
    expect(rightPanel.match(/role="tablist"/g)).toHaveLength(1);
    expect(rightPanel.match(/role="tab"/g)).toHaveLength(3);

    for (const label of ['Scripts', 'Onion', 'Motion']) {
      expect(rightPanel).toMatch(new RegExp(`>\\s*${label}\\s*<`));
      expect(rightPanel).not.toMatch(new RegExp(`>\\s*${label.toUpperCase()}\\s*<`));
    }
    expect(rule('.physics-paint-options-tab')).toMatch(/text-transform:\s*none/);
  });

  it('owns three independently scrollable sections sharing the sidebar height in equal thirds by default', () => {
    // 36.15-12, UAT Gap H-4: Brush color, Tool, and Scripts/Onion/Motion share
    // the sidebar height in thirds (100/3 each), with a 28px grab handle
    // between each pair.
    expect(rightPanel).toContain('const [brushSplit, setBrushSplit] = useState(100 / 3)');
    expect(rightPanel).toContain('const [toolSplit, setToolSplit] = useState(100 / 3)');
    expect(rightPanel).toContain('gridTemplateRows: `minmax(0, ${brushSplit}fr) 28px minmax(0, ${toolSplit}fr) 28px minmax(0, ${100 - brushSplit - toolSplit}fr)`');
    expect(rightPanel.match(/class="physics-paint-right-pane /g)).toHaveLength(3);
    expect(rightPanel.match(/<SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>/g)).toHaveLength(3);
    const pane = rule('.physics-paint-right-pane');
    expect(pane).toMatch(/min-height:\s*0/);
    expect(pane).toMatch(/overflow:\s*hidden/);
    expect(rule('.physics-paint-right-pane-layout')).toMatch(/overflow:\s*hidden/);
    expect(rule('.physics-paint-right-pane-content')).toMatch(/padding-right:\s*6px/);
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

  it('places a Lucide-grip 28px grab handle between each section pair with keyboard and pointer resize clamped to 15% minimum sections', () => {
    // 36.15-12, UAT Gap H-3/H-4: two grab handles reuse the existing
    // GripHorizontal resize band look and pointer behavior — one between the
    // brush color and tool sections, one between the tool and scripts
    // sections.
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
    expect(resizeBand).toMatch(/min-height:\s*28px/);
    expect(resizeBand).toMatch(/cursor:\s*row-resize/);
    expect(resizeBand).toMatch(/touch-action:\s*none/);
  });

  it('keeps full-row load-only activation and approved six-control Scripts behavior', () => {
    expectInOrder(scriptsPanel, ['label="Save Script"', 'label="Load and Apply Script"', 'label="Play Script"', 'label="Rename Script"', 'label="Delete Script"', 'label="Refresh Scripts"']);
    expect(scriptsPanel).toContain('<Paintbrush size={16} />');
    expect(scriptsPanel).toContain('<Play size={16} />');
    expect(scriptsPanel).toContain("label=\"Play Script\" title={`Play Script — ${playScript.disabledReason.value ?? 'Generate progressive real Roto keys'}`}");
    expect(scriptsPanel).toMatch(/label="Play Script"[^>]*onClick=/);
    expect(scriptsPanel).toContain('role="option"');
    expect(scriptsPanel).toContain('tabIndex={0}');
    expect(scriptsPanel).toContain('onClick={() => onActivateRow(row.id)}');
    expect(scriptsPanel).toContain("event.key !== 'Enter' && event.key !== ' '");
    expect(scriptsPanel).toContain('event.preventDefault()');
    expect(scriptsPanel).toContain('onActivateRow(row.id)');
    expect(scriptsPanel).toContain('onClick={stopRowPointerActivation}');
    expect(scriptsPanel).toContain('event.stopPropagation()');
  });

  it('keeps approved durable-load destination guard labels', () => {
    expect(studio).toContain("? 'Select a project script first.'");
    expect(studio).toContain("? 'Finish the current script library operation.'");
    expect(studio).toContain('rotoScript.availability.value.replacementApplyDisabledReason');
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
