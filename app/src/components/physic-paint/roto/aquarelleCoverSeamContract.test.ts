// ============================================================
//  aquarelleCoverSeamContract — the Body cover's forwarding chain,
//  transaction and profile plumbing (quick 261117-tq7, spec 09 law 3).
//
//  A Brush stamp with `coverAmount > 0` must replace the underlayer even
//  when that paint lives OUTSIDE the engine: on a cooked frame the visible
//  paint is the cached base, and the ONLY path that reaches it is the Lift
//  preview/commit seam. This suite pins the cover's half of that seam
//  end-to-end:
//
//    engine onCoverDab -> AquarelleCanvasLayer -> PhysicsPaintCanvasMount
//      -> Studio handleAquarelleCoverDab -> beginAquarelleLiftPreview(frame,
//      'deposit') -> flushPreview(profile) -> buildLiftCoverage(..., 'deposit')
//    stroke end -> planAquarelleCoverErase (mode: 'cover') -> the SAME
//      3-argument runAquarelleLiftErase -> punchTransmittanceBytes(...,
//      { profile: 'deposit' }) -> captureLivePixels (one ledger entry)
//
//  The cover is purely ADDITIVE: every Lift literal the two existing
//  contract suites count stays byte-identical, and the cover's durable
//  rewrite goes through a local map alias so the whole-Studio
//  `.set(` literal count stays 10 (a raw verbatim occurrence anywhere in
//  the file, comments included, breaks that pin).
//
//  Written KNOWINGLY RED by task 1 of the quick plan: at HEAD the cover
//  symbols do not exist, so the cover-specific slices throw naming the
//  missing marker. Task 3 turns them green without touching the Lift text.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const coordinator = readFileSync(resolve(__dirname, '../hooks/useRotoFramePersistenceCoordinator.ts'), 'utf8');
const layer = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
const mount = readFileSync(resolve(__dirname, '../engine/PhysicsPaintCanvasMount.tsx'), 'utf8');
const baseLayer = readFileSync(resolve(__dirname, '../engine/AquarelleCachedBaseLayer.tsx'), 'utf8');
const bus = readFileSync(resolve(__dirname, './aquarelleLiftPreview.ts'), 'utf8');
const punchLib = readFileSync(resolve(__dirname, './aquarelleLiftErase.ts'), 'utf8');

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

const strokeEnd = () => slice(
  studio,
  'const handleAquarelleStrokeEnd = useCallback(',
  'const handleAquarelleStrokeSettled',
);
// The lift plan's OWN body, ending where BOTH existing pinning suites end
// their `plan`/`preflight` windows (`aquarelleLiftEraseContract.test.ts:72`,
// `PhysicsPaintStudio.test.ts` `plan`). Ending at `runAquarelleLiftErase`
// instead would swallow the whole preview block — and the cover handler that
// the same suite requires INSIDE that block — making the two pins
// contradictory.
const preflight = () => slice(
  studio,
  'const planAquarelleLiftErase = useCallback(',
  'const aquarelleLiftPreviewPlanRef',
);
const erase = () => slice(
  studio,
  'const runAquarelleLiftErase = useCallback(',
  'const handleAquarelleStrokeEnd = useCallback(',
);
const preview = () => slice(
  studio,
  'const aquarelleLiftPreviewPlanRef',
  'const runAquarelleLiftErase = useCallback(',
);
/** The cover's block inside the transaction: mode guard to the scripted arm. */
const coverBranch = () => slice(studio, "if (mode === 'cover') {", 'if (plan.scripted) {');

