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
  it('mounts PaperPicker exactly once in PhysicsPaintRightPanel.tsx', () => {
    const mounts = panelSource.match(/<PaperPicker\b/g) ?? [];
    expect(mounts).toHaveLength(1);
  });

  it('surviving mount sits in the Paper tab branch, not the Paint shared block', () => {
    const paperTabIndex = panelSource.indexOf("topPaneTab === 'paper'");
    expect(paperTabIndex).toBeGreaterThan(-1);

    const sharedBlockStart = panelSource.indexOf('physics-paint-shared-block');
    expect(sharedBlockStart).toBeGreaterThan(-1);

    // The shared block runs until the MODULE-ONLY comment that follows it.
    const sharedBlockEnd = panelSource.indexOf('MODULE-ONLY block', sharedBlockStart);
    expect(sharedBlockEnd).toBeGreaterThan(sharedBlockStart);
    const sharedBlock = panelSource.slice(sharedBlockStart, sharedBlockEnd);
    expect(sharedBlock).not.toContain('<PaperPicker');

    // The single mount is after the paper-tab branch marker and before the
    // shared block (the Paper tab is the top pane; the shared block is the
    // Paint tool tab below).
    const mountIndex = panelSource.indexOf('<PaperPicker');
    expect(mountIndex).toBeGreaterThan(paperTabIndex);
  });

  it('Paint tab shared block still contains the Opacity option-group (shared-opacity)', () => {
    const sharedBlockStart = panelSource.indexOf('physics-paint-shared-block');
    const sharedBlockEnd = panelSource.indexOf('MODULE-ONLY block', sharedBlockStart);
    const sharedBlock = panelSource.slice(sharedBlockStart, sharedBlockEnd);
    expect(sharedBlock).toContain('shared-opacity');
    expect(sharedBlock).toContain('Opacity');
  });
});

// 261017-vcn I-04 remainder — three locked moves. Source-scan pins, same
// idiom as the single-home contract above (source-scan + vnode materialize).
describe('261017-vcn I-04 remainder paper-tab single home', () => {
  it('Paper tab order is grain pair → Transparent/White → grid; the D-10 bottom pair is gone', () => {
    // Pin 1: the rendered Paper-tab order is grain pair → Transparent/White →
    // grid. Anchor on the structural section markers (the JSX render order),
    // not on label substrings (warmProceduralReliefThumbs also contains
    // "Procedural"; BACKGROUND_ARMS constants sit above the component).
    const body = stripComments(pickerSource);
    const grainIdx = body.indexOf('data-paper-picker-grain');
    const armsIdx = body.indexOf('data-paper-picker-backgrounds');
    const gridIdx = body.indexOf('data-paper-picker-popover');
    expect(grainIdx, 'grain section must sit at the top of the Paper tab').toBeGreaterThan(-1);
    expect(armsIdx, 'Transparent/White arms must join the Paper tab').toBeGreaterThan(-1);
    expect(gridIdx, 'Procedural/Real grid must stay').toBeGreaterThan(-1);
    expect(grainIdx).toBeLessThan(armsIdx);
    expect(armsIdx).toBeLessThan(gridIdx);
    // Names stay Grain strength + Grain scale (Q6).
    expect(body.indexOf('Grain strength'), 'Grain strength name must stay').toBeGreaterThan(-1);
    expect(body.indexOf('Grain scale'), 'Grain scale name must stay').toBeGreaterThan(-1);
    expect(body.indexOf('Transparent'), 'Transparent arm must stay').toBeGreaterThan(-1);
    expect(body.indexOf("'White'"), 'White arm must stay').toBeGreaterThan(-1);
    // The D-10 bottom Strength/Scale pair leaves (one grain pair only).
    expect(pickerSource.indexOf('data-paper-picker-sliders'), 'bottom pair must leave').toBe(-1);
    expect(pickerSource.indexOf('paper-strength'), 'paper-strength id must leave').toBe(-1);
    expect(pickerSource.indexOf('paper-scale'), 'paper-scale id must leave').toBe(-1);
    // Names stay Grain strength + Grain scale (Q6).
    expect(pickerSource.indexOf('Grain scale'), 'Grain scale name must stay').toBeGreaterThan(-1);
  });

  it('top bar keeps status + ModuleSwitcher + Brush size + Opacity only', () => {
    // Pin 2: Background / Grain strength / Grain scale rows and those props
    // are gone; Brush size + Opacity remain. Scalar predicates keep TAP
    // diagnostics one-line (project idiom).
    const body = stripComments(topBarSource);
    expect(body.includes('Brush size'), 'Brush size must remain').toBe(true);
    expect(body.includes('Opacity'), 'Opacity must remain').toBe(true);
    expect(body.includes('ModuleSwitcher'), 'ModuleSwitcher must remain').toBe(true);
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
