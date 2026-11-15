// ============================================================
//  builtinBake — the one-off authoring step that turns the
//  user-supplied source art into `builtinTipMasks.generated.ts`
//  (63-03 / T-63-10, T-63-14).
//
//  Env-gated by design: the default package run performs NO file
//  write and NO child process. This file must still register one
//  named skipped test when the gate is unset — Vitest fails a
//  collected file that registers no test, and the package `test`
//  script collects it.
//
//  Run it with:
//    BAKE_BUILTIN_TIPS=1 pnpm --filter @efxlab/efx-watercolor \
//      exec vitest run src/brushes/builtinBake.test.ts
//
//  The bake owns NO private conversion: each asset goes through
//  `deriveMask` (the same two-branch law as import, D-09) and
//  `normalizeMaskContrast` (the bake-only stretch, D-08). The
//  registry / brush-bridge imports are dynamic ON PURPOSE — they
//  are loaded after the generated module is written, so the run
//  proves the artifact it just produced, not a stale one.
// ============================================================

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { deriveMask, normalizeMaskContrast, TIP_MASK_BYTES } from './deriveMask'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../..')
const ASSETS_DIR = join(REPO_ROOT, 'SPECS/v2.2.0-brush-tips/assets')
const GENERATED_PATH = join(HERE, 'builtinTipMasks.generated.ts')

/** D-07 mapping, fixed: asset → constant → tip id → label. */
const BAKE_TARGETS = [
  {
    asset: 'Paint_Brush_sb4tebyp_1K_Brush.jpg',
    constant: 'BRISTLE_MASK_BASE64',
    id: 'wc/builtin-bristle',
    label: 'Bristle fan',
  },
  {
    asset: 'Paint_Brush_sb5qdgop_1K_Brush.jpg',
    constant: 'CHALK_MASK_BASE64',
    id: 'wc/builtin-chalk',
    label: 'Chalk grain',
  },
  {
    asset: 'Paint_Brush_scmeagrp_1K_Brush.jpg',
    constant: 'SPONGE_MASK_BASE64',
    id: 'wc/builtin-sponge',
    label: 'Sponge',
  },
] as const

/** Parse the BMP `sips` emits: 24-bit BGR (padding-aware) or 32-bit BGRA. */
function parseSipsBmp(buffer: Buffer): { width: number; height: number; rgba: Uint8Array } {
  if (buffer.length < 54) throw new Error('BMP header truncated')
  if (buffer.toString('ascii', 0, 2) !== 'BM') throw new Error('not a BMP file')
  const pixelOffset = buffer.readUInt32LE(10)
  const headerSize = buffer.readUInt32LE(14)
  if (headerSize < 40) throw new Error(`unsupported BMP header size ${headerSize}`)
  const width = buffer.readInt32LE(18)
  const rawHeight = buffer.readInt32LE(22)
  const bitsPerPixel = buffer.readUInt16LE(28)
  const compression = buffer.readUInt32LE(30)
  if (compression !== 0) throw new Error(`compressed BMP unsupported (${compression})`)
  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new Error(`unsupported BMP depth ${bitsPerPixel}`)
  }
  const height = Math.abs(rawHeight)
  const topDown = rawHeight < 0
  const bytesPerPixel = bitsPerPixel / 8
  const stride = Math.floor((bitsPerPixel * width + 31) / 32) * 4
  if (buffer.length < pixelOffset + stride * height) throw new Error('BMP pixel data truncated')
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const rowStart = pixelOffset + (topDown ? y : height - 1 - y) * stride
    for (let x = 0; x < width; x += 1) {
      const source = rowStart + x * bytesPerPixel
      const dest = (y * width + x) * 4
      rgba[dest] = buffer[source + 2]
      rgba[dest + 1] = buffer[source + 1]
      rgba[dest + 2] = buffer[source]
      rgba[dest + 3] = bitsPerPixel === 32 ? buffer[source + 3] : 255
    }
  }
  // BI_RGB 32-bit files often leave the fourth byte unused (zero). An
  // all-zero alpha channel is an unused slot, not a transparent image:
  // treat it as opaque so the derivation law sees RGB, not alpha.
  if (bitsPerPixel === 32) {
    let sawAlpha = false
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] !== 0) {
        sawAlpha = true
        break
      }
    }
    if (!sawAlpha) for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
  }
  return { width, height, rgba }
}

