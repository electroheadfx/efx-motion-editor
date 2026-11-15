// ============================================================
//  aquarelleTextureParity — live, bake and replay agree on the
//  (brushId, textureId) pair (quick-261115-oh9, acceptance 5).
//
//  The texture axis must not fork the brush resolution: the LIVE
//  selection (`aquarelleBrushForActiveTool`), the RECORDED stroke's
//  projection (`toStudioStroke` → codec serialize/parse) and the
//  parsed payload's engine slot (what the bake configures) all
//  resolve through `buildBrushForStroke`, so the three brushes are
//  field-identical and their tip bytes are the same mask.
//
//  Preact-free of DOM: the record store is plain module signals.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  NEUTRAL_TOOL_OVERRIDES,
  type AquarelleToolOverrides,
} from '@efxlab/efx-watercolor/brushes';
import { buildBrushForStroke, type Brush } from '@efxlab/efx-watercolor';
import {
  isAquarelleDryEvent,
  parse,
  serialize,
  toStudioStroke,
  type AquarelleStroke,
  type AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  aquarelleActiveTool,
  aquarelleBrushForActiveTool,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  buildAquarelleStrokePayload,
  resetAquarelleRecordState,
  setAquarelleSelectedTextureId,
  snapshotAquarelleRecord,
} from '../view/aquarelleRecordState';

const TEXTURE_ID = 'wc/builtin-chalk';
const RESPONSE_ID = 'chalk';
const OVERRIDES: AquarelleToolOverrides = {
  ...NEUTRAL_TOOL_OVERRIDES,
  tip: 1.4,
  aspect: 0.8,
  scatter: 1.25,
};

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function recordedRuntimeStroke(
  textureId: string | undefined,
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#2244aa',
    params: { size: 12, water: 50 },
    brushId: RESPONSE_ID,
    points: [
      { x: 0.2, y: 0.8, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 0.5, y: 0.5, p: 0.7, tx: 0, ty: 0, tw: 0 },
    ],
    toolOverrides: { ...OVERRIDES },
    mutationId: 5,
    timestamp: 10,
    ...(textureId !== undefined ? { textureId } : {}),
  };
}

function parsedStroke(raw: unknown): StudioStroke<AquarelleStrokePayload> {
  const parsed = parse(raw);
  if (parsed === null || isAquarelleDryEvent(parsed)) {
    throw new Error('expected the wire form to parse as a stroke payload');
  }
  return parsed;
}

function assertSameBrush(actual: Brush, expected: Brush, label: string): void {
  if (!sameBytes(actual.tipData, expected.tipData)) {
    throw new Error(`${label}: tipData bytes diverged from the live brush`);
  }
  expect(actual.aspect, `${label}: aspect`).toBe(expected.aspect);
  expect(actual.spacing, `${label}: spacing`).toBe(expected.spacing);
  expect(actual.scatter, `${label}: scatter`).toBe(expected.scatter);
  expect(actual.grain, `${label}: grain`).toBe(expected.grain);
  expect(actual.wetRound, `${label}: wetRound`).toBe(expected.wetRound);
  expect(actual.rotation, `${label}: rotation`).toBe(expected.rotation);
}

beforeEach(() => {
  resetAquarelleRecordState();
  aquarelleActiveTool.value = 'brush';
  aquarelleSelectedTipId.value = RESPONSE_ID;
  aquarelleToolOverrides.value = { ...OVERRIDES };
  setAquarelleSelectedTextureId(null);
});

describe('live / bake / replay texture parity (quick-261115-oh9)', () => {
  it('the live, recorded and replayed brushes are field-identical with a texture', () => {
    // LIVE — the one binding seam the engine reads.
    setAquarelleSelectedTextureId(TEXTURE_ID);
    const liveSelection = aquarelleBrushForActiveTool();
    expect(liveSelection.brushId).toBe(RESPONSE_ID);
    expect(liveSelection.textureId).toBe(TEXTURE_ID);
    const live = buildBrushForStroke(liveSelection.brushId, {
      textureId: liveSelection.textureId,
      overrides: liveSelection.toolOverrides,
    });

    // RECORD — the snapshot and the payload both carry the pair.
    const snap = snapshotAquarelleRecord();
    expect(snap.textureId).toBe(TEXTURE_ID);
    const payload = buildAquarelleStrokePayload();
    expect(payload.textureId).toBe(TEXTURE_ID);

    // BAKE / REPLAY — through the codec's opaque engine slot.
    const wire = serialize(toStudioStroke(recordedRuntimeStroke(TEXTURE_ID)));
    const engine = parsedStroke(wire).engine;
    expect(engine.brushId).toBe(RESPONSE_ID);
    expect(engine.textureId).toBe(TEXTURE_ID);
    const baked = buildBrushForStroke(engine.brushId, {
      textureId: engine.textureId ?? null,
      overrides: engine.toolOverrides,
    });

    assertSameBrush(baked, live, 'replay');
    // The texture actually reached the footprint: the live brush stamps the
    // registered chalk mask, not the procedural chalk tip.
    expect(live.tipSize).toBe(192);
    expect(live.aspect).toBe(0.8 * 0.8);
  })

  it('a stroke recorded without a texture gains no key and replays the response tip', () => {
    const snap = snapshotAquarelleRecord();
    expect(snap.textureId).toBe(null);
    const payload = buildAquarelleStrokePayload();
    expect('textureId' in payload).toBe(false);

    const wire = serialize(toStudioStroke(recordedRuntimeStroke(undefined)));
    const replayed = parsedStroke(wire);
    expect('textureId' in replayed.engine).toBe(false);

    const live = buildBrushForStroke(RESPONSE_ID, {
      textureId: null,
      overrides: OVERRIDES,
    });
    const baked = buildBrushForStroke(replayed.engine.brushId, {
      textureId: replayed.engine.textureId ?? null,
      overrides: replayed.engine.toolOverrides,
    });
    assertSameBrush(baked, live, 'no-texture replay');
  })

  it('the unknown-texture fallback survives the round-trip unchanged', () => {
    setAquarelleSelectedTextureId('wc/custom-gone');
    const liveSelection = aquarelleBrushForActiveTool();
    const live = buildBrushForStroke(liveSelection.brushId, {
      textureId: liveSelection.textureId,
      overrides: liveSelection.toolOverrides,
    });
    const wire = serialize(toStudioStroke(recordedRuntimeStroke('wc/custom-gone')));
    const replayed = parsedStroke(wire);
    const baked = buildBrushForStroke(replayed.engine.brushId, {
      textureId: replayed.engine.textureId ?? null,
      overrides: replayed.engine.toolOverrides,
    });
    assertSameBrush(baked, live, 'unknown-texture replay');
    // Both fell back to the response's procedural tip.
    const procedural = buildBrushForStroke(RESPONSE_ID, { overrides: OVERRIDES });
    expect(sameBytes(live.tipData, procedural.tipData)).toBe(true);
  })
});
