// ============================================================
//  aquarelleLiftEraseContract — the Studio pipeline pins for
//  Lift (the eraser) across the three frame states (261028-k03).
//
//  The ordering below is the whole contract; every index
//  assertion guards a failure that shipped as a real bug in a
//  sibling quick:
//
//  1. D3 gate — a Lift pointerdown on a scripted frame with
//     Script OFF is stopped in the CAPTURE phase, before the
//     engine can erase the live sheet.
//  2. Preflight before the pin + the record — a refused lift
//     leaves no event and no half-written durable base.
//  3. An EMPTY frame is not a group refusal; it takes the live
//     sheet path.
//  4. The sheet snapshot is taken BEFORE the first await and the
//     frame's in-flight settle capture is drained BEFORE any
//     base read or capture.
//  5. RASTER-ONLY: the durable gate runs at the punch read AND the
//     set write back, rewrites a base this very stroke pinned
//     (willPinBase) with D^K, and never writes twice.
//  6. RASTER-ONLY: the commit is the existing physical-edit
//     transaction: baseCanvas + pigment-alpha + cachedBase null.
//  7. RASTER-ONLY: the display refresh follows the Apply precedent.
//  8. SCRIPTED (261028-k03b): never commits the composite — the
//     bake would discard it. Punch only the durable pre-script base,
//     end the sheet session, then re-bake the recorded timeline.
//  9. The engine's own lift dabs drive a live preview on the cached
//     base; the layer punches in place and never blanks the canvas
//     while a new URL decodes.
// 10. 261028-k03c: an unknown-base scripted lift RECOVERS the
//     pre-script base from the displayed composite (fail-closed at
//     ≤3/255) instead of refusing, and owns its single punch. The
//     raster commit retries once and bumps the strokes revision so
//     the erase survives leave/return; settle captures of the
//     lift-owned (track, frame) are fenced for the transaction.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const layer = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
const mount = readFileSync(resolve(__dirname, '../engine/PhysicsPaintCanvasMount.tsx'), 'utf8');
const baseLayer = readFileSync(resolve(__dirname, '../engine/AquarelleCachedBaseLayer.tsx'), 'utf8');

function slice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

function countOccurrences(source: string, literal: string): number {
  return source.split(literal).length - 1;
}

const strokeEnd = slice(
  studio,
  'const handleAquarelleStrokeEnd = useCallback(',
  'const handleAquarelleStrokeSettled',
);
const preflight = slice(
  studio,
  'const planAquarelleLiftErase = useCallback(',
  'const runAquarelleLiftErase = useCallback(',
);
const erase = slice(
  studio,
  'const runAquarelleLiftErase = useCallback(',
  'const handleAquarelleStrokeEnd = useCallback(',
);
const preview = slice(
  studio,
  'const aquarelleLiftPreviewPlanRef',
  'const runAquarelleLiftErase = useCallback(',
);
const layerGate = slice(
  layer,
  'const reopenSettleOnPaint = ',
  "window.addEventListener('pointerdown', reopenSettleOnPaint, true);",
);

describe('Lift pointerdown gate (261028-k03 D3)', () => {
  it('blocks a Lift gesture in the capture phase before the engine can erase', () => {
    const gate = layerGate.indexOf("toolForSelection() === 'lift'");
    const blocked = layerGate.indexOf('getLiftBlockedRef.current?.()');
    const cancel = layerGate.indexOf('engine.cancelAutoFix()');
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(blocked).toBeGreaterThan(gate);
    expect(cancel).toBeGreaterThan(blocked);
    expect(layerGate).toContain('event.preventDefault()');
    expect(layerGate).toContain('event.stopPropagation()');
    expect(layerGate).toContain('onLiftBlockedRef.current?.(refusal)');
    // A stylus eraser end is a lift gesture even when the selected tool is brush.
    expect(layerGate).toContain("event.pointerType === 'pen'");
    expect(layerGate).toContain('(event.buttons & 32) === 32');
    // The props exist on the layer and the mount forwards both (message copy).
    expect(layer).toContain('getLiftBlocked?: () => string | null;');
    expect(layer).toContain('onLiftBlocked?: (message: string) => void;');
    expect(mount).toContain('getAquarelleLiftBlocked?: () => string | null;');
    expect(mount).toContain('onAquarelleLiftBlocked?: (message: string) => void;');
    expect(mount).toContain('getLiftBlocked={() => getAquarelleLiftBlockedRef.current?.() ?? null}');
    expect(mount).toContain('onLiftBlocked={(message) => onAquarelleLiftBlockedRef.current?.(message)}');
  });

  it('records the ENGINE-resolved tool per stroke, never a stale carried value', () => {
    // onStrokeEnd(tool) is the engine's resolved tool for THIS stroke (stylus
    // eraser end, pen barrel, finger-water). A ref filled from onStrokeTool
    // would leak across strokes because the engine emits only on a change.
    expect(layer).toContain('onStrokeEnd(tool)');
    expect(layer).toContain('tool: (tool ?? toolForSelection()) as AquarelleTool');
    expect(layer).not.toContain('onStrokeTool');
  });
});

