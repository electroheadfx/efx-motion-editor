import {useSignal} from '@preact/signals';
import {useEffect, useRef} from 'preact/hooks';
import {playbackEngine} from '../../lib/playbackEngine';
import type {PhysicPaintLoopOperationIntent, PhysicPaintLoopOperationOpenRequest} from '../../lib/physicPaintBridge';
import {sequenceStore} from '../../stores/sequenceStore';
import {badgeTextForLoop, isZeroEffectiveLoop} from './loopCapsuleGeometry';
import {
  timelineLoopCapsuleTooltipRequest,
  type TimelineLoopCapsuleTooltipRequest,
} from './TimelineInteraction';

export const TIMELINE_CAPSULE_TOOLTIP_DELAY_MS = 1000;
export const TIMELINE_CAPSULE_TOOLTIP_VIEWPORT_MARGIN = 8;

export type TimelineCapsuleTooltipAction =
  | 'Edit source frame'
  | 'Duplicate linked loop'
  | 'Repair loop…'
  | 'Relink loop…'
  | 'Unlink loop'
  | 'Delete loop';

export interface TimelineCapsuleTooltipModel {
  readonly lines: readonly string[];
  readonly actions: readonly TimelineCapsuleTooltipAction[];
}

export interface TimelineCapsuleLoopOpResult {
  readonly ok: boolean;
  readonly reason: string | null;
}

export interface TimelineCapsuleTooltipOps {
  readonly editSourceFrame: (loopId: string, sourceAppFrame: number) => Promise<TimelineCapsuleLoopOpResult>;
  readonly duplicateLinkedLoop: (loopId: string, destinationStart: number) => Promise<TimelineCapsuleLoopOpResult>;
  readonly unlinkLoop: (loopId: string) => Promise<TimelineCapsuleLoopOpResult>;
  readonly deleteLoop: (loopId: string) => Promise<TimelineCapsuleLoopOpResult>;
  readonly repairLoop: (loopId: string) => Promise<TimelineCapsuleLoopOpResult>;
  readonly relinkLoop: (loopId: string, targetKeyIds: readonly string[]) => Promise<TimelineCapsuleLoopOpResult>;
  readonly promptDestinationStart: () => number | null;
  readonly promptRelinkKeyIds: () => readonly string[] | null;
}

function requestedDuration(request: TimelineLoopCapsuleTooltipRequest): string {
  const {capsule} = request;
  if (capsule.repeat === 'infinity' || capsule.requestedEnd === 'infinity') return '∞';
  return `${capsule.cycleLength * capsule.repeat}f`;
}

function effectiveDuration(request: TimelineLoopCapsuleTooltipRequest): number {
  return Math.max(0, request.capsule.effectiveEnd - request.capsule.placementStart);
}

/** Exact English-only copy contract. Every item is rendered as its own text
 * node; missing source IDs are never interpreted as markup. */
export function buildTimelineCapsuleTooltipModel(
  request: TimelineLoopCapsuleTooltipRequest,
  guardReason: string | null = null,
): TimelineCapsuleTooltipModel {
  const {capsule, hit} = request;
  let lines: string[];
  let actions: TimelineCapsuleTooltipAction[];
  if (capsule.unresolved) {
    lines = [
      ...capsule.unresolved.missingSourceKeyIds.map((keyId) => `Missing source reference: ${keyId}`),
      'Repair, relink, unlink, or delete the loop.',
    ];
    actions = ['Repair loop…', 'Relink loop…', 'Unlink loop', 'Delete loop'];
  } else if (isZeroEffectiveLoop(capsule)) {
    lines = [`${badgeTextForLoop(capsule)} · Effective 0f — fully shortened by the next clip`];
    actions = ['Duplicate linked loop', 'Unlink loop', 'Delete loop'];
  } else if (hit.region === 'occurrence') {
    lines = [`Repeat ${hit.repeatInstance} · Source frame ${hit.sourceIndex + 1} of ${capsule.cycleLength}`];
    actions = ['Edit source frame', 'Duplicate linked loop', 'Unlink loop', 'Delete loop'];
  } else if (capsule.truncated && hit.region === 'truncation') {
    lines = [
      badgeTextForLoop(capsule),
      `Requested ${requestedDuration(request)}`,
      `Effective ${effectiveDuration(request)}f`,
      `Loop shortened by next clip (${capsule.partialCycle ? 'partial cycle' : 'complete cycles'})`,
      capsule.mode === 'progressive' ? 'Progressive' : 'Static / Hold',
    ];
    actions = ['Duplicate linked loop', 'Unlink loop', 'Delete loop'];
  } else {
    lines = [badgeTextForLoop(capsule), capsule.mode === 'progressive' ? 'Progressive' : 'Static / Hold'];
    actions = ['Duplicate linked loop', 'Unlink loop', 'Delete loop'];
  }
  if (guardReason) lines = [...lines, guardReason];
  return {lines, actions};
}