describe('the cover forwarding chain (engine -> layer -> mount -> Studio)', () => {
  it('declares and forwards onCoverDab through the layer and the mount', () => {
    // The layer mirrors onLiftDab exactly: prop -> ref -> engine callback.
    expect(layer).toContain(
      'onCoverDab?: (x: number, y: number, r: number, amount: number, angle: number, density: number) => void;',
    );
    expect(layer).toContain('const onCoverDabRef = useRef(props.onCoverDab);');
    expect(layer).toContain('onCoverDabRef.current = props.onCoverDab;');
    expect(layer).toContain('onCoverDab(x, y, r, amount, angle, density) {');
    expect(layer).toContain('onCoverDabRef.current?.(x, y, r, amount, angle, density);');
    expect(layer.indexOf('onCoverDab?:')).toBeGreaterThan(layer.indexOf('onLiftDab?:'));
    // The Lift wiring is untouched.
    expect(layer).toContain('onLiftDab(x, y, r, amount, angle)');
    expect(layer).toContain('onLiftDabRef.current?.(x, y, r, amount, angle)');

    // The mount forwards it to the Studio prop, mirroring the lift literal.
    expect(mount).toContain(
      'onAquarelleCoverDab?: (x: number, y: number, r: number, amount: number, angle: number, density: number) => void;',
    );
    expect(mount).toContain('const onAquarelleCoverDabRef = useRef(props.onAquarelleCoverDab);');
    expect(mount).toContain('onAquarelleCoverDabRef.current = props.onAquarelleCoverDab;');
    expect(mount).toContain(
      'onCoverDab={(x, y, r, amount, angle, density) => onAquarelleCoverDabRef.current?.(x, y, r, amount, angle, density)}',
    );
    expect(mount).toContain(
      'onLiftDab={(x, y, r, amount, angle) => onAquarelleLiftDabRef.current?.(x, y, r, amount, angle)}',
    );

    // The Studio hands the handler to the mount.
    expect(studio).toContain('onAquarelleCoverDab: handleAquarelleCoverDab,');
  });

  it('arms the cover preview once per stroke and streams the engine dabs', () => {
    const window = preview();
    // The two per-stroke refs sit beside their Lift counterparts.
    expect(window).toContain(
      'const aquarelleCoverPreviewPlanRef = useRef<{ frame: number; active: boolean } | null>(null);',
    );
    expect(window).toContain('const aquarelleCoverGestureDabsRef = useRef<LiftDab[]>([]);');
    expect(window).toContain('const handleAquarelleCoverDab = useCallback(');
    expect(window).toContain('aquarelleCoverGestureDabsRef.current.push({ x, y, r, amount, angle, density });');
    expect(window).toContain("active = planAquarelleCoverErase(frame).kind === 'erase';");
    // The deposit profile rides the SAME bus; a Lift begin stays a one-arg call.
    expect(window).toContain("if (active) beginAquarelleLiftPreview(frame, 'deposit');");
    expect(window).toContain('pushAquarelleLiftPreviewDab({ x, y, r, amount, angle, density });');
    // Cover plumbing lands AFTER the lift handler it mirrors.
    expect(window.indexOf('const handleAquarelleCoverDab')).toBeGreaterThan(
      window.indexOf('const handleAquarelleLiftDab'),
    );
    // Every pinned Lift literal in this window survives verbatim.
    expect(window).toContain("planAquarelleLiftErase(frame).kind === 'erase'");
    expect(window).toContain('beginAquarelleLiftPreview(frame)');
    expect(window).toContain('aquarelleLiftGestureDabsRef.current.push({ x, y, r, amount, angle });');
  });
});

