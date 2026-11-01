// ============================================================
//  quick-261025-awl Task 3 — Raster strip wiring (source pins).
//
//  The strip is a large render surface with no DOM harness; the
//  layout and copy contracts are pinned structurally:
//    - Stamp icon at size 18, visible label Raster, aria-label
//      "Raster the key";
//    - placement immediately before the Tools anchor;
//    - the confirmation reuses the Memory-tab classes with Cancel
//      before the destructive confirm;
//    - onRasterKey + the ownership signal are threaded from the
//      strip props to the memoized static chrome;
//    - the portaled dialog is fixed-positioned by CSS.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stripSource = readFileSync(
  resolve(__dirname, 'PhysicsPaintWorkflowStrip.tsx'),
  'utf8',
);
const cssSource = readFileSync(
  resolve(__dirname, '../physicsPaintStudio.css'),
  'utf8',
);

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

describe('quick-261025-awl Raster strip wiring', () => {
  it('imports Stamp and renders it at size 18', () => {
    expect(stripSource).toMatch(/import \{[^}]*\bStamp\b[^}]*\} from 'lucide-preact';/);
    expect(stripSource).toContain('<Stamp size={18} aria-hidden="true" />');
  });

  it('renders the Raster control immediately before the Tools anchor', () => {
    const liveStatus = stripSource.indexOf('<PhysicsPaintWorkflowLiveStatus capsuleText={props.capsuleText}');
    const rasterControl = stripSource.indexOf('<PhysicsPaintRasterKeyControl');
    const toolsAnchor = stripSource.indexOf(
      'class="physics-paint-roto-key-icon-action physics-paint-toolbox-button-anchor"',
    );

    expect(liveStatus).toBeGreaterThan(-1);
    expect(rasterControl).toBeGreaterThan(liveStatus);
    expect(toolsAnchor).toBeGreaterThan(rasterControl);
  });

  it('uses the exact Raster label and accessible name', () => {
    // quick-261101-f5v: the accessible name names the scope; the visible
    // label stays Raster in both modes (no header layout shift).
    expect(stripSource).toContain("aria-label={railMode ? 'Raster the rail' : 'Raster the key'}");
    expect(stripSource).toContain('<span class="physics-paint-roto-key-icon-label">Raster</span>');
  });

  it('reads the ownership signal only in the leaf (narrow subscription)', () => {
    const leafStart = stripSource.indexOf('function PhysicsPaintRasterKeyControl(');
    const leafEnd = stripSource.indexOf('interface PhysicsPaintWorkflowStaticChromeProps {', leafStart);
    const leaf = stripSource.slice(leafStart, leafEnd);

    expect(leafStart).toBeGreaterThan(-1);
    expect(leaf).toContain('const owner = props.ownerSignal.value;');
    expect(leaf).toContain('hasScript: owner !== null,');
    // The confirmation gate uses the signal reference, never a body read.
    expect(stripSource).toContain('{props.frameScriptOwner ? (');
  });

  it('threads onRasterKey and frameScriptOwner from the strip props to the static chrome', () => {
    // Strip props, static-chrome props, and the leaf's own inline props.
    expect(countOccurrences(stripSource, 'onRasterKey?: (frame: number) => void;')).toBe(3);
    expect(countOccurrences(stripSource, 'frameScriptOwner?: ReadonlySignal<FrameScriptOwner>;')).toBe(2);
    expect(stripSource).toContain('onRasterKey={props.onRasterKey}');
    expect(stripSource).toContain('frameScriptOwner={props.frameScriptOwner}');
  });

  it('portals the confirmation and reuses the Memory-tab classes', () => {
    expect(stripSource).toContain(
      'class="physics-paint-memory-confirmation physics-paint-raster-confirmation"',
    );
    expect(stripSource).toContain('class="physics-paint-memory-confirm-copy"');
    expect(stripSource).toContain('class="physics-paint-memory-confirm-actions"');
    expect(stripSource).toContain('class="physics-paint-memory-confirm-cancel"');
    expect(stripSource).toContain('class="physics-paint-memory-confirm-ok destructive"');
    expect(stripSource).toContain('createPortal(dialog, document.body)');
  });

  it('keeps Cancel before the destructive confirm and confirms only the current frame', () => {
    const cancelIndex = stripSource.indexOf('class="physics-paint-memory-confirm-cancel"');
    const confirmIndex = stripSource.indexOf('class="physics-paint-memory-confirm-ok destructive"');

    expect(cancelIndex).toBeGreaterThan(-1);
    expect(confirmIndex).toBeGreaterThan(cancelIndex);
    expect(stripSource).toContain('props.onRasterKey?.(props.currentFrame.peek());');
  });

  it('carries the exact dialog copy for the current key', () => {
    // quick-261101-f5v: the key copy names the SCOPE frame — the current
    // frame in key mode, the rail's own frame on a one-key rail.
    expect(stripSource).toContain('`Raster key ${scopeFrame}?`');
    expect(stripSource).toContain(
      "This removes the key's Brush and Water color script and keeps the painted pixels. Move, Select and replay are lost for this key.",
    );
    expect(stripSource).toContain('`Raster key ${scopeFrame}`');
    expect(stripSource).toContain("const dialogConfirm = multiKeyRail ? 'Raster rail keys' : 'Raster key';");
  });

  it('threads the rail Raster bundle from the strip props to the leaf', () => {
    // Strip props, static-chrome props, and the leaf's own inline props.
    expect(countOccurrences(
      stripSource,
      "onRasterRail?: (kind: RasterRailTarget['kind'], railId: string) => void;",
    )).toBe(3);
    expect(countOccurrences(stripSource, 'rasterRailTarget?: ReadonlySignal<RasterRailTarget | null>;')).toBe(2);
    expect(countOccurrences(stripSource, 'railTargetSignal?: ReadonlySignal<RasterRailTarget | null>;')).toBe(1);
    expect(stripSource).toContain('onRasterRail={props.onRasterRail}');
    expect(stripSource).toContain('rasterRailTarget={props.rasterRailTarget}');
    expect(stripSource).toContain('railTargetSignal={props.rasterRailTarget}');
  });

  it('reads the rail target only in the leaf (narrow subscription)', () => {
    const leafStart = stripSource.indexOf('function PhysicsPaintRasterKeyControl(');
    const leafEnd = stripSource.indexOf('interface PhysicsPaintWorkflowStaticChromeProps {', leafStart);
    const leaf = stripSource.slice(leafStart, leafEnd);

    expect(leaf).toContain('const railTarget = props.railTargetSignal?.value ?? null;');
    // The strip body and the memoized chrome only forward the reference.
    expect(stripSource).not.toContain('props.rasterRailTarget?.value');
    expect(stripSource).not.toContain('props.rasterRailTarget.value');
  });

  it('dispatches the clicked rail identity in rail mode and keeps the frame dispatch otherwise', () => {
    expect(stripSource).toContain('props.onRasterRail?.(railTarget.kind, railTarget.railId)');
    expect(stripSource).toContain('props.onRasterKey?.(props.currentFrame.peek());');
  });

  it('carries the rail dialog copy beside the key copy', () => {
    expect(stripSource).toContain('`Raster rail keys ${railRange}?`');
    expect(stripSource).toContain('`Raster rail keys ${railRange}`');
    expect(stripSource).toContain(
      'Every scripted key on this rail loses its Brush and Water color script and keeps its painted pixels. Keys without cached pixels are skipped. Move, Select and replay are lost for those keys.',
    );
    expect(stripSource).toContain("const dialogConfirm = multiKeyRail ? 'Raster rail keys' : 'Raster key';");
  });

  it('keeps the rail copy single-sourced and out of the key branch', () => {
    // One occurrence each: the rail copy is written once, never duplicated
    // into the key branch.
    expect(countOccurrences(stripSource, '`Raster rail keys ${railRange}?`')).toBe(1);
    expect(countOccurrences(stripSource, '`Raster rail keys ${railRange}`')).toBe(1);
    expect(countOccurrences(stripSource, "'Raster rail keys'")).toBe(1);
    expect(countOccurrences(
      stripSource,
      'Every scripted key on this rail loses its Brush and Water color script and keeps its painted pixels. Keys without cached pixels are skipped. Move, Select and replay are lost for those keys.',
    )).toBe(1);
    // The single-key branch is reachable: one-key rails fall through to the
    // key copy with the rail's own frame.
    expect(stripSource).toContain('const multiKeyRail = railTarget !== null && railTarget.frames.length > 1;');
    expect(stripSource).toContain('const scopeFrame = railTarget !== null && railTarget.frames.length === 1');
    expect(stripSource).toContain('? railTarget.frames[0]!');
    expect(stripSource).toContain(': frame;');
    // The frame-mode copy literals survive.
    expect(stripSource).toContain('Raster key');
  });

  it('names the rail scope in the accessible name and the tooltip', () => {
    expect(stripSource).toContain("aria-label={railMode ? 'Raster the rail' : 'Raster the key'}");
    expect(stripSource).toContain(
      "\"Raster the rail — remove every key's script and keep the painted pixels.\"",
    );
    // The visible label never shifts between modes.
    expect(stripSource).toContain('<span class="physics-paint-roto-key-icon-label">Raster</span>');
  });

  it('never dispatches a rail request from a disabled (empty) rail', () => {
    const leafStart = stripSource.indexOf('function PhysicsPaintRasterKeyControl(');
    const leafEnd = stripSource.indexOf('interface PhysicsPaintWorkflowStaticChromeProps {', leafStart);
    const leaf = stripSource.slice(leafStart, leafEnd);
    const clickStart = leaf.indexOf('onClick={() => {');
    const clickEnd = leaf.indexOf('}}', clickStart);
    const click = leaf.slice(clickStart, clickEnd);

    expect(leaf).toContain('frameCount: railTarget.frames.length,');
    // The disabled gate returns before the dialog can open, so neither
    // dispatch is reachable on an empty rail.
    expect(click).toContain('if (presentation.disabled) return;');
    expect(click).not.toContain('onRasterRail');
    expect(click).not.toContain('onRasterKey');
  });

  it('closes on Escape and cycles Tab between the two buttons', () => {
    const leafStart = stripSource.indexOf('function PhysicsPaintRasterKeyControl(');
    const leafEnd = stripSource.indexOf('interface PhysicsPaintWorkflowStaticChromeProps {', leafStart);
    const leaf = stripSource.slice(leafStart, leafEnd);

    expect(leaf).toContain("if (event.key === 'Escape') {");
    expect(leaf).toContain("if (event.key !== 'Tab') return;");
    expect(leaf).toContain("'button:not(:disabled), [tabindex]:not([tabindex=\"-1\"])'");
  });

  it('styles the portaled confirmation as a fixed viewport panel', () => {
    const ruleStart = cssSource.indexOf('.physics-paint-raster-confirmation {');
    const ruleEnd = cssSource.indexOf('}', ruleStart);
    const rule = cssSource.slice(ruleStart, ruleEnd);

    expect(ruleStart).toBeGreaterThan(-1);
    expect(rule).toContain('position: fixed;');
    expect(rule).toContain('inset: auto;');
    expect(rule).toContain('z-index: 60;');
    expect(rule).toContain('width: 300px;');
    expect(rule).toContain('box-sizing: border-box;');
  });
});
