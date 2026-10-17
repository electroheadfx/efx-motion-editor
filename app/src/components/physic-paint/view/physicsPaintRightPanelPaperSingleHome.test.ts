// ============================================================
//  261017-fz3 Task 1 — exactly one PaperPicker mount.
//
//  Source-scan pin (same idiom as projectPaperRaster.test.ts):
//  readFileSync PhysicsPaintRightPanel.tsx and assert the Paint
//  tab shared block carries NO PaperPicker — paper lives in the
//  Paper tab only (user asked twice).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const panelSource = readFileSync(
  resolve(root, 'src/components/physic-paint/view/PhysicsPaintRightPanel.tsx'),
  'utf8',
);

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
