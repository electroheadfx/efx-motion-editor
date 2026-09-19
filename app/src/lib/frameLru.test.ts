import { describe, expect, it, vi } from 'vitest';
import { FrameLru } from './frameLru';

/** A mock ImageBitmap stand-in — no real GPU handle, just a close() spy. */
function mockBitmap(): ImageBitmap {
  return { close: vi.fn() } as unknown as ImageBitmap;
}

describe('FrameLru (byte-budgeted LRU with pinning)', () => {
  it('evicts the least-recently-used unpinned entry past the byte ceiling and calls bitmap.close() exactly once', () => {
    const lru = new FrameLru(1500);
    const a = mockBitmap();
    const b = mockBitmap();
    const c = mockBitmap();
    lru.put('a', a, 10, 10); // 400 bytes
    lru.put('b', b, 10, 10); // 800 bytes
    lru.put('c', c, 10, 10); // 1200 bytes — under ceiling
    expect(a.close).not.toHaveBeenCalled();

    lru.put('d', mockBitmap(), 10, 10); // 1600 bytes — over ceiling
    expect(a.close).toHaveBeenCalledTimes(1);
    expect(b.close).not.toHaveBeenCalled();
    expect(c.close).not.toHaveBeenCalled();
    expect(lru.get('a')).toBeUndefined();
    expect(lru.get('b')).toBe(b);
    expect(lru.get('c')).toBe(c);
  });

  it('skips a pinned entry (pinCount > 0) even when it is the least-recently-used', () => {
    const lru = new FrameLru(1500);
    const a = mockBitmap();
    const b = mockBitmap();
    const c = mockBitmap();
    lru.put('a', a, 10, 10);
    lru.put('b', b, 10, 10);
    lru.put('c', c, 10, 10);
    lru.pin('a');

    lru.put('d', mockBitmap(), 10, 10); // over ceiling
    expect(a.close).not.toHaveBeenCalled(); // pinned — skipped
    expect(b.close).toHaveBeenCalledTimes(1); // LRU unpinned victim
    expect(lru.get('a')).toBe(a);
  });

  it('touching an entry (get) updates its lastUsed so it is not the next victim', () => {
    const lru = new FrameLru(1500);
    const a = mockBitmap();
    const b = mockBitmap();
    const c = mockBitmap();
    lru.put('a', a, 10, 10);
    lru.put('b', b, 10, 10);
    lru.put('c', c, 10, 10);
    lru.get('a'); // touch a — it is now most-recently-used

    lru.put('d', mockBitmap(), 10, 10); // over ceiling
    expect(a.close).not.toHaveBeenCalled(); // a was touched
    expect(b.close).toHaveBeenCalledTimes(1); // b is now the LRU victim
  });

  it('releasing a pin (pinCount back to 0) makes the entry evictable again', () => {
    const lru = new FrameLru(1500);
    const a = mockBitmap();
    const b = mockBitmap();
    const c = mockBitmap();
    lru.put('a', a, 10, 10);
    lru.put('b', b, 10, 10);
    lru.put('c', c, 10, 10);
    lru.pin('a');
    lru.put('d', mockBitmap(), 10, 10); // over ceiling — b evicted, a skipped
    expect(a.close).not.toHaveBeenCalled();
    expect(b.close).toHaveBeenCalledTimes(1);

    lru.unpin('a');
    lru.put('e', mockBitmap(), 10, 10); // over ceiling — a now evictable
    expect(a.close).toHaveBeenCalledTimes(1);
    expect(lru.get('a')).toBeUndefined();
  });

  it('clear() evicts every entry (pinned included), closing each bitmap and zeroing the byte total', () => {
    const lru = new FrameLru(1500);
    const a = mockBitmap();
    const b = mockBitmap();
    lru.put('a', a, 10, 10);
    lru.put('b', b, 10, 10);
    lru.pin('a'); // pinned — clear() must still close it (teardown, not eviction)

    lru.clear();
    expect(a.close).toHaveBeenCalledTimes(1);
    expect(b.close).toHaveBeenCalledTimes(1);
    expect(lru.get('a')).toBeUndefined();
    expect(lru.get('b')).toBeUndefined();
    expect(lru.byteTotal).toBe(0);
  });
});
