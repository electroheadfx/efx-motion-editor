// ============================================================
//  I-08 — Brush-mode context gating (source-scan pin).
//
//  Watercolor-only surfaces (WatercolorModuleSection,
//  WatercolorBrushLibrary, BrushResponsePanel, AquarelleGlobalsPanel,
//  WatercolorRail) must sit behind `activeModule.value === 'watercolor'`.
//  The Paper tab stays shared document-fond vocabulary (I-07) — no
//  activeModule gate between the paper arm and the paper mount.
//  The top-pane tab row stays `color | actions | brush | paper`.
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
    // I-10: the Brush-tab body is RightPanelBrushTab (early-return module arm).
    const body = stripComments(brushTabSource);
    const gateAt = body.indexOf("activeModule.value === 'watercolor'");
    expect(gateAt, 'Brush tab keeps its watercolor gate').toBeGreaterThan(-1);
    const elseArmAt = body.indexOf('data-module="brush"');
    expect(elseArmAt, 'brush-module arm stays the non-watercolor return').toBeGreaterThan(gateAt);

    const watercolorArm = body.slice(gateAt, elseArmAt);
    expectMountsBehindWatercolorGate(watercolorArm, 'WatercolorBrushLibrary');
    expectMountsBehindWatercolorGate(watercolorArm, 'BrushResponsePanel');

    const brushArm = body.slice(elseArmAt);
    expect(brushArm, 'brush-module arm mounts BrushModuleSection').toMatch(/<BrushModuleSection\b/);
    expect(brushArm, 'watercolor mounts never leak into the brush-module arm').not.toMatch(
      /<WatercolorBrushLibrary\b|<BrushResponsePanel\b/,
    );
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

  it('Paper tab branch mounts the paper surface with no activeModule gate', () => {
    // I-10: the paper surface is RightPanelPaperTab (which mounts PaperPicker);
    // both the panel arm and the tab component stay ungated (I-07 document fond).
    const paperTabStart = panelSource.indexOf("topPaneTab === 'paper'");
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

  it('top-pane tab row stays color | actions | brush | paper', () => {
    expect(panelSource, 'tab id list unchanged').toContain("['color', 'actions', 'brush', 'paper']");
    expect(panelSource, 'topPaneTab union unchanged').toContain(
      "useState<'color' | 'actions' | 'brush' | 'paper'>",
    );
    // Labels stay the four human names (no restructure, no Watercolor tab).
    expect(panelSource, 'Color label stays').toContain("'Color'");
    expect(panelSource, 'Actions label stays').toContain("'Actions'");
    expect(panelSource, 'Brush label stays').toContain("'Brush'");
    expect(panelSource, 'Paper label stays').toContain("'Paper'");
  });
});
