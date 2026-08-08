export interface PhysicsPaintRotoSpacingProxy {
  readonly loopId: string;
  readonly sourceCycleId: string;
  readonly sourceKeyIds: readonly string[];
  readonly sourceKeyId: string;
  readonly sourceIndex: number;
}

export interface PhysicsPaintRotoSpacingSelection {
  readonly sourceCycleId: string;
  readonly sourceKeyIds: readonly string[];
  readonly selectedSourceKeyIds: readonly string[];
  readonly anchorSourceIndex: number;
}

export interface PhysicsPaintRotoSpacingCycle {
  readonly sourceKeyIds: readonly string[];
}

export type PhysicsPaintRotoSpacingSelectionGesture = 'plain' | 'toggle' | 'range';

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function hasUniqueBoundedKeyIds(sourceKeyIds: readonly string[]): boolean {
  return sourceKeyIds.length >= 2
    && sourceKeyIds.every(isBoundedKeyId)
    && new Set(sourceKeyIds).size === sourceKeyIds.length;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function getPhysicsPaintRotoSourceCycleId(sourceKeyIds: readonly string[]): string {
  return sourceKeyIds.map((keyId) => `${keyId.length}:${keyId}`).join('|');
}

function isValidProxy(proxy: PhysicsPaintRotoSpacingProxy): boolean {
  return isBoundedKeyId(proxy.loopId)
    && hasUniqueBoundedKeyIds(proxy.sourceKeyIds)
    && proxy.sourceCycleId === getPhysicsPaintRotoSourceCycleId(proxy.sourceKeyIds)
    && Number.isInteger(proxy.sourceIndex)
    && proxy.sourceIndex >= 0
    && proxy.sourceIndex < proxy.sourceKeyIds.length
    && proxy.sourceKeyIds[proxy.sourceIndex] === proxy.sourceKeyId;
}

function sameCycle(selection: PhysicsPaintRotoSpacingSelection, proxy: PhysicsPaintRotoSpacingProxy): boolean {
  return selection.sourceCycleId === proxy.sourceCycleId
    && arraysEqual(selection.sourceKeyIds, proxy.sourceKeyIds);
}

function freezeSelection(
  sourceKeyIds: readonly string[],
  selectedSourceKeyIds: readonly string[],
  anchorSourceIndex: number,
): PhysicsPaintRotoSpacingSelection {
  const frozenSourceKeyIds = Object.freeze([...sourceKeyIds]);
  return Object.freeze({
    sourceCycleId: getPhysicsPaintRotoSourceCycleId(frozenSourceKeyIds),
    sourceKeyIds: frozenSourceKeyIds,
    selectedSourceKeyIds: Object.freeze([...selectedSourceKeyIds]),
    anchorSourceIndex,
  });
}

export function selectPhysicsPaintRotoSpacingProxyPlain(
  _selection: PhysicsPaintRotoSpacingSelection | null,
  proxy: PhysicsPaintRotoSpacingProxy,
): PhysicsPaintRotoSpacingSelection | null {
  if (!isValidProxy(proxy)) return null;
  return freezeSelection(proxy.sourceKeyIds, [proxy.sourceKeyId], proxy.sourceIndex);
}

export function togglePhysicsPaintRotoSpacingProxy(
  selection: PhysicsPaintRotoSpacingSelection | null,
  proxy: PhysicsPaintRotoSpacingProxy,
): PhysicsPaintRotoSpacingSelection | null {
  if (!isValidProxy(proxy)) return null;
  if (selection === null || !sameCycle(selection, proxy)) {
    return selectPhysicsPaintRotoSpacingProxyPlain(null, proxy);
  }
  const selected = new Set(selection.selectedSourceKeyIds);
  if (selected.has(proxy.sourceKeyId)) selected.delete(proxy.sourceKeyId);
  else selected.add(proxy.sourceKeyId);
  const ordered = proxy.sourceKeyIds.filter((keyId) => selected.has(keyId));
  return ordered.length === 0 ? null : freezeSelection(proxy.sourceKeyIds, ordered, proxy.sourceIndex);
}

export function extendPhysicsPaintRotoSpacingProxyRange(
  selection: PhysicsPaintRotoSpacingSelection | null,
  proxy: PhysicsPaintRotoSpacingProxy,
): PhysicsPaintRotoSpacingSelection | null {
  if (!isValidProxy(proxy)) return null;
  if (selection === null || !sameCycle(selection, proxy)) {
    return selectPhysicsPaintRotoSpacingProxyPlain(null, proxy);
  }
  const start = Math.min(selection.anchorSourceIndex, proxy.sourceIndex);
  const end = Math.max(selection.anchorSourceIndex, proxy.sourceIndex);
  return freezeSelection(proxy.sourceKeyIds, proxy.sourceKeyIds.slice(start, end + 1), selection.anchorSourceIndex);
}

export function reconcilePhysicsPaintRotoSpacingSelection(
  selection: PhysicsPaintRotoSpacingSelection | null,
  cycles: readonly PhysicsPaintRotoSpacingCycle[],
): PhysicsPaintRotoSpacingSelection | null {
  if (selection === null) return null;
  if (!hasUniqueBoundedKeyIds(selection.sourceKeyIds)) return null;
  if (selection.sourceCycleId !== getPhysicsPaintRotoSourceCycleId(selection.sourceKeyIds)) return null;
  if (!Number.isInteger(selection.anchorSourceIndex)
    || selection.anchorSourceIndex < 0
    || selection.anchorSourceIndex >= selection.sourceKeyIds.length) return null;
  if (!Array.isArray(selection.selectedSourceKeyIds)) return null;
  const selected = new Set<string>();
  for (const keyId of selection.selectedSourceKeyIds) {
    if (!isBoundedKeyId(keyId) || selected.has(keyId) || !selection.sourceKeyIds.includes(keyId)) return null;
    selected.add(keyId);
  }
  const exactCycleExists = cycles.some((cycle) => (
    hasUniqueBoundedKeyIds(cycle.sourceKeyIds)
    && arraysEqual(cycle.sourceKeyIds, selection.sourceKeyIds)
  ));
  if (!exactCycleExists) return null;
  return freezeSelection(
    selection.sourceKeyIds,
    selection.sourceKeyIds.filter((keyId) => selected.has(keyId)),
    selection.anchorSourceIndex,
  );
}
