import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { usePhysicsPaintSessionController, type PhysicsPaintDebugProof } from '../hooks/usePhysicsPaintSessionController';
import { useRotoPlayConversionController, type RotoPlayConversionControllerInput } from '../hooks/useRotoPlayConversionController';

type SessionInput = Parameters<typeof usePhysicsPaintSessionController>[0];

export function usePhysicsPaintWorkflowIntegration<TFrame extends PhysicPaintRenderedFrame>(input: {
  session: SessionInput;
  conversion: RotoPlayConversionControllerInput<TFrame>;
}) {
  const sessionActions = usePhysicsPaintSessionController(input.session);
  const conversionActions = useRotoPlayConversionController(input.conversion);
  return { ...sessionActions, ...conversionActions };
}

export type PhysicsPaintWorkflowEngine = EfxPaintEngine;
export type { PhysicsPaintDebugProof };
