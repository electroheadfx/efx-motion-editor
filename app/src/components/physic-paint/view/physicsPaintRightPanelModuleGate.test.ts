// ============================================================
//  I-08 — Brush-mode context gating (source-scan pin), collapsed
//  to the single-engine world by 261027-klx.
//
//  @efxlab/efx-watercolor is the only paint engine, so the right
//  panel no longer branches on `activeModule`: the Paint tool tab
//  mounts WatercolorModuleSection directly, the top pane is the
//  fixed Color + Brush + Settings + Paper + Memory row, and the
//  Brush module section / Brush-mode arm are gone. Every top-pane
//  tab component keeps its watercolor gate as an always-true
//  single-arm guard. 261028-k03c D2: the Brush tab is MOUNTED again
//  (261027-gh9g had retired it) — it carries the catalog, Size, the
//  globals, the response multipliers and the Lift section.
//
//  The Paper tab stays shared document-fond vocabulary (I-07) — no
//  module gate between the paper arm and the paper mount.
//
//  Source-scan pin (same idiom as
//  physicsPaintRightPanelPaperSingleHome.test.ts): readFileSync the
//  owning files and assert the branch structure.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const panelSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/PhysicsPaintRightPanel.tsx'),
  'utf8',
);
const brushTabSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/RightPanelBrushTab.tsx'),
  'utf8',
);
const settingsTabSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/RightPanelSettingsTab.tsx'),
  'utf8',
);
const paperTabSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/RightPanelPaperTab.tsx'),
  'utf8',
);
const toolRailSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/PhysicsPaintToolRail.tsx'),
  'utf8',
);
const moduleSectionSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/WatercolorModuleSection.tsx'),
  'utf8',
);

/** Strip block + line comments so negative scans never trip on docs. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Every JSX mount of `component` inside `region` must sit AFTER an
 * `activeModule.value === 'watercolor'` test and must NOT fall into that
 * ternary's else arm (the first `) : (` after the gate, unless a second
 * watercolor gate re-enters).
 */
function expectMountsBehindWatercolorGate(region: string, component: string): void {
  const mountRe = new RegExp(`<${component}\\b`, 'g');
  const mounts = [...region.matchAll(mountRe)];
  expect(mounts.length, `${component} mount must appear in the region`).toBeGreaterThan(0);
  for (const mount of mounts) {
    const mountAt = mount.index ?? 0;
    const before = region.slice(0, mountAt);
    const gateAt = before.lastIndexOf("activeModule.value === 'watercolor'");
    expect(gateAt, `${component} mount must sit behind a watercolor gate`).toBeGreaterThan(-1);
    // The nearest activeModule test before the mount must be the watercolor
    // branch — never some other module arm.
    const nearestModuleTest = before.lastIndexOf('activeModule.value');
    expect(
      nearestModuleTest,
      `nearest activeModule test before ${component} must be the watercolor branch`,
    ).toBe(gateAt);
    // If a ternary-else marker lands between the gate and the mount, the mount
    // is in the else arm unless a second watercolor gate re-enters it.
    const between = region.slice(gateAt, mountAt);
    const elseAt = between.indexOf(') : (');
    if (elseAt !== -1) {
      const afterElse = between.slice(elseAt);
      expect(
        afterElse.indexOf("activeModule.value === 'watercolor'"),
        `${component} mount falls in the else arm of the watercolor branch`,
      ).toBeGreaterThan(-1);
    }
  }
}

