import { describe, expect, it } from 'vitest';
// The resolver module is created in the GREEN step; the unresolved import is the
// intended RED signal for every case below (260918-o0n).
import { resolveFxSpanDragRange } from './timelineFxSpanDrag';

describe('FX-area span drag range (260918-o0n)', () => {
  it('extends a shrunk span back out past the collapsed timeline end (the repro)', () => {
    // Gesture 1 — the user shrinks the span. The derived timeline collapses onto
    // the span's own new end, which is exactly what used to become the ceiling.
    expect(resolveFxSpanDragRange({ mode: 'resize-right', origIn: 0, origOut: 100, delta: -40 }))
      .toEqual({ inFrame: 0, outFrame: 60 });

    // Gesture 2 — dragging the shrunk span back out must be possible again.
    expect(resolveFxSpanDragRange({ mode: 'resize-right', origIn: 0, origOut: 60, delta: 40 }))
      .toEqual({ inFrame: 0, outFrame: 100 });
  });

  it("an extension is never capped at the span's own current end", () => {
    // The live timeline total in this state equals 60, so an implementation that
    // clamps against it resolves 60 here instead of 65.
    expect(resolveFxSpanDragRange({ mode: 'resize-right', origIn: 0, origOut: 60, delta: 5 }))
      .toEqual({ inFrame: 0, outFrame: 65 });
  });

  it('keeps the one-frame floor on resize-right', () => {
    expect(resolveFxSpanDragRange({ mode: 'resize-right', origIn: 0, origOut: 60, delta: -1000 }))
      .toEqual({ inFrame: 0, outFrame: 1 });
  });

  it('resize-left keeps the start inside [0, end-1] and never moves the end', () => {
    expect(resolveFxSpanDragRange({ mode: 'resize-left', origIn: 10, origOut: 60, delta: 40 }))
      .toEqual({ inFrame: 50, outFrame: 60 });
    expect(resolveFxSpanDragRange({ mode: 'resize-left', origIn: 10, origOut: 60, delta: -100 }))
      .toEqual({ inFrame: 0, outFrame: 60 });
  });

  it('move translates the whole span, preserving duration, and may push the end past the current end', () => {
    expect(resolveFxSpanDragRange({ mode: 'move', origIn: 0, origOut: 60, delta: 45 }))
      .toEqual({ inFrame: 45, outFrame: 105 });
    expect(resolveFxSpanDragRange({ mode: 'move', origIn: 0, origOut: 60, delta: -100 }))
      .toEqual({ inFrame: 0, outFrame: 60 });
  });
});
