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

describe('Physic-paint FX rail double-click opens Studio (261008-ful UAT)', () => {
  it('routes rail-body dblclick through the ONE shared launch path, physic-paint only', () => {
    const start = interaction.indexOf('private onDoubleClick(');
    const end = interaction.indexOf('private selectFxSequenceLayer(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const region = interaction.slice(start, end);

    // Body branch sits at/after the header boundary; the name area keeps rename.
    expect(region).toContain('if (localX >= TRACK_HEADER_WIDTH) {');
    expect(region).toContain("track.layerType === 'physic-paint'");
    expect(region).toContain('this.openStudioFromFxRail(track, e.clientX);');
    expect(region).toContain('timelineStore.fxRenameEdit.value = {');

    // The helper assembles nothing itself — payload lives in the shared bridge.
    expect(region).toContain('openPhysicPaintForLayer(layer, frame)');
    expect(region).not.toContain('openPhysicPaintCanvas(');
    expect(region).toContain('Number.isInteger(frame)');
  });

  it('advertises pointer cursor on physic-paint rail body hover, other kinds unchanged', () => {
    const start = interaction.indexOf('// Cursor hint: FX area');
    const end = interaction.indexOf('// Cursor hint: Audio area');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const region = interaction.slice(start, end);

    expect(region).toContain("fxTrack.layerType === 'physic-paint'");
    expect(region).toContain("this.canvas.style.cursor = 'pointer';");
    // Non-physic-paint kinds keep the drag-mode cursor ladder.
    expect(region).toContain('this.fxDragModeFromX(e.clientX, fxTrack)');
    // 261009-v0s: trim edges advertise ew-resize (was col-resize).
    expect(region).toContain("'ew-resize'");
    expect(region).not.toContain("'col-resize'");
    expect(region).toContain("'grab'");
  });
});

describe('Timeline hover cursor tokens (261009-v0s)', () => {
  it('edge zones of FX bars and audio clips resolve to ew-resize, even on physic-paint rails', () => {
    const hoverStart = interaction.indexOf('// Cursor hints (hover state)');
    const hoverEnd = interaction.indexOf('private onPointerUp(');
    expect(hoverStart).toBeGreaterThan(-1);
    expect(hoverEnd).toBeGreaterThan(hoverStart);
    const hover = interaction.slice(hoverStart, hoverEnd);

    // Edge hit-test wins over the physic-paint pointer hint (row body).
    // The FX header's own pointer comes first — skip past it.
    const fxBranch = hover.slice(
      hover.indexOf('// Cursor hint: FX area'),
      hover.indexOf('// Cursor hint: Audio area'),
    );
    const modeIndex = fxBranch.indexOf('const mode = this.fxDragModeFromX(e.clientX, fxTrack);');
    const edgeIndex = fxBranch.indexOf("this.canvas.style.cursor = 'ew-resize';", modeIndex);
    const pointerIndex = fxBranch.indexOf("this.canvas.style.cursor = 'pointer';", edgeIndex);
    expect(modeIndex).toBeGreaterThan(-1);
    expect(edgeIndex).toBeGreaterThan(modeIndex);
    expect(pointerIndex).toBeGreaterThan(edgeIndex);
    expect(fxBranch).toContain("mode === 'resize-left' || mode === 'resize-right'");
    expect(fxBranch).toContain("fxTrack.layerType === 'physic-paint'");

    // Audio clip edges use the same token.
    const audioBranch = hover.slice(
      hover.indexOf('// Cursor hint: Audio area'),
      hover.indexOf('// Name label hover'),
    );
    expect(audioBranch).toContain("this.canvas.style.cursor = 'ew-resize';");
    expect(audioBranch).not.toContain("'col-resize'");
  });

  it('active-drag trim on FX and audio bars advertises ew-resize', () => {
    expect(interaction).toContain("mode === 'move' ? 'grabbing' : 'ew-resize'");
    // Audio resize-start site (the INT-04 edge branch).
    expect(interaction).toContain("this.canvas.style.cursor = 'ew-resize';");
    // Slip keeps its existing ew-resize on alt; row-resize stays on the bottom edge.
    expect(interaction).toContain("mode === 'slip' ? 'ew-resize' : 'grabbing'");
    expect(interaction).toContain("this.canvas.style.cursor = 'row-resize';");
  });

  it('playhead 10px hover shows pointer via isOnPlayhead before the content-area default fallback', () => {
    const defaultIndex = interaction.indexOf("this.canvas.style.cursor = 'default';");
    const playheadIndex = interaction.indexOf('if (this.isOnPlayhead(e.clientX)) {');
    expect(defaultIndex).toBeGreaterThan(-1);
    // Exactly one hover-time isOnPlayhead consult (the pointer-down gate is separate).
    expect(interaction.match(/isOnPlayhead\(e\.clientX\)/g) ?? []).toHaveLength(2);
    expect(playheadIndex).toBeGreaterThan(-1);
    // The hover consult sits immediately before the default fallback.
    const fallbackAfterPlayhead = interaction.indexOf(
      "this.canvas.style.cursor = 'default';",
      playheadIndex,
    );
    expect(fallbackAfterPlayhead).toBeGreaterThan(playheadIndex);
    const playheadBody = interaction.slice(playheadIndex, fallbackAfterPlayhead);
    expect(playheadBody).toContain("this.canvas.style.cursor = 'pointer';");
    // Hit zone stays 10px — the helper is untouched.
    expect(interaction).toContain('return Math.abs(clientX - playheadX) <= 10;');
  });
});
