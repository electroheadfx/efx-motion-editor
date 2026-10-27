// ============================================================
//  261027-gh9e — Water color pen pressure.
//
//  On macOS a tablet often reaches WKWebView as pointerType 'mouse'
//  with no pressure, so the watercolor engine saw no pen dynamics at
//  all. The host already listens for the Rust `tablet:pressure`
//  event (engine-1 consumes it); the aquarelle layer must forward the
//  same sample to the engine and the engine must prefer it while the
//  pointer reports none. Source-scan pin (same idiom as
//  aquarelleLayerContract.test.ts).
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const engineSource = readFileSync(
  fileURLToPath(new URL('../../../../../packages/efx-watercolor/src/playground/Engine.ts', import.meta.url)),
  'utf8',
);
const layerSource = readFileSync(
  fileURLToPath(new URL('./AquarelleCanvasLayer.tsx', import.meta.url)),
  'utf8',
);

describe('261027-gh9e Water color native pen pressure', () => {
  it('the engine exposes the native pen injection with a freshness window', () => {
    expect(engineSource).toContain('updateNativePenInput(input: { pressure: number; tiltX?: number; tiltY?: number }): void');
    expect(engineSource).toContain('this.nativePenAt = this.clock();');
    expect(engineSource).toContain('now - this.nativePenAt < 300');
    // The pointer path prefers the native sample when the PointerEvent
    // carries no pen dynamics (macOS reports 'mouse' with pressure 0).
    expect(engineSource).toContain('const reportsPenDynamics = e.pointerType === \'pen\'');
    expect(engineSource).toContain('p = Math.pow(this.nativePen.pressure, 0.8);');
  });

  it('the aquarelle layer forwards the Rust tablet:pressure event to the engine', () => {
    expect(layerSource).toContain("'tablet:pressure'");
    expect(layerSource).toContain('engine.updateNativePenInput({');
    expect(layerSource).toContain('pressure: event.payload.pressure,');
    expect(layerSource).toContain('penBridgeDisposed = true;');
    expect(layerSource).toContain('disposePenBridge?.();');
  });
});