export function computeTimelineCapsuleTooltipPosition(
  anchor: {readonly x: number; readonly y: number},
  size: {readonly width: number; readonly height: number},
  viewport: {readonly width: number; readonly height: number},
): {left: number; top: number} {
  const margin = TIMELINE_CAPSULE_TOOLTIP_VIEWPORT_MARGIN;
  return {
    left: Math.min(Math.max(anchor.x, margin), Math.max(margin, viewport.width - size.width - margin)),
    top: Math.min(Math.max(anchor.y, margin), Math.max(margin, viewport.height - size.height - margin)),
  };
}

/** Event-driven visibility controller for a canvas anchor. It mirrors the
 * Studio tooltip lifecycle without manufacturing one DOM anchor per capsule. */
export class TimelineCapsuleTooltipVisibility {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private mounted = true;

  constructor(private readonly publish: (visible: boolean) => void) {}

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  hover(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.mounted) this.publish(true);
    }, TIMELINE_CAPSULE_TOOLTIP_DELAY_MS);
  }

  focus(): void {
    this.clearTimer();
    if (this.mounted) this.publish(true);
  }

  leave(): void {
    this.clearTimer();
    if (this.mounted) this.publish(false);
  }

  escape(): void {
    this.leave();
  }

  dispose(): void {
    this.mounted = false;
    this.clearTimer();
  }
}

export async function runTimelineCapsuleTooltipAction(
  action: TimelineCapsuleTooltipAction,
  request: TimelineLoopCapsuleTooltipRequest,
  ops: TimelineCapsuleTooltipOps,
): Promise<TimelineCapsuleLoopOpResult> {
  const loopId = request.capsule.loopId;
  if (action === 'Edit source frame') {
    const sourceIndex = request.hit.region === 'occurrence' ? request.hit.sourceIndex : 0;
    const sourceFrame = request.capsule.firstCycleCells[sourceIndex]?.sourceAppFrame;
    if (sourceFrame === null || sourceFrame === undefined) return {ok: false, reason: 'The source frame is unavailable.'};
    return ops.editSourceFrame(loopId, sourceFrame);
  }
  if (action === 'Duplicate linked loop') {
    const destination = ops.promptDestinationStart();
    if (destination === null) return {ok: false, reason: 'Choose a destination start frame.'};
    return ops.duplicateLinkedLoop(loopId, destination);
  }
  if (action === 'Repair loop…') return ops.repairLoop(loopId);
  if (action === 'Relink loop…') {
    const keyIds = ops.promptRelinkKeyIds();
    if (!keyIds?.length) return {ok: false, reason: 'Choose a non-empty existing source cycle to relink to.'};
    return ops.relinkLoop(loopId, keyIds);
  }
  return action === 'Delete loop' ? ops.deleteLoop(loopId) : ops.unlinkLoop(loopId);
}

function findLayerRequest(request: TimelineLoopCapsuleTooltipRequest) {
  for (const sequence of sequenceStore.sequences.peek()) {
    const layer = sequence.layers.find((candidate) => candidate.source.type === 'physic-paint'
      && candidate.source.layerId === request.layerId);
    if (layer) return {layer, frame: sequence.inFrame ?? 0};
  }
  return null;
}

type TimelineLoopOperationBridgeRequest = (
  request: PhysicPaintLoopOperationOpenRequest & PhysicPaintLoopOperationIntent,
) => Promise<TimelineCapsuleLoopOpResult>;

