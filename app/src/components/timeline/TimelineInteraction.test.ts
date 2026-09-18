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

describe('FX span drag never reads the live timeline total (260918-o0n)', () => {
  it('resolves the FX drag range through the pure resolver and the store', () => {
    const start = interaction.indexOf('// FX range bar dragging');
    const end = interaction.indexOf('// Audio track height resize (INT-07)');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const region = interaction.slice(start, end);
    expect(region).toContain('resolveFxSpanDragRange(');
    expect(region).toContain('sequenceStore.updateFxSequenceRange(');
    expect(region).not.toContain('totalFrames');
  });

  it('drops the pointer ceiling only through getSpanDragFrame at capture and drag-move', () => {
    const calls = interaction.match(/getSpanDragFrame\(e\.clientX\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const definitionIndex = interaction.indexOf('private getSpanDragFrame(');
    expect(definitionIndex).toBeGreaterThan(-1);
    const definition = interaction.slice(definitionIndex, definitionIndex + 400);
    expect(definition).toContain('frameFromX(');
    expect(definition).toContain('null');
  });

  it('keeps the live-timeline clamp on the seek, scrub, and hit-test pointer paths', () => {
    // Unchanged shapes: every non-drag consumer still resolves through the clamped getFrame.
    expect(interaction).toContain('const frame = this.getFrame(e.clientX);');
    expect(interaction).toContain('playbackEngine.seekToFrame(frame);');
    expect(interaction).toContain('playbackEngine.seekToFrame(this.getFrame(e.clientX));');
    expect(interaction).toContain('const frame = this.snapFrame(this.getFrame(e.clientX));');
    expect(interaction).toContain('const clickFrame = this.getFrame(clientX);');
    expect(interaction).toContain('const globalFrame = this.getFrame(e.clientX);');
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