describe('single-engine right panel (261027-klx)', () => {
  it('Brush tab body is mounted again and everything it mounts stays watercolor-gated', () => {
    // 261028-k03d: the Brush tab is the catalog + the top-bar response
    // (Size + the seven globals). The Settings clone and the Lift section are
    // gone — Settings owns the response block, the top bar owns Lift.
    const body = stripComments(brushTabSource);
    const gateAt = body.indexOf("activeModule.value === 'watercolor'");
    expect(gateAt, 'Brush tab keeps its watercolor gate').toBeGreaterThan(-1);

    expectMountsBehindWatercolorGate(body, 'WatercolorBrushLibrary');
    expectMountsBehindWatercolorGate(body, 'AquarelleGlobalsPanel');
    expect(body, 'Settings content stays in the Settings tab').not.toMatch(
      /<BrushResponsePanel\b/,
    );
    expect(body, 'Lift controls stay in the top bar').not.toMatch(/<LiftShapePicker\b/);
    expect(body, 'BrushModuleSection is not mounted in the Brush tab').not.toMatch(
      /<BrushModuleSection\b/,
    );
    // The panel mounts the Brush tab arm again.
    expect(stripComments(panelSource), 'the Brush tab body is mounted').toMatch(
      /<RightPanelBrushTab\b/,
    );
  });

  it('Settings tab mounts BrushResponsePanel behind its watercolor gate (I-11 / D)', () => {
    const body = stripComments(settingsTabSource);
    const gateAt = body.indexOf("activeModule.value === 'watercolor'");
    expect(gateAt, 'Settings tab keeps its watercolor gate').toBeGreaterThan(-1);
    expectMountsBehindWatercolorGate(body, 'BrushResponsePanel');
  });

  it('Paint tab mounts WatercolorModuleSection directly — no module branch left', () => {
    const paintTabStart = panelSource.indexOf("effectiveToolTab === 'paint'");
    expect(paintTabStart, 'paint-tab branch must exist').toBeGreaterThan(-1);
    const paintTabEnd = panelSource.indexOf("effectiveToolTab === 'background'", paintTabStart);
    expect(paintTabEnd, 'paint-tab branch must end at the background arm').toBeGreaterThan(paintTabStart);
    const paintTab = stripComments(panelSource.slice(paintTabStart, paintTabEnd));

    expect(paintTab, 'paint tab mounts the watercolor module section').toMatch(
      /<WatercolorModuleSection\b/,
    );
    // 261027-klx: one module — the Brush-module section and every activeModule
    // branch (including the old else arm) leave the panel entirely.
    expect(paintTab, 'BrushModuleSection is gone').not.toMatch(/<BrushModuleSection\b/);
    expect(paintTab, 'no module branch in the paint tab').not.toMatch(/activeModule/);
  });

  it('AquarelleGlobalsPanel mounts inside WatercolorModuleSection and the gated Brush tab', () => {
    // The globals panel is never a DIRECT panel mount — it rides
    // WatercolorModuleSection (the paint-tab pin above proves that is the only
    // module surface left) and the 261028-k03c restored Brush tab, where the
    // watercolor gate pin above covers it.
    expect(panelSource, 'globals panel is not a direct panel mount').not.toMatch(
      /<AquarelleGlobalsPanel\b/,
    );
    expect(moduleSectionSource, 'WatercolorModuleSection mounts AquarelleGlobalsPanel').toMatch(
      /<AquarelleGlobalsPanel\b/,
    );
  });

  it('PhysicsPaintToolRail returns WatercolorRail unconditionally', () => {
    const body = stripComments(toolRailSource);
    const railMounts = [...body.matchAll(/<WatercolorRail\b/g)];
    expect(railMounts, 'exactly one WatercolorRail mount').toHaveLength(1);
    // 261027-klx: the Brush tool set (Paint / Paint with physics / Erase /
    // Move) went with engine 1 — no module branch remains, so the aquarelle
    // rail is the only return path.
    expect(body, 'no module branch in the tool rail').not.toMatch(/activeModule/);
    const implStart = body.indexOf('function PhysicsPaintToolRailImpl(');
    expect(implStart, 'tool rail impl must exist').toBeGreaterThan(-1);
    const impl = body.slice(implStart);
    expect(impl, 'impl returns directly').toContain('<WatercolorRail');
    expect(impl, 'no second (brush-tools) return path').not.toContain('physics-paint-tool-rail');
  });

  it('WatercolorRail shows Undo / Redo / Trash on the existing history path (261018-cy1)', () => {
    const body = stripComments(toolRailSource);
    expect(body, 'Undo/Redo reuse PhysicsPaintHistoryActionButton').toMatch(
      /<PhysicsPaintHistoryActionButton\b/,
    );
    expect(body, 'Trash routes to onClearFrame').toContain('onClearFrame');
    expect(body, 'rail mounts history actions').toContain('onUndo');
    expect(body, 'rail mounts history actions').toContain('onRedo');
    // No second history store — the existing props are the only path.
    expect(body, 'no new history store').not.toMatch(/createPhysicsPaintHistory\b/);
  });

  it('Paper tab branch mounts the paper surface with no activeModule gate', () => {
    // I-10: the paper surface is RightPanelPaperTab (which mounts PaperPicker);
    // both the panel arm and the tab component stay ungated (I-07 document fond).
    const paperTabStart = panelSource.indexOf("effectiveTopPaneTab === 'paper'");
    expect(paperTabStart, 'paper-tab branch must exist').toBeGreaterThan(-1);
    const paperTabEnd = panelSource.indexOf("effectiveTopPaneTab === 'memory'", paperTabStart);
    expect(paperTabEnd, 'paper-tab branch ends before the memory arm').toBeGreaterThan(paperTabStart);
    const paperTab = stripComments(panelSource.slice(paperTabStart, paperTabEnd));

    expect(paperTab, 'paper arm mounts the paper tab component').toMatch(/<RightPanelPaperTab\b/);
    expect(paperTab, 'paper arm stays shared (document-fond, I-07)').not.toMatch(/activeModule/);

    const paperTabBody = stripComments(paperTabSource);
    expect(paperTabBody, 'RightPanelPaperTab mounts PaperPicker').toMatch(/<PaperPicker\b/);
    expect(paperTabBody, 'RightPanelPaperTab stays ungated').not.toMatch(/activeModule/);
  });

  it('top-pane tab row is fixed to Color + Brush + Settings + Paper + Memory', () => {
    // 261018-cy1 + I-11 / D retired Actions; 261027-klx removed the
    // mode-derived variant entirely. 261028-k03c D2 reinstated the Brush tab
    // (261027-gh9g had retired it). quick-261023-ors: 'memory' is LAST.
    expect(panelSource, 'top-pane tab list').toContain(
      "['color', 'brush', 'settings', 'paper', 'memory']",
    );
    expect(panelSource, 'no brush-mode tab list').not.toContain("['color', 'paper', 'memory']");
    expect(panelSource, 'no actions id in the tab list').not.toMatch(
      /\[\s*'color',\s*'actions'/,
    );
    expect(panelSource, 'topPaneTab union carries the live tabs').toContain(
      "useState<'color' | 'brush' | 'settings' | 'paper' | 'memory'>",
    );
    expect(panelSource, 'no mode-derived settings gate').not.toContain('isWatercolorModule');
    expect(panelSource, 'no stale brush-mode fallback').not.toContain(
      "topPaneTab === 'settings' && !isWatercolorModule",
    );
    // Labels stay the human names (no Watercolor tab).
    expect(panelSource, 'Color label stays').toContain("color: 'Color'");
    expect(panelSource, 'Brush label is back').toContain("brush: 'Brush'");
    expect(panelSource, 'Settings label stays').toContain("settings: 'Settings'");
    expect(panelSource, 'Paper label stays').toContain("paper: 'Paper'");
    expect(panelSource, 'Memory label').toContain("memory: 'Memory'");
    // Top-pane Actions routing is gone (the bottom-pane scripts tab keeps its label).
    expect(panelSource, 'no RightPanelActionsTab mount').not.toMatch(/<RightPanelActionsTab\b/);
  });

  it('quick-261023-ors: the Memory tab branch sits after Paper and before the Color fallback', () => {
    const paperAt = panelSource.indexOf("effectiveTopPaneTab === 'paper'");
    const memoryAt = panelSource.indexOf("effectiveTopPaneTab === 'memory'");
    const colorFallbackAt = panelSource.indexOf('physics-paint-single-tab-panel', memoryAt);
    expect(paperAt, 'paper arm exists').toBeGreaterThan(-1);
    expect(memoryAt, 'memory arm exists').toBeGreaterThan(paperAt);
    expect(colorFallbackAt, 'color fallback follows the memory arm').toBeGreaterThan(memoryAt);
    // The memory arm is never module-gated.
    const memoryArm = panelSource.slice(memoryAt, colorFallbackAt);
    expect(memoryArm).toMatch(/<RightPanelMemoryTab\b/);
    expect(memoryArm).not.toMatch(/activeModule/);
    // An absent memorySection renders an empty body (no crash, no figures).
    expect(memoryArm).toContain('memorySection ? (');
  });
});
