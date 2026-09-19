import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const source = () => readFileSync(sourcePath, 'utf8');
const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css');
const css = () => readFileSync(cssPath, 'utf8');
const trackRowPath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintTrackRow.tsx');
const trackRowSource = () => readFileSync(trackRowPath, 'utf8');
const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/usePhysicsPaintRulerScrub.ts');
const hookSource = () => readFileSync(hookPath, 'utf8');

function getMatchingDivEnd(code: string, start: number): number {
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(code)) !== null) {
    depth += match[0] === '</div>' ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  return -1;
}
function getRulerBlock(code: string): string {
  const anchor = code.indexOf('class="physics-paint-ruler"');
  if (anchor === -1) return '';
  const start = code.lastIndexOf('<div', anchor);
  const end = getMatchingDivEnd(code, start);
  return end === -1 ? '' : code.slice(start, end);
}

function getPlayheadComponentBlock(code: string): string {
  const start = code.indexOf('function PhysicsPaintPlayheadBar');
  if (start === -1) return '';
  const end = code.indexOf('\nfunction ', start + 1);
  return code.slice(start, end === -1 ? code.length : end);
}
function getPlayheadCssBlock(code: string): string {
  const start = code.indexOf('.physics-paint-playhead-bar {');
  if (start === -1) return '';
  const end = code.indexOf('}', start);
  return code.slice(start, end + 1);
}

describe('PhysicsPaintPlayheadBar contract', () => {
  it('renders the playhead bar overlay as the scroll container\'s last child, after the rows-region', () => {
    const code = source();
    expect(code).toContain('physics-paint-playhead-bar');
    const block = getPlayheadComponentBlock(code);
    expect(block).toContain('aria-hidden="true"');
    const scrollStart = code.indexOf('class="physics-paint-timeline-scroll"');
    expect(scrollStart).toBeGreaterThan(-1);
    const playheadRender = code.indexOf('<PhysicsPaintPlayheadBar', scrollStart);
    const rowsRegionTail = code.indexOf('renderActiveLane()}', scrollStart);
    expect(playheadRender).toBeGreaterThan(rowsRegionTail);
  });

  it('positions the bar with the 4px scroll-padding-inclusive cell-center offset', () => {
    const block = getPlayheadComponentBlock(source());
    // 4 = the timeline-scroll padding-left (ruler/cell origin); the pitch is
    // ROTO_CELL_WIDTH_PX; +8 centers the 2px line on the 18px cell.
    expect(block).toContain('4 +');
    expect(block).toContain('ROTO_CELL_WIDTH_PX');
    expect(block).toContain('+ 8');
  });

  it('reads the per-tick playback signal ONLY inside a playback-active guard', () => {
    const block = getPlayheadComponentBlock(source());
    // Mirrors the RotoPlaybackCurrentFrameOutput pattern: the tick signal is
    // dereferenced only while playback is active, so an idle strip holds zero
    // per-tick subscriptions.
    const guardedRead = block.match(/playbackActive\s*\?\s*\(?props\.playbackTick\?\.value\?\.appFrame/);
    expect(guardedRead).not.toBeNull();
  });

  it('creates no position state of its own — cursorAppFrame stays the single source', () => {
    const block = getPlayheadComponentBlock(source());
    expect(block).not.toContain('useSignal(');
    expect(block).not.toContain('signal(');
    expect(block).toContain('props.currentFrame.value');
  });

  it('is pointer-transparent, full-height, and accent-colored in CSS above the cell layers', () => {
    const block = getPlayheadCssBlock(css());
    expect(block).toContain('position: absolute');
    expect(block).toContain('top: 0');
    expect(block).toContain('bottom: 0');
    expect(block).toContain('pointer-events: none');
    expect(block).toContain('#A6D334');
    expect(block).toContain('z-index: 30');
  });

  it('makes the scroll container the positioning context and the ruler a pointer affordance', () => {
    const code = css();
    const scrollStart = code.indexOf('.physics-paint-timeline-scroll {');
    const scrollBlock = code.slice(scrollStart, code.indexOf('}', scrollStart) + 1);
    expect(scrollBlock).toContain('position: relative');
    expect(scrollBlock).toContain('padding-left: 4px');
    expect(scrollBlock).toContain('flex-direction: column');
    const rulerStart = code.indexOf('.physics-paint-ruler {');
    const rulerBlock = code.slice(rulerStart, code.indexOf('}', rulerStart) + 1);
    expect(rulerBlock).toContain('cursor: pointer');
  });
});

describe('Ruler seek hard contract (selection immunity)', () => {
  it('binds the ruler-scrub pointerdown while referencing NO selection or track-activation prop', () => {
    // Region-scoped to the ruler div only: the ruler gesture structurally
    // cannot mutate frame/key/rail selection or the active track.
    const block = getRulerBlock(source());
    expect(block).toContain('rulerScrub.onPointerDown');
    for (const forbidden of [
      'onSelectTrack',
      'onSelectTrackFrame',
      'onSelectTrackRail',
      'onSelectRotoKeyRail',
      'onSelectRotoLoopClip',
      'onToggleRotoKeySelection',
      'onCollapseRotoSelectionToKey',
      'onExtendRotoKeySelection',
      'onSelectAllRotoKeys',
      'onClearRotoKeySelection',
      'onSelectRotoSpacingProxy',
      'onClearRotoSpacingSelection',
    ]) {
      expect(block).not.toContain(forbidden);
    }
  });

  it('keeps the ruler-scrub hook a pure gesture hook — no store import, no selection reference', () => {
    const code = hookSource();
    expect(code).not.toContain('physicPaintStore');
    expect(code).not.toContain('efxPaintStore');
    expect(code).not.toContain('onSelect');
  });

  it('routes the ruler scrub lifecycle to the onScrubStart/onScrubEnd props (D-02 amendment)', () => {
    const code = source();
    const start = code.indexOf('const rulerScrub = usePhysicsPaintRulerScrub({');
    expect(start).toBeGreaterThan(-1);
    const end = code.indexOf('});', start);
    const block = code.slice(start, end + 3);
    expect(block).toContain('onScrubStart: () => props.onScrubStart?.()');
    expect(block).toContain('onScrubEnd: (frame) => props.onScrubEnd?.(frame)');
  });

  it('keeps the non-active row click select-then-navigate pair intact', () => {
    // Positive-shape gate: the existing row click behavior is asserted
    // unchanged (cell click selects the frame/key AND navigates).
    const code = trackRowSource();
    const start = code.indexOf('const handleRowClick');
    expect(start).toBeGreaterThan(-1);
    const end = code.indexOf('};', start);
    const block = code.slice(start, end + 2);
    expect(block).toContain('onSelectTrackFrame(trackId, frame)');
    expect(block).toContain('onSelectTrack?.(trackId)');
    expect(block).toContain('onNavigateToFrame?.(frame)');
  });
});
