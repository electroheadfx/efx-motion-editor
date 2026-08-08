import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const transport = readFileSync(fileURLToPath(new URL('./physicsPaintBridgeTransport.ts', import.meta.url)), 'utf8');

describe('generic Physics Paint child transport', () => {
  it('retains generic apply, authority, script, audio, frame-sync, and thumbnail senders only', () => {
    for (const retained of [
      'sendPhysicPaintApplyPayload',
      'sendPhysicPaintRotoAuthorityRequest',
      'sendPhysicPaintScriptLibraryRequest',
      'sendPhysicPaintAudioOwnership',
      'sendPhysicPaintFrameSyncMessage',
      'createPhysicPaintThumbnailNativeEncoder',
    ]) expect(transport).toContain(retained);

    for (const removed of [
      'sendPhysicPaintOpenLoopEdit',
      'sendPhysicPaintLoopOperationRequest',
      'sendPhysicPaintLoopOperationResult',
      'PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT',
    ]) expect(transport).not.toContain(removed);
  });
});
