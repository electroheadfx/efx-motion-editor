import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const addFxMenuSource = readFileSync(
  fileURLToPath(new URL('./AddFxMenu.tsx', import.meta.url)),
  'utf8',
);
const sequenceStoreSource = readFileSync(
  fileURLToPath(new URL('../../stores/sequenceStore.ts', import.meta.url)),
  'utf8',
);
const timelineVisibleSpanSource = readFileSync(
  fileURLToPath(new URL('../../lib/timelineVisibleSpan.ts', import.meta.url)),
  'utf8',
);

/** Slice a handler body by its declaration and the next sibling handler. */
function handlerBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = `);
  expect(start, `handler ${name} not found`).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + 1);
  const next = rest.search(/\n  const handle|\n  return \(/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('AddFxMenu physic-paint view span (261010-mwy)', () => {
  it('routes handleAddPhysicPaintLayer through resolvePhysicPaintCreateSpan', () => {
    const body = handlerBody(addFxMenuSource, 'handleAddPhysicPaintLayer');
    expect(body).toContain('resolvePhysicPaintCreateSpan');
    expect(addFxMenuSource).toContain("import {resolvePhysicPaintCreateSpan}");
  });

  it('reads viewport signals with .peek() at click time (narrow reads, no subscription)', () => {
    const body = handlerBody(addFxMenuSource, 'handleAddPhysicPaintLayer');
    expect(body).toContain('timelineStore.zoom.peek()');
    expect(body).toContain('timelineStore.scrollX.peek()');
    expect(body).toContain('timelineStore.viewportWidth.peek()');
    // The menu must not subscribe to viewport signals in render/effects.
    expect(body).not.toContain('timelineStore.zoom.value');
    expect(body).not.toContain('timelineStore.scrollX.value');
    expect(body).not.toContain('timelineStore.viewportWidth.value');
  });

  it('always supplies both span opts (inFrame + outFrame) to createFxSequence', () => {
    const body = handlerBody(addFxMenuSource, 'handleAddPhysicPaintLayer');
    // Single createFxSequence call carrying both span opts (nested peek() parens
    // break a naive [^)]* scan — match the opts object itself).
    expect(body).toContain('createSpan.inFrame');
    expect(body).toContain('createSpan.outFrame');
    expect(body).toContain("position: 'top'");
    expect(body).toContain('inFrame: createSpan.inFrame');
    expect(body).toContain('outFrame: createSpan.outFrame');
  });

  it('keeps the isolation short-circuit: isolated range wins when targetSequenceId is set', () => {
    const body = handlerBody(addFxMenuSource, 'handleAddPhysicPaintLayer');
    expect(body).toContain('targetSequenceId');
    expect(body).toContain('isolatedInFrame');
    expect(body).toContain('isolatedOutFrame');
    expect(body).toContain('resolvePhysicPaintCreateSpan({');
    expect(body).toContain('isolated:');
  });

  it('leaves Paint / FX / content handlers on their existing call shape', () => {
    const paint = handlerBody(addFxMenuSource, 'handleAddPaintLayer');
    const fx = handlerBody(addFxMenuSource, 'handleAddFxLayer');
    const content = handlerBody(addFxMenuSource, 'handleAddContentLayer');

    // Paint keeps the isolation branch shape (opts only when targetSequenceId).
    expect(paint).toContain('if (targetSequenceId)');
    expect(paint).toContain('inFrame: isolatedInFrame, outFrame: isolatedOutFrame');
    expect(paint).not.toContain('resolvePhysicPaintCreateSpan');

    // FX keeps the same createFxSequence dual-call shape.
    expect(fx).toContain('if (targetSequenceId)');
    expect(fx).toContain('inFrame: isolatedInFrame, outFrame: isolatedOutFrame');
    expect(fx).not.toContain('resolvePhysicPaintCreateSpan');

    // Content keeps setAddLayerIntent.
    expect(content).toContain('setAddLayerIntent');
    expect(content).not.toContain('resolvePhysicPaintCreateSpan');
  });

  it('leaves the createFxSequence outFrame fallback intact', () => {
    expect(sequenceStoreSource).toContain(
      'opts?.outFrame ?? (totalFrames > 0 ? totalFrames : 100)',
    );
  });

  it('timelineVisibleSpan stays the only home of the LOCKED view-span law', () => {
    expect(timelineVisibleSpanSource).toContain('BASE_FRAME_WIDTH * view.zoom');
    expect(timelineVisibleSpanSource).toContain('view.viewportWidth - TRACK_HEADER_WIDTH');
    expect(timelineVisibleSpanSource).toContain('Math.max(1, Math.round(trackArea / frameWidth))');
    expect(timelineVisibleSpanSource).toContain('Math.floor(view.scrollX / frameWidth)');
    // The 100-frame createFxSequence fallback is never an input to resolvePhysicPaintCreateSpan
    // (no fallback literal in the computation — only in the explanatory comment).
    expect(timelineVisibleSpanSource).not.toMatch(/\?\? 100|: 100\b/);
    expect(timelineVisibleSpanSource).toContain('isolated: TimelineFrameSpan | null');
  });
});
