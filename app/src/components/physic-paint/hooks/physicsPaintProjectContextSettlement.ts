import type { PhysicPaintLaunchContext, PhysicPaintProjectContext } from '../../../types/physicPaint';

/**
 * quick-260922-jss: order-independent controller for the project-context round
 * trip (the payload that carries the live layer list the Scripts panel's
 * Action-scope selector needs).
 *
 * WHY THE ARRIVAL ORDER IS UNDEFINED: the child realm pulls the project
 * context ONCE, read-only, at mount (`usePhysicsPaintParentBridge.ts:183`,
 * deliberately argument-less) while the launch context is published only at the
 * END of `applySettledLaunchContext`'s asynchronous hydration
 * (`usePhysicsPaintLaunchIntegration.ts`). Both paths are real, and either can
 * land first: the pull's response reaches `accept` before the settle published
 * a context, or after. Treating "no context yet" as "nothing to do" silently
 * discarded the ONLY payload that ever carries `project.layers`, so the layer
 * list — and with it the selector — never appeared.
 *
 * `peekLaunchContext()` and `applyContext()` are the ONLY ports: the controller
 * reads nothing else and owns no state other than its single stash slot.
 *
 * TERMINATION CONDITION: the stash is a single slot that `settle` consumes
 * exactly once (read into a local, then cleared), and nothing in this path
 * reacts to what `settle` returns — no effect, no subscription, no re-entrant
 * write — so no caller can re-arm the slot. Repeated payloads cannot
 * accumulate: the slot holds the newest one only.
 */
export interface PhysicsPaintProjectContextSettlement {
  /** Inbound project context from the main realm (already validated by the bridge). */
  accept: (project: PhysicPaintProjectContext) => void;
  /** Launch-side: fold any pending inbound payload into the context about to be published. */
  settle: (context: PhysicPaintLaunchContext) => PhysicPaintLaunchContext;
}

export interface PhysicsPaintProjectContextSettlementPorts {
  /** The launch context currently published in the child realm — null until the launch settles. */
  peekLaunchContext: () => PhysicPaintLaunchContext | null;
  /** Publish an updated context (launch state + the settled-context port). */
  applyContext: (context: PhysicPaintLaunchContext) => void;
}

export function createPhysicsPaintProjectContextSettlement(
  ports: PhysicsPaintProjectContextSettlementPorts,
): PhysicsPaintProjectContextSettlement {
  /** The newest payload that arrived before a launch context existed. Single slot, last write wins. */
  let stashed: PhysicPaintProjectContext | null = null;
  return {
    accept: (project) => {
      const current = ports.peekLaunchContext();
      if (!current) {
        // No context to apply to YET — hold the payload for the settle instead
        // of dropping the round trip's only carrier of `project.layers`.
        stashed = project;
        return;
      }
      ports.applyContext({ ...current, project });
    },
    settle: (context) => {
      if (!stashed) return context;
      // Consume exactly once: the slot is cleared before the new context is
      // handed out, so a second settle can never re-deliver this payload.
      const project = stashed;
      stashed = null;
      return { ...context, project };
    },
  };
}
