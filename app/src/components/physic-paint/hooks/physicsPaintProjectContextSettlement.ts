import type { PhysicPaintLaunchContext, PhysicPaintProjectContext } from '../../../types/physicPaint';

/**
 * quick-260922-jss (STEP A — extraction, production behaviour UNCHANGED): the
 * project-context round trip used to live inline in the
 * `usePhysicsPaintProjectContextBridge` handler of
 * `usePhysicsPaintLaunchIntegration`. It is extracted here verbatim so the
 * arrival-order behaviour has a seam the Node harness can reach — no DOM, no
 * Tauri transport, no second webview realm — and can be pinned by tests before
 * it is changed.
 *
 * `peekLaunchContext()` and `applyContext()` are the ONLY ports: the controller
 * reads nothing else and owns no state other than what it is given.
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
  return {
    accept: (project) => {
      const current = ports.peekLaunchContext();
      if (!current) return;
      ports.applyContext({ ...current, project });
    },
    settle: (context) => context,
  };
}
