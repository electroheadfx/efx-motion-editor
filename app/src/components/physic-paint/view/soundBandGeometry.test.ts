import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 52.5-01b Task 3 RED — Studio sound band geometry + trim law + gesture
 * truth-table source assertions (UI-SPEC Interaction Contracts, D-07/D-08/D-09).
 *
 * The geometry module does not exist yet: every target test uses a dynamic
 * `await import()` inside the test body so each test reports its own named
 * failure (no collection load-failure). The source assertions pin the truth
 * table at the handler level per the plan's acceptance criteria.
 */

const load = () => import('./soundBandGeometry');

const readSource = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('soundBandGeometry — band layout constants (D-07)', () => {
  it('(t1) the band is 36px with an 8px inset and a 14px stain half-extent', async () => {
    const g = await load();
    expect(g.SOUND_BAND_HEIGHT_PX).toBe(36);
    expect(g.SOUND_STAIN_INSET_PX).toBe(8);
    expect(g.SOUND_STAIN_HALF_EXTENT_PX).toBe(14);
  });

  it('(t2) arm thresholds: 4px stain reposition, 2px trim, 6px end zones, 8px hit depth', async () => {
    const g = await load();
    expect(g.SOUND_STAIN_ARM_PX).toBe(4);
    expect(g.SOUND_TRIM_ARM_PX).toBe(2);
    expect(g.SOUND_TRIM_ZONE_PX).toBe(6);
    expect(g.SOUND_TRIM_HIT_PX).toBe(8);
  });

  it('(t3) the stain spans [start, start+(out-in)] in content space at cell pitch', async () => {
    const g = await load();
    expect(g.soundSpanFrames(0, 120)).toBe(120);
    expect(g.soundSpanFrames(30, 30)).toBe(0);
    expect(g.soundStainLeftPx(7, 18)).toBe(126);
    expect(g.soundStainWidthPx(0, 120, 18)).toBe(2160);
  });
});

describe('soundBandGeometry — tier selection mirrors TimelineRenderer.drawAudioTrack (D-04)', () => {
  const tier = (n: number) => new Float32Array(n); // interleaved [min,max] pairs
  const peaks = { tier1: tier(1000), tier2: tier(4000), tier3: tier(32000) };

  it('(t4) pixelsPerPeak < 1 -> tier1, > 4 -> tier3, else tier2; no peaks -> null', async () => {
    const g = await load();
    // tier2 has 2000 pairs: 100px/2000 = 0.05 < 1 -> tier1
    expect(g.selectSoundPeaks(peaks, 100)).toBe(peaks.tier1);
    // 6000px/2000 = 3 (1..4) -> tier2
    expect(g.selectSoundPeaks(peaks, 6000)).toBe(peaks.tier2);
    // 10000px/2000 = 5 > 4 -> tier3
    expect(g.selectSoundPeaks(peaks, 10000)).toBe(peaks.tier3);
    // tier2 empty -> tier1 fallback; undefined -> null (no stain, loading state)
    expect(g.selectSoundPeaks({ tier1: peaks.tier1, tier2: new Float32Array(0), tier3: peaks.tier3 }, 500)).toBe(peaks.tier1);
    expect(g.selectSoundPeaks(undefined, 500)).toBeNull();
  });
});

describe('soundBandGeometry — filled waveform path (TimelineRenderer trace adapted)', () => {
  it('(t5) traces maxes left-to-right on top, mins right-to-left on bottom, inside ±14 of center', async () => {
    const g = await load();
    const peaks = new Float32Array([-0.5, 0.5, -1, 1, -0.25, 0.25]); // 3 pairs
    const d = g.soundWaveformPathD(peaks, 20);
    expect(d).not.toBeNull();
    expect(d!.startsWith('M')).toBe(true);
    expect(d!.endsWith('Z')).toBe(true);
    // first max (0.5) -> y = 18 - 0.5*14 = 11
    expect(d).toContain('M0 11');
    // every y must stay within [4, 32] (center 18 ± half-extent 14)
    const ys = [...d!.matchAll(/[ML][\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys.length).toBeGreaterThanOrEqual(6);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y).toBeLessThanOrEqual(32);
    }
    // too few peaks -> no path (degenerate, never a broken shape)
    expect(g.soundWaveformPathD(new Float32Array([0, 0]), 20)).toBeNull();
  });
});

