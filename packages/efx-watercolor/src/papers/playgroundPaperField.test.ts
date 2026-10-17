// ============================================================
//  playgroundPaperField — port pins (261017-ki6).
//
//  Laws pinned here:
//    - the port is a 1:1 transliteration: primitive names and
//      per-kind salt constants survive in the source string
//      (T-261017-KI6-01 — a tidied constant changes the look
//      without failing a runtime pin)
//    - PAPER_UNITS = 1100 (playground Engine.ts:133)
//    - per-kind determinism: same (kind, seed, W, H) ⇒ same bytes
//    - no tiling: column 0 differs from column N
//    - scale law: uScale is consumed; constant physical size
//    - paperLight packs g = height and r moves with bump
//
//  Assertion style: scalar predicates (boolean/primitive toBe).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAPER_PRESETS,
  PAPER_UNITS,
  PROCEDURAL_PAPER_IDS,
  linearRGB,
  paperColour,
  paperField,
  paperFieldMap,
  paperHeightMap,
  paperLight,
  presetForPaperId,
  renderPaperSheet,
  toSRGBChannel,
} from './playgroundPaperField';

const root = resolve(__dirname);
const source = readFileSync(resolve(root, 'playgroundPaperField.ts'), 'utf8');

function bytesHash(values: ArrayLike<number>): number {
  const bytes = new Uint8Array(
    values instanceof Float32Array
      ? values.buffer.slice(values.byteOffset, values.byteOffset + values.byteLength)
      : (() => {
          const buf = new ArrayBuffer(values.length);
          const view = new Float32Array(buf);
          for (let i = 0; i < values.length; i++) view[i] = values[i];
          return buf;
        })(),
  );
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

describe('playgroundPaperField source-scan (T-261017-KI6-01)', () => {
  it('ported primitive names are present and used', () => {
    for (const name of ['pcg', 'hash', 'hash2', 'vnoise', 'fbm', 'cells', 'blobs', 'segment', 'fibres', 'specks', 'hexDist', 'warp']) {
      expect(source.includes(`function ${name}(`)).toBe(true);
    }
    // used, not just declared
    expect(source).toContain('warp(px, py, 0.02, 10.0, 100.0');
    expect(source).toContain('fbm(');
    expect(source).toContain('blobs(');
    expect(source).toContain('fibres(');
  });

  it('fbm keeps the oracle rotate-scale (mat2 0.8/-0.6/0.6/0.8, * 2.03 + 17.1)', () => {
    expect(source).toContain('0.8 * px + 0.6 * py');
    expect(source).toContain('-0.6 * px + 0.8 * py');
    expect(source).toContain('2.03');
    expect(source).toContain('17.1');
    expect(source).toContain('salt + i * 13.0');
  });

  it('blobs keeps the 0.75 factor and hexDist the 1.7320508 lattice', () => {
    expect(source).toContain('h * 0.75');
    expect(source).toContain('1.7320508');
    expect(source).toContain('0.35 + 0.4');
    expect(source).toContain('width * 0.5 + 0.9');
    expect(source).toContain('k * 31.0');
    expect(source).toContain('salt + 50.0');
  });

  it('coldPress salts survive (kind 0)', () => {
    // warp(p, 0.02, 10.0, 100.0) / blobs(q/11.0, 110.0) / blobs(q/5.5, 115.0)
    // / fbm(q*0.09, 5, 120.0) / vnoise(p*0.5, 130.0) / fbm(p*0.012, 4, 140.0)
    expect(source).toContain('0.02, 10.0, 100.0');
    expect(source).toContain('11.0, qy / 11.0, 110.0');
    expect(source).toContain('5.5, qy / 5.5, 115.0');
    expect(source).toContain('0.09');
    expect(source).toContain('120.0');
    expect(source).toContain('0.5, 130.0');
    expect(source).toContain('0.012');
    expect(source).toContain('140.0');
  });

  it('hotPress salts survive (kind 1)', () => {
    expect(source).toContain('0.06');
    expect(source).toContain('200.0');
    expect(source).toContain('210.0');
    expect(source).toContain('16.0, 2.5, 0.8, 0.3, 0.0, 220.0');
    expect(source).toContain('230.0');
  });

  it('rough salts survive (kind 2)', () => {
    expect(source).toContain('0.01, 40.0, 300.0');
    expect(source).toContain('26.0, qy / 26.0, 310.0');
    expect(source).toContain('12.0, qy / 12.0, 315.0');
    expect(source).toContain('305.0');
    expect(source).toContain('320.0');
    expect(source).toContain('325.0');
    expect(source).toContain('330.0');
  });

  it('khadi salts survive (kind 3)', () => {
    expect(source).toContain('0.008, 60.0, 400.0');
    expect(source).toContain('410.0');
    expect(source).toContain('13.0');
    expect(source).toContain('420.0');
    expect(source).toContain('0.05, 8.0, 430.0');
    expect(source).toContain('440.0');
    expect(source).toContain('450.0');
    expect(source).toContain('60.0, 2.0, 0.3, 460.0');
    expect(source).toContain('0.06, 10.0, 465.0');
    expect(source).toContain('110.0, 0.4, 0.9, 0.3, 0.0, 470.0');
    expect(source).toContain('480.0');
  });

  it('washi salts survive (kind 4)', () => {
    expect(source).toContain('0.025, 28.0, 500.0');
    expect(source).toContain('42.0, 3.4, 1.3, 0.4, 0.0, 510.0');
    expect(source).toContain('512.0');
    expect(source).toContain('0.05, 10.0, 515.0');
    expect(source).toContain('14.0, 3.0, 0.6, 0.45, 0.0, 520.0');
    expect(source).toContain('530.0');
    expect(source).toContain('540.0');
    expect(source).toContain('70.0, 1.6, 0.18, 550.0');
  });

  it('laid salts survive (kind 5)', () => {
    expect(source).toContain('600.0');
    expect(source).toContain('/ 5.6');
    expect(source).toContain('610.0');
    expect(source).toContain('140.0');
    expect(source).toContain('620.0');
    expect(source).toContain('630.0');
  });

  it('canvas salts survive (kind 6)', () => {
    expect(source).toContain('702.0');
    expect(source).toContain('704.0');
    expect(source).toContain('706.0');
    expect(source).toContain('700.0');
    expect(source).toContain('701.0');
    expect(source).toContain('T * 1.2');
    expect(source).toContain('2.3');
    expect(source).toContain('1.15');
  });

  it('toned salts survive (kind 7)', () => {
    expect(source).toContain('0.05, 7.0, 800.0');
    expect(source).toContain('805.0');
    expect(source).toContain('810.0');
    expect(source).toContain('12.0, 2.0, 0.9, 0.35, 0.0, 820.0');
    expect(source).toContain('830.0');
    expect(source).toContain('60.0, 1.2, 0.2, 840.0');
  });

  it('kraft salts survive (kind 8)', () => {
    expect(source).toContain('900.0');
    expect(source).toContain('910.0');
    expect(source).toContain('10.0, 2.5, 0.9, 0.6, 0.7, 920.0');
    expect(source).toContain('930.0');
    expect(source).toContain('0.08, 10.0, 935.0');
    expect(source).toContain('60.0, 0.35, 0.7, 0.2, 0.6, 940.0');
    expect(source).toContain('40.0, 1.3, 0.35, 950.0');
    expect(source).toContain('0.08, 10.0, 955.0');
    expect(source).toContain('70.0, 0.4, 1.0, 0.25, 0.5, 960.0');
    expect(source).toContain('970.0');
  });

  it('student salts survive (kind 9)', () => {
    expect(source).toContain('0.03, 3.0, 995.0');
    expect(source).toContain('7.0');
    expect(source).toContain('1000.0');
    expect(source).toContain('1010.0');
    expect(source).toContain('1020.0');
    expect(source).toContain('0.7');
  });

  it('paperLightFS law survives (L = normalize(-0.5, 0.6, 0.62), * 1.3, * 0.25, * 1.4)', () => {
    expect(source).toContain('-0.5 / L_LEN');
    expect(source).toContain('0.6 / L_LEN');
    expect(source).toContain('0.62 / L_LEN');
    expect(source).toContain('* 1.3');
    expect(source).toContain('* 0.25');
    expect(source).toContain('preset.bump * 1.4');
  });

  it('PAPER_COLOUR law survives (0.32, * 2.0, * 1.1 + 0.02)', () => {
    expect(source).toContain('* 0.32');
    expect(source).toContain('mottle * 2.0');
    expect(source).toContain('* 1.1 + 0.02');
    expect(source).toContain('12.92');
    expect(source).toContain('0.0031308');
    expect(source).toContain('1.055');
  });

  it('no Math.random anywhere in the port (pure function of x, y, scale, seed, kind)', () => {
    expect(source.includes('Math.random')).toBe(false);
  });
});

describe('PAPER_UNITS and presets', () => {
  it('exports PAPER_UNITS = 1100 (playground Engine.ts:133)', () => {
    expect(PAPER_UNITS).toBe(1100);
  });

  it('PAPER_PRESETS has the 10 studio ids with playground kinds 0..9', () => {
    expect(PAPER_PRESETS.length).toBe(10);
    const kinds = PAPER_PRESETS.map((p) => p.kind).join('|');
    expect(kinds).toBe('0|1|2|3|4|5|6|7|8|9');
    const ids = PAPER_PRESETS.map((p) => p.id).join('|');
    expect(ids).toBe(PROCEDURAL_PAPER_IDS.join('|'));
  });

  it('preset table matches playground papers.ts bump/mottle/tint/fleck', () => {
    const byId = new Map(PAPER_PRESETS.map((p) => [p.id, p]));
    expect(byId.get('paper/cold-press')).toMatchObject({ kind: 0, bump: 1.0, mottle: 0.05, tint: '#f6f3ec', fleck: '#8a8070' });
    expect(byId.get('paper/hot-press')).toMatchObject({ kind: 1, bump: 0.6, mottle: 0.04, tint: '#f8f7f3', fleck: '#8a8478' });
    expect(byId.get('paper/rough')).toMatchObject({ kind: 2, bump: 0.8, mottle: 0.06, tint: '#f5f1e8', fleck: '#857a68' });
    expect(byId.get('paper/khadi')).toMatchObject({ kind: 3, bump: 1.0, mottle: 0.12, tint: '#efe7d6', fleck: '#6d5f4a' });
    expect(byId.get('paper/washi')).toMatchObject({ kind: 4, bump: 0.8, mottle: 0.14, tint: '#f1ece0', fleck: '#7a6a52' });
    expect(byId.get('paper/laid')).toMatchObject({ kind: 5, bump: 1.0, mottle: 0.05, tint: '#f2ebdb', fleck: '#8a7c64' });
    expect(byId.get('paper/canvas')).toMatchObject({ kind: 6, bump: 1.0, mottle: 0.04, tint: '#f3efe6', fleck: '#8a8070' });
    expect(byId.get('paper/toned-sand')).toMatchObject({ kind: 7, bump: 1.0, mottle: 0.06, tint: '#d9c8a6', fleck: '#6e5f45' });
    expect(byId.get('paper/kraft')).toMatchObject({ kind: 8, bump: 0.8, mottle: 0.12, tint: '#b99872', fleck: '#4e3b28' });
    expect(byId.get('paper/student')).toMatchObject({ kind: 9, bump: 1.0, mottle: 0.03, tint: '#f7f7f4', fleck: '#8a8a84' });
    expect(presetForPaperId('paper/nope')).toBe(null);
    expect(presetForPaperId('paper/cold-press')!.kind).toBe(0);
  });

  it('linearRGB and toSRGBChannel round-trip the playground conversions', () => {
    const lin = linearRGB('#f6f3ec');
    expect(lin[0] > 0.9 && lin[0] < 1).toBe(true);
    expect(toSRGBChannel(lin[0]) * 255).toBeGreaterThan(240);
  });
});

describe('paperField determinism / no tiling / scale law', () => {
  it('per-kind determinism: same (kind, seed, W, H) ⇒ identical bytes', () => {
    const ok = PAPER_PRESETS.every((preset) => {
      const a = paperFieldMap(24, 24, PAPER_UNITS / 24, 1, preset.kind);
      const b = paperFieldMap(24, 24, PAPER_UNITS / 24, 1, preset.kind);
      return bytesHash(a.height) === bytesHash(b.height);
    });
    expect(ok).toBe(true);
  });

  it('different kinds yield different height fields', () => {
    const hashes = PAPER_PRESETS.map((preset) =>
      bytesHash(paperFieldMap(32, 32, PAPER_UNITS / 32, 1, preset.kind).height),
    );
    expect(new Set(hashes).size).toBe(10);
  });

  it('no tiling: at 64×64 column 0 of the height field differs from column 32', () => {
    const map = paperFieldMap(64, 64, PAPER_UNITS / 64, 1, 0);
    let anyDiffers = false;
    for (let y = 0; y < 64; y++) {
      if (map.height[y * 64] !== map.height[y * 64 + 32]) {
        anyDiffers = true;
        break;
      }
    }
    expect(anyDiffers).toBe(true);
  });

  it('scale is consumed: paperField at scale 0.5 differs from scale 1', () => {
    // At a non-origin texel — the origin maps to paper (0,0) at any scale.
    const a = paperField(10, 7, 0.5, 1, 0);
    const b = paperField(10, 7, 1, 1, 0);
    const differs = a.height !== b.height || a.mottle !== b.mottle || a.fleck !== b.fleck;
    expect(differs).toBe(true);
  });

  it('physical-size law: 32×32 and 64×64 at uScale = PAPER_UNITS / h share a comparable mid-tone', () => {
    const s32 = renderPaperSheet(32, 32, PAPER_UNITS / 32, 1, PAPER_PRESETS[0]);
    const s64 = renderPaperSheet(64, 64, PAPER_UNITS / 64, 1, PAPER_PRESETS[0]);
    const mean = (rgba: Uint8ClampedArray): number => {
      let total = 0;
      let n = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        total += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
        n++;
      }
      return total / n;
    };
    const m32 = mean(s32);
    const m64 = mean(s64);
    expect(m32 > 120 && m32 < 250).toBe(true);
    expect(m64 > 120 && m64 < 250).toBe(true);
    expect(Math.abs(m32 - m64) < 40).toBe(true);
  });

  it('field output stays in [0, 1]', () => {
    for (const preset of PAPER_PRESETS) {
      const map = paperFieldMap(16, 16, PAPER_UNITS / 16, 2, preset.kind);
      let ok = true;
      for (let i = 0; i < map.height.length; i++) {
        if (
          !(map.height[i] >= 0 && map.height[i] <= 1) ||
          !(map.mottle[i] >= 0 && map.mottle[i] <= 1) ||
          !(map.fleck[i] >= 0 && map.fleck[i] <= 1)
        ) {
          ok = false;
          break;
        }
      }
      expect(ok).toBe(true);
    }
  });

  it('offset shifts the field (the target sits at a place on the sheet)', () => {
    const a = paperField(0, 0, 1, 1, 0, 0, 0);
    const b = paperField(0, 0, 1, 1, 0, 40, 0);
    expect(a.height === b.height && a.mottle === b.mottle && a.fleck === b.fleck).toBe(false);
  });
});

