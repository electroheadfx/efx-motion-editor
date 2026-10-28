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
//  5. The durable gate runs at the punch read AND the set write
//     back, rewrites a base this very stroke pinned (willPinBase)
//     with D^K, and never writes twice.
//  6. The commit is the existing physical-edit transaction:
//     baseCanvas + pigment-alpha + cachedBase null.
//  7. The display refresh follows the Apply precedent.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const layer = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
const mount = readFileSync(resolve(__dirname, '../engine/PhysicsPaintCanvasMount.tsx'), 'utf8');

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
});

describe('Lift erase pipeline order (261028-k03 D2)', () => {
  it('snapshots the sheet eagerly and drains the settle capture before any base read', () => {
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

  it('punches, then rewrites the durable base exactly once for every reported state', () => {
    const gate = 'plan.scripted || plan.willPinBase || aquarelleDurableBaseByKeyRef.current.has(plan.keyId)';
    expect(countOccurrences(erase, gate)).toBe(2);
    expect(erase).toContain('plan.willPinBase ? punched.bytes : durable');
    expect(countOccurrences(erase, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(1);
    // Nothing is written before the transaction acknowledges.
    const setIndex = erase.indexOf('aquarelleDurableBaseByKeyRef.current.set(');
    const okIndex = erase.indexOf('if (!ok) {');
    expect(okIndex).toBeGreaterThan(-1);
    expect(setIndex).toBeGreaterThan(okIndex);
    // The merge base is re-pinned BEFORE the commit await (a settle capture
    // enqueued mid-punch must not merge over the pre-erase base) and restored
    // when the transaction does not acknowledge.
    const mergePin = erase.indexOf('aquarelleMergeBaseRef.current = {');
    const captureStart = erase.indexOf('captureLivePixels({');
    expect(mergePin).toBeGreaterThan(-1);
    expect(captureStart).toBeGreaterThan(mergePin);
    expect(erase).toContain('aquarelleMergeBaseRef.current = previousMergeBase;');
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
    expect(captureCall).toContain('liveAlphaCanvas: sheet');
  });

  it('refreshes the display exactly like the Apply precedent', () => {
    expect(erase).toContain('loadCachedRotoReferenceFrame(');
    expect(erase).toContain('physicPaintVersion.value++');
    expect(erase).toContain('getAppliedPreviewBaseContentToken()');
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

  it('adds exactly one durable-base set site (3 -> 4)', () => {
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(4);
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.delete(')).toBe(2);
  });
});