describe('soundBandGeometry — trim law (UI-SPEC: in < out, min span 1, start >= 0, parent end)', () => {
  it('(t6) reposition bounds the START (body may overhang) so a full-width clip is never pinned', async () => {
    const g = await load();
    expect(g.clampSoundRepositionStart(10, 5, 100)).toBe(15);
    expect(g.clampSoundRepositionStart(10, -50, 100)).toBe(0);
    // UAT round 5: the start may reach the last parent frame (the body
    // overhangs) — a full-width clip used to be pinned at 0.
    expect(g.clampSoundRepositionStart(10, 500, 100)).toBe(99);
    // full-width clip (span == parent) at 0 can now be dragged to frame 10,
    // matching the UAT "instead" placement.
    expect(g.clampSoundRepositionStart(0, 10, 30)).toBe(10);
    // end-anchored clip (cut the in, start 3) can move right to 10, not stick at 3.
    expect(g.clampSoundRepositionStart(3, 7, 30)).toBe(10);
    // the start itself never leaves the parent span (>= 0 and <= end - 1).
    expect(g.clampSoundRepositionStart(0, -5, 0)).toBe(0);
    expect(g.clampSoundRepositionStart(0, 5, 0)).toBe(0);
  });

  it('(t7) trim start moves start+in together, keeps min span 1 and start >= 0', async () => {
    const g = await load();
    // left end drags 3 frames left: start 7, in 2 — timeline end unchanged (65)
    expect(g.applyTrimStartSound(10, 5, 60, -3, 200)).toEqual({ startFrame: 7, inFrame: 2 });
    // in is already 0 -> the drag is blocked (in never goes below 0)
    expect(g.applyTrimStartSound(10, 0, 60, -5, 200)).toEqual({ startFrame: 10, inFrame: 0 });
    // rightward drags clamp to a 1-frame span (in = out - 1)
    expect(g.applyTrimStartSound(10, 5, 60, 100, 200)).toEqual({ startFrame: 64, inFrame: 59 });
    // start never below 0 when in would stay valid
    expect(g.applyTrimStartSound(2, 2, 60, -10, 200)).toEqual({ startFrame: 0, inFrame: 0 });
  });

  it('(t8) trim end clamps to a 1-frame span and the timeline end to the parent end', async () => {
    const g = await load();
    // normal: out + 10, timeline end 10 + (70-5) = 75 <= parentEnd 100
    expect(g.applyTrimEndSound(10, 5, 60, 10, 100)).toEqual({ outFrame: 70 });
    // parent-end clamp: out <= parentEnd - start + in = 95 -> timeline end 100
    expect(g.applyTrimEndSound(10, 5, 60, 50, 100)).toEqual({ outFrame: 95 });
    // min span: out >= in + 1 = 6
    expect(g.applyTrimEndSound(10, 5, 60, -100, 100)).toEqual({ outFrame: 6 });
    // UAT round 5: an already-overhanging clip (timeline end 10 + 27 = 37 >
    // parentEnd 30) must never be yanked back by touching the end handle —
    // the parent bound floors at 0, so out may shrink but not snap left.
    expect(g.applyTrimEndSound(10, 3, 30, 5, 30)).toEqual({ outFrame: 30 });
    expect(g.applyTrimEndSound(10, 3, 30, -4, 30)).toEqual({ outFrame: 26 });
  });
});