describe('Lift preflight ordering (261028-k03 D2)', () => {
  it('runs the preflight before the durable pin and the script record', () => {
    const plan = strokeEnd.indexOf('planAquarelleLiftErase(');
    const record = strokeEnd.indexOf('recordAquarelleStrokeWhenEnabled(');
    expect(plan).toBeGreaterThanOrEqual(0);
    expect(record).toBeGreaterThan(plan);
    // A refusal returns before the record — nothing is pinned or recorded.
    const refuse = strokeEnd.indexOf("kind === 'refuse'");
    expect(refuse).toBeGreaterThan(plan);
    expect(strokeEnd.indexOf('return;', refuse)).toBeLessThan(record);
    // The pin + record stay in their existing order behind the preflight.
    const peek = strokeEnd.indexOf('aquarelleScriptRecordingEnabled.peek()');
    const pin = strokeEnd.indexOf('recordAquarelleOrdinaryDurableBaseRef.current(');
    expect(peek).toBeGreaterThan(refuse);
    expect(pin).toBeGreaterThan(peek);
    expect(record).toBeGreaterThan(pin);
  });

  it('routes an EMPTY frame to the live path, never the group refusal', () => {
    const empty = preflight.indexOf("target.kind === 'empty'");
    const groupRefusal = preflight.indexOf("target.kind !== 'ordinary-key'");
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(groupRefusal).toBeGreaterThan(empty);
    expect(preflight).toContain("return { kind: 'normal' };");
  });

  it('keeps scripted and willPinBase distinct booleans', () => {
    // `scripted` = a script existed BEFORE this stroke; `willPinBase` = this
    // stroke is about to pin the PRE-erase raster. Swapping them either
    // skips the durable rewrite or leaves the pre-erase bytes pinned — the
    // next Apply then resurrects the erased pixels.
    expect(preflight).toContain('const scripted = hasAquarelleScriptForFrame(frame);');
    expect(preflight).toContain(
      'const willPinBase = scriptRecordingOn && !aquarelleDurableBaseByKeyRef.current.has(',
    );
    const scriptOffRefusal = preflight.indexOf('if (!scriptRecordingOn && scripted)');
    const rasterCheck = preflight.indexOf('if (!rasterBacked)');
    const unknownBase = preflight.indexOf('if (scripted && !aquarelleDurableBaseByKeyRef.current.has(');
    expect(scriptOffRefusal).toBeGreaterThanOrEqual(0);
    expect(rasterCheck).toBeGreaterThan(scriptOffRefusal);
    expect(unknownBase).toBeGreaterThan(rasterCheck);
  });

  it('k03c: an unknown-base scripted lift routes to base recovery, never a silent refusal', () => {
    const unknown = preflight.indexOf(
      'if (scripted && !aquarelleDurableBaseByKeyRef.current.has(target.keyId))',
    );
    expect(unknown).toBeGreaterThanOrEqual(0);
    const recovered = preflight.slice(unknown);
    // The fail-closed memo is checked FIRST: one failed recovery per key per
    // session — a second attempt would re-bake and re-invert for nothing.
    const memo = recovered.indexOf('aquarelleLiftRecoveryFailedRef.current.has(target.keyId)');
    expect(memo).toBeGreaterThan(-1);
    expect(recovered.indexOf("return { kind: 'refuse'")).toBeGreaterThan(memo);
    // The adopt path never pins a raster — recovery owns the durable write.
    // The ordinary erase keeps the pin classification and recoverBase false.
    expect(recovered).toContain('willPinBase: false,');
    expect(recovered).toContain('recoverBase: true,');
    expect(preflight).toContain(
      'return { kind: \'erase\', frame, trackId, keyId: target.keyId, scripted, willPinBase, recoverBase: false };',
    );
  });
});

