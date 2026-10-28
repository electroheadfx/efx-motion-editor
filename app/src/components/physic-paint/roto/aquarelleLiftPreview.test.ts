import { describe, expect, it, vi } from 'vitest';
import {
  beginAquarelleLiftPreview,
  endAquarelleLiftPreview,
  pushAquarelleLiftPreviewDab,
  registerAquarelleLiftPreviewSink,
  revertAquarelleLiftPreview,
} from './aquarelleLiftPreview';

describe('261028-k03b aquarelle lift preview bus', () => {
  it('forwards every gesture event to the registered sink', () => {
    const sink = { begin: vi.fn(), dab: vi.fn(), end: vi.fn(), revert: vi.fn() };
    const unregister = registerAquarelleLiftPreviewSink(sink);
    try {
      beginAquarelleLiftPreview(42);
      pushAquarelleLiftPreviewDab({ x: 0.5, y: 0.5, r: 0.02, amount: 0.22 });
      endAquarelleLiftPreview();
      revertAquarelleLiftPreview();
      expect(sink.begin).toHaveBeenCalledWith(42);
      expect(sink.dab).toHaveBeenCalledWith({ x: 0.5, y: 0.5, r: 0.02, amount: 0.22 });
      expect(sink.end).toHaveBeenCalledTimes(1);
      expect(sink.revert).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
    // The unmounted layer never receives another dab.
    beginAquarelleLiftPreview(43);
    expect(sink.begin).toHaveBeenCalledTimes(1);
  });
});
