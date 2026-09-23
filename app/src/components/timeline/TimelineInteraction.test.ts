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

  it('keeps every FX-area row kind on the single shared drag path', () => {
    // fxTrackLayouts carries one entry per non-content sequence (generators,
    // Paint, Physic Paint, imported static-image / image-sequence / video), so
    // the drag branch must keep indexing that list rather than branching on the
    // layer kind. Fixing the one path fixes every row kind.
    const dispatchStart = interaction.indexOf('if (this.isInFxArea(e.clientY)) {');
    const dispatchEnd = interaction.indexOf('// Click in FX area but not on a bar', dispatchStart);
    expect(dispatchStart).toBeGreaterThan(-1);
    expect(dispatchEnd).toBeGreaterThan(dispatchStart);

    const dispatch = interaction.slice(dispatchStart, dispatchEnd);
    expect(dispatch).toContain('const fxIdx = this.fxTrackIndexFromY(e.clientY);');
    expect(dispatch).toContain('const fxTracks = fxTrackLayouts.peek();');
    expect(dispatch).toContain('this.fxDragModeFromX(e.clientX, fxTrack)');
    expect(dispatch).not.toContain('physic-paint');
    expect(dispatch).not.toContain('generator-');
    expect(dispatch).not.toContain('content-overlay');
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

describe('FX stack one-gesture drop + inline rename wiring (260923-kcs)', () => {
  it('routes the FX reorder commit through the insertion-point resolver and drops the length-1 clamp', () => {
    // One-gesture bottom drop: the commit site must translate fxDropIndexFromY's
    // [0, trackCount] insertion point via the pure resolver — the old
    // Math.min(dropFxIdx, fxTracks.length - 1) re-clamp destroyed it.
    expect(interaction).toContain('resolveFxReorderToIndex(');
    expect(interaction).not.toContain('Math.min(dropFxIdx, fxTracks.length - 1)');
  });

  it('registers a double-click listener and drives the inline rename edit signal', () => {
    // Inline double-click rename on the FX header name area — canvas overlay
    // input, no dialog — with the commit path reachable from the interaction.
    expect(interaction).toContain("addEventListener('dblclick'");
    expect(interaction).toContain('fxRenameEdit');
    expect(interaction).toContain('sequenceStore.rename(');
  });

  it('renders the inline rename input commit path on the canvas overlay', () => {
    expect(canvas).toContain('fxRenameEdit');
    expect(canvas).toContain('sequenceStore.rename(');
  });
});