if (process.env.BAKE_BUILTIN_TIPS === '1') {
  it('bakes builtin tips from the supplied source art', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'bake-builtin-tips-'))
    try {
      const constants: Record<string, string> = {}
      for (const target of BAKE_TARGETS) {
        const source = join(ASSETS_DIR, target.asset)
        const bmpPath = join(workDir, `${target.id.replace(/[^a-z0-9]+/gi, '-')}.bmp`)
        execFileSync(
          'sips',
          ['--resampleHeightWidth', '192', '192', '-s', 'format', 'bmp', source, '--out', bmpPath],
          { stdio: 'pipe' },
        )
        const parsed = parseSipsBmp(readFileSync(bmpPath))
        expect(parsed.width).toBe(192)
        expect(parsed.height).toBe(192)
        const derived = deriveMask(parsed.rgba)
        if (derived === null) {
          throw new Error(`${target.id}: deriveMask refused the ${parsed.width}x${parsed.height} RGBA buffer`)
        }
        const normalized = normalizeMaskContrast(derived)
        expect(normalized.length).toBe(TIP_MASK_BYTES)
        let min = 255
        let max = 0
        for (const value of normalized) {
          if (value < min) min = value
          if (value > max) max = value
        }
        expect(min).toBe(0)
        expect(max).toBe(255)
        constants[target.constant] = Buffer.from(normalized).toString('base64')
      }

      const moduleSource = [
        '// Generated by src/brushes/builtinBake.test.ts from the user-supplied source art.',
        '// Do not edit by hand. Re-run:',
        '//   BAKE_BUILTIN_TIPS=1 pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/builtinBake.test.ts',
        '//',
        '// One-off conversion (D-06 .. D-09): each 1024x1024 JPEG is downscaled to 192x192 with',
        '// `sips --resampleHeightWidth 192 192`, parsed from BMP, assembled into RGBA, passed',
        '// through deriveMask (the same two-branch law as import) and then normalizeMaskContrast',
        '// (the bake-only stretch to the full 0..255 range). No blur, no denoise, no runtime',
        '// generator: these constants are the tip.',
        '',
        ...BAKE_TARGETS.map(
          (target) => `export const ${target.constant} =\n  '${constants[target.constant]}'`,
        ),
        '',
      ].join('\n')
      writeFileSync(GENERATED_PATH, moduleSource)

      // Prove the written artifact by decoding the file itself.
      const written = readFileSync(GENERATED_PATH, 'utf8')
      expect((written.match(/^export /gm) ?? []).length).toBe(3)
      const writtenConstants = new Map(
        [...written.matchAll(
          /export const (BRISTLE_MASK_BASE64|CHALK_MASK_BASE64|SPONGE_MASK_BASE64)\s*=\s*'([^']+)'/g,
        )].map((match) => [match[1]!, match[2]!]),
      )
      expect(writtenConstants.size).toBe(3)

      const decoded: { id: string; mask: Uint8Array }[] = []
      for (const target of BAKE_TARGETS) {
        const constant = writtenConstants.get(target.constant)
        if (constant === undefined) {
          throw new Error(`${target.constant} missing from the generated module`)
        }
        const mask = new Uint8Array(Buffer.from(constant, 'base64'))
        expect(mask.length).toBe(TIP_MASK_BYTES)
        decoded.push({ id: target.id, mask })
      }

      // End-to-end: the artifact just written is the tip the engine paints.
      // WR-05 (63-13): a built-in id admits ONLY the compile-time allocation,
      // so the freshly decoded copy is refused by the registry on purpose —
      // BYTE equality against the shipped mask is the proof that the baked
      // constant and the mask the engine installs are the same tip.
      const { resetMaskRegistry } = await import('./maskRegistry')
      const { BUILTIN_TIP_MASKS } = await import('./builtinTips')
      const { buildBrushForStroke } = await import('../playground/brushBridge')
      resetMaskRegistry()
      const bristle = decoded.find((entry) => entry.id === 'wc/builtin-bristle')
      if (bristle === undefined) throw new Error('bristle mask missing from the baked set')
      const shipped = BUILTIN_TIP_MASKS.find((entry) => entry.id === 'wc/builtin-bristle')
      if (shipped === undefined) throw new Error('bristle mask missing from the shipped set')
      const brush = buildBrushForStroke('round', { textureId: 'wc/builtin-bristle' })
      expect(brush.tipSize).toBe(192)
      expect(brush.tipData === shipped.mask).toBe(true)
      expect(Buffer.from(brush.tipData).equals(Buffer.from(bristle.mask))).toBe(true)
      expect(brush.tipData.length).toBe(TIP_MASK_BYTES)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  })
} else {
  it.skip('bakes builtin tips (set BAKE_BUILTIN_TIPS=1 to run)', () => {})
}