describe('paperLight packing (paperLightFS)', () => {
  it('g channel is the input height', () => {
    const field = paperFieldMap(8, 8, PAPER_UNITS / 8, 1, 0);
    const lit = paperLight(field, 8, 8, 1.4, 1);
    let ok = true;
    for (let i = 0; i < 64; i++) {
      const expected = field.height[i] * 255;
      const actual = lit[i * 4 + 1];
      if (Math.abs(expected - actual) > 1.5) {
        ok = false;
        break;
      }
    }
    expect(ok).toBe(true);
  });

  it('r moves with the bump (bump 0 vs bump 2 differ)', () => {
    const field = paperFieldMap(16, 16, PAPER_UNITS / 16, 1, 0);
    const flat = paperLight(field, 16, 16, 0, 1);
    const bumpy = paperLight(field, 16, 16, 2, 1);
    let anyDiffers = false;
    for (let i = 0; i < 256; i++) {
      if (flat[i * 4] !== bumpy[i * 4]) {
        anyDiffers = true;
        break;
      }
    }
    expect(anyDiffers).toBe(true);
  });

  it('packs r/g/b/a = lit / height / mottle / fleck', () => {
    const field = paperFieldMap(4, 4, PAPER_UNITS / 4, 1, 0);
    const lit = paperLight(field, 4, 4, 1, 1);
    const o = 5 * 4;
    expect(Math.abs(lit[o + 1] - field.height[5] * 255) < 1.5).toBe(true);
    expect(Math.abs(lit[o + 2] - field.mottle[5] * 255) < 1.5).toBe(true);
    expect(Math.abs(lit[o + 3] - field.fleck[5] * 255) < 1.5).toBe(true);
  });
});