describe('Lift erase pipeline order (261028-k03 / k03b)', () => {
  it('snapshots the sheet eagerly and drains the settle capture before any base read', () => {
    // The snapshot is raster-only (a scripted lift never commits the sheet),
    // but it must still be taken before the async flush.
    const snapshot = erase.indexOf('aquarelleSnapshotRef.current?.()');
    const firstPersistenceAwait = erase.indexOf('await rotoPersistenceRef.current.');
    const flush = erase.indexOf('flushLivePixels(plan.frame, plan.trackId)');
    const baseRead = erase.indexOf('const mergeBase = aquarelleMergeBaseRef.current');
    const capture = erase.indexOf('captureLivePixels(');
    expect(snapshot).toBeGreaterThanOrEqual(0);
    expect(firstPersistenceAwait).toBeGreaterThan(snapshot);
    expect(flush).toBeGreaterThan(snapshot);
    expect(baseRead).toBeGreaterThan(flush);
    expect(capture).toBeGreaterThan(baseRead);
  });

  it('k03b: a SCRIPTED lift never commits the composite — it punches the durable base and re-bakes', () => {
    const scripted = erase.slice(erase.indexOf('if (plan.scripted) {'), erase.indexOf('// RASTER-ONLY:'));
    expect(scripted.length).toBeGreaterThan(0);
    // The composite punch is what the bake discarded and the script could not
    // reproduce — it must not exist on this path.
    expect(scripted).not.toContain('captureLivePixels(');
    expect(scripted).not.toContain('baseCanvas: punched.canvas');
    expect(scripted).not.toContain('loadCachedRotoReferenceFrame(');
    expect(scripted).toContain('aquarelleDurableBaseByKeyRef.current.get(plan.keyId)');
    expect(scripted).toContain('punchTransmittanceBytes(durable, size, dabs');
    // The script edit ends the sheet session (the next stroke must re-read the
    // re-baked cache as its merge base) and replays the frame's timeline.
    expect(scripted).toContain('aquarelleResetSheetRef.current?.()');
    expect(scripted).toContain('const rebake = aquarelleRebakeRef.current;');
    expect(scripted).toContain('await rebake(getAquarelleEventsForFrame(plan.frame))');
    expect(scripted).toContain('revertAquarelleLiftPreview();');
    expect(scripted).toContain('publish(AQUARELLE_LIFT_FAILURE_MESSAGE);');
  });

  it('k03b: the RASTER-ONLY punch still rewrites the durable base exactly once', () => {
    const raster = erase.slice(erase.indexOf('// RASTER-ONLY:'));
    const gate = 'plan.willPinBase || aquarelleDurableBaseByKeyRef.current.has(plan.keyId)';
    expect(countOccurrences(raster, gate)).toBe(2);
    expect(raster).toContain('plan.willPinBase ? punched.bytes : durable');
    expect(countOccurrences(raster, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(1);
    // Nothing is written before the transaction acknowledges.
    const setIndex = raster.indexOf('aquarelleDurableBaseByKeyRef.current.set(');
    const okIndex = raster.indexOf('if (!ok) {');
    expect(okIndex).toBeGreaterThan(-1);
    expect(setIndex).toBeGreaterThan(okIndex);
    // The merge base is re-pinned BEFORE the commit await (a settle capture
    // enqueued mid-punch must not merge over the pre-erase base) and restored
    // when the transaction does not acknowledge.
    const mergePin = raster.indexOf('aquarelleMergeBaseRef.current = {');
    const captureStart = raster.indexOf('captureLivePixels({');
    expect(mergePin).toBeGreaterThan(-1);
    expect(captureStart).toBeGreaterThan(mergePin);
    expect(raster).toContain('aquarelleMergeBaseRef.current = previousMergeBase;');
  });

  it('k03c: a recoverBase lift owns its single punch and adopts the base durably first', () => {
    const recoverStart = erase.indexOf('if (plan.recoverBase) {');
    const recoverArm = erase.slice(recoverStart, erase.indexOf('} else {', recoverStart));
    expect(recoverStart).toBeGreaterThan(-1);
    expect(recoverArm.length).toBeGreaterThan(0);
    // SINGLE-PUNCH LAW: the arms are exclusive, so exactly one punch runs per
    // transaction; the map must hold t^K, never t^(K·K).
    expect(countOccurrences(recoverArm, 'punchTransmittanceBytes(')).toBe(1);
    expect(recoverArm).not.toContain('aquarelleDurableBaseByKeyRef.current.get(');
    // Adopt -> persist, then punch -> rewrite -> persist.
    const adopt = recoverArm.indexOf(
      'aquarelleDurableBaseByKeyRef.current.set(plan.keyId, recovery.bytes);',
    );
    const punch = recoverArm.indexOf('punchTransmittanceBytes(');
    const rewrite = recoverArm.indexOf(
      'aquarelleDurableBaseByKeyRef.current.set(plan.keyId, punchedRecovered.bytes);',
    );
    expect(adopt).toBeGreaterThan(-1);
    expect(punch).toBeGreaterThan(adopt);
    expect(rewrite).toBeGreaterThan(punch);
    // markDirty no-ops on an unchanged signature — the revision bump is the
    // load-bearing write on BOTH recovery writes.
    expect(countOccurrences(recoverArm, 'bumpAquarelleStrokesRevision();')).toBe(2);
  });

  it('k03c: a failed recovery erases nothing — the event, sheet and preview all revert', () => {
    const fail = erase.slice(
      erase.indexOf('const failRecovery = '),
      erase.indexOf('const display = findCachedRotoDisplayFrameRef.current(plan.frame);'),
    );
    expect(fail).toContain('aquarelleLiftRecoveryFailedRef.current.add(plan.keyId);');
    expect(fail).toContain('deleteAquarelleStrokesFromScript([mutationId])');
    expect(fail).toContain("stage: 'base-recovery-failed',");
    expect(fail).toContain('reason,');
    expect(fail).toContain('meanError: meanError ?? null,');
    expect(fail).toContain('aquarelleResetSheetRef.current?.();');
    expect(fail).toContain('revertAquarelleLiftPreview();');
    expect(fail).toContain('publish(AQUARELLE_LIFT_UNKNOWN_BASE_REFUSAL);');
    // The memo lives for the session: it is added to, never cleared.
    expect(studio).toContain('const aquarelleLiftRecoveryFailedRef = useRef<Set<string>>(new Set());');
    expect(studio).not.toContain('aquarelleLiftRecoveryFailedRef.current.clear()');
    expect(studio).not.toContain('aquarelleLiftRecoveryFailedRef.current.delete(');
  });

  it('k03c: the raster commit retries once and the durable write survives leave/return', () => {
    const raster = erase.slice(erase.indexOf('// RASTER-ONLY:'));
    expect(raster).toContain(
      'const commit = async () => rotoPersistenceRef.current.captureLivePixels({',
    );
    expect(raster).toContain('let attempts = 1;');
    expect(raster).toContain('attempts = 2;');
    expect(raster).toContain('let ok = await commit();');
    expect(raster).toContain('ok = await commit();');
    expect(raster).toContain("stage: 'commit-failed',");
    expect(raster).toContain("stage: 'committed',");
    // Both diagnostics carry the attempt count so a real rejection is
    // distinguishable from the settle race this retry absorbs.
    expect(countOccurrences(raster, 'attempts,')).toBe(2);
    // markDirty no-ops on an unchanged signature — the revision bump is the
    // load-bearing write that makes the punched payload survive leave/return.
    const setIndex = raster.indexOf(
      'aquarelleDurableBaseByKeyRef.current.set(plan.keyId, punchedDurableBytes);',
    );
    const bumpIndex = raster.indexOf('bumpAquarelleStrokesRevision();', setIndex);
    const dirtyIndex = raster.indexOf('studioScriptSnapshot.markDirty();', bumpIndex);
    expect(setIndex).toBeGreaterThan(-1);
    expect(bumpIndex).toBeGreaterThan(setIndex);
    expect(dirtyIndex).toBeGreaterThan(bumpIndex);
  });

  it('k03c: a settle capture for the lift-owned (track, frame) is fenced, other captures run', () => {
    const fence = studio.slice(
      studio.indexOf('const liftTarget = aquarelleLiftEraseTargetRef.current;'),
      studio.indexOf('let cachedBase: RenderedFramePayload | null;'),
    );
    expect(fence.length).toBeGreaterThan(0);
    expect(fence).toContain('aquarelleLiftEraseInFlightRef.current');
    expect(fence).toContain('liftTarget !== null');
    expect(fence).toContain('liftTarget.frame === playFrame');
    expect(fence).toContain('liftTarget.trackId === targetTrackId');
    expect(fence).toContain("stage: 'lift-in-flight',");
    expect(fence).toContain('return;');
    // The fence is per transaction: set before the first await, cleared in
    // `finish` (a queued re-entry re-sets it synchronously).
    expect(erase).toContain(
      'aquarelleLiftEraseTargetRef.current = { frame: plan.frame, trackId: plan.trackId };',
    );
    expect(erase).toContain('aquarelleLiftEraseTargetRef.current = null;');
    const setIndex = erase.indexOf('aquarelleLiftEraseTargetRef.current = {');
    const firstAwait = erase.indexOf('await ', setIndex);
    expect(setIndex).toBeGreaterThan(-1);
    expect(firstAwait).toBeGreaterThan(setIndex);
  });

  it('commits through the existing physical-edit transaction seam', () => {
    const captureStart = erase.indexOf('captureLivePixels({');
    expect(captureStart).toBeGreaterThan(-1);
    const captureCall = erase.slice(captureStart, erase.indexOf('});', captureStart));
    expect(captureCall).toContain('cachedBase: null');
    expect(captureCall).toContain('baseCanvas: punched.canvas');
    expect(captureCall).toContain("mergeBlend: 'pigment-alpha'");
    expect(captureCall).toContain('trackId: plan.trackId');
    expect(captureCall).not.toContain('studioActiveTrackId()');
    expect(captureCall).toContain('liveAlphaCanvas: commitSheet');
  });

  it('refreshes the display exactly like the Apply precedent', () => {
    expect(erase).toContain('loadCachedRotoReferenceFrame(');
    expect(erase).toContain('physicPaintVersion.value++');
    expect(erase).toContain('getAppliedPreviewBaseContentToken()');
  });

  it('k03b: previews the engine dabs on the cached base only for a cached-display lift', () => {
    expect(preview).toContain("planAquarelleLiftErase(frame).kind === 'erase'");
    expect(preview).toContain('beginAquarelleLiftPreview(frame)');
    // 261028-k03c: the 5-argument dab — the angle rides to the preview.
    expect(preview).toContain('pushAquarelleLiftPreviewDab({ x, y, r, amount, angle })');
    // Stroke end closes the gesture and drops the per-stroke plan cache.
    expect(studio).toContain('endAquarelleLiftPreview();');
    expect(studio).toContain('aquarelleLiftPreviewPlanRef.current = null;');
    // The layer hands over the exact dab the engine applied (angle included).
    expect(layer).toContain('onLiftDab(x, y, r, amount, angle)');
    expect(mount).toContain(
      'onLiftDab={(x, y, r, amount, angle) => onAquarelleLiftDabRef.current?.(x, y, r, amount, angle)}',
    );
  });

  it('k03b: the cached base punches in place and double-buffers URL swaps', () => {
    expect(baseLayer).toContain('punchTransmittanceRgba(');
    expect(baseLayer).toContain('buildLiftCoverage(');
    expect(baseLayer).toContain('registerAquarelleLiftPreviewSink');
    // The visible canvas is never zeroed before the new bytes are decoded —
    // that reset was the blank flash on every refresh.
    expect(baseLayer).not.toContain('canvas.width = 0');
    const decode = baseLayer.indexOf('image.onload = () => {');
    const draw = baseLayer.indexOf('context.clearRect(0, 0, width, height)');
    expect(decode).toBeGreaterThan(-1);
    expect(draw).toBeGreaterThan(decode);
  });

  it('queues re-entrant lifts in order and never leaks in-flight', () => {
    expect(erase).toContain('aquarelleLiftEraseInFlightRef.current');
    expect(erase).toContain('aquarelleLiftErasePendingRef.current.push(');
    expect(erase).toContain('aquarelleLiftErasePendingRef.current.shift()');
    expect(erase).toContain('} finally {');
  });
});

describe('Lift copy and untouched laws (261028-k03)', () => {
  it('carries all six exact messages', () => {
    expect(studio).toContain("'Lift needs Script ON to erase recorded paint. Turn Script ON, or use Raster Key for a pixel-only erase.'");
    expect(studio).toContain("'Group frames cannot be lifted — erase the source key instead.'");
    expect(studio).toContain('"This key\'s pre-script base is unavailable — nothing changed."');
    expect(studio).toContain('"The frame\'s painted pixels are unavailable — nothing changed."');
    expect(studio).toContain("'Lifted — erased pixels are permanent (no undo).'");
    expect(studio).toContain("'The erase did not commit — the picture is unchanged. The recorded Lift applies on the next Apply.'");
  });

  it('leaves the capture ink gate literal untouched', () => {
    expect(studio).toContain('if (ink < AQUARELLE_MIN_CAPTURE_INK) return');
  });

  it('adds the four lift durable-base set sites (3 base + scripted + recovery x2 + raster)', () => {
    // 261028-k03c: the recovery arm adopts the recovered base and then rewrites
    // it as t^K — two writes, both before the shared re-bake tail.
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(7);
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.delete(')).toBe(2);
  });
});
