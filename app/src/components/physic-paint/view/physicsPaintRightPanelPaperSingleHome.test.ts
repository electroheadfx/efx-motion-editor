// ============================================================
//  261017-fz3 Task 1 — exactly one PaperPicker mount.
//
//  Source-scan pin (same idiom as projectPaperRaster.test.ts):
//  readFileSync PhysicsPaintRightPanel.tsx and assert the Paint
//  tab shared block carries NO PaperPicker — paper lives in the
//  Paper tab only (user asked twice).
//
//  261017-vcn I-04 remainder — the Paper tab is the SINGLE home
//  for paper + background: grain pair at the TOP (Q6), then the
//  Transparent + White arms, then the locked 13-cell grid. The
//  top bar drops its Background / Grain rows. One grain pair
//  writes both write-throughs (paper-display record AND document
//  fallback / track metadata).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const panelSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/PhysicsPaintRightPanel.tsx'),
  'utf8',
);
const paperTabSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/RightPanelPaperTab.tsx'),
  'utf8',
);
const pickerSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/PaperPicker.tsx'),
  'utf8',
);
const topBarSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/PhysicsPaintTopBar.tsx'),
  'utf8',
);
const studioSource = readFileSync(
  resolve(root, 'src/components/physic-paint/PhysicsPaintStudio.tsx'),
  'utf8',
);

