// ============================================================
//  quick 261027-klx CR-01 — Copy -> Apply against the REAL ledger.
//
//  The app-owned ledger accepts a stroke and emits its completion
//  SYNCHRONOUSLY, inside `enqueueRecordedStroke`, before that call returns.
//  The clipboard used to register the expected id and the accepted target
//  only AFTER the call, so it ignored every completion of an Apply burst and
//  `finishApply` never ran. This suite wires the REAL ledger through the
//  memoized Roto port and the REAL controller (no async fake), and pins that
//  a multi-brush burst consumes every id and settles — the first brush
//  included.
// ============================================================

import { afterEach, describe, expect, it } from 'vitest';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import type { PaintStroke } from '../types/paintCore';
import { createPaintMutationLedger } from '../engine/paintMutationLedger';
import { recordAquarelleStroke, resetAquarelleRecordState } from '../view/aquarelleRecordState';
import { getRotoPort } from './paintMutationRotoPort';
import {
  createRotoScriptClipboardController,
  type RotoScriptSourceSnapshot,
} from './physicsPaintRotoScriptClipboard';

function stroke(mutationId: number, x: number): PaintStroke {
  return {
    mutationId,
    tool: 'paint',
    points: [{ x, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }],
    color: '#123456',
    params: {
      size: 12,
      opacity: 100,
      pressure: 100,
      waterAmount: 50,
      dryAmount: 50,
      edgeDetail: 50,
      pickup: 50,
      eraseStrength: 50,
      antiAlias: 1,
    },
    timestamp: mutationId,
  };
}

function liveAquarelle(mutationId: number, playFrame: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#123456',
    params: { size: 8, water: 50, load: 50, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 0.1, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 0.14, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId,
    timestamp: mutationId,
    playFrame,
  };
}

afterEach(() => { resetAquarelleRecordState(); });

describe('quick 261027-klx CR-01 Copy -> Apply on the synchronous ledger', () => {
  it('consumes every id and settles a multi-brush burst, including the first brush', async () => {
    const ledger = createPaintMutationLedger();
    const port = getRotoPort(ledger);
    let source: RotoScriptSourceSnapshot = {
      selectionKind: 'real-key',
      layerId: null,
      keyId: 'key-4',
      appFrame: 4,
    };
    const controller = createRotoScriptClipboardController({
      getEngine: () => port,
      getSource: () => source,
      getMotion: () => ({ deformation: 0, position: 0 }),
      prepareTarget: async (current) => ({
        keyId: current.keyId ?? 'prepared-key',
        appFrame: current.appFrame,
      }),
    });
    controller.updateEngine(port);
    // The Studio wires exactly this: every ledger completion reaches the
    // controller synchronously, while the enqueue call is still on the stack.
    const unsubscribe = ledger.subscribe((mutation) => {
      controller.observeCompletedMutation(port, mutation);
    });

    // Two guide strokes accepted on frame 4 by the REAL ledger.
    const first = port.enqueueRecordedStroke({ primary: stroke(1, 10) });
    const second = port.enqueueRecordedStroke({ primary: stroke(2, 20) });
    recordAquarelleStroke(first, liveAquarelle(first, 4));
    recordAquarelleStroke(second, liveAquarelle(second, 4));

    await expect(controller.copyScript()).resolves.toBe(true);
    expect(controller.clipboard.value?.brushes).toHaveLength(2);

    source = { selectionKind: 'empty', layerId: null, keyId: null, appFrame: 9 };
    controller.updateSource(source);

    const applying = controller.applyScript();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      applying,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), 1000);
      }),
    ]);
    if (timer !== undefined) clearTimeout(timer);

    // HEAD deadlocks here: the synchronous completions arrive before the
    // controller registers their ids, so the operation never settles.
    expect(settled).toBe(true);
    expect(controller.status.value).toBe('Applied 2');
    expect(controller.applying.value).toBe(false);
    expect(controller.applyProgress.value).toBeNull();
    // Two copied guide strokes + two applied brushes; every id accepted once.
    expect(ledger.getAcceptedStrokeCount()).toBe(4);
    expect(port.getStrokeCount?.()).toBe(4);
    unsubscribe();
  });
});