describe('the cover preflight and dispatch (Studio stroke end)', () => {
  it('resolves planAquarelleCoverErase before the lift plan so both pinned windows stay Lift-only', () => {
    expect(studio).toContain(
      'const planAquarelleCoverErase = useCallback((frame: number): AquarelleLiftErasePlan => {',
    );
    // The preflight windows of BOTH suites start at the lift plan; the cover
    // plan must sit outside them.
    expect(studio.indexOf('const planAquarelleCoverErase = useCallback(')).toBeLessThan(
      studio.indexOf('const planAquarelleLiftErase = useCallback('),
    );
    const liftPreflight = preflight();
    expect(liftPreflight).not.toContain('planAquarelleCoverErase');
    // The lift plan's pinned return literal is byte-unchanged (no `mode`).
    expect(liftPreflight).toContain(
      "return { kind: 'erase', frame, trackId, keyId: target.keyId, scripted, willPinBase, recoverBase: false };",
    );
    expect(liftPreflight).not.toContain("mode: 'cover'");

    const coverPlan = slice(
      studio,
      'const planAquarelleCoverErase = useCallback(',
      'const planAquarelleLiftErase = useCallback(',
    );
    // The plan carries the mode; only a cached display is worth punching.
    expect(coverPlan).toContain("mode: 'cover',");
    expect(coverPlan).toContain(
      'if (findCachedRotoDisplayFrameRef.current(frame) === null) return { kind: \'normal\' };',
    );
    // No refusal copy: a legacy key degrades to the visible-base punch.
    expect(coverPlan).not.toContain("kind: 'refuse'");
    expect(coverPlan).toContain('const scripted = hasAquarellePaintScriptForFrame(frame);');
  });

  it('dispatches the 3-argument cover transaction after the record, behind the lift dispatch', () => {
    const handler = strokeEnd();
    // This gesture's cover dabs are taken ONCE, before any refusal path.
    expect(handler).toContain('aquarelleCoverGestureDabsRef.current.splice(0)');
    expect(handler).toContain('aquarelleCoverPreviewPlanRef.current = null;');
    expect(handler).toContain('const coverPlan = stroke.tool === \'brush\' && coverGestureDabs.length > 0');
    expect(handler).toContain('planAquarelleCoverErase(launchContextRef.current?.startFrame ?? 0)');
    // The mode rides the plan: same 3-argument shape, same fence and queue.
    expect(handler).toContain(
      'if (coverPlan?.kind === \'erase\') void runAquarelleLiftErase(coverPlan, stroke, coverGestureDabs);',
    );
    const record = handler.indexOf('recordAquarelleStrokeWhenEnabled(');
    const liftDispatch = handler.indexOf('void runAquarelleLiftErase(liftPlan, stroke, liftGestureDabs)');
    const coverDispatch = handler.indexOf('void runAquarelleLiftErase(coverPlan, stroke, coverGestureDabs)');
    expect(record).toBeGreaterThanOrEqual(0);
    expect(liftDispatch).toBeGreaterThan(record);
    expect(coverDispatch).toBeGreaterThan(liftDispatch);
    // The lift literals the other suites count survive verbatim.
    expect(handler).toContain(
      'if (liftPlan?.kind === \'erase\') void runAquarelleLiftErase(liftPlan, stroke, liftGestureDabs);',
    );
    expect(handler).toContain("const liftIsScriptOwned = liftPlan?.kind === 'erase' && liftPlan.scripted;");
    expect(handler).toContain('endAquarelleLiftPreview();');
  });
});

