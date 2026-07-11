import type { PhysicsPaintStudioViewProps } from '../view/PhysicsPaintStudioView';

export type PhysicsPaintStudioViewModel = PhysicsPaintStudioViewProps;

export function buildPhysicsPaintStudioViewModel(props: PhysicsPaintStudioViewProps): PhysicsPaintStudioViewModel {
  return props;
}

export function usePhysicsPaintStudioViewModel(props: PhysicsPaintStudioViewProps): PhysicsPaintStudioViewModel {
  return buildPhysicsPaintStudioViewModel(props);
}
