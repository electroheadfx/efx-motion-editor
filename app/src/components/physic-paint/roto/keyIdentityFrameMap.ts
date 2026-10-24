// ============================================================
//  keyIdentityFrameMap — the ONE key-identity frame mapping.
//
//  An accepted physical edit rewrites appFrames but keeps key IDs.
//  Every session store anchored to a frame (roto physical ownership,
//  the brush script ledger, the watercolor record state) must follow
//  its KEY IDENTITY, never the old frame number.
//
//  `buildKeyIdentityFrameMap` answers one question: where did each
//  physical key's app frame move? It is a pure old→new frame map.
//
//  A null result means a MALFORMED layout (duplicate keyId or
//  appFrame on either side) and every caller must fail closed.
//
//  The map must NOT be used to infer ownership: callers that enforce
//  ownership (roto) gate on the pre-state key identity FIRST and use
//  this map only for destination frames.
// ============================================================

/** The structural key identity pair every session store anchors on. */
export interface KeyIdentityFrameRecord {
  readonly keyId: string;
  readonly appFrame: number;
}

/**
 * Build the old→new app-frame map by key identity.
 *
 *  - A surviving key maps its old frame to the key's new frame.
 *  - A key that disappeared leaves no mapping (its content is dropped
 *    from the session, never moved to an unrelated key).
 *  - A frame that GAINED a key keeps whatever session content was
 *    already anchored there (identity entry frame → frame).
 *
 * Returns null for a malformed layout without mutating anything.
 */
export function buildKeyIdentityFrameMap(
  before: readonly KeyIdentityFrameRecord[],
  after: readonly KeyIdentityFrameRecord[],
): Map<number, number> | null {
  const keyIdByOldFrame = new Map<number, string>();
  const beforeKeyIds = new Set<string>();
  for (const record of before) {
    if (beforeKeyIds.has(record.keyId) || keyIdByOldFrame.has(record.appFrame)) return null;
    beforeKeyIds.add(record.keyId);
    keyIdByOldFrame.set(record.appFrame, record.keyId);
  }

  const frameByKeyId = new Map<string, number>();
  const afterFrames = new Set<number>();
  for (const record of after) {
    if (frameByKeyId.has(record.keyId) || afterFrames.has(record.appFrame)) return null;
    frameByKeyId.set(record.keyId, record.appFrame);
    afterFrames.add(record.appFrame);
  }

  const frameRemap = new Map<number, number>();
  const destinations = new Set<number>();
  // Owned frames first: a surviving key always wins its new destination.
  for (const [oldFrame, keyId] of keyIdByOldFrame) {
    const nextFrame = frameByKeyId.get(keyId);
    if (nextFrame === undefined) continue;
    frameRemap.set(oldFrame, nextFrame);
    destinations.add(nextFrame);
  }
  // A frame that just gained a key (direct auto-paint) keeps its script.
  for (const frame of afterFrames) {
    if (keyIdByOldFrame.has(frame) || destinations.has(frame)) continue;
    frameRemap.set(frame, frame);
  }
  return frameRemap;
}
