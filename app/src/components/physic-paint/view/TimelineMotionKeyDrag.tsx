/**
 * 261107-pd8: the thin drag leaf for a Phase 59 motion lane.
 *
 * It owns exactly ONE pointer session for one lane: it arms the pressed key,
 * projects the pointer travel into rail-local frames through the shared
 * `usePhysicsPaintKeyRailDrag` hook, clamps with the command layer's pure
 * nearest-free-frame helper, and forwards prepare/commit to the action bundle.
 * No listener, pointer capture or gesture lifecycle lives here — the hook owns
 * all of it, so the motion lane and the Key Rail cannot drift apart.
 */

import { useRef } from 'preact/hooks';
import { usePhysicsPaintKeyRailDrag } from '../hooks/usePhysicsPaintKeyRailDrag';
import type { RotoMotionKeyDragPublication } from '../hooks/useRotoTimelineActions';
import { clampRailMotionKeyDragFrame } from '../roto/railMotionCommands';
import type { PhysicPaintRotoRailMotionChannelId } from '../roto/railMotionModel';
import {
  TimelineMotionChannelLane,
  resolveDisplayLaneChannelId,
  resolveInBandMotionKeys,
  type TimelineMotionChannelLaneProps,
} from './TimelineMotionChannels';
import { TIMELINE_GEOMETRY, TIMELINE_MOTION } from './timelineRailDesign';

/** One key, one destination rail-local frame — never a batch. */
export interface MotionKeyDragRequest {
  readonly railId: string;
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  readonly fromFrame: number;
  readonly toFrame: number;
}

/** The action-bundle half of the drag, injected so this leaf stays testable. */
export interface TimelineMotionKeyDragPorts {
  readonly prepare: (request: MotionKeyDragRequest) => Readonly<
    | { ok: true; publication: RotoMotionKeyDragPublication }
    | { ok: false; reason?: string; detail?: string }
  >;
  readonly commit: (publication: RotoMotionKeyDragPublication) => Promise<boolean>;
  readonly onRejected?: (reason?: string, detail?: string) => void;
}

export interface TimelineMotionKeyDragLaneProps extends TimelineMotionChannelLaneProps {
  readonly dragPorts: TimelineMotionKeyDragPorts;
}

export function TimelineMotionKeyDragLane({
  dragPorts,
  ...laneProps
}: TimelineMotionKeyDragLaneProps) {
  const frameCount = Number.isFinite(laneProps.railFrameCount)
    ? Math.max(0, Math.floor(laneProps.railFrameCount))
    : 0;
  const keyFrames = resolveInBandMotionKeys(laneProps.lane.keys, frameCount)
    .map((key) => key.frame);
  const channelId = resolveDisplayLaneChannelId(laneProps.lane);

  // Latest-value pattern: the pointer session reads the CURRENT lane, ports
  // and band on every move without re-creating the session or its hook table.
  const latestRef = useRef({ laneProps, dragPorts, frameCount, keyFrames, channelId });
  latestRef.current = { laneProps, dragPorts, frameCount, keyFrames, channelId };
  const armedFrameRef = useRef<number | null>(null);

  const drag = usePhysicsPaintKeyRailDrag<RotoMotionKeyDragPublication>({
    projectDestination: ({ originClientX, clientX }) => {
      const armed = armedFrameRef.current ?? 0;
      // Frame delta over the lane's own column pitch: no measure is inlined.
      return armed + Math.round((clientX - originClientX) / TIMELINE_GEOMETRY.cellPitch);
    },
    clampDestination: (proposedFrame) => {
      const current = latestRef.current;
      const clamped = clampRailMotionKeyDragFrame({
        keyFrames: current.keyFrames,
        fromFrame: armedFrameRef.current ?? 0,
        proposedFrame,
        frameCount: current.frameCount,
      });
      return {
        destination: clamped.frame,
        left:
          clamped.frame * TIMELINE_GEOMETRY.cellPitch +
          (TIMELINE_MOTION.cellWidth - TIMELINE_MOTION.keySize) / 2,
        width: TIMELINE_MOTION.keySize,
        blockedEdge: clamped.blockedEdge,
      };
    },
    prepareAtDestination: (destination) => {
      const armed = armedFrameRef.current;
      if (armed === null) return { ok: false, reason: 'No Motion key is armed.' };
      const current = latestRef.current;
      return current.dragPorts.prepare({
        railId: current.laneProps.railId,
        channelId: current.channelId,
        fromFrame: armed,
        toFrame: destination,
      });
    },
    onDropCommit: (publication) => {
      armedFrameRef.current = null;
      return latestRef.current.dragPorts.commit(publication);
    },
    onCancel: () => {
      armedFrameRef.current = null;
    },
    onRejected: (reason, detail) => {
      armedFrameRef.current = null;
      latestRef.current.dragPorts.onRejected?.(reason, detail);
    },
    // This surface has no rail-click timer to cancel.
    clearClickSequence: () => {},
  });

  return (
    <TimelineMotionChannelLane
      {...laneProps}
      keyDrag={{
        onPointerDownKey: (event, frame) => {
          armedFrameRef.current = frame;
          drag.onPointerDown(event);
        },
        consumeClickSuppression: drag.consumeClickSuppression,
        ghost: drag.ghost,
      }}
    />
  );
}
