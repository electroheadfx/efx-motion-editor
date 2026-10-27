import { usePhysicsPaintSessionController, type PhysicsPaintDebugProof } from '../hooks/usePhysicsPaintSessionController';

type SessionInput = Parameters<typeof usePhysicsPaintSessionController>[0];

export function usePhysicsPaintWorkflowIntegration(input: { session: SessionInput }) {
  return usePhysicsPaintSessionController(input.session);
}

export type { PhysicsPaintDebugProof };
