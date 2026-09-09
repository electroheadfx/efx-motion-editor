import { describe, expect, it } from 'vitest';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { createDocumentSyncPushGuard } from './documentSyncPushGuard';

function paperVariant(doc: EfxPaintDocument): EfxPaintDocument {
  return {
    ...doc,
    background: { ...doc.background, fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0.1 } },
  };
}

describe('createDocumentSyncPushGuard', () => {
  it('sends the first push even when the serialize is a no-op (launch / crash-recovery mount push)', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    // Fresh session: the mount push must go out even though nothing changed —
    // after a reload the main window may hold an older mirror.
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
  });

  it('skips a second consecutive push when the document content is unchanged', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
    expect(guard.evaluate(() => doc, () => 0)).toBeNull();
  });

  it('sends again when a real mutation changed the document content', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
    // Direct mutation (setBackgroundFallback shape): the LIVE document already
    // carries the paper fallback when the scheduled push serializes it — the
    // old before/after version heuristic dropped this. Content comparison must send it.
    expect(guard.evaluate(() => paperVariant(doc), () => 0)).not.toBeNull();
  });

  it('does not produce a duplicate after a segment apply (the #3/#4 pair)', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    // Launch mount push.
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
    // Segment/background apply: serialize returns the changed document → sends.
    expect(guard.evaluate(() => paperVariant(doc), () => 0)).not.toBeNull();
    // The bump re-fires the immediate push effect: serialize is now the same
    // changed document → skip.
    expect(guard.evaluate(() => paperVariant(doc), () => 0)).toBeNull();
  });

  it('returns null when the serialize produces no document', () => {
    const guard = createDocumentSyncPushGuard();
    expect(guard.evaluate(() => null, () => 0)).toBeNull();
  });
});
