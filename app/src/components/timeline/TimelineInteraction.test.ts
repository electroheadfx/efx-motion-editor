import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const interaction = readFileSync(fileURLToPath(new URL('./TimelineInteraction.ts', import.meta.url)), 'utf8');
const canvas = readFileSync(fileURLToPath(new URL('./TimelineCanvas.tsx', import.meta.url)), 'utf8');

describe('Motion Editor passive Loop Clip marker interaction contract', () => {
  it('ignores former Loop Clip coordinates and keys in the Motion Editor', () => {
    for (const removed of [
      'LoopCapsuleHit',
      'getLoopCapsuleHitRegions',
      'hitTestLoopCapsule',
      'dispatchLoopCapsuleHit',
      'dispatchFocusedLoopCapsuleKey',
      'loopCapsuleHitTest',
      'selectedTimelineLoopClipId',
      'focusedTimelineLoopClipId',
      'hoveredTimelineLoopClipId',
      'timelineLoopCapsuleTooltipRequest',
      'openPhysicPaintLoopEdit',
      'requestPhysicPaintLoopOperation',
    ]) expect(interaction).not.toContain(removed);

    expect(canvas).not.toContain('TimelineCapsuleTooltip');
    expect(canvas).not.toContain('selectedLoopClipId');
    expect(canvas).not.toContain('hoveredLoopClipId');
    expect(canvas).not.toContain('focusedLoopClipId');
  });

  it('keeps Group lifecycle, Action navigation, and deferred edit operations unreachable from Motion Editor input', () => {
    for (const forbidden of [
      'repeatDurationMarkers',
      'syncState',
      'provenanceState',
      'linkedRotoLoopClipIds',
      'activeLinkedLoopClipId',
      'navigateLinkedGroup',
      'Update Action from Group Frame',
      'Relink',
      'Push Right',
      'Push Left',
      'Key Group',
      'Scissor',
      'delete-group-frame',
      'regenerate-group',
    ]) expect(interaction).not.toContain(forbidden);

    expect(interaction).toContain('const mode = this.fxDragModeFromX(e.clientX, fxTrack);');
    expect(interaction).toContain('playbackEngine.seekToFrame(frame);');
    expect(interaction).toContain('sequenceStore.reorderFxSequences(fromIndex, toIndex);');
  });
});

describe('Motion Editor playhead scrub audio contract (TIME-03)', () => {
  it('routes drag-scrub through the audible scrub port and stops the snippet on release', () => {
    // The drag-move branch carries the throttled snippet; click seeks keep the
    // plain silent seekToFrame port.
    expect(interaction).toContain('playbackEngine.scrubToFrame(frame);');
    // Pointer-up stops the snippet before the final silent re-anchor.
    expect(interaction).toContain('playbackEngine.scrubAudioEnd();');
    const releaseIndex = interaction.indexOf('playbackEngine.scrubAudioEnd();');
    const finalSyncIndex = interaction.indexOf('playbackEngine.seekToFrame(timelineStore.currentFrame.peek());');
    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(finalSyncIndex).toBeGreaterThan(releaseIndex);
  });
});
