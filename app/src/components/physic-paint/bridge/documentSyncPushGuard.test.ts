import { describe, expect, it } from 'vitest';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { createDocumentSyncPushGuard } from './documentSyncPushGuard';

const doc = { parentLayerId: 'layer-x' } as EfxPaintDocument;

describe('createDocumentSyncPushGuard', () => {
  it('sends the first push even when the serialize is a no-op (launch / crash-recovery mount push)', () => {
    const guard = createDocumentSyncPushGuard();
    let version = 0;
    // Fresh session: the mount push must go out even though nothing changed —
    // after a reload the main window may hold an older mirror.
    expect(guard.evaluate(() => doc, () => version)).toBe(doc);
  });

  it('skips a second consecutive push when no mutation happened', () => {
    const guard = createDocumentSyncPushGuard();
    let version = 0;
    expect(guard.evaluate(() => doc, () => version)).toBe(doc);
    // No mutation: serialize produced no version bump → duplicate → skipped.
    expect(guard.evaluate(() => doc, () => version)).toBeNull();
  });

  it('sends again when a real mutation bumped the version', () => {
    const guard = createDocumentSyncPushGuard();
    let version = 0;
    expect(guard.evaluate(() => doc, () => version)).toBe(doc);
    // A mutation bumps the version inside the serialize step → must send.
    expect(guard.evaluate(() => { version += 1; return doc; }, () => version)).toBe(doc);
    // Another mutation → sends again.
    expect(guard.evaluate(() => { version += 1; return doc; }, () => version)).toBe(doc);
  });

  it('does not produce a duplicate after a segment apply (the #3/#4 pair)', () => {
    const guard = createDocumentSyncPushGuard();
    let version = 0;
    // Launch mount push.
    expect(guard.evaluate(() => doc, () => version)).toBe(doc);
    // Segment apply: the debounced push serializes a real change → bumps → sends.
    let mutated = false;
    const serializeAfterApply = () => {
      if (!mutated) { version += 1; mutated = true; }
      return doc;
    };
    expect(guard.evaluate(serializeAfterApply, () => version)).toBe(doc);
    // The bump re-fires the immediate push effect: serialize is now a no-op → skip.
    expect(guard.evaluate(serializeAfterApply, () => version)).toBeNull();
  });

  it('returns null when the serialize produces no document', () => {
    const guard = createDocumentSyncPushGuard();
    expect(guard.evaluate(() => null, () => 0)).toBeNull();
  });
});