/** Strip block + line comments so negative scans never trip on docs. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('261017-fz3 PaperPicker single home', () => {
  it('mounts PaperPicker exactly once in RightPanelPaperTab.tsx (I-10 adoption)', () => {
    // 261018-0ox I-10: the single PaperPicker home moved out of the panel into
    // RightPanelPaperTab; the panel mounts that tab component once.
    const mounts = paperTabSource.match(/<PaperPicker\b/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(panelSource, 'panel no longer mounts PaperPicker directly').not.toMatch(/<PaperPicker\b/);
    const panelMounts = panelSource.match(/<RightPanelPaperTab\b/g) ?? [];
    expect(panelMounts, 'panel mounts RightPanelPaperTab once').toHaveLength(1);
  });

  it('surviving mount sits in the Paper tab branch, not the Paint tool tab', () => {
    const paperTabIndex = panelSource.indexOf("effectiveTopPaneTab === 'paper'");
    expect(paperTabIndex).toBeGreaterThan(-1);

    // The Paint tool tab branch runs from the paint-tab test to the background
    // arm; the Paper-tab component must not live in it.
    const paintTabStart = panelSource.indexOf("effectiveToolTab === 'paint'");
    expect(paintTabStart).toBeGreaterThan(-1);
    const paintTabEnd = panelSource.indexOf("effectiveToolTab === 'background'", paintTabStart);
    expect(paintTabEnd).toBeGreaterThan(paintTabStart);
    const paintTab = panelSource.slice(paintTabStart, paintTabEnd);
    expect(paintTab).not.toContain('<RightPanelPaperTab');
    expect(paintTab).not.toContain('<PaperPicker');

    // The single RightPanelPaperTab mount is after the paper-tab branch marker.
    const mountIndex = panelSource.indexOf('<RightPanelPaperTab');
    expect(mountIndex).toBeGreaterThan(paperTabIndex);
  });

  it('Paint tab branch hosts the size/opacity pair above the MODULE-ONLY switch (261018-f15)', () => {
    // 261017-w4x I-05 (Q3): the shared wrapper + Opacity option-group left.
    // 261018-f15 C2: a Brush size + Opacity write-through pair sits at the TOP.
    const paintTabStart = panelSource.indexOf("effectiveToolTab === 'paint'");
    expect(paintTabStart).toBeGreaterThan(-1);
    const paintTabEnd = panelSource.indexOf("effectiveToolTab === 'background'", paintTabStart);
    expect(paintTabEnd).toBeGreaterThan(paintTabStart);
    const paintTab = panelSource.slice(paintTabStart, paintTabEnd);

    // Negative region scan: none of the retired shared-block markers remain.
    expect(paintTab.indexOf('physics-paint-shared-block'), 'shared wrapper must leave').toBe(-1);
    expect(paintTab.indexOf('data-shared-block'), 'data-shared-block must leave').toBe(-1);
    expect(paintTab.indexOf('shared-opacity'), 'shared-opacity must leave').toBe(-1);
    expect(paintTab.indexOf('<SectionLabel text="Opacity"'), 'Opacity option-group must leave').toBe(-1);

    // The size pair precedes the MODULE-ONLY switch.
    expect(paintTab.indexOf('MODULE-ONLY block')).toBeGreaterThan(-1);
    expect(paintTab.indexOf('WatercolorModuleSection')).toBeGreaterThan(-1);
    // 261027-klx: the Brush-module section left with engine 1 — Water color is
    // the only module surface in the Paint tab.
    expect(paintTab.indexOf('BrushModuleSection'), 'Brush module section must leave').toBe(-1);
    const pairAt = paintTab.indexOf('paint-tab-size-opacity');
    const moduleSwitchIndex = paintTab.indexOf('WatercolorModuleSection');
    expect(pairAt, 'size/opacity pair must mount').toBeGreaterThan(-1);
    expect(pairAt, 'pair precedes the module switch').toBeLessThan(moduleSwitchIndex);
    expect(moduleSwitchIndex).toBeGreaterThan(paintTab.indexOf('MODULE-ONLY block'));
  });
});

// 261017-vcn I-04 remainder — three locked moves. Source-scan pins, same
// idiom as the single-home contract above (source-scan + vnode materialize).
describe('261017-vcn I-04 remainder paper-tab single home', () => {
  it('Paper tab order is grain pair → flat popover (arms in Real); D-10 bottom pair is gone', () => {
    // Pin 1: grain pair at the top; Transparent/White join the Real section
    // INSIDE the flat popover (261018-f15). Anchor on structural markers.
    const body = stripComments(pickerSource);
    const grainIdx = body.indexOf('data-paper-picker-grain');
    const gridIdx = body.indexOf('data-paper-picker-popover');
    const armsIdx = body.indexOf('data-paper-picker-backgrounds');
    expect(grainIdx, 'grain section must sit at the top of the Paper tab').toBeGreaterThan(-1);
    expect(gridIdx, 'flat popover must stay').toBeGreaterThan(-1);
    expect(armsIdx, 'Transparent/White arms must join the Real section').toBeGreaterThan(-1);
    expect(grainIdx).toBeLessThan(gridIdx);
    // Arms live inside the popover (Real section), not before it.
    expect(gridIdx).toBeLessThan(armsIdx);
    // Names stay Grain strength + Grain scale (Q6).
    expect(body.indexOf('Grain strength'), 'Grain strength name must stay').toBeGreaterThan(-1);
    expect(body.indexOf('Grain scale'), 'Grain scale name must stay').toBeGreaterThan(-1);
    expect(body.indexOf('Transparent'), 'Transparent arm must stay').toBeGreaterThan(-1);
    expect(body.indexOf("'White'"), 'White arm must stay').toBeGreaterThan(-1);
    // The D-10 bottom Strength/Scale pair leaves (one grain pair only).
    expect(pickerSource.indexOf('data-paper-picker-sliders'), 'bottom pair must leave').toBe(-1);
    expect(pickerSource.indexOf('paper-strength'), 'paper-strength id must leave').toBe(-1);
    expect(pickerSource.indexOf('paper-scale'), 'paper-scale id must leave').toBe(-1);
    // 261018-f15: the inner scroller goes — the outer SidebarScrollArea owns it.
    expect(body.indexOf('maxHeight'), 'no inner maxHeight').toBe(-1);
    expect(body.indexOf('overflowY'), 'no inner overflowY').toBe(-1);
  });

  it('top bar keeps status + brush trigger + Brush size + Opacity only', () => {
    // Pin 2: Background / Grain strength / Grain scale rows and those props
    // are gone; Brush size + Opacity remain. Scalar predicates keep TAP
    // diagnostics one-line (project idiom).
    const body = stripComments(topBarSource);
    expect(body.includes('Brush size'), 'Brush size must remain').toBe(true);
    expect(body.includes('Opacity'), 'Opacity must remain').toBe(true);
    // 261027-gh9g: the module switcher left the Studio top bar; the enlarged
    // brush trigger owns that slot.
    expect(body.includes('ModuleSwitcher'), 'ModuleSwitcher must leave').toBe(false);
    expect(body.includes('TopBarBrushTrigger'), 'brush trigger must remain').toBe(true);
    expect(body.includes('physics-paint-status-pill'), 'status pill must remain').toBe(true);
    // The Background row leaves with the swatch group.
    expect(body.indexOf('Background'), 'Background row must leave the top bar').toBe(-1);
    expect(body.indexOf('Grain strength'), 'Grain strength row must leave the top bar').toBe(-1);
    expect(body.indexOf('Grain scale'), 'Grain scale row must leave the top bar').toBe(-1);
    expect(body.indexOf('BACKGROUND_OPTIONS'), 'BACKGROUND_OPTIONS must leave').toBe(-1);
    expect(body.indexOf('GRAIN_STRENGTH_OPTIONS'), 'GRAIN_STRENGTH_OPTIONS must leave').toBe(-1);
    // Props interface drops the retired ports.
    const propsStart = topBarSource.indexOf('export interface PhysicsPaintTopBarProps');
    const propsEnd = topBarSource.indexOf('}', propsStart);
    const propsBlock = topBarSource.slice(propsStart, propsEnd);
    for (const field of [
      'background:',
      'grainStrength:',
      'grainScale:',
      'onBackgroundChange:',
      'onGrainStrengthChange:',
      'onGrainScaleChange:',
    ]) {
      expect(propsBlock.indexOf(field), `TopBar props must drop ${field}`).toBe(-1);
    }
    expect(propsBlock.indexOf('brushSize:'), 'brushSize prop must remain').toBeGreaterThan(-1);
    expect(propsBlock.indexOf('opacity:'), 'opacity prop must remain').toBeGreaterThan(-1);
  });

  it('surviving grain handlers write settings + paper-display + metadata + fallback; one pair only', () => {
    // Pin 3: handleGrainStrengthChange / handleGrainScaleChange each write
    // setGrain* + physicPaintStore.setPaper* + setRotoBackgroundMetadata +
    // setBackgroundFallback. The paper-only pair is gone. Scalar predicates
    // keep TAP diagnostics one-line.
    for (const [handler, settingsWrite, paperWrite] of [
      ['handleGrainStrengthChange', 'setGrainStrength', 'setPaperStrength'],
      ['handleGrainScaleChange', 'setGrainScale', 'setPaperScale'],
    ] as const) {
      const start = studioSource.indexOf(`const ${handler}`);
      expect(start, `${handler} must exist`).toBeGreaterThan(-1);
      const next = studioSource.indexOf('\n  const ', start + 1);
      const body = studioSource.slice(start, next > -1 ? next : start + 900);
      expect(body.indexOf(settingsWrite), `${handler} must write the settings mirror`).toBeGreaterThan(-1);
      expect(body.indexOf(paperWrite), `${handler} must write the paper-display record`).toBeGreaterThan(-1);
      expect(body.indexOf('setRotoBackgroundMetadata'), `${handler} must write track metadata`).toBeGreaterThan(-1);
      expect(body.indexOf('setBackgroundFallback'), `${handler} must write the document fallback`).toBeGreaterThan(-1);
    }
    // One pair only — the paper-only strength/scale handlers leave.
    expect(studioSource.indexOf('const handlePaperStrengthChange'), 'paper-only strength handler must leave').toBe(-1);
    expect(studioSource.indexOf('const handlePaperScaleChange'), 'paper-only scale handler must leave').toBe(-1);
  });
});
