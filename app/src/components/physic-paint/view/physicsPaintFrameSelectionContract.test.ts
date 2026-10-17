// ============================================================
//  physicsPaintFrameSelectionContract — I-09 source-scan pins.
//
//  Frame/key selection stuck on the launch frame. The silent gates
//  live in statements that were swallowed by trailing `//` probe
//  comments (the whole statement sits on a comment line and never
//  runs) and in `completeNavigation` dropping `endOperation` when
//  the script engine is detached, which strands `busy` and makes
//  every later `prepareNavigation` return false.
//
//  Source-scan style: readFileSync the real sources and assert the
//  statements are live code (own line, not behind `//`). Vitest
//  only collects *.test.ts.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const clipboard = readFileSync(resolve(__dirname, '../roto/physicsPaintRotoScriptClipboard.ts'), 'utf8');
const scrubHook = readFileSync(resolve(__dirname, '../hooks/usePhysicsPaintRulerScrub.ts'), 'utf8');

/** Slice `source` from `startNeedle` to `endNeedle` (exclusive). */
function sliceBetween(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  expect(start, `start needle not found: ${startNeedle}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endNeedle, start);
  expect(end, `end needle not found: ${endNeedle}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** True when `needle` appears as live code — its line does not start with `//`. */
function isLiveStatement(source: string, needle: string): boolean {
  return source.split('\n').some((line) => {
    const trimmed = line.trimStart();
    return trimmed.includes(needle) && !trimmed.startsWith('//');
  });
}

describe('I-09 frame/key selection — swallowed-statement pins', () => {
  it('handleSelectTrackFrame calls setActiveTrackId as live code (not on a // probe line)', () => {
    // bacc26f0 probe comment swallowed `setActiveTrackId(layerId, trackId);`
    // on the same line as the trailing `// …display-state change).` — the
    // cross-track activation never ran and a frame click stayed on the
    // launch frame's track.
    const handler = sliceBetween(studio, 'const handleSelectTrackFrame = useCallback', 'const handleSelectTrackRail = useCallback');
    expect(isLiveStatement(handler, 'setActiveTrackId(layerId, trackId)')).toBe(true);
  });

  it('startFrame propagation reseeds selectedKeyId as live code', () => {
    // The same commit swallowed the reseed assignment in the setLaunchContext
    // startFrame branch — the click selection was never reconciled to the
    // landed frame's key.
    const reseedBranch = sliceBetween(studio, 'next.startFrame !== current?.startFrame', 'return next;');
    expect(
      isLiveStatement(
        reseedBranch,
        'selectedKeyId.value = physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, liveTrackId, next.startFrame)',
      ),
    ).toBe(true);
  });

  it('flush-failure path sets the error status as live code', () => {
    const navigate = sliceBetween(studio, 'const navigateToSyncedPhysicalFrame = useCallback', 'const lastReferenceDisplayStateRef');
    const catchBlock = navigate.slice(navigate.indexOf('catch {'));
    expect(isLiveStatement(catchBlock, "setApplyStatus('error')")).toBe(true);
  });
});

describe('I-09 frame/key selection — busy-lease release pin', () => {
  it('completeNavigation releases the busy lease even when the script engine is detached', () => {
    // completeNavigation used `const engine = engineState.peek(); if (engine)
    // endOperation(engine)` — a detached engine skipped endOperation, left
    // pendingOperationCount > 0 and busy stuck true, and every later
    // prepareNavigation silently returned false (the `void request…` dropped
    // it). The release must not depend on the CURRENT engine being non-null.
    const completeNav = sliceBetween(clipboard, 'function completeNavigation', 'function cancelApply');
    expect(completeNav).toMatch(/endOperation\(/);
    // The guarded `if (engine) endOperation(engine)` form is the leak.
    expect(completeNav).not.toMatch(/if \(engine\) endOperation/);
  });
});

describe('I-09 frame/key selection — scrub arm release pin', () => {
  it('ruler scrub cleanup always fires onScrubEnd when scrubbing had armed', () => {
    // cleanup() ran `options.onSeek(pendingFrame)` BEFORE `options.onScrubEnd`.
    // A throw in onSeek stranded scrubActiveRef at true and every later frame
    // click was swallowed into scrub-only mode. onScrubEnd must run even if
    // the final seek throws.
    const cleanup = sliceBetween(scrubHook, 'const cleanup = () => {', 'const handlePointerMove');
    const scrubbingBlock = cleanup.slice(cleanup.indexOf('if (session.scrubbing)'));
    // Positive: onScrubEnd still fires on the scrubbing path.
    expect(scrubbingBlock).toMatch(/onScrubEnd/);
    // The leak shape: onSeek can throw before onScrubEnd. The release pair
    // must be exception-safe (try/finally), so onScrubEnd always runs.
    expect(scrubbingBlock).toMatch(/finally/);
  });
});

describe('I-09 frame/key selection — Actions tab prop wiring pin', () => {
  it('right panel props include the Actions-tab handlers the panel requires', () => {
    // PhysicsPaintRightPanel destructures onUndo/onRedo/onClearFrame (required
    // by its props interface) but the Studio's rightPanelPropsMemo never passed
    // them — the Actions tab buttons called undefined on click.
    const rightPanelProps = sliceBetween(studio, 'const rightPanel = rightPanelPropsMemo.resolve', 'const playScriptConfirmationOpen');
    expect(isLiveStatement(rightPanelProps, 'onUndo:')).toBe(true);
    expect(isLiveStatement(rightPanelProps, 'onRedo:')).toBe(true);
    expect(isLiveStatement(rightPanelProps, 'onClearFrame:')).toBe(true);
  });
});