describe('soundBandGeometry — UAT round 4/5 overlays (waveform RGB 22 110 203, lightened overlay at 1px)', () => {
  it('(t13) the waveform fill and overlay stroke carry the exact RGB values the UAT asked for', async () => {
    const { SOUND_WAVEFORM_FILL, SOUND_OVERLAY_STROKE, SOUND_OVERLAY_STROKE_PX } = await load();
    expect(SOUND_WAVEFORM_FILL).toBe('#166ECB'); // RGB (22, 110, 203)
    // UAT round 5: the fade/gain stroke was lightened from #2DB3E3.
    expect(SOUND_OVERLAY_STROKE).toBe('#7DD3F5');
    expect(SOUND_OVERLAY_STROKE_PX).toBe(1); // thin like 1 pixel
  });

  it('(t14) the gain line maps +100 to the top, 0 to the CENTER, -100 to the bottom', async () => {
    const { soundGainLineY, SOUND_STAIN_HALF_EXTENT_PX } = await load();
    const centerY = 18;
    expect(soundGainLineY(0)).toBe(centerY);
    expect(soundGainLineY(100)).toBe(centerY - SOUND_STAIN_HALF_EXTENT_PX);
    expect(soundGainLineY(-100)).toBe(centerY + SOUND_STAIN_HALF_EXTENT_PX);
    expect(soundGainLineY(50)).toBe(centerY - SOUND_STAIN_HALF_EXTENT_PX / 2);
    // Out-of-range gains clamp (the slider is -100..100; the helper is fail-safe).
    expect(soundGainLineY(150)).toBe(soundGainLineY(100));
    expect(soundGainLineY(-150)).toBe(soundGainLineY(-100));
  });

  it('(t15) fade-in ramps bottom-left up to the GAIN line and bows with the curve type; null when zero', async () => {
    const { soundFadeInPathD, soundGainLineY, SOUND_STAIN_HALF_EXTENT_PX } = await load();
    const bottom = 18 + SOUND_STAIN_HALF_EXTENT_PX;
    // 24-frame span at 4px/frame = 96px; 6-frame fade -> a quarter = 24px.
    const linear = soundFadeInPathD(6, 0, 24, 96, 0, 'linear');
    expect(linear).not.toBeNull();
    expect(linear!.startsWith(`M0 ${bottom}`)).toBe(true);
    expect(linear!.endsWith(`L24 ${soundGainLineY(0)}`)).toBe(true);
    // The fade must land on the gain line, never past it (UAT round 4 #5):
    // the ramp stays between the silent edge and the gain line — it never
    // climbs to the top of the stain extent the way the round-3 diagonal did.
    const fadeYs = [...linear!.matchAll(/[ML][\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...fadeYs)).toBe(bottom);
    expect(Math.min(...fadeYs)).toBe(soundGainLineY(0));
    expect(Math.min(...fadeYs)).toBeGreaterThan(18 - SOUND_STAIN_HALF_EXTENT_PX);
    expect(soundFadeInPathD(0, 0, 24, 96, 0, 'linear')).toBeNull();
    // 261010-ht0 F1: fade-in samples fadeLoudnessIn, so exponential is the
    // true mirror of the user-liked fade-out (2t - t^2 — fast start / bows
    // OVER toward the gain line) and logarithmic bows UNDER (1 - sqrt(1-t)).
    // In=exp and Out=exp are visual mirrors with no curve-name pairing.
    const exponential = soundFadeInPathD(6, 0, 24, 96, 0, 'exponential')!;
    const logarithmic = soundFadeInPathD(6, 0, 24, 96, 0, 'logarithmic')!;
    const midY = (d: string): number => {
      const ys = [...d.matchAll(/[ML][\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
      return ys[Math.floor(ys.length / 2)];
    };
    expect(midY(exponential)).toBeLessThan(midY(linear!));
    expect(midY(logarithmic)).toBeGreaterThan(midY(linear!));
  });

  it('(t16) fade-out ramps from the gain line down to bottom-right and bows with the curve type; null when zero', async () => {
    const { soundFadeOutPathD, soundGainLineY, SOUND_STAIN_HALF_EXTENT_PX } = await load();
    const bottom = 18 + SOUND_STAIN_HALF_EXTENT_PX;
    // 24-frame span, 12-frame fade -> half the 96px width = 48px, starting at x=48.
    const linear = soundFadeOutPathD(12, 0, 24, 96, 0, 'linear');
    expect(linear).not.toBeNull();
    expect(linear!.startsWith(`M48 ${soundGainLineY(0)}`)).toBe(true);
    expect(linear!.endsWith(`L96 ${bottom}`)).toBe(true);
    expect(soundFadeOutPathD(0, 0, 24, 96, 0, 'linear')).toBeNull();
  });

  it('(t17) the gain line is clipped to the gap between active fades (UAT round 5); null when they meet', async () => {
    const { soundGainLineSpan } = await load();
    // No fades: the line runs the full width, "from in to out".
    expect(soundGainLineSpan(0, 0, 0, 24, 96)).toEqual({ x1: 0, x2: 96 });
    // 6-frame fade-in of a 24-frame span = 24px -> the line starts at x=24.
    expect(soundGainLineSpan(6, 0, 0, 24, 96)).toEqual({ x1: 24, x2: 96 });
    // 12-frame fade-out = 48px -> the line ends at x=48.
    expect(soundGainLineSpan(0, 12, 0, 24, 96)).toEqual({ x1: 0, x2: 48 });
    // Both fades leave the middle gap [24, 48].
    expect(soundGainLineSpan(6, 12, 0, 24, 96)).toEqual({ x1: 24, x2: 48 });
    // The fades meet exactly -> no gap -> the line is omitted entirely.
    expect(soundGainLineSpan(12, 12, 0, 24, 96)).toBeNull();
    // The fades overlap -> still no gap.
    expect(soundGainLineSpan(12, 24, 0, 24, 96)).toBeNull();
    // Degenerate span -> no line (the fades meet at a zero width).
    expect(soundGainLineSpan(0, 0, 0, 0, 0)).toBeNull();
  });
});

describe('soundBandGeometry — band surface source contract (plan acceptance criteria)', () => {
  // Every source assertion resolves to a BOOLEAN first so a failing TAP record
  // carries a tiny message (a full-file string dump breaks TAP YAML parsing).
  it('(t9) physicsPaintStudio.css carries the 36px band, the stain token, and the untouched playhead contract', () => {
    const css = readSource('../physicsPaintStudio.css');
    const band36 = (css.match(/flex: 0 0 36px/g) ?? []).length;
    expect(band36 >= 2).toBe(true);
    expect(css.includes('height: 36px')).toBe(true);
    expect(css.includes('--color-audio-stain: #2D5BE3')).toBe(true);
    const playheadAt = css.indexOf('.physics-paint-playhead-bar');
    expect(playheadAt >= 0).toBe(true);
    const playhead = css.slice(playheadAt, playheadAt + 300);
    expect(playhead.includes('pointer-events: none')).toBe(true);
    expect(playhead.includes('z-index: 30')).toBe(true);
  });

  it('(t10) the strip renderer carries the 36px chrome height and renders the stain behind the ticks', () => {
    const strip = readSource('./PhysicsPaintWorkflowStrip.tsx');
    expect(strip.includes('46 + 1 + 1 + 36 + 34 + 14 = 132')).toBe(true);
    expect(strip.includes('const STRIP_CHROME_HEIGHT_PX = 132')).toBe(true);
    // the stain layer is rendered BEFORE the tick spans (numbers stay on top)
    const stainAt = strip.indexOf('physics-paint-sound-stain');
    const tickAt = strip.indexOf('physics-paint-ruler-tick');
    expect(stainAt >= 0).toBe(true);
    expect(tickAt > stainAt).toBe(true);
    // launcher intent reaches the header column
    expect(strip.includes('onOpenDocumentSound')).toBe(true);
  });

  it('(t11) the gesture truth table is encoded at the handler level (T-52.5-13, UAT round 3)', () => {
    const strip = readSource('./PhysicsPaintWorkflowStrip.tsx');
    // UAT round 3: the clip and its trim handles are NEVER scrub targets —
    // both presses stop propagation before anything else.
    expect(/handleSoundStainPointerDown[\s\S]{0,400}?event\.stopPropagation\(\)/.test(strip)).toBe(true);
    expect(/handleSoundTrimZonePointerDown[\s\S]{0,400}?event\.stopPropagation\(\)/.test(strip)).toBe(true);
    // A clip drag never scrubs: no playhead navigation from the move handler.
    const moveAt = strip.indexOf('const handleSoundGesturePointerMove');
    expect(moveAt >= 0).toBe(true);
    const moveHandler = strip.slice(moveAt, moveAt + 1400);
    expect(moveHandler.includes('onNavigateToSyncedFrame')).toBe(false);
    // The sub-threshold tap selects only — never commits.
    const upHandler = strip.slice(strip.indexOf('const handleSoundGesturePointerUp'), strip.indexOf('const handleSoundGesturePointerUp') + 700);
    expect(/if \(!session\.armed\) \{/.test(upHandler)).toBe(true);
    // The playhead carries the dedicated scrub handle.
    expect(strip.includes('physics-paint-playhead-handle')).toBe(true);
    // UAT round 6 + 261008-ig1 Task 2: double-clicking the clip opens THAT
    // clip through the dedicated clip port — the header launcher port is
    // never fired from the band.
    expect(strip).toContain('props.onDocumentSoundDblClick?.(clip.id)');
    expect(strip.includes('props.onOpenDocumentSound?.()')).toBe(false);
  });

  it('(t12) the launcher is a 24x26 nav button with the Document sound label and AudioWaveform icon', () => {
    const row = readSource('./PhysicsPaintTrackRow.tsx');
    expect(row.includes('aria-label="Document sound"')).toBe(true);
    expect(row.includes('AudioWaveform')).toBe(true);
    expect(row.includes('physics-paint-nav-button')).toBe(true);
    expect(/hasSound[\s\S]{0,400}?onOpenDocumentSound/.test(row)).toBe(true);
  });
});