describe('the cover transaction (runAquarelleLiftErase keeps its 3-argument signature)', () => {
  it('threads the mode on the plan and captures the live sheet for a scripted cover', () => {
    const transaction = erase();
    // Mode is read from the plan before the pending push so the queue's
    // spread carries it; it never becomes a 4th parameter.
    expect(transaction).toContain("const mode = plan.mode ?? 'lift';");
    expect(transaction.indexOf("const mode = plan.mode ?? 'lift';")).toBeLessThan(
      transaction.indexOf('aquarelleLiftErasePendingRef.current.push('),
    );
    expect(transaction).toContain(
      'const sheet = plan.scripted && mode !== \'cover\' ? null : (aquarelleSnapshotRef.current?.() ?? null);',
    );
    expect(transaction).toContain("if (mode === 'cover' && !sheet) {");
    // The cover branch sits AFTER the shared dabs/shape resolution and BEFORE
    // the scripted arm, so no counted Lift slice moves.
    const branch = transaction.indexOf("if (mode === 'cover') {");
    expect(branch).toBeGreaterThan(
      transaction.indexOf('const dabs = engineDabs !== undefined && engineDabs.length > 0'),
    );
    expect(branch).toBeLessThan(transaction.indexOf('if (plan.scripted) {'));
    // The pending-queue trio stays verbatim (it is what carries the mode).
    expect(transaction).toContain(
      'aquarelleLiftErasePendingRef.current.push({ ...plan, stroke, engineDabs });',
    );
    expect(transaction).toContain(
      'const { stroke: pendingStroke, engineDabs: pendingDabs, ...pendingPlan } = pending;',
    );
    expect(transaction).toContain('}, pendingStroke, pendingDabs);');
  });

  it('punches the visible base with the deposit profile and commits the sheet over it', () => {
    const cover = coverBranch();
    // The punch source resolves key-payload first, then the display base.
    expect(cover).toContain('const pinnedCoverBase = mergeBase && mergeBase.appFrame === plan.frame');
    expect(cover).toContain('aquarelleKeyPayloadRef.current(plan.frame)');
    expect(cover).toContain('findCachedRotoDisplayFrameRef.current(plan.frame)');
    expect(cover).toContain(
      'displayCoverBase.bytes.length > AQUARELLE_PLACEHOLDER_MAX_BYTES',
    );
    // Visible + durable punches both carry the deposit-footprint profile.
    expect(cover).toContain('punchTransmittanceBytes(coverBase.bytes, size, dabs, {');
    expect(countOccurrences(cover, "profile: 'deposit',")).toBe(2);
    // The commit is the raster Lift's physical-edit transaction: baseCanvas
    // WINS over cachedBase, so the recorded bytes are the punched ones.
    expect(cover).toContain('const commitCover = async () => rotoPersistenceRef.current.captureLivePixels({');
    expect(cover).toContain('liveAlphaCanvas: sheet,');
    expect(cover).toContain('cachedBase: coverBase,');
    expect(cover).toContain('baseCanvas: punchedCover.canvas,');
    expect(cover).toContain("mergeBlend: 'pigment-alpha',");
    expect(cover).toContain('aquarelleMergeBaseRef.current = previousMergeBase;');
    // One retry, the cover's own attempt counter and diagnostics.
    expect(cover).toContain('let coverAttempts = 1;');
    expect(cover).toContain('coverAttempts = 2;');
    expect(cover).toContain("stage: 'cover-commit-failed',");
    // The durable rewrite goes through the LOCAL MAP ALIAS — the whole-Studio
    // durable `.set(` literal count (10) must stay put in both pinning suites.
    expect(cover).toContain('const coverDurableBase = aquarelleDurableBaseByKeyRef.current;');
    expect(cover).toContain('coverDurableBase.set(plan.keyId, punchedDurableBytes);');
    expect(cover).not.toContain('aquarelleDurableBaseByKeyRef.current.set(');
    // A legacy scripted key without a durable base still covers the display.
    expect(cover).toContain("stage: 'cover-durable-base-unavailable',");
    // Display refresh + a silent success (the stroke sheet stays visible).
    expect(cover).toContain('loadCachedRotoReferenceFrame(');
    expect(cover).toContain('physicPaintVersion.value++;');
    expect(cover).toContain('setApplyMessage(null);');
    expect(cover).toContain('setApplyStatus(\'idle\');');
    expect(cover).toContain('setLastError(null);');
    // Every failure arm reverts the display before publishing the cover copy.
    expect(cover).toContain('revertAquarelleLiftPreview();');
    expect(cover).toContain('publish(AQUARELLE_COVER_FAILURE_MESSAGE);');
    expect(studio).toContain(
      "const AQUARELLE_COVER_FAILURE_MESSAGE = 'The cover did not commit — the picture is unchanged. The recorded stroke applies on the next Apply.';",
    );
    // A NEW message: none of the six pinned Lift strings is reused here.
    for (const liftMessage of [
      'Eraser needs Script ON to erase recorded paint.',
      'Group frames cannot be lifted',
      "This key's pre-script base is unavailable",
      "The frame's painted pixels are unavailable",
      'Erased — removed pixels are permanent (no undo).',
      'The erase did not commit — the picture is unchanged.',
    ]) {
      expect(cover).not.toContain(liftMessage);
    }
    // Nothing counted by the existing suites moves into the cover block.
    expect(cover).not.toContain('cachedBase: null');
    expect(cover).not.toContain('await rebake(');
    expect(cover).not.toContain('diagnostics: recoveryDiagnostics,');
    expect(cover).not.toContain('// RASTER-ONLY:');
  });

  it('never rewrites an UNKNOWN durable entry as KNOWN-EMPTY', () => {
    const cover = coverBranch();
    const punch = cover.slice(
      cover.indexOf('let punchedDurableBytes: Uint8Array | null = null;'),
      cover.indexOf('// Pin the session base BEFORE the commit await'),
    );
    // The definedness flag starts false and only the DEFINED arm raises it.
    expect(punch).toContain('let coverDurableDefined = false;');
    const unavailable = punch.indexOf('stage: \'cover-durable-base-unavailable\',');
    expect(unavailable).toBeGreaterThanOrEqual(0);
    expect(unavailable).toBeLessThan(punch.indexOf('coverDurableDefined = true;'));
    // A defined `null` (known-empty) is still written back; absence is not.
    expect(punch.indexOf('coverDurableDefined = true;')).toBeLessThan(
      punch.indexOf('if (coverDurableSource !== null) {'),
    );
    // The post-ack write is gated on the flag, not on the old has() test —
    // one durable `has()` guard remains, on the punch-resolution side only.
    expect(cover).toContain('if (coverDurableDefined) {');
    expect(
      countOccurrences(
        cover,
        'if (plan.willPinBase || aquarelleDurableBaseByKeyRef.current.has(plan.keyId)) {',
      ),
    ).toBe(1);
    // The lift-recovery arm that keys on has() proves the distinction matters:
    // a forged KNOWN-EMPTY entry would skip the recovery and drop the paint.
    expect(studio).toContain(
      'if (scripted && !aquarelleDurableBaseByKeyRef.current.has(target.keyId)) {',
    );
  });

  it('never resets the sheet under a stroke that started during the commit', () => {
    // The layer owns the generation: it advances on every stroke start.
    expect(layer).toContain('let strokeGeneration = 0;');
    expect(layer).toContain('if (!painting) strokeGeneration++;');
    // Both the getter and the reset ride the one registration.
    expect(layer).toContain('onResetSheetReadyRef.current?.(resetSheet, () => strokeGeneration);');
    expect(layer).toContain(
      'onResetSheetReady?: (resetSheet: () => void, strokeGeneration: () => number) => void;',
    );
    expect(mount).toContain(
      'onAquarelleResetSheetReady?: (resetSheet: () => void, strokeGeneration: () => number) => void;',
    );
    expect(studio).toContain(
      'const aquarelleStrokeGenerationRef = useRef<(() => number) | null>(null);',
    );
    expect(studio).toContain('aquarelleStrokeGenerationRef.current = strokeGeneration;');
    const cover = coverBranch();
    // Captured BEFORE the async commit...
    const captured = cover.indexOf('const coverStrokeGeneration = aquarelleStrokeGenerationRef.current?.() ?? 0;');
    expect(captured).toBeGreaterThanOrEqual(0);
    expect(captured).toBeLessThan(cover.indexOf('let coverOk = await commitCover();'));
    // ...and compared after the ack; a changed generation skips the reset
    // (and the display swap that depends on it) instead of wiping the stroke.
    const drift = cover.indexOf("if (abandonIfDrifted('cover-commit-ack')) return;");
    const gate = cover.indexOf(
      'const coverStrokeLive = (aquarelleStrokeGenerationRef.current?.() ?? 0) !== coverStrokeGeneration;',
    );
    expect(gate).toBeGreaterThan(drift);
    expect(cover.indexOf('if (!coverStrokeLive) {')).toBeGreaterThan(gate);
    expect(cover.indexOf('if (!coverStrokeLive) {')).toBeLessThan(
      cover.indexOf('aquarelleResetSheetRef.current?.();'),
    );
    // quick 261117-tq7 (rev 4, UAT round 3): the reset is DEFERRED to the
    // cached base's applied hook, not run at URL-set time. The layer keeps
    // the preview-punched pixels until the decode lands, so clearing the
    // sheet first flashed the punched base alone for the decode gap (the
    // reported paper-white flash). The hook is armed BEFORE the load; the
    // synchronous reset survives only as the no-display fallback.
    const armed = cover.indexOf('aquarelleCachedBaseAppliedRef.current = () => {');
    expect(armed).toBeGreaterThanOrEqual(0);
    expect(armed).toBeLessThan(cover.indexOf('loadCachedRotoReferenceFrame('));
    expect(cover.slice(armed)).toContain('aquarelleResetSheetRef.current?.();');
    expect(studio).toContain(
      'const aquarelleCachedBaseAppliedRef = useRef<(() => void) | null>(null);',
    );
    expect(studio).toContain('onAquarelleCachedBaseApplied: handleAquarelleCachedBaseApplied,');
    expect(mount).toContain('onAquarelleCachedBaseApplied?: () => void;');
    expect(baseLayer).toContain('onApplied?: () => void');
    expect(baseLayer).toContain('props.onApplied?.();');
    // The diagnostic records whether the reset was skipped.
    expect(cover).toContain('resetSkipped: coverStrokeLive,');
  });

  it('publishes the committed composite to the display, never the punched base alone', () => {
    // quick 261117-tq7 (rev 4, UAT round 2): a new stroke rendered correctly
    // during the drag and turned paper-white only on release. The commit was
    // fine (leaving/returning restored the paint), but the post-ack display
    // swap loaded `punchedCover.bytes` — the underlayer REMOVED along the
    // footprint — while the sheet (the stroke's only on-screen pigment) had
    // just been reset. The display must publish the COMMITTED composite: the
    // punched base with this stroke's sheet merged over it.
    const cover = coverBranch();
    // The extra-canvas seam: the produce step hands its exact encoded frame
    // to the caller so the display swap never re-merges or re-encodes.
    expect(coordinator).toContain('onProduced?: (rendered: RenderedFramePayload) => void;');
    expect(coordinator.indexOf('capture.onProduced?.(produced);')).toBeGreaterThan(
      coordinator.indexOf('const produced = await (usedMerge'),
    );
    // The cover passes the seam on every commit attempt...
    expect(cover).toContain('onProduced: (produced) => { coverProduced.bytes = produced.bytes; },');
    // ...and the swap publishes those bytes (null falls back to the committed
    // payload lookup), never the underlayer-only punch.
    const swap = cover.slice(cover.indexOf('if (!coverStrokeLive) {'));
    expect(swap).toContain('coverProduced.bytes,');
    expect(swap).not.toContain('punchedCover.bytes,');
  });

  it('keeps every pinned Lift arm and whole-Studio count intact', () => {
    const transaction = erase();
    const scripted = transaction.slice(
      transaction.indexOf('if (plan.scripted) {'),
      transaction.indexOf('// RASTER-ONLY:'),
    );
    const raster = transaction.slice(transaction.indexOf('// RASTER-ONLY:'));
    // Scripted arm: one durable punch, one rebake fallback, two reconciles.
    expect(scripted).toContain('punchTransmittanceBytes(durable, size, dabs');
    expect(countOccurrences(scripted, 'await rebake(getAquarelleEventsForFrame(plan.frame))')).toBe(1);
    expect(countOccurrences(scripted, 'loadCachedRotoReferenceFrame(')).toBe(2);
    expect(scripted).toContain('cachedBase: null');
    expect(scripted).toContain('baseCanvas: null');
    // Raster arm: the existing merge + durable rewrite, exactly once each.
    expect(raster).toContain('baseCanvas: punched.canvas');
    expect(scripted + raster).toContain("mergeBlend: 'pigment-alpha'");
    expect(countOccurrences(raster, 'attempts,')).toBe(2);
    expect(countOccurrences(raster, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(1);
    expect(raster).not.toContain('loadCachedRotoReferenceFrame(');
    expect(raster).not.toContain('physicPaintVersion.value++');
    // Whole-Studio counts both pinning suites re-derive from the source.
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(10);
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.delete(')).toBe(2);
    expect(countOccurrences(studio, 'cachedBase: null')).toBe(2);
    // The navigation guard still gates the cover's own commit acknowledgement.
    expect(transaction).toContain("abandonIfDrifted('cover-commit-ack')");
    expect(transaction).toContain("abandonIfDrifted('commit-ack')");
  });
});

describe('the cover profile plumbing (punch library -> bus -> cached base)', () => {
  it('adds the deposit profile to buildLiftCoverage and the punch options', () => {
    expect(punchLib).toContain("export type LiftCoverageProfile = 'tip' | 'deposit';");
    const signature = slice(punchLib, 'export function buildLiftCoverage(', '): LiftCoverage {');
    expect(signature).toContain('shape?: LiftFootprintShape,');
    expect(signature).toContain("profile: LiftCoverageProfile = 'tip',");
    // The deposit law is the tip mask the engine deposits with, no envelope,
    // alpha-shaped by the per-dab density exactly as the engine binds it.
    expect(punchLib).toContain('if (profile === \'deposit\') {');
    // rev 4 (UAT round 3): the tip mask mirrors footprintMask() point for
    // point — the rotated, jittered sample through the wide ramp and the
    // soft square rim (the raw unrotated mask erased where a textured
    // deposit paints nothing).
    expect(punchLib).toContain('const tqAlong = along * deposit.cos - across * deposit.sin;');
    expect(punchLib).toContain('const ramp = smoothstep01(deposit.lowCut, deposit.lowCut + 0.5, tip);');
    expect(punchLib).toContain(
      'const rim = 1 - smoothstep01(0.82, 1, Math.max(Math.abs(along), Math.abs(across)));',
    );
    expect(punchLib).toContain('one.amount * (1 - Math.exp(-one.density * mask))');
    // The no-density fallback keeps the legacy linear law for old literals.
    expect(punchLib).toContain(': one.amount * mask;');
    // The options object carries it and every punch leg passes it through.
    expect(punchLib).toContain('profile?: LiftCoverageProfile;');
    expect(punchLib).toContain('buildLiftCoverage(dabs, width, height, shape, profile);');
    expect(punchLib).toContain('punchTransmittanceCanvas(source, dabs, options.shape, stats, options.profile)');
    // The Lift's tip laws stay byte-identical.
    expect(punchLib).toContain(
      'f = one.amount * Math.exp(-(d * d)) * (mask * (1 - LIFT_TIP_ROUND) + LIFT_TIP_ROUND);',
    );
    expect(punchLib).toContain('f = one.amount * Math.exp(-(d * d));');
  });

  it('threads the profile from begin to the cached-base flush, keeping Lift one-arg', () => {
    // The bus: a default (tip) begin reaches the sink with the frame ALONE —
    // aquarelleLiftPreview.test.ts asserts begin was called with (42) exactly.
    expect(bus).toContain('begin(frame: number, profile?: \'tip\' | \'deposit\'): void;');
    expect(bus).toContain(
      "export function beginAquarelleLiftPreview(frame: number, profile: 'tip' | 'deposit' = 'tip'): void {",
    );
    expect(bus).toContain('if (profile === \'deposit\') {');
    expect(bus).toContain("previewSink?.begin(frame, 'deposit');");
    expect(bus).toContain('previewSink?.begin(frame);');
    // The dab/end/revert contract is untouched.
    expect(bus).toContain('export function pushAquarelleLiftPreviewDab(dab: AquarelleLiftPreviewDab): void {');
    expect(bus).toContain('export function revertAquarelleLiftPreview(): void {');

    // The cached base stores the gesture's profile and flushes with it.
    expect(baseLayer).toContain("const profileRef = useRef<'tip' | 'deposit'>('tip');");
    expect(baseLayer).toContain('begin(frame, profile) {');
    expect(baseLayer).toContain("profileRef.current = profile ?? 'tip';");
    expect(baseLayer).toContain('shapeRef.current ?? undefined,');
    expect(baseLayer).toContain('profileRef.current,');
    // The existing preview/punch/revert contract survives.
    expect(baseLayer).toContain('buildLiftCoverage(');
    expect(baseLayer).toContain('punchTransmittanceRgba(');
    expect(baseLayer).toContain('decoded.image.data.set(snapshot.data);');
    // One decode per URL: the profile is a ref, never a second effect.
    expect(countOccurrences(baseLayer, 'image.src = props.url;')).toBe(1);
  });
});