export function createTimelineCapsuleTooltipOps(
  request: TimelineLoopCapsuleTooltipRequest,
  bridgeRequest?: TimelineLoopOperationBridgeRequest,
  prompts: Pick<TimelineCapsuleTooltipOps, 'promptDestinationStart' | 'promptRelinkKeyIds'> = {
    promptDestinationStart: () => {
      if (typeof window === 'undefined') return null;
      const answer = window.prompt('Destination start frame');
      if (answer === null || answer.trim() === '') return null;
      const parsed = Number(answer);
      return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
    },
    promptRelinkKeyIds: () => {
      if (typeof window === 'undefined') return null;
      const answer = window.prompt('Existing source key IDs, comma-separated');
      return answer?.split(',').map((item) => item.trim()).filter(Boolean) ?? null;
    },
  },
): TimelineCapsuleTooltipOps {
  const result = (ok: boolean, reason: string | null = null): TimelineCapsuleLoopOpResult => ({ok, reason});
  const run = async (loopId: string, intent: PhysicPaintLoopOperationIntent) => {
    const target = findLayerRequest(request);
    if (!target) return result(false, 'The Physics Paint layer is unavailable.');
    const requestOperation = bridgeRequest
      ?? (await import('../../lib/physicPaintBridge')).requestPhysicPaintLoopOperation;
    return requestOperation({...target, loopId, ...intent});
  };
  return {
    editSourceFrame: async (_loopId, sourceAppFrame) => {
      playbackEngine.seekToFrame(request.sequenceStartFrame + sourceAppFrame);
      return result(true);
    },
    duplicateLinkedLoop: (loopId, destinationStart) => run(loopId, {kind: 'duplicate-linked-loop', destinationStart}),
    unlinkLoop: (loopId) => run(loopId, {kind: 'unlink-loop'}),
    deleteLoop: (loopId) => run(loopId, {kind: 'delete-loop'}),
    repairLoop: (loopId) => run(loopId, {kind: 'repair-loop'}),
    relinkLoop: (loopId, sourceKeyIds) => run(loopId, {kind: 'relink-loop', sourceKeyIds}),
    ...prompts,
  };
}

export function TimelineCapsuleTooltip(props: {readonly ops?: TimelineCapsuleTooltipOps}) {
  const visible = useSignal(false);
  const activeRequest = useSignal<TimelineLoopCapsuleTooltipRequest | null>(null);
  const guardReason = useSignal<string | null>(null);
  const visibilityRef = useRef<TimelineCapsuleTooltipVisibility | null>(null);
  if (!visibilityRef.current) visibilityRef.current = new TimelineCapsuleTooltipVisibility((next) => { visible.value = next; });
  const request = timelineLoopCapsuleTooltipRequest.value;

  useEffect(() => {
    const visibility = visibilityRef.current!;
    if (!request) {
      visibility.leave();
      activeRequest.value = null;
      return;
    }
    activeRequest.value = request;
    guardReason.value = null;
    if (request.pinned) visibility.focus();
    else visibility.hover();
  }, [request]);

  const isVisible = visible.value;
  useEffect(() => {
    if (!isVisible || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') visibilityRef.current?.escape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isVisible]);

  useEffect(() => () => visibilityRef.current?.dispose(), []);

  const current = activeRequest.value;
  if (!isVisible || !current) return null;
  const model = buildTimelineCapsuleTooltipModel(current, guardReason.value);
  const width = 320;
  const height = 28 + model.lines.length * 18 + (current.pinned ? 40 : 0);
  const viewport = {
    width: typeof window === 'undefined' ? width + 16 : window.innerWidth,
    height: typeof window === 'undefined' ? height + 16 : window.innerHeight,
  };
  const position = computeTimelineCapsuleTooltipPosition(
    {x: current.clientX + 8, y: current.clientY + 8},
    {width, height},
    viewport,
  );
  const ops = props.ops ?? createTimelineCapsuleTooltipOps(current);

  const activate = async (action: TimelineCapsuleTooltipAction) => {
    const operation = await runTimelineCapsuleTooltipAction(action, current, ops);
    guardReason.value = operation.ok ? null : operation.reason;
    if (operation.ok && (action === 'Unlink loop' || action === 'Delete loop')) {
      timelineLoopCapsuleTooltipRequest.value = null;
    }
  };

  return (
    <div
      role="tooltip"
      class="fixed z-50 max-w-80 rounded-md border border-[var(--color-tooltip-border)] bg-[var(--color-tooltip-bg)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-lg"
      style={{left: `${position.left}px`, top: `${position.top}px`, width: `${width}px`, pointerEvents: current.pinned ? 'auto' : 'none'}}
      onPointerLeave={() => { if (!current.pinned) visibilityRef.current?.leave(); }}
    >
      <div class="flex flex-col gap-1">
        {model.lines.map((line) => <span key={line}>{line}</span>)}
      </div>
      {current.pinned && (
        <div class="mt-2 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2">
          {model.actions.map((action) => (
            <button key={action} type="button" class="rounded px-2 py-1 hover:bg-[var(--hover)]" onClick={() => { void activate(action); }}>
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
