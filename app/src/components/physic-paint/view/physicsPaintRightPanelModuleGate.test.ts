// ============================================================
//  I-08 — Brush-mode context gating (source-scan pin).
//
//  Watercolor-only surfaces (WatercolorModuleSection,
//  WatercolorBrushLibrary, BrushResponsePanel, AquarelleGlobalsPanel,
//  WatercolorRail) must sit behind `activeModule.value === 'watercolor'`.
//  The Paper tab stays shared document-fond vocabulary (I-07) — no
//  activeModule gate between the paper arm and the paper mount.
//  261018-cy1 + I-11 / D: the top-pane tab row is mode-derived (brush mode
//  Color + Paper; watercolor Color + Brush + Settings + Paper) with no
//  Actions entry.
//
//  Source-scan pin (same idiom as
//  physicsPaintRightPanelPaperSingleHome.test.ts): readFileSync the
//  owning files and assert the branch structure. 261018-0ox I-10
//  moved the Brush-tab mounts into RightPanelBrushTab.tsx and the
//  Paper-tab mount into RightPanelPaperTab.tsx — this pin follows
//  those homes.
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

describe('I-08 Brush-mode context gating', () => {
  it('watercolor-only mounts in the Brush tab sit behind the watercolor branch', () => {
    // I-10 + 261018-cy1: the Brush-tab body is RightPanelBrushTab (early-return
    // watercolor arm). The brush-module duplicate arm is gone — the Paint tool
    // tab owns the physics param bag.
    const body = stripComments(brushTabSource);
    const gateAt = body.indexOf("activeModule.value === 'watercolor'");
    expect(gateAt, 'Brush tab keeps its watercolor gate').toBeGreaterThan(-1);

    expectMountsBehindWatercolorGate(body, 'WatercolorBrushLibrary');
    // I-11 / D: the brush response moved to the Settings tab.
    expect(body, 'BrushResponsePanel leaves the Brush tab').not.toMatch(
      /<BrushResponsePanel\b/,
    );

    expect(body, 'BrushModuleSection is not mounted in the Brush tab').not.toMatch(
      /<BrushModuleSection\b/,
    );
  });

  it('Settings tab mounts BrushResponsePanel behind the watercolor gate (I-11 / D)', () => {
    const body = stripComments(settingsTabSource);
    const gateAt = body.indexOf("activeModule.value === 'watercolor'");
    expect(gateAt, 'Settings tab keeps its watercolor gate').toBeGreaterThan(-1);
    expectMountsBehindWatercolorGate(body, 'BrushResponsePanel');
  });

  it('watercolor-only mounts in the Paint tab sit behind the watercolor branch', () => {
    const paintTabStart = panelSource.indexOf("effectiveToolTab === 'paint'");
    expect(paintTabStart, 'paint-tab branch must exist').toBeGreaterThan(-1);
    const paintTabEnd = panelSource.indexOf("effectiveToolTab === 'background'", paintTabStart);
    expect(paintTabEnd, 'paint-tab branch must end at the background arm').toBeGreaterThan(paintTabStart);
    const paintTab = stripComments(panelSource.slice(paintTabStart, paintTabEnd));

    expectMountsBehindWatercolorGate(paintTab, 'WatercolorModuleSection');
    expect(paintTab, 'brush-module arm stays the else branch').toMatch(/BrushModuleSection/);
  });

  it('AquarelleGlobalsPanel mounts only inside WatercolorModuleSection (itself watercolor-gated)', () => {
    // The globals panel is never a direct panel mount — it rides
    // WatercolorModuleSection, which the paint-tab pin above proves is
    // watercolor-only.
    expect(panelSource, 'globals panel is not a direct panel mount').not.toMatch(
      /<AquarelleGlobalsPanel\b/,
    );
    expect(moduleSectionSource, 'WatercolorModuleSection mounts AquarelleGlobalsPanel').toMatch(
      /<AquarelleGlobalsPanel\b/,
    );
  });

  it('PhysicsPaintToolRail returns WatercolorRail only from its watercolor branch', () => {
    const body = stripComments(toolRailSource);
    const railMounts = [...body.matchAll(/<WatercolorRail\b/g)];
    expect(railMounts, 'exactly one WatercolorRail mount').toHaveLength(1);

    const mountAt = railMounts[0].index ?? 0;
    const before = body.slice(0, mountAt);
    const gateAt = before.lastIndexOf("activeModule.value === 'watercolor'");
    expect(gateAt, 'WatercolorRail must sit behind a watercolor gate').toBeGreaterThan(-1);
    expect(before.lastIndexOf('activeModule.value')).toBe(gateAt);

    // The non-watercolor return path is the existing brush-tools rail and
    // never mounts WatercolorRail.
    const nonWatercolor = body.slice(gateAt);
    const railNavAt = nonWatercolor.indexOf('physics-paint-tool-rail');
    expect(railNavAt, 'brush-tools rail stays the non-watercolor return').toBeGreaterThan(-1);
    expect(
      nonWatercolor.indexOf('<WatercolorRail'),
      'WatercolorRail mount sits before the brush-tools return',
    ).toBeLessThan(railNavAt);
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
    const paperTabEnd = panelSource.indexOf('physics-paint-single-tab-panel', paperTabStart);
    expect(paperTabEnd, 'paper-tab branch ends before the color fallback').toBeGreaterThan(paperTabStart);
    const paperTab = stripComments(panelSource.slice(paperTabStart, paperTabEnd));

    expect(paperTab, 'paper arm mounts the paper tab component').toMatch(/<RightPanelPaperTab\b/);
    expect(paperTab, 'paper arm stays shared (document-fond, I-07)').not.toMatch(/activeModule/);

    const paperTabBody = stripComments(paperTabSource);
    expect(paperTabBody, 'RightPanelPaperTab mounts PaperPicker').toMatch(/<PaperPicker\b/);
    expect(paperTabBody, 'RightPanelPaperTab stays ungated').not.toMatch(/activeModule/);
  });

  it('top-pane tab row is mode-derived with no Actions or Brush entry', () => {
    // 261018-cy1 + I-11 / D: brush mode = Color + Paper; watercolor mode =
    // Color + Settings + Paper. The retired top-pane Actions entry is gone.
    // 261027-gh9g: the Brush tab is retired too (top-bar picker + modal).
    // quick-261023-ors: 'memory' is LAST in BOTH modes.
    expect(panelSource, 'brush-mode tab list').toContain("['color', 'paper', 'memory']");
    expect(panelSource, 'watercolor tab list').toContain(
      "['color', 'settings', 'paper', 'memory']",
    );
    expect(panelSource, 'no actions id in the tab list').not.toMatch(
      /\[\s*'color',\s*'actions'/,
    );
    expect(panelSource, 'topPaneTab union drops actions').toContain(
      "useState<'color' | 'brush' | 'settings' | 'paper' | 'memory'>",
    );
    expect(panelSource, 'no Brush tab body is mounted').not.toMatch(/<RightPanelBrushTab\b/);
    expect(panelSource, 'settings body is watercolor-gated').toContain(
      "effectiveTopPaneTab === 'settings' && isWatercolorModule",
    );
    expect(panelSource, 'stale settings tab falls back in brush mode').toContain(
      "topPaneTab === 'settings' && !isWatercolorModule",
    );
    // Labels stay the human names (no Watercolor tab).
    expect(panelSource, 'Color label stays').toContain("color: 'Color'");
    expect(panelSource, 'Brush label stays').toContain("brush: 'Brush'");
    expect(panelSource, 'Settings label stays').toContain("settings: 'Settings'");
    expect(panelSource, 'Paper label stays').toContain("paper: 'Paper'");
    // quick-261023-ors: the Memory tab is the LAST top-pane tab.
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
    // The memory arm is available in BOTH modes — never watercolor-gated.
    const memoryArm = panelSource.slice(memoryAt, colorFallbackAt);
    expect(memoryArm).toMatch(/<RightPanelMemoryTab\b/);
    expect(memoryArm).not.toMatch(/activeModule/);
    // An absent memorySection renders an empty body (no crash, no figures).
    expect(memoryArm).toContain('memorySection ? (');
  });
});
