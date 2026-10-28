// ============================================================
//  aquarelleLiftPreview — the live erase preview bridge
//  (261028-k03b).
//
//  The engine erases the LIVE sheet, but on a cooked frame the
//  visible paint is the cached base. Without a preview the user
//  sees nothing until the punch/re-bake commits (~1.5 s later),
//  then a full refresh: "slow, soft, flashing".
//
//  The engine hands over the EXACT dab it applied
//  (`onLiftDab(x, y, r, amount)`, document uv y up). The Studio
//  forwards it here; the mounted AquarelleCachedBaseLayer punches
//  the same numbers into its decoded transmittance and redraws the
//  dirty rect while the user draws. The authoritative punch/bake
//  still commits at stroke end; the preview only holds the visual
//  until the new bytes land.
//
//  One sink: the Studio shows one sheet at a time. A registration
//  returns its own unregister so a remount can never leave a stale
//  layer receiving dabs.
// ============================================================

export interface AquarelleLiftPreviewDab {
  /** Document uv, y up (the engine's native space). */
  x: number;
  y: number;
  /** Footprint radius in document heights. */
  r: number;
  /** Effective per-dab erase amount (0..0.9). */
  amount: number;
}

export interface AquarelleLiftPreviewSink {
  /** A lift gesture began on `frame`; the layer arms its preview. */
  begin(frame: number): void;
  /** One applied engine dab. The layer batches per animation frame. */
  dab(dab: AquarelleLiftPreviewDab): void;
  /**
   * The gesture ended. The painted preview STAYS visible until the
   * authoritative bytes replace it (commit or script re-bake).
   */
  end(): void;
  /** The commit/bake failed: restore the pre-gesture display. */
  revert(): void;
}

let previewSink: AquarelleLiftPreviewSink | null = null;

export function registerAquarelleLiftPreviewSink(sink: AquarelleLiftPreviewSink): () => void {
  previewSink = sink;
  return () => {
    if (previewSink === sink) previewSink = null;
  };
}

export function beginAquarelleLiftPreview(frame: number): void {
  previewSink?.begin(frame);
}

export function pushAquarelleLiftPreviewDab(dab: AquarelleLiftPreviewDab): void {
  previewSink?.dab(dab);
}

export function endAquarelleLiftPreview(): void {
  previewSink?.end();
}

export function revertAquarelleLiftPreview(): void {
  previewSink?.revert();
}