describe('paperColour (PAPER_COLOUR) + paperHeightMap', () => {
  it('neutral texel (0.5, 0.5, 0.5, 0.5) returns the base tint', () => {
    const tint = linearRGB('#f6f3ec');
    const out = paperColour({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }, tint, tint, 0.05, 1);
    expect(Math.abs(out[0] - tint[0]) < 1e-9).toBe(true);
    expect(Math.abs(out[1] - tint[1]) < 1e-9).toBe(true);
    expect(Math.abs(out[2] - tint[2]) < 1e-9).toBe(true);
  });

  it('textureStrength 0 is a flat sheet of the tint', () => {
    const tint = linearRGB('#f6f3ec');
    const fleck = linearRGB('#8a8070');
    const out = paperColour({ r: 0.9, g: 0.2, b: 0.8, a: 0.1 }, tint, fleck, 0.5, 0);
    expect(Math.abs(out[0] - tint[0]) < 1e-9).toBe(true);
  });

  it('paperHeightMap is total: unknown id / bad sizes / bad scale return null', () => {
    expect(paperHeightMap('paper/nope', 1, 8, 8, 1)).toBe(null);
    expect(paperHeightMap('paper/cold-press', 1, 0, 8, 1)).toBe(null);
    expect(paperHeightMap('paper/cold-press', 1, 8, -4, 1)).toBe(null);
    expect(paperHeightMap('paper/cold-press', 1, 8.5, 8, 1)).toBe(null);
    expect(paperHeightMap('paper/cold-press', Number.NaN, 8, 8, 1)).toBe(null);
    expect(paperHeightMap('paper/cold-press', 1, 8, 8, 0)).toBe(null);
    expect(paperHeightMap('paper/cold-press', 1, 8, 8, Number.NaN)).toBe(null);
  });

  it('paperHeightMap yields the field height and is deterministic', () => {
    const a = paperHeightMap('paper/cold-press', 1, 16, 16, PAPER_UNITS / 16)!;
    const b = paperHeightMap('paper/cold-press', 1, 16, 16, PAPER_UNITS / 16)!;
    expect(a).not.toBe(null);
    expect(a.length).toBe(256);
    expect(bytesHash(a)).toBe(bytesHash(b));
  });
});
