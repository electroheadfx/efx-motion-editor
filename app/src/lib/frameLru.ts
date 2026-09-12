/**
 * 52.1 (D-08..D-12): the single decoded-frame cache authority — a byte-budgeted
 * LRU keyed by stable frame ID (cachePath / sourceRef / library asset ID /
 * bytes content token). Decoded frames are GPU-backed ImageBitmap handles; the
 * LRU owns `bitmap.close()` on eviction (D-11) and skips pinned entries
 * (pinCount > 0) so an in-flight draw can never be closed mid-`drawImage`.
 *
 * Budget is in BYTES (D-09), never frame counts — resolution-agnostic (D-16).
 * One budget, one eviction policy (D-10): neighbor prewarm shares this same
 * ceiling, there is no second prewarm budget.
 */

/** Decoded RGBA byte size for one frame: width * height * 4. */
export function frameByteSize(width: number, height: number): number {
  return width * height * 4;
}

/** Fixed 512 MB byte ceiling (D-09) — a tuning constant, reversible. */
export const FRAME_LRU_BYTE_CEILING = 512 * 1024 * 1024;

export interface FrameLruEntry {
  readonly key: string;
  bitmap: ImageBitmap;
  readonly byteSize: number;
  pinCount: number;
  lastUsed: number;
}

export class FrameLru {
  private readonly entries = new Map<string, FrameLruEntry>();
  private totalBytes = 0;
  private clock = 0;
  private capacityEvictionTotal = 0;
  private explicitEvictionTotal = 0;

  constructor(private readonly byteCeiling: number = FRAME_LRU_BYTE_CEILING) {}

  /** Resolve a decoded handle, bumping its LRU recency. */
  get(key: string): ImageBitmap | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    entry.lastUsed = ++this.clock;
    return entry.bitmap;
  }

  /** True when the key holds a live (non-evicted) entry. */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Insert (or replace) a decoded frame. `byteSize = width * height * 4`.
   * Replacing an existing key closes the prior bitmap. Evicts least-recently-
   * used unpinned entries until the total is back under the ceiling.
   */
  put(key: string, bitmap: ImageBitmap, width: number, height: number): void {
    const byteSize = frameByteSize(width, height);
    const existing = this.entries.get(key);
    if (existing) {
      this.totalBytes -= existing.byteSize;
      existing.bitmap.close();
      this.entries.delete(key);
    }
    const entry: FrameLruEntry = { key, bitmap, byteSize, pinCount: 0, lastUsed: ++this.clock };
    this.entries.set(key, entry);
    this.totalBytes += byteSize;
    this.evictIfNeeded();
  }

  /** Pin an entry (in-flight draw) — it becomes unevictable until unpinned. */
  pin(key: string): void {
    const entry = this.entries.get(key);
    if (entry) entry.pinCount += 1;
  }

  /** Release one pin; at pinCount 0 the entry is evictable again. */
  unpin(key: string): void {
    const entry = this.entries.get(key);
    if (entry && entry.pinCount > 0) entry.pinCount -= 1;
  }

  /** Explicitly evict one entry, closing its bitmap. */
  evict(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalBytes -= entry.byteSize;
    this.explicitEvictionTotal += 1;
    entry.bitmap.close();
  }

  /** Current decoded byte total (diagnostics). */
  get byteTotal(): number {
    return this.totalBytes;
  }

  /** Live entry count (diagnostics). */
  get entryCount(): number {
    return this.entries.size;
  }

  /** Evictions caused by byte-ceiling pressure in `evictIfNeeded` (diagnostics). */
  get capacityEvictionCount(): number {
    return this.capacityEvictionTotal;
  }

  /** Entries closed by an explicit `evict()` call (diagnostics). */
  get explicitEvictionCount(): number {
    return this.explicitEvictionTotal;
  }

  /** Evict every entry, closing each bitmap (reset/teardown). */
  clear(): void {
    for (const entry of this.entries.values()) {
      entry.bitmap.close();
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  private evictIfNeeded(): void {
    while (this.totalBytes > this.byteCeiling) {
      let victim: FrameLruEntry | undefined;
      for (const entry of this.entries.values()) {
        if (entry.pinCount > 0) continue;
        if (!victim || entry.lastUsed < victim.lastUsed) victim = entry;
      }
      if (!victim) break; // every entry is pinned — nothing evictable
      this.entries.delete(victim.key);
      this.totalBytes -= victim.byteSize;
      this.capacityEvictionTotal += 1;
      victim.bitmap.close();
    }
  }
}

/** The process-wide decoded-frame cache authority (D-12). */
export const frameLru = new FrameLru();
