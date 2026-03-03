/**
 * ThumbnailCache: Lazily loads thumbnail images for use with Canvas drawImage().
 *
 * Returns cached HTMLImageElement if loaded, or null (caller draws placeholder).
 * Fires onLoad callback when any image finishes loading so the timeline can redraw.
 */
export class ThumbnailCache {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();
  onLoad: (() => void) | null = null;

  /**
   * Get a cached image for the given imageId. If not yet loaded, starts loading
   * and returns null (caller should draw a placeholder).
   */
  get(imageId: string, thumbnailUrl: string): HTMLImageElement | null {
    const cached = this.cache.get(imageId);
    if (cached?.complete) return cached;

    if (!this.loading.has(imageId)) {
      this.loading.add(imageId);
      const img = new Image();
      img.onload = () => {
        this.cache.set(imageId, img);
        this.loading.delete(imageId);
        this.onLoad?.();
      };
      img.onerror = () => {
        this.loading.delete(imageId);
      };
      img.src = thumbnailUrl;
    }

    return null;
  }

  /** Clear all cached and in-flight images */
  clear() {
    this.cache.clear();
    this.loading.clear();
  }
}
